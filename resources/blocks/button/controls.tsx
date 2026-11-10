import { createBlock } from '@wordpress/blocks';
import { ToolbarButton, ToolbarDropdownMenu, ToolbarGroup } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Exact, Field, Note, Row, SegIcons, SegText, Sec, Select, Steps, Switch, type Option } from '@/framework/inspector-v2/kit';
import { IconPicker } from '@/controls/IconPicker';
import { withValue } from '@/blocks/box/model';
import { cleanContentMode, toLabel, type ContentMode } from './content';
import { DataSec } from '@/blocks/loop/binding';
import { useDialogTargets } from '@/blocks/dialog/editor';
import { requestTab } from '@/framework/inspector-v2/design-focus';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import { SYMBOLS } from '@/framework/inspector-v2/symbols.gen';

const VARIANTS = [ 'default', 'secondary', 'destructive', 'outline', 'ghost', 'link' ];
const SIZES = [ 'sm', 'default', 'lg', 'icon' ];

export function cleanButtonVariant( value: unknown ): string {
	const variant = String( value || 'default' );
	return VARIANTS.includes( variant ) ? variant : 'default';
}

/**
 * What a click does: follow its link, open a dialog, close the dialog it is in, send the Form it
 * is in, or clear that Form. Open dialog with no dialog chosen yet is still a plain button, so it never saves a
 * command aimed at nothing.
 */
export function buttonAction( attributes: any ): 'link' | 'dialog' | 'close' | 'submit' | 'reset' {
	if ( attributes.action === 'close' ) return 'close';
	if ( attributes.action === 'submit' ) return 'submit';
	if ( attributes.action === 'reset' ) return 'reset';
	if ( attributes.action === 'dialog' && String( attributes.dialog || '' ) ) return 'dialog';
	return 'link';
}

export function cleanButtonSize( value: unknown ): string {
	const size = String( value || 'default' );
	return SIZES.includes( size ) ? size : 'default';
}

/** The looks, in plain names, with the small drawing each card shows. */
const LOOKS: Array< [ string, string, string, React.CSSProperties ] > = [
	[ 'default', __( 'Main', 'blicks' ), __( 'The main action', 'blicks' ), { background: 'var(--blicks-color-primary, #18181b)', color: 'var(--blicks-color-primary-foreground, #fafafa)' } ],
	[ 'secondary', __( 'Soft', 'blicks' ), __( 'A second action', 'blicks' ), { background: 'var(--blicks-color-secondary, #f4f4f5)', color: 'var(--blicks-color-secondary-foreground, #18181b)' } ],
	[ 'outline', __( 'Outline', 'blicks' ), __( 'Beside a main one', 'blicks' ), { background: 'transparent', color: 'var(--blicks-color-foreground, #09090b)', border: '1px solid var(--blicks-color-border, #e4e4e7)' } ],
	[ 'ghost', __( 'Subtle', 'blicks' ), __( 'Quiet, in toolbars', 'blicks' ), { background: 'transparent', color: 'var(--blicks-color-foreground, #09090b)' } ],
	[ 'link', __( 'Text link', 'blicks' ), __( 'Reads like a link', 'blicks' ), { background: 'transparent', color: 'var(--blicks-color-primary, #18181b)', textDecoration: 'underline', padding: 0 } ],
	[ 'destructive', __( 'Warning', 'blicks' ), __( 'Delete or cancel', 'blicks' ), { background: 'var(--blicks-color-destructive, #dc2626)', color: '#fff' } ],
];
const SIZE_OPTS: Option[] = [ [ 'sm', __( 'Small', 'blicks' ) ], [ 'default', __( 'Medium', 'blicks' ) ], [ 'lg', __( 'Large', 'blicks' ) ] ];
const SIDES: Option[] = [
	[ 'leading', __( 'Before the text', 'blicks' ), 'M5 9h4v6H5zM12 12h7' ],
	[ 'trailing', __( 'After the text', 'blicks' ), 'M15 9h4v6h-4zM5 12h7' ],
];
const LINK_ICON = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';

