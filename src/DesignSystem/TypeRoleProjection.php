<?php
/**
 * Projects theme and Global Styles into per-role typography values.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Projects the active theme + user Global Styles into concrete per-role typography values —
 * the read half of the {@see TypeRoles} layer (the write half is {@see GlobalStylesWriter}).
 *
 * Native roles read from the merged `styles` tree (`wp_get_global_styles()`), with a
 * per-h{n} → `elements.heading` → DEFAULTS precedence so the editor shows the true effective
 * look. Custom roles (lead, code) read from `settings.custom.blicks.typeRoles.*`.
 */
final class TypeRoleProjection {

	/**
	 * Live values for every role, projected from the active theme + user Global Styles.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function current(): array {
		$styles = function_exists( 'wp_get_global_styles' ) ? wp_get_global_styles() : [];
		$settings = ThemeProjection::currentSettings();

		return self::fromStylesAndSettings( is_array( $styles ) ? $styles : [], $settings );
	}

	/**
	 * Pure projection (testable without a WP bootstrap).
	 *
	 * @param array<string, mixed> $styles   The `styles` tree (root of `styles`, not the document).
	 * @param array<string, mixed> $settings The `settings` tree (for custom roles).
	 * @return array<string, array<string, string>>
	 */
	public static function fromStylesAndSettings( array $styles, array $settings ): array {
		$values = [];

		$headingFallback = self::path( $styles, [ 'elements', 'heading', 'typography' ] );
		$headingFallback = is_array( $headingFallback ) ? $headingFallback : [];

		foreach ( TypeRoles::ROLES as $role ) {
			$slot = TypeRoles::slot( $role );
			$defaults = TypeRoles::DEFAULTS[ $role ] ?? [];

			foreach ( TypeRoles::PROPS as $prop ) {
				$value = null;

				if ( null !== $slot && 'native' === ( $slot['kind'] ?? '' ) ) {
					$value = self::path( $styles, array_merge( $slot['stylesPath'] ?? [], [ $prop ] ) );

					// For heading levels, fall back to the shared `elements.heading` look before
					// the baked default — mirrors WP's element cascade.
					if ( ! is_string( $value ) && in_array( $role, [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ], true ) ) {
						$value = $headingFallback[ $prop ] ?? null;
					}
				} elseif ( null !== $slot && 'custom' === ( $slot['kind'] ?? '' ) ) {
					$value = self::path( $settings, array_merge( $slot['settingsGroup'] ?? [], [ TypeRoles::kebabProp( $prop ) ] ) );
				}

				$values[ $role ][ $prop ] = is_string( $value ) && '' !== $value
					? $value
					: ( $defaults[ $prop ] ?? '' );
			}
		}

		return $values;
	}

	/**
	 * Overlay sparse `{role: {prop: value}}` user overrides onto projected values.
	 *
	 * @param array<string, array<string, string>> $values
	 * @param array<string, array<string, string>> $overrides
	 * @return array<string, array<string, string>>
	 */
	public static function applyOverrides( array $values, array $overrides ): array {
		foreach ( $overrides as $role => $props ) {
			if ( ! is_array( $props ) || ! isset( $values[ $role ] ) ) {
				continue;
			}
			foreach ( $props as $prop => $value ) {
				if ( is_string( $prop ) && is_string( $value ) && isset( $values[ $role ][ $prop ] ) ) {
					$values[ $role ][ $prop ] = $value;
				}
			}
		}

		return $values;
	}

	/** @param list<string> $path */
	private static function path( array $data, array $path ): mixed {
		$value = $data;
		foreach ( $path as $segment ) {
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return null;
			}
			$value = $value[ $segment ];
		}

		return $value;
	}
}
