import { describe, expect, it } from 'vitest';
import { findStyleProblems } from './vars';

const at = ( value: unknown, slot = 'default', bp = 'base' ) => ( { [ slot ]: { [ bp ]: value } } );

describe( 'findStyleProblems', () => {
	it( 'finds nothing in a clean tree', () => {
		expect( findStyleProblems( {
			'spacing.padding': at( { top: '16px', left: 'md' } ),
			'effects.boxShadow': at( [ { token: 'sm' }, { x: '0px', y: '2px', blur: '4px', spread: '0px', color: 'primary' } ] ),
			'colors.text': at( 'primary', 'hover' ),
			'meta.look': { anything: true },
		}, [ 'spacing.*', 'effects.*', 'colors.text' ] ) ).toEqual( [] );
	} );

	it( 'reports controls the block does not allow, and unknown ones', () => {
		expect( findStyleProblems( { 'layout.display': at( 'grid' ), 'made.up': at( 'x' ) }, [ 'spacing.*' ] ) ).toEqual( [
			{ id: 'layout.display', reason: 'not-allowed' },
			{ id: 'made.up', reason: 'unknown-control' },
		] );
	} );

	it( 'reports a shadow with one bad layer, since the whole shadow is dropped', () => {
		const shadow = [ { token: 'sm' }, { x: '0px', y: '2px', blur: 'oops;', color: 'red' } ];
		expect( findStyleProblems( { 'effects.boxShadow': at( shadow ) } ) ).toEqual( [
			{ id: 'effects.boxShadow', slot: 'default', breakpoint: 'base', reason: 'invalid-value', value: shadow },
		] );
	} );

	it( 'reports a bad side, an unknown slot or breakpoint, and a control a part cannot take', () => {
		const problems = findStyleProblems( {
			'spacing.margin': at( { top: 'calc(1px; 2px)' } ),
			'spacing.padding': { wobble: { base: '1px' }, default: { desktop: '1px' } },
			'columns.breakInside': at( 'avoid', 'before' ),
		} );
		expect( problems.map( ( p ) => [ p.id, p.reason ] ) ).toEqual( [
			[ 'spacing.margin', 'invalid-value' ],
			[ 'spacing.padding', 'unknown-slot' ],
			[ 'spacing.padding', 'unknown-breakpoint' ],
			[ 'columns.breakInside', 'not-on-part' ],
		] );
	} );
} );
