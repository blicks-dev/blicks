import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { modes } from './registry';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerBlockType, createBlock } from '@wordpress/blocks';
import {
	MountError,
	blicksAncestors,
	blocksFromJson,
	detach,
	modeOf,
	mountBlank,
	mountJson,
	mountPattern,
	mountSelection,
	mountSelectionAt,
	onlyIdentity,
	toPortableJson,
	type BlockNode,
} from './mount';

/**
 * Registered from the free plugin's own `block.json`, like the apply path's tests, and for the same
 * reason: an attribute list written out twice is a list that drifts.
 *
 * `blicks/scene` is deliberately NOT registered. It does not exist in the free plugin — the engine
 * ships the `sceneChild.*` control ids a stage needs, but the block itself is Pro's — so a test
 * that registered it here would be asserting against a world that does not occur.
 */
const BLOCKS = resolve( __dirname, '../blocks' );

beforeAll( () => {
	/* `core/missing` is what WordPress turns an unregistered block into; cloning needs its type. */
	registerBlockType( 'core/missing', {
		title: 'Unsupported',
		category: 'text',
		attributes: {
			originalName: { type: 'string' },
			originalContent: { type: 'string' },
			originalUndelimitedContent: { type: 'string' },
		},
		save: ( { attributes }: never ) =>
			( attributes as { originalContent?: string } ).originalContent ?? null,
		edit: () => null,
	} as never );

	for ( const slug of [ 'section', 'box', 'heading', 'text' ] ) {
		const file = resolve( BLOCKS, slug, 'block.json' );
		const meta = JSON.parse( readFileSync( file, 'utf8' ) );

		registerBlockType( meta.name, { ...meta, save: () => null, edit: () => null } );
	}
} );

/**
 * A Blicks block without a `uniqueId` writes one on its first render. Done inside the Studio, that
 * write was an undo step per block: a pattern opened with history already in it. Mounting gives
 * every block its id up front, derived as the block itself would derive it, so nothing is written.
 */
describe( 'identity on mount', () => {
	const idOf = ( block: BlockNode ): unknown => ( block.attributes as { uniqueId?: string } ).uniqueId;
	const derived = ( block: BlockNode ): string => String( block.clientId ).replace( /-/g, '' ).slice( 0, 8 );

	it( 'gives every Blicks block the id its first render would have written', () => {
		const [ section ] = mountPattern(
			[ { name: 'blicks/section', innerBlocks: [ { name: 'blicks/heading', attributes: { content: 'Hi' } } ] } ],
			'Hero'
		).blocks;

		expect( idOf( section! ) ).toBe( derived( section! ) );
		expect( idOf( section!.innerBlocks![ 0 ]! ) ).toBe( derived( section!.innerBlocks![ 0 ]! ) );
	} );

	it( 'keeps an id the block already carries', () => {
		const [ copy ] = detach( [ { name: 'blicks/text', attributes: { uniqueId: 'keepme12' } } ] );

		expect( idOf( copy! ) ).toBe( 'keepme12' );
	} );

	it( 'leaves blocks that have no such attribute alone', () => {
		const [ copy ] = detach( [ { name: 'core/missing', attributes: { originalName: 'x/y' } } ] );

		expect( idOf( copy! ) ).toBeUndefined();
	} );

	it( 'covers pasted JSON too', () => {
		const [ block ] = mountJson( JSON.stringify( [ { name: 'blicks/text' } ] ) ).blocks;

		expect( idOf( block! ) ).toBe( derived( block! ) );
	} );
} );

