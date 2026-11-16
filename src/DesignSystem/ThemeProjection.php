<?php
/**
 * Projects theme.json settings into concrete design-token values.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Projects theme.json settings into concrete token, breakpoint and font values.
 */
final class ThemeProjection {

	/** A fill, and the token for the text drawn on it ({@see readableForegrounds()}). */
	private const FOREGROUND_PAIRS = [
		'primary' => 'primary-foreground',
		'secondary' => 'secondary-foreground',
		'accent' => 'accent-foreground',
		'card' => 'card-foreground',
		'popover' => 'popover-foreground',
	];

	/** WCAG AA for body text; a button label is body-sized. */
	private const READABLE_RATIO = 4.5;

	/** The plugin's own light and dark foregrounds, the two a swap chooses between. */
	private const READABLE_LIGHT = '#fafafa';
	private const READABLE_DARK = '#18181b';

	private const FALLBACKS = [
		'color' => [
			'background' => '#ffffff',
			'foreground' => '#09090b',
			'primary' => '#18181b',
			'primary-foreground' => '#fafafa',
			'secondary' => '#f4f4f5',
			'secondary-foreground' => '#18181b',
			'muted' => '#f4f4f5',
			'muted-foreground' => '#71717a',
			'accent' => '#f4f4f5',
			'accent-foreground' => '#18181b',
			'destructive' => '#dc2626',
			'border' => '#e4e4e7',
			'input' => '#e4e4e7',
			'ring' => '#18181b',
			'card' => '#ffffff',
			'card-foreground' => '#09090b',
			'popover' => '#ffffff',
			'popover-foreground' => '#09090b',
		],
		'spacing' => [
			'0' => '0',
			'px' => '1px',
			'xs' => '0.5rem',
			'sm' => '0.75rem',
			'md' => '1rem',
			'lg' => '1.5rem',
			'xl' => '2rem',
			'2xl' => '3rem',
			'3xl' => '4rem',
			'4xl' => '6rem',
		],
		'radius' => [
			'none' => '0',
			'sm' => '0.25rem',
			'md' => '0.5rem',
			'lg' => '0.75rem',
			'xl' => '1rem',
			'full' => '9999px',
		],
		'shadow' => [
			'none' => 'none',
			'sm' => '0 1px 2px rgb(0 0 0 / 0.08)',
			'md' => '0 4px 8px rgb(0 0 0 / 0.1)',
			'lg' => '0 10px 20px rgb(0 0 0 / 0.12)',
			'xl' => '0 20px 30px rgb(0 0 0 / 0.16)',
		],
		'fontSize' => [
			'xs' => '0.75rem',
			'sm' => '0.875rem',
			'base' => '1rem',
			'lg' => '1.125rem',
			'xl' => '1.25rem',
			'2xl' => '1.5rem',
			'3xl' => '1.875rem',
			'4xl' => '2.25rem',
		],
		'fontFamily' => [
			'sans' => 'system-ui, sans-serif',
			'serif' => 'Georgia, serif',
			'mono' => 'ui-monospace, monospace',
		],
		'transition' => [
			'fast' => 'all 150ms ease',
			'base' => 'all 200ms ease',
			'slow' => 'all 300ms ease',
		],
		'transform' => [
			'lift' => 'translateY(-2px)',
			'press' => 'translateY(1px)',
			'zoom' => 'scale(1.05)',
		],
		'filter' => [
			'blur' => 'blur(4px)',
			'dim' => 'brightness(0.85)',
			'grayscale' => 'grayscale(1)',
		],
		'gradient' => [
			'brand' => 'linear-gradient(135deg, #002bff, #5b7bff)',
			'paper' => 'linear-gradient(180deg, #ffffff, #f1f5f9)',
			'atomic' => 'linear-gradient(135deg, #a440ce, #8bf6ff)',
			// What a section paints behind its cards. The page's own colour unless the design
			// language needs something to show through its surfaces (Glassmorphism, Liquid Glass).
			'backdrop' => 'linear-gradient(var(--blicks-color-background), var(--blicks-color-background))',
		],
		'zIndex' => [
			'base' => '1',
			'sticky' => '100',
			'drawer' => '400',
			'popover' => '600',
			'drag' => '800',
			'toast' => '1000',
		],
		'opacity' => [
			'disabled' => '0.4',
			'muted' => '0.64',
			'scrim' => '0.55',
			'hover' => '0.06',
		],
		'borderWidth' => [
			'hair' => '1px',
			'strong' => '2px',
			'heavy' => '3px',
		],
		'width' => [
			'prose' => '720px',
			'content' => '1080px',
			'wide' => '1360px',
			'full' => '1600px',
		],
		'aspect' => [
			'square' => '1 / 1',
			'wide' => '16 / 9',
			'portrait' => '3 / 4',
		],
		'leading' => [
			'tight' => '1.1',
			'snug' => '1.3',
			'body' => '1.55',
			'loose' => '1.7',
		],
		// Layout content width. Aliases the active theme's content size (Site Editor ▸ Layout),
		// falling back to 1200px. Emitted as --blicks-content-size; override via design-system settings.
		'content' => [
			'size' => 'var(--wp--style--global--content-size, 1200px)',
		],
	];

