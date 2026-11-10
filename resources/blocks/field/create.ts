/**
 * A Field's parts. A Field is a container: its label and help are Text blocks and its control an
 * Input block, each styled on its own. The Field keeps every semantic attribute (type, name,
 * label…), so the server's schema, the validator and the entries never look inside it.
 *
 * The specs here are plain data (`[ name, attributes, inner ]`) so templates and tests can use them
 * without a block registry; `createField()` turns one into blocks.
 */
import { createBlock } from '@wordpress/blocks';
import { cleanType, type FieldType } from './model';

export type BlockSpec = [ name: string, attributes: Record< string, unknown >, inner?: BlockSpec[] ];

export const TEXT = 'blicks/text';
export const INPUT = 'blicks/input';

/** What a Text inside a Field is for, saved in its `metadata.blicksRole`. */
export type FieldRole = 'label' | 'help';

/** The blocks a Field holds. */
export const FIELD_CHILDREN = [ TEXT, INPUT, 'blicks/icon' ];

/** The Input is the field: it cannot be removed on its own. */
export const INPUT_LOCK = { remove: true };

/** Types with no visible parts at all. */
export const hasParts = ( type: FieldType ) => type !== 'hidden';

/** Consent reads as a sentence beside its box: the label comes after the control. */
export const labelAfter = ( type: FieldType ) => type === 'consent';

export function labelSpec( content: string ): BlockSpec {
	return [ TEXT, { content, metadata: { name: 'Label', blicksRole: 'label' } } ];
}

export function helpSpec( content: string ): BlockSpec {
	return [ TEXT, { content, metadata: { name: 'Help', blicksRole: 'help' } } ];
}

export function inputSpec(): BlockSpec {
	return [ INPUT, { lock: INPUT_LOCK } ];
}

/** The escaped form a plain-text attribute takes as a Text block's rich text. */
export function toRichText( text: string ): string {
	return String( text || '' ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );
}

/**
 * The parts a new Field starts with: its label (before the control, after it for consent), the
 * Input, and its help when it has some. A Hidden field has none.
 */
export function fieldChildSpecs( attributes: Record< string, unknown > ): BlockSpec[] {
	const type = cleanType( attributes.type );
	if ( ! hasParts( type ) ) return [];
	const label = labelSpec( toRichText( String( attributes.label || '' ) ) );
	const help = String( attributes.help || '' );
	return [
		...( labelAfter( type ) ? [ inputSpec(), label ] : [ label, inputSpec() ] ),
		...( help ? [ helpSpec( toRichText( help ) ) ] : [] ),
	];
}

/** A Field as a spec, with its parts. */
export function fieldSpec( attributes: Record< string, unknown > ): BlockSpec {
	return [ 'blicks/field', attributes, fieldChildSpecs( attributes ) ];
}

/**
 * A spec as blocks, each with its own client id. Each Blicks block also gets the `uniqueId` its
 * editor would give it on mount (define-block.tsx), so seeding a Field is one undo step rather than
 * one more per part.
 */
export const specToBlock = ( [ name, attributes, inner = [] ]: BlockSpec ): any => {
	const block = createBlock( name, attributes, inner.map( specToBlock ) );
	if ( name.startsWith( 'blicks/' ) && ! block.attributes.uniqueId ) {
		block.attributes.uniqueId = String( block.clientId ).replace( /-/g, '' ).slice( 0, 8 );
	}
	return block;
};

/** A spec in the shape a block's inserter `example` takes. */
export const specToExample = ( [ name, attributes, inner = [] ]: BlockSpec ): any => ( {
	name,
	attributes,
	...( inner.length ? { innerBlocks: inner.map( specToExample ) } : {} ),
} );

/** A new Field block, seeded with its label, Input and help. */
export function createField( attributes: Record< string, unknown > ): any {
	return specToBlock( fieldSpec( attributes ) );
}

/* -------------------------------------------------------------------------------------------- */
/* Reading and arranging a Field's parts                                                         */
/* -------------------------------------------------------------------------------------------- */

interface Child {
	clientId?: string;
	name: string;
	attributes?: Record< string, any >;
}

/** What a child of a Field is: its label, its help, its Input, or something else. */
export function roleOf( block: Child | undefined ): FieldRole | 'input' | null {
	if ( ! block ) return null;
	if ( block.name === INPUT ) return 'input';
	if ( block.name !== TEXT ) return null;
	const role = block.attributes?.metadata?.blicksRole;
	return role === 'label' || role === 'help' ? role : null;
}

export const findRole = < T extends Child >( children: T[], role: FieldRole | 'input' ): T | undefined =>
	children.find( ( c ) => roleOf( c ) === role );

/** Where a new label goes among a Field's children: before the Input, or after it for consent. */
export function labelIndex( type: FieldType, children: Child[] ): number {
	const input = children.findIndex( ( c ) => roleOf( c ) === 'input' );
	if ( input < 0 ) return labelAfter( type ) ? children.length : 0;
	return labelAfter( type ) ? input + 1 : input;
}

/** Where new help goes: after the Input, and after the label when that follows the Input. */
export function helpIndex( children: Child[] ): number {
	const input = children.findIndex( ( c ) => roleOf( c ) === 'input' );
	const label = children.findIndex( ( c ) => roleOf( c ) === 'label' );
	const last = Math.max( input, label );
	return last < 0 ? children.length : last + 1;
}

