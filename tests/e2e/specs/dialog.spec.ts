/**
 * The Dialog on a published page: every way to open and close one, where each kind sits on a phone,
 * a tablet and a desktop, the Loop card that opens its item, and what the page loads for it.
 *
 * The pages are built once, in a Chromium editor, from the blocks' own save output (createBlock +
 * serialize), then only visited: what is under test is the page, not the editor. The same specs run
 * in WebKit (playwright.config.ts), which has neither invoker commands nor `closedby`, so there they
 * go through the dialog behaviour's polyfills instead of the browser's own.
 */

import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test, type Browser, type Page } from '@playwright/test';
import { ConsoleWatcher } from '../support/blocks';

// One worker per project runs this file in order, so the pages below are built once.
test.describe.configure( { mode: 'default' } );

type Spec = [ string, Record< string, unknown >, Spec[]? ];

/** Serialize block specs in the editor and publish them, as `type`, returning the permalink. */
async function publish( page: Page, title: string, blocks: Spec[], type: 'pages' | 'posts' = 'pages' ): Promise< { link: string; id: number } > {
	return page.evaluate(
		async ( { pageTitle, specs, kind } ) => {
			const wp = ( window as any ).wp;
			const build = ( [ name, attrs, inner = [] ]: any ): any => wp.blocks.createBlock( name, attrs, inner.map( build ) );
			const content = wp.blocks.serialize( specs.map( build ) );
			const created = await wp.apiFetch( { path: `/wp/v2/${ kind }`, method: 'POST', data: { title: pageTitle, status: 'publish', content } } );
			return { link: created.link as string, id: created.id as number };
		},
		{ pageTitle: title, specs: blocks, kind: type }
	);
}

/** Wait until the editor has registered the Blicks blocks, so createBlock knows them. */
async function editorReady( page: Page ): Promise< void > {
	await page.goto( '/wp-admin/post-new.php' );
	await page.waitForFunction( () => !! ( window as any ).wp?.blocks?.getBlockType?.( 'blicks/dialog' ), undefined, { timeout: 120_000 } );
}

const heading = ( content: string, level = 2 ): Spec => [ 'blicks/heading', { level, content } ];
const text = ( content: string ): Spec => [ 'blicks/text', { content } ];
const opens = ( label: string, anchor: string ): Spec => [ 'blicks/button', { text: label, action: 'dialog', dialog: anchor } ];
const dialog = ( anchor: string, attrs: Record< string, unknown >, inner: Spec[] ): Spec => [ 'blicks/dialog', { title: anchor, anchor, ...attrs }, inner ];

const KINDS = [
	{ anchor: 'k-modal', attrs: { kind: 'modal' }, phone: 'card', wide: 'card' },
	{ anchor: 'k-modal-sheet', attrs: { kind: 'modal', phone: 'sheet' }, phone: 'sheet', wide: 'card' },
	{ anchor: 'k-modal-full', attrs: { kind: 'modal', phone: 'full' }, phone: 'full', wide: 'card' },
	{ anchor: 'k-drawer-start', attrs: { kind: 'drawer', side: 'start' }, phone: 'start', wide: 'start' },
	{ anchor: 'k-drawer-end', attrs: { kind: 'drawer', side: 'end' }, phone: 'end', wide: 'end' },
	{ anchor: 'k-sheet', attrs: { kind: 'sheet' }, phone: 'sheet', wide: 'sheet' },
	{ anchor: 'k-full', attrs: { kind: 'full' }, phone: 'full', wide: 'full' },
] as const;

const SIZES = [
	{ width: 375, height: 667 },
	{ width: 768, height: 1024 },
	{ width: 1440, height: 900 },
];

const ITEMS = [
	{ slug: 'arc-lamp', title: 'Arc floor lamp', price: '$189', url: '/?p=1' },
	{ slug: 'oak-table', title: 'Oak side table', price: '$240', url: '/?p=1' },
];

const bound = ( attr: string, key: string ) => ( { metadata: { bindings: { [ attr ]: { source: 'blicks/item', args: { key } } } } } );

const pages: Record< string, string > = {};