const CONTENT_OPTS: Option< ContentMode >[] = [ [ 'label', __( 'Label & icon', 'blicks' ) ], [ 'blocks', __( 'Blocks', 'blicks' ) ] ];

type ButtonAction = 'link' | 'dialog' | 'close' | 'submit' | 'reset';

/** On click, in three: follow a link, work a dialog, or work the form it is in. The last two then say what. */
type ClickKind = 'link' | 'dialog' | 'form';
const CLICK_OPTS: Option< ClickKind >[] = [ [ 'link', __( 'Link', 'blicks' ) ], [ 'dialog', __( 'Dialog', 'blicks' ) ], [ 'form', __( 'Form', 'blicks' ) ] ];
const DIALOG_OPTS: Option< ButtonAction >[] = [ [ 'dialog', __( 'Open one', 'blicks' ) ], [ 'close', __( 'Close this one', 'blicks' ) ] ];
const FORM_OPTS: Option< ButtonAction >[] = [ [ 'submit', __( 'Send it', 'blicks' ) ], [ 'reset', __( 'Clear it', 'blicks' ) ] ];
export const clickKind = ( action: ButtonAction ): ClickKind => ( action === 'dialog' || action === 'close' ? 'dialog' : action === 'submit' || action === 'reset' ? 'form' : 'link' );
/** The action a kind starts at: the one already picked when it is that kind's, else the kind's first. */
export const actionFor = ( kind: ClickKind, now: ButtonAction ): ButtonAction => ( clickKind( now ) === kind ? now : kind === 'dialog' ? 'dialog' : kind === 'form' ? 'submit' : 'link' );

/** True when this block sits inside a Form, where Send form is offered. */
function useInForm( clientId: string | undefined ): boolean {
	return useSelect(
		( select: any ) => !! clientId && select( 'core/block-editor' ).getBlockParentsByBlockName( clientId, 'blicks/form' ).length > 0,
		[ clientId ]
	);
}

/** The dialogs this Button can open: the post's own, and any a companion plugin lists. */
function DialogPicker( { value, onChange }: { value: string; onChange: ( v: string ) => void } ) {
	const targets = useDialogTargets();
	const id = value ? `dialog-${ value }` : '';
	const options: Option[] = [
		[ '', __( 'Choose a dialog…', 'blicks' ) ],
		...targets.map( ( t ): Option => [ t.id.replace( /^dialog-/, '' ), t.title || t.id ] ),
	];
	if ( value && ! targets.some( ( t ) => t.id === id ) ) options.push( [ value, sprintf( /* translators: %s: a dialog id */ __( '%s (not on this page)', 'blicks' ), id ) ] );

	return (
		<Row label={ __( 'Dialog', 'blicks' ) } stack set={ !! value } note={ targets.length === 0 ? __( 'Add a Dialog block to this page, then choose it here.', 'blicks' ) : undefined } noteIcon="info">
			<Select value={ value } options={ options } label={ __( 'Dialog', 'blicks' ) } onChange={ onChange } />
		</Row>
	);
}

// `wide` (at least 12rem) is no longer offered but is still saved and drawn, so older buttons keep it.
export const WIDTHS = [ '', 'wide', 'full' ];
export const cleanButtonWidth = ( value: unknown ): string => ( WIDTHS.includes( String( value || '' ) ) ? String( value || '' ) : '' );

/** Width as Settings offers it: fit the label, fill the row, or a fixed size (`layout.width`). */
type WidthChoice = 'fit' | 'fill' | 'fixed';
const WIDTH_OPTS: Option< WidthChoice >[] = [ [ 'fit', __( 'Fit', 'blicks' ) ], [ 'fill', __( 'Fill', 'blicks' ) ], [ 'fixed', __( 'Fixed', 'blicks' ) ] ];
const FIXED_START = '12rem';
const baseOf = ( tree: any, id: string ): string => String( tree?.[ id ]?.default?.base ?? '' );

