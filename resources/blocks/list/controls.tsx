import { useMemo, useState } from 'react';
import { useDispatch, useSelect } from '@wordpress/data';
import { ToolbarGroup } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { TypeStyle } from '@/framework/inspector-v2/TypeStyle';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { ListMeaning } from '@/framework/inspector-v2/More';
import { Field, Opts, Row, SegIcons, SegText, Sec, Slider, Steps, SubView, Swatches, Switch, type Option, type Swatch } from '@/framework/inspector-v2/kit';
import { colourCss } from '@/framework/inspector-v2/style-model';
import { resolveTokenValues } from '@/controls/token-utils';
import { IconPicker } from '@/controls/IconPicker';
import { renderIcon } from '@/framework/icons/render';
import { getIcon } from '@/framework/icons';
import { outerList } from '@/blocks/list-item/editing';
import {
	cleanArrange, cleanBehind, cleanBullet, cleanColumns, cleanGap, cleanKind, cleanLook, cleanNumber, cleanSeparator, type ListKind,
} from './model';

const KINDS: Array< [ ListKind, string ] > = [ [ 'bullets', __( 'Bullets', 'blicks' ) ], [ 'numbers', __( 'Numbers', 'blicks' ) ], [ 'icons', __( 'Icons', 'blicks' ) ], [ 'plain', __( 'Plain', 'blicks' ) ] ];
const BULLETS: Option[] = [
	[ 'dot', __( 'Dot', 'blicks' ), 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' ],
	[ 'ring', __( 'Ring', 'blicks' ), 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z' ],
	[ 'square', __( 'Square', 'blicks' ), 'M9.5 9.5h5v5h-5z' ],
	[ 'dash', __( 'Dash', 'blicks' ), 'M7 12h10' ],
	[ 'chevron', __( 'Chevron', 'blicks' ), 'M10 8l4 4-4 4' ],
];
const NUMBERS: Option[] = [ [ '1', '1.' ], [ '01', '01' ], [ 'a', 'a.' ], [ 'i', 'i.' ], [ '1.1', '1.1' ] ];
const ARRANGES: Option[] = [
	[ 'stack', __( 'Stacked', 'blicks' ), 'M5 6h14M5 12h14M5 18h14' ],
	[ 'row', __( 'In a row', 'blicks' ), 'M4 12h3M10.5 12h3M17 12h3' ],
	[ 'cols', __( 'Columns', 'blicks' ), 'M4 5h7M4 10h7M4 15h7M13 5h7M13 10h7M13 15h7' ],
];
const SEPARATORS: Option[] = [ [ '', __( 'None', 'blicks' ) ], [ 'dot', '·' ], [ 'slash', '/' ], [ 'pipe', '|' ], [ 'arrow', '→' ] ];
const COLUMNS: Option[] = [ [ '2', __( 'Two', 'blicks' ) ], [ '3', __( 'Three', 'blicks' ) ], [ '4', __( 'Four', 'blicks' ) ] ];
const GAPS: Option[] = [ [ 'tight', __( 'Small', 'blicks' ) ], [ '', __( 'Medium', 'blicks' ) ], [ 'roomy', __( 'Large', 'blicks' ) ], [ 'spacious', __( 'Extra large', 'blicks' ) ] ];
const BEHINDS: Option[] = [
	[ '', __( 'Nothing', 'blicks' ), 'M6 12h12' ],
	[ 'tint', __( 'Soft square', 'blicks' ), 'M6 6h12v12H6z' ],
	[ 'circle', __( 'Soft circle', 'blicks' ), 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z' ],
	[ 'solid', __( 'Solid circle', 'blicks' ), 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' ],
];
const CONTENTS: Option[] = [ [ '', __( 'Words', 'blicks' ) ], [ 'titled', __( 'Title + a line', 'blicks' ) ] ];
const LOOKS: Option[] = [ [ '', __( 'Plain', 'blicks' ) ], [ 'cards', __( 'Cards', 'blicks' ) ], [ 'stripes', __( 'Stripes', 'blicks' ) ] ];
const CORNERS: Option[] = [
	[ 'none', __( 'Square', 'blicks' ), 'M5 19V5h14' ],
	[ '', __( 'Slight', 'blicks' ), 'M5 19V8a3 3 0 0 1 3-3h11' ],
	[ 'md', __( 'Rounded', 'blicks' ), 'M5 19V12a7 7 0 0 1 7-7h7' ],
	[ 'lg', __( 'Round', 'blicks' ), 'M5 19v-4a10 10 0 0 1 10-10h4' ],
];
/** The marker's colour: the text's, or one of the theme's. A List item offers the same row. */
export const MARKER_COLOURS: Array< [ string, string ] > = [
	[ '', __( 'Same as text', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ],
	[ 'muted-foreground', __( 'Slate', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ],
];
const CARD_FILLS: Array< [ string, string ] > = [ [ '', __( 'Mist', 'blicks' ) ], [ 'secondary', __( 'Light gray', 'blicks' ) ], [ 'accent', __( 'Soft brand', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ] ];
/** Icons one click away; the picker below holds the rest. */
export const QUICK_ICONS = [ 'check', 'circle-check', 'arrow-right', 'star', 'sparkles', 'plus' ];

const named = ( list: Array< [ string, string, ...unknown[] ] >, v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';

/** The theme's colours as swatches, drawn with their live values. */
export function useSwatches( list: Array< [ string, string ] > ): Swatch[] {
	const palette = useMemo( () => resolveTokenValues( 'color' as any ), [] );
	return list.map( ( [ v, l ] ) => ( v ? { value: v, label: l, css: palette[ v ] || colourCss( v ) } : { value: '', label: l } ) );
}

/** Three sample rows of a kind of list, for the Kind cards. */
function KindArt( { kind }: { kind: ListKind } ) {
	const marker = ( y: number, i: number ) => {
		if ( kind === 'bullets' ) return <circle cx="10" cy={ y } r="2.2" fill="currentColor" />;
		if ( kind === 'numbers' ) return <text x="10" y={ y + 3 } fontSize="8" fontWeight="700" textAnchor="middle" fill="currentColor">{ i + 1 }</text>;
		if ( kind === 'icons' ) return <path d={ `M7 ${ y }l2 2 4-4` } stroke="var(--bl-ui-primary, #002bff)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
		return null;
	};
	return (
		<svg viewBox="0 0 40 30" width="40" height="30" aria-hidden="true">
			{ [ 6, 15, 24 ].map( ( y, i ) => (
				<g key={ y }>
					{ marker( y, i ) }
					<path d={ `M17 ${ y }h18` } stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".45" />
				</g>
			) ) }
		</svg>
	);
}

/** An inner list takes its look from the list it sits in; its panels say so and lead there. */
function useOuter( clientId?: string ) {
	const outer = useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		const parent = clientId ? store.getBlockRootClientId( clientId ) : null;
		return parent && store.getBlockName( parent ) === 'blicks/list-item' ? outerList( store, parent ) : null;
	}, [ clientId ] );
	const { selectBlock } = useDispatch( 'core/block-editor' ) as any;
	return { outer, selectOuter: () => outer && selectBlock( outer ) };
}

function InnerListNote( { onSelect, title, icon }: { onSelect: () => void; title: string; icon: string } ) {
	return (
		<Sec title={ title } icon={ icon }>
			<Row label={ __( 'Look', 'blicks' ) } stack note={ __( 'An inner list looks like the list it sits in. Change the look there, and every level follows.', 'blicks' ) } noteIcon="north_west">
				<button type="button" className="link-x" onClick={ onSelect }>{ __( 'Select the outer list', 'blicks' ) }</button>
			</Row>
		</Sec>
	);
}

/** Choosing a kind keeps the marker choices of the others, so switching back restores them. */
export function ListSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const { outer, selectOuter } = useOuter( clientId );
	const anyDone = useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		const walk = ( id: string ): boolean => store.getBlockOrder( id ).some( ( c: string ) => ( store.getBlockName( c ) === 'blicks/list-item' && store.getBlockAttributes( c )?.state === 'done' ) || walk( c ) );
		return !! clientId && walk( clientId );
	}, [ clientId ] );
	if ( outer || attributes.nested ) return <InnerListNote onSelect={ selectOuter } title={ __( 'Kind', 'blicks' ) } icon="category" />;

	const kind = cleanKind( attributes.kind );
	const arrange = cleanArrange( attributes.arrange );
	const icon = String( attributes.icon || 'check' );
	const start = attributes.start === undefined || attributes.start === null ? '' : String( attributes.start );

	const bullet = cleanBullet( attributes.bullet );
	const numbering = cleanNumber( attributes.numbering );
	const separator = cleanSeparator( attributes.separator );
	const gap = cleanGap( attributes.gap );
	const tag = kind === 'numbers' ? '<ol>' : '<ul>';

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note" value={ named( CONTENTS as any, attributes.content || '' ) }>
				<Row label={ __( 'Each item has', 'blicks' ) } stack set={ attributes.content === 'titled' } note={ attributes.content === 'titled' ? __( 'A bold first line and a muted line of detail under it.', 'blicks' ) : undefined } noteIcon="info">
					<SegText label={ __( 'Each item has', 'blicks' ) } options={ CONTENTS } value={ attributes.content === 'titled' ? 'titled' : '' } onChange={ ( content ) => setAttributes( { content } ) } />
				</Row>
				{ ( anyDone || attributes.strikeDone ) && (
					<Switch label={ __( 'Cross out done items', 'blicks' ) } hint={ __( 'Done items keep their tick either way', 'blicks' ) } checked={ !! attributes.strikeDone } onChange={ ( strikeDone ) => setAttributes( { strikeDone } ) } />
				) }
			</Sec>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( KINDS, kind ) }>
				<Row label={ __( 'What is it?', 'blicks' ) } stack set={ kind !== 'bullets' } hint={ tag } note={ sprintf( /* translators: %s: an HTML tag such as <ul> */ __( 'Saved as %s.', 'blicks' ), tag ) } noteIcon="code">
					<Opts columns={ 4 } value={ kind } onChange={ ( k ) => setAttributes( { kind: k } ) } options={ KINDS.map( ( [ v, l ] ) => [ v, l, <KindArt key={ v } kind={ v } /> ] ) } />
				</Row>
				{ kind === 'bullets' && (
					<Row label={ __( 'Marker', 'blicks' ) } set={ bullet !== 'dot' }>
						<SegIcons label={ __( 'Marker', 'blicks' ) } options={ BULLETS } value={ bullet } onChange={ ( b ) => setAttributes( { bullet: b } ) } />
					</Row>
				) }
				{ kind === 'numbers' && (
					<Row label={ __( 'Numbering', 'blicks' ) } stack set={ numbering !== '1' } note={ numbering === '1.1' ? __( 'Inner lists count on from their item: 2.1, 2.2.', 'blicks' ) : undefined } noteIcon="info">
						<SegText label={ __( 'Numbering', 'blicks' ) } options={ NUMBERS } value={ numbering } onChange={ ( n ) => setAttributes( { numbering: n } ) } />
					</Row>
				) }
				{ kind === 'numbers' && (
					<Row label={ __( 'Start at', 'blicks' ) } set={ start !== '' }>
						<Field type="number" label={ __( 'Start at', 'blicks' ) } placeholder="1" value={ start } onChange={ ( v ) => setAttributes( { start: v === '' ? undefined : Math.max( 0, Math.round( Number( v ) ) || 0 ) } ) } />
					</Row>
				) }
				{ kind === 'numbers' && <Switch label={ __( 'Count down', 'blicks' ) } checked={ !! attributes.reversed } onChange={ ( reversed ) => setAttributes( { reversed } ) } /> }
				{ kind === 'icons' && (
					<Row label={ __( 'Icon', 'blicks' ) } stack set={ icon !== 'check' } note={ getIcon( icon )?.label ?? icon }>
						<Opts columns={ 6 } showLabels={ false } value={ QUICK_ICONS.includes( icon ) ? icon : null } onChange={ ( v ) => setAttributes( { icon: v } ) } options={ QUICK_ICONS.map( ( n ) => [ n, getIcon( n )?.label ?? n, <span key={ n }>{ renderIcon( n, { width: 18, height: 18, strokeWidth: 2 } ) }</span> ] ) } />
					</Row>
				) }
				{ kind === 'icons' && (
					<Row label={ __( 'Any icon', 'blicks' ) } stack>
						<IconPicker value={ icon } onChange={ ( v ) => setAttributes( { icon: v || 'check' } ) } />
					</Row>
				) }
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ named( ARRANGES as any, arrange ) }>
				<Row label={ __( 'Arrange', 'blicks' ) } set={ arrange !== 'stack' }>
					<SegIcons label={ __( 'Arrange', 'blicks' ) } options={ ARRANGES } value={ arrange } onChange={ ( a ) => setAttributes( { arrange: a } ) } />
				</Row>
				{ arrange === 'row' && (
					<Row label={ __( 'Between items', 'blicks' ) } stack set={ !! separator } note={ __( 'Inner lists are hidden in a row.', 'blicks' ) } noteIcon="info">
						<SegText label={ __( 'Between items', 'blicks' ) } options={ SEPARATORS } value={ separator } onChange={ ( sep ) => setAttributes( { separator: sep } ) } />
					</Row>
				) }
				{ arrange === 'cols' && (
					<Row label={ __( 'Columns', 'blicks' ) } stack note={ __( 'Phones get one column.', 'blicks' ) } noteIcon="smartphone">
						<Steps label={ __( 'Columns', 'blicks' ) } options={ COLUMNS } value={ String( cleanColumns( attributes.columns ) ) } onChange={ ( c ) => setAttributes( { columns: Number( c ) } ) } />
					</Row>
				) }
				<Row label={ __( 'Space between', 'blicks' ) } stack set={ !! gap } hint="gap">
					<Steps label={ __( 'Space between', 'blicks' ) } options={ GAPS } value={ gap } onChange={ ( g ) => setAttributes( { gap: g } ) } />
				</Row>
				{ arrange !== 'row' && <Switch label={ __( 'Lines between items', 'blicks' ) } checked={ !! attributes.lines } onChange={ ( lines ) => setAttributes( { lines } ) } /> }
			</Sec>
			<ListMeaning
				attributes={ attributes }
				setAttributes={ setAttributes }
				tag={ kind === 'numbers' ? 'ol' : 'ul' }
				placeholder={ __( 'e.g. “What’s included”', 'blicks' ) }
				note={ sprintf( /* translators: %s: an HTML tag such as <ul> */ __( 'Saved as %s. Screen readers say how many items it holds; the name comes first.', 'blicks' ), tag ) }
			/>
		</>
	);
}

