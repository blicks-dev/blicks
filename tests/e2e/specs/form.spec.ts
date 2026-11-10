/**
 * The Form on a published page, sent the way a visitor sends it: errors and the summary, the token
 * and the minimum time, a good send landing in Entries, the trap field, and a page served from an
 * old render (as a page cache would) still sending.
 *
 * The page is built once in a Chromium editor from the blocks' own save output, then visited by a
 * logged-out visitor: the public route is what is under test.
 */

import { chromium, expect, test, type Browser, type Page } from '@playwright/test';
import { ConsoleWatcher } from '../support/blocks';

test.describe.configure( { mode: 'default' } );

type Spec = [ string, Record< string, unknown >, Spec[]? ];

// Stored blocks carry a uniqueId (the editor gives one on insert); a Form without one cannot be
// found by a send, so it renders as a plain group.
let uid = 0;
// A Field as the editor makes one (field/create.ts): its label a Text block, its control an Input
// (the label after it for consent), each with its own uniqueId.
const field = ( attrs: Record< string, unknown > ): Spec => {
	const n = ++uid;
	const label: Spec = [ 'blicks/text', { uniqueId: `e2et${ n }`, content: String( attrs.label ?? '' ), metadata: { name: 'Label', blicksRole: 'label' } } ];
	const input: Spec = [ 'blicks/input', { uniqueId: `e2ei${ n }`, lock: { remove: true } } ];
	return [ 'blicks/field', { uniqueId: `e2ef${ n }`, ...attrs }, attrs.type === 'consent' ? [ input, label ] : [ label, input ] ];
};
const send = ( text: string ): Spec => [ 'blicks/button', { text, action: 'submit' } ];

// Its own id per run and browser: a send is rate limited per visitor and form id, and every
// project sends from the same address, so a shared id put Chromium and WebKit in one bucket.
const contact = ( uniqueId: string ): Spec => [ 'blicks/form', { uniqueId, template: 'contact', after: { kind: 'message', title: 'Thanks, your message is on its way' } }, [
	field( { type: 'text', label: 'Name', name: 'name', width: 'half', required: true, errorMessage: 'Enter your name.' } ),
	field( { type: 'email', label: 'Email', name: 'email', width: 'half', required: true } ),
	field( { type: 'select', label: 'Topic', name: 'topic', width: 'half', options: [ 'General question', 'Sales', 'Support' ] } ),
	field( { type: 'textarea', label: 'Message', name: 'message', required: true, errorMessage: 'Write a message.' } ),
	field( { type: 'consent', label: 'I agree that you store my details to answer this message.', name: 'consent', required: true } ),
	send( 'Send message' ),
] ];

let link = '';

async function publish( page: Page, title: string, blocks: Spec[] ): Promise< string > {
	return page.evaluate(
		async ( { pageTitle, specs } ) => {
			const wp = ( window as any ).wp;
			const build = ( [ name, attrs, inner = [] ]: any ): any => wp.blocks.createBlock( name, attrs, inner.map( build ) );
			const content = wp.blocks.serialize( specs.map( build ) );
			const created = await wp.apiFetch( { path: '/wp/v2/pages', method: 'POST', data: { title: pageTitle, status: 'publish', content } } );
			return created.link as string;
		},
		{ pageTitle: title, specs: blocks }
	);
}

/** Entries for the form on the test page, read as the administrator. */
async function entries( search: string ): Promise< Array< Record< string, any > > > {
	const browser = await chromium.launch();
	const context = await browser.newContext( { baseURL: test.info().project.use.baseURL, storageState: test.info().project.use.storageState as string } );
	const page = await context.newPage();
	await page.goto( '/wp-admin/' );
	const items = await page.evaluate( async ( q ) => {
		const res = await ( window as any ).wp.apiFetch( { path: `/blicks/v1/forms/entries?search=${ encodeURIComponent( q ) }` } );
		return res.items;
	}, search );
	await browser.close();
	return items;
}

test.beforeAll( async ( {}, testInfo ) => {
	testInfo.setTimeout( 300_000 );
	const { baseURL, storageState } = testInfo.project.use;
	const browser: Browser = await chromium.launch();
	const context = await browser.newContext( { baseURL, storageState: storageState as string } );
	const page = await context.newPage();
	page.setDefaultTimeout( 120_000 );
	await page.goto( '/wp-admin/post-new.php' );
	await page.waitForFunction( () => !! ( window as any ).wp?.blocks?.getBlockType?.( 'blicks/form' ), undefined, { timeout: 120_000 } );
	link = await publish( page, `Contact ${ Date.now() }`, [ [ 'blicks/heading', { level: 2, content: 'Get in touch' } ], contact( `e2e${ testInfo.project.name.replace( /[^a-z0-9]/gi, '' ) }${ Date.now().toString( 36 ) }` ) ] );
	await browser.close();
} );

/** A logged-out visitor: the public send, no cookie, no REST nonce. */
test.use( { storageState: { cookies: [], origins: [] } } );

