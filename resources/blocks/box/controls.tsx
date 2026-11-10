import { __, sprintf } from '@wordpress/i18n';
import { ToolbarDropdownMenu, ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice, ToolbarSegments } from '@/blocks/shared/toolbar';
import { useSelect } from '@wordpress/data';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { readStyle, writeStyle, type Look } from '@/framework/inspector-v2/style-model';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { HideFromReaders } from '@/framework/inspector-v2/More';
import { useState } from 'react';
import { Chips, Exact, Field, Icon, Note, Row, SegIcons, SegText, Sec, Select, Slider, Steps, SubView, Switch, type Option } from '@/framework/inspector-v2/kit';
import {
	type Align,
	type ArrangeOptions,
	type Arrangement,
	type BoxKind,
	type Height,
	type Room,
	type Length,
	type PhoneRoom,
	type Thickness,
	type Tree,
	type Width,
	LEAF_KINDS,
	rearrange,
	arrangeDefaults,
	isCustomArrange,
	type Spread,
	applyExactHeight,
	applyExactWidth,
	applyHeight,
	applyKind,
	applyExactLength,
	applyLength,
	applyLengthPhoneFull,
	ROOM as ROOM_LEN,
	applyExactRoom,
	applyPhoneRoom,
	applySticky,
	applyThickness,
	applyThicknessPx,
	applyWidth,
	baseOf,
	cleanKind,
	cleanTag,
	readArrange,
	readHeight,
	readLength,
	readLengthPhoneFull,
	readRoom,
	readSticky,
	readThickness,
	readThicknessPx,
	readWidth,
} from './model';

export const KINDS: Array< [ BoxKind, string, string ] > = [
	[ 'plain', __( 'Plain', 'blicks' ), __( 'No look of its own', 'blicks' ) ],
	[ 'card', __( 'Card', 'blicks' ), __( 'Raised, framed content', 'blicks' ) ],
	[ 'panel', __( 'Panel', 'blicks' ), __( 'A quiet tinted area', 'blicks' ) ],
	[ 'cover', __( 'Cover', 'blicks' ), __( 'A big colored band', 'blicks' ) ],
	[ 'badge', __( 'Badge', 'blicks' ), __( 'A small label', 'blicks' ) ],
	[ 'divider', __( 'Divider', 'blicks' ), __( 'A line between things', 'blicks' ) ],
	[ 'spacer', __( 'Spacer', 'blicks' ), __( 'Empty room', 'blicks' ) ],
];

/** The small drawing on each kind card. */
const KIND_VIZ: Record< BoxKind, JSX.Element > = {
	plain: <span className="kv" style={ { border: '1px dashed currentColor' } } />,
	card: <span className="kv" style={ { background: '#fff', border: '1px solid #d4d4d8', borderRadius: 4, boxShadow: '0 2px 4px rgb(0 0 0/18%)' } }><i /><i style={ { width: '60%' } } /></span>,
	panel: <span className="kv" style={ { background: '#eef0f6', borderRadius: 3 } }><i /><i style={ { width: '60%' } } /></span>,
	cover: <span className="kv" style={ { background: 'linear-gradient(90deg,#4f46e5,#7b61ff)', alignItems: 'center' } }><i style={ { background: '#fff', opacity: 0.9, width: '60%' } } /></span>,
	badge: <span className="kv" style={ { height: 12, width: 28, borderRadius: 99, background: '#e0e7ff', padding: 0 } } />,
	divider: <span className="kv" style={ { height: 2, padding: 0, background: '#71717a', borderRadius: 1 } } />,
	spacer: <span className="kv" style={ { borderLeft: '1px solid #a1a1aa', borderRight: '1px solid #a1a1aa', borderRadius: 0, background: 'repeating-linear-gradient(0deg,transparent 0 4px,#d4d4d8 4px 5px)' } } />,
};

