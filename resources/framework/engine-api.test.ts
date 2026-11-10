import { beforeAll, describe, expect, it } from 'vitest';
import { registerBlockType } from '@wordpress/blocks';
import fixture from '../../tests/fixtures/control-glob-cases.json';
import { allowsControl, blockControls, engineApi, isBlicksBlock, problems, validateBlocks } from './engine-api';

beforeAll( () => {
	const base = { category: 'design', attributes: { blicks: { type: 'object' } }, save: () => null, edit: () => null } as any;
	registerBlockType( 'test-engine/card', { ...base, title: 'Card', supports: { blicks: { controls: [ 'spacing.*', 'colors.background' ] } } } );
	registerBlockType( 'test-engine/bare', { ...base, title: 'Bare', supports: { blicks: true } } );
	registerBlockType( 'test-engine/plain', { ...base, title: 'Plain' } );
} );

describe( 'engine API', () => {
	it( 'publishes a frozen, documented surface', () => {
		expect( Object.keys( engineApi ).sort() ).toEqual(
			[ 'allowsControl', 'blockControls', 'control', 'isBlicksBlock', 'problems', 'schema', 'validateBlocks', 'valueSchema' ].sort()
		);
		expect( Object.isFrozen( engineApi ) ).toBe( true );
		expect( engineApi.schema().controls.length ).toBeGreaterThan( 100 );
		expect( engineApi.control( 'spacing.padding' )?.valueShape ).toBe( 'sides' );
		expect( engineApi.valueSchema( 'spacing.padding' ) ).toMatchObject( { title: 'spacing.padding' } );
	} );

	it.each( fixture.cases )( 'allowsControl agrees with the shared table: $why', ( c ) => {
		expect( allowsControl( c.id, c.allow ) ).toBe( c.allowed );
	} );

	it( 'reads a block\'s allow-list from supports.blicks', () => {
		expect( blockControls( 'test-engine/card' ) ).toEqual( [ 'spacing.*', 'colors.background' ] );
		expect( blockControls( 'test-engine/bare' ) ).toEqual( [] );
		expect( blockControls( 'test-engine/plain' ) ).toBeNull();
		expect( blockControls( 'test-engine/missing' ) ).toBeNull();
		expect( isBlicksBlock( 'test-engine/card' ) ).toBe( true );
		expect( isBlicksBlock( 'test-engine/plain' ) ).toBe( false );
	} );

	it( 'never throws on junk input', () => {
		expect( problems( 'nope' ) ).toEqual( [] );
		expect( allowsControl( 'spacing.padding', null as any ) ).toBe( false );
		expect( validateBlocks( null as any ) ).toEqual( { valid: true, problems: [] } );
	} );

	it( 'validates a tree, with paths, recursing through non-Blicks blocks', () => {
		const result = validateBlocks( [
			{
				name: 'test-engine/plain',
				innerBlocks: [
					{ name: 'test-engine/card', attributes: { blicks: { 'spacing.padding': { default: { base: '1rem' } }, 'effects.opacity': { default: { base: '0.5' } } } } },
					{ name: 'test-engine/gone' },
				],
			},
			{ name: 'test-engine/card', attributes: { blicks: { 'colors.background': { sideways: { base: 'red' } } } } },
			7 as any,
		] );

		expect( result.valid ).toBe( false );
		expect( result.problems ).toEqual( [
			{ id: 'effects.opacity', reason: 'not-allowed', path: 'blocks[0].innerBlocks[0]', block: 'test-engine/card' },
			{ path: 'blocks[0].innerBlocks[1]', block: 'test-engine/gone', reason: 'unknown-block' },
			{ id: 'colors.background', slot: 'sideways', reason: 'unknown-slot', path: 'blocks[1]', block: 'test-engine/card' },
			{ path: 'blocks[2]', block: '', reason: 'invalid-block' },
		] );
	} );

	it( 'passes a clean tree', () => {
		expect( validateBlocks( [ { name: 'test-engine/card', attributes: { blicks: { 'spacing.margin': { default: { base: '2px' } } } } } ] ) ).toEqual( { valid: true, problems: [] } );
	} );
} );
