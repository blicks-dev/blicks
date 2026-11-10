/**
 * Binding one block attribute to a field of the Loop's current item: the Data section a block
 * shows in its Settings when it sits inside a Loop, and the value it shows on the live card.
 *
 * A binding is stored where WordPress stores them, `metadata.bindings.<attr>`, with the source
 * `blicks/item`; the page writes it in (src/Data/Bindings.php), the previews write it into their
 * copies (canvas.tsx bindBlocks). This module is block-agnostic; a block opts in by rendering
 * `<DataSec>` in its Settings and `<BoundValue>` in place of its editable text.
 */
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { Field, Note, Sec, Select, type Option } from '@/framework/inspector-v2/kit';
import { FORMATS, resolve, type BindingArgs } from './data';
import { usePreview, usePreviewPage, useLoopItems } from './use-items';

export const SOURCE = 'blicks/item';

const FORMAT_NAMES: Record< string, string > = {
	none: __( 'As it is', 'blicks' ),
	upper: __( 'Upper case', 'blicks' ),
	truncate: __( 'Shorten', 'blicks' ),
	number: __( 'Number', 'blicks' ),
	currency: __( 'Currency', 'blicks' ),
	date: __( 'Date', 'blicks' ),
	prefix: __( 'Add text before', 'blicks' ),
	suffix: __( 'Add text after', 'blicks' ),
	join: __( 'Join a list', 'blicks' ),
};
const FORMAT_ARG: Record< string, [ label: string, placeholder: string ] > = {
	truncate: [ __( 'Characters', 'blicks' ), '80' ],
	number: [ __( 'Decimals', 'blicks' ), '0' ],
	currency: [ __( 'Symbol', 'blicks' ), '$' ],
	prefix: [ __( 'Text before', 'blicks' ), '' ],
	suffix: [ __( 'Text after', 'blicks' ), '' ],
	join: [ __( 'Between items', 'blicks' ), ', ' ],
};

export function bindingOf( attributes: any, attr: string ): BindingArgs | null {
	const b = attributes?.metadata?.bindings?.[ attr ];
	return b?.source === SOURCE ? ( b.args ?? {} ) : null;
}

/** Attributes with one binding set (args) or removed (null), keeping every other binding. */
export function withBinding( attributes: any, attr: string, args: BindingArgs | null ): { metadata: any } {
	const metadata = { ...( attributes.metadata ?? {} ) };
	const bindings = { ...( metadata.bindings ?? {} ) };
	if ( args ) bindings[ attr ] = { source: SOURCE, args };
	else delete bindings[ attr ];
	if ( Object.keys( bindings ).length ) metadata.bindings = bindings;
	else delete metadata.bindings;
	return { metadata };
}

/** The Loop this block sits in, or null. */
export function useLoop( clientId: string | undefined ): { clientId: string; attributes: any } | null {
	return useSelect(
		( select: any ) => {
			if ( ! clientId ) return null;
			const editor = select( 'core/block-editor' );
			const parents: string[] = editor.getBlockParentsByBlockName( clientId, 'blicks/loop' );
			const id = parents[ parents.length - 1 ];
			return id ? { clientId: id, attributes: editor.getBlockAttributes( id ) } : null;
		},
		[ clientId ]
	);
}

/** The Loop's fields and the item the live card is showing. */
function useLoopItem( loop: { clientId: string; attributes: any } | null ) {
	const { data } = useLoopItems( loop?.attributes ?? null, usePreviewPage( loop?.clientId ) );
	const items = loop ? data?.items ?? [] : [];
	const index = usePreview( loop?.clientId, items.length );
	return { fields: loop ? data?.fields ?? [] : [], item: items[ index ] ?? null, index, count: items.length };
}

/**
 * The Data section: which field an attribute shows, how it is formatted, and what shows when the
 * field is empty. Renders nothing outside a Loop.
 */
