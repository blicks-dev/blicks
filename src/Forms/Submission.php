<?php
/**
 * One send of a form, checked in order.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Request;
use WP_REST_Response;

/**
 * The submit route's work, in the order the contract fixes
 * (docs/blicks/plans/form-contracts.md, "Order of checks in submit"):
 *
 * 1. find the saved form — its fields and actions come from there, never from the request (404);
 * 2. rate limit, before anything expensive (429); then the request must come from this site (403);
 * 3. a no-JavaScript post: kept as Spam, not emailed, 303 back to the page;
 * 4. the token: signed, this form and post, old enough, young enough, unused (403);
 * 5. the trap field: filled means a bot — told it worked, kept as Spam;
 * 6. values validated and cleaned by type, unknown names dropped (422);
 * 7. the challenge, when the form has one: failed means Spam, unreachable means a note;
 * 8. save, email (not Spam), then `blicks_form_sent` for companions.
 *
 * Companions shape a send through filters, run in this order: `blicks_form_values` right after
 * validation, `blicks_form_errors` before the 422, `blicks_form_entry` before the entry is
 * stored, and `blicks_form_response` on an accepted send's reply.
 */
final class Submission {

	private const FORM_TYPES = [ 'application/x-www-form-urlencoded', 'multipart/form-data' ];

	public static function handle( WP_REST_Request $request ): WP_REST_Response {
		$formId = Schema::uid( (string) $request->get_param( 'form' ) );
		$noJs = self::isPlainPost( $request );
		$post = absint( $noJs ? $request->get_param( '_bl_post' ) : $request->get_param( 'post' ) );

		// 1. The saved form.
		$form = '' !== $formId ? Locator::find( $formId, $post ) : null;

		if ( null === $form ) {
			return new WP_REST_Response( [ 'status' => 'missing' ], 404 );
		}

		// 2. Rate limit, then the request's origin.
		if ( ! RateLimit::hit( $formId ) ) {
			return new WP_REST_Response( [ 'status' => 'busy' ], 429 );
		}

		if ( ! self::sameSite( $request ) ) {
			return self::expired();
		}

		$settings = $form['settings'];
		$fields = $form['fields'];

		// 3. Sent without JavaScript: no token is possible. Kept for the owner to look at.
		if ( $noJs ) {
			$checked = self::validate( $fields, $request->get_body_params(), $form );
			self::store( $request, $form, $post, $checked['values'], 'spam', [ __( 'Sent without JavaScript', 'blicks' ) ], 'none' );

			$response = new WP_REST_Response( [ 'status' => 'sent' ], 303 );
			$response->header( 'Location', self::returnUrl( $post, $formId ) );

			return $response;
		}

		// 4. The token.
		$token = $request->get_param( 'token' );
		$token = is_string( $token ) ? $token : '';

		if ( '' !== Token::check( $token, $formId, $post, (int) $settings['spam']['minSeconds'] ) ) {
			return self::expired();
		}

		$input = $request->get_param( 'fields' );
		$input = is_array( $input ) ? $input : [];
		$checked = self::validate( $fields, $input, $form );

		// 5. The trap: a person never sees it. A bot is told it worked.
		$hp = $request->get_param( 'hp' );

		if ( is_string( $hp ) && '' !== trim( $hp ) ) {
			if ( ! Token::spend( $token ) ) {
				return self::expired();
			}

			self::store( $request, $form, $post, $checked['values'], 'spam', [ __( 'Trap field filled', 'blicks' ) ], 'none' );

			return self::sent( $settings );
		}

		// 6. Values.
		$errors = self::errors( $checked['errors'], $checked['values'], $form );

		if ( [] !== $errors ) {
			return new WP_REST_Response(
				[
					'status' => 'invalid',
					'errors' => $errors,
				],
				422
			);
		}

		// The token is spent only by a send that is accepted, so fixing a field needs no new one.
		if ( ! Token::spend( $token ) ) {
			return self::expired();
		}

		// 7. The challenge.
		$status = 'new';
		$notes = [];
		$challenge = 'none';
		$kind = (string) $settings['spam']['challenge'];

		if ( 'none' !== $kind ) {
			$answer = $request->get_param( 'challenge' );
			// The form's own threshold when it set one, else the site-wide one from Settings › Forms.
			$result = Challenge::verify( $kind, is_string( $answer ) ? $answer : '', FormRenderer::minScore( is_array( $form['block']['attrs'] ?? null ) ? $form['block']['attrs'] : [] ) );
			$challenge = in_array( $result['result'] ?? '', [ 'pass', 'fail', 'unchecked' ], true ) ? (string) $result['result'] : 'unchecked';

			if ( 'fail' === $challenge ) {
				$status = 'spam';
				$notes[] = is_string( $result['note'] ?? null ) && '' !== $result['note'] ? $result['note'] : __( 'Challenge failed', 'blicks' );
			} elseif ( 'unchecked' === $challenge ) {
				$notes[] = __( 'Challenge not checked', 'blicks' );
			}
		}

		// 8. Actions.
		$values = $checked['values'];
		$entryId = self::store( $request, $form, $post, $values, $status, $notes, $challenge );

		if ( 'spam' === $status ) {
			return self::sent( $settings );
		}

		if ( true === $settings['email']['on'] ) {
			Mailer::send( $form, $values, $entryId, self::pageUrl( $request, $post ) );
		}

		/**
		 * A form was sent and accepted (never for Spam). Companions add lists and webhooks here.
		 *
		 * @param int                                 $entryId The stored entry, 0 when the form does not save entries.
		 * @param array<string, mixed>                $form    The saved form: block, settings, fields, post, title.
		 * @param array<string, mixed>                $values  The validated values, after `blicks_form_values`.
		 */
		do_action( 'blicks_form_sent', $entryId, $form, $values );

		return self::sent( $settings, $entryId, $form );
	}

