/**
 * Writes each block's `icon` into `resources/blocks/<slug>/block.json`, outlined from the shared
 * glyph source in `resources/framework/icons/block-glyphs.json`.
 *
 * Why outlined: wordpress.org renders a block.json icon that contains `<svg` through `wp_kses`
 * with an allow-list of `svg`/`g`/`title`/`path` and, on a path, only `d`, `fill` and `transform`
 * (see the wporg-plugins-2024 theme, `template-parts/section-blocks.php`). Every stroke attribute,
 * every `fill-rule` and every `<rect>`/`<circle>` is stripped, so each glyph is reduced to two
 * filled paths — one `currentColor`, one accent — and a knockout is drawn against the winding of
 * the shape it cuts, so the default nonzero rule punches it out without a `fill-rule`.
 *
 * The editor renders this same markup (`resources/framework/identity.tsx` reads it back out of the
 * metadata), so wordpress.org, Plugins → Add New → Blocks, the inserter and the Studio all show one
 * drawing, not two that are meant to agree.
 *
 * Run via `pnpm gen:block-icons` (also auto-runs before `pnpm build`/`pnpm dev`).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const SOURCE = resolve( ROOT, 'resources/framework/icons/block-glyphs.json' );

const { strokeWidth, accent: ACCENT, viewBox, glyphs } = JSON.parse( readFileSync( SOURCE, 'utf8' ) );

const MITER_LIMIT = 4;              // SVG's own default; past it a miter becomes a bevel

/** Trim float noise: 10.700000000000001 → 10.7, 12.0 → 12. */
const n = ( v ) => String( Number( v.toFixed( 3 ) ) );

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ];

function unit( v ) {
	const len = Math.hypot( v[ 0 ], v[ 1 ] );
	if ( ! len ) throw new Error( 'zero-length segment in a glyph polyline' );
	return [ v[ 0 ] / len, v[ 1 ] / len ];
}

/** Left-hand normal of a unit direction. */
const normal = ( d ) => [ -d[ 1 ], d[ 0 ] ];

/** Twice the signed area. Positive is clockwise on screen (y grows downward). */
function signedArea( pts ) {
	let sum = 0;
	for ( let i = 0; i < pts.length; i++ ) {
		const a = pts[ i ];
		const b = pts[ ( i + 1 ) % pts.length ];
		sum += a[ 0 ] * b[ 1 ] - b[ 0 ] * a[ 1 ];
	}
	return sum;
}

/**
 * A closed polygon wound clockwise, or counter-clockwise to cut. Every filled shape is normalised
 * to one winding, so two that overlap add up instead of cancelling into a hole.
 */
function polygon( pts, cut = false ) {
	const clockwise = signedArea( pts ) > 0;
	const wound     = clockwise === ! cut ? pts : [ ...pts ].reverse();
	return 'M' + wound.map( ( p ) => `${ n( p[ 0 ] ) } ${ n( p[ 1 ] ) }` ).join( 'L' ) + 'Z';
}

/** A rectangle with rounded corners, clockwise — or counter-clockwise, to punch a hole. */
function roundRect( x, y, w, h, r, cut = false ) {
	r = Math.max( 0, Math.min( r, w / 2, h / 2 ) );

	if ( ! r ) {
		return polygon( [ [ x, y ], [ x + w, y ], [ x + w, y + h ], [ x, y + h ] ], cut );
	}

	const R = `${ n( r ) } ${ n( r ) } 0 0 ${ cut ? 0 : 1 }`;

	return cut
		? `M${ n( x + r ) } ${ n( y ) }A${ R } ${ n( x ) } ${ n( y + r ) }V${ n( y + h - r ) }A${ R } ${ n( x + r ) } ${ n( y + h ) }`
			+ `H${ n( x + w - r ) }A${ R } ${ n( x + w ) } ${ n( y + h - r ) }V${ n( y + r ) }A${ R } ${ n( x + w - r ) } ${ n( y ) }Z`
		: `M${ n( x + r ) } ${ n( y ) }H${ n( x + w - r ) }A${ R } ${ n( x + w ) } ${ n( y + r ) }V${ n( y + h - r ) }`
			+ `A${ R } ${ n( x + w - r ) } ${ n( y + h ) }H${ n( x + r ) }A${ R } ${ n( x ) } ${ n( y + h - r ) }V${ n( y + r ) }A${ R } ${ n( x + r ) } ${ n( y ) }Z`;
}

/** A disc as two half-arcs — `<circle>` is not in wordpress.org's allow-list. */
function disc( cx, cy, r, cut = false ) {
	const sweep = cut ? 0 : 1;
	return `M${ n( cx - r ) } ${ n( cy ) }A${ n( r ) } ${ n( r ) } 0 1 ${ sweep } ${ n( cx + r ) } ${ n( cy ) }`
		+ `A${ n( r ) } ${ n( r ) } 0 1 ${ sweep } ${ n( cx - r ) } ${ n( cy ) }Z`;
}

