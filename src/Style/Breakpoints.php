<?php
/**
 * Reads the shared breakpoint registry.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the shared breakpoint registry (resources/design-system/breakpoints.json) — the same
 * file the TypeScript engine imports. Desktop-first; the first entry is the base (no query).
 */
final class Breakpoints {

	/** @var list<array<string, mixed>>|null */
	private static ?array $defaults = null;

	/** @return list<array<string, mixed>> */
	public static function defaults(): array {
		if ( null === self::$defaults ) {
			$path = dirname( __DIR__, 2 ) . '/resources/design-system/breakpoints.json';
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reads a JSON file bundled with the plugin, not a remote URL.
			$json = is_file( $path ) ? (string) file_get_contents( $path ) : '[]';
			/** @var list<array<string, mixed>> $decoded */
			$decoded = json_decode( $json ? $json : '[]', true ) ?? [];
			self::$defaults = $decoded;
		}

		return self::$defaults;
	}
}