	/**
	 * The plugin's own token values, keyed category → slug. These are the values every slug in the
	 * shared catalogue (`resources/design-system/tokens.json`) resolves to before the active theme
	 * is projected over them, so they double as the base-scale floor {@see CssVariables} emits.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function baseFallbacks(): array {
		return self::FALLBACKS;
	}

	/** @param array<string, list<string>> $catalogue */
	public static function current( array $catalogue ): array {
		$settings = self::currentSettings();
		return self::fromSettings( is_array( $settings ) ? $settings : [], $catalogue );
	}

	/** @return array<string, mixed> */
	public static function currentSettings(): array {
		$settings = wp_get_global_settings();

		return is_array( $settings ) ? $settings : [];
	}

	/**
	 * @param array<string, mixed> $settings
	 * @param array<string, list<string>> $catalogue
	 * @return array<string, array<string, string>>
	 */
	public static function fromSettings( array $settings, array $catalogue ): array {
		$values = [];

		foreach ( $catalogue as $category => $slugs ) {
			foreach ( $slugs as $slug ) {
				$values[ $category ][ $slug ] = self::FALLBACKS[ $category ][ $slug ] ?? '';
			}
		}

		$themeColors = [];

		foreach ( TokenMap::descriptors() as $descriptor ) {
			$category = $descriptor['category'];
			if ( ! isset( $values[ $category ] ) ) {
				continue;
			}

			if ( 'preset' === $descriptor['kind'] ) {
				$presets = self::presetList( $settings, $descriptor['settings'] );
				self::applyPresets( $values[ $category ], $presets, (string) $descriptor['valueKey'] );
				if ( 'color' === $category ) {
					foreach ( $presets as $preset ) {
						if ( is_string( $preset['slug'] ?? null ) ) {
							$themeColors[] = $preset['slug'];
						}
					}
				}
				continue;
			}

			if ( 'custom' === $descriptor['kind'] ) {
				self::applyCustomMap( $values[ $category ], self::customMap( $settings, $descriptor['settings'] ) );
				continue;
			}

			if ( 'layout' === $descriptor['kind'] ) {
				$value = self::path( $settings, $descriptor['settings'] );
				$slug = $catalogue[ $category ][0] ?? null;
				if ( is_string( $slug ) && is_scalar( $value ) ) {
					$values[ $category ][ $slug ] = (string) $value;
				}
			}
		}

		if ( isset( $values['color'] ) ) {
			self::readableForegrounds( $values['color'], $themeColors );
		}

		return $values;
	}

	/**
	 * @param array<string, mixed> $settings
	 * @param list<array<string, mixed>> $defaults
	 * @return list<array<string, mixed>>
	 */
	public static function breakpointsFromSettings( array $settings, array $defaults ): array {
		$descriptor = TokenMap::forCategory( 'breakpoints' );
		if ( null === $descriptor ) {
			return $defaults;
		}

		$custom = self::customMap( $settings, $descriptor['settings'] );
		if ( [] === $custom ) {
			return $defaults;
		}

		return array_map(
			static function ( array $breakpoint ) use ( $custom ): array {
				$id = $breakpoint['id'] ?? null;
				if ( ! is_string( $id ) || ! array_key_exists( $id, $custom ) ) {
					return $breakpoint;
				}

				$max = $custom[ $id ];
				if ( is_int( $max ) && $max > 0 ) {
					$breakpoint['max'] = $max;
				} elseif ( is_string( $max ) && 1 === preg_match( '/^\d+$/', $max ) ) {
					$breakpoint['max'] = (int) $max;
				}

				return $breakpoint;
			},
			$defaults
		);
	}

