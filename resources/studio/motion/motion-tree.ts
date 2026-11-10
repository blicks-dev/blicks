/**
 * A block's animation, as the Motion tab sees it, against the `animation.*` controls it is stored in.
 *
 * Every value here is an existing engine control on the element's base slot — nothing new is saved,
 * so a tree the Studio animates renders on any site running this engine, with or without the Studio.
 *
 * **"On hover" is a play state, not a hover animation.** The engine emits `animation-name` with no
 * state rules (it is a `custom` runtime control), so a name set on `:hover` would do nothing. What
 * does have state rules is `animation.playState`: the animation is attached always, paused at rest,
 * and running while pointed at. Moving the pointer away pauses it where it is rather than rewinding,
 * which reads as the motion "waiting" — and needs no engine change.
 */

export type Plays = 'always' | 'view' | 'hover';

export interface Motion {
	/** The `animation-name`: a built-in (`bl-float`) or a custom one (`bl-anim-<slug>`). */
	name: string;
	plays: Plays;
	/** Milliseconds. */
	duration: number;
	/** Milliseconds. */
	delay: number;
	loop: boolean;
	easing: string;
}

type Slots = Record< string, Record< string, unknown > >;
type Tree = Record< string, Slots >;

/** Every control this writes, so changing the animation never leaves a stale one behind. */
const IDS = [
	'animation.name',
	'animation.duration',
	'animation.easing',
	'animation.iteration',
	'animation.direction',
	'animation.fillMode',
	'animation.delay',
	'animation.playState',
	'animation.timeline',
	'animation.range',
] as const;

/** The range an entrance plays over: from the block's top edge entering to a third of the way in. */
export const VIEW_RANGE = 'entry 0% cover 30%';

const base = ( tree: Tree, id: string, slot = 'default' ): string => {
	const v = tree[ id ]?.[ slot ]?.base;

	return typeof v === 'string' ? v : '';
};

/** `600ms` / `0.6s` → 600. Anything else → `fallback`. */
export function toMs( value: string, fallback: number ): number {
	const m = /^(\d+(?:\.\d+)?)(ms|s)$/.exec( value.trim() );

	return m ? Math.round( Number( m[ 1 ] ) * ( m[ 2 ] === 's' ? 1000 : 1 ) ) : fallback;
}

/** The animation on a block's base slot, or null when it has none. */
export function readMotion( tree: Tree | null | undefined ): Motion | null {
	const t = tree ?? {};
	const name = base( t, 'animation.name' );

	if ( name === '' || name === 'none' ) {
		return null;
	}

	const plays: Plays = base( t, 'animation.timeline' ).startsWith( 'view' )
		? 'view'
		: base( t, 'animation.playState' ) === 'paused' && base( t, 'animation.playState', 'hover' ) === 'running'
			? 'hover'
			: 'always';

	return {
		name,
		plays,
		duration: toMs( base( t, 'animation.duration' ), 600 ),
		delay: toMs( base( t, 'animation.delay' ), 0 ),
		loop: base( t, 'animation.iteration' ) === 'infinite',
		easing: base( t, 'animation.easing' ) || 'ease',
	};
}

/** The tree with this animation — or none — on its base slot. The input is not touched. */
export function writeMotion( tree: Tree | null | undefined, motion: Motion | null ): Tree {
	const next: Tree = { ...( tree ?? {} ) };

	for ( const id of IDS ) {
		delete next[ id ];
	}

	if ( ! motion || motion.name === '' ) {
		return next;
	}

	const set = ( id: string, value: string, slot = 'default' ): void => {
		next[ id ] = { ...( next[ id ] ?? {} ), [ slot ]: { base: value } };
	};

	set( 'animation.name', motion.name );
	set( 'animation.duration', `${ Math.max( 0, Math.round( motion.duration ) ) }ms` );
	set( 'animation.easing', motion.easing || 'ease' );
	set( 'animation.fillMode', 'both' );

	if ( motion.delay > 0 ) {
		set( 'animation.delay', `${ Math.round( motion.delay ) }ms` );
	}

	// Scrolling into view plays it once, along the scroll; looping a scroll-driven animation means
	// nothing, so the switch is ignored there rather than written and contradicted.
	if ( motion.plays === 'view' ) {
		set( 'animation.timeline', 'view()' );
		set( 'animation.range', VIEW_RANGE );
		return next;
	}

	set( 'animation.iteration', motion.loop ? 'infinite' : '1' );

	if ( motion.plays === 'hover' ) {
		set( 'animation.playState', 'paused' );
		set( 'animation.playState', 'running', 'hover' );
	}

	return next;
}

/**
 * What a block's `supports.blicks` lets this panel write: an animation at all (the allow-list names
 * the controls, exactly or by a `section.*` wildcard), and "On hover" (the block also has a hover
 * state, since that is the slot the play state is written to).
 */
export function animationSupport( blicks: unknown ): { animate: boolean; hover: boolean } {
	const support = ( blicks ?? {} ) as { controls?: unknown; states?: unknown };
	const controls = Array.isArray( support.controls ) ? support.controls.map( String ) : [];
	const allowed = new Set( controls );
	const covers = ( id: string ): boolean => allowed.has( id ) || allowed.has( `${ id.split( '.' )[ 0 ] }.*` );
	const animate = [ 'animation.name', 'animation.duration', 'animation.playState' ].every( covers );
	const states = Array.isArray( support.states ) ? support.states.map( String ) : [];

	return { animate, hover: animate && states.includes( 'hover' ) };
}
