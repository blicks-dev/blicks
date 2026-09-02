<?php
/**
 * Renders the keyframe animation library to CSS.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders the user's {@see Animations} library to CSS.
 *
 * Wrapped in `@media (prefers-reduced-motion: no-preference)` to match the built-in keyframes in
 * `resources/runtime/runtime.scss`. That media query *is* the reduced-motion guard: under
 * `reduce` the keyframes simply do not exist, so any `animation-name` referencing them resolves
 * to nothing. Custom animations inherit that rather than opting out of it.
 */
final class Keyframes {

	/** Namespace prefix — keeps custom names clear of the built-in bare `bl-{name}` set. */
	public const PREFIX = 'bl-anim-';

	/** @param list<array<string,mixed>>|null $animations */
	public static function css( ?array $animations = null ): string {
		$animations ??= Animations::all();

		$blocks = [];
		foreach ( $animations as $animation ) {
			$rule = self::rule( $animation );
			if ( '' !== $rule ) {
				$blocks[] = $rule;
			}
		}

		if ( [] === $blocks ) {
			return '';
		}

		return "@media (prefers-reduced-motion: no-preference) {\n" . implode( "\n", $blocks ) . "\n}";
	}

	/** @param array<string,mixed> $animation */
	private static function rule( array $animation ): string {
		$slug = is_string( $animation['slug'] ?? null ) ? $animation['slug'] : '';
		$steps = is_array( $animation['steps'] ?? null ) ? $animation['steps'] : [];

		if ( '' === $slug || [] === $steps ) {
			return '';
		}

		$rendered = [];
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) || ! is_array( $step['declarations'] ?? null ) ) {
				continue;
			}

			$declarations = [];
			foreach ( $step['declarations'] as $property => $value ) {
				if ( is_string( $property ) && is_scalar( $value ) && (string) '' !== $value ) {
					$declarations[] = sprintf( '%s: %s;', $property, (string) $value );
				}
			}

			if ( [] === $declarations ) {
				continue;
			}

			$rendered[] = sprintf( '    %d%% { %s }', (int) ( $step['offset'] ?? 0 ), implode( ' ', $declarations ) );
		}

		if ( [] === $rendered ) {
			return '';
		}

		return sprintf( "  @keyframes %s%s {\n%s\n  }", self::PREFIX, $slug, implode( "\n", $rendered ) );
	}

	/** The CSS animation-name a stored slug maps to. */
	public static function name( string $slug ): string {
		return self::PREFIX . $slug;
	}
}
