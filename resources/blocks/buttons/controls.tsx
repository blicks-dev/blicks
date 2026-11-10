import { __, sprintf } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice, ToolbarSegments } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { readStyle, writeStyle } from '@/framework/inspector-v2/style-model';
import { Icon, Row, SegIcons, SegText, Sec, Steps, Switch, type Option } from '@/framework/inspector-v2/kit';
import { withValue } from '@/blocks/box/model';
import { gapToken, orientationOf, withStyleLayout, wrapOf } from '@/framework/layout-source';

const ORIENTATION_OPTIONS = [
	{ label: __( 'Horizontal', 'blicks' ), value: 'horizontal' },
	{ label: __( 'Vertical', 'blicks' ), value: 'vertical' },
];

// `xs` (Tight) is no longer offered but still read, so buttons saved with it keep their spacing.
const GAP_OPTIONS = [
	{ label: __( 'None', 'blicks' ), value: 'none' },
	{ label: __( 'XS', 'blicks' ), value: 'xs' },
	{ label: __( 'SM', 'blicks' ), value: 'sm' },
	{ label: __( 'MD', 'blicks' ), value: 'md' },
	{ label: __( 'LG', 'blicks' ), value: 'lg' },
];

const JUSTIFY_OPTIONS = [
	{ label: __( 'Start', 'blicks' ), value: 'flex-start' },
	{ label: __( 'Center', 'blicks' ), value: 'center' },
	{ label: __( 'End', 'blicks' ), value: 'flex-end' },
	{ label: __( 'Between', 'blicks' ), value: 'space-between' },
];

export function buttonsDirection( orientation: unknown ): string {
	return validOption( ORIENTATION_OPTIONS, orientation, 'horizontal' ) === 'vertical' ? 'column' : 'row';
}

export function buttonsGapValue( gap: unknown ): string {
	return gapValue( validOption( GAP_OPTIONS, gap, 'sm' ) );
}

export function buttonsJustifyValue( justify: unknown ): string {
	return validOption( JUSTIFY_OPTIONS, justify, 'flex-start' );
}

function gapValue( gap: string ): string {
	return gap === 'none' ? '0' : `var(--blicks-spacing-${ gap })`;
}

function validOption( options: Array< { value: string } >, value: unknown, fallback: string ): string {
	const next = String( value || fallback );
	return options.some( ( option ) => option.value === next ) ? next : fallback;
}

function writeBaseValue( tree: any, controlId: string, value: string ) {
	return {
		...tree,
		[ controlId ]: {
			...( tree?.[ controlId ] ?? {} ),
			default: {
				...( tree?.[ controlId ]?.default ?? {} ),
				base: value,
			},
		},
	};
}

/** The style values these attributes mirror; a style value, when set, is what the page shows. */
export const buttonsLayout = ( attributes: any ) => withStyleLayout( attributes, {
	orientation: [ 'layout.flexDirection', orientationOf ],
	gap: [ 'layout.gapRow', gapToken ],
	justify: [ 'layout.justifyContent', ( v ) => v ],
	wrap: [ 'layout.flexWrap', wrapOf ],
} );

function updateButtonsLayout(
	attributes: any,
	setAttributes: ( a: any ) => void,
	next: Partial< { orientation: string; gap: string; justify: string; wrap: boolean } >
) {
	const now = buttonsLayout( attributes );
	const orientation = validOption( ORIENTATION_OPTIONS, next.orientation ?? now.orientation, 'horizontal' );
	const gap = validOption( GAP_OPTIONS, next.gap ?? now.gap, 'sm' );
	const justify = validOption( JUSTIFY_OPTIONS, next.justify ?? now.justify, 'flex-start' );
	const wrap = Boolean( next.wrap ?? now.wrap );

	let blicks = { ...( attributes.blicks ?? {} ) };
	blicks = writeBaseValue( blicks, 'layout.flexDirection', orientation === 'vertical' ? 'column' : 'row' );
	blicks = writeBaseValue( blicks, 'layout.gapRow', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.gapColumn', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.justifyContent', justify );
	blicks = writeBaseValue( blicks, 'layout.flexWrap', wrap ? 'wrap' : 'nowrap' );

	setAttributes( { ...next, orientation, gap, justify, wrap, blicks } );
}

