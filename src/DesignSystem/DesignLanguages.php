<?php
/**
 * Design languages — how a site is drawn, picked apart from its colours.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Models\SettingModel;
use Blicks\Style\CssValue;

/**
 * A design language is the shape half of a design system: corners, depth, borders, the hover lift,
 * how headings are set, and how buttons and cards are drawn. Colour is the other half and stays with
 * the palette, so any language works with any palette.
 *
 * A language is one layer of values between the theme.json projection and the active theme's own
 * overrides ({@see Catalogue::snapshot()}): it changes what a token *is*, never what a block saved,
 * so switching it restyles every page without re-saving a post, and a value someone set by hand on
 * a block (or in the Design system) still wins. Three parts:
 *
 * - `tokens`     — token values, same shape as an override bag's `tokens`.
 * - `typeRoles`  — type-role props, same shape as an override bag's `typeRoles`.
 * - `components` — `--blicks-button-*` / `--blicks-surface-*` variables Button and Box read with
 *                  today's look as their fallback, for what a token cannot say (a bevel, a sheen).
 *                  `{color.x}` in a value is the palette's colour, as a CSS variable. They sit in
 *                  the blocks' base layer, so anything set on a block itself still wins; a sheen
 *                  is a translucent overlay for the same reason — it lights any fill.
 *                  `surface-opacity`, `surface-tint` and `surface-border-color` are the exception:
 *                  a card's fill and edge come from its own style classes, so Box mixes *that* fill
 *                  (this much of it, the rest `surface-tint`, transparent by default — frosted
 *                  glass, or Claymorphism's pastel) and recolours that edge, rather than replacing
 *                  either.
 *
 * Minimal is what Blicks ships and sets nothing, so a site that never picks a language renders
 * exactly as before.
 */
final class DesignLanguages {

	/** Key in the `blicks_settings` table. */
	private const SETTING = 'design.language';
	public const DEFAULT = 'minimal';

	/** The headings a language sets the weight and tracking of. */
	private const HEADINGS = [ 'display', 'h1', 'h2', 'h3' ];

	/**
	 * What glass is laid over: the palette's accent and primary as two soft lights on the page's own
	 * colour. A frosted surface on a flat page is a slightly paler rectangle; it only reads as glass
	 * with something behind it to blur. The primary sits low and to the right so a headline at the
	 * top left stays on the light side.
	 */
	private const GLASS_BACKDROP = 'radial-gradient(circle at 12% 15%, color-mix(in srgb, var(--blicks-color-accent) 70%, transparent), transparent 55%), '
		. 'radial-gradient(circle at 88% 88%, color-mix(in srgb, var(--blicks-color-primary) 45%, transparent), transparent 60%), '
		. 'linear-gradient(135deg, color-mix(in srgb, var(--blicks-color-accent) 30%, var(--blicks-color-background)), color-mix(in srgb, var(--blicks-color-primary) 20%, var(--blicks-color-background)))';

