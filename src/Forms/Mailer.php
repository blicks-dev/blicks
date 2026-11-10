<?php
/**
 * Emails a sent form.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One email per accepted send, through `wp_mail`, to the recipients **saved** on the Form (never
 * from the request; the site's admin email when none is set).
 *
 * The visitor's values reach the email in three places, each guarded: the subject (`{name}` tags,
 * line breaks stripped so no header can be added), the Reply-To header (a validated address, no
 * line breaks), and the HTML body (every value escaped).
 */
final class Mailer {

	private const SUBJECT_MAX = 200;

	/**
	 * @param array<string, mixed>                $form    From {@see Locator::find()}.
	 * @param array<string, mixed>                $values  Validated values.
	 * @param int                                 $entryId The stored entry, 0 when not stored.
	 * @param string                              $pageUrl The page it was sent from.
	 */
	public static function send( array $form, array $values, int $entryId, string $pageUrl ): bool {
		$settings = is_array( $form['settings'] ?? null ) ? $form['settings'] : [];
		$email = is_array( $settings['email'] ?? null ) ? $settings['email'] : [];
		$fields = is_array( $form['fields'] ?? null ) ? $form['fields'] : [];

		if ( false === ( $email['on'] ?? true ) ) {
			return false;
		}

		$to = self::recipients( (string) ( $email['to'] ?? '' ) );

		if ( [] === $to ) {
			Entries::addLog( $entryId, __( 'Email failed: no recipient', 'blicks' ) );
			return false;
		}

		$headers = [ 'Content-Type: text/html; charset=UTF-8' ];
		$replyTo = true === ( $email['replyTo'] ?? true ) ? self::replyTo( $fields, $values ) : '';

		if ( '' !== $replyTo ) {
			$headers[] = 'Reply-To: ' . $replyTo;
		}

		$sent = wp_mail(
			$to,
			self::subject( (string) ( $email['subject'] ?? '' ), (string) ( $form['title'] ?? '' ), $values ),
			self::body( $fields, $values, $entryId, $pageUrl, (string) ( $form['title'] ?? '' ) ),
			$headers
		);

		Entries::addLog(
			$entryId,
			$sent
				/* translators: %s: comma-separated email addresses */
				? sprintf( __( 'Emailed to %s', 'blicks' ), implode( ', ', $to ) )
				: __( 'Email failed', 'blicks' )
		);

		return $sent;
	}

	/**
	 * The saved recipients that are addresses, or the admin email.
	 *
	 * @return list<string>
	 */
	public static function recipients( string $list ): array {
		$to = [];

		foreach ( explode( ',', $list ) as $address ) {
			$address = sanitize_email( trim( $address ) );

			if ( '' !== $address && false !== is_email( $address ) && ! in_array( $address, $to, true ) ) {
				$to[] = $address;
			}
		}

		if ( [] === $to ) {
			$admin = sanitize_email( (string) get_option( 'admin_email' ) );

			if ( false !== is_email( $admin ) ) {
				$to[] = $admin;
			}
		}

		return $to;
	}

	/**
	 * The subject: the saved one with `{name}` tags filled, or "New entry: <form title>". One line.
	 *
	 * @param array<string, mixed> $values
	 */
	public static function subject( string $subject, string $title, array $values ): string {
		if ( '' === trim( $subject ) ) {
			$subject = '' !== $title
				/* translators: %s: where the form lives, e.g. "Contact" */
				? sprintf( __( 'New entry: %s', 'blicks' ), $title )
				: __( 'New entry', 'blicks' );
		}

		$subject = (string) preg_replace_callback(
			'/\{([a-z][a-z0-9_]{0,39})\}/',
			static fn ( array $m ): string => isset( $values[ $m[1] ] ) ? self::text( $values[ $m[1] ] ) : '',
			$subject
		);

		$subject = sanitize_text_field( str_replace( [ "\r", "\n", "\t" ], ' ', $subject ) );

		return mb_strlen( $subject ) > self::SUBJECT_MAX ? mb_substr( $subject, 0, self::SUBJECT_MAX ) : $subject;
	}

	/**
	 * The first email field's value when it is an address, '' otherwise.
	 *
	 * @param list<array<string, mixed>> $fields
	 * @param array<string, mixed>       $values
	 */
	private static function replyTo( array $fields, array $values ): string {
		foreach ( $fields as $field ) {
			if ( 'email' !== ( $field['type'] ?? '' ) ) {
				continue;
			}

			$value = $values[ (string) ( $field['name'] ?? '' ) ] ?? '';
			$address = is_string( $value ) ? sanitize_email( str_replace( [ "\r", "\n" ], '', $value ) ) : '';

			if ( '' !== $address && false !== is_email( $address ) ) {
				return $address;
			}
		}

		return '';
	}

	/**
	 * @param list<array<string, mixed>> $fields
	 * @param array<string, mixed>       $values
	 */
	private static function body( array $fields, array $values, int $entryId, string $pageUrl, string $title ): string {
		$rows = '';
		$entry = $entryId > 0 ? Entries::get( $entryId ) : null;

		foreach ( $fields as $field ) {
			$name = (string) ( $field['name'] ?? '' );

			if ( '' === $name || ! array_key_exists( $name, $values ) ) {
				continue;
			}

			$label = (string) ( $field['label'] ?? '' );
			$rows .= sprintf(
				'<tr><th align="left" valign="top" style="padding:6px 12px 6px 0;font-weight:600;">%1$s</th><td style="padding:6px 0;">%2$s</td></tr>',
				esc_html( '' !== $label ? $label : $name ),
				nl2br( esc_html( FieldTypes::display( $field, $values[ $name ], $entry ) ) )
			);
		}

		$footer = [];

		if ( '' !== $pageUrl ) {
			$footer[] = sprintf(
				/* translators: %s: link to the page the form was sent from */
				esc_html__( 'Sent from %s', 'blicks' ),
				'<a href="' . esc_url( $pageUrl ) . '">' . esc_html( $pageUrl ) . '</a>'
			);
		}

		if ( $entryId > 0 ) {
			$footer[] = '<a href="' . esc_url( admin_url( 'admin.php?page=blicks-entries#entries/' . $entryId ) ) . '">' . esc_html__( 'Open the entry', 'blicks' ) . '</a>';
		}

		return '<!doctype html><html><body style="font-family:sans-serif;font-size:14px;color:#1e1e1e;">'
			. ( '' !== $title ? '<p style="font-size:16px;font-weight:600;">' . esc_html( $title ) . '</p>' : '' )
			. '<table cellpadding="0" cellspacing="0" border="0">' . $rows . '</table>'
			. ( [] !== $footer ? '<p style="margin-top:24px;color:#757575;font-size:12px;">' . implode( ' · ', $footer ) . '</p>' : '' )
			. '</body></html>';
	}

	private static function text( mixed $value ): string {
		return is_array( $value ) ? implode( ', ', array_filter( $value, 'is_string' ) ) : ( is_scalar( $value ) ? (string) $value : '' );
	}
}
