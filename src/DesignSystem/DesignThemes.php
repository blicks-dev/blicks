<?php
/**
 * Named local design themes — user-owned snapshots of token overrides.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Models\SettingModel;
use Blicks\Style\Breakpoints;

/**
 * Palettes: named sets of colours, one of which is in use. The admin calls them palettes; the
 * class and routes keep the older "theme" name they shipped with. Stored in the `blicks_settings`
 * table under `design.palettes` (moved there from the `blicks_design_themes` option).
 *
 * A palette holds colours only. Everything else someone sets lives in {@see Store} as their own
 * values, and a whole look — design language, palette and those values — is a {@see DesignKits}
 * kit. A palette's bag keeps the `{tokens, breakpoints, typeRoles}` shape of a `PATCH
 * /design-system` body so the save pipeline reads it unchanged.
 *
 * Before kits, a theme held every value and saving wrote into the one in use. {@see legacy()} and
 * {@see settleAsPalettes()} are how {@see Store} moves those values out, once.
 */
final class DesignThemes {

	/** Where palettes were kept before the plugin's tables; read once and moved. */
	private const OPTION = 'blicks_design_themes';
	/** Key in the `blicks_settings` table. */
	private const SETTING = 'design.palettes';
	private const DEFAULT_ACTIVE = 'indigo';
	private const MAX_NAME_LENGTH = 60;

	/**
	 * The five default Blicks palettes. Each pairs a brand colour (shadcn `primary`, mirrored to the
	 * focus `ring`) with a complementary `accent` (+ readable `accent-foreground`), so applying one
	 * repaints every Blicks block's brand *and* accent in a single move.
	 *
	 * @var list<array{id: string, name: string, brand: string, accent: string, accentFg: string}>
	 */
	private const BUILTINS = [
		[
			'id' => 'indigo',
			'name' => 'Blicks Indigo',
			'brand' => '#4f46e5',
			'accent' => '#06b6d4',
			'accentFg' => '#ffffff',
		],
		[
			'id' => 'emerald',
			'name' => 'Emerald Citrus',
			'brand' => '#059669',
			'accent' => '#f59e0b',
			'accentFg' => '#1c1917',
		],
		[
			'id' => 'rose',
			'name' => 'Rose Ember',
			'brand' => '#e11d48',
			'accent' => '#fb923c',
			'accentFg' => '#1c1917',
		],
		[
			'id' => 'violet',
			'name' => 'Violet Bloom',
			'brand' => '#7c3aed',
			'accent' => '#ec4899',
			'accentFg' => '#ffffff',
		],
		[
			'id' => 'slate',
			'name' => 'Slate Sky',
			'brand' => '#0f172a',
			'accent' => '#0ea5e9',
			'accentFg' => '#ffffff',
		],
	];

	/**
	 * Full theme list (built-ins first, then custom) plus the active id. Each theme carries its
	 * *effective* settings bag (for a built-in: its stored override layer if any, else the curated
	 * preset) and an `edited` flag — true when the theme diverges from its preset (built-in) or
	 * holds any override (custom). The active theme's bag is what blocks render via {@see Store}.
	 *
	 * @return array{active: string, themes: list<array{id: string, name: string, builtin: bool, edited: bool, tokens: array<string, mixed>}>}
	 */
	public static function all(): array {
		$state = self::state();

		$themes = [];
		foreach ( self::BUILTINS as $builtin ) {
			$themes[] = [
				'id' => $builtin['id'],
				'name' => $builtin['name'],
				'builtin' => true,
				'edited' => false,
				'tokens' => self::builtinTokens( $builtin['brand'], $builtin['accent'], $builtin['accentFg'] ),
			];
		}
		foreach ( $state['custom'] as $theme ) {
			$themes[] = [
				'id' => $theme['id'],
				'name' => $theme['name'],
				'builtin' => false,
				'edited' => false,
				'tokens' => self::colorsOnly( $theme['tokens'] ),
			];
		}

		$active = $state['active'];
		if ( ! self::exists( $active, $themes ) ) {
			$active = self::DEFAULT_ACTIVE;
		}

		return [
			'active' => $active,
			'themes' => $themes,
		];
	}

	/**
	 * @return array{id: string, name: string, builtin: bool, tokens: array<string, mixed>}|null
	 */
	public static function find( string $id ): ?array {
		foreach ( self::all()['themes'] as $theme ) {
			if ( $theme['id'] === $id ) {
				return $theme;
			}
		}

		return null;
	}