export function setButtonsOrientation(
	attributes: any,
	setAttributes: ( a: any ) => void,
	orientation: string
) {
	// Side by side or stacked is a flex row or column, so picking one leaves the grid.
	updateButtonsLayout( { ...attributes, blicks: withButtonsGrid( attributes.blicks, null ) }, setAttributes, { orientation } );
}

export const GRID_COLUMNS = [ 2, 3, 4, 6 ] as const;
const gridTemplate = ( n: number ) => `repeat(${ n }, minmax(0, 1fr))`;
const columnsOf = ( v: unknown ) => Number( /^repeat\((\d+),/.exec( String( v ?? '' ) )?.[ 1 ] ) || 0;

/**
 * The buttons as a grid of equal columns, read from the style values (`layout.display: grid` and
 * `layout.gridColumns`), or null when they sit in a row or a column.
 */
export function buttonsGrid( tree: any ): { columns: number; phoneTwo: boolean } | null {
	if ( tree?.[ 'layout.display' ]?.default?.base !== 'grid' ) return null;
	const columns = columnsOf( tree?.[ 'layout.gridColumns' ]?.default?.base ) || 3;
	return { columns, phoneTwo: columnsOf( tree?.[ 'layout.gridColumns' ]?.default?.mobile ) === 2 };
}

/** Turns the grid on with this many columns (two on phones when asked), or off with null. */
export function withButtonsGrid( tree: any, columns: number | null, phoneTwo = true ) {
	const next = { ...( tree ?? {} ) };
	delete next[ 'layout.gridColumns' ];
	if ( columns === null ) {
		delete next[ 'layout.display' ];
		return next;
	}
	let out = withValue( next, 'layout.display', 'grid' );
	out = withValue( out, 'layout.gridColumns', gridTemplate( columns ) );
	return phoneTwo && columns > 2 ? withValue( out, 'layout.gridColumns', gridTemplate( 2 ), 'default', 'mobile' ) : out;
}

/** True when the row turns into a stack on phones. */
export function readStackPhone( tree: any ): boolean {
	return tree?.[ 'layout.flexDirection' ]?.default?.mobile === 'column';
}

export function withStackPhone( tree: any, on: boolean ) {
	return withValue( tree ?? {}, 'layout.flexDirection', on ? 'column' : undefined, 'default', 'mobile' );
}

const ARRANGE: Option[] = [
	[ 'horizontal', __( 'Side by side', 'blicks' ), 'M3 8h7v8H3zM14 8h7v8h-7z' ],
	[ 'vertical', __( 'Stacked', 'blicks' ), 'M6 3h12v7H6zM6 14h12v7H6z' ],
	[ 'grid', __( 'Grid', 'blicks' ), 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' ],
];
const COLUMNS: Option[] = GRID_COLUMNS.map( ( n ) => [ String( n ), String( n ) ] );
const ALIGN_ROW: Option[] = [
	[ 'flex-start', __( 'Left', 'blicks' ), 'M4 5v14M8 9h4v6H8zM14 9h4v6h-4z' ],
	[ 'center', __( 'Center', 'blicks' ), 'M12 4v3M12 17v3M6 9h4v6H6zM14 9h4v6h-4z' ],
	[ 'flex-end', __( 'Right', 'blicks' ), 'M20 5v14M6 9h4v6H6zM12 9h4v6h-4z' ],
	[ 'space-between', __( 'Spread out', 'blicks' ), 'M4 5v14M20 5v14M7 9h3v6H7zM14 9h3v6h-3z' ],
];
const ALIGN_COL: Option[] = [
	[ 'flex-start', __( 'Left', 'blicks' ), 'M4 5v14M8 8h10M8 12h6M8 16h8' ],
	[ 'center', __( 'Center', 'blicks' ), 'M12 4v16M6 8h12M8 12h8M7 16h10' ],
	[ 'flex-end', __( 'Right', 'blicks' ), 'M20 5v14M6 8h10M10 12h6M8 16h8' ],
	[ 'space-between', __( 'Full width', 'blicks' ), 'M4 5v14M20 5v14M7 9h10M7 15h10' ],
];
const GAPS: Option[] = [ [ 'none', __( 'None', 'blicks' ) ], [ 'sm', __( 'Small', 'blicks' ) ], [ 'md', __( 'Medium', 'blicks' ) ], [ 'lg', __( 'Large', 'blicks' ) ] ];
const OUTS: Option[] = [ [ '', __( 'None', 'blicks' ) ], [ '16', __( 'Small', 'blicks' ) ], [ '32', __( 'Medium', 'blicks' ) ], [ '48', __( 'Large', 'blicks' ) ] ];

const named = ( list: Option[], v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';

/** The Buttons' Settings tab: how the buttons sit together, and a way to add one. */
export function ButtonsSettings( { attributes: saved, setAttributes, clientId }: PanelProps ) {
	const attributes = buttonsLayout( saved );
	const orientation = validOption( ORIENTATION_OPTIONS, attributes.orientation, 'horizontal' );
	const gap = validOption( GAP_OPTIONS, attributes.gap, 'sm' );
	const justify = validOption( JUSTIFY_OPTIONS, attributes.justify, 'flex-start' );
	const column = orientation === 'vertical';
	const align = column ? ALIGN_COL : ALIGN_ROW;
	const update = ( next: Parameters< typeof updateButtonsLayout >[ 2 ] ) => updateButtonsLayout( attributes, setAttributes, next );
	const { insertBlock } = useDispatch( 'core/block-editor' ) as any;
	const count = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlockCount( clientId ) : 0 ), [ clientId ] );
	// A new button follows the size of the ones already there, in the quieter outline look.
	const lastSize = useSelect( ( select: any ) => {
		const ids = clientId ? select( 'core/block-editor' ).getBlockOrder( clientId ) : [];
		return ids.length ? select( 'core/block-editor' ).getBlockAttributes( ids[ ids.length - 1 ] )?.size : undefined;
	}, [ clientId ] );
	const stackPhone = readStackPhone( attributes.blicks );
	const grid = buttonsGrid( attributes.blicks );
	const setGrid = ( columns: number | null, phoneTwo = grid?.phoneTwo ?? true ) => setAttributes( { blicks: withButtonsGrid( attributes.blicks, columns, phoneTwo ) } );

	return (
		<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ grid ? sprintf( /* translators: %d: number of columns */ __( '%d across', 'blicks' ), grid.columns ) : named( ARRANGE, orientation ) }>
			<Row label={ __( 'Arrange', 'blicks' ) } stack set={ !! grid || column }>
				<SegText label={ __( 'Arrange', 'blicks' ) } options={ ARRANGE } value={ grid ? 'grid' : orientation } onChange={ ( o ) => ( o === 'grid' ? setGrid( 3 ) : setButtonsOrientation( attributes, setAttributes, o ) ) } />
			</Row>
			{ grid ? (
				<Row label={ __( 'Columns', 'blicks' ) } set={ grid.columns !== 3 } hint="grid-template-columns">
					<Steps label={ __( 'Columns', 'blicks' ) } options={ COLUMNS } value={ String( grid.columns ) } onChange={ ( n ) => setGrid( Number( n ) ) } />
				</Row>
			) : (
				<Row label={ __( 'Line up', 'blicks' ) } set={ justify !== 'flex-start' } hint="justify-content">
					<SegIcons label={ __( 'Line up', 'blicks' ) } options={ align } value={ justify } onChange={ ( j ) => update( { justify: j } ) } />
				</Row>
			) }
			<Row label={ __( 'Space between', 'blicks' ) } stack set={ gap !== 'sm' } hint="gap" note={ gap === 'xs' ? __( 'Tight: a smaller step than Small. Pick one to change it.', 'blicks' ) : undefined } noteIcon="info">
				<Steps label={ __( 'Space between', 'blicks' ) } options={ GAPS } value={ GAPS.some( ( [ v ] ) => v === gap ) ? gap : null } onChange={ ( g ) => update( { gap: g } ) } />
			</Row>
			{ grid ? grid.columns > 2 && (
				<Switch label={ __( 'Two across on phones', 'blicks' ) } checked={ grid.phoneTwo } onChange={ ( on ) => setGrid( grid.columns, on ) } />
			) : (
				<>
					<Switch label={ __( 'Wrap onto a new line', 'blicks' ) } hint={ __( 'When there isn’t room', 'blicks' ) } checked={ !! attributes.wrap } onChange={ ( wrap ) => update( { wrap } ) } />
					{ ! column && <Switch label={ __( 'Stack on phones', 'blicks' ) } checked={ stackPhone } onChange={ ( on ) => setAttributes( { blicks: withStackPhone( attributes.blicks, on ) } ) } /> }
				</>
			) }
			{ clientId && (
				<Row label={ __( 'Buttons', 'blicks' ) } stack>
					<button type="button" className="btn-add" onClick={ () => insertBlock( createBlock( 'blicks/button', { variant: 'outline', ...( lastSize ? { size: lastSize } : {} ) } ), count, clientId ) }>
						<Icon d="M12 5v14M5 12h14" size={ 16 } />
						{ __( 'Add a button', 'blicks' ) }
					</button>
				</Row>
			) }
		</Sec>
	);
}

