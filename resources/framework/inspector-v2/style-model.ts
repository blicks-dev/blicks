/**
 * The Style tab's model: what the Box/Buttons inspector designs call a look — a fill, a picture,
 * a border, corners, a shadow, a depth, text, and what happens on hover, click and focus — written
 * to and read from ordinary engine controls.
 *
 * The engine values are the truth; the front end renders only them. The look is also kept in the
 * tree under `meta.look` (an id no control owns, so the engine ignores it) because a value like
 * "a 3D edge plus a medium shadow" is one `box-shadow` list on the page, and splitting it back into
 * its parts is guesswork. `readStyle()` trusts that copy only while re-writing it reproduces every
 * value it owns; if anything else changed them — another panel, an import, an AI edit — it reads
 * what it can from the plain values instead, so the panel never shows a stale look.
 */

import { isToken } from '@/design-system/tokens';

export type Tree = Record< string, any >;

export const META = 'meta.look';

// ── value shapes ────────────────────────────────────────────────────────────

export interface GradStop {
	/** A palette slug or a hex colour. */
	c: string;
	/** Opacity, 0–100. */
	a: number;
	/** Position along the gradient, 0–100. */
	p: number;
}

export interface GradLayer {
	type: 'linear' | 'radial' | 'conic';
	angle: number;
	pos: string;
	shape: 'circle' | 'ellipse';
	stops: GradStop[];
}

/** '' (none), a palette slug or hex, or a gradient (a named preset, or layers top first). */
export type Fill = string | { k: 'grad'; preset?: string; layers?: GradLayer[] };

export interface BorderSpec {
	w: number;
	style: 'solid' | 'dashed' | 'dotted' | 'double';
	sides: 'all' | 'bottom' | 'tb' | 'left';
}

export interface ShadowLayer {
	inset: boolean;
	x: number;
	y: number;
	b: number;
	s: number;
	c: string;
	a: number;
}

export type Shadow = '' | 'sm' | 'md' | 'lg' | { preset?: string; layers: ShadowLayer[] };

/** Finish → Customise. Unset fields keep the preset as drawn. */
export interface FinishX {
	/** 0–150: how strong the shine, shading or frost is; 100 is the preset. */
	s: number;
	/** The thin light line along the top edge. */
	edge: boolean;
	/** Glass only: how much it blurs what is behind, in px. */
	blur: number;
}

export interface DepthX {
	n: number;
	c: string;
	hover: 'lift' | 'settle' | 'stay';
}

/** What changes in a state. Every field is optional — unset means "no change". */
export interface StateLook {
	fill?: string;
	text?: string;
	bcol?: string;
	move?: number;
	scale?: number;
	tilt?: number;
	bright?: number;
	shadow?: 'sm' | 'md' | 'lg' | 'glow' | 'inset';
	push?: boolean;
	/** Hidden at rest, shown in the state: the reveal a card's quick actions use. */
	show?: boolean;
	/** px to the side at rest, back in place in the state: a reveal that slides in. */
	from?: number;
}

export interface FocusOutline {
	line: 'dashed' | 'dotted' | 'solid';
	col: string;
	w: number;
	off: number;
}

export const FOCUS_OUTLINE: FocusOutline = { line: 'dashed', col: 'primary', w: 2, off: 3 };

export interface Look {
	fill: Fill;
	/** '' = readable on the fill, chosen automatically. */
	text: string;
	img: string;
	dim: '' | 'light' | 'medium' | 'strong';
	ifit: 'cover' | 'contain' | 'tile';
	ipos: string;
	ifixed: boolean;
	finish: '' | 'gloss' | 'soft' | 'glass';
	finishX: Partial< FinishX >;
	border: '' | 'thin' | 'thick' | BorderSpec;
	bcol: string;
	/** '' | a spacing token | a badge size (b1–b3) | [top, right, bottom, left] in px. */
	pad: string | number[];
	/** Space outside, [top, right, bottom, left] in px, or null. */
	out: number[] | null;
	/** '' | sm | md | lg | full | per-corner px | the sketch shape. */
	radius: string | { c: number[] } | { sketch: true };
	shadow: Shadow;
	depth: '' | 'edge' | 'block' | 'frame';
	depthX: Partial< DepthX >;
	tilt: number;
	font: string;
	/** px as a number, or any CSS length or size token as written by something else. */
	fsize: number | string | '';
	/** Line height as written: a number (`1.5`) or a length; '' leaves the theme's. */
	lh: string;
	/** Paint the fill's gradient into the letters instead of behind them. */
	clip: boolean;
	weight: string;
	italic: boolean;
	track: number | '';
	tcase: '' | 'uppercase' | 'lowercase' | 'capitalize';
	deco: '' | 'underline' | 'line-through';
	tsh: '' | 'soft' | 'lift' | 'glow' | 'retro';
	hover: string;
	hoverX: StateLook | null;
	/**
	 * What the hover look answers to: the block itself, or the nearest card around it (pointed at
	 * or focused) — the engine's `group` state. Same look, different slot.
	 */
	hoverFrom: 'self' | 'card';
	press: string;
	/** What the click look answers to: the block itself, or its card being pressed — `groupActive`. */
	pressFrom: 'self' | 'card';
	pressX: StateLook | null;
	focus: '' | 'ring' | 'gap' | 'glow' | 'outline';
	/** Focus → Outline: its line, colour, width and gap in px. Unset fields take the defaults. */
	focusOl: Partial< FocusOutline >;
	speed: 'instant' | 'quick' | 'smooth' | 'slow';
	feel: 'ease' | 'spring' | 'steady';
	/** Dividers only: how the line is drawn. */
	dline: 'solid' | 'dashed' | 'dotted' | 'double';
	/** Dividers only: where a line shorter than its space sits. */
	dalign: 'start' | 'center' | 'end';
}

