import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { createBlocksFromInnerBlocksTemplate } from '@wordpress/blocks';
import { useRegistry, useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/nav-item/block.json';
import { kit, type PanelProps } from '../blicks';
import { OnPhonesSec, StyleDoor } from '../controls';
import { itemLink } from '../model';
import { megaPanel } from '../studio/presets';
import type { Define } from './types';

/** The site's top-level pages' ids, for a new mega menu's Link lists. */
export function usePageIds(): number[] {
	return useSelect(
		( select: any ) =>
			( ( select( 'core' ).getEntityRecords( 'postType', 'page', { per_page: 20, status: 'publish', parent: 0, orderby: 'menu_order', order: 'asc' } ) ?? [] ) as { id: number }[] ).map( ( p ) => p.id ),
		[]
	);
}

/**
 * Add or remove a menu item's mega menu, and its `hasPanel`, as ONE change.
 *
 * Batched, so the editor's listeners see a single change: the Studio's history records one step,
 * and Undo goes straight back to the item as it was. Written apart, the panel and the flag were
 * two steps, and undoing the second left a panel with the flag off, which `useHasPanel` then
 * put back on: Undo did nothing at all.
 */
export function useMegaPanel( clientId: string | undefined ): { add: () => void; remove: () => void } {
	const registry = useRegistry() as any;
	const pages = usePageIds();
	const run = ( change: ( d: any, ids: string[] ) => void ) => {
		if ( ! clientId ) return;
		const ids = registry.select( 'core/block-editor' ).getBlockOrder( clientId ) as string[];
		const d = registry.dispatch( 'core/block-editor' );
		registry.batch( () => change( d, ids ) );
	};
	return {
		add: () =>
			run( ( d ) => {
				d.insertBlocks( createBlocksFromInnerBlocksTemplate( [ megaPanel( 'columns', pages ) ] as never ), 0, clientId, false );
				d.updateBlockAttributes( clientId, { hasPanel: true } );
			} ),
		remove: () =>
			run( ( d, ids ) => {
				d.removeBlocks( ids, false );
				d.updateBlockAttributes( clientId, { hasPanel: false } );
			} ),
	};
}

const plain = ( html: unknown ): string => String( html ?? '' ).replace( /<[^>]*>/g, '' );

function Settings( props: PanelProps ) {
	const { Sec, Field, Switch, Sub, Note, Icon } = kit();
	const { attributes: a, setAttributes, clientId } = props;
	const hasPanel = !! a.hasPanel;
	const mega = useMegaPanel( clientId );
	return (
		<>
			<Sec title={ __( 'Menu item', 'blicks-pro' ) }>
				<Sub>{ __( 'Label', 'blicks-pro' ) }</Sub>
				<Field label={ __( 'Label', 'blicks-pro' ) } value={ plain( a.label ) } onChange={ ( label ) => setAttributes( { label } ) } />
				{ hasPanel ? (
					<Note>{ __( 'Opens its mega menu. Remove the mega menu to make it a link again.', 'blicks-pro' ) }</Note>
				) : (
					<>
						<Sub>{ __( 'Goes to', 'blicks-pro' ) }</Sub>
						<Field icon="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" label={ __( 'Goes to', 'blicks-pro' ) } placeholder={ __( '/page or https://…', 'blicks-pro' ) } value={ String( a.url ?? '' ) } onChange={ ( url ) => setAttributes( { url: url.trim() } ) } />
						<Switch label={ __( 'Opens in a new tab', 'blicks-pro' ) } checked={ a.linkTarget === '_blank' } onChange={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '' } ) } />
					</>
				) }
			</Sec>
			{ clientId && (
				<Sec title={ __( 'Mega menu', 'blicks-pro' ) }>
					{ hasPanel ? (
						<button type="button" className="btn-add" onClick={ mega.remove }>
							<Icon d="M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" size={ 16 } />
							{ __( 'Remove the mega menu', 'blicks-pro' ) }
						</button>
					) : (
						<button type="button" className="btn-add" onClick={ mega.add }>
							<Icon d="M12 5v14M5 12h14" size={ 16 } />
							{ __( 'Add a mega menu', 'blicks-pro' ) }
						</button>
					) }
				</Sec>
			) }
			<OnPhonesSec { ...props } />
		</>
	);
}

/** Add or remove the item's mega menu. */
function Toolbar( { attributes, clientId }: PanelProps ) {
	const mega = useMegaPanel( clientId );
	if ( ! clientId ) return null;
	return (
		<ToolbarGroup>
			{ attributes.hasPanel ? (
				<ToolbarButton onClick={ mega.remove }>{ __( 'Remove mega menu', 'blicks-pro' ) }</ToolbarButton>
			) : (
				<ToolbarButton onClick={ mega.add }>{ __( 'Add mega menu', 'blicks-pro' ) }</ToolbarButton>
			) }
		</ToolbarGroup>
	);
}

/** Keeps `hasPanel`, which decides the saved element, in step with whether a mega menu is inside. */
function useHasPanel( { attributes, setAttributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) {
	const count = useSelect( ( select: any ) => select( 'core/block-editor' ).getBlockCount( clientId ), [ clientId ] ) as number;
	// A safety net for a panel added or removed some other way (the inserter, Delete); the item's
	// own controls change both at once (`useMegaPanel`).
	useEffect( () => {
		if ( !! attributes.hasPanel !== count > 0 ) setAttributes( { hasPanel: count > 0 } );
	}, [ count, attributes.hasPanel, setAttributes ] );
}

/**
 * One menu item: a link, or, with a mega menu inside, a disclosure button for it. The button saves
 * `aria-expanded="false"`; its `aria-controls`, the panel's id and the behaviour's directives are
 * written when the page renders (BlicksPro\HeaderStudio\Render).
 *
 *   <li class="bl-nav-item …"><a class="bl-nav-item__link" href="/pricing">Pricing</a></li>
 *   <li class="bl-nav-item … has-panel"><button class="bl-nav-item__toggle" type="button" aria-expanded="false">Products</button>…mega menu…</li>
 */
export const navItem: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings, Style: StyleDoor, describe: ( a ) => plain( a.label ) || __( 'Menu item', 'blicks-pro' ) } ),
		Toolbar,
		useEdit: useHasPanel,
		innerBlocks: { allowedBlocks: [ 'blicks/mega-panel' ], renderAppender: false, templateLock: false },
		render( { attributes, blockProps, children, richText, isEdit }: any ) {
			const hasPanel = !! attributes.hasPanel;
			const label = hasPanel
				? richText( {
						attr: 'label',
						tagName: isEdit ? 'span' : 'button',
						className: 'bl-nav-item__toggle',
						...( isEdit ? {} : { type: 'button', 'aria-expanded': 'false' } ),
						placeholder: __( 'Menu item', 'blicks-pro' ),
						allowedFormats: [],
				  } )
				: richText( {
						attr: 'label',
						tagName: isEdit ? 'span' : 'a',
						className: 'bl-nav-item__link',
						...( isEdit ? {} : itemLink( attributes ) ),
						placeholder: __( 'Menu item', 'blicks-pro' ),
						allowedFormats: [],
				  } );

			return (
				<li { ...blockProps } className={ [ blockProps.className, hasPanel ? 'has-panel' : '' ].filter( Boolean ).join( ' ' ) }>
					{ label }
					{ children }
				</li>
			);
		},
	} );
