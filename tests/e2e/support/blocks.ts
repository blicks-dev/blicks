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

	// global-setup disables the "Choose a pattern" and welcome modals, which otherwise appear
	// asynchronously and swallow clicks. Assert that rather than trusting it: if a preference
	// ever fails to persist, the failure should name the modal instead of surfacing as a dozen
	// unrelated click timeouts.
	await expect( page.locator( '.components-modal__screen-overlay' ) ).toHaveCount( 0 );

	await expect( page.locator( '.editor-document-tools__inserter-toggle' ) ).toBeEnabled();
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

export async function selectBlock( page: Page, slug: string ): Promise< void > {
	await canvas( page ).locator( `.bl-${ slug }` ).first().click();
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