	/**
	 * Live list of font families registered with the active theme — covers theme.json
	 * presets AND families installed via the native WP Font Library (which writes the
	 * same `typography.fontFamilies` slice). Each row carries the WP slug, a human label,
	 * the resolved CSS stack, and the theme.json origin so the manager UI can tell
	 * theme-baked families from user-installed ones (only the latter are uninstallable).
	 *
	 * @param array<string,mixed>|null $settings Pass an explicit settings tree (used by tests);
	 *                                           defaults to `wp_get_global_settings()`.
	 * @return list<array{slug:string, name:string, fontFamily:string, source:string}>
	 */
	public static function fontFamilies( ?array $settings = null ): array {
		if ( null === $settings ) {
			$settings = wp_get_global_settings();
		}
		if ( ! is_array( $settings ) ) {
			return [];
		}

		$raw = self::path( $settings, [ 'typography', 'fontFamilies' ] );
		if ( ! is_array( $raw ) ) {
			return [];
		}

		// Modern WP (6.1+) groups presets by origin: `{ default: [...], theme: [...], custom: [...] }`.
		// Font Library installs land in the `custom` bucket; theme.json families in `theme`. Older
		// sites can still surface a flat list — detect by checking whether the top-level entries
		// are themselves origin arrays vs preset objects.
		$groups = self::isOriginGrouped( $raw ) ? $raw : [ 'theme' => $raw ];

		$families = [];
		foreach ( $groups as $origin => $presets ) {
			if ( ! is_array( $presets ) ) {
				continue;
			}
			foreach ( $presets as $preset ) {
				if ( ! is_array( $preset ) ) {
					continue;
				}
				$slug   = is_string( $preset['slug'] ?? null ) ? $preset['slug'] : null;
				$name   = is_string( $preset['name'] ?? null ) ? $preset['name'] : null;
				$stack  = is_string( $preset['fontFamily'] ?? null ) ? $preset['fontFamily'] : null;
				$source = is_string( $preset['origin'] ?? null )
					? $preset['origin']
					: ( is_string( $origin ) ? $origin : 'theme' );
				if ( null === $slug || null === $stack ) {
					continue;
				}
				$families[] = [
					'slug'       => $slug,
					'name'       => $name ?? ucwords( str_replace( [ '-', '_' ], ' ', $slug ) ),
					'fontFamily' => $stack,
					'source'     => $source,
				];
			}
		}
		return $families;
	}

	/** @param array<int|string, mixed> $value */
	private static function isOriginGrouped( array $value ): bool {
		foreach ( $value as $key => $entry ) {
			// Origin keys are strings (`default` / `theme` / `custom`). A flat preset list has
			// numeric keys *and* its entries each carry a `slug` field.
			if ( is_string( $key ) ) {
				return true;
			}
			if ( is_array( $entry ) && array_key_exists( 'slug', $entry ) ) {
				return false;
			}
		}
		return false;
	}

	/**
	 * @param array<string, array<string, string>> $values
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>} $overrides
	 * @param bool $readable Keep text readable on a fill this layer changes without its foreground
	 *                       ({@see readableForegrounds()}). On for the design language, which sits
	 *                       under the author; off for the author's own values, which the Design
	 *                       screen previews as they are.
	 * @return array<string, array<string, string>>
	 */
	public static function applyOverrides( array $values, array $overrides, bool $readable = false ): array {
		foreach ( $overrides['tokens'] as $category => $tokens ) {
			foreach ( $tokens as $slug => $value ) {
				if ( isset( $values[ $category ][ $slug ] ) ) {
					$values[ $category ][ $slug ] = $value;
				}
			}
		}

		if ( $readable && isset( $values['color'] ) ) {
			self::readableForegrounds( $values['color'], array_map( 'strval', array_keys( $overrides['tokens']['color'] ?? [] ) ) );
		}

		return $values;
	}

	/**
	 * Keeps the text on a fill readable when a layer sets the fill but not the text on it.
	 *
	 * A theme's palette fills Blicks' slugs by name, so Ollie's `secondary` (a dark purple) becomes
	 * `--blicks-color-secondary` while `secondary-foreground`, which Ollie does not define, stays the
	 * plugin's dark default: dark on dark. Mapping neither would drop the theme's brand colours;
	 * mapping the pair is impossible when the theme has no foreground. So the fill is the theme's,
	 * and its foreground is kept while it still reads (WCAG AA, 4.5:1) or else swapped for whichever
	 * of the plugin's light and dark foregrounds reads better on that fill. A foreground the same
	 * layer sets is the author's choice and left alone, and so is any colour this cannot parse
	 * (a `var()`, `color-mix()`, a named colour): no guess is better than a wrong one.
	 *
	 * @param array<string, string> $colors
	 * @param list<string>          $set    Slugs this layer set.
	 */
	private static function readableForegrounds( array &$colors, array $set ): void {
		foreach ( self::FOREGROUND_PAIRS as $fill => $foreground ) {
			if ( ! in_array( $fill, $set, true ) || in_array( $foreground, $set, true ) ) {
				continue;
			}
			if ( ! isset( $colors[ $fill ], $colors[ $foreground ] ) ) {
				continue;
			}

			$fillLuminance = Contrast::luminance( $colors[ $fill ] );
			if ( null === $fillLuminance ) {
				continue;
			}

			$current = Contrast::luminance( $colors[ $foreground ] );
			if ( null !== $current && Contrast::ratio( $fillLuminance, $current ) >= self::READABLE_RATIO ) {
				continue;
			}

			$light = Contrast::ratio( $fillLuminance, (float) Contrast::luminance( self::READABLE_LIGHT ) );
			$dark = Contrast::ratio( $fillLuminance, (float) Contrast::luminance( self::READABLE_DARK ) );
			$colors[ $foreground ] = $light >= $dark ? self::READABLE_LIGHT : self::READABLE_DARK;
		}
	}

