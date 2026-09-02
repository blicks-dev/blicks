<?php
/**
 * The user-defined keyframe animation library.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The user-defined keyframe library.
 *
 * Stored **globally** rather than on the active design theme: a block records its animation as a
 * plain name string, so if the library rode along with the theme, switching theme would silently
 * strip motion from already-published content. Every theme therefore sees the same library.
 *
 * Definitions are structured (offset + declarations), never raw CSS — this stylesheet loads on
 * every front-end page, so declarations are whitelisted rather than blocklisted. {@see Keyframes}
 * renders them.
 */
final class Animations {

	private const OPTION = 'blicks_design_animations';

	private const MAX_ANIMATIONS = 60;
	private const MAX_STEPS = 20;
	private const MAX_DECLARATIONS = 12;
	private const MAX_LABEL = 60;
	private const MAX_SLUG = 40;
	private const MAX_VALUE = 200;

	/**
	 * Properties a keyframe step may set. Animatable, paint-only, and none of them can load a
	 * resource or escape the rule. `--bl-*` custom properties are allowed separately (see
	 * {@see self::property()}) because blocks like the progress dial animate `--bl-p`.
	 */
	private const ALLOWED_PROPERTIES = [
		'opacity',
		'transform',
		'translate',
		'rotate',
		'scale',
		'filter',
		'backdrop-filter',
		'color',
		'background-color',
		'background-position',
		'background-size',
		'border-color',
		'border-radius',
		'box-shadow',
		'text-shadow',
		'outline-color',
		'clip-path',
		'width',
		'height',
		'max-width',
		'max-height',
		'margin',
		'padding',
		'top',
		'right',
		'bottom',
		'left',
		'inset',
		'gap',
		'letter-spacing',
		'word-spacing',
		'line-height',
		'font-size',
		'font-weight',
		'stroke-dashoffset',
		'stroke-dasharray',
		'visibility',
		'offset-distance',
		'offset-rotate',
		'perspective',
		'z-index',
	];

	/**
	 * The predefined animations. These are **structural**: their `@keyframes` are declared in
	 * `resources/runtime/runtime.scss` and at least one (`bl-marquee`) is consumed directly by a
	 * block's own stylesheet, so they are not user records — they cannot be edited or deleted,
	 * and {@see Keyframes} does not re-emit them. They appear here so the block Motion control
	 * has **one** list to read: {@see self::library()}.
	 *
	 * Keep in step with the `@keyframes` block in runtime.scss.
	 *
	 * @return list<array{slug:string,name:string,label:string,description:string,defaults:array<string,string>,builtin:true}>
	 */
	public static function builtins(): array {
		$make = static fn ( string $slug, string $label, string $description, array $defaults ): array => [
			'slug' => $slug,
			// Built-ins keep their bare historic name — content already references `bl-spin`.
			'name' => 'bl-' . $slug,
			'label' => $label,
			'description' => $description,
			'defaults' => $defaults,
			'builtin' => true,
			'steps' => [],
		];

		return [
			$make(
				'spin',
				__( 'Spin', 'blicks' ),
				__( 'Rotates one full turn.', 'blicks' ),
				[
					'duration' => '8s',
					'easing' => 'linear',
					'iteration' => 'infinite',
				]
			),
			$make(
				'float',
				__( 'Float', 'blicks' ),
				__( 'Gentle up/down bobbing.', 'blicks' ),
				[
					'duration' => '6s',
					'easing' => 'ease-in-out',
					'iteration' => 'infinite',
					'direction' => 'alternate',
				]
			),
			$make(
				'ping',
				__( 'Ping', 'blicks' ),
				__( 'Expanding pulse — opacity fades while scaling up.', 'blicks' ),
				[
					'duration' => '1.5s',
					'easing' => 'cubic-bezier(0, 0, 0.2, 1)',
					'iteration' => 'infinite',
				]
			),
			$make(
				'rise',
				__( 'Rise', 'blicks' ),
				__( 'Fades in from below — good for view-driven reveals.', 'blicks' ),
				[
					'duration' => '700ms',
					'easing' => 'cubic-bezier(0.16, 1, 0.3, 1)',
					'iteration' => '1',
					'fillMode' => 'both',
				]
			),
			$make(
				'pan',
				__( 'Pan', 'blicks' ),
				__( 'Slides the background-position horizontally.', 'blicks' ),
				[
					'duration' => '12s',
					'easing' => 'linear',
					'iteration' => 'infinite',
					'direction' => 'alternate',
				]
			),
			$make(
				'marquee',
				__( 'Marquee', 'blicks' ),
				__( 'Translates the element by -50% — pair with a duplicated track for a seamless loop.', 'blicks' ),
				[
					'duration' => '20s',
					'easing' => 'linear',
					'iteration' => 'infinite',
				]
			),
			$make(
				'fill',
				__( 'Fill', 'blicks' ),
				__( 'Animates --bl-p from 0 to --bl-p-target — drives progress dials and bars.', 'blicks' ),
				[
					'duration' => '1.5s',
					'easing' => 'ease-out',
					'iteration' => '1',
					'fillMode' => 'forwards',
				]
			),
		];
	}

