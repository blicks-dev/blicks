import { describe, expect, it, vi } from 'vitest';
import { choiceControls, choiceLabel, newTabAttributes } from './toolbar-model';

const OPTS = [ [ 'sm', 'Small' ], [ 'md', 'Medium' ], [ '', 'None' ] ] as const;

describe( 'choiceLabel', () => {
	it( 'names the current value', () => {
		expect( choiceLabel( OPTS, 'md' ) ).toBe( 'Medium' );
		expect( choiceLabel( OPTS, undefined ) ).toBe( 'None' );
	} );
	it( 'falls back for an unknown value', () => {
		expect( choiceLabel( OPTS, 'xl', 'Custom' ) ).toBe( 'Custom' );
	} );
} );

describe( 'choiceControls', () => {
	it( 'marks the current option and writes a new one', () => {
		const onChange = vi.fn();
		const rows = choiceControls( OPTS, 'sm', onChange );
		expect( rows.map( ( r ) => [ r.title, r.isActive ] ) ).toEqual( [ [ 'Small', true ], [ 'Medium', false ], [ 'None', false ] ] );
		rows[ 1 ].onClick();
		expect( onChange ).toHaveBeenCalledWith( 'md' );
	} );
	it( 'does not write when the current option is picked again', () => {
		const onChange = vi.fn();
		choiceControls( OPTS, 'sm', onChange )[ 0 ].onClick();
		expect( onChange ).not.toHaveBeenCalled();
	} );
	it( 'leaves out disabled options', () => {
		const rows = choiceControls( OPTS, 'sm', () => {}, ( v ) => v === '' );
		expect( rows.map( ( r ) => r.title ) ).toEqual( [ 'Small', 'Medium' ] );
	} );
} );

describe( 'newTabAttributes', () => {
	it( 'writes target and rel together', () => {
		expect( newTabAttributes( true ) ).toEqual( { linkTarget: '_blank', rel: 'noreferrer noopener' } );
		expect( newTabAttributes( true, 'noopener' ) ).toEqual( { linkTarget: '_blank', rel: 'noopener' } );
		expect( newTabAttributes( false ) ).toEqual( { linkTarget: '', rel: '' } );
	} );
} );
