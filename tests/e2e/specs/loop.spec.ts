/**
 * The Loop in real WordPress: the editor previews one card per item from the server's own items
 * (blicks/v1/loop/items), and the published page renders the same items with the same values.
 */

import { expect, test, type Page } from '@playwright/test';
import { ConsoleWatcher, canvas, openEditor, publishCurrentContent } from '../support/blocks';

const ITEMS = [
	{ title: 'Arc floor lamp', price: 189, featured: true },
	{ title: 'Oak <side> table', price: 240, featured: false },
	{ title: 'Linen throw', price: 72.5, featured: false },
];

const PICTURES = [
	{ title: 'Arc floor lamp', image: 'https://picsum.photos/seed/lamp/600/400' },
	{ title: 'Oak table', image: 'https://picsum.photos/seed/oak/600/400' },
];

test( 'binds a Heading and an Image, and the page gets each item’s picture', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );

	const ids = await page.evaluate( ( items ) => {
		const { createBlock } = ( window as any ).wp.blocks;
		const heading = createBlock( 'blicks/heading', { level: 3, content: 'Typed' } );
		const image = createBlock( 'blicks/image', {} );
		const loop = createBlock( 'blicks/loop', { source: 'json', data: JSON.stringify( items ) }, [ createBlock( 'blicks/box', { kind: 'card' }, [ image, heading ] ) ] );
		( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( loop );
		return { heading: heading.clientId, image: image.clientId };
	}, PICTURES );
	const select = ( id: string ) => page.evaluate( ( c ) => ( window as any ).wp.data.dispatch( 'core/block-editor' ).selectBlock( c ), id );

	await select( ids.heading );
	await page.getByLabel( 'Heading comes from' ).selectOption( 'title' );

	await select( ids.image );
	await page.getByLabel( 'The picture comes from' ).selectOption( 'image' );
	await page.getByLabel( 'The alt text comes from' ).selectOption( 'title' );

	// Binding the picture also saved the first item's address, so the template has an <img>.
	const url = await page.evaluate( ( id ) => ( window as any ).wp.data.select( 'core/block-editor' ).getBlockAttributes( id ).url, ids.image );
	expect( url ).toBe( PICTURES[ 0 ].image );

	const loop = canvas( page ).locator( '.bl-loop' ).first();
	await expect( loop.locator( '.is-template .bl-heading.is-bound' ) ).toContainText( 'Arc floor lamp' );
	await expect( loop.locator( '.is-template img' ) ).toHaveAttribute( 'alt', 'Arc floor lamp' );
	await expect( loop.locator( '.is-preview img' ).first() ).toHaveAttribute( 'src', PICTURES[ 1 ].image );

	const permalink = await publishCurrentContent( page, 'Loop pictures' );
	await page.goto( permalink );
	const items = page.locator( '.bl-loop .bl-loop__item' );
	await expect( items.nth( 0 ).locator( '.bl-heading' ) ).toHaveText( 'Arc floor lamp' );
	await expect( items.nth( 1 ).locator( 'img' ) ).toHaveAttribute( 'src', PICTURES[ 1 ].image );
	await expect( items.nth( 1 ).locator( 'img' ) ).toHaveAttribute( 'alt', 'Oak table' );

	expect( watcher.errors ).toEqual( [] );
} );

test( 'binds a Button’s label and link, and drops an unsafe link on the page', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );
	const items = [
		{ cta: 'View the lamp', url: 'https://shop.example/lamp' },
		{ cta: 'View the table', url: 'javascript:alert(1)' },
	];

	const id = await page.evaluate( ( data ) => {
		const { createBlock } = ( window as any ).wp.blocks;
		const button = createBlock( 'blicks/button', { text: 'View' } );
		const loop = createBlock( 'blicks/loop', { source: 'json', data: JSON.stringify( data ) }, [ createBlock( 'blicks/box', { kind: 'card' }, [ button ] ) ] );
		( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( loop );
		return button.clientId;
	}, items );
	await page.evaluate( ( c ) => ( window as any ).wp.data.dispatch( 'core/block-editor' ).selectBlock( c ), id );

	await page.getByLabel( 'The label comes from' ).selectOption( 'cta' );
	await page.getByLabel( 'The link comes from' ).selectOption( 'url' );

	// A Button with no link saves a <button>; binding the link stored the first item's address.
	const url = await page.evaluate( ( c ) => ( window as any ).wp.data.select( 'core/block-editor' ).getBlockAttributes( c ).url, id );
	expect( url ).toBe( items[ 0 ].url );

	const loop = canvas( page ).locator( '.bl-loop' ).first();
	await expect( loop.locator( '.is-template .bl-button' ) ).toContainText( 'View the lamp' );
	await expect( loop.locator( '.is-template .bl-bound-chip' ) ).toHaveText( 'cta' );

	const permalink = await publishCurrentContent( page, 'Loop buttons' );
	await page.goto( permalink );
	const buttons = page.locator( '.bl-loop .bl-button' );
	await expect( buttons.nth( 0 ) ).toHaveAttribute( 'href', items[ 0 ].url );
	await expect( buttons.nth( 0 ) ).toHaveText( 'View the lamp' );
	await expect( buttons.nth( 1 ) ).toHaveText( 'View the table' );
	await expect( buttons.nth( 1 ) ).not.toHaveAttribute( 'href', /javascript/ );

	expect( watcher.errors ).toEqual( [] );
} );

