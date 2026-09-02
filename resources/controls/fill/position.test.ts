import { describe, expect, it } from 'vitest';
import { formatPosition, offsetFor, parsePosition, positionFromDrag, resolveBackgroundSize } from './position';
import { validateSpaced } from '@/controls/validate';

describe( 'parsePosition', () => {
	it( 'centres an empty value', () => {
		expect( parsePosition( '' ) ).toEqual( { x: 50, y: 50 } );
	} );

	it( 'reads the keyword pairs the old nine-cell grid wrote', () => {
		expect( parsePosition( 'left top' ) ).toEqual( { x: 0, y: 0 } );
		expect( parsePosition( 'right bottom' ) ).toEqual( { x: 100, y: 100 } );
		expect( parsePosition( 'center center' ) ).toEqual( { x: 50, y: 50 } );
	} );

	it( 'reads percentages', () => {
		expect( parsePosition( '28% 72%' ) ).toEqual( { x: 28, y: 72 } );
	} );

	// `background-position: top` is centred horizontally. Reading the lone keyword as an X value
	// would move the image sideways on a value that never mentioned X.
	it( 'treats a lone vertical keyword as the Y axis', () => {
		expect( parsePosition( 'top' ) ).toEqual( { x: 50, y: 0 } );
		expect( parsePosition( 'bottom' ) ).toEqual( { x: 50, y: 100 } );
		expect( parsePosition( 'left' ) ).toEqual( { x: 0, y: 50 } );
	} );

	it( 'clamps and tolerates junk rather than throwing', () => {
		expect( parsePosition( '150% -20%' ) ).toEqual( { x: 100, y: 0 } );
		expect( parsePosition( 'nonsense here' ) ).toEqual( { x: 50, y: 50 } );
	} );

	it( 'round-trips the keyword thirds', () => {
		for ( const value of [ 'left top', 'center top', 'right center', 'left bottom', 'right bottom' ] ) {
			const { x, y } = parsePosition( value );
			expect( formatPosition( x, y ) ).toBe( value );
		}
	} );
} );

describe( 'formatPosition', () => {
	it( 'prefers keywords on the thirds', () => {
		expect( formatPosition( 0, 0 ) ).toBe( 'left top' );
		expect( formatPosition( 50, 100 ) ).toBe( 'center bottom' );
	} );

	it( 'falls back to percentages elsewhere', () => {
		expect( formatPosition( 28, 72 ) ).toBe( '28% 72%' );
		expect( formatPosition( 0, 72 ) ).toBe( 'left 72%' );
	} );
} );

describe( 'validateSpaced', () => {
	const PAIR = /^(left|center|right|top|bottom|\d+%)( (left|center|right|top|bottom|\d+%))?$/;

	// The regression this exists for: `validateOrEmpty` deletes every space, so `right bottom`
	// became `rightbottom`, failed, and cleared the field the author had just filled in.
	it( 'keeps a single space between the parts', () => {
		expect( validateSpaced( 'right bottom', PAIR ) ).toBe( 'right bottom' );
		expect( validateSpaced( '  right   bottom  ', PAIR ) ).toBe( 'right bottom' );
	} );

	it( 'still rejects what the pattern rejects', () => {
		expect( validateSpaced( 'garbage!!', PAIR ) ).toBe( '' );
		expect( validateSpaced( '', PAIR ) ).toBe( '' );
	} );
} );

describe( 'resolveBackgroundSize', () => {
	const box = { w: 200, h: 100 };
	const natural = { w: 400, h: 400 };

	it( 'renders at intrinsic size when unset or auto', () => {
		expect( resolveBackgroundSize( box, natural, '' ) ).toEqual( natural );
		expect( resolveBackgroundSize( box, natural, 'auto' ) ).toEqual( natural );
	} );

	it( 'covers the box on its larger ratio and contains it on its smaller', () => {
		expect( resolveBackgroundSize( box, natural, 'cover' ) ).toEqual( { w: 200, h: 200 } );
		expect( resolveBackgroundSize( box, natural, 'contain' ) ).toEqual( { w: 100, h: 100 } );
	} );

	it( 'reads percentages against the box and lengths as themselves', () => {
		expect( resolveBackgroundSize( box, natural, '50% 25%' ) ).toEqual( { w: 100, h: 25 } );
		expect( resolveBackgroundSize( box, natural, '80px 40px' ) ).toEqual( { w: 80, h: 40 } );
	} );

	it( 'takes the missing axis from the aspect ratio, as CSS does', () => {
		expect( resolveBackgroundSize( box, { w: 400, h: 200 }, '100px' ) ).toEqual( { w: 100, h: 50 } );
		expect( resolveBackgroundSize( box, { w: 400, h: 200 }, 'auto 50px' ) ).toEqual( { w: 100, h: 50 } );
	} );

	it( 'gives up rather than guessing when the image has no size yet', () => {
		expect( resolveBackgroundSize( box, { w: 0, h: 0 }, 'cover' ) ).toEqual( { w: 0, h: 0 } );
	} );
} );

describe( 'positionFromDrag', () => {
	// An image smaller than its box slides forward as the percentage grows.
	it( 'moves a small image the same way as the pointer', () => {
		expect( offsetFor( 200, 100, 0 ) ).toBe( 0 );
		expect( positionFromDrag( 200, 100, 0, 50 ) ).toBe( 50 );
	} );

	// A larger-than-box image slides backward — which is exactly why the author should be dragging
	// the picture rather than doing this arithmetic in their head.
	it( 'moves an oversized image the same way as the pointer too', () => {
		expect( positionFromDrag( 200, 400, 100, 100 ) ).toBe( 50 );
	} );

	it( 'stops at the edges instead of running past them', () => {
		expect( positionFromDrag( 200, 400, 0, 100 ) ).toBe( 0 );
		expect( positionFromDrag( 200, 100, 100, 500 ) ).toBe( 100 );
	} );

	// Every percentage renders an exactly-fitting image in the same place, so a drag along that
	// axis is no movement at all — and writing a number for it would be a lie.
	it( 'reports no movement on an axis with no slack', () => {
		expect( positionFromDrag( 200, 200, 50, 40 ) ).toBeNull();
	} );
} );