/** The Buttons' Style tab: only the space around the group; each button styles itself. */
export function ButtonsStyle( { attributes, setAttributes }: PanelProps ) {
	const tree = attributes.blicks ?? {};
	const { look } = readStyle( tree, { kind: 'box' } );
	const out = look.out;
	const key = ! out ? '' : out[ 0 ] === out[ 2 ] && ! out[ 1 ] && ! out[ 3 ] && [ 16, 32, 48 ].includes( out[ 0 ] ) ? String( out[ 0 ] ) : null;
	return (
		<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ key === null ? __( 'Custom', 'blicks' ) : named( OUTS, key ) }>
			<Row
				label={ __( 'Above and below', 'blicks' ) }
				stack
				set={ !! out }
				hint="margin-block"
				note={ __( 'Colors, corners and hover belong to each button. Select one to change them.', 'blicks' ) }
				noteIcon="info"
			>
				<Steps label={ __( 'Space above and below', 'blicks' ) } options={ OUTS } value={ key } onChange={ ( o ) => setAttributes( { blicks: writeStyle( tree, { ...look, out: o ? [ Number( o ), 0, Number( o ), 0 ] : null }, { kind: 'box' } ) } ) } />
			</Row>
		</Sec>
	);
}

/** The group's Motion tab: how it arrives. Each Button times its own hover and click. */
export function ButtonsMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="box" timed={ false } />;
}

