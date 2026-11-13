// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { getBlockType, registerBlockType, createBlock } from '@wordpress/blocks';
import { bindBlocks } from './canvas';

const bound = ( key: string ) => ( { metadata: { bindings: { content: { source: 'blicks/item', args: { key } } } } } );

beforeAll( () => {
	for ( const name of [ 'blicks/heading', 'blicks/loop' ] ) {
		if ( ! getBlockType( name ) ) {
			registerBlockType( name, {
				title: name,
				category: 'design',
				attributes: {
					content: { type: 'string', bindable: { selector: ':root' } },
					source: { type: 'string' },
					path: { type: 'string' },
					uniqueId: { type: 'string' },
					metadata: { type: 'object' },
				},
				edit: () => null,
				save: () => null,
			} as never );
		}
	}
} );

describe( 'bindBlocks', () => {
	it( 'writes the item into the card but copies a Loop inside it untouched', () => {
		const inner = createBlock( 'blicks/loop', { source: 'item', path: 'days' }, [ createBlock( 'blicks/heading', { content: 'Day', ...bound( 'title' ) } ) ] );
		const out = bindBlocks( [ createBlock( 'blicks/heading', { content: 'Trip', ...bound( 'title' ) } ), inner ], { title: 'Everest', days: [ { title: 'Fly to Lukla' } ] }, [] );

		expect( out[ 0 ].attributes.content ).toBe( 'Everest' );
		expect( out[ 1 ].name ).toBe( 'blicks/loop' );
		expect( out[ 1 ].attributes.path ).toBe( 'days' );
		expect( out[ 1 ].innerBlocks[ 0 ].attributes.content ).toBe( 'Day' );
	} );

	it( 'still lets a card rule hide the inner Loop', () => {
		const inner = createBlock( 'blicks/loop', { source: 'item', uniqueId: 'in1' } as never, [] );

		expect( bindBlocks( [ inner ], {}, [ 'in1' ] ) ).toEqual( [] );
	} );
} );
