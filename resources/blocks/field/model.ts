/**
 * The Field block's vocabulary, shared by its editor, the Form's editor and the front-end
 * behaviour. `src/Forms/Schema.php` is the PHP mirror: a value added here is added there.
 */
import { __, sprintf } from '@wordpress/i18n';
import { getFieldType, getFieldTypes, hasRegisteredGroups, type FieldTypeDefinition } from './registry';

/** The types free ships. */
export type BuiltinType = 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'date' | 'time' | 'range' | 'select' | 'choice' | 'consent' | 'hidden';
/**
 * A Field's type: a built-in one, or one a companion plugin registers (`registry.ts`). A type no
 * one registers is kept as saved, never coerced: its plugin may only be switched off for now.
 */
export type FieldType = BuiltinType | ( string & {} );
export type FieldWidth = 'full' | 'two' | 'half' | 'third';

export const FIELD_TYPES: readonly BuiltinType[] = [ 'text', 'textarea', 'email', 'tel', 'number', 'date', 'time', 'range', 'select', 'choice', 'consent', 'hidden' ];

/** Width → columns of the Form's 6-column grid. Phones always take all 6. */
export const WIDTH_SPAN: Record< FieldWidth, number > = { full: 6, two: 4, half: 3, third: 2 };
export const FIELD_WIDTHS = Object.keys( WIDTH_SPAN ) as FieldWidth[];

/** Names a field may not take: the submit request's own keys. They get `_field` appended. */
export const RESERVED_NAMES: readonly string[] = [ 'form', 'post', 'token', 'fields', 'hp', 'challenge', 'page', 'action' ];

/** Values a Hidden field's default may name; filled at render or by the behaviour. */
export const HIDDEN_TOKENS: readonly string[] = [ '{page}', '{url}', '{referrer}', '{title}', '{utm_source}', '{utm_medium}', '{utm_campaign}', '{utm_term}', '{utm_content}' ];

/** The tokens the browser fills (the server cannot know them on a cached page). */
export const CLIENT_TOKENS: readonly string[] = [ '{referrer}', '{utm_source}', '{utm_medium}', '{utm_campaign}', '{utm_term}', '{utm_content}' ];

export const NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/** What a type may be called: the registry's rule, and the class `bl-field--<type>` it becomes. */
export const TYPE_PATTERN = /^[a-z][a-z0-9-]*$/;

export const isBuiltinType = ( type: unknown ): type is BuiltinType => FIELD_TYPES.includes( type as BuiltinType );

/** Built in, or registered by a plugin that is active now. */
export const isKnownType = ( type: unknown ): boolean => isBuiltinType( type ) || ( typeof type === 'string' && !! getFieldType( type ) );

/**
 * The saved type, as it is. Only a missing or malformed one becomes `text` (the block's default);
 * an unknown well-formed type is kept, so a form saved with a plugin's field survives that plugin
 * being off and comes back whole when it is on again. `src/Forms/Schema.php` does the same.
 */
export function cleanType( value: unknown ): FieldType {
	return typeof value === 'string' && TYPE_PATTERN.test( value ) ? value : 'text';
}

export function cleanWidth( value: unknown ): FieldWidth {
	return FIELD_WIDTHS.includes( value as FieldWidth ) ? ( value as FieldWidth ) : 'full';
}

/** Types drawn as a group of boxes, with a `<fieldset>` and `<legend>`. */
export const isGroup = ( type: FieldType ) => type === 'choice';

/** Types that take a placeholder. */
export const hasPlaceholder = ( type: FieldType ) => [ 'text', 'textarea', 'email', 'tel', 'number', 'select' ].includes( type );

/** Types with a list of options. */
export const hasOptions = ( type: FieldType ) => type === 'select' || type === 'choice';

/** Types with min / max / step. */
export const hasBounds = ( type: FieldType ) => [ 'number', 'date', 'time', 'range' ].includes( type );

