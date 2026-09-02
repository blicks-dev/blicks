/**
 * One representative instance per Blicks block, derived from the block registry.
 *
 * The fixtures are NOT hand-maintained. Every block already carries an `example`
 * (attributes + innerBlocks) in `framework/identity.ts` — WordPress uses it for the
 * inserter preview, so it is kept current as a matter of course and is by definition
 * the canonical "representative instance" of the block. Reading it back out of the
 * registry means a new block is covered by every fixture-driven test the moment it is
 * registered, with no parallel list to forget to update.
 *
 * Consumed by:
 *   • `block-round-trip.test.tsx` (this package) — serialize → parse → validate.
 *   • `tests/e2e/blocks.spec.ts` (blicks-playground) — insert each block into the canvas.
 */

import { createBlock, getBlockTypes } from '@wordpress/blocks';

/** A block and its children, in the shape `createBlock` consumes recursively. */
export interface FixtureNode {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: FixtureNode[];
}

export interface BlockFixture extends FixtureNode {
	// Narrowed from FixtureNode: `blockFixtures()` always defaults these, so consumers
	// never have to guard them.
	attributes: Record< string, unknown >;
	innerBlocks: FixtureNode[];
	title: string;
	/** `block.json` `parent` — the block is only insertable inside one of these. */
	parent: string[] | null;
	/** True when the block ships no `example` and is exercised with its attribute defaults. */
	usesDefaults: boolean;
}

const NAMESPACE = 'blicks/';

/** `blicks/box` → `box`. Used for golden-markup filenames. */
export function blockSlug( name: string ): string {
	return name.slice( NAMESPACE.length );
}

/**
 * Every registered Blicks block as a fixture. Call after the block library has been
 * imported (registration is a side effect of importing `@/block-library`).
 */
export function blockFixtures(): BlockFixture[] {
	return getBlockTypes()
		.filter( ( type: any ) => String( type.name ).startsWith( NAMESPACE ) )
		.map( ( type: any ) => {
			const example = type.example ?? null;
			return {
				name: type.name,
				title: type.title ?? type.name,
				attributes: example?.attributes ?? {},
				innerBlocks: example?.innerBlocks ?? [],
				parent: type.parent ?? null,
				usesDefaults: ! example,
			};
		} )
		.sort( ( a: BlockFixture, b: BlockFixture ) => a.name.localeCompare( b.name ) );
}

export interface CreateOptions {
	/**
	 * Stamp a stable `uniqueId` instead of leaving it unset.
	 *
	 * In the editor `uniqueId` is derived from the random clientId, so real stored markup
	 * always carries one (it becomes the `bl-<id>` scoping class). Golden markup has to
	 * include it to be representative, and has to be deterministic to be diffable.
	 */
	deterministicIds?: boolean;
}

/** Recursively instantiate a fixture (and its children) as real block objects. */
export function createFixtureBlock( node: FixtureNode, options: CreateOptions = {} ): any {
	const attributes = { ...( node.attributes ?? {} ) };

	if ( options.deterministicIds && attributes.uniqueId === undefined ) {
		attributes.uniqueId = stableId( node.name );
	}

	return createBlock(
		node.name,
		attributes,
		( node.innerBlocks ?? [] ).map( ( child ) => createFixtureBlock( child, options ) )
	);
}

/**
 * A stable 8-char id per block name, in the shape `edit()` produces (a clientId with the
 * dashes stripped, truncated). Deterministic so golden markup only changes when the block does.
 */
function stableId( name: string ): string {
	let hash = 0x811c9dc5;
	for ( let i = 0; i < name.length; i++ ) {
		hash ^= name.charCodeAt( i );
		hash = Math.imul( hash, 0x01000193 ) >>> 0;
	}
	return hash.toString( 16 ).padStart( 8, '0' ).slice( 0, 8 );
}

/**
 * The top-level block to drop on a canvas for this fixture. A block with a `parent`
 * (e.g. `blicks/button`) is not insertable on its own, so it is wrapped in its parent —
 * which is how a user would ever get one in the first place.
 */
export function createInsertableBlock( fixture: BlockFixture, options: CreateOptions = {} ): any {
	const block = createFixtureBlock( fixture, options );
	const parent = fixture.parent?.[ 0 ];
	if ( ! parent ) return block;

	const wrapper = createFixtureBlock( { name: parent }, options );
	return createBlock( parent, wrapper.attributes, [ block ] );
}

/** Depth-first walk over a parsed/created block tree. */
export function walkBlocks( blocks: any[], visit: ( block: any, path: string ) => void, prefix = '' ): void {
	blocks.forEach( ( block, index ) => {
		const path = `${ prefix }${ block?.name ?? '?' }[${ index }]`;
		visit( block, path );
		if ( block?.innerBlocks?.length ) {
			walkBlocks( block.innerBlocks, visit, `${ path } > ` );
		}
	} );
}
