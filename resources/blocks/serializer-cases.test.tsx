/**
 * @vitest-environment jsdom
 *
 * What `save()` writes for the block variants the PHP serializer reproduces.
 *
 * Agents write pages through MCP, and the server has no JavaScript runtime, so
 * `src/Ai/Spec/SpecSerializer.php` writes block markup itself. That is a second implementation of
 * every block's `save()`, and the only thing that makes keeping two defensible is a test that holds
 * them to the same bytes. The goldens in `__golden__/` do part of that — but each holds one default
 * instance, which for an Image is an empty delimiter.
 *
 * So this file records the variants that matter in `tests/fixtures/serializer-cases.json`: each
 * case is the spec an agent would send and the markup the real `save()` produced for it. The PHP
 * integration suite (`SerializerCasesTest`) asserts the server writes the same bytes.
 *
 * The file is checked, not regenerated, on a normal run: a change to a block's `save()` fails here
 * first. Rewrite it deliberately with `BLICKS_WRITE_SERIALIZER_CASES=1 pnpm vitest run
 * resources/blocks/serializer-cases.test.tsx`, then make the PHP side match.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serialize } from '@wordpress/blocks';

import '@/block-library';
import { createFixtureBlock, type FixtureNode } from './block-fixtures';

interface Case {
	title: string;
	block: FixtureNode;
}

const img = 'https://example.test/wp-content/uploads/photo.jpg';

/** Every block carries a fixed `uniqueId`, as stored content always does. */
function block( name: string, uniqueId: string, attributes: Record< string, unknown > = {}, innerBlocks: FixtureNode[] = [] ): FixtureNode {
	return { name: `blicks/${ name }`, attributes: { uniqueId, ...attributes }, innerBlocks };
}