	/**
	 * Every built-in language. Each sets the same token keys, so switching never leaves another
	 * language's value behind.
	 *
	 * @return list<array{id: string, name: string, description: string, traits: list<string>, tokens: array<string, array<string, string>>, typeRoles: array<string, array<string, string>>, components: array<string, string>}>
	 */
	public static function builtins(): array {
		return [
			self::language(
				'minimal',
				__( 'Minimalism', 'blicks' ),
				__( 'Quiet and plain. Thin lines, small corners, almost no shadow.', 'blicks' ),
				[ __( 'small corners', 'blicks' ), __( 'hairlines', 'blicks' ), __( 'quiet', 'blicks' ) ],
				[],
				[],
				[]
			),
			self::language(
				'flat',
				__( 'Flat design', 'blicks' ),
				__( 'Solid shapes and solid colors. No shadows, no gradients, nothing raised.', 'blicks' ),
				[ __( 'no shadows', 'blicks' ), __( 'solid fills', 'blicks' ), __( 'crisp', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.125rem',
						'md' => '0.25rem',
						'lg' => '0.375rem',
						'xl' => '0.5rem',
					],
					'shadow' => [
						'sm' => 'none',
						'md' => 'none',
						'lg' => 'none',
						'xl' => 'none',
					],
					'transform' => [ 'lift' => 'none' ],
				],
				self::headings( '700', '-0.01em' ),
				[]
			),
			self::language(
				'skeuo',
				__( 'Skeuomorphism', 'blicks' ),
				__( 'Made of real things. Lit from above, bevelled buttons, raised surfaces.', 'blicks' ),
				[ __( 'bevels', 'blicks' ), __( 'layered depth', 'blicks' ), __( 'serif headings', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.25rem',
						'md' => '0.5rem',
						'lg' => '0.625rem',
						'xl' => '0.875rem',
					],
					'shadow' => [
						'sm' => '0 1px 2px rgb(0 0 0 / 0.3), 0 3px 6px rgb(0 0 0 / 0.12)',
						'md' => 'inset 0 1px 0 rgb(255 255 255 / 0.8), 0 2px 3px rgb(0 0 0 / 0.14), 0 8px 18px rgb(0 0 0 / 0.1)',
						'lg' => 'inset 0 1px 0 rgb(255 255 255 / 0.8), 0 4px 8px rgb(0 0 0 / 0.16), 0 18px 36px rgb(0 0 0 / 0.14)',
						'xl' => 'inset 0 1px 0 rgb(255 255 255 / 0.8), 0 8px 16px rgb(0 0 0 / 0.18), 0 28px 56px rgb(0 0 0 / 0.16)',
					],
					'transform' => [ 'lift' => 'translateY(-1px)' ],
				],
				self::headings( '700', '-0.01em', 'var(--blicks-fontFamily-serif)' ),
				[
					// Overlays, not fills: they light whatever colour the button has, a fill set by hand too.
					'button-sheen' => 'linear-gradient(180deg, rgb(255 255 255 / 0.3), rgb(255 255 255 / 0) 55%, rgb(0 0 0 / 0.14))',
					'button-border-color' => 'color-mix(in srgb, {color.primary} 65%, #000)',
					'button-shadow' => 'inset 0 1px 0 rgb(255 255 255 / 0.4), 0 1px 2px rgb(0 0 0 / 0.3), 0 3px 6px rgb(0 0 0 / 0.12)',
					'button-text-shadow' => '0 -1px 0 rgb(0 0 0 / 0.3)',
					'button-secondary-sheen' => 'linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 70%)',
					'button-secondary-border-color' => 'color-mix(in srgb, {color.border} 60%, #000)',
					'button-secondary-shadow' => 'inset 0 1px 0 #fff, 0 1px 2px rgb(0 0 0 / 0.15)',
					'surface-sheen' => 'linear-gradient(180deg, rgb(255 255 255 / 0.6), rgb(0 0 0 / 0.04))',
				]
			),
			self::language(
				'glass',
				__( 'Glassmorphism', 'blicks' ),
				__( 'Frosted panels with a soft sheen, light edges and a deep blur.', 'blicks' ),
				[ __( 'frosted', 'blicks' ), __( 'blur', 'blicks' ), __( 'wide shadows', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.5rem',
						'md' => '0.75rem',
						'lg' => '1.25rem',
						'xl' => '1.75rem',
					],
					'shadow' => [
						'sm' => '0 1px 2px rgb(0 0 0 / 0.06)',
						'md' => '0 8px 32px rgb(0 0 0 / 0.12)',
						'lg' => '0 20px 50px rgb(0 0 0 / 0.18)',
						'xl' => '0 30px 70px rgb(0 0 0 / 0.22)',
					],
					'gradient' => [ 'backdrop' => self::GLASS_BACKDROP ],
				],
				self::headings( '600', '-0.03em' ),
				[
					'surface-sheen' => 'linear-gradient(135deg, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0.12))',
					'surface-blur' => 'blur(14px) saturate(1.4)',
					'surface-opacity' => '45%',
					'surface-border-color' => 'rgb(255 255 255 / 0.6)',
					'button-secondary-background' => 'color-mix(in srgb, {color.secondary} 60%, transparent)',
					'button-secondary-border-color' => 'rgb(255 255 255 / 0.6)',
				]
			),
			self::language(
				'liquid-glass',
				__( 'Liquid Glass', 'blicks' ),
				__( 'Rounded glass that bends the light. A bright rim on top, a strong blur behind.', 'blicks' ),
				[ __( 'very round', 'blicks' ), __( 'specular rim', 'blicks' ), __( 'strong blur', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.75rem',
						'md' => '9999px',
						'lg' => '1.75rem',
						'xl' => '2.25rem',
					],
					'shadow' => [
						'sm' => 'inset 0 1px 0 rgb(255 255 255 / 0.7), 0 2px 8px rgb(0 0 0 / 0.08)',
						'md' => 'inset 0 1px 1px rgb(255 255 255 / 0.8), inset 0 -1px 1px rgb(0 0 0 / 0.06), 0 12px 32px rgb(0 0 0 / 0.12)',
						'lg' => 'inset 0 1px 1px rgb(255 255 255 / 0.8), inset 0 -1px 1px rgb(0 0 0 / 0.06), 0 22px 50px rgb(0 0 0 / 0.16)',
						'xl' => 'inset 0 1px 1px rgb(255 255 255 / 0.8), inset 0 -1px 1px rgb(0 0 0 / 0.06), 0 32px 72px rgb(0 0 0 / 0.2)',
					],
					'button' => [ 'radius' => '9999px' ],
					'gradient' => [ 'backdrop' => self::GLASS_BACKDROP ],
				],
				self::headings( '600', '-0.03em' ),
				[
					'button-sheen' => 'radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.45), rgb(255 255 255 / 0) 60%)',
					'button-shadow' => 'inset 0 1px 1px rgb(255 255 255 / 0.6), 0 4px 14px rgb(0 0 0 / 0.14)',
					'button-secondary-background' => 'color-mix(in srgb, {color.secondary} 45%, transparent)',
					'button-secondary-sheen' => 'radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.7), rgb(255 255 255 / 0) 60%)',
					'button-secondary-shadow' => 'inset 0 1px 1px rgb(255 255 255 / 0.8), 0 4px 14px rgb(0 0 0 / 0.08)',
					'surface-sheen' => 'radial-gradient(140% 70% at 30% 0%, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0) 55%)',
					'surface-blur' => 'blur(22px) saturate(1.8)',
					'surface-opacity' => '28%',
					'surface-border-color' => 'rgb(255 255 255 / 0.75)',
				]
			),
			self::language(
				'neumorph',
				__( 'Neumorphism', 'blicks' ),
				__( 'Soft shapes pressed out of the page, lit from the top left. Best on a light, even background.', 'blicks' ),
				[ __( 'extruded', 'blicks' ), __( 'two-sided light', 'blicks' ), __( 'borderless', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.625rem',
						'md' => '0.875rem',
						'lg' => '1.25rem',
						'xl' => '1.75rem',
					],
					'shadow' => [
						'sm' => '4px 4px 8px rgb(0 0 0 / 0.12), -4px -4px 8px rgb(255 255 255 / 0.85)',
						'md' => '8px 8px 16px rgb(0 0 0 / 0.12), -8px -8px 16px rgb(255 255 255 / 0.85)',
						'lg' => '12px 12px 24px rgb(0 0 0 / 0.14), -12px -12px 24px rgb(255 255 255 / 0.9)',
						'xl' => '18px 18px 36px rgb(0 0 0 / 0.16), -18px -18px 36px rgb(255 255 255 / 0.9)',
					],
					'transform' => [ 'lift' => 'none' ],
					// The shapes are pressed out of the page, so page and surfaces share one soft tone
					// the white light side can show against. Brand and accent stay the palette's.
					'color' => [
						'background' => '#e7ecf2',
						'card' => '#e7ecf2',
						'secondary' => '#e7ecf2',
						'muted' => '#dfe5ec',
						'border' => '#d3dbe5',
						'input' => '#d3dbe5',
					],
				],
				self::headings( '600', '-0.015em' ),
				[
					'button-shadow' => '4px 4px 8px rgb(0 0 0 / 0.16), -4px -4px 8px rgb(255 255 255 / 0.8)',
					'button-secondary-background' => '{color.background}',
					'button-secondary-shadow' => '4px 4px 8px rgb(0 0 0 / 0.12), -4px -4px 8px rgb(255 255 255 / 0.9)',
					// Borderless: the two-sided light is the edge, so a card's hairline goes.
					'surface-border-color' => 'transparent',
				]
			),
			self::language(
				'clay',
				__( 'Claymorphism', 'blicks' ),
				__( 'Puffy, rounded shapes like soft clay. Inner light, a deep drop shadow, playful headings.', 'blicks' ),
				[ __( 'puffy', 'blicks' ), __( 'inner light', 'blicks' ), __( 'very round', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.875rem',
						'md' => '9999px',
						'lg' => '1.75rem',
						'xl' => '2.5rem',
					],
					'shadow' => [
						'sm' => 'inset -6px -6px 12px rgb(0 0 0 / 0.14), inset 6px 6px 12px rgb(255 255 255 / 0.75), 6px 10px 20px rgb(0 0 0 / 0.14)',
						'md' => 'inset -6px -6px 12px rgb(0 0 0 / 0.1), inset 6px 6px 12px rgb(255 255 255 / 0.6), 8px 14px 28px rgb(0 0 0 / 0.14)',
						'lg' => 'inset -8px -8px 16px rgb(0 0 0 / 0.1), inset 8px 8px 16px rgb(255 255 255 / 0.6), 12px 20px 40px rgb(0 0 0 / 0.16)',
						'xl' => 'inset -10px -10px 20px rgb(0 0 0 / 0.1), inset 10px 10px 20px rgb(255 255 255 / 0.6), 18px 28px 56px rgb(0 0 0 / 0.18)',
					],
					'button' => [ 'radius' => '9999px' ],
					'transform' => [ 'lift' => 'translateY(-3px) scale(1.02)' ],
				],
				self::headings( '800', '-0.02em' ),
				[
					'button-shadow' => 'inset -3px -3px 6px rgb(0 0 0 / 0.18), inset 3px 3px 6px rgb(255 255 255 / 0.35), 4px 8px 16px rgb(0 0 0 / 0.16)',
					'button-secondary-shadow' => 'inset -3px -3px 6px rgb(0 0 0 / 0.08), inset 3px 3px 6px rgb(255 255 255 / 0.7), 4px 8px 16px rgb(0 0 0 / 0.1)',
					'button-secondary-background' => 'color-mix(in srgb, {color.accent} 22%, #fff)',
					// Soft pastel clay: the card's own fill blended into a light tint of the accent.
					'surface-opacity' => '35%',
					'surface-tint' => 'color-mix(in srgb, {color.accent} 32%, #fff)',
					'surface-border-color' => 'transparent',
				]
			),
			self::language(
				'brutal',
				__( 'Neo-brutalism', 'blicks' ),
				__( 'Loud and graphic. Square corners, heavy outlines, hard offset shadows.', 'blicks' ),
				[ __( 'square', 'blicks' ), __( 'hard shadows', 'blicks' ), __( 'heavy type', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0',
						'md' => '0',
						'lg' => '0',
						'xl' => '0',
					],
					'shadow' => [
						'sm' => '3px 3px 0 #09090b',
						'md' => '5px 5px 0 #09090b',
						'lg' => '8px 8px 0 #09090b',
						'xl' => '12px 12px 0 #09090b',
					],
					'borderWidth' => [
						'hair' => '2px',
						'strong' => '3px',
						'heavy' => '4px',
					],
					'transform' => [ 'lift' => 'translate(-2px, -2px)' ],
				],
				self::headings( '800', '-0.035em' ),
				[
					'button-border-color' => '{color.foreground}',
					'button-shadow' => '3px 3px 0 {color.foreground}',
					'button-secondary-border-color' => '{color.foreground}',
					'surface-border-color' => '{color.foreground}',
					'button-secondary-shadow' => '3px 3px 0 {color.foreground}',
				]
			),
			self::language(
				'bento',
				__( 'Bento grid', 'blicks' ),
				__( 'Tidy rounded tiles side by side, like a bento box. Even gaps, fine edges, no fuss.', 'blicks' ),
				[ __( 'rounded tiles', 'blicks' ), __( 'fine edges', 'blicks' ), __( 'calm depth', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.5rem',
						'md' => '0.75rem',
						'lg' => '1.5rem',
						'xl' => '2rem',
					],
					'shadow' => [
						'sm' => '0 1px 2px rgb(0 0 0 / 0.05)',
						'md' => '0 1px 3px rgb(0 0 0 / 0.06), 0 6px 16px rgb(0 0 0 / 0.04)',
						'lg' => '0 12px 32px rgb(0 0 0 / 0.08)',
						'xl' => '0 24px 56px rgb(0 0 0 / 0.1)',
					],
				],
				self::headings( '700', '-0.03em' ),
				[]
			),
			self::language(
				'y2k',
				__( 'Retro Y2K', 'blicks' ),
				__( 'Glossy, bubbly and chrome, straight from 2001. Aqua buttons and shiny panels.', 'blicks' ),
				[ __( 'glossy', 'blicks' ), __( 'chrome', 'blicks' ), __( 'bubbly', 'blicks' ) ],
				[
					'radius' => [
						'sm' => '0.5rem',
						'md' => '9999px',
						'lg' => '1rem',
						'xl' => '1.5rem',
					],
					'shadow' => [
						'sm' => '0 2px 4px rgb(0 0 0 / 0.25)',
						'md' => 'inset 0 1px 0 rgb(255 255 255 / 0.9), 0 3px 8px rgb(0 0 0 / 0.2)',
						'lg' => 'inset 0 1px 0 rgb(255 255 255 / 0.9), 0 8px 20px rgb(0 0 0 / 0.22)',
						'xl' => 'inset 0 1px 0 rgb(255 255 255 / 0.9), 0 16px 36px rgb(0 0 0 / 0.24)',
					],
					'borderWidth' => [
						'hair' => '1px',
						'strong' => '2px',
						'heavy' => '3px',
					],
					'button' => [ 'radius' => '9999px' ],
					'transform' => [ 'lift' => 'translateY(-2px)' ],
				],
				self::headings( '800', '-0.02em' ),
				[
					// Aqua: a hard-edged white gloss on the top half of whatever colour the button has.
					'button-sheen' => 'linear-gradient(180deg, rgb(255 255 255 / 0.75), rgb(255 255 255 / 0.2) 48%, rgb(255 255 255 / 0) 52%, rgb(255 255 255 / 0.25))',
					'button-border-color' => 'color-mix(in srgb, {color.primary} 60%, #000)',
					'button-shadow' => '0 2px 6px color-mix(in srgb, {color.primary} 45%, transparent)',
					'button-text-shadow' => '0 1px 1px rgb(0 0 0 / 0.35)',
					'button-secondary-sheen' => 'linear-gradient(180deg, #fff, #dfe3ea 50%, #c9cfd9 51%, #eef1f5)',
					'button-secondary-border-color' => '#9aa3b2',
					'surface-sheen' => 'linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0.15) 50%, rgb(0 0 0 / 0.03))',
				]
			),
		];
	}