const bind = ( attr: string, key: string, more: Record< string, string > = {} ) => ( {
	metadata: { bindings: { [ attr ]: { source: 'blicks/item', args: { key, ...more } } } },
} );

test( 'previews each item in the editor and renders the same on the page', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );

	await page.evaluate(
		( { items, title, price } ) => {
			const { createBlock } = ( window as any ).wp.blocks;
			const loop = createBlock( 'blicks/loop', {
				source: 'json',
				data: JSON.stringify( items ),
				layout: 'bento',
				bento: { tiles: [ '1x1' ], rowHeight: 180, repeat: true },
				rules: [ { when: { field: 'featured', op: 'is', value: 'true' }, then: [ { size: '2x2' }, { card: 'highlight' } ] } ],
			}, [
				createBlock( 'blicks/box', { kind: 'card', tag: 'article' }, [
					createBlock( 'blicks/heading', { level: 3, content: 'Item title', ...title } ),
					createBlock( 'blicks/text', { content: '$0', ...price } ),
				] ),
			] );
			( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( loop );
		},
		{ items: ITEMS, title: bind( 'content', 'title' ), price: bind( 'content', 'price', { format: 'currency', formatArg: '$' } ) }
	);

	const loop = canvas( page ).locator( '.bl-loop' ).first();
	await expect( loop ).toBeVisible();

	// The live card first, then one read-only preview per other item, with that item's values.
	await expect( loop.locator( '.bl-loop__item.is-template' ) ).toHaveCount( 1 );
	await expect( loop.locator( '.bl-loop__item.is-preview' ) ).toHaveCount( 2 );
	await expect( loop.locator( '.is-preview' ).nth( 0 ) ).toContainText( 'Oak <side> table' );
	await expect( loop.locator( '.is-preview' ).nth( 1 ) ).toContainText( '$72.50' );

	// The rule made the featured item a highlighted 2 × 2 tile.
	await expect( loop.locator( '.bl-loop__item.is-template' ) ).toHaveClass( /is-card-highlight/ );
	await expect( canvas( page ).locator( '.block-editor-warning' ) ).toHaveCount( 0 );

	const permalink = await publishCurrentContent( page, 'Loop render' );
	await page.goto( permalink );

	const items = page.locator( '.bl-loop .bl-loop__item' );
	await expect( items ).toHaveCount( 3 );
	await expect( items.nth( 0 ) ).toHaveClass( /is-card-highlight/ );
	await expect( items.nth( 0 ).locator( '.bl-heading' ) ).toHaveText( 'Arc floor lamp' );
	await expect( items.nth( 1 ).locator( '.bl-heading' ) ).toHaveText( 'Oak <side> table' );
	await expect( items.nth( 2 ).locator( '.bl-text' ) ).toHaveText( '$72.50' );

	expect( watcher.errors ).toEqual( [] );
} );

test( 'binds a Text to a field from its Data section', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );

	const ids = await page.evaluate( ( items ) => {
		const { createBlock } = ( window as any ).wp.blocks;
		const text = createBlock( 'blicks/text', { content: 'Typed' } );
		const outside = createBlock( 'blicks/text', { content: 'Not in a loop' } );
		const loop = createBlock( 'blicks/loop', { source: 'json', data: JSON.stringify( items ) }, [ createBlock( 'blicks/box', { kind: 'card' }, [ text ] ) ] );
		( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( [ loop, outside ] );
		return { text: text.clientId, outside: outside.clientId };
	}, ITEMS );
	const select = ( id: string ) => page.evaluate( ( c ) => ( window as any ).wp.data.dispatch( 'core/block-editor' ).selectBlock( c ), id );

	// Outside a Loop there is nothing to bind.
	await select( ids.outside );
	await expect( page.getByLabel( 'Text comes from' ) ).toHaveCount( 0 );

	// Inside one, the Data section offers the item's fields.
	await select( ids.text );
	await page.getByLabel( 'Text comes from' ).selectOption( 'title' );

	const binding = await page.evaluate( ( id ) => ( window as any ).wp.data.select( 'core/block-editor' ).getBlockAttributes( id ).metadata?.bindings?.content, ids.text );
	expect( binding ).toEqual( { source: 'blicks/item', args: { key: 'title' } } );

	// The live card shows the first item's value with a chip naming the field; the previews show theirs.
	const loop = canvas( page ).locator( '.bl-loop' ).first();
	await expect( loop.locator( '.is-template .bl-text.is-bound' ) ).toContainText( 'Arc floor lamp' );
	await expect( loop.locator( '.is-template .bl-bound-chip' ) ).toHaveText( 'title' );
	await expect( loop.locator( '.is-preview' ).nth( 0 ) ).toContainText( 'Oak <side> table' );

	// Unbinding brings the typed text back.
	await page.getByLabel( 'Text comes from' ).selectOption( '' );
	await expect( loop.locator( '.is-template .bl-text' ) ).toContainText( 'Typed' );

	expect( watcher.errors ).toEqual( [] );
} );

