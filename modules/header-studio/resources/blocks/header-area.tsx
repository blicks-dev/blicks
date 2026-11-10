import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/header-area/block.json';
import { OnPhonesSec, StyleDoor } from '../controls';
import { areaClasses } from '../model';
import type { Define } from './types';

/** What a header area may hold: the bar's elements, never page bands or another header's parts. */
export const AREA_BLOCKS = [
	'blicks/nav',
	'blicks/image',
	'blicks/icon',
	'blicks/button',
	'blicks/buttons',
	'blicks/text',
	'blicks/heading',
	'blicks/box',
	'blicks/menu-link',
	'core/site-logo',
	'core/site-title',
	'core/search',
];

const SLOT_NAMES: Record< string, string > = {
	start: __( 'Start of the row', 'blicks-pro' ),
	centre: __( 'Center of the row', 'blicks-pro' ),
	end: __( 'End of the row', 'blicks-pro' ),
};

/** The start, centre or end of a row. Its slot is fixed by the row; what it holds is free. */
export const headerArea: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings: OnPhonesSec, Style: StyleDoor, describe: ( a ) => SLOT_NAMES[ String( a.slot ) ] ?? SLOT_NAMES.start } ),
		// The row locks its three areas in place; what an area holds is free, so it says so rather than
		// inheriting the row's lock. No appender: selecting an area must not change the bar's layout,
		// so blocks are added from the Studio's panels or the inserter, never from a slot in the row.
		innerBlocks: { allowedBlocks: AREA_BLOCKS, orientation: 'horizontal', templateLock: false, renderAppender: false },
		render( { attributes, blockProps, children }: any ) {
			return (
				<div { ...blockProps } className={ [ blockProps.className, ...areaClasses( attributes ) ].join( ' ' ) }>
					{ children }
				</div>
			);
		},
	} );