export function DataSec( { attributes, setAttributes, clientId, attr, kind = 'text', label, title }: {
	attributes: any;
	setAttributes: ( a: any ) => void;
	clientId?: string;
	attr: string;
	kind?: 'text' | 'url' | 'image';
	label: string;
	/** Section title; defaults to "Data". A block with two bindable values names each. */
	title?: string;
} ) {
	const loop = useLoop( clientId );
	const { fields, item, index, count } = useLoopItem( loop );
	if ( ! loop ) return null;

	const args = bindingOf( attributes, attr );
	const set = ( next: BindingArgs | null ) => {
		const patch: Record< string, unknown > = withBinding( attributes, attr, next );
		// An address must be in the saved markup for the page to rewrite (an Image with no URL
		// saves nothing at all), so binding one also stores the current item's value.
		if ( next?.key && kind !== 'text' && ! attributes[ attr ] && item ) {
			const seed = resolve( item, next, kind ).text;
			if ( seed ) patch[ attr ] = seed;
		}
		setAttributes( patch );
	};
	const format = args?.format ?? 'none';
	const formatArg = FORMAT_ARG[ format ];
	const options: Option[] = [ [ '', __( 'Typed text', 'blicks' ) ], ...fields.map( ( f ): Option => [ f.key, `${ f.key } · ${ f.type }` ] ) ];
	// A field the data no longer has stays listed, so the binding is not silently changed.
	if ( args?.key && ! fields.some( ( f ) => f.key === args.key ) ) options.push( [ args.key, sprintf( /* translators: %s: field name */ __( '%s (not in this data)', 'blicks' ), args.key ) ] );
	const shown = args && item ? resolve( item, args, kind ) : null;

	return (
		<Sec title={ title ?? __( 'Data', 'blicks' ) } value={ args?.key ? sprintf( /* translators: %s: field name */ __( 'From %s', 'blicks' ), args.key ) : __( 'Typed', 'blicks' ) }>
			<Select
				label={ sprintf( /* translators: %s: what is bound, e.g. Text */ __( '%s comes from', 'blicks' ), label ) }
				value={ args?.key ?? '' }
				options={ options }
				onChange={ ( key ) => set( key ? { ...( args ?? {} ), key } : null ) }
			/>
			{ args?.key && (
				<>
					{ kind === 'text' && (
						<div className="mt">
							<Select label={ __( 'Format', 'blicks' ) } value={ format } options={ FORMATS.map( ( f ): Option => [ f, FORMAT_NAMES[ f ] ] ) }
								onChange={ ( f ) => set( { ...args, format: f === 'none' ? undefined : f, formatArg: undefined } ) } />
						</div>
					) }
					{ format === 'date' && (
						<div className="mt">
							<Select label={ __( 'Date style', 'blicks' ) } value={ String( args.formatArg ?? 'short' ) } options={ [ [ 'short', '3 Nov 2026' ], [ 'long', '3 November 2026' ] ] }
								onChange={ ( formatArg ) => set( { ...args, formatArg } ) } />
						</div>
					) }
					{ formatArg && (
						<div className="mt">
							<Field label={ formatArg[ 0 ] } value={ String( args.formatArg ?? '' ) } placeholder={ formatArg[ 1 ] } onChange={ ( formatArg ) => set( { ...args, formatArg } ) } />
						</div>
					) }
					<div className="mt">
						<Field label={ __( 'If the field is empty', 'blicks' ) } value={ String( args.fallback ?? '' ) } placeholder={ __( 'If the field is empty, show…', 'blicks' ) }
							onChange={ ( fallback ) => set( { ...args, fallback: fallback || undefined } ) } />
					</div>
					{ shown && (
						<Note>
							{ shown.from === 'fallback'
								? sprintf( /* translators: 1: item number, 2: what shows instead */ __( 'Item %1$d has no value here, so it shows: %2$s', 'blicks' ), index + 1, shown.text || __( 'nothing', 'blicks' ) )
								: sprintf( /* translators: 1: item number, 2: items, 3: the value */ __( 'Item %1$d of %2$d shows: %3$s', 'blicks' ), index + 1, count, shown.text ) }
						</Note>
					) }
				</>
			) }
			{ ! args?.key && <Note>{ __( 'This block is inside a Loop: it can show a field from each item instead of typed text.', 'blicks' ) }</Note> }
		</Sec>
	);
}

/**
 * The block's attributes with every bound one replaced by the current item's value — for blocks
 * whose bound values are not a single text (an Image's address and alt). Outside a Loop, or with
 * nothing bound, the attributes come back as they are.
 */
export function WithBound( { attributes, clientId, kinds, children }: {
	attributes: any;
	clientId?: string;
	kinds: Record< string, 'text' | 'url' | 'image' >;
	children: ( attributes: any ) => JSX.Element | null;
} ) {
	const loop = useLoop( clientId );
	const { item } = useLoopItem( loop );
	if ( ! loop || ! item ) return children( attributes );

	const next = { ...attributes };
	for ( const [ attr, kind ] of Object.entries( kinds ) ) {
		const args = bindingOf( attributes, attr );
		if ( args?.key ) next[ attr ] = resolve( item, args, kind ).text;
	}
	return children( next );
}

/**
 * A bound value on the live card: the current item's value, read-only, with a chip naming the
 * field. Outside a Loop (or in a preview, which carries its value already) `fallback` renders
 * instead — the block's own editable field.
 */
export function BoundValue( { attributes, clientId, attr, kind = 'text', tagName, props, fallback }: {
	attributes: any;
	clientId?: string;
	attr: string;
	kind?: 'text' | 'url' | 'image';
	tagName: string;
	props: Record< string, any >;
	fallback: () => JSX.Element;
} ) {
	const loop = useLoop( clientId );
	const { item } = useLoopItem( loop );
	const args = bindingOf( attributes, attr );
	if ( ! loop || ! args?.key ) return fallback();

	const shown = item ? resolve( item, args, kind ) : { text: '', from: 'fallback' as const };
	const Tag = tagName as any;
	return (
		<Tag { ...props } className={ `${ props.className ?? '' } is-bound${ shown.from === 'fallback' ? ' is-fallback' : '' }` }>
			<span className="bl-bound-chip" aria-hidden="true">{ args.key }</span>
			{ shown.text || ( item ? __( '(empty)', 'blicks' ) : __( 'Loading…', 'blicks' ) ) }
		</Tag>
	);
}