test.beforeAll( async ( { browserName }, testInfo ) => {
	testInfo.setTimeout( 300_000 );
	const { baseURL, storageState } = testInfo.project.use;
	// The editor is driven in Chromium whatever the project; the pages are then visited in it.
	const browser: Browser = await chromium.launch();
	const context = await browser.newContext( { baseURL, storageState: storageState as string } );
	const page = await context.newPage();
	page.setDefaultTimeout( 120_000 );
	await editorReady( page );

	const tag = `${ browserName }-${ Date.now() }`;
	const lorem = text( 'Long enough to scroll. '.repeat( 400 ) );

	pages.basic = ( await publish( page, `Dialog basics ${ tag }`, [
		opens( 'Open the offer', 'promo' ),
		text( 'Or <a href="#dialog-promo">see the offer</a>.' ),
		opens( 'Open the notice', 'notice' ),
		opens( 'Open the strict one', 'strict' ),
		dialog( 'promo', {}, [
			heading( 'Spring offer' ),
			text( 'Ten percent off everything.' ),
			[ 'blicks/button', { text: 'No thanks', action: 'close' } ],
		] ),
		dialog( 'notice', { modal: false }, [ heading( 'We use cookies' ), [ 'blicks/button', { text: 'Fine', action: 'close' } ] ] ),
		dialog( 'strict', { outsideCloses: false }, [ heading( 'Read this first' ) ] ),
		lorem,
	] ) ).link;

	pages.kinds = ( await publish( page, `Dialog kinds ${ tag }`, [
		...KINDS.map( ( k ) => text( `<a href="#dialog-${ k.anchor }">${ k.anchor }</a>` ) ),
		...KINDS.map( ( k ) => dialog( k.anchor, k.attrs, [ heading( `The ${ k.anchor } dialog` ), text( 'Some content.' ) ] ) ),
		lorem,
	] ) ).link;

	pages.transformed = ( await publish( page, `Dialog in a section ${ tag }`, [
		opens( 'Open the corner offer', 'corner' ),
		[ 'blicks/section', {}, [ text( 'A section a theme transforms.' ), dialog( 'corner', { modal: false }, [ heading( 'Corner offer' ) ] ) ] ],
	] ) ).link;

	const loop = ( itemInUrl: boolean ): Spec => [ 'blicks/loop', { source: 'json', data: JSON.stringify( ITEMS ), itemInUrl }, [
		[ 'blicks/box', { kind: 'card' }, [
			[ 'blicks/heading', { level: 3, content: 'Title', ...bound( 'content', 'title' ) } ],
			[ 'blicks/button', { text: 'View', url: '/?p=1', metadata: { bindings: { url: { source: 'blicks/item', args: { key: 'url' } } } } } ],
			[ 'blicks/button', { text: 'Details', url: '/?p=1', metadata: { bindings: { url: { source: 'blicks/item', args: { key: 'url' } } } } } ],
		] ],
		dialog( 'item-preview', {}, [
			[ 'blicks/heading', { level: 2, content: 'Item title', ...bound( 'content', 'title' ) } ],
			[ 'blicks/text', { content: '$0', ...bound( 'content', 'price' ) } ],
		] ),
	] ];
	pages.loop = ( await publish( page, `Dialog loop ${ tag }`, [ loop( false ) ] ) ).link;
	pages.loopUrl = ( await publish( page, `Dialog loop address ${ tag }`, [ loop( true ) ] ) ).link;

	pages.plain = ( await publish( page, `No dialog ${ tag }`, [ heading( 'Nothing to open' ), text( 'Just words.' ) ] ) ).link;

	await browser.close();
} );

/** The page's `bl:dialog-*` events, as they happened. */
async function recordEvents( page: Page ): Promise< void > {
	await page.addInitScript( () => {
		( window as any ).__dialogEvents = [];
		for ( const type of [ 'bl:dialog-open', 'bl:dialog-close' ] ) {
			document.addEventListener( type, ( e ) => ( window as any ).__dialogEvents.push( { type, ...( e as CustomEvent ).detail } ) );
		}
	} );
}
const events = ( page: Page ) => page.evaluate( () => ( window as any ).__dialogEvents as Array< Record< string, string > > );
const lastEvent = async ( page: Page ) => ( await events( page ) ).at( -1 );

/** Wait for the page and its modules: in WebKit, opening relies on the dialog behaviour. */
async function visit( page: Page, url: string ): Promise< void > {
	await page.goto( url );
	await page.waitForLoadState( 'networkidle' );
}

