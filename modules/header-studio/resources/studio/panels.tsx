/**
 * The header mode's rail tabs (the prototype's right rail):
 *
 *  - **Header**: layout, top bar, row height, on scroll, phones and tablets.
 *  - **Selected**: what the selected block is in the header's words: a menu item (label, link, its
 *    mega menu), a mega menu (Edit panel, opening, size, start over, fill from a WordPress menu), a
 *    row, or any element, each with its On phones setting.
 *
 * Every change is an ordinary block edit in the mounted tree, so Undo covers it. Styling stays in
 * the Studio's own design tab.
 */
import { Button, RangeControl, SelectControl, TextControl, ToggleControl } from '@wordpress/components';
import { createBlocksFromInnerBlocksTemplate } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { blicks } from '../blicks';
import { OnPhonesControl } from '../controls';
import { gridBox, panelInner, PANEL_LAYOUTS, stackBox, topBarTemplate, type PanelLayout, type Template } from './presets';
import { studio, type Block, type PanelProps } from './host';
import { rowLabel } from './tree';
import { AddInto, AddToRow, isContainer } from './add';
import { useMegaPanel, usePageIds } from '../blocks/nav-item';

type Attrs = Record< string, any >;

interface Editor {
	attributes: ( id: string ) => Attrs;
	set: ( id: string, a: Attrs ) => void;
	insert: ( template: Template[], index: number, root: string ) => void;
	replace: ( root: string, template: Template[] ) => void;
	remove: ( ids: string[] ) => void;
}

function useEditor(): Editor {
	const select = useSelect( ( s: any ) => s( 'core/block-editor' ), [] );
	const d = useDispatch( 'core/block-editor' ) as any;
	const make = ( t: Template[] ) => createBlocksFromInnerBlocksTemplate( t as never );
	return {
		attributes: ( id ) => ( id ? select.getBlockAttributes( id ) ?? {} : {} ),
		set: ( id, a ) => d.updateBlockAttributes( id, a ),
		insert: ( t, index, root ) => d.insertBlocks( make( t ), index, root, false ),
		replace: ( root, t ) => d.replaceInnerBlocks( root, make( t ), false ),
		remove: ( ids ) => d.removeBlocks( ids, false ),
	};
}

/** The block, read live, so a panel re-renders when it changes. */
function useBlock( clientId: string ): Block | null {
	return useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlock( clientId ) : null ), [ clientId ] );
}

function Sec( { title, children }: { title: string; children: React.ReactNode } ): JSX.Element {
	return (
		<section className="bl-hs-panel__sec">
			<h3>{ title }</h3>
			{ children }
		</section>
	);
}

const Note = ( { children }: { children: React.ReactNode } ): JSX.Element => <p className="bl-hs-panel__note">{ children }</p>;

function Seg< T extends string >( { label, value, options, onChange }: { label: string; value: T; options: [ T, string ][]; onChange: ( v: T ) => void } ): JSX.Element {
	return (
		<div className="bl-hs-seg" role="radiogroup" aria-label={ label }>
			{ options.map( ( [ v, text ] ) => (
				<button key={ v } type="button" role="radio" aria-checked={ v === value } className={ v === value ? 'is-on' : '' } onClick={ () => onChange( v ) }>
					{ text }
				</button>
			) ) }
		</div>
	);
}

const Toggle = ( { label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: ( v: boolean ) => void } ): JSX.Element => (
	<ToggleControl __nextHasNoMarginBottom label={ label } help={ help } checked={ checked } onChange={ onChange } />
);

const plain = ( html: unknown ): string => String( html ?? '' ).replace( /<[^>]*>/g, '' );

/* ------------------------------------------------------------------ Header */

