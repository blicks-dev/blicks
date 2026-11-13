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
import { Field, Note, Row, Sec, SegText, Select, Switch, type Option } from '@/framework/inspector-v2/kit';
import { format as formatValue, resolve, setSiteDateFormat, upgrade, type BindingArgs } from './data';
import { usePreview, usePreviewPage, useLoopItems } from './use-items';

export const SOURCE = 'blicks/item';

// The site's date format, for the "Site's format" date style; the page reads it from Settings → General.
setSiteDateFormat( ( globalThis as any ).wp?.date?.getSettings?.()?.formats?.date ?? '' );

/** The formats the Data section offers; `upper`, `prefix` and `suffix` are only read ({@see upgrade}). */
const FORMAT_NAMES: Option[] = [
	[ 'none', __( 'As it is', 'blicks' ) ],
	[ 'case', __( 'Case', 'blicks' ) ],
	[ 'truncate', __( 'Shorten', 'blicks' ) ],
	[ 'number', __( 'Number', 'blicks' ) ],
	[ 'currency', __( 'Currency', 'blicks' ) ],
	[ 'date', __( 'Date', 'blicks' ) ],
	[ 'join', __( 'Join a list', 'blicks' ) ],
];

const GROUPS: Option[] = [ [ ',', '1,000' ], [ '.', '1.000' ], [ ' ', '1 000' ], [ '', '1000' ] ];
const POINTS: Option[] = [ [ '.', '0.50' ], [ ',', '0,50' ] ];
const EXAMPLE_DATE = '2026-11-03';
const DATE_STYLES = [ 'short', 'long', 'us', 'weekday', 'dmy', 'mdy', 'iso', 'site' ] as const;

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

	const saved = bindingOf( attributes, attr );
	const args = saved ? upgrade( saved ) : null;
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
	const opts = ( args?.opts ?? {} ) as Record< string, unknown >;
	const o = ( key: string, fallback = '' ): string => ( opts[ key ] === undefined ? fallback : String( opts[ key ] ) );
	const setOpt = ( key: string, value: string | undefined ) => {
		const next = { ...opts, [ key ]: value };
		if ( value === undefined ) delete next[ key ];
		set( { ...args, opts: Object.keys( next ).length ? next : undefined } );
	};
	const setText = ( key: 'before' | 'after' | 'fallback' ) => ( v: string ) => set( { ...args, [ key ]: v || undefined } );
	const fieldOptions: Option[] = [ [ '', __( 'Typed text', 'blicks' ) ], ...fields.map( ( f ): Option => [ f.key, `${ f.key } · ${ f.type }` ] ) ];
	const options: Option[] = [ ...fieldOptions ];
	// A field the data no longer has stays listed, so the binding is not silently changed.
	if ( args?.key && ! fields.some( ( f ) => f.key === args.key ) ) options.push( [ args.key, sprintf( /* translators: %s: field name */ __( '%s (not in this data)', 'blicks' ), args.key ) ] );
	const shown = args && item ? resolve( item, args, kind ) : null;
	// Each choice drawn as what it makes of this item's value (or a stand-in), so the list is the preview.
	const sample = ( fmt: string, more: Record< string, unknown >, value: unknown ) => formatValue( value, fmt, '', { ...opts, ...more }, item ?? {} );
	const price = item && args?.key && Number.isFinite( Number( item[ args.key ] ) ) && item[ args.key ] !== '' ? Number( item[ args.key ] ) : 1290;
	const separators = (
		<>
			<Row label={ __( 'Thousands', 'blicks' ) } set={ opts.group !== undefined }>
				<Select label={ __( 'Thousands', 'blicks' ) } value={ o( 'group', ',' ) } options={ GROUPS } onChange={ ( v ) => setOpt( 'group', v ) } />
			</Row>
			<Row label={ __( 'Decimal mark', 'blicks' ) } set={ opts.point !== undefined }>
				<SegText label={ __( 'Decimal mark', 'blicks' ) } options={ POINTS } value={ o( 'point', '.' ) } onChange={ ( v ) => setOpt( 'point', v ) } />
			</Row>
		</>
	);

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
						<Row label={ __( 'Format', 'blicks' ) } set={ format !== 'none' }>
							<Select label={ __( 'Format', 'blicks' ) } value={ format } options={ FORMAT_NAMES }
								onChange={ ( f ) => set( { ...args, format: f === 'none' ? undefined : f, formatArg: undefined, opts: undefined } ) } />
						</Row>
					) }

					{ format === 'case' && (
						<Row label={ __( 'Case', 'blicks' ) } stack>
							<SegText label={ __( 'Case', 'blicks' ) } value={ o( 'case', 'upper' ) } onChange={ ( v ) => setOpt( 'case', v ) }
								options={ [ [ 'upper', __( 'UPPER', 'blicks' ) ], [ 'lower', __( 'lower', 'blicks' ) ], [ 'title', __( 'Title Case', 'blicks' ) ] ] } />
						</Row>
					) }

					{ format === 'truncate' && (
						<>
							<Row label={ __( 'Characters', 'blicks' ) } set={ args.formatArg !== undefined }>
								<Field label={ __( 'Characters', 'blicks' ) } type="number" value={ String( args.formatArg ?? '' ) } placeholder="80" onChange={ ( v ) => set( { ...args, formatArg: v || undefined } ) } />
							</Row>
							<Row label={ __( 'Cut', 'blicks' ) } set={ opts.cut !== undefined }>
								<SegText label={ __( 'Cut', 'blicks' ) } value={ o( 'cut', 'word' ) } onChange={ ( v ) => setOpt( 'cut', v ) }
									options={ [ [ 'word', __( 'At a word', 'blicks' ) ], [ 'char', __( 'Exactly', 'blicks' ) ] ] } />
							</Row>
						</>
					) }

					{ format === 'number' && (
						<>
							<Row label={ __( 'Decimals', 'blicks' ) } set={ opts.decimals !== undefined } stack>
								<SegText label={ __( 'Decimals', 'blicks' ) } value={ o( 'decimals', args.formatArg !== undefined ? String( args.formatArg ) : '0' ) } onChange={ ( v ) => set( { ...args, formatArg: undefined, opts: { ...opts, decimals: v } } ) }
									options={ [ [ 'auto', __( 'Auto', 'blicks' ) ], [ '0', '0' ], [ '1', '0.0' ], [ '2', '0.00' ] ] } />
							</Row>
							{ separators }
							<Switch label={ __( 'Short (1.2K, 3.4M)', 'blicks' ) } checked={ o( 'compact' ) === 'yes' } onChange={ ( on ) => setOpt( 'compact', on ? 'yes' : undefined ) } />
						</>
					) }

					{ format === 'currency' && (
						<>
							<Row label={ __( 'Currency from', 'blicks' ) } set={ !! o( 'currencyField' ) }>
								<Select label={ __( 'Currency from', 'blicks' ) } value={ o( 'currencyField' ) } options={ [ [ '', __( 'Typed below', 'blicks' ) ], ...fieldOptions.slice( 1 ).filter( ( [ k ] ) => k !== args.key ) ] }
									onChange={ ( v ) => setOpt( 'currencyField', v || undefined ) } />
							</Row>
							<Row label={ o( 'currencyField' ) ? __( 'If none', 'blicks' ) : __( 'Currency', 'blicks' ) } set={ opts.currency !== undefined }
								note={ __( 'A symbol ($) or a three-letter code (USD).', 'blicks' ) }>
								<Field label={ __( 'Currency', 'blicks' ) } value={ o( 'currency' ) } placeholder="$" onChange={ ( v ) => setOpt( 'currency', v || undefined ) } />
							</Row>
							<Row label={ __( 'Show as', 'blicks' ) } set={ opts.show !== undefined } stack>
								<SegText label={ __( 'Show as', 'blicks' ) } value={ o( 'show', 'symbol' ) } onChange={ ( v ) => setOpt( 'show', v ) }
									options={ ( [ 'symbol', 'code', 'code-after', 'both' ] as const ).map( ( show ): Option => [ show, sample( 'currency', { show }, price ) ] ) } />
							</Row>
							<Row label={ __( 'Decimals', 'blicks' ) } set={ opts.decimals !== undefined }>
								<SegText label={ __( 'Decimals', 'blicks' ) } value={ o( 'decimals', 'auto' ) } onChange={ ( v ) => setOpt( 'decimals', v ) }
									options={ [ [ 'auto', __( 'Auto', 'blicks' ) ], [ '2', '0.00' ], [ '0', __( 'None', 'blicks' ) ] ] } />
							</Row>
							{ separators }
						</>
					) }

					{ format === 'date' && (
						<>
							<Row label={ __( 'Style', 'blicks' ) } set={ opts.style !== undefined }>
								<Select label={ __( 'Date style', 'blicks' ) } value={ o( 'style', args.formatArg === 'long' ? 'long' : 'short' ) } onChange={ ( v ) => set( { ...args, formatArg: undefined, opts: { ...opts, style: v } } ) }
									options={ [
										...DATE_STYLES.map( ( style ): Option => [ style, style === 'site'
											? sprintf( /* translators: %s: a date in the site's format */ __( "Site's format (%s)", 'blicks' ), sample( 'date', { style }, EXAMPLE_DATE ) )
											: sample( 'date', { style }, EXAMPLE_DATE ) ] ),
										[ 'custom', __( 'Custom…', 'blicks' ) ],
									] } />
							</Row>
							{ o( 'style' ) === 'custom' && (
								<Row label={ __( 'Pattern', 'blicks' ) } set={ !! o( 'pattern' ) }
									note={ __( 'd j: day · D l: weekday · S: 1st · m n M F: month · y Y: year · \\x: a letter as is', 'blicks' ) }>
									<Field label={ __( 'Pattern', 'blicks' ) } value={ o( 'pattern' ) } placeholder="j M Y" onChange={ ( v ) => setOpt( 'pattern', v || undefined ) } />
								</Row>
							) }
						</>
					) }

					{ format === 'join' && (
						<Row label={ __( 'Between items', 'blicks' ) } set={ args.formatArg !== undefined }>
							<Field label={ __( 'Between items', 'blicks' ) } value={ String( args.formatArg ?? '' ) } placeholder=", " onChange={ ( v ) => set( { ...args, formatArg: v || undefined } ) } />
						</Row>
					) }

					<Row label={ __( 'Text before', 'blicks' ) } set={ !! args.before }>
						<Field label={ __( 'Text before', 'blicks' ) } value={ String( args.before ?? '' ) } placeholder={ __( 'From ', 'blicks' ) } onChange={ setText( 'before' ) } />
					</Row>
					<Row label={ __( 'Text after', 'blicks' ) } set={ !! args.after }>
						<Field label={ __( 'Text after', 'blicks' ) } value={ String( args.after ?? '' ) } placeholder={ __( ' / person', 'blicks' ) } onChange={ setText( 'after' ) } />
					</Row>
					<Row label={ __( 'If empty', 'blicks' ) } set={ !! args.fallback }>
						<Field label={ __( 'If the field is empty', 'blicks' ) } value={ String( args.fallback ?? '' ) } placeholder={ __( 'Show…', 'blicks' ) } onChange={ setText( 'fallback' ) } />
					</Row>
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