export const EMPTY_LOOK: Look = {
	fill: '', text: '', img: '', dim: '', ifit: 'cover', ipos: '50% 50%', ifixed: false, finish: '', finishX: {},
	border: '', bcol: '', pad: '', out: null, radius: '', shadow: '', depth: '', depthX: {}, tilt: 0,
	font: '', fsize: '', lh: '', clip: false, weight: '', italic: false, track: '', tcase: '', deco: '', tsh: '',
	hover: 'none', hoverX: null, hoverFrom: 'self', press: 'none', pressFrom: 'self', pressX: null, focus: '', focusOl: {}, speed: 'quick', feel: 'ease', dline: 'solid', dalign: 'start',
};

// ── presets ─────────────────────────────────────────────────────────────────

const S = ( c: string, p: number, a = 100 ): GradStop => ( { c, a, p } );
const L = ( type: GradLayer[ 'type' ], angle: number, stops: GradStop[], pos = '50% 50%', shape: GradLayer[ 'shape' ] = 'circle' ): GradLayer => ( { type, angle, pos, shape, stops } );

/** Ready-made gradients. Those that are theme tokens are written as the token. */
export const GRADIENTS: Record< string, { label: string; layers: GradLayer[] } > = {
	brand: { label: 'Brand', layers: [ L( 'linear', 90, [ S( 'primary', 0 ), S( '#7b61ff', 100 ) ] ) ] },
	paper: { label: 'Paper', layers: [ L( 'linear', 180, [ S( '#ffffff', 0 ), S( '#e9eef6', 100 ) ] ) ] },
	atomic: { label: 'Atomic', layers: [ L( 'linear', 135, [ S( '#ff8a65', 0 ), S( '#ec4899', 50 ), S( '#6366f1', 100 ) ] ) ] },
	sunset: { label: 'Sunset', layers: [ L( 'linear', 135, [ S( '#f97316', 0 ), S( '#ec4899', 100 ) ] ) ] },
	ocean: { label: 'Ocean', layers: [ L( 'linear', 135, [ S( '#0ea5e9', 0 ), S( '#4f46e5', 100 ) ] ) ] },
	night: { label: 'Night', layers: [ L( 'linear', 160, [ S( '#18181b', 0 ), S( '#4f46e5', 100 ) ] ) ] },
	aurora: { label: 'Aurora', layers: [ L( 'radial', 0, [ S( '#22d3ee', 0, 85 ), S( '#22d3ee', 55, 0 ) ], '15% 20%' ), L( 'radial', 0, [ S( '#d946ef', 0, 80 ), S( '#d946ef', 50, 0 ) ], '85% 80%' ), L( 'linear', 135, [ S( '#0f172a', 0 ), S( '#312e81', 100 ) ] ) ] },
	glow: { label: 'Top glow', layers: [ L( 'radial', 0, [ S( '#ffffff', 0, 45 ), S( '#ffffff', 60, 0 ) ], '50% 0%', 'ellipse' ), L( 'linear', 90, [ S( 'primary', 0 ), S( 'primary', 100 ) ] ) ] },
	rainbow: { label: 'Spectrum', layers: [ L( 'conic', 0, [ S( '#f43f5e', 0 ), S( '#f59e0b', 20 ), S( '#22c55e', 40 ), S( '#0ea5e9', 60 ), S( '#6366f1', 80 ), S( '#f43f5e', 100 ) ] ) ] },
};

