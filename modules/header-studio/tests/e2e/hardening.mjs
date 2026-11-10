/**
 * Header Studio's hardening pass, in a real browser against wp-env: the site's header on four block
 * themes at 1440, 768 and 375 (one banner landmark, full width, no sideways scroll, the mega menu on
 * screen and readable, the drawer opening and readable, axe with no serious issue), right-to-left,
 * and reduced motion.
 *
 * Needs wp-env running with BLICKS_DEV_MODULES=header-studio, a Header Studio header in each theme's
 * header part, and Playwright with @axe-core/playwright (tests/e2e's dependencies):
 *
 *   node modules/header-studio/tests/e2e/hardening.mjs [site url] [screenshots dir]
 *
 * BLICKS_E2E_DEPS names another folder to load Playwright from.
 *
 * It switches the site's theme while it runs and puts Twenty Twenty-Five back at the end.
 */
/* global console, process, document, getComputedStyle -- Node here, the page inside evaluate(). */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve( import.meta.dirname, '../../../..' );
// Playwright from tests/e2e, or from the folder BLICKS_E2E_DEPS names.
const require = createRequire( resolve( process.env.BLICKS_E2E_DEPS ?? resolve( REPO, 'tests/e2e' ), 'package.json' ) );
const { chromium } = require( '@playwright/test' );
const AxeBuilder = require( '@axe-core/playwright' ).default;
const URL = process.argv[ 2 ] ?? 'http://localhost:8888/';
const OUT = process.argv[ 3 ] ?? resolve( REPO, 'artifacts/header-studio' );
mkdirSync( OUT, { recursive: true } );
const out = [];
const check = ( name, ok, extra = '' ) => out.push( `${ ok ? 'PASS' : 'FAIL' } ${ name }${ extra ? ' — ' + extra : '' }` );
const theme = ( t ) => execSync( `npx wp-env run cli wp theme activate ${ t }`, { cwd: REPO, stdio: 'ignore' } );
const browser = await chromium.launch();

for ( const t of [ 'twentytwentyfive', 'twentytwentyfour', 'twentytwentythree', 'twentytwentytwo' ] ) {
	theme( t );
	for ( const [ w, h ] of [ [ 1440, 900 ], [ 768, 1024 ], [ 375, 812 ] ] ) {
		const ctx = await browser.newContext( { viewport: { width: w, height: h } } );
		const page = await ctx.newPage();
		const errors = [];
		page.on( 'pageerror', ( e ) => errors.push( String( e ) ) );
		await page.goto( URL, { waitUntil: 'networkidle' } );
		const tag = `${ t } ${ w }`;
		const banners = await page.evaluate( () => document.querySelectorAll( 'header' ).length );
		check( `${ tag } one header element`, banners === 1, String( banners ) );
		const box = await page.locator( 'header.bl-header' ).boundingBox();
		check( `${ tag } header full width`, !! box && box.width >= w - 20, box ? String( Math.round( box.width ) ) : 'none' );
		const scrollW = await page.evaluate( () => document.documentElement.scrollWidth );
		check( `${ tag } no sideways scroll`, scrollW <= w + 1, String( scrollW ) );
		if ( w === 1440 ) {
			await page.locator( '.bl-nav-item.has-panel > .bl-nav-item__toggle' ).first().hover();
			await page.waitForTimeout( 400 );
			const panel = await page.locator( '.bl-mega-panel' ).first().boundingBox();
			check( `${ tag } mega menu opens inside the screen`, !! panel && panel.x >= 0 && panel.x + panel.width <= w + 1 );
			const ink = await page.locator( '.bl-mega-panel' ).first().evaluate( ( el ) => {
				const bg = getComputedStyle( el ).backgroundColor;
				return [ ...el.querySelectorAll( 'a' ) ].filter( ( a ) => a.offsetParent ).every( ( a ) => getComputedStyle( a ).color !== bg );
			} );
			check( `${ tag } panel links differ from the panel`, ink );
		} else {
			await page.locator( '.bl-nav__toggle' ).click();
			await page.waitForTimeout( 350 );
			check( `${ tag } drawer opens`, await page.locator( 'dialog.bl-nav__drawer' ).evaluate( ( d ) => d.open ) );
			check( `${ tag } drawer links differ from the drawer`, await page.locator( 'dialog.bl-nav__drawer' ).evaluate( ( d ) => {
				const bg = getComputedStyle( d ).backgroundColor;
				return [ ...d.querySelectorAll( 'a, button.bl-nav-item__toggle' ) ].filter( ( a ) => a.offsetParent ).every( ( a ) => getComputedStyle( a ).color !== bg );
			} ) );
			await page.keyboard.press( 'Escape' );
			await page.waitForTimeout( 350 );
		}
		const axe = await new AxeBuilder( { page } ).include( 'header.bl-header' ).analyze();
		const serious = axe.violations.filter( ( v ) => [ 'serious', 'critical' ].includes( v.impact ) );
		check( `${ tag } axe: no serious issues in the header`, serious.length === 0, serious.map( ( v ) => `${ v.id }(${ v.nodes.length })` ).join( ', ' ) );
		const minor = axe.violations.filter( ( v ) => ! serious.includes( v ) );
		if ( minor.length ) out.push( `  note ${ tag } axe minor: ${ minor.map( ( v ) => v.id ).join( ', ' ) }` );
		await page.screenshot( { path: `${ OUT }/hard-${ t }-${ w }.png` } );
		check( `${ tag } no script errors`, errors.length === 0, errors.join( ' | ' ) );
		await ctx.close();
	}
}
theme( 'twentytwentyfive' );

// Right-to-left: the drawer from the end is on the left, the panel stays on screen.
{
	const page = await browser.newPage( { viewport: { width: 1440, height: 900 } } );
	await page.goto( URL, { waitUntil: 'networkidle' } );
	await page.evaluate( () => ( document.documentElement.dir = 'rtl' ) );
	await page.locator( '.bl-nav-item.has-panel > .bl-nav-item__toggle' ).first().hover();
	await page.waitForTimeout( 400 );
	const panel = await page.locator( '.bl-mega-panel' ).first().boundingBox();
	check( 'rtl 1440 panel inside the screen', !! panel && panel.x >= 0 && panel.x + panel.width <= 1441 );
	await page.screenshot( { path: `${ OUT }/hard-rtl-1440.png` } );
	await page.setViewportSize( { width: 375, height: 812 } );
	await page.locator( '.bl-nav__toggle' ).click();
	await page.waitForTimeout( 350 );
	const drawer = await page.locator( 'dialog.bl-nav__drawer' ).boundingBox();
	check( 'rtl 375 drawer comes from the left (end)', !! drawer && drawer.x < 5, drawer ? String( Math.round( drawer.x ) ) : '' );
	await page.screenshot( { path: `${ OUT }/hard-rtl-375.png` } );
	await page.close();
}

// Reduced motion: no transition on panels.
{
	const ctx = await browser.newContext( { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' } );
	const page = await ctx.newPage();
	await page.goto( URL, { waitUntil: 'networkidle' } );
	const d = await page.locator( '.bl-mega-panel' ).first().evaluate( ( p ) => getComputedStyle( p ).transitionDuration );
	check( 'reduced motion: panels do not animate', /^0s(, 0s)*$/.test( d ), d );
	await ctx.close();
}

await browser.close();
console.log( out.join( '\n' ) );
process.exitCode = out.some( ( line ) => line.startsWith( 'FAIL' ) ) ? 1 : 0;