export function HeaderPanel( { blocks, applyBurst, selection }: PanelProps ): JSX.Element | null {
	const root = blocks[ 0 ];
	const header = useBlock( root?.name === 'blicks/header' ? String( root.clientId ?? '' ) : '' );
	const ed = useEditor();

	if ( ! header?.clientId ) return <Note>{ __( 'This tree has no Header block.', 'blicks-pro' ) }</Note>;

	const a = header.attributes ?? {};
	const rows = ( header.innerBlocks ?? [] ).filter( ( b ) => b.name === 'blicks/header-row' );
	const main = rows[ rows.length - 1 ];
	const mainAttrs = main?.attributes ?? {};
	const hasTopBar = rows.length > 1;
	const set = ( next: Attrs ) => ed.set( String( header.clientId ), next );
	const height = Number.parseInt( String( blicks()?.values.getValue( mainAttrs, 'layout.minHeight', 'default', 'base' ) ?? '' ), 10 );

	return (
		<div className="bl-hs-panel">
			<Sec title={ __( 'Layout', 'blicks-pro' ) }>
				<Seg
					label={ __( 'Layout', 'blicks-pro' ) }
					value={ String( mainAttrs.preset ?? 'classic' ) as 'classic' }
					options={ [
						[ 'classic', __( 'Classic', 'blicks-pro' ) ],
						[ 'centred', __( 'Centered', 'blicks-pro' ) ],
						[ 'stacked', __( 'Stacked', 'blicks-pro' ) ],
					] }
					onChange={ ( preset ) => main?.clientId && ed.set( main.clientId, { preset } ) }
				/>
				<Toggle
					label={ __( 'Top bar', 'blicks-pro' ) }
					help={ __( 'A thin row above the main one, for news or contact links.', 'blicks-pro' ) }
					checked={ hasTopBar }
					onChange={ ( on ) =>
						applyBurst( () => {
							if ( on ) ed.insert( [ topBarTemplate() ], 0, String( header.clientId ) );
							else if ( rows[ 0 ]?.clientId ) ed.remove( [ rows[ 0 ].clientId ] );
						} )
					}
				/>
				{ main && (
					<RangeControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Main row height (px)', 'blicks-pro' ) }
						min={ 40 }
						max={ 160 }
						allowReset
						value={ Number.isFinite( height ) ? height : undefined }
						onChange={ ( v?: number ) => main.clientId && blicks()?.values.setValue( mainAttrs, ( next ) => ed.set( String( main.clientId ), next ), 'layout.minHeight', 'default', 'base', v ? `${ v }px` : '' ) }
					/>
				) }
			</Sec>
			<Sec title={ __( 'Add to a row', 'blicks-pro' ) }>
				<AddToRow header={ header } selected={ selection?.clientId ?? '' } rowName={ rowLabel } />
			</Sec>
			<Sec title={ __( 'On scroll', 'blicks-pro' ) }>
				<Toggle label={ __( 'Stays at the top', 'blicks-pro' ) } checked={ !! a.sticky } onChange={ ( sticky ) => set( sticky ? { sticky } : { sticky, hideOnScroll: false } ) } />
				<Toggle label={ __( 'Shrinks after scrolling', 'blicks-pro' ) } checked={ !! a.shrink } onChange={ ( shrink ) => set( { shrink } ) } />
				<Toggle
					label={ __( 'Clear over the first section', 'blicks-pro' ) }
					help={ __( 'No background until the page scrolls.', 'blicks-pro' ) }
					checked={ !! a.overHero }
					onChange={ ( overHero ) => set( { overHero } ) }
				/>
				<Toggle
					label={ __( 'Hides while scrolling down', 'blicks-pro' ) }
					help={ __( 'Comes back as soon as the page scrolls up.', 'blicks-pro' ) }
					checked={ !! a.hideOnScroll }
					onChange={ ( hideOnScroll ) => set( hideOnScroll ? { hideOnScroll, sticky: true } : { hideOnScroll } ) }
				/>
			</Sec>
			<Sec title={ __( 'Phones and tablets', 'blicks-pro' ) }>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Menu in a drawer on', 'blicks-pro' ) }
					value={ String( a.drawerAt ?? 'tablet' ) as 'tablet' }
					options={ [
						{ value: 'tablet', label: __( 'Tablets and phones', 'blicks-pro' ) },
						{ value: 'mobile', label: __( 'Phones only', 'blicks-pro' ) },
						{ value: 'always', label: __( 'Every screen', 'blicks-pro' ) },
						{ value: 'never', label: __( 'Never', 'blicks-pro' ) },
					] }
					onChange={ ( drawerAt: string ) => set( { drawerAt } ) }
				/>
				<Seg
					label={ __( 'Mega menus open as', 'blicks-pro' ) }
					value={ String( a.mobile ?? 'drill' ) as 'drill' }
					options={ [
						[ 'drill', __( 'Next screen', 'blicks-pro' ) ],
						[ 'accordion', __( 'Expand in place', 'blicks-pro' ) ],
					] }
					onChange={ ( mobile ) => set( { mobile } ) }
				/>
				<Note>{ __( 'Switch the canvas to tablet or phone to see the drawer.', 'blicks-pro' ) }</Note>
			</Sec>
		</div>
	);
}

