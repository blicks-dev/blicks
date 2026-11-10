/**
 * The editor's reading of a Loop's pagination, as src/Data/Pager.php reads it. The page-number
 * sequence itself is held to the shared fixtures in data.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { paging, perPage, statusText } from './pager';

describe( 'loop pager', () => {
	it( 'is off unless the mode is one the server knows', () => {
		expect( paging( {} ) ).toBeNull();
		expect( paging( { pagination: { mode: 'infinite' as never } } ) ).toBeNull();
		expect( paging( { pagination: { mode: 'more' } } ) ).toEqual( { mode: 'more' } );
	} );

	it( 'takes the limit as the page size, 12 for "every item"', () => {
		expect( perPage( 6 ) ).toBe( 6 );
		expect( perPage( 0 ) ).toBe( 12 );
		expect( perPage( 90 ) ).toBe( 50 );
	} );

	it( 'fills in the count', () => {
		expect( statusText( 'Showing {shown} of {total}', 12, 34 ) ).toBe( 'Showing 12 of 34' );
		expect( statusText( '{shown}/{total}', 40, 34 ) ).toBe( '34/34' );
	} );
} );
