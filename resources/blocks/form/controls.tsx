import { useDispatch, useSelect } from '@wordpress/data';
import { ToolbarDropdownMenu, ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice, outlineGlyph, toolbarIcon } from '@/blocks/shared/toolbar';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Field, Icon, Note, Row, SegText, Sec, Select, Steps, Swatches, Switch, type Option } from '@/framework/inspector-v2/kit';
import { useSwatches } from '@/blocks/list/controls';
import { withValue } from '@/blocks/box/model';
import { useDialogTargets } from '@/blocks/dialog/editor';
import { cleanAfter, cleanEmail, cleanErrorColour, cleanLabels, cleanLook, cleanMarker, cleanName, cleanSpam, type AfterKind, type ChallengeKind, type Labels, type Look, type Marker } from './model';
import { TEMPLATES, findTemplate, templateAttributes, templateBlocks, type TemplateKey } from './templates';
import { hasProblems, useFormProblems, type FormProblems } from './editor';
import { moreFieldsLine, typeGroups, type TypeChoice } from '@/blocks/field/model';
import { createField } from '@/blocks/field/create';
import { useFieldTypes } from '@/blocks/field/controls';

const WARN = 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z';

export const AFTER_OPTS: Option< AfterKind >[] = [
	[ 'message', __( 'Message', 'blicks' ) ],
	[ 'page', __( 'Page', 'blicks' ) ],
	[ 'dialog', __( 'Dialog', 'blicks' ) ],
];

const AFTER_NOTES: Record< AfterKind, string > = {
	message: __( 'Shows the sent message in place of the form.', 'blicks' ),
	page: __( 'Goes to a page you pick, e.g. a thank-you page.', 'blicks' ),
	dialog: __( 'Opens a Blicks dialog on this page.', 'blicks' ),
};

export const CHALLENGE_OPTS: Option< ChallengeKind >[] = [
	[ 'none', __( 'None', 'blicks' ) ],
	[ 'recaptcha-v3', __( 'reCAPTCHA v3 · invisible', 'blicks' ) ],
	[ 'recaptcha-v2', __( 'reCAPTCHA v2 · checkbox', 'blicks' ) ],
	[ 'turnstile', __( 'Cloudflare Turnstile', 'blicks' ) ],
];

const CHALLENGE_NOTES: Record< ChallengeKind, string > = {
	none: __( 'No outside script is loaded.', 'blicks' ),
	'recaptcha-v3': __( 'Loads Google’s script on pages with this form only. Nothing for visitors to click.', 'blicks' ),
	'recaptcha-v2': __( 'Loads Google’s script on pages with this form only. Visitors tick a box, sometimes solve a puzzle.', 'blicks' ),
	turnstile: __( 'Loads Cloudflare’s script on pages with this form only. Usually no click needed.', 'blicks' ),
};

export const LOOK_OPTS: Option< Look >[] = [
	[ 'filled', __( 'Filled', 'blicks' ) ],
	[ 'outlined', __( 'Outlined', 'blicks' ) ],
	[ 'line', __( 'Line', 'blicks' ) ],
];

export const LABEL_OPTS: Option< Labels >[] = [
	[ 'above', __( 'Above', 'blicks' ) ],
	[ 'inside', __( 'Inside', 'blicks' ) ],
	[ 'hidden', __( 'Hidden', 'blicks' ) ],
];

export const MARKER_OPTS: Option< Marker >[] = [
	[ 'optional', __( '(optional)', 'blicks' ) ],
	[ 'required', __( '* required', 'blicks' ) ],
	[ 'both', __( 'Both', 'blicks' ) ],
	[ 'none', __( 'None', 'blicks' ) ],
];

const MARKER_NOTES: Record< Marker, string > = {
	optional: __( '“(optional)” after the label of each field that can be left empty.', 'blicks' ),
	required: __( 'A red * after the label of each required field.', 'blicks' ),
	both: __( 'A red * on required fields and “Optional” on the others.', 'blicks' ),
	none: __( 'No mark on any label. Say in the form which fields are needed.', 'blicks' ),
};

