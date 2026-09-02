<?php
/**
 * Reusable argument definitions for register_rest_route().
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reusable `args` definitions for register_rest_route().
 *
 * Declaring only `'type'` on a REST arg does **not** make WordPress sanitize it — the type is
 * advisory unless a `sanitize_callback` is present. These builders supply the callbacks so every
 * declared argument is sanitized at the REST boundary.
 *
 * This is the *first* of two layers, not the only one. Structured payloads (token bags, type
 * roles, breakpoints, animation steps) are narrowed again downstream by the allowlist validators
 * that own each shape — {@see \Blicks\DesignSystem\Overrides::sanitize()},
 * {@see \Blicks\DesignSystem\DesignThemes}, {@see \Blicks\DesignSystem\Animations} and
 * {@see \Blicks\Settings\AdminSettings::save()}. Those decide what a *valid* slug or value is;
 * this layer only guarantees that what reaches them is well-formed, tag-free scalar data.
 */
final class RestArgs {

	private function __construct() {}

	/** A short free-text field (theme names, animation labels). */
	public static function text( bool $required = false ): array {
		return [
			'type' => 'string',
			'required' => $required,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => static fn ( $value ): bool => is_string( $value ),
		];
	}

	/**
	 * An identifier that appears in a URL path or an option key. Deliberately not `sanitize_key`:
	 * ids and slugs here are case-sensitive (`[A-Za-z0-9_-]+` in the route regex), and lowercasing
	 * them would silently break lookups.
	 */
	public static function identifier( bool $required = false ): array {
		return [
			'type' => 'string',
			'required' => $required,
			'sanitize_callback' => static fn ( $value ): string => is_string( $value )
				? (string) preg_replace( '/[^A-Za-z0-9_-]/', '', $value )
				: '',
			'validate_callback' => static fn ( $value ): bool => is_string( $value ) && '' !== $value,
		];
	}

	/** A boolean flag. */
	public static function boolean(): array {
		return [
			'type' => 'boolean',
			'sanitize_callback' => 'rest_sanitize_boolean',
		];
	}

	/** A string constrained to a fixed set of values. */
	public static function enum( array $allowed ): array {
		return [
			'type' => 'string',
			'enum' => $allowed,
			'sanitize_callback' => 'sanitize_key',
			'validate_callback' => static fn ( $value ): bool => is_string( $value )
				&& in_array( sanitize_key( $value ), $allowed, true ),
		];
	}

	/** A nested map (token bags, breakpoints, type roles, animation defaults). */
	public static function object(): array {
		return [
			'type' => 'object',
			'sanitize_callback' => [ self::class, 'deepSanitize' ],
			'validate_callback' => static fn ( $value ): bool => is_array( $value ),
		];
	}

	/** A list (reset categories, animation steps). */
	public static function list( bool $required = false ): array {
		return [
			'type' => 'array',
			'required' => $required,
			'sanitize_callback' => [ self::class, 'deepSanitize' ],
			'validate_callback' => static fn ( $value ): bool => is_array( $value ),
		];
	}

	/**
	 * Recursively strip tags and invalid UTF-8 from every scalar leaf, preserving structure.
	 *
	 * Keys are passed through untouched on purpose: token maps are keyed by category and slug,
	 * and type-role props are camelCase (`fontSize`, `lineHeight`). Running `sanitize_key` over
	 * them would lowercase the props and break every downstream allowlist match. The allowlists
	 * are what reject unknown keys; this only cleans values.
	 *
	 * Depth is capped so a deeply nested payload cannot exhaust the stack.
	 *
	 * WordPress invokes a `sanitize_callback` as `($value, $request, $param)`, so this entry point
	 * takes only the value and swallows the extra arguments; the depth counter belongs to the
	 * private recursion below and must never be fed from the request.
	 *
	 * @param mixed $value
	 * @return mixed
	 */
	public static function deepSanitize( mixed $value ): mixed {
		return self::sanitizeBranch( $value, 0 );
	}

	/**
	 * @param mixed $value
	 * @return mixed
	 */
	private static function sanitizeBranch( mixed $value, int $depth ): mixed {
		if ( $depth > 10 ) {
			return null;
		}

		if ( is_array( $value ) ) {
			$clean = [];
			foreach ( $value as $key => $item ) {
				$clean[ $key ] = self::sanitizeBranch( $item, $depth + 1 );
			}

			return $clean;
		}

		if ( is_string( $value ) ) {
			return sanitize_text_field( $value );
		}

		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			return $value;
		}

		return null;
	}
}
