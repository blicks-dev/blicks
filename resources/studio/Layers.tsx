/**
 * The Studio's left sidebar: the mounted tree as layers.
 *
 * Groups fold and unfold; a search finds a block wherever it is folded. Each row carries its own
 * actions (lock, duplicate, delete and a menu for the rest), shown on hover and on the selected
 * row, so nothing about a block needs a trip to the inspector to find. Shift-click selects a run of
 * siblings, which Group wraps in a Box.
 *
 * Every edit goes through the mount's own block-editor store, never the post's — the same rule the
 * rest of the Studio keeps — so the Studio's history records it and Undo takes it back.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { BlockIcon, store as blockEditorStore } from '@wordpress/block-editor';
import { cloneBlock, createBlock } from '@wordpress/blocks';
import { Dropdown } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { Glyph } from './Glyph';
import type { BlockNode } from './mount';
import {
	canGroup,
	canUngroup,
	flatten,
	GROUP_BLOCK,
	groupAttributes,
	inTreeOrder,
	SCREENS,
	visibleRows,
	type LayerRow,
	type Screen,
} from './layer-model';

const G = {
	caret: 'M9 6l6 6-6 6',
	lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z',
	unlock: 'M7 11V8a5 5 0 019.6-2M5 11h14v10H5z',
	copy: 'M8 8h12v12H8zM4 16V4h12',
	trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
	more: 'M4.5 12h1M11.5 12h1M18.5 12h1',
	eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0122 12a17 17 0 01-3 3.6M6.6 6.6A17 17 0 002 12s4 7 10 7a9.8 9.8 0 004-.9',
	search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5',
	foldAll: 'M7 15l5-5 5 5M7 20l5-5 5 5',
	unfoldAll: 'M7 9l5 5 5-5M7 4l5 5 5-5',
};

const SCREEN_LABEL: Record< Screen, string > = {
	base: __( 'Desktop', 'blicks' ),
	tablet: __( 'Tablet', 'blicks' ),
	mobile: __( 'Phone', 'blicks' ),
};

/** Styles copied from one block, for Paste styles on another. Session-wide, like a clipboard. */
let styleClip: unknown = null;

/**
 * The tree's keyboard commands, for the Studio's key handler to reach. The handler lives outside
 * the mount's block-editor provider, where these commands have to run, so the panel lends them.
 */
export const layerKeys: { run: ( ( action: 'group' | 'ungroup' ) => void ) | null } = { run: null };

interface Editor {
	getSelectedBlockClientIds: () => string[];
	getBlock: ( id: string ) => any;
	getBlocks: ( id?: string ) => any[];
	getBlockRootClientId: ( id: string ) => string | null;
}

const strip = ( html: string ): string => new DOMParser().parseFromString( html, 'text/html' ).body.textContent ?? '';

/** One style value Find matched, as the design panel reports it. */
interface ValueHit {
	id: string;
	part: string;
	state: string;
	breakpoint: string;
	text: string;
	label: string;
}

/**
 * The design panel's runtime API (`window.blicks.designPanel`).
 *
 * The panel lives in the editor bundle, which this entry may not import from; it publishes Find
 * and its focus requests there instead. Absent (an older editor bundle), Find is by name only.
 */
interface DesignPanelHost {
	matchesOf?: ( tree: unknown, query: string ) => ValueHit[];
	requestFocus?: ( request: Omit< ValueHit, 'text' | 'label' > & { clientId: string } ) => void;
}

const designPanel = (): DesignPanelHost | undefined => ( window as unknown as { blicks?: { designPanel?: DesignPanelHost } } ).blicks?.designPanel;

/** Each block's style tree, by client id. */
function treesOf( nodes: BlockNode[], into = new Map< string, unknown >() ): Map< string, unknown > {
	for ( const node of nodes ) {
		if ( node.clientId ) into.set( node.clientId, ( node.attributes as { blicks?: unknown } | undefined )?.blicks ?? {} );
		treesOf( node.innerBlocks ?? [], into );
	}
	return into;
}

/** Where a hit is, in a few words: "hover · phone". */
const whereOf = ( hit: ValueHit ): string => [ hit.part === 'element' ? '' : hit.part, hit.state === 'default' ? '' : hit.state, hit.breakpoint === 'base' ? '' : hit.breakpoint === 'mobile' ? __( 'phone', 'blicks' ) : hit.breakpoint ].filter( Boolean ).join( ' · ' );

