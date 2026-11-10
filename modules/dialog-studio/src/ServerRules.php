<?php
/**
 * The display rules decided on the server: where, and when.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Only rules that need nothing from the visitor are decided here: which page this is and what day
 * it is. A page cache serves one HTML to everyone, so anything about the visitor (logged in, screen,
 * how often they have seen it) is left to the browser (`resources/view/auto.ts`). A dialog that
 * fails these is not printed at all.
 *
 * The day is rechecked in the browser too, against the window's start and end as timestamps
 * ({@see self::window()}), for a page cached before the window closed.
 */
final class ServerRules {

	/**
	 * Whether the rules let the dialog onto this page today.
	 *
	 * @param array<string, mixed>                                          $rules Cleaned rules.
	 * @param array{front: bool, type: string, id: int, today: string} $page  What this page is.
	 */
	public static function passes( array $rules, array $page ): bool {
		$schedule = $rules['schedule'];

		if ( $schedule['on'] && ( ( '' !== $schedule['from'] && $page['today'] < $schedule['from'] ) || ( '' !== $schedule['to'] && $page['today'] > $schedule['to'] ) ) ) {
			return false;
		}

		foreach ( $rules['exclude'] as $place ) {
			if ( self::matches( $place, $page ) ) {
				return false;
			}
		}

		if ( 'some' !== $rules['where'] ) {
			return true;
		}

		foreach ( $rules['include'] as $place ) {
			if ( self::matches( $place, $page ) ) {
				return true;
			}
		}

		return false;
	}

	/** @param array{front: bool, type: string, id: int, today: string} $page */
	public static function matches( string $place, array $page ): bool {
		if ( 'front' === $place ) {
			return $page['front'];
		}

		if ( str_starts_with( $place, 'type:' ) ) {
			return '' !== $page['type'] && substr( $place, 5 ) === $page['type'];
		}

		return str_starts_with( $place, 'post:' ) && $page['id'] > 0 && (int) substr( $place, 5 ) === $page['id'];
	}

	/**
	 * The page being served, from the main query.
	 *
	 * @return array{front: bool, type: string, id: int, today: string}
	 */
	public static function page(): array {
		$type = '';
		$id = 0;

		if ( is_singular() ) {
			$id = (int) get_queried_object_id();
			$type = (string) get_post_type( $id );
		} elseif ( is_post_type_archive() ) {
			$queried = get_queried_object();
			$type = is_object( $queried ) && isset( $queried->name ) ? (string) $queried->name : '';
		} elseif ( is_home() ) {
			$type = 'post';
		}

		return [
			'front' => is_front_page(),
			'type' => $type,
			'id' => $id,
			'today' => wp_date( 'Y-m-d' ),
		];
	}

	/**
	 * The schedule as the first and last millisecond it allows, in the site's time zone, for the
	 * browser's recheck; 0 for an open end.
	 *
	 * @param array<string, mixed> $rules Cleaned rules.
	 * @return array{0: int, 1: int}
	 */
	public static function window( array $rules, \DateTimeZone $zone ): array {
		$schedule = $rules['schedule'];

		if ( ! $schedule['on'] ) {
			return [ 0, 0 ];
		}

		$at = static function ( string $day, string $time ) use ( $zone ): int {
			$date = '' !== $day ? \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', "{$day} {$time}", $zone ) : false;

			return $date ? $date->getTimestamp() * 1000 + ( '23:59:59' === $time ? 999 : 0 ) : 0;
		};

		return [ $at( $schedule['from'], '00:00:00' ), $at( $schedule['to'], '23:59:59' ) ];
	}
}
