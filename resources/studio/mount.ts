/**
 * What the Studio opens on, and where it came from.
 *
 * The Studio owns a **detached copy** of a block tree. Nothing it holds is a reference to anything
 * in the post, which is the property the whole surface rests on: the page is untouched until a door
 * is taken, so mounting something off a live page and taking it apart costs nothing.
 *
 * Detachment is not automatic. `getBlocks()` hands back the editor's own block objects, and a block
 * object carries its `clientId`; mounting one as-is would give two editors the same identity for
 * the same block, and an edit in either would land in the other's store. `cloneBlock()` is what
 * makes the copy real — it regenerates every `clientId` in the tree, recursively.
 *
 * The other half of this file is **origin**, which is the one piece of state the exits need. A tree
 * mounted from a selection remembers the client id it came from, and Insert replaces exactly that.
 * Every other way in has no origin, and Insert has to ask. That asymmetry is the whole reason the
 * target picker exists, so it is modelled here rather than inferred later from whatever happens to
 * be selected at the time.
 */

import { cloneBlock, createBlock, getBlockType } from '@wordpress/blocks';
import { modeFor, type StudioRef } from './registry';
import type { Keyframes } from './motion/keyframes';

/** Which canvas a mounted tree opens on: the id of a registered mode ('section' is built in). */
export type Mode = string;

/** How the tree got here. Kept for the exits and for what the chrome says, not for styling. */
export type Source = 'selection' | 'pattern' | 'json' | 'blank' | 'draft' | 'ref';

/** A block, in the shape `@wordpress/blocks` uses. Loose on purpose — this is other people's data. */
export interface BlockNode {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: BlockNode[];
	clientId?: string;
	/**
	 * Whether the editor considers this node's saved markup to match what its `save` produces.
	 *
	 * Absent on every hand-written tree, which is why `fill` supplies it. The editor reads the
	 * field directly and treats a missing one as invalid.
	 */
	isValid?: boolean;
}

/** Everything the Studio needs to know about what it is holding. */
export interface Mount {
	blocks: BlockNode[];
	mode: Mode;
	source: Source;
	/**
	 * The client id Insert replaces, or `null` when there is nothing to replace.
	 *
	 * Only a mount from a selection has one. It is deliberately NOT re-derived at exit time from
	 * the current selection: by then the author has been inside the Studio for ten minutes and the
	 * post's selection means nothing.
	 */
	origin: string | null;
	/** What the chrome calls it. Empty for a blank canvas. */
	label: string;
	/**
	 * The block to select once the Studio opens, by its client id in `blocks` — set when the Studio
	 * is opened on one block inside a larger mount (the post editor's "Edit in Studio").
	 */
	select?: string;
	/**
	 * Custom keyframes the tree arrived with — a saved pattern's, or pasted JSON's. The session
	 * reconciles them against this site's library when the Studio opens (`motion/session.ts`).
	 */
	keyframes?: Keyframes[];
	/**
	 * Where the tree is stored, for a mode that persists (`StudioMode.persist`): its filled door
	 * saves back there instead of inserting into the post. Set only by `studio.openRef()`.
	 */
	ref?: StudioRef;
	/** A line the chrome shows under the label for a stored tree: "Used on 12 pages". */
	note?: string;
}

/** A tree that could not be read, with the reason a person can act on. */
export class MountError extends Error {
	constructor( message: string ) {
		super( message );
		this.name = 'MountError';
	}
}

/**
 * Which canvas to open on, read from the tree rather than asked.
 *
 * Asking would be a question with a right answer, which is the worst kind. The registered modes
 * decide: a companion's mode claims the trees it understands (a Board claims a lone Scene), and the
 * built-in Section takes everything else.
 */
export function modeOf( blocks: BlockNode[] ): Mode {
	return modeFor( blocks )?.id ?? 'section';
}

/**
 * Detach a tree so the Studio can edit it without touching where it came from.
 *
 * `cloneBlock` regenerates client ids through the whole tree. Reaching for a hand-rolled deep copy
 * here is the mistake worth naming: a structuredClone keeps the ids, so the copy looks right,
 * renders right, and writes into the post's store the first time anything is dragged.
 */
export function detach( blocks: BlockNode[] ): BlockNode[] {
	return withIdentity(
		blocks.map( ( block ) => cloneBlock( fill( block ) as never ) as unknown as BlockNode )
	);
}