/**
 * `names` is the mode's own words for its blocks (`StudioMode.tree`): a row shows the author's
 * name for a block first, then the mode's, then the block type's title.
 */
export function Layers( { blocks, names }: { blocks: BlockNode[]; names?: ReadonlyMap< string, { label: string; note: string } > } ): JSX.Element {
	const registry = useRegistry();
	const editor = () => registry.select( blockEditorStore ) as unknown as Editor;
	const types = registry.select( 'core/blocks' ) as unknown as { getBlockType: ( name: string ) => { title?: string; icon?: unknown } | undefined };
	const dispatch = useDispatch( blockEditorStore ) as any;

	const selected: string[] = useSelect( ( select: any ) => select( blockEditorStore ).getSelectedBlockClientIds(), [] );
	const [ collapsed, setCollapsed ] = useState< Set< string > >( () => new Set() );
	const [ query, setQuery ] = useState( '' );
	const [ renaming, setRenaming ] = useState( '' );
	const anchor = useRef( '' );

	const rows = useMemo( () => flatten( blocks, types, strip ), [ blocks, types ] );
	// Find reaches into every block's style values too, through the design panel's own matcher.
	const hits = useMemo( () => {
		const out = new Map< string, ValueHit[] >();
		const match = designPanel()?.matchesOf;
		if ( ! match || ! query.trim() ) return out;
		for ( const [ id, tree ] of treesOf( blocks ) ) {
			const found = match( tree, query );
			if ( found.length ) out.set( id, found );
		}
		return out;
	}, [ blocks, query ] );
	const shown = useMemo( () => visibleRows( rows, collapsed, query, new Set( hits.keys() ) ), [ rows, collapsed, query, hits ] );
	const hitCount = [ ...hits.values() ].reduce( ( n, list ) => n + list.length, 0 );

	/** Open the design panel on a value: ask first, so the panel that mounts for the block takes it. */
	const openHit = ( row: LayerRow, hit: ValueHit ) => {
		designPanel()?.requestFocus?.( { clientId: row.id, id: hit.id, part: hit.part, state: hit.state, breakpoint: hit.breakpoint } );
		anchor.current = row.id;
		dispatch.selectBlock( row.id );
	};
	const byId = useMemo( () => new Map( rows.map( ( r ) => [ r.id, r ] ) ), [ rows ] );

	const setAttrs = ( id: string, attrs: Record< string, unknown > ) => dispatch.updateBlockAttributes( id, attrs );
	const attrsOf = ( id: string ): Record< string, any > => editor().getBlock( id )?.attributes ?? {};

	const group = ( ids: string[] ) => {
		const ordered = inTreeOrder( ids, rows );
		if ( ! canGroup( ordered, rows ) ) return;
		const inner = ordered.map( ( id ) => cloneBlock( editor().getBlock( id ) ) );
		const box = createBlock( GROUP_BLOCK, groupAttributes( ordered, rows ), inner );
		dispatch.replaceBlocks( ordered, box );
		dispatch.selectBlock( box.clientId );
	};

	const ungroup = ( id: string ) => {
		if ( ! canUngroup( byId.get( id ) ) ) return;
		const inner = editor().getBlocks( id ).map( ( b: any ) => cloneBlock( b ) );
		dispatch.replaceBlocks( id, inner );
	};

	// Lend ⌘G / ⇧⌘G to the Studio's key handler while the panel is mounted.
	const latest = useRef( { group, ungroup, selected } );
	latest.current = { group, ungroup, selected };
	useEffect( () => {
		layerKeys.run = ( action ) => {
			const { selected: ids } = latest.current;
			if ( 'group' === action ) latest.current.group( ids );
			else if ( 1 === ids.length ) latest.current.ungroup( ids[ 0 ]! );
		};
		return () => {
			layerKeys.run = null;
		};
	}, [] );

	const pick = ( row: LayerRow, extend: boolean ) => {
		const from = anchor.current;
		if ( extend && from && from !== row.id && byId.get( from )?.parent === row.parent ) {
			dispatch.multiSelect( from, row.id );
			return;
		}
		anchor.current = row.id;
		dispatch.selectBlock( row.id );
	};

	const toggleFold = ( id: string ) =>
		setCollapsed( ( prev ) => {
			const next = new Set( prev );
			if ( next.has( id ) ) next.delete( id );
			else next.add( id );
			return next;
		} );

	const toggleLock = ( row: LayerRow ) => setAttrs( row.id, { lock: row.locked ? undefined : { move: true, remove: true } } );

	const toggleHidden = ( row: LayerRow, screen: Screen ) => {
		const visibility = { ...( attrsOf( row.id ).visibility ?? {} ) };
		if ( visibility[ screen ] ) delete visibility[ screen ];
		else visibility[ screen ] = true;
		setAttrs( row.id, { visibility } );
	};

	const rename = ( row: LayerRow, name: string ) => {
		const metadata = { ...( attrsOf( row.id ).metadata ?? {} ) };
		if ( name.trim() ) metadata.name = name.trim();
		else delete metadata.name;
		setAttrs( row.id, { metadata } );
		setRenaming( '' );
	};

	const multi = selected.length > 1 && canGroup( selected, rows );

	if ( rows.length === 0 ) {
		return <p className="bl-studio__empty">{ __( 'Nothing mounted yet. Add a block with +.', 'blicks' ) }</p>;
	}

	return (
		<div className="bl-layers">
			<div className="bl-layers__head">
				<label className="bl-layers__search">
					<Glyph path={ G.search } size={ 14 } />
					<input type="search" value={ query } onChange={ ( e ) => setQuery( e.target.value ) } placeholder={ __( 'Find a layer or a setting', 'blicks' ) } aria-label={ __( 'Find a layer or a setting', 'blicks' ) } />
				</label>
				<button type="button" className="bl-layers__tool" onClick={ () => setCollapsed( new Set( rows.filter( ( r ) => r.children > 0 ).map( ( r ) => r.id ) ) ) } aria-label={ __( 'Collapse all', 'blicks' ) } title={ __( 'Collapse all', 'blicks' ) }>
					<Glyph path={ G.foldAll } size={ 14 } />
				</button>
				<button type="button" className="bl-layers__tool" onClick={ () => setCollapsed( new Set() ) } aria-label={ __( 'Expand all', 'blicks' ) } title={ __( 'Expand all', 'blicks' ) }>
					<Glyph path={ G.unfoldAll } size={ 14 } />
				</button>
			</div>

			{ query.trim() !== '' && designPanel()?.matchesOf && (
				<p className="bl-layers__found" role="status">
					{ /* translators: 1: number of style values, 2: number of blocks */ __( '%1$d values on %2$d blocks', 'blicks' ).replace( '%1$d', String( hitCount ) ).replace( '%2$d', String( hits.size ) ) }
				</p>
			) }

			<ul className="bl-layers__tree" role="tree" aria-multiselectable="true">
				{ shown.map( ( row ) => {
					const on = selected.includes( row.id );
					const open = ! collapsed.has( row.id );
					const ungroupable = canUngroup( row );

					const found = hits.get( row.id ) ?? [];

					return (
						<Fragment key={ row.id }>
						<li
							role="treeitem"
							aria-selected={ on }
							aria-expanded={ row.children > 0 ? open : undefined }
							className={ `bl-layers__row${ on ? ' is-on' : '' }${ row.hidden.length ? ' is-hidden' : '' }` }
							style={ { paddingLeft: `${ 6 + ( query ? 0 : row.depth ) * 16 }px` } }
							tabIndex={ on ? 0 : -1 }
							onClick={ ( e ) => pick( row, e.shiftKey ) }
							onKeyDown={ ( e ) => {
								if ( e.target !== e.currentTarget ) return;
								if ( 'Enter' === e.key || ' ' === e.key ) { e.preventDefault(); pick( row, e.shiftKey ); }
								if ( 'F2' === e.key ) setRenaming( row.id );
								if ( ( 'ArrowRight' === e.key && ! open ) || ( 'ArrowLeft' === e.key && open && row.children > 0 ) ) toggleFold( row.id );
								if ( 'ArrowDown' === e.key || 'ArrowUp' === e.key ) {
									e.preventDefault();
									const at = shown.findIndex( ( r ) => r.id === row.id );
									const next = shown[ at + ( 'ArrowDown' === e.key ? 1 : -1 ) ];
									if ( next ) { pick( next, e.shiftKey ); ( e.currentTarget.parentElement?.children[ at + ( 'ArrowDown' === e.key ? 1 : -1 ) ] as HTMLElement | undefined )?.focus(); }
								}
							} }
							onDoubleClick={ () => setRenaming( row.id ) }
						>
							{ row.children > 0 && ! query ? (
								<button type="button" className={ `bl-layers__caret${ open ? ' is-open' : '' }` } onClick={ ( e ) => { e.stopPropagation(); toggleFold( row.id ); } } aria-label={ open ? __( 'Collapse', 'blicks' ) : __( 'Expand', 'blicks' ) }>
									<Glyph path={ G.caret } size={ 12 } />
								</button>
							) : (
								<span className="bl-layers__caret-sp" />
							) }
							<span className="bl-layers__icon" aria-hidden="true"><BlockIcon icon={ row.icon as never } /></span>

							{ renaming === row.id ? (
								<input
									className="bl-layers__rename"
									defaultValue={ row.label || row.title }
									autoFocus
									onClick={ ( e ) => e.stopPropagation() }
									onBlur={ ( e ) => rename( row, e.target.value ) }
									onKeyDown={ ( e ) => {
										if ( 'Enter' === e.key ) rename( row, ( e.target as HTMLInputElement ).value );
										if ( 'Escape' === e.key ) { e.stopPropagation(); setRenaming( '' ); }
									} }
									aria-label={ __( 'Layer name', 'blicks' ) }
								/>
							) : (
								<span className="bl-layers__name">
									{ row.label || names?.get( row.id )?.label || row.title }
									{ '' !== ( names?.get( row.id )?.note ?? '' ) && <span className="bl-layers__snip">{ names?.get( row.id )?.note }</span> }
									{ '' === ( names?.get( row.id )?.note ?? '' ) && '' !== row.snippet && row.snippet !== row.label && <span className="bl-layers__snip">{ row.snippet }</span> }
								</span>
							) }

							<span className="bl-layers__flags">
								{ row.hidden.length > 0 && (
									<span title={ __( 'Hidden on', 'blicks' ) + ' ' + row.hidden.map( ( s ) => SCREEN_LABEL[ s ] ).join( ', ' ) }><Glyph path={ G.eyeOff } size={ 13 } /></span>
								) }
								{ row.locked && <span title={ __( 'Locked', 'blicks' ) }><Glyph path={ G.lock } size={ 13 } /></span> }
								{ row.children > 0 && <small>{ row.children }</small> }
							</span>

							<span className="bl-layers__acts" onClick={ ( e ) => e.stopPropagation() }>
								<button type="button" className="bl-layers__act" onClick={ () => toggleLock( row ) } aria-label={ row.locked ? __( 'Unlock', 'blicks' ) : __( 'Lock', 'blicks' ) } title={ row.locked ? __( 'Unlock', 'blicks' ) : __( 'Lock', 'blicks' ) }>
									<Glyph path={ row.locked ? G.unlock : G.lock } size={ 14 } />
								</button>
								<button type="button" className="bl-layers__act" onClick={ () => dispatch.duplicateBlocks( [ row.id ] ) } aria-label={ __( 'Duplicate', 'blicks' ) } title={ __( 'Duplicate', 'blicks' ) }>
									<Glyph path={ G.copy } size={ 14 } />
								</button>
								<button type="button" className="bl-layers__act" disabled={ row.locked } onClick={ () => dispatch.removeBlocks( [ row.id ], false ) } aria-label={ __( 'Delete', 'blicks' ) } title={ __( 'Delete', 'blicks' ) }>
									<Glyph path={ G.trash } size={ 14 } />
								</button>
								<Dropdown
									popoverProps={ { placement: 'bottom-end', className: 'bl-layers__popover' } }
									renderToggle={ ( { isOpen, onToggle } ) => (
										<button type="button" className="bl-layers__act" onClick={ onToggle } aria-expanded={ isOpen } aria-label={ __( 'More actions', 'blicks' ) } title={ __( 'More actions', 'blicks' ) }>
											<Glyph path={ G.more } size={ 16 } />
										</button>
									) }
									renderContent={ ( { onClose } ) => {
										const run = ( fn: () => void ) => () => { fn(); onClose(); };
										const ids = selected.includes( row.id ) && selected.length > 1 ? selected : [ row.id ];

										return (
											<div className="bl-layers__menu" role="menu">
												<button role="menuitem" type="button" onClick={ run( () => setRenaming( row.id ) ) }>{ __( 'Rename', 'blicks' ) }</button>
												<button role="menuitem" type="button" disabled={ ! row.parent } onClick={ run( () => dispatch.selectBlock( row.parent ) ) }>{ __( 'Select parent', 'blicks' ) }</button>
												<hr />
												<button role="menuitem" type="button" disabled={ ! canGroup( ids, rows ) } onClick={ run( () => group( ids ) ) }>{ __( 'Group into Box', 'blicks' ) }<kbd>⌘G</kbd></button>
												<button role="menuitem" type="button" disabled={ ! ungroupable } onClick={ run( () => ungroup( row.id ) ) }>{ __( 'Ungroup', 'blicks' ) }<kbd>⇧⌘G</kbd></button>
												<button role="menuitem" type="button" disabled={ row.locked } onClick={ run( () => dispatch.moveBlocksUp( [ row.id ], row.parent || undefined ) ) }>{ __( 'Move up', 'blicks' ) }</button>
												<button role="menuitem" type="button" disabled={ row.locked } onClick={ run( () => dispatch.moveBlocksDown( [ row.id ], row.parent || undefined ) ) }>{ __( 'Move down', 'blicks' ) }</button>
												<hr />
												<span className="bl-layers__menulabel">{ __( 'Hide on', 'blicks' ) }</span>
												<span className="bl-layers__screens">
													{ SCREENS.map( ( screen ) => (
														<button key={ screen } type="button" role="switch" aria-checked={ row.hidden.includes( screen ) } className={ row.hidden.includes( screen ) ? 'is-on' : '' } onClick={ () => toggleHidden( row, screen ) }>
															{ SCREEN_LABEL[ screen ] }
														</button>
													) ) }
												</span>
												<hr />
												<button role="menuitem" type="button" disabled={ ! attrsOf( row.id ).blicks } onClick={ run( () => { styleClip = structuredClone( attrsOf( row.id ).blicks ); } ) }>{ __( 'Copy styles', 'blicks' ) }</button>
												<button role="menuitem" type="button" disabled={ ! styleClip } onClick={ run( () => setAttrs( row.id, { blicks: structuredClone( styleClip ) } ) ) }>{ __( 'Paste styles', 'blicks' ) }</button>
												<hr />
												<button role="menuitem" type="button" className="is-danger" disabled={ row.locked } onClick={ run( () => dispatch.removeBlocks( [ row.id ], false ) ) }>{ __( 'Delete', 'blicks' ) }</button>
											</div>
										);
									} }
								/>
							</span>
						</li>
						{ found.length > 0 && (
							<li role="none" className="bl-layers__hits">
								{ found.slice( 0, 3 ).map( ( hit ) => (
									<button key={ `${ hit.id }|${ hit.part }|${ hit.state }|${ hit.breakpoint }` } type="button" onClick={ () => openHit( row, hit ) } title={ `${ hit.label } — ${ hit.text }` }>
										<span>{ hit.label }{ whereOf( hit ) ? ` · ${ whereOf( hit ) }` : '' } — { hit.text }</span>
									</button>
								) ) }
								{ found.length > 3 && <small>{ /* translators: %d: number of further matches */ __( '%d more', 'blicks' ).replace( '%d', String( found.length - 3 ) ) }</small> }
							</li>
						) }
						</Fragment>
					);
				} ) }
			</ul>

			{ multi && (
				<div className="bl-layers__groupbar">
					<span>{ /* translators: %d: number of selected blocks */ __( '%d selected', 'blicks' ).replace( '%d', String( selected.length ) ) }</span>
					<button type="button" className="bl-studio__btn bl-studio__btn--filled" onClick={ () => group( selected ) }>{ __( 'Group into Box', 'blicks' ) }</button>
				</div>
			) }

			<p className="bl-layers__foot">{ __( 'Shift-click to select several · double-click to rename', 'blicks' ) }</p>
		</div>
	);
}
