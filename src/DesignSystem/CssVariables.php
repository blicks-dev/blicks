<?php
/**
 * Renders a design-token snapshot to CSS custom properties.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders a token snapshot to `--blicks-*` CSS custom properties.
 */
final class CssVariables {

	/** @param array<string, mixed>|null $snapshot */
	public static function css( ?array $snapshot = null ): string {
		$snapshot ??= Catalogue::snapshot();
		$values = $snapshot['values'] ?? [];

		if ( ! is_array( $values ) ) {
			return '';
		}

		$lines = [ ':root {' ];

		foreach ( $values as $category => $tokens ) {
			if ( ! is_string( $category ) || ! is_array( $tokens ) ) {
				continue;
			}

			foreach ( $tokens as $rawSlug => $value ) {
				// Numeric slugs (`spacing.50`) reach us as int keys — see Overrides::slugKey().
				$slug = Overrides::slugKey( $rawSlug );
				if ( null === $slug || ! is_scalar( $value ) ) {
					continue;
				}

				$value = self::sanitizeValue( (string) $value );
				if ( '' === $value ) {
					continue;
				}

				$lines[] = sprintf( '  --blicks-%s-%s: %s;', self::sanitizeName( $category ), self::sanitizeName( $slug ), $value );
			}
		}

		// Typography roles ride on `--blicks-type-{role}-{prop}` aliases. Custom roles (lead, code…)
		// need them to render at all; native roles (h1–h6, body, caption) already have element CSS,
		// but we emit their vars too so the opt-in `.bl-type--{role}` library class can re-apply any
		// role's look on any tag (heading Style picker) — additive, the element CSS is untouched.
		$roles = $snapshot['typeRoles'] ?? null;
		if ( is_array( $roles ) && is_array( $roles['values'] ?? null ) ) {
			foreach ( $roles['values'] as $role => $props ) {
				if ( ! is_string( $role ) || ! is_array( $props ) ) {
					continue;
				}

				foreach ( $props as $prop => $value ) {
					if ( ! is_string( $prop ) || ! is_scalar( $value ) ) {
						continue;
					}

					$value = self::sanitizeValue( (string) $value );
					if ( '' === $value ) {
						continue;
					}

					$lines[] = sprintf( '  --blicks-type-%s-%s: %s;', self::sanitizeName( $role ), self::sanitizeName( TypeRoles::kebabProp( $prop ) ), $value );
				}
			}
		}

		$lines[] = '}';

		return implode( "\n", $lines );
	}

	private static function sanitizeName( string $value ): string {
		$stripped = preg_replace( '/[^a-zA-Z0-9_-]/', '', $value );

		return $stripped ? $stripped : '';
	}

	private static function sanitizeValue( string $value ): string {
		$value = trim( $value );
		$value = preg_replace( '/[\x00-\x1F\x7F]/', '', $value ) ?? '';

		return str_replace( [ ';', '{', '}', '<', '>' ], '', $value );
	}
}
