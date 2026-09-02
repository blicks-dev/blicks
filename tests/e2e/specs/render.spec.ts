/**
 * Front-end coverage — the half the standalone playground SPA could never reach.
 *
 * The SPA had no PHP, so nothing proved that saved markup survives a real publish, that the
 * dynamic Section block's render.php runs, or that the PHP style engine emits anything. All of
 * that is server-side, and all of it is what a visitor actually sees.
 */

import { expect, test } from '@playwright/test';
import {
	ConsoleWatcher,
	insertBlock,
	insertableBlocks,
	openEditor,
	publishCurrentContent,
} from '../support/blocks';

/**
 * Blocks whose save() deliberately returns null until they are given content, so an untouched
 * one is absent from the front end by design. Image is the only such block today:
 * `resources/blocks/image/index.tsx` returns null while `url` is empty, rather than shipping an
 * empty figure. They are still inserted below — only the rendered assertion is skipped.
 */
const RENDER_REQUIRES_CONTENT = [ 'image' ];

// One page carrying every block, published once. Cheaper than a page per block, and it also
// exercises the blocks composed together rather than each in isolation.
test( 'every block survives a publish and renders on the front end', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	const blocks = insertableBlocks();

	await openEditor( page );
	for ( const block of blocks ) {
		await insertBlock( page, block );
	}

	const permalink = await publishCurrentContent( page, 'Front-end render coverage' );
	expect( permalink ).toBeTruthy();

	await page.goto( permalink );

	for ( const block of blocks ) {
		if ( RENDER_REQUIRES_CONTENT.includes( block.slug ) ) continue;
		await expect(
			page.locator( `.bl-${ block.slug }` ).first(),
			`${ block.name } is missing from the rendered page`
		).toBeAttached();
	}

	// A PHP notice or warning prints into the markup and is invisible in a passing visual check.
	const body = await page.locator( 'body' ).innerText();
	expect( body ).not.toMatch( /Fatal error|Parse error|Warning:|Notice:|Deprecated:/ );

	expect( watcher.errors ).toEqual( [] );
} );

test( 'the dynamic Section block renders through its PHP callback', async ( { page } ) => {
	await openEditor( page );
	await insertBlock( page, insertableBlocks().find( ( b ) => b.slug === 'section' )! );

	const permalink = await publishCurrentContent( page, 'Section server render' );
	await page.goto( permalink );

	const section = page.locator( '.bl-section' ).first();
	await expect( section ).toBeAttached();

	// These are added by render.php and the PHP style engine, not by save() — saved markup
	// carries neither. Asserting them is what proves the server path actually ran, rather
	// than the browser simply echoing the stored HTML back.
	await expect( section ).toHaveClass( /bl-section--surface-/ );
	await expect( section ).toHaveClass( /bl-section--space-/ );

	const style = await section.getAttribute( 'style' );
	expect( style, 'the PHP style engine emitted no custom properties' ).toMatch(
		/--bl-section-content-max-width/
	);
} );

test( 'the plugin enqueues its runtime stylesheet on the front end', async ( { page } ) => {
	await openEditor( page );
	await insertBlock( page, insertableBlocks().find( ( b ) => b.slug === 'box' )! );

	const permalink = await publishCurrentContent( page, 'Runtime asset check' );
	await page.goto( permalink );

	// Blocks are styled by generated CSS that hangs off the runtime sheet; without it the page
	// renders unstyled while every markup assertion still passes.
	const runtime = page.locator( 'link[rel="stylesheet"][href*="blicks"][href*="runtime"]' );
	await expect( runtime ).toHaveCount( 1 );
} );