	/**
	 * Create a custom theme from a token payload (a `{tokens, breakpoints, typeRoles}` bag — usually
	 * a snapshot of the current values).
	 *
	 * @param array<string, mixed> $tokens
	 * @return array{active: string, themes: list<array<string, mixed>>}
	 */
	public static function create( string $name, array $tokens ): array {
		$name = self::sanitizeName( $name );
		if ( '' === $name ) {
			$name = __( 'My theme', 'blicks' );
		}

		$state = self::state();
		$state['custom'][] = [
			'id' => self::generateId(),
			'name' => $name,
			'tokens' => self::colorsOnly( self::validateTokens( $tokens ) ),
		];
		$state['active'] = $state['custom'][ count( $state['custom'] ) - 1 ]['id'];
		self::persist( $state );

		return self::all();
	}

	/**
	 * Rename / re-snapshot a custom theme. Built-ins are immutable.
	 *
	 * @param array<string, mixed>|null $tokens
	 * @return array{active: string, themes: list<array<string, mixed>>}
	 */
	public static function update( string $id, ?string $name, ?array $tokens ): array {
		$state = self::state();
		foreach ( $state['custom'] as &$theme ) {
			if ( $theme['id'] !== $id ) {
				continue;
			}
			if ( null !== $name && '' !== self::sanitizeName( $name ) ) {
				$theme['name'] = self::sanitizeName( $name );
			}
			if ( null !== $tokens ) {
				$theme['tokens'] = self::colorsOnly( self::validateTokens( $tokens ) );
			}
			break;
		}
		unset( $theme );
		self::persist( $state );

		return self::all();
	}

	/**
	 * Delete a custom theme. Built-ins can't be removed. If the deleted theme was active, fall back
	 * to the default.
	 *
	 * @return array{active: string, themes: list<array<string, mixed>>}
	 */
	public static function delete( string $id ): array {
		$state = self::state();
		$state['custom'] = array_values(
			array_filter(
				$state['custom'],
				static fn ( array $theme ): bool => $theme['id'] !== $id
			)
		);
		if ( $state['active'] === $id ) {
			$state['active'] = self::DEFAULT_ACTIVE;
		}
		self::persist( $state );

		return self::all();
	}

	public static function setActive( string $id ): void {
		$state = self::state();
		$state['active'] = $id;
		self::persist( $state );
	}

	/**
	 * The effective settings bag of the currently active theme — this is the live override set that
	 * {@see Store::getOverrides()} returns, so blocks render the active theme.
	 *
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function activeBag(): array {
		$all = self::all();
		foreach ( $all['themes'] as $theme ) {
			if ( $theme['id'] === $all['active'] ) {
				return $theme['tokens'];
			}
		}

		return self::emptyTokens();
	}

	/**
	 * Every palette as it was stored before kits, values and all, with the one in use — what
	 * {@see Store} reads once to move each palette's non-colour values into kits.
	 *
	 * @return array{active: string, custom: list<array{id: string, name: string, tokens: array<string, mixed>}>, builtinOverrides: array<string, array<string, mixed>>}
	 */
	public static function legacy(): array {
		return self::state();
	}

	/** After {@see legacy()} has been read: keep each palette's colours and drop the rest. */
	public static function settleAsPalettes(): void {
		$state = self::state();
		foreach ( $state['custom'] as &$theme ) {
			$theme['tokens'] = self::colorsOnly( $theme['tokens'] );
		}
		unset( $theme );
		$state['builtinOverrides'] = [];
		self::persist( $state );
	}

	/**
	 * A built-in palette's own colours by id, or null for an id that is not one.
	 *
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}|null
	 */
	public static function builtinBag( string $id ): ?array {
		return self::isBuiltinId( $id ) ? self::builtinBaseById( $id ) : null;
	}

	/**
	 * Reset a palette: a built-in already is its preset (palettes are not edited in place any more);
	 * one of your own loses its colours.
	 *
	 * @return array{active: string, themes: list<array<string, mixed>>}
	 */
	public static function resetTheme( string $id ): array {
		$state = self::state();
		if ( self::isBuiltinId( $id ) ) {
			unset( $state['builtinOverrides'][ $id ] );
		} else {
			foreach ( $state['custom'] as &$theme ) {
				if ( $theme['id'] === $id ) {
					$theme['tokens'] = self::emptyTokens();
					break;
				}
			}
			unset( $theme );
		}
		self::persist( $state );

		return self::all();
	}

	// ─── Internals ──────────────────────────────────────────────────────────────