test( 'renders a real form with labelled controls and no secrets', async ( { page } ) => {
	const console = new ConsoleWatcher( page );
	await page.goto( link );
	const form = page.locator( 'form.bl-form' );
	await expect( form ).toHaveAttribute( 'novalidate', '' );
	await expect( page.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
	await expect( page.getByLabel( 'Email', { exact: true } ) ).toHaveAttribute( 'type', 'email' );
	await expect( page.getByRole( 'combobox', { name: /^Topic/ } ) ).toBeVisible();
	await expect( page.getByRole( 'checkbox', { name: /I agree/ } ) ).toBeVisible();
	await expect( page.getByRole( 'button', { name: 'Send message' } ) ).toHaveAttribute( 'type', 'submit' );
	// The trap is in the page but out of sight and out of the tab order.
	await expect( form.locator( 'input[name="_bl_hp"]' ) ).toHaveAttribute( 'tabindex', '-1' );
	const html = await page.content();
	expect( html ).not.toContain( 'admin@' );
	expect( console.errors ).toEqual( [] );
} );

test( 'a send with missing fields shows the summary and focuses it', async ( { page } ) => {
	await page.goto( link );
	await page.getByRole( 'button', { name: 'Send message' } ).click();
	const summary = page.locator( '.bl-form__summary' );
	await expect( summary ).toBeVisible();
	await expect( summary ).toBeFocused();
	await expect( summary ).toContainText( '4 fields need a fix' );
	await expect( page.getByLabel( 'Name', { exact: true } ) ).toHaveAttribute( 'aria-invalid', 'true' );
	await expect( page.locator( '[data-bl-field="name"] .bl-field__error' ) ).toHaveText( 'Enter your name.' );
	// Fixing a field clears its error as it is typed.
	await page.getByLabel( 'Name', { exact: true } ).fill( 'Sita Rai' );
	await expect( page.getByLabel( 'Name', { exact: true } ) ).not.toHaveAttribute( 'aria-invalid', 'true' );
	// The summary links move focus to the field.
	await summary.getByRole( 'link', { name: 'Message', exact: true } ).click();
	await expect( page.getByLabel( 'Message', { exact: true } ) ).toBeFocused();
} );

async function fill( page: Page, name: string ): Promise< void > {
	await page.getByLabel( 'Name', { exact: true } ).fill( name );
	await page.getByLabel( 'Email', { exact: true } ).fill( 'sita@example.com' );
	await page.getByRole( 'combobox', { name: /^Topic/ } ).selectOption( 'Sales' );
	await page.getByLabel( 'Message', { exact: true } ).fill( 'Do you deliver to Pokhara?' );
	await page.getByRole( 'checkbox', { name: /I agree/ } ).check();
}

test( 'a good send shows the message in place and lands in Entries', async ( { page } ) => {
	await page.goto( link );
	const name = `Sita ${ Date.now() }`;
	await fill( page, name );
	// The token must be at least 3 seconds old: a send faster than a person types is refused.
	await page.waitForTimeout( 3500 );
	await page.getByRole( 'button', { name: 'Send message' } ).click();
	const sent = page.locator( '.bl-form__sent' );
	await expect( sent ).toBeVisible();
	await expect( sent ).toBeFocused();
	await expect( sent ).toContainText( 'Thanks, your message is on its way' );
	await expect( page.getByLabel( 'Name', { exact: true } ) ).toBeHidden();

	const found = await entries( name );
	expect( found ).toHaveLength( 1 );
	expect( found[ 0 ].status ).toBe( 'new' );
	expect( found[ 0 ].fields ).toMatchObject( { name, email: 'sita@example.com', topic: 'Sales', consent: 'Yes' } );
	expect( found[ 0 ] ).not.toHaveProperty( 'ipHash' );
} );

test( 'a filled trap field looks sent but is saved as spam', async ( { page } ) => {
	await page.goto( link );
	const name = `Bot ${ Date.now() }`;
	await fill( page, name );
	await page.locator( 'input[name="_bl_hp"]' ).fill( 'http://spam.example' );
	await page.waitForTimeout( 3500 );
	await page.getByRole( 'button', { name: 'Send message' } ).click();
	await expect( page.locator( '.bl-form__sent' ) ).toBeVisible();
	const found = await entries( name );
	expect( found ).toHaveLength( 1 );
	expect( found[ 0 ].status ).toBe( 'spam' );
} );

test( 'a page served from an earlier render still sends', async ( { page } ) => {
	// This test's own earlier render, not one another test captured: tests in this file may run on
	// different workers, and a worker that restarts after a failure starts with nothing.
	const staleHtml = await ( await page.request.get( link ) ).text();
	expect( staleHtml ).toContain( 'bl-form' );
	// Let it age past the token's minimum, then serve it as the page, the way a full-page cache would.
	await page.waitForTimeout( 1000 );
	await page.route( link, ( route ) => route.fulfill( { status: 200, contentType: 'text/html', body: staleHtml } ) );
	await page.goto( link );
	const name = `Cached ${ Date.now() }`;
	await fill( page, name );
	await page.waitForTimeout( 3500 );
	await page.getByRole( 'button', { name: 'Send message' } ).click();
	await expect( page.locator( '.bl-form__sent' ) ).toBeVisible();
	expect( await entries( name ) ).toHaveLength( 1 );
} );