/**
 * When the type changes the label moves to its side of the Input (after it for consent, before it
 * otherwise). The index to move it to, or null when it is already there.
 */
export function labelMove( type: FieldType, children: Child[] ): number | null {
	const input = children.findIndex( ( c ) => roleOf( c ) === 'input' );
	const label = children.findIndex( ( c ) => roleOf( c ) === 'label' );
	if ( input < 0 || label < 0 ) return null;
	if ( labelAfter( type ) ) return label > input ? null : input;
	return label < input ? null : input;
}

/** A Text's rich text as the plain words a screen reader and an entries column use. */
export function plainText( html: unknown ): string {
	const text = String( html ?? '' )
		.replace( /<br\s*\/?>/gi, ' ' )
		.replace( /<[^>]*>/g, '' )
		.replace( /&nbsp;/g, ' ' )
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /&#0?39;/g, "'" )
		.replace( /&amp;/g, '&' );
	return text.replace( /\s+/g, ' ' ).trim();
}

/* -------------------------------------------------------------------------------------------- */
/* Options and their notes                                                                       */
/* -------------------------------------------------------------------------------------------- */

/**
 * A choice's options and the note under each (a description or a price), as two arrays kept in
 * step: `notes[ i ]` belongs to `options[ i ]`. Notes are saved trimmed of trailing empties, so a
 * field with no notes saves `[]`.
 */
export interface OptionRows {
	options: string[];
	notes: string[];
}

const strings = ( value: unknown ): string[] => ( Array.isArray( value ) ? value.map( ( v ) => String( v ?? '' ) ) : [] );

/** Drops the empty notes at the end: nothing after them is lost, and none-at-all saves `[]`. */
export function trimNotes( notes: readonly string[] ): string[] {
	const out = [ ...notes ];
	while ( out.length && ! out[ out.length - 1 ] ) out.pop();
	return out;
}

/** The rows of a Field's attributes: notes padded or cut to one per option. */
export function optionRows( attributes: Record< string, unknown > ): OptionRows {
	const options = strings( attributes.options );
	const notes = strings( attributes.optionNotes );
	return { options, notes: options.map( ( _, i ) => notes[ i ] ?? '' ) };
}

/** The attributes that save rows. */
export function rowsToAttributes( rows: OptionRows ): { options: string[]; optionNotes: string[] } {
	return { options: [ ...rows.options ], optionNotes: trimNotes( rows.notes.slice( 0, rows.options.length ) ) };
}

export function setOption( rows: OptionRows, i: number, value: string ): OptionRows {
	return { options: rows.options.map( ( o, j ) => ( j === i ? value : o ) ), notes: rows.notes };
}

export function setNote( rows: OptionRows, i: number, value: string ): OptionRows {
	return { options: rows.options, notes: rows.options.map( ( _, j ) => ( j === i ? value : rows.notes[ j ] ?? '' ) ) };
}

export function addOption( rows: OptionRows, value = '' ): OptionRows {
	return { options: [ ...rows.options, value ], notes: [ ...rows.options.map( ( _, j ) => rows.notes[ j ] ?? '' ), '' ] };
}

export function removeOption( rows: OptionRows, i: number ): OptionRows {
	return { options: rows.options.filter( ( _, j ) => j !== i ), notes: rows.options.map( ( _, j ) => rows.notes[ j ] ?? '' ).filter( ( _, j ) => j !== i ) };
}

/** Moves row `i` by `by` places, its note with it. Out of range, the rows are returned as they are. */
export function moveOption( rows: OptionRows, i: number, by: number ): OptionRows {
	const to = i + by;
	if ( i < 0 || i >= rows.options.length || to < 0 || to >= rows.options.length ) return rows;
	const move = < T >( list: T[] ) => {
		const next = [ ...list ];
		const [ item ] = next.splice( i, 1 );
		next.splice( to, 0, item );
		return next;
	};
	return { options: move( rows.options ), notes: move( rows.options.map( ( _, j ) => rows.notes[ j ] ?? '' ) ) };
}

/* -------------------------------------------------------------------------------------------- */
/* A slider's numbers                                                                            */
/* -------------------------------------------------------------------------------------------- */

const num = ( value: unknown, fallback: number ) => {
	const n = Number( String( value ?? '' ).trim() );
	return String( value ?? '' ).trim() !== '' && Number.isFinite( n ) ? n : fallback;
};

/** A slider's lowest, highest, step and start: 0..100 step 1 by default, starting in the middle. */
export function rangeBounds( attributes: Record< string, unknown > ): { min: number; max: number; step: number; value: number } {
	const min = num( attributes.min, 0 );
	const max = Math.max( min, num( attributes.max, 100 ) );
	const step = num( attributes.step, 1 ) > 0 ? num( attributes.step, 1 ) : 1;
	const middle = min + Math.round( ( max - min ) / 2 / step ) * step;
	const value = Math.min( max, Math.max( min, num( attributes.defaultValue, middle ) ) );
	return { min, max, step, value };
}

/** A slider's number as people read it: the prefix, the number in the reader's locale, the suffix. */
export function rangeText( n: number, { prefix = '', suffix = '' }: { prefix?: string; suffix?: string } = {} ): string {
	return `${ prefix }${ n.toLocaleString() }${ suffix }`;
}