	/** @return array{active: string, custom: list<array{id: string, name: string, tokens: array<string, mixed>}>, builtinOverrides: array<string, array<string, mixed>>} */
	private static function state(): array {
		$value = SettingModel::adoptOption( self::OPTION, self::SETTING, [] );
		if ( ! is_array( $value ) ) {
			$value = [];
		}

		$active = is_string( $value['active'] ?? null ) ? $value['active'] : self::DEFAULT_ACTIVE;

		$custom = [];
		foreach ( is_array( $value['custom'] ?? null ) ? $value['custom'] : [] as $theme ) {
			if ( ! is_array( $theme ) || ! is_string( $theme['id'] ?? null ) || ! is_string( $theme['name'] ?? null ) ) {
				continue;
			}
			$custom[] = [
				'id' => $theme['id'],
				'name' => $theme['name'],
				'tokens' => is_array( $theme['tokens'] ?? null ) ? self::sanitizeTokens( $theme['tokens'] ) : self::emptyTokens(),
			];
		}

		// Per-built-in override layer: the user's edits on top of a curated preset, keyed by built-in
		// id. Absence = pristine preset; presence = edited (and reset-able back to the preset).
		$builtinOverrides = [];
		foreach ( is_array( $value['builtinOverrides'] ?? null ) ? $value['builtinOverrides'] : [] as $id => $bag ) {
			if ( is_string( $id ) && self::isBuiltinId( $id ) && is_array( $bag ) ) {
				$builtinOverrides[ $id ] = self::sanitizeTokens( $bag );
			}
		}

		return [
			'active' => $active,
			'custom' => $custom,
			'builtinOverrides' => $builtinOverrides,
		];
	}

	/** @param array{active: string, custom: list<array<string, mixed>>, builtinOverrides?: array<string, array<string, mixed>>} $state */
	private static function persist( array $state ): void {
		SettingModel::setValue( self::SETTING, $state );
	}

	/** @param list<array{id: string, ...}> $themes */
	private static function exists( string $id, array $themes ): bool {
		foreach ( $themes as $theme ) {
			if ( ( $theme['id'] ?? null ) === $id ) {
				return true;
			}
		}

		return false;
	}

	/** @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} */
	private static function builtinTokens( string $brand, string $accent, string $accentFg ): array {
		return [
			'tokens' => [
				'color' => [
					'primary' => $brand,
					'ring' => $brand,
					'accent' => $accent,
					'accent-foreground' => $accentFg,
				],
			],
			'breakpoints' => [],
			'typeRoles' => [],
		];
	}

	private static function isBuiltinId( string $id ): bool {
		foreach ( self::BUILTINS as $builtin ) {
			if ( $builtin['id'] === $id ) {
				return true;
			}
		}

		return false;
	}

	/** @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} */
	private static function builtinBaseById( string $id ): array {
		foreach ( self::BUILTINS as $builtin ) {
			if ( $builtin['id'] === $id ) {
				return self::builtinTokens( $builtin['brand'], $builtin['accent'], $builtin['accentFg'] );
			}
		}

		return self::emptyTokens();
	}

	/**
	 * A bag with its colours and nothing else.
	 *
	 * @param array<string, mixed> $bag
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function colorsOnly( array $bag ): array {
		$clean = self::sanitizeTokens( $bag );
		$colors = $clean['tokens']['color'] ?? [];

		return [
			'tokens' => [] === $colors ? [] : [ 'color' => $colors ],
			'breakpoints' => [],
			'typeRoles' => [],
		];
	}

	/**
	 * Normalize a token payload to the stored shape (string-keyed maps). Reuses {@see Overrides}.
	 *
	 * @param array<string, mixed> $tokens
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	private static function sanitizeTokens( array $tokens ): array {
		return Overrides::normalize( $tokens );
	}

	/**
	 * Validate an incoming token payload before it is stored: known categories and slugs only, and
	 * every value through the same whole-value allow-list as the design-system save path. Reads use
	 * {@see self::sanitizeTokens()} (shape only), because stored bags were validated on the way in
	 * and are re-validated again when rendered to CSS.
	 *
	 * @param array<string, mixed> $tokens
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	private static function validateTokens( array $tokens ): array {
		return Overrides::sanitize( $tokens, Catalogue::catalogue(), Breakpoints::defaults() );
	}

	/** @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} */
	private static function emptyTokens(): array {
		return [
			'tokens' => [],
			'breakpoints' => [],
			'typeRoles' => [],
		];
	}

	private static function sanitizeName( string $name ): string {
		$name = sanitize_text_field( $name );

		return mb_substr( trim( $name ), 0, self::MAX_NAME_LENGTH );
	}

	private static function generateId(): string {
		return 'c' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 );
	}
}
