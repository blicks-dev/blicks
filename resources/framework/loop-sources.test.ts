import { afterEach, describe, expect, it } from 'vitest';
import { isSourceId, loopSource, loopSources, registerSource, resetSources } from './loop-sources';

const card = { id: 'classic', title: 'Classic', card: { name: 'blicks/box', innerBlocks: [] } };

describe( 'Loop sources', () => {
	afterEach( () => resetSources() );

	it( 'registers a namespaced source with its rows and starter cards', () => {
		const Settings = () => null;

		expect( registerSource( { id: 'acme/trips', label: 'Trips', Settings, ordersItself: true, cards: [ card ] } ) ).toBe( true );
		expect( loopSource( 'acme/trips' ) ).toMatchObject( { id: 'acme/trips', label: 'Trips', Settings, ordersItself: true } );
		expect( loopSource( 'acme/trips' )?.cards ).toEqual( [ card ] );
		expect( loopSources().map( ( s ) => s.id ) ).toEqual( [ 'acme/trips' ] );
	} );

	it( 'refuses malformed ids and duplicates; the first registration wins', () => {
		expect( registerSource( { id: 'query', label: 'Mine' } ) ).toBe( false );
		expect( registerSource( { id: 'Acme/Trips', label: 'x' } ) ).toBe( false );
		expect( registerSource( { id: 'acme/trips', label: 'First' } ) ).toBe( true );
		expect( registerSource( { id: 'acme/trips', label: 'Second' } ) ).toBe( false );
		expect( loopSource( 'acme/trips' )?.label ).toBe( 'First' );
	} );

	it( 'drops starter cards without a block and labels a source by its id when unnamed', () => {
		registerSource( { id: 'acme/x', label: '', cards: [ card, { id: 'bad', title: 'Bad' } as never ] } );

		expect( loopSource( 'acme/x' )?.label ).toBe( 'acme/x' );
		expect( loopSource( 'acme/x' )?.cards ).toEqual( [ card ] );
	} );

	it( 'tells a plugin source id from a built-in', () => {
		expect( isSourceId( 'acme/trips' ) ).toBe( true );
		expect( isSourceId( 'json' ) ).toBe( false );
		expect( loopSource( 'json' ) ).toBeUndefined();
	} );
} );
