/**
 * One card, three sources: the same Loop built on pasted JSON, a data endpoint and a WordPress
 * query must show the same cards in the editor as on the published page, at phone, tablet and
 * desktop widths.
 *
 * "The same" is measured, not eyeballed: the cards' headings and texts in order, and how many sit
 * in the first row. The grid's column count follows the width it is laid out in (the editor
 * canvas is its own iframe, so its media queries see the canvas), which is why the editor's
 * sidebar is hidden first: then the canvas is as wide as the page and both pick the same columns.
 *
 * The endpoint is answered by `tests/e2e/mu-plugins/blicks-e2e-endpoint.php`, so the suite needs
 * no network; the plugin's fetch, checks and cache still run.
 */

import { expect, test, type Page } from '@playwright/test';
import { ConsoleWatcher, canvas, openEditor, publishCurrentContent } from '../support/blocks';

const WIDTHS = [ 375, 1024, 1440 ] as const;

/** Columns the Loop's default (3 / 2 / 1) gives at each width: phone ≤ 600, tablet ≤ 782. */
const COLUMNS: Record< ( typeof WIDTHS )[ number ], number > = { 375: 1, 1024: 3, 1440: 3 };

const ITEMS = [
	{ title: 'Arc floor lamp', blurb: 'Brass and linen, 160 cm.' },
	{ title: 'Oak side table', blurb: 'Solid oak, oiled.' },
	{ title: 'Linen throw', blurb: 'Stone-washed, 130 × 170 cm.' },
	{ title: 'Wool rug', blurb: 'Hand-tufted, 2 × 3 m.' },
];

type Cards = { headings: string[]; texts: string[]; firstRow: number };

const bind = ( attr: string, key: string ) => ( {
	metadata: { bindings: { [ attr ]: { source: 'blicks/item', args: { key } } } },
} );

/** Insert the prototype's card — a Box holding a bound Heading and Text — inside a Loop. */
async function insertLoop( page: Page, attributes: Record< string, unknown >, textField: string ): Promise< void > {
	await page.evaluate(
		( { attrs, title, text } ) => {
			const { createBlock } = ( window as any ).wp.blocks;
			const loop = createBlock( 'blicks/loop', attrs, [
				createBlock( 'blicks/box', { kind: 'card', tag: 'article' }, [
					createBlock( 'blicks/heading', { level: 3, content: 'Title', ...title } ),
					createBlock( 'blicks/text', { content: 'Text', ...text } ),
				] ),
			] );
			( window as any ).wp.data.dispatch( 'core/block-editor' ).insertBlocks( loop );
		},
		{ attrs: attributes, title: bind( 'content', 'title' ), text: bind( 'content', textField ) }
	);
}

/** Read the first Loop's cards in whichever document this runs in. */
function readCards(): Cards {
	const loop = document.querySelector( '.bl-loop' );
	const items = Array.from( loop?.querySelectorAll( '.bl-loop__item' ) ?? [] ) as HTMLElement[];
	// The editor's live card labels each bound block with a chip naming its field; that is editor
	// chrome, not content, so it is left out of the comparison.
	const text = ( item: HTMLElement, selector: string ) => {
		const found = item.querySelector( selector )?.cloneNode( true ) as HTMLElement | undefined;
		found?.querySelectorAll( '.bl-bound-chip' ).forEach( ( chip ) => chip.remove() );
		return ( found?.textContent ?? '' ).replace( /\s+/g, ' ' ).trim();
	};
	const top = items[ 0 ]?.getBoundingClientRect().top ?? 0;

	return {
		headings: items.map( ( item ) => text( item, '.bl-heading' ) ),
		texts: items.map( ( item ) => text( item, '.bl-text' ) ),
		firstRow: items.filter( ( item ) => Math.abs( item.getBoundingClientRect().top - top ) < 2 ).length,
	};
}

/**
 * Hide the settings sidebar for this page only. Closing it through `core/interface` would be saved
 * as the admin's preference, and every other spec running as admin would lose its inspector.
 */
async function hideSidebar( page: Page ): Promise< void > {
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await page.addStyleTag( { content: '.interface-interface-skeleton__sidebar { display: none !important; }' } );
}

async function editorCards( page: Page, count: number ): Promise< Cards > {
	await expect( canvas( page ).locator( '.bl-loop .bl-loop__item' ) ).toHaveCount( count );
	// Previews fill in once the items arrive; wait for the last card's heading to be bound.
	await expect( canvas( page ).locator( '.bl-loop .bl-loop__item' ).last().locator( '.bl-heading' ) ).not.toHaveText( 'Title' );
	const frame = page.frame( { name: 'editor-canvas' } );
	if ( ! frame ) {
		throw new Error( 'The editor canvas iframe is missing.' );
	}
	return frame.evaluate( readCards );
}

