/**
 * A Button with no colour of its own reads on any theme.
 *
 * Twenty Twenty-One ships normalize's unlayered `a { background-color: transparent }`, which beat the
 * variant fill in `@layer blicks.base` and left a link button's light label on the page background.
 * Ollie's palette has a dark `secondary` and no `secondary-foreground`, which once put the default
 * dark label on Ollie's dark fill. Each theme draws the same page here (`X-Blicks-E2E-Theme`, see
 * mu-plugins/blicks-e2e-theme.php) and every button must have an opaque fill and a label that
 * passes WCAG AA against it.
 */

import { expect, test, type Page } from '@playwright/test';

type Spec = [ string, Record< string, unknown >, Spec[]? ];

const THEMES = [ 'twentytwentyfive', 'twentytwentyone', 'ollie' ];
const VARIANTS = [ 'default', 'secondary' ];

async function publish( page: Page, title: string, blocks: Spec[] ): Promise< string > {
	await page.goto( '/wp-admin/post-new.php' );
	await page.waitForFunction( () => !! ( window as any ).wp?.blocks?.getBlockType?.( 'blicks/button' ), undefined, { timeout: 120_000 } );

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

/** The fill and label of every button, with their WCAG contrast, as the visitor sees them. */
function readButtons( page: Page ) {
	return page.locator( '.bl-button' ).evaluateAll( ( buttons ) => {
		const rgba = ( value: string ): number[] | null => {
			const m = value.match( /^rgba?\(([^)]+)\)$/ );
			if ( ! m ) return null;
			const parts = m[ 1 ].split( /[\s,/]+/ ).filter( Boolean ).map( Number );
			return [ parts[ 0 ], parts[ 1 ], parts[ 2 ], parts[ 3 ] ?? 1 ];
		};
		const luminance = ( [ r, g, b ]: number[] ): number => {
			const lin = ( c: number ) => ( ( c /= 255 ) <= 0.04045 ? c / 12.92 : ( ( c + 0.055 ) / 1.055 ) ** 2.4 );
			return 0.2126 * lin( r ) + 0.7152 * lin( g ) + 0.0722 * lin( b );
		};

		return buttons.map( ( el ) => {
			const style = getComputedStyle( el );
			const fill = rgba( style.backgroundColor );
			const label = rgba( style.color );
			const ratio = fill && label
				? ( Math.max( luminance( fill ), luminance( label ) ) + 0.05 ) / ( Math.min( luminance( fill ), luminance( label ) ) + 0.05 )
				: 0;
			return {
				name: `${ el.tagName.toLowerCase() } ${ ( el.className.match( /bl-button--(default|secondary)\b/ ) ?? [] )[ 1 ] }`,
				background: style.backgroundColor,
				color: style.color,
				alpha: fill ? fill[ 3 ] : 0,
				ratio: Math.round( ratio * 100 ) / 100,
			};
		} );
	} );
}

let link = '';

test.beforeAll( async ( { browser } ) => {
	const page = await browser.newPage();
	const blocks: Spec[] = VARIANTS.flatMap( ( variant ): Spec[] => [
		// A link, the case the theme reset hit, and a plain button.
		[ 'blicks/button', { text: `Link ${ variant }`, variant, action: 'link', url: 'https://example.com/' } ],
		[ 'blicks/button', { text: `Button ${ variant }`, variant } ],
	] );
	link = await publish( page, `Buttons on every theme ${ Date.now() }`, [ [ 'blicks/buttons', {}, blocks ] ] );
	await page.close();
} );

for ( const theme of THEMES ) {
	test( `default and secondary buttons have a readable fill on ${ theme }`, async ( { browser } ) => {
		// A logged-out visitor, drawn with this theme.
		const context = await browser.newContext( { storageState: undefined, extraHTTPHeaders: { 'X-Blicks-E2E-Theme': theme } } );
		const page = await context.newPage();
		await page.goto( link );

		// The header reached WordPress: the page really is this theme's.
		await expect( page.locator( `link[href*="/themes/${ theme }/"], style[id^="${ theme }"]` ).first() ).toBeAttached();

		const buttons = await readButtons( page );
		expect( buttons.map( ( b ) => b.name ).sort() ).toEqual( [ 'a default', 'a secondary', 'button default', 'button secondary' ] );

		for ( const button of buttons ) {
			expect( button.alpha, `${ button.name } on ${ theme } has no fill (${ button.background })` ).toBeGreaterThan( 0.9 );
			expect( button.ratio, `${ button.name } on ${ theme }: ${ button.color } on ${ button.background }` ).toBeGreaterThanOrEqual( 4.5 );
		}

		await context.close();
	} );
}
