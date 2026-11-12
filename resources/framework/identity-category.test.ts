import { describe, expect, it } from 'vitest';
import { blockCategory } from './identity';

describe( 'block category', () => {
	it( 'puts Blicks blocks in the Blicks category, whatever they say', () => {
		expect( blockCategory( { name: 'blicks/box', category: 'design' } ) ).toBe( 'blicks' );
	} );

	it( 'lets a companion block keep its own category', () => {
		expect( blockCategory( { name: 'blicks-kits/trip-cards', category: 'travel' } ) ).toBe( 'travel' );
	} );

	it( 'puts a companion block that names none in Blicks', () => {
		expect( blockCategory( { name: 'acme/thing' } ) ).toBe( 'blicks' );
		expect( blockCategory( { name: 'acme/thing', category: '' } ) ).toBe( 'blicks' );
	} );
} );
