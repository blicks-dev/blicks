/**
 * Decorations: the block's `::before` and `::after`, as people think of them — a shape behind the
 * content and one in front. Read from and written to the part slots of the style tree, so a
 * decoration an agent wrote through the MCP opens here too (best effort: what this model has no
 * control for is kept, never cleared).
 */
import type { Tree } from './style-model';

export type DecoPart = 'before' | 'after';
/** Covers the block, a shape of its own size at one of nine spots, or a line along an edge. */
export type Place = 'fill' | 'spot' | 'line';
export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export type Shape = 'match' | 'square' | 'rounded' | 'round';
/** One of the built-ins offered as chips, or any other animation name the design system holds. */
export type Motion = '' | 'bl-ping' | 'bl-spin' | 'bl-float' | 'bl-pan' | ( string & {} );
export type DecoHover = 'stays' | 'grow' | 'bright' | 'appear' | 'draw';

export interface Decoration {
	place: Place;
	anchor: Anchor;
	/** px: the shape's width and height (spot) or thickness (line). */
	size: number;
	/** px from the anchored edges; negative reaches outside the block (a glow). */
	offset: number;
	/** A CSS colour or gradient. */
	fill: string;
	shape: Shape;
	/** px. */
	blur: number;
	/** Percent. */
	opacity: number;
	motion: Motion;
	hover: DecoHover;
}

export const ANCHORS: Anchor[] = [ 'tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br' ];

const BLANK: Decoration = { place: 'fill', anchor: 'mc', size: 12, offset: 0, fill: '#34e08a', shape: 'match', blur: 0, opacity: 100, motion: '', hover: 'stays' };

/** Starting points, taken from the marketplace buttons that needed them. */
export const PRESETS: Record< 'glow' | 'ring' | 'dot' | 'shine' | 'underline' | 'blank', { part: DecoPart; deco: Decoration } > = {
	glow: { part: 'before', deco: { ...BLANK, offset: -6, fill: 'conic-gradient(from 0deg, #00e5ff, #6b5bff, #ff3d9a, #ffb23d, #00e5ff)', blur: 18, opacity: 60 } },
	ring: { part: 'before', deco: { ...BLANK, offset: -2, fill: 'linear-gradient(135deg, #6b5bff, #ff3d9a)' } },
	dot: { part: 'before', deco: { ...BLANK, place: 'spot', anchor: 'ml', size: 10, offset: 16, shape: 'round' } },
	shine: { part: 'after', deco: { ...BLANK, fill: 'linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 45%) 50%, transparent 70%)', hover: 'appear' } },
	underline: { part: 'after', deco: { ...BLANK, place: 'line', anchor: 'bc', size: 2, offset: -4, fill: 'currentColor', shape: 'square', hover: 'draw' } },
	blank: { part: 'before', deco: BLANK },
};

/** The library's own timing for each motion, so a decoration moves as the animation was designed. */
const MOTION_TIMING: Record< string, { duration: string; easing: string } > = {
	'bl-ping': { duration: '1.5s', easing: 'cubic-bezier(0, 0, 0.2, 1)' },
	'bl-spin': { duration: '8s', easing: 'linear' },
	'bl-float': { duration: '6s', easing: 'ease-in-out' },
	'bl-pan': { duration: '12s', easing: 'linear' },
};

const RADIUS: Record< Shape, string > = { match: 'inherit', square: '0', rounded: '8px', round: '9999px' };

/** Controls a decoration writes on its part. Anything else on the part is the author's and stays. */
const OWNED = [
	'decoration.content', 'position.type', 'position.zIndex', 'position.inset', 'layout.width', 'layout.height',
	'colors.background', 'background.gradient', 'border.radius', 'effects.filter', 'effects.opacity',
	'effects.transform', 'effects.transformOrigin', 'animation.name', 'animation.duration', 'animation.easing', 'animation.iteration',
];

