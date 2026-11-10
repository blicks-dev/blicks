/**
 * Header Studio's UX pass, in a real browser against wp-env, run until it is clean:
 *
 *  - **Studio**: at wide, tablet and phone, selecting every layer moves nothing but the ring (every
 *    block's box and the camera are compared with the unselected state); Ctrl+wheel zoom keeps the
 *    work on screen; a Header tab setting survives Save and a reload; the "+ New › Header" picker
 *    offers the starters.
 *  - **Front end**: the mega menu by keyboard (Enter opens, Esc closes and gives focus back, Tab
 *    reaches its links) and by hover; the drawer by keyboard (opens, keeps focus inside, Next
 *    screen and Back, Esc returns focus); no script (the list shows in place); 200% zoom; sticky and
 *    shrink while scrolling, logged out and in; focus visible on the menu's controls.
 *
 * Needs wp-env with BLICKS_DEV_MODULES=header-studio and a Header Studio header in the active
 * theme's header part, and Playwright (tests/e2e's dependencies, or the folder BLICKS_E2E_DEPS names):
 *
 *   node modules/header-studio/tests/e2e/ux.mjs [site url] [screenshots dir]
 *
 * Signs in as wp-env's admin. Saves the header part once, putting back the setting it changes.
 */
/* global console, process, document, getComputedStyle, setTimeout -- Node here, the page inside evaluate(). */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve( import.meta.dirname, '../../../..' );
const require = createRequire( resolve( process.env.BLICKS_E2E_DEPS ?? resolve( REPO, 'tests/e2e' ), 'package.json' ) );
const { chromium } = require( '@playwright/test' );
const URL = ( process.argv[ 2 ] ?? 'http://localhost:8888/' ).replace( /\/?$/, '/' );
const OUT = process.argv[ 3 ] ?? resolve( REPO, 'artifacts/header-studio' );
const PART = 'twentytwentyfive//header';
const STUDIO = `${ URL }wp-admin/site-editor.php?p=${ encodeURIComponent( `/wp_template_part/${ PART }` ) }&canvas=edit&blicks-studio=${ encodeURIComponent( `ref:header:${ JSON.stringify( { kind: 'template-part', id: PART } ) }` ) }`;
mkdirSync( OUT, { recursive: true } );

const out = [];
const check = ( name, ok, extra = '' ) => out.push( `${ ok ? 'PASS' : 'FAIL' } ${ name }${ extra ? ' — ' + extra : '' }` );
const browser = await chromium.launch();

async function signIn( ctx ) {
	const page = await ctx.newPage();
	await page.goto( `${ URL }wp-login.php` );
	await page.fill( '#user_login', 'admin' );
	await page.fill( '#user_pass', 'password' );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/, { waitUntil: 'domcontentloaded', timeout: 60000 } );
	return page;
}

async function openStudio( page ) {
	await page.goto( STUDIO );
	await page.waitForSelector( '.bl-hs-stage [data-type="blicks/nav"]', { timeout: 60000 } );
	await page.waitForSelector( '.bl-studio [role=treeitem]' );
	await page.waitForTimeout( 1200 );
}

const studioButton = ( page, name ) => page.locator( '.bl-studio button' ).filter( { hasText: new RegExp( `^${ name }$` ) } ).first();

