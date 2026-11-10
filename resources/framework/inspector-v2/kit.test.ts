import { describe, expect, it } from 'vitest';
import { cleanLength } from './kit';

describe( 'cleanLength', () => {
	it( 'reads a bare number as px and keeps CSS lengths', () => {
		expect( cleanLength( '24' ) ).toBe( '24px' );
		expect( cleanLength( ' 1.5rem ' ) ).toBe( '1.5rem' );
		expect( cleanLength( '0' ) ).toBe( '0' );
		expect( cleanLength( '2.5em' ) ).toBe( '2.5em' );
		expect( cleanLength( '4vw' ) ).toBe( '4vw' );
	} );

	it( 'refuses anything that is not one length', () => {
		for ( const bad of [ '', 'big', '-4px', '10px 20px', '1px;color:red', 'calc(1px)' ] ) expect( cleanLength( bad ), bad ).toBeNull();
	} );
} );