/** A dialog's box once it has stopped moving: two reads in a row agree. */
async function settledBox( page: Page, id: string ) {
	let last = '';
	let box = null as { x: number; y: number; width: number; height: number } | null;
	await expect.poll( async () => {
		box = await page.locator( `#${ id }` ).boundingBox();
		const now = JSON.stringify( box );
		const same = now === last;
		last = now;
		return same;
	}, { intervals: [ 100 ] } ).toBe( true );
	// The viewport is the area a fixed box, a dialog and its ::backdrop are laid out in, not
	// innerWidth: with classic scrollbars (Windows, Linux) a modal's scroll lock keeps the page's
	// scrollbar gutter (scrollbar-gutter: stable), so innerWidth counts 15px no dialog can reach,
	// and while the root is overflow: hidden clientWidth does not subtract it either. Measured
	// with a fixed box; the dialog's x is taken from its left edge, wherever the gutter sits.
	const viewport = await page.evaluate( () => {
		const probe = document.createElement( 'div' );
		probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
		document.body.append( probe );
		const { left, top, width, height } = probe.getBoundingClientRect();
		probe.remove();
		return { left, top, width, height };
	} );
	const { x, y, width, height } = box!;
	return { box: { x: x - viewport.left, y: y - viewport.top, width, height }, vw: viewport.width, vh: viewport.height };
}

const isOpen = ( page: Page, id: string ) => page.locator( `#${ id }` ).evaluate( ( d: HTMLDialogElement ) => d.open );
const isModal = ( page: Page, id: string ) => page.locator( `#${ id }` ).evaluate( ( d ) => d.matches( ':modal' ) );
const focusInside = ( page: Page, id: string ) => page.locator( `#${ id }` ).evaluate( ( d ) => d.contains( document.activeElement ) );

