import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { TypeStyle } from '@/framework/inspector-v2/TypeStyle';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Note, Opts, Row, SegIcons, SegText, Sec, Slider, Steps, SubView, Switch, type Option } from '@/framework/inspector-v2/kit';
import { withValue } from '@/blocks/box/model';
import { DataSec } from '@/blocks/loop/binding';

// Semantic element for the text. `p` for paragraphs (default); `span` for inline labels/badges,
// `small` for fine print, `div` for a generic block — so tiny UI text isn't forced into a <p>.
const TAGS: Option[] = [ [ 'p', __( 'Paragraph', 'blicks' ) ], [ 'div', __( 'Group', 'blicks' ) ], [ 'span', __( 'Inline', 'blicks' ) ], [ 'small', __( 'Fine print', 'blicks' ) ] ];

export function cleanTextTag( tag: unknown ): string {
	const value = String( tag || 'p' );
	return TAGS.some( ( [ v ] ) => v === value ) ? value : 'p';
}

// `variant: 'lead'` predates type roles; Kind now writes `typography.role`, and a Text still on the
// old variant reads as Lead until Kind is changed.
export function cleanTextVariant( variant: unknown ): string {
	return String( variant || 'default' ) === 'lead' ? 'lead' : 'default';
}

/** What Kind shows: the type role, else the old Lead variant, else Body. */
export function textKind( attributes: any ): string {
	const role = attributes.blicks?.[ 'typography.role' ]?.default?.base;
	if ( typeof role === 'string' && KINDS.some( ( [ v ] ) => v === role ) ) return role;
	return cleanTextVariant( attributes.variant ) === 'lead' ? 'lead' : 'body';
}

/** Kind writes the type role and retires the old variant, so the two never disagree. */
export function withTextKind( attributes: any, kind: string ) {
	return { variant: 'default', blicks: withValue( attributes.blicks ?? {}, 'typography.role', kind === 'body' ? undefined : kind ) };
}

export const KINDS: Array< [ string, string, number, string? ] > = [
	[ 'body', __( 'Body', 'blicks' ), 17 ], [ 'lead', __( 'Lead', 'blicks' ), 21, 'var(--bl-ui-ink-2)' ], [ 'small', __( 'Small', 'blicks' ), 14 ], [ 'caption', __( 'Caption', 'blicks' ), 13, 'var(--bl-ui-ink-2)' ],
];
const ALIGNS: Option[] = [
	[ 'left', __( 'Left', 'blicks' ), 'M4 6h16M4 12h10M4 18h13' ],
	[ 'center', __( 'Center', 'blicks' ), 'M4 6h16M7 12h10M5.5 18h13' ],
	[ 'right', __( 'Right', 'blicks' ), 'M4 6h16M10 12h10M7 18h13' ],
	[ 'justify', __( 'Justified', 'blicks' ), 'M4 6h16M4 12h16M4 18h16' ],
];
const MEASURES: Option[] = [ [ '', __( 'Full', 'blicks' ) ], [ '65ch', __( 'Readable', 'blicks' ) ], [ '45ch', __( 'Narrow', 'blicks' ) ] ];
const COLS: Option[] = [ [ '', __( 'One', 'blicks' ) ], [ '2', __( 'Two', 'blicks' ) ], [ '3', __( 'Three', 'blicks' ) ] ];
const CLAMPS: Option[] = [ [ '', __( 'All', 'blicks' ) ], [ '2', __( '2 lines', 'blicks' ) ], [ '3', __( '3 lines', 'blicks' ) ], [ '5', __( '5 lines', 'blicks' ) ] ];

