<?php
/**
 * The design system's semantic typography roles.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The single source of truth for the design system's **semantic typography roles** — the
 * "complete typography" layer that sits on top of the flat `fontSize` token scale.
 *
 * A role (h1…h6, body, lead, caption, code) bundles a full typographic look — size, weight,
 * line-height, letter-spacing, family, transform — rather than a single scalar. Unlike the
 * {@see TokenMap} categories (which all live in theme.json `settings.*`), roles target the
 * `styles.*` tree:
 *
 *  - **native** roles map onto a real theme.json element slot WordPress already emits CSS for
 *    (`styles.elements.h{n}.typography`, root `styles.typography`, `styles.elements.caption`).
 *    We only READ them to populate the editor and WRITE edits back — no `--blicks-*` var needed.
 *  - **custom** roles (lead, code) have NO native element slot, so they live under
 *    `settings.custom.blicks.typeRoles.{role}` and emit `--blicks-type-{role}-{prop}` aliases
 *    that the relevant block CSS consumes ({@see CssVariables}).
 *
 * Read: {@see TypeRoleProjection}. Write: {@see GlobalStylesWriter}. Both walk these descriptors.
 */
final class TypeRoles {

	/** @var list<string> */
	public const ROLES = [ 'display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'lead', 'small', 'caption', 'code', 'mono' ];

	/** @var list<string> theme.json `typography.*` keys, 1:1. */
	public const PROPS = [ 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily', 'textTransform' ];

	/**
	 * How each role is stored. `native` carries the `styles` path (relative to the `styles` root)
	 * its `typography` object lives at; `custom` carries the `settings` group its props live under.
	 *
	 * @var array<string, array{kind: 'native'|'custom', stylesPath?: list<string>, settingsGroup?: list<string>}>
	 */
	public const SLOTS = [
		'display' => [
			'kind' => 'custom',
			'settingsGroup' => [ 'custom', 'blicks', 'typeRoles', 'display' ],
		],
		'h1'      => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'h1', 'typography' ],
		],
		'h2'      => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'h2', 'typography' ],
		],
		'h3'      => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'h3', 'typography' ],
		],
		'h4'      => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'h4', 'typography' ],
		],
		'h5'      => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'h5', 'typography' ],
		],
		'h6'      => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'h6', 'typography' ],
		],
		'body'    => [
			'kind' => 'native',
			'stylesPath' => [ 'typography' ],
		],
		'caption' => [
			'kind' => 'native',
			'stylesPath' => [ 'elements', 'caption', 'typography' ],
		],
		'lead'    => [
			'kind' => 'custom',
			'settingsGroup' => [ 'custom', 'blicks', 'typeRoles', 'lead' ],
		],
		'small'   => [
			'kind' => 'custom',
			'settingsGroup' => [ 'custom', 'blicks', 'typeRoles', 'small' ],
		],
		'code'    => [
			'kind' => 'custom',
			'settingsGroup' => [ 'custom', 'blicks', 'typeRoles', 'code' ],
		],
		'mono'    => [
			'kind' => 'custom',
			'settingsGroup' => [ 'custom', 'blicks', 'typeRoles', 'mono' ],
		],
	];

	/**
	 * Default / fallback look per role. `fontSize` and `fontFamily` resolve through the matching
	 * token presets (`--wp--preset--font-size--{slug}` / `--wp--preset--font-family--{slug}`) so a
	 * role tracks the primitive scale by default; concrete lengths here are the read fallback when
	 * neither the user nor the theme set the leaf.
	 *
	 * @var array<string, array<string, string>>
	 */
	public const DEFAULTS = [
		'display' => [
			'fontSize' => '3.5rem',
			'fontWeight' => '700',
			'lineHeight' => '1.05',
			'letterSpacing' => '-0.035em',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'h1'      => [
			'fontSize' => '2.25rem',
			'fontWeight' => '700',
			'lineHeight' => '1.1',
			'letterSpacing' => '-0.02em',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'h2'      => [
			'fontSize' => '1.875rem',
			'fontWeight' => '700',
			'lineHeight' => '1.15',
			'letterSpacing' => '-0.015em',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'h3'      => [
			'fontSize' => '1.5rem',
			'fontWeight' => '600',
			'lineHeight' => '1.2',
			'letterSpacing' => '-0.01em',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'h4'      => [
			'fontSize' => '1.25rem',
			'fontWeight' => '600',
			'lineHeight' => '1.3',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'h5'      => [
			'fontSize' => '1.125rem',
			'fontWeight' => '600',
			'lineHeight' => '1.4',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'h6'      => [
			'fontSize' => '1rem',
			'fontWeight' => '600',
			'lineHeight' => '1.4',
			'letterSpacing' => '0.01em',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'uppercase',
		],
		'body'    => [
			'fontSize' => '1rem',
			'fontWeight' => '400',
			'lineHeight' => '1.6',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'lead'    => [
			'fontSize' => '1.25rem',
			'fontWeight' => '400',
			'lineHeight' => '1.6',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'small'   => [
			'fontSize' => '0.75rem',
			'fontWeight' => '400',
			'lineHeight' => '1.45',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'caption' => [
			'fontSize' => '0.875rem',
			'fontWeight' => '400',
			'lineHeight' => '1.4',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--sans)',
			'textTransform' => 'none',
		],
		'code'    => [
			'fontSize' => '0.875rem',
			'fontWeight' => '400',
			'lineHeight' => '1.6',
			'letterSpacing' => '0',
			'fontFamily' => 'var(--wp--preset--font-family--mono)',
			'textTransform' => 'none',
		],
		'mono'    => [
			'fontSize' => '0.6875rem',
			'fontWeight' => '500',
			'lineHeight' => '1',
			'letterSpacing' => '0.1em',
			'fontFamily' => 'var(--wp--preset--font-family--mono)',
			'textTransform' => 'uppercase',
		],
	];

	/**
	 * The slot metadata block for the REST snapshot — tells the editor which roles are native
	 * (read straight from element CSS) vs custom (Blicks-var driven).
	 *
	 * @return array<string, array{kind: string, stylesPath?: list<string>, settingsGroup?: list<string>}>
	 */
	public static function slots(): array {
		return self::SLOTS;
	}

	/** @return array{kind: 'native'|'custom', stylesPath?: list<string>, settingsGroup?: list<string>}|null */
	public static function slot( string $role ): ?array {
		return self::SLOTS[ $role ] ?? null;
	}

	/**
	 * Converts a camelCase prop → kebab-case, matching WP's `settings.custom` key transform so the
	 * `--wp--custom--blicks--type-roles--{role}--{prop}` var name (and read path) agree
	 * byte-for-byte. Mirrors {@see TokenMap::kebab}.
	 */
	public static function kebabProp( string $prop ): string {
		$prop = preg_replace( '/([a-z0-9])([A-Z])/', '$1-$2', $prop ) ?? $prop;

		return strtolower( $prop );
	}
}