/**
 * One side of a stroked polyline, `h` (half the stroke) away. `side` is +1 for the left offset,
 * -1 for the right. Butt caps and miter joins.
 */
function offsetSide( points, side, h ) {
	const normals = [];

	for ( let i = 0; i < points.length - 1; i++ ) {
		normals.push( mul( normal( unit( sub( points[ i + 1 ], points[ i ] ) ) ), side ) );
	}

	/** The offset of the vertex where segment `i - 1` meets segment `i`. */
	const join = ( vertex, prev, next ) => {
		const bisector = add( prev, next );

		// A 180° reversal has no miter, and a miter past the limit is a spike — bevel both.
		if ( Math.hypot( bisector[ 0 ], bisector[ 1 ] ) < 1e-6 ) {
			return [ add( vertex, mul( prev, h ) ), add( vertex, mul( next, h ) ) ];
		}

		const m      = unit( bisector );
		const length = h / dot( m, prev );

		return Math.abs( length ) > MITER_LIMIT * h
			? [ add( vertex, mul( prev, h ) ), add( vertex, mul( next, h ) ) ]
			: [ add( vertex, mul( m, length ) ) ];
	};

	const out = [ add( points[ 0 ], mul( normals[ 0 ], h ) ) ];

	for ( let i = 1; i < points.length - 1; i++ ) {
		out.push( ...join( points[ i ], normals[ i - 1 ], normals[ i ] ) );
	}

	out.push( add( points[ points.length - 1 ], mul( normals[ normals.length - 1 ], h ) ) );

	return out;
}

/**
 * Outline one shape into fill geometry. Shapes sit at their exact outer edge: a `rect` or `circle`
 * is solid when `filled`, otherwise a frame `width` thick inside that edge; a `line` is a stroke
 * centred on its points; a `poly` is a solid polygon.
 */
function outline( shape ) {
	const width = shape.width ?? strokeWidth;
	const cut   = Boolean( shape.cut );

	switch ( shape.type ) {
		case 'rect': {
			const { x, y, w, h, r = 0 } = shape;
			const outer = roundRect( x, y, w, h, r, cut );
			return shape.filled
				? outer
				: outer + roundRect( x + width, y + width, w - 2 * width, h - 2 * width, r - width, ! cut );
		}
		case 'circle': {
			const { cx, cy, r } = shape;
			return shape.filled
				? disc( cx, cy, r, cut )
				: disc( cx, cy, r, cut ) + disc( cx, cy, r - width, ! cut );
		}
		case 'line':
			return polygon( [ ...offsetSide( shape.points, 1, width / 2 ), ...offsetSide( shape.points, -1, width / 2 ).reverse() ], cut );
		case 'poly':
			return polygon( shape.points, cut );
		default:
			throw new Error( `unknown glyph shape "${ shape.type }"` );
	}
}

/**
 * Build the full icon markup: one path per colour, base first so the accent sits on top. A cut
 * lives in its colour's path, after the shapes it punches through.
 */
export function buildIcon( shapes ) {
	const base   = shapes.filter( ( s ) => ! s.accent ).map( outline ).join( '' );
	const accent = shapes.filter( ( s ) => s.accent ).map( outline ).join( '' );

	const paths = [
		base   ? `<path d="${ base }" fill="currentColor"/>` : '',
		accent ? `<path d="${ accent }" fill="${ ACCENT }"/>` : '',
	].join( '' );

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ viewBox }" width="24" height="24">${ paths }</svg>`;
}

export function generate() {
	let written = 0;

	for ( const [ blockName, shapes ] of Object.entries( glyphs ) ) {
		const slug = blockName.replace( /^blicks\//, '' );
		const file = resolve( ROOT, `resources/blocks/${ slug }/block.json` );

		if ( ! existsSync( file ) ) {
			console.error( `gen-block-icons: no block.json for "${ blockName }"` );
			process.exit( 1 );
		}

		const raw  = readFileSync( file, 'utf8' );
		const icon = JSON.stringify( buildIcon( shapes ) );

		// Rewrite in place rather than re-serialising the whole file — block.json is hand-maintained
		// and its formatting (tabs, one-line arrays) is not what JSON.stringify would produce.
		// One leading tab, so the `icon` *attribute* some blocks declare (two tabs, inside
		// "attributes") is never the thing being rewritten.
		const next = /^\t"icon": /m.test( raw )
			? raw.replace( /^\t"icon": .*$/m, `\t"icon": ${ icon },` )
			: raw.replace( /(\n\t"category": .*,\n)/, `$1\t"icon": ${ icon },\n` );

		if ( ! next.includes( `\t"icon": ${ icon },` ) ) {
			console.error( `gen-block-icons: could not place the icon in ${ slug }/block.json` );
			process.exit( 1 );
		}

		writeFileSync( file, next );
		written++;
	}

	console.log( `gen-block-icons: wrote ${ written } outlined icon(s) into resources/blocks/*/block.json` );
}

// Importing this file (the drift test does) must not rewrite the tree — only running it does.
if ( process.argv[ 1 ] && resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
	generate();
}