/* ---------------------------------------------------------------- Selected */

function MenuFill( { panelId, ed }: { panelId: string; ed: Editor } ): JSX.Element {
	const [ menu, setMenu ] = useState( '' );
	const [ parent, setParent ] = useState( '' );
	const { menus, items }: { menus: { id: number; name: string }[]; items: { id: number; parent: number; title: { rendered?: string } }[] } = useSelect(
		( select: any ) => {
			const core = select( 'core' );
			return {
				menus: ( core.getEntityRecords( 'root', 'menu', { per_page: -1 } ) ?? [] ) as { id: number; name: string }[],
				items: ( menu ? core.getEntityRecords( 'root', 'menuItem', { menus: Number( menu ), per_page: -1 } ) ?? [] : [] ) as { id: number; parent: number; title: { rendered?: string } }[],
			};
		},
		[ menu ]
	);
	const under = ( id: number ) => items.filter( ( i ) => i.parent === id );
	const top = items.filter( ( i ) => i.parent === 0 && under( i.id ).length > 0 );

	const fill = () => {
		const base = `classic:${ menu }`;
		const columns = parent ? under( Number( parent ) ) : top;
		const template: Template[] = columns.length
			? [
					[
						'blicks/box',
						gridBox( Math.min( 4, columns.length ) ),
						columns.map( ( c ): Template => [
							'blicks/box',
							stackBox(),
							[
								[ 'blicks/heading', { level: 3, content: plain( c.title?.rendered ) } ],
								[ 'blicks/link-list', { menu: under( c.id ).length ? `${ base }:${ c.id }` : `${ base }:${ parent || c.id }` } ],
							],
						] ),
					],
			  ]
			: [ [ 'blicks/link-list', { menu: parent ? `${ base }:${ parent }` : base } ] ];
		ed.replace( panelId, template );
	};

	if ( ! menus.length ) return <Note>{ __( 'This site has no classic menus. Add Menu links instead, or a Link list of pages.', 'blicks-pro' ) }</Note>;

	return (
		<>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Fill from a WordPress menu', 'blicks-pro' ) }
				value={ menu }
				options={ [ { value: '', label: __( 'Choose a menu', 'blicks-pro' ) }, ...menus.map( ( m ) => ( { value: String( m.id ), label: m.name } ) ) ] }
				onChange={ ( v: string ) => {
					setMenu( v );
					setParent( '' );
				} }
			/>
			{ menu && top.length > 0 && (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'From the items under', 'blicks-pro' ) }
					value={ parent }
					options={ [ { value: '', label: __( 'Every item with sub-items', 'blicks-pro' ) }, ...top.map( ( i ) => ( { value: String( i.id ), label: plain( i.title?.rendered ) } ) ) ] }
					onChange={ setParent }
				/>
			) }
			{ menu && (
				<Button variant="secondary" onClick={ fill }>
					{ __( 'Fill the panel', 'blicks-pro' ) }
				</Button>
			) }
			<Note>{ __( 'Its sub-items become Link lists, kept in step with the menu.', 'blicks-pro' ) }</Note>
		</>
	);
}