/* ------------------------------------------------------------------ Studio */
{
	const ctx = await browser.newContext( { viewport: { width: 1440, height: 900 } } );
	const page = await signIn( ctx );
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( String( e ) ) );
	await openStudio( page );

	for ( const width of [ 'Desktop', 'Tablet', 'Phone' ] ) {
		await page.locator( `.bl-studio__bar--centre button[aria-label="${ width }"]` ).click();
		await page.waitForTimeout( 900 );
		const moved = await page.evaluate( async () => {
			const wait = ( t ) => new Promise( ( r ) => setTimeout( r, t ) );
			const snap = () => {
				const stage = document.querySelector( '.bl-hs-stage' );
				const s = stage.getBoundingClientRect();
				const boxes = {};
				stage.querySelectorAll( '[data-type]' ).forEach( ( el ) => {
					if ( el.closest( '.bl-mega-panel' ) ) return;
					const r = el.getBoundingClientRect();
					boxes[ el.dataset.block ] = `${ el.dataset.type }@${ [ r.x - s.x, r.y - s.y, r.width, r.height ].map( Math.round ).join( ',' ) }`;
				} );
				return { boxes, camera: document.querySelector( '.bl-studio__viewport' ).style.transform };
			};
			const base = snap();
			const found = [];
			const rows = () => [ ...document.querySelectorAll( '.bl-studio [role=treeitem]' ) ];
			for ( let i = 0; i < rows().length; i++ ) {
				const name = rows()[ i ].querySelector( '.bl-layers__name' );
				name.click();
				await wait( 350 );
				const now = snap();
				const diff = Object.keys( base.boxes ).filter( ( k ) => now.boxes[ k ] !== base.boxes[ k ] ).map( ( k ) => `${ base.boxes[ k ] } → ${ now.boxes[ k ] ?? 'gone' }` );
				if ( now.camera !== base.camera ) diff.unshift( `camera ${ base.camera } → ${ now.camera }` );
				if ( diff.length ) found.push( `${ name.textContent }: ${ diff.slice( 0, 2 ).join( '; ' ) }` );
			}
			return found;
		} );
		check( `studio ${ width }: selecting any layer moves nothing`, moved.length === 0, moved.slice( 0, 3 ).join( ' | ' ) );
		await page.screenshot( { path: `${ OUT }/ux-studio-${ width.toLowerCase() }.png` } );
	}
	await page.locator( '.bl-studio__bar--centre button[aria-label="Desktop"]' ).click();
	await page.waitForTimeout( 600 );

	// Twenty quick Ctrl+wheel zooms out, then in: the work stays in the world.
	const world = page.locator( '.bl-studio__world' );
	const wbox = await world.boundingBox();
	await page.mouse.move( wbox.x + wbox.width / 2, wbox.y + wbox.height / 2 );
	await page.keyboard.down( 'Control' );
	for ( let i = 0; i < 20; i++ ) await page.mouse.wheel( 0, 120 );
	for ( let i = 0; i < 10; i++ ) await page.mouse.wheel( 0, -120 );
	await page.keyboard.up( 'Control' );
	await page.waitForTimeout( 400 );
	const onScreen = await page.evaluate( () => {
		const w = document.querySelector( '.bl-studio__world' ).getBoundingClientRect();
		const h = document.querySelector( '.bl-hs-stage .bl-header' ).getBoundingClientRect();
		return h.width > 20 && h.right > w.left && h.left < w.right && h.bottom > w.top && h.top < w.bottom;
	} );
	check( 'studio: Ctrl+wheel zoom keeps the header on screen', onScreen );

	// A Header tab setting survives Save and a reload; put it back after.
	const flip = async () => {
		await studioButton( page, 'Header' ).click();
		const toggle = page.locator( '.bl-studio .components-toggle-control' ).filter( { hasText: 'Clear over' } ).locator( 'input' );
		const was = await toggle.isChecked();
		await toggle.click();
		await studioButton( page, 'Save header' ).click();
		await page.waitForTimeout( 2500 );
		return was;
	};
	const before = await flip();
	await openStudio( page );
	await studioButton( page, 'Header' ).click();
	const after = await page.locator( '.bl-studio .components-toggle-control' ).filter( { hasText: 'Clear over' } ).locator( 'input' ).isChecked();
	check( 'studio: a setting survives Save and a reload', after === ! before );
	await flip();

	// + New › Header, from the Studio's library, offers the starters and the theme's header.
	await page.goto( `${ URL }wp-admin/site-editor.php?blicks-studio=library` );
	await page.locator( '.bl-library__new > button' ).click( { timeout: 60000 } );
	await page.locator( '.bl-library__newmenu [role=menuitem]' ).filter( { hasText: /Header/ } ).first().click();
	await page.waitForSelector( '.bl-hs-new__item', { timeout: 30000 } ).catch( () => null );
	await page.waitForTimeout( 1500 );
	const starters = await page.locator( '.bl-hs-new__item' ).count();
	check( 'studio: + New › Header offers the starters and the theme’s', starters >= 4, String( starters ) );
	await page.screenshot( { path: `${ OUT }/ux-studio-new.png` } );

	// Blicks › Headers lists the header with an Edit link into the Studio.
	await page.goto( `${ URL }wp-admin/admin.php?page=blicks-headers` );
	await page.waitForSelector( '.bl-hs-admin table', { timeout: 60000 } ).catch( () => null );
	const edit = await page.locator( '.bl-hs-admin a' ).filter( { hasText: /^Edit/ } ).first().getAttribute( 'href' ).catch( () => null );
	check( 'admin: Blicks › Headers links each header into the Studio', !! edit && edit.includes( 'blicks-studio=ref' ), String( edit ).slice( 0, 60 ) );
	await page.screenshot( { path: `${ OUT }/ux-admin-headers.png` } );

	check( 'studio: no script errors', errors.length === 0, errors.slice( 0, 2 ).join( ' | ' ) );
	await ctx.close();
}