export const SHADOW_PRESETS: Record< string, { label: string; layers: ShadowLayer[] } > = {};
const SH = ( x: number, y: number, b: number, s: number, c: string, a: number, inset = false ): ShadowLayer => ( { inset, x, y, b, s, c, a } );
Object.assign( SHADOW_PRESETS, {
	soft: { label: 'Soft', layers: [ SH( 0, 1, 2, 0, '#000000', 18 ) ] },
	medium: { label: 'Medium', layers: [ SH( 0, 3, 8, 0, '#000000', 20 ) ] },
	strong: { label: 'Strong', layers: [ SH( 0, 10, 22, -6, '#000000', 35 ) ] },
	floating: { label: 'Floating', layers: [ SH( 0, 1, 2, 0, '#000000', 8 ), SH( 0, 12, 28, -8, '#000000', 30 ) ] },
	lifted: { label: 'Lifted', layers: [ SH( 0, 18, 30, -12, 'primary', 45 ) ] },
	hard: { label: 'Hard edge', layers: [ SH( 4, 4, 0, 0, 'foreground', 100 ) ] },
	glow: { label: 'Glow', layers: [ SH( 0, 0, 0, 4, 'primary', 25 ), SH( 0, 8, 24, 0, 'primary', 35 ) ] },
	inset: { label: 'Pressed in', layers: [ SH( 0, 2, 4, 0, '#000000', 22, true ) ] },
	stacked: { label: 'Stacked', layers: [ 1, 2, 3, 4, 5 ].map( ( n ) => SH( n, n, 0, 0, 'foreground', 100 ) ) },
	neon: { label: 'Neon', layers: [ SH( 0, 0, 4, 0, '#22d3ee', 90 ), SH( 0, 0, 18, 2, '#22d3ee', 60 ) ] },
} );

export const STATE_PRESETS: Record< 'hover' | 'press', Record< string, StateLook > > = {
	hover: { none: {}, appear: { show: true }, slide: { show: true, from: -10 }, lift: { move: -2, shadow: 'md' }, glow: { shadow: 'glow' }, darken: { bright: 85 }, grow: { scale: 105 }, tilt: { tilt: -3, scale: 104 } },
	press: { none: {}, press: { scale: 97 }, push: { push: true }, sink: { shadow: 'inset', move: 1 } },
};

/** Badge padding sizes, [top, right, bottom, left] px. */
export const BADGE_PADS: Record< string, number[] > = { b1: [ 2, 6, 2, 6 ], b2: [ 4, 10, 4, 10 ], b3: [ 6, 14, 6, 14 ] };
export const SPEEDS = { instant: 0, quick: 150, smooth: 260, slow: 450 } as const;
export const FEELS = { ease: 'ease', spring: 'cubic-bezier(.34,1.56,.64,1)', steady: 'linear' } as const;
export const FONTS: Record< string, [ string, string ] > = {
	sans: [ 'Sans', 'sans' ],
	display: [ 'Display', '"Instrument Sans", Inter, sans-serif' ],
	serif: [ 'Serif', 'serif' ],
	mono: [ 'Mono', 'mono' ],
	round: [ 'Rounded', 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' ],
};
export const SKETCH = [ '255px 15px', '15px 225px', '225px 15px', '15px 255px' ];
const DIM_OPACITY = { light: 20, medium: 40, strong: 60 } as const;
const DEPTH_N = { edge: 4, block: 5, frame: 6 } as const;

/** The readable text colour for each palette fill — the theme's own `-foreground` pairs. */
const READABLE: Record< string, string > = {
	primary: 'primary-foreground', secondary: 'secondary-foreground', accent: 'accent-foreground', muted: 'foreground',
	card: 'card-foreground', popover: 'popover-foreground', destructive: 'background', foreground: 'background',
	background: 'foreground', border: 'foreground', input: 'foreground', ring: 'background',
};

// ── helpers ─────────────────────────────────────────────────────────────────

/** A palette slug or hex as CSS, at an opacity. */
export function colourCss( c: string, a = 100 ): string {
	const base = isToken( 'color', c ) ? `var(--blicks-color-${ c })` : c;
	return a >= 100 ? base : `color-mix(in srgb, ${ base } ${ a }%, transparent)`;
}

const px = ( n: number ) => ( n ? `${ n }px` : '0' );
const four = ( v: string ) => ( { top: v, right: v, bottom: v, left: v } );
const corners = ( v: string[] ) => ( { topLeft: v[ 0 ], topRight: v[ 1 ], bottomRight: v[ 2 ], bottomLeft: v[ 3 ] } );
const isGrad = ( f: Fill ): f is { k: 'grad'; preset?: string; layers?: GradLayer[] } => typeof f === 'object' && f !== null && f.k === 'grad';

export function gradLayers( f: Fill ): GradLayer[] {
	if ( ! isGrad( f ) ) return [];
	return f.layers ?? GRADIENTS[ f.preset ?? '' ]?.layers ?? [];
}

/** A gradient layer in the engine's gradient-builder shape. */
function gradientValue( l: GradLayer ) {
	return {
		type: l.type,
		angle: `${ l.angle }deg`,
		...( l.type !== 'linear' ? { position: l.pos } : {} ),
		...( l.type === 'radial' ? { shape: l.shape } : {} ),
		stops: [ ...l.stops ].sort( ( x, y ) => x.p - y.p ).map( ( s ) => ( { color: colourCss( s.c, s.a ), position: `${ s.p }%` } ) ),
	};
}

function luminance( hex: string ): number {
	const n = parseInt( hex.slice( 1 ), 16 );
	if ( Number.isNaN( n ) || hex.length !== 7 ) return 1;
	return [ n >> 16, ( n >> 8 ) & 255, n & 255 ]
		.map( ( x ) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow( ( x + 0.055 ) / 1.055, 2.4 ); } )
		.reduce( ( sum, x, i ) => sum + x * [ 0.2126, 0.7152, 0.0722 ][ i ], 0 );
}

