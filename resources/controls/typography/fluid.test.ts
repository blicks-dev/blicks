import { describe, expect, it } from 'vitest';
import { toRem, fromRem, buildFluidClamp, parseFluidClamp } from './fluid';

describe( 'fluid type', () => {
	it( 'parses sizes to rem', () => {
		expect( toRem( '1rem' ) ).toBe( 1 );
		expect( toRem( '16px' ) ).toBe( 1 );
		expect( toRem( '32' ) ).toBe( 2 );
		expect( toRem( '' ) ).toBeNull();
		expect( toRem( '2em' ) ).toBeNull();
	} );

	it( 'builds a clamp scaling min→max over the viewport band', () => {
		const out = buildFluidClamp( '16px', '32px' );
		expect( out ).toMatch( /^clamp\(1rem, calc\([-\d.]+rem \+ [\d.]+vw\), 2rem\)$/ );
	} );

	it( 'orders min/max regardless of input order', () => {
		expect( buildFluidClamp( '2rem', '1rem' ) ).toBe( buildFluidClamp( '1rem', '2rem' ) );
	} );

	it( 'returns null when sizes are equal or unparseable', () => {
		expect( buildFluidClamp( '1rem', '1rem' ) ).toBeNull();
		expect( buildFluidClamp( '1rem', '5%' ) ).toBeNull();
	} );

	it( 'formats rem back to whole pixels when it lands on one', () => {
		expect( fromRem( 1 ) ).toBe( '16px' );
		expect( fromRem( 1.75 ) ).toBe( '28px' );
		expect( fromRem( 1.001 ) ).toBe( '1.001rem' );
	} );

	it( 'round-trips its own clamp back to the authored min/max', () => {
		const out = buildFluidClamp( '16px', '28px' ) as string;
		expect( parseFluidClamp( out ) ).toEqual( { min: '16px', max: '28px' } );
	} );

	it( 'leaves anything it did not author alone', () => {
		expect( parseFluidClamp( '16px' ) ).toBeNull();
		expect( parseFluidClamp( '' ) ).toBeNull();
		// hand-written clamps use their own preferred term — not this module's shape
		expect( parseFluidClamp( 'clamp(1rem, 5vw, 2rem)' ) ).toBeNull();
		expect( parseFluidClamp( 'clamp(1rem, calc(0.5rem + 2vw), 2rem) !important' ) ).toBeNull();
	} );
} );
