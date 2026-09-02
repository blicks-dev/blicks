import { describe, expect, it } from 'vitest';
import { SHAPE_PRESETS, shapeToCss, shapeToSvgPoints } from './shape-presets';

describe( 'shape-presets', () => {
	it( 'every preset has at least 3 points', () => {
		expect( SHAPE_PRESETS.length ).toBeGreaterThan( 0 );
		SHAPE_PRESETS.forEach( ( s ) => expect( s.points.length ).toBeGreaterThanOrEqual( 3 ) );
	} );

	it( 'builds a CSS polygon() from percentage points', () => {
		expect( shapeToCss( [ [ 50, 0 ], [ 100, 100 ], [ 0, 100 ] ] ) ).toBe( 'polygon(50% 0%, 100% 100%, 0% 100%)' );
	} );

	it( 'builds SVG points scaled to a 20-unit viewBox', () => {
		expect( shapeToSvgPoints( [ [ 0, 0 ], [ 100, 100 ], [ 50, 0 ] ] ) ).toBe( '0.00,0.00 20.00,20.00 10.00,0.00' );
	} );
} );