/** Types with a length limit (and, for Long text, a counter). */
export const hasLength = ( type: FieldType ) => [ 'text', 'textarea', 'email', 'tel' ].includes( type );

/**
 * How a type may be drawn. The first is the default (written as ''). `src/Forms/Schema.php`
 * APPEARANCES is the mirror.
 */
export const APPEARANCES: Partial< Record< BuiltinType, readonly string[] > > = {
	choice: [ 'list', 'chips', 'cards', 'segmented' ],
	consent: [ 'box', 'switch' ],
	number: [ 'field', 'stepper' ],
};

export function cleanAppearance( type: FieldType, value: unknown ): string {
	const list = isBuiltinType( type ) ? APPEARANCES[ type ] : undefined;
	return list && list.includes( value as string ) && value !== list[ 0 ] ? ( value as string ) : '';
}

/** How a Form marks its fields: (optional) on optional ones, * on required ones, both, or neither. */
export type Marker = 'optional' | 'required' | 'both' | 'none';
export const MARKERS: readonly Marker[] = [ 'optional', 'required', 'both', 'none' ];

/**
 * A name for entries and emails, made from a label: "Wedding date" → `wedding_date`. Lower case
 * ASCII, words joined by `_`, starting with a letter, at most 40 characters. Reserved names get
 * `_field` appended. Empty when the label has no letters or digits at all.
 */
export function toFieldName( label: string ): string {
	let name = String( label || '' )
		.normalize( 'NFKD' )
		.replace( /[̀-ͯ]/g, '' )
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '_' )
		.replace( /^_+|_+$/g, '' );
	if ( ! name ) return '';
	if ( ! /^[a-z]/.test( name ) ) name = `f_${ name }`;
	name = name.slice( 0, 40 ).replace( /_+$/, '' );
	if ( RESERVED_NAMES.includes( name ) ) name = `${ name }_field`;
	return name;
}

/** `name` unless taken, else `name_2`, `name_3`… */
export function uniqueName( name: string, taken: readonly string[] ): string {
	if ( ! taken.includes( name ) ) return name;
	for ( let n = 2; ; n++ ) {
		const next = `${ name.slice( 0, 36 ) }_${ n }`;
		if ( ! taken.includes( next ) ) return next;
	}
}

/** The message shown when a field is missing or wrong and the author wrote none. */
export function defaultError( type: FieldType, label: string ): string {
	switch ( type ) {
		case 'email':
			return __( 'Enter an email address like name@example.com.', 'blicks' );
		case 'tel':
			return __( 'Enter a phone number.', 'blicks' );
		case 'number':
			return __( 'Enter a number.', 'blicks' );
		case 'date':
			return __( 'Pick a date.', 'blicks' );
		case 'time':
			return __( 'Pick a time.', 'blicks' );
		case 'range':
			return __( 'Pick a value.', 'blicks' );
		case 'select':
		case 'choice':
			return __( 'Choose an option.', 'blicks' );
		case 'consent':
			return __( 'Tick this box to send the form.', 'blicks' );
		default: {
			const what = String( label || '' ).trim().toLowerCase();
			/* translators: %s: a field's label, in lower case, e.g. "your name" */
			return what ? sprintf( __( 'Fill in %s.', 'blicks' ), what ) : __( 'Fill in this field.', 'blicks' );
		}
	}
}

