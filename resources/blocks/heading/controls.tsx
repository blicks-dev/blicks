import { __, sprintf } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { TypeStyle } from '@/framework/inspector-v2/TypeStyle';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Icon, Opts, Row, SegIcons, SegText, Sec, Switch, type Option } from '@/framework/inspector-v2/kit';
import { setValue } from '@/framework/values';
import { withValue } from '@/blocks/box/model';
import { DataSec } from '@/blocks/loop/binding';

const ALIGNMENTS = [ 'left', 'center', 'right' ] as const;

export function cleanHeadingLevel( level: unknown ): number {
	const value = Number( level );
	if ( Number.isNaN( value ) ) return 2;
	return Math.min( 6, Math.max( 1, Math.round( value ) ) );
}

export function setHeadingAlignment(
	attributes: any,
	setAttributes: ( a: any ) => void,
	alignment: string
) {
	// Left is how a heading reads with no value, so it is stored as none — as the Text block does.
	const next = ALIGNMENTS.includes( alignment as any ) && alignment !== 'left' ? alignment : undefined;
	setValue( attributes, setAttributes, 'typography.textAlign', 'default', 'base', next );
}

/** An anchor as it is typed: like `slugOf`, but a dash at the end stays so the next word can follow it. */
export function typingSlug( text: string ): string {
	return slugOf( text ) + ( /[^a-z0-9]$/i.test( text ) && slugOf( text ) ? '-' : '' );
}

/** A heading's words as an anchor: lowercase, dashes between words, nothing else. */
export function slugOf( html: unknown ): string {
	return String( html ?? '' ).replace( /<[^>]*>/g, '' ).toLowerCase().normalize( 'NFKD' ).replace( /[̀-ͯ]/g, '' ).replace( /[^a-z0-9]+/g, '-' ).replace( /^-|-$/g, '' );
}

export interface OutlineRow {
	level: number;
	text: string;
	me: boolean;
}

/** What is wrong with this heading's place in the outline, if anything. */
export function outlineWarning( rows: OutlineRow[] ): string {
	const i = rows.findIndex( ( r ) => r.me );
	if ( i < 0 ) return '';
	const level = rows[ i ].level;
	if ( level === 1 && rows.some( ( r, k ) => k !== i && r.level === 1 ) ) {
		return __( 'The page already has an H1. Use H2 for a section.', 'blicks' );
	}
	const prev = rows.slice( 0, i ).reverse().find( () => true )?.level ?? 1;
	if ( level > prev + 1 ) {
		/* translators: 1: the previous heading level, 2: this heading's level, 3: the level expected */
		return sprintf( __( 'Jumps from H%1$d to H%2$d. Screen readers expect H%3$d here.', 'blicks' ), prev, level, prev + 1 );
	}
	return '';
}

const HINTS: Record< number, string > = {
	1: __( 'Page title', 'blicks' ), 2: __( 'Section', 'blicks' ), 3: __( 'Part of a section', 'blicks' ),
	4: __( 'Smaller part', 'blicks' ), 5: __( 'Small label', 'blicks' ), 6: __( 'Smallest label', 'blicks' ),
};
export const LEVELS: Option[] = [ 1, 2, 3, 4, 5, 6 ].map( ( n ) => [ String( n ), `H${ n }` ] );
export const LOOKS: Array< [ string, string, number ] > = [
	[ '', __( 'Its level', 'blicks' ), 0 ], [ 'display', __( 'Display', 'blicks' ), 26 ], [ 'h1', 'H1', 20 ], [ 'h2', 'H2', 16 ], [ 'h3', 'H3', 13 ], [ 'h4', 'H4', 11 ],
];
/** "Looks like" writes the type role; "Its level" clears it. */
export function withHeadingLook( attributes: any, look: string ) {
	return { blicks: withValue( attributes.blicks ?? {}, 'typography.role', look || undefined ) };
}

const ALIGN_OPTS: Option[] = [
	[ 'left', __( 'Left', 'blicks' ), 'M4 6h16M4 12h10M4 18h13' ],
	[ 'center', __( 'Center', 'blicks' ), 'M4 6h16M7 12h10M5.5 18h13' ],
	[ 'right', __( 'Right', 'blicks' ), 'M4 6h16M10 12h10M7 18h13' ],
];
const LEVEL_SIZE: Record< number, number > = { 1: 20, 2: 16, 3: 13, 4: 11, 5: 10, 6: 9 };
/** The inspector's level track: plain numbers, the tag in the row's hint. The toolbar keeps H1–H6. */
const LEVEL_OPTS: Option[] = [ 1, 2, 3, 4, 5, 6 ].map( ( n ) => [ String( n ), String( n ) ] );
/* translators: %d: a heading level, 1 to 6 */
const levelName = ( n: number ) => sprintf( __( 'Level %d', 'blicks' ), n );
/** A look in plain words: "Level 1" rather than the toolbar's "H1". */
const lookName = ( v: string ) => ( /^h[1-6]$/.test( v ) ? levelName( Number( v.slice( 1 ) ) ) : LOOKS.find( ( [ k ] ) => k === v )?.[ 1 ] ?? '' );

/** Every heading on the page, in reading order, so the panel can show where this one sits. */
function useOutline( clientId?: string ): OutlineRow[] {
	return useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		const rows: OutlineRow[] = [];
		const walk = ( ids: string[] ) => {
			for ( const id of ids ) {
				const block = store.getBlock( id );
				if ( ! block ) continue;
				if ( block.name === 'blicks/heading' || block.name === 'core/heading' ) {
					rows.push( { level: cleanHeadingLevel( block.attributes.level ), text: String( block.attributes.content ?? '' ).replace( /<[^>]*>/g, '' ), me: id === clientId } );
				}
				walk( store.getBlockOrder( id ) );
			}
		};
		walk( store.getBlockOrder() );
		return rows;
	}, [ clientId ] );
}

