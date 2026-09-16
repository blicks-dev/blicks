/**
 * The Blicks logo is drawn in three places that cannot import each other:
 *
 *   • `resources/framework/brand.tsx`   — the editor (Theme Settings sidebar)
 *   • `resources/admin/icons.tsx`       — the wp-admin app header
 *   • `docs/favicon.svg`                — the docs site, a static file
 *
 * The first two are separate Vite entries, and entries here are self-contained by construction
 * (see the `blicks-iife-wrap` note in `brand.tsx`); the third is not JavaScript at all. So the
 * geometry is copied, and this test is what keeps the copies honest: a logo that drifts between
 * the admin header, the editor sidebar and the favicon is worse than no logo.
 *
 * Only the geometry is compared. The paint differs on purpose — the components inherit
 * `currentColor` so the mark takes its chrome's colour, while the favicon is a fixed `#0d1117`
 * on white.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve( __dirname, '../..' );

/** Every `<rect>` in source order, as the four numbers that place it. */
function rects( file: string ): string[] {
	const source = readFileSync( resolve( root, file ), 'utf8' );

	return [ ...source.matchAll( /<rect\b[^>]*>/g ) ].map( ( [ tag ] ) => {
		const at = ( name: string ) => tag.match( new RegExp( `${ name }="(\\d+)"` ) )?.[ 1 ] ?? '?';
		return `${ at( 'x' ) },${ at( 'y' )} ${ at( 'width' ) }x${ at( 'height' ) }`;
	} );
}

const GEOMETRY = [
	'20,20 100x40',
	'20,70 80x40',
	'20,120 110x40',
	'135,120 20x40',
];

describe( 'the Blicks logo', () => {
	it.each( [
		[ 'the editor copy', 'resources/framework/brand.tsx' ],
		[ 'the wp-admin copy', 'resources/admin/icons.tsx' ],
		[ 'the docs favicon', 'docs/favicon.svg' ],
	] )( '%s draws the mark', ( _label, file ) => {
		expect( rects( file ) ).toEqual( GEOMETRY );
	} );

	it( 'draws it on one 180-square viewBox everywhere', () => {
		for ( const file of [ 'resources/framework/brand.tsx', 'resources/admin/icons.tsx', 'docs/favicon.svg' ] ) {
			expect( readFileSync( resolve( root, file ), 'utf8' ) ).toContain( 'viewBox="0 0 180 180"' );
		}
	} );

	it( 'keeps the accent tick on the brand blue', () => {
		expect( readFileSync( resolve( root, 'resources/framework/brand.tsx' ), 'utf8' ) ).toContain( "'#002bff'" );
		expect( readFileSync( resolve( root, 'resources/admin/icons.tsx' ), 'utf8' ) ).toContain( "'#002bff'" );
		expect( readFileSync( resolve( root, 'docs/favicon.svg' ), 'utf8' ) ).toContain( '"#002bff"' );
	} );
} );
