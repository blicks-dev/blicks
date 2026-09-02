<?php
/**
 * Validation and normalisation for user-supplied token overrides.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates and normalises user-supplied token overrides.
 */
final class Overrides {

	private const MAX_TOKEN_VALUE_LENGTH = 200;

	/** @var list<string> */
	private const FONT_WEIGHTS = [ '100', '200', '300', '400', '500', '600', '700', '800', '900' ];

	/** @var list<string> */
	private const TEXT_TRANSFORMS = [ 'none', 'uppercase', 'lowercase', 'capitalize' ];

	/**
	 * @param array<string, mixed> $payload
	 * @param array<string, list<string>> $catalogue
	 * @param list<array<string, mixed>> $breakpoints
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function sanitize( array $payload, array $catalogue, array $breakpoints ): array {
		return [
			'tokens' => self::sanitizeTokens( $payload['tokens'] ?? [], $catalogue ),
			'breakpoints' => self::sanitizeBreakpoints( $payload['breakpoints'] ?? [], $breakpoints ),
			'typeRoles' => self::sanitizeTypeRoles( $payload['typeRoles'] ?? [], $catalogue ),
		];
	}

	/**
	 * @param array<string, mixed> $overrides
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function normalize( array $overrides ): array {
		$tokens = [];
		foreach ( ( $overrides['tokens'] ?? [] ) as $category => $values ) {
			if ( ! is_string( $category ) || ! is_array( $values ) ) {
				continue;
			}
			foreach ( $values as $rawSlug => $value ) {
				$slug = self::slugKey( $rawSlug );
				if ( null !== $slug && is_string( $value ) && '' !== $value ) {
					$tokens[ $category ][ $slug ] = $value;
				}
			}
		}

		$breakpoints = [];
		foreach ( ( $overrides['breakpoints'] ?? [] ) as $id => $max ) {
			if ( is_string( $id ) && is_int( $max ) && $max > 0 ) {
				$breakpoints[ $id ] = $max;
			}
		}

		$typeRoles = [];
		foreach ( ( $overrides['typeRoles'] ?? [] ) as $role => $props ) {
			if ( ! is_string( $role ) || ! is_array( $props ) ) {
				continue;
			}
			foreach ( $props as $prop => $value ) {
				if ( is_string( $prop ) && is_string( $value ) && '' !== $value ) {
					$typeRoles[ $role ][ $prop ] = $value;
				}
			}
		}

		return [
			'tokens' => $tokens,
			'breakpoints' => $breakpoints,
			'typeRoles' => $typeRoles,
		];
	}

	/**
	 * Sparse, per-prop-validated `{role: {prop: value}}` map. Unknown roles/props and invalid
	 * values are dropped rather than failing the request.
	 *
	 * @param mixed $input
	 * @param array<string, list<string>> $catalogue
	 * @return array<string, array<string, string>>
	 */
	private static function sanitizeTypeRoles( mixed $input, array $catalogue ): array {
		if ( ! is_array( $input ) ) {
			return [];
		}

		$families = $catalogue['fontFamily'] ?? [];
		$roles = [];

		foreach ( $input as $role => $props ) {
			if ( ! is_string( $role ) || ! in_array( $role, TypeRoles::ROLES, true ) || ! is_array( $props ) ) {
				continue;
			}

			foreach ( $props as $prop => $value ) {
				if ( ! is_string( $prop ) || ! in_array( $prop, TypeRoles::PROPS, true ) ) {
					continue;
				}

				$clean = self::sanitizeRoleProp( $prop, $value, $families );
				if ( null !== $clean ) {
					$roles[ $role ][ $prop ] = $clean;
				}
			}
		}

		return $roles;
	}

	/**
	 * @param mixed $value
	 * @param list<string> $families
	 */
	private static function sanitizeRoleProp( string $prop, mixed $value, array $families ): ?string {
		$clean = self::sanitizeTokenValue( $value );
		if ( null === $clean ) {
			return null;
		}

		// Reject CSS-injection / delimiter characters across every prop (these flow into element
		// styles and, for lead/code, into custom-property values).
		if ( 1 === preg_match( '/[;{}<>]/', $clean ) ) {
			return null;
		}

		// Each arm is parenthesised: consecutive unparenthesised ternaries in match arms trip
		// PHPCompatibility's removed-ternary-associativity sniff.
		return match ( $prop ) {
			'fontWeight' => ( in_array( $clean, self::FONT_WEIGHTS, true ) ? $clean : null ),
			'textTransform' => ( in_array( $clean, self::TEXT_TRANSFORMS, true ) ? $clean : null ),
			'lineHeight' => ( 1 === preg_match( '/^\d*\.?\d+(px|rem|em|%)?$/', $clean ) ? $clean : null ),
			'fontSize', 'letterSpacing' => ( self::isLength( $clean ) ? $clean : null ),
			'fontFamily' => ( self::isFamily( $clean, $families ) ? $clean : null ),
			default => null,
		};
	}

	/** A CSS length/keyword we allow for size/letter-spacing — concrete unit, clamp/calc, or `normal`/`0`. */
	private static function isLength( string $value ): bool {
		if ( 'normal' === $value || '0' === $value ) {
			return true;
		}
		if ( 1 === preg_match( '/^(clamp|calc|min|max)\([^;{}<>]*\)$/', $value ) ) {
			return true;
		}

		return 1 === preg_match( '/^-?\d*\.?\d+(px|rem|em|%|vw|vh|ch|ex|pt)$/', $value );
	}

