<?php
/**
 * Maps each Blicks token category onto its theme.json settings.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The single source of truth for how each Blicks token category maps onto the
 * **theme.json v3** schema (`https://schemas.wp.org/trunk/theme.json`, `"version": 3`).
 *
 * BOTH directions consume this one table:
 *  - **read**  — {@see ThemeProjection} projects the active theme's settings → Blicks values.
 *  - **write** — {@see GlobalStylesWriter} writes Blicks values back into the user Global Styles.
 *
 * Because read and write walk the *same* descriptors (one inverted from the other), round-trip
 * parity is structural, not coincidental. Don't hardcode a theme.json path anywhere else — add or
 * change it here.
 *
 * Each descriptor:
 *   - `category`  — the Blicks token category (matches `resources/design-system/tokens.json`,
 *                   plus the synthetic `breakpoints` category sourced from `breakpoints.json`).
 *   - `kind`      — `preset` | `custom` | `layout` (how WP stores it; see below).
 *   - `settings`  — verbatim key path under theme.json `settings`.
 *   - `valueKey`  — for `preset`, the item value property (items are `{ slug, name, <valueKey> }`).
 *                   `null` for `custom` (a flat `slug => value` map) and `layout` (a bare scalar).
 *   - `presetVar` — for `preset`, the `{category}` in `--wp--preset--{category}--{slug}`.
 *   - `cssVar`    — for `layout` only, the fixed CSS var (no slug fan-out).
 *
 * | kind   | theme.json shape                                   | CSS var                                  |
 * |--------|----------------------------------------------------|------------------------------------------|
 * | preset | `settings.<path>` = `[ {slug,name,<valueKey>}, ]`  | `--wp--preset--{presetVar}--{slug}`      |
 * | custom | `settings.custom.blicks.<group>` = `{slug:value}`  | `--wp--custom--blicks--{group}--{slug}`  |
 * | layout | `settings.<path>` = scalar string                  | the descriptor's fixed `cssVar`          |
 *
 * Slug strategy: **unprefixed** — a Blicks slug IS the WP preset slug. A same-slug collision with a
 * theme preset is an intentional user-origin override (WP user origin wins). Slugs the theme lacks
 * are simply added to the native UI.
 */
final class TokenMap {

	/**
	 * @var list<array{
	 *   category: string,
	 *   kind: 'preset'|'custom'|'layout',
	 *   settings: list<string>,
	 *   valueKey: string|null,
	 *   presetVar: string|null,
	 *   cssVar: string|null,
	 *   source: 'tokens'|'breakpoints'
	 * }>
	 */
	private const DESCRIPTORS = [
		// --- Native presets (visible to core block UI) -------------------------------------------
		[
			'category' => 'color',
			'kind' => 'preset',
			'settings' => [ 'color', 'palette' ],
			'valueKey' => 'color',
			'presetVar' => 'color',
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'spacing',
			'kind' => 'preset',
			'settings' => [ 'spacing', 'spacingSizes' ],
			'valueKey' => 'size',
			'presetVar' => 'spacing',
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'fontSize',
			'kind' => 'preset',
			'settings' => [ 'typography', 'fontSizes' ],
			'valueKey' => 'size',
			'presetVar' => 'font-size',
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'fontFamily',
			'kind' => 'preset',
			'settings' => [ 'typography', 'fontFamilies' ],
			'valueKey' => 'fontFamily',
			'presetVar' => 'font-family',
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'radius',
			'kind' => 'preset',
			'settings' => [ 'border', 'radiusSizes' ],
			'valueKey' => 'size',
			'presetVar' => 'border-radius',
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'shadow',
			'kind' => 'preset',
			'settings' => [ 'shadow', 'presets' ],
			'valueKey' => 'shadow',
			'presetVar' => 'shadow',
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'gradient',
			'kind' => 'preset',
			'settings' => [ 'color', 'gradients' ],
			'valueKey' => 'gradient',
			'presetVar' => 'gradient',
			'cssVar' => null,
			'source' => 'tokens',
		],

		// --- Layout (single scalar, not a preset array) ------------------------------------------
		[
			'category' => 'content',
			'kind' => 'layout',
			'settings' => [ 'layout', 'contentSize' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => '--wp--style--global--content-size',
			'source' => 'tokens',
		],

		// --- Blicks-only customs (no native slot) → settings.custom.blicks.* ---------------------
		[
			'category' => 'transition',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'transition' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'transform',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'transform' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'filter',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'filter' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'zIndex',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'zIndex' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'opacity',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'opacity' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'borderWidth',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'borderWidth' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'borderStyle',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'borderStyle' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'ring',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'ring' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'width',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'width' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'aspect',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'aspect' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'leading',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'leading' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
		[
			'category' => 'breakpoints',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'breakpoints' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'breakpoints',
		],

		// --- Component tokens — global per-component looks (theme.json custom.blicks.<component>).
		// Each emits `--blicks-<component>-<prop>`; a component's base CSS consumes them with a
		// primitive fallback, so a theme restyles all buttons (etc.) in one place without bending a
		// primitive token (e.g. radius-md). Add more components (card, input…) the same way.
		[
			'category' => 'button',
			'kind' => 'custom',
			'settings' => [ 'custom', 'blicks', 'button' ],
			'valueKey' => null,
			'presetVar' => null,
			'cssVar' => null,
			'source' => 'tokens',
		],
	];

	/**
	 * @return list<array{category: string, kind: string, settings: list<string>, valueKey: string|null, presetVar: string|null, cssVar: string|null, source: string}>
	 */
	public static function descriptors(): array {
		return self::DESCRIPTORS;
	}

	/** @return list<string> */
	public static function categories(): array {
		return array_map( static fn ( array $d ): string => $d['category'], self::DESCRIPTORS );
	}

	/**
	 * @return array{category: string, kind: string, settings: list<string>, valueKey: string|null, presetVar: string|null, cssVar: string|null, source: string}|null
	 */
	public static function forCategory( string $category ): ?array {
		foreach ( self::DESCRIPTORS as $descriptor ) {
			if ( $descriptor['category'] === $category ) {
				return $descriptor;
			}
		}

		return null;
	}

	/**
	 * The native CSS custom property a token resolves to once it lives in theme.json. Used to keep
	 * the `--blicks-*` aliases honest and to assert read/write agreement in tests.
	 */
	public static function cssVar( string $category, string $slug ): string {
		$descriptor = self::forCategory( $category );
		if ( null === $descriptor ) {
			return '';
		}

		return match ( $descriptor['kind'] ) {
			'preset' => sprintf( '--wp--preset--%s--%s', $descriptor['presetVar'], $slug ),
			'custom' => sprintf( '--wp--custom--blicks--%s--%s', self::kebab( self::group( $descriptor ) ), self::kebab( $slug ) ),
			'layout' => (string) $descriptor['cssVar'],
			default => '',
		};
	}

	/**
	 * Converts camelCase → kebab-case, matching WP's `settings.custom` key transform so reads and
	 * writes agree byte-for-byte. Current Blicks custom slugs are already lowercase, so this is
	 * usually a no-op — it exists to stay correct if a camelCase slug is ever introduced.
	 */
	public static function kebab( string $key ): string {
		$key = preg_replace( '/([a-z0-9])([A-Z])/', '$1-$2', $key ) ?? $key;

		return strtolower( $key );
	}

	/** The trailing `custom.blicks.<group>` segment for a custom descriptor. */
	private static function group( array $descriptor ): string {
		$settings = $descriptor['settings'];

		return is_string( end( $settings ) ) ? (string) end( $settings ) : '';
	}
}