	/**
	 * Validated values, then `blicks_form_values`.
	 *
	 * @param list<array<string, mixed>> $fields
	 * @param array<mixed>               $input
	 * @param array<string, mixed>       $form
	 * @return array{values: array<string, mixed>, errors: array<string, string>}
	 */
	private static function validate( array $fields, array $input, array $form ): array {
		$checked = Validator::validate( $fields, $input );

		/**
		 * The values of a send, validated and cleaned, before anything else reads them: drop a
		 * value, recompute one. Runs on every send that reaches validation, Spam included.
		 *
		 * @param array<string, mixed> $values Field name => cleaned value.
		 * @param array<string, mixed> $form   The saved form: block, settings, fields, post, title.
		 */
		$values = apply_filters( 'blicks_form_values', $checked['values'], $form );

		return [
			'values' => is_array( $values ) ? $values : $checked['values'],
			'errors' => $checked['errors'],
		];
	}

	/**
	 * The field errors, then `blicks_form_errors`. Any left means a 422.
	 *
	 * @param array<string, string> $errors
	 * @param array<string, mixed>  $values
	 * @param array<string, mixed>  $form
	 * @return array<string, string>
	 */
	private static function errors( array $errors, array $values, array $form ): array {
		/**
		 * The errors of a send, field name => message, for checks of a companion's own. Leave one
		 * and the send is refused (422) with it, shown on that field.
		 *
		 * @param array<string, string> $errors Field name => message, from the validator.
		 * @param array<string, mixed>  $values The values, after `blicks_form_values`.
		 * @param array<string, mixed>  $form   The saved form.
		 */
		$filtered = apply_filters( 'blicks_form_errors', $errors, $values, $form );
		$out = [];

		foreach ( is_array( $filtered ) ? $filtered : $errors as $name => $message ) {
			if ( is_string( $name ) && '' !== $name && is_scalar( $message ) ) {
				$out[ $name ] = sanitize_text_field( (string) $message );
			}
		}

		return $out;
	}

	/**
	 * Save the entry, when the form saves entries.
	 *
	 * @param array<string, mixed>                $form
	 * @param array<string, mixed> $values
	 * @param list<string>         $notes
	 */
	private static function store( WP_REST_Request $request, array $form, int $post, array $values, string $status, array $notes, string $challenge ): int {
		if ( true !== $form['settings']['save'] ) {
			return 0;
		}

		// Only the fields that have a value: a field no plugin registers leaves no trace.
		$labels = [];
		$definitions = [];

		foreach ( $form['fields'] as $field ) {
			$name = (string) $field['name'];

			if ( array_key_exists( $name, $values ) ) {
				$labels[ $name ] = (string) $field['label'];
				$definitions[ $name ] = $field;
			}
		}

		$agent = $request->get_header( 'user_agent' );

		$entry = [
			'form' => (string) $form['settings']['uid'],
			'formTitle' => (string) $form['title'],
			'post' => $post,
			'page' => self::pagePath( $request, $post ),
			'fields' => $values,
			'labels' => $labels,
			'definitions' => $definitions,
			'status' => $status,
			'notes' => $notes,
			'user' => get_current_user_id(),
			'ipHash' => RateLimit::ipHash(),
			'userAgent' => is_string( $agent ) ? substr( sanitize_text_field( $agent ), 0, 255 ) : '',
			'challenge' => $challenge,
		];

		/**
		 * An entry about to be stored, Spam included. Change its fields or notes, or its status to
		 * any of {@see Entries::statuses()} (another status is ignored).
		 *
		 * @param array<string, mixed> $entry The entry, as {@see Entries::create()} takes it.
		 * @param array<string, mixed> $form  The saved form.
		 */
		$filtered = apply_filters( 'blicks_form_entry', $entry, $form );

		if ( is_array( $filtered ) ) {
			if ( ! is_string( $filtered['status'] ?? null ) || ! Entries::isStatus( $filtered['status'] ) ) {
				$filtered['status'] = $status;
			}
			$entry = $filtered;
		}

		$id = Entries::create( $entry );

		if ( $id > 0 ) {
			Entries::addLog( $id, __( 'Saved', 'blicks' ) );
		}

		return $id;
	}

