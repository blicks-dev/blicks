/**
 * Dialog Studio (modules/dialog-studio) on a published page: a saved dialog opened by a Button on a
 * page that does not hold it (and counted), and one that opens by itself, once per visit.
 *
 * The module loads only for browser contexts carrying the `blicks_e2e_modules` cookie
 * (mu-plugins/blicks-e2e-modules.php), and only when it was built:
 * `BLICKS_DEV_MODULES=dialog-studio pnpm build`.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const BUILT = existsSync( resolve( fileURLToPath( new URL( '.', import.meta.url ) ), '../../../modules/dialog-studio/build/view/auto.js' ) );

test.describe.configure( { mode: 'default' } );
test.skip( ! BUILT, 'Dialog Studio is not built: run BLICKS_DEV_MODULES=dialog-studio pnpm build.' );

type Spec = [ string, Record< string, unknown >, Spec[]? ];

const MODULE_COOKIE = ( baseURL: string ) => [ { name: 'blicks_e2e_modules', value: 'dialog-studio', url: baseURL } ];

async function withModule( context: BrowserContext, baseURL: string ): Promise< void > {
	await context.addCookies( MODULE_COOKIE( baseURL ) );
}

/** Serialize specs in the editor and create a post of `rest` base, returning its REST record. */
async function create( page: Page, rest: string, data: Record< string, unknown >, blocks: Spec[] ): Promise< { id: number; link: string } > {
	return page.evaluate(
		async ( { base, body, specs } ) => {
			const wp = ( window as any ).wp;
			const build = ( [ name, attrs, inner = [] ]: any ): any => wp.blocks.createBlock( name, attrs, inner.map( build ) );
			const created = await wp.apiFetch( { path: `/wp/v2/${ base }`, method: 'POST', data: { ...body, content: wp.blocks.serialize( specs.map( build ) ) } } );
			return { id: created.id as number, link: created.link as string };
		},
		{ base: rest, body: data, specs: blocks }
	);
}

const dialog = ( anchor: string, inner: Spec[], attrs: Record< string, unknown > = {} ): Spec => [ 'blicks/dialog', { title: anchor, anchor, ...attrs }, inner ];
const heading = ( content: string ): Spec => [ 'blicks/heading', { level: 2, content } ];

const pages: Record< string, string > = {};

test.beforeAll( async ( { browser }, testInfo ) => {
	testInfo.setTimeout( 300_000 );
	const { baseURL, storageState } = testInfo.project.use;
	const context = await browser.newContext( { baseURL, storageState: storageState as string } );
	await withModule( context, baseURL as string );
	const page = await context.newPage();
	page.setDefaultTimeout( 120_000 );

	await page.goto( '/wp-admin/post-new.php' );
	await page.waitForFunction( () => !! ( window as any ).wp?.blocks?.getBlockType?.( 'blicks/dialog' ), undefined, { timeout: 120_000 } );

	const tag = `${ testInfo.project.name }${ Date.now() }`;

	// A saved dialog, opened by a Button on a page that does not hold it.
	await create( page, 'blicks-dialogs', { title: 'Size guide', status: 'publish' }, [ dialog( `guide-${ tag }`, [ heading( 'Sizes' ) ] ) ] );
	pages.button = ( await create( page, 'pages', { title: 'Opens a saved dialog', status: 'publish' }, [ [ 'blicks/button', { text: 'Sizes', action: 'dialog', dialog: `guide-${ tag }` } ] ] ) ).link;
	pages.buttonId = `dialog-guide-${ tag }`;

	// One that opens by itself a second after load, once per visit, only on its own page.
	const target = await create( page, 'pages', { title: 'Has an offer', status: 'publish' }, [ [ 'blicks/text', { content: 'Hello.' } ] ] );
	await create(
		page,
		'blicks-dialogs',
		{
			title: 'Offer',
			status: 'publish',
			meta: {
				blicks_dialog_triggers: { load: { on: true, delay: 1 }, scroll: { on: false, percent: 50 }, exit: { on: false }, idle: { on: false, seconds: 30 } },
				blicks_dialog_rules: { where: 'some', include: [ `post:${ target.id }` ], exclude: [], screens: { desktop: true, tablet: true, phone: true }, visitors: 'all', frequency: 'session', days: 7, stopAfterConvert: true, schedule: { on: false, from: '', to: '' } },
			},
		},
		[ dialog( `offer-${ tag }`, [ heading( 'Ten percent off' ) ] ) ]
	);
	pages.auto = target.link;
	pages.autoId = `dialog-offer-${ tag }`;
	pages.other = pages.button;

	await context.close();
} );

/** A logged-out visitor with the module on. */
async function visitor( browser: import('@playwright/test').Browser, baseURL: string ): Promise< { context: BrowserContext; page: Page } > {
	const context = await browser.newContext( { baseURL, storageState: { cookies: [], origins: [] } } );
	await withModule( context, baseURL );
	const page = await context.newPage();
	page.setDefaultTimeout( 60_000 );
	return { context, page };
}

test( 'a Button opens a saved dialog the page does not hold', async ( { browser }, testInfo ) => {
	const { context, page } = await visitor( browser, testInfo.project.use.baseURL as string );
	await page.goto( pages.button );

	const saved = page.locator( `dialog#${ pages.buttonId }` );
	await expect( saved ).toHaveCount( 1 );
	await expect( saved ).toHaveAttribute( 'data-bl-saved', /^\d+$/ );
	await expect( saved ).not.toBeVisible();

	// Counted as shown, by a beacon to the module's public route.
	const counted = page.waitForRequest( ( r ) => 'POST' === r.method() && /blicks-pro\/v1\/dialogs\/\d+\/events/.test( decodeURIComponent( r.url() ) ) );
	await page.getByRole( 'button', { name: 'Sizes' } ).click();
	await expect( page.getByRole( 'dialog', { name: 'Sizes' } ) ).toBeVisible();
	expect( ( await counted ).postData() ).toBe( 'event=shown' );
	await page.keyboard.press( 'Escape' );
	await expect( saved ).not.toBeVisible();
	await context.close();
} );

test( 'an automatic dialog opens by itself, once per visit, only where its rules allow', async ( { browser }, testInfo ) => {
	const baseURL = testInfo.project.use.baseURL as string;
	const { context, page } = await visitor( browser, baseURL );

	await page.goto( pages.other );
	await expect( page.locator( `dialog#${ pages.autoId }` ) ).toHaveCount( 0 );

	await page.goto( pages.auto );
	const offer = page.locator( `dialog#${ pages.autoId }` );
	await expect( offer ).toHaveAttribute( 'data-bl-auto', /"delay":1/ );
	await expect( offer ).toBeVisible( { timeout: 10_000 } );
	await page.keyboard.press( 'Escape' );
	await expect( offer ).not.toBeVisible();

	// The same visit: printed again from the same HTML, but not opened.
	await page.reload();
	await page.waitForTimeout( 2_500 );
	await expect( offer ).not.toBeVisible();
	await context.close();

	// A new visit opens it again.
	const next = await visitor( browser, baseURL );
	await next.page.goto( pages.auto );
	await expect( next.page.locator( `dialog#${ pages.autoId }` ) ).toBeVisible( { timeout: 10_000 } );
	await next.context.close();
} );
