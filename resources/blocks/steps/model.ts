/**
 * The Steps block's attributes, cleaned for rendering. Kept apart from the panels so tests need no
 * editor. Like the List, everything is a class or a custom property on the `<ol>`; each Step reads
 * them through `style.scss`, plus its own state, which the Steps block keeps in step (see index.tsx).
 */

import { colourValue, iconClass } from '@/blocks/list/model';

export const LAYOUTS = [ 'across', 'down' ] as const;
export const MARKERS = [ 'numbers', 'icons', 'dots' ] as const;
export const NUMS = [ '1', '01' ] as const;
export const SHAPES = [ 'circle', 'square', 'plain' ] as const;
export const LINES = [ 'solid', 'dashed' ] as const;
export const GAPS = [ 'tight', '', 'roomy' ] as const;
export const STATES = [ '', 'done', 'cur', 'next' ] as const;
export type StepState = ( typeof STATES )[ number ];

const pick = < T extends string >( list: readonly T[], value: unknown, fallback: T ): T => {
	const v = String( value ?? '' );
	return ( list as readonly string[] ).includes( v ) ? ( v as T ) : fallback;
};

export const cleanLayout = ( v: unknown ) => pick( LAYOUTS, v, 'across' );
export const cleanMarker = ( v: unknown ) => pick( MARKERS, v, 'numbers' );
export const cleanShape = ( v: unknown ) => pick( SHAPES, v, 'circle' );
export const cleanStepState = ( v: unknown ) => pick( STATES, v, '' );
export const cleanCurrent = ( v: unknown ): number => Math.max( 0, Math.round( Number( v ) || 0 ) );

/** A step's state from its place: before the current step done, the current one, after it upcoming. */
export function stepState( index: number, current: number ): StepState {
	if ( ! current ) return '';
	if ( index + 1 < current ) return 'done';
	return index + 1 === current ? 'cur' : 'next';
}

export function stepsClasses( attributes: any ): string[] {
	const layout = cleanLayout( attributes.layout );
	const marker = cleanMarker( attributes.marker );
	const shape = cleanShape( attributes.markerShape );
	const gap = pick( GAPS, attributes.gap, '' );
	return [
		`bl-steps--${ layout }`,
		`bl-steps--${ marker }`,
		marker === 'numbers' && attributes.numbering === '01' ? 'bl-steps--n-01' : '',
		marker === 'icons' ? iconClass( attributes.icon || 'check' ) : '',
		shape !== 'circle' ? `bl-steps--${ shape }` : '',
		shape === 'plain' && marker === 'numbers' && attributes.outline ? 'bl-steps--outline' : '',
		attributes.join !== false ? 'bl-steps--join' : '',
		attributes.join !== false && attributes.line === 'dashed' ? 'bl-steps--dashed' : '',
		attributes.tickDone !== false ? 'bl-steps--tick' : '',
		cleanCurrent( attributes.current ) ? 'bl-steps--has-current' : '',
		attributes.labels && layout === 'down' ? 'bl-steps--labels' : '',
		gap ? `bl-steps--gap-${ gap }` : '',
	].filter( Boolean );
}

export function stepsVars( attributes: any ): Record< string, string > {
	const vars: Record< string, string > = {};
	const mc = colourValue( attributes.markerColour );
	if ( mc ) vars[ '--bl-st-mc' ] = mc;
	const size = Number( attributes.markerSize );
	if ( size && size !== 100 ) vars[ '--bl-st-ms' ] = String( Math.min( 3, Math.max( 0.5, size / 100 ) ) );
	const line = colourValue( attributes.lineColour );
	if ( line ) vars[ '--bl-st-line' ] = line;
	return vars;
}

export function stepClasses( attributes: any ): string[] {
	const state = cleanStepState( attributes.state );
	return [ state ? `bl-step--${ state }` : '', attributes.icon ? iconClass( attributes.icon ) : '' ].filter( Boolean );
}
