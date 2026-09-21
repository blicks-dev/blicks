#!/usr/bin/env node
/**
 * Writes each block's `icon` into `resources/blocks/<slug>/block.json`, outlined from the shared
 * glyph source in `resources/framework/icons/block-glyphs.json`.
 *
 * Why outlined: wordpress.org renders a block.json icon that contains `<svg` through `wp_kses`
 * with an allow-list of `svg`/`g`/`title`/`path` and, on a path, only `d`, `fill` and `transform`
 * (see the wporg-plugins-2024 theme, `template-parts/section-blocks.php`). Every stroke attribute
 * and every `<rect>`/`<circle>` is stripped, so the editor's stroked glyphs would arrive invisible.
 * Converting each stroke to its filled outline renders identically and survives the filter.
 *
 * The editor does not use this — `resources/framework/identity.tsx` renders the same glyphs as
 * real strokes. This file exists for the surfaces that read the metadata statically and never run
 * the editor bundle: the wordpress.org plugin page and Plugins → Add New → Blocks.
 *
 * Run via `pnpm gen:block-icons` (also auto-runs before `pnpm build`/`pnpm dev`).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const SOURCE = resolve( ROOT, 'resources/framework/icons/block-glyphs.json' );

const { strokeWidth, accent: ACCENT, viewBox, glyphs } = JSON.parse( readFileSync( SOURCE, 'utf8' ) );

const H = strokeWidth / 2;          // half the stroke — how far the outline sits from the path
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

const polygon = ( pts ) =>
	'M' + pts.map( ( p ) => `${ n( p[ 0 ] ) } ${ n( p[ 1 ] ) }` ).join( 'L' ) + 'Z';

/** An axis-aligned rectangle, wound clockwise (or counter-clockwise, to punch a hole). */
function rectPath( x, y, w, h, clockwise = true ) {
	const corners = [ [ x, y ], [ x + w, y ], [ x + w, y + h ], [ x, y + h ] ];
	return polygon( clockwise ? corners : corners.reverse() );
}

/**
 * One side of a stroked polyline. `side` is +1 for the left offset, -1 for the right.
 * Butt caps (the ends are not extended) and miter joins, matching the editor's glyph style.
 * A closed polyline has no caps — every vertex, the seam included, is a join.
 */
function offsetSide( points, side, closed = false ) {
	const dirs    = [];
	const normals = [];
	const count   = closed ? points.length : points.length - 1;

	for ( let i = 0; i < count; i++ ) {
		const d = unit( sub( points[ ( i + 1 ) % points.length ], points[ i ] ) );
		dirs.push( d );
		normals.push( mul( normal( d ), side ) );
	}

	/** The offset of the vertex where segment `i - 1` meets segment `i`. */
	const join = ( vertex, prev, next ) => {
		const bisector = add( prev, next );

		// A 180° reversal has no miter, and a miter past the limit is a spike — bevel both.
		if ( Math.hypot( bisector[ 0 ], bisector[ 1 ] ) < 1e-6 ) {
			return [ add( vertex, mul( prev, H ) ), add( vertex, mul( next, H ) ) ];
		}

		const m      = unit( bisector );
		const length = H / dot( m, prev );

		return Math.abs( length ) > MITER_LIMIT * H
			? [ add( vertex, mul( prev, H ) ), add( vertex, mul( next, H ) ) ]
			: [ add( vertex, mul( m, length ) ) ];
	};

	const out = closed
		? join( points[ 0 ], normals[ normals.length - 1 ], normals[ 0 ] )
		: [ add( points[ 0 ], mul( normals[ 0 ], H ) ) ];

	for ( let i = 1; i < points.length - 1; i++ ) {
		out.push( ...join( points[ i ], normals[ i - 1 ], normals[ i ] ) );
	}

	if ( closed ) {
		const last = points.length - 1;
		out.push( ...join( points[ last ], normals[ last - 1 ], normals[ last ] ) );
	} else {
		out.push( add( points[ points.length - 1 ], mul( normals[ normals.length - 1 ], H ) ) );
	}

	return out;
}

/** Twice the signed area — its sign is the winding, its magnitude ranks the two offsets. */
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
 * Both offsets of a closed glyph, outward first — which side is which depends on the winding the
 * glyph happens to be drawn in, so it is decided by area rather than assumed.
 */
function closedOffsets( points ) {
	const a = offsetSide( points, 1, true );
	const b = offsetSide( points, -1, true );
	return Math.abs( signedArea( a ) ) > Math.abs( signedArea( b ) ) ? [ a, b ] : [ b, a ];
}

/**
 * A stroked polyline becomes one closed polygon: the left offsets, then the right ones reversed.
 * A closed shape is instead its own outline — filled, that is just the outward offset; unfilled,
 * the outward offset with the inward one punched out of it.
 */
function linePath( points, { closed = false, filled = false } = {} ) {
	if ( ! closed ) {
		return polygon( [ ...offsetSide( points, 1 ), ...offsetSide( points, -1 ).reverse() ] );
	}

	const [ outer, inner ] = closedOffsets( points );

	return filled
		? polygon( outer )
		: polygon( outer ) + polygon( inner.reverse() );
}

/** A filled disc, as two half-arcs — `<circle>` is not in wordpress.org's allow-list. */
const circlePath = ( cx, cy, r ) =>
	`M${ n( cx - r ) } ${ n( cy ) }a${ n( r ) } ${ n( r ) } 0 1 0 ${ n( r * 2 ) } 0a${ n( r ) } ${ n( r ) } 0 1 0 ${ n( -r * 2 ) } 0Z`;

/** Outline one shape into fill geometry. Returns the `d` for a filled path. */
function outline( shape ) {
	switch ( shape.type ) {
		case 'rect':
			// A filled cell also carries the stroke in the editor, so it grows by half a stroke on
			// every side; an unfilled one is a frame — the outer rect with the inner one punched out.
			return shape.filled
				? rectPath( shape.x - H, shape.y - H, shape.w + 2 * H, shape.h + 2 * H )
				: rectPath( shape.x - H, shape.y - H, shape.w + 2 * H, shape.h + 2 * H )
					+ rectPath( shape.x + H, shape.y + H, shape.w - 2 * H, shape.h - 2 * H, false );
		case 'line':
			return linePath( shape.points, shape );
		case 'circle':
			return circlePath( shape.cx, shape.cy, shape.r + ( shape.filled ? H : 0 ) );
		case 'path':
			return shape.d;
		default:
			throw new Error( `unknown glyph shape "${ shape.type }"` );
	}
}

/** Build the full icon markup: one path per colour, base first so the accent sits on top. */
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
