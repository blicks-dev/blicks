/**
 * The List's attributes, cleaned for rendering. Kept apart from the panels so tests need no editor.
 *
 * Everything the List draws is a class or a custom property on the outer list; the items read
 * them through `style.scss`. An inner list (one nested in an item) saves neither: it inherits
 * the outer list's look, so a list reads the same at every level and one setting changes all.
 */

import { getIconName } from '@/framework/icons';

export type ListKind = 'bullets' | 'numbers' | 'icons' | 'plain';

export const KINDS: ListKind[] = [ 'bullets', 'numbers', 'icons', 'plain' ];
export const BULLETS = [ 'dot', 'ring', 'square', 'dash', 'chevron' ] as const;
/** `1.1` is outline numbering: inner lists count on from their item (2.1, 2.2). */
export const NUMBERS = [ '1', '01', 'a', 'i', '1.1' ] as const;
export const ARRANGES = [ 'stack', 'row', 'cols' ] as const;
export const SEPARATORS = [ '', 'dot', 'slash', 'pipe', 'arrow' ] as const;
export const GAPS = [ 'tight', '', 'roomy', 'spacious' ] as const;
export const BEHINDS = [ '', 'tint', 'circle', 'solid' ] as const;
export const LOOKS = [ '', 'cards', 'stripes' ] as const;
export const STATES = [ '', 'hi', 'out', 'done' ] as const;

const pick = < T extends string >( list: readonly T[], value: unknown, fallback: T ): T => {
	const v = String( value ?? '' );
	return ( list as readonly string[] ).includes( v ) ? ( v as T ) : fallback;
};

export const cleanKind = ( v: unknown ): ListKind => pick( KINDS, v, 'bullets' );
export const cleanBullet = ( v: unknown ) => pick( BULLETS, v, 'dot' );
export const cleanNumber = ( v: unknown ) => pick( NUMBERS, v, '1' );
export const cleanArrange = ( v: unknown ) => pick( ARRANGES, v, 'stack' );
export const cleanSeparator = ( v: unknown ) => pick( SEPARATORS, v, '' );
export const cleanGap = ( v: unknown ) => pick( GAPS, v, '' );
export const cleanBehind = ( v: unknown ) => pick( BEHINDS, v, '' );
export const cleanLook = ( v: unknown ) => pick( LOOKS, v, '' );
export const cleanState = ( v: unknown ) => pick( STATES, v, '' );
export const cleanColumns = ( v: unknown ): number => Math.min( 4, Math.max( 2, Math.round( Number( v ) || 2 ) ) );

/** The tag the List saves: numbered lists are `<ol>`, the rest `<ul>`. */
export const listTag = ( attributes: any ): 'ol' | 'ul' => ( cleanKind( attributes.kind ) === 'numbers' ? 'ol' : 'ul' );

/** An icon marker's class. One rule per icon used on the page draws it (see `markerIconCss`). */
export function iconClass( name: unknown ): string {
	const resolved = getIconName( name );
	return /^[a-z0-9-]+$/.test( resolved ) ? `bl-li-ic-${ resolved }` : '';
}

/** A theme colour slug as CSS, or a literal colour as written; '' when there is none. */
export function colourValue( value: unknown ): string {
	const v = String( value ?? '' ).trim();
	if ( ! v ) return '';
	if ( /^[a-z][a-z0-9-]*$/.test( v ) ) return `var(--blicks-color-${ v })`;
	return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\))$/i.test( v ) ? v : '';
}

/** The outer list's classes. An inner list gets none of these: it inherits them. */
export function listClasses( attributes: any ): string[] {
	if ( attributes.nested ) return [];
	const kind = cleanKind( attributes.kind );
	const arrange = cleanArrange( attributes.arrange );
	const sep = arrange === 'row' ? cleanSeparator( attributes.separator ) : '';
	const gap = cleanGap( attributes.gap );
	const behind = kind === 'icons' || kind === 'numbers' ? cleanBehind( attributes.markerBehind ) : '';
	const look = cleanLook( attributes.look );
	return [
		`bl-list--${ kind }`,
		kind === 'bullets' ? `bl-list--m-${ cleanBullet( attributes.bullet ) }` : '',
		kind === 'numbers' ? `bl-list--n-${ cleanNumber( attributes.numbering ).replace( '.', '-' ) }` : '',
		kind === 'icons' ? iconClass( attributes.icon || 'check' ) : '',
		behind ? `bl-list--b-${ behind }` : '',
		arrange === 'row' ? 'bl-list--row' : '',
		arrange === 'cols' ? `bl-list--cols-${ cleanColumns( attributes.columns ) }` : '',
		sep ? `bl-list--sep-${ sep }` : '',
		gap ? `bl-list--gap-${ gap }` : '',
		attributes.lines && arrange !== 'row' ? 'bl-list--lines' : '',
		look ? `bl-list--${ look }` : '',
		attributes.content === 'titled' ? 'bl-list--titled' : '',
		attributes.strikeDone ? 'bl-list--strike-done' : '',
		colourValue( attributes.innerMarkerColour ) ? 'bl-list--inner-mc' : '',
		attributes.innerMono && kind === 'numbers' ? 'bl-list--inner-mono' : '',
	].filter( Boolean );
}

/** The outer list's custom properties — only the ones that differ from the stylesheet's own. */
export function listVars( attributes: any ): Record< string, string > {
	if ( attributes.nested ) return {};
	const vars: Record< string, string > = {};
	const mc = colourValue( attributes.markerColour );
	if ( mc ) vars[ '--bl-li-mc' ] = mc;
	const inner = colourValue( attributes.innerMarkerColour );
	if ( inner ) vars[ '--bl-li-mc2' ] = inner;
	const size = Number( attributes.markerSize );
	if ( size && size !== 100 ) vars[ '--bl-li-ms' ] = String( Math.min( 2, Math.max( 0.5, size / 100 ) ) );
	const space = Number( attributes.markerSpace );
	if ( Number.isFinite( space ) && attributes.markerSpace !== undefined && attributes.markerSpace !== '' && space !== 10 ) {
		vars[ '--bl-li-mg' ] = `${ Math.min( 48, Math.max( 0, space ) ) }px`;
	}
	if ( cleanLook( attributes.look ) === 'cards' ) {
		const fill = colourValue( attributes.cardFill );
		if ( fill ) vars[ '--bl-li-card' ] = fill;
		// A white card on a white page needs an edge to read as a card.
		if ( attributes.cardFill === 'background' ) vars[ '--bl-li-cb' ] = '1px solid var(--blicks-color-border)';
		const r = { none: '0', md: '10px', lg: '16px', '': '' }[ String( attributes.cardCorners ?? '' ) as 'none' | 'md' | 'lg' | '' ];
		if ( r ) vars[ '--bl-li-cr' ] = r;
	}
	return vars;
}

/** A List item's own classes: its state, and its own icon when it has one. */
export function itemClasses( attributes: any ): string[] {
	const state = cleanState( attributes.state );
	return [
		state ? `bl-list-item--${ state }` : '',
		attributes.icon ? iconClass( attributes.icon ) : '',
	].filter( Boolean );
}

export function itemVars( attributes: any ): Record< string, string > {
	const mc = colourValue( attributes.markerColour );
	return mc ? { '--bl-li-mc': mc } : {};
}

/** An icon's inner SVG as a mask image, for `--bl-li-icon`. The colour comes from the mask's fill. */
export function iconMaskUrl( svg: string ): string {
	const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ svg }</svg>`;
	return `url("data:image/svg+xml,${ encodeURIComponent( doc ).replace( /'/g, '%27' ) }")`;
}
