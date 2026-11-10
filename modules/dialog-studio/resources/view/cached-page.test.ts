// @vitest-environment jsdom
/**
 * Rules evaluate in the browser (header-studio.md): a page cache serves one HTML to everyone, so
 * two visitors given the very same bytes must still get their own result.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { memoryKey, DAY } from './auto-core';

vi.mock( '@wordpress/interactivity', () => ( { store: () => ( { actions: { open: () => undefined } } ) } ) );

const CACHED = readFileSync( resolve( __dirname, '../../tests/cached-page.html' ), 'utf8' );

async function visit( { loggedIn, width, storage = {} }: { loggedIn: boolean; width: number; storage?: Record< string, unknown > } ): Promise< string[] > {
	document.body.className = loggedIn ? 'home logged-in' : 'home';
	document.body.innerHTML = CACHED;
	localStorage.clear();
	sessionStorage.clear();
	for ( const [ key, value ] of Object.entries( storage ) ) localStorage.setItem( key, JSON.stringify( value ) );

	const { arm, eligible } = await import( './auto' );
	const opened: string[] = [];
	arm( eligible( document, { loggedIn, width, now: Date.now() } ), ( id ) => opened.push( id ) );
	vi.advanceTimersByTime( 60_000 );

	return opened;
}

beforeEach( () => vi.useFakeTimers() );
afterEach( () => vi.useRealTimers() );

describe( 'one cached page, two visitors', () => {
	it( 'a first-time logged-out visitor on a desktop gets the newsletter, and only it', async () => {
		expect( await visit( { loggedIn: false, width: 1280 } ) ).toEqual( [ 'dialog-newsletter' ] );
	} );

	it( 'a logged-in member gets the offer instead, from the same bytes', async () => {
		expect( await visit( { loggedIn: true, width: 1280 } ) ).toEqual( [ 'dialog-offer' ] );
	} );

	it( 'a phone visitor never gets the newsletter, which is off on phones', async () => {
		expect( await visit( { loggedIn: false, width: 390 } ) ).toEqual( [ 'dialog-offer' ] );
	} );

	it( 'someone who saw the newsletter two days ago gets the offer; who converted gets neither', async () => {
		expect( await visit( { loggedIn: false, width: 1280, storage: { [ memoryKey( 12 ) ]: { shown: Date.now() - 2 * DAY } } } ) ).toEqual( [ 'dialog-offer' ] );
		expect(
			await visit( { loggedIn: false, width: 1280, storage: { [ memoryKey( 12 ) ]: { converted: 1 }, [ memoryKey( 13 ) ]: { converted: 1 } } } )
		).toEqual( [] );
	} );

	it( 'opens the newsletter once per page view and remembers it', async () => {
		expect( await visit( { loggedIn: false, width: 1280 } ) ).toEqual( [ 'dialog-newsletter' ] );
		expect( JSON.parse( localStorage.getItem( memoryKey( 12 ) ) ?? '{}' ).shown ).toBeGreaterThan( 0 );
		expect( localStorage.getItem( memoryKey( 13 ) ) ).toBeNull();
	} );
} );
