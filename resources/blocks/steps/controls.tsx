import { useState } from 'react';
import { useSelect } from '@wordpress/data';
import { ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice, ToolbarSegments } from '@/blocks/shared/toolbar';
import { __, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { ListMeaning } from '@/framework/inspector-v2/More';
import { Opts, Row, SegIcons, SegText, Sec, Slider, Steps, SubView, Swatches, Switch, type Option } from '@/framework/inspector-v2/kit';
import { IconPicker } from '@/controls/IconPicker';
import { renderIcon } from '@/framework/icons/render';
import { getIcon } from '@/framework/icons';
import { MARKER_COLOURS, QUICK_ICONS, useSwatches } from '@/blocks/list/controls';
import { cleanCurrent, cleanLayout, cleanMarker, cleanShape } from './model';

const LAYOUTS: Option[] = [
	[ 'across', __( 'Across', 'blicks' ), 'M3 12h4M10 12h4M17 12h4M5 8v8M12 8v8M19 8v8' ],
	[ 'down', __( 'Down', 'blicks' ), 'M12 3v4M12 10v4M12 17v4M8 5h8M8 12h8M8 19h8' ],
];
const MARKERS: Option[] = [ [ 'numbers', __( 'Numbers', 'blicks' ) ], [ 'icons', __( 'Icons', 'blicks' ) ], [ 'dots', __( 'Dots', 'blicks' ) ] ];
const NUMS: Option[] = [ [ '1', '1' ], [ '01', '01' ] ];
const LINES: Option[] = [ [ 'solid', __( 'Solid', 'blicks' ) ], [ 'dashed', __( 'Dashed', 'blicks' ) ] ];
const GAPS: Option[] = [ [ 'tight', __( 'Small', 'blicks' ) ], [ '', __( 'Medium', 'blicks' ) ], [ 'roomy', __( 'Large', 'blicks' ) ] ];
const SHAPES: Option[] = [
	[ 'circle', __( 'Circle', 'blicks' ), 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z' ],
	[ 'square', __( 'Square', 'blicks' ), 'M5 5h14v14H5z' ],
	[ 'plain', __( 'No shape', 'blicks' ), 'M8 7h3v10M7 17h6' ],
];
const LINE_COLOURS: Array< [ string, string ] > = [ [ '', __( 'Marker color, then gray', 'blicks' ) ], [ 'border', __( 'Line gray', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ] ];
const named = ( list: Array< [ string, string, ...unknown[] ] >, v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';

export function StepsSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const count = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlockCount( clientId ) : 0 ), [ clientId ] );
	const layout = cleanLayout( attributes.layout );
	const marker = cleanMarker( attributes.marker );
	const current = Math.min( cleanCurrent( attributes.current ), count );
	const icon = String( attributes.icon || 'check' );
	const currents: Option[] = [ [ '0', __( 'None', 'blicks' ) ], ...Array.from( { length: count }, ( _, i ): Option => [ String( i + 1 ), String( i + 1 ) ] ) ];

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note" value={ current ? sprintf( /* translators: 1: step, 2: steps */ __( 'Step %1$d of %2$d', 'blicks' ), current, count ) : __( 'None', 'blicks' ) }>
				<Row
					label={ __( 'Current step', 'blicks' ) }
					stack
					set={ !! current }
					note={ current ? undefined : __( 'With no current step, every step looks the same — a “how it works”.', 'blicks' ) }
					noteIcon="info"
				>
					{ count <= 8 ? (
						<Steps label={ __( 'Current step', 'blicks' ) } options={ currents } value={ String( current ) } onChange={ ( v ) => setAttributes( { current: Number( v ) } ) } />
					) : (
						<SegText label={ __( 'Current step', 'blicks' ) } options={ [ currents[ 0 ], [ String( current || 1 ), String( current || 1 ) ] ] } value={ String( current ) } onChange={ ( v ) => setAttributes( { current: Number( v ) } ) } />
					) }
				</Row>
				{ current ? (
					<>
						<Switch label={ __( 'Tick the steps before it', 'blicks' ) } checked={ attributes.tickDone !== false } onChange={ ( tickDone ) => setAttributes( { tickDone } ) } />
						<Switch label={ __( 'Say where each step stands', 'blicks' ) } hint={ sprintf( /* translators: 1: step, 2: steps */ __( 'Done · Step %1$d of %2$d · Upcoming', 'blicks' ), current, count ) } checked={ !! attributes.status } onChange={ ( status ) => setAttributes( { status } ) } />
					</>
				) : null }
			</Sec>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( MARKERS as any, marker ) }>
				<Row label={ __( 'Marker', 'blicks' ) } stack set={ marker !== 'numbers' }>
					<SegText label={ __( 'Marker', 'blicks' ) } options={ MARKERS } value={ marker } onChange={ ( v ) => setAttributes( { marker: v } ) } />
				</Row>
				{ marker === 'numbers' && (
					<Row label={ __( 'Numbering', 'blicks' ) } set={ attributes.numbering === '01' }>
						<SegText label={ __( 'Numbering', 'blicks' ) } options={ NUMS } value={ attributes.numbering === '01' ? '01' : '1' } onChange={ ( numbering ) => setAttributes( { numbering } ) } />
					</Row>
				) }
				{ marker === 'icons' && (
					<Row label={ __( 'Icon', 'blicks' ) } stack set={ icon !== 'check' } note={ __( 'Each step can pick its own.', 'blicks' ) } noteIcon="info">
						<Opts columns={ 6 } showLabels={ false } value={ QUICK_ICONS.includes( icon ) ? icon : null } onChange={ ( v ) => setAttributes( { icon: v } ) } options={ QUICK_ICONS.map( ( n ) => [ n, getIcon( n )?.label ?? n, <span key={ n }>{ renderIcon( n, { width: 18, height: 18, strokeWidth: 2 } ) }</span> ] ) } />
					</Row>
				) }
				{ marker === 'icons' && (
					<Row label={ __( 'Any icon', 'blicks' ) } stack>
						<IconPicker value={ icon } onChange={ ( v ) => setAttributes( { icon: v || 'check' } ) } />
					</Row>
				) }
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ named( LAYOUTS as any, layout ) }>
				<Row label={ __( 'Direction', 'blicks' ) } set={ layout !== 'across' } note={ __( 'Phones always get Down.', 'blicks' ) } noteIcon="smartphone">
					<SegIcons label={ __( 'Direction', 'blicks' ) } options={ LAYOUTS } value={ layout } onChange={ ( v ) => setAttributes( { layout: v } ) } />
				</Row>
				<Switch label={ __( 'Join steps with a line', 'blicks' ) } checked={ attributes.join !== false } onChange={ ( join ) => setAttributes( { join } ) } />
				{ attributes.join !== false && (
					<Row label={ __( 'Line', 'blicks' ) } set={ attributes.line === 'dashed' }>
						<SegText label={ __( 'Line', 'blicks' ) } options={ LINES } value={ attributes.line === 'dashed' ? 'dashed' : 'solid' } onChange={ ( line ) => setAttributes( { line } ) } />
					</Row>
				) }
				{ layout === 'down' && (
					<Switch label={ __( 'A label beside each step', 'blicks' ) } hint={ __( 'A date or a time, as a timeline shows', 'blicks' ) } checked={ !! attributes.labels } onChange={ ( labels ) => setAttributes( { labels } ) } />
				) }
				<Row label={ __( 'Space between', 'blicks' ) } stack hint="gap" set={ !! attributes.gap }>
					<Steps label={ __( 'Space between', 'blicks' ) } options={ GAPS } value={ attributes.gap || '' } onChange={ ( gap ) => setAttributes( { gap } ) } />
				</Row>
			</Sec>
			<ListMeaning
				attributes={ attributes }
				setAttributes={ setAttributes }
				tag="ol"
				placeholder={ __( 'e.g. “Checkout progress”', 'blicks' ) }
				note={ current
					? sprintf( /* translators: %d: the current step */ __( 'Saved as <ol>. Screen readers count the steps and hear step %d as the current one.', 'blicks' ), current )
					: __( 'Saved as <ol>. Screen readers count the steps.', 'blicks' ) }
			/>
		</>
	);
}

