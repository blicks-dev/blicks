<?php
/**
 * Personal data export and erase for entries.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Http\Controllers\EntriesController;

/**
 * Tools › Export / Erase Personal Data for form entries, keyed on the email address: an entry
 * belongs to an address when one of its field values is that address. Candidates are found with
 * a LIKE over the stored JSON and then confirmed by decoding, so `ann@example.com` never matches
 * `joann@example.com`.
 */
final class Privacy {

	private const GROUP = 'blicks-entries';

	/** Entries exported per page of the exporter. */
	private const PER_PAGE = 50;

	/** Entries erased per call of the eraser. */
	private const ERASE_BATCH = 100;

	/**
	 * @param array<string, mixed> $exporters
	 * @return array<string, mixed>
	 */
	public static function exporters( array $exporters ): array {
		$exporters[ self::GROUP ] = [
			'exporter_friendly_name' => __( 'Blicks form entries', 'blicks' ),
			'callback' => [ self::class, 'export' ],
		];

		return $exporters;
	}

	/**
	 * @param array<string, mixed> $erasers
	 * @return array<string, mixed>
	 */
	public static function erasers( array $erasers ): array {
		$erasers[ self::GROUP ] = [
			'eraser_friendly_name' => __( 'Blicks form entries', 'blicks' ),
			'callback' => [ self::class, 'erase' ],
		];

		return $erasers;
	}

	/** On admin_init: the privacy policy text. */
	public static function policy(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		$text = '<p>' . __( 'When you send a form on this site, what you type into it is stored as a form entry so the site owner can read and answer it. Each entry also records the page it was sent from, the time, your browser\'s user agent and a salted, one-way hash of your IP address (the address itself is not stored), used to limit repeated sending.', 'blicks' ) . '</p>'
			. '<p>' . __( 'Entries are kept until the site owner deletes them. If the form asks for your email address, you can ask for the entries sent with it to be exported or erased.', 'blicks' ) . '</p>';

		wp_add_privacy_policy_content( __( 'Blicks forms', 'blicks' ), wp_kses_post( $text ) );
	}

	/**
	 * @return array{data: list<array{group_id: string, group_label: string, item_id: string, data: list<array{name: string, value: string}>}>, done: bool}
	 */
	public static function export( string $email, int $page = 1 ): array {
		$ids = self::candidates( $email );
		$slice = array_slice( $ids, ( max( 1, $page ) - 1 ) * self::PER_PAGE, self::PER_PAGE );
		$data = [];

		foreach ( $slice as $id ) {
			$entry = Entries::get( $id );
			if ( null === $entry || ! self::belongs( $entry, $email ) ) {
				continue;
			}

			$labels = is_array( $entry['labels'] ) ? $entry['labels'] : [];
			$pairs = [
				[
					'name' => __( 'Form', 'blicks' ),
					'value' => '' !== $entry['formTitle'] ? $entry['formTitle'] : $entry['form'],
				],
				[
					'name' => __( 'Received', 'blicks' ),
					'value' => $entry['received'],
				],
				[
					'name' => __( 'Page', 'blicks' ),
					'value' => $entry['page'],
				],
			];

			foreach ( $entry['fields'] as $name => $value ) {
				$label = $labels[ $name ] ?? '';
				$pairs[] = [
					'name' => is_string( $label ) && '' !== $label ? $label : (string) $name,
					'value' => EntriesController::text( $value ),
				];
			}

			if ( '' !== $entry['userAgent'] ) {
				$pairs[] = [
					'name' => __( 'User agent', 'blicks' ),
					'value' => $entry['userAgent'],
				];
			}

			$data[] = [
				'group_id' => self::GROUP,
				'group_label' => __( 'Blicks form entries', 'blicks' ),
				'item_id' => 'blicks-entry-' . $id,
				'data' => $pairs,
			];
		}

		return [
			'data' => $data,
			'done' => count( $ids ) <= max( 1, $page ) * self::PER_PAGE,
		];
	}

	/**
	 * Delete the entries sent with the address, a batch per call.
	 *
	 * @return array{items_removed: bool, items_retained: bool, messages: list<string>, done: bool}
	 */
	public static function erase( string $email, int $page = 1 ): array {
		unset( $page ); // Deleted entries leave the candidates, so every call starts from the top.

		$removed = 0;
		$seen = 0;
		$ids = self::candidates( $email );

		foreach ( $ids as $id ) {
			$entry = Entries::get( $id );
			if ( null === $entry || ! self::belongs( $entry, $email ) ) {
				++$seen;
				continue;
			}

			if ( $removed >= self::ERASE_BATCH ) {
				break;
			}

			if ( false !== wp_delete_post( $id, true ) ) {
				++$removed;
			}
			++$seen;
		}

		return [
			'items_removed' => $removed > 0,
			'items_retained' => false,
			'messages' => [],
			'done' => $seen >= count( $ids ),
		];
	}

	/**
	 * Entry ids whose stored fields mention the address, oldest first.
	 *
	 * @return list<int>
	 */
	private static function candidates( string $email ): array {
		$email = trim( $email );

		if ( '' === $email || ! is_email( $email ) ) {
			return [];
		}

		$encoded = trim( (string) wp_json_encode( $email ), '"' );
		$like = [
			'relation' => 'OR',
			[
				'key' => '_ble_fields',
				'value' => $email,
				'compare' => 'LIKE',
			],
		];

		if ( $encoded !== $email ) {
			$like[] = [
				'key' => '_ble_fields',
				'value' => $encoded,
				'compare' => 'LIKE',
			];
		}

		$args = EntriesController::queryArgs( '' );
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- a privacy request, matched on the entry's own fields.
		$args['meta_query'] = $like;

		$ids = get_posts(
			$args + [
				'posts_per_page' => -1,
				'orderby' => 'ID',
				'order' => 'ASC',
				'fields' => 'ids',
				'no_found_rows' => true,
			]
		);

		return array_values( array_map( 'intval', $ids ) );
	}

	/**
	 * Whether one of the entry's values is the address itself.
	 *
	 * @param array<string, mixed> $entry
	 */
	private static function belongs( array $entry, string $email ): bool {
		$email = strtolower( trim( $email ) );

		foreach ( is_array( $entry['fields'] ?? null ) ? $entry['fields'] : [] as $value ) {
			foreach ( is_array( $value ) ? $value : [ $value ] as $item ) {
				if ( is_scalar( $item ) && strtolower( trim( (string) $item ) ) === $email ) {
					return true;
				}
			}
		}

		return false;
	}
}