/** Fill is the `full` attribute, Fixed a base `layout.width`, else Fit. The old Wide is none of them (null). */
export function widthChoice( attributes: any ): WidthChoice | null {
	const width = cleanButtonWidth( attributes.width );
	if ( width === 'full' ) return 'fill';
	if ( width === 'wide' ) return null;
	return baseOf( attributes.blicks, 'layout.width' ) ? 'fixed' : 'fit';
}

/** What a width choice writes. Fit and Fill clear a fixed size; Fixed keeps one already set. */
export function withWidth( attributes: any, choice: WidthChoice, size?: string ) {
	const tree = attributes.blicks ?? {};
	const fixed = choice === 'fixed' ? size || baseOf( tree, 'layout.width' ) || FIXED_START : undefined;
	return { width: choice === 'fill' ? 'full' : '', blicks: withValue( tree, 'layout.width', fixed ) };
}

/** The space between icon and label, as steps of the spacing scale; '' is the stylesheet's own, Small. */
const ICON_GAPS: Option[] = [ [ '0', __( 'None', 'blicks' ) ], [ '', __( 'Small', 'blicks' ) ], [ 'sm', __( 'Medium', 'blicks' ) ], [ 'md', __( 'Large', 'blicks' ) ] ];

const named = ( list: Array< [ string, string, ...unknown[] ] >, v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';

/** A Material glyph at toolbar size: the toolbar sits outside `.bui`, which sizes `Sym`. */
const glyph = ( name: string ) => {
	const [ box, d ] = SYMBOLS[ name ] ?? [ '0 0 24 24', '' ];
	return <svg width={ 24 } height={ 24 } viewBox={ box } fill="currentColor" aria-hidden="true" focusable="false"><path d={ d } /></svg>;
};

/** The look's own colours as a dot, as the Look cards draw them. */
const lookDot = ( css: React.CSSProperties ) => (
	<span
		aria-hidden="true"
		style={ {
			display: 'inline-block', width: 14, height: 14, borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgb(16 24 40 / 18%)',
			background: css.background === 'transparent' ? ( css.border ? '#fff' : String( css.color ) ) : String( css.background ),
		} }
	/>
);

/**
 * The Button's quick bar: Look and Size on the block's own toolbar, where the work is, plus a way
 * into Quick in the Studio (below 1280px it shows one sidebar at a time). The same attributes the
 * Look and Size sections write; nothing of its own. An icon-only button has no size to pick.
 */
export function ButtonQuickBar( { attributes, setAttributes, clientId, inStudio = false }: PanelProps & { inStudio?: boolean } ) {
	const variant = cleanButtonVariant( attributes.variant );
	const size = cleanButtonSize( attributes.size );
	const look = LOOKS.find( ( l ) => l[ 0 ] === variant ) ?? LOOKS[ 0 ]!;
	return (
		<ToolbarGroup>
			<ToolbarDropdownMenu
				icon={ lookDot( look[ 3 ] ) }
				text={ look[ 1 ] }
				label={ __( 'Look', 'blicks' ) }
				controls={ LOOKS.map( ( [ v, l, , css ] ) => ( { title: l, icon: lookDot( css ), isActive: v === variant, onClick: () => setAttributes( { variant: v } ) } ) ) }
			/>
			{ size !== 'icon' && (
				<ToolbarChoice label={ __( 'Size', 'blicks' ) } value={ size } options={ SIZE_OPTS } onChange={ ( v ) => setAttributes( { size: v } ) } />
			) }
			{ inStudio && clientId && (
				<ToolbarButton icon={ glyph( 'bolt' ) } label={ __( 'All quick choices', 'blicks' ) } onClick={ () => requestTab( clientId, 'quick' ) } />
			) }
		</ToolbarGroup>
	);
}

export function ButtonSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const mode = cleanContentMode( attributes.content );
	const children = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlock( clientId )?.innerBlocks ?? [] : [] ), [ clientId ] );
	const { replaceInnerBlocks } = useDispatch( 'core/block-editor' ) as any;
	const gap = baseOf( attributes.blicks, 'layout.gapColumn' );
	const gapStep = ICON_GAPS.some( ( [ v ] ) => v === gap );
	const width = widthChoice( attributes );
	const fixedWidth = baseOf( attributes.blicks, 'layout.width' );

	// Blocks mode starts from what the label already shows; label mode keeps the first Text and
	// Icon and asks before dropping anything else.
	const setMode = ( next: ContentMode ) => {
		if ( next === mode || ! clientId ) return;
		if ( next === 'blocks' ) {
			const icon = attributes.icon ? [ createBlock( 'blicks/icon', { icon: attributes.icon, size: attributes.iconSize || '1em' } ) ] : [];
			const text = attributes.size === 'icon' ? [] : [ createBlock( 'blicks/text', { content: attributes.text || '', tag: 'span' } ) ];
			replaceInnerBlocks( clientId, attributes.iconPosition === 'trailing' ? [ ...text, ...icon ] : [ ...icon, ...text ], false );
			setAttributes( { content: 'blocks' } );
			return;
		}
		const kept = toLabel( children );
		if ( kept.lossy && ! window.confirm( __( 'Label & icon keeps the first text and icon. Remove the other blocks inside this button?', 'blicks' ) ) ) return;
		replaceInnerBlocks( clientId, [], false );
		setAttributes( { content: 'label', text: kept.text, icon: kept.icon } );
	};

	const variant = cleanButtonVariant( attributes.variant );
	const size = cleanButtonSize( attributes.size );
	const iconOnly = size === 'icon';
	const icon = String( attributes.icon || '' );
	const url = String( attributes.url || '' );
	// The tab follows what was picked, even before a dialog is chosen.
	const onClick: ButtonAction = [ 'dialog', 'close', 'submit', 'reset' ].includes( attributes.action ) ? attributes.action : 'link';
	const inForm = useInForm( clientId );
	const kind = clickKind( onClick );
	const setAction = ( action: ButtonAction ) => setAttributes( { action: action === 'link' ? '' : action } );
	// Leaving icon-only goes back to the medium size; it is the one every look is drawn at.
	const setIconOnly = ( on: boolean ) => setAttributes( { size: on ? 'icon' : 'default', label: on ? attributes.label || attributes.text?.replace( /<[^>]*>/g, '' ) || '' : attributes.label } );

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
				<Row label={ __( 'Holds', 'blicks' ) } set={ mode === 'blocks' } note={ mode === 'blocks' ? __( 'Add text, icons, boxes and images inside. They stay inline, so the button is still one link.', 'blicks' ) : undefined } noteIcon="info">
					<SegText label={ __( 'Content', 'blicks' ) } options={ CONTENT_OPTS } value={ mode } onChange={ setMode } />
				</Row>
				{ mode === 'label' && (
					<Row label={ __( 'Icon', 'blicks' ) } stack set={ !! icon }>
						<IconPicker value={ icon } allowNone onChange={ ( next ) => setAttributes( { icon: next, ...( next ? {} : { size: iconOnly ? 'default' : size } ) } ) } />
					</Row>
				) }
				{ mode === 'label' && icon && ! iconOnly && (
					<Row label={ __( 'Icon side', 'blicks' ) } set={ attributes.iconPosition === 'trailing' }>
						<SegIcons label={ __( 'Icon side', 'blicks' ) } options={ SIDES } value={ attributes.iconPosition === 'trailing' ? 'trailing' : 'leading' } onChange={ ( iconPosition ) => setAttributes( { iconPosition } ) } />
					</Row>
				) }
				{ mode === 'label' && icon && (
					<Row label={ __( 'Icon size', 'blicks' ) } set={ !! attributes.iconSize }>
						<Field value={ attributes.iconSize || '' } placeholder={ __( 'e.g. 20px', 'blicks' ) } label={ __( 'Icon size', 'blicks' ) } onChange={ ( v ) => setAttributes( { iconSize: v.trim() } ) } />
					</Row>
				) }
				{ mode === 'label' && icon && <Switch label={ __( 'Icon only', 'blicks' ) } checked={ iconOnly } onChange={ setIconOnly } /> }
			</Sec>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( LOOKS, variant ) }>
				<Row label={ __( 'Look', 'blicks' ) } stack set={ variant !== 'default' }>
					<div className="lookgrid" role="radiogroup" aria-label={ __( 'Look', 'blicks' ) }>
						{ LOOKS.map( ( [ v, l, hint, css ] ) => (
							<button key={ v } type="button" role="radio" className="lookc" aria-checked={ variant === v } onClick={ () => setAttributes( { variant: v } ) }>
								<span className="lookw"><span className="mini" style={ css }>{ __( 'Button', 'blicks' ) }</span></span>
								<b>{ l }</b>
								<small>{ hint }</small>
							</button>
						) ) }
					</div>
				</Row>
				{ ! iconOnly && (
					<Row label={ __( 'Size', 'blicks' ) } stack set={ size !== 'default' }>
						<SegText label={ __( 'Size', 'blicks' ) } options={ SIZE_OPTS } value={ size } onChange={ ( s ) => setAttributes( { size: s } ) } />
					</Row>
				) }
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ width ? named( WIDTH_OPTS, width ) : __( 'Wide', 'blicks' ) }>
				<Row
					label={ __( 'Width', 'blicks' ) }
					stack
					set={ width !== 'fit' }
					note={ width === null ? __( 'Wide: at least 12rem. Pick one to change it.', 'blicks' ) : undefined }
					noteIcon="info"
				>
					<SegText label={ __( 'Width', 'blicks' ) } options={ WIDTH_OPTS } value={ width } onChange={ ( w ) => setAttributes( withWidth( attributes, w ) ) } />
				</Row>
				{ width === 'fixed' && <Exact value={ fixedWidth } isStep={ false } label={ __( 'Fixed width', 'blicks' ) } placeholder={ FIXED_START } onChange={ ( w ) => setAttributes( withWidth( attributes, 'fixed', w ) ) } /> }
				{ /* Only something beside the label has space to keep from it: an icon, or blocks. */ }
				{ ( ( mode === 'label' && !! icon && ! iconOnly ) || mode === 'blocks' || !! gap ) && (
					<>
						<Row label={ __( 'Space between', 'blicks' ) } stack set={ !! gap } hint="gap">
							<Steps label={ mode === 'blocks' ? __( 'Space between the blocks', 'blicks' ) : __( 'Space between the icon and the label', 'blicks' ) } options={ ICON_GAPS } value={ gapStep ? gap : null } onChange={ ( g ) => setAttributes( { blicks: withValue( attributes.blicks ?? {}, 'layout.gapColumn', g || undefined ) } ) } />
						</Row>
						<Exact value={ gap } isStep={ gapStep } label={ __( 'Exact space between', 'blicks' ) } placeholder="12px" onChange={ ( g ) => setAttributes( { blicks: withValue( attributes.blicks ?? {}, 'layout.gapColumn', g ) } ) } />
					</>
				) }
				<Switch
					label={ __( 'Label can wrap', 'blicks' ) }
					hint={ __( 'Long labels break onto a second line instead of widening the button', 'blicks' ) }
					checked={ attributes.blicks?.[ 'typography.whiteSpace' ]?.default?.base === 'normal' }
					onChange={ ( on ) => setAttributes( { blicks: withValue( attributes.blicks ?? {}, 'typography.whiteSpace', on ? 'normal' : undefined ) } ) }
				/>
			</Sec>
			<Sec title={ __( 'Link', 'blicks' ) } icon="link" value={ named( CLICK_OPTS, kind ) }>
				<Row label={ __( 'On click', 'blicks' ) } stack set={ kind !== 'link' }>
					<SegText label={ __( 'On click', 'blicks' ) } options={ CLICK_OPTS } value={ kind } onChange={ ( k ) => setAction( actionFor( k, onClick ) ) } />
				</Row>
				{ kind === 'dialog' && (
					<Row label={ __( 'It does', 'blicks' ) } stack set={ onClick === 'close' }>
						<SegText label={ __( 'What it does to a dialog', 'blicks' ) } options={ DIALOG_OPTS } value={ onClick } onChange={ setAction } />
					</Row>
				) }
				{ kind === 'form' && (
					<Row label={ __( 'It does', 'blicks' ) } stack set={ onClick === 'reset' }>
						<SegText label={ __( 'What it does to the form', 'blicks' ) } options={ FORM_OPTS } value={ onClick } onChange={ setAction } />
					</Row>
				) }
				{ onClick === 'link' && (
					<Row label={ __( 'Address', 'blicks' ) } stack set={ !! url } note={ url ? undefined : __( 'No link: it acts as a button on the page, e.g. to open a form.', 'blicks' ) } noteIcon="info">
						<Field icon={ LINK_ICON } value={ url } placeholder={ __( 'Paste a link', 'blicks' ) } label={ __( 'Link', 'blicks' ) } onChange={ ( v ) => setAttributes( { url: v.trim() } ) } />
					</Row>
				) }
				{ onClick === 'link' && url && (
					<Switch label={ __( 'Open in a new tab', 'blicks' ) } checked={ attributes.linkTarget === '_blank' } onChange={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '', rel: on ? 'noreferrer noopener' : '' } ) } />
				) }
				{ onClick === 'dialog' && <DialogPicker value={ String( attributes.dialog || '' ) } onChange={ ( dialog ) => setAttributes( { dialog } ) } /> }
				{ onClick === 'close' && <Note>{ __( 'Closes the dialog this button is in.', 'blicks' ) }</Note> }
				{ onClick === 'submit' && <Note>{ inForm ? __( 'Sends the form this button is in.', 'blicks' ) : __( 'Sends a form: put this button inside a Form block.', 'blicks' ) }</Note> }
				{ onClick === 'reset' && <Note>{ inForm ? __( 'Empties every field of the form this button is in, and its messages.', 'blicks' ) : __( 'Clears a form: put this button inside a Form block.', 'blicks' ) }</Note> }
			</Sec>
			{ /* Block-only sections go after the fixed ones, before Meaning and access. */ }
			<DataSec attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } attr="text" label={ __( 'The label', 'blicks' ) } title={ __( 'Label from data', 'blicks' ) } />
			<DataSec attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } attr="url" kind="url" label={ __( 'The link', 'blicks' ) } title={ __( 'Link from data', 'blicks' ) } />
			{ /* Always shown: an icon-only or blocks button needs a name; a labelled one is named by its label. */ }
			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new" value={ iconOnly || mode === 'blocks' ? ( attributes.label ? __( 'Named', 'blicks' ) : '' ) : __( 'Its label', 'blicks' ) }>
				{ iconOnly || mode === 'blocks' ? (
					<Row label={ __( 'Name', 'blicks' ) } stack set={ !! attributes.label } note={ iconOnly ? __( 'Needed: only the icon shows, so this is read out instead of a label.', 'blicks' ) : __( 'Read out in place of the blocks inside. Empty: their text is read.', 'blicks' ) } noteIcon={ iconOnly && ! attributes.label ? 'warning' : 'info' }>
						<Field value={ attributes.label || '' } placeholder={ __( 'e.g. “Start planning”', 'blicks' ) } label={ __( 'Name for screen readers', 'blicks' ) } onChange={ ( label ) => setAttributes( { label } ) } />
					</Row>
				) : (
					<Note>{ __( 'Screen readers read its label. Turn on Icon only and it needs a name here.', 'blicks' ) }</Note>
				) }
			</Sec>
		</>
	);
}


/** The Button's Style tab. A button is always clickable, so click and focus are always offered. */
export function ButtonStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="button" linked />;
}

export function ButtonMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked kind="button" />;
}
