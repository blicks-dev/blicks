/**
 * Guards the public API surface against silent drift.
 *
 * `resources/api.ts` is the contract addons build against, and it is published on
 * `window.blicks` from the editor bundle. Adding to it is cheap; removing or renaming from it
 * breaks an addon at runtime, in someone else's plugin, with no compile-time signal here.
 *
 * So the shape is asserted literally. A deliberate change updates this list — and bumping
 * `apiVersion` is the reminder that anything already shipped needs to keep working.
 *
 * Like registry-drift.test.ts, this reads the source rather than importing it: importing the
 * barrel would pull the whole control tree and @wordpress/block-editor into a node-env test for
 * what is a pure data assertion.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync( resolve( __dirname, 'api.ts' ), 'utf8' );

/** Top-level keys of an `export const <name> = { … } as const;` block. */
function namespaceKeys( name: string ): string[] {
	const start = SOURCE.indexOf( `export const ${ name } = {` );
	if ( start === -1 ) throw new Error( `api.ts does not export a '${ name }' namespace` );

	let depth = 0;
	let end = start;
	for ( let i = SOURCE.indexOf( '{', start ); i < SOURCE.length; i++ ) {
		if ( SOURCE[ i ] === '{' ) depth++;
		if ( SOURCE[ i ] === '}' ) {
			depth--;
			if ( depth === 0 ) {
				end = i;
				break;
			}
		}
	}

	const body = SOURCE.slice( SOURCE.indexOf( '{', start ) + 1, end );
	const keys: string[] = [];
	let nested = 0;
	for ( const line of body.split( '\n' ) ) {
		const trimmed = line.trim();
		if ( ! trimmed || trimmed.startsWith( '//' ) || trimmed.startsWith( '*' ) || trimmed.startsWith( '/*' ) ) {
			continue;
		}
		if ( nested === 0 ) {
			const match = trimmed.match( /^([A-Za-z_][A-Za-z0-9_]*)\s*[,:]/ );
			if ( match ) keys.push( match[ 1 ] );
		}
		nested += ( trimmed.match( /\{/g ) ?? [] ).length;
		nested -= ( trimmed.match( /\}/g ) ?? [] ).length;
	}
	return keys.sort();
}

describe( 'public API surface', () => {
	it( 'exports exactly the documented namespaces', () => {
		const exported = [ ...SOURCE.matchAll( /^export const ([A-Za-z]+)/gm ) ].map( ( m ) => m[ 1 ] );
		expect( exported.sort() ).toEqual( [ 'apiVersion', 'blocks', 'design', 'inspector', 'style', 'values' ] );
	} );

	it( 'exposes the block factory', () => {
		expect( namespaceKeys( 'blocks' ) ).toEqual( [ 'applyBlockIdentity', 'defineBlock' ] );
	} );

	it( 'exposes the value tree', () => {
		expect( namespaceKeys( 'values' ) ).toEqual( [
			'BREAKPOINTS',
			'STATES',
			'STATE_LABELS',
			'getValue',
			'hasOverrides',
			'setValue',
			'stateSuffix',
		] );
	} );

	it( 'exposes the style engine', () => {
		expect( namespaceKeys( 'style' ) ).toEqual( [
			'STYLE_MAP',
			'buildElementStyle',
			'cleanAttributes',
			'cssValueForCategory',
			'registerCssValueBuilder',
			'sanitizeCss',
			'scopeCss',
		] );
	} );

	it( 'exposes the inspector shell and every control', () => {
		expect( namespaceKeys( 'inspector' ) ).toEqual( [ 'ContextBar', 'Inspector', 'Section', 'controls' ] );
	} );

	it( 'exposes the design system registries', () => {
		expect( namespaceKeys( 'design' ) ).toEqual( [
			'BREAKPOINTS',
			'TOKENS',
			'TYPE_ROLES',
			'TYPE_ROLE_GROUPS',
			'TYPE_ROLE_LABELS',
			'fonts',
			'icons',
			'isToken',
			'isTypeRole',
		] );
	} );

	it( 'the script module re-exports exactly the same namespaces', () => {
		// `resources/framework-module.ts` is the ESM face of this API (`@blicks/framework`). It
		// reads the same object off `window.blicks`, so a namespace added here and forgotten
		// there would be importable by name from the global but missing from the module.
		const module = readFileSync( resolve( __dirname, 'framework-module.ts' ), 'utf8' );
		const moduleExports = [ ...module.matchAll( /^export const ([A-Za-z]+)/gm ) ].map( ( m ) => m[ 1 ] );
		const barrelExports = [ ...SOURCE.matchAll( /^export const ([A-Za-z]+)/gm ) ].map( ( m ) => m[ 1 ] );
		expect( moduleExports.sort() ).toEqual( barrelExports.sort() );
	} );

	it( 're-exports nothing from outside the plugin', () => {
		// A third-party type or component leaking into the barrel would make the addon contract
		// depend on a package version addons cannot see.
		const sources = [ ...SOURCE.matchAll( /from '([^']+)'/g ) ].map( ( m ) => m[ 1 ] );
		expect( sources.filter( ( s ) => ! s.startsWith( '@/' ) ) ).toEqual( [] );
	} );
} );