export function ListStyle( { attributes, setAttributes, clientId }: PanelProps ) {
	const [ sub, setSub ] = useState< null | 'marker' | 'cards' >( null );
	const markerSwatches = useSwatches( MARKER_COLOURS );
	const fillSwatches = useSwatches( CARD_FILLS );
	const innerSwatches = useSwatches( [ [ '', __( 'Same as the top level', 'blicks' ) ], ...MARKER_COLOURS.slice( 1 ) ] );
	const { outer, selectOuter } = useOuter( clientId );
	if ( outer || attributes.nested ) return <InnerListNote onSelect={ selectOuter } title={ __( 'Fill', 'blicks' ) } icon="format_color_fill" />;

	const kind = cleanKind( attributes.kind );
	const boxable = kind === 'icons' || kind === 'numbers';
	const size = Number( attributes.markerSize ?? 100 ) || 100;
	const space = Number( attributes.markerSpace ?? 10 );
	const look = cleanLook( attributes.look );
	const markerCustom = ( boxable && !! cleanBehind( attributes.markerBehind ) ) || size !== 100 || space !== 10 || !! attributes.innerMarkerColour || !! attributes.innerMono;
	const cardsCustom = look === 'cards' && ( !! attributes.cardFill || !! attributes.cardCorners );

	if ( sub === 'marker' ) {
		return (
			<SubView title={ __( 'Marker', 'blicks' ) } onBack={ () => setSub( null ) } clearLabel={ __( 'Back to the plain marker', 'blicks' ) } onClear={ () => setAttributes( { markerColour: '', markerBehind: '', markerSize: 100, markerSpace: 10, innerMarkerColour: '', innerMono: false } ) }>
				<Sec title={ __( 'Top level', 'blicks' ) } icon="list">
					<Row label={ __( 'Color', 'blicks' ) } stack set={ !! attributes.markerColour }>
						<Swatches swatches={ markerSwatches } empty="auto" value={ attributes.markerColour || '' } onChange={ ( markerColour ) => setAttributes( { markerColour } ) } />
					</Row>
					{ boxable && (
						<Row label={ __( 'Behind it', 'blicks' ) } set={ !! cleanBehind( attributes.markerBehind ) }>
							<SegIcons label={ __( 'Behind it', 'blicks' ) } options={ BEHINDS } value={ cleanBehind( attributes.markerBehind ) } onChange={ ( markerBehind ) => setAttributes( { markerBehind } ) } />
						</Row>
					) }
					<Slider label={ __( 'Size', 'blicks' ) } min={ 60 } max={ 200 } step={ 5 } unit="%" value={ size } onChange={ ( markerSize ) => setAttributes( { markerSize } ) } />
					<Slider label={ __( 'Space to text', 'blicks' ) } min={ 4 } max={ 32 } value={ space } onChange={ ( markerSpace ) => setAttributes( { markerSpace } ) } />
				</Sec>
				<Sec title={ __( 'Inner levels', 'blicks' ) } icon="format_list_numbered">
					<Row label={ __( 'Color', 'blicks' ) } stack set={ !! attributes.innerMarkerColour }>
						<Swatches swatches={ innerSwatches } empty="auto" value={ attributes.innerMarkerColour || '' } onChange={ ( innerMarkerColour ) => setAttributes( { innerMarkerColour } ) } />
					</Row>
					{ kind === 'numbers' && <Switch label={ __( 'Monospace numbers', 'blicks' ) } hint={ __( 'Inner numbers in a code face, as legal outlines set them', 'blicks' ) } checked={ !! attributes.innerMono } onChange={ ( innerMono ) => setAttributes( { innerMono } ) } /> }
				</Sec>
			</SubView>
		);
	}
	if ( sub === 'cards' ) {
		return (
			<SubView title={ __( 'Cards', 'blicks' ) } onBack={ () => setSub( null ) } clearLabel={ __( 'Back to plain items', 'blicks' ) } onClear={ () => setAttributes( { look: '', cardFill: '', cardCorners: '' } ) }>
				<Row label={ __( 'Fill', 'blicks' ) } stack set={ !! attributes.cardFill }>
					<Swatches swatches={ fillSwatches.map( ( s ) => ( s.value ? s : { ...s, css: 'var(--blicks-color-muted, #f4f4f5)' } ) ) } value={ attributes.cardFill || '' } onChange={ ( cardFill ) => setAttributes( { cardFill } ) } />
				</Row>
				<Row label={ __( 'Corners', 'blicks' ) } set={ !! attributes.cardCorners }>
					<SegIcons label={ __( 'Corners', 'blicks' ) } options={ CORNERS } value={ String( attributes.cardCorners ?? '' ) } onChange={ ( cardCorners ) => setAttributes( { cardCorners } ) } />
				</Row>
			</SubView>
		);
	}

	// The list's own fills (Marker, Each item) open TypeStyle's Fill section, in the tab's fixed order.
	return (
		<TypeStyle
			attributes={ attributes }
			setAttributes={ setAttributes }
			kind="text"
			fill={
				<>
				{ kind !== 'plain' && (
					<Row label={ __( 'Marker', 'blicks' ) } stack set={ !! attributes.markerColour || markerCustom } note={ named( MARKER_COLOURS, attributes.markerColour || '' ) } action={ { label: markerCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setSub( 'marker' ) } }>
						<Swatches swatches={ markerSwatches } empty="auto" value={ attributes.markerColour || '' } onChange={ ( markerColour ) => setAttributes( { markerColour } ) } />
					</Row>
				) }
				<Row label={ __( 'Each item', 'blicks' ) } stack set={ !! look } action={ look === 'cards' ? { label: cardsCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setSub( 'cards' ) } : undefined }>
					<SegText label={ __( 'Each item', 'blicks' ) } options={ LOOKS } value={ look } onChange={ ( v ) => setAttributes( { look: v } ) } />
				</Row>
				</>
			}
		/>
	);
}

export function ListMotion( { attributes, setAttributes, clientId }: PanelProps ) {
	const { outer, selectOuter } = useOuter( clientId );
	if ( outer || attributes.nested ) return <InnerListNote onSelect={ selectOuter } title={ __( 'Entrance', 'blicks' ) } icon="animation" />;
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="text" timed={ false } />;
}

/** The List's toolbar, outer list only: Kind, Arrange and Space between — the Settings writes. */
export function ListToolbar( { attributes, setAttributes }: PanelProps ) {
	if ( attributes.nested ) return null;
	return (
		<ToolbarGroup>
			<ToolbarChoice label={ __( 'Kind', 'blicks' ) } value={ cleanKind( attributes.kind ) } options={ KINDS } onChange={ ( kind ) => setAttributes( { kind } ) } />
			<ToolbarChoice label={ __( 'Arrange', 'blicks' ) } value={ cleanArrange( attributes.arrange ) } options={ ARRANGES } onChange={ ( arrange ) => setAttributes( { arrange } ) } />
			<ToolbarChoice label={ __( 'Space between', 'blicks' ) } value={ cleanGap( attributes.gap ) } options={ GAPS } onChange={ ( gap ) => setAttributes( { gap } ) } />
		</ToolbarGroup>
	);
}
