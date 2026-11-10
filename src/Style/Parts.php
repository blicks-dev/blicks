<?php
/**
 * The part axis — mirror of resources/framework/parts.ts.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Composes and splits value-tree slot keys: `default`, `hover`, `before`, `before:hover`.
 *
 * A part slot styles a pseudo-element through tier-3 scoped CSS; an element slot takes the static
 * tier-1/2 path. See parts.ts for why parts are not simply more states.
 */
final class Parts {

	public const ELEMENT = 'element';

	private const STATES = [ 'default', 'group', 'groupActive', 'hover', 'focus', 'active', 'play', 'on', 'groupOn', 'reduced' ];

	public static function isPart( string $id ): bool {
		return self::ELEMENT === $id || array_key_exists( $id, Schema::PARTS );
	}

	/** The selector suffix a part adds after `.bl-{uniqueId}` — '' for the element itself. */
	public static function partSuffix( string $id ): string {
		return Schema::PARTS[ $id ] ?? '';
	}

	/** From the engine schema, so tier 3 writes the selector runtime.scss does — see states.ts. */
	public static function stateSuffix( string $state ): string {
		return Schema::STATE_PSEUDO[ $state ] ?? '';
	}

	/**
	 * Split a slot key into its part and state. An unrecognised key resolves to the element's base
	 * state, as the emitters treat an unknown state key.
	 *
	 * @return array{part: string, state: string}
	 */
	public static function parseSlot( string $slot ): array {
		$colon = strpos( $slot, ':' );

		if ( false !== $colon ) {
			$part  = substr( $slot, 0, $colon );
			$state = substr( $slot, $colon + 1 );

			return [
				'part'  => self::isPart( $part ) ? $part : self::ELEMENT,
				'state' => in_array( $state, self::STATES, true ) ? $state : 'default',
			];
		}

		if ( in_array( $slot, self::STATES, true ) ) {
			return [
				'part'  => self::ELEMENT,
				'state' => $slot,
			];
		}

		return [
			'part'  => self::isPart( $slot ) ? $slot : self::ELEMENT,
			'state' => 'default',
		];
	}

	public static function isElementSlot( string $slot ): bool {
		return self::ELEMENT === self::parseSlot( $slot )['part'];
	}

	/**
	 * The selector suffix a slot contributes after `.bl-{uniqueId}` — e.g. `:hover::before`. The state
	 * comes first: Chrome drops a rule with a pseudo-class after a pseudo-element.
	 */
	public static function slotSelectorSuffix( string $slot ): string {
		$parsed = self::parseSlot( $slot );

		// An ancestor-selected state cannot be a suffix; it is marked, and selectorFor() expands it.
		if ( isset( Schema::STATE_ANCESTOR[ $parsed['state'] ] ) ) {
			return '@' . $parsed['state'] . self::partSuffix( $parsed['part'] );
		}

		// A media-selected state is no selector at all; it is marked, and the emitter wraps the rule.
		if ( isset( Schema::STATE_MEDIA[ $parsed['state'] ] ) ) {
			return '!' . $parsed['state'] . self::partSuffix( $parsed['part'] );
		}

		return self::stateSuffix( $parsed['state'] ) . self::partSuffix( $parsed['part'] );
	}

	/** The media query a slot suffix plays under (`!reduced::after` → its query), or ''. Mirrors slotMedia() in parts.ts. */
	public static function slotMedia( string $suffix ): string {
		return 1 === preg_match( '/^!([a-zA-Z]+)/', $suffix, $media ) ? ( Schema::STATE_MEDIA[ $media[1] ] ?? '' ) : '';
	}

	/**
	 * The full selector for an element (`.bl-abc123`) and a suffix from slotSelectorSuffix(). An
	 * ancestor state (`@group::before`) becomes the nearest-card form runtime.scss writes. Mirrors
	 * `selectorFor()` in resources/framework/parts.ts.
	 */
	public static function selectorFor( string $base, string $suffix ): string {
		if ( 1 === preg_match( '/^!([a-zA-Z]+)(.*)$/', $suffix, $media ) && isset( Schema::STATE_MEDIA[ $media[1] ] ) ) {
			return $base . $media[2];
		}

		if ( 1 !== preg_match( '/^@([a-zA-Z]+)(.*)$/', $suffix, $m ) || ! isset( Schema::STATE_ANCESTOR[ $m[1] ] ) ) {
			return $base . $suffix;
		}

		$ancestor = Schema::STATE_ANCESTOR[ $m[1] ];

		return ':where(' . $ancestor['on'] . ') ' . $base . $base . ':not(:where(' . $ancestor['off'] . ') *)' . $m[2];
	}

	/** Can this state style that control? Mirrors stateAllows() in parts.ts. */
	public static function stateAllows( string $state, string $controlId ): bool {
		$allowed = Schema::STATE_CONTROLS[ $state ] ?? null;

		return null === $allowed || in_array( $controlId, $allowed, true );
	}

	/**
	 * A control's value tree without the slots its state may not style. Mirrors allowedSlots().
	 *
	 * @param array<string|int, mixed> $tree
	 * @return array<string|int, mixed>
	 */
	public static function allowedSlots( string $controlId, array $tree ): array {
		return array_filter(
			$tree,
			static fn ( $slot ): bool => self::stateAllows( self::parseSlot( (string) $slot )['state'], $controlId ),
			ARRAY_FILTER_USE_KEY
		);
	}
}
