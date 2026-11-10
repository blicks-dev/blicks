/**
 * One set of token values, held in one place: `ThemeProjection::FALLBACKS` in PHP. It is what
 * `CssVariables` emits as the `:root` floor on every page, so it is the value a visitor sees
 * whenever no theme or override says otherwise. Everything else that names a token value is a
 * copy, and this test is what keeps the copies honest:
 *
 *   • `tokens.json` — the slug catalogue both engines read
 *   • `admin/constants.ts` — the admin's own catalogue and `COLOR_FALLBACKS`
 *   • every `var(--blicks-<category>-<slug>, <fallback>)` in the source — a fallback that
 *     disagrees with the floor paints a different site the moment the floor is missing
 *   • `BUTTON_FOLLOWS` — what the admin says an unset button token falls back to
 *
 * A failure names the file and line and the value it should carry.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogue from './tokens.json';
import { BUTTON_FOLLOWS, COLOR_FALLBACKS, TOKENS as ADMIN_TOKENS } from '../admin/constants';

const root = resolve( __dirname, '../..' );

/**
 * Families that deliberately carry no value of their own: a component family is unset until a
 * theme or design language sets it, and its stylesheet falls back to a primitive meanwhile.
 */
const COMPONENT_FAMILIES = [ 'button' ];

/** Parses the `FALLBACKS` array literal out of ThemeProjection.php. */
function phpFallbacks(): Record< string, Record< string, string > > {
	const php = readFileSync( resolve( root, 'src/DesignSystem/ThemeProjection.php' ), 'utf8' );
	const start = php.indexOf( 'private const FALLBACKS = [' );
	const body = php.slice( start, php.indexOf( '\n\t];\n', start ) );
	const out: Record< string, Record< string, string > > = {};
	let category: string | null = null;
	for ( const line of body.split( '\n' ) ) {
		const open = /^\t\t'([A-Za-z]+)' => \[$/.exec( line );
		if ( open ) {
			category = open[ 1 ];
			out[ category ] = {};
			continue;
		}
		const entry = /^\t\t\t'([^']+)' => '(.*)',$/.exec( line );
		if ( entry && category ) out[ category ][ entry[ 1 ] ] = entry[ 2 ];
	}
	return out;
}

const FALLBACKS = phpFallbacks();

/** `#fff` and `#ffffff` are one colour. */
const norm = ( v: string ): string => v.trim().replace( /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3' ).toLowerCase();

/**
 * A fallback that defers rather than states a value: another var (checked on its own), or a
 * keyword that means "whatever surrounds me" — a dialog inheriting its text colour, a menu link
 * tinting its own `currentColor`.
 */
const defers = ( v: string ): boolean => /^var\(/.test( v ) || /^inherit$/.test( v ) || /currentColor/.test( v );

function sourceFiles( dir: string, out: string[] = [] ): string[] {
	for ( const name of readdirSync( dir ) ) {
		if ( name === 'node_modules' || name === 'generated' || name === 'build' ) continue;
		const path = join( dir, name );
		if ( statSync( path ).isDirectory() ) sourceFiles( path, out );
		else if ( /\.(scss|css|ts|tsx|php)$/.test( name ) && ! /\.test\.tsx?$/.test( name ) ) out.push( path );
	}
	return out;
}

/** Every `var(--blicks-<cat>-<slug>, <fallback>)` with its balanced fallback text. */
function fallbackUses( text: string ): Array< { category: string; slug: string; fallback: string; index: number } > {
	const uses: Array< { category: string; slug: string; fallback: string; index: number } > = [];
	const re = /var\(--blicks-([A-Za-z]+)-([a-z0-9-]+),\s*/g;
	let match: RegExpExecArray | null;
	while ( ( match = re.exec( text ) ) ) {
		let depth = 1;
		let end = re.lastIndex;
		while ( end < text.length && depth > 0 ) {
			if ( text[ end ] === '(' ) depth++;
			if ( text[ end ] === ')' ) depth--;
			end++;
		}
		uses.push( { category: match[ 1 ], slug: match[ 2 ], fallback: text.slice( re.lastIndex, end - 1 ).trim(), index: match.index } );
	}
	return uses;
}

describe( 'token values agree with ThemeProjection::FALLBACKS', () => {
	it( 'parses the PHP table', () => {
		expect( Object.keys( FALLBACKS ).length ).toBeGreaterThan( 10 );
		expect( FALLBACKS.color.primary ).toMatch( /^#/ );
	} );

	it( 'tokens.json lists exactly the slugs FALLBACKS gives values to', () => {
		const valued = Object.fromEntries( Object.entries( FALLBACKS ).map( ( [ category, values ] ) => [ category, Object.keys( values ) ] ) );
		const listed = Object.fromEntries( Object.entries( catalogue ).filter( ( [ category ] ) => ! COMPONENT_FAMILIES.includes( category ) ) );
		expect( listed ).toEqual( valued );
		for ( const family of COMPONENT_FAMILIES ) {
			expect( catalogue ).toHaveProperty( family );
			expect( FALLBACKS ).not.toHaveProperty( family );
		}
	} );

	it( 'the admin catalogue is tokens.json', () => {
		expect( Object.keys( ADMIN_TOKENS ).sort() ).toEqual( Object.keys( catalogue ).sort() );
		for ( const [ category, slugs ] of Object.entries( catalogue ) ) {
			expect( [ ...ADMIN_TOKENS[ category as keyof typeof ADMIN_TOKENS ] ] ).toEqual( slugs );
		}
	} );

	it( 'COLOR_FALLBACKS is the colour floor', () => {
		expect( COLOR_FALLBACKS ).toEqual( FALLBACKS.color );
	} );

	it( 'every var() fallback in the source carries the floor value', () => {
		const wrong: string[] = [];
		for ( const file of [ ...sourceFiles( resolve( root, 'resources' ) ), ...sourceFiles( resolve( root, 'src' ) ), ...sourceFiles( resolve( root, 'templates' ) ) ] ) {
			const text = readFileSync( file, 'utf8' );
			for ( const use of fallbackUses( text ) ) {
				const want = FALLBACKS[ use.category ]?.[ use.slug ];
				if ( want === undefined || defers( use.fallback ) || norm( use.fallback ) === norm( want ) ) continue;
				const line = text.slice( 0, use.index ).split( '\n' ).length;
				wrong.push( `${ relative( root, file ) }:${ line } --blicks-${ use.category }-${ use.slug } falls back to ${ use.fallback }, FALLBACKS says ${ want }` );
			}
		}
		expect( wrong ).toEqual( [] );
	} );

	it( 'BUTTON_FOLLOWS matches what the button stylesheet falls back to', () => {
		const scss = readFileSync( resolve( root, 'resources/blocks/button/style.scss' ), 'utf8' );
		const seen: Record< string, Set< string > > = {};
		for ( const use of fallbackUses( scss ) ) {
			if ( use.category !== 'button' ) continue;
			( seen[ use.slug ] ??= new Set() ).add( use.fallback );
		}
		for ( const slug of catalogue.button ) {
			expect( [ ...( seen[ slug ] ?? [] ) ], `button.${ slug }` ).toEqual( [ BUTTON_FOLLOWS[ slug ] ] );
		}
	} );
} );
