import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/header/block.json';
import { kit, type Option, type PanelProps } from '../blicks';
import { StyleDoor } from '../controls';
import { headerClasses } from '../model';
import { headerTemplate } from '../studio/presets';
import type { Define } from './types';

const DRAWER_OPTS: Option[] = [
	[ 'tablet', __( 'Tablets and phones', 'blicks-pro' ) ],
	[ 'mobile', __( 'Phones only', 'blicks-pro' ) ],
	[ 'always', __( 'Every screen', 'blicks-pro' ) ],
	[ 'never', __( 'Never', 'blicks-pro' ) ],
];

const MOBILE_OPTS: Option< 'drill' | 'accordion' >[] = [
	[ 'drill', __( 'Next screen', 'blicks-pro' ) ],
	[ 'accordion', __( 'Expand in place', 'blicks-pro' ) ],
];

function Settings( { attributes: a, setAttributes }: PanelProps ) {
	const { Sec, Switch, Select, SegText, Sub, Note } = kit();
	return (
		<>
			<Sec title={ __( 'On scroll', 'blicks-pro' ) }>
				<Switch label={ __( 'Stays at the top', 'blicks-pro' ) } checked={ !! a.sticky } onChange={ ( sticky ) => setAttributes( sticky ? { sticky } : { sticky, hideOnScroll: false } ) } />
				<Switch label={ __( 'Shrinks after scrolling', 'blicks-pro' ) } checked={ !! a.shrink } onChange={ ( shrink ) => setAttributes( { shrink } ) } />
				<Switch
					label={ __( 'Clear over the first section', 'blicks-pro' ) }
					hint={ __( 'No background until the page scrolls', 'blicks-pro' ) }
					checked={ !! a.overHero }
					onChange={ ( overHero ) => setAttributes( { overHero } ) }
				/>
				<Switch
					label={ __( 'Hides while scrolling down', 'blicks-pro' ) }
					hint={ __( 'Comes back as soon as the page scrolls up', 'blicks-pro' ) }
					checked={ !! a.hideOnScroll }
					onChange={ ( hideOnScroll ) => setAttributes( hideOnScroll ? { hideOnScroll, sticky: true } : { hideOnScroll } ) }
				/>
			</Sec>
			<Sec title={ __( 'Phones and tablets', 'blicks-pro' ) }>
				<Sub>{ __( 'Menu in a drawer on', 'blicks-pro' ) }</Sub>
				<Select label={ __( 'Menu in a drawer on', 'blicks-pro' ) } value={ String( a.drawerAt ?? 'tablet' ) } options={ DRAWER_OPTS } onChange={ ( drawerAt ) => setAttributes( { drawerAt } ) } />
				<Sub>{ __( 'Mega menus open as', 'blicks-pro' ) }</Sub>
				<SegText options={ MOBILE_OPTS } value={ a.mobile === 'accordion' ? 'accordion' : 'drill' } onChange={ ( mobile ) => setAttributes( { mobile } ) } />
				<Note>{ __( 'Tablets and phones follows the design system’s tablet breakpoint.', 'blicks-pro' ) }</Note>
			</Sec>
		</>
	);
}

/** The site header: the `<header>` landmark, holding rows. */
export const header: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings, Style: StyleDoor, describe: () => __( 'Site header', 'blicks-pro' ) } ),
		innerBlocks: {
			allowedBlocks: [ 'blicks/header-row' ],
			templateLock: false,
			// Rows come from the Header tab's Top bar or the inserter, not a slot under the bar.
			renderAppender: false,
			// The Classic starter with nothing made up: the site title, a menu item and a button to fill in.
			template: ( headerTemplate( 'classic' )[ 2 ] ?? [] ) as never,
		},
		render( { attributes, blockProps, children }: any ) {
			const className = [ blockProps.className, ...headerClasses( attributes ) ].join( ' ' );
			return (
				<header { ...blockProps } className={ className }>
					{ children }
				</header>
			);
		},
	} );
