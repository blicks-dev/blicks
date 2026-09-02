/**
 * Colour value maths — the conversions between what we store and what a colour picker speaks.
 *
 * Pure and dependency-free so it can be tested directly: the picker components are `.tsx`, which
 * the test runner cannot import, so anything worth asserting has to live here (same reason
 * `gradient-css.ts` exists).
 *
 * We store the shortest honest form — `#rrggbb` when opaque, `rgba(…)` when not — because a stored
 * value is also a value an author reads and edits by hand. `<ColorPicker>` speaks 8-digit hex, so
 * the two forms are converted at the boundary rather than leaking either one into the other.
 */

/** WordPress's own accent, used when there is nothing to open the picker on. */
export const DEFAULT_PICKER_COLOR = '#3858e9';

export function parseHex( hex: string ) {
	let clean = hex.replace( '#', '' );
	if ( clean.length === 3 ) {
		clean = clean[ 0 ] + clean[ 0 ] + clean[ 1 ] + clean[ 1 ] + clean[ 2 ] + clean[ 2 ];
	}
	const num = parseInt( clean, 16 );
	return {
		r: ( num >> 16 ) & 255,
		g: ( num >> 8 ) & 255,
		b: num & 255,
	};
}

export function toRgba( hex: string, alpha: number ) {
	try {
		const { r, g, b } = parseHex( hex );
		return `rgba(${ r }, ${ g }, ${ b }, ${ alpha })`;
	} catch {
		return hex;
	}
}

/**
 * `<ColorPicker>`'s 8-digit hex → the form we store.
 *
 * The alpha byte is dropped when it rounds to fully opaque: `#ff0000ff` is `#ff0000`, and storing
 * the longer form would mean an author who never touched the alpha slider still finds one in their
 * CSS. Anything that is not 8-digit hex passes through untouched — the picker is not the only
 * thing that writes here.
 */
export function hex8ToValue( value: string ) {
	if ( /^#[0-9A-Fa-f]{8}$/.test( value ) ) {
		const hex = value.slice( 0, 7 );
		const alpha = parseInt( value.slice( 7, 9 ), 16 ) / 255;
		return alpha >= 0.995 ? hex : toRgba( hex, Math.round( alpha * 100 ) / 100 );
	}
	return value;
}

/**
 * A stored value → the 8-digit hex `<ColorPicker>` opens on.
 *
 * Only raw CSS colours can be shown on a colour wheel: a palette slug or a `var()` reference has
 * no position on it, so callers pass `''` for those and the picker opens on the default rather
 * than on a misleading swatch. Anything it cannot parse falls back the same way.
 */
export function pickerColorOf( value: string, fallback = DEFAULT_PICKER_COLOR ): string {
	let hex = fallback;
	let alpha = 1;

	if ( value.startsWith( '#' ) ) {
		hex = value.slice( 0, 7 );
	} else if ( value.startsWith( 'rgba' ) ) {
		const match = value.match( /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/ );
		if ( match ) {
			const r = parseInt( match[ 1 ] ).toString( 16 ).padStart( 2, '0' );
			const g = parseInt( match[ 2 ] ).toString( 16 ).padStart( 2, '0' );
			const b = parseInt( match[ 3 ] ).toString( 16 ).padStart( 2, '0' );
			hex = `#${ r }${ g }${ b }`;
			alpha = parseFloat( match[ 4 ] );
		}
	}

	return alpha < 0.995
		? hex + Math.round( alpha * 255 ).toString( 16 ).padStart( 2, '0' )
		: hex;
}
