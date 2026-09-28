import { createBlock } from '@wordpress/blocks';

/**
 * A new scene item, placed in the middle of its box.
 *
 * Shared because there are two ways to add one — the surface toolbar and the per-box inserter —
 * and they MUST agree. They did not: the toolbar called `createBlock` bare, so an item added that
 * way had no coordinates at all and rendered at the box's top-left corner with no anchor offset,
 * while the same button in the box inserter produced a centred one.
 *
 * Centre rather than a corner because an item has to be findable and draggable the instant it
 * appears; something pinned at 0,0 under the box's own outline is neither.
 */
export function createCentredItem( name: string, attributes: Record< string, unknown > = {} ) {
	return createBlock( name, {
		...attributes,
		blicks: {
			'sceneChild.x': { default: { base: '50%' } },
			'sceneChild.y': { default: { base: '50%' } },
			'sceneChild.anchor': { default: { base: 'center' } },
		},
	} );
}
