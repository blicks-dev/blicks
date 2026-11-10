import { ToolbarGroup } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { ToolbarChoice, ToolbarSegments } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { Exact, Field, Note, Row, SegText, Sec, Switch, type Option } from '@/framework/inspector-v2/kit';
import { setEntry } from '@/framework/inspector-v2/all-settings-model';
import { cleanBackdrop, cleanFocus, cleanKind, cleanMotion, cleanPhone, cleanPlace, cleanSide, dialogId, slugify, type Kind } from './model';

export const KIND_OPTS: Option< Kind >[] = [
	[ 'modal', __( 'Modal', 'blicks' ) ],
	[ 'drawer', __( 'Drawer', 'blicks' ) ],
	[ 'sheet', __( 'Sheet', 'blicks' ) ],
	[ 'full', __( 'Full screen', 'blicks' ) ],
];
const SIDE_OPTS: Option[] = [ [ 'start', __( 'Start', 'blicks' ) ], [ 'end', __( 'End', 'blicks' ) ] ];
const PLACE_OPTS: Option[] = [ [ 'center', __( 'Center', 'blicks' ) ], [ 'top', __( 'Top', 'blicks' ) ] ];
const PHONE_OPTS: Option[] = [ [ 'keep', __( 'Card', 'blicks' ) ], [ 'sheet', __( 'Sheet', 'blicks' ) ], [ 'full', __( 'Full', 'blicks' ) ] ];
const BACKDROP_OPTS: Option[] = [ [ 'dark', __( 'Dark', 'blicks' ) ], [ 'light', __( 'Light', 'blicks' ) ], [ 'none', __( 'None', 'blicks' ) ] ];
const MOTION_OPTS: Option[] = [
	[ 'rise', __( 'Rise', 'blicks' ) ],
	[ 'scale', __( 'Scale', 'blicks' ) ],
	[ 'fade', __( 'Fade', 'blicks' ) ],
	[ 'none', __( 'None', 'blicks' ) ],
];
/** Panel widths, as `layout.maxWidth` over the kind's own width. '' keeps the kind's. */
const WIDTH_OPTS: Option[] = [ [ '400px', __( 'Narrow', 'blicks' ) ], [ '', __( 'Normal', 'blicks' ) ], [ '720px', __( 'Wide', 'blicks' ) ], [ '960px', __( 'Extra wide', 'blicks' ) ] ];
/** How tall it may grow before it scrolls, as `layout.maxHeight`. */
const HEIGHT_OPTS: Option[] = [ [ '', __( 'Fit', 'blicks' ) ], [ '50dvh', __( 'Half', 'blicks' ) ], [ '80dvh', __( 'Most', 'blicks' ) ] ];
const baseOf = ( tree: any, id: string ): string => String( tree?.[ id ]?.default?.base ?? '' );

const FOCUS_OPTS: Option[] = [ [ '', __( 'First field', 'blicks' ) ], [ 'close', __( 'Close button', 'blicks' ) ] ];

const PHONE_NOTES: Record< string, string > = {
	keep: __( 'Stays a centered card, full width less a margin.', 'blicks' ),
	sheet: __( 'Becomes a bottom sheet on phones.', 'blicks' ),
	full: __( 'Fills the screen on phones.', 'blicks' ),
};

export const named = ( list: Option[], v: string ) => list.find( ( o ) => o[ 0 ] === v )?.[ 1 ] ?? '';