test.describe( 'opening and closing', () => {
	// Boxes are measured at rest, not mid-transition.
	test.use( { reducedMotion: 'reduce' } );
	test.beforeEach( async ( { page } ) => recordEvents( page ) );

	test( 'a Button opens it, focus moves in, and Esc gives focus back', async ( { page } ) => {
		const watcher = new ConsoleWatcher( page );
		await visit( page, pages.basic );
		const opener = page.getByRole( 'button', { name: 'Open the offer' } );

		await opener.click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( true );
		expect( await isModal( page, 'dialog-promo' ) ).toBe( true );
		expect( await focusInside( page, 'dialog-promo' ) ).toBe( true );
		// Named by its first heading, written at render.
		await expect( page.getByRole( 'dialog', { name: 'Spring offer' } ) ).toBeVisible();

		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		await expect( opener ).toBeFocused();
		expect( await lastEvent( page ) ).toMatchObject( { type: 'bl:dialog-close', id: 'dialog-promo', reason: 'esc', source: 'click' } );
		expect( watcher.errors ).toEqual( [] );
	} );

	test( 'a link to #dialog-<address> opens it without moving the page', async ( { page } ) => {
		await visit( page, pages.basic );
		const link = page.getByRole( 'link', { name: 'see the offer' } );
		await link.click();

		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( true );
		expect( new URL( page.url() ).hash ).toBe( '' );
		await page.getByRole( 'button', { name: 'Close' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		await expect( link ).toBeFocused();
		expect( await lastEvent( page ) ).toMatchObject( { type: 'bl:dialog-close', reason: 'button' } );
	} );

	test( 'a page loaded at the address opens it, and closing drops the address', async ( { page } ) => {
		await visit( page, `${ pages.basic }#dialog-promo` );

		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( true );
		expect( ( await events( page ) )[ 0 ] ).toMatchObject( { type: 'bl:dialog-open', source: 'hash' } );
		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		expect( new URL( page.url() ).hash ).toBe( '' );
	} );

	test( 'a click outside closes it, unless it is set not to', async ( { page } ) => {
		await visit( page, pages.basic );

		await page.getByRole( 'button', { name: 'Open the offer' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( true );
		await page.mouse.click( 8, 8 );
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		expect( await lastEvent( page ) ).toMatchObject( { reason: 'outside' } );

		await page.getByRole( 'button', { name: 'Open the strict one' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-strict' ) ).toBe( true );
		await page.mouse.click( 8, 8 );
		await page.waitForTimeout( 300 );
		expect( await isOpen( page, 'dialog-strict' ) ).toBe( true );
		// Esc always closes.
		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-strict' ) ).toBe( false );
	} );

	test( 'the close button and a Button set to Close dialog close it', async ( { page } ) => {
		await visit( page, pages.basic );
		const opener = page.getByRole( 'button', { name: 'Open the offer' } );

		await opener.click();
		await page.getByRole( 'button', { name: 'Close', exact: true } ).click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		await expect( opener ).toBeFocused();

		await opener.click();
		await page.getByRole( 'button', { name: 'No thanks' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		await expect( opener ).toBeFocused();
		expect( await lastEvent( page ) ).toMatchObject( { reason: 'button' } );
	} );

	test( 'a dialog that does not block the page leaves it usable', async ( { page } ) => {
		await visit( page, pages.basic );
		await page.getByRole( 'button', { name: 'Open the notice' } ).click();

		await expect.poll( () => isOpen( page, 'dialog-notice' ) ).toBe( true );
		expect( await isModal( page, 'dialog-notice' ) ).toBe( false );
		expect( await focusInside( page, 'dialog-notice' ) ).toBe( true );
		// No backdrop, nothing inert: the page's own Button still works, and scrolls still scroll.
		const { box, vw, vh } = await settledBox( page, 'dialog-notice' );
		expect( Math.round( box.x + box.width ) ).toBe( vw - 16 );
		expect( Math.round( box.y + box.height ) ).toBe( vh - 16 );

		// Using the page does not close it: a modal opens over it, and it is still there after.
		await page.getByRole( 'button', { name: 'Open the offer' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( true );
		expect( await isOpen( page, 'dialog-notice' ) ).toBe( true );
		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		expect( await isOpen( page, 'dialog-notice' ) ).toBe( true );

		// Esc closes a non-modal one too, once it is the one in front.
		await page.locator( '#dialog-notice' ).getByRole( 'button', { name: 'Fine' } ).focus();
		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-notice' ) ).toBe( false );
		await expect( page.getByRole( 'button', { name: 'Open the notice' } ) ).toBeFocused();
	} );

	test( 'the page behind a modal does not scroll', async ( { page } ) => {
		await visit( page, pages.basic );
		await page.getByRole( 'button', { name: 'Open the offer' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( true );

		// Wherever the click scrolled the page to reach the Button, it stays there.
		const at = await page.evaluate( () => scrollY );
		await page.mouse.move( 10, 10 );
		await page.mouse.wheel( 0, 900 );
		await page.waitForTimeout( 300 );
		expect( await page.evaluate( () => scrollY ) ).toBe( at );

		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-promo' ) ).toBe( false );
		await page.mouse.wheel( 0, 900 );
		await expect.poll( () => page.evaluate( () => scrollY ) ).toBeGreaterThan( at );
	} );
} );

/** Where a kind's box should be, in a viewport of that size. */
function expectForm( form: string, box: { x: number; y: number; width: number; height: number }, vw: number, vh: number ) {
	const right = box.x + box.width;
	const bottom = box.y + box.height;
	const near = ( a: number, b: number ) => expect( Math.abs( a - b ) ).toBeLessThanOrEqual( 1.5 );

	if ( form === 'card' ) {
		near( box.x, vw - right );
		near( box.y, vh - bottom );
		expect( box.width ).toBeLessThanOrEqual( Math.min( 560, vw - 32 ) + 1 );
	} else if ( form === 'sheet' ) {
		near( box.x, 0 );
		near( right, vw );
		near( bottom, vh );
		expect( box.height ).toBeLessThan( vh );
	} else if ( form === 'full' ) {
		near( box.x, 0 );
		near( box.y, 0 );
		near( right, vw );
		near( bottom, vh );
	} else {
		near( box.y, 0 );
		near( bottom, vh );
		expect( box.width ).toBeLessThanOrEqual( Math.min( 380, vw * 0.86 ) + 1 );
		near( form === 'start' ? box.x : right, form === 'start' ? 0 : vw );
	}
}

test.describe( 'each kind, on a phone, a tablet and a desktop', () => {
	// The resting box, not one caught mid-transition.
	test.use( { reducedMotion: 'reduce' } );

	for ( const size of SIZES ) {
		test( `sits where it should at ${ size.width }px`, async ( { page } ) => {
			await page.setViewportSize( size );
			await visit( page, pages.kinds );

			for ( const k of KINDS ) {
				await page.getByRole( 'link', { name: k.anchor, exact: true } ).click();
				await expect.poll( () => isOpen( page, `dialog-${ k.anchor }` ), { message: k.anchor } ).toBe( true );
				const { box, vw, vh } = await settledBox( page, `dialog-${ k.anchor }` );
				await test.step( `${ k.anchor } is a ${ size.width <= 600 ? k.phone : k.wide }`, async () => {
					expectForm( size.width <= 600 ? k.phone : k.wide, box, vw, vh );
				} );
				await page.keyboard.press( 'Escape' );
				await expect.poll( () => isOpen( page, `dialog-${ k.anchor }` ) ).toBe( false );
			}
		} );
	}

	test( 'drawers swap sides in a right-to-left language', async ( { page } ) => {
		await page.setViewportSize( { width: 1440, height: 900 } );
		const url = new URL( pages.kinds );
		url.searchParams.set( 'e2e-rtl', '1' );
		await visit( page, url.toString() );
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'dir', 'rtl' );

		for ( const [ anchor, form ] of [ [ 'k-drawer-end', 'start' ], [ 'k-drawer-start', 'end' ] ] ) {
			await page.getByRole( 'link', { name: anchor, exact: true } ).click();
			await expect.poll( () => isOpen( page, `dialog-${ anchor }` ) ).toBe( true );
			const { box, vw, vh } = await settledBox( page, `dialog-${ anchor }` );
			expectForm( form, box, vw, vh );
			await page.keyboard.press( 'Escape' );
		}
	} );

	test( 'every open kind passes axe', async ( { page } ) => {
		await page.setViewportSize( { width: 1440, height: 900 } );
		await visit( page, pages.kinds );

		for ( const k of KINDS ) {
			await page.getByRole( 'link', { name: k.anchor, exact: true } ).click();
			await expect.poll( () => isOpen( page, `dialog-${ k.anchor }` ) ).toBe( true );
			// Mid-fade, text is measured against a half-shown dialog: let the opening finish.
			await page.locator( `#dialog-${ k.anchor }` ).evaluate( ( el ) => Promise.all( el.getAnimations( { subtree: true } ).map( ( a ) => a.finished ) ) );
			const results = await new AxeBuilder( { page } ).include( `#dialog-${ k.anchor }` ).analyze();
			expect( results.violations.map( ( v ) => `${ k.anchor }: ${ v.id } (${ v.nodes.map( ( n ) => n.target ).join( ', ' ) })` ) ).toEqual( [] );
			await page.keyboard.press( 'Escape' );
			await expect.poll( () => isOpen( page, `dialog-${ k.anchor }` ) ).toBe( false );
		}
	} );
} );

test.describe( 'motion', () => {
	test( 'opens with a transition, and with none when reduced motion is asked for', async ( { page } ) => {
		const duration = async () => {
			await visit( page, pages.kinds );
			return page.locator( '#dialog-k-drawer-end' ).evaluate( ( d ) => getComputedStyle( d ).transitionDuration );
		};

		await page.emulateMedia( { reducedMotion: 'no-preference' } );
		expect( await duration() ).toMatch( /0\.24s/ );

		await page.emulateMedia( { reducedMotion: 'reduce' } );
		expect( await duration() ).toBe( '0s' );
		await page.getByRole( 'link', { name: 'k-drawer-end', exact: true } ).click();
		await expect.poll( () => isOpen( page, 'dialog-k-drawer-end' ) ).toBe( true );
		expect( await page.locator( '#dialog-k-drawer-end' ).evaluate( ( d ) => getComputedStyle( d ).transform ) ).toBe( 'none' );
	} );
} );

test.describe( 'on a phone', () => {
	test.use( { viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' } );

	test( 'a sheet keeps clear of the home bar and the page does not scroll behind it', async ( { page } ) => {
		await visit( page, pages.kinds );
		await page.getByRole( 'link', { name: 'k-sheet', exact: true } ).tap();
		await expect.poll( () => isOpen( page, 'dialog-k-sheet' ) ).toBe( true );

		// env(safe-area-inset-bottom) is 0 here (no notch to emulate), so the padding falls back to
		// the spacing token: the rule is in place and resolves; the inset itself is not covered.
		const padding = await page.locator( '#dialog-k-sheet' ).evaluate( ( d ) => parseFloat( getComputedStyle( d ).paddingBottom ) );
		expect( padding ).toBeGreaterThanOrEqual( 16 );
		expect( await page.evaluate( () => getComputedStyle( document.documentElement ).overflow ) ).toBe( 'hidden' );
	} );
} );

test.describe( 'inside a transformed Section', () => {
	test.use( { reducedMotion: 'reduce' } );

	test( 'a dialog that does not block the page still sits in the corner of the screen', async ( { page } ) => {
		await page.setViewportSize( { width: 1440, height: 900 } );
		await visit( page, pages.transformed );
		// What a theme's animation or sticky header does to an ancestor: a containing block for
		// everything fixed inside it.
		await page.locator( '#dialog-corner' ).evaluate( ( d ) => {
			const section = d.closest( '.bl-section' ) as HTMLElement;
			Object.assign( section.style, { transform: 'translateZ(0)', margin: '200px auto', width: '50%' } );
		} );

		await page.getByRole( 'button', { name: 'Open the corner offer' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-corner' ) ).toBe( true );
		const { box, vw, vh } = await settledBox( page, 'dialog-corner' );
		expect( Math.round( box.x + box.width ) ).toBe( vw - 16 );
		expect( Math.round( box.y + box.height ) ).toBe( vh - 16 );
	} );
} );

test.describe( 'a Loop card', () => {
	test.beforeEach( async ( { page } ) => recordEvents( page ) );

	test( 'opens its own item in the dialog, and Ctrl/Cmd-click still follows the link', async ( { page, context } ) => {
		const watcher = new ConsoleWatcher( page );
		await visit( page, pages.loop );
		const cards = page.locator( '.bl-loop__item' );
		await expect( cards ).toHaveCount( 2 );

		const view = cards.nth( 1 ).getByRole( 'link', { name: 'View' } );
		await view.click();
		await expect.poll( () => isOpen( page, 'dialog-item-preview' ) ).toBe( true );
		const shown = page.getByRole( 'dialog', { name: ITEMS[ 1 ].title } );
		await expect( shown ).toBeVisible();
		await expect( shown ).toContainText( ITEMS[ 1 ].price );
		expect( await lastEvent( page ) ).toMatchObject( { type: 'bl:dialog-open', source: 'loop' } );
		// Not in the address unless the Loop asks.
		expect( new URL( page.url() ).searchParams.has( 'item' ) ).toBe( false );

		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-item-preview' ) ).toBe( false );
		await expect( view ).toBeFocused();

		// The first card's item, this time, from its second link to the item.
		await cards.nth( 0 ).getByRole( 'link', { name: 'Details' } ).click();
		await expect( page.getByRole( 'dialog', { name: ITEMS[ 0 ].title } ) ).toContainText( ITEMS[ 0 ].price );
		// The item's blocks sit in the dialog's own column.
		expect( await page.locator( '#dialog-item-preview .bl-dialog__item' ).evaluate( ( el ) => getComputedStyle( el ).display ) ).toBe( 'contents' );
		await page.keyboard.press( 'Escape' );

		const [ tab ] = await Promise.all( [ context.waitForEvent( 'page' ), view.click( { modifiers: [ 'ControlOrMeta' ] } ) ] );
		// The item's own page (WordPress redirects `/?p=1` to its pretty address).
		await tab.waitForURL( /^http:\/\/127\.0\.0\.1:\d+\// );
		await expect( tab.locator( 'body' ) ).toHaveClass( /single|postid-1/ );
		expect( await isOpen( page, 'dialog-item-preview' ) ).toBe( false );
		await tab.close();
		expect( watcher.errors ).toEqual( [] );
	} );

	test( 'puts its item in the address when the Loop asks, and Back closes it', async ( { page } ) => {
		await visit( page, pages.loopUrl );
		const start = page.url();
		await page.locator( '.bl-loop__item' ).nth( 1 ).getByRole( 'link', { name: 'View' } ).click();

		await expect.poll( () => isOpen( page, 'dialog-item-preview' ) ).toBe( true );
		expect( new URL( page.url() ).searchParams.get( 'item' ) ).toBe( 'oak-table' );

		await page.evaluate( () => history.back() );
		await expect.poll( () => isOpen( page, 'dialog-item-preview' ) ).toBe( false );
		expect( page.url() ).toBe( start );
		expect( await lastEvent( page ) ).toMatchObject( { type: 'bl:dialog-close', reason: 'back' } );

		// Closing it any other way takes its entry back off the history.
		await page.locator( '.bl-loop__item' ).nth( 0 ).getByRole( 'link', { name: 'View' } ).click();
		await expect.poll( () => isOpen( page, 'dialog-item-preview' ) ).toBe( true );
		await page.keyboard.press( 'Escape' );
		await expect.poll( () => page.url() ).toBe( start );
	} );

	test( 'a page loaded with ?item= opens that item', async ( { page } ) => {
		const url = new URL( pages.loopUrl );
		url.searchParams.set( 'item', 'oak-table' );
		await visit( page, url.toString() );

		await expect( page.getByRole( 'dialog', { name: ITEMS[ 1 ].title } ) ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect.poll( () => isOpen( page, 'dialog-item-preview' ) ).toBe( false );
		expect( new URL( page.url() ).searchParams.has( 'item' ) ).toBe( false );
	} );
} );

test( 'a page with no dialog loads no dialog script', async ( { page } ) => {
	const scripts = async () => page.evaluate( () => [ ...document.querySelectorAll( 'script' ) ].map( ( s ) => `${ s.src } ${ s.type === 'importmap' ? s.textContent : '' }` ).join( '\n' ) );

	await visit( page, pages.plain );
	expect( await scripts() ).not.toMatch( /behaviours\/dialog|@blicks\/dialog/ );

	await visit( page, pages.basic );
	expect( await scripts() ).toMatch( /behaviours\/dialog/ );
} );

test( 'content an Author saves keeps commandfor, command and closedby', async ( { browserName, page }, testInfo ) => {
	test.skip( browserName !== 'chromium', 'kses runs on the server: once is enough' );
	const { baseURL } = testInfo.project.use;
	const admin = page;
	await editorReady( admin );
	const login = `author${ Date.now() }`;
	await admin.evaluate( ( username ) => ( window as any ).wp.apiFetch( {
		path: '/wp/v2/users',
		method: 'POST',
		data: { username, password: 'password', email: `${ username }@example.com`, roles: [ 'author' ] },
	} ), login );

	const browser = admin.context().browser()!;
	const context = await browser.newContext( { baseURL } );
	const author = await context.newPage();
	await author.goto( '/wp-login.php' );
	await author.fill( '#user_login', login );
	await author.fill( '#user_pass', 'password' );
	await author.click( '#wp-submit' );
	await editorReady( author );
	expect( await author.evaluate( () => ( window as any ).wp.data.select( 'core' ).canUser( 'create', { kind: 'root', name: 'user' } ) ) ).not.toBe( true );

	const { id, link } = await publish( author, 'An Author’s offer', [
		opens( 'Open it', 'author' ),
		dialog( 'author', {}, [ heading( 'From an Author' ), [ 'blicks/button', { text: 'Not now', action: 'close' } ] ] ),
	], 'posts' );
	await context.close();

	const raw: string = await admin.evaluate( async ( postId ) => ( await ( window as any ).wp.apiFetch( { path: `/wp/v2/posts/${ postId }?context=edit` } ) ).content.raw, id );
	expect( raw ).toMatch( /<button[^>]*commandfor="dialog-author"[^>]*command="show-modal"/ );
	expect( raw ).toMatch( /<dialog[^>]*id="dialog-author"[^>]*closedby="any"/ );
	expect( raw ).toMatch( /<dialog[^>]*class="bl-dialog / );
	expect( raw ).toMatch( /<button[^>]*command="close"[^>]*>(<span[^>]*>)?Not now/ );

	await visit( admin, link );
	await admin.getByRole( 'button', { name: 'Open it' } ).click();
	await expect( admin.getByRole( 'dialog', { name: 'From an Author' } ) ).toBeVisible();
} );
