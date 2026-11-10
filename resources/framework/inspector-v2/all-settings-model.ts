/**
 * All settings: every value a block stores, as the Studio's raw view lists and edits them. The
 * quick choices in the Style tab show a look; this reads the `blicks` tree itself, so a value an
 * agent or a pattern wrote is reachable even when no quick choice can show it.
 */
import { __ } from '@wordpress/i18n';
import { CONTROL_VALUES, CORNERS, IMPORT_PROPERTIES, SECTION_CONTROLS, SIDES } from '@/engine/schema.gen';
import { findStyleProblems, PARTABLE_CONTROLS, STYLE_MAP, type StyleProblemReason } from '@/framework/css/vars';
import { lookValues, META, readStyle, type Tree } from './style-model';

export const ELEMENT = 'element';
export const PARTS = [ 'before', 'after' ] as const;
export const BREAKPOINTS = [ 'base', 'tablet', 'mobile' ] as const;

export interface Entry {
	id: string;
	part: string;
	state: string;
	breakpoint: string;
	value: unknown;
}

/** Slot key as the tree stores it: `hover`, `before`, `before:hover`. */
export function slotKey( part: string, state: string ): string {
	if ( part === ELEMENT ) return state;
	return state === 'default' ? part : `${ part }:${ state }`;
}

export function splitSlot( slot: string ): [ string, string ] {
	if ( slot.includes( ':' ) ) return slot.split( ':' ) as [ string, string ];
	return ( PARTS as readonly string[] ).includes( slot ) ? [ slot, 'default' ] : [ ELEMENT, slot ];
}

/** Every stored value, flat. The look the quick choices keep (`meta.*`) is not a style value. */
export function entriesOf( tree: Tree ): Entry[] {
	const out: Entry[] = [];
	for ( const [ id, slots ] of Object.entries< any >( tree ?? {} ) ) {
		if ( id.startsWith( 'meta.' ) || ! slots || typeof slots !== 'object' ) continue;
		for ( const [ slot, byBp ] of Object.entries< any >( slots ) ) {
			const [ part, state ] = splitSlot( slot );
			for ( const [ breakpoint, value ] of Object.entries< any >( byBp ?? {} ) ) out.push( { id, part, state, breakpoint, value } );
		}
	}
	return out;
}

/** The tree with one value set, or removed when `value` is undefined; empty levels are dropped. */
export function setEntry( tree: Tree, id: string, part: string, state: string, breakpoint: string, value: unknown ): Tree {
	const slot = slotKey( part, state );
	const next: Tree = { ...tree };
	const control = { ...( next[ id ] ?? {} ) };
	const byBp = { ...( control[ slot ] ?? {} ) };
	if ( value === undefined ) delete byBp[ breakpoint ];
	else byBp[ breakpoint ] = value;
	if ( Object.keys( byBp ).length ) control[ slot ] = byBp;
	else delete control[ slot ];
	if ( Object.keys( control ).length ) next[ id ] = control;
	else delete next[ id ];
	return next;
}

const PROPERTY: Record< string, string > = Object.entries( IMPORT_PROPERTIES ).reduce< Record< string, string > >( ( m, [ prop, id ] ) => {
	if ( ! m[ id ] ) m[ id ] = prop;
	return m;
}, {} );

/** Controls that no CSS property imports into, named by the property they write. */
const WRITES: Record< string, string > = {
	'background.gradient': 'background-image',
	'background.layers': 'background',
	'decoration.content': 'content',
};

/** The CSS property a control writes, for the header — or its id when it writes several. */
export const propertyOf = ( id: string ): string => CONTROL_VALUES[ id ]?.property ?? PROPERTY[ id ] ?? WRITES[ id ] ?? id;

/** Names the id alone reads wrongly, e.g. `position.type` → "Type". */
const LABEL: Record< string, string > = {
	'position.type': 'Position',
	'position.zIndex': 'Stacking order',
	'border.radius': 'Corners',
	'colors.text': 'Text colour',
	'colors.background': 'Fill',
	'layout.group': 'Card',
	'typography.role': 'Type role',
};

/** `layout.alignItems` → "Align items". */
export function labelOf( id: string ): string {
	if ( LABEL[ id ] ) return LABEL[ id ];
	const words = ( id.split( '.' )[ 1 ] ?? id ).replace( /([A-Z])/g, ' $1' ).toLowerCase();
	return words.charAt( 0 ).toUpperCase() + words.slice( 1 );
}

