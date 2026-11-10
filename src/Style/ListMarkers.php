<?php
/**
 * Icon markers for the List block.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

use Blicks\Ai\Spec\Icons;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A List with icon markers saves only a class naming the icon (`bl-li-ic-check`), on the list or on
 * an item with its own icon. The icon itself is one rule per icon used on the page, setting the
 * `--bl-li-icon` mask the stylesheet draws each marker with. Kept out of the saved markup so a
 * post never carries the same SVG once per item, and a list reads as a plain list without CSS.
 *
 * Names resolve exactly as `iconClass()` does in `resources/blocks/list/model.ts`: aliases first,
 * then the registry's own fallback, so the class saved in the editor always has a rule here.
 */
final class ListMarkers {

	/** The icon a List or List item draws for `$name`, as its class names it; '' for none. */
	public static function iconName( mixed $name ): string {
		$key = Icons::resolve( is_string( $name ) ? $name : '' );

		if ( ! Icons::exists( $key ) ) {
			$key = 'star';
		}

		return 1 === preg_match( '/^[a-z0-9-]+$/', $key ) ? $key : '';
	}

	/** The rule that draws one icon marker, or '' when the icon has no art. */
	public static function rule( string $name ): string {
		$body = Icons::body( $name );

		if ( '' === $name || '' === $body ) {
			return '';
		}

		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' . $body . '</svg>';
		$url = 'url("data:image/svg+xml,' . str_replace( "'", '%27', rawurlencode( $svg ) ) . '")';

		return '.bl-li-ic-' . $name . '{--bl-li-icon:' . $url . '}';
	}

	/** The icon a rendered block asks for: an icon list's own, or an item's. '' for anything else. */
	public static function iconFor( array $block ): string {
		$name  = $block['blockName'] ?? '';
		$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];

		if ( 'blicks/list' === $name ) {
			if ( ! empty( $attrs['nested'] ) || 'icons' !== ( $attrs['kind'] ?? 'bullets' ) ) {
				return '';
			}

			$icon = $attrs['icon'] ?? '';

			return self::iconName( is_string( $icon ) && '' !== $icon ? $icon : 'check' );
		}

		// Steps draw their icon markers from the same rules.
		if ( 'blicks/steps' === $name ) {
			if ( 'icons' !== ( $attrs['marker'] ?? 'numbers' ) ) {
				return '';
			}

			$icon = $attrs['icon'] ?? '';

			return self::iconName( is_string( $icon ) && '' !== $icon ? $icon : 'check' );
		}

		if ( 'blicks/list-item' === $name || 'blicks/step' === $name ) {
			$icon = $attrs['icon'] ?? '';

			return is_string( $icon ) && '' !== $icon ? self::iconName( $icon ) : '';
		}

		return '';
	}

	/** Queue the marker rule a rendered block needs, once per icon per page. */
	public static function collect( array $block ): void {
		$icon = self::iconFor( $block );

		if ( '' !== $icon ) {
			ScopedCss::add( self::rule( $icon ) );
		}
	}
}
