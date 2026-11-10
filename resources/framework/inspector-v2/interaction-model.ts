/**
 * Interactions as the Studio's Motion tab edits them, and as a block stores them: custom HTML
 * attributes (`data-bl-do` and its settings — injected at render, never in saved markup) plus the
 * style values the behaviour needs (the `play` state's animation, the move that follows the
 * pointer). See resources/runtime/interactions.ts for what runs them.
 */
import type { Tree } from './style-model';

export interface HtmlAttribute {
	name: string;
	value: string;
}

export interface Interactions {
	/** Px the block leans toward the pointer, or null when it does not follow. */
	follow: number | null;
	/** Move the block itself with the pointer (else only `--bl-px/--bl-py` are set for children). */
	move: boolean;
	/** The animation the `play` state runs on every press, or null. */
	replay: { name: string; duration: string } | null;
	/** What a click turns on: the block, its card, or nothing. */
	toggle: 'self' | 'card' | null;
	/** A mode that stays on until switched again (Escape and outside clicks leave it alone). */
	keep: boolean;
	/** One option of a pair: always turns the state on, or off, instead of flipping it. */
	set: 'on' | 'off' | null;
}

export const NO_INTERACTIONS: Interactions = { follow: null, move: false, replay: null, toggle: null, keep: false, set: null };

const OURS = [ 'data-bl-do', 'data-bl-follow', 'data-bl-toggle', 'data-bl-keep', 'data-bl-set' ];
export const FOLLOW_MOVE = 'translate(var(--bl-px, 0px), var(--bl-py, 0px))';
const PLAY = 'play';
const PLAY_IDS = [ 'animation.name', 'animation.duration', 'animation.easing', 'animation.fillMode' ];

const valueOf = ( attrs: HtmlAttribute[], name: string ): string | undefined => attrs.find( ( a ) => a?.name === name )?.value;

export function readInteractions( htmlAttributes: unknown, tree: Tree ): Interactions {
	const attrs = Array.isArray( htmlAttributes ) ? ( htmlAttributes as HtmlAttribute[] ) : [];
	const does = new Set( ( valueOf( attrs, 'data-bl-do' ) ?? '' ).split( /\s+/ ).filter( Boolean ) );
	const name = tree?.[ 'animation.name' ]?.[ PLAY ]?.base;
	return {
		follow: does.has( 'follow' ) ? Number( valueOf( attrs, 'data-bl-follow' ) ) || 12 : null,
		move: tree?.[ 'effects.transform' ]?.default?.base === FOLLOW_MOVE,
		replay: does.has( 'replay' ) && typeof name === 'string' ? { name, duration: String( tree?.[ 'animation.duration' ]?.[ PLAY ]?.base ?? '600ms' ) } : null,
		toggle: does.has( 'toggle' ) ? ( valueOf( attrs, 'data-bl-toggle' ) === 'card' ? 'card' : 'self' ) : null,
		keep: does.has( 'toggle' ) && valueOf( attrs, 'data-bl-keep' ) !== undefined,
		set: does.has( 'toggle' ) && [ 'on', 'off' ].includes( valueOf( attrs, 'data-bl-set' ) ?? '' ) ? valueOf( attrs, 'data-bl-set' ) as 'on' | 'off' : null,
	};
}

/** The block's next `htmlAttributes` and `blicks` for these interactions; others' attributes are kept. */
export function writeInteractions( htmlAttributes: unknown, tree: Tree, next: Interactions ): { htmlAttributes: HtmlAttribute[]; blicks: Tree } {
	const attrs = ( Array.isArray( htmlAttributes ) ? ( htmlAttributes as HtmlAttribute[] ) : [] ).filter( ( a ) => ! OURS.includes( a?.name ) );
	const does = [ next.follow !== null && 'follow', next.replay && 'replay', next.toggle && 'toggle' ].filter( Boolean ) as string[];
	if ( does.length ) attrs.push( { name: 'data-bl-do', value: does.join( ' ' ) } );
	if ( next.follow !== null ) attrs.push( { name: 'data-bl-follow', value: String( next.follow ) } );
	if ( next.toggle === 'card' ) attrs.push( { name: 'data-bl-toggle', value: 'card' } );
	if ( next.toggle && next.keep ) attrs.push( { name: 'data-bl-keep', value: '' } );
	if ( next.toggle && next.set ) attrs.push( { name: 'data-bl-set', value: next.set } );

	const blicks: Tree = { ...tree };
	const slot = ( id: string, s: string, value: unknown ) => {
		const slots = { ...( blicks[ id ] ?? {} ) };
		if ( value === undefined ) delete slots[ s ];
		else slots[ s ] = { base: value };
		if ( Object.keys( slots ).length ) blicks[ id ] = slots;
		else delete blicks[ id ];
	};

	for ( const id of PLAY_IDS ) slot( id, PLAY, undefined );
	if ( next.replay ) {
		slot( 'animation.name', PLAY, next.replay.name );
		slot( 'animation.duration', PLAY, next.replay.duration );
		slot( 'animation.easing', PLAY, 'ease-out' );
		slot( 'animation.fillMode', PLAY, 'both' );
	}

	// Only ever remove the move this panel wrote, never a transform the author set in Style.
	const moving = tree?.[ 'effects.transform' ]?.default?.base === FOLLOW_MOVE;
	if ( next.follow !== null && next.move ) slot( 'effects.transform', 'default', FOLLOW_MOVE );
	else if ( moving ) slot( 'effects.transform', 'default', undefined );

	return { htmlAttributes: attrs, blicks };
}
