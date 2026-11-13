import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DATA_KEYS, dataAttributes } from './use-items';

describe( 'the attributes the editor sends for a Loop’s items', () => {
	it( 'carries a registered source’s settings, so changing them reaches the preview', () => {
		const out = dataAttributes( { source: 'acme/things', sourceArgs: { which: 'pick', trip: 7 }, columns: 3 } );

		expect( out ).toEqual( { source: 'acme/things', sourceArgs: { which: 'pick', trip: 7 } } );
	} );

	it( 'names every attribute the server reads to choose the items (LoopAttributes::sanitize)', () => {
		const php = readFileSync( new URL( '../../../src/Data/LoopAttributes.php', import.meta.url ), 'utf8' );
		const read = new Set( [ ...php.matchAll( /\$attrs\['([a-zA-Z]+)'\]/g ) ].map( ( m ) => m[ 1 ] ) );

		expect( read.size ).toBeGreaterThan( 5 );
		for ( const key of read ) {
			expect( DATA_KEYS, key ).toContain( key );
		}
	} );
} );