const ARRANGE: Array< [ Arrangement, string, string, string ] > = [
	[ 'none', __( 'As written', 'blicks' ), 'M4 7h16M4 11h16M4 15h10', __( 'Things follow one another, like text.', 'blicks' ) ],
	[ 'stack', __( 'Stacked', 'blicks' ), 'M5 4h14v4H5zM5 10h14v4H5zM5 16h14v4H5z', __( 'One under another.', 'blicks' ) ],
	[ 'row', __( 'Side by side', 'blicks' ), 'M3 6h5v12H3zM9.5 6h5v12h-5zM16 6h5v12h-5z', __( 'Next to each other, wrapping when narrow.', 'blicks' ) ],
	[ 'grid', __( 'Grid', 'blicks' ), 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', __( 'Even columns.', 'blicks' ) ],
	[ 'layers', __( 'Layers', 'blicks' ), 'M4 9h11v11H4zM9 4h11v11H9z', __( 'On top of each other, e.g. words on a picture.', 'blicks' ) ],
];

const GAPS: Option[] = [ [ 'sm', __( 'Tight', 'blicks' ) ], [ 'md', __( 'Small', 'blicks' ) ], [ 'xl', __( 'Medium', 'blicks' ) ], [ '2xl', __( 'Wide', 'blicks' ) ] ];
const WIDTHS: Option< Width >[] = [ [ 'fit', __( 'Fit', 'blicks' ) ], [ 'prose', __( 'Narrow', 'blicks' ) ], [ 'content', __( 'Medium', 'blicks' ) ], [ 'fill', __( 'Fill', 'blicks' ) ] ];
const HEIGHTS: Array< [ Height, string, string ] > = [
	[ 'auto', __( 'Fit', 'blicks' ), __( 'Fit content', 'blicks' ) ],
	[ 'half', __( 'Half', 'blicks' ), __( 'Half screen', 'blicks' ) ],
	[ 'full', __( 'Screen', 'blicks' ), __( 'Full screen', 'blicks' ) ],
	[ 'square', __( 'Square', 'blicks' ), __( 'Square', 'blicks' ) ],
];
const ROOMS: Option< Room >[] = [ [ 'sm', __( 'Small', 'blicks' ) ], [ 'lg', __( 'Medium', 'blicks' ) ], [ 'xl', __( 'Large', 'blicks' ) ], [ '2xl', __( 'Huge', 'blicks' ) ] ];
const ROOM_PX: Record< Room, string > = { sm: '16px', lg: '32px', xl: '64px', '2xl': '96px' };
const PHONE_ROOMS: Option< PhoneRoom >[] = [ [ 'same', __( 'Same', 'blicks' ) ], [ 'half', __( 'Half', 'blicks' ) ], [ 'none', __( 'None', 'blicks' ) ] ];
const THICK: Option< Thickness >[] = [ [ 'thin', __( 'Thin', 'blicks' ) ], [ 'medium', __( 'Medium', 'blicks' ) ], [ 'thick', __( 'Thick', 'blicks' ) ] ];
const LENGTHS: Option< Length >[] = [ [ 'fill', __( 'Full width', 'blicks' ) ], [ 'short', __( 'Short', 'blicks' ) ] ];
const LINE_UP: Option< Look[ 'dalign' ] >[] = [
	[ 'start', __( 'Left', 'blicks' ), 'M5 4v16M9 12h10' ],
	[ 'center', __( 'Center', 'blicks' ), 'M12 4v16M6 12h12' ],
	[ 'end', __( 'Right', 'blicks' ), 'M19 4v16M5 12h10' ],
];

export const TAGS: Option[] = [
	[ 'div', __( 'Just a box', 'blicks' ) ],
	[ 'section', __( 'A section of the page', 'blicks' ) ],
	[ 'article', __( 'A card or post', 'blicks' ) ],
	[ 'aside', __( 'A side note', 'blicks' ) ],
	[ 'header', __( 'A header', 'blicks' ) ],
	[ 'footer', __( 'A footer', 'blicks' ) ],
	[ 'nav', __( 'Navigation', 'blicks' ) ],
	[ 'main', __( 'The main content', 'blicks' ) ],
	[ 'figure', __( 'A picture with caption', 'blicks' ) ],
	[ 'span', __( 'Inside a line of text', 'blicks' ) ],
];

const AXIS_NAME: Record< Align, [ string, string ] > = {
	start: [ __( 'left', 'blicks' ), __( 'Top', 'blicks' ) ],
	center: [ __( 'center', 'blicks' ), __( 'Middle', 'blicks' ) ],
	end: [ __( 'right', 'blicks' ), __( 'Bottom', 'blicks' ) ],
};

/** The 3×3 "where things sit" pad: rows are vertical placement, columns horizontal. */
function AlignPad( { x, y, onChange }: { x: Align; y: Align; onChange: ( x: Align, y: Align ) => void } ) {
	const axis: Align[] = [ 'start', 'center', 'end' ];
	return (
		<div className="apad" role="group" aria-label={ __( 'Where things sit', 'blicks' ) }>
			{ axis.map( ( row ) => axis.map( ( col ) => (
				<button key={ `${ row }-${ col }` } type="button" aria-pressed={ x === col && y === row } aria-label={ `${ AXIS_NAME[ row ][ 1 ] } ${ AXIS_NAME[ col ][ 0 ] }` } onClick={ () => onChange( col, row ) }>
					<i />
				</button>
			) ) ) }
		</div>
	);
}

const named = < V extends string >( list: Array< [ V, string, ...unknown[] ] >, v: V ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';

function LinkSec( { attributes, setAttributes }: PanelProps ) {
	const href = String( attributes.href || '' );
	return (
		<Sec title={ __( 'Link', 'blicks' ) } icon="link" value={ href ? ( attributes.linkTarget === '_blank' ? __( 'New tab', 'blicks' ) : __( 'Linked', 'blicks' ) ) : __( 'None', 'blicks' ) }>
			<Row label={ __( 'Address', 'blicks' ) } stack set={ !! href }>
				<Field icon="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" value={ href } placeholder={ __( 'Make the whole box clickable', 'blicks' ) } label={ __( 'Link', 'blicks' ) } onChange={ ( v ) => setAttributes( { href: v.trim() } ) } />
			</Row>
			{ href && <Switch label={ __( 'Open in a new tab', 'blicks' ) } checked={ attributes.linkTarget === '_blank' } onChange={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '', rel: on ? 'noreferrer noopener' : '' } ) } /> }
			{ href && (
				<Row label={ __( 'Link name', 'blicks' ) } stack set={ !! attributes.linkLabel } note={ __( 'Read out by screen readers. Empty: the card’s heading is used.', 'blicks' ) } noteIcon="info">
					<Field value={ attributes.linkLabel || '' } placeholder={ __( 'The card’s heading', 'blicks' ) } label={ __( 'Link name for screen readers', 'blicks' ) } onChange={ ( v ) => setAttributes( { linkLabel: v } ) } />
				</Row>
			) }
		</Sec>
	);
}

const SPREADS: Option< Spread >[] = [
	[ 'start', __( 'Packed', 'blicks' ) ], [ 'center', __( 'Centered', 'blicks' ) ], [ 'end', __( 'At the end', 'blicks' ) ],
	[ 'between', __( 'Space between', 'blicks' ) ], [ 'around', __( 'Space around', 'blicks' ) ], [ 'evenly', __( 'Even spacing', 'blicks' ) ],
];

