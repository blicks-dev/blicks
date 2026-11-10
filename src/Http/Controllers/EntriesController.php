<?php
/**
 * Admin routes for form entries.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Http\Rest;
use Blicks\Forms\Entries;
use Blicks\Http\RestArgs;
use WP_Query;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Blicks › Entries over REST: list, read one, change its status, delete, and the same in bulk.
 * Every route is behind {@see Entries::capability()}.
 *
 * What leaves here is the entry as stored, with each value as its type displays it (`display`),
 * less the IP hash (never sent anywhere) and, in lists,
 * the user agent (only the single read carries it). The admin screen renders every value as text.
 */
final class EntriesController {

	private const PER_PAGE = 20;

	private const MAX_PER_PAGE = 100;

	/** Bulk changes per request. */
	private const MAX_BULK = 200;

	/** Declare the routes (called from RestServiceProvider on init). */
	public static function routes(): void {
		$id = [
			'id' => [
				'type' => 'integer',
				'required' => true,
				'sanitize_callback' => 'absint',
				'validate_callback' => static fn ( $value ): bool => is_numeric( $value ) && (int) $value > 0,
			],
		];

		Rest::get( 'blicks/v1', 'forms/entries', [ self::class, 'index' ] )
			->permission( [ Entries::class, 'capability' ] )
			->schema(
				[
					'form' => RestArgs::identifier(),
					'status' => self::status(),
					'search' => RestArgs::text(),
					'page' => self::integer(),
					'per_page' => self::integer(),
				]
			);

		Rest::post( 'blicks/v1', 'forms/entries/bulk', [ self::class, 'bulk' ] )
			->permission( [ Entries::class, 'capability' ] )
			->schema(
				[
					'ids' => RestArgs::list( true ),
					'do' => self::status( [ 'delete' ] ) + [ 'required' => true ],
				]
			);

		Rest::get( 'blicks/v1', 'forms/entries/(?P<id>\d+)', [ self::class, 'show' ] )
			->permission( [ Entries::class, 'capability' ] )
			->schema( $id );

		Rest::patch( 'blicks/v1', 'forms/entries/(?P<id>\d+)', [ self::class, 'update' ] )
			->permission( [ Entries::class, 'capability' ] )
			->schema( $id + [ 'status' => self::status() + [ 'required' => true ] ] );

		Rest::delete( 'blicks/v1', 'forms/entries/(?P<id>\d+)', [ self::class, 'remove' ] )
			->permission( [ Entries::class, 'capability' ] )
			->schema( $id );
	}

	public static function index( WP_REST_Request $request ): WP_REST_Response {
		$form = (string) $request->get_param( 'form' );
		$status = (string) $request->get_param( 'status' );
		$search = trim( (string) $request->get_param( 'search' ) );
		$perPage = min( self::MAX_PER_PAGE, max( 1, (int) ( $request->get_param( 'per_page' ) ?? self::PER_PAGE ) ) );
		$page = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );

		$args = self::queryArgs( $form, $status );

		if ( '' !== $search ) {
			$ids = self::searchIds( $search, $args );
			$args['post__in'] = [] === $ids ? [ 0 ] : $ids;
		}

		$query = new WP_Query(
			$args + [
				'posts_per_page' => $perPage,
				'paged' => $page,
				'orderby' => 'date',
				'order' => 'DESC',
				'fields' => 'ids',
			]
		);

		$counts = self::counts( $form );
		$statuses = [];
		foreach ( Entries::statuses() as $slug => $label ) {
			$statuses[] = [
				'slug' => $slug,
				'label' => $label,
				'count' => $counts[ $slug ] ?? 0,
			];
		}

		$items = [];
		foreach ( $query->posts as $postId ) {
			$entry = Entries::get( (int) $postId );
			if ( null !== $entry ) {
				$items[] = self::shape( $entry, false );
			}
		}