/** The automatic text colour: the fill's foreground pair, white on a picture, dark or white on a hex. */
export function readableText( look: Pick< Look, 'fill' | 'img' > ): string {
	if ( look.img ) return '#ffffff';
	const f = look.fill;
	if ( typeof f === 'string' && f ) return READABLE[ f ] ?? ( f.startsWith( '#' ) ? ( luminance( f ) > 0.4 ? '#18181b' : '#ffffff' ) : '' );
	if ( isGrad( f ) ) {
		if ( f.preset === 'brand' || f.preset === 'glow' ) return 'primary-foreground';
		const first = gradLayers( f ).at( -1 )?.stops[ 0 ]?.c ?? '';
		if ( READABLE[ first ] ) return READABLE[ first ];
		return first.startsWith( '#' ) ? ( luminance( first ) > 0.4 ? '#18181b' : '#ffffff' ) : '';
	}
	return '';
}

function borderSpec( b: Look[ 'border' ] ): BorderSpec | null {
	if ( ! b ) return null;
	if ( typeof b === 'object' ) return b;
	return { w: b === 'thick' ? 2 : 1, style: 'solid', sides: 'all' };
}

function shadowLayers( v: Shadow ): ShadowLayer[] {
	if ( ! v || typeof v === 'string' ) return [];
	return v.layers ?? SHADOW_PRESETS[ v.preset ?? '' ]?.layers ?? [];
}

const shadowLayer = ( l: ShadowLayer, role: string ) => ( {
	...( l.inset ? { inset: true } : {} ),
	x: px( l.x ), y: px( l.y ), blur: px( l.b ), spread: px( l.s ), color: colourCss( l.c, l.a ), role,
} );

export const FINISH_BLUR = 10;
const pct = ( n: number ) => `${ Math.round( n * 10 ) / 10 }%`;

/** A finish's strength as a 0–1 factor, its edge line, and glass blur — preset values where unset. */
export function finishOf( look: Look ): { k: number; edge: boolean; blur: number } {
	const x = look.finishX ?? {};
	return { k: Math.max( 0, Math.min( 150, x.s ?? 100 ) ) / 100, edge: x.edge ?? true, blur: x.blur ?? FINISH_BLUR };
}

/** The base `box-shadow` list: depth, then finish, then the shadow setting — as the designs stack them. */
function baseShadows( look: Look, depthN?: number ): any[] {
	const out: any[] = [];
	if ( look.depth ) {
		const n = depthN ?? look.depthX.n ?? DEPTH_N[ look.depth ];
		const fillBase = typeof look.fill === 'string' && look.fill ? colourCss( look.fill ) : '#d4d4d8';
		const c = look.depthX.c ? colourCss( look.depthX.c ) : look.depth === 'edge' ? `color-mix(in srgb, ${ fillBase } 65%, #000)` : colourCss( 'foreground' );
		if ( look.depth === 'edge' ) out.push( { x: '0', y: px( n ), color: c, role: 'depth' } );
		if ( look.depth === 'block' ) out.push( { x: px( n ), y: px( n ), color: c, role: 'depth' } );
		if ( look.depth === 'frame' ) out.push( { x: px( n ), y: px( n ), spread: '-2px', color: colourCss( 'background' ), role: 'depth' }, { x: px( n ), y: px( n ), color: c, role: 'depth' } );
	}
	const { k, edge } = finishOf( look );
	if ( look.finish === 'soft' && k > 0 ) out.push( { inset: true, y: '-10px', blur: '14px', spread: '-8px', color: `rgb(0 0 0 / ${ pct( 28 * k ) })`, role: 'finish' } );
	if ( look.finish && edge ) {
		const rim = { gloss: { y: '1px', a: 45 }, soft: { y: '1px', blur: '1px', a: 35 }, glass: { y: '1px', a: 55 } }[ look.finish ];
		out.push( { inset: true, y: rim.y, ...( 'blur' in rim ? { blur: rim.blur } : {} ), color: `rgb(255 255 255 / ${ rim.a }%)`, role: 'finish' } );
	}
	if ( typeof look.shadow === 'string' && look.shadow ) out.push( { token: look.shadow, role: 'shadow' } );
	else out.push( ...shadowLayers( look.shadow ).map( ( l ) => shadowLayer( l, 'shadow' ) ) );
	return out;
}

const STATE_SHADOW: Record< string, any[] > = {
	sm: [ { token: 'sm' } ], md: [ { token: 'md' } ], lg: [ { token: 'lg' } ],
	glow: [ { spread: '4px', color: colourCss( 'primary', 30 ) }, { y: '8px', blur: '20px', color: colourCss( 'primary', 30 ) } ],
	inset: [ { inset: true, y: '3px', blur: '6px', color: 'rgb(0 0 0 / 30%)' } ],
};

