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

	/**
	 * One `@keyframes` block from one stored record.
	 *
	 * Every value is re-validated here rather than trusted from the caller. `css()` defaults to
	 * `Animations::all()`, which already allow-lists the property and runs the value through
	 * `CssValue::clean()` — but it also accepts a caller-supplied list, and this is the sink that
	 * writes a declaration. Validating at the sink means a future caller passing a raw record
	 * cannot emit anything the stored path would have refused.
	 *
	 * @param array<string,mixed> $animation
	 */
	private static function rule( array $animation ): string {
		$slug = is_string( $animation['slug'] ?? null ) ? $animation['slug'] : '';
		$steps = is_array( $animation['steps'] ?? null ) ? $animation['steps'] : [];

		// The slug lands in a selector-position identifier, so it is an identifier or nothing.
		if ( '' === $slug || [] === $steps || 1 !== preg_match( '/^[A-Za-z0-9_-]+$/', $slug ) ) {
			return '';
		}

		$rendered = [];
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) || ! is_array( $step['declarations'] ?? null ) ) {
				continue;
			}

			$declarations = [];
			foreach ( $step['declarations'] as $property => $value ) {
				if ( ! is_string( $property ) || ! is_scalar( $value ) ) {
					continue;
				}

				$prop = Animations::property( $property );
				$clean = Animations::value( (string) $value );

				if ( null !== $prop && '' !== $clean ) {
					$declarations[] = sprintf( '%s: %s;', $prop, $clean );
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