/** The arrangement as preview CSS — what the engine writes, scaled into a small box. */
function previewStyle( a: Arrangement, o: ArrangeOptions ): React.CSSProperties {
	const flex: Record< Align, string > = { start: 'flex-start', center: 'center', end: 'flex-end' };
	const spread = ( pad: Align ) => ( { between: 'space-between', around: 'space-around', evenly: 'space-evenly' } as Record< string, string > )[ o.spread ] ?? flex[ o.spread !== 'start' ? ( o.spread as Align ) : pad ];
	const cross = ( pad: Align ) => ( o.stretch === 'yes' ? 'stretch' : o.stretch === 'base' ? 'baseline' : flex[ pad ] );
	const gap = o.gapC ? '10px 4px' : '4px';
	if ( a === 'stack' ) return { display: 'flex', flexDirection: o.rev ? 'column-reverse' : 'column', gap: 4, alignItems: cross( o.x ), justifyContent: spread( o.y ) };
	if ( a === 'row' ) return { display: 'flex', flexDirection: o.rev ? 'row-reverse' : 'row', flexWrap: o.wrap ? 'wrap' : 'nowrap', gap, justifyContent: spread( o.x ), alignItems: cross( o.y ) };
	if ( a === 'grid' ) {
		return {
			display: 'grid', gap, alignContent: 'start',
			gridTemplateColumns: o.gmode === 'fit' ? `repeat(auto-fit, minmax(${ Math.round( o.minW / 3 ) }px, 1fr))` : `repeat(${ o.cols }, minmax(0, 1fr))`,
			gridAutoFlow: o.flow === 'dense' ? 'row dense' : o.flow, gridAutoRows: o.rowsEq ? '1fr' : undefined,
			placeItems: o.stretch === 'yes' ? 'stretch' : `${ o.y } ${ o.x }`,
		};
	}
	return { display: 'grid', placeItems: o.stretch === 'yes' ? 'stretch' : `${ o.y } ${ o.x }` };
}