	/** A font family: a known token slug, a `var(--wp--preset--font-family--…)` ref, or a literal stack. */
	private static function isFamily( string $value, array $families ): bool {
		if ( in_array( $value, $families, true ) ) {
			return true;
		}
		if ( 1 === preg_match( '/^var\(--wp--preset--font-family--[a-z0-9-]+\)$/', $value ) ) {
			return true;
		}

		// Literal stack: letters, digits, spaces, commas, quotes, hyphens only.
		return 1 === preg_match( '/^[A-Za-z0-9 ,"\'\-]+$/', $value );
	}

	/**
	 * @param mixed $input
	 * @param array<string, list<string>> $catalogue
	 * @return array<string, array<string, string>>
	 */
	private static function sanitizeTokens( mixed $input, array $catalogue ): array {
		if ( ! is_array( $input ) ) {
			return [];
		}

		$tokens = [];

		foreach ( $input as $category => $values ) {
			if ( ! is_string( $category ) || ! isset( $catalogue[ $category ] ) || ! is_array( $values ) ) {
				continue;
			}

			foreach ( $values as $rawSlug => $value ) {
				$slug = self::slugKey( $rawSlug );
				if ( null === $slug || ! in_array( $slug, $catalogue[ $category ], true ) ) {
					continue;
				}

				$value = self::sanitizeTokenValue( $value );
				if ( null === $value || ! self::isValidTokenValue( $category, $value ) ) {
					continue;
				}

				$tokens[ $category ][ $slug ] = $value;
			}
		}

		return $tokens;
	}

	/**
	 * @param mixed $input
	 * @param list<array<string, mixed>> $defaults
	 * @return array<string, int>
	 */
	private static function sanitizeBreakpoints( mixed $input, array $defaults ): array {
		if ( ! is_array( $input ) ) {
			return [];
		}

		$editable = [];
		foreach ( $defaults as $breakpoint ) {
			if ( 'base' === ( $breakpoint['id'] ?? null ) ) {
				continue;
			}
			if ( isset( $breakpoint['id'] ) && is_string( $breakpoint['id'] ) ) {
				$editable[] = $breakpoint['id'];
			}
		}

		$breakpoints = [];
		foreach ( $input as $id => $max ) {
			if ( ! is_string( $id ) || ! in_array( $id, $editable, true ) ) {
				continue;
			}

			if ( is_string( $max ) && 1 === preg_match( '/^\d+$/', $max ) ) {
				$max = (int) $max;
			}

			if ( is_int( $max ) && $max >= 320 && $max <= 2400 ) {
				$breakpoints[ $id ] = $max;
			}
		}

		return $breakpoints;
	}

	/**
	 * Per-category value guards for the numeric custom groups. Other categories (CSS-string customs
	 * like ring/borderStyle/gradient, presets) accept any sanitized value — same as the existing
	 * transition/transform/filter customs.
	 */
	private static function isValidTokenValue( string $category, string $value ): bool {
		return match ( $category ) {
			'opacity' => is_numeric( $value ) && (float) $value >= 0 && (float) $value <= 1,
			// Already a Yoda condition. The sniff scans back past the preceding match arm and
			// misreads this one, so it is silenced here rather than rewritten.
			'zIndex' => 1 === preg_match( '/^\d+$/', $value ), // phpcs:ignore WordPress.PHP.YodaConditions.NotYoda
			default => true,
		};
	}

	/**
	 * An override bag is keyed by token slug, and PHP silently casts a **numeric-string array key
	 * to an int** — so a theme whose scale uses numeric slugs (`spacing.50`, the Twenty Twenty-Five
	 * family) arrives here as `[50 => '1.125rem']`. A bare `is_string($slug)` guard therefore drops
	 * every numeric slug on the floor: unsavable in the admin and in the editor sidebar alike.
	 *
	 * Use this wherever an override bag is walked by key. Returns null only for a key that is
	 * genuinely neither a slug nor a number.
	 */
	public static function slugKey( mixed $key ): ?string {
		return is_string( $key ) ? $key : ( is_int( $key ) ? (string) $key : null );
	}

	/**
	 * Normalize a user-supplied token slug: lowercase kebab, alphanumerics + hyphens only. Returns
	 * null for empty or over-long input. Shared by the custom-slug registry.
	 */
	public static function sanitizeSlug( mixed $value ): ?string {
		if ( ! is_string( $value ) ) {
			return null;
		}

		$slug = strtolower( trim( $value ) );
		$slug = preg_replace( '/[^a-z0-9]+/', '-', $slug ) ?? '';
		$slug = trim( $slug, '-' );

		if ( '' === $slug || strlen( $slug ) > 40 ) {
			return null;
		}

		return $slug;
	}

	private static function sanitizeTokenValue( mixed $value ): ?string {
		if ( ! is_scalar( $value ) ) {
			return null;
		}

		$value = trim( (string) $value );
		if ( '' === $value || strlen( $value ) > self::MAX_TOKEN_VALUE_LENGTH ) {
			return null;
		}

		$stripped = preg_replace( '/[\x00-\x1F\x7F]/', '', $value );

		return $stripped ? $stripped : null;
	}
}
