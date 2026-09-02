/**
 * @vitest-environment jsdom
 *
 * Saved-markup contract for every registered Blicks block.
 *
 * The bug this exists to catch is `save()` drifting from markup that is already sitting in
 * users' posts. WordPress re-runs `save()` on load and compares it to the stored HTML; a
 * mismatch shows "This block contains unexpected or invalid content" and offers to discard
 * the user's markup.
 *
 * A serialize → parse round trip CANNOT catch that — both sides run today's `save()`, so they
 * always agree. The guard has to be markup frozen at a point in time, which is what the
 * committed golden files in `__golden__/` are: a stand-in for what is in the database.
 * Changing one is a deliberate, reviewable act that means "existing content needs a
 * deprecation or a migration".
 *
 * Coverage is derived from the block registry (see `block-fixtures.ts`), so a new block joins
 * automatically — its golden file is written on the first `vitest -u` run.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, serialize } from '@wordpress/blocks';

import '@/block-library';
import {
	blockFixtures,
	blockSlug,
	createFixtureBlock,
	createInsertableBlock,
	walkBlocks,
	type BlockFixture,
} from './block-fixtures';

const fixtures = blockFixtures();
const GOLDEN_DIR = resolve( __dirname, '__golden__' );

const goldenPath = ( fixture: BlockFixture ) => resolve( GOLDEN_DIR, `${ blockSlug( fixture.name ) }.html` );

/** Markup for a fixture, in the shape WordPress would have stored it. */
function saveMarkup( fixture: BlockFixture ): string {
	return serialize( [ createInsertableBlock( fixture, { deterministicIds: true } ) ] );
}

/**
 * WordPress reports validation issues as an unformatted sprintf pair. Interpolating it here
 * is the difference between "Expected attribute `%s` of value `%s`, saw `%s`" and a message
 * that names the attribute that actually drifted.
 */
function formatIssue( issue: any ): string {
	const [ template, ...args ] = issue?.args ?? [];
	if ( typeof template !== 'string' ) return '';

	// The trailing summary issue interpolates the entire block type as %o — thousands of
	// characters of registry JSON that say nothing the block path has not already said.
	if ( template.startsWith( 'Block validation failed' ) ) return '';

	let i = 0;
	return template.replace( /%[sdo]/g, () => {
		const arg = args[ i++ ];
		const text = typeof arg === 'string' ? arg : JSON.stringify( arg );
		return text && text.length > 200 ? `${ text.slice( 0, 200 ) }…` : text;
	} );
}

/** Collect every invalid block in a parsed tree, with its path, for a readable failure. */
function invalidBlocks( blocks: any[] ): string[] {
	const invalid: string[] = [];
	walkBlocks( blocks, ( block, path ) => {
		if ( block.name === 'core/missing' ) {
			invalid.push( `${ path }: unregistered (parsed as core/missing)` );
			return;
		}
		if ( block.isValid === false ) {
			const issues = ( block.validationIssues ?? [] )
				.map( formatIssue )
				.filter( Boolean )
				.join( '; ' );
			invalid.push( `${ path }: invalid${ issues ? ` — ${ issues }` : '' }` );
		}
	} );
	return invalid;
}

function readGolden( fixture: BlockFixture ): string | null {
	try {
		return readFileSync( goldenPath( fixture ), 'utf8' );
	} catch {
		return null;
	}
}

describe( 'block library', () => {
	it( 'registers every block in the blicks namespace', () => {
		expect( fixtures.length ).toBeGreaterThan( 0 );
		expect( fixtures.map( ( f ) => f.name ) ).toContain( 'blicks/text' );
	} );

	// A block with no `example` still gets tested, but only ever with its attribute defaults —
	// worth failing on rather than silently under-covering it.
	it( 'gives every block an inserter example to derive fixtures from', () => {
		const missing = fixtures.filter( ( f ) => f.usesDefaults ).map( ( f ) => f.name );
		expect( missing ).toEqual( [] );
	} );
} );

describe.each( fixtures.map( ( fixture ) => [ fixture.name, fixture ] as [ string, BlockFixture ] ) )(
	'%s',
	( _name, fixture ) => {
		it( 'saves the markup frozen in its golden file', async () => {
			// A diff here means save() changed. That is allowed — but every post already
			// containing this block will now fail validation unless a deprecation handles the
			// old shape. Re-run with `vitest -u` only once that deprecation exists.
			await expect( saveMarkup( fixture ) ).toMatchFileSnapshot( goldenPath( fixture ) );
		} );

		it( 'still validates markup saved by an earlier build', () => {
			const golden = readGolden( fixture );
			if ( golden === null ) {
				throw new Error(
					`No golden markup for ${ fixture.name }. Run \`pnpm test -u\` to record it.`
				);
			}

			// The real regression check: yesterday's stored HTML meeting today's save().
			expect( invalidBlocks( parse( golden ) ) ).toEqual( [] );
		} );

		it( 'preserves its attributes through a parse', () => {
			const block = createInsertableBlock( fixture, { deterministicIds: true } );
			const [ parsed ] = parse( serialize( [ block ] ) );

			expect( parsed?.name ).toBe( block.name );
			for ( const [ key, value ] of Object.entries( fixture.attributes ) ) {
				const target = fixture.parent ? parsed.innerBlocks[ 0 ] : parsed;
				expect( target.attributes[ key ] ).toEqual( value );
			}
		} );

		it( 'keeps editor-only props out of the saved markup', () => {
			// The factory strips editor-only RichText props and custom HTML attributes on save
			// (define-block.tsx). A leak lands in the markup as a stray DOM attribute and breaks
			// validation for every existing post using the block.
			const markup = serialize( [ createFixtureBlock( fixture, { deterministicIds: true } ) ] );

			for ( const leak of [ 'onReplace', 'identifier=', 'autocompleters', 'placeholder=' ] ) {
				expect( markup ).not.toContain( leak );
			}
		} );
	}
);