describe( 'detach', () => {
	it( 'gives every block in the tree a new identity', () => {
		const source = createBlock( 'blicks/box', {}, [
			createBlock( 'blicks/heading', { content: 'Hello' } ),
		] );

		const [ copy ] = detach( [ source as never ] );

		expect( copy!.clientId ).not.toBe( source.clientId );
		expect( copy!.innerBlocks![ 0 ]!.clientId ).not.toBe( source.innerBlocks[ 0 ]!.clientId );
	} );

	/**
	 * Hand-written trees are the normal case for a built-in pattern or a pasted payload, and the
	 * obvious way to write a leaf omits both fields. `cloneBlock` walks `innerBlocks.map` unguarded.
	 */
	it( 'accepts a hand-written tree whose leaves omit attributes and children', () => {
		const [ copy ] = detach( [
			{ name: 'blicks/box', innerBlocks: [ { name: 'blicks/heading' } ] },
		] );

		expect( copy!.innerBlocks![ 0 ]!.name ).toBe( 'blicks/heading' );
		expect( copy!.innerBlocks![ 0 ]!.clientId ).toBeTruthy();
	} );

	/**
	 * **The gap that rendered every built-in as a grey warning.** `isBlockValid` reads the field
	 * off the block and returns it, so a hand-written tree that never set it is `undefined`, which
	 * is falsy, which is "Block contains unexpected or invalid content" on every node. Nothing
	 * throws, the outline rail draws the tree perfectly, and only the canvas says anything is
	 * wrong — which is why no test caught it for the whole life of the library screen.
	 */
	it( 'marks a hand-written tree valid, all the way down', () => {
		const [ copy ] = detach( [
			{
				name: 'blicks/box',
				innerBlocks: [ { name: 'blicks/heading' }, { name: 'blicks/text' } ],
			},
		] );

		expect( copy!.isValid ).toBe( true );
		expect( copy!.innerBlocks!.map( ( b ) => b.isValid ) ).toEqual( [ true, true ] );
	} );

	/** A block `parse` found genuinely broken is a fact about someone's content, not a gap to fill. */
	it( 'leaves a block that is already known to be invalid alone', () => {
		const [ copy ] = detach( [ { name: 'blicks/heading', isValid: false } ] );

		expect( copy!.isValid ).toBe( false );
	} );

	it( 'accepts a single hand-written leaf with no children at all', () => {
		expect( detach( [ { name: 'blicks/text' } ] )[ 0 ]!.name ).toBe( 'blicks/text' );
	} );

	it( 'keeps the attributes and the shape', () => {
		const source = createBlock( 'blicks/box', {}, [
			createBlock( 'blicks/heading', { content: 'Hello' } ),
		] );

		const [ copy ] = detach( [ source as never ] );

		expect( copy!.name ).toBe( 'blicks/box' );
		expect( copy!.innerBlocks![ 0 ]!.attributes!.content ).toBe( 'Hello' );
	} );

	/**
	 * The bug this file exists to prevent. A deep copy that keeps client ids produces a mount that
	 * renders correctly and writes into the post's store the first time anything is dragged, with
	 * nothing on screen to suggest it.
	 */
	it( 'does not share identity with the tree it came from', () => {
		const source = createBlock( 'blicks/box', {}, [
			createBlock( 'blicks/heading', { content: 'Hello' } ),
		] );

		const ids = new Set< string >();
		const walk = ( nodes: { clientId?: string; innerBlocks?: unknown[] }[] ): void => {
			for ( const node of nodes ) {
				if ( node.clientId ) ids.add( node.clientId );
				walk( ( node.innerBlocks ?? [] ) as never[] );
			}
		};

		walk( [ source as never ] );
		const before = ids.size;
		walk( detach( [ source as never ] ) );

		expect( ids.size ).toBe( before * 2 );
	} );
} );

