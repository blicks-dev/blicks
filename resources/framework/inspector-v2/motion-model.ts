/**
 * Entrances: a built-in keyframe driven by a `view()` timeline, so it plays as the block scrolls
 * into view (and once on load in a browser without scroll-driven animation).
 */
import type { Tree } from './style-model';

export type Entrance = 'none' | 'fade' | 'rise' | 'zoom';

const NAME: Record< Exclude< Entrance, 'none' >, string > = { fade: 'bl-fade-in', rise: 'bl-rise', zoom: 'bl-zoom-in' };

const IDS = [ 'animation.name', 'animation.duration', 'animation.easing', 'animation.fillMode', 'animation.timeline', 'animation.range' ];

export function withEntrance( tree: Tree, entrance: Entrance ): Tree {
	const next: Tree = { ...tree };
	for ( const id of IDS ) delete next[ id ];
	if ( entrance === 'none' ) return next;
	const values: Record< string, string > = {
		'animation.name': NAME[ entrance ],
		'animation.duration': '600ms',
		'animation.easing': 'ease-out',
		'animation.fillMode': 'both',
		'animation.timeline': 'view()',
		'animation.range': 'entry 0% cover 30%',
	};
	for ( const [ id, v ] of Object.entries( values ) ) next[ id ] = { default: { base: v } };
	return next;
}

export function readEntrance( tree: Tree ): Entrance {
	const name = tree?.[ 'animation.name' ]?.default?.base;
	return ( Object.entries( NAME ).find( ( [ , n ] ) => n === name )?.[ 0 ] as Entrance ) ?? 'none';
}

/**
 * What a moving block shows to someone who asked for less motion. Its animation stops either way
 * (the keyframes exist only under `prefers-reduced-motion: no-preference`); this is the still look
 * it rests in: as it normally looks, hidden, or a size and fade of its own — the engine's `reduced`
 * state, so it can differ from the moving look (a ping's halo resting soft and small).
 */
export type Calm = 'still' | 'hide' | 'custom';
export interface CalmLook {
	mode: Calm;
	/** Percent of its normal size. */
	size: number;
	/** Percent opacity. */
	opacity: number;
}

const REDUCED = 'reduced';

/** Does this block keep moving — an animation that is not one of the scroll entrances? */
export function loops( tree: Tree ): boolean {
	const names = Object.values( ( tree?.[ 'animation.name' ] ?? {} ) as Record< string, Record< string, unknown > > ).flatMap( ( byBp ) => Object.values( byBp ?? {} ) );
	return names.some( ( n ) => typeof n === 'string' && n !== '' && n !== 'none' && ! Object.values( NAME ).includes( n ) );
}

export function readCalm( tree: Tree ): CalmLook {
	const opacity = tree?.[ 'effects.opacity' ]?.[ REDUCED ]?.base;
	const transform = tree?.[ 'effects.transform' ]?.[ REDUCED ]?.base as { scale?: string } | undefined;
	if ( opacity === undefined && transform === undefined ) return { mode: 'still', size: 100, opacity: 100 };
	if ( String( opacity ) === '0' && transform === undefined ) return { mode: 'hide', size: 100, opacity: 0 };
	return {
		mode: 'custom',
		size: transform?.scale !== undefined ? Math.round( Number( transform.scale ) * 100 ) : 100,
		opacity: opacity !== undefined ? Math.round( Number( opacity ) * 100 ) : 100,
	};
}

export function withCalm( tree: Tree, calm: CalmLook ): Tree {
	const next: Tree = { ...tree };
	const put = ( id: string, value: unknown ) => {
		const slots = { ...( next[ id ] ?? {} ) };
		if ( value === undefined ) delete slots[ REDUCED ];
		else slots[ REDUCED ] = { base: value };
		if ( Object.keys( slots ).length ) next[ id ] = slots;
		else delete next[ id ];
	};
	const custom = calm.mode === 'custom';
	put( 'effects.opacity', calm.mode === 'hide' ? '0' : custom && calm.opacity !== 100 ? String( calm.opacity / 100 ) : undefined );
	put( 'effects.transform', custom && calm.size !== 100 ? { scale: String( calm.size / 100 ) } : undefined );
	return next;
}
