import { describe, expect, it } from 'vitest';
import { textKind, withTextKind } from './controls';

describe( 'Text kind', () => {
	it( 'reads the type role, else the old Lead variant, else Body', () => {
		expect( textKind( {} ) ).toBe( 'body' );
		expect( textKind( { variant: 'lead' } ) ).toBe( 'lead' );
		expect( textKind( { variant: 'lead', blicks: { 'typography.role': { default: { base: 'caption' } } } } ) ).toBe( 'caption' );
	} );

	it( 'writes the role and retires the variant, so they never disagree', () => {
		expect( withTextKind( { variant: 'lead' }, 'small' ) ).toEqual( { variant: 'default', blicks: { 'typography.role': { default: { base: 'small' } } } } );
		expect( withTextKind( { blicks: { 'typography.role': { default: { base: 'lead' } } } }, 'body' ) ).toEqual( { variant: 'default', blicks: {} } );
	} );
} );