	/** @return array{id: string, name: string, description: string, traits: list<string>, tokens: array<string, array<string, string>>, typeRoles: array<string, array<string, string>>, components: array<string, string>} */
	public static function find( string $id ): ?array {
		foreach ( self::builtins() as $language ) {
			if ( $language['id'] === $id ) {
				return $language;
			}
		}

		return null;
	}

	/** The chosen language's id; an unknown stored id reads as the default. */
	public static function activeId(): string {
		$stored = SettingModel::getValue( self::SETTING, self::DEFAULT );

		return is_string( $stored ) && null !== self::find( $stored ) ? $stored : self::DEFAULT;
	}

	/** @return array{id: string, name: string, description: string, traits: list<string>, tokens: array<string, array<string, string>>, typeRoles: array<string, array<string, string>>, components: array<string, string>} */
	public static function active(): array {
		return self::find( self::activeId() ) ?? self::builtins()[0];
	}

	/** Choose a language. False for an id no language has. */
	public static function setActive( string $id ): bool {
		if ( null === self::find( $id ) ) {
			return false;
		}

		SettingModel::setValue( self::SETTING, $id );

		return true;
	}

	/**
	 * The list the admin shows: every language with what its picker card draws, plus the chosen id.
	 *
	 * @return array{active: string, languages: list<array{id: string, name: string, description: string, traits: list<string>, sample: array<string, string>}>}
	 */
	public static function summary(): array {
		return [
			'active' => self::activeId(),
			'languages' => array_map(
				static fn ( array $l ): array => [
					'id' => $l['id'],
					'name' => $l['name'],
					'description' => $l['description'],
					'traits' => $l['traits'],
					'sample' => self::sample( $l ),
				],
				self::builtins()
			),
		];
	}

