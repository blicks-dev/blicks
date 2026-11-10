/**
 * The header blocks' options, cleaned, and the classes they save. Every option is a class, never
 * a JSON attribute, so a theme can style it and a new option is one more class, not a migration.
 * A value outside its list falls back to the default, which writes nothing.
 */

export const DRAWER_AT = [ 'tablet', 'mobile', 'always', 'never' ] as const;
export const MOBILE = [ 'drill', 'accordion' ] as const;
export const PRESETS = [ 'classic', 'centred', 'stacked', 'custom' ] as const;
export const SLOTS = [ 'start', 'centre', 'end' ] as const;
export const OPENS_ON = [ 'hover', 'click' ] as const;
export const WIDTHS = [ 'container', 'full', 'content' ] as const;
export const ANIMATIONS = [ 'fade', 'slide', 'none' ] as const;
export const ON_PHONES = [ 'show', 'last', 'hide' ] as const;

export type OnPhones = ( typeof ON_PHONES )[ number ];

export function pick< T extends string >( list: readonly T[], value: unknown ): T {
	return list.includes( value as T ) ? ( value as T ) : list[ 0 ];
}

export function headerClasses( a: Record< string, unknown > ): string[] {
	const at = pick( DRAWER_AT, a.drawerAt );
	return [
		a.sticky ? 'bl-header--sticky' : '',
		a.shrink ? 'bl-header--shrink' : '',
		a.overHero ? 'bl-header--over' : '',
		a.hideOnScroll ? 'bl-header--hide' : '',
		pick( MOBILE, a.mobile ) === 'accordion' ? 'bl-header--accordion' : '',
		at !== 'tablet' ? `bl-header--drawer-${ at }` : '',
	].filter( Boolean );
}

export const rowClasses = ( a: Record< string, unknown > ): string[] => [ `bl-header-row--${ pick( PRESETS, a.preset ) }` ];

export const areaClasses = ( a: Record< string, unknown > ): string[] => [ `bl-header-area--${ pick( SLOTS, a.slot ) }` ];

export function panelClasses( a: Record< string, unknown > ): string[] {
	const width = pick( WIDTHS, a.width );
	const animation = pick( ANIMATIONS, a.animation );
	return [
		pick( OPENS_ON, a.openOn ) === 'click' ? 'bl-mega-panel--on-click' : '',
		width !== 'container' ? `bl-mega-panel--w-${ width }` : '',
		animation !== 'fade' ? `bl-mega-panel--m-${ animation }` : '',
		a.closeOnScroll ? 'bl-mega-panel--scroll-closes' : '',
	].filter( Boolean );
}

/** A menu item's link attributes, in the order they are saved. */
export function itemLink( a: Record< string, unknown > ): Record< string, string > {
	const url = String( a.url ?? '' ).trim();
	return {
		...( url ? { href: url } : {} ),
		...( a.linkTarget ? { target: String( a.linkTarget ) } : {} ),
		...( a.linkTarget === '_blank' ? { rel: 'noopener' } : {} ),
	};
}

/**
 * On phones, from the attributes the free plugin already has: Hide is the block's mobile
 * visibility (`bl-hide-mobile`), Last is a mobile `flexChild.order` past every sibling's.
 */
export const LAST_ORDER = '99';

export function onPhones( a: { visibility?: Record< string, unknown >; blicks?: Record< string, any > } ): OnPhones {
	if ( a.visibility?.mobile ) return 'hide';
	return String( a.blicks?.[ 'flexChild.order' ]?.default?.mobile ?? '' ) === LAST_ORDER ? 'last' : 'show';
}
