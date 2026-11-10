<?php
/**
 * The front-end behaviour registry.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Behaviours;

use Blicks\Core\Plugin as BasePlugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Behaviours are the few things a block does that CSS cannot: open a dialog, toggle, follow the
 * pointer. Each is a WordPress script module built on the Interactivity API, registered as
 * `@blicks/<name>`, whose store is the `blicks/<name>` namespace.
 *
 * A block uses one by carrying its directives: `data-wp-interactive="blicks/<name>"` on its element,
 * saved or written at render. The module is enqueued only when the page renders such an element
 * ({@see self::collect()}), so a page without one loads no behaviour JavaScript.
 *
 * Companion plugins add their own through the `blicks_behaviours` filter:
 *
 *     add_filter( 'blicks_behaviours', fn ( $b ) => $b + [
 *         'countdown' => [ 'src' => plugins_url( 'build/countdown.js', __FILE__ ), 'version' => '1.0.0' ],
 *     ] );
 */
final class Behaviours {

	/** The core module every behaviour imports. */
	private const INTERACTIVITY = '@wordpress/interactivity';

	/** @var array<string, array{src: string, version: string, deps: list<string>}>|null */
	private static ?array $all = null;

	/**
	 * Every behaviour, by name: the plugin's own from `build/behaviours`, then the filter's.
	 *
	 * @return array<string, array{src: string, version: string, deps: list<string>}>
	 */
	public static function all(): array {
		if ( null !== self::$all ) {
			return self::$all;
		}

		$builtins = [];

		foreach ( [ 'dialog', 'disclosure', 'hover-intent', 'sticky-shrink', 'portal', 'form' ] as $name ) {
			$asset = BasePlugin::path( "build/behaviours/{$name}.asset.php" );
			$manifest = is_readable( $asset ) ? include $asset : [];

			if ( file_exists( BasePlugin::path( "build/behaviours/{$name}.js" ) ) ) {
				$builtins[ $name ] = [
					'src' => BasePlugin::url( "build/behaviours/{$name}.js" ),
					'version' => is_array( $manifest ) ? (string) ( $manifest['version'] ?? '' ) : '',
				];
			}
		}

		/**
		 * The front-end behaviours, by name. Each is a script module built on the Interactivity
		 * API, whose store is the `blicks/<name>` namespace.
		 *
		 * @param array<string, array{src: string, version?: string, deps?: list<string>}> $behaviours
		 */
		$filtered = apply_filters( 'blicks_behaviours', $builtins );
		$clean = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $name => $spec ) {
			if ( ! is_string( $name ) || 1 !== preg_match( '/^[a-z][a-z0-9-]*$/', $name ) || ! is_array( $spec ) || ! is_string( $spec['src'] ?? null ) || '' === $spec['src'] ) {
				continue;
			}

			$deps = array_values( array_filter( is_array( $spec['deps'] ?? null ) ? $spec['deps'] : [], 'is_string' ) );

			$clean[ $name ] = [
				'src' => $spec['src'],
				'version' => is_string( $spec['version'] ?? null ) ? $spec['version'] : '',
				'deps' => array_values( array_unique( array_merge( [ self::INTERACTIVITY ], $deps ) ) ),
			];
		}

		self::$all = $clean;

		return $clean;
	}

	/** Forget what was read: for tests, and after the filter changes. */
	public static function reset(): void {
		self::$all = null;
	}

	/** `@blicks/dialog` for `dialog`. */
	public static function moduleId( string $name ): string {
		return '@blicks/' . $name;
	}

	/** Register every behaviour as a script module. */
	public static function register(): void {
		foreach ( self::all() as $name => $spec ) {
			wp_register_script_module( self::moduleId( $name ), $spec['src'], $spec['deps'], '' !== $spec['version'] ? $spec['version'] : false );
		}
	}

	/** Load one behaviour on this page. False when there is no such behaviour. */
	public static function enqueue( string $name ): bool {
		if ( ! isset( self::all()[ $name ] ) ) {
			return false;
		}

		wp_enqueue_script_module( self::moduleId( $name ) );

		return true;
	}

	/**
	 * The behaviours rendered markup uses, whose name is registered: every region,
	 * `data-wp-interactive="blicks/<name>"`, and every directive that calls one from inside another
	 * region by namespace, `data-wp-on--pointerenter="blicks/<name>::actions.enter"`.
	 *
	 * @return list<string>
	 */
	public static function used( string $html ): array {
		if ( ! str_contains( $html, 'data-wp-' ) ) {
			return [];
		}

		preg_match_all( '/data-wp-interactive=(["\'])blicks\/([a-z][a-z0-9-]*)\1/', $html, $regions );
		preg_match_all( '/\sdata-wp-[a-z0-9-]+=(["\'])blicks\/([a-z][a-z0-9-]*)::/', $html, $calls );

		return array_values( array_intersect( array_unique( [ ...$regions[2], ...$calls[2] ] ), array_keys( self::all() ) ) );
	}

	/** Enqueue the behaviours a rendered block uses. */
	public static function collect( string $html ): void {
		foreach ( self::used( $html ) as $name ) {
			self::enqueue( $name );
		}
	}
}
