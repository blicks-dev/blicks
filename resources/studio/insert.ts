/**
 * Where Insert lands.
 *
 * The rule, in one line: **Insert asks only when it cannot know.** A mount from a selection carries
 * an origin — the client id the Studio was opened from — and replacing it is not a guess, so there
 * is no question to put. Every other way in has no origin, and guessing there would mean writing
 * into somebody's post at a position nothing chose.
 *
 * Kept apart from the sheet that renders it because the interesting part is the decision, not the
 * dialog: four inputs, first match wins, and each branch is a sentence a person could disagree
 * with. A component that both decides and draws would hide that behind a render.
 */

import { getBlockType } from '@wordpress/blocks';
import type { BlockNode } from './mount';

/** Where the tree goes. */
export type InsertTarget =
	/** Replace the block the Studio was opened from, keeping its position in the document. */
	| { kind: 'replace-origin'; clientId: string }
	/** After a block the author has selected in the post. */
	| { kind: 'after'; clientId: string }
	/** Replace a block the author has selected, and its children. */
	| { kind: 'replace'; clientId: string }
	/** After the last block in the post. */
	| { kind: 'end' };

export interface InsertDecision {
	/** What happens if nothing is changed. Also the picker's preselected row. */
	target: InsertTarget;
	/** Whether to put the picker up at all. */
	asks: boolean;
	/**
	 * Why it is asking, in the sheet's own words. Empty when it is not.
	 *
	 * Carried rather than derived in the component, because "the block you opened this from is no
	 * longer in the post" is the one case a person needs told — silently falling back to the end of
	 * the document would look like the Studio losing their work.
	 */
	reason: string;
}

export interface InsertContext {
	/** The client id recorded at mount, or null for every way in except a selection. */
	origin: string | null;
	/** Whether that id is still in the post. It can be deleted in another tab while the Studio is open. */
	originExists: boolean;
	/** What is selected in the post right now, if anything. */
	selected: string | null;
}

/**
 * First match wins, read top to bottom.
 *
 * The last two branches both ask, and differ only in what they preselect. That is deliberate: a
 * selection is the nearest thing the post has to a cursor, so offering it as the default costs
 * nothing when wrong and saves a click when right — but it is still shown, because "after the
 * thing I last clicked" is not the same as "where I want this".
 */
export function decideInsert( { origin, originExists, selected }: InsertContext ): InsertDecision {
	if ( origin && originExists ) {
		return { target: { kind: 'replace-origin', clientId: origin }, asks: false, reason: '' };
	}

	if ( origin && ! originExists ) {
		return {
			target: selected ? { kind: 'after', clientId: selected } : { kind: 'end' },
			asks: true,
			reason: 'The block this was opened from is no longer in the post.',
		};
	}

	if ( selected ) {
		return { target: { kind: 'after', clientId: selected }, asks: true, reason: '' };
	}

	return { target: { kind: 'end' }, asks: true, reason: '' };
}

/**
 * The parent a tree needs before it can live at the top of a post, or null if it can live there.
 *
 * A Scene box mounted on its own — from pasted JSON, say — is `parent`-restricted: valid inside a
 * Scene and nowhere else. Inserting it at post root would produce a block WordPress immediately
 * flags as invalid content, so Insert offers to wrap it instead.
 *
 * Refusing would be the other option and is worse: the author has a composition they just built,
 * and "no" with no way forward is not an answer. Wrapping is what they would do by hand.
 *
 * Only roots are checked. A restricted block *inside* the tree already has whatever parent the tree
 * gives it, and second-guessing that would mean re-validating a structure the editor built.
 */
export function requiredWrapper( blocks: BlockNode[] ): string | null {
	if ( blocks.length === 0 ) {
		return null;
	}

	const parents = blocks.map( ( block ) => {
		const type = getBlockType( block.name ) as { parent?: string[] } | undefined;

		return type?.parent?.length ? type.parent : null;
	} );

	// Every root has to want the same wrapper. A mixed set has no single right answer, and picking
	// one would silently drop the others inside a parent that refuses them.
	if ( parents.some( ( p ) => p === null ) ) {
		return null;
	}

	const first = parents[ 0 ]![ 0 ]!;

	return parents.every( ( p ) => p!.includes( first ) ) ? first : null;
}

/** What the chrome says the button will do, so the label is never a surprise. */
export function describeTarget( target: InsertTarget, nameOf: ( id: string ) => string ): string {
	switch ( target.kind ) {
		case 'replace-origin':
			return `Replaces ${ nameOf( target.clientId ) }`;
		case 'after':
			return `After ${ nameOf( target.clientId ) }`;
		case 'replace':
			return `Replaces ${ nameOf( target.clientId ) }`;
		case 'end':
			return 'At the end of the post';
	}
}
