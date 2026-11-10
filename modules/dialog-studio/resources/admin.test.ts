import { describe, expect, it } from 'vitest';
import { editLink, openersLine } from './admin';
import { rate } from './results';

describe( 'the Dialogs view', () => {
	it( 'edits in the Studio, through the editor’s address', () => {
		const link = editLink( 'https://example.test/wp-admin/post.php?action=edit&post=', 12 );
		expect( link.startsWith( 'https://example.test/wp-admin/post.php?action=edit&post=12&blicks-studio=' ) ).toBe( true );
		expect( decodeURIComponent( link.split( 'blicks-studio=' )[ 1 ] ) ).toBe( 'ref:dialog:{"kind":"post","type":"blicks_dialog","id":12}' );
	} );

	it( 'says what opens it', () => {
		expect( openersLine( { buttons: 0, pages: 0 } ) ).toBe( 'Not opened by any Button or link' );
		expect( openersLine( { buttons: 4, pages: 3 } ) ).toBe( 'Opened by 4 buttons or links on 3 pages' );
	} );

	it( 'gives a rate only when something was shown', () => {
		expect( rate( 0, 0 ) ).toBe( '–' );
		expect( rate( 8, 1 ) ).toBe( '12.5%' );
	} );
} );
