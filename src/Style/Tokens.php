<?php
/**
 * Reads the shared design-token catalogue.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the shared design-token catalogue (resources/design-system/tokens.json) — the same
 * file the TypeScript engine imports — so token detection is identical on both sides.
 */
final class Tokens {

	/** @var array<string, list<string>>|null */
	private static ?array $catalogue = null;

	/** Whether $value is a known token slug in $category. */
	public static function isToken( string $category, mixed $value ): bool {
		if ( ! is_string( $value ) ) {
			return false;
		}

		return in_array( $value, self::catalogue()[ $category ] ?? [], true );
	}

	/** @return array<string, list<string>> */
	public static function catalogue(): array {
		if ( null === self::$catalogue ) {
			$path = dirname( __DIR__, 2 ) . '/resources/design-system/tokens.json';
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reads a JSON file bundled with the plugin, not a remote URL.
			$json = is_file( $path ) ? (string) file_get_contents( $path ) : '{}';
			/** @var array<string, list<string>> $decoded */
			$decoded = json_decode( $json ? $json : '{}', true ) ?? [];
			self::$catalogue = $decoded;
		}

		return self::$catalogue;
	}
}
