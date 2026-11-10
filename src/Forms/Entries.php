<?php
/**
 * Form entries: a private post type.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Each sent form is one `blicks_entry` post. The post type has no public face, no admin UI of its
 * own and no REST route of its own: Blicks › Entries draws it (EntriesController), behind
 * {@see self::capability()}.
 *
 * Meta, all prefixed `_ble_` (one row each, values that are lists or maps stored as JSON):
 *
 *   _ble_form        the Form's uniqueId          _ble_form_title  where it lives, for the filter
 *   _ble_post        the post the form was sent from, 0 if none
 *   _ble_page        the page path it was sent from
 *   _ble_fields      { name: value } (JSON)       _ble_labels      { name: label } (JSON)
 *   _ble_defs        { name: field definition } at send time (JSON), for showing values
 *   _ble_status      one of {@see self::statuses()} _ble_notes     why it is spam, etc. (JSON list)
 *   _ble_user        the logged-in sender's id    _ble_ip_hash     salted hash, never the address
 *   _ble_ua          the user agent, cut to 255   _ble_challenge   pass | fail | unchecked | none
 *   _ble_log         what was done with it (JSON list of lines)
 */
final class Entries {

	public const POST_TYPE = 'blicks_entry';

	/** Blicks' own statuses. Companions add more through {@see self::statuses()}. */
	public const STATUSES = [ 'new', 'handled', 'spam' ];

	/**
	 * Every status an entry may have, slug => label: Blicks' own first, then companions'.
	 *
	 * @return array<string, string>
	 */
	public static function statuses(): array {
		$builtIn = [
			'new' => __( 'New', 'blicks' ),
			'handled' => __( 'Handled', 'blicks' ),
			'spam' => __( 'Spam', 'blicks' ),
		];

		/**
		 * The statuses an entry may have, slug => label. Blicks' own (new, handled, spam) cannot be
		 * removed; their labels can be changed. A slug is a key (`sanitize_key`).
		 *
		 * @param array<string, string> $statuses
		 */
		$filtered = apply_filters( 'blicks_entry_statuses', $builtIn );
		$out = $builtIn;

		foreach ( is_array( $filtered ) ? $filtered : [] as $slug => $label ) {
			$slug = is_string( $slug ) ? sanitize_key( $slug ) : '';

			if ( '' !== $slug && is_scalar( $label ) && '' !== trim( (string) $label ) ) {
				$out[ $slug ] = sanitize_text_field( (string) $label );
			}
		}

		return $out;
	}

	/** True for a status in {@see self::statuses()}. */
	public static function isStatus( string $status ): bool {
		return '' !== $status && array_key_exists( $status, self::statuses() );
	}

	/** On `init`. */
	public static function register(): void {
		register_post_type(
			self::POST_TYPE,
			[
				'labels' => [
					'name' => __( 'Entries', 'blicks' ),
					'singular_name' => __( 'Entry', 'blicks' ),
				],
				'public' => false,
				'publicly_queryable' => false,
				'exclude_from_search' => true,
				'show_ui' => false,
				'show_in_menu' => false,
				'show_in_nav_menus' => false,
				'show_in_rest' => false,
				'has_archive' => false,
				'rewrite' => false,
				'query_var' => false,
				'can_export' => false,
				'delete_with_user' => false,
				'supports' => [ 'title', 'custom-fields' ],
				'capability_type' => 'post',
				'map_meta_cap' => true,
			]
		);
	}

	/** Who may read, change and export entries. `manage_options` unless filtered. */
	public static function capability(): bool {
		/**
		 * The capability that opens Blicks › Entries and its REST routes.
		 *
		 * @param string $capability Default `manage_options`.
		 */
		$capability = apply_filters( 'blicks_entries_capability', 'manage_options' );

		return current_user_can( is_string( $capability ) && '' !== $capability ? $capability : 'manage_options' );
	}

	/**
	 * Store one entry. Values are expected already validated and sanitised (Validator); they are
	 * stored as given.
	 *
	 * @param array{form: string, formTitle?: string, post?: int, page?: string, fields: array<string, mixed>, labels?: array<string, string>, definitions?: array<string, array<string, mixed>>, status?: string, notes?: list<string>, user?: int, ipHash?: string, userAgent?: string, challenge?: string} $entry
	 * @return int The entry's id, 0 when it could not be stored.
	 */
	public static function create( array $entry ): int {
		$fields = is_array( $entry['fields'] ?? null ) ? $entry['fields'] : [];
		$status = is_string( $entry['status'] ?? null ) && self::isStatus( $entry['status'] ) ? $entry['status'] : 'new';

		$id = wp_insert_post(
			[
				'post_type' => self::POST_TYPE,
				'post_status' => 'private',
				'post_title' => self::summary( $fields ),
				'post_content' => '',
				'post_author' => max( 0, (int) ( $entry['user'] ?? 0 ) ),
			],
			true
		);

		if ( is_wp_error( $id ) || ! is_int( $id ) || $id <= 0 ) {
			return 0;
		}

		$meta = [
			'_ble_form' => (string) ( $entry['form'] ?? '' ),
			'_ble_form_title' => (string) ( $entry['formTitle'] ?? '' ),
			'_ble_post' => max( 0, (int) ( $entry['post'] ?? 0 ) ),
			'_ble_page' => (string) ( $entry['page'] ?? '' ),
			'_ble_fields' => self::json( $fields ),
			'_ble_labels' => self::json( is_array( $entry['labels'] ?? null ) ? $entry['labels'] : [] ),
			'_ble_defs' => self::json( (object) ( is_array( $entry['definitions'] ?? null ) ? $entry['definitions'] : [] ) ),
			'_ble_status' => $status,
			'_ble_notes' => self::json( array_values( is_array( $entry['notes'] ?? null ) ? $entry['notes'] : [] ) ),
			'_ble_user' => max( 0, (int) ( $entry['user'] ?? 0 ) ),
			'_ble_ip_hash' => (string) ( $entry['ipHash'] ?? '' ),
			'_ble_ua' => substr( (string) ( $entry['userAgent'] ?? '' ), 0, 255 ),
			'_ble_challenge' => (string) ( $entry['challenge'] ?? 'none' ),
			'_ble_log' => self::json( [] ),
		];

		foreach ( $meta as $key => $value ) {
			// update_post_meta() unslashes: JSON with escaped quotes would lose its backslashes.
			update_post_meta( $id, $key, is_string( $value ) ? wp_slash( $value ) : $value );
		}

		return $id;
	}