const PRODUCTS = ITEMS.map( ( item ) => ( { title: item.title, description: `About the ${ item.title.toLowerCase() }` } ) );

/** Insert a Loop as the inserter does: no inner blocks, so it starts with its starter card. */
async function insertNewLoop( page: Page ): Promise< string > {
	const id = await page.evaluate( ( items ) => {
		const { createBlock } = ( window as any ).wp.blocks;
		const loop = createBlock( 'blicks/loop', { source: 'json', data: JSON.stringify( items ) } );
		( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( loop );
		return loop.clientId;
	}, PRODUCTS );
	await page.evaluate( ( c ) => ( window as any ).wp.data.dispatch( 'core/block-editor' ).selectBlock( c ), id );
	return id;
}

test( 'a new Loop offers card designs on the canvas, previews them and can undo one', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );
	await insertNewLoop( page );

	const loop = canvas( page ).locator( '.bl-loop' ).first();
	const shelf = loop.locator( '.bl-shelf--wide' );
	await expect( shelf ).toBeVisible();
	const funky = shelf.getByRole( 'button', { name: 'Feature card, Funky' } );

	// The thumbnail is the real card, filled with the first item.
	await expect( funky.locator( '.bl-heading' ) ).toHaveText( 'Arc floor lamp' );

	// Pointing at it previews the design on every item.
	await funky.hover();
	await expect( loop.locator( '.bl-loop__items.is-ghost .bl-loop__item' ) ).toHaveCount( 3 );
	await expect( loop.locator( '.is-ghost .bl-loop__item' ).nth( 2 ) ).toContainText( 'About the linen throw' );

	await funky.click();
	await expect( page.locator( '.components-snackbar' ) ).toContainText( 'Card changed. 2 blocks show item fields.' );
	await expect( shelf ).toHaveCount( 0 );
	await expect( loop.locator( '.is-template .bl-heading' ) ).toContainText( 'Arc floor lamp' );
	await expect( page.getByRole( 'button', { name: 'Card: Feature card · Funky' } ) ).toBeVisible();

	await page.locator( '.components-snackbar' ).getByRole( 'button', { name: 'Undo' } ).click();
	await expect( loop.locator( '.is-template .bl-heading' ) ).toContainText( 'Item title' );

	expect( watcher.errors ).toEqual( [] );
} );

test( 'the toolbar reopens the designs, and the chosen card reaches the page', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );
	await insertNewLoop( page );

	const loop = canvas( page ).locator( '.bl-loop' ).first();
	await loop.locator( '.bl-shelf--wide' ).getByRole( 'button', { name: 'Start with a plain card' } ).click();
	await expect( loop.locator( '.bl-shelf' ) ).toHaveCount( 0 );

	await page.getByRole( 'button', { name: 'Card design' } ).click();
	const shelf = loop.locator( '.bl-shelf--grid' );
	await shelf.getByRole( 'button', { name: 'Offer panel, Editorial' } ).click();
	await expect( page.locator( '.components-snackbar' ) ).toContainText( 'Card changed. 2 blocks show item fields.' );

	const permalink = await publishCurrentContent( page, 'Loop card design' );
	await page.goto( permalink );
	const cards = page.locator( '.bl-loop .bl-loop__item' );
	await expect( cards ).toHaveCount( 3 );
	await expect( cards.nth( 2 ).locator( '.bl-heading' ).first() ).toHaveText( 'Linen throw' );
	await expect( cards.nth( 2 ).locator( '.bl-text' ).first() ).toHaveText( 'About the linen throw' );

	expect( watcher.errors ).toEqual( [] );
} );

