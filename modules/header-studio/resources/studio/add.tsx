/**
 * Adding to a header, from the tabs rather than the canvas.
 *
 * The bar has no appenders: a slot that appears when an area or the menu is selected takes width
 * from its neighbours, so selecting would change the layout. Instead:
 *
 *  - **Add to a row** (Header tab): one tile per element a header area holds, added to the start,
 *    centre or end of the row the selection is in (the main row when nothing is selected).
 *  - **+ Add** (Item tab): core's inserter, anchored to the button, limited to what the selected
 *    container allows and adding at its end. A menu adds a menu item in one click.
 */
import { Inserter } from '@wordpress/block-editor';
import { createBlocksFromInnerBlocksTemplate } from '@wordpress/blocks';
import { Button } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { Block } from './host';
import type { Template } from './presets';

export type Slot = 'start' | 'centre' | 'end';

interface Tile {
	id: string;
	label: string;
	/** An SVG path, drawn in a 24px box. */
	icon: string;
	/** Where it goes when the author has not picked an area. */
	slot: Slot;
	template: () => Template;
}

export const TILES: Tile[] = [
	{ id: 'logo', label: __( 'Logo', 'blicks-pro' ), icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5', slot: 'start', template: () => [ 'core/site-logo', {} ] },
	{ id: 'title', label: __( 'Site title', 'blicks-pro' ), icon: 'M5 6h14M12 6v13', slot: 'start', template: () => [ 'core/site-title', { level: 0 } ] },
	{ id: 'menu', label: __( 'Menu', 'blicks-pro' ), icon: 'M4 7h16M4 12h16M4 17h16', slot: 'centre', template: () => [ 'blicks/nav', {}, [ [ 'blicks/nav-item', {} ] ] ] },
	{ id: 'button', label: __( 'Button', 'blicks-pro' ), icon: 'M3 8h18v8H3zM8 12h8', slot: 'end', template: () => [ 'blicks/buttons', {}, [ [ 'blicks/button', {} ] ] ] },
	{
		id: 'search',
		label: __( 'Search', 'blicks-pro' ),
		icon: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l4 4',
		slot: 'end',
		template: () => [ 'core/search', { label: __( 'Search', 'blicks-pro' ), showLabel: false, buttonUseIcon: true, buttonPosition: 'button-only' } ],
	},
	{ id: 'text', label: __( 'Text', 'blicks-pro' ), icon: 'M5 7h14M5 12h14M5 17h9', slot: 'start', template: () => [ 'blicks/text', { tag: 'span' } ] },
	{ id: 'link', label: __( 'Menu link', 'blicks-pro' ), icon: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1', slot: 'end', template: () => [ 'blicks/menu-link', {} ] },
	{ id: 'icon', label: __( 'Icon', 'blicks-pro' ), icon: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z', slot: 'end', template: () => [ 'blicks/icon', {} ] },
];

const PLUS = 'M12 5v14M5 12h14';

const Glyph = ( { d }: { d: string } ): JSX.Element => (
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d={ d } />
	</svg>
);

/** The id of the header row the selection is in, or ''. */
function useSelectedRow( selected: string ): string {
	return useSelect(
		( select: any ) => {
			if ( ! selected ) return '';
			const store = select( 'core/block-editor' );
			const ids: string[] = [ selected, ...[ ...store.getBlockParents( selected ) ].reverse() ];
			return ids.find( ( id ) => store.getBlockName( id ) === 'blicks/header-row' ) ?? '';
		},
		[ selected ]
	) as string;
}

/** Which area a tile lands in: the one picked, else the tile's own, else the last there is. */
export function areaFor( areas: Block[], picked: Slot | '', tile: Pick< Tile, 'slot' > ): Block | undefined {
	const want = picked || tile.slot;
	return areas.find( ( a ) => ( a.attributes?.slot ?? 'start' ) === want ) ?? areas[ areas.length - 1 ];
}

/** "Add to a row": tiles that add an element to the start, centre or end of a row. */
export function AddToRow( { header, selected, rowName }: { header: Block | null; selected: string; rowName: ( row: Block, index: number, count: number ) => string } ): JSX.Element | null {
	const rowId = useSelectedRow( selected );
	const [ slot, setSlot ] = useState< Slot | '' >( '' );
	const { insertBlocks } = useDispatch( 'core/block-editor' ) as any;
	const rows = ( header?.innerBlocks ?? [] ).filter( ( b ) => b.name === 'blicks/header-row' );
	const index = Math.max( 0, rows.findIndex( ( r ) => r.clientId === rowId ) );
	const row = rowId ? rows[ index ] : rows[ rows.length - 1 ];

	if ( ! row ) return null;

	const areas = ( row.innerBlocks ?? [] ).filter( ( b ) => b.name === 'blicks/header-area' );

	const add = ( tile: Tile ) => {
		const area = areaFor( areas, slot, tile );
		if ( ! area?.clientId ) return;
		insertBlocks( createBlocksFromInnerBlocksTemplate( [ tile.template() ] as never ), ( area.innerBlocks ?? [] ).length, area.clientId, true );
	};

	const slots: [ Slot | '', string ][] = [
		[ '', __( 'Auto', 'blicks-pro' ) ],
		[ 'start', __( 'Start', 'blicks-pro' ) ],
		[ 'centre', __( 'Center', 'blicks-pro' ) ],
		[ 'end', __( 'End', 'blicks-pro' ) ],
	];

	return (
		<>
			<div className="bl-hs-seg" role="radiogroup" aria-label={ __( 'Area to add to', 'blicks-pro' ) }>
				{ slots.map( ( [ v, text ] ) => (
					<button key={ v || 'auto' } type="button" role="radio" aria-checked={ v === slot } className={ v === slot ? 'is-on' : '' } onClick={ () => setSlot( v ) }>
						{ text }
					</button>
				) ) }
			</div>
			<div className="bl-hs-add" role="group" aria-label={ __( 'Elements', 'blicks-pro' ) }>
				{ TILES.map( ( tile ) => (
					<button key={ tile.id } type="button" onClick={ () => add( tile ) }>
						<Glyph d={ tile.icon } />
						{ tile.label }
					</button>
				) ) }
			</div>
			<p className="bl-hs-panel__note">
				{ sprintf(
					/* translators: %s: the row's name, e.g. Main row */
					__( 'Adds to the %s. Auto puts a logo at the start, a menu in the center and the rest at the end. Drag in Layers to move it.', 'blicks-pro' ),
					rowName( row, rowId ? index : rows.length - 1, rows.length )
				) }
			</p>
		</>
	);
}

/** Containers the Item tab offers "+ Add" for. */
const CONTAINERS = [ 'blicks/header-area', 'blicks/nav', 'blicks/mega-panel', 'blicks/box', 'blicks/buttons' ];

export const isContainer = ( name: string ): boolean => CONTAINERS.includes( name );

/** "+ Add": into the selected container, at its end. A menu gets a menu item straight away. */
export function AddInto( { block }: { block: Block } ): JSX.Element | null {
	const { insertBlocks } = useDispatch( 'core/block-editor' ) as any;
	if ( ! block.clientId ) return null;
	const id = block.clientId;
	const count = ( block.innerBlocks ?? [] ).length;

	if ( block.name === 'blicks/nav' ) {
		return (
			<Button variant="secondary" icon={ <Glyph d={ PLUS } /> } onClick={ () => insertBlocks( createBlocksFromInnerBlocksTemplate( [ [ 'blicks/nav-item', {} ] ] as never ), count, id, true ) }>
				{ __( 'Add menu item', 'blicks-pro' ) }
			</Button>
		);
	}

	return (
		<Inserter
			rootClientId={ id }
			position="bottom left"
			isAppender
			renderToggle={ ( { onToggle, disabled, isOpen }: any ) => (
				<Button variant="secondary" icon={ <Glyph d={ PLUS } /> } onClick={ onToggle } disabled={ disabled } aria-expanded={ isOpen }>
					{ __( 'Add', 'blicks-pro' ) }
				</Button>
			) }
		/>
	);
}