/* --------------------------------------------------------------- Front end */
const focusInfo = ( page ) =>
	page.evaluate( () => {
		const a = document.activeElement;
		const cs = a ? getComputedStyle( a ) : null;
		return { cls: a?.className ?? '', text: ( a?.textContent ?? '' ).trim().slice( 0, 20 ), ring: !! cs && ( cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' ), inDrawer: !! a?.closest( 'dialog.bl-nav__drawer' ), outside: !! a && a !== document.body && ! a.closest( 'dialog.bl-nav__drawer' ) };
	} );

// Wide: the mega menu by keyboard and pointer.
{
	const ctx = await browser.newContext( { viewport: { width: 1440, height: 900 } } );
	const page = await ctx.newPage();
	await page.goto( URL, { waitUntil: 'networkidle' } );
	const toggle = page.locator( '.bl-nav-item__toggle' ).first();
	await toggle.focus();
	check( 'wide: menu button shows focus', ( await focusInfo( page ) ).ring );
	await page.keyboard.press( 'Enter' );
	await page.waitForTimeout( 300 );
	check( 'wide: Enter opens the mega menu', ( await toggle.getAttribute( 'aria-expanded' ) ) === 'true' );
	await page.keyboard.press( 'Tab' );
	const inPanel = await page.evaluate( () => !! document.activeElement?.closest( '.bl-mega-panel' ) );
	check( 'wide: Tab goes into the open panel', inPanel );
	await page.keyboard.press( 'Escape' );
	await page.waitForTimeout( 300 );
	check( 'wide: Esc closes it', ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' );
	check( 'wide: Esc gives focus back to its button', ( await focusInfo( page ) ).cls.includes( 'bl-nav-item__toggle' ) );
	await page.keyboard.press( 'Space' );
	await page.waitForTimeout( 300 );
	check( 'wide: Space opens it too', ( await toggle.getAttribute( 'aria-expanded' ) ) === 'true' );
	await page.keyboard.press( 'Escape' );
	await toggle.hover();
	await page.waitForTimeout( 600 );
	check( 'wide: hover opens it', ( await toggle.getAttribute( 'aria-expanded' ) ) === 'true' );
	await page.mouse.move( 700, 800 );
	await page.waitForTimeout( 800 );
	check( 'wide: leaving closes it', ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' );
	await page.screenshot( { path: `${ OUT }/ux-front-1440.png` } );

	// Sticky and shrink.
	await page.mouse.wheel( 0, 900 );
	await page.waitForTimeout( 600 );
	const stuck = await page.evaluate( () => {
		const h = document.querySelector( 'header.bl-header' );
		return { top: Math.round( h.getBoundingClientRect().top ), shrunk: h.hasAttribute( 'data-bl-scrolled' ) || ! h.classList.contains( 'bl-header--shrink' ) };
	} );
	check( 'wide: sticky header stays at the top while scrolling', stuck.top <= 1 && stuck.top >= -1, String( stuck.top ) );
	check( 'wide: a shrinking header shrinks after scrolling', stuck.shrunk );
	await ctx.close();
}

// Logged in: under the admin bar.
{
	const ctx = await browser.newContext( { viewport: { width: 1440, height: 900 } } );
	const page = await signIn( ctx );
	await page.goto( URL, { waitUntil: 'networkidle' } );
	await page.mouse.wheel( 0, 900 );
	await page.waitForTimeout( 600 );
	const top = await page.evaluate( () => Math.round( document.querySelector( 'header.bl-header' ).getBoundingClientRect().top ) );
	check( 'logged in: sticky header sits under the admin bar', top === 32, String( top ) );
	await ctx.close();
}

// Phone: the drawer by keyboard.
for ( const [ w, h, label ] of [ [ 375, 812, 'phone' ], [ 720, 450, '200% zoom' ] ] ) {
	const ctx = await browser.newContext( { viewport: { width: w, height: h }, deviceScaleFactor: label === '200% zoom' ? 2 : 1 } );
	const page = await ctx.newPage();
	await page.goto( URL, { waitUntil: 'networkidle' } );
	check( `${ label }: no sideways scroll`, ( await page.evaluate( () => document.documentElement.scrollWidth ) ) <= w + 1 );
	const opener = page.locator( '.bl-nav__toggle' ).first();
	await opener.focus();
	check( `${ label }: menu button shows focus`, ( await focusInfo( page ) ).ring );
	await page.keyboard.press( 'Enter' );
	await page.waitForTimeout( 400 );
	check( `${ label }: Enter opens the drawer`, await page.locator( 'dialog.bl-nav__drawer' ).evaluate( ( d ) => d.open ) );
	check( `${ label }: focus moves into the drawer`, ( await focusInfo( page ) ).inDrawer );
	let escaped = false;
	for ( let i = 0; i < 25; i++ ) {
		await page.keyboard.press( 'Tab' );
		// A modal dialog lets focus leave for the browser's own controls (the page then reports the
		// body); reaching anything else on the page is the escape that matters.
		if ( ( await focusInfo( page ) ).outside ) escaped = true;
	}
	check( `${ label }: Tab never reaches the page behind the drawer`, ! escaped );
	const sub = page.locator( 'dialog.bl-nav__drawer .bl-nav-item__toggle' ).first();
	if ( await sub.count() ) {
		await sub.focus();
		await page.keyboard.press( 'Enter' );
		await page.waitForTimeout( 400 );
		const back = page.locator( 'dialog.bl-nav__drawer .bl-mega-panel__back' ).first();
		const drill = await back.count();
		if ( drill ) {
			check( `${ label }: a mega menu opens as the next screen with Back focused`, ( await focusInfo( page ) ).cls.includes( 'bl-mega-panel__back' ) );
			await page.screenshot( { path: `${ OUT }/ux-front-${ w }-drill.png` } );
			await page.keyboard.press( 'Enter' );
			await page.waitForTimeout( 400 );
			check( `${ label }: Back returns to the menu, focus on its item`, ( await focusInfo( page ) ).cls.includes( 'bl-nav-item__toggle' ) );
		}
	}
	await page.keyboard.press( 'Escape' );
	await page.waitForTimeout( 400 );
	const open = await page.locator( 'dialog.bl-nav__drawer' ).evaluate( ( d ) => d.open ).catch( () => true );
	if ( open ) {
		await page.keyboard.press( 'Escape' );
		await page.waitForTimeout( 400 );
	}
	check( `${ label }: Esc closes the drawer`, ! ( await page.locator( 'dialog.bl-nav__drawer' ).evaluate( ( d ) => d.open ) ) );
	check( `${ label }: focus returns to the menu button`, ( await focusInfo( page ) ).cls.includes( 'bl-nav__toggle' ) );
	await page.screenshot( { path: `${ OUT }/ux-front-${ w }.png` } );
	await ctx.close();
}

// Tablet and wide widths: no sideways scroll, a screenshot each.
for ( const w of [ 1024, 768 ] ) {
	const ctx = await browser.newContext( { viewport: { width: w, height: 900 } } );
	const page = await ctx.newPage();
	await page.goto( URL, { waitUntil: 'networkidle' } );
	check( `${ w }: no sideways scroll`, ( await page.evaluate( () => document.documentElement.scrollWidth ) ) <= w + 1 );
	await page.screenshot( { path: `${ OUT }/ux-front-${ w }.png` } );
	await ctx.close();
}

// No script: the list in place, no dead menu button.
{
	const ctx = await browser.newContext( { viewport: { width: 375, height: 812 }, javaScriptEnabled: false } );
	const page = await ctx.newPage();
	await page.goto( URL );
	const state = await page.evaluate( () => {
		const list = document.querySelector( '.bl-nav__list' );
		const button = document.querySelector( '.bl-nav__toggle' );
		return { list: !! list && list.getBoundingClientRect().height > 0, button: !! button && button.getBoundingClientRect().width > 0, scroll: document.documentElement.scrollWidth };
	} );
	check( 'no script: the menu shows in place', state.list );
	check( 'no script: no menu button that does nothing', ! state.button );
	check( 'no script: no sideways scroll', state.scroll <= 376, String( state.scroll ) );
	await page.screenshot( { path: `${ OUT }/ux-front-375-nojs.png` } );
	await ctx.close();
}

await browser.close();
console.log( out.join( '\n' ) );
process.exitCode = out.some( ( line ) => line.startsWith( 'FAIL' ) ) ? 1 : 0;
