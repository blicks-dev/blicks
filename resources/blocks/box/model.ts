/**
 * The Box's settings, as functions over its `blicks` style tree.
 *
 * Box is one primitive with **kinds** (Card, Panel, Cover, Badge, Divider, Spacer…) and
 * **arrangements** (stacked, side by side, grid, layers). None of those is a style of its own: each
 * one is a starting point that writes ordinary control values — `layout.display`, `spacing.padding`,
 * `colors.background` — which the Style tab then shows and edits like any other. Reading a setting
 * back is the same in reverse, from the base slot.
 *
 * Only what changes the markup is a block attribute: `kind` (a Divider is an `<hr>`, a Spacer is an
 * empty `aria-hidden` box, a Badge holds a line of text instead of blocks), `tag` and `layers`
 * (children share one grid cell — no control can say that about the children from the parent).
 */

export const BOX_KINDS = [ 'plain', 'card', 'panel', 'cover', 'badge', 'divider', 'spacer' ] as const;
export type BoxKind = ( typeof BOX_KINDS )[ number ];

/** Kinds that hold no inner blocks. Switching to one is only offered while the box is empty. */
export const LEAF_KINDS: readonly BoxKind[] = [ 'badge', 'divider', 'spacer' ];

export const BOX_TAGS = [ 'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'span' ] as const;

export function cleanKind( kind: unknown ): BoxKind {
	return ( BOX_KINDS as readonly string[] ).includes( String( kind ) ) ? ( kind as BoxKind ) : 'plain';
}

export function cleanTag( tag: unknown ): string {
	return ( BOX_TAGS as readonly string[] ).includes( String( tag ) ) ? String( tag ) : 'div';
}

import { EMPTY_LOOK, writeStyle, type Look } from '@/framework/inspector-v2/style-model';

export type Tree = Record< string, any >;
type Values = Record< string, unknown >;


/** The base value of a control, or undefined. */
export function baseOf( tree: Tree, id: string ): any {
	return tree?.[ id ]?.default?.base;
}

/** Set (or with `undefined`, clear) one slot of one control, pruning empty branches. */
export function withValue( tree: Tree, id: string, value: unknown, slot = 'default', bp = 'base' ): Tree {
	const next: Tree = { ...tree };
	const control = { ...( next[ id ] ?? {} ) };
	const bySlot = { ...( control[ slot ] ?? {} ) };
	if ( value === undefined || value === '' ) delete bySlot[ bp ];
	else bySlot[ bp ] = value;
	if ( Object.keys( bySlot ).length ) control[ slot ] = bySlot;
	else delete control[ slot ];
	if ( Object.keys( control ).length ) next[ id ] = control;
	else delete next[ id ];
	return next;
}

function withBase( tree: Tree, values: Values ): Tree {
	return Object.entries( values ).reduce( ( t, [ id, v ] ) => withValue( t, id, v ), tree );
}

// ── Arrange ──────────────────────────────────────────────────────────────────

export const ARRANGEMENTS = [ 'none', 'stack', 'row', 'grid', 'layers' ] as const;
export type Arrangement = ( typeof ARRANGEMENTS )[ number ];
export type Align = 'start' | 'center' | 'end';

export type Spread = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface ArrangeOptions {
	/** Horizontal placement — the 3×3 pad's column. */
	x: Align;
	/** Vertical placement — the pad's row. */
	y: Align;
	/** Spacing token between children (along the row, or down the stack). */
	gap: string;
	/** Spacing token between wrapped lines / grid rows; '' = the same as `gap`. */
	gapC: string;
	/** Grid columns. */
	cols: number;
	/** Grid only: collapse to one column on phones. */
	colsPhone: boolean;
	// ── the second level (Arrange → Customise) ──
	/** Reverse the order: bottom first, or right to left. */
	rev: boolean;
	/** How spare room is shared out along the main direction. */
	spread: Spread;
	/** Across the main direction: the pad's placement, stretch to fill, or line up the text. */
	stretch: 'no' | 'yes' | 'base';
	/** Side by side: wrap onto new lines. */
	wrap: boolean;
	/** Side by side: one under another on phones. */
	stackPhone: boolean;
	/** Grid: a set number of columns, or as many as fit at `minW`. */
	gmode: 'count' | 'fit';
	minW: number;
	/** Grid: column count on tablets; 0 = the same. */
	tabCols: number;
	/** Grid: every row as tall as the tallest. */
	rowsEq: boolean;
	/** Grid: fill across, down, or across filling gaps. */
	flow: 'row' | 'column' | 'dense';
}

export const DEFAULT_ARRANGE: ArrangeOptions = {
	x: 'start', y: 'start', gap: 'md', gapC: '', cols: 3, colsPhone: true,
	rev: false, spread: 'start', stretch: 'no', wrap: true, stackPhone: false,
	gmode: 'count', minW: 200, tabCols: 0, rowsEq: false, flow: 'row',
};

/** Grid cells fill by default, so cards in a grid stay full width. */
export const DEFAULT_GRID_STRETCH: ArrangeOptions[ 'stretch' ] = 'yes';

/** The options an arrangement starts from when it is picked. */
export function arrangeDefaults( a: Arrangement, keep: Partial< ArrangeOptions > = {} ): ArrangeOptions {
	return { ...DEFAULT_ARRANGE, ...keep, stretch: a === 'grid' ? DEFAULT_GRID_STRETCH : 'no' };
}

/** The second-level options, and whether any is off its default — the section then reads "Custom". */
const SECOND_LEVEL: Array< keyof ArrangeOptions > = [ 'gapC', 'rev', 'spread', 'stretch', 'wrap', 'stackPhone', 'gmode', 'minW', 'tabCols', 'rowsEq', 'flow' ];
export function isCustomArrange( a: Arrangement, o: ArrangeOptions ): boolean {
	const base = { ...DEFAULT_ARRANGE, stretch: a === 'grid' ? DEFAULT_GRID_STRETCH : 'no' };
	// Columns and "one column on phones" live in the second level too; the gap does not count, since
	// kinds start from different gaps and a Cover would otherwise always read as Custom.
	return SECOND_LEVEL.some( ( k ) => o[ k ] !== base[ k ] ) || ( a === 'grid' && ( o.cols !== DEFAULT_ARRANGE.cols || ! o.colsPhone ) );
}

/** Every control an arrangement writes — cleared before writing a new one so modes cannot mix. */
const ARRANGE_IDS = [
	'layout.display', 'layout.flexDirection', 'layout.flexWrap', 'layout.justifyContent', 'layout.alignItems',
	'layout.justifyItems', 'layout.alignContent', 'layout.gapRow', 'layout.gapColumn', 'layout.gridColumns',
	'layout.gridAutoFlow', 'layout.gridAutoRows',
];

const FLEX: Record< Align, string > = { start: 'flex-start', center: 'center', end: 'flex-end' };
const SPREAD: Record< Exclude< Spread, 'start' | 'center' | 'end' >, string > = { between: 'space-between', around: 'space-around', evenly: 'space-evenly' };
const fromFlex = ( v: unknown ): Align => ( v === 'center' ? 'center' : v === 'flex-end' || v === 'end' ? 'end' : 'start' );
const fromGrid = ( v: unknown ): Align => ( v === 'center' ? 'center' : v === 'end' ? 'end' : 'start' );
const gridCols = ( n: number ) => `repeat(${ n }, minmax(0, 1fr))`;
const fitCols = ( w: number ) => `repeat(auto-fit, minmax(min(${ w }px, 100%), 1fr))`;

/** Main-axis value: an explicit spread, or the pad's placement. */
const mainAxis = ( o: ArrangeOptions, pad: Align ) => ( o.spread === 'between' || o.spread === 'around' || o.spread === 'evenly' ? SPREAD[ o.spread ] : FLEX[ o.spread !== 'start' ? o.spread : pad ] );
/** Cross-axis value: stretch, baseline, or the pad's placement. */
const crossAxis = ( o: ArrangeOptions, pad: Align, flex: boolean ) => ( o.stretch === 'yes' ? 'stretch' : o.stretch === 'base' ? 'baseline' : flex ? FLEX[ pad ] : pad );

/** Write an arrangement into the tree. Returns the tree and the `layers` attribute it implies. */
export function applyArrange( tree: Tree, arrangement: Arrangement, o: ArrangeOptions ): { tree: Tree; layers: boolean } {
	let next = ARRANGE_IDS.reduce(
		( t, id ) => [ 'base', 'tablet', 'mobile' ].reduce( ( u, bp ) => withValue( u, id, undefined, 'default', bp ), t ),
		tree
	);
	const lines = o.gapC || o.gap;

	if ( arrangement === 'stack' ) {
		next = withBase( next, {
			'layout.display': 'flex',
			'layout.flexDirection': o.rev ? 'column-reverse' : 'column',
			'layout.alignItems': crossAxis( o, o.x, true ),
			'layout.justifyContent': mainAxis( o, o.y ),
			'layout.gapRow': o.gap,
		} );
	} else if ( arrangement === 'row' ) {
		next = withBase( next, {
			'layout.display': 'flex',
			'layout.flexDirection': o.rev ? 'row-reverse' : 'row',
			'layout.flexWrap': o.wrap ? 'wrap' : 'nowrap',
			'layout.justifyContent': mainAxis( o, o.x ),
			'layout.alignItems': crossAxis( o, o.y, true ),
			'layout.gapRow': lines,
			'layout.gapColumn': o.gap,
		} );
		if ( o.stackPhone ) {
			next = withValue( next, 'layout.flexDirection', 'column', 'default', 'mobile' );
			next = withValue( next, 'layout.alignItems', 'stretch', 'default', 'mobile' );
		}
	} else if ( arrangement === 'grid' ) {
		next = withBase( next, {
			'layout.display': 'grid',
			'layout.gridColumns': o.gmode === 'fit' ? fitCols( o.minW ) : gridCols( o.cols ),
			'layout.alignContent': o.y,
			'layout.gapRow': lines,
			'layout.gapColumn': o.gap,
			'layout.gridAutoFlow': o.flow === 'dense' ? 'row dense' : o.flow === 'column' ? 'column' : undefined,
			'layout.gridAutoRows': o.rowsEq ? '1fr' : undefined,
			// Filling the cell is the browser's own default for grid items, so it writes nothing.
			'layout.justifyItems': o.stretch === 'yes' ? undefined : o.x,
			'layout.alignItems': o.stretch === 'yes' ? undefined : o.y,
		} );
		if ( o.gmode === 'count' && o.tabCols ) next = withValue( next, 'layout.gridColumns', gridCols( o.tabCols ), 'default', 'tablet' );
		if ( o.colsPhone ) next = withValue( next, 'layout.gridColumns', gridCols( 1 ), 'default', 'mobile' );
	} else if ( arrangement === 'layers' ) {
		next = withBase( next, {
			'layout.display': 'grid',
			'layout.justifyItems': o.stretch === 'yes' ? 'stretch' : o.x,
			'layout.alignItems': o.stretch === 'yes' ? 'stretch' : o.y,
		} );
	}

	return { tree: next, layers: arrangement === 'layers' };
}

/** Read the arrangement back from the tree (and the `layers` attribute). */
export function readArrange( tree: Tree, layers: boolean ): { arrangement: Arrangement; options: ArrangeOptions } {
	const display = baseOf( tree, 'layout.display' );
	const cols = String( baseOf( tree, 'layout.gridColumns' ) ?? '' );
	const fit = /auto-fit, minmax\(min\((\d+)px/.exec( cols );
	const at = ( id: string, bp: string ) => tree?.[ id ]?.default?.[ bp ];
	const gapRow = baseOf( tree, 'layout.gapRow' );
	const gapColumn = baseOf( tree, 'layout.gapColumn' );
	const gap = String( gapColumn ?? gapRow ?? DEFAULT_ARRANGE.gap );
	const justify = baseOf( tree, 'layout.justifyContent' );
	const align = baseOf( tree, 'layout.alignItems' );
	const spreadOf = ( v: unknown ): Spread => ( v === 'space-between' ? 'between' : v === 'space-around' ? 'around' : v === 'space-evenly' ? 'evenly' : 'start' );
	const stretchOf = ( v: unknown ): ArrangeOptions[ 'stretch' ] => ( v === 'stretch' ? 'yes' : v === 'baseline' ? 'base' : 'no' );
	const flow = baseOf( tree, 'layout.gridAutoFlow' );
	const options: ArrangeOptions = {
		...DEFAULT_ARRANGE,
		gap,
		gapC: gapColumn !== undefined && gapRow !== undefined && gapRow !== gapColumn ? String( gapRow ) : '',
		cols: Number( /repeat\(\s*(\d+)/.exec( cols )?.[ 1 ] ?? DEFAULT_ARRANGE.cols ),
		colsPhone: at( 'layout.gridColumns', 'mobile' ) !== undefined,
		tabCols: Number( /repeat\(\s*(\d+)/.exec( String( at( 'layout.gridColumns', 'tablet' ) ?? '' ) )?.[ 1 ] ?? 0 ),
		gmode: fit ? 'fit' : 'count',
		minW: fit ? Number( fit[ 1 ] ) : DEFAULT_ARRANGE.minW,
		rev: /-reverse$/.test( String( baseOf( tree, 'layout.flexDirection' ) ?? '' ) ),
		wrap: baseOf( tree, 'layout.flexWrap' ) !== 'nowrap',
		stackPhone: at( 'layout.flexDirection', 'mobile' ) === 'column',
		rowsEq: baseOf( tree, 'layout.gridAutoRows' ) === '1fr',
		flow: flow === 'row dense' ? 'dense' : flow === 'column' ? 'column' : 'row',
	};

	if ( display === 'grid' && layers ) {
		const ji = baseOf( tree, 'layout.justifyItems' );
		return { arrangement: 'layers', options: { ...options, stretch: ji === 'stretch' ? 'yes' : 'no', x: fromGrid( ji ), y: fromGrid( align ) } };
	}
	if ( display === 'grid' ) {
		const ji = baseOf( tree, 'layout.justifyItems' );
		return {
			arrangement: 'grid',
			options: ji === undefined
				? { ...options, stretch: 'yes', y: fromGrid( baseOf( tree, 'layout.alignContent' ) ) }
				: { ...options, stretch: 'no', x: fromGrid( ji ), y: fromGrid( align ) },
		};
	}
	const direction = String( baseOf( tree, 'layout.flexDirection' ) ?? '' );
	if ( display === 'flex' && direction.startsWith( 'column' ) ) {
		return { arrangement: 'stack', options: { ...options, spread: spreadOf( justify ), stretch: stretchOf( align ), x: fromFlex( align ), y: fromFlex( justify ) } };
	}
	if ( display === 'flex' ) {
		return { arrangement: 'row', options: { ...options, spread: spreadOf( justify ), stretch: stretchOf( align ), x: fromFlex( justify ), y: fromFlex( align ) } };
	}
	return { arrangement: 'none', options };
}

/**
 * Picks an arrangement as the Arrange section does: the current one keeps its options; another
 * starts its own over, carrying the pad, gap and columns. Settings and the toolbar both call it.
 */
export function rearrange( tree: Tree, layers: boolean, a: Arrangement, patch: Partial< ArrangeOptions > = {} ): { tree: Tree; layers: boolean } {
	const { arrangement, options } = readArrange( tree, layers );
	const base = a === arrangement ? options : arrangeDefaults( a, { x: options.x, y: options.y, gap: options.gap, cols: Math.min( options.cols, 4 ), colsPhone: options.colsPhone } );
	return applyArrange( tree, a, { ...base, ...patch } );
}

// ── Size and behaviour ──────────────────────────────────────────────────────

export const WIDTHS = [ 'fit', 'prose', 'content', 'fill' ] as const;
export type Width = ( typeof WIDTHS )[ number ];

export function applyWidth( tree: Tree, width: Width ): Tree {
	const values: Values = {
		fit: { 'layout.width': 'fit-content', 'layout.maxWidth': undefined },
		prose: { 'layout.width': 'prose', 'layout.maxWidth': '100%' },
		content: { 'layout.width': 'content', 'layout.maxWidth': '100%' },
		fill: { 'layout.width': '100%', 'layout.maxWidth': undefined },
	}[ width ];
	return withBase( tree, values );
}

export function readWidth( tree: Tree ): Width | '' {
	const w = baseOf( tree, 'layout.width' );
	if ( w === 'fit-content' ) return 'fit';
	if ( w === 'prose' || w === 'content' ) return w;
	if ( w === '100%' ) return 'fill';
	return '';
}

/** A typed width, held to the space it sits in so it never pushes past it. */
export function applyExactWidth( tree: Tree, length: string ): Tree {
	return withBase( tree, { 'layout.width': length, 'layout.maxWidth': '100%' } );
}

export const HEIGHTS = [ 'auto', 'half', 'full', 'square' ] as const;
export type Height = ( typeof HEIGHTS )[ number ];

export function applyHeight( tree: Tree, height: Height ): Tree {
	return withBase( tree, {
		'layout.minHeight': { half: '50vh', full: '100vh' }[ height as 'half' | 'full' ],
		'layout.aspectRatio': height === 'square' ? '1' : undefined,
	} );
}

/** '' when the height is a typed one rather than a preset. */
export function readHeight( tree: Tree ): Height | '' {
	if ( baseOf( tree, 'layout.aspectRatio' ) === '1' ) return 'square';
	const min = baseOf( tree, 'layout.minHeight' );
	if ( min === undefined ) return 'auto';
	return min === '50vh' ? 'half' : min === '100vh' ? 'full' : '';
}

/** A typed height is a floor, like the presets: content taller than it still shows. */
export function applyExactHeight( tree: Tree, length: string ): Tree {
	return withBase( tree, { 'layout.minHeight': length, 'layout.aspectRatio': undefined } );
}

/** Stay on screen while scrolling: sticky to the top, above ordinary content. */
export function applySticky( tree: Tree, on: boolean ): Tree {
	return withBase( tree, {
		'position.type': on ? 'sticky' : undefined,
		'position.inset': on ? { top: '0' } : undefined,
		'position.zIndex': on ? 'sticky' : undefined,
	} );
}

export const readSticky = ( tree: Tree ): boolean => baseOf( tree, 'position.type' ) === 'sticky';

// ── Divider and Spacer ──────────────────────────────────────────────────────

export const THICKNESS = { thin: '1px', medium: '2px', thick: '4px' } as const;
export type Thickness = keyof typeof THICKNESS;

export function applyThickness( tree: Tree, t: Thickness ): Tree {
	return withValue( tree, 'layout.height', THICKNESS[ t ] );
}

/** '' when the thickness is a typed one rather than a step. */
export function readThickness( tree: Tree ): Thickness | '' {
	const h = baseOf( tree, 'layout.height' );
	if ( h === undefined ) return 'thin';
	return ( Object.keys( THICKNESS ) as Thickness[] ).find( ( k ) => THICKNESS[ k ] === h ) ?? '';
}

/** The line's thickness in px, for the slider; 1 when it is not a px value. */
export function readThicknessPx( tree: Tree ): number {
	const m = /^(\d+(?:\.\d+)?)px$/.exec( String( baseOf( tree, 'layout.height' ) ?? '1px' ) );
	return m ? Number( m[ 1 ] ) : 1;
}

export const applyThicknessPx = ( tree: Tree, n: number ): Tree => withValue( tree, 'layout.height', `${ n }px` );

export type Length = 'fill' | 'short';

/** A preset length keeps the phone rule; only the base width changes. */
export function applyLength( tree: Tree, length: Length ): Tree {
	return withValue( tree, 'layout.width', length === 'short' ? '4rem' : '100%' );
}

export const applyExactLength = ( tree: Tree, length: string ): Tree => withValue( tree, 'layout.width', length );

/** '' when the length is a typed one. */
export function readLength( tree: Tree ): Length | '' {
	const w = baseOf( tree, 'layout.width' );
	return w === '4rem' ? 'short' : w === undefined || w === '100%' ? 'fill' : '';
}

/** A short line runs full width on phones, where a short stub looks lost. */
export const applyLengthPhoneFull = ( tree: Tree, on: boolean ): Tree => withValue( tree, 'layout.width', on ? '100%' : undefined, 'default', 'mobile' );
export const readLengthPhoneFull = ( tree: Tree ): boolean => tree?.[ 'layout.width' ]?.default?.mobile === '100%';

export const ROOM = { sm: '1rem', lg: '2rem', xl: '4rem', '2xl': '6rem' } as const;
export type Room = keyof typeof ROOM;
const HALF_ROOM: Record< Room, string > = { sm: '0.5rem', lg: '1rem', xl: '2rem', '2xl': '3rem' };

/** A spacer's height, optionally halved on phones. */
export function applyRoom( tree: Tree, room: Room, lessPhone: boolean ): Tree {
	const next = withValue( tree, 'layout.height', ROOM[ room ] );
	return withValue( next, 'layout.height', lessPhone ? HALF_ROOM[ room ] : undefined, 'default', 'mobile' );
}

export type PhoneRoom = 'same' | 'half' | 'none';

/** Half of a length, in its own unit; null when it is not a plain number and unit. */
export function halfOf( length: string ): string | null {
	const m = /^(\d*\.?\d+)([a-z%]*)$/.exec( length );
	return m ? `${ Number( m[ 1 ] ) / 2 }${ m[ 2 ] || 'px' }` : null;
}

/** A typed amount of room. A phone rule set to half follows the new height. */
export function applyExactRoom( tree: Tree, length: string ): Tree {
	const was = readRoom( tree ).phone;
	const next = withValue( tree, 'layout.height', length );
	return was === 'half' ? applyPhoneRoom( next, 'half' ) : next;
}

/** On phones: the same room, half of it, none, or a typed length. */
export function applyPhoneRoom( tree: Tree, phone: PhoneRoom | string ): Tree {
	const h = String( baseOf( tree, 'layout.height' ) ?? ROOM.lg );
	const value = phone === 'same' ? undefined : phone === 'none' ? '0' : phone === 'half' ? ( halfOf( h ) ?? undefined ) : phone;
	return withValue( tree, 'layout.height', value, 'default', 'mobile' );
}

export function readRoom( tree: Tree ): { room: Room | ''; lessPhone: boolean; height: string; phone: PhoneRoom | ''; phoneHeight: string } {
	const height = String( baseOf( tree, 'layout.height' ) ?? ROOM.lg );
	const room = ( Object.keys( ROOM ) as Room[] ).find( ( k ) => ROOM[ k ] === height ) ?? '';
	const mob = tree?.[ 'layout.height' ]?.default?.mobile;
	const phoneHeight = mob === undefined ? '' : String( mob );
	const half = room ? HALF_ROOM[ room ] : halfOf( height );
	const phone = mob === undefined ? 'same' : phoneHeight === '0' ? 'none' : phoneHeight === half ? 'half' : '';
	return { room, lessPhone: mob !== undefined, height, phone, phoneHeight };
}

// ── Kinds ───────────────────────────────────────────────────────────────────

interface KindLook {
	tag: string;
	/** How the box itself is laid out (base-slot layout values). */
	layout: Values;
	/** Its look, as the Style tab describes it — written through the same model the tab uses. */
	look: Partial< Look >;
	/** How the kind arranges its children, if it holds any. */
	arrange?: { arrangement: Arrangement; options: Partial< ArrangeOptions > };
}

const KIND_LOOKS: Record< BoxKind, KindLook > = {
	plain: { tag: 'div', layout: {}, look: {} },
	card: {
		tag: 'article',
		layout: {},
		look: { fill: 'background', pad: 'xl', radius: 'lg', border: 'thin', bcol: 'border', shadow: 'sm' },
		arrange: { arrangement: 'stack', options: { gap: 'md' } },
	},
	panel: {
		tag: 'aside',
		layout: {},
		look: { fill: 'secondary', pad: 'xl', radius: 'md' },
		arrange: { arrangement: 'stack', options: { gap: 'md' } },
	},
	cover: {
		tag: 'section',
		layout: { 'layout.minHeight': '50vh' },
		look: { fill: { k: 'grad', preset: 'brand' }, pad: '3xl' },
		arrange: { arrangement: 'stack', options: { x: 'center', y: 'center', gap: 'xl' } },
	},
	badge: {
		tag: 'span',
		layout: { 'layout.display': 'inline-flex', 'layout.alignItems': 'center' },
		look: { fill: 'accent', pad: 'b2', radius: 'full', weight: '600', fsize: 12 },
	},
	divider: {
		tag: 'div',
		layout: { 'layout.height': THICKNESS.thin, 'layout.width': '100%' },
		look: { fill: 'border', out: [ 16, 0, 16, 0 ] },
	},
	spacer: { tag: 'div', layout: {}, look: {} },
};

/**
 * Start a kind's look over. Picking another kind replaces the style tree — the kinds are different
 * things, and blending a Card's border into a Cover's gradient helps nobody.
 */
export function applyKind( kind: BoxKind ): { blicks: Tree; tag: string; layers: boolean } {
	const look = KIND_LOOKS[ kind ];
	let tree = withBase( {}, look.layout );
	if ( kind !== 'spacer' ) tree = writeStyle( tree, { ...EMPTY_LOOK, ...look.look }, { kind } );
	let layers = false;
	if ( look.arrange ) {
		( { tree, layers } = applyArrange( tree, look.arrange.arrangement, { ...DEFAULT_ARRANGE, ...look.arrange.options } ) );
	}
	if ( kind === 'spacer' ) tree = applyRoom( tree, 'lg', true );
	return { blicks: tree, tag: look.tag, layers };
}