function PanelSettings( { panel, itemLabel, ed, focused }: { panel: Block; itemLabel: string; ed: Editor; focused: boolean } ): JSX.Element {
	const a = panel.attributes ?? {};
	const id = String( panel.clientId );
	const set = ( next: Attrs ) => ed.set( id, next );
	const [ layout, setLayout ] = useState< PanelLayout | '' >( '' );
	const pageIds = usePageIds();

	return (
		<>
			<Sec title={ __( 'Panel', 'blicks-pro' ) }>
				{ focused ? (
					<Button variant="secondary" onClick={ () => studio()?.unfocus() }>
						{ __( 'Back to the header', 'blicks-pro' ) }
					</Button>
				) : (
					<Button
						variant="primary"
						onClick={ () => studio()?.focus( id, { label: `${ itemLabel } · ${ __( 'Mega menu', 'blicks-pro' ) }`, exitLabel: __( 'Back to the header', 'blicks-pro' ) } ) }
					>
						{ __( 'Edit panel', 'blicks-pro' ) }
					</Button>
				) }
				{ focused && <AddInto block={ panel } /> }
				<Note>{ __( 'Only the panel’s blocks are listed while it is open, and the inserter offers what a panel may hold.', 'blicks-pro' ) }</Note>
			</Sec>
			<Sec title={ __( 'Start over from', 'blicks-pro' ) }>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Layout', 'blicks-pro' ) }
					value={ layout }
					options={ [ { value: '', label: __( 'Keep what is there', 'blicks-pro' ) }, ...PANEL_LAYOUTS.map( ( l ) => ( { value: l.id, label: l.label } ) ) ] }
					onChange={ ( v: string ) => setLayout( v as PanelLayout | '' ) }
				/>
				{ layout && (
					<Button
						variant="secondary"
						onClick={ () => {
							ed.replace( id, panelInner( layout, pageIds ) );
							setLayout( '' );
						} }
					>
						{ __( 'Replace the panel’s blocks', 'blicks-pro' ) }
					</Button>
				) }
				<MenuFill panelId={ id } ed={ ed } />
			</Sec>
			<Sec title={ __( 'Opening', 'blicks-pro' ) }>
				<Seg
					label={ __( 'Opens on', 'blicks-pro' ) }
					value={ String( a.openOn ?? 'hover' ) as 'hover' }
					options={ [
						[ 'hover', __( 'Hover', 'blicks-pro' ) ],
						[ 'click', __( 'Click', 'blicks-pro' ) ],
					] }
					onChange={ ( openOn ) => set( { openOn } ) }
				/>
				{ 'click' !== a.openOn && (
					<RangeControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Delay (ms)', 'blicks-pro' ) }
						help={ __( 'Stops the panel flashing open as the pointer crosses the menu.', 'blicks-pro' ) }
						min={ 0 }
						max={ 1000 }
						step={ 50 }
						value={ Number( a.delay ?? 150 ) }
						onChange={ ( delay?: number ) => set( { delay: delay ?? 150 } ) }
					/>
				) }
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Animation', 'blicks-pro' ) }
					value={ String( a.animation ?? 'fade' ) as 'fade' }
					options={ [
						{ value: 'fade', label: __( 'Fade', 'blicks-pro' ) },
						{ value: 'slide', label: __( 'Slide down', 'blicks-pro' ) },
						{ value: 'none', label: __( 'None', 'blicks-pro' ) },
					] }
					onChange={ ( animation: string ) => set( { animation } ) }
				/>
				<Toggle label={ __( 'Close when the page scrolls', 'blicks-pro' ) } checked={ !! a.closeOnScroll } onChange={ ( closeOnScroll ) => set( { closeOnScroll } ) } />
			</Sec>
			<Sec title={ __( 'Size', 'blicks-pro' ) }>
				<Seg
					label={ __( 'Width', 'blicks-pro' ) }
					value={ String( a.width ?? 'container' ) as 'container' }
					options={ [
						[ 'container', __( 'Content', 'blicks-pro' ) ],
						[ 'full', __( 'Full', 'blicks-pro' ) ],
						[ 'content', __( 'Fit', 'blicks-pro' ) ],
					] }
					onChange={ ( width ) => set( { width } ) }
				/>
			</Sec>
		</>
	);
}

function ItemSettings( { item, ed, focusedOn }: { item: Block; ed: Editor; focusedOn: string } ): JSX.Element {
	const mega = useMegaPanel( item.clientId );
	const a = item.attributes ?? {};
	const id = String( item.clientId );
	const panel = ( item.innerBlocks ?? [] ).find( ( b ) => b.name === 'blicks/mega-panel' );
	const label = plain( a.label ) || __( 'Menu item', 'blicks-pro' );

	return (
		<>
			<Sec title={ __( 'Menu item', 'blicks-pro' ) }>
				<TextControl __next40pxDefaultSize __nextHasNoMarginBottom label={ __( 'Label', 'blicks-pro' ) } value={ plain( a.label ) } onChange={ ( v: string ) => ed.set( id, { label: v } ) } />
				{ ! panel && (
					<>
						<TextControl __next40pxDefaultSize __nextHasNoMarginBottom label={ __( 'Link', 'blicks-pro' ) } value={ String( a.url ?? '' ) } onChange={ ( v: string ) => ed.set( id, { url: v.trim() } ) } />
						<Toggle label={ __( 'Opens in a new tab', 'blicks-pro' ) } checked={ a.linkTarget === '_blank' } onChange={ ( on ) => ed.set( id, { linkTarget: on ? '_blank' : '' } ) } />
					</>
				) }
				{ panel?.clientId ? (
					<Button variant="tertiary" isDestructive onClick={ mega.remove }>
						{ __( 'Remove the mega menu', 'blicks-pro' ) }
					</Button>
				) : (
					<Button variant="secondary" onClick={ mega.add }>
						{ __( 'Add a mega menu', 'blicks-pro' ) }
					</Button>
				) }
				<OnPhonesControl attributes={ a } setAttributes={ ( next ) => ed.set( id, next ) } />
			</Sec>
			{ panel?.clientId && <PanelSettings panel={ panel } itemLabel={ label } ed={ ed } focused={ focusedOn === panel.clientId } /> }
		</>
	);
}