const FOCUS_SHADOW: Record< string, any[] > = {
	ring: [ { spread: '2px', color: colourCss( 'primary' ) } ],
	gap: [ { spread: '2px', color: colourCss( 'background' ) }, { spread: '4px', color: colourCss( 'primary' ) } ],
	glow: [ { spread: '4px', color: colourCss( 'primary', 35 ) } ],
};

export const stateOf = ( look: Look, k: 'hover' | 'press' ): StateLook =>
	( k === 'hover' ? look.hoverX : look.pressX ) ?? STATE_PRESETS[ k ][ k === 'hover' ? look.hover : look.press ] ?? {};

// ── write ───────────────────────────────────────────────────────────────────

/** Every control the look writes. Re-writing clears the ones a look no longer sets. */
export const OWNED = [
	'colors.background', 'colors.text', 'background.layers', 'border.width', 'border.style', 'border.color', 'border.radius',
	'spacing.padding', 'spacing.margin', 'effects.boxShadow', 'effects.outline', 'effects.outlineOffset', 'effects.transform', 'effects.filter', 'effects.backdropFilter',
	'effects.transition', 'effects.textShadow', 'effects.opacity', 'typography.fontFamily', 'typography.fontSize', 'typography.lineHeight', 'typography.fontWeight', 'colors.clipText',
	'typography.fontStyle', 'typography.letterSpacing', 'typography.textTransform', 'typography.textDecoration',
] as const;

const OWNED_SLOTS = [ 'default', 'group', 'groupActive', 'hover', 'active', 'focus' ];

/**
 * Opacity is owned only by a look that reveals (Appear, Slide in). Owning it always would let the
 * first edit here wipe an opacity set from the full inspector, and make every such tree read as
 * stale — so it is in play only while the look, before or after the edit, hides the block at rest.
 */
const REVEAL_ONLY = 'effects.opacity';
const reveals = ( look: Look | undefined ): boolean => !! look && !! stateOf( { ...EMPTY_LOOK, ...look }, 'hover' ).show;

type Values = Record< string, Record< string, unknown > >;