describe( 'modeOf', () => {
	// The free Studio ships one mode; a companion's Board claims a lone Scene. Both registered here
	// in their bare shape, so this is the registry's decision and not a name baked into the mount.
	const Canvas = () => null;
	beforeAll( () => {
		modes.register( { id: 'section', label: 'Section', priority: 0, matches: () => true, Canvas } );
		modes.register( { id: 'board', label: 'Board', priority: 10, matches: ( b: BlockNode[] ) => 1 === b.length && 'blicks/scene' === b[ 0 ]?.name, Canvas } );
	} );
	afterAll( () => {
		modes.unregister( 'board' );
		modes.unregister( 'section' );
	} );

	it( 'opens a lone stage in the mode that claims it', () => {
		expect( modeOf( [ { name: 'blicks/scene' } ] ) ).toBe( 'board' );
	} );

	it( 'opens anything else as a Section', () => {
		expect( modeOf( [ { name: 'blicks/section' } ] ) ).toBe( 'section' );
		expect( modeOf( [] ) ).toBe( 'section' );
	} );

	it( 'opens a stage nested in a document as a Section', () => {
		expect(
			modeOf( [ { name: 'blicks/section', innerBlocks: [ { name: 'blicks/scene' } ] } ] )
		).toBe( 'section' );
	} );

	it( 'opens two roots as a Section even when one is a stage', () => {
		expect( modeOf( [ { name: 'blicks/scene' }, { name: 'blicks/text' } ] ) ).toBe( 'section' );
	} );

	it( 'falls back to section when nothing is registered', () => {
		modes.unregister( 'section' );
		modes.unregister( 'board' );
		expect( modeOf( [ { name: 'blicks/scene' } ] ) ).toBe( 'section' );
	} );
} );

describe( 'the ways in', () => {
	it( 'records an origin only for a selection', () => {
		const block = createBlock( 'blicks/section' );

		expect( mountSelection( block as never, 'Hero' ).origin ).toBe( block.clientId );
		expect( mountPattern( [ block as never ], 'Split hero' ).origin ).toBeNull();
		expect( mountBlank( 'section' ).origin ).toBeNull();
	} );

	/**
	 * The origin is the id in the POST, so it must survive detaching — the mounted copy has a
	 * different id by design, and recording that one would make Insert replace a block that does
	 * not exist outside the Studio.
	 */
	it( 'keeps the origin pointing at the post, not at the copy', () => {
		const block = createBlock( 'blicks/section' );
		const mount = mountSelection( block as never, 'Hero' );

		expect( mount.origin ).toBe( block.clientId );
		expect( mount.blocks[ 0 ]!.clientId ).not.toBe( mount.origin );
	} );

	/** "Edit in Studio" mounts the section and selects the block the author was on, in the copy. */
	it( 'selects the same block inside the copy, by where it sits', () => {
		const price = createBlock( 'blicks/text', { content: '$0' } );
		const plan = createBlock( 'blicks/box', {}, [ createBlock( 'blicks/text', { content: 'Free' } ), price ] );
		const section = createBlock( 'blicks/section', {}, [ createBlock( 'blicks/heading' ), plan ] );
		const mount = mountSelectionAt( section as never, price.clientId, 'Pricing' );
		const picked = mount.blocks[ 0 ]!.innerBlocks![ 1 ]!.innerBlocks![ 1 ]!;

		expect( mount.select ).toBe( picked.clientId );
		expect( mount.select ).not.toBe( price.clientId );
		expect( picked.attributes?.content ).toBe( '$0' );
		expect( mount.origin ).toBe( section.clientId );
		expect( mountSelectionAt( section as never, 'not-there', 'Pricing' ).select ).toBeUndefined();
	} );

	it( 'takes the mode it is given for a blank canvas', () => {
		expect( mountBlank( 'board' ).mode ).toBe( 'board' );
		expect( mountBlank( 'section' ).mode ).toBe( 'section' );
	} );
} );

