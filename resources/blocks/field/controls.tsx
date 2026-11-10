import { useSyncExternalStore } from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import { __, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { Field, Icon, Note, Row, SegText, Sec, Select, Switch, type Option } from '@/framework/inspector-v2/kit';
import { Sym } from '@/framework/inspector-v2/sym';
import {
	APPEARANCES,
	FIELD_WIDTHS,
	HIDDEN_TOKENS,
	WIDTH_LABELS,
	cleanAppearance,
	cleanType,
	isBuiltinType,
	isKnownType,
	moreFieldsLine,
	typeGroups,
	typeInfo,
	cleanWidth,
	defaultError,
	hasBounds,
	hasLength,
	hasOptions,
	hasPlaceholder,
	toFieldName,
	type FieldType,
	type FieldWidth,
	type TypeGroup,
} from './model';
import { getFieldType, getFieldTypes, subscribeFieldTypes, type FieldTypeDefinition } from './registry';
import {
	addOption,
	findRole,
	fieldChildSpecs,
	hasParts,
	helpIndex,
	helpSpec,
	labelIndex,
	labelMove,
	labelSpec,
	moveOption,
	optionRows,
	rangeBounds,
	removeOption,
	rowsToAttributes,
	setNote,
	setOption,
	specToBlock,
	toRichText,
	type OptionRows,
} from './create';

/** The registered field types, re-read whenever a companion registers or removes one. */
export function useFieldTypes(): readonly FieldTypeDefinition[] {
	return useSyncExternalStore( subscribeFieldTypes, getFieldTypes, getFieldTypes );
}

/**
 * The Type picker: built-in and registered types, a heading (`<optgroup>`) per group once a
 * companion has added one. A saved type no active plugin registers stays listed, as itself.
 */
function TypeSelect( { value, groups, onChange }: { value: FieldType; groups: TypeGroup[]; onChange: ( v: FieldType ) => void } ) {
	const listed = groups.some( ( g ) => g.types.some( ( t ) => t.type === value ) );
	const options = ( group: TypeGroup ) => group.types.map( ( t ) => <option key={ t.type } value={ t.type }>{ t.label }</option> );
	return (
		// The kit Select's markup, with a heading (`<optgroup>`) per group, which `Select` cannot draw.
		<span className="bui-select">
			<select value={ value } aria-label={ __( 'Type', 'blicks' ) } onChange={ ( e ) => onChange( cleanType( e.currentTarget.value ) ) }>
			{ ! listed && (
				<option value={ value }>
					{ sprintf( /* translators: %s: a field type's name, from a plugin that is not active */ __( '%s (not active)', 'blicks' ), value ) }
				</option>
			) }
			{ groups.map( ( group ) =>
				group.heading ? (
					<optgroup key={ group.heading } label={ group.heading }>
						{ options( group ) }
					</optgroup>
				) : (
					options( group )
				)
			) }
			</select>
			<Sym name="expand_more" />
		</span>
	);
}

/** True for a value a new type's `defaults` may fill: nothing set yet. */
const unset = ( v: unknown ) =>
	v === undefined || v === null || v === '' || ( Array.isArray( v ) && ! v.length ) || ( typeof v === 'object' && ! Array.isArray( v ) && ! Object.keys( v as object ).length );
const WIDTH_OPTS: Option< FieldWidth >[] = FIELD_WIDTHS.map( ( w ) => [ w, WIDTH_LABELS[ w ] ] );

/** The plain names of each way a type can be drawn (model.ts APPEARANCES). */
const APPEARANCE_NAMES: Record< string, string > = {
	list: __( 'List', 'blicks' ),
	chips: __( 'Chips', 'blicks' ),
	cards: __( 'Cards', 'blicks' ),
	segmented: __( 'Segments', 'blicks' ),
	box: __( 'Box', 'blicks' ),
	switch: __( 'Switch', 'blicks' ),
	field: __( 'Field', 'blicks' ),
	stepper: __( 'Stepper', 'blicks' ),
};

const APPEARANCE_NOTES: Record< string, string > = {
	list: __( 'One option per line, each with its button.', 'blicks' ),
	chips: __( 'Rounded pills in a row; the picked ones fill in.', 'blicks' ),
	cards: __( 'A card per option, with room for its note.', 'blicks' ),
	segmented: __( 'One joined bar. Best for two to five short options.', 'blicks' ),
	box: __( 'A box to tick.', 'blicks' ),
	switch: __( 'An on/off switch.', 'blicks' ),
	field: __( 'A box to type the number in.', 'blicks' ),
	stepper: __( 'The number between − and + buttons.', 'blicks' ),
};

const TOKEN_NAMES: Record< string, string > = {
	'{page}': __( 'Page id', 'blicks' ),
	'{url}': __( 'Page address', 'blicks' ),
	'{title}': __( 'Page title', 'blicks' ),
	'{referrer}': __( 'Where the visitor came from', 'blicks' ),
	'{utm_source}': __( 'Campaign source (utm_source)', 'blicks' ),
	'{utm_medium}': __( 'Campaign medium (utm_medium)', 'blicks' ),
	'{utm_campaign}': __( 'Campaign name (utm_campaign)', 'blicks' ),
	'{utm_term}': __( 'Campaign term (utm_term)', 'blicks' ),
	'{utm_content}': __( 'Campaign content (utm_content)', 'blicks' ),
};
const CUSTOM = '';
const DEFAULT_OPTS: Option[] = [ [ CUSTOM, __( 'A fixed value', 'blicks' ) ], ...HIDDEN_TOKENS.map( ( t ): Option => [ t, TOKEN_NAMES[ t ] ?? t ] ) ];

const UP = 'M12 19V5M6 11l6-6 6 6';
const DOWN = 'M12 5v14M6 13l6 6 6-6';
const REMOVE = 'M6 6l12 12M18 6L6 18';
const ADD = 'M12 5v14M5 12h14';

/**
 * Text rows: add, remove, reorder. Empty rows are kept while typing; the server drops them. With
 * `notes`, each row has a line under it for a description or a price, moved and removed with it.
 */
function OptionsList( { value, notes, onChange }: { value: OptionRows; notes: boolean; onChange: ( v: OptionRows ) => void } ) {
	const { options } = value;
	return (
		<div className="opt-list">
			{ options.map( ( option, i ) => (
				<div className="opt-item" key={ i }>
					<div className="inp">
						<input
							value={ option }
							placeholder={ sprintf( /* translators: %d: option number */ __( 'Option %d', 'blicks' ), i + 1 ) }
							aria-label={ sprintf( /* translators: %d: option number */ __( 'Option %d', 'blicks' ), i + 1 ) }
							onChange={ ( e ) => onChange( setOption( value, i, e.currentTarget.value ) ) }
						/>
						<button type="button" className="copy" disabled={ i === 0 } title={ __( 'Move up', 'blicks' ) } aria-label={ __( 'Move up', 'blicks' ) } onClick={ () => onChange( moveOption( value, i, -1 ) ) }>
							<Icon d={ UP } size={ 16 } />
						</button>
						<button type="button" className="copy" disabled={ i === options.length - 1 } title={ __( 'Move down', 'blicks' ) } aria-label={ __( 'Move down', 'blicks' ) } onClick={ () => onChange( moveOption( value, i, 1 ) ) }>
							<Icon d={ DOWN } size={ 16 } />
						</button>
						<button type="button" className="copy" title={ __( 'Remove', 'blicks' ) } aria-label={ __( 'Remove', 'blicks' ) } onClick={ () => onChange( removeOption( value, i ) ) }>
							<Icon d={ REMOVE } size={ 16 } />
						</button>
					</div>
					{ notes && (
						<Field
							value={ value.notes[ i ] ?? '' }
							placeholder={ __( 'Note or price (optional)', 'blicks' ) }
							label={ sprintf( /* translators: %d: option number */ __( 'Note for option %d', 'blicks' ), i + 1 ) }
							onChange={ ( v ) => onChange( setNote( value, i, v ) ) }
						/>
					) }
				</div>
			) ) }
			<button type="button" className="btn-add" onClick={ () => onChange( addOption( value ) ) }>
				<Icon d={ ADD } size={ 16 } />
				{ __( 'Add option', 'blicks' ) }
			</button>
		</div>
	);
}

/** A labelled text setting: the kit Row around a Field. */
function TextRow( { label, value, placeholder, type, stack, note, noteIcon, onChange }: {
	label: string;
	value: string;
	placeholder?: string;
	type?: string;
	stack?: boolean;
	note?: string;
	noteIcon?: string;
	onChange: ( v: string ) => void;
} ) {
	return (
		<Row label={ label } stack={ stack } set={ !! value } note={ note } noteIcon={ noteIcon }>
			<Field value={ value } placeholder={ placeholder } label={ label } type={ type } onChange={ onChange } />
		</Row>
	);
}

const EDITOR = 'core/block-editor';

/** The placeholder of a Lowest / Highest box: the format the type takes. */
function boundHint( type: FieldType, fallback: string ): string {
	if ( type === 'date' ) return __( 'YYYY-MM-DD or today', 'blicks' );
	if ( type === 'time' ) return __( 'HH:MM', 'blicks' );
	return fallback;
}

/**
 * The Field's parts and the edits that add, remove and arrange them. Each edit is one undo step:
 * the parts and the attributes that go with them change together, in one batch.
 */
function useParts( clientId: string | undefined, attributes: any, setAttributes: ( a: any ) => void ) {
	const registry = useRegistry();
	const children: any[] = useSelect( ( select: any ) => ( clientId ? select( EDITOR ).getBlocks( clientId ) : [] ), [ clientId ] );
	const { insertBlock, removeBlock, replaceInnerBlocks, moveBlockToPosition } = useDispatch( EDITOR ) as any;
	const label = findRole( children, 'label' );
	const help = findRole( children, 'help' );

	const setType = ( next: FieldType ) => {
		registry.batch( () => {
			const was = cleanType( attributes.type );
			// A look the new type has no name for goes back to its default.
			// A registered type's defaults fill what is still empty; nothing the author set is replaced.
			const defaults = Object.fromEntries( Object.entries( getFieldType( next )?.defaults ?? {} ).filter( ( [ key ] ) => key !== 'type' && unset( attributes[ key ] ) ) );
			setAttributes( { ...defaults, type: next, appearance: cleanAppearance( next, attributes.appearance ) } );
			if ( ! clientId ) return;
			// Hidden has nothing to show; coming back from it, the parts are made again.
			if ( ! hasParts( next ) ) {
				if ( children.length ) replaceInnerBlocks( clientId, [], false );
			} else if ( ! hasParts( was ) || ! findRole( children, 'input' ) ) {
				replaceInnerBlocks( clientId, fieldChildSpecs( { ...attributes, type: next } ).map( specToBlock ), false );
			} else if ( label ) {
				const to = labelMove( next, children );
				if ( to !== null ) moveBlockToPosition( label.clientId, clientId, clientId, to );
			}
		} );
	};

	const setLabel = ( on: boolean ) => {
		if ( ! clientId ) return;
		if ( on && ! label ) {
			insertBlock( specToBlock( labelSpec( toRichText( String( attributes.label || '' ) ) ) ), labelIndex( cleanType( attributes.type ), children ), clientId, false );
		} else if ( ! on && label ) {
			removeBlock( label.clientId, false );
		}
	};

	const setHelp = ( on: boolean ) => {
		if ( ! clientId ) return;
		if ( on && ! help ) {
			const text = String( attributes.help || '' ) || __( 'A line under the field', 'blicks' );
			insertBlock( specToBlock( helpSpec( toRichText( text ) ) ), helpIndex( children ), clientId, false );
		} else if ( ! on && help ) {
			registry.batch( () => {
				removeBlock( help.clientId, false );
				setAttributes( { help: '' } );
			} );
		}
	};

	return { hasLabel: !! label, hasHelp: !! help, setType, setLabel, setHelp };
}

/** The Field's Settings tab: what it asks, then the rules it is checked by. */
export function FieldSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const type = cleanType( attributes.type );
	const rows = optionRows( attributes );
	const looks = isBuiltinType( type ) ? APPEARANCES[ type ] : undefined;
	const look = cleanAppearance( type, attributes.appearance ) || looks?.[ 0 ] || '';
	const isRange = type === 'range';
	const isTime = type === 'time';
	const middle = isRange ? String( rangeBounds( { ...attributes, defaultValue: '' } ).value ) : '';
	const defaultValue = String( attributes.defaultValue || '' );
	const token = HIDDEN_TOKENS.includes( defaultValue ) ? defaultValue : CUSTOM;
	const isDate = type === 'date';
	const parts = useParts( clientId, attributes, setAttributes );
	const registered = useFieldTypes();
	const known = isKnownType( type );
	const info = typeInfo( type );
	const more = moreFieldsLine( registered );
	const Extra = registered.find( ( t ) => t.type === type )?.controls;

	const name = (
		<Row label={ __( 'Name', 'blicks' ) } set={ !! attributes.name } hint="name" note={ __( 'The column it gets in entries and emails.', 'blicks' ) } noteIcon="info">
			<label className="bui-fld">
				<input
					value={ attributes.name || '' }
					placeholder="your_name"
					aria-label={ __( 'Name', 'blicks' ) }
					spellCheck={ false }
					// Typed as a slug, tidied (and checked against the reserved names) on leaving.
					onChange={ ( e ) => setAttributes( { name: e.currentTarget.value.toLowerCase().replace( /[^a-z0-9_]+/g, '_' ).slice( 0, 40 ) } ) }
					onBlur={ ( e ) => setAttributes( { name: toFieldName( e.currentTarget.value ) } ) }
				/>
			</label>
		</Row>
	);

	const picker = (
		<>
			<Row label={ __( 'Type', 'blicks' ) } stack set={ type !== 'text' } note={ info.hint || undefined } noteIcon="info">
				<TypeSelect value={ type } groups={ typeGroups( registered ) } onChange={ parts.setType } />
			</Row>
			{ more && <Note>{ more }</Note> }
		</>
	);

	// A type no active plugin registers: say so, keep it as it is, offer only what is safe to edit.
	if ( ! known ) {
		return (
			<>
				<p className="warn">
					{ sprintf(
						/* translators: %s: the field's type, e.g. rating */
						__( 'This field’s type, %s, comes from a plugin that is not active. It is not shown on the page.', 'blicks' ),
						type
					) }
				</p>
				<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note" value={ info.label }>
					{ picker }
					{ name }
				</Sec>
			</>
		);
	}

	const width = cleanWidth( attributes.width );
	const hasValues = hasLength( type ) || hasBounds( type ) || isRange || type === 'hidden';

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note" value={ info.label }>
				{ picker }

				{ name }

				{ type !== 'hidden' && (
					<Switch
						label={ type === 'consent' ? __( 'Sentence', 'blicks' ) : __( 'Label', 'blicks' ) }
						hint={ parts.hasLabel ? __( 'A Text block: write and style it in place.', 'blicks' ) : __( 'No visible label.', 'blicks' ) }
						checked={ parts.hasLabel }
						onChange={ parts.setLabel }
					/>
				) }

				{ hasPlaceholder( type ) && (
					<TextRow
						label={ type === 'select' ? __( 'Empty choice', 'blicks' ) : __( 'Placeholder', 'blicks' ) }
						stack
						value={ attributes.placeholder || '' }
						placeholder={ type === 'select' ? __( 'Choose one', 'blicks' ) : __( 'Shown while it is empty', 'blicks' ) }
						onChange={ ( placeholder ) => setAttributes( { placeholder } ) }
					/>
				) }

				{ hasOptions( type ) && (
					<Row
						label={ __( 'Options', 'blicks' ) }
						stack
						set={ rows.options.some( Boolean ) }
						note={ type === 'choice' ? __( 'A note shows under its option: a short description or a price.', 'blicks' ) : undefined }
						noteIcon="info"
					>
						<OptionsList value={ rows } notes={ type === 'choice' } onChange={ ( next ) => setAttributes( rowsToAttributes( next ) ) } />
					</Row>
				) }
				{ type === 'choice' && (
					<Switch
						label={ __( 'Several answers', 'blicks' ) }
						hint={ attributes.multiple ? __( 'Boxes to tick, any number of them.', 'blicks' ) : __( 'One answer, as round buttons.', 'blicks' ) }
						checked={ !! attributes.multiple }
						onChange={ ( multiple ) => setAttributes( { multiple } ) }
					/>
				) }

				{ type !== 'hidden' && (
					<Switch
						label={ __( 'Help text', 'blicks' ) }
						hint={ parts.hasHelp ? __( 'A Text block under the field.', 'blicks' ) : __( 'A line under the field.', 'blicks' ) }
						checked={ parts.hasHelp }
						onChange={ parts.setHelp }
					/>
				) }
			</Sec>

			{ looks && (
				<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ APPEARANCE_NAMES[ look ] ?? look }>
					<Row label={ __( 'Appearance', 'blicks' ) } stack set={ look !== looks[ 0 ] } note={ APPEARANCE_NOTES[ look ] } noteIcon="info">
						<SegText
							label={ __( 'Appearance', 'blicks' ) }
							options={ looks.map( ( a ): Option => [ a, APPEARANCE_NAMES[ a ] ?? a ] ) }
							value={ look }
							onChange={ ( v ) => setAttributes( { appearance: cleanAppearance( type, v ) } ) }
						/>
					</Row>
				</Sec>
			) }

			{ type !== 'hidden' && type !== 'consent' && (
				<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ WIDTH_LABELS[ width ] }>
					<Row label={ __( 'Width', 'blicks' ) } stack set={ width !== 'full' } note={ __( 'Phones always use the full width.', 'blicks' ) } noteIcon="smartphone">
						<SegText label={ __( 'Width', 'blicks' ) } options={ WIDTH_OPTS } value={ width } onChange={ ( v ) => setAttributes( { width: v } ) } />
					</Row>
				</Sec>
			) }

			{ hasValues && (
				<Sec title={ __( 'Values', 'blicks' ) } icon="tune">
					{ hasLength( type ) && (
						<TextRow
							label={ __( 'Most characters', 'blicks' ) }
							value={ attributes.maxLength || '' }
							placeholder={ __( 'No limit', 'blicks' ) }
							type="number"
							note={ type === 'textarea' ? __( 'Long text shows a counter under the box.', 'blicks' ) : undefined }
							noteIcon="info"
							onChange={ ( v ) => setAttributes( { maxLength: v.replace( /[^0-9]/g, '' ) } ) }
						/>
					) }

					{ hasBounds( type ) && (
						<>
							<TextRow label={ __( 'Lowest', 'blicks' ) } value={ attributes.min || '' } placeholder={ boundHint( type, '0' ) } onChange={ ( v ) => setAttributes( { min: v.trim() } ) } />
							<TextRow
								label={ __( 'Highest', 'blicks' ) }
								value={ attributes.max || '' }
								placeholder={ boundHint( type, '100' ) }
								note={ isTime ? __( 'Times as HH:MM, on the 24-hour clock, e.g. 09:00 and 17:30.', 'blicks' ) : undefined }
								noteIcon="info"
								onChange={ ( v ) => setAttributes( { max: v.trim() } ) }
							/>
							{ ! isTime && (
								<TextRow
									label={ isDate ? __( 'Step, in days', 'blicks' ) : __( 'Step', 'blicks' ) }
									value={ attributes.step || '' }
									placeholder="1"
									note={ isDate ? __( '“today” is the day the page is shown, in the site’s timezone.', 'blicks' ) : undefined }
									noteIcon="info"
									onChange={ ( v ) => setAttributes( { step: v.trim() } ) }
								/>
							) }
						</>
					) }

					{ isRange && (
						<>
							<TextRow label={ __( 'Start value', 'blicks' ) } value={ defaultValue } placeholder={ middle } note={ __( 'Empty: the middle of the scale.', 'blicks' ) } noteIcon="info" onChange={ ( v ) => setAttributes( { defaultValue: v.trim() } ) } />
							<TextRow label={ __( 'Before the number', 'blicks' ) } stack value={ attributes.prefix || '' } placeholder={ __( 'e.g. £', 'blicks' ) } onChange={ ( prefix ) => setAttributes( { prefix } ) } />
							<TextRow label={ __( 'After the highest', 'blicks' ) } stack value={ attributes.suffix || '' } placeholder={ __( 'e.g. +', 'blicks' ) } onChange={ ( suffix ) => setAttributes( { suffix } ) } />
						</>
					) }

					{ type === 'hidden' && (
						<>
							<Row label={ __( 'Value', 'blicks' ) } stack set={ !! defaultValue } note={ token === CUSTOM ? undefined : __( 'Sent with every entry. Visitors never see it.', 'blicks' ) } noteIcon="info">
								<Select value={ token } options={ DEFAULT_OPTS } label={ __( 'Value', 'blicks' ) } onChange={ ( v ) => setAttributes( { defaultValue: v } ) } />
							</Row>
							{ token === CUSTOM && (
								<TextRow
									label={ __( 'Fixed value', 'blicks' ) }
									stack
									value={ defaultValue }
									placeholder={ __( 'e.g. spring-offer', 'blicks' ) }
									note={ __( 'Sent with every entry. Visitors never see it.', 'blicks' ) }
									noteIcon="info"
									onChange={ ( v ) => setAttributes( { defaultValue: v } ) }
								/>
							) }
						</>
					) }
				</Sec>
			) }

			{ Extra && (
				<Sec title={ info.label } icon="settings">
					<Extra attributes={ attributes } setAttributes={ setAttributes } />
				</Sec>
			) }

			{ type !== 'hidden' && (
				<Sec title={ __( 'Rules', 'blicks' ) } icon="rule">
					<Switch label={ __( 'Required', 'blicks' ) } checked={ !! attributes.required } onChange={ ( required ) => setAttributes( { required } ) } />
					<TextRow
						label={ __( 'When it is missing or wrong', 'blicks' ) }
						stack
						value={ attributes.errorMessage || '' }
						placeholder={ defaultError( type, attributes.label || '' ) }
						onChange={ ( errorMessage ) => setAttributes( { errorMessage } ) }
					/>
				</Sec>
			) }

			{ type !== 'hidden' && ! parts.hasLabel && (
				<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new">
					<TextRow
						label={ __( 'Name read out by screen readers', 'blicks' ) }
						stack
						value={ attributes.label || '' }
						placeholder={ type === 'consent' ? __( 'I agree to be contacted', 'blicks' ) : __( 'e.g. Your name', 'blicks' ) }
						note={ __( 'There is no visible label, so this names the field.', 'blicks' ) }
						noteIcon="info"
						onChange={ ( label ) => setAttributes( { label } ) }
					/>
				</Sec>
			) }
		</>
	);
}

