import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Every class the Studio renders has a rule somewhere.
 *
 * **This exists because the library screen was entirely unstyled for five commits and no test
 * noticed.** A wholesale rewrite of `studio.css` dropped its whole block; the four tests covering
 * that screen all read its DOM — counts, titles, which empty state showed — and a screen whose
 * assertions are text can lose every rule and still pass.
 *
 * So the gap is not "we needed a screenshot test". It is that nothing tied a class a component
 * renders to a rule that styles it, in a plugin whose own house rule is that anything duplicated
 * across files gets a drift test. This is that test for the surface's own classes.
 *
 * It cannot tell a good rule from a bad one. It tells you that a class you render is a class
 * nothing anywhere styles, which is the failure that actually happened.
 */

const STUDIO = resolve( __dirname );

/**
 * Classes owned by someone else and deliberately unstyled here.
 *
 * `bl-ins*` and `bl-settings-card*` belong to the free plugin's inspector, which the Studio only
 * re-themes through tokens; `bl-scx`/`bl-scy`/`bl-scw`/`bl-sch` and `bl-anim-name` are the style
 * engine's own consumer classes, set by its runtime stylesheet. A rule for any of them HERE would
 * be the drift this plugin tries to avoid, so their absence is correct and asserted as such.
 *
 * `bl-anim` is not a class at all: it is the namespace custom `@keyframes` names live in
 * (`bl-anim-<slug>`), which the Motion tab writes into `animation-name`.
 */
const FOREIGN = [
	'bl-anim',
	'bl-ins',
	'bl-settings-card',
	'bl-scx',
	'bl-scy',
	'bl-scw',
	'bl-sch',
	'bl-anim-name',
	'bl-combobox',
];

function walk( dir: string ): string[] {
	return readdirSync( dir ).flatMap( ( entry ) => {
		const path = join( dir, entry );

		if ( statSync( path ).isDirectory() ) {
			return walk( path );
		}

		return /\.tsx?$/.test( path ) && ! /\.test\.tsx?$/.test( path ) ? [ path ] : [];
	} );
}

/**
 * Every `bl-` class name a component file mentions.
 *
 * A plain token scan, not an attempt to find string literals. Pairing quotes in a source file is
 * the wrong tool and failed twice here: prose comments carry apostrophes, so one of them opens a
 * span that runs to the next and swallows the real `className` values in between. The first version
 * of this test reported one unstyled class while silently missing the one beside it, which is worse
 * than not having the test.
 *
 * Over-capturing is harmless and deliberate. A class named anywhere in these files — in a
 * `className`, in a `querySelector`, in a template string — is a class this surface depends on, so
 * it either needs a rule here or belongs to someone else and is listed in `FOREIGN`.
 */
function renderedClasses(): Map< string, string > {
	const found = new Map< string, string >();

	for ( const file of [ ...walk( STUDIO ), resolve( __dirname, '../studio.tsx' ) ] ) {
		const source = readFileSync( file, 'utf8' )
			.replace( /\/\*[\s\S]*?\*\//g, ' ' )
			.replace( /\/\/[^\n]*/g, ' ' );

		/*
		 * `(?<!-)` keeps CUSTOM PROPERTIES out: `--bl-studio-chrome` contains `bl-studio-chrome`,
		 * which is a variable, not a class. Ending on an alphanumeric trims a template prefix like
		 * `bl-library__badge--${ source }` back to the base class, which is the part that must
		 * exist.
		 */
		for ( const match of source.matchAll( /(?<!-)\bbl-[a-z0-9_-]*[a-z0-9]/g ) ) {
			if ( ! found.has( match[ 0 ] ) ) {
				found.set( match[ 0 ], file.replace( `${ STUDIO }/`, '' ) );
			}
		}
	}

	return found;
}

/** Class names any rule in the Studio's stylesheets selects. */
function styledClasses(): Set< string > {
	const css = [ resolve( STUDIO, 'studio.css' ) ]
		.map( ( file ) => readFileSync( file, 'utf8' ) )
		.join( '\n' );

	return new Set( [ ...css.matchAll( /\.(bl-[a-z0-9_-]+)/g ) ].map( ( m ) => m[ 1 ]! ) );
}

describe( 'the Studio styles what it renders', () => {
	it( 'has a rule for every class it renders', () => {
		const rendered = renderedClasses();
		const styled = styledClasses();

		const unstyled = [ ...rendered.entries() ]
			.filter( ( [ name ] ) => ! styled.has( name ) )
			.filter( ( [ name ] ) => ! FOREIGN.some( ( prefix ) => name.startsWith( prefix ) ) )
			.map( ( [ name, file ] ) => `${ name } (rendered by ${ file })` );

		expect( unstyled ).toEqual( [] );
	} );

	/**
	 * The screen the original loss was on. Named explicitly so that deleting its block fails with
	 * the screen's name rather than a list of class names someone has to recognise.
	 */
	it( 'still styles the library', () => {
		const styled = styledClasses();

		for ( const name of [
			'bl-library__top',
			'bl-library__rail',
			'bl-library__grid',
			'bl-library__card',
			'bl-library__thumb',
			'bl-library__import',
		] ) {
			expect( styled.has( name ), `${ name } has no rule; the library screen is unstyled` ).toBe(
				true
			);
		}
	} );

	it( 'finds something to check, so a broken matcher cannot pass silently', () => {
		expect( renderedClasses().size ).toBeGreaterThan( 30 );
		expect( styledClasses().size ).toBeGreaterThan( 30 );
	} );
} );
