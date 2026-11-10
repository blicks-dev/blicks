/**
 * The Image's settings model: the attributes the v2 inspector writes beyond the media itself, and
 * how each one reaches the saved markup. Every default writes nothing, so an image saved before
 * these existed keeps exactly the markup it has.
 */

export const ASPECTS = [ 'auto', '1/1', '4/3', '16/9', '3/4' ];
export const FITS = [ 'cover', 'contain', 'fill' ];
/** The 3×3 "Keep in view" pad, as object-position values. */
export const FOCUS_POINTS = [ '20% 20%', '50% 20%', '80% 20%', '20% 50%', '50% 50%', '80% 50%', '20% 80%', '50% 80%', '80% 80%' ];

export type WidthStep = 'sm' | 'md' | 'lg';
export const WIDTH_PX: Record< WidthStep, string > = { sm: '240px', md: '400px', lg: '560px' };
export type Side = 'start' | 'center' | 'end';
export type Dim = '' | 'light' | 'medium' | 'strong';
export const DIM_PCT: Record< Exclude< Dim, '' >, number > = { light: 20, medium: 40, strong: 60 };
export type Hover = '' | 'zoom' | 'lift' | 'brighten' | 'colour';
export interface Adjust {
	/** Brightness, contrast and saturation in %, 100 = unchanged. */
	b?: number;
	c?: number;
	s?: number;
	/** Blur in px. */
	blur?: number;
}

export function cleanAspectRatio( value: unknown ): string {
	const ratio = String( value || 'auto' ).trim();
	return ASPECTS.includes( ratio ) || /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test( ratio ) ? ratio : 'auto';
}

/** A typed shape — "21/9", "21:9", "21 / 9" — or null. A zero side is not a shape. */
export function parseRatio( input: string ): string | null {
	const s = input.replace( /\s+/g, '' ).replace( ':', '/' );
	if ( ! /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test( s ) ) return null;
	const [ w, h ] = s.split( '/' ).map( Number );
	return w > 0 && h > 0 ? s : null;
}

export function cleanObjectFit( value: unknown ): string {
	const fit = String( value || 'cover' );
	return FITS.includes( fit ) ? fit : 'cover';
}

export const cleanFocus = ( value: unknown ): string => ( FOCUS_POINTS.includes( String( value ) ) ? String( value ) : '' );
const SIDES: Side[] = [ 'start', 'center', 'end' ];
export const cleanSide = ( value: unknown ): Side | '' => ( SIDES.includes( value as Side ) ? ( value as Side ) : '' );
export const cleanDim = ( value: unknown ): Dim => ( value === 'light' || value === 'medium' || value === 'strong' ? value : '' );
export const cleanHover = ( value: unknown ): Hover => ( [ 'zoom', 'lift', 'brighten', 'colour' ].includes( String( value ) ) ? ( value as Hover ) : '' );

/** The width as CSS: a step, or one typed length; '' is the full column. */
export function widthCss( value: unknown ): string {
	const v = String( value || '' ).trim();
	if ( v in WIDTH_PX ) return WIDTH_PX[ v as WidthStep ];
	return /^\d*\.?\d+(px|rem|em|%|vw|ch)$/.test( v ) ? v : '';
}

const clamp = ( n: unknown, lo: number, hi: number, def: number ) => {
	const v = Number( n );
	return Number.isFinite( v ) ? Math.min( hi, Math.max( lo, v ) ) : def;
};

/** Adjustments with every field in range; unchanged fields are dropped, so "nothing" is null. */
export function cleanAdjust( value: unknown ): Adjust | null {
	if ( ! value || typeof value !== 'object' ) return null;
	const a = value as Adjust;
	const out: Adjust = {};
	const b = clamp( a.b, 50, 150, 100 );
	const c = clamp( a.c, 50, 150, 100 );
	const s = clamp( a.s, 0, 200, 100 );
	const blur = clamp( a.blur, 0, 12, 0 );
	if ( b !== 100 ) out.b = b;
	if ( c !== 100 ) out.c = c;
	if ( s !== 100 ) out.s = s;
	if ( blur ) out.blur = blur;
	return Object.keys( out ).length ? out : null;
}

/** The img's `filter`: the duotone first (it flattens colour), then the adjustments. */
export function filterCss( duotoneId: string | null, adjust: Adjust | null ): string | undefined {
	const f: string[] = [];
	if ( duotoneId ) f.push( `url(#${ duotoneId })` );
	if ( adjust?.b ) f.push( `brightness(${ adjust.b / 100 })` );
	if ( adjust?.c ) f.push( `contrast(${ adjust.c / 100 })` );
	if ( adjust?.s !== undefined ) f.push( `saturate(${ adjust.s / 100 })` );
	if ( adjust?.blur ) f.push( `blur(${ adjust.blur }px)` );
	return f.length ? f.join( ' ' ) : undefined;
}

/** The figure's own classes and inline style for what Settings and Style set. */
export function figureLook( attributes: any ): { classes: string[]; style: Record< string, string > } {
	const classes: string[] = [];
	const style: Record< string, string > = {};
	const width = widthCss( attributes.width );
	if ( width ) {
		style[ '--bl-img-w' ] = width;
		classes.push( `bl-image--w` );
		const align = cleanSide( attributes.lineUp );
		if ( align && align !== 'center' ) classes.push( `bl-image--${ align }` );
		if ( attributes.phoneFull === false ) classes.push( 'bl-image--keep-phone' );
	}
	if ( attributes.capPos === 'over' && attributes.caption ) classes.push( 'bl-image--cap-over' );
	const capAlign = cleanSide( attributes.capAlign );
	if ( capAlign ) classes.push( `bl-image--cap-${ capAlign }` );
	const dim = cleanDim( attributes.dim );
	if ( dim ) {
		classes.push( 'bl-image--dim' );
		style[ '--bl-img-dim' ] = `${ DIM_PCT[ dim ] }%`;
	}
	const hover = cleanHover( attributes.hover );
	if ( hover ) classes.push( `bl-image--hover-${ hover }` );
	return { classes, style };
}

/** A frame around the img is only drawn when something sits over it: the shade, or the caption. */
export const needsFrame = ( attributes: any ): boolean =>
	!! cleanDim( attributes.dim ) || ( attributes.capPos === 'over' && !! attributes.caption ) || !! cleanHover( attributes.hover );