/** The sentences the inspector and the canvas show for what is wrong. */
export function problemLines( p: FormProblems ): string[] {
	const lines: string[] = [];
	if ( p.noSubmit ) lines.push( __( 'No Button here sends the form. Add a Button and set its On click to Form › Send it.', 'blicks' ) );
	if ( p.duplicates.length ) {
		lines.push(
			sprintf(
				/* translators: %s: field names, comma separated */
				_n( 'Two fields share the name %s. Entries keep only the first.', 'Fields share the names %s. Entries keep only the first of each.', p.duplicates.length, 'blicks' ),
				p.duplicates.join( ', ' )
			)
		);
	}
	if ( p.unnamed ) {
		lines.push(
			sprintf(
				/* translators: %d: number of fields */
				_n( '%d field has no name, so its answer is not saved.', '%d fields have no name, so their answers are not saved.', p.unnamed, 'blicks' ),
				p.unnamed
			)
		);
	}
	return lines;
}

const named = ( list: Option[], v: string ) => list.find( ( o ) => o[ 0 ] === v )?.[ 1 ] ?? '';

/** Published pages, for After sending › Page. */
function PagePicker( { value, onChange }: { value: number; onChange: ( v: number ) => void } ) {
	const pages = useSelect(
		( select: any ) => select( 'core' ).getEntityRecords( 'postType', 'page', { per_page: 100, status: 'publish', orderby: 'title', order: 'asc', context: 'view' } ),
		[]
	) as any[] | null;
	const options: Option[] = [
		[ '0', pages ? __( 'Choose a page…', 'blicks' ) : __( 'Loading pages…', 'blicks' ) ],
		...( pages ?? [] ).map( ( p ): Option => [ String( p.id ), p.title?.rendered ? decode( p.title.rendered ) : sprintf( /* translators: %d: a page id */ __( 'Page #%d', 'blicks' ), p.id ) ] ),
	];
	if ( value && pages && ! pages.some( ( p ) => p.id === value ) ) {
		options.push( [ String( value ), sprintf( /* translators: %d: a page id */ __( 'Page #%d (not published)', 'blicks' ), value ) ] );
	}
	return (
		<Row label={ __( 'Page', 'blicks' ) } stack set={ !! value }>
			<Select value={ String( value || 0 ) } options={ options } label={ __( 'Page', 'blicks' ) } onChange={ ( v ) => onChange( Number( v ) || 0 ) } />
		</Row>
	);
}

/** A rendered title as text: entities decoded, tags dropped. */
function decode( html: string ): string {
	if ( typeof document === 'undefined' ) return html;
	const el = document.createElement( 'textarea' );
	el.innerHTML = html.replace( /<[^>]*>/g, '' );
	return el.value;
}

/** The Dialog blocks on this page, for After sending › Dialog. */
function DialogPicker( { value, onChange }: { value: string; onChange: ( v: string ) => void } ) {
	const targets = useDialogTargets();
	const options: Option[] = [
		[ '', __( 'Choose a dialog…', 'blicks' ) ],
		...targets.map( ( t ): Option => [ t.id.replace( /^dialog-/, '' ), t.title || t.id ] ),
	];
	if ( value && ! targets.some( ( t ) => t.id === `dialog-${ value }` ) ) {
		options.push( [ value, sprintf( /* translators: %s: a dialog id */ __( '%s (not on this page)', 'blicks' ), `dialog-${ value }` ) ] );
	}
	return (
		<Row label={ __( 'Dialog', 'blicks' ) } stack set={ !! value } note={ targets.length === 0 ? __( 'Add a Dialog block to this page, then choose it here.', 'blicks' ) : undefined } noteIcon="info">
			<Select value={ value } options={ options } label={ __( 'Dialog', 'blicks' ) } onChange={ onChange } />
		</Row>
	);
}