/**
 * The block the Studio is focused on, or ''. A focus scope (Studio API v3) leaves the tree's root
 * `disabled` and the scope `default`, so that is how it is read back.
 */
function useFocused(): string {
	return useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		const [ root ] = store.getBlockOrder( '' ) as string[];
		if ( ! root || 'disabled' !== store.getBlockEditingMode( root ) ) return '';
		const panels = store.getBlocksByName?.( 'blicks/mega-panel' ) as string[] | undefined;
		return ( panels ?? [] ).find( ( id ) => 'default' === store.getBlockEditingMode( id ) ) ?? '';
	}, [] );
}

/** The nearest ancestor of a block that has one of these names, the block itself first. */
function useNearest( clientId: string, names: string[] ): Block | null {
	return useSelect(
		( select: any ) => {
			if ( ! clientId ) return null;
			const store = select( 'core/block-editor' );
			const ids = [ clientId, ...[ ...store.getBlockParents( clientId ) ].reverse() ];
			const hit = ids.find( ( id: string ) => names.includes( store.getBlockName( id ) ) );
			return hit ? store.getBlock( hit ) : null;
		},
		[ clientId, names.join() ]
	);
}

export function SelectedPanel( { blocks, selection }: PanelProps ): JSX.Element {
	const ed = useEditor();
	const clientId = selection?.clientId ?? '';
	const owner = useNearest( clientId, [ 'blicks/nav-item' ] );
	const block = useBlock( clientId );
	const focusedOn = useFocused();

	if ( ! block?.clientId ) return <Note>{ __( 'Select a part of the header to set it here.', 'blicks-pro' ) }</Note>;

	if ( owner?.clientId && ( block.name === 'blicks/nav-item' || block.name === 'blicks/mega-panel' ) ) {
		return (
			<div className="bl-hs-panel">
				<ItemSettings item={ owner } ed={ ed } focusedOn={ focusedOn } />
			</div>
		);
	}

	if ( block.name === 'blicks/header' ) {
		return <Note>{ __( 'The whole header is set in the Header tab.', 'blicks-pro' ) }</Note>;
	}

	const id = String( block.clientId );
	const rows = ( blocks[ 0 ]?.innerBlocks ?? [] ).filter( ( b ) => b.name === 'blicks/header-row' );
	const index = rows.findIndex( ( r ) => r.clientId === id );

	return (
		<div className="bl-hs-panel">
			<Sec title={ index >= 0 ? rowLabel( block, index, rows.length ) : ( ( block.name.split( '/' )[ 1 ] ?? block.name ).replace( /-/g, ' ' ) ) }>
				{ block.name === 'blicks/header-row' && (
					<Seg
						label={ __( 'Layout', 'blicks-pro' ) }
						value={ String( block.attributes?.preset ?? 'classic' ) as 'classic' }
						options={ [
							[ 'classic', __( 'Classic', 'blicks-pro' ) ],
							[ 'centred', __( 'Centered', 'blicks-pro' ) ],
							[ 'stacked', __( 'Stacked', 'blicks-pro' ) ],
							[ 'custom', __( 'Custom', 'blicks-pro' ) ],
						] }
						onChange={ ( preset ) => ed.set( id, { preset } ) }
					/>
				) }
				{ owner?.clientId && (
					<Button variant="secondary" onClick={ () => studio()?.unfocus() }>
						{ __( 'Back to the header', 'blicks-pro' ) }
					</Button>
				) }
				{ isContainer( block.name ) && <AddInto block={ block } /> }
				<OnPhonesControl attributes={ block.attributes ?? {} } setAttributes={ ( next ) => ed.set( id, next ) } />
			</Sec>
		</div>
	);
}