/** Arrange → Customise: everything the quick row leaves out, for the arrangement in use. */
function ArrangeEditor( { arrangement, options, arrange, back }: {
	arrangement: Arrangement;
	options: ArrangeOptions;
	arrange: ( a: Arrangement, patch?: Partial< ArrangeOptions > ) => void;
	back: () => void;
} ) {
	const o = options;
	const set = ( patch: Partial< ArrangeOptions > ) => arrange( arrangement, patch );
	const isRow = arrangement === 'row';
	const isGrid = arrangement === 'grid';
	const lineUp = ( dir: 'h' | 'v' ) => (
		<SegIcons
			options={ [
				[ 'no', __( 'Use the placement pad', 'blicks' ), dir === 'h' ? 'M4 12h16M8 8v8M14 10v4' : 'M12 4v16M8 8h8M10 14h4' ],
				[ 'yes', __( 'Stretch to fill', 'blicks' ), dir === 'h' ? 'M4 6v12M20 6v12M7 9h10M7 15h10' : 'M6 4h12M6 20h12M9 7v10M15 7v10' ],
				...( isRow ? [ [ 'base', __( 'Line up the text', 'blicks' ), 'M4 16h16M7 16V9M12 16V6M17 16v-5' ] as Option ] : [] ),
			] as Option< ArrangeOptions[ 'stretch' ] >[] }
			value={ o.stretch }
			onChange={ ( stretch ) => set( { stretch } ) }
		/>
	);
	const gaps = (
		<Sec title={ __( 'Space between', 'blicks' ) } icon="horizontal_distribute">
			<Row label={ __( 'Space between', 'blicks' ) } stack hint="gap">
				<Steps label={ __( 'Space between', 'blicks' ) } options={ GAPS } value={ o.gap } onChange={ ( gap ) => set( { gap } ) } />
			</Row>
			<Exact value={ o.gap } isStep={ GAPS.some( ( [ v ] ) => v === o.gap ) } label={ __( 'Exact space between', 'blicks' ) } onChange={ ( gap ) => set( { gap } ) } />
			{ ( isRow || isGrid ) && (
				<>
					<Switch label={ __( 'Different space between lines', 'blicks' ) } hint={ __( 'When things wrap onto a new line', 'blicks' ) } checked={ !! o.gapC } onChange={ ( on ) => set( { gapC: on ? ( o.gap === '2xl' ? 'md' : '2xl' ) : '' } ) } />
					{ o.gapC && (
						<>
							<Row label={ __( 'Between lines', 'blicks' ) } stack hint="row-gap">
								<Steps label={ __( 'Between lines', 'blicks' ) } options={ GAPS } value={ o.gapC } onChange={ ( gapC ) => set( { gapC } ) } />
							</Row>
							<Exact value={ o.gapC } isStep={ GAPS.some( ( [ v ] ) => v === o.gapC ) } label={ __( 'Exact space between lines', 'blicks' ) } onChange={ ( gapC ) => set( { gapC } ) } />
						</>
					) }
				</>
			) }
		</Sec>
	);
	const name = ARRANGE.find( ( q ) => q[ 0 ] === arrangement )?.[ 1 ] ?? '';

	return (
		<SubView title={ `${ __( 'Arrange', 'blicks' ) } · ${ name }` } onBack={ back } clearLabel={ __( 'Back to the simple settings', 'blicks' ) } onClear={ () => arrange( arrangement, { ...arrangeDefaults( arrangement ), x: o.x, y: o.y, gap: o.gap, cols: Math.min( o.cols, 4 ), colsPhone: o.colsPhone } ) }>
			{ /* "As it comes" has nothing to customise, so the switcher here leaves it out. */ }
			<Row label={ __( 'Arrange', 'blicks' ) }>
				<SegIcons label={ __( 'Arrange', 'blicks' ) } options={ ARRANGE.filter( ( q ) => q[ 0 ] !== 'none' ).map( ( [ v, l, d ] ) => [ v, l, d ] as Option< Arrangement > ) } value={ arrangement } onChange={ ( a ) => arrange( a ) } />
			</Row>
			<div className="arr-prev" aria-hidden="true">
				<div className={ `pv${ isGrid ? ' is-grid' : '' }${ arrangement === 'layers' ? ' is-layers' : '' }` } style={ previewStyle( arrangement, o ) }><i /><i /><i /></div>
			</div>

			{ arrangement === 'stack' && (
				<>
					<Sec title={ __( 'Order and line up', 'blicks' ) } icon="align_horizontal_left">
						<Row label={ __( 'Order', 'blicks' ) } stack set={ o.rev } hint="flex-direction">
							<SegText label={ __( 'Order', 'blicks' ) } options={ [ [ 'no', __( 'Top first', 'blicks' ) ], [ 'yes', __( 'Bottom first', 'blicks' ) ] ] } value={ o.rev ? 'yes' : 'no' } onChange={ ( v ) => set( { rev: v === 'yes' } ) } />
						</Row>
						<Row label={ __( 'Across', 'blicks' ) } hint="align-items">
							{ lineUp( 'h' ) }
						</Row>
						<Row label={ __( 'Down the box', 'blicks' ) } stack hint="justify-content" note={ __( 'Shows once the box is taller than what it holds.', 'blicks' ) } noteIcon="info">
							<Chips label={ __( 'Down the box', 'blicks' ) } options={ SPREADS } value={ o.spread } onChange={ ( spread ) => set( { spread } ) } />
						</Row>
					</Sec>
					{ gaps }
				</>
			) }

			{ isRow && (
				<>
					<Sec title={ __( 'Order and line up', 'blicks' ) } icon="align_horizontal_left">
						<Row label={ __( 'Order', 'blicks' ) } stack set={ o.rev } hint="flex-direction">
							<SegText label={ __( 'Order', 'blicks' ) } options={ [ [ 'no', __( 'Left to right', 'blicks' ) ], [ 'yes', __( 'Right to left', 'blicks' ) ] ] } value={ o.rev ? 'yes' : 'no' } onChange={ ( v ) => set( { rev: v === 'yes' } ) } />
						</Row>
						<Row label={ __( 'Along the row', 'blicks' ) } stack hint="justify-content">
							<Chips label={ __( 'Along the row', 'blicks' ) } options={ SPREADS } value={ o.spread } onChange={ ( spread ) => set( { spread } ) } />
						</Row>
						<Row label={ __( 'Up and down', 'blicks' ) } hint="align-items">
							{ lineUp( 'v' ) }
						</Row>
						<Switch label={ __( 'Wrap onto new lines', 'blicks' ) } hint={ __( 'Otherwise everything stays on one line', 'blicks' ) } checked={ o.wrap } onChange={ ( wrap ) => set( { wrap } ) } />
					</Sec>
					{ gaps }
					<Sec title={ __( 'On phones', 'blicks' ) } icon="smartphone">
						<Switch label={ __( 'One under another', 'blicks' ) } checked={ o.stackPhone } onChange={ ( stackPhone ) => set( { stackPhone } ) } />
					</Sec>
				</>
			) }

			{ isGrid && (
				<>
					<Sec title={ __( 'Columns', 'blicks' ) } icon="view_column">
						<Row label={ __( 'Columns', 'blicks' ) } stack hint="grid-template-columns">
							<SegText label={ __( 'Columns', 'blicks' ) } options={ [ [ 'count', __( 'Set number', 'blicks' ) ], [ 'fit', __( 'Fit to width', 'blicks' ) ] ] } value={ o.gmode } onChange={ ( gmode ) => set( { gmode: gmode as ArrangeOptions[ 'gmode' ] } ) } />
						</Row>
						{ o.gmode === 'count' ? (
							<>
								<Row label={ __( 'How many', 'blicks' ) } stack>
									<SegText label={ __( 'How many', 'blicks' ) } options={ [ '1', '2', '3', '4', '5', '6' ].map( ( n ) => [ n, n ] as Option ) } value={ String( o.cols ) } onChange={ ( n ) => set( { cols: Number( n ) } ) } />
								</Row>
								<Row label={ __( 'On tablets', 'blicks' ) } stack set={ o.tabCols !== 0 }>
									<SegText label={ __( 'On tablets', 'blicks' ) } options={ [ [ '0', __( 'Same', 'blicks' ) ], [ '1', '1' ], [ '2', '2' ], [ '3', '3' ] ] } value={ String( o.tabCols ) } onChange={ ( n ) => set( { tabCols: Number( n ) } ) } />
								</Row>
							</>
						) : (
							<>
								<Slider label={ __( 'Each at least', 'blicks' ) } min={ 120 } max={ 400 } step={ 10 } value={ o.minW } onChange={ ( minW ) => set( { minW } ) } />
								<Note>{ __( 'As many columns as fit, never narrower than this.', 'blicks' ) }</Note>
							</>
						) }
						<Switch label={ __( 'One column on phones', 'blicks' ) } checked={ o.colsPhone } onChange={ ( colsPhone ) => set( { colsPhone } ) } />
					</Sec>
					<Sec title={ __( 'Rows', 'blicks' ) } icon="view_agenda">
						<Row label={ __( 'Row height', 'blicks' ) } stack set={ o.rowsEq } hint="grid-auto-rows">
							<SegText label={ __( 'Row height', 'blicks' ) } options={ [ [ 'no', __( 'Fit content', 'blicks' ) ], [ 'yes', __( 'All the same height', 'blicks' ) ] ] } value={ o.rowsEq ? 'yes' : 'no' } onChange={ ( v ) => set( { rowsEq: v === 'yes' } ) } />
						</Row>
						<Row label={ __( 'Fill order', 'blicks' ) } stack hint="grid-auto-flow">
							<SegText label={ __( 'Fill order', 'blicks' ) } options={ [ [ 'row', __( 'Across', 'blicks' ) ], [ 'column', __( 'Down', 'blicks' ) ], [ 'dense', __( 'Fill gaps', 'blicks' ) ] ] } value={ o.flow } onChange={ ( flow ) => set( { flow: flow as ArrangeOptions[ 'flow' ] } ) } />
						</Row>
					</Sec>
					<Sec title={ __( 'Inside each cell', 'blicks' ) } icon="grid_view">
						<Row label={ __( 'Sits', 'blicks' ) } hint="place-items">
							<AlignPad x={ o.x } y={ o.y } onChange={ ( x, y ) => set( { x, y, stretch: 'no' } ) } />
						</Row>
						<Switch label={ __( 'Fill the cell', 'blicks' ) } checked={ o.stretch === 'yes' } onChange={ ( on ) => set( { stretch: on ? 'yes' : 'no' } ) } />
					</Sec>
					{ gaps }
				</>
			) }

			{ arrangement === 'layers' && (
				<>
					<Row label={ __( 'Top layer sits', 'blicks' ) } hint="place-items" note={ __( 'Later blocks sit on top. Drag a block down in the list to bring it forward.', 'blicks' ) } noteIcon="info">
						<AlignPad x={ o.x } y={ o.y } onChange={ ( x, y ) => set( { x, y, stretch: 'no' } ) } />
					</Row>
					<Switch label={ __( 'Fill the whole box', 'blicks' ) } hint={ __( 'Every layer covers the box', 'blicks' ) } checked={ o.stretch === 'yes' } onChange={ ( on ) => set( { stretch: on ? 'yes' : 'no' } ) } />
				</>
			) }
		</SubView>
	);
}