/** The engine values a look stands for, per slot (base breakpoint). */
export function lookValues( look: Look, opts: { linked?: boolean; kind?: string } = {} ): Values {
	const v: Values = { default: {}, group: {}, groupActive: {}, hover: {}, active: {}, focus: {} };
	const d = v.default;
	const divider = opts.kind === 'divider';

	// Fill, picture, finish
	const layers: any[] = [];
	if ( ! divider ) {
		if ( look.finish === 'gloss' && finishOf( look ).k > 0 ) {
			const { k } = finishOf( look );
			layers.push( { type: 'gradient', role: 'finish', value: { type: 'linear', angle: '180deg', stops: [ { color: `rgb(255 255 255 / ${ pct( 42 * k ) })`, position: '0%' }, { color: `rgb(255 255 255 / ${ pct( 12 * k ) })`, position: '50%' }, { color: 'rgb(255 255 255 / 0%)', position: '50%' } ] } } );
		}
		if ( look.img && look.dim ) layers.push( { type: 'tint', role: 'dim', color: '#000000', opacity: DIM_OPACITY[ look.dim ] } );
		if ( look.img ) {
			layers.push( {
				type: 'image', role: 'picture', url: look.img,
				size: look.ifit === 'tile' ? '160px auto' : look.ifit, position: look.ipos,
				repeat: look.ifit === 'tile' ? 'repeat' : 'no-repeat', ...( look.ifixed ? { attachment: 'fixed' } : {} ),
			} );
		}
		if ( isGrad( look.fill ) ) {
			if ( ! look.fill.layers && look.fill.preset && isToken( 'gradient', look.fill.preset ) ) layers.push( { type: 'gradient', role: 'fill', value: look.fill.preset } );
			else layers.push( ...gradLayers( look.fill ).map( ( l ) => ( { type: 'gradient', role: 'fill', value: gradientValue( l ) } ) ) );
		}
	}
	if ( layers.length ) d[ 'background.layers' ] = layers;

	const flat = typeof look.fill === 'string' ? look.fill : '';
	if ( divider && look.dline !== 'solid' ) {
		// A dashed or dotted line is a top border on an otherwise empty rule.
		d[ 'border.width' ] = { top: look.dline === 'double' ? '3px' : '2px', right: '0', bottom: '0', left: '0' };
		d[ 'border.style' ] = { top: look.dline, right: 'none', bottom: 'none', left: 'none' };
		d[ 'border.color' ] = four( colourCss( flat || 'border' ) );
	} else if ( look.finish === 'glass' ) {
		// Strength is the frost: how much of the fill colour the glass holds.
		const { k, blur } = finishOf( look );
		d[ 'colors.background' ] = flat ? `color-mix(in srgb, ${ colourCss( flat ) } ${ pct( 35 * k ) }, transparent)` : `rgb(255 255 255 / ${ pct( 20 * k ) })`;
		d[ 'effects.backdropFilter' ] = { ...( blur > 0 ? { blur: `${ blur }px` } : {} ), saturate: '1.6' };
	} else if ( flat ) {
		d[ 'colors.background' ] = flat;
	}
	if ( divider ) {
		// Space above and below, and auto margins to place a short line.
		const [ l, r ] = { start: [ '0', 'auto' ], center: [ 'auto', 'auto' ], end: [ 'auto', '0' ] }[ look.dalign ];
		if ( look.out || look.dalign !== 'start' ) d[ 'spacing.margin' ] = { top: px( look.out?.[ 0 ] ?? 0 ), right: r, bottom: px( look.out?.[ 2 ] ?? 0 ), left: l };
		if ( look.radius === 'full' ) d[ 'border.radius' ] = corners( [ 'full', 'full', 'full', 'full' ] );
		return v;
	}

	const text = look.text || readableText( look );
	if ( text ) d[ 'colors.text' ] = text;

	// Border
	const bd = borderSpec( look.border );
	if ( bd ) {
		const w = `${ bd.w }px`;
		const on = { all: [ 1, 1, 1, 1 ], bottom: [ 0, 0, 1, 0 ], tb: [ 1, 0, 1, 0 ], left: [ 0, 0, 0, 1 ] }[ bd.sides ];
		const [ t, r, b, l ] = on.map( ( x ) => ( x ? w : '0' ) );
		d[ 'border.width' ] = { top: t, right: r, bottom: b, left: l };
		d[ 'border.style' ] = four( bd.style );
		d[ 'border.color' ] = four( colourCss( look.bcol || 'foreground' ) );
	}

	// Space
	if ( typeof look.pad === 'string' && look.pad ) {
		d[ 'spacing.padding' ] = BADGE_PADS[ look.pad ] ? ( ( p ) => ( { top: px( p[ 0 ] ), right: px( p[ 1 ] ), bottom: px( p[ 2 ] ), left: px( p[ 3 ] ) } ) )( BADGE_PADS[ look.pad ] ) : four( look.pad );
	} else if ( Array.isArray( look.pad ) ) {
		d[ 'spacing.padding' ] = { top: px( look.pad[ 0 ] ), right: px( look.pad[ 1 ] ), bottom: px( look.pad[ 2 ] ), left: px( look.pad[ 3 ] ) };
	}
	if ( look.out ) d[ 'spacing.margin' ] = { top: px( look.out[ 0 ] ), right: px( look.out[ 1 ] ), bottom: px( look.out[ 2 ] ), left: px( look.out[ 3 ] ) };

	// Corners
	if ( typeof look.radius === 'string' && look.radius ) d[ 'border.radius' ] = corners( [ look.radius, look.radius, look.radius, look.radius ] );
	else if ( typeof look.radius === 'object' && 'sketch' in look.radius ) d[ 'border.radius' ] = corners( SKETCH );
	else if ( typeof look.radius === 'object' ) d[ 'border.radius' ] = corners( look.radius.c.map( ( n ) => `${ n }px` ) );

	// Shadows, tilt
	const shadows = baseShadows( look );
	if ( shadows.length ) d[ 'effects.boxShadow' ] = shadows;
	if ( look.tilt ) d[ 'effects.transform' ] = { rotate: `${ look.tilt }deg` };

	// Text
	if ( look.font ) d[ 'typography.fontFamily' ] = FONTS[ look.font ]?.[ 1 ] ?? look.font;
	if ( look.fsize !== '' ) d[ 'typography.fontSize' ] = typeof look.fsize === 'number' ? `${ look.fsize }px` : look.fsize;
	if ( look.lh ) d[ 'typography.lineHeight' ] = look.lh;
	// Gradient letters: the fill's layers, clipped to the text, which is then left without a colour.
	if ( look.clip && isGrad( look.fill ) ) {
		d[ 'colors.clipText' ] = 'text';
		delete d[ 'colors.text' ];
	}
	if ( look.weight ) d[ 'typography.fontWeight' ] = look.weight;
	if ( look.italic ) d[ 'typography.fontStyle' ] = 'italic';
	if ( look.track !== '' ) d[ 'typography.letterSpacing' ] = `${ look.track }em`;
	if ( look.tcase ) d[ 'typography.textTransform' ] = look.tcase;
	if ( look.deco ) d[ 'typography.textDecoration' ] = look.deco;
	if ( look.tsh ) {
		d[ 'effects.textShadow' ] = {
			soft: { x: '0px', y: '1px', blur: '2px', color: 'rgb(0 0 0 / 30%)' },
			lift: { x: '0px', y: '3px', blur: '8px', color: 'rgb(0 0 0 / 35%)' },
			glow: { x: '0px', y: '0.01px', blur: '12px', color: 'currentColor' },
			retro: { x: '2px', y: '2px', blur: '0px', color: 'color-mix(in srgb, currentColor 45%, #000)' },
		}[ look.tsh ];
	}

	// States
	const depth = look.depth ? ( look.depthX.n ?? DEPTH_N[ look.depth ] ) : 0;
	const writeState = ( slot: 'hover' | 'group' | 'active' | 'groupActive', c: StateLook, extraMove: string[] ) => {
		const out = v[ slot ];
		const transform: Record< string, string > = {};
		if ( c.show ) {
			d[ 'effects.opacity' ] = '0';
			out[ 'effects.opacity' ] = '1';
		}
		if ( c.from ) {
			d[ 'effects.transform' ] = { ...( d[ 'effects.transform' ] as Record< string, string > | undefined ), translateX: `${ c.from }px` };
			transform.translateX = '0px';
		}
		const move = [ ...extraMove, ...( c.move ? [ `${ c.move }px` ] : [] ) ];
		if ( move.length ) transform.translateY = move.length > 1 ? `calc(${ move.join( ' + ' ) })` : move[ 0 ];
		if ( c.scale && c.scale !== 100 ) transform.scale = String( c.scale / 100 );
		const tilt = look.tilt + ( c.tilt ?? 0 );
		if ( Object.keys( transform ).length || c.tilt ) {
			if ( tilt ) transform.rotate = `${ tilt }deg`;
			out[ 'effects.transform' ] = transform;
		}
		const hb = slot !== 'active' && slot !== 'groupActive' && look.depth ? ( look.depthX.hover === 'stay' ? depth : look.depthX.hover === 'settle' ? ( look.depth === 'edge' ? Math.round( depth / 2 ) : 0 ) : depth + 2 ) : undefined;
		if ( c.shadow || hb !== undefined || c.push ) {
			const base = baseShadows( look, c.push ? 0 : hb );
			const list = [ ...base.filter( ( l ) => ! ( c.shadow && l.role === 'shadow' ) && ! ( c.push && l.role === 'depth' ) ), ...( c.shadow ? STATE_SHADOW[ c.shadow ] : [] ) ];
			// An emptied state still has to say so: an empty list writes nothing, and the base
			// shadow (the depth being pushed into) would stay on screen.
			out[ 'effects.boxShadow' ] = list.length ? list : [ { token: 'none' } ];
		}
		if ( c.fill ) out[ 'colors.background' ] = c.fill;
		const t = c.text || ( c.fill ? readableText( { fill: c.fill, img: '' } ) : '' );
		if ( t ) out[ 'colors.text' ] = t;
		if ( c.bcol && bd ) out[ 'border.color' ] = four( colourCss( c.bcol ) );
		if ( c.bright && c.bright !== 100 ) out[ 'effects.filter' ] = `brightness(${ c.bright / 100 })`;
	};

	const hover = stateOf( look, 'hover' );
	const depthLift = look.depth && ( look.depthX.hover ?? 'lift' ) === 'lift' ? [ '-2px' ] : [];
	if ( Object.keys( hover ).length || look.depth ) writeState( look.hoverFrom === 'card' ? 'group' : 'hover', hover, depthLift );
	// A card press plays on any block in the card; the block's own press only on one people click.
	const press = stateOf( look, 'press' );
	if ( Object.keys( press ).length && look.pressFrom === 'card' ) writeState( 'groupActive', press, press.push ? [ `${ depth || 2 }px` ] : [] );
	if ( opts.linked ) {
		if ( Object.keys( press ).length && look.pressFrom !== 'card' ) writeState( 'active', press, press.push ? [ `${ depth || 2 }px` ] : [] );
		if ( look.focus === 'outline' ) {
			// A drawn line outside the border: dashed rings and the like, without touching the shadow.
			const o = { ...FOCUS_OUTLINE, ...look.focusOl };
			v.focus[ 'effects.outline' ] = { width: `${ o.w }px`, style: o.line, color: o.col };
			v.focus[ 'effects.outlineOffset' ] = `${ o.off }px`;
		} else if ( look.focus ) v.focus[ 'effects.boxShadow' ] = [ ...FOCUS_SHADOW[ look.focus ], ...baseShadows( look ) ];
	}
	if ( [ v.group, v.groupActive, v.hover, v.active, v.focus ].some( ( slot ) => Object.keys( slot! ).length ) ) {
		const ms = SPEEDS[ look.speed ];
		const ease = FEELS[ look.feel ];
		d[ 'effects.transition' ] = [ 'background-color', 'color', 'border-color', 'box-shadow', 'transform', 'filter', ...( d[ 'effects.opacity' ] !== undefined ? [ 'opacity' ] : [] ) ].map( ( p ) => `${ p } ${ ms }ms ${ ease }` ).join( ', ' );
	}
	return v;
}

