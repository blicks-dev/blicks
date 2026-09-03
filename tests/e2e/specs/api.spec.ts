/**
 * The public addon API, exercised the way an addon uses it: in the real editor, against the
 * `blicks-editor` bundle WordPress actually enqueues.
 *
 * The load-bearing assertion is the last one. A block registered through `window.blicks` must
 * land in the SAME registry as the plugin's own blocks — if the API were ever served from a
 * second bundle, the addon's block would register into a registry the editor is not reading and
 * simply never appear, with nothing thrown.
 */

import { expect, test } from '@playwright/test';
import { canvas, openEditor } from '../support/blocks';

test( 'publishes the API namespace on window.blicks', async ( { page } ) => {
	await openEditor( page );

	const api = await page.evaluate( () => {
		const b = ( window as any ).blicks;
		if ( ! b ) return null;
		return {
			apiVersion: b.apiVersion,
			defineBlock: typeof b.blocks?.defineBlock,
			getValue: typeof b.values?.getValue,
			states: b.values?.STATES,
			breakpoints: ( b.values?.BREAKPOINTS ?? [] ).map( ( x: any ) => x.id ),
			styleMapRules: Array.isArray( b.style?.STYLE_MAP ) ? b.style.STYLE_MAP.length : 0,
			controls: Object.keys( b.inspector?.controls ?? {} ).length,
			// The icon registry predates this API and registers onto the same namespace, so a
			// merge that replaced the object instead of extending it would drop it.
			iconsSurvived: typeof b.icons,
		};
	} );

	expect( api, 'window.blicks is not published' ).not.toBeNull();
	expect( api!.apiVersion ).toBeGreaterThanOrEqual( 1 );
	expect( api!.defineBlock ).toBe( 'function' );
	expect( api!.getValue ).toBe( 'function' );
	expect( api!.states ).toEqual( [ 'default', 'hover', 'focus', 'active' ] );
	expect( api!.breakpoints ).toEqual( [ 'base', 'tablet', 'mobile' ] );
	expect( api!.styleMapRules ).toBeGreaterThan( 0 );
	expect( api!.controls ).toBeGreaterThan( 0 );
	expect( api!.iconsSurvived ).toBe( 'object' );
} );

test( 'an addon can register a block through the API', async ( { page } ) => {
	await openEditor( page );

	const registered = await page.evaluate( () => {
		const wp = ( window as any ).wp;
		const api = ( window as any ).blicks;

		api.blocks.defineBlock(
			{
				name: 'addon/e2e-probe',
				title: 'Addon E2E Probe',
				category: 'blicks',
				attributes: { uniqueId: { type: 'string' }, blicks: { type: 'object', default: {} } },
				supports: { blicks: { controls: [ 'spacing.*' ], states: [ 'default' ] } },
			},
			{ render: ( ctx: any ) => wp.element.createElement( 'div', ctx.blockProps, 'addon probe' ) }
		);

		const type = wp.blocks.getBlockType( 'addon/e2e-probe' );
		return {
			exists: !! type,
			// The factory supplies these; a bare registerBlockType would not.
			hasFrameworkAttributes: !! type?.attributes?.uniqueId && !! type?.attributes?.blicks,
			// Same registry as the plugin's own blocks — the single-copy proof.
			pluginBlockAlsoPresent: !! wp.blocks.getBlockType( 'blicks/section' ),
		};
	} );

	expect( registered.exists ).toBe( true );
	expect( registered.hasFrameworkAttributes ).toBe( true );
	expect( registered.pluginBlockAlsoPresent ).toBe( true );

	// Insert it and confirm the framework styled it like one of its own: `bl-<slug>` is the class
	// the generated CSS hangs off, so without it an addon block is unstyleable.
	await page.evaluate( () => {
		const wp = ( window as any ).wp;
		wp.data.dispatch( 'core/block-editor' ).insertBlock( wp.blocks.createBlock( 'addon/e2e-probe', {} ) );
	} );

	await expect( canvas( page ).locator( '.bl-e2e-probe' ) ).toBeVisible();
	await expect( canvas( page ).locator( '.block-editor-warning' ) ).toHaveCount( 0 );
} );