/** The Dialog's Settings tab: its name and link, its kind, phones, how it sits over the page and closes. */
export function DialogSettings( { attributes, setAttributes }: PanelProps ) {
	const kind = cleanKind( attributes.kind );
	const modal = attributes.modal !== false;
	const id = dialogId( attributes );
	const side = cleanSide( attributes.side );
	const place = cleanPlace( attributes.place );
	const phone = cleanPhone( attributes.phone );
	const backdrop = cleanBackdrop( attributes.backdrop );
	const focus = cleanFocus( attributes.focus );

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
				<Row label={ __( 'Name', 'blicks' ) } stack set={ !! attributes.title }>
					<Field value={ attributes.title || '' } placeholder={ __( 'e.g. Size guide', 'blicks' ) } label={ __( 'Dialog name', 'blicks' ) } onChange={ ( title ) => setAttributes( { title } ) } />
				</Row>
				<Row
					label={ __( 'Link to it', 'blicks' ) }
					stack
					set={ !! attributes.anchor }
					hint="#id"
					noteIcon="info"
					note={ sprintf(
						/* translators: %s: a link such as #dialog-size-guide */
						__( 'A Button set to Open dialog opens it, and so does any link to %s.', 'blicks' ),
						`#${ id }`
					) }
				>
					<Field value={ attributes.anchor || '' } placeholder={ __( 'size-guide', 'blicks' ) } label={ __( 'Link to it', 'blicks' ) } onChange={ ( v ) => setAttributes( { anchor: slugify( v ) } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( KIND_OPTS, kind ) }>
				<Row label={ __( 'Kind', 'blicks' ) } stack set={ kind !== 'modal' }>
					<SegText label={ __( 'Kind', 'blicks' ) } options={ KIND_OPTS } value={ kind } onChange={ ( v ) => setAttributes( { kind: v } ) } />
				</Row>
				{ kind === 'drawer' && (
					<Row label={ __( 'Side', 'blicks' ) } set={ side !== 'end' }>
						<SegText label={ __( 'Side', 'blicks' ) } options={ SIDE_OPTS } value={ side } onChange={ ( v ) => setAttributes( { side: v } ) } />
					</Row>
				) }
				{ kind === 'modal' && (
					<Row label={ __( 'Place', 'blicks' ) } set={ place !== 'center' }>
						<SegText label={ __( 'Place', 'blicks' ) } options={ PLACE_OPTS } value={ place } onChange={ ( v ) => setAttributes( { place: v } ) } />
					</Row>
				) }
			</Sec>
			{ kind === 'modal' && (
				<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ named( PHONE_OPTS, phone ) }>
					<Row label={ __( 'Phones', 'blicks' ) } set={ phone !== 'keep' } note={ PHONE_NOTES[ phone ] } noteIcon="smartphone">
						<SegText label={ __( 'On phones', 'blicks' ) } options={ PHONE_OPTS } value={ phone } onChange={ ( v ) => setAttributes( { phone: v } ) } />
					</Row>
				</Sec>
			) }
			{ ( kind === 'modal' || kind === 'drawer' ) && ( () => {
				const tree = attributes.blicks ?? {};
				const width = baseOf( tree, 'layout.maxWidth' );
				const height = baseOf( tree, 'layout.maxHeight' );
				const isWidth = WIDTH_OPTS.some( ( [ v ] ) => v === width );
				const write = ( id: string, v: string ) => setAttributes( { blicks: setEntry( tree, id, 'element', 'default', 'base', v || undefined ) } );
				return (
					<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio" value={ [ isWidth ? named( WIDTH_OPTS, width ) : width, height ? ( named( HEIGHT_OPTS, height ) || height ) : '' ].filter( Boolean ).join( ' · ' ) }>
						<Row label={ __( 'Width', 'blicks' ) } stack set={ !! width } note={ kind === 'drawer' ? __( 'Never wider than most of the screen.', 'blicks' ) : undefined } noteIcon="info">
							<SegText label={ __( 'Width', 'blicks' ) } options={ WIDTH_OPTS } value={ isWidth ? width : null } onChange={ ( v ) => write( 'layout.maxWidth', v ) } />
						</Row>
						<Exact value={ width } isStep={ isWidth } label={ __( 'Exact width', 'blicks' ) } placeholder="560px" onChange={ ( v ) => write( 'layout.maxWidth', v ) } />
						{ kind === 'modal' && (
							<Row label={ __( 'Height', 'blicks' ) } stack set={ !! height } note={ __( 'Taller content scrolls inside it.', 'blicks' ) } noteIcon="info">
								<SegText label={ __( 'Height', 'blicks' ) } options={ HEIGHT_OPTS } value={ HEIGHT_OPTS.some( ( [ v ] ) => v === height ) ? height : null } onChange={ ( v ) => write( 'layout.maxHeight', v ) } />
							</Row>
						) }
					</Sec>
				);
			} )() }
			<Sec title={ __( 'Over the page', 'blicks' ) } icon="layers">
				<Switch
					label={ __( 'Blocks the page', 'blicks' ) }
					hint={ modal
						? __( 'The page behind can’t be used and doesn’t scroll until it closes.', 'blicks' )
						: __( 'No backdrop; the page stays usable. For notices and corner offers.', 'blicks' ) }
					checked={ modal }
					onChange={ ( on ) => setAttributes( { modal: on } ) }
				/>
				{ modal && (
					<Row label={ __( 'Backdrop', 'blicks' ) } set={ backdrop !== 'dark' }>
						<SegText label={ __( 'Backdrop', 'blicks' ) } options={ BACKDROP_OPTS } value={ backdrop } onChange={ ( v ) => setAttributes( { backdrop: v } ) } />
					</Row>
				) }
				{ modal && <Switch label={ __( 'Blur the page', 'blicks' ) } checked={ !! attributes.blur } onChange={ ( blur ) => setAttributes( { blur } ) } /> }
			</Sec>
			<Sec title={ __( 'Closing', 'blicks' ) } icon="close">
				<Switch label={ __( 'Close button', 'blicks' ) } checked={ attributes.closeButton !== false } onChange={ ( closeButton ) => setAttributes( { closeButton } ) } />
				{ attributes.closeButton !== false && (
					<Row label={ __( 'Its name', 'blicks' ) } stack set={ !! attributes.closeLabel } note={ __( 'Read out by screen readers.', 'blicks' ) } noteIcon="info">
						<Field value={ attributes.closeLabel ?? '' } placeholder={ __( 'Close', 'blicks' ) } label={ __( 'Close button name, for screen readers', 'blicks' ) } onChange={ ( closeLabel ) => setAttributes( { closeLabel } ) } />
					</Row>
				) }
				{ /* A dialog that does not block the page leaves it usable: clicks on it never close the dialog. */ }
				{ modal && <Switch label={ __( 'Click outside closes it', 'blicks' ) } checked={ attributes.outsideCloses !== false } onChange={ ( outsideCloses ) => setAttributes( { outsideCloses } ) } /> }
				<Note>{ __( 'Esc always closes it. A Button inside can be set to Close dialog.', 'blicks' ) }</Note>
			</Sec>
			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new">
				<Row label={ __( 'Name', 'blicks' ) } stack set={ !! attributes.label } hint="aria-label" note={ __( 'Read out by screen readers.', 'blicks' ) } noteIcon="info">
					<Field value={ attributes.label || '' } placeholder={ __( 'Named by its first heading', 'blicks' ) } label={ __( 'Dialog name for screen readers', 'blicks' ) } onChange={ ( label ) => setAttributes( { label } ) } />
				</Row>
				<Row label={ __( 'Focus on open', 'blicks' ) } stack set={ !! focus } note={ __( 'On close, focus returns to what opened it.', 'blicks' ) } noteIcon="keyboard">
					<SegText label={ __( 'Focus on open', 'blicks' ) } options={ FOCUS_OPTS } value={ focus } onChange={ ( v ) => setAttributes( { focus: v } ) } />
				</Row>
			</Sec>
		</>
	);
}

