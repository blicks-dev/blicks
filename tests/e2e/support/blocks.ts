/**
 * Shared helpers for driving the real WordPress editor.
 *
 * The block list is read from the plugin's BUILD output, not its source, because the build is
 * what WordPress actually registers. Reading source would list blocks the browser has never
 * heard of the moment the build is stale.
 */

import { expect, type Page, type FrameLocator, type ConsoleMessage } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath( new URL( '.', import.meta.url ) );
const BUILD_BLOCKS = resolve( HERE, '../../../build/blocks' );

export interface BlockMeta {
	name: string;
	slug: string;
	title: string;
	/** Set when the block can only exist inside another block, so the inserter hides it. */
	parent: string[] | null;
}

export function allBlocks(): BlockMeta[] {
	return readdirSync( BUILD_BLOCKS, { withFileTypes: true } )
		.filter( ( entry ) => entry.isDirectory() )
		.map( ( entry ) => {
			const json = JSON.parse(
				readFileSync( resolve( BUILD_BLOCKS, entry.name, 'block.json' ), 'utf8' )
			);
			return {
				name: json.name as string,
				slug: ( json.name as string ).split( '/' )[ 1 ],
				title: json.title as string,
				parent: ( json.parent as string[] | undefined ) ?? null,
			};
		} )
		.sort( ( a, b ) => a.name.localeCompare( b.name ) );
}

export const insertableBlocks = (): BlockMeta[] => allBlocks().filter( ( b ) => ! b.parent );
export const nestedBlocks = (): BlockMeta[] => allBlocks().filter( ( b ) => b.parent );

/**
 * Console errors are a real failure signal here: a block that throws inside edit() often still
 * paints something, so the canvas can look fine while React has bailed out underneath it.
 */
export class ConsoleWatcher {
	readonly errors: string[] = [];

	constructor( page: Page ) {
		page.on( 'console', ( message: ConsoleMessage ) => {
			if ( message.type() !== 'error' ) return;
			const text = message.text();
			// WordPress core itself is noisy in the editor; only fail on our own breakage.
			if ( IGNORED_CONSOLE.some( ( pattern ) => pattern.test( text ) ) ) return;
			this.errors.push( text );
		} );
		page.on( 'pageerror', ( error ) => this.errors.push( String( error ) ) );
	}
}

const IGNORED_CONSOLE = [
	// Core ships deprecated calls and dev warnings of its own; they are not ours to fix.
	/is deprecated since version/i,
	/Failed to load resource/i,
	/favicon/i,
];

/** The editor canvas is iframed in WordPress 6.3+, so every canvas assertion goes through this. */
export const canvas = ( page: Page ): FrameLocator =>
	page.frameLocator( 'iframe[name="editor-canvas"]' );

export async function openEditor( page: Page ): Promise< void > {
	await page.goto( '/wp-admin/post-new.php?post_type=page' );

	await expect( page.locator( '.editor-document-tools__inserter-toggle' ) ).toBeEnabled();

	// global-setup disables the "Choose a pattern" and welcome modals, but that preference is
	// persisted over REST and a freshly booted WordPress can render the modal before the write
	// lands. It also appears a beat AFTER the toolbar is ready, so close it if it is there rather
	// than asserting on a race — an open overlay silently swallows every later click.
	const overlay = page.locator( '.components-modal__screen-overlay' );
	if ( await overlay.count() ) {
		await page.locator( '.components-modal__frame' ).getByRole( 'button', { name: 'Close' } ).click();
		await expect( overlay ).toHaveCount( 0 );
	}
}

export async function insertBlock( page: Page, block: BlockMeta ): Promise< void > {
	const toggle = page.locator( '.editor-document-tools__inserter-toggle' );
	await toggle.click();

	const search = page.locator( 'input[type="search"][placeholder="Search"]' ).first();
	await search.fill( block.title );

	// Match on the class WordPress derives from the block NAME, not on the title: searching
	// "Section" returns fourteen results, several of them core blocks with colliding titles.
	await page.locator( `.editor-block-list-item-blicks-${ block.slug }` ).first().click();

	// Close the inserter so its panel stops overlaying the canvas for later assertions.
	await toggle.click();
}

/**
 * Select a block through the editor store rather than by clicking it.
 *
 * A click has to wait for the element to be "stable", and the editor animates on insert — under
 * load that never settles and the click times out, failing a test that is really about the
 * inspector. Selection is what the assertion needs; the click was only ever a means to it.
 */
export async function selectBlock( page: Page, slug: string ): Promise< void > {
	const selected = await page.evaluate( ( name ) => {
		const wp = ( window as any ).wp;
		const find = ( list: any[] ): any => {
			for ( const block of list ) {
				if ( block.name === name ) return block;
				const nested = find( block.innerBlocks ?? [] );
				if ( nested ) return nested;
			}
			return null;
		};

		const target = find( wp.data.select( 'core/block-editor' ).getBlocks() );
		if ( ! target ) return false;
		wp.data.dispatch( 'core/block-editor' ).selectBlock( target.clientId );
		return true;
	}, `blicks/${ slug }` );

	expect( selected, `no blicks/${ slug } block in the editor to select` ).toBe( true );
}

/** Serialize whatever is in the editor and publish it as a page, returning its permalink. */
export async function publishCurrentContent( page: Page, title: string ): Promise< string > {
	return page.evaluate( async ( pageTitle ) => {
		const wp = ( window as any ).wp;
		const blocks = wp.data.select( 'core/block-editor' ).getBlocks();
		const content = wp.blocks.serialize( blocks );
		const created = await wp.apiFetch( {
			path: '/wp/v2/pages',
			method: 'POST',
			data: { title: pageTitle, status: 'publish', content },
		} );
		return created.link as string;
	}, title );
}
