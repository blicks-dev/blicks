import { afterEach, describe, expect, it, vi } from 'vitest';
import { focus, getFocus, subscribe, unfocus } from './scope';
import { closeSession, openLibrary, openSession } from './session';
import type { Mount } from './mount';

const mount = (): Mount => ( { blocks: [], mode: 'section', source: 'blank', origin: null, label: '' } );

afterEach( () => {
	unfocus();
	closeSession();
	vi.restoreAllMocks();
} );

describe( 'studio.focus()', () => {
	it( 'needs something mounted', () => {
		const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );

		expect( focus( 'abc', { label: 'Card' } ) ).toBe( false );
		openLibrary();
		expect( focus( 'abc', { label: 'Card' } ) ).toBe( false );
		expect( error ).toHaveBeenCalledTimes( 2 );
		expect( getFocus() ).toBeNull();
	} );

	it( 'sets a scope and tells whoever listens, and unfocus() clears it', () => {
		openSession( mount() );
		const heard = vi.fn();
		const stop = subscribe( heard );

		expect( focus( 'abc', { label: 'Products panel', exitLabel: 'Back to the header' } ) ).toBe( true );
		expect( getFocus() ).toEqual( { clientId: 'abc', label: 'Products panel', exitLabel: 'Back to the header' } );

		unfocus();
		expect( getFocus() ).toBeNull();
		expect( heard.mock.calls.map( ( call ) => call[ 0 ]?.clientId ?? null ) ).toEqual( [ 'abc', null ] );
		stop();
	} );

	it( 'refuses a malformed request without touching the scope it has', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		openSession( mount() );
		focus( 'abc', { label: 'Card' } );

		expect( focus( 42, { label: 'x' } ) ).toBe( false );
		expect( getFocus()?.clientId ).toBe( 'abc' );
	} );

	it( 'is dropped when something else is mounted, or the Studio closes', () => {
		openSession( mount() );
		focus( 'abc', { label: 'Card' } );
		openSession( mount() );
		expect( getFocus() ).toBeNull();

		focus( 'abc', { label: 'Card' } );
		closeSession();
		expect( getFocus() ).toBeNull();
	} );
} );
