<?php
/**
 * CSV export of entries.
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
 * Blicks › Entries › Export CSV: one form's entries (or every form's), one row each.
 *
 * Columns are Received, Status, Page, then one per field name in the order the names first
 * appear, headed by the field's label when one was stored; each value as its type displays it
 * ({@see Entries::display()}). A spreadsheet runs a cell that starts
 * with `= + - @` (or a tab / carriage return) as a formula, so such a cell gets a leading `'`.
 */
final class EntriesCsv {

	/** Entries read per query while streaming. */
	private const BATCH = 200;

	/** Streams the CSV for admin-post.php?action=blicks_entries_csv. */
	public static function download(): void {
		if ( ! Entries::capability() ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to export entries.', 'blicks' ), '', [ 'response' => 403 ] );
		}

		check_admin_referer( 'blicks_entries_csv' );

		$form = isset( $_GET['form'] ) ? sanitize_key( wp_unslash( $_GET['form'] ) ) : '';
		$rows = self::rows( self::entries( $form ) );
		$name = sprintf( 'blicks-entries%s-%s.csv', '' !== $form ? '-' . $form : '', gmdate( 'Y-m-d' ) );

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $name . '"' );
		header( 'X-Content-Type-Options: nosniff' );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- streaming to the response, not the file system.
		$out = fopen( 'php://output', 'w' );

		if ( false !== $out ) {
			foreach ( $rows as $row ) {
				fputcsv( $out, $row, ',', '"', '\\' );
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- the output stream opened above.
			fclose( $out );
		}

		exit;
	}

	/**
	 * Every entry of the form (every form when `$form` is empty), newest first.
	 *
	 * @return list<array<string, mixed>>
	 */
	public static function entries( string $form ): array {
		$entries = [];
		$page = 1;

		do {
			$ids = get_posts(
				EntriesController::queryArgs( $form ) + [
					'posts_per_page' => self::BATCH,
					'paged' => $page,
					'orderby' => 'date',
					'order' => 'DESC',
					'fields' => 'ids',
					'no_found_rows' => true,
				]
			);

			foreach ( $ids as $id ) {
				$entry = Entries::get( (int) $id );
				if ( null !== $entry ) {
					$entries[] = $entry;
				}
			}

			++$page;
			$full = count( $ids ) === self::BATCH;
		} while ( $full );

		return $entries;
	}

	/**
	 * The CSV as rows, header first, every cell guarded.
	 *
	 * @param list<array<string, mixed>> $entries From {@see Entries::get()}.
	 * @return list<list<string>>
	 */
	public static function rows( array $entries ): array {
		$names = [];
		$labels = [];

		foreach ( $entries as $entry ) {
			$entryLabels = is_array( $entry['labels'] ?? null ) ? $entry['labels'] : [];
			foreach ( array_keys( is_array( $entry['fields'] ?? null ) ? $entry['fields'] : [] ) as $name ) {
				$name = (string) $name;
				if ( ! isset( $labels[ $name ] ) ) {
					$names[] = $name;
					$labels[ $name ] = '';
				}
				if ( '' === $labels[ $name ] && is_string( $entryLabels[ $name ] ?? null ) ) {
					$labels[ $name ] = $entryLabels[ $name ];
				}
			}
		}

		$header = [ __( 'Received', 'blicks' ), __( 'Status', 'blicks' ), __( 'Page', 'blicks' ) ];
		foreach ( $names as $name ) {
			$header[] = '' !== $labels[ $name ] ? $labels[ $name ] : $name;
		}

		$rows = [ array_map( [ self::class, 'cell' ], $header ) ];

		foreach ( $entries as $entry ) {
			$display = Entries::display( $entry );
			$row = [ (string) ( $entry['received'] ?? '' ), (string) ( $entry['status'] ?? '' ), (string) ( $entry['page'] ?? '' ) ];

			foreach ( $names as $name ) {
				$row[] = $display[ $name ] ?? '';
			}

			$rows[] = array_map( [ self::class, 'cell' ], $row );
		}

		return $rows;
	}

	/** One cell, with a leading `'` when a spreadsheet would read it as a formula. */
	public static function cell( string $value ): string {
		return '' !== $value && false !== strpos( "=+-@\t\r", $value[0] ) ? "'" . $value : $value;
	}
}
