/**
 * Fluid type helper — builds a `clamp()` that scales a font-size with the viewport between a min and
 * max, over a fixed 24rem–80rem (384px–1280px) viewport band. Standard fluid-type formula:
 *   clamp(min, calc(intercept + slope·100vw), max)
 * The Size field already accepts any CSS, so this just authors the clamp for the user.
 */
const VW_MIN = 24; // rem (384px)
const VW_MAX = 80; // rem (1280px)

const round = ( n: number ): number => Math.round( n * 1000 ) / 1000;

/** Parse a CSS size to rem (px → /16, rem → as-is, bare number → treated as px). */
export function toRem( value: string ): number | null {
	const s = String( value ?? '' ).trim();
	if ( s === '' ) {
		return null;
	}
	const n = Number.parseFloat( s );
	if ( ! Number.isFinite( n ) ) {
		return null;
	}
	if ( s.endsWith( 'rem' ) ) {
		return n;
	}
	if ( s.endsWith( 'px' ) ) {
		return n / 16;
	}
	if ( /^[\d.]+$/.test( s ) ) {
		return n / 16; // bare number = px
	}
	return null; // unsupported unit (em/%/vw/…) — can't make a fluid clamp from it
}

/** rem back to an author-friendly string: whole pixels when it lands on one, rem otherwise. */
export function fromRem( rem: number ): string {
	const px = rem * 16;
	return Math.abs( px - Math.round( px ) ) < 0.001 ? `${ Math.round( px ) }px` : `${ round( rem ) }rem`;
}

/**
 * The inverse of `buildFluidClamp` — recover the min/max a fluid size was authored from, so the
 * Size field can show two inputs again instead of an opaque `clamp()` string. Deliberately strict:
 * it only matches the shape this module emits, so a hand-written `clamp()` (or any other CSS) stays
 * a plain value and is left alone.
 */
export function parseFluidClamp( css: string ): { min: string; max: string } | null {
	const match = String( css ?? '' ).trim().match(
		/^clamp\(\s*(-?[\d.]+)rem\s*,\s*calc\(\s*-?[\d.]+rem\s*\+\s*-?[\d.]+vw\s*\)\s*,\s*(-?[\d.]+)rem\s*\)$/
	);
	if ( ! match ) {
		return null;
	}
	const lo = Number.parseFloat( match[ 1 ] );
	const hi = Number.parseFloat( match[ 2 ] );
	if ( ! Number.isFinite( lo ) || ! Number.isFinite( hi ) ) {
		return null;
	}
	return { min: fromRem( lo ), max: fromRem( hi ) };
}

/** Build a fluid `clamp()` between two sizes, or null if either can't be parsed / they're equal. */
export function buildFluidClamp( minCss: string, maxCss: string ): string | null {
	const a = toRem( minCss );
	const b = toRem( maxCss );
	if ( a === null || b === null || a === b ) {
		return null;
	}
	const lo = Math.min( a, b );
	const hi = Math.max( a, b );
	const slope = ( hi - lo ) / ( VW_MAX - VW_MIN );
	const intercept = lo - slope * VW_MIN;
	const preferred = `calc(${ round( intercept ) }rem + ${ round( slope * 100 ) }vw)`;
	return `clamp(${ round( lo ) }rem, ${ preferred }, ${ round( hi ) }rem)`;
}
