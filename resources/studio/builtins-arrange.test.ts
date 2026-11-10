import { describe, expect, it } from 'vitest';
import { applyArrange, arrangeDefaults } from '@/blocks/box/model';
import { GRID, STACK } from './builtins';

/* The built-in compositions write Box arrangements as data, to keep the Box model out of the Studio
   bundle. They must stay exactly what the Box's own Arrange writes, or Settings reads them as Custom. */
describe( 'built-in Box arrangements', () => {
	it( 'match the Box model', () => {
		expect( STACK ).toEqual( applyArrange( {}, 'stack', { ...arrangeDefaults( 'stack' ), stretch: 'yes' } ).tree );
		expect( GRID ).toEqual( applyArrange( {}, 'grid', { ...arrangeDefaults( 'grid' ), gmode: 'fit', minW: 240, colsPhone: false } ).tree );
	} );
} );