/** The attributes a Field added from the list starts with: the type's defaults, its type, its name as label. */
export function newFieldAttributes( choice: TypeChoice ): Record< string, unknown > {
	return { label: choice.label, ...( choice.defaults ?? {} ), type: choice.type };
}

/**
 * "Add a field": every type, built-in and registered, under a heading per group. A Field goes in
 * before the form's first Button, else at the end.
 */
function useAddField( clientId?: string ) {
	const registered = useFieldTypes();
	const children: any[] = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlocks( clientId ) : [] ), [ clientId ] );
	const { insertBlock } = useDispatch( 'core/block-editor' ) as any;
	const add = ( choice: TypeChoice ) => {
		const button = children.findIndex( ( b ) => b.name === 'blicks/button' || b.name === 'blicks/buttons' );
		insertBlock( createField( newFieldAttributes( choice ) ), button < 0 ? children.length : button, clientId );
	};
	return { groups: typeGroups( registered ), more: moreFieldsLine( registered ), add };
}

/** "Add a field": a row of buttons per group of types, under the group's heading. */
function AddField( { clientId }: { clientId?: string } ) {
	const { groups, more, add } = useAddField( clientId );
	if ( ! clientId ) return null;
	return (
		<>
			{ groups.map( ( group ) => (
				<Row key={ group.heading || 'fields' } label={ group.heading || __( 'Add a field', 'blicks' ) } stack>
					{ group.types.map( ( t ) => (
						<button key={ t.type } type="button" className="btn-add" title={ t.hint || undefined } onClick={ () => add( t ) }>
							{ typeof t.icon === 'string' ? <Icon d={ t.icon } size={ 16 } /> : t.icon }
							{ t.label }
						</button>
					) ) }
				</Row>
			) ) }
			{ more && <Note>{ more }</Note> }
		</>
	);
}