	/**
	 * One entry, or null when there is no such entry.
	 *
	 * @return array{id: int, form: string, formTitle: string, post: int, page: string, fields: array<string, mixed>, labels: array<string, string>, definitions: array<string, array<string, mixed>>, status: string, notes: list<string>, user: int, ipHash: string, userAgent: string, challenge: string, received: string, log: list<string>}|null
	 */
	public static function get( int $id ): ?array {
		$post = $id > 0 ? get_post( $id ) : null;

		if ( ! $post || self::POST_TYPE !== $post->post_type ) {
			return null;
		}

		$status = (string) get_post_meta( $id, '_ble_status', true );

		return [
			'id' => $id,
			'form' => (string) get_post_meta( $id, '_ble_form', true ),
			'formTitle' => (string) get_post_meta( $id, '_ble_form_title', true ),
			'post' => (int) get_post_meta( $id, '_ble_post', true ),
			'page' => (string) get_post_meta( $id, '_ble_page', true ),
			'fields' => self::decode( get_post_meta( $id, '_ble_fields', true ) ),
			'labels' => self::decode( get_post_meta( $id, '_ble_labels', true ) ),
			'definitions' => array_filter( self::decode( get_post_meta( $id, '_ble_defs', true ) ), 'is_array' ),
			'status' => self::isStatus( $status ) ? $status : 'new',
			'notes' => array_values( array_filter( self::decode( get_post_meta( $id, '_ble_notes', true ) ), 'is_string' ) ),
			'user' => (int) get_post_meta( $id, '_ble_user', true ),
			'ipHash' => (string) get_post_meta( $id, '_ble_ip_hash', true ),
			'userAgent' => (string) get_post_meta( $id, '_ble_ua', true ),
			'challenge' => (string) get_post_meta( $id, '_ble_challenge', true ),
			'received' => (string) get_post_time( 'c', true, $post ),
			'log' => array_values( array_filter( self::decode( get_post_meta( $id, '_ble_log', true ) ), 'is_string' ) ),
		];
	}

	public static function setStatus( int $id, string $status ): bool {
		if ( ! self::isStatus( $status ) || null === self::get( $id ) ) {
			return false;
		}

		update_post_meta( $id, '_ble_status', $status );

		return true;
	}

	/**
	 * Each stored value as one line of plain text ({@see FieldTypes::display()}), name => text, in
	 * the entry's order. A field stored before definitions were kept is shown as text.
	 *
	 * @param array<string, mixed> $entry From {@see self::get()}.
	 * @return array<string, string>
	 */
	public static function display( array $entry ): array {
		$fields = is_array( $entry['fields'] ?? null ) ? $entry['fields'] : [];
		$labels = is_array( $entry['labels'] ?? null ) ? $entry['labels'] : [];
		$defs = is_array( $entry['definitions'] ?? null ) ? $entry['definitions'] : [];
		$out = [];

		foreach ( $fields as $name => $value ) {
			$name = (string) $name;
			$field = is_array( $defs[ $name ] ?? null ) ? $defs[ $name ] : [];
			$field += [
				'name' => $name,
				'type' => 'text',
				'label' => is_string( $labels[ $name ] ?? null ) ? $labels[ $name ] : '',
			];
			$out[ $name ] = FieldTypes::display( $field, $value, $entry );
		}

		return $out;
	}

	/** Note what was done with an entry: "Saved", "Emailed to …". */
	public static function addLog( int $id, string $line ): void {
		if ( $id <= 0 ) {
			return;
		}

		$log = self::decode( get_post_meta( $id, '_ble_log', true ) );
		$log[] = sanitize_text_field( $line );
		update_post_meta( $id, '_ble_log', wp_slash( self::json( array_values( $log ) ) ) );
	}

	/**
	 * The entry's title in lists: the first email value, else the first non-empty value.
	 *
	 * @param array<string, mixed> $fields
	 */
	private static function summary( array $fields ): string {
		$first = '';

		foreach ( $fields as $value ) {
			$text = is_array( $value ) ? implode( ', ', array_filter( $value, 'is_string' ) ) : ( is_scalar( $value ) ? (string) $value : '' );

			if ( is_email( $text ) ) {
				return $text;
			}

			if ( '' === $first && '' !== trim( $text ) ) {
				$first = $text;
			}
		}

		return '' !== $first ? wp_html_excerpt( $first, 80, '…' ) : __( '(empty entry)', 'blicks' );
	}

	private static function json( mixed $value ): string {
		$json = wp_json_encode( $value );

		return is_string( $json ) ? $json : '[]';
	}

	/** @return array<int|string, mixed> */
	private static function decode( mixed $value ): array {
		$decoded = is_string( $value ) ? json_decode( $value, true ) : null;

		return is_array( $decoded ) ? $decoded : [];
	}
}