/** The gap new columns get. Picking a count writes it, so only a different gap reads as a change. */
const DEFAULT_GAP = '32px';
const named = ( list: Array< [ string, string, ...unknown[] ] >, v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';
const baseOf = ( tree: any, id: string, bp = 'base' ) => {
	const v = tree?.[ id ]?.default?.[ bp ];
	return v === undefined || v === null ? '' : String( v );
};
const px = ( v: string, fallback: number ) => ( /^\d+(\.\d+)?px$/.test( v ) ? Number( v.slice( 0, -2 ) ) : fallback );

/** The Text block's Settings tab, as its inspector design draws it. */
export function TextSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const [ sub, setSub ] = useState< null | 'cols' >( null );
	const tree = attributes.blicks ?? {};
	const write = ( id: string, value: unknown, bp = 'base' ) => setAttributes( { blicks: withValue( tree, id, value, 'default', bp ) } );
	const kind = textKind( attributes );
	const align = baseOf( tree, 'typography.textAlign' ) || 'left';
	const measure = baseOf( tree, 'layout.maxWidth' );
	const cols = baseOf( tree, 'columns.columnCount' );
	const gap = baseOf( tree, 'columns.columnGap' );
	const narrowest = baseOf( tree, 'columns.columnWidth' );
	const clamp = baseOf( tree, 'layout.lineClamp' );
	// Phones always get one column; the count is written for wider screens only.
	const setCols = ( n: string ) => {
		let next = withValue( tree, 'columns.columnCount', n || undefined );
		next = withValue( next, 'columns.columnCount', n ? '1' : undefined, 'default', 'mobile' );
		// Unset, the browser's gap is 1em, too tight for running text.
		if ( n && ! gap ) next = withValue( next, 'columns.columnGap', DEFAULT_GAP );
		if ( ! n ) next = withValue( withValue( next, 'columns.columnGap', undefined ), 'columns.columnWidth', undefined );
		setAttributes( { blicks: next } );
	};

	if ( sub === 'cols' ) {
		return (
			<SubView title={ __( 'Columns', 'blicks' ) } onBack={ () => setSub( null ) } clearLabel={ __( 'Back to one column', 'blicks' ) } onClear={ () => setCols( '' ) }>
				<Row label={ __( 'Columns', 'blicks' ) } stack set={ !! cols }>
					<Steps label={ __( 'Columns', 'blicks' ) } options={ COLS } value={ cols } onChange={ setCols } />
				</Row>
				<Slider label={ __( 'Space between', 'blicks' ) } min={ 16 } max={ 64 } step={ 4 } value={ px( gap, 16 ) } onChange={ ( n ) => write( 'columns.columnGap', `${ n }px` ) } />
				<Slider label={ __( 'Narrowest', 'blicks' ) } min={ 0 } max={ 360 } step={ 20 } value={ px( narrowest, 0 ) } display={ narrowest || __( 'Any', 'blicks' ) } onChange={ ( n ) => write( 'columns.columnWidth', n ? `${ n }px` : undefined ) } />
				<Note>{ __( 'Phones always get one column. With a narrowest width, columns also drop on tablets when they would get thinner.', 'blicks' ) }</Note>
			</SubView>
		);
	}

	const tag = cleanTextTag( attributes.tag );
	const colsCustom = !! cols && ( ( !! gap && gap !== DEFAULT_GAP ) || !! narrowest );
	const measureStep = MEASURES.some( ( [ v ] ) => v === measure );

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
				<Switch label={ __( 'Drop cap', 'blicks' ) } hint={ __( 'A large first letter, for the opening paragraph', 'blicks' ) } checked={ !! attributes.dropCap } onChange={ ( dropCap ) => setAttributes( { dropCap } ) } />
				<Switch label={ __( 'No lone last word', 'blicks' ) } hint={ __( 'Moves a word down so the last line is never one word on its own', 'blicks' ) } checked={ baseOf( tree, 'typography.textWrap' ) === 'pretty' } onChange={ ( on ) => write( 'typography.textWrap', on ? 'pretty' : undefined ) } />
			</Sec>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( KINDS as any, kind ) }>
				<Row label={ __( 'What is it?', 'blicks' ) } stack set={ kind !== 'body' }>
					<Opts columns={ 4 } value={ kind } onChange={ ( k ) => setAttributes( withTextKind( attributes, k ) ) } options={ KINDS.map( ( [ v, l, size, color ] ) => [ v, l, <span key={ v } className="tf" style={ { fontSize: Math.round( size * 0.95 ), color } }>Aa</span> ] ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard">
				<Row label={ __( 'Line up', 'blicks' ) } set={ align !== 'left' } hint="text-align">
					<SegIcons label={ __( 'Line up', 'blicks' ) } options={ ALIGNS } value={ align } onChange={ ( a ) => write( 'typography.textAlign', a === 'left' ? undefined : a ) } />
				</Row>
				<Row
					label={ __( 'Line length', 'blicks' ) }
					stack
					set={ !! measure }
					hint="max-width"
					note={ ! measure ? undefined : measureStep ? __( 'Keeps lines short enough to read comfortably.', 'blicks' ) : sprintf( /* translators: %s: a length such as 600px */ __( 'Set to %s', 'blicks' ), measure ) }
					noteIcon="info"
				>
					<Steps label={ __( 'Line length', 'blicks' ) } options={ MEASURES } value={ measureStep ? measure : null } onChange={ ( m ) => write( 'layout.maxWidth', m || undefined ) } />
				</Row>
				<Row label={ __( 'Columns', 'blicks' ) } stack set={ !! cols } hint="column-count" action={ cols ? { label: colsCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setSub( 'cols' ) } : undefined }>
					<Steps label={ __( 'Columns', 'blicks' ) } options={ COLS } value={ COLS.some( ( [ v ] ) => v === cols ) ? cols : null } onChange={ setCols } />
				</Row>
				<Row label={ __( 'Show at most', 'blicks' ) } stack set={ !! clamp } hint="line-clamp" note={ clamp ? __( 'The rest is cut off with “…”. Good for cards that should line up.', 'blicks' ) : undefined } noteIcon="info">
					<Steps label={ __( 'Show at most', 'blicks' ) } options={ CLAMPS } value={ CLAMPS.some( ( [ v ] ) => v === clamp ) ? clamp : null } onChange={ ( c ) => write( 'layout.lineClamp', c || undefined ) } />
				</Row>
			</Sec>
			{ /* Block-only: after the fixed sections, before Meaning and access. */ }
			<DataSec attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } attr="content" label={ __( 'Text', 'blicks' ) } />
			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new">
				<Row label={ __( 'Meaning', 'blicks' ) } stack set={ tag !== 'p' } hint={ `<${ tag }>` } note={ sprintf( /* translators: %s: an HTML tag such as <p> */ __( 'Saved as %s. Helps search engines and screen readers; doesn’t change the look.', 'blicks' ), `<${ tag }>` ) } noteIcon="code">
					<SegText label={ __( 'Meaning', 'blicks' ) } options={ TAGS } value={ tag } onChange={ ( t ) => setAttributes( { tag: t } ) } />
				</Row>
			</Sec>
		</>
	);
}

export function TextStyle( { attributes, setAttributes }: PanelProps ) {
	return <TypeStyle attributes={ attributes } setAttributes={ setAttributes } kind="text" />;
}

export function TextMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="text" timed={ false } />;
}