/** The engine section a control belongs to, for grouping rows. */
export function sectionOf( id: string ): string {
	return Object.entries( SECTION_CONTROLS ).find( ( [ , ids ] ) => ids.includes( id ) )?.[ 0 ] ?? id.split( '.' )[ 0 ];
}

const shapeOf = ( id: string ): string => CONTROL_VALUES[ id ]?.shape ?? 'css';

/** Object keys of the four-sided shapes, in CSS shorthand order. */
export function keysOf( id: string ): readonly string[] | null {
	const shape = shapeOf( id );
	if ( shape === 'corners' ) return CORNERS.map( ( [ k ] ) => k );
	if ( shape === 'sides' || shape === 'sidesKeyword' || shape === 'inset' ) return SIDES.map( ( [ k ] ) => k );
	return null;
}

/** Split on spaces or commas outside parentheses, so `rgba(0, 0, 0, .4)` stays one token. */
function split( text: string, separator: ' ' | ',' ): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = '';
	for ( const ch of text ) {
		if ( ch === '(' ) depth++;
		else if ( ch === ')' ) depth--;
		if ( depth === 0 && ( separator === ' ' ? /\s/.test( ch ) : ch === separator ) ) {
			parts.push( current );
			current = '';
			continue;
		}
		current += ch;
	}
	parts.push( current );
	return parts.map( ( p ) => p.trim() ).filter( Boolean );
}

