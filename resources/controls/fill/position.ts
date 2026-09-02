/**
 * Background-position maths, split out of `PositionPad` so it can be reused — and unit-tested —
 * without pulling the React/WordPress editor bundle in behind it. Same reason `gradient-css.ts`
 * sits beside its editor rather than inside it.
 */
/** Keyword ⇄ percentage, per axis. `background-position` accepts either, so we speak both. */
const X_WORDS: Record< string, number > = { left: 0, center: 50, right: 100 };
const Y_WORDS: Record< string, number > = { top: 0, center: 50, bottom: 100 };
const X_FROM: Record< number, string > = { 0: 'left', 50: 'center', 100: 'right' };
const Y_FROM: Record< number, string > = { 0: 'top', 50: 'center', 100: 'bottom' };

function axis( token: string, words: Record< string, number > ): number | null {
	if ( ! token ) return null;
	if ( token in words ) return words[ token ];
	const parsed = parseFloat( token );
	return Number.isFinite( parsed ) ? Math.min( 100, Math.max( 0, parsed ) ) : null;
}

/**
 * Read a stored `background-position` into a point. Handles the keyword pairs the old nine-cell
 * grid wrote (`left top`), percentage pairs, and a single value (CSS reads the missing axis as
 * `center`).
 */
export function parsePosition( value: string ): { x: number; y: number } {
	const parts = String( value || '' ).trim().toLowerCase().split( /\s+/ ).filter( Boolean );
	if ( parts.length === 0 ) return { x: 50, y: 50 };
	// A lone `top`/`bottom` names the Y axis, not the X — `background-position: top` is centred
	// horizontally, and reading it as an X value would silently move the image sideways.
	if ( parts.length === 1 ) {
		if ( parts[ 0 ] in Y_WORDS && ! ( parts[ 0 ] in X_WORDS ) ) return { x: 50, y: Y_WORDS[ parts[ 0 ] ] };
		return { x: axis( parts[ 0 ], X_WORDS ) ?? 50, y: 50 };
	}
	return { x: axis( parts[ 0 ], X_WORDS ) ?? 50, y: axis( parts[ 1 ], Y_WORDS ) ?? 50 };
}

/**
 * Write a point back out, preferring the keyword form when it lands exactly on a third. `left top`
 * is what a person means and what they can read back; `0% 0%` is the same thing said worse.
 */
export function formatPosition( x: number, y: number ): string {
	const xs = X_FROM[ x ] ?? `${ x }%`;
	const ys = Y_FROM[ y ] ?? `${ y }%`;
	return `${ xs } ${ ys }`;
}

/**
 * Within `tolerance` of a third, take the third — a pad you cannot land dead-centre on is a pad
 * that makes the common answer the hardest one.
 *
 * Dragging the image itself wants a tighter pull than dragging the anchor: the image drag IS the
 * fine adjustment, so a wide magnet fights the thing you are doing.
 *
 * Unrounded, because this is what the *live* drag renders from: rounding here would quantise the
 * image to whole percent — about a pixel and a half on a pad this size — and a picture that moves
 * in visible steps reads as a stutter, however fast the frames are arriving.
 */
export function snapTo( value: number, tolerance = 6 ): number {
	for ( const target of [ 0, 50, 100 ] ) {
		if ( Math.abs( value - target ) <= tolerance ) return target;
	}
	return value;
}

/** `snapTo`, rounded — the form that gets stored. Whole percent is what an author wants to read
 *  back and edit; the fractional precision only exists to make the drag itself smooth. */
export function snap( value: number, tolerance = 6 ): number {
	return Math.round( snapTo( value, tolerance ) );
}

export interface Size {
	w: number;
	h: number;
}

/**
 * How big the image actually renders inside the box, given `background-size`.
 *
 * Needed because `background-position` is a *ratio*, not an offset: `50%` means "the point halfway
 * across the image sits at the point halfway across the box". To turn a drag in pixels back into
 * that ratio you have to know how much bigger or smaller than the box the image is.
 */
export function resolveBackgroundSize( box: Size, natural: Size, size: string ): Size {
	const value = ( size || 'auto' ).trim().toLowerCase();
	if ( ! natural.w || ! natural.h ) return { w: 0, h: 0 };

	if ( value === 'cover' || value === 'contain' ) {
		const pick = value === 'cover' ? Math.max : Math.min;
		const scale = pick( box.w / natural.w, box.h / natural.h );
		return { w: natural.w * scale, h: natural.h * scale };
	}

	const parts = value.split( /\s+/ ).filter( Boolean );
	if ( parts.length === 0 || value === 'auto' ) return { ...natural };

	// One value sizes the width; the height follows the aspect ratio, same as CSS.
	const axis = ( token: string, basis: number ): number | null => {
		if ( ! token || token === 'auto' ) return null;
		if ( token.endsWith( '%' ) ) {
			const pct = parseFloat( token );
			return Number.isFinite( pct ) ? ( basis * pct ) / 100 : null;
		}
		const px = parseFloat( token );
		return Number.isFinite( px ) ? px : null;
	};

	const w = axis( parts[ 0 ], box.w );
	const h = axis( parts[ 1 ] ?? 'auto', box.h );
	if ( w === null && h === null ) return { ...natural };
	if ( w === null ) return { w: ( natural.w / natural.h ) * ( h as number ), h: h as number };
	if ( h === null ) return { w, h: ( natural.h / natural.w ) * w };
	return { w, h };
}

/**
 * Where the image's leading edge sits, in pixels, for a given percentage.
 *
 * `(box - image) * pct` is the whole of `background-position`: when the image is smaller than the
 * box the term is positive and the image slides forward as the percentage grows; when it is larger
 * the term is negative and the image slides *backward*, which is why a `cover` image moves the
 * opposite way to a tiled one for the same numbers.
 */
export function offsetFor( boxLength: number, imageLength: number, pct: number ): number {
	return ( ( boxLength - imageLength ) * pct ) / 100;
}

/**
 * The percentage that puts the image where a drag just dropped it, or `null` when this axis cannot
 * move at all.
 *
 * An image exactly as wide as its box has no slack: every percentage from 0 to 100 renders it in
 * precisely the same place, so a drag along that axis is not a small movement, it is no movement,
 * and pretending otherwise would write a value that changes nothing.
 */
export function positionFromDrag(
	boxLength: number,
	imageLength: number,
	pct: number,
	delta: number
): number | null {
	const slack = boxLength - imageLength;
	if ( Math.abs( slack ) < 0.5 ) return null;
	const next = ( ( offsetFor( boxLength, imageLength, pct ) + delta ) / slack ) * 100;
	return Math.min( 100, Math.max( 0, next ) );
}

/** One axis of a `background-position`: a keyword or any CSS length. */
export const POSITION_TOKEN = '(left|center|right|top|bottom|-?\\d+(\\.\\d+)?(px|%|em|rem|vw|vh))';
export const POSITION_PATTERN = new RegExp( `^${ POSITION_TOKEN }( ${ POSITION_TOKEN })?$` );

export const POSITION_OPTIONS = [
	'left top', 'center top', 'right top',
	'left center', 'center center', 'right center',
	'left bottom', 'center bottom', 'right bottom',
].map( ( value ) => ( { value, label: value } ) );