test( 'offers a card from the site’s saved patterns', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );

	const title = `Team card ${ Date.now() }`;
	await page.evaluate( async ( name ) => {
		const wp = ( window as any ).wp;
		const { createBlock, serialize } = wp.blocks;
		const pattern = createBlock( 'blicks/section', {}, [
			createBlock( 'blicks/box', { kind: 'card' }, [ createBlock( 'blicks/heading', { level: 3, content: 'Ada' } ) ] ),
		] );
		await wp.apiFetch( {
			path: '/wp/v2/blocks',
			method: 'POST',
			data: { title: name, status: 'publish', content: serialize( [ pattern ] ), meta: { wp_pattern_sync_status: 'unsynced' } },
		} );
	}, title );
	await insertNewLoop( page );

	const loop = canvas( page ).locator( '.bl-loop' ).first();
	const shelf = loop.locator( '.bl-shelf--wide' );
	await shelf.getByRole( 'tab', { name: 'Your patterns' } ).click();
	await shelf.getByRole( 'button', { name: new RegExp( title ) } ).click();

	await expect( loop.locator( '.is-template .bl-heading' ) ).toContainText( 'Arc floor lamp' );
	await expect( loop.locator( '.is-preview' ).nth( 0 ) ).toContainText( 'Oak <side> table' );

	expect( watcher.errors ).toEqual( [] );
} );

const TRIPS = [
	{ title: 'Everest', days: [ { title: 'Fly to Lukla' }, { title: 'Trek to Namche' } ] },
	{ title: 'Bhutan', days: [ { title: 'Arrive in Paro' } ] },
	{ title: 'Mustang', days: [ { title: 'Drive to Jomsom' }, { title: 'Kagbeni' }, { title: 'Lo Manthang' } ] },
];

test( 'a Loop inside a card repeats over that card’s list, in the editor and on the page', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );

	// Both levels bind `title`: each must show its own.
	const innerId = await page.evaluate(
		( { trips, title } ) => {
			const { createBlock } = ( window as any ).wp.blocks;
			const inner = createBlock( 'blicks/loop', { layout: 'list' }, [ createBlock( 'blicks/text', { content: 'Day', ...title } ) ] );
			const outer = createBlock( 'blicks/loop', { source: 'json', data: JSON.stringify( trips ) }, [
				createBlock( 'blicks/box', { kind: 'card', tag: 'article' }, [ createBlock( 'blicks/heading', { level: 3, content: 'Trip', ...title } ), inner ] ),
			] );
			( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( outer );
			( window as any ).wp.data.dispatch( 'core/block-editor' ).selectBlock( inner.clientId );
			return inner.clientId as string;
		},
		{ trips: TRIPS, title: bind( 'content', 'title' ) }
	);

	// Inside a card, the inner Loop can come from a list of the card's item.
	await page.getByRole( 'radio', { name: 'A list of the item above' } ).click();
	await expect( page.getByLabel( 'List to loop over' ) ).toHaveValue( 'days' );
	expect( await page.evaluate( ( id ) => ( window as any ).wp.data.select( 'core/block-editor' ).getBlockAttributes( id ).source, innerId ) ).toBe( 'item' );

	// Every card, the live one and each preview, shows its own trip's days. Each inner Loop's first
	// day is its live card, so it also carries the field's chip: matched by contained text.
	const outer = canvas( page ).locator( '.bl-loop' ).first();
	const cards = outer.locator( ':scope > .bl-loop__items > .bl-loop__item' );
	const days = ( i: number ) => cards.nth( i ).locator( '.bl-loop .bl-loop__items > .bl-loop__item .bl-text' );
	await expect( cards ).toHaveCount( 3 );
	for ( const [ i, trip ] of TRIPS.entries() ) {
		await expect( days( i ) ).toHaveCount( trip.days.length );
		await expect( days( i ) ).toContainText( trip.days.map( ( d ) => d.title ) );
	}
	await expect( cards.nth( 1 ).locator( '.bl-heading' ).first() ).toHaveText( 'Bhutan' );

	// The outer Loop is in no card, so it does not offer the list source.
	await page.evaluate( () => {
		const editor = ( window as any ).wp.data;
		editor.dispatch( 'core/block-editor' ).selectBlock( editor.select( 'core/block-editor' ).getBlocks()[ 0 ].clientId );
	} );
	await expect( page.getByRole( 'radio', { name: 'Pasted' } ) ).toBeVisible();
	await expect( page.getByRole( 'radio', { name: 'A list of the item above' } ) ).toHaveCount( 0 );

	const permalink = await publishCurrentContent( page, 'Loop inside a card' );
	await page.goto( permalink );

	const published = page.locator( '.bl-loop' ).first().locator( ':scope > .bl-loop__items > .bl-loop__item' );
	await expect( published ).toHaveCount( 3 );
	for ( const [ i, trip ] of TRIPS.entries() ) {
		await expect( published.nth( i ).locator( '.bl-heading' ) ).toHaveText( trip.title );
		await expect( published.nth( i ).locator( '.bl-loop .bl-text' ) ).toHaveText( trip.days.map( ( d ) => d.title ) );
	}

	expect( watcher.errors ).toEqual( [] );
} );
