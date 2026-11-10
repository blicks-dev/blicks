import { createBlock } from '@wordpress/blocks';
import { useRegistry, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { Chips, Opts, Row, SegText, Sec, Steps, Swatches, type Option } from '@/framework/inspector-v2/kit';
import { withValue } from '@/blocks/box/model';
import { IconPicker } from '@/controls/IconPicker';
import { getIcon } from '@/framework/icons';
import { renderIcon } from '@/framework/icons/render';
import { MARKER_COLOURS, useSwatches } from '@/blocks/list/controls';
import { cleanKind, cleanState } from '@/blocks/list/model';
import { LIST, canIndent, canOutdent, indent, levelOf, outdent, outerList, type ListActions, type ListMakers, type ListStore } from './editing';

export const STATES: Option[] = [ [ '', __( 'Normal', 'blicks' ) ], [ 'hi', __( 'Highlight', 'blicks' ) ], [ 'out', __( 'Left out', 'blicks' ) ], [ 'done', __( 'Done', 'blicks' ) ] ];
/** Icons an item most often swaps in: a stand-out, a favourite, a warning. */
const OWN_ICONS = [ 'star', 'heart', 'zap', 'triangle-alert' ];
const TEXT_COLOURS: Array< [ string, string ] > = [
	[ '', __( 'Same as the list', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'muted-foreground', __( 'Slate', 'blicks' ) ],
	[ 'primary', __( 'Brand', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ],
];
const WEIGHTS: Option[] = [ [ '', __( 'Same', 'blicks' ) ], [ '400', __( 'Regular', 'blicks' ) ], [ '600', __( 'Semibold', 'blicks' ) ], [ '700', __( 'Bold', 'blicks' ) ] ];
const ICON_OUTDENT = 'M21 6H11M21 12H11M21 18H11M7 9l-3 3 3 3';
const ICON_INDENT = 'M21 6H11M21 12H11M21 18H11M3 9l3 3-3 3';
type Move = 'outdent' | 'indent';
const MOVES: Option< Move >[] = [ [ 'outdent', __( 'Outdent', 'blicks' ), ICON_OUTDENT ], [ 'indent', __( 'Indent', 'blicks' ), ICON_INDENT ] ];
/** A move the item cannot make, drawn faded and not clickable, as the old disabled buttons were. */
const OFF: React.CSSProperties = { opacity: 0.4, pointerEvents: 'none' };
const STATE_NOTES: Record< string, string > = {
	out: __( 'Struck through and grayed, with a cross for a marker. For what a plan does not include.', 'blicks' ),
	done: __( 'A tick for a marker. The list’s “Cross out done items” also crosses out its words.', 'blicks' ),
};

const makers: ListMakers = { list: ( attributes, innerBlocks = [] ) => createBlock( LIST, attributes, innerBlocks ), text: () => createBlock( 'blicks/text' ) };
const named = ( list: Array< [ string, string, ...unknown[] ] >, v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';

/** Where the item sits, and the outer list's kind (an item's own icon only shows in an icon list). */
function usePlace( clientId?: string ) {
	return useSelect( ( select: any ) => {
		const s = select( 'core/block-editor' );
		if ( ! clientId ) return { kind: 'bullets', level: 1, indentable: false, outdentable: false };
		const outer = outerList( s, clientId );
		return {
			kind: cleanKind( outer ? s.getBlockAttributes( outer )?.kind : '' ),
			level: levelOf( s, clientId ),
			indentable: canIndent( s, clientId ),
			outdentable: canOutdent( s, clientId ),
		};
	}, [ clientId ] );
}

export function ListItemSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const registry = useRegistry();
	const place = usePlace( clientId );
	const state = cleanState( attributes.state );
	const run = ( op: typeof indent ) => clientId && ( registry as any ).batch( () => op(
		registry.select( 'core/block-editor' ) as unknown as ListStore,
		registry.dispatch( 'core/block-editor' ) as unknown as ListActions,
		makers,
		clientId
	) );
	const own = String( attributes.icon || '' );

	return (
		<>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( STATES as any, state ) }>
				<Row label={ __( 'This item', 'blicks' ) } stack set={ !! state } note={ STATE_NOTES[ state ] } noteIcon="info">
					<Chips label={ __( 'This item', 'blicks' ) } options={ STATES } value={ state } onChange={ ( v ) => setAttributes( { state: v } ) } />
				</Row>
				{ place.kind === 'icons' && (
					<Row label={ __( 'Icon', 'blicks' ) } stack set={ !! own } note={ own ? getIcon( own )?.label ?? own : __( 'Same as the list', 'blicks' ) }>
						<Opts columns={ 5 } showLabels={ false } value={ OWN_ICONS.includes( own ) || ! own ? own : null } onChange={ ( icon ) => setAttributes( { icon } ) } options={ [
							[ '', __( 'Same as the list', 'blicks' ), <span key="same" className="tl">{ __( 'List', 'blicks' ) }</span> ],
							...OWN_ICONS.map( ( n ): [ string, string, JSX.Element ] => [ n, getIcon( n )?.label ?? n, <span key={ n }>{ renderIcon( n, { width: 18, height: 18, strokeWidth: 2 } ) }</span> ] ),
						] } />
					</Row>
				) }
				{ place.kind === 'icons' && (
					<Row label={ __( 'Any icon', 'blicks' ) } stack>
						<IconPicker value={ own || 'check' } allowNone onChange={ ( icon ) => setAttributes( { icon } ) } />
					</Row>
				) }
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ String( place.level ) }>
				<Row label={ __( 'Level', 'blicks' ) } stack set={ place.level > 1 } note={ __( 'Tab indents and Shift+Tab outdents while typing. Enter on an empty item steps out.', 'blicks' ) } noteIcon="keyboard">
					<SegText
						label={ __( 'Level', 'blicks' ) }
						options={ MOVES }
						value={ null }
						styles={ { outdent: place.outdentable ? undefined : OFF, indent: place.indentable ? undefined : OFF } }
						onChange={ ( m ) => run( m === 'indent' ? indent : outdent ) }
					/>
				</Row>
			</Sec>
		</>
	);
}

export function ListItemStyle( { attributes, setAttributes, clientId }: PanelProps ) {
	const place = usePlace( clientId );
	const markerSwatches = useSwatches( [ [ '', __( 'Same as the list', 'blicks' ) ], ...MARKER_COLOURS.slice( 1 ) ] );
	const textSwatches = useSwatches( TEXT_COLOURS );
	const tree = attributes.blicks ?? {};
	const text = String( tree[ 'colors.text' ]?.default?.base ?? '' );
	const weight = String( tree[ 'typography.fontWeight' ]?.default?.base ?? '' );

	return (
		<>
			<Sec title={ __( 'Text', 'blicks' ) } icon="text_fields">
				<Row label={ __( 'Weight', 'blicks' ) } stack set={ !! weight } note={ weight ? undefined : __( 'Same as the list', 'blicks' ) } noteIcon="north_west">
					<Steps label={ __( 'Weight', 'blicks' ) } options={ WEIGHTS } value={ weight } onChange={ ( w ) => setAttributes( { blicks: withValue( tree, 'typography.fontWeight', w || undefined ) } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill">
				{ place.kind !== 'plain' && (
					<Row label={ __( 'Marker', 'blicks' ) } stack set={ !! attributes.markerColour } note={ named( MARKER_COLOURS, attributes.markerColour || '' ) || __( 'Same as the list', 'blicks' ) }>
						<Swatches swatches={ markerSwatches } empty="auto" value={ attributes.markerColour || '' } onChange={ ( markerColour ) => setAttributes( { markerColour } ) } />
					</Row>
				) }
				<Row label={ __( 'Text color', 'blicks' ) } stack set={ !! text } note={ named( TEXT_COLOURS, text ) || undefined }>
					<Swatches swatches={ textSwatches } empty="auto" value={ text } onChange={ ( c ) => setAttributes( { blicks: withValue( tree, 'colors.text', c || undefined ) } ) } />
				</Row>
			</Sec>
		</>
	);
}