/** Write a look: every owned control is replaced (base breakpoint of the four slots it uses). */
export function writeStyle( tree: Tree, look: Look, opts: { linked?: boolean; kind?: string } = {} ): Tree {
	const values = lookValues( look, opts );
	// Only what this edit changes is written. A tree another tool wrote (the MCP, a pattern) reads
	// back as a partial look; rewriting every owned value from it would erase the rest — a rotation,
	// a hover, a layered shadow — on the first click.
	const before = lookValues( readStyle( tree, opts ).look, opts );
	const next: Tree = { ...tree };
	const revealing = reveals( look ) || reveals( tree?.[ META ] as Look | undefined );
	for ( const id of OWNED ) {
		if ( id === REVEAL_ONLY && ! revealing ) continue;
		const control = { ...( next[ id ] ?? {} ) };
		for ( const slot of OWNED_SLOTS ) {
			const value = values[ slot ]?.[ id ];
			if ( same( value, before[ slot ]?.[ id ] ) ) continue;
			const bySlot = { ...( control[ slot ] ?? {} ) };
			if ( value === undefined ) delete bySlot.base;
			else bySlot.base = value;
			if ( Object.keys( bySlot ).length ) control[ slot ] = bySlot;
			else delete control[ slot ];
		}
		if ( Object.keys( control ).length ) next[ id ] = control;
		else delete next[ id ];
	}
	next[ META ] = look;
	return next;
}