const LENGTH = /^-?(\d+\.?\d*|\.\d+)(px|em|rem|%|vw|vh|vmin|vmax|ch)?$|^-?(calc|clamp|min|max|var)\(/i;

function shadowText( layer: any, box: boolean ): string {
	if ( ! layer || typeof layer !== 'object' ) return String( layer ?? '' );
	if ( layer.token !== undefined ) return String( layer.token );
	const lengths = box ? [ layer.x, layer.y, layer.blur, layer.spread ] : [ layer.x, layer.y, layer.blur ];
	while ( lengths.length > 2 && ( lengths[ lengths.length - 1 ] === undefined || lengths[ lengths.length - 1 ] === '' ) ) lengths.pop();
	return [ layer.inset ? 'inset' : '', ...lengths.map( ( l ) => l ?? '0' ), layer.color ?? '' ].filter( ( s ) => s !== '' ).join( ' ' );
}

/** One shadow layer from CSS text, as the engine stores it; null when it does not read as one. */
function shadowLayer( text: string, box: boolean ): Record< string, unknown > | null {
	const lengths: string[] = [];
	const colour: string[] = [];
	let inset = false;
	for ( const token of split( text, ' ' ) ) {
		if ( box && token.toLowerCase() === 'inset' ) inset = true;
		else if ( LENGTH.test( token ) ) lengths.push( /^-?(\d+\.?\d*|\.\d+)$/.test( token ) && Number( token ) !== 0 ? `${ token }px` : token );
		else colour.push( token );
	}
	if ( lengths.length < 2 || lengths.length > ( box ? 4 : 3 ) || colour.length > 1 ) return null;
	const layer: Record< string, unknown > = { x: lengths[ 0 ], y: lengths[ 1 ] };
	if ( lengths[ 2 ] !== undefined ) layer.blur = lengths[ 2 ];
	if ( lengths[ 3 ] !== undefined ) layer.spread = lengths[ 3 ];
	if ( colour.length ) layer.color = colour[ 0 ];
	if ( inset ) layer.inset = true;
	return layer;
}

/** A stored value as the text the editor shows, written the way CSS would write it. */
export function textOf( id: string, value: unknown ): string {
	if ( value === undefined || value === null ) return '';
	if ( typeof value !== 'object' ) return String( value );
	const keys = keysOf( id );
	if ( keys && ! Array.isArray( value ) ) return keys.map( ( k ) => String( ( value as any )[ k ] ?? '0' ) ).join( ' ' );
	const shape = shapeOf( id );
	if ( shape === 'boxShadow' || shape === 'textShadow' ) {
		return ( Array.isArray( value ) ? value : [ value ] ).map( ( l ) => shadowText( l, shape === 'boxShadow' ) ).join( ', ' );
	}
	return JSON.stringify( value );
}

/** One to four shorthand values spread to four, as CSS does. */
function fourWay( v: string[] ): string[] | null {
	if ( v.length === 1 ) return [ v[ 0 ], v[ 0 ], v[ 0 ], v[ 0 ] ];
	if ( v.length === 2 ) return [ v[ 0 ], v[ 1 ], v[ 0 ], v[ 1 ] ];
	if ( v.length === 3 ) return [ v[ 0 ], v[ 1 ], v[ 2 ], v[ 1 ] ];
	return v.length === 4 ? v : null;
}

/**
 * What was typed, as the value to store: shorthand becomes the sides or corners object, shadow CSS
 * becomes layers, JSON stays JSON for the few structured values. Undefined for empty text (remove
 * the value); null when it cannot be read at all.
 */
export function valueOf( id: string, text: string ): unknown {
	const t = text.trim();
	if ( ! t ) return undefined;
	const keys = keysOf( id );
	if ( keys ) {
		// Elliptical corners, `4% 8% / 6%`: each half spreads on its own, then pairs per corner.
		const halves = shapeOf( id ) === 'corners' ? t.split( '/' ).map( ( h ) => fourWay( split( h, ' ' ) ) ) : [ fourWay( split( t, ' ' ) ) ];
		if ( halves.length > 2 || halves.some( ( h ) => ! h ) ) return null;
		if ( halves.length === 1 && split( t, ' ' ).length === 1 ) return t;
		return Object.fromEntries( keys.map( ( k, i ) => [ k, halves.map( ( h ) => h![ i ] ).join( ' ' ) ] ) );
	}
	const shape = shapeOf( id );
	if ( shape === 'boxShadow' || shape === 'textShadow' ) {
		if ( shape === 'boxShadow' && /^[\w-]+$/.test( t ) ) return t;
		const layers = split( t, ',' ).map( ( l ) => shadowLayer( l, shape === 'boxShadow' ) );
		if ( layers.some( ( l ) => ! l ) ) return null;
		return layers.length === 1 ? layers[ 0 ] : layers;
	}
	if ( /^[[{]/.test( t ) ) {
		try {
			return JSON.parse( t );
		} catch {
			return null;
		}
	}
	return t;
}

/** Why the engine would refuse this value here, or null when it is used. */
export function problemOf( id: string, part: string, state: string, breakpoint: string, value: unknown, controls?: readonly string[] ): StyleProblemReason | null {
	const probe = setEntry( {}, id, part, state, breakpoint, value );
	return findStyleProblems( probe, controls )[ 0 ]?.reason ?? null;
}

/**
 * The controls this block can take in this part, for Add a setting: its allow-list (with `x.*`
 * wildcards), only those a ::before or ::after takes on a part.
 */
export function addableOf( controls: readonly string[] | undefined, part: string ): string[] {
	const allowed = ( id: string ) => ! controls || controls.includes( id ) || controls.includes( `${ id.split( '.' )[ 0 ] }.*` );
	return STYLE_MAP.map( ( r ) => r.attr ).filter( ( id ) => allowed( id ) && ( part === ELEMENT || PARTABLE_CONTROLS.has( id ) ) );
}

/**
 * Values the quick choices do not reproduce: anything on a part or a smaller screen, and anything
 * the look would write differently. `quick` is the look's own values per state (`lookValues`).
 */
export function hiddenOf( tree: Tree, quick: Record< string, Record< string, unknown > > ): Entry[] {
	return entriesOf( tree ).filter( ( e ) => e.part !== ELEMENT || e.breakpoint !== 'base' || JSON.stringify( quick[ e.state ]?.[ e.id ] ?? null ) !== JSON.stringify( e.value ) );
}

/** Which hidden values each quick-choice section stands for, by the section's sub-view key. */
const SECTION_MATCH: Record< string, ( e: Entry ) => boolean > = {
	fill: ( e ) => e.state === 'default' && ( e.id === 'colors.background' || e.id.startsWith( 'background.' ) ),
	'text-style': ( e ) => e.state === 'default' && ( e.id.startsWith( 'typography.' ) || e.id === 'colors.text' ),
	border: ( e ) => e.state === 'default' && [ 'border.width', 'border.style', 'border.color' ].includes( e.id ),
	corners: ( e ) => e.state === 'default' && e.id === 'border.radius',
	shadow: ( e ) => e.state === 'default' && e.id === 'effects.boxShadow',
	space: ( e ) => e.state === 'default' && e.id.startsWith( 'spacing.' ),
	hover: ( e ) => e.state === 'hover' || e.state === 'group',
	press: ( e ) => e.state === 'active' || e.state === 'groupActive',
};

/** The hidden values a section stands for, on the block itself (parts have their own view). */
export function hiddenFor( hidden: Entry[], section: string ): Entry[] {
	const match = SECTION_MATCH[ section ];
	return match ? hidden.filter( ( e ) => e.part === ELEMENT && match( e ) ) : [];
}

/** The quick-choice sections by name, as the Style tab titles them. */
const SECTION_NAME: Record< string, string > = {
	fill: __( 'Color', 'blicks' ),
	'text-style': __( 'Text', 'blicks' ),
	border: __( 'Border', 'blicks' ),
	corners: __( 'Corners', 'blicks' ),
	shadow: __( 'Shadow', 'blicks' ),
	space: __( 'Space', 'blicks' ),
	hover: __( 'On hover', 'blicks' ),
	press: __( 'When clicked', 'blicks' ),
};

/**
 * Which Quick section wrote this value, if one did: the name a design-panel row shows under it, so
 * a value set by picking "Pill" is not mistaken for one typed by hand.
 *
 * Only values the look still reproduces count — `readStyle` must trust the stored look, and the
 * look must write exactly this value — so a value edited in the design panel afterwards stops
 * saying it came from Quick. `opts` is the block's own look (`InspectorPanels.look`).
 */
export function quickSourceOf( tree: Tree, opts: { linked?: boolean; kind?: string }, id: string, where: { part: string; state: string; breakpoint: string } ): string | null {
	if ( where.part !== ELEMENT || where.breakpoint !== 'base' || ! tree?.[ META ] ) return null;
	const { look, stale } = readStyle( tree, opts );
	if ( stale ) return null;
	const wrote = ( lookValues( look, opts ) as Record< string, Record< string, unknown > | undefined > )[ where.state ]?.[ id ];
	const stored = tree[ id ]?.[ where.state ]?.base;
	if ( wrote === undefined || JSON.stringify( wrote ) !== JSON.stringify( stored ) ) return null;
	const entry: Entry = { id, part: ELEMENT, state: where.state, breakpoint: 'base', value: stored };
	const section = Object.keys( SECTION_NAME ).find( ( key ) => SECTION_MATCH[ key ]?.( entry ) );
	return section ? SECTION_NAME[ section ]! : __( 'Style', 'blicks' );
}

/** Where a door into the design panel lands: one setting, in one slot. */
export interface DoorTarget {
	id: string;
	part: string;
	state: string;
	breakpoint: string;
}

/**
 * The row each quick-choice section opens on in the Studio's design panel when nothing it stands
 * for is set yet: the setting the section's choices mostly write, in the state they write it.
 */
const DOOR_DEFAULT: Record< string, [ id: string, state: string ] > = {
	fill: [ 'colors.background', 'default' ],
	'text-style': [ 'typography.fontSize', 'default' ],
	border: [ 'border.width', 'default' ],
	corners: [ 'border.radius', 'default' ],
	shadow: [ 'effects.boxShadow', 'default' ],
	space: [ 'spacing.padding', 'default' ],
	depth: [ 'effects.transform', 'default' ],
	hover: [ 'colors.background', 'hover' ],
	press: [ 'colors.background', 'active' ],
	entrance: [ 'animation.name', 'default' ],
};

/**
 * The row a section's Fine-tune door opens. A value the quick choices cannot show wins — that is
 * the one the person came for — and otherwise the section's own setting, so the hover door lands
 * on a hover row and the next edit is a hover value. Null for a section with no engine row.
 */
export function doorFor( section: string, hidden: Entry[] ): DoorTarget | null {
	const first = hiddenFor( hidden, section )[ 0 ];
	if ( first ) return { id: first.id, part: first.part, state: first.state, breakpoint: first.breakpoint };
	const fallback = DOOR_DEFAULT[ section ];
	return fallback ? { id: fallback[ 0 ], part: ELEMENT, state: fallback[ 1 ], breakpoint: 'base' } : null;
}

/** The editor a value opens in. Anything not listed is CSS text. */
export type Kind = 'colour' | 'sides' | 'length' | 'choice' | 'motion' | 'shadow' | 'css';

/** The animation settings, edited together: they only mean something as a set. */
export const MOTION_IDS = [ 'animation.name', 'animation.duration', 'animation.delay', 'animation.easing', 'animation.iteration', 'animation.direction', 'animation.fillMode' ];

/** The common keywords of the settings that take a keyword; "Other…" opens the CSS text. */
export const CHOICES: Record< string, readonly string[] > = {
	'layout.display': [ 'block', 'flex', 'grid', 'inline-flex', 'inline-block', 'inline', 'none' ],
	'layout.flexDirection': [ 'row', 'column', 'row-reverse', 'column-reverse' ],
	'layout.flexWrap': [ 'nowrap', 'wrap', 'wrap-reverse' ],
	'layout.alignItems': [ 'start', 'center', 'end', 'stretch', 'baseline' ],
	'layout.alignContent': [ 'start', 'center', 'end', 'space-between', 'stretch' ],
	'layout.justifyContent': [ 'start', 'center', 'end', 'space-between', 'space-around', 'space-evenly' ],
	'layout.justifyItems': [ 'start', 'center', 'end', 'stretch' ],
	'layout.overflow': [ 'visible', 'hidden', 'clip', 'auto', 'scroll' ],
	'layout.isolation': [ 'auto', 'isolate' ],
	'layout.boxSizing': [ 'border-box', 'content-box' ],
	'layout.containerType': [ 'normal', 'inline-size', 'size' ],
	'position.type': [ 'static', 'relative', 'absolute', 'fixed', 'sticky' ],
	'flexChild.alignSelf': [ 'auto', 'start', 'center', 'end', 'stretch', 'baseline' ],
	'gridChild.alignSelf': [ 'auto', 'start', 'center', 'end', 'stretch' ],
	'typography.textAlign': [ 'start', 'center', 'end', 'justify' ],
	'typography.textTransform': [ 'none', 'uppercase', 'lowercase', 'capitalize' ],
	'typography.fontStyle': [ 'normal', 'italic' ],
	'typography.whiteSpace': [ 'normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line' ],
	'typography.textWrap': [ 'wrap', 'balance', 'pretty', 'nowrap' ],
	'typography.textOverflow': [ 'clip', 'ellipsis' ],
	'typography.fontWeight': [ '300', '400', '500', '600', '700', '800', '900' ],
	'typography.writingMode': [ 'horizontal-tb', 'vertical-rl', 'vertical-lr' ],
	'effects.cursor': [ 'auto', 'default', 'pointer', 'text', 'move', 'grab', 'grabbing', 'not-allowed', 'wait', 'help', 'zoom-in', 'zoom-out', 'crosshair' ],
	'effects.blendMode': [ 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity' ],
	'effects.backfaceVisibility': [ 'visible', 'hidden' ],
	'effects.transformStyle': [ 'flat', 'preserve-3d' ],
	'background.repeat': [ 'no-repeat', 'repeat', 'repeat-x', 'repeat-y' ],
	'animation.direction': [ 'normal', 'reverse', 'alternate', 'alternate-reverse' ],
	'animation.fillMode': [ 'none', 'forwards', 'backwards', 'both' ],
	'animation.playState': [ 'running', 'paused' ],
};

/** Token categories whose values are lengths: picked from theme steps or typed exactly. */
const LENGTH_TOKENS = [ 'spacing', 'width', 'radius', 'borderWidth', 'fontSize', 'leading' ];
const LENGTH_IDS = /^(layout\.(width|height|min|max)|layout\.gap|typography\.(fontSize|letterSpacing|lineHeight)|effects\.outlineOffset|effects\.perspective|flexChild\.basis)/;

export const tokensOf = ( id: string ): string | undefined => CONTROL_VALUES[ id ]?.tokens;

export function kindOf( id: string ): Kind {
	const shape = shapeOf( id );
	if ( MOTION_IDS.includes( id ) ) return 'motion';
	if ( shape === 'boxShadow' || shape === 'textShadow' ) return 'shadow';
	if ( keysOf( id ) ) return 'sides';
	if ( tokensOf( id ) === 'color' ) return 'colour';
	if ( CHOICES[ id ] ) return 'choice';
	if ( LENGTH_TOKENS.includes( tokensOf( id ) ?? '' ) || LENGTH_IDS.test( id ) ) return 'length';
	return 'css';
}

/** A bare number typed as a length is px, as everywhere else in the inspector; `0` stays `0`. */
export const asLength = ( text: string ): string => ( /^-?(\d+\.?\d*|\.\d+)$/.test( text.trim() ) && Number( text ) !== 0 ? `${ text.trim() }px` : text.trim() );

/** `400ms` / `.4s` / `4s` as milliseconds, or null. */
export function msOf( value: unknown ): number | null {
	const m = /^(\d*\.?\d+)(ms|s)$/.exec( String( value ?? '' ).trim() );
	return m ? Math.round( Number( m[ 1 ] ) * ( m[ 2 ] === 's' ? 1000 : 1 ) ) : null;
}

/** Milliseconds written as CSS time, in seconds once it reads cleaner. */
export const timeOf = ( ms: number ): string => ( ms >= 1000 && ms % 100 === 0 ? `${ ms / 1000 }s` : `${ ms }ms` );