const CASES: Case[] = [
	{ title: 'image without a picture', block: block( 'image', 'a1000001' ) },
	{ title: 'image, plain', block: block( 'image', 'a1000002', { url: img, alt: 'A hill at dusk' } ) },
	{ title: 'image, ratio and focus', block: block( 'image', 'a1000003', { url: img, aspectRatio: '16/9', objectFit: 'cover', focus: '50% 20%' } ) },
	{ title: 'image, contain ignores focus', block: block( 'image', 'a1000004', { url: img, aspectRatio: '4/3', objectFit: 'contain', focus: '50% 20%' } ) },
	{ title: 'image, linked to a page in a new tab', block: block( 'image', 'a1000005', { url: img, linkTo: 'custom', href: 'https://example.test/about?a=1&b=2', linkTarget: '_blank' } ) },
	{ title: 'image, linked to itself', block: block( 'image', 'a1000006', { url: img, linkTo: 'media' } ) },
	{ title: 'image, unsafe link dropped', block: block( 'image', 'a1000007', { url: img, linkTo: 'custom', href: 'data:text/html,hi' } ) },
	{ title: 'image, caption below', block: block( 'image', 'a1000008', { url: img, caption: 'Taken <strong>early</strong>' } ) },
	{ title: 'image, caption over with a shade', block: block( 'image', 'a1000009', { url: img, caption: 'Over', capPos: 'over', capAlign: 'center', dim: 'medium' } ) },
	{ title: 'image, width and line-up', block: block( 'image', 'a100000a', { url: img, width: 'md', lineUp: 'end', phoneFull: false } ) },
	{ title: 'image, typed width and hover', block: block( 'image', 'a100000b', { url: img, width: '50%', hover: 'zoom' } ) },
	{ title: 'image, decorative and eager', block: block( 'image', 'a100000c', { url: img, alt: 'ignored', decorative: true, eager: true } ) },
	{ title: 'image, adjustments', block: block( 'image', 'a100000d', { url: img, adjust: { b: 120, c: 90, s: 0, blur: 2 } } ) },
	{ title: 'image, styled', block: block( 'image', 'a100000e', { url: img, blicks: { 'border.radius': { default: { base: 'lg' } } } } ) },
	{
		title: 'buttons, a link with an apostrophe and an icon button',
		block: block( 'buttons', 'c1000001', {}, [
			block( 'button', 'c1000002', { text: 'Read O\'Brien', url: '/o\'brien?x=1&y=2', linkTarget: '_blank', rel: 'noopener' } ),
			block( 'button', 'c1000003', { size: 'icon', icon: 'search', label: 'Search', variant: 'ghost' } ),
		] ),
	},
	{ title: 'icon, filled', block: block( 'icon', 'd1000001', { icon: 'heart', filled: true, label: 'Liked' } ) },
	{ title: 'icon, a turned link', block: block( 'icon', 'd1000002', { icon: 'arrowRight', url: 'https://example.test/next', linkTarget: '_blank', turn: 90, flipH: true, size: '3vw' } ) },
	{ title: 'icon, unlabelled', block: block( 'icon', 'd1000003', { icon: 'bolt', size: '32', strokeWidth: 1.5 } ) },
	{ title: 'button, full width with a trailing icon', block: block( 'buttons', 'c1000004', {}, [ block( 'button', 'c1000005', { text: 'Go', width: 'full', icon: 'arrowRight', iconPosition: 'trailing', variant: 'outline', size: 'lg' } ) ] ) },
	{ title: 'button, label mode with an icon size', block: block( 'buttons', 'c1000006', {}, [ block( 'button', 'c1000007', { text: 'Plan', icon: 'map', iconSize: '18', blicks: { 'layout.gapColumn': { default: { base: '10px' } } } } ) ] ) },
	{
		title: 'button, blocks mode with a dot, a label and meta text',
		block: block( 'button', 'c1000008', { content: 'blocks', url: '/keynote', variant: 'secondary' }, [
			block( 'box', 'c1000009', { tag: 'span', blicks: { 'layout.width': { default: { base: '8px' } } } } ),
			block( 'text', 'c100000a', { content: 'Product <strong>launch</strong>', tag: 'span' } ),
			block( 'icon', 'c100000b', { icon: 'arrowRight', size: '1em' } ),
		] ),
	},
	{
		title: 'button, blocks mode without a link, holding an inline image',
		block: block( 'button', 'c100000c', { content: 'blocks' }, [
			block( 'image', 'c100000d', { url: img, alt: 'Ada', inline: true, aspectRatio: '1/1', caption: 'dropped', linkTo: 'media' } ),
			block( 'text', 'c100000e', { content: 'Ada', tag: 'span' } ),
		] ),
	},
	{
		title: 'box side by side holding a heading and text',
		block: block( 'box', 'e2000001', { blicks: {
			'layout.display': { default: { base: 'flex' } },
			'layout.flexDirection': { default: { base: 'row' } },
			'layout.gapColumn': { default: { base: 'lg' } },
		} }, [
			block( 'heading', 'e2000002', { content: 'Hello & welcome', level: 3 } ),
			block( 'text', 'e2000003', { content: 'One <em>line</em>.' } ),
		] ),
	},
	{
		title: 'box, a card holding a heading',
		block: block( 'box', 'f1000001', { kind: 'card', tag: 'article', blicks: { 'spacing.padding': { default: { base: '24px' } } } }, [
			block( 'heading', 'f1000002', { content: 'Kinds', level: 3 } ),
		] ),
	},
	{ title: 'box, layers', block: block( 'box', 'f1000003', { layers: true } ) },
	{ title: 'box, a badge', block: block( 'box', 'f1000004', { kind: 'badge', text: 'New <strong>in</strong> v2' } ) },
	{ title: 'box, a linked badge', block: block( 'box', 'f1000005', { kind: 'badge', text: 'Docs', href: '/docs?a=1&b=2', linkTarget: '_blank', rel: 'noopener', linkLabel: 'Read the docs' } ) },
	{ title: 'box, a divider', block: block( 'box', 'f1000006', { kind: 'divider' } ) },
	{ title: 'box, a spacer', block: block( 'box', 'f1000007', { kind: 'spacer', blicks: { 'layout.height': { default: { base: '48px' } } } } ) },
	{
		title: 'box, a linked panel',
		block: block( 'box', 'f1000008', { kind: 'panel', href: 'https://example.test/o\'brien', linkTarget: '_blank', linkLabel: 'Open' }, [
			block( 'text', 'f1000009', { content: 'Whole panel is a link.' } ),
		] ),
	},
	{ title: 'box, an unknown kind and tag fall back', block: block( 'box', 'f100000a', { kind: 'bogus', tag: 'figure' } ) },
	{
		title: 'loop, a bento of cards with bound fields',
		block: block( 'loop', 'g1000001', {
			data: JSON.stringify( [ { title: 'Arc "floor" lamp', price: 189, photo: img }, { title: 'Oak <side> table', price: 240, photo: img } ] ),
			layout: 'bento',
			bento: { tiles: [ '2x2', '1x1' ], rowHeight: 200, repeat: true },
			rules: [ { when: { field: 'price', op: 'gt', value: '200' }, then: [ { card: 'highlight' } ] } ],
			emptyText: 'Nothing -- yet',
		}, [
			block( 'box', 'g1000002', { kind: 'card', tag: 'article' }, [
				block( 'image', 'g1000003', { url: img, metadata: { bindings: { url: { source: 'blicks/item', args: { key: 'photo' } }, alt: { source: 'blicks/item', args: { key: 'title' } } } } } ),
				block( 'heading', 'g1000004', { content: 'Title', level: 3, metadata: { bindings: { content: { source: 'blicks/item', args: { key: 'title' } } } } } ),
				block( 'text', 'g1000005', { content: '$0', metadata: { bindings: { content: { source: 'blicks/item', args: { key: 'price', format: 'currency', formatArg: '$' } } } } } ),
			] ),
		] ),
	},
	{
		title: 'loop, an endpoint in a list',
		block: block( 'loop', 'g1000006', { source: 'endpoint', endpoint: 'shop', path: 'data.items', layout: 'list', limit: 4 }, [
			block( 'text', 'g1000007', { content: 'Name', metadata: { bindings: { content: { source: 'blicks/item', args: { key: 'name', fallback: 'Unnamed' } } } } } ),
		] ),
	},
	{ title: 'button, opens a dialog', block: block( 'buttons', 'c2000001', {}, [ block( 'button', 'c2000002', { text: 'Size guide', action: 'dialog', dialog: 'size-guide', url: 'https://example.test/ignored' } ) ] ) },
	{ title: 'button, closes its dialog', block: block( 'buttons', 'c2000003', {}, [ block( 'button', 'c2000004', { text: 'No thanks', action: 'close' } ) ] ) },
	{ title: 'button, open dialog with none chosen is a plain button', block: block( 'buttons', 'c2000005', {}, [ block( 'button', 'c2000006', { text: 'Open', action: 'dialog' } ) ] ) },
	{ title: 'dialog, modal default', block: block( 'dialog', 'd1000001', { anchor: 'newsletter' }, [ block( 'text', 'd1000002', { content: 'Hello' } ) ] ) },
	{ title: 'dialog, drawer from the start, light backdrop, no close button', block: block( 'dialog', 'd1000003', { anchor: 'menu', kind: 'drawer', side: 'start', backdrop: 'light', blur: true, closeButton: false } ) },
	{ title: 'dialog, top modal, sheet on phones, named, scale, focus close', block: block( 'dialog', 'd1000004', { anchor: 'offer', place: 'top', phone: 'full', label: 'Offer & terms', motion: 'scale', focus: 'close', closeLabel: 'Fermer' } ) },
	{ title: 'dialog, non-modal sheet that ignores outside clicks', block: block( 'dialog', 'd1000005', { anchor: 'cookies', kind: 'sheet', modal: false, outsideCloses: false, backdrop: 'light' } ) },
	{ title: 'dialog, no anchor falls back to its id', block: block( 'dialog', 'd1000006', { kind: 'full', motion: 'none' } ) },
	{ title: 'menu link, plain', block: block( 'menu-link', 'e1000001', { label: 'Pricing', url: '/pricing' } ) },
	{ title: 'menu link, icon, description, badge, new tab', block: block( 'menu-link', 'e1000002', { label: 'Docs', description: 'Guides & <em>reference</em>', url: 'https://example.test/docs?a=1&b=2', linkTarget: '_blank', rel: 'noopener', icon: 'book-open', badge: 'R&D <beta>' } ) },
	{ title: 'menu link, no link yet', block: block( 'menu-link', 'e1000003', { label: 'Soon' } ) },
];

const FILE = resolve( __dirname, '../../tests/fixtures/serializer-cases.json' );

function record(): Array< Case & { markup: string } > {
	return CASES.map( ( c ) => ( { ...c, markup: serialize( [ createFixtureBlock( c.block ) ] ) } ) );
}

describe( 'serializer cases', () => {
	const actual = record();

	if ( process.env.BLICKS_WRITE_SERIALIZER_CASES ) {
		writeFileSync( FILE, JSON.stringify( actual, null, '\t' ) + '\n' );
	}

	it( 'has a recorded file', () => {
		expect( existsSync( FILE ), 'run with BLICKS_WRITE_SERIALIZER_CASES=1 to record it' ).toBe( true );
	} );

	it.each( actual.map( ( c ) => [ c.title, c ] as const ) )( '%s', ( title, c ) => {
		const recorded = JSON.parse( readFileSync( FILE, 'utf8' ) ) as Array< Case & { markup: string } >;
		const match = recorded.find( ( r ) => r.title === title );

		expect( match?.block, 'the case changed; re-record deliberately' ).toEqual( c.block );
		expect( c.markup, 'save() no longer writes the recorded markup; the PHP serializer must change with it' ).toBe( match?.markup );
	} );
} );
