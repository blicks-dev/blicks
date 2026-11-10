import { describe, expect, it } from 'vitest';
import { APPEARANCES, cleanAppearance } from './model';
import { addOption, moveOption, optionRows, rangeBounds, rangeText, removeOption, rowsToAttributes, setNote, setOption, trimNotes } from './create';

const rows = () => optionRows( { options: [ 'Portrait', 'Wedding', 'Event' ], optionNotes: [ 'Headshots', '', '£400' ] } );

describe( 'a choice’s options and their notes', () => {
	it( 'read one note per option, padded or cut', () => {
		expect( optionRows( { options: [ 'A', 'B' ], optionNotes: [ 'one' ] } ) ).toEqual( { options: [ 'A', 'B' ], notes: [ 'one', '' ] } );
		expect( optionRows( { options: [ 'A' ], optionNotes: [ 'one', 'two' ] } ).notes ).toEqual( [ 'one' ] );
		expect( optionRows( {} ) ).toEqual( { options: [], notes: [] } );
	} );

	it( 'save notes without trailing empties, and none as []', () => {
		expect( trimNotes( [ 'a', '', 'b', '', '' ] ) ).toEqual( [ 'a', '', 'b' ] );
		expect( rowsToAttributes( { options: [ 'A', 'B' ], notes: [ '', '' ] } ) ).toEqual( { options: [ 'A', 'B' ], optionNotes: [] } );
	} );

	it( 'edit an option or a note without touching the other', () => {
		expect( setOption( rows(), 1, 'Elopement' ) ).toEqual( { options: [ 'Portrait', 'Elopement', 'Event' ], notes: [ 'Headshots', '', '£400' ] } );
		expect( setNote( rows(), 1, 'Two hours' ).notes ).toEqual( [ 'Headshots', 'Two hours', '£400' ] );
	} );

	it( 'add a row with an empty note', () => {
		expect( addOption( rows() ) ).toEqual( { options: [ 'Portrait', 'Wedding', 'Event', '' ], notes: [ 'Headshots', '', '£400', '' ] } );
	} );

	it( 'remove a row with its note', () => {
		expect( removeOption( rows(), 0 ) ).toEqual( { options: [ 'Wedding', 'Event' ], notes: [ '', '£400' ] } );
	} );

	it( 'move a note with its option', () => {
		const moved = moveOption( rows(), 2, -2 );
		expect( moved ).toEqual( { options: [ 'Event', 'Portrait', 'Wedding' ], notes: [ '£400', 'Headshots', '' ] } );
		expect( rowsToAttributes( moved ).optionNotes ).toEqual( [ '£400', 'Headshots' ] );
		expect( moveOption( rows(), 0, -1 ) ).toEqual( rows() );
	} );
} );

describe( 'appearances', () => {
	it( 'save the default as empty, and drop a look the type has not got', () => {
		expect( cleanAppearance( 'choice', 'list' ) ).toBe( '' );
		expect( cleanAppearance( 'choice', 'cards' ) ).toBe( 'cards' );
		expect( cleanAppearance( 'consent', 'switch' ) ).toBe( 'switch' );
		expect( cleanAppearance( 'number', 'stepper' ) ).toBe( 'stepper' );
		// A type change keeps nothing the new type cannot draw.
		expect( cleanAppearance( 'select', 'chips' ) ).toBe( '' );
		expect( cleanAppearance( 'consent', 'chips' ) ).toBe( '' );
		expect( Object.keys( APPEARANCES ) ).toEqual( [ 'choice', 'consent', 'number' ] );
	} );
} );

describe( 'a slider’s numbers', () => {
	it( 'run 0 to 100 by 1 and start in the middle by default', () => {
		expect( rangeBounds( {} ) ).toEqual( { min: 0, max: 100, step: 1, value: 50 } );
	} );

	it( 'start on a step, and keep the start value within the bounds', () => {
		expect( rangeBounds( { min: '150', max: '1500', step: '50' } ).value ).toBe( 850 );
		expect( rangeBounds( { min: '150', max: '1500', step: '50', defaultValue: '400' } ).value ).toBe( 400 );
		expect( rangeBounds( { min: '0', max: '10', defaultValue: '99' } ).value ).toBe( 10 );
		expect( rangeBounds( { min: '10', max: '5' } ) ).toMatchObject( { min: 10, max: 10 } );
	} );

	it( 'read with the prefix and suffix around the number', () => {
		expect( rangeText( 400, { prefix: '£' } ) ).toBe( '£400' );
		expect( rangeText( 5, { suffix: '+' } ) ).toBe( '5+' );
	} );
} );