/**
 * Give every Blicks block its `uniqueId` before the canvas sees it.
 *
 * A Blicks block that renders without one writes it from an effect on its first render
 * (`define-block.tsx`), so a freshly mounted tree used to make one write per block before anyone
 * touched it. Each write reached the Studio's `onChange` and became an undo step — a pattern of
 * seven blocks opened with seven steps of "history", undo already live, and closing without a
 * change asked whether to discard work nobody had done.
 *
 * The id is derived the same way the effect derives it, from the block's own client id, so the
 * result is the one the effect would have written. Only types that declare the attribute get one,
 * and an id the block already carries is kept.
 */
function withIdentity( blocks: BlockNode[] ): BlockNode[] {
	return blocks.map( ( block ) => {
		const type = getBlockType( block.name ) as { attributes?: Record< string, unknown > } | undefined;
		const attributes = ( block.attributes ?? {} ) as Record< string, unknown >;
		const needs = undefined !== type?.attributes?.uniqueId && ! attributes.uniqueId && block.clientId;

		return {
			...block,
			attributes: needs
				? { ...attributes, uniqueId: String( block.clientId ).replace( /-/g, '' ).slice( 0, 8 ) }
				: block.attributes,
			innerBlocks: withIdentity( block.innerBlocks ?? [] ),
		};
	} );
}

/**
 * Give every node the fields the editor assumes are there.
 *
 * `BlockNode` declares `attributes` and `innerBlocks` optional, because the trees that reach this
 * file are hand-written data as often as they are editor objects — a built-in pattern, a pasted
 * payload. `cloneBlock` assumes both exist and walks `block.innerBlocks.map` unguarded, so a leaf
 * written the obvious way (`{ name: 'blicks/text' }`) throws on the way in.
 *
 * **`isValid` is the one that fails silently.** `isBlockValid` reads the field straight off the
 * block and returns it, so a tree that never set it is `undefined`, which is falsy, which renders
 * every node as "Block contains unexpected or invalid content" with a recovery button. Nothing
 * throws and the tree is structurally perfect — the outline rail draws it correctly while the
 * canvas shows four grey warnings. `cloneBlock` spreads the block, so the gap travels through it
 * untouched.
 *
 * `?? true` rather than `true`: a block that came back from `parse` as genuinely invalid carries
 * `isValid: false` explicitly, and that is a fact about someone's content, not a field to fill in.
 *
 * Normalising here rather than in each source is the point: every way into the Studio goes through
 * `detach`, so one guard covers the sources that exist and the ones that do not yet.
 */
function fill( block: BlockNode ): BlockNode {
	return {
		...block,
		attributes: block.attributes ?? {},
		isValid: block.isValid ?? true,
		innerBlocks: ( block.innerBlocks ?? [] ).map( fill ),
	};
}

/**
 * Whether `after` is `before` with nothing changed but ids filled in, or attributes a block derives
 * from its own state.
 *
 * True only when the trees have the same blocks in the same places and every attribute is the same
 * value, except `uniqueId` going from unset to set, and any change to an attribute `derived` names
 * for that block (its `supports.blicks.derived`: a flag an editor effect keeps in step with the
 * block's inner blocks, say). Such a change follows an edit rather than being one: committed, it
 * is a step that Undo returns to only for the effect to write it again, so Undo appears to do
 * nothing. Anything else — a reorder, a new block, any other attribute — is an edit. Attribute values are compared by reference, which is how the block
 * store hands back what it did not touch; a value it rebuilt reads as changed, which errs towards
 * an extra undo step rather than a lost one.
 */
export function onlyIdentity( before: BlockNode[], after: BlockNode[], derived: ( name: string ) => readonly string[] = () => [] ): boolean {
	let filled = false;

	const same = ( a: BlockNode[], b: BlockNode[] ): boolean => {
		if ( a.length !== b.length ) {
			return false;
		}

		return a.every( ( x, i ) => {
			const y = b[ i ]!;

			if ( x.clientId !== y.clientId || x.name !== y.name ) {
				return false;
			}

			const ax = ( x.attributes ?? {} ) as Record< string, unknown >;
			const ay = ( y.attributes ?? {} ) as Record< string, unknown >;

			for ( const key of new Set( [ ...Object.keys( ax ), ...Object.keys( ay ) ] ) ) {
				if ( 'uniqueId' === key && ! ax.uniqueId && ay.uniqueId ) {
					filled = true;
					continue;
				}

				if ( ax[ key ] !== ay[ key ] && derived( x.name ).includes( key ) ) {
					filled = true;
					continue;
				}

				if ( ax[ key ] !== ay[ key ] ) {
					return false;
				}
			}

			return same( x.innerBlocks ?? [], y.innerBlocks ?? [] );
		} );
	};

	return same( before, after ) && filled;
}