/** The Heading's Settings tab, as its inspector design draws it. */
export function HeadingSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const level = cleanHeadingLevel( attributes.level );
	const tree = attributes.blicks ?? {};
	const role = String( tree[ 'typography.role' ]?.default?.base ?? '' );
	const look = LOOKS.some( ( [ v ] ) => v === role ) ? role : '';
	const align = String( tree[ 'typography.textAlign' ]?.default?.base ?? 'left' );
	const rows = useOutline( clientId );
	const warning = outlineWarning( rows );
	const fromWords = slugOf( attributes.content );
	const anchor = String( attributes.anchor ?? '' );
	const balanced = tree[ 'typography.textWrap' ]?.default?.base === 'balance';

	return (
		<>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ look ? lookName( look ) : levelName( level ) }>
				<Row label={ __( 'Looks like', 'blicks' ) } stack set={ !! look } note={ look ? sprintf( /* translators: 1: the heading level, 2: the look it is drawn at */ __( 'Read out as level %1$d, drawn like %2$s.', 'blicks' ), level, lookName( look ) ) : undefined } noteIcon="info">
					<Opts
						columns={ 3 }
						value={ look }
						onChange={ ( v ) => setAttributes( withHeadingLook( attributes, v ) ) }
						options={ LOOKS.map( ( [ v, , size ] ) => [ v, lookName( v ), <span key={ v } className="tf" style={ { fontSize: size || LEVEL_SIZE[ level ], fontWeight: 700 } }>Aa</span> ] ) }
					/>
				</Row>
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ ALIGN_OPTS.find( ( [ v ] ) => v === align )?.[ 1 ] }>
				<Row label={ __( 'Line up', 'blicks' ) } set={ align !== 'left' } hint="text-align">
					<SegIcons label={ __( 'Line up', 'blicks' ) } options={ ALIGN_OPTS } value={ align } onChange={ ( a ) => setHeadingAlignment( attributes, setAttributes, a ) } />
				</Row>
				<Switch label={ __( 'Even out the lines', 'blicks' ) } hint={ __( 'Lines of similar length instead of one long and one short', 'blicks' ) } checked={ balanced } onChange={ ( on ) => setAttributes( { blicks: withValue( tree, 'typography.textWrap', on ? 'balance' : undefined ) } ) } />
			</Sec>
			<Sec title={ __( 'Link', 'blicks' ) } icon="link">
				<Row
					label={ __( 'Link to it', 'blicks' ) }
					stack
					set={ !! anchor }
					hint={ __( 'Anchor (id)', 'blicks' ) }
					note={ anchor ? sprintf( /* translators: %s: the heading's anchor */ __( 'Link to it with #%s.', 'blicks' ), anchor ) : __( 'Give it an anchor so other pages and menus can link straight to it.', 'blicks' ) }
					noteIcon="info"
				>
					{ /* A plain Field has no blur hook or trailing button: the anchor is tidied on blur and can be taken from the words. */ }
					<label className="inp">
						<span className="hash">#</span>
						<input value={ anchor } placeholder={ fromWords } spellCheck={ false } aria-label={ __( 'Anchor', 'blicks' ) } onChange={ ( e ) => setAttributes( { anchor: typingSlug( e.currentTarget.value ) || undefined } ) } onBlur={ () => setAttributes( { anchor: slugOf( anchor ) || undefined } ) } />
						{ ! anchor && fromWords && (
							<button type="button" className="copy" title={ __( 'Use the words', 'blicks' ) } aria-label={ __( 'Use the words', 'blicks' ) } onClick={ () => setAttributes( { anchor: fromWords } ) }>
								<Icon d="M5 12h14M13 6l6 6-6 6" size={ 16 } />
							</button>
						) }
					</label>
				</Row>
			</Sec>
			{ /* Block-only: after the fixed sections, before Meaning and access. */ }
			<DataSec attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } attr="content" label={ __( 'Heading', 'blicks' ) } />
			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new" value={ HINTS[ level ] }>
				<Row
					label={ __( 'Level', 'blicks' ) }
					stack
					set={ level !== 2 }
					hint="h1–h6"
					note={ warning || sprintf( /* translators: %s: the heading tag, e.g. <h2> */ __( 'Saved as %s. Screen readers use the levels to outline the page.', 'blicks' ), `<h${ level }>` ) }
					noteIcon={ warning ? 'warning' : 'code' }
				>
					<SegText label={ __( 'Level', 'blicks' ) } options={ LEVEL_OPTS } value={ String( level ) } onChange={ ( l ) => setAttributes( { level: Number( l ) } ) } />
				</Row>
				{ rows.length > 1 && (
					<Row label={ __( 'Page outline', 'blicks' ) } stack>
						<ol className="outline" aria-label={ __( 'Page outline', 'blicks' ) }>
							{ rows.map( ( r, i ) => (
								<li key={ i } className={ `ol${ r.me ? ' me' : '' }` } style={ { '--d': r.level - 1 } as React.CSSProperties }>
									<b>H{ r.level }</b><span>{ r.text || __( '(empty)', 'blicks' ) }</span>
								</li>
							) ) }
						</ol>
					</Row>
				) }
			</Sec>
		</>
	);
}

export function HeadingStyle( { attributes, setAttributes }: PanelProps ) {
	return <TypeStyle attributes={ attributes } setAttributes={ setAttributes } kind="heading" />;
}

export function HeadingMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="heading" timed={ false } />;
}
