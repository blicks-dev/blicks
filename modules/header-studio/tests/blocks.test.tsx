/**
 * @vitest-environment jsdom
 *
 * Saved markup for the Header Studio blocks, frozen in `tests/__golden__/` as the free plugin's
 * are in `resources/blocks/__golden__/`: a golden stands in for headers already saved, so a diff
 * means a `deprecated` entry, not `vitest -u`. Each block's fixture is its block.json `example`.
 *
 * `shape-cases.json` records the spec an agent would send and what `save()` wrote for it, for the
 * PHP side (ShapesTest.php) to reproduce byte for byte. Rewrite it deliberately with
 * `BLICKS_WRITE_SHAPE_CASES=1`.
 */
import '@blicks/test-runtime';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBlock, getBlockType, parse, serialize } from '@wordpress/blocks';
import { blicks } from '../resources/blicks';
import { registerBlocks } from '../resources/blocks';

const api = blicks();
if ( ! api ) throw new Error( 'window.blicks is missing' );
registerBlocks( api );

const NAMES = [ 'header', 'header-row', 'header-area', 'nav', 'nav-item', 'mega-panel', 'link-list' ];
const GOLDEN = resolve( __dirname, '__golden__' );

interface Node {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: Node[];
}

/** A stable 8-character id per block name and position, as the editor's are 8 characters. */
function stableId( seed: string ): string {
	let hash = 0x811c9dc5;
	for ( let i = 0; i < seed.length; i++ ) {
		hash ^= seed.charCodeAt( i );
		hash = Math.imul( hash, 0x01000193 ) >>> 0;
	}
	return hash.toString( 16 ).padStart( 8, '0' ).slice( 0, 8 );
}

function create( node: Node, path = '0' ): any {
	const attributes = { uniqueId: stableId( `${ node.name }@${ path }` ), ...( node.attributes ?? {} ) };
	return createBlock( node.name, attributes, ( node.innerBlocks ?? [] ).map( ( child, i ) => create( child, `${ path }.${ i }` ) ) );
}

function invalid( blocks: any[], at = '' ): string[] {
	return blocks.flatMap( ( b, i ) => [
		...( b.name === 'core/missing' || b.isValid === false ? [ `${ at }${ b.name }[${ i }]` ] : [] ),
		...invalid( b.innerBlocks ?? [], `${ at }${ b.name }[${ i }] > ` ),
	] );
}

describe.each( NAMES )( 'blicks/%s', ( slug ) => {
	const type: any = getBlockType( `blicks/${ slug }` );
	const file = resolve( GOLDEN, `${ slug }.html` );

	it( 'is registered with an example', () => {
		expect( type?.example ).toBeTruthy();
	} );

	it( 'saves the markup frozen in its golden file', async () => {
		await expect( serialize( [ create( { name: type.name, ...type.example } ) ] ) ).toMatchFileSnapshot( file );
	} );

	it( 'still validates markup saved by an earlier build', () => {
		expect( existsSync( file ) ).toBe( true );
		expect( invalid( parse( readFileSync( file, 'utf8' ) ) ) ).toEqual( [] );
	} );
} );

/** The variants the PHP shapes must reproduce, beyond each golden's one instance. */
const b = ( name: string, uniqueId: string, attributes: Record< string, unknown > = {}, innerBlocks: Node[] = [] ): Node => ( {
	name: `blicks/${ name }`,
	attributes: { uniqueId, ...attributes },
	innerBlocks,
} );

const CASES: Array< { title: string; block: Node } > = [
	{ title: 'header, default', block: b( 'header', 'h0000001' ) },
	{ title: 'header, every option', block: b( 'header', 'h0000002', { sticky: true, shrink: true, overHero: true, hideOnScroll: true, mobile: 'accordion', drawerAt: 'always' } ) },
	{ title: 'header, unknown options fall back', block: b( 'header', 'h0000003', { mobile: 'sideways', drawerAt: 'huge' } ) },
	{ title: 'row, stacked, hidden on phones', block: b( 'header-row', 'h0000004', { preset: 'stacked', visibility: { mobile: true } }, [ b( 'header-area', 'h0000005' ) ] ) },
	{ title: 'area, centre, last on phones', block: b( 'header-area', 'h0000006', { slot: 'centre', blicks: { 'flexChild.order': { default: { mobile: '99' } } } } ) },
	{ title: 'nav, named', block: b( 'nav', 'h0000007', { label: 'Primary & more' }, [ b( 'nav-item', 'h0000008', { label: 'Home', url: '/' } ) ] ) },
	{ title: 'nav item, link in a new tab', block: b( 'nav-item', 'h0000009', { label: 'Docs <em>v2</em>', url: 'https://example.test/docs?a=1&b=2', linkTarget: '_blank' } ) },
	{ title: 'nav item, no link yet', block: b( 'nav-item', 'h000000a', { label: 'Soon' } ) },
	{ title: 'nav item, with a mega menu', block: b( 'nav-item', 'h000000b', { label: 'Products', url: '/ignored', hasPanel: true }, [ b( 'mega-panel', 'h000000c' ) ] ) },
	{ title: 'mega panel, content width, no animation', block: b( 'mega-panel', 'h000000d', { width: 'content', animation: 'none', delay: 300 } ) },
	{ title: 'link list, a menu', block: b( 'link-list', 'h000000e', { menu: 'classic:3:12' } ) },
];

const CASES_FILE = resolve( __dirname, 'fixtures/shape-cases.json' );

describe( 'shape cases', () => {
	it( 'match what save() writes', () => {
		const recorded = CASES.map( ( { title, block } ) => ( { title, block, markup: serialize( [ create( block ) ] ) } ) );
		// `create` stamps a uniqueId only where a case has none; every case has one, so the spec is exact.
		const json = JSON.stringify( recorded, null, '\t' ) + '\n';
		if ( process.env.BLICKS_WRITE_SHAPE_CASES ) writeFileSync( CASES_FILE, json );
		expect( readFileSync( CASES_FILE, 'utf8' ) ).toBe( json );
	} );
} );
