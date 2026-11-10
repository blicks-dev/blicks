<?php
/**
 * The style engine's controls, described for a machine reader.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Catalog;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Style\ElementStyle;

/**
 * The style engine's controls, described well enough for something that has never seen the
 * codebase to write a valid `blicks` attribute tree.
 *
 * The tree has three levels, and every control uses all three:
 *
 *     [ '<control id>' ][ '<state>' ][ '<breakpoint>' ] = value
 *
 * A control id absent from this catalogue is not a style that happens to be unsupported — it is
 * dead config. `ElementStyle::build()` walks its rule table and ignores anything it does not
 * recognise, so an invented id is silently dropped and looks, from the outside, exactly like a
 * control that works. That is the failure this class exists to make impossible: a caller can
 * check an id before writing it, and {@see \Blicks\Ai\Spec\SpecValidator} does exactly that.
 *
 * Every read goes through the style engine rather than a copy. See `src/Ai/README.md`.
 */
final class ControlCatalog {

	/**
	 * The states a value may be set for. Mirrors `STATE_KEY` in
	 * `resources/framework/css/vars.ts`.
	 */
	public const STATES = [ 'default', 'group', 'groupActive', 'hover', 'focus', 'active', 'play', 'on', 'groupOn', 'reduced' ];

	/**
	 * The breakpoints a value may be set for. Mirrors `BP_KEY` in the same file.
	 *
	 * `base` is not "desktop" — it is the unqualified value every breakpoint inherits until one
	 * overrides it.
	 */
	public const BREAKPOINTS = [ 'base', 'tablet', 'mobile' ];

	/** The four keys a `sides` value takes. */
	public const SIDES = [ 'top', 'right', 'bottom', 'left' ];

	/** The four keys a `corners` value takes. */
	public const CORNERS = [ 'topLeft', 'topRight', 'bottomRight', 'bottomLeft' ];

	/**
	 * Every control the engine can emit, keyed by control id.
	 *
	 * Not cached. `ElementStyle::registerRule()` lets a plugin add controls at runtime, so a
	 * catalogue built once would silently omit them — including a companion plugin's.
	 *
	 * @return array<string, array{id: string, valueShape: string, category: string|null, scoped: bool}>
	 */
	public static function all(): array {
		$byId = [];

		foreach ( ElementStyle::controls() as $control ) {
			if ( '' === $control['id'] ) {
				continue;
			}

			// Last write wins, matching `build()`: it walks the same table in order and a later
			// rule for an id is the one whose emission survives.
			$byId[ $control['id'] ] = $control;
		}

		return $byId;
	}

	/**
	 * Every control id the engine can emit.
	 *
	 * @return list<string>
	 */
	public static function ids(): array {
		return array_keys( self::all() );
	}

	public static function has( string $id ): bool {
		return isset( self::all()[ $id ] );
	}

	/**
	 * One control, or null if the engine has no rule for it.
	 *
	 * @return array{id: string, valueShape: string, category: string|null, scoped: bool}|null
	 */
	public static function get( string $id ): ?array {
		return self::all()[ $id ] ?? null;
	}

	/**
	 * Expand a block's `supports.blicks.controls` into the concrete ids it permits.
	 *
	 * The allow-list holds exact ids and one-level globs (`spacing.*`). Matching is the free
	 * plugin's `ElementStyle::allowsControl()` and is deliberately not reimplemented here: it is
	 * the rule the inspector enforces, it has a JavaScript twin, and the three-way agreement is
	 * pinned by `tests/fixtures/control-glob-cases.json`. A private copy here would be the
	 * drift that fixture exists to prevent.
	 *
	 * Entries matching no known control are dropped rather than returned: a block declaring a glob
	 * for a category the engine has no rules in should yield nothing, not an id that cannot be
	 * emitted.
	 *
	 * @param list<string> $allowList
	 * @return list<string>
	 */
	public static function expand( array $allowList ): array {
		$ids = [];

		foreach ( self::ids() as $id ) {
			if ( ElementStyle::allowsControl( $id, $allowList ) ) {
				$ids[] = $id;
			}
		}

		return $ids;
	}
}
