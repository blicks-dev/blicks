import type { BlicksApi, Panels } from '../blicks';

/**
 * A block's definition, given the free plugin's `defineBlock` and a `panels` helper that gives the
 * config its v2 panels, or nothing when the free plugin is too old to draw them.
 */
export type Define = ( defineBlock: BlicksApi[ 'blocks' ][ 'defineBlock' ], panels: ( p: Panels ) => { panels?: Panels } ) => void;
