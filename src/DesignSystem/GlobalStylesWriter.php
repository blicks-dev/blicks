<?php
/**
 * Writes design-system values into the user's Global Styles entity.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Merges design-system values into the user's Global Styles entity and persists
 * them.
 */
final class GlobalStylesWriter {

	/**
	 * @param array<string, mixed> $settings
	 * @param array<string, array<string, string>> $tokens
	 * @param array<string, int> $breakpoints
	 * @return array<string, mixed>
	 */
	public static function mergeSettings( array $settings, array $tokens, array $breakpoints ): array {
		foreach ( $tokens as $category => $values ) {
			$descriptor = TokenMap::forCategory( $category );
			if ( null === $descriptor ) {
				continue;
			}

			foreach ( $values as $rawSlug => $value ) {
				// Numeric slugs (`spacing.50`) reach us as int keys — see Overrides::slugKey().
				$slug = Overrides::slugKey( $rawSlug );
				if ( null === $slug || '' === $value ) {
					continue;
				}

				if ( 'preset' === $descriptor['kind'] ) {
					self::upsertPreset( $settings, $descriptor['settings'], $slug, self::label( $slug ), (string) $descriptor['valueKey'], $value );
				} elseif ( 'custom' === $descriptor['kind'] ) {
					self::setPath( $settings, array_merge( $descriptor['settings'], [ TokenMap::kebab( $slug ) ] ), $value );
				} elseif ( 'layout' === $descriptor['kind'] ) {
					self::setPath( $settings, $descriptor['settings'], $value );
				}
			}
		}

		$descriptor = TokenMap::forCategory( 'breakpoints' );
		if ( null !== $descriptor ) {
			foreach ( $breakpoints as $id => $max ) {
				if ( is_string( $id ) && $max > 0 ) {
					self::setPath( $settings, array_merge( $descriptor['settings'], [ TokenMap::kebab( $id ) ] ), $max );
				}
			}
		}

		return $settings;
	}

	/**
	 * Merge per-role typography into the document. Native roles (h1–h6, body, caption) land in
	 * the `styles` tree WordPress already emits element CSS from; custom roles (lead, code) land
	 * in `settings.custom.blicks.typeRoles.*` (consumed via `--blicks-type-*` aliases). Existing
	 * sibling keys are preserved — only the touched leaves change.
	 *
	 * @param array<string, mixed> $data The full Global Styles document (mutated copy returned).
	 * @param array<string, array<string, string>> $typeRoles
	 * @return array<string, mixed>
	 */
	public static function mergeTypeRoles( array $data, array $typeRoles ): array {
		$styles = isset( $data['styles'] ) && is_array( $data['styles'] ) ? $data['styles'] : [];
		$settings = isset( $data['settings'] ) && is_array( $data['settings'] ) ? $data['settings'] : [];

		foreach ( $typeRoles as $role => $props ) {
			$slot = TypeRoles::slot( is_string( $role ) ? $role : '' );
			if ( null === $slot || ! is_array( $props ) ) {
				continue;
			}

			foreach ( $props as $prop => $value ) {
				if ( ! is_string( $prop ) || ! in_array( $prop, TypeRoles::PROPS, true ) || ! is_string( $value ) || '' === $value ) {
					continue;
				}

				$value = 'fontFamily' === $prop ? self::resolveFamily( $value ) : $value;

				if ( 'native' === ( $slot['kind'] ?? '' ) ) {
					self::setPath( $styles, array_merge( $slot['stylesPath'] ?? [], [ $prop ] ), $value );
				} elseif ( 'custom' === ( $slot['kind'] ?? '' ) ) {
					self::setPath( $settings, array_merge( $slot['settingsGroup'] ?? [], [ TypeRoles::kebabProp( $prop ) ] ), $value );
				}
			}
		}

		if ( [] !== $styles ) {
			$data['styles'] = $styles;
		}
		if ( [] !== $settings ) {
			$data['settings'] = $settings;
		}

		return $data;
	}

	/** A bare token slug becomes its preset var; an existing var / literal stack passes through. */
	private static function resolveFamily( string $value ): string {
		if ( 1 === preg_match( '/^[a-z0-9-]+$/', $value ) ) {
			return sprintf( 'var(--wp--preset--font-family--%s)', $value );
		}

		return $value;
	}

	/**
	 * @param array<string, array<string, string>> $tokens
	 * @param array<string, int> $breakpoints
	 */
	public static function persist( array $tokens, array $breakpoints ): bool {
		return self::persistAll( $tokens, $breakpoints, [] );
	}