/**
 * Mount what is selected in the post.
 *
 * The caller resolves which ancestor it wants — the picker's job, and a decision about intent that
 * does not belong in here. This takes the block it is given and records its id as the origin.
 */
export function mountSelection( block: BlockNode, label: string ): Mount {
	const blocks = detach( [ block ] );

	return {
		blocks,
		mode: modeOf( blocks ),
		source: 'selection',
		origin: block.clientId ?? null,
		label,
	};
}

/**
 * Mount a block's ancestor and select the block inside it.
 *
 * `detach` gives every node a new client id, so the block is found again by where it sits — its
 * path of child indexes from the root — rather than by the id it had in the post.
 */
export function mountSelectionAt( root: BlockNode, target: string, label: string ): Mount {
	const mount = mountSelection( root, label );
	const path = pathTo( [ root ], target );
	const select = path ? atPath( mount.blocks, path )?.clientId : undefined;

	return select ? { ...mount, select } : mount;
}

/** Child indexes from the top of `nodes` down to `target`, or null when it is not there. */
export function pathTo( nodes: BlockNode[], target: string ): number[] | null {
	for ( let i = 0; i < nodes.length; i++ ) {
		const node = nodes[ i ]!;

		if ( node.clientId === target ) {
			return [ i ];
		}

		const below = pathTo( node.innerBlocks ?? [], target );

		if ( below ) {
			return [ i, ...below ];
		}
	}

	return null;
}

/** The node at a path of child indexes. */
export function atPath( nodes: BlockNode[], path: number[] ): BlockNode | undefined {
	let node: BlockNode | undefined;
	let level = nodes;

	for ( const i of path ) {
		node = level[ i ];
		level = node?.innerBlocks ?? [];
	}

	return node;
}

/** Mount a copy of a library pattern. The library entry is never the live tree. */
export function mountPattern( blocks: BlockNode[], label: string, keyframes: Keyframes[] = [] ): Mount {
	const detached = detach( blocks );

	return {
		blocks: detached,
		mode: modeOf( detached ),
		source: 'pattern',
		origin: null,
		label,
		...( keyframes.length > 0 ? { keyframes } : {} ),
	};
}

/**
 * Mount a stored tree for the mode that stores it (`studio.openRef()`).
 *
 * Detached like any other tree: the copy is the Studio's until the mode's `save` writes it back.
 * The mode is the one that loaded it, not whichever matches the tree, so a header opened from a
 * template part opens in the header mode even while it is still empty.
 */
export function mountRef( blocks: BlockNode[], mode: Mode, ref: StudioRef, label: string, note = '' ): Mount {
	return {
		blocks: detach( blocks ),
		mode,
		source: 'ref',
		origin: null,
		label,
		ref,
		...( '' !== note ? { note } : {} ),
	};
}

/** An empty canvas, on the mode the author picked, because there is no tree to read it off. */
export function mountBlank( mode: Mode ): Mount {
	return { blocks: [], mode, source: 'blank', origin: null, label: '' };
}

/**
 * Build real blocks from parsed JSON, refusing anything this site cannot render.
 *
 * Validation is deliberately **not** deferred to the canvas. A tree that fails halfway leaves the
 * author looking at a half-drawn composition with no way back to the text that caused it; failing
 * at the import box leaves them looking at a textarea they can edit. Same information, one of them
 * actionable.
 *
 * The gate is the registry, not a list kept here: `getBlockType` is the only thing that knows what
 * this install can render, and it accounts for the free plugin, Pro, and anything else a site has.
 */
export function blocksFromJson( text: string ): BlockNode[] {
	return readPortable( text ).blocks;
}

/**
 * Pasted JSON, in either shape Copy JSON writes: a plain block list, or `{ blocks, keyframes }`
 * when the tree uses custom animations. A single block object is accepted as well.
 */
export function readPortable( text: string ): { blocks: BlockNode[]; keyframes: Keyframes[] } {
	let parsed: unknown;

	try {
		parsed = JSON.parse( text );
	} catch ( e ) {
		throw new MountError(
			`That is not valid JSON: ${ e instanceof Error ? e.message : String( e ) }`
		);
	}

	let keyframes: Keyframes[] = [];

	if ( parsed && typeof parsed === 'object' && ! Array.isArray( parsed ) && Array.isArray( ( parsed as { blocks?: unknown } ).blocks ) ) {
		const envelope = parsed as { blocks: unknown[]; keyframes?: unknown };

		keyframes = Array.isArray( envelope.keyframes ) ? envelope.keyframes.filter( isKeyframes ) : [];
		parsed = envelope.blocks;
	}

	const list = Array.isArray( parsed ) ? parsed : [ parsed ];

	if ( list.length === 0 ) {
		throw new MountError( 'There are no blocks in that.' );
	}

	return { blocks: list.map( ( node, index ) => build( node, `blocks[${ index }]` ) ), keyframes };
}

