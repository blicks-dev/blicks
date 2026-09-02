<?php
/**
 * Strict validation for the Advanced-tab CSS escape hatches.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Strict validation/sanitization for the Advanced-tab escape hatches (Custom CSS + custom HTML
 * attributes). **Authoritative front-end gate.** Mirror of `resources/framework/sanitize.ts` —
 * keep the two byte-compatible (parity: tests/Unit/Style/SanitizeTest.php ⇄ sanitize.test.ts).
 */
final class Sanitize {

	private const ATTR_NAME_RE   = '/^(?:data-[a-z0-9-]+|aria-[a-z-]+|role|title|id|lang|dir)$/';
	private const CONTROL_CHARS  = '/[\x00-\x1F\x7F]/';
	private const SCRIPT_SCHEME  = '/(?:javascript|vbscript)\s*:/i';
	private const ATTR_VALUE_MAX = 500;
	private const CSS_MAX         = 10000;

	/** @return list<array{label:string,re:string}> */
	private static function cssBlocklist(): array {
		return [
			[
				'label' => '<',
				're' => '/</',
			],
			[
				'label' => '@import',
				're' => '/@import[^;]*;?/i',
			],
			[
				'label' => '@charset/@namespace',
				're' => '/@(?:charset|namespace)[^;]*;?/i',
			],
			[
				'label' => 'expression()',
				're' => '/expression\s*\(/i',
			],
			[
				'label' => 'javascript:/vbscript:',
				're' => self::SCRIPT_SCHEME,
			],
			[
				'label' => 'data:text/html',
				're' => '/data:\s*text\/html/i',
			],
			[
				'label' => 'url()',
				're' => '/url\s*\(/i',
			],
			[
				'label' => 'behavior/-moz-binding',
				're' => '/(?:-moz-binding|behavior)\s*:/i',
			],
		];
	}

	/** Normalised (lowercased) attribute name, or null if disallowed. */
	public static function attrName( string $name ): ?string {
		$n = strtolower( trim( $name ) );
		return 1 === preg_match( self::ATTR_NAME_RE, $n ) ? $n : null;
	}

	/** Strip control chars + dangerous URL schemes, cap length. */
	public static function attrValue( string $value ): string {
		$v = (string) preg_replace( self::CONTROL_CHARS, '', $value );
		$v = (string) preg_replace( self::SCRIPT_SCHEME, '', $v );
		$v = trim( $v );
		if ( mb_strlen( $v ) > self::ATTR_VALUE_MAX ) {
			$v = mb_substr( $v, 0, self::ATTR_VALUE_MAX );
		}
		return $v;
	}

	/**
	 * Validate a list of `{name,value}` rows → name => value (valid only, last write wins).
	 *
	 * @param mixed $list
	 * @return array<string,string>
	 */
	public static function attributes( $list ): array {
		if ( ! is_array( $list ) ) {
			return [];
		}
		$out = [];
		foreach ( $list as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$name = self::attrName( (string) ( $item['name'] ?? '' ) );
			if ( null === $name ) {
				continue;
			}
			$out[ $name ] = self::attrValue( (string) ( $item['value'] ?? '' ) );
		}
		return $out;
	}

	/** Strip dangerous constructs from Custom CSS, cap length. */
	public static function css( string $raw ): string {
		$css = mb_strlen( $raw ) > self::CSS_MAX ? mb_substr( $raw, 0, self::CSS_MAX ) : $raw;
		foreach ( self::cssBlocklist() as $entry ) {
			$css = (string) preg_replace( $entry['re'], '', $css );
		}
		return $css;
	}

	/** Sanitize + scope Custom CSS to one instance: replace the `selector` keyword with `.bl-{id}`. */
	public static function scopeCss( string $raw, string $scopeId ): string {
		if ( '' === $scopeId ) {
			return '';
		}
		$css = self::css( $raw );
		if ( '' === trim( $css ) ) {
			return '';
		}
		return str_replace( 'selector', '.bl-' . $scopeId, $css );
	}

	/** Keep CSS text safe inside a raw `<style>` element without HTML-escaping valid selectors. */
	public static function styleTagContent( string $css ): string {
		return (string) preg_replace( '/<\/\s*style/i', '<\/style', $css );
	}
}
