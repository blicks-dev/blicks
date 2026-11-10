import { createBlocksFromInnerBlocksTemplate } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/nav/block.json';
import { kit, type PanelProps } from '../blicks';
import { OnPhonesSec, StyleDoor } from '../controls';
import type { Define } from './types';

function Settings( props: PanelProps ) {
	const { Sec, Field, Sub, Note, Icon } = kit();
	const { attributes: a, setAttributes, clientId } = props;
	const { insertBlocks } = useDispatch( 'core/block-editor' ) as any;
	const count = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlockCount( clientId ) : 0 ), [ clientId ] ) as number;
	return (
		<>
			{ clientId && (
				<Sec>
					<button type="button" className="btn-add" onClick={ () => insertBlocks( createBlocksFromInnerBlocksTemplate( [ [ 'blicks/nav-item', {} ] ] as never ), count, clientId, true ) }>
						<Icon d="M12 5v14M5 12h14" size={ 16 } />
						{ __( 'Add a menu item', 'blicks-pro' ) }
					</button>
				</Sec>
			) }
			<Sec title={ __( 'Names', 'blicks-pro' ) }>
				<Sub>{ __( 'Name for screen readers', 'blicks-pro' ) }</Sub>
				<Field label={ __( 'Name for screen readers', 'blicks-pro' ) } value={ String( a.label ?? '' ) } placeholder={ __( 'Main', 'blicks-pro' ) } onChange={ ( label ) => setAttributes( { label } ) } />
				<Note>{ __( 'Read out as “Main navigation”.', 'blicks-pro' ) }</Note>
				<Sub>{ __( 'Drawer button', 'blicks-pro' ) }</Sub>
				<Field label={ __( 'Drawer button', 'blicks-pro' ) } value={ String( a.menuLabel ?? '' ) } placeholder={ __( 'Menu', 'blicks-pro' ) } onChange={ ( menuLabel ) => setAttributes( { menuLabel } ) } />
				<Note>{ __( 'The name of the button that opens the menu on phones.', 'blicks-pro' ) }</Note>
				<Sub>{ __( 'Close button', 'blicks-pro' ) }</Sub>
				<Field label={ __( 'Close button', 'blicks-pro' ) } value={ String( a.closeLabel ?? '' ) } placeholder={ __( 'Close', 'blicks-pro' ) } onChange={ ( closeLabel ) => setAttributes( { closeLabel } ) } />
			</Sec>
			<OnPhonesSec { ...props } />
		</>
	);
}

/**
 * The header's menu: `<nav aria-label><ul>` with one Menu item per `<li>`. The phone drawer is not
 * saved: the module writes its button and a `blicks/dialog` drawer around the list when the page
 * renders (BlicksPro\HeaderStudio\Render), so the same list is the bar on wide screens and the
 * drawer on narrow ones.
 */
export const nav: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings, Style: StyleDoor, describe: ( a ) => String( a.label || __( 'Main', 'blicks-pro' ) ) } ),
		innerBlocks: {
			allowedBlocks: [ 'blicks/nav-item' ],
			templateLock: false,
			orientation: 'horizontal',
			wrapperClassName: 'bl-nav__list',
			// An "Add menu item" slot in the bar would push its neighbours along whenever the menu is
			// selected; items are added from the Settings tab, the Studio's panels or the inserter.
			renderAppender: false,
			template: [
				[ 'blicks/nav-item', { label: __( 'Products', 'blicks-pro' ) } ],
				[ 'blicks/nav-item', { label: __( 'Pricing', 'blicks-pro' ) } ],
				[ 'blicks/nav-item', { label: __( 'About', 'blicks-pro' ) } ],
			],
		},
		render( { attributes, blockProps, innerBlocksProps }: any ) {
			return (
				<nav { ...blockProps } aria-label={ attributes.label || 'Main' }>
					<ul { ...innerBlocksProps } />
				</nav>
			);
		},
	} );