/** The shape of a library record, enough to hand on. The server cleans it properly on save. */
function isKeyframes( value: unknown ): value is Keyframes {
	const v = value as Partial< Keyframes > | null;

	return !! v && typeof v === 'object' && typeof v.slug === 'string' && typeof v.label === 'string' && Array.isArray( v.steps );
}

/** One node, recursively. Reports the path so a deep failure names where it is. */
function build( node: unknown, path: string ): BlockNode {
	if ( ! node || typeof node !== 'object' || Array.isArray( node ) ) {
		throw new MountError( `${ path } is not a block.` );
	}

	const { name, attributes, innerBlocks } = node as Record< string, unknown >;

	if ( typeof name !== 'string' || name === '' ) {
		throw new MountError( `${ path } has no block name.` );
	}

	if ( ! getBlockType( name ) ) {
		throw new MountError( `${ path }: no block named ${ name } is registered here.` );
	}

	if ( attributes !== undefined && ( typeof attributes !== 'object' || attributes === null ) ) {
		throw new MountError( `${ path }.attributes is not an object.` );
	}

	if ( innerBlocks !== undefined && ! Array.isArray( innerBlocks ) ) {
		throw new MountError( `${ path }.innerBlocks is not a list.` );
	}

	const children = ( ( innerBlocks ?? [] ) as unknown[] ).map( ( child, index ) =>
		build( child, `${ path }.innerBlocks[${ index }]` )
	);

	return createBlock(
		name,
		( attributes ?? {} ) as never,
		children as never
	) as unknown as BlockNode;
}

/** Mount pasted JSON. Throws `MountError` with a message meant for the import box. */
export function mountJson( text: string ): Mount {
	const portable = readPortable( text );
	const blocks = withIdentity( portable.blocks );

	return {
		blocks,
		mode: modeOf( blocks ),
		source: 'json',
		origin: null,
		label: '',
		...( portable.keyframes.length > 0 ? { keyframes: portable.keyframes } : {} ),
	};
}

/**
 * The tree as portable JSON — the Copy JSON door, and the other end of the import box.
 *
 * Client ids are stripped. They are this editor session's identity for a block and mean nothing
 * anywhere else; leaving them in would be shipping a local detail to another site, where it either
 * gets ignored or, worse, collides with something.
 *
 * Plain block JSON rather than a Blicks format: anything that can read a block tree can read it,
 * which is what lets two sites trade work with no account and no service in between. The one
 * exception is a tree using this site's own animations: their keyframes live in the site's library,
 * not in any block, so the list is wrapped as `{ blocks, keyframes }` to carry them. A tree without
 * any stays a plain list.
 */
export function toPortableJson( blocks: BlockNode[], keyframes: Keyframes[] = [] ): string {
	const strip = ( node: BlockNode ): Record< string, unknown > => {
		const out: Record< string, unknown > = { name: node.name };

		if ( node.attributes && Object.keys( node.attributes ).length > 0 ) {
			out.attributes = node.attributes;
		}

		if ( node.innerBlocks && node.innerBlocks.length > 0 ) {
			out.innerBlocks = node.innerBlocks.map( strip );
		}

		return out;
	};

	const list = blocks.map( strip );

	return JSON.stringify( keyframes.length > 0 ? { blocks: list, keyframes } : list, null, 2 );
}

/**
 * Walk up from a block to every Blicks ancestor, outermost last.
 *
 * What the "mount which?" picker offers. The block that was clicked is almost never what a person
 * means by "open this in the Studio" — they mean the section it is in — so the picker defaults to
 * the outermost of these and this returns them in the order it needs to show them.
 *
 * Takes its own `getBlockRootClientId` / `getBlockName` rather than reaching for a store, so it is
 * callable from an event handler without binding to a registry, and testable without one.
 */
export function blicksAncestors(
	clientId: string,
	rootOf: ( id: string ) => string | null | undefined,
	nameOf: ( id: string ) => string | undefined
): string[] {
	const found: string[] = [];
	let cursor = rootOf( clientId );

	while ( cursor ) {
		if ( ( nameOf( cursor ) ?? '' ).startsWith( 'blicks/' ) ) {
			found.push( cursor );
		}

		cursor = rootOf( cursor );
	}

	return found;
}
