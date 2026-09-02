<?php
/**
 * The design-token catalogue for the active theme.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Style\Breakpoints;
use Blicks\Style\Tokens;
use Blicks\Settings\AdminSettings;

/**
 * The design-token catalogue for the active theme, merging the shared plugin
 * catalogue with what theme.json declares.
 */
final class Catalogue {

	/**
	 * The token catalogue for the ACTIVE theme: the shared plugin catalogue
	 * (`resources/design-system/tokens.json`) merged, per preset category, with the slugs the
	 * theme actually defines (palette colors, spacing/type/radius/shadow scales). This is how a
	 * theme's brand accents surface as editable, projectable design-system tokens without
	 * polluting the shared catalogue. Reads the live Global Styles settings.
	 *
	 * @return array<string, list<string>>
	 */
	public static function catalogue(): array {
		return self::effectiveCatalogue( ThemeProjection::currentSettings() );
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array<string, list<string>>
	 */
	public static function effectiveCatalogue( array $settings ): array {
		$catalogue = Tokens::catalogue();

		foreach ( TokenMap::descriptors() as $descriptor ) {
			if ( 'preset' !== ( $descriptor['kind'] ?? '' ) ) {
				continue;
			}

			$category = $descriptor['category'] ?? '';
			$path = $descriptor['settings'] ?? null;
			if ( ! is_string( $category ) || ! isset( $catalogue[ $category ] ) || ! is_array( $path ) ) {
				continue;
			}

			$themeSlugs = ThemeProjection::presetSlugs( $settings, $path );
			if ( [] === $themeSlugs ) {
				continue;
			}

			if ( 'color' === $category ) {
				// Colors: union base semantic tokens with theme palette (keep semantic completeness
				// even when a theme omits some shadcn slugs).
				$merged = $catalogue[ $category ];
				foreach ( $themeSlugs as $slug ) {
					if ( ! in_array( $slug, $merged, true ) ) {
						$merged[] = $slug;
					}
				}
				$catalogue[ $category ] = $merged;
			} else {
				// Scales (spacing/type/…): use the theme's own scale verbatim — avoids showing a
				// duplicate base scale alongside the theme's (e.g. `2xl` next to `2-xl`).
				$catalogue[ $category ] = $themeSlugs;
			}
		}

		// Union user-added custom slugs so their values pass sanitisation and render in the UI.
		foreach ( Store::getCustomSlugs() as $category => $slugs ) {
			if ( ! isset( $catalogue[ $category ] ) ) {
				continue;
			}
			foreach ( $slugs as $slug ) {
				if ( ! in_array( $slug, $catalogue[ $category ], true ) ) {
					$catalogue[ $category ][] = $slug;
				}
			}
		}

		return $catalogue;
	}

	/**
	 * @param array<string, mixed>|null $overrides
	 * @return array<string, mixed>
	 */
	public static function snapshot( ?array $overrides = null ): array {
		$settings = ThemeProjection::currentSettings();
		$tokens = self::effectiveCatalogue( $settings );
		$breakpoints = ThemeProjection::breakpointsFromSettings( $settings, Breakpoints::defaults() );
		$overrides = null === $overrides ? Store::getOverrides() : Overrides::normalize( $overrides );
		$projectedValues = ThemeProjection::fromSettings( $settings, $tokens );

		$roleBase = TypeRoleProjection::current();
		$roleValues = TypeRoleProjection::applyOverrides(
			$roleBase,
			is_array( $overrides['typeRoles'] ?? null ) ? $overrides['typeRoles'] : []
		);

		$fontLibrary = ThemeProjection::fontFamilies();
		$themeJsonSupported = AdminSettings::themeJsonSupported();
		$themeJsonSync = AdminSettings::themeJsonSyncEnabled() && $themeJsonSupported;

		return [
			'mode' => 'readOnly',
			'source' => [
				'theme' => 'active',
				'themeJson' => $themeJsonSupported,
				'globalStyles' => $themeJsonSync,
			],
			'tokens' => $tokens,
			'baseValues' => $projectedValues,
			'values' => ThemeProjection::applyOverrides( $projectedValues, $overrides ),
			'typeRoles' => [
				'roles' => TypeRoles::ROLES,
				'props' => TypeRoles::PROPS,
				'slots' => TypeRoles::slots(),
				'base' => $roleBase,
				'values' => $roleValues,
			],
			'overrides' => $overrides,
			'breakpoints' => self::applyBreakpointOverrides( $breakpoints, $overrides['breakpoints'] ),
			'fontLibrary' => $fontLibrary,
			'counts' => [
				'colors' => count( $tokens['color'] ?? [] ),
				'typography' => count( $tokens['fontSize'] ?? [] ) + count( $tokens['fontFamily'] ?? [] ),
				'spacing' => count( $tokens['spacing'] ?? [] ),
				'radius' => count( $tokens['radius'] ?? [] ),
				'shadow' => count( $tokens['shadow'] ?? [] ),
				'breakpoints' => count( $breakpoints ),
				'fontFamilies' => count( $fontLibrary ),
				'typeRoles' => count( $roleValues ),
			],
		];
	}

	/**
	 * The design-system colour palette for the editor colour picker — the full preset set (shadcn
	 * semantic tokens UNION the active theme's palette accents), carrying the active design theme's
	 * values. Every slug has a `--blicks-color-{slug}` var emitted by {@see CssVariables}, so a pick
	 * resolves through the design system (not the raw theme.json palette, which omits the semantic
	 * set). Bridged to the editor via `window.blicksEditorSettings.colorPalette` (see palette.ts).
	 *
	 * @param array<string, mixed>|null $snapshot Reuse an already-computed {@see snapshot()} to avoid
	 *                                             recomputing it when also bridging {@see tokenCatalogue()}.
	 * @return list<array{slug:string, name:string, color:string}>
	 */
	public static function colorPalette( ?array $snapshot = null ): array {
		return array_map(
			static fn ( array $row ): array => [
				'slug' => $row['slug'],
				'name' => $row['name'],
				'color' => $row['value'],
			],
			self::rowsForCategory( $snapshot ?? self::snapshot(), 'color' )
		);
	}

	/**
	 * The live, theme/admin-projected token catalogue for every scalar category the inspector's
	 * `TokenLibrary` pickers can address — spacing/radius/shadow/borderWidth/zIndex/transition/
	 * transform/filter/fontSize/width/aspect/leading/gradient/opacity. Each row carries the slug,
	 * a humanised name, and its live resolved CSS value, so a picker shows the active theme's own
	 * scale instead of the static compiled catalogue. `color`/`fontFamily` already have their own
	 * dedicated bridge keys ({@see colorPalette()}, `ThemeProjection::fontFamilies()`) and are not
	 * duplicated here. Bridged via `window.blicksEditorSettings.tokenCatalogue` (see token-utils.ts).
	 *
	 * @param array<string, mixed>|null $snapshot Reuse an already-computed {@see snapshot()} to avoid
	 *                                             recomputing it when also bridging {@see colorPalette()}.
	 * @return array<string, list<array{slug:string, name:string, value:string}>>
	 */
	public static function tokenCatalogue( ?array $snapshot = null ): array {
		$snapshot ??= self::snapshot();
		$categories = [
			'spacing',
			'radius',
			'shadow',
			'borderWidth',
			'zIndex',
			'transition',
			'transform',
			'filter',
			'fontSize',
			'width',
			'aspect',
			'leading',
			'gradient',
			'opacity',
		];

		$catalogue = [];
		foreach ( $categories as $category ) {
			$catalogue[ $category ] = self::rowsForCategory( $snapshot, $category );
		}
		return $catalogue;
	}

	/**
	 * @param array<string, mixed> $snapshot
	 * @return list<array{slug:string, name:string, value:string}>
	 */
	private static function rowsForCategory( array $snapshot, string $category ): array {
		$slugs = is_array( $snapshot['tokens'][ $category ] ?? null ) ? $snapshot['tokens'][ $category ] : [];
		$values = is_array( $snapshot['values'][ $category ] ?? null ) ? $snapshot['values'][ $category ] : [];

		$rows = [];
		foreach ( $slugs as $slug ) {
			if ( ! is_string( $slug ) ) {
				continue;
			}
			$rows[] = [
				'slug'  => $slug,
				'name'  => ucwords( str_replace( [ '-', '_' ], ' ', $slug ) ),
				'value' => is_string( $values[ $slug ] ?? null ) ? $values[ $slug ] : '',
			];
		}
		return $rows;
	}

	/**
	 * Overlay the just-saved (sanitized) payload onto a snapshot so a POST-save response reflects
	 * what the user saved. Needed because `wp_get_global_settings()` can lag the Global Styles
	 * write within the SAME request — without this, a synced token momentarily reads back as its
	 * theme.json fallback right after Save (it self-corrects on reload, which reads fresh). The
	 * payload is the source of truth for "what was just saved" whether it synced to theme.json or
	 * stayed in the option.
	 *
	 * @param array<string, mixed> $snapshot
	 * @param array<string, mixed> $payload
	 * @return array<string, mixed>
	 */
	public static function withSavedValues( array $snapshot, array $payload ): array {
		$saved = Overrides::sanitize( $payload, self::catalogue(), Breakpoints::defaults() );

		if ( isset( $snapshot['values'] ) && is_array( $snapshot['values'] ) ) {
			$snapshot['values'] = ThemeProjection::applyOverrides(
				$snapshot['values'],
				[
					'tokens' => $saved['tokens'],
					'breakpoints' => [],
				]
			);
		}

		if ( isset( $snapshot['breakpoints'] ) && is_array( $snapshot['breakpoints'] ) ) {
			$snapshot['breakpoints'] = self::applyBreakpointOverrides( $snapshot['breakpoints'], $saved['breakpoints'] );
		}

		if ( isset( $snapshot['typeRoles']['values'] ) && is_array( $snapshot['typeRoles']['values'] ) ) {
			$snapshot['typeRoles']['values'] = TypeRoleProjection::applyOverrides(
				$snapshot['typeRoles']['values'],
				$saved['typeRoles']
			);
		}

		return $snapshot;
	}

	/**
	 * @param list<array<string, mixed>> $breakpoints
	 * @param array<string, int> $overrides
	 * @return list<array<string, mixed>>
	 */
	private static function applyBreakpointOverrides( array $breakpoints, array $overrides ): array {
		return array_map(
			static function ( array $breakpoint ) use ( $overrides ): array {
				$id = $breakpoint['id'] ?? null;
				if ( is_string( $id ) && isset( $overrides[ $id ] ) ) {
					$breakpoint['max'] = $overrides[ $id ];
				}

				return $breakpoint;
			},
			$breakpoints
		);
	}
}
