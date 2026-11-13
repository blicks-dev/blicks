/**
 * What a card rule changes has to show on the blocks it is for. Those blocks carry the style
 * engine's classes, which are unlayered, and an unlayered declaration beats every layered one
 * whatever its specificity. So a rule's look lives outside `@layer`, and is specific enough to
 * outrank the engine's strongest colour, shadow or size selector: a state class doubled, (0,2,0).
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { compile } from 'sass';
import { ACTIONS } from './data';

interface Rule {
	selector: string;
	layer: string | null;
}

/** Every style rule in the sheet, with the `@layer` around it (null when there is none). */
function rulesOf( css: string ): Rule[] {
	const out: Rule[] = [];
	const stack: Array< string | null > = [];
	let buf = '';
	for ( const ch of css.replace( /\/\*[\s\S]*?\*\//g, '' ) ) {
		if ( ch === '{' ) {
			const head = buf.trim();
			buf = '';
			const layer = /^@layer\s+([\w.-]+)/.exec( head )?.[ 1 ] ?? null;
			const inLayer = stack.find( ( s ) => s !== null && s.startsWith( 'layer:' ) ) ?? null;
			if ( head.startsWith( '@' ) ) {
				stack.push( layer ? `layer:${ layer }` : 'at' );
			} else {
				out.push( { selector: head, layer: inLayer ? inLayer.slice( 6 ) : null } );
				stack.push( null );
			}
		} else if ( ch === '}' ) {
			stack.pop();
			buf = '';
		} else if ( ch === ';' ) {
			buf = '';
		} else {
			buf += ch;
		}
	}
	return out;
}

/** Class, attribute and pseudo-class count of a plain compound selector (these hold no ids or :is). */
const specificity = ( selector: string ) => ( selector.match( /\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g ) ?? [] ).length;

const css = compile( resolve( __dirname, 'style.scss' ) ).css;
const rules = rulesOf( css );

describe( 'what card rules change', () => {
	const looks = ( [ 'card', 'badge', 'heading' ] as const ).flatMap( ( kind ) => ACTIONS[ kind ].map( ( value ) => `is-${ kind }-${ value }` ) );

	it.each( looks )( '%s has a look', ( look ) => {
		expect( rules.some( ( r ) => r.selector.includes( `.${ look }` ) ) ).toBe( true );
	} );

	it.each( looks )( '%s is outside every layer and outranks the engine', ( look ) => {
		const mine = rules.filter( ( r ) => r.selector.includes( `.${ look }` ) );

		for ( const rule of mine ) {
			expect( rule.layer, rule.selector ).toBeNull();
			for ( const one of rule.selector.split( ',' ) ) expect( specificity( one ), one ).toBeGreaterThanOrEqual( 3 );
		}
	} );

	it( 'keeps the rest of the Loop in the base layer, where a theme overrides it', () => {
		const items = rules.filter( ( r ) => /^\.bl-loop__items\s*\{?$/.test( r.selector ) || r.selector === '.bl-loop__item' );

		expect( items.length ).toBeGreaterThan( 0 );
		for ( const rule of items ) expect( rule.layer ).toBe( 'blicks.base' );
	} );
} );