export function StepsStyle( { attributes, setAttributes }: PanelProps ) {
	const [ sub, setSub ] = useState< null | 'marker' >( null );
	const markerSwatches = useSwatches( MARKER_COLOURS.slice( 1 ) );
	const lineSwatches = useSwatches( LINE_COLOURS );
	const shape = cleanShape( attributes.markerShape );
	const size = Number( attributes.markerSize ?? 100 ) || 100;
	const custom = shape !== 'circle' || size !== 100 || !! attributes.outline;

	if ( sub === 'marker' ) {
		return (
			<SubView title={ __( 'Marker', 'blicks' ) } onBack={ () => setSub( null ) } clearLabel={ __( 'Back to a filled circle', 'blicks' ) } onClear={ () => setAttributes( { markerShape: 'circle', markerSize: 100, outline: false } ) }>
				<Row label={ __( 'Shape', 'blicks' ) } stack set={ shape !== 'circle' }>
					<SegIcons label={ __( 'Shape', 'blicks' ) } options={ SHAPES } value={ shape } onChange={ ( markerShape ) => setAttributes( { markerShape } ) } />
				</Row>
				<Slider label={ __( 'Size', 'blicks' ) } min={ 60 } max={ 300 } step={ 10 } unit="%" value={ size } onChange={ ( markerSize ) => setAttributes( { markerSize } ) } />
				{ shape === 'plain' && cleanMarker( attributes.marker ) === 'numbers' && (
					<Switch label={ __( 'Outlined numbers', 'blicks' ) } hint={ __( 'Large display numerals drawn as an outline', 'blicks' ) } checked={ !! attributes.outline } onChange={ ( outline ) => setAttributes( { outline } ) } />
				) }
			</SubView>
		);
	}

	// Each step's words are its own Heading and Text blocks, styled there; nothing for them here.
	return (
		<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill">
			<Row
				label={ __( 'Marker', 'blicks' ) }
				stack
				set={ !! attributes.markerColour }
				note={ custom ? __( 'Shape or size changed.', 'blicks' ) : undefined }
				action={ { label: custom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setSub( 'marker' ) } }
			>
				<Swatches swatches={ [ { value: '', label: __( 'Same as text', 'blicks' ) }, ...markerSwatches ] } empty="auto" value={ attributes.markerColour || '' } onChange={ ( markerColour ) => setAttributes( { markerColour } ) } />
			</Row>
			{ attributes.join !== false && (
				<Row label={ __( 'Line', 'blicks' ) } stack set={ !! attributes.lineColour } note={ named( LINE_COLOURS, attributes.lineColour || '' ) }>
					<Swatches swatches={ lineSwatches } empty="auto" value={ attributes.lineColour || '' } onChange={ ( lineColour ) => setAttributes( { lineColour } ) } />
				</Row>
			) }
		</Sec>
	);
}

