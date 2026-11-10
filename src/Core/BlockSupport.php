<?php
/**
 * Which blocks the Blicks engine works on.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether a block opts into the Blicks style engine.
 *
 * This used to be asked as "is it called `blicks/…`", in two places. That answer is wrong for any
 * block this plugin does not itself ship: a companion plugin registering `acme/hero` with
 * `supports.blicks` got the editor controls — the JavaScript reads the manifest, not the name — and
 * then rendered on the front end with no scoped CSS at all. Tier-3 rules (pseudo-elements,
 * container queries, `@property`, keyframes) simply vanished, and the base stylesheet never
 * enqueued, so a static block's layout did nothing. Silent, and only on the front end.
 *
 * So the question is now what a block DECLARES. `supports.blicks` is already the manifest the
 * editor filters its inspector from, which makes it the honest gate on the PHP side too.
 */
final class BlockSupport {

	/**
	 * Memoised per name, for the request.
	 *
	 * `render_block` fires once per block per render, and a registry lookup on every call of a
	 * long page is real work for an answer that cannot change within a request.
	 *
	 * @var array<string, bool>
	 */
	private static array $cache = [];

	/**
	 * Does this block use the Blicks engine?
	 *
	 * @param string              $name Block name, e.g. `blicks/box` or `acme/hero`.
	 * @param \WP_Block_Type|null $type Already in hand? Pass it and skip the registry lookup.
	 */
	public static function usesBlicks( string $name, ?\WP_Block_Type $type = null ): bool {
		if ( '' === $name ) {
			return false;
		}

		// Every block this plugin ships, without touching the registry. It is the common case by a
		// wide margin, and on a page of Blicks blocks it is the whole loop.
		if ( str_starts_with( $name, 'blicks/' ) ) {
			return true;
		}

		if ( $type instanceof \WP_Block_Type ) {
			return self::declares( $type );
		}

		if ( isset( self::$cache[ $name ] ) ) {
			return self::$cache[ $name ];
		}

		$registered = \WP_Block_Type_Registry::get_instance()->get_registered( $name );

		self::$cache[ $name ] = $registered instanceof \WP_Block_Type && self::declares( $registered );

		return self::$cache[ $name ];
	}

	/**
	 * `supports.blicks` present and not switched off.
	 *
	 * Truthy rather than strictly `true`: a block declares it as an object of controls and states,
	 * `{ "blicks": { "controls": [ … ] } }`, which is what the editor reads. `false` is the way to
	 * opt out explicitly.
	 */
	private static function declares( \WP_Block_Type $type ): bool {
		$supports = $type->supports;

		if ( ! is_array( $supports ) || ! array_key_exists( 'blicks', $supports ) ) {
			return false;
		}

		return false !== $supports['blicks'] && null !== $supports['blicks'];
	}

	/** Test seam. Block types can be registered and unregistered within one test run. */
	public static function flush(): void {
		self::$cache = [];
	}
}