/** The Field's Style tab: the shared Style panel, as a box's. */
export function FieldStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked={ false } />;
}

/**
 * The Field's toolbar: Required, Width and, where the type has more than one, Appearance — the
 * writes its Settings tab makes. A hidden field has none of them; a consent box has no width.
 */
export function FieldToolbar( { attributes, setAttributes }: PanelProps ) {
	const type = cleanType( attributes.type );
	if ( type === 'hidden' ) return null;
	const looks = isBuiltinType( type ) ? APPEARANCES[ type ] : undefined;
	return (
		<ToolbarGroup>
			<ToolbarButton label={ __( 'Required', 'blicks' ) } isPressed={ !! attributes.required } onClick={ () => setAttributes( { required: ! attributes.required } ) }>
				{ __( 'Required', 'blicks' ) }
			</ToolbarButton>
			{ type !== 'consent' && (
				<ToolbarChoice label={ __( 'Width', 'blicks' ) } value={ cleanWidth( attributes.width ) } options={ WIDTH_OPTS } onChange={ ( width ) => setAttributes( { width } ) } />
			) }
			{ looks && looks.length > 1 && (
				<ToolbarChoice
					label={ __( 'Appearance', 'blicks' ) }
					value={ cleanAppearance( type, attributes.appearance ) || looks[ 0 ] }
					options={ looks.map( ( a ) => [ a, APPEARANCE_NAMES[ a ] ?? a ] as const ) }
					onChange={ ( v ) => setAttributes( { appearance: cleanAppearance( type, v ) } ) }
				/>
			) }
		</ToolbarGroup>
	);
}