	/**
	 * The few values a picker card needs to draw a language — its own where it sets one, else
	 * what Blicks ships — with component values left as written (`{color.x}` is resolved by the
	 * page against the palette it shows).
	 *
	 * @param array{tokens: array<string, array<string, string>>, typeRoles: array<string, array<string, string>>, components: array<string, string>} $language
	 * @return array<string, string>
	 */
	private static function sample( array $language ): array {
		$base = ThemeProjection::baseFallbacks();
		$token = static fn ( string $cat, string $slug ): string => (string) ( $language['tokens'][ $cat ][ $slug ] ?? $base[ $cat ][ $slug ] ?? '' );
		$h1 = $language['typeRoles']['h1'] ?? [];

		return array_merge(
			[
				'radius' => '' !== $token( 'button', 'radius' ) ? $token( 'button', 'radius' ) : $token( 'radius', 'md' ),
				'cardRadius' => $token( 'radius', 'lg' ),
				'shadow' => $token( 'shadow', 'sm' ),
				'cardShadow' => $token( 'shadow', 'sm' ),
				'border' => $token( 'borderWidth', 'hair' ),
				'headingWeight' => (string) ( $h1['fontWeight'] ?? '700' ),
				'headingSpacing' => (string) ( $h1['letterSpacing'] ?? '-0.02em' ),
				'headingSerif' => isset( $h1['fontFamily'] ) && str_contains( $h1['fontFamily'], 'serif' ) && ! str_contains( $h1['fontFamily'], 'sans' ) ? '1' : '',
				// Shapes pressed out of the page only read on its own tone, so it is drawn on that.
				'backdrop' => isset( $language['tokens']['color']['background'] ) ? 'plain' : '',
			],
			self::prefixed( 'color.', $language['tokens']['color'] ?? [] ),
			$language['components']
		);
	}