/** The Form's Settings tab: template, what happens when it is sent, after sending, spam. */
export function FormSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const email = cleanEmail( attributes.email );
	const after = cleanAfter( attributes.after );
	const spam = cleanSpam( attributes.spam );
	const marker = cleanMarker( attributes.marker );
	const problems = useFormProblems( clientId );
	const count = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlockCount( clientId ) : 0 ), [ clientId ] );
	const { replaceInnerBlocks } = useDispatch( 'core/block-editor' ) as any;

	const setEmail = ( patch: Partial< typeof email > ) => setAttributes( { email: { ...email, ...patch } } );
	const setAfter = ( patch: Partial< typeof after > ) => setAttributes( { after: { ...after, ...patch } } );
	const setSpam = ( patch: Partial< typeof spam > ) => setAttributes( { spam: cleanSpam( { ...spam, ...patch } ) } );

	const applyTemplate = ( key: string ) => {
		const template = findTemplate( key );
		if ( ! template || ! clientId ) return;
		if ( count > 0 && ! window.confirm( __( 'Changing it replaces the blocks inside this form. Go on?', 'blicks' ) ) ) return;
		replaceInnerBlocks( clientId, templateBlocks( template.key as TemplateKey ), false );
		setAttributes( templateAttributes( template.key, attributes.after ) );
	};

	const templateOpts: Option[] = [
		...( findTemplate( attributes.template ) ? [] : [ [ '', __( 'Choose a template…', 'blicks' ) ] as Option ] ),
		...TEMPLATES.map( ( t ): Option => [ t.key, `${ t.name } · ${ t.hint }` ] ),
	];
	const actions = ( attributes.save !== false ? 1 : 0 ) + ( email.on ? 1 : 0 );

	const template = findTemplate( attributes.template );

	return (
		<>
			{ /* Problems, not a section: they come first, above everything. */ }
			{ hasProblems( problems ) &&
				problemLines( problems ).map( ( line ) => (
					<p key={ line } className="warn">
						<Icon d={ WARN } size={ 16 } />
						{ line }
					</p>
				) ) }
			{ clientId && (
				<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
					<AddField clientId={ clientId } />
				</Sec>
			) }
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ template?.name }>
				<Row label={ __( 'Template', 'blicks' ) } stack set={ !! template } note={ __( 'Changing it replaces the blocks inside this form.', 'blicks' ) } noteIcon="warning">
					<Select value={ template ? attributes.template : '' } options={ templateOpts } label={ __( 'Template', 'blicks' ) } onChange={ applyTemplate } />
				</Row>
				<Row label={ __( 'Mark fields', 'blicks' ) } stack set={ marker !== 'optional' } note={ MARKER_NOTES[ marker ] } noteIcon="info">
					<SegText label={ __( 'Mark fields', 'blicks' ) } options={ MARKER_OPTS } value={ marker } onChange={ ( v ) => setAttributes( { marker: v } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Sending', 'blicks' ) } icon="send" value={ String( actions ) }>
				<Row
					label={ __( 'Form name', 'blicks' ) }
					stack
					set={ !! cleanName( attributes.name ) }
					note={ __( 'Names its entries in Blicks › Entries, and the emails. Empty: the page’s title.', 'blicks' ) }
					noteIcon="info"
				>
					<Field value={ attributes.name || '' } placeholder={ __( 'e.g. Contact, home page', 'blicks' ) } label={ __( 'Form name', 'blicks' ) } onChange={ ( name ) => setAttributes( { name } ) } />
				</Row>
				<Switch
					label={ __( 'Save each entry', 'blicks' ) }
					hint={ __( 'In Blicks › Entries.', 'blicks' ) }
					checked={ attributes.save !== false }
					onChange={ ( save ) => setAttributes( { save } ) }
				/>
				<Switch label={ __( 'Email it', 'blicks' ) } checked={ email.on } onChange={ ( on ) => setEmail( { on } ) } />
				{ email.on && (
					<>
						<Row label={ __( 'To', 'blicks' ) } stack set={ !! email.to } note={ __( 'Separate several addresses with commas. Never shown on the page.', 'blicks' ) } noteIcon="info">
							<Field value={ email.to } placeholder={ __( 'Site admin email', 'blicks' ) } label={ __( 'Send to', 'blicks' ) } onChange={ ( to ) => setEmail( { to } ) } />
						</Row>
						<Row label={ __( 'Subject', 'blicks' ) } stack set={ !! email.subject } note={ __( '{name} tags insert a field’s value.', 'blicks' ) } noteIcon="code">
							<Field value={ email.subject } placeholder={ __( 'New entry: {email}', 'blicks' ) } label={ __( 'Subject', 'blicks' ) } onChange={ ( subject ) => setEmail( { subject } ) } />
						</Row>
						<Switch
							label={ __( 'Reply to the sender', 'blicks' ) }
							hint={ __( 'Replying to the email answers the Email field’s address.', 'blicks' ) }
							checked={ email.replyTo }
							onChange={ ( replyTo ) => setEmail( { replyTo } ) }
						/>
					</>
				) }
			</Sec>
			<Sec title={ __( 'After sending', 'blicks' ) } icon="mark_email_read" value={ named( AFTER_OPTS, after.kind ) }>
				<Row label={ __( 'Show', 'blicks' ) } stack set={ after.kind !== 'message' } note={ AFTER_NOTES[ after.kind ] } noteIcon="info">
					<SegText label={ __( 'After sending', 'blicks' ) } options={ AFTER_OPTS } value={ after.kind } onChange={ ( kind ) => setAfter( { kind } ) } />
				</Row>
				{ after.kind === 'message' && (
					<>
						<Row label={ __( 'Title', 'blicks' ) } stack set={ !! after.title }>
							<Field value={ after.title } placeholder={ __( 'Thanks, your message is on its way', 'blicks' ) } label={ __( 'Sent message title', 'blicks' ) } onChange={ ( title ) => setAfter( { title } ) } />
						</Row>
						<Row label={ __( 'Message', 'blicks' ) } stack set={ !! after.message }>
							<Field value={ after.message } placeholder={ __( 'e.g. We reply within a day.', 'blicks' ) } label={ __( 'Sent message text', 'blicks' ) } onChange={ ( message ) => setAfter( { message } ) } />
						</Row>
					</>
				) }
				{ after.kind === 'page' && <PagePicker value={ after.page } onChange={ ( page ) => setAfter( { page } ) } /> }
				{ after.kind === 'dialog' && <DialogPicker value={ after.dialog } onChange={ ( dialog ) => setAfter( { dialog } ) } /> }
			</Sec>
			<Sec title={ __( 'Spam', 'blicks' ) } icon="shield" value={ named( CHALLENGE_OPTS, spam.challenge ) }>
				<Switch
					label={ __( 'Hidden trap field', 'blicks' ) }
					hint={ __( 'Always on. People never see it; bots fill it in, and their entries go to Spam.', 'blicks' ) }
					checked
					disabled
					onChange={ () => {} }
				/>
				<Row label={ __( 'Wait at least (seconds)', 'blicks' ) } stack set={ spam.minSeconds !== cleanSpam( {} ).minSeconds } note={ __( 'Sent faster than this, an entry is treated as a bot’s. 0 to 60.', 'blicks' ) } noteIcon="info">
					<Field type="number" value={ String( spam.minSeconds ) } label={ __( 'Minimum seconds before sending', 'blicks' ) } onChange={ ( v ) => setSpam( { minSeconds: Number( v ) } ) } />
				</Row>
				<Row
					label={ __( 'Challenge', 'blicks' ) }
					stack
					set={ spam.challenge !== 'none' }
					note={ spam.challenge !== 'none'
						? `${ CHALLENGE_NOTES[ spam.challenge ] } ${ __( 'Keys are set in Blicks › Settings › Forms. Without them the form sends without a challenge.', 'blicks' ) }`
						: CHALLENGE_NOTES[ spam.challenge ] }
					noteIcon="info"
				>
					<Select value={ spam.challenge } options={ CHALLENGE_OPTS } label={ __( 'Challenge', 'blicks' ) } onChange={ ( v ) => setSpam( { challenge: v as ChallengeKind } ) } />
				</Row>
				{ spam.challenge === 'recaptcha-v3' && (
					<Row label={ __( 'Block below (score)', 'blicks' ) } stack set={ spam.minScore !== cleanSpam( {} ).minScore } note={ __( 'From 0 to 1. Lower scores go to Entries › Spam, not lost.', 'blicks' ) } noteIcon="info">
						<Field type="number" value={ String( spam.minScore ) } label={ __( 'Lowest score that passes', 'blicks' ) } onChange={ ( v ) => setSpam( { minScore: Number( v ) } ) } />
					</Row>
				) }
			</Sec>
		</>
	);
}

