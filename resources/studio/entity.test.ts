import { describe, expect, it, vi } from 'vitest';
import { ENTITY_PATH, entityPersist, entityQuery } from './entity';
import type { BlockNode } from './mount';

const parse = ( content: string ): BlockNode[] => ( content ? [ { name: 'blicks/box', attributes: { content } } ] : [] );
const serialize = ( blocks: BlockNode[] ): string => blocks.map( ( block ) => `<!-- ${ block.name } -->` ).join( '' );
const word = ( n: number ): string => `Used on ${ n } pages`;

describe( 'entityQuery', () => {
	it( 'sends the kind, id and type only', () => {
		expect( entityQuery( { kind: 'post', type: 'blicks_dialog', id: 12, secret: 'x' } ) ).toBe( 'kind=post&id=12&type=blicks_dialog' );
		expect( entityQuery( { kind: 'template-part', id: 'theme//header' } ) ).toBe( 'kind=template-part&id=theme%2F%2Fheader' );
	} );
} );

describe( 'entityPersist', () => {
	it( 'loads blocks, a label and how widely the entity is used', async () => {
		const fetch = vi.fn( async () => ( { content: 'hello', title: 'Main header', usedOn: [ { id: '1', title: 'Home', kind: 'template' }, { id: '2', title: 'Page', kind: 'template' } ] } ) );
		const loaded = await entityPersist( fetch, parse, serialize, word ).load( { kind: 'template-part', id: 'theme//header' } );

		expect( fetch ).toHaveBeenCalledWith( { path: `${ ENTITY_PATH }?kind=template-part&id=theme%2F%2Fheader` } );
		expect( loaded ).toEqual( { blocks: parse( 'hello' ), label: 'Main header', note: 'Used on 2 pages' } );
	} );

	it( 'says nothing about use when nothing uses it, and survives a thin answer', async () => {
		const loaded = await entityPersist( async () => ( {} ), parse, serialize, word ).load( { kind: 'post', type: 'x', id: 1 } );

		expect( loaded ).toEqual( { blocks: [], label: '', note: '' } );
	} );

	it( 'saves the serialized tree to the same entity', async () => {
		const fetch = vi.fn( async () => ( { content: '', title: '', usedOn: [] } ) );
		await entityPersist( fetch, parse, serialize, word ).save( [ { name: 'blicks/box' } ], { kind: 'post', type: 'blicks_dialog', id: 7 } );

		expect( fetch ).toHaveBeenCalledWith( {
			path: `${ ENTITY_PATH }?kind=post&id=7&type=blicks_dialog`,
			method: 'POST',
			data: { content: '<!-- blicks/box -->' },
		} );
	} );

	it( 'lets a failed request reach the Studio, which shows its message at the door', async () => {
		const failing = entityPersist( async () => { throw new Error( 'You cannot edit this header.' ); }, parse, serialize, word );

		await expect( failing.save( [], { kind: 'template-part', id: 'x' } ) ).rejects.toThrow( 'You cannot edit this header.' );
	} );
} );