/**
 * The Buttons' toolbar: Arrange, then Line up (or Columns, in a grid) and Space between — the writes
 * the Settings tab makes, through the same helpers.
 */
export function ButtonsToolbar( { attributes: saved, setAttributes }: PanelProps ) {
	const attributes = buttonsLayout( saved );
	const orientation = validOption( ORIENTATION_OPTIONS, attributes.orientation, 'horizontal' );
	const grid = buttonsGrid( attributes.blicks );
	const update = ( next: Parameters< typeof updateButtonsLayout >[ 2 ] ) => updateButtonsLayout( attributes, setAttributes, next );
	const setGrid = ( columns: number ) => setAttributes( { blicks: withButtonsGrid( attributes.blicks, columns, grid?.phoneTwo ?? true ) } );
	return (
		<>
			<ToolbarGroup>
				<ToolbarSegments value={ grid ? 'grid' : orientation } options={ ARRANGE } onChange={ ( o ) => ( o === 'grid' ? setGrid( 3 ) : setButtonsOrientation( attributes, setAttributes, o ) ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				{ grid ? (
					<ToolbarChoice label={ __( 'Columns', 'blicks' ) } value={ String( grid.columns ) } options={ COLUMNS.map( ( [ v ] ) => [ v, sprintf( /* translators: %s: number of columns */ __( '%s across', 'blicks' ), v ) ] as const ) } onChange={ ( n ) => setGrid( Number( n ) ) } />
				) : (
					<ToolbarChoice label={ __( 'Line up', 'blicks' ) } value={ validOption( JUSTIFY_OPTIONS, attributes.justify, 'flex-start' ) } options={ orientation === 'vertical' ? ALIGN_COL : ALIGN_ROW } onChange={ ( justify ) => update( { justify } ) } />
				) }
				<ToolbarChoice label={ __( 'Space between', 'blicks' ) } value={ validOption( GAP_OPTIONS, attributes.gap, 'sm' ) } options={ GAPS } onChange={ ( gap ) => update( { gap } ) } />
			</ToolbarGroup>
		</>
	);
}
