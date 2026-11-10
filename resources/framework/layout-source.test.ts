import { describe, expect, it } from 'vitest';
import { gapToken, orientationOf, withStyleLayout, wrapOf } from './layout-source';

const READERS = {
	orientation: [ 'layout.flexDirection', orientationOf ],
	gap: [ 'layout.gapRow', gapToken ],
	wrap: [ 'layout.flexWrap', wrapOf ],
} as const;

describe( 'layout values: the style value wins', () => {
	it( 'keeps the attribute when no style value is set', () => {
		expect( withStyleLayout( { orientation: 'horizontal', gap: 'sm', wrap: true }, READERS as any ) ).toEqual( { orientation: 'horizontal', gap: 'sm', wrap: true } );
	} );

	it( 'reads the style value back in the attribute’s shape', () => {
		const blicks = { 'layout.flexDirection': { default: { base: 'column' } }, 'layout.gapRow': { default: { base: 'var(--blicks-spacing-lg)' } }, 'layout.flexWrap': { default: { base: 'nowrap' } } };
		expect( withStyleLayout( { orientation: 'horizontal', gap: 'sm', wrap: true, blicks }, READERS as any ) ).toMatchObject( { orientation: 'vertical', gap: 'lg', wrap: false } );
	} );

	it( 'leaves the attribute alone for a style value it cannot name', () => {
		const blicks = { 'layout.gapRow': { default: { base: '13px' } } };
		expect( withStyleLayout( { gap: 'sm', blicks }, READERS as any ).gap ).toBe( 'sm' );
	} );
} );
