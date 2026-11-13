/**
 * The card a block reacts to: the nearest container around it that can be one.
 *
 * "Reacts when its card is pointed at" writes the block's hover look into the engine's `group`
 * state, which only plays inside an element carrying `layout.group`. So choosing it also marks the
 * nearest container that allows that control — the author never has to find the card and set it by
 * hand. A container already marked is left alone, and so is everything above it.
 */

import { STATE_ANCESTOR } from '@/engine/schema.gen';

export const CARD_CONTROL = 'layout.group';
export const CARD_VALUE = 'card';

/**
 * Whether a value in this state needs a card around the block, part prefix or not (`before:groupOn`):
 * the states an ancestor turns on (`STATE_ANCESTOR`) — the card's hover, press and On. A value in
 * one of them does nothing until something around the block is marked as the card.
 */
export function needsCard( state: string ): boolean {
	return Object.hasOwn( STATE_ANCESTOR, state.split( ':' ).pop() ?? '' );
}

type Tree = Record< string, Record< string, Record< string, unknown > > >;

export interface Ancestor {
	clientId: string;
	/** The block's `supports.blicks.controls`. */
	controls: unknown;
	blicks: Tree | undefined;
}

/** Whether an allow-list lets a block be a card. */
export function canBeCard( controls: unknown ): boolean {
	if ( ! Array.isArray( controls ) ) return false;
	const list = controls.map( String );
	return list.includes( CARD_CONTROL ) || list.includes( 'layout.*' );
}

export function isCard( blicks: Tree | undefined ): boolean {
	return blicks?.[ CARD_CONTROL ]?.default?.base === CARD_VALUE;
}

/**
 * The ancestor to mark, nearest first, or null when nothing needs marking — the nearest container
 * able to be a card already is one, or there is none.
 */
export function cardToMark( ancestors: Ancestor[] ): Ancestor | null {
	const nearest = ancestors.find( ( a ) => canBeCard( a.controls ) );
	return nearest && ! isCard( nearest.blicks ) ? nearest : null;
}

/** The tree with the card switch on. */
export function markCard( blicks: Tree | undefined ): Tree {
	return { ...( blicks ?? {} ), [ CARD_CONTROL ]: { default: { base: CARD_VALUE } } };
}