const px = ( n: number ) => `${ n }px`;
const isGradient = ( v: string ) => /gradient\(/i.test( v );
const base = ( tree: Tree, id: string, slot: string ): any => tree?.[ id ]?.[ slot ]?.base;
const num = ( v: unknown, fallback: number ): number => {
	const n = parseFloat( String( v ?? '' ) );
	return Number.isFinite( n ) ? n : fallback;
};

/** Is anything drawn on this part? */
export function hasDecoration( tree: Tree, part: DecoPart ): boolean {
	return Object.values( tree ?? {} ).some( ( slots ) => slots && typeof slots === 'object' && Object.keys( slots ).some( ( s ) => s === part || s.startsWith( `${ part }:` ) ) );
}

function inset( d: Decoration ): Record< string, string > {
	if ( d.place === 'fill' ) return { top: px( d.offset ), right: px( d.offset ), bottom: px( d.offset ), left: px( d.offset ) };
	const [ row, col ] = [ d.anchor[ 0 ], d.anchor[ 1 ] ];
	const half = `calc(50% - ${ px( d.size / 2 ) })`;
	if ( d.place === 'line' ) {
		const y: Record< string, string > = row === 't' ? { top: px( d.offset ) } : row === 'b' ? { bottom: px( d.offset ) } : { top: half };
		return { left: '0', right: '0', ...y };
	}
	const out: Record< string, string > = {
		...( row === 't' ? { top: px( d.offset ) } : row === 'b' ? { bottom: px( d.offset ) } : { top: half } ),
		...( col === 'l' ? { left: px( d.offset ) } : col === 'r' ? { right: px( d.offset ) } : { left: half } ),
	};
	return out;
}

/** The tree with this part's decoration replaced (or removed, with `null`). */
export function writeDecoration( tree: Tree, part: DecoPart, d: Decoration | null ): Tree {
	const next: Tree = {};
	// An animation this panel has no chip for (a design-system one, or an agent's) is kept as it is:
	// name, timing and all. Only picking a chip, or None, replaces it.
	const keepAnimation = !! d?.motion && ! MOTION_TIMING[ d.motion ];
	// Drop this part's owned slots, in every state; keep everything else as it was.
	for ( const [ id, slots ] of Object.entries( tree ?? {} ) ) {
		if ( ! slots || typeof slots !== 'object' || ! OWNED.includes( id ) || ( keepAnimation && id.startsWith( 'animation.' ) ) ) {
			next[ id ] = slots;
			continue;
		}
		const kept = Object.fromEntries( Object.entries( slots ).filter( ( [ s ] ) => s !== part && ! s.startsWith( `${ part }:` ) ) );
		if ( Object.keys( kept ).length ) next[ id ] = kept;
	}
	if ( ! d ) return next;

	const put = ( id: string, value: unknown, slot: string = part ) => {
		next[ id ] = { ...( next[ id ] ?? {} ), [ slot ]: { base: value } };
	};
	put( 'decoration.content', '""' );
	put( 'position.type', 'absolute' );
	put( 'position.zIndex', part === 'before' ? '-1' : '1' );
	put( 'position.inset', inset( d ) );
	if ( d.place === 'spot' ) {
		put( 'layout.width', px( d.size ) );
		put( 'layout.height', px( d.size ) );
	}
	if ( d.place === 'line' ) put( 'layout.height', px( d.size ) );
	put( isGradient( d.fill ) ? 'background.gradient' : 'colors.background', d.fill );
	put( 'border.radius', RADIUS[ d.shape ] );
	if ( d.blur > 0 ) put( 'effects.filter', `blur(${ px( d.blur ) })` );
	const shown = d.opacity < 100 ? String( d.opacity / 100 ) : '';
	if ( d.hover === 'appear' ) put( 'effects.opacity', '0' );
	else if ( shown ) put( 'effects.opacity', shown );
	if ( d.motion && ! keepAnimation ) {
		put( 'animation.name', d.motion );
		put( 'animation.duration', MOTION_TIMING[ d.motion ].duration );
		put( 'animation.easing', MOTION_TIMING[ d.motion ].easing );
		put( 'animation.iteration', 'infinite' );
	}

	const hover = `${ part }:hover`;
	if ( d.hover === 'grow' ) put( 'effects.transform', 'scale(1.15)', hover );
	if ( d.hover === 'bright' ) put( 'effects.filter', [ d.blur > 0 ? `blur(${ px( d.blur ) })` : '', 'brightness(1.35)' ].filter( Boolean ).join( ' ' ), hover );
	if ( d.hover === 'appear' ) put( 'effects.opacity', shown || '1', hover );
	if ( d.hover === 'draw' ) {
		put( 'effects.transform', 'scaleX(0)' );
		put( 'effects.transformOrigin', 'left center' );
		put( 'effects.transform', 'scaleX(1)', hover );
	}

	// The block holds what it decorates: positioned, and its own stacking context so a shape
	// behind the content stays in front of whatever is behind the block.
	if ( ! base( next, 'position.type', 'default' ) ) next[ 'position.type' ] = { ...( next[ 'position.type' ] ?? {} ), default: { base: 'relative' } };
	if ( part === 'before' && ! base( next, 'layout.isolation', 'default' ) ) next[ 'layout.isolation' ] = { ...( next[ 'layout.isolation' ] ?? {} ), default: { base: 'isolate' } };
	return next;
}

function placeOf( inset: Record< string, string > | undefined, width: unknown, height: unknown ): Pick< Decoration, 'place' | 'anchor' | 'offset' > {
	const side = ( k: string ) => inset?.[ k ];
	const set = ( k: string ) => side( k ) !== undefined && side( k ) !== 'auto';
	if ( width === undefined && height === undefined ) return { place: 'fill', anchor: 'mc', offset: num( side( 'top' ), 0 ) };
	const row = set( 'top' ) && ! String( side( 'top' ) ).startsWith( 'calc' ) ? 't' : set( 'bottom' ) ? 'b' : 'm';
	if ( width === undefined ) return { place: 'line', anchor: `${ row }c` as Anchor, offset: num( row === 'b' ? side( 'bottom' ) : side( 'top' ), 0 ) };
	const col = set( 'left' ) && ! String( side( 'left' ) ).startsWith( 'calc' ) ? 'l' : set( 'right' ) ? 'r' : 'c';
	const edge = row === 't' ? side( 'top' ) : row === 'b' ? side( 'bottom' ) : col === 'l' ? side( 'left' ) : side( 'right' );
	return { place: 'spot', anchor: `${ row }${ col }` as Anchor, offset: num( edge, 0 ) };
}

/** This part's decoration, or null when nothing is drawn there. */
export function readDecoration( tree: Tree, part: DecoPart ): Decoration | null {
	if ( ! hasDecoration( tree, part ) ) return null;
	const at = ( id: string, slot: string = part ) => base( tree, id, slot );
	const hover = `${ part }:hover`;
	const where = placeOf( at( 'position.inset' ), at( 'layout.width' ), at( 'layout.height' ) );
	const radius = String( at( 'border.radius' ) ?? 'inherit' );
	const shape = radius === '50%' ? 'round' : ( Object.entries( RADIUS ).find( ( [ , v ] ) => v === radius )?.[ 0 ] as Shape ) ?? 'match';
	const filter = String( at( 'effects.filter' ) ?? '' );
	const motion = String( at( 'animation.name' ) ?? '' );
	const hoverOpacity = at( 'effects.opacity', hover );
	const appear = String( at( 'effects.opacity' ) ) === '0' && hoverOpacity !== undefined;
	const hoverOf = (): DecoHover => {
		const t = String( at( 'effects.transform', hover ) ?? '' );
		if ( t.startsWith( 'scaleX(1' ) ) return 'draw';
		if ( t.startsWith( 'scale(' ) ) return 'grow';
		if ( String( at( 'effects.filter', hover ) ?? '' ).includes( 'brightness' ) ) return 'bright';
		return appear ? 'appear' : 'stays';
	};
	return {
		...where,
		size: num( where.place === 'line' ? at( 'layout.height' ) : at( 'layout.width' ), 12 ),
		fill: String( at( 'background.gradient' ) ?? at( 'colors.background' ) ?? '' ),
		shape,
		blur: num( /blur\(([^)]+)\)/.exec( filter )?.[ 1 ], 0 ),
		opacity: Math.round( num( appear ? hoverOpacity : at( 'effects.opacity' ), 1 ) * 100 ),
		motion: motion === 'none' ? '' : motion,
		hover: hoverOf(),
	};
}