describe( 'blocksFromJson', () => {
	it( 'builds a nested tree', () => {
		const blocks = blocksFromJson(
			JSON.stringify( [
				{
					name: 'blicks/box',
					attributes: {},
					innerBlocks: [ { name: 'blicks/heading', attributes: { content: 'Hi' } } ],
				},
			] )
		);

		expect( blocks ).toHaveLength( 1 );
		expect( blocks[ 0 ]!.name ).toBe( 'blicks/box' );
		expect( blocks[ 0 ]!.innerBlocks![ 0 ]!.attributes!.content ).toBe( 'Hi' );
	} );

	it( 'accepts a single block as well as a list', () => {
		expect( blocksFromJson( JSON.stringify( { name: 'blicks/text' } ) ) ).toHaveLength( 1 );
	} );

	it( 'reports bad JSON as bad JSON', () => {
		expect( () => blocksFromJson( '{ not json' ) ).toThrow( MountError );
		expect( () => blocksFromJson( '{ not json' ) ).toThrow( /valid JSON/ );
	} );

	/**
	 * The gate that matters: the registry, not a list kept here. A site with Pro installed renders
	 * blocks a free site cannot, and only `getBlockType` knows which site this is.
	 */
	it( 'refuses a block this site does not have, and names it', () => {
		expect( () =>
			blocksFromJson( JSON.stringify( [ { name: 'blicks/sektion' } ] ) )
		).toThrow( /no block named blicks\/sektion/ );
	} );

	it( 'names where in the tree the problem is', () => {
		const json = JSON.stringify( [
			{
				name: 'blicks/box',
				innerBlocks: [ { name: 'blicks/heading' }, { name: 'nope/at-all' } ],
			},
		] );

		expect( () => blocksFromJson( json ) ).toThrow( /blocks\[0\]\.innerBlocks\[1\]/ );
	} );

	it( 'rejects an empty list rather than mounting nothing', () => {
		expect( () => blocksFromJson( '[]' ) ).toThrow( /no blocks/ );
	} );

	it( 'rejects a node that is not a block', () => {
		expect( () => blocksFromJson( '[ 42 ]' ) ).toThrow( /is not a block/ );
		expect( () => blocksFromJson( JSON.stringify( [ {} ] ) ) ).toThrow( /no block name/ );
	} );

	it( 'rejects attributes and innerBlocks of the wrong shape', () => {
		expect( () =>
			blocksFromJson( JSON.stringify( [ { name: 'blicks/text', attributes: 'nope' } ] ) )
		).toThrow( /attributes is not an object/ );

		expect( () =>
			blocksFromJson( JSON.stringify( [ { name: 'blicks/text', innerBlocks: 'nope' } ] ) )
		).toThrow( /innerBlocks is not a list/ );
	} );

	it( 'mounts nothing at all when one node deep in the tree is bad', () => {
		const json = JSON.stringify( [
			{ name: 'blicks/text' },
			{ name: 'blicks/box', innerBlocks: [ { name: 'nope/at-all' } ] },
		] );

		expect( () => mountJson( json ) ).toThrow( MountError );
	} );
} );

