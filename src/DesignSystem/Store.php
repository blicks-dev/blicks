<?php
/**
 * Persistence for the design system's override set and custom slugs.
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
 * Reads and writes the design system's override set and its registered custom
 * slugs.
 */
final class Store {

	private const OPTION = 'blicks_design_system';
	private const SLUGS_OPTION = 'blicks_design_custom_slugs';

	/**
	 * The live override set = the active theme's effective settings bag. Themes own their settings
	 * now (see {@see DesignThemes}); this single read is the seam the snapshot + CSS pipeline uses.
	 *
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function getOverrides(): array {
		return DesignThemes::activeBag();
	}

	/**
	 * Persist a token payload onto the **active theme** (Save and theme-apply both land here), and
	 * forward-sync the changed values to the user Global Styles entity when theme.json sync is on.
	 *
	 * @param array<string, mixed> $payload
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function saveOverrides( array $payload ): array {
		$overrides = Overrides::sanitize( $payload, Catalogue::catalogue(), Breakpoints::defaults() );
		$current = self::getOverrides();

		if ( AdminSettings::themeJsonSyncEnabled() && AdminSettings::themeJsonSupported() ) {
			$changed = self::changedValues( $current, $overrides );
			GlobalStylesWriter::persistAll( $changed['tokens'], $changed['breakpoints'], $changed['typeRoles'] );
		}

		return DesignThemes::saveActiveOverrides( $overrides );
	}

	/** One-time cleanup: the live override set is now owned per-theme, so drop the legacy global option. */
	public static function purgeLegacyOption(): void {
		if ( function_exists( 'delete_option' ) ) {
			delete_option( self::OPTION );
		}
	}

	/**
	 * User-added token slugs per category, unioned into the catalogue so their values pass
	 * sanitisation and round-trip. Base catalogue + theme-palette slugs are excluded (they're
	 * already present); only genuinely new slugs live here.
	 *
	 * @return array<string, list<string>>
	 */
	public static function getCustomSlugs(): array {
		if ( ! function_exists( 'get_option' ) ) {
			return [];
		}

		$value = get_option( self::SLUGS_OPTION, [] );
		if ( ! is_array( $value ) ) {
			return [];
		}

		$valid = TokenMap::categories();
		$out = [];
		foreach ( $value as $category => $slugs ) {
			if ( ! is_string( $category ) || ! in_array( $category, $valid, true ) || ! is_array( $slugs ) ) {
				continue;
			}
			foreach ( $slugs as $slug ) {
				$clean = Overrides::sanitizeSlug( $slug );
				if ( null !== $clean && ! in_array( $clean, $out[ $category ] ?? [], true ) ) {
					$out[ $category ][] = $clean;
				}
			}
		}

		return $out;
	}

	/**
	 * Merge new custom slugs into the registry (skipping base/theme slugs already in the catalogue),
	 * persist, and return the full registry.
	 *
	 * @param array<string, mixed> $incoming
	 * @return array<string, list<string>>
	 */
	public static function registerCustomSlugs( array $incoming ): array {
		$base = Tokens::catalogue();
		$valid = TokenMap::categories();
		$existing = self::getCustomSlugs();

		foreach ( $incoming as $category => $slugs ) {
			if ( ! is_string( $category ) || ! in_array( $category, $valid, true ) || ! is_array( $slugs ) ) {
				continue;
			}
			foreach ( $slugs as $slug ) {
				$clean = Overrides::sanitizeSlug( $slug );
				if ( null === $clean || in_array( $clean, $base[ $category ] ?? [], true ) ) {
					continue;
				}
				if ( ! in_array( $clean, $existing[ $category ] ?? [], true ) ) {
					$existing[ $category ][] = $clean;
				}
			}
		}

		if ( function_exists( 'update_option' ) ) {
			update_option( self::SLUGS_OPTION, $existing, false );
		}

		return $existing;
	}

	/**
	 * Reset a token group: drop its local option overrides and any custom slugs. Values fall back to
	 * the theme.json projection. Tokens already synced to theme.json (forward-only) are not clawed
	 * back — they're legitimately part of the user Global Styles now.
	 */
	public static function resetCategory( string $category ): void {
		$overrides = self::getOverrides();
		unset( $overrides['tokens'][ $category ] );
		DesignThemes::saveActiveOverrides( $overrides );

		$slugs = self::getCustomSlugs();
		if ( isset( $slugs[ $category ] ) ) {
			unset( $slugs[ $category ] );
			if ( function_exists( 'update_option' ) ) {
				update_option( self::SLUGS_OPTION, $slugs, false );
			}
		}
	}

	/**
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $before
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $after
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function changedValues( array $before, array $after ): array {
		$tokens = [];
		foreach ( $after['tokens'] as $category => $values ) {
			foreach ( $values as $slug => $value ) {
				if ( ( $before['tokens'][ $category ][ $slug ] ?? null ) !== $value ) {
					$tokens[ $category ][ $slug ] = $value;
				}
			}
		}

		$breakpoints = [];
		foreach ( $after['breakpoints'] as $id => $max ) {
			if ( ( $before['breakpoints'][ $id ] ?? null ) !== $max ) {
				$breakpoints[ $id ] = $max;
			}
		}

		$typeRoles = [];
		foreach ( ( $after['typeRoles'] ?? [] ) as $role => $props ) {
			foreach ( $props as $prop => $value ) {
				if ( ( $before['typeRoles'][ $role ][ $prop ] ?? null ) !== $value ) {
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
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $overrides
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $remove
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function withoutValues( array $overrides, array $remove ): array {
		foreach ( $remove['tokens'] as $category => $values ) {
			foreach ( array_keys( $values ) as $slug ) {
				unset( $overrides['tokens'][ $category ][ $slug ] );
			}
			if ( [] === ( $overrides['tokens'][ $category ] ?? [] ) ) {
				unset( $overrides['tokens'][ $category ] );
			}
		}

		foreach ( array_keys( $remove['breakpoints'] ) as $id ) {
			unset( $overrides['breakpoints'][ $id ] );
		}

		foreach ( ( $remove['typeRoles'] ?? [] ) as $role => $props ) {
			foreach ( array_keys( $props ) as $prop ) {
				unset( $overrides['typeRoles'][ $role ][ $prop ] );
			}
			if ( [] === ( $overrides['typeRoles'][ $role ] ?? [] ) ) {
				unset( $overrides['typeRoles'][ $role ] );
			}
		}

		return $overrides;
	}
}