/** Space between fields, rows then columns; Medium is the stylesheet's own 18px and 16px. */
const FIELD_GAPS: Array< [ string, string, string, string ] > = [
	[ 'sm', __( 'Small', 'blicks' ), '10px', '12px' ],
	[ '', __( 'Medium', 'blicks' ), '', '' ],
	[ 'lg', __( 'Large', 'blicks' ), '28px', '24px' ],
];

const FIELD_GAP_IDS = [ 'layout.gapRow', 'layout.gapColumn' ];

/** Which step the form's gaps are on: none set is Medium; anything else typed is no step (null). */
export function fieldGap( tree: any ): string | null {
	const row = String( tree?.[ 'layout.gapRow' ]?.default?.base ?? '' );
	const col = String( tree?.[ 'layout.gapColumn' ]?.default?.base ?? '' );
	return FIELD_GAPS.find( ( [ , , r, c ] ) => r === row && c === col )?.[ 0 ] ?? null;
}

/** The style tree with the form's gaps on a step: rows and columns together. */
export function withFieldGap( tree: any, step: string ) {
	const [ , , row, col ] = FIELD_GAPS.find( ( [ v ] ) => v === step ) ?? FIELD_GAPS[ 1 ]!;
	return withValue( withValue( tree ?? {}, 'layout.gapRow', row || undefined ), 'layout.gapColumn', col || undefined );
}