describe( 'toPortableJson', () => {
	it( 'round-trips through the import box', () => {
		const json = toPortableJson(
			blocksFromJson(
				JSON.stringify( [
					{
						name: 'blicks/box',
						innerBlocks: [ { name: 'blicks/heading', attributes: { content: 'Hi' } } ],
					},
				] )
			)
		);

		const back = blocksFromJson( json );

		expect( back[ 0 ]!.name ).toBe( 'blicks/box' );
		expect( back[ 0 ]!.innerBlocks![ 0 ]!.attributes!.content ).toBe( 'Hi' );
	} );

	/**
	 * A client id is this session's identity for a block. Carrying one to another site is shipping
	 * a local detail that can only be ignored or collide.
	 */
	it( 'carries no client ids', () => {
		const json = toPortableJson( blocksFromJson( JSON.stringify( [ { name: 'blicks/text' } ] ) ) );

		expect( json ).not.toContain( 'clientId' );
	} );

	it( 'leaves out empty attributes and empty children rather than writing noise', () => {
		const json = toPortableJson( blocksFromJson( JSON.stringify( [ { name: 'blicks/text' } ] ) ) );
		const parsed = JSON.parse( json );

		expect( parsed[ 0 ] ).not.toHaveProperty( 'innerBlocks' );
	} );

	/*
	 * Custom keyframes live in the site's library, not in any block, so a tree that names them
	 * carries them beside it — and one that names none stays the plain list it always was.
	 */
	it( 'carries the keyframes a tree uses, and stays a plain list without any', () => {
		const blocks = blocksFromJson( JSON.stringify( [ { name: 'blicks/text' } ] ) );
		const glow = { slug: 'glow', label: 'Glow', steps: [ { offset: 0, declarations: { opacity: '0' } } ] };

		expect( Array.isArray( JSON.parse( toPortableJson( blocks ) ) ) ).toBe( true );

		const json = toPortableJson( blocks, [ glow ] );
		const mounted = mountJson( json );

		expect( JSON.parse( json ).keyframes ).toEqual( [ glow ] );
		expect( mounted.blocks[ 0 ]!.name ).toBe( 'blicks/text' );
		expect( mounted.keyframes ).toEqual( [ glow ] );
		expect( mountJson( toPortableJson( blocks ) ) ).not.toHaveProperty( 'keyframes' );
	} );

	it( 'drops a carried record that is not shaped like one', () => {
		const json = JSON.stringify( { blocks: [ { name: 'blicks/text' } ], keyframes: [ { slug: 'x' }, 'nope' ] } );

		expect( mountJson( json ) ).not.toHaveProperty( 'keyframes' );
	} );
} );

describe( 'blicksAncestors', () => {
	const tree: Record< string, { parent: string | null; name: string } > = {
		post: { parent: null, name: 'core/post-content' },
		section: { parent: 'post', name: 'blicks/section' },
		stack: { parent: 'section', name: 'blicks/box' },
		paragraph: { parent: 'stack', name: 'core/paragraph' },
	};

	const rootOf = ( id: string ) => tree[ id ]?.parent ?? null;
	const nameOf = ( id: string ) => tree[ id ]?.name;

	it( 'walks up, innermost first', () => {
		expect( blicksAncestors( 'paragraph', rootOf, nameOf ) ).toEqual( [ 'stack', 'section' ] );
	} );

	it( 'skips ancestors that are not ours', () => {
		expect( blicksAncestors( 'paragraph', rootOf, nameOf ) ).not.toContain( 'post' );
	} );

	it( 'returns nothing when the block has no Blicks parent', () => {
		expect( blicksAncestors( 'section', rootOf, nameOf ) ).toEqual( [] );
	} );

	/**
	 * The picker's default is the LAST of these — the outermost — because "open this in the Studio"
	 * almost always means the section, not the paragraph that happened to have the cursor in it.
	 */
	it( 'puts the outermost last, which is what the picker defaults to', () => {
		const found = blicksAncestors( 'paragraph', rootOf, nameOf );

		expect( found[ found.length - 1 ] ).toBe( 'section' );
	} );
} );