/** The editor's names for each type, with the icon the prototype uses (Material Symbols name). */
export const TYPE_INFO: Record< BuiltinType, { label: string; hint: string } > = {
	text: { label: __( 'Short text', 'blicks' ), hint: __( 'One line', 'blicks' ) },
	textarea: { label: __( 'Long text', 'blicks' ), hint: __( 'A message', 'blicks' ) },
	email: { label: __( 'Email', 'blicks' ), hint: __( 'Checked as an address', 'blicks' ) },
	tel: { label: __( 'Phone', 'blicks' ), hint: __( 'Any country format', 'blicks' ) },
	number: { label: __( 'Number', 'blicks' ), hint: __( 'Min, max, step', 'blicks' ) },
	date: { label: __( 'Date', 'blicks' ), hint: __( 'The browser’s picker', 'blicks' ) },
	time: { label: __( 'Time', 'blicks' ), hint: __( 'Hours and minutes', 'blicks' ) },
	range: { label: __( 'Slider', 'blicks' ), hint: __( 'A value on a scale', 'blicks' ) },
	select: { label: __( 'Dropdown', 'blicks' ), hint: __( 'One from a list', 'blicks' ) },
	choice: { label: __( 'Choices', 'blicks' ), hint: __( 'One or several', 'blicks' ) },
	consent: { label: __( 'Consent', 'blicks' ), hint: __( 'A box to tick', 'blicks' ) },
	hidden: { label: __( 'Hidden', 'blicks' ), hint: __( 'Page, source, campaign', 'blicks' ) },
};

/**
 * A type's name and hint for the editor: the built-in one, the registered one, or — for a type
 * whose plugin is not active — the bare type, so the author can still tell what it was.
 */
export function typeInfo( type: FieldType ): { label: string; hint: string } {
	if ( isBuiltinType( type ) ) return TYPE_INFO[ type ];
	const registered = getFieldType( type );
	return registered ? { label: registered.label, hint: registered.description ?? '' } : { label: type, hint: '' };
}

/** One entry of the Type picker and the "Add a field" list. */
export interface TypeChoice {
	type: FieldType;
	label: string;
	hint: string;
	icon?: FieldTypeDefinition[ 'icon' ];
	/** The attributes a new Field of this type starts with. */
	defaults?: Record< string, unknown >;
}

/** A heading and its types. The built-in group's heading is `''` while it is the only group. */
export interface TypeGroup {
	heading: string;
	types: TypeChoice[];
}

/**
 * The types to offer, grouped: free's own first (with any registered type that names no group),
 * then one group per registered `group`, in the order each first appeared.
 */
export function typeGroups( registered: readonly FieldTypeDefinition[] = getFieldTypes() ): TypeGroup[] {
	const choice = ( t: FieldTypeDefinition ): TypeChoice => ( {
		type: t.type,
		label: t.label,
		hint: t.description ?? '',
		...( t.icon !== undefined ? { icon: t.icon } : {} ),
		...( t.defaults ? { defaults: t.defaults } : {} ),
	} );
	const builtIn: TypeGroup = {
		heading: '',
		types: [ ...FIELD_TYPES.map( ( type ): TypeChoice => ( { type, ...TYPE_INFO[ type ] } ) ), ...registered.filter( ( t ) => ! t.group ).map( choice ) ],
	};
	const groups = new Map< string, TypeChoice[] >();
	for ( const t of registered ) {
		if ( ! t.group ) continue;
		groups.set( t.group, [ ...( groups.get( t.group ) ?? [] ), choice( t ) ] );
	}
	if ( ! groups.size ) return [ builtIn ];
	return [ { ...builtIn, heading: __( 'Fields', 'blicks' ) }, ...Array.from( groups, ( [ heading, list ] ) => ( { heading, types: list } ) ) ];
}

/**
 * The one quiet line under the pickers while no companion has added a group of its own: plain
 * text, no link, no lock. Empty once one has.
 */
export function moreFieldsLine( registered: readonly FieldTypeDefinition[] = getFieldTypes() ): string {
	return hasRegisteredGroups( registered ) ? '' : __( 'More fields in Blicks Pro', 'blicks' );
}

export const WIDTH_LABELS: Record< FieldWidth, string > = {
	full: __( 'Full', 'blicks' ),
	two: __( '2/3', 'blicks' ),
	half: __( 'Half', 'blicks' ),
	third: __( '1/3', 'blicks' ),
};
