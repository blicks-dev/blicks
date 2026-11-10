import { describe, expect, it } from 'vitest';
import { cleanAdjust, cleanAspectRatio, figureLook, filterCss, needsFrame, parseRatio, widthCss } from './model';

describe( 'image model', () => {
	it( 'writes nothing for an image saved before these settings', () => {
		expect( figureLook( { caption: 'Hi', capPos: 'below', phoneFull: true } ) ).toEqual( { classes: [], style: {} } );
		expect( needsFrame( { caption: 'Hi', capPos: 'below' } ) ).toBe( false );
		expect( filterCss( null, null ) ).toBeUndefined();
	} );

	it( 'takes a typed shape and refuses a zero side', () => {
		expect( parseRatio( '21:9' ) ).toBe( '21/9' );
		expect( parseRatio( ' 2.35 / 1 ' ) ).toBe( '2.35/1' );
		expect( parseRatio( '0/9' ) ).toBeNull();
		expect( parseRatio( 'wide' ) ).toBeNull();
		expect( cleanAspectRatio( '21/9' ) ).toBe( '21/9' );
	} );

	it( 'sizes and lines up a narrower image', () => {
		expect( widthCss( 'md' ) ).toBe( '400px' );
		expect( widthCss( '60%' ) ).toBe( '60%' );
		expect( widthCss( 'calc(1px)' ) ).toBe( '' );
		const look = figureLook( { width: 'sm', lineUp: 'end', phoneFull: false } );
		expect( look.classes ).toEqual( [ 'bl-image--w', 'bl-image--end', 'bl-image--keep-phone' ] );
		expect( look.style ).toEqual( { '--bl-img-w': '240px' } );
	} );

	it( 'ignores line-up without a width', () => {
		expect( figureLook( { lineUp: 'end' } ).classes ).toEqual( [] );
	} );

	it( 'draws a frame for a shade, an overlaid caption or a hover', () => {
		expect( needsFrame( { dim: 'light' } ) ).toBe( true );
		expect( needsFrame( { capPos: 'over', caption: 'Hi' } ) ).toBe( true );
		expect( needsFrame( { capPos: 'over', caption: '' } ) ).toBe( false );
		expect( needsFrame( { hover: 'zoom' } ) ).toBe( true );
		expect( figureLook( { dim: 'strong', hover: 'zoom', capPos: 'over', caption: 'Hi' } ) ).toEqual( {
			classes: [ 'bl-image--cap-over', 'bl-image--dim', 'bl-image--hover-zoom' ],
			style: { '--bl-img-dim': '60%' },
		} );
	} );

	it( 'keeps adjustments in range and drops unchanged ones', () => {
		expect( cleanAdjust( { b: 100, c: 100, s: 100, blur: 0 } ) ).toBeNull();
		expect( cleanAdjust( { b: 400, s: 0, blur: -3 } ) ).toEqual( { b: 150, s: 0 } );
		expect( filterCss( 'duo', { b: 120, s: 0 } ) ).toBe( 'url(#duo) brightness(1.2) saturate(0)' );
	} );
} );
