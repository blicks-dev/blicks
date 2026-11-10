import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/mega-panel/block.json';
import { kit, type Option, type PanelProps } from '../blicks';
import { StyleDoor } from '../controls';
import { panelClasses, pick, OPENS_ON } from '../model';
import { panelInner } from '../studio/presets';
import type { Define } from './types';

/** What a mega menu may hold: no page bands, no Scene, no nested panels. */
export const PANEL_BLOCKS = [
	'blicks/box',
	'blicks/heading',
	'blicks/text',
	'blicks/image',
	'blicks/button',
	'blicks/buttons',
	'blicks/loop',
	'blicks/menu-link',
	'blicks/link-list',
];

const OPEN_OPTS: Option< 'hover' | 'click' >[] = [
	[ 'hover', __( 'Hover or click', 'blicks-pro' ) ],
	[ 'click', __( 'Click only', 'blicks-pro' ) ],
];
const WIDTH_OPTS: Option< 'container' | 'full' | 'content' >[] = [
	[ 'container', __( 'Content', 'blicks-pro' ) ],
	[ 'full', __( 'Full', 'blicks-pro' ) ],
	[ 'content', __( 'Fit', 'blicks-pro' ) ],
];
const WIDTH_HELP: Record< string, string > = {
	container: __( 'As wide as the page’s content.', 'blicks-pro' ),
	full: __( 'The full width of the screen.', 'blicks-pro' ),
	content: __( 'As wide as what is in it, under its menu item.', 'blicks-pro' ),
};
const ANIMATION_OPTS: Option[] = [
	[ 'fade', __( 'Fade', 'blicks-pro' ) ],
	[ 'slide', __( 'Slide down', 'blicks-pro' ) ],
	[ 'none', __( 'None', 'blicks-pro' ) ],
];

function Settings( { attributes: a, setAttributes }: PanelProps ) {
	const { Sec, SegText, Slider, Select, Switch, Sub, Note } = kit();
	const openOn = pick( OPENS_ON, a.openOn ) as 'hover' | 'click';
	const width = ( WIDTH_OPTS.some( ( [ v ] ) => v === a.width ) ? a.width : 'container' ) as 'container';
	return (
		<>
			<Sec title={ __( 'Opening', 'blicks-pro' ) }>
				<Sub>{ __( 'Opens on', 'blicks-pro' ) }</Sub>
				<SegText options={ OPEN_OPTS } value={ openOn } onChange={ ( v ) => setAttributes( { openOn: v } ) } />
				<Note>{ __( 'A keyboard or a tap always opens it with the menu item’s button.', 'blicks-pro' ) }</Note>
				{ openOn === 'hover' && (
					<>
						<Slider label={ __( 'Delay', 'blicks-pro' ) } min={ 0 } max={ 1000 } step={ 50 } unit="ms" value={ Number( a.delay ?? 150 ) } onChange={ ( delay ) => setAttributes( { delay } ) } />
						<Note>{ __( 'Stops the panel flashing open as the pointer crosses the menu.', 'blicks-pro' ) }</Note>
					</>
				) }
				<Sub>{ __( 'Animation', 'blicks-pro' ) }</Sub>
				<Select label={ __( 'Animation', 'blicks-pro' ) } value={ String( a.animation ?? 'fade' ) } options={ ANIMATION_OPTS } onChange={ ( animation ) => setAttributes( { animation } ) } />
				<Switch label={ __( 'Close when the page scrolls', 'blicks-pro' ) } checked={ !! a.closeOnScroll } onChange={ ( closeOnScroll ) => setAttributes( { closeOnScroll } ) } />
			</Sec>
			<Sec title={ __( 'Size', 'blicks-pro' ) }>
				<SegText options={ WIDTH_OPTS } value={ width } onChange={ ( w ) => setAttributes( { width: w } ) } />
				<Note>{ WIDTH_HELP[ width ] }</Note>
			</Sec>
		</>
	);
}

/** The panel a menu item opens: ordinary Blicks blocks, laid out with the usual controls. */
export const megaPanel: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings, Style: StyleDoor, describe: () => __( 'Mega menu', 'blicks-pro' ) } ),
		innerBlocks: {
			allowedBlocks: PANEL_BLOCKS,
			templateLock: false,
			// Added from the Studio's panels or the inserter: an appender in the panel would move its
			// columns whenever it is selected.
			renderAppender: false,
			// A heading to write over a Link list to fill: nothing made up. The Studio and the menu item's
			// Add a mega menu start it from the site's pages instead.
			template: panelInner( 'list' ) as never,
		},
		render( { attributes, blockProps, children }: any ) {
			return (
				<div { ...blockProps } className={ [ blockProps.className, ...panelClasses( attributes ) ].join( ' ' ) }>
					{ children }
				</div>
			);
		},
	} );
