/**
 * Section is edited in the v2 inspector.
 */

import { expect, test } from '@playwright/test';
import { ConsoleWatcher, openEditor } from '../support/blocks';

test( 'Section is edited in the v2 inspector', async ( { page } ) => {
	const watcher = new ConsoleWatcher( page );
	await openEditor( page );
	await page.evaluate( () => {
		const wp = ( window as any ).wp;
		const section = wp.blocks.createBlock( 'blicks/section', {}, [ wp.blocks.createBlock( 'blicks/heading', { content: 'Band' } ) ] );
		wp.data.dispatch( 'core/block-editor' ).resetBlocks( [ section ] );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( section.clientId );
	} );

	const sidebar = page.locator( '.interface-complementary-area' );
	for ( const tab of [ 'Settings', 'Style', 'Motion' ] ) await expect( sidebar.getByRole( 'tab', { name: tab } ) ).toBeVisible();
	await page.screenshot( { path: 'test-results/section-v2-inspector.png' } );
	expect( watcher.errors ).toEqual( [] );
} );