	/**
	 * Decode the user Global Styles post once, merge settings tokens + breakpoints + type roles,
	 * encode once. Single write avoids racing two post updates within one request.
	 *
	 * @param array<string, array<string, string>> $tokens
	 * @param array<string, int> $breakpoints
	 * @param array<string, array<string, string>> $typeRoles
	 */
	public static function persistAll( array $tokens, array $breakpoints, array $typeRoles ): bool {
		if ( ! self::isAvailable() || ( [] === $tokens && [] === $breakpoints && [] === $typeRoles ) ) {
			return false;
		}

		$postId = (int) \WP_Theme_JSON_Resolver::get_user_global_styles_post_id();
		if ( $postId <= 0 ) {
			return false;
		}

		$post = get_post( $postId );
		if ( ! is_object( $post ) || ! isset( $post->post_content ) ) {
			return false;
		}

		$content = is_string( $post->post_content ) ? $post->post_content : '{}';
		try {
			$data = json_decode( '' !== $content ? $content : '{}', true, 512, JSON_THROW_ON_ERROR );
		} catch ( \JsonException ) {
			$data = [];
		}
		if ( ! is_array( $data ) ) {
			$data = [];
		}

		$settings = isset( $data['settings'] ) && is_array( $data['settings'] ) ? $data['settings'] : [];
		$data['version'] = isset( $data['version'] ) && is_int( $data['version'] ) ? $data['version'] : 3;
		$data['settings'] = self::mergeSettings( $settings, $tokens, $breakpoints );

		if ( [] !== $typeRoles ) {
			$data = self::mergeTypeRoles( $data, $typeRoles );
		}

		$encoded = function_exists( 'wp_json_encode' )
			? wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
            // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- fallback for the branch where wp_json_encode() is unavailable.
			: json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		if ( ! is_string( $encoded ) || '' === $encoded ) {
			return false;
		}

		$result = wp_update_post(
			[
				'ID' => $postId,
				'post_content' => $encoded,
			],
			true
		);

		if ( ( function_exists( 'is_wp_error' ) && is_wp_error( $result ) ) || 0 === $result ) {
			return false;
		}

		\WP_Theme_JSON_Resolver::clean_cached_data();

		return true;
	}

	public static function isAvailable(): bool {
		return function_exists( 'wp_theme_has_theme_json' )
			&& wp_theme_has_theme_json()
			&& class_exists( 'WP_Theme_JSON_Resolver' )
			&& method_exists( 'WP_Theme_JSON_Resolver', 'get_user_global_styles_post_id' )
			&& function_exists( 'get_post' )
			&& function_exists( 'wp_update_post' );
	}

	/**
	 * @param array<string, mixed> $settings
	 * @param list<string> $path
	 */
	private static function upsertPreset( array &$settings, array $path, string $slug, string $name, string $valueKey, string $value ): void {
		$presets = self::getPath( $settings, $path );
		$presets = is_array( $presets ) ? array_values( array_filter( $presets, 'is_array' ) ) : [];
		$found = false;

		foreach ( $presets as &$preset ) {
			if ( ( $preset['slug'] ?? null ) !== $slug ) {
				continue;
			}

			$preset['name'] = is_string( $preset['name'] ?? null ) ? $preset['name'] : $name;
			$preset[ $valueKey ] = $value;
			$found = true;
			break;
		}
		unset( $preset );

		if ( ! $found ) {
			$presets[] = [
				'slug' => $slug,
				'name' => $name,
				$valueKey => $value,
			];
		}

		self::setPath( $settings, $path, $presets );
	}

	/**
	 * @param array<string, mixed> $data
	 * @param list<string> $path
	 */
	private static function getPath( array $data, array $path ): mixed {
		$value = $data;
		foreach ( $path as $segment ) {
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return null;
			}
			$value = $value[ $segment ];
		}

		return $value;
	}

	/**
	 * @param array<string, mixed> $data
	 * @param list<string> $path
	 */
	private static function setPath( array &$data, array $path, mixed $value ): void {
		$target =& $data;
		foreach ( $path as $index => $segment ) {
			if ( count( $path ) - 1 === $index ) {
				$target[ $segment ] = $value;
				return;
			}

			if ( ! isset( $target[ $segment ] ) || ! is_array( $target[ $segment ] ) ) {
				$target[ $segment ] = [];
			}
			$target =& $target[ $segment ];
		}
	}

	private static function label( string $slug ): string {
		return ucwords( str_replace( [ '-', '_' ], ' ', $slug ) );
	}
}
