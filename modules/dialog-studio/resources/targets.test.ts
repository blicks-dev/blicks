import { describe, expect, it } from 'vitest';
import { withSaved } from './targets';

describe( 'saved dialogs in the picker', () => {
	const saved = [
		{ id: 'dialog-newsletter', title: 'Newsletter', modal: true, source: 'saved' },
		{ id: 'dialog-guide', title: 'Saved guide', modal: true, source: 'saved' },
	];

	it( 'follow the page’s own, and never shadow one the page holds', () => {
		const page = [ { id: 'dialog-guide', title: 'Guide', modal: true, source: 'page' } ];
		expect( withSaved( page, saved ).map( ( t ) => `${ t.id }:${ t.source }` ) ).toEqual( [ 'dialog-guide:page', 'dialog-newsletter:saved' ] );
	} );

	it( 'survive a filter before them returning nonsense', () => {
		expect( withSaved( null, saved ) ).toHaveLength( 2 );
	} );
} );
