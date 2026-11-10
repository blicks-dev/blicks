<?php
/**
 * What the module's unit tests need beside the free plugin's test bootstrap: the module's own
 * classes, without booting it, and core's `serialize_block_attributes()`, which the serializer
 * calls and the unit suite has no WordPress for.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

spl_autoload_register(
	static function ( string $name ): void {
		$prefix = 'BlicksPro\\HeaderStudio\\';

		if ( str_starts_with( $name, $prefix ) ) {
			$file = dirname( __DIR__ ) . '/src/' . str_replace( '\\', '/', substr( $name, strlen( $prefix ) ) ) . '.php';

			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	}
);

if ( ! function_exists( 'serialize_block_attributes' ) ) {
	/**
	 * Core's, from wp-includes/blocks.php.
	 *
	 * @param array<string, mixed> $block_attributes
	 */
	function serialize_block_attributes( $block_attributes ) {
		$encoded_attributes = wp_json_encode( $block_attributes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		$encoded_attributes = preg_replace( '/--/', '\\u002d\\u002d', $encoded_attributes );
		$encoded_attributes = preg_replace( '/</', '\\u003c', $encoded_attributes );
		$encoded_attributes = preg_replace( '/>/', '\\u003e', $encoded_attributes );
		$encoded_attributes = preg_replace( '/&/', '\\u0026', $encoded_attributes );
		// Regex: /\\"/.
		$encoded_attributes = preg_replace( '/\\\\"/', '\\u0022', $encoded_attributes );

		return $encoded_attributes;
	}
}