	/**
	 * The reply to a send that looks accepted. Only a send that really was (`$form` given) goes
	 * through `blicks_form_response`; a send kept as Spam gets the plain reply.
	 *
	 * @param array<string, mixed>      $settings
	 * @param array<string, mixed>|null $form
	 */
	private static function sent( array $settings, int $entryId = 0, ?array $form = null ): WP_REST_Response {
		$body = [ 'status' => 'sent' ];
		$message = (string) ( $settings['after']['message'] ?? '' );

		if ( 'message' === ( $settings['after']['kind'] ?? '' ) && '' !== $message ) {
			$body['message'] = $message;
		}

		if ( null !== $form ) {
			/**
			 * The reply to an accepted send, before it goes back to the page: add what a companion's
			 * script needs (a redirect, a client secret). `status` is always `sent`.
			 *
			 * @param array<string, mixed> $response The reply's data: status, and message when set.
			 * @param int                  $entryId  The stored entry, 0 when the form does not save entries.
			 * @param array<string, mixed> $form     The saved form.
			 */
			$filtered = apply_filters( 'blicks_form_response', $body, $entryId, $form );
			$body = ( is_array( $filtered ) ? $filtered : $body );
			$body['status'] = 'sent';
		}

		return new WP_REST_Response( $body, 200 );
	}

	private static function expired(): WP_REST_Response {
		return new WP_REST_Response(
			[
				'status' => 'expired',
				'code' => 'blicks_form_token',
			],
			403
		);
	}

	/** A plain HTML form post: a form body and no token. */
	private static function isPlainPost( WP_REST_Request $request ): bool {
		$type = $request->get_content_type();
		$value = is_array( $type ) ? strtolower( (string) ( $type['value'] ?? '' ) ) : '';
		$token = $request->get_param( 'token' );

		return in_array( $value, self::FORM_TYPES, true ) && ( ! is_string( $token ) || '' === $token );
	}

	/**
	 * The request comes from this site: its `Origin`, or failing that its `Referer`, names this
	 * site's host. A request carrying neither (a non-browser client) is left to the token.
	 */
	private static function sameSite( WP_REST_Request $request ): bool {
		$origin = $request->get_header( 'origin' );
		$source = is_string( $origin ) && '' !== $origin ? $origin : $request->get_header( 'referer' );

		if ( ! is_string( $source ) || '' === $source ) {
			return true;
		}

		$host = wp_parse_url( $source, PHP_URL_HOST );

		return is_string( $host ) && in_array( strtolower( $host ), self::hosts(), true );
	}

	/** @return list<string> */
	private static function hosts(): array {
		$hosts = [];

		foreach ( [ home_url(), site_url() ] as $url ) {
			$host = wp_parse_url( $url, PHP_URL_HOST );

			if ( is_string( $host ) ) {
				$hosts[] = strtolower( $host );
			}
		}

		return $hosts;
	}

	/** The page it was sent from: the `Referer` when it is this site, else the post's permalink. */
	private static function pageUrl( WP_REST_Request $request, int $post ): string {
		$referer = $request->get_header( 'referer' );

		if ( is_string( $referer ) && '' !== $referer ) {
			$host = wp_parse_url( $referer, PHP_URL_HOST );

			if ( is_string( $host ) && in_array( strtolower( $host ), self::hosts(), true ) ) {
				return esc_url_raw( $referer );
			}
		}

		$link = $post > 0 ? get_permalink( $post ) : false;

		return is_string( $link ) ? $link : '';
	}

	private static function pagePath( WP_REST_Request $request, int $post ): string {
		$url = self::pageUrl( $request, $post );
		$path = '' !== $url ? wp_parse_url( $url, PHP_URL_PATH ) : null;

		return is_string( $path ) && '' !== $path ? sanitize_text_field( $path ) : ( '' !== $url ? '/' : '' );
	}

	/** Back to the page, which shows its sent message for `?bl_form=<uid>`. */
	private static function returnUrl( int $post, string $formId ): string {
		$link = $post > 0 && 'publish' === get_post_status( $post ) ? get_permalink( $post ) : false;
		$base = is_string( $link ) ? $link : home_url( '/' );

		return add_query_arg( 'bl_form', $formId, $base ) . '#blform-' . $formId;
	}
}
