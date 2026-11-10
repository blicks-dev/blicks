import { describe, it, expect } from 'vitest';
import { canBeCard, cardToMark, isCard, markCard } from './card';

const box = ( id: string, blicks?: any ) => ( { clientId: id, controls: [ 'layout.*' ], blicks } );
const text = ( id: string ) => ( { clientId: id, controls: [ 'typography.*' ], blicks: undefined } );

describe( 'the card a block reacts to', () => {
	it( 'marks the nearest container that can be a card, skipping ones that cannot', () => {
		expect( cardToMark( [ text( 'inline' ), box( 'card' ), box( 'section' ) ] )?.clientId ).toBe( 'card' );
	} );

	it( 'marks nothing when that container already is a card', () => {
		expect( cardToMark( [ box( 'card', markCard( undefined ) ), box( 'section' ) ] ) ).toBeNull();
	} );

	it( 'marks nothing when there is no container', () => {
		expect( cardToMark( [ text( 'a' ) ] ) ).toBeNull();
	} );

	it( 'reads the allow-list exactly or by wildcard', () => {
		expect( canBeCard( [ 'layout.group' ] ) ).toBe( true );
		expect( canBeCard( [ 'layout.width' ] ) ).toBe( false );
		expect( canBeCard( undefined ) ).toBe( false );
	} );

	it( 'keeps the rest of the tree when marking', () => {
		const next = markCard( { 'spacing.padding': { default: { base: '4' } } } );

		expect( isCard( next ) ).toBe( true );
		expect( next[ 'spacing.padding' ] ).toEqual( { default: { base: '4' } } );
	} );
} );