	/**
	 * The full set the Motion control offers: predefined first, then the user's own. This is the
	 * single source of truth — the control renders this list and nothing else.
	 *
	 * @return list<array<string,mixed>>
	 */
	public static function library(): array {
		$custom = array_map(
			static fn ( array $animation ): array => $animation + [
				'name' => Keyframes::name( $animation['slug'] ),
				'builtin' => false,
				'description' => '',
			],
			self::all()
		);

		return array_merge( self::builtins(), $custom );
	}

	/**
	 * Reserved because `runtime.scss` already declares them. A custom animation is namespaced
	 * `bl-anim-{slug}` so it cannot collide, but the slug itself is still kept clear of the
	 * built-in names to avoid two identically-labelled rows in the picker.
	 */
	private const BUILTIN_SLUGS = [ 'spin', 'float', 'ping', 'rise', 'pan', 'marquee', 'fill' ];

	/**
	 * The stored library, validated on read (an option edited by hand or restored from an old
	 * backup must not be able to inject anything).
	 *
	 * @return list<array{slug:string,label:string,defaults:array<string,string>,steps:list<array{offset:int,declarations:array<string,string>}>}>
	 */
	public static function all(): array {
		if ( ! function_exists( 'get_option' ) ) {
			return [];
		}

		$raw = get_option( self::OPTION, [] );
		if ( ! is_array( $raw ) ) {
			return [];
		}

		$out = [];
		foreach ( $raw as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}

			$clean = self::sanitize( $entry );
			if ( null !== $clean ) {
				$out[] = $clean;
			}
		}

