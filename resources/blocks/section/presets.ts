import { applyArrange, arrangeDefaults, type ArrangeOptions, type Tree } from '@/blocks/box/model';

/**
 * The style tree for a Box that stacks its blocks one under another, written the way Box's own
 * "Stacked" arrangement writes it — so the Box inspector reads it back as Stacked, not as custom values.
 */
export function stackedBox( patch: Partial< ArrangeOptions > = {} ): Tree {
	return applyArrange( {}, 'stack', { ...arrangeDefaults( 'stack' ), ...patch } ).tree;
}

/** "Heading + copy": stacked, every block as wide as the content. */
export const copyStack = (): Tree => stackedBox( { stretch: 'yes' } );

/** "Centered hero": stacked, every block in the middle. */
export const heroStack = (): Tree => stackedBox( { x: 'center', y: 'center' } );
