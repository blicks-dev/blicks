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
use Blicks\Models\SettingModel;
use Blicks\Settings\AdminSettings;

/**
 * Reads and writes the design system's override set and its registered custom
 * slugs.
 */
final class Store {

	/** Someone's own values — everything they set, apart from the palette in use. Key in `blicks_settings`. */
	private const VALUES_SETTING = 'design.values';
	/** Where custom slugs were kept before the plugin's tables; read once and moved. */
	private const SLUGS_OPTION = 'blicks_design_custom_slugs';
	/** Key in the `blicks_settings` table. */
	private const SLUGS_SETTING = 'design.custom_slugs';

	/**
	 * The live override set: the palette's colours with someone's own values on top. This single
	 * read is the seam the snapshot + CSS pipeline uses.
	 *
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function getOverrides(): array {
		$own = self::values();
		$palette = DesignThemes::activeBag();

		return [
			'tokens' => array_replace_recursive( $palette['tokens'], $own['tokens'] ),
			'breakpoints' => $own['breakpoints'],
			'typeRoles' => $own['typeRoles'],
		];
	}

	/**
	 * Save a token payload as someone's own values (the Design system's Save lands here), and
	 * forward-sync the changed values to the user Global Styles entity when theme.json sync is on.
	 * A colour equal to the palette's is the palette's, not theirs, so the next palette repaints it.
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

		self::persistValues( self::withoutPalette( $overrides, DesignThemes::activeBag() ) );

		return self::getOverrides();
	}

	/**
	 * Use a palette: its colours replace any of the same colours someone set themselves; every other
	 * value of theirs stays.
	 */
	public static function usePalette( string $id ): void {
		DesignThemes::setActive( $id );
		$palette = DesignThemes::activeBag();
		self::persistValues( self::withoutValues( self::values(), $palette ) );
	}

	/**
	 * Replace someone's own values and the palette in use at once — a kit being used.
	 *
	 * @param array<string, mixed> $values
	 */
	public static function replaceValues( string $palette, array $values ): void {
		if ( null !== DesignThemes::find( $palette ) ) {
			DesignThemes::setActive( $palette );
		}
		self::persistValues( self::withoutPalette( Overrides::normalize( $values ), DesignThemes::activeBag() ) );
	}

	/**
	 * Someone's own values. Before kits these lived inside each palette, so the first read moves
	 * them out: the palette in use hands its values over, every other palette with values of its
	 * own becomes a kit, and palettes keep only their colours. Nothing anyone saved is dropped.
	 *
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function values(): array {
		$stored = SettingModel::getValue( self::VALUES_SETTING, null );
		if ( is_array( $stored ) ) {
			return Overrides::normalize( $stored );
		}

		$legacy = DesignThemes::legacy();
		$bagOf = static function ( string $id ) use ( $legacy ): ?array {
			foreach ( $legacy['custom'] as $theme ) {
				if ( $theme['id'] === $id ) {
					return Overrides::normalize( $theme['tokens'] );
				}
			}
			$builtin = DesignThemes::builtinBag( $id );

			return null === $builtin ? null : Overrides::normalize( $legacy['builtinOverrides'][ $id ] ?? $builtin );
		};

		foreach ( $legacy['custom'] as $theme ) {
			$bag = Overrides::normalize( $theme['tokens'] );
			if ( DesignThemes::colorsOnly( $bag ) !== $bag ) {
				DesignKits::adopt( $theme['name'], $theme['id'] === $legacy['active'] ? DesignLanguages::activeId() : DesignLanguages::DEFAULT, $theme['id'], $bag );
			}
		}
		foreach ( $legacy['builtinOverrides'] as $id => $bag ) {
			$name = (string) ( DesignThemes::find( $id )['name'] ?? $id );
			/* translators: %s: palette name. */
			DesignKits::adopt( sprintf( __( '%s, your values', 'blicks' ), $name ), $id === $legacy['active'] ? DesignLanguages::activeId() : DesignLanguages::DEFAULT, $id, $bag );
		}

		$own = $bagOf( $legacy['active'] ) ?? self::emptyBag();
		DesignThemes::settleAsPalettes();
		$own = self::withoutPalette( $own, DesignThemes::activeBag() );
		self::persistValues( $own );

		return $own;
	}

	/**
	 * Drop the colours that equal the palette's own — those are the palette's, not someone's.
	 *
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $values
	 * @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $palette
	 * @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}
	 */
	public static function withoutPalette( array $values, array $palette ): array {
		foreach ( $palette['tokens'] as $category => $tokens ) {
			foreach ( $tokens as $slug => $value ) {
				if ( ( $values['tokens'][ $category ][ $slug ] ?? null ) === $value ) {
					unset( $values['tokens'][ $category ][ $slug ] );
				}
			}
			if ( [] === ( $values['tokens'][ $category ] ?? null ) ) {
				unset( $values['tokens'][ $category ] );
			}
		}

		return $values;
	}

	/** @param array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} $values */
	private static function persistValues( array $values ): void {
		SettingModel::setValue( self::VALUES_SETTING, $values );
	}

	/** @return array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>} */
	private static function emptyBag(): array {
		return [
			'tokens' => [],
			'breakpoints' => [],
			'typeRoles' => [],
		];
	}

	/**
	 * User-added token slugs per category, unioned into the catalogue so their values pass
	 * sanitisation and round-trip. Base catalogue + theme-palette slugs are excluded (they're
	 * already present); only genuinely new slugs live here.
	 *
	 * @return array<string, list<string>>
	 */
	public static function getCustomSlugs(): array {
		$value = SettingModel::adoptOption( self::SLUGS_OPTION, self::SLUGS_SETTING, [] );
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

		SettingModel::setValue( self::SLUGS_SETTING, $existing );

		return $existing;
	}

	/**
	 * Reset a token group: drop someone's own values in it and any custom slugs. Values fall back to
	 * the palette (for colours) and the theme.json projection. Tokens already synced to theme.json (forward-only) are not clawed
	 * back — they're legitimately part of the user Global Styles now.
	 */
	public static function resetCategory( string $category ): void {
		$own = self::values();
		unset( $own['tokens'][ $category ] );
		self::persistValues( $own );

		$slugs = self::getCustomSlugs();
		if ( isset( $slugs[ $category ] ) ) {
			unset( $slugs[ $category ] );
			SettingModel::setValue( self::SLUGS_SETTING, $slugs );
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