		return array_slice( $out, 0, self::MAX_ANIMATIONS );
	}

	public static function find( string $slug ): ?array {
		foreach ( self::all() as $animation ) {
			if ( $animation['slug'] === $slug ) {
				return $animation;
			}
		}

		return null;
	}

	/**
	 * Create or replace one animation. `$originalSlug` lets an update rename in place; without it
	 * the payload's slug decides.
	 *
	 * @param array<string,mixed> $payload
	 * @return array{ok:bool,error?:string,animations:list<array<string,mixed>>}
	 */
	public static function save( array $payload, string $originalSlug = '' ): array {
		$clean = self::sanitize( $payload );
		if ( null === $clean ) {
			return [
				'ok' => false,
				'error' => 'invalid',
				'animations' => self::all(),
			];
		}

		$existing = self::all();
		$isRename = '' !== $originalSlug && $originalSlug !== $clean['slug'];

		foreach ( $existing as $animation ) {
			if ( $animation['slug'] === $clean['slug'] && ( '' === $originalSlug || $isRename ) ) {
				return [
					'ok' => false,
					'error' => 'duplicate',
					'animations' => $existing,
				];
			}
		}

		$replaced = false;
		$next = [];
		foreach ( $existing as $animation ) {
			if ( ( '' !== $originalSlug ? $originalSlug : $clean['slug'] ) === $animation['slug'] ) {
				$next[] = $clean;
				$replaced = true;
				continue;
			}
			$next[] = $animation;
		}

		if ( ! $replaced ) {
			if ( count( $next ) >= self::MAX_ANIMATIONS ) {
				return [
					'ok' => false,
					'error' => 'limit',
					'animations' => $existing,
				];
			}
			$next[] = $clean;
		}

		self::persist( $next );

		return [
			'ok' => true,
			'animations' => $next,
		];
	}

	/** @return list<array<string,mixed>> */
	public static function delete( string $slug ): array {
		$next = array_values(
			array_filter(
				self::all(),
				static fn ( array $animation ): bool => $animation['slug'] !== $slug
			)
		);

		self::persist( $next );

		return $next;
	}

	/** @param list<array<string,mixed>> $animations */
	private static function persist( array $animations ): void {
		if ( function_exists( 'update_option' ) ) {
			update_option( self::OPTION, $animations, false );
		}
	}

	/**
	 * @param array<string,mixed> $entry
	 * @return array{slug:string,label:string,defaults:array<string,string>,steps:list<array{offset:int,declarations:array<string,string>}>}|null
	 */
	private static function sanitize( array $entry ): ?array {
		$slug = self::slug( (string) ( $entry['slug'] ?? '' ) );
		if ( null === $slug ) {
			return null;
		}

		$steps = self::steps( $entry['steps'] ?? null );
		if ( [] === $steps ) {
			return null;
		}

		$label = self::text( (string) ( $entry['label'] ?? '' ), self::MAX_LABEL );

		return [
			'slug' => $slug,
			'label' => '' !== $label ? $label : $slug,
			'defaults' => self::defaults( $entry['defaults'] ?? null ),
			'steps' => $steps,
		];
	}

	/** Lowercase kebab, never a built-in name, never empty. */
	private static function slug( string $value ): ?string {
		$slug = strtolower( trim( $value ) );
		$slug = (string) preg_replace( '/[^a-z0-9-]+/', '-', $slug );
		$slug = trim( (string) preg_replace( '/-+/', '-', $slug ), '-' );

		if ( '' === $slug || mb_strlen( $slug ) > self::MAX_SLUG ) {
			return null;
		}

		return in_array( $slug, self::BUILTIN_SLUGS, true ) ? null : $slug;
	}

	/**
	 * @param mixed $raw
	 * @return list<array{offset:int,declarations:array<string,string>}>
	 */
	private static function steps( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return [];
		}

		$byOffset = [];
		foreach ( $raw as $step ) {
			if ( ! is_array( $step ) ) {
				continue;
			}

			$offset = (int) round( (float) ( $step['offset'] ?? -1 ) );
			if ( $offset < 0 || $offset > 100 ) {
				continue;
			}

			$declarations = self::declarations( $step['declarations'] ?? null );
			if ( [] === $declarations ) {
				continue;
			}

			// Last write wins for a repeated offset — two `50%` blocks would be invalid CSS.
			$byOffset[ $offset ] = [
				'offset' => $offset,
				'declarations' => $declarations,
			];
		}

		ksort( $byOffset );

		return array_slice( array_values( $byOffset ), 0, self::MAX_STEPS );
	}

	/**
	 * @param mixed $raw
	 * @return array<string,string>
	 */
	private static function declarations( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return [];
		}

		$out = [];
		foreach ( $raw as $property => $value ) {
			if ( count( $out ) >= self::MAX_DECLARATIONS ) {
				break;
			}

			if ( ! is_string( $property ) || ! is_scalar( $value ) ) {
				continue;
			}

			$name = self::property( $property );
			if ( null === $name ) {
				continue;
			}

			$clean = self::value( (string) $value );
			if ( '' === $clean ) {
				continue;
			}

			$out[ $name ] = $clean;
		}

		return $out;
	}

	/** A whitelisted animatable property, or one of our own `--bl-*` custom properties. */
	private static function property( string $name ): ?string {
		$prop = strtolower( trim( $name ) );

		if ( str_starts_with( $prop, '--bl-' ) ) {
			return 1 === preg_match( '/^--bl-[a-z0-9-]{1,40}$/', $prop ) ? $prop : null;
		}

		return in_array( $prop, self::ALLOWED_PROPERTIES, true ) ? $prop : null;
	}

	/**
	 * Values are whitelisted by shape rather than blocklisted: no braces (cannot close the rule),
	 * no `<` (cannot close a `<style>`), no `url(`/`@`/script schemes (cannot fetch or execute),
	 * no comment markers (cannot smuggle past the parser).
	 */
	private static function value( string $raw ): string {
		$value = trim( (string) preg_replace( '/[\x00-\x1F\x7F]/', '', $raw ) );
		$value = str_replace( [ '{', '}', ';', '<', '>', '\\' ], '', $value );
		$value = (string) preg_replace( '#/\*|\*/#', '', $value );

		if ( 1 === preg_match( '/url\s*\(|expression\s*\(|(?:javascript|vbscript|data)\s*:|@import|behavior\s*:|-moz-binding/i', $value ) ) {
			return '';
		}

		$value = trim( $value );

		return mb_strlen( $value ) > self::MAX_VALUE ? '' : $value;
	}

	/**
	 * @param mixed $raw
	 * @return array<string,string>
	 */
	private static function defaults( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return [];
		}

		$allowed = [
			'duration' => '/^\d+(\.\d+)?(ms|s)$/',
			'easing' => '/^[a-z0-9\s\.,()-]{1,60}$/i',
			'iteration' => '/^(infinite|\d+(\.\d+)?)$/',
			'direction' => '/^(normal|reverse|alternate|alternate-reverse)$/',
			'fillMode' => '/^(none|forwards|backwards|both)$/',
		];

		$out = [];
		foreach ( $allowed as $key => $pattern ) {
			$value = $raw[ $key ] ?? null;
			if ( ! is_scalar( $value ) ) {
				continue;
			}

			$clean = self::value( (string) $value );
			if ( '' !== $clean && 1 === preg_match( $pattern, $clean ) ) {
				$out[ $key ] = $clean;
			}
		}

		return $out;
	}

	private static function text( string $value, int $max ): string {
		$clean = trim( (string) preg_replace( '/[\x00-\x1F\x7F]/', '', $value ) );
		$clean = wp_strip_all_tags( $clean );

		return mb_strlen( $clean ) > $max ? mb_substr( $clean, 0, $max ) : $clean;
	}
}