export function StepsMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="box" timed={ false } />;
}

/** The Steps' toolbar: Layout, Marker and Current step — the writes its Settings tab makes. */
export function StepsToolbar( { attributes, setAttributes, clientId }: PanelProps ) {
	const count = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlockCount( clientId ) : 0 ), [ clientId ] );
	const current = Math.min( cleanCurrent( attributes.current ), count );
	const currents = [
		[ '0', __( 'No current step', 'blicks' ) ] as const,
		...Array.from( { length: count }, ( _, i ) => [ String( i + 1 ), sprintf( /* translators: %d: step number */ __( 'Current: step %d', 'blicks' ), i + 1 ) ] as const ),
	];
	return (
		<>
			<ToolbarGroup>
				<ToolbarSegments value={ cleanLayout( attributes.layout ) } options={ LAYOUTS } onChange={ ( layout ) => setAttributes( { layout } ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'Marker', 'blicks' ) } value={ cleanMarker( attributes.marker ) } options={ MARKERS } onChange={ ( marker ) => setAttributes( { marker } ) } />
				{ count > 0 && <ToolbarChoice label={ __( 'Current step', 'blicks' ) } value={ String( current ) } options={ currents } onChange={ ( v ) => setAttributes( { current: Number( v ) } ) } /> }
			</ToolbarGroup>
		</>
	);
}
