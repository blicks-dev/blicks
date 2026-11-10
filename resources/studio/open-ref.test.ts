import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRef } from './open-ref';
import { modes } from './registry';
import { closeSession, getSession, openSession } from './session';

const Canvas = () => null;
const ref = { kind: 'template-part', id: 'theme//header' };
const header = ( load: ( r: Record< string, unknown > ) => Promise< unknown > ) => ( {
	id: 'header',
	label: 'Header',
	matches: () => false,
	Canvas,
	persist: { label: 'Save header', load, save: async () => undefined },
} );

afterEach( () => {
	for ( const mode of modes.list() ) modes.unregister( mode.id );
	closeSession();
	vi.restoreAllMocks();
} );

describe( 'studio.openRef()', () => {
	it( 'mounts what the mode loads, in that mode, with the ref for its save', async () => {
		const load = vi.fn( async () => ( { blocks: [], label: 'Main header', note: 'Used on 12 pages' } ) );
		modes.register( header( load ) );

		expect( await openRef( 'header', ref ) ).toBe( true );
		expect( load ).toHaveBeenCalledWith( ref );
		expect( getSession()?.mount ).toEqual( expect.objectContaining( { mode: 'header', source: 'ref', ref, label: 'Main header', note: 'Used on 12 pages', origin: null } ) );
	} );

	it( 'keeps its own copy of the ref', async () => {
		modes.register( header( async () => ( { blocks: [] } ) ) );
		const mine = { kind: 'post', type: 'blicks_dialog', id: 3 };

		await openRef( 'header', mine );
		mine.id = 99;
		expect( getSession()?.mount?.ref ).toEqual( { kind: 'post', type: 'blicks_dialog', id: 3 } );
		expect( getSession()?.mount?.label ).toBe( 'Header' );
	} );

	it( 'refuses an unknown mode, a mode that does not persist, and a ref that is not an object', async () => {
		const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		modes.register( { id: 'section', label: 'Section', matches: () => true, Canvas } );
		modes.register( header( async () => ( { blocks: [] } ) ) );

		expect( await openRef( 'nope', ref ) ).toBe( false );
		expect( await openRef( 'section', ref ) ).toBe( false );
		expect( await openRef( 'header', 'theme//header' ) ).toBe( false );
		expect( error.mock.calls.map( ( call ) => String( call[ 0 ] ) ) ).toEqual( [
			expect.stringContaining( 'no mode "nope"' ),
			expect.stringContaining( 'has no persist' ),
			expect.stringContaining( 'a ref object' ),
		] );
		expect( getSession() ).toBeNull();
	} );

	it( 'will not replace a tree already mounted', async () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		modes.register( header( async () => ( { blocks: [] } ) ) );
		const open = { blocks: [], mode: 'section', source: 'blank' as const, origin: null, label: 'Hero' };
		openSession( open );

		expect( await openRef( 'header', ref ) ).toBe( false );
		expect( getSession()?.mount ).toBe( open );
	} );

	it( 'reports a failed or empty load and stays closed', async () => {
		const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		modes.register( header( async () => { throw new Error( 'Not found' ); } ) );
		expect( await openRef( 'header', ref ) ).toBe( false );

		modes.register( header( async () => ( { nothing: true } ) ) );
		expect( await openRef( 'header', ref ) ).toBe( false );
		expect( error ).toHaveBeenCalledTimes( 2 );
		expect( getSession() ).toBeNull();
	} );
} );
