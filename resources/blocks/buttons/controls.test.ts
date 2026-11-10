import { describe, expect, it } from 'vitest';
import { buttonsGapValue, buttonsGrid, readStackPhone, setButtonsOrientation, withButtonsGrid, withStackPhone } from './controls';

describe( 'buttons stack on phones', () => {
	it( 'writes a column only at the phone breakpoint, and clears it again', () => {
		const on = withStackPhone( { 'layout.gapRow': { default: { base: '8px' } } }, true );
		expect( on[ 'layout.flexDirection' ] ).toEqual( { default: { mobile: 'column' } } );
		expect( readStackPhone( on ) ).toBe( true );
		expect( readStackPhone( withStackPhone( on, false ) ) ).toBe( false );
		expect( on[ 'layout.gapRow' ] ).toEqual( { default: { base: '8px' } } );
	} );
} );

describe( 'buttons grid', () => {
	it( 'writes equal columns, two on phones, and reads them back', () => {
		const tree = withButtonsGrid( { 'layout.gapRow': { default: { base: '8px' } } }, 4 );
		expect( tree[ 'layout.display' ] ).toEqual( { default: { base: 'grid' } } );
		expect( tree[ 'layout.gridColumns' ] ).toEqual( { default: { base: 'repeat(4, minmax(0, 1fr))', mobile: 'repeat(2, minmax(0, 1fr))' } } );
		expect( buttonsGrid( tree ) ).toEqual( { columns: 4, phoneTwo: true } );
		expect( buttonsGrid( withButtonsGrid( tree, 3, false ) ) ).toEqual( { columns: 3, phoneTwo: false } );
		expect( withButtonsGrid( {}, 2 )[ 'layout.gridColumns' ] ).toEqual( { default: { base: 'repeat(2, minmax(0, 1fr))' } } );
	} );

	it( 'is not a grid until display says so, and side by side leaves it', () => {
		expect( buttonsGrid( {} ) ).toBeNull();
		let next: any = null;
		setButtonsOrientation( { blicks: withButtonsGrid( {}, 3 ) }, ( a ) => { next = a.blicks; }, 'horizontal' );
		expect( buttonsGrid( next ) ).toBeNull();
		expect( next[ 'layout.gridColumns' ] ).toBeUndefined();
		expect( next[ 'layout.flexDirection' ] ).toEqual( { default: { base: 'row' } } );
	} );
} );

describe( 'buttons space between', () => {
	it( 'offers None as no gap, and still reads the older Tight step', () => {
		expect( buttonsGapValue( 'none' ) ).toBe( '0' );
		expect( buttonsGapValue( 'lg' ) ).toBe( 'var(--blicks-spacing-lg)' );
		expect( buttonsGapValue( 'xs' ) ).toBe( 'var(--blicks-spacing-xs)' );
		expect( buttonsGapValue( 'nope' ) ).toBe( 'var(--blicks-spacing-sm)' );
	} );
} );