/**
 * The Box's Settings tab, as the Box inspector design draws it. Every choice writes ordinary style
 * values (model.ts), so what it sets stays editable in the Style tab.
 */
export function BoxSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const [ arrEdit, setArrEdit ] = useState( false );
	const [ lineEdit, setLineEdit ] = useState< '' | 'thick' | 'length' | 'room' >( '' );
	const isEmpty = useSelect( ( select: any ) => ! clientId || select( 'core/block-editor' ).getBlockCount( clientId ) === 0, [ clientId ] );
	const kind = cleanKind( attributes.kind );
	const tree: Tree = attributes.blicks ?? {};
	const setTree = ( blicks: Tree, extra: Record< string, unknown > = {} ) => setAttributes( { blicks, ...extra } );

	const pickKind = ( k: BoxKind ) => {
		if ( k !== kind ) setAttributes( kindAttributes( k ) );
	};

	const kindSec = (
		<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( KINDS, kind ) }>
			<Row label={ __( 'What is it?', 'blicks' ) } stack set={ kind !== 'plain' } note={ __( 'Picking another kind starts its look over.', 'blicks' ) } noteIcon="info">
			<div className="lookgrid" role="radiogroup" aria-label={ __( 'Kind', 'blicks' ) }>
				{ KINDS.map( ( [ v, l, hint ] ) => {
					// A badge, divider or spacer holds no blocks; switching to one would drop them.
					const blocked = ! isEmpty && LEAF_KINDS.includes( v ) && v !== kind;
					return (
						<button key={ v } type="button" role="radio" className="lookc" aria-checked={ kind === v } disabled={ blocked } title={ blocked ? __( 'Empty the box first', 'blicks' ) : undefined } onClick={ () => pickKind( v ) }>
							<span className="lookw">{ KIND_VIZ[ v ] }</span>
							<b>{ l }</b>
							<small>{ hint }</small>
						</button>
					);
				} ) }
			</div>
			</Row>
		</Sec>
	);

	if ( kind === 'spacer' ) {
		const { room, height, phone, phoneHeight } = readRoom( tree );
		// A step keeps the phone rule: half follows the new height, the others stay as they are.
		const pickRoom = ( r: Room ) => setTree( applyExactRoom( tree, ROOM_LEN[ r ] ) );
		const shown = ( len: string ) => ROOM_PX[ ( Object.keys( ROOM_LEN ) as Room[] ).find( ( k ) => ROOM_LEN[ k ] === len ) as Room ] ?? len;

		if ( lineEdit === 'room' ) {
			return (
				<SubView title={ __( 'How much room', 'blicks' ) } onBack={ () => setLineEdit( '' ) } clearLabel={ __( 'Back to medium', 'blicks' ) } onClear={ () => setTree( applyPhoneRoom( applyExactRoom( tree, ROOM_LEN.lg ), 'half' ) ) }>
					<Row label={ __( 'Room', 'blicks' ) } stack hint="height">
						<Steps label={ __( 'Room', 'blicks' ) } options={ ROOMS } value={ room || null } onChange={ pickRoom } />
					</Row>
					<Exact value={ room ? '' : height } isStep={ !! room } label={ __( 'Exact room', 'blicks' ) } placeholder="48px" onChange={ ( h ) => setTree( applyExactRoom( tree, h ) ) } />
					<Row label={ __( 'On phones', 'blicks' ) } stack>
						<SegText label={ __( 'On phones', 'blicks' ) } options={ PHONE_ROOMS } value={ phone || null } onChange={ ( v ) => setTree( applyPhoneRoom( tree, v ) ) } />
					</Row>
					<Exact value={ phone ? '' : phoneHeight } isStep={ !! phone } label={ __( 'Exact room on phones', 'blicks' ) } placeholder="24px" onChange={ ( h ) => setTree( applyPhoneRoom( tree, h ) ) } />
				</SubView>
			);
		}

		return (
			<>
				{ kindSec }
				<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio" value={ shown( height ) }>
					<Row label={ __( 'How much room', 'blicks' ) } stack set action={ { label: ! room || ( phone !== 'half' && phone !== 'same' ) ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setLineEdit( 'room' ) } }>
						<Steps label={ __( 'How much room', 'blicks' ) } options={ ROOMS } value={ room || null } onChange={ pickRoom } />
					</Row>
					<Switch label={ __( 'Half as much on phones', 'blicks' ) } checked={ phone === 'half' } onChange={ ( on ) => setTree( applyPhoneRoom( tree, on ? 'half' : 'same' ) ) } />
				</Sec>
			</>
		);
	}

	if ( kind === 'divider' ) {
		const thick = readThickness( tree );
		const px = readThicknessPx( tree );
		const length = readLength( tree );
		const width = String( baseOf( tree, 'layout.width' ) ?? '' );
		const phoneFull = readLengthPhoneFull( tree );
		// Round ends and placement are part of the line's look, so they go through the style model.
		const lookOpts = { linked: !! String( attributes.href || '' ).trim(), kind: 'divider' };
		const { look } = readStyle( tree, lookOpts );
		const setLook = ( patch: Partial< Look > ) => setTree( writeStyle( tree, { ...look, ...patch }, lookOpts ) );
		const round = look.radius === 'full';
		const back = () => setLineEdit( '' );

		if ( lineEdit === 'thick' ) {
			return (
				<SubView title={ __( 'Thickness', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to thin', 'blicks' ) } onClear={ () => { setTree( writeStyle( applyThickness( tree, 'thin' ), { ...look, radius: '' }, lookOpts ) ); } }>
					<Row label={ __( 'Thickness', 'blicks' ) } stack hint="border-width">
						<Steps label={ __( 'Thickness', 'blicks' ) } options={ THICK } value={ thick || null } onChange={ ( t ) => setTree( applyThickness( tree, t ) ) } />
					</Row>
					<Slider label={ __( 'Exact', 'blicks' ) } min={ 1 } max={ 24 } value={ px } unit="px" onChange={ ( n ) => setTree( applyThicknessPx( tree, n ) ) } />
					<Switch label={ __( 'Round ends', 'blicks' ) } hint={ __( 'Shows on thicker lines', 'blicks' ) } checked={ round } onChange={ ( on ) => setLook( { radius: on ? 'full' : '' } ) } />
					{ look.dline !== 'solid' && <Note>{ __( 'Dashed, dotted and double lines keep their own weight. Switch the line to solid in Style to use this thickness.', 'blicks' ) }</Note> }
				</SubView>
			);
		}
		if ( lineEdit === 'length' ) {
			return (
				<SubView title={ __( 'Length', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to full width', 'blicks' ) } onClear={ () => { setTree( writeStyle( applyLengthPhoneFull( applyLength( tree, 'fill' ), false ), { ...look, dalign: 'start' }, lookOpts ) ); } }>
					<Row label={ __( 'Length', 'blicks' ) } stack hint="width">
						<SegText label={ __( 'Length', 'blicks' ) } options={ LENGTHS } value={ length || null } onChange={ ( l ) => setTree( applyLength( tree, l ) ) } />
					</Row>
					<Exact value={ length ? '' : width } isStep={ !! length } label={ __( 'Exact length', 'blicks' ) } placeholder="120px" onChange={ ( w ) => setTree( applyExactLength( tree, w ) ) } />
					{ length !== 'fill' && (
						<>
							<Row label={ __( 'Line up', 'blicks' ) }>
								<SegIcons label={ __( 'Line up', 'blicks' ) } options={ LINE_UP } value={ look.dalign } onChange={ ( dalign ) => setLook( { dalign } ) } />
							</Row>
							<Switch label={ __( 'Full width on phones', 'blicks' ) } checked={ phoneFull } onChange={ ( on ) => setTree( applyLengthPhoneFull( tree, on ) ) } />
						</>
					) }
				</SubView>
			);
		}

		const thickCustom = ! thick || round;
		const lengthCustom = ! length || look.dalign !== 'start' || phoneFull;
		return (
			<>
				{ kindSec }
				<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio">
					<Row label={ __( 'Thickness', 'blicks' ) } stack set={ thick !== 'thin' } note={ `${ px }px` } action={ { label: thickCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setLineEdit( 'thick' ) } }>
						<Steps label={ __( 'Thickness', 'blicks' ) } options={ THICK } value={ thick || null } onChange={ ( t ) => setTree( applyThickness( tree, t ) ) } />
					</Row>
					<Row label={ __( 'Length', 'blicks' ) } stack set={ length !== 'fill' } note={ length ? undefined : width } action={ { label: lengthCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setLineEdit( 'length' ) } }>
						<SegText label={ __( 'Length', 'blicks' ) } options={ LENGTHS } value={ length || null } onChange={ ( l ) => setTree( applyLength( tree, l ) ) } />
					</Row>
				</Sec>
			</>
		);
	}

	if ( kind === 'badge' ) {
		return (
			<>
				{ kindSec }
				<LinkSec attributes={ attributes } setAttributes={ setAttributes } />
			</>
		);
	}

	const { arrangement, options } = readArrange( tree, !! attributes.layers );
	const arrange = ( a: Arrangement, patch: Partial< ArrangeOptions > = {} ) => {
		const result = rearrange( tree, !! attributes.layers, a, patch );
		setTree( result.tree, { layers: result.layers } );
	};

	if ( arrEdit && arrangement !== 'none' ) {
		return <ArrangeEditor arrangement={ arrangement } options={ options } arrange={ arrange } back={ () => setArrEdit( false ) } />;
	}
	const current = ARRANGE.find( ( q ) => q[ 0 ] === arrangement )!;
	// No width at all is a block's own: it fills the space it sits in.
	const width = readWidth( tree ) || ( baseOf( tree, 'layout.width' ) ? '' : 'fill' );
	const height = readHeight( tree );
	const exactWidth = width ? '' : String( baseOf( tree, 'layout.width' ) ?? '' );
	const exactHeight = height ? '' : String( baseOf( tree, 'layout.minHeight' ) ?? '' );

	return (
		<>
			{ kindSec }

			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ current[ 1 ] }>
				<Row
					label={ __( 'Arrange what’s inside', 'blicks' ) }
					stack
					set={ arrangement !== 'none' }
					note={ current[ 3 ] }
					action={ arrangement !== 'none' ? { label: isCustomArrange( arrangement, options ) ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setArrEdit( true ) } : undefined }
				>
					<SegIcons label={ __( 'Arrange', 'blicks' ) } options={ ARRANGE.map( ( [ v, l, d ] ) => [ v, l, d ] as Option< Arrangement > ) } value={ arrangement } onChange={ ( a ) => arrange( a ) } />
				</Row>
				{ ( arrangement === 'stack' || arrangement === 'row' || arrangement === 'layers' ) && (
					<Row label={ __( 'Line up', 'blicks' ) } set={ options.x !== 'start' || options.y !== 'start' } note={ arrangement === 'layers' ? __( 'Where the top layer sits.', 'blicks' ) : __( 'Where things sit.', 'blicks' ) }>
						<AlignPad x={ options.x } y={ options.y } onChange={ ( x, y ) => arrange( arrangement, { x, y } ) } />
					</Row>
				) }
				{ arrangement !== 'none' && arrangement !== 'layers' && (
					<Row label={ __( 'Space between', 'blicks' ) } stack hint="gap" set={ options.gap !== 'md' }>
						<Steps label={ __( 'Space between', 'blicks' ) } options={ GAPS } value={ GAPS.some( ( [ v ] ) => v === options.gap ) ? options.gap : null } onChange={ ( gap ) => arrange( arrangement, { gap } ) } />
					</Row>
				) }
				{ /* Phone behaviour as toggles: they write the phone values, as the Customise view does. */ }
				{ arrangement === 'row' && <Switch label={ __( 'Stack on phones', 'blicks' ) } hint={ __( 'One under another on small screens', 'blicks' ) } checked={ options.stackPhone } onChange={ ( stackPhone ) => arrange( arrangement, { stackPhone } ) } /> }
				{ arrangement === 'grid' && <Switch label={ __( 'One column on phones', 'blicks' ) } checked={ options.colsPhone } onChange={ ( colsPhone ) => arrange( arrangement, { colsPhone } ) } /> }
				<Switch label={ __( 'Stay on screen when scrolling', 'blicks' ) } hint={ __( 'Sticks to the top of the window', 'blicks' ) } checked={ readSticky( tree ) } onChange={ ( on ) => setTree( applySticky( tree, on ) ) } />
			</Sec>

			<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio" value={ [ exactWidth || WIDTHS.find( ( [ v ] ) => v === width )?.[ 1 ], exactHeight || ( height && height !== 'auto' ? HEIGHTS.find( ( [ v ] ) => v === height )?.[ 2 ] : '' ) ].filter( Boolean ).join( ' · ' ) }>
				<Row label={ __( 'Width', 'blicks' ) } stack set={ !! exactWidth || ( !! width && width !== 'fill' ) }>
					<Steps label={ __( 'Width', 'blicks' ) } options={ WIDTHS } value={ width || null } onChange={ ( w ) => setTree( applyWidth( tree, w ) ) } />
				</Row>
				<Exact value={ exactWidth } isStep={ !! width } label={ __( 'Exact width', 'blicks' ) } placeholder="640px" onChange={ ( w ) => setTree( applyExactWidth( tree, w ) ) } />
				<Row label={ __( 'Height', 'blicks' ) } stack set={ !! exactHeight || ( !! height && height !== HEIGHTS[ 0 ]![ 0 ] ) } note={ exactHeight ? sprintf( /* translators: %s: a length such as 400px */ __( 'At least %s', 'blicks' ), exactHeight ) : undefined }>
					<SegText label={ __( 'Height', 'blicks' ) } options={ HEIGHTS.map( ( [ v, l ] ) => [ v, l ] as Option< Height > ) } value={ height || null } onChange={ ( h ) => setTree( applyHeight( tree, h ) ) } />
				</Row>
				<Exact value={ exactHeight } isStep={ !! height } label={ __( 'Exact height, at least', 'blicks' ) } placeholder="400px" onChange={ ( h ) => setTree( applyExactHeight( tree, h ) ) } />
			</Sec>

			<LinkSec attributes={ attributes } setAttributes={ setAttributes } />

			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new" value={ TAGS.find( ( [ v ] ) => v === cleanTag( attributes.tag ) )?.[ 1 ] }>
				<Row label={ __( 'Meaning', 'blicks' ) } stack set={ cleanTag( attributes.tag ) !== 'div' } hint={ `<${ cleanTag( attributes.tag ) }>` } note={ sprintf( /* translators: %s: an HTML tag such as <section> */ __( 'Saved as %s. Helps search engines and screen readers; doesn’t change the look.', 'blicks' ), `<${ cleanTag( attributes.tag ) }>` ) } noteIcon="code">
					<Select value={ cleanTag( attributes.tag ) } options={ TAGS } label={ __( 'What this is, for search engines and screen readers', 'blicks' ) } onChange={ ( tag ) => setAttributes( { tag } ) } />
				</Row>
				<HideFromReaders attributes={ attributes } setAttributes={ setAttributes } />
			</Sec>
		</>
	);
}

/** The Box's Style tab: the shared Style panel, with the sections its kind has. */
export function BoxStyle( { attributes, setAttributes }: PanelProps ) {
	const kind = cleanKind( attributes.kind );
	return (
		<StylePanel
			attributes={ attributes }
			setAttributes={ setAttributes }
			kind={ kind === 'badge' || kind === 'divider' ? kind : 'box' }
			linked={ !! String( attributes.href || '' ).trim() }
		/>
	);
}

/** The Box's Motion tab. A divider and a spacer do not move. */
export function BoxMotion( { attributes, setAttributes }: PanelProps ) {
	const kind = cleanKind( attributes.kind );
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ !! String( attributes.href || '' ).trim() } kind={ kind === 'badge' ? 'badge' : 'box' } />;
}

const tagGlyph = <Icon d="M9 8l-4 4 4 4M15 8l4 4-4 4" size={ 24 } />;

/** A kind's starting look, as picking it in "What is it?" writes it. */
export function kindAttributes( k: BoxKind ) {
	const look = applyKind( k );
	return { kind: k, blicks: look.blicks, tag: look.tag, layers: look.layers };
}

/**
 * The Box's toolbar, by kind — the writes its Settings tab makes. Every kind: What is it (leaf kinds
 * only while empty). A container: Arrange, Width and its tag. A divider: Thickness and Length. A
 * spacer: Room. A badge has no more.
 */
export function BoxToolbar( { attributes, setAttributes, clientId }: PanelProps ) {
	const isEmpty = useSelect( ( select: any ) => ! clientId || select( 'core/block-editor' ).getBlockCount( clientId ) === 0, [ clientId ] );
	const kind = cleanKind( attributes.kind );
	const tree: Tree = attributes.blicks ?? {};
	const setTree = ( blicks: Tree ) => setAttributes( { blicks } );
	const kindChoice = (
		<ToolbarChoice
			label={ __( 'What is it?', 'blicks' ) }
			value={ kind }
			options={ KINDS }
			disabled={ ( v ) => ! isEmpty && LEAF_KINDS.includes( v as BoxKind ) && v !== kind }
			onChange={ ( k ) => setAttributes( kindAttributes( k as BoxKind ) ) }
		/>
	);

	if ( kind === 'divider' ) {
		return (
			<ToolbarGroup>
				{ kindChoice }
				<ToolbarChoice label={ __( 'Thickness', 'blicks' ) } value={ readThickness( tree ) } options={ THICK } onChange={ ( t ) => setTree( applyThickness( tree, t as Thickness ) ) } />
				<ToolbarChoice label={ __( 'Length', 'blicks' ) } value={ readLength( tree ) } options={ LENGTHS } onChange={ ( l ) => setTree( applyLength( tree, l as Length ) ) } />
			</ToolbarGroup>
		);
	}
	if ( kind === 'spacer' ) {
		return (
			<ToolbarGroup>
				{ kindChoice }
				<ToolbarChoice label={ __( 'How much room', 'blicks' ) } value={ readRoom( tree ).room } options={ ROOMS } onChange={ ( r ) => setTree( applyExactRoom( tree, ROOM_LEN[ r as Room ] ) ) } />
			</ToolbarGroup>
		);
	}
	if ( LEAF_KINDS.includes( kind ) ) return <ToolbarGroup>{ kindChoice }</ToolbarGroup>;

	const { arrangement } = readArrange( tree, !! attributes.layers );
	const width = readWidth( tree ) || ( baseOf( tree, 'layout.width' ) ? '' : 'fill' );
	const current = cleanTag( attributes.tag );
	return (
		<>
			<ToolbarGroup>{ kindChoice }</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarSegments
					value={ arrangement }
					options={ ARRANGE.filter( ( [ v ] ) => v !== 'none' ) }
					onChange={ ( a ) => {
						const result = rearrange( tree, !! attributes.layers, a as Arrangement );
						setAttributes( { blicks: result.tree, layers: result.layers } );
					} }
				/>
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'Width', 'blicks' ) } value={ width } options={ WIDTHS } onChange={ ( w ) => setTree( applyWidth( tree, w as Width ) ) } />
				<ToolbarDropdownMenu
					icon={ tagGlyph }
					text={ `<${ current }>` }
					label={ __( 'Meaning', 'blicks' ) }
					controls={ TAGS.map( ( [ v, l ] ) => ( {
						title: `<${ v }> — ${ l }`,
						isActive: current === v,
						onClick: () => setAttributes( { tag: v } ),
					} ) ) }
				/>
			</ToolbarGroup>
		</>
	);
}