	/**
	 * @param array<string, string> $values
	 * @param list<array<string, mixed>> $presets
	 */
	private static function applyPresets( array &$values, array $presets, string $valueKey = 'color' ): void {
		foreach ( $presets as $preset ) {
			$slug = $preset['slug'] ?? null;
			$value = $preset[ $valueKey ] ?? null;

			if ( is_string( $slug ) && is_string( $value ) && isset( $values[ $slug ] ) ) {
				$values[ $slug ] = $value;
			}
		}
	}

	/** @param array<string, string> $values */
	private static function applyCustomMap( array &$values, array $custom ): void {
		foreach ( $custom as $rawSlug => $value ) {
			// Numeric slugs (`spacing.50`) reach us as int keys — see Overrides::slugKey().
			$slug = Overrides::slugKey( $rawSlug );
			if ( null !== $slug && is_scalar( $value ) && isset( $values[ $slug ] ) ) {
				$values[ $slug ] = (string) $value;
			}
		}
	}

	/**
	 * Slugs of the presets the active theme defines at $path (e.g. `color.palette`,
	 * `spacing.spacingSizes`), in theme precedence order. Lets the design system reflect
	 * the real active palette/scales — including a theme's brand accents — rather than only
	 * the fixed plugin token list.
	 *
	 * @param array<string, mixed> $settings
	 * @param list<string> $path
	 * @return list<string>
	 */
	public static function presetSlugs( array $settings, array $path ): array {
		$value = self::path( $settings, $path );
		if ( ! is_array( $value ) ) {
			return [];
		}

		// `wp_get_global_settings()` groups presets by origin (`default` / `theme` / `custom`).
		// Skip the `default` bucket: WP's built-in palette and scales are not part of the active
		// theme's design system. Keep theme + custom (+ any user origin).
		if ( self::isOriginGrouped( $value ) ) {
			$merged = [];
			foreach ( $value as $origin => $presets ) {
				if ( 'default' === $origin || ! is_array( $presets ) ) {
					continue;
				}
				foreach ( $presets as $preset ) {
					$merged[] = $preset;
				}
			}
			$value = $merged;
		}

		$slugs = [];
		foreach ( $value as $preset ) {
			if ( ! is_array( $preset ) ) {
				continue;
			}
			$slug = $preset['slug'] ?? null;
			if ( is_string( $slug ) && '' !== $slug && ! in_array( $slug, $slugs, true ) ) {
				$slugs[] = $slug;
			}
		}

		return $slugs;
	}

	/**
	 * @param array<string, mixed> $settings
	 * @param list<string> $path
	 * @return list<array<string, mixed>>
	 */
	private static function presetList( array $settings, array $path ): array {
		$value = self::path( $settings, $path );
		if ( ! is_array( $value ) ) {
			return [];
		}

		// `wp_get_global_settings()` returns presets origin-grouped — `{ default, theme, custom }`
		// (a user value synced into the Global Styles post lands in `custom`). Flatten in
		// precedence order so later origins override earlier ones in `applyPresets`: default →
		// theme → custom → any other origin. A flat list (e.g. saved theme.json, tests) passes
		// through unchanged.
		if ( self::isOriginGrouped( $value ) ) {
			$ordered = [ 'default', 'theme', 'custom' ];
			$origins = array_merge(
				$ordered,
				array_values( array_diff( array_keys( $value ), $ordered ) )
			);

			$flat = [];
			foreach ( $origins as $origin ) {
				$presets = $value[ $origin ] ?? null;
				if ( is_array( $presets ) ) {
					foreach ( $presets as $preset ) {
						if ( is_array( $preset ) ) {
							$flat[] = $preset;
						}
					}
				}
			}

			return $flat;
		}

		return array_values( array_filter( $value, 'is_array' ) );
	}

	/**
	 * @param array<string, mixed> $settings
	 * @param list<string> $path
	 * @return array<string, mixed>
	 */
	private static function customMap( array $settings, array $path ): array {
		$value = self::path( $settings, $path );
		return is_array( $value ) ? $value : [];
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