	/**
	 * @param array<string, string> $values
	 * @return array<string, string>
	 */
	private static function prefixed( string $prefix, array $values ): array {
		$out = [];
		foreach ( $values as $key => $value ) {
			$out[ $prefix . $key ] = $value;
		}

		return $out;
	}

	/**
	 * The language's component variables as CSS declarations, `{color.x}` resolved to the palette's
	 * variable. Every value goes through the same allow-list as a token value and is dropped whole
	 * when it fails.
	 *
	 * @param array<string, string> $components
	 * @return list<string>
	 */
	public static function componentDeclarations( array $components ): array {
		$lines = [];
		foreach ( $components as $name => $value ) {
			if ( 1 !== preg_match( '/^[a-z][a-z0-9-]*$/', $name ) ) {
				continue;
			}

			$resolved = (string) preg_replace_callback(
				'/\{color\.([a-z0-9-]+)\}/',
				static fn ( array $m ): string => 'var(--blicks-color-' . $m[1] . ')',
				$value
			);
			$clean = CssValue::clean( $resolved );
			if ( '' === $clean ) {
				continue;
			}

			$lines[] = sprintf( '  --blicks-%s: %s;', $name, $clean );
		}

		return $lines;
	}

	/**
	 * @param list<string> $traits
	 * @param array<string, array<string, string>> $tokens
	 * @param array<string, array<string, string>> $typeRoles
	 * @param array<string, string> $components
	 * @return array{id: string, name: string, description: string, traits: list<string>, tokens: array<string, array<string, string>>, typeRoles: array<string, array<string, string>>, components: array<string, string>}
	 */
	private static function language( string $id, string $name, string $description, array $traits, array $tokens, array $typeRoles, array $components ): array {
		return [
			'id' => $id,
			'name' => $name,
			'description' => $description,
			'traits' => $traits,
			'tokens' => $tokens,
			'typeRoles' => $typeRoles,
			'components' => $components,
		];
	}

	/** @return array<string, array<string, string>> */
	private static function headings( string $weight, string $tracking, ?string $family = null ): array {
		$roles = [];
		foreach ( self::HEADINGS as $role ) {
			$roles[ $role ] = array_filter(
				[
					'fontWeight' => $weight,
					'letterSpacing' => $tracking,
					'fontFamily' => $family,
				],
				static fn ( ?string $v ): bool => null !== $v
			);
		}

		return $roles;
	}
}