		return new WP_REST_Response(
			[
				'items' => $items,
				'total' => (int) $query->found_posts,
				'pages' => (int) $query->max_num_pages,
				'forms' => self::forms(),
				'counts' => $counts,
				'statuses' => $statuses,
				'csvUrl' => add_query_arg(
					[
						'action' => 'blicks_entries_csv',
						'_wpnonce' => wp_create_nonce( 'blicks_entries_csv' ),
					],
					admin_url( 'admin-post.php' )
				),
			],
			200
		);
	}

	public static function show( WP_REST_Request $request ): WP_REST_Response {
		$entry = Entries::get( (int) $request->get_param( 'id' ) );

		return null === $entry ? self::missing() : new WP_REST_Response( self::shape( $entry, true ), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$id = (int) $request->get_param( 'id' );

		if ( null === Entries::get( $id ) ) {
			return self::missing();
		}

		Entries::setStatus( $id, (string) $request->get_param( 'status' ) );
		$entry = Entries::get( $id );

		return null === $entry ? self::missing() : new WP_REST_Response( self::shape( $entry, true ), 200 );
	}

	public static function remove( WP_REST_Request $request ): WP_REST_Response {
		$id = (int) $request->get_param( 'id' );

		if ( null === Entries::get( $id ) ) {
			return self::missing();
		}

		return new WP_REST_Response( [ 'deleted' => false !== wp_delete_post( $id, true ) ], 200 );
	}

	public static function bulk( WP_REST_Request $request ): WP_REST_Response {
		$raw = $request->get_param( 'ids' );
		$ids = array_slice( array_values( array_unique( array_filter( array_map( 'absint', is_array( $raw ) ? $raw : [] ) ) ) ), 0, self::MAX_BULK );
		$do = (string) $request->get_param( 'do' );
		$done = 0;

		foreach ( $ids as $id ) {
			if ( null === Entries::get( $id ) ) {
				continue;
			}

			if ( 'delete' === $do ) {
				$done += false !== wp_delete_post( $id, true ) ? 1 : 0;
			} elseif ( Entries::setStatus( $id, $do ) ) {
				++$done;
			}
		}

		return new WP_REST_Response( [ 'done' => $done ], 200 );
	}

	/**
	 * The entry as the screen gets it. `$full` adds the user agent; the IP hash never leaves.
	 *
	 * @param array<string, mixed> $entry From {@see Entries::get()}.
	 * @return array<string, mixed>
	 */
	public static function shape( array $entry, bool $full ): array {
		$fields = is_array( $entry['fields'] ?? null ) ? $entry['fields'] : [];
		$labels = is_array( $entry['labels'] ?? null ) ? $entry['labels'] : [];
		$email = self::email( $fields );
		$name = self::name( $fields, $labels );

		$out = [
			'id' => (int) $entry['id'],
			'form' => (string) $entry['form'],
			'formTitle' => (string) $entry['formTitle'],
			'post' => (int) $entry['post'],
			'page' => (string) $entry['page'],
			'fields' => (object) $fields,
			'labels' => (object) $labels,
			'display' => (object) Entries::display( $entry ),
			'status' => (string) $entry['status'],
			'notes' => $entry['notes'],
			'received' => (string) $entry['received'],
			'log' => $entry['log'],
			'from' => '' !== $name ? $name : $email,
			'email' => $email,
			'says' => self::says( $fields, $labels ),
			'challenge' => (string) $entry['challenge'],
		];

		if ( $full ) {
			$out['userAgent'] = (string) $entry['userAgent'];
		}

		return $out;
	}

	/**
	 * Query arguments shared by the list, the counts and the CSV.
	 *
	 * @return array<string, mixed>
	 */
	public static function queryArgs( string $form, string $status = '' ): array {
		$meta = [];

		if ( '' !== $form ) {
			$meta[] = [
				'key' => '_ble_form',
				'value' => $form,
			];
		}

		if ( '' !== $status ) {
			$meta[] = [
				'key' => '_ble_status',
				'value' => $status,
			];
		}

		$args = [
			'post_type' => Entries::POST_TYPE,
			'post_status' => 'any',
			'ignore_sticky_posts' => true,
			'suppress_filters' => false,
		];

		if ( [] !== $meta ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- an admin screen, filtered by its own meta.
			$args['meta_query'] = [ 'relation' => 'AND' ] + $meta;
		}

		return $args;
	}

	/** One value as one line of text. */
	public static function text( mixed $value ): string {
		if ( is_array( $value ) ) {
			return implode( ', ', array_map( static fn ( $v ): string => is_scalar( $v ) ? (string) $v : '', $value ) );
		}

		return is_scalar( $value ) ? (string) $value : '';
	}

	/**
	 * Entries whose title or stored fields hold the search. The fields are JSON, so the term is
	 * also looked for as JSON writes it (non-ASCII as `\uXXXX`, `/` as `\/`).
	 *
	 * @param array<string, mixed> $base
	 * @return list<int>
	 */
	private static function searchIds( string $search, array $base ): array {
		$encoded = trim( (string) wp_json_encode( $search ), '"' );
		$like = [
			'relation' => 'OR',
			[
				'key' => '_ble_fields',
				'value' => $search,
				'compare' => 'LIKE',
			],
		];

		if ( $encoded !== $search ) {
			$like[] = [
				'key' => '_ble_fields',
				'value' => $encoded,
				'compare' => 'LIKE',
			];
		}

		$common = $base + [
			'posts_per_page' => -1,
			'fields' => 'ids',
			'no_found_rows' => true,
		];

		$byTitle = get_posts( [ 's' => $search ] + $common );

		$byFields = $common;
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- an admin search over the entry's own fields.
		$byFields['meta_query'] = isset( $common['meta_query'] ) ? [
			'relation' => 'AND',
			$common['meta_query'],
			$like,
		] : $like;

		return array_values( array_unique( array_map( 'intval', array_merge( $byTitle, get_posts( $byFields ) ) ) ) );
	}

	/**
	 * Every form that has entries, with its latest title and how many.
	 *
	 * @return list<array{id: string, title: string, count: int}>
	 */
	private static function forms(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a grouped count WP_Query cannot express; read once per screen load.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pm.meta_value AS form, COUNT(*) AS count, MAX(p.ID) AS latest
				FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				WHERE p.post_type = %s AND pm.meta_key = '_ble_form'
				GROUP BY pm.meta_value
				ORDER BY latest DESC",
				Entries::POST_TYPE
			),
			ARRAY_A
		);

		$forms = [];
		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$title = (string) get_post_meta( (int) $row['latest'], '_ble_form_title', true );
			$forms[] = [
				'id' => (string) $row['form'],
				'title' => '' !== $title ? $title : (string) $row['form'],
				'count' => (int) $row['count'],
			];
		}

		return $forms;
	}

	/**
	 * A status argument, checked against {@see Entries::statuses()} when the request arrives (so a
	 * status a companion adds late still counts), plus any extra words.
	 *
	 * @param list<string> $extra
	 * @return array<string, mixed>
	 */
	private static function status( array $extra = [] ): array {
		return [
			'type' => 'string',
			'sanitize_callback' => 'sanitize_key',
			'validate_callback' => static fn ( $value ): bool => is_string( $value )
				&& ( Entries::isStatus( sanitize_key( $value ) ) || in_array( sanitize_key( $value ), $extra, true ) ),
		];
	}

	/**
	 * How many entries are in each status ({@see Entries::statuses()}), within the chosen form.
	 *
	 * @return array<string, int>
	 */
	private static function counts( string $form ): array {
		$counts = [];

		foreach ( array_keys( Entries::statuses() ) as $status ) {
			$query = new WP_Query(
				self::queryArgs( $form, $status ) + [
					'posts_per_page' => 1,
					'fields' => 'ids',
				]
			);
			$counts[ $status ] = (int) $query->found_posts;
		}

		return $counts;
	}

	/** @param array<string, mixed> $fields */
	private static function email( array $fields ): string {
		foreach ( $fields as $value ) {
			$text = trim( self::text( $value ) );
			if ( '' !== $text && is_email( $text ) ) {
				return $text;
			}
		}

		return '';
	}

	/**
	 * The first field named or labelled like a name.
	 *
	 * @param array<string, mixed> $fields
	 * @param array<string, mixed> $labels
	 */
	private static function name( array $fields, array $labels ): string {
		foreach ( $fields as $key => $value ) {
			$label = strtolower( (string) $key . ' ' . self::text( $labels[ $key ] ?? '' ) );
			$text = trim( self::text( $value ) );

			if ( '' !== $text && str_contains( $label, 'name' ) && ! is_email( $text ) ) {
				return wp_html_excerpt( $text, 60, '…' );
			}
		}

		return '';
	}

	/**
	 * A preview of what the sender said: the message field, else the longest free text.
	 *
	 * @param array<string, mixed> $fields
	 * @param array<string, mixed> $labels
	 */
	private static function says( array $fields, array $labels ): string {
		$best = '';

		foreach ( $fields as $key => $value ) {
			$text = trim( self::text( $value ) );
			if ( '' === $text || is_email( $text ) ) {
				continue;
			}

			$label = strtolower( (string) $key . ' ' . self::text( $labels[ $key ] ?? '' ) );
			if ( preg_match( '/message|comment|says|question|enquiry|inquiry|details/', $label ) ) {
				$best = $text;
				break;
			}

			if ( ! str_contains( $label, 'name' ) && mb_strlen( $text ) > mb_strlen( $best ) ) {
				$best = $text;
			}
		}

		$best = (string) preg_replace( '/\s+/', ' ', $best );

		return mb_strlen( $best ) > 80 ? rtrim( mb_substr( $best, 0, 79 ) ) . '…' : $best;
	}

	/** @return array<string, mixed> */
	private static function integer(): array {
		return [
			'type' => 'integer',
			'sanitize_callback' => 'absint',
			'validate_callback' => static fn ( $value ): bool => is_numeric( $value ),
		];
	}

	private static function missing(): WP_REST_Response {
		return new WP_REST_Response(
			[
				'code' => 'blicks_entry_missing',
				'message' => __( 'That entry is not there any more.', 'blicks' ),
			],
			404
		);
	}
}
