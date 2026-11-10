import { describe, expect, it } from 'vitest';
import { dialogAttributes, freeAnchor, starters } from './starters';

describe( 'starters', () => {
	it( 'each has its blocks and starts with only conservative triggers', () => {
		for ( const s of starters() ) {
			expect( s.inner.length ).toBeGreaterThan( 0 );
			// A delay under 3 s only where nothing blocks the page (the cookie sheet).
			if ( s.triggers.load.on && s.triggers.load.delay < 3 ) expect( s.dialog.modal ).toBe( false );
		}
	} );

	it( 'never reuses a saved dialog’s address', () => {
		const targets = [ { id: 'dialog-newsletter', title: '', modal: true, source: 'saved' }, { id: 'dialog-newsletter-2', title: '', modal: true, source: 'saved' } ];
		expect( freeAnchor( 'newsletter', targets ) ).toBe( 'newsletter-3' );
		expect( freeAnchor( 'offer', targets ) ).toBe( 'offer' );
	} );

	it( 'names the dialog after the starter', () => {
		const [ first ] = starters();
		expect( dialogAttributes( first, 'newsletter' ) ).toMatchObject( { title: first.title, anchor: 'newsletter', kind: 'modal' } );
	} );
} );