// ── read ────────────────────────────────────────────────────────────────────

const same = ( a: unknown, b: unknown ) => JSON.stringify( a ?? null ) === JSON.stringify( b ?? null );

/** Read the look back. Trusts the stored copy only while it still reproduces every owned value. */
/**
 * Does this block turn in 3D — a rotation about X or Y in any state? Only then does its back face
 * ever show, so only then is "hide its back" worth offering.
 */
export function turnsIn3d( tree: Tree ): boolean {
	if ( tree?.[ 'effects.backfaceVisibility' ] ) return true;
	const byState = tree?.[ 'effects.transform' ];
	if ( ! byState || typeof byState !== 'object' ) return false;
	return Object.values( byState ).some( ( byBp ) => Object.values( ( byBp ?? {} ) as Record< string, unknown > ).some( ( value ) => {
		if ( typeof value === 'string' ) return /rotate(X|Y|3d)\(/i.test( value );
		const t = value as Record< string, unknown > | null;
		return !! t && [ 'rotateX', 'rotateY' ].some( ( k ) => t[ k ] !== undefined && t[ k ] !== '' && t[ k ] !== '0deg' );
	} ) );
}

export function readStyle( tree: Tree, opts: { linked?: boolean; kind?: string } = {} ): { look: Look; stale: boolean } {
	const stored = tree?.[ META ] as Look | undefined;
	if ( stored ) {
		const look = { ...EMPTY_LOOK, ...stored };
		const values = lookValues( look, opts );
		const matches = OWNED.filter( ( id ) => id !== REVEAL_ONLY || reveals( look ) ).every( ( id ) => OWNED_SLOTS.every( ( slot ) => same( tree?.[ id ]?.[ slot ]?.base, values[ slot ]?.[ id ] ) ) );
		if ( matches ) return { look, stale: false };
	}
	// Something else wrote these values: take what maps onto the quick choices.
	const base = ( id: string ) => tree?.[ id ]?.default?.base;
	const look: Look = { ...EMPTY_LOOK };
	const bg = base( 'colors.background' );
	if ( typeof bg === 'string' ) look.fill = bg;
	const tx = base( 'colors.text' );
	if ( typeof tx === 'string' && tx !== readableText( look ) ) look.text = tx;
	const r = base( 'border.radius' );
	if ( r && typeof r === 'object' && new Set( Object.values( r ) ).size === 1 ) look.radius = String( r.topLeft );
	const p = base( 'spacing.padding' );
	if ( p && typeof p === 'object' && new Set( Object.values( p ) ).size === 1 ) look.pad = String( p.top );
	const sh = base( 'effects.boxShadow' );
	if ( typeof sh === 'string' ) look.shadow = sh as Shadow;
	// Type set by the rail inspector or a layout tool: keep it, so the first edit here does not wipe it.
	const str = ( id: string ) => ( typeof base( id ) === 'string' || typeof base( id ) === 'number' ? String( base( id ) ) : '' );
	const fs = str( 'typography.fontSize' );
	if ( fs ) look.fsize = /^\d+(\.\d+)?px$/.test( fs ) ? Number( fs.slice( 0, -2 ) ) : fs;
	look.lh = str( 'typography.lineHeight' );
	look.weight = str( 'typography.fontWeight' );
	const ff = str( 'typography.fontFamily' );
	if ( ff ) look.font = Object.entries( FONTS ).find( ( [ , [ , f ] ] ) => f === ff )?.[ 0 ] ?? ff;
	look.italic = base( 'typography.fontStyle' ) === 'italic';
	const tr = str( 'typography.letterSpacing' );
	if ( /^-?\d*\.?\d+em$/.test( tr ) ) look.track = Number( tr.slice( 0, -2 ) );
	const tc = str( 'typography.textTransform' );
	if ( [ 'uppercase', 'lowercase', 'capitalize' ].includes( tc ) ) look.tcase = tc as Look[ 'tcase' ];
	const td = str( 'typography.textDecoration' );
	if ( [ 'underline', 'line-through' ].includes( td ) ) look.deco = td as Look[ 'deco' ];
	return { look, stale: !! stored };
}