/**
 * Keep this page's preference changes to itself. At phone width the editor closes its sidebar and
 * saves that to the admin's user meta, and every spec running beside this one as admin would open
 * an editor with no inspector. The save is answered here instead of reaching WordPress.
 */
async function keepPreferencesLocal( page: Page ): Promise< void > {
	await page.route( /users(\/|%2F)me/, async ( route ) => {
		if ( route.request().method() === 'GET' ) {
			return route.continue();
		}
		return route.fulfill( { status: 200, contentType: 'application/json', body: '{}' } );
	} );
}

/** Publish, then compare editor and page at every width. */
async function compareAtEveryWidth( page: Page, title: string, expected: { headings: string[]; texts: string[] } ): Promise< void > {
	const permalink = await publishCurrentContent( page, title );
	const front = await page.context().newPage();
	await front.goto( permalink );
	await hideSidebar( page );

	for ( const width of WIDTHS ) {
		await page.setViewportSize( { width, height: 900 } );
		await front.setViewportSize( { width, height: 900 } );

		const editor = await editorCards( page, expected.headings.length );
		await expect( front.locator( '.bl-loop .bl-loop__item' ) ).toHaveCount( expected.headings.length );
		const published = await front.evaluate( readCards );

		expect( published, `page at ${ width }px` ).toEqual( { ...expected, firstRow: COLUMNS[ width ] } );
		expect( editor, `editor at ${ width }px` ).toEqual( published );
	}

	await front.close();
}

test.describe( 'a Loop shows the same cards in the editor and on the page', () => {
	test( 'from pasted JSON', async ( { page } ) => {
		const watcher = new ConsoleWatcher( page );
		await keepPreferencesLocal( page );
		await openEditor( page );

		await insertLoop( page, { source: 'json', data: JSON.stringify( ITEMS ) }, 'blurb' );
		await compareAtEveryWidth( page, 'Loop from JSON', {
			headings: ITEMS.map( ( item ) => item.title ),
			texts: ITEMS.map( ( item ) => item.blurb ),
		} );

		expect( watcher.errors ).toEqual( [] );
	} );

	test( 'from a data endpoint', async ( { page } ) => {
		const watcher = new ConsoleWatcher( page );
		await keepPreferencesLocal( page );
		await openEditor( page );

		// Administrators add endpoints in Settings; the Loop stores only the id.
		const id = await page.evaluate( async ( name ) => {
			const saved = await ( window as any ).wp.apiFetch( {
				path: '/blicks/v1/data-endpoints',
				method: 'POST',
				data: { name, url: 'https://api.blicks-e2e.example/cards', cache: '5m' },
			} );
			return saved.id as string;
		}, `E2E cards ${ Date.now() }` );

		await insertLoop( page, { source: 'endpoint', endpoint: id, path: 'data.items' }, 'blurb' );
		await compareAtEveryWidth( page, 'Loop from an endpoint', {
			headings: ITEMS.map( ( item ) => item.title ),
			texts: ITEMS.map( ( item ) => item.blurb ),
		} );

		expect( watcher.errors ).toEqual( [] );
	} );

	test( 'from a WordPress query', async ( { page } ) => {
		const watcher = new ConsoleWatcher( page );
		await keepPreferencesLocal( page );
		await openEditor( page );

		// Posts of their own, in a category of their own, so other specs' posts never join in.
		const run = Date.now().toString( 36 );
		const slug = await page.evaluate( async ( { items, tag } ) => {
			const apiFetch = ( window as any ).wp.apiFetch;
			const category = await apiFetch( { path: '/wp/v2/categories', method: 'POST', data: { name: `Loop ${ tag }` } } );
			for ( const item of items ) {
				await apiFetch( {
					path: '/wp/v2/posts',
					method: 'POST',
					data: { title: item.title, excerpt: item.blurb, status: 'publish', categories: [ category.id ] },
				} );
			}
			return category.slug as string;
		}, { items: ITEMS, tag: run } );

		await insertLoop( page, {
			source: 'query',
			query: { postType: 'post', orderBy: 'title', order: 'asc', taxonomy: { category: slug } },
		}, 'excerpt' );

		const sorted = [ ...ITEMS ].sort( ( a, b ) => a.title.localeCompare( b.title ) );
		await compareAtEveryWidth( page, 'Loop from a query', {
			headings: sorted.map( ( item ) => item.title ),
			texts: sorted.map( ( item ) => item.blurb ),
		} );

		expect( watcher.errors ).toEqual( [] );
	} );
} );
