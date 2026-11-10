import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerBlockType } from '@wordpress/blocks';
import { decideInsert, describeTarget, requiredWrapper } from './insert';

const BLOCKS = resolve( __dirname, '../blocks' );

beforeAll( () => {
	for ( const slug of [ 'section', 'box', 'buttons', 'button' ] ) {
		const file = resolve( BLOCKS, slug, 'block.json' );
		const meta = JSON.parse( readFileSync( file, 'utf8' ) );

		registerBlockType( meta.name, { ...meta, save: () => null, edit: () => null } );
	}

	// No Blicks block is parent-restricted any more (a Button may stand alone), so the rule is
	// exercised on a stand-in that is.
	registerBlockType( 'test/tab', { title: 'Tab', category: 'text', parent: [ 'test/tabs' ], attributes: {}, save: () => null, edit: () => null } as any );
} );

describe( 'decideInsert', () => {
	it( 'replaces the origin without asking', () => {
		const decision = decideInsert( { origin: 'abc', originExists: true, selected: null } );

		expect( decision.asks ).toBe( false );
		expect( decision.target ).toEqual( { kind: 'replace-origin', clientId: 'abc' } );
	} );

	it( 'replaces the origin even when something else is selected', () => {
		// The origin was recorded at mount. What is selected ten minutes later is not a signal.
		const decision = decideInsert( { origin: 'abc', originExists: true, selected: 'xyz' } );

		expect( decision.asks ).toBe( false );
		expect( decision.target ).toEqual( { kind: 'replace-origin', clientId: 'abc' } );
	} );

	/**
	 * Deleted in another tab, or the post reverted while the Studio was open. Falling through to the
	 * end of the document silently would look like the Studio losing the work.
	 */
	it( 'asks, and says why, when the origin is gone', () => {
		const decision = decideInsert( { origin: 'abc', originExists: false, selected: null } );

		expect( decision.asks ).toBe( true );
		expect( decision.reason ).toMatch( /no longer in the post/ );
		expect( decision.target ).toEqual( { kind: 'end' } );
	} );

	it( 'offers the selection when the origin is gone but something is selected', () => {
		const decision = decideInsert( { origin: 'abc', originExists: false, selected: 'xyz' } );

		expect( decision.asks ).toBe( true );
		expect( decision.target ).toEqual( { kind: 'after', clientId: 'xyz' } );
	} );

	it( 'asks with the selection preselected when there is no origin', () => {
		const decision = decideInsert( { origin: null, originExists: false, selected: 'xyz' } );

		expect( decision.asks ).toBe( true );
		expect( decision.reason ).toBe( '' );
		expect( decision.target ).toEqual( { kind: 'after', clientId: 'xyz' } );
	} );

	/** Never writes at the top of a post without being told. */
	it( 'asks with the end preselected when there is no origin and no selection', () => {
		const decision = decideInsert( { origin: null, originExists: false, selected: null } );

		expect( decision.asks ).toBe( true );
		expect( decision.target ).toEqual( { kind: 'end' } );
	} );
} );

describe( 'requiredWrapper', () => {
	it( 'is null for a block that can live at post root', () => {
		expect( requiredWrapper( [ { name: 'blicks/section' } ] ) ).toBeNull();
	} );

	it( 'is null for a Button, which may stand alone', () => {
		expect( requiredWrapper( [ { name: 'blicks/button' } ] ) ).toBeNull();
	} );

	/**
	 * A block that declares `parent` cannot go at post root when mounted alone — from pasted JSON —
	 * and inserting it anyway produces content WordPress flags as invalid the moment it renders.
	 */
	it( 'names the parent a restricted root needs', () => {
		expect( requiredWrapper( [ { name: 'test/tab' } ] ) ).toBe( 'test/tabs' );
	} );

	it( 'wraps several restricted roots that agree', () => {
		expect( requiredWrapper( [ { name: 'test/tab' }, { name: 'test/tab' } ] ) ).toBe( 'test/tabs' );
	} );

	/**
	 * A mixed set has no single right answer, and picking one would drop the others into a parent
	 * that refuses them — trading a visible invalid-content warning for a silent loss.
	 */
	it( 'declines to wrap when the roots disagree', () => {
		expect(
			requiredWrapper( [ { name: 'test/tab' }, { name: 'blicks/section' } ] )
		).toBeNull();
	} );

	it( 'is null for an empty canvas', () => {
		expect( requiredWrapper( [] ) ).toBeNull();
	} );

	it( 'is null for a block this site does not have', () => {
		expect( requiredWrapper( [ { name: 'nope/at-all' } ] ) ).toBeNull();
	} );
} );

describe( 'describeTarget', () => {
	const nameOf = ( id: string ) => ( { abc: 'Hero', xyz: 'Plans' } )[ id ] ?? id;

	it( 'says what the button will do', () => {
		expect( describeTarget( { kind: 'replace-origin', clientId: 'abc' }, nameOf ) ).toBe(
			'Replaces Hero'
		);
		expect( describeTarget( { kind: 'after', clientId: 'xyz' }, nameOf ) ).toBe( 'After Plans' );
		expect( describeTarget( { kind: 'end' }, nameOf ) ).toBe( 'At the end of the post' );
	} );
} );
