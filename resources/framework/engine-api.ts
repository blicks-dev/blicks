import { getBlockType } from '@wordpress/blocks';
import { describeControl, describeEngine } from '@/engine/describe';
import { valueSchema } from '@/engine/value-schema';
import { findStyleProblems, type StyleProblem } from '@/framework/css/vars';
import { includesControl } from '@/framework/inspector/control-allow';

/**
 * `window.blicks.engine`: the style engine's registry and validator, for Studio, Blicks Pro and the
 * AI layer. Read-only — control ids are not registerable from JS (see `public-api.ts`).
 *
 * Three questions a tool that writes style trees has to answer before it writes one, and the
 * inspector already answers internally:
 *
 * - **What exists?** `schema()` / `control( id )` / `valueSchema( id )` — the engine described
 *   (`resources/engine/describe.ts`; PHP mirror `Blicks\Style\EngineSchema::describe()`).
 * - **What may this block use?** `blockControls( name )` / `allowsControl( id, allowList )` — the
 *   block's `supports.blicks.controls`, and the same glob rule the inspector and the PHP
 *   `ElementStyle::allowsControl()` apply (`tests/fixtures/control-glob-cases.json`).
 * - **Would the engine apply it?** `problems( blicks, allowList? )` for one style tree, and
 *   `validateBlocks( blocks )` for a whole tree of blocks. The same judgement `buildElementStyle`
 *   makes silently, made out loud. PHP mirror: `ElementStyle::problems()`, and for a full layout
 *   the `blicks/validate-layout` ability.
 *
 * Never throws: it runs inside another plugin's bundle, where an exception takes the editor down.
 */

/** A block a tree walk can read: the shape of `BlockInstance` and of Studio's `BlockNode`. */
export interface EngineBlock {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: EngineBlock[];
}

/** A problem found by `validateBlocks`: where it is, which block, and why. */
export type BlockProblem =
	| ( StyleProblem & { path: string; block: string } )
	| { path: string; block: string; reason: 'unknown-block' | 'invalid-block' };

/** Whether a registered block opts into the Blicks engine through `supports.blicks`. */
export function isBlicksBlock( name: string ): boolean {
	return blockControls( name ) !== null;
}

/**
 * A block's `supports.blicks.controls` allow-list, or null when the block is not registered or
 * does not opt into the engine. An opted-in block with no list allows nothing.
 */
export function blockControls( name: string ): string[] | null {
	if ( typeof name !== 'string' || name === '' ) return null;
	const support = ( getBlockType( name )?.supports as Record< string, unknown > | undefined )?.blicks;
	if ( ! support ) return null;
	const controls = ( support as { controls?: unknown } ).controls;
	return Array.isArray( controls ) ? controls.filter( ( c ): c is string => typeof c === 'string' ) : [];
}

/** Does an allow-list permit this control id? Exact ids and one-level globs (`spacing.*`). */
export function allowsControl( id: string, allowList: readonly string[] ): boolean {
	return typeof id === 'string' && Array.isArray( allowList ) && includesControl( allowList as string[], id );
}

/** Every value in one `blicks` style tree the engine would not apply. */
export function problems( blicks: unknown, allowList?: readonly string[] ): StyleProblem[] {
	try {
		return findStyleProblems( blicks, allowList );
	} catch {
		return [];
	}
}

/**
 * Validate a tree of blocks the way the engine will read it: every block must be registered, and
 * every Blicks block's `blicks` tree must hold only controls it allows, in slots that exist, with
 * values the engine applies. Blocks that are not Blicks blocks (`core/paragraph`) are walked into
 * but not style-checked.
 *
 * Paths read `blocks[0].innerBlocks[2]`, the same form the `validate-layout` ability reports.
 */
export function validateBlocks( blocks: readonly EngineBlock[] ): { valid: boolean; problems: BlockProblem[] } {
	const found: BlockProblem[] = [];

	const walk = ( list: unknown, at: string ) => {
		if ( ! Array.isArray( list ) ) return;
		list.forEach( ( block, index ) => {
			const path = `${ at }[${ index }]`;
			if ( ! block || typeof block !== 'object' || typeof ( block as EngineBlock ).name !== 'string' ) {
				found.push( { path, block: '', reason: 'invalid-block' } );
				return;
			}
			const { name, attributes, innerBlocks } = block as EngineBlock;
			if ( ! getBlockType( name ) ) {
				found.push( { path, block: name, reason: 'unknown-block' } );
			} else {
				const allowList = blockControls( name );
				if ( allowList !== null ) {
					for ( const problem of problems( attributes?.blicks, allowList ) ) {
						found.push( { ...problem, path, block: name } );
					}
				}
			}
			walk( innerBlocks, `${ path }.innerBlocks` );
		} );
	};

	walk( blocks, 'blocks' );

	return { valid: found.length === 0, problems: found };
}

/** Published as `window.blicks.engine`. */
export const engineApi = Object.freeze( {
	schema: describeEngine,
	control: describeControl,
	valueSchema,
	isBlicksBlock,
	blockControls,
	allowsControl,
	problems,
	validateBlocks,
} );
