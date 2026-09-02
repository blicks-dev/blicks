/**
 * Editor coverage for every Blicks block, in real WordPress.
 *
 * This replaces the standalone playground SPA, which stubbed apiFetch and the editor settings
 * and had no PHP at all. Here the blocks are registered by the plugin the way a site registers
 * them, so registration, enqueueing and the editor bundle are all under test rather than
 * simulated.
 */

import { expect, test } from '@playwright/test';
import {
	ConsoleWatcher,
	canvas,
	insertBlock,
	insertableBlocks,
	nestedBlocks,
	openEditor,
	selectBlock,
} from '../support/blocks';

test( 'registers every built block in the editor', async ( { page } ) => {
	await openEditor( page );

	const registered = await page.evaluate( () =>
		( window as any ).wp.blocks
			.getBlockTypes()
			.filter( ( type: any ) => type.name.startsWith( 'blicks/' ) )
			.map( ( type: any ) => type.name )
			.sort()
	);

	expect( registered ).toEqual(
		[ ...insertableBlocks(), ...nestedBlocks() ].map( ( b ) => b.name ).sort()
	);
} );

for ( const block of insertableBlocks() ) {
	test.describe( block.name, () => {
		test( 'inserts and renders in the canvas', async ( { page } ) => {
			const watcher = new ConsoleWatcher( page );
			await openEditor( page );

			const rendered = canvas( page ).locator( `.bl-${ block.slug }` );
			await insertBlock( page, block );

			// The `bl-<slug>` class is stamped by the block factory in the editor and in save()
			// alike, and is what the generated CSS hangs off — missing it means the block is
			// unstyleable even when it looks fine.
			await expect( rendered.first() ).toBeVisible();

			// WordPress swaps a block that throws or fails validation for a warning panel,
			// which is easy to miss visually but never legitimate here.
			await expect( canvas( page ).locator( '.block-editor-warning' ) ).toHaveCount( 0 );

			expect( watcher.errors ).toEqual( [] );
		} );

		test( 'binds the inspector when selected', async ( { page } ) => {
			const watcher = new ConsoleWatcher( page );
			await openEditor( page );
			await insertBlock( page, block );
			await selectBlock( page, block.slug );

			// An inspector that renders nothing means the controls threw, or the block's
			// `supports.blicks` manifest resolved to no facets at all.
			await expect(
				page.locator( '.block-editor-block-inspector' ).first()
			).not.toBeEmpty();

			expect( watcher.errors ).toEqual( [] );
		} );
	} );
}

for ( const block of nestedBlocks() ) {
	test( `${ block.name } renders inside its parent`, async ( { page } ) => {
		const watcher = new ConsoleWatcher( page );
		await openEditor( page );

		// A nested block is hidden from the inserter, so reach it the way a user does: insert
		// the parent and let it seed the child through its InnerBlocks template.
		const parentName = block.parent![ 0 ];
		const parent = insertableBlocks().find( ( candidate ) => candidate.name === parentName );
		expect(
			parent,
			`${ block.name } declares parent ${ parentName }, which is not insertable`
		).toBeTruthy();

		await insertBlock( page, parent! );

		await expect( canvas( page ).locator( `.bl-${ block.slug }` ).first() ).toBeVisible();
		await expect( canvas( page ).locator( '.block-editor-warning' ) ).toHaveCount( 0 );

		expect( watcher.errors ).toEqual( [] );
	} );
}