/** The error colour: the form's own red, or one of the theme's. */
const ERROR_COLOURS: Array< [ string, string ] > = [
	[ '', __( 'Error red', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ],
];

/** The Form's Style tab: the shared Style panel, then how its fields look (block-only, so last). */
export function FormStyle( { attributes, setAttributes }: PanelProps ) {
	const look = cleanLook( attributes.look );
	const labels = cleanLabels( attributes.labels );
	const gap = fieldGap( attributes.blicks );
	const error = cleanErrorColour( attributes.errorColour );
	const errorSwatches = useSwatches( ERROR_COLOURS ).map( ( s ) => ( s.value ? s : { ...s, css: '#b3261e' } ) );
	const fields = (
		<Sec title={ __( 'Fields', 'blicks' ) } icon="view_agenda" value={ named( LOOK_OPTS, look ) }>
			<Row label={ __( 'Look', 'blicks' ) } set={ look !== 'filled' } note={ __( 'Set on the form: every field follows it.', 'blicks' ) } noteIcon="info">
				<SegText label={ __( 'Look', 'blicks' ) } options={ LOOK_OPTS } value={ look } onChange={ ( v ) => setAttributes( { look: v } ) } />
			</Row>
			<Row label={ __( 'Label', 'blicks' ) } set={ labels !== 'above' } note={ labels === 'hidden' ? __( 'Hidden from view, still read out by screen readers.', 'blicks' ) : undefined } noteIcon="info">
				<SegText label={ __( 'Label', 'blicks' ) } options={ LABEL_OPTS } value={ labels } onChange={ ( v ) => setAttributes( { labels: v } ) } />
			</Row>
			<Row label={ __( 'Space between', 'blicks' ) } stack set={ gap !== '' } hint="gap" note={ gap === null ? __( 'A size set elsewhere. Pick a step to replace it.', 'blicks' ) : undefined } noteIcon="info">
				<Steps label={ __( 'Space between fields', 'blicks' ) } options={ FIELD_GAPS.map( ( [ v, l ] ) => [ v, l ] as Option ) } value={ gap } onChange={ ( g ) => setAttributes( { blicks: withFieldGap( attributes.blicks, g ) } ) } />
			</Row>
			<Row label={ __( 'Errors', 'blicks' ) } stack set={ !! error } note={ __( 'The color of a field’s error and of the message above the form.', 'blicks' ) } noteIcon="info">
				<Swatches swatches={ errorSwatches } value={ error } onChange={ ( errorColour ) => setAttributes( { errorColour } ) } />
			</Row>
		</Sec>
	);
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked={ false } after={ fields } shown={ gap === null ? [] : FIELD_GAP_IDS } />;
}

/** The Form's Motion tab: how it arrives, and the timing of its hover look. */
export function FormMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } />;
}

const plusGlyph = outlineGlyph( 'M12 5v14M5 12h14' );

/** The Form's toolbar: add a field (as Settings' "Add a field" does) and Mark fields. */
export function FormToolbar( { attributes, setAttributes, clientId }: PanelProps ) {
	const { groups, add } = useAddField( clientId );
	return (
		<ToolbarGroup>
			{ clientId && (
				<ToolbarDropdownMenu
					icon={ plusGlyph }
					text={ __( 'Field', 'blicks' ) }
					label={ __( 'Add a field', 'blicks' ) }
					controls={ groups.map( ( group ) => group.types.map( ( t ) => ( { title: t.label, icon: toolbarIcon( t.icon ), onClick: () => add( t ) } ) ) ) }
				/>
			) }
			<ToolbarChoice label={ __( 'Mark fields', 'blicks' ) } value={ cleanMarker( attributes.marker ) } options={ MARKER_OPTS } onChange={ ( marker ) => setAttributes( { marker } ) } />
		</ToolbarGroup>
	);
}