/** The Dialog's Motion tab: how it opens. Drawers and sheets slide in from their edge. */
export function DialogMotion( { attributes, setAttributes }: PanelProps ) {
	const motion = cleanMotion( attributes.motion );
	return (
		<Sec title={ __( 'Entrance', 'blicks' ) } icon="animation" value={ named( MOTION_OPTS, motion ) }>
			<Row label={ __( 'Opening', 'blicks' ) } stack set={ motion !== 'rise' } note={ __( 'Drawers and sheets slide in from their edge. Reduced motion turns it off.', 'blicks' ) } noteIcon="info">
				<SegText label={ __( 'Opening', 'blicks' ) } options={ MOTION_OPTS } value={ motion } onChange={ ( v ) => setAttributes( { motion: v } ) } />
			</Row>
		</Sec>
	);
}

/** The Dialog's Style tab: the shared Style panel, as a card's. */
export function DialogStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked={ false } />;
}

/** The Dialog's toolbar: Kind, then Side (drawer) or Place (modal) — the Settings writes. */
export function DialogToolbar( { attributes, setAttributes }: PanelProps ) {
	const kind = cleanKind( attributes.kind );
	return (
		<ToolbarGroup>
			<ToolbarChoice label={ __( 'Kind', 'blicks' ) } value={ kind } options={ KIND_OPTS } onChange={ ( v ) => setAttributes( { kind: v } ) } />
			{ kind === 'drawer' && <ToolbarSegments value={ cleanSide( attributes.side ) } options={ SIDE_OPTS } onChange={ ( side ) => setAttributes( { side } ) } /> }
			{ kind === 'modal' && <ToolbarSegments value={ cleanPlace( attributes.place ) } options={ PLACE_OPTS } onChange={ ( place ) => setAttributes( { place } ) } /> }
		</ToolbarGroup>
	);
}