describe( 'a block this site does not have', () => {
	/**
	 * The promise the Studio makes about content it cannot render: it is kept, exactly, and handed
	 * back unchanged.
	 *
	 * WordPress parses an unregistered block into `core/missing`, which carries the original markup
	 * in its attributes. Whether it parses that way is core's business and core's tests; what is
	 * OURS is that nothing in the mount path rewrites it afterwards — and `detach` runs over every
	 * tree that enters the Studio, by every door.
	 *
	 * Deliberately no `parse()` here. It needs a DOM, this suite runs in node by choice, and adding
	 * jsdom to a plugin kept this small to re-test core's parser would be a poor trade. The round
	 * trip through a real editor is covered where a real editor exists.
	 */
	const foreign = (): BlockNode => ( {
		name: 'core/missing',
		attributes: {
			originalName: 'acme/widget',
			originalContent: '<!-- wp:acme/widget --><div class="acme">kept</div><!-- /wp:acme/widget -->',
			originalUndelimitedContent: '<div class="acme">kept</div>',
		},
	} );

	it( 'keeps every attribute through detaching', () => {
		const [ copy ] = detach( [ foreign() ] );

		expect( copy!.name ).toBe( 'core/missing' );
		expect( copy!.attributes!.originalName ).toBe( 'acme/widget' );
		expect( copy!.attributes!.originalContent ).toBe( foreign().attributes!.originalContent );
	} );

	it( 'keeps it when mounted as a pattern', () => {
		const mount = mountPattern( [ foreign() ], 'Foreign' );

		expect( mount.blocks[ 0 ]!.attributes!.originalContent ).toBe(
			foreign().attributes!.originalContent
		);
	} );

	it( 'keeps it nested inside a tree that is otherwise ours', () => {
		const [ copy ] = detach( [
			{ name: 'blicks/section', innerBlocks: [ foreign() ] },
		] );

		expect( copy!.innerBlocks![ 0 ]!.attributes!.originalContent ).toBe(
			foreign().attributes!.originalContent
		);
	} );

	/**
	 * Pasted JSON is the one path that refuses it instead, and deliberately: a paste fails at the
	 * import box where there is still a textarea to fix, rather than halfway down a canvas.
	 */
	it( 'is refused from pasted JSON, by name', () => {
		expect( () => blocksFromJson( JSON.stringify( [ { name: 'acme/widget' } ] ) ) ).toThrow(
			/no block named acme\/widget/
		);
	} );
} );

describe( 'onlyIdentity', () => {
	const shared = { content: 'Hi' };
	const node = ( attributes: Record< string, unknown >, innerBlocks: BlockNode[] = [] ): BlockNode => ( {
		name: 'blicks/heading',
		clientId: 'c1',
		attributes,
		innerBlocks,
	} );

	it( 'is true when the only change is an id being filled in', () => {
		expect( onlyIdentity( [ node( { content: shared } ) ], [ node( { content: shared, uniqueId: 'c1' } ) ] ) ).toBe( true );
	} );

	it( 'is false when nothing changed', () => {
		const tree = [ node( { content: shared } ) ];

		expect( onlyIdentity( tree, tree ) ).toBe( false );
	} );

	it( 'is false when anything else changed alongside the id', () => {
		expect( onlyIdentity( [ node( { content: 'a' } ) ], [ node( { content: 'b', uniqueId: 'c1' } ) ] ) ).toBe( false );
	} );

	it( 'is false when an id is changed rather than filled in', () => {
		expect( onlyIdentity( [ node( { uniqueId: 'old' } ) ], [ node( { uniqueId: 'new' } ) ] ) ).toBe( false );
	} );

	it( 'is false when a block was added', () => {
		expect( onlyIdentity( [ node( {} ) ], [ node( {} ), { ...node( { uniqueId: 'x' } ), clientId: 'c2' } ] ) ).toBe( false );
	} );

	it( 'looks inside nested blocks', () => {
		const child = ( attributes: Record< string, unknown > ): BlockNode => ( { ...node( attributes ), clientId: 'c2' } );

		expect( onlyIdentity( [ node( {}, [ child( {} ) ] ) ], [ node( {}, [ child( { uniqueId: 'c2' } ) ] ) ] ) ).toBe( true );
	} );

	it( 'treats a change to an attribute the block derives as no edit, and only that', () => {
		const derived = ( name: string ) => ( name === node( {} ).name ? [ 'hasPanel' ] : [] );
		expect( onlyIdentity( [ node( { hasPanel: true } ) ], [ node( { hasPanel: false } ) ], derived ) ).toBe( true );
		expect( onlyIdentity( [ node( { hasPanel: true, content: 'a' } ) ], [ node( { hasPanel: false, content: 'b' } ) ], derived ) ).toBe( false );
		expect( onlyIdentity( [ node( { hasPanel: true } ) ], [ node( { hasPanel: false } ) ] ) ).toBe( false );
	} );
} );
