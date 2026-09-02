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

/**
 * Named local design themes — user-owned snapshots of token overrides applied on top of the
 * theme.json projection. These live in the
 * `blicks_design_themes` option and apply through the same {@see Store::saveOverrides()} path the
 * Design System page uses.
 *
 * A theme's `tokens` payload is the same shape as a `PATCH /design-system` body
 * (`{tokens, breakpoints, typeRoles}`), so "apply" reuses the whole existing write/sync pipeline.
 * Built-ins live in code (brand-color presets); only user-created themes + the active id persist.
 */
final class DesignThemes {

	private const OPTION = 'blicks_design_themes';
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
			$override = $state['builtinOverrides'][ $builtin['id'] ] ?? null;
			$themes[] = [
				'id' => $builtin['id'],
				'name' => $builtin['name'],
				'builtin' => true,
				'edited' => null !== $override,
				'tokens' => $override ?? self::builtinTokens( $builtin['brand'], $builtin['accent'], $builtin['accentFg'] ),
			];
		}
		foreach ( $state['custom'] as $theme ) {
			$themes[] = [
				'id' => $theme['id'],
				'name' => $theme['name'],
				'builtin' => false,
				'edited' => ! self::bagIsEmpty( $theme['tokens'] ),
				'tokens' => $theme['tokens'],
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
			'tokens' => self::sanitizeTokens( $tokens ),
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
				$theme['tokens'] = self::sanitizeTokens( $tokens );
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
	 * Persist an override bag onto the active theme (called on every Save). For a custom theme the
	 * bag *is* the theme; for a built-in it's stored as an override layer, except when it equals the
	 * curated preset (then the layer is dropped, so the theme reads as pristine again).
	 *
	 * @param array<string, mixed> $bag
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function saveActiveOverrides( array $bag ): array {
		$clean = self::sanitizeTokens( $bag );
		$state = self::state();
		$active = $state['active'];

		if ( self::isBuiltinId( $active ) ) {
			if ( self::bagsEqual( $clean, self::builtinBaseById( $active ) ) ) {
				unset( $state['builtinOverrides'][ $active ] );
			} else {
				$state['builtinOverrides'][ $active ] = $clean;
			}
		} else {
			foreach ( $state['custom'] as &$theme ) {
				if ( $theme['id'] === $active ) {
					$theme['tokens'] = $clean;
					break;
				}
			}
			unset( $theme );
		}

		self::persist( $state );

		return $clean;
	}

	/**
	 * Reset a theme's overrides: a built-in returns to its curated preset; a custom theme returns to
	 * the shared base (empty bag). If the reset theme is active, the change takes effect immediately.
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
		$value = function_exists( 'get_option' ) ? get_option( self::OPTION, [] ) : [];
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
		if ( function_exists( 'update_option' ) ) {
			update_option( self::OPTION, $state, false );
		}
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
	 * @param array<string, mixed> $a
	 * @param array<string, mixed> $b
	 */
	private static function bagsEqual( array $a, array $b ): bool {
		// All three sub-maps are associative, so loose array equality is order-insensitive.
		// Strict comparison would also compare key order and report equal bags as different.
		return self::sanitizeTokens( $a ) == self::sanitizeTokens( $b ); // phpcs:ignore Universal.Operators.StrictComparisons.LooseEqual
	}

	/** @param array{tokens: array<string, mixed>, breakpoints: array<string, mixed>, typeRoles: array<string, mixed>} $bag */
	private static function bagIsEmpty( array $bag ): bool {
		return [] === ( $bag['tokens'] ?? [] )
			&& [] === ( $bag['breakpoints'] ?? [] )
			&& [] === ( $bag['typeRoles'] ?? [] );
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
		if ( function_exists( 'wp_generate_uuid4' ) ) {
			return 'c' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 );
		}

		return uniqid( 'c', true );
	}
}
