import { isToken } from '@/design-system/tokens';

/**
 * The single Blicks style engine — turns the `blicks` value tree into the **class list + inline
 * CSS vars** an element carries, plus any **scoped per-instance CSS** (pseudo-elements, container
 * queries, `@property`, keyframes). Driven by one declarative STYLE_MAP table.
 *
 * Tier 1/2 emission: the property/media-query/state rules live in the static runtime stylesheet
 * (resources/runtime/runtime.scss); here we only emit which consumer/marker classes apply and the
 * per-instance var values. Tier 3 (scoped) is emitted as `.bl-{uniqueId}{…}` strings collected and
 * printed once per page.
 *
 * No per-block `<style>` for tier 1/2 and no per-request CSS generation — just a cheap value→var
 * mapping that works identically in `edit()` (live preview), `save()` (static blocks) and PHP
 * render (dynamic). Naming MUST stay in sync with resources/runtime/runtime.scss and the PHP mirror
 * (src/Style/ElementStyle.php).
 */

// state → marker/var key (default has no key)
const STATE_KEY: Record< string, string > = {
	default: '',
	hover: 'hov',
	focus: 'foc',
	active: 'act',
};

// breakpoint id → marker/var key (base has no key)
const BP_KEY: Record< string, string > = {
	base: '',
	tablet: 'tab',
	mobile: 'mob',
};

const SIDES: Array< [ 'top' | 'right' | 'bottom' | 'left', string ] > = [
	[ 'top', 't' ],
	[ 'right', 'r' ],
	[ 'bottom', 'b' ],
	[ 'left', 'l' ],
];

const CORNERS: Array< [ 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', string ] > = [
	[ 'topLeft', 'tl' ],
	[ 'topRight', 'tr' ],
	[ 'bottomRight', 'br' ],
	[ 'bottomLeft', 'bl' ],
];

/**
 * A scoped emit descriptor — the WA mechanisms. Present only on rules that need a real selector
 * (pseudo-elements / child / at-rule) or a global registration, which a class+inline-var can't do.
 */
interface ScopedSpec {
	/** CSS property the scoped rule sets (e.g. `content`, `animation-name`). */
	prop?: string;
	/** Sub-selector appended to `.bl-{uniqueId}` (e.g. `::after`, `> * + *`). */
	selectorSuffix?: string;
	/** Wrap the scoped rule in an at-rule. */
	atRule?: { type: 'container' | 'media'; query: string };
	/** Register the rule's var with `@property` so browsers can interpolate it. */
	registerProperty?: { syntax: string; initialValue: string; inherits: boolean };
	/** Named runtime keyframes referenced as this rule's value. */
	keyframes?: string;
}

/**
 * One control's emission rule. `kind` selects how the value tree expands:
 *  - `sides`   → four logical-box sides `t/r/b/l`, var `--bl-{v}{side}{suf}` (e.g. `--bl-pt`).
 *  - `inset`   → four sides but DASHED, var `--bl-{v}-{side}{suf}` (e.g. `--bl-pos-t`).
 *  - `corners` → four corners `tl/tr/br/bl`, var `--bl-{v}{corner}{suf}` (e.g. `--bl-brtl`).
 *  - `single`  → one var; `v` is the full var name (e.g. `--bl-bg`); value via builder/category.
 *  - `enum`    → library preset; emits ONLY the class `bl-{cls}--{value}` (no inline var). The
 *                value is a fixed slug (e.g. a type role); the look lives in a global class in
 *                runtime.scss. Base/default slot only. `v` is unused ('').
 */
export interface StyleMapRule extends ScopedSpec {
	attr: string;
	cls: string;
	kind: 'sides' | 'inset' | 'corners' | 'single' | 'enum';
	/** Var letter (`p`, `bw`, `pos`, `br`) for sides/inset/corners; full var (`--bl-bg`) for single. */
	v: string;
	/** Token / builder category. sides/inset use `spacing`; corners use `radius`. */
	category?: string;
	/**
	 * Second category checked (sides/inset/corners path only) when a slug isn't found in `category`
	 * — lets a rule's token category change without breaking values saved under the old one (e.g.
	 * `border.width` moved from `spacing` to a dedicated `borderWidth` scale; old saved `spacing`
	 * slugs still resolve).
	 */
	fallbackCategory?: string;
	/**
	 * sides/corners only: the value is a keyword or colour, not a length. Skips the length
	 * normaliser (no bare-number → `px`) and resolves token slugs through the same category lookup
	 * the `single` path uses.
	 */
	raw?: boolean;
	/** sides/corners only: what an unset side emits. Defaults to `0` (the length case). */
	emptyValue?: string;
}

const LAYOUT_SINGLES: Array< [ string, string, string, string? ] > = [
	// [attr, cls, var, category?]
	[ 'layout.display', 'd', '--bl-d' ],
	[ 'layout.flexDirection', 'fd', '--bl-fd' ],
	[ 'layout.justifyContent', 'jc', '--bl-jc' ],
	[ 'layout.alignItems', 'ai', '--bl-ai' ],
	[ 'layout.flexWrap', 'fw', '--bl-fw' ],
	[ 'layout.gapRow', 'gap-r', '--bl-gap-r', 'spacing' ],
	[ 'layout.gapColumn', 'gap-c', '--bl-gap-c', 'spacing' ],
	[ 'layout.gridColumns', 'cols', '--bl-cols' ],
	[ 'layout.gridRows', 'rows', '--bl-rows' ],
	[ 'layout.justifyItems', 'ji', '--bl-ji' ],
	[ 'layout.width', 'w', '--bl-w', 'width' ],
	[ 'layout.height', 'h', '--bl-h', 'width' ],
	[ 'layout.overflow', 'ov', '--bl-ov' ],
	// Wave B — layout extensions
	[ 'layout.overflowX',      'ovx',   '--bl-ovx'   ],
	[ 'layout.overflowY',      'ovy',   '--bl-ovy'    ],
	[ 'layout.scrollSnapType', 'sst',   '--bl-sst'    ],
	[ 'layout.gridAreas',      'areas', '--bl-areas'  ],
	[ 'layout.gridAutoFlow',   'gaf',   '--bl-gaf'    ],
	[ 'layout.containerType',  'ct',    '--bl-ct'     ],
	[ 'layout.containerName',  'cn',    '--bl-cn'     ],
	[ 'layout.aspectRatio',    'ar',    '--bl-ar',     'aspect' ],
	[ 'layout.objectFit',      'of',    '--bl-of'     ],
	// Wave G — layout completeness (align-content, grid auto tracks, box sizing, box behavior,
	// scroll extras, direction)
	[ 'layout.alignContent',        'ac',   '--bl-ac'   ],
	[ 'layout.gridAutoColumns',     'gac',  '--bl-gac'  ],
	[ 'layout.gridAutoRows',        'gar',  '--bl-gar'  ],
	[ 'layout.minWidth',            'miw',  '--bl-miw', 'width' ],
	[ 'layout.maxWidth',            'maw',  '--bl-maw', 'width' ],
	[ 'layout.minHeight',           'mih',  '--bl-mih', 'width' ],
	[ 'layout.maxHeight',           'mah',  '--bl-mah', 'width' ],
	[ 'layout.boxSizing',           'bxz',  '--bl-bxz'  ],
	[ 'layout.visibility',          'vis',  '--bl-vis'  ],
	[ 'layout.float',               'flt2', '--bl-flt2' ],
	[ 'layout.clear',               'clr',  '--bl-clr'  ],
	[ 'layout.isolation',           'iso',  '--bl-iso'  ],
	[ 'layout.resize',              'rsz',  '--bl-rsz'  ],
	[ 'layout.scrollBehavior',      'sb',   '--bl-sb'   ],
	[ 'layout.overscrollBehavior',  'osb',  '--bl-osb'  ],
	[ 'layout.scrollSnapStop',      'sss',  '--bl-sss'  ],
	[ 'layout.direction',           'dir',  '--bl-dir'  ],
	// Wave H — containment/perf + truncation (high real-world usage: CSS Containment,
	// content-visibility offscreen-skip, and the -webkit-line-clamp truncation hack).
	[ 'layout.contain',              'ctn', '--bl-ctn' ],
	[ 'layout.contentVisibility',    'cv',  '--bl-cv'  ],
	[ 'layout.containIntrinsicSize', 'cis', '--bl-cis' ],
	// `lc`'s runtime.scss rule bundles 3 fixed companion declarations (display/box-orient/
	// overflow) alongside the var-driven line count — see the dedicated Line-clamp block there.
	[ 'layout.lineClamp',            'lc',  '--bl-lc'  ],
];

const SINGLES: Array< [ string, string, string, string? ] > = [
	...LAYOUT_SINGLES,
	// NB: `border.style` / `border.color` are NOT here — they're `sides` rules in STYLE_MAP below.
	[ 'position.type', 'pos', '--bl-pos' ],
	[ 'position.zIndex', 'zi', '--bl-zi', 'zIndex' ],
	[ 'colors.background', 'bg', '--bl-bg', 'color' ],
	[ 'colors.text', 'tx', '--bl-tx', 'color' ],
	[ 'background.image', 'bg-img', '--bl-bg-img', 'image' ],
	[ 'background.gradient', 'bg-grad', '--bl-bg-grad', 'gradient' ],
	[ 'background.size', 'bg-size', '--bl-bg-size' ],
	[ 'background.position', 'bg-pos', '--bl-bg-pos' ],
	[ 'background.repeat', 'bg-repeat', '--bl-bg-repeat' ],
	[ 'background.attachment', 'bg-attach', '--bl-bg-attach' ],
	// Wave C — color/background extensions
	[ 'background.blendMode', 'bg-blend', '--bl-bg-blend' ],
	[ 'colors.clipText',      'cliptext', '--bl-cliptext' ],
	[ 'typography.fontFamily', 'ff', '--bl-ff', 'fontFamily' ],
	[ 'typography.fontSize', 'fs', '--bl-fs', 'fontSize' ],
	[ 'typography.lineHeight', 'lh', '--bl-lh', 'leading' ],
	[ 'typography.fontWeight', 'fwt', '--bl-fwt' ],
	[ 'typography.fontStyle', 'fst', '--bl-fst' ],
	[ 'typography.letterSpacing', 'ls', '--bl-ls' ],
	[ 'typography.wordSpacing', 'ws', '--bl-ws' ],
	[ 'typography.textTransform', 'tt', '--bl-tt' ],
	[ 'typography.textDecoration', 'td', '--bl-td' ],
	[ 'typography.textAlign', 'ta', '--bl-ta' ],
	// Wave C — typography extensions
	[ 'typography.writingMode',     'wm', '--bl-wm' ],
	[ 'typography.textOrientation', 'to', '--bl-to' ],
	[ 'effects.opacity', 'op', '--bl-op', 'opacity' ],
	[ 'effects.cursor', 'cur', '--bl-cur' ],
	[ 'effects.blendMode', 'bm', '--bl-bm' ],
	[ 'effects.boxShadow', 'bsh', '--bl-bsh', 'boxShadow' ],
	[ 'effects.textShadow', 'tsh', '--bl-tsh', 'textShadow' ],
	[ 'effects.transition', 'tr', '--bl-tr', 'transition' ],
	[ 'effects.transform', 'tfm', '--bl-tfm', 'transform' ],
	[ 'effects.filter', 'flt', '--bl-flt', 'filter' ],
	// Wave D — effects extensions
	[ 'effects.clipPath',        'clip', '--bl-clip', 'clipPath'       ],
	[ 'effects.backdropFilter',  'bdf',  '--bl-bdf',  'backdropFilter' ],
	[ 'effects.mask',            'mask', '--bl-mask', 'mask'           ],
	[ 'effects.transformOrigin', 'tfo',  '--bl-tfo'   ],
	[ 'effects.transformStyle',  'tfs',  '--bl-tfs'   ],
	[ 'effects.perspective',     'psp',  '--bl-psp'   ],
	// Wave E — animation section
	[ 'animation.name',        'anim-name',  '--bl-anim-name'  ],
	[ 'animation.duration',    'anim-dur',   '--bl-anim-dur'   ],
	[ 'animation.easing',      'anim-ease',  '--bl-anim-ease'  ],
	[ 'animation.iteration',   'anim-iter',  '--bl-anim-iter'  ],
	[ 'animation.direction',   'anim-dir',   '--bl-anim-dir'   ],
	[ 'animation.fillMode',    'anim-fill',  '--bl-anim-fill'  ],
	[ 'animation.delay',       'anim-delay', '--bl-anim-delay' ],
	[ 'animation.timeline',    'anim-tl',    '--bl-anim-tl'    ],
	[ 'animation.range',       'anim-range', '--bl-anim-range' ],
	[ 'animation.targetAngle', 'anim-ang',   '--bl-ang'        ],
	[ 'animation.target',      'anim-p',     '--bl-p-target'   ],
	// Wave F — counters (parent-side reset, child-side increment)
	[ 'decoration.counterReset',     'cnt-r', '--bl-cnt-r' ],
	[ 'decoration.counterIncrement', 'cnt-i', '--bl-cnt-i' ],
	[ 'gridChild.columnSpan', 'gcs', '--bl-gcs' ],
	[ 'gridChild.rowSpan', 'grs', '--bl-grs' ],
	[ 'gridChild.alignSelf', 'gas', '--bl-gas' ],
	[ 'gridChild.justifySelf', 'gjs', '--bl-gjs' ],
	[ 'gridChild.order', 'go', '--bl-go' ],
	// Wave B — grid-child extensions
	[ 'gridChild.gridArea',        'ga',  '--bl-ga'  ],
	[ 'gridChild.scrollSnapAlign', 'ssa', '--bl-ssa' ],
	// Wave B — columns section
	[ 'columns.columnCount', 'cc',   '--bl-cc'   ],
	[ 'columns.columnWidth', 'cw',   '--bl-cw',   'width' ],
	[ 'columns.columnGap',   'cgap', '--bl-cgap', 'spacing' ],
	// Wave G — flex-child (the flexbox parallel to gridChild)
	[ 'flexChild.grow',      'fg',  '--bl-fg'  ],
	[ 'flexChild.shrink',    'fsk', '--bl-fsk' ],
	[ 'flexChild.basis',     'fb',  '--bl-fb',  'width' ],
	[ 'flexChild.alignSelf', 'fas', '--bl-fas' ],
	[ 'flexChild.order',     'fco', '--bl-fco' ],
];

/**
 * The single source of truth for attribute → CSS emission. Order matters only for the rare exact-
 * array class assertions (expanded boxes first, then singles). Future advanced capabilities (Waves
 * B–F) add rows here — including scoped ones via the ScopedSpec fields.
 */
export const STYLE_MAP: StyleMapRule[] = [
	{ attr: 'spacing.padding', cls: 'pad', kind: 'sides', v: 'p', category: 'spacing' },
	{ attr: 'spacing.margin', cls: 'mar', kind: 'sides', v: 'm', category: 'spacing' },
	{ attr: 'border.width', cls: 'bw', kind: 'sides', v: 'bw', category: 'borderWidth', fallbackCategory: 'spacing' },
	// Style/colour are per-side too (4-value `border-style` / `border-color` shorthands), so a red
	// top can sit over a grey bottom. `raw: true` keeps the length normaliser away from them: an
	// unset side must fall back to the property's own initial value, not `0`, and `2` must not
	// become `2px`.
	{ attr: 'border.style', cls: 'bs', kind: 'sides', v: 'bs', raw: true, emptyValue: 'none' },
	{ attr: 'border.color', cls: 'bc', kind: 'sides', v: 'bc', category: 'color', raw: true, emptyValue: 'currentcolor' },
	{ attr: 'border.radius', cls: 'br', kind: 'corners', v: 'br', category: 'radius' },
	{ attr: 'position.inset', cls: 'inset', kind: 'inset', v: 'pos', category: 'spacing' },
	// Library preset: a picked type role → global class `bl-type--{role}` (runtime.scss). No var.
	{ attr: 'typography.role', cls: 'type', kind: 'enum', v: '' },
	...SINGLES.map(
		( [ attr, cls, v, category ] ): StyleMapRule => ( { attr, cls, kind: 'single', v, category } )
	),
	// Wave B: columns break-inside emits a child selector rule, not a class+var on the element.
	{ attr: 'columns.breakInside', cls: 'cbi', kind: 'single', v: '--bl-cbi', prop: 'break-inside', selectorSuffix: ' > *' },
	// Wave F: pseudo-element decoration — builder returns the full body, no `prop`.
	{ attr: 'decoration.before', cls: 'deco-b', kind: 'single', v: '--bl-deco-b', category: 'decoration', selectorSuffix: '::before' },
	{ attr: 'decoration.after',  cls: 'deco-a', kind: 'single', v: '--bl-deco-a', category: 'decoration', selectorSuffix: '::after' },
];

/**
 * Non-length side value (`raw` rules): a keyword (`solid`) or colour passes through, a token slug
 * resolves against the rule's category, and an unset side falls back to the property's own initial
 * value — `border-style: 0` would invalidate the whole shorthand.
 */
function rawOrToken( category: string | undefined, v: unknown, empty: string ): string {
	const s = String( v ?? '' ).trim();
	if ( s === '' ) return empty;
	if ( category && isToken( category as any, s ) ) {
		return `var(--blicks-${ category }-${ s })`;
	}
	return s;
}

/**
 * A `sides`/`corners` control whose stored value is a bare string means "the same on every side".
 * That is how `border.style` / `border.color` were stored before they became per-side, so this is
 * what keeps already-saved content rendering identically.
 */
function expandSideValue( value: unknown, keys: Array< [ string, string ] > ): any {
	if ( typeof value !== 'string' ) return value;
	const spread: Record< string, string > = {};
	for ( const [ prop ] of keys ) spread[ prop ] = value;
	return spread;
}

/** Normalise a length or resolve a spacing/radius token (sides/inset/corners path). */
function valOrToken( category: string, v: unknown, fallbackCategory?: string ): string {
	const s = String( v ?? '' ).trim();
	if ( s === '' ) return '0';
	// A bare number is a literal length, NEVER a token slug. Critically, "0" must stay "0" — the
	// slug list contains "0" but no `--blicks-spacing-0` var is emitted, so token-wrapping it yields
	// an empty value that invalidates the whole `padding`/`margin` shorthand (dropping ALL sides).
	if ( /^-?\d*\.?\d+$/.test( s ) ) return s === '0' ? '0' : `${ s }px`;
	if ( isToken( category as any, s ) ) {
		return `var(--blicks-${ category }-${ s })`;
	}
	if ( fallbackCategory && isToken( fallbackCategory as any, s ) ) {
		return `var(--blicks-${ fallbackCategory }-${ s })`;
	}
	return s;
}

export type CssValueBuilder = ( value: unknown ) => string;

function imageBuilder( v: unknown ): string {
	const url = typeof v === 'string' ? v : ( v as any )?.url;
	const clean = String( url ?? '' ).trim();
	if ( ! clean ) return '';
	return `url("${ clean.replace( /["\\]/g, '\\$&' ) }")`;
}

function boxShadowBuilder( v: unknown ): string {
	// A bare string is a shadow-token slug (`md`) → resolve to the alias var.
	if ( typeof v === 'string' ) {
		const slug = v.trim();
		return isToken( 'shadow', slug ) ? `var(--blicks-shadow-${ slug })` : '';
	}
	const s = v as any;
	if ( ! s || ( ! s.x && ! s.y ) ) return '';
	const inset = s.inset ? 'inset ' : '';
	return `${ inset }${ s.x || '0px' } ${ s.y || '0px' } ${ s.blur || '0px' } ${ s.spread || '0px' } ${ s.color || 'rgba(0,0,0,0.1)' }`;
}

function textShadowBuilder( v: unknown ): string {
	const s = v as any;
	if ( ! s || ( ! s.x && ! s.y ) ) return '';
	return `${ s.x || '0px' } ${ s.y || '0px' } ${ s.blur || '0px' } ${ s.color || 'rgba(0,0,0,0.1)' }`;
}

function gradientBuilder( v: unknown ): string {
	// A theme gradient preset is stored as a bare token slug (picked via the gradient token
	// library) — everything else is a custom stops object.
	if ( typeof v === 'string' ) {
		const slug = v.trim();
		if ( ! slug ) return '';
		return isToken( 'gradient', slug ) ? `var(--blicks-gradient-${ slug })` : slug;
	}
	const gradient = v as any;
	const rawType = String( gradient?.type ?? 'linear' );
	const type = rawType === 'radial' ? 'radial' : rawType === 'conic' ? 'conic' : 'linear';
	const rawStops = Array.isArray( gradient?.stops ) && gradient.stops.length >= 2
		? gradient.stops
		: [
			{ color: gradient?.from ?? '#6366f1', position: gradient?.fromPos ?? '0%' },
			{ color: gradient?.to ?? '#ec4899', position: gradient?.toPos ?? '100%' },
		];
	const stops = rawStops
		.map( ( stop: any, index: number ) => {
			const fallbackPosition = `${ Math.round( ( index / Math.max( rawStops.length - 1, 1 ) ) * 100 ) }%`;
			return `${ String( stop?.color ?? '#000000' ).trim() } ${ String( stop?.position ?? fallbackPosition ).trim() }`;
		} )
		.join( ', ' );
	const positionRaw = gradient?.position;
	const position = typeof positionRaw === 'string' && positionRaw.trim() !== '' ? positionRaw.trim() : '';
	if ( type === 'radial' ) {
		const shape = String( gradient?.shape ?? 'circle' ).trim() || 'circle';
		const head = position ? `${ shape } at ${ position }` : shape;
		return `radial-gradient(${ head }, ${ stops })`;
	}
	if ( type === 'conic' ) {
		const angle = String( gradient?.angle ?? '0deg' ).trim();
		const head = position ? `from ${ angle } at ${ position }` : `from ${ angle }`;
		return `conic-gradient(${ head }, ${ stops })`;
	}
	const angle = String( gradient?.angle ?? '90deg' ).trim();
	return `linear-gradient(${ angle }, ${ stops })`;
}

/** Wave D — clip-path preset → polygon/circle/ellipse/inset string. */
function clipPathBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) return v.trim();
	const c = v as any;
	const shape = String( c?.shape ?? '' ).trim();
	const amount = String( c?.amount ?? '20%' ).trim() || '20%';
	switch ( shape ) {
		case 'diagonal':
			return `polygon(0 0, 100% 0, 100% calc(100% - ${ amount }), 0 100%)`;
		case 'diagonal-reverse':
			return `polygon(0 ${ amount }, 100% 0, 100% 100%, 0 100%)`;
		case 'notch':
			return `polygon(0 0, 100% 0, 100% 100%, calc(50% + ${ amount }) 100%, 50% calc(100% - ${ amount }), calc(50% - ${ amount }) 100%, 0 100%)`;
		case 'chevron':
			return `polygon(0 0, 100% 0, calc(100% - ${ amount }) 50%, 100% 100%, 0 100%, ${ amount } 50%)`;
		case 'fold':
			return `polygon(0 0, calc(100% - ${ amount }) 0, 100% ${ amount }, 100% 100%, 0 100%)`;
		case 'circle':
			return `circle(${ amount } at center)`;
		case 'ellipse':
			return `ellipse(${ amount } ${ amount } at center)`;
		case 'inset':
			return `inset(${ amount })`;
		case 'custom':
			return String( c?.custom ?? '' ).trim();
		default:
			return '';
	}
}

/** Wave D — structured backdrop-filter: { blur, brightness, saturate }. */
function backdropFilterBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) return v.trim();
	const b = v as any;
	const parts: string[] = [];
	if ( b?.blur )       parts.push( `blur(${ String( b.blur ).trim() })` );
	if ( b?.brightness ) parts.push( `brightness(${ String( b.brightness ).trim() })` );
	if ( b?.saturate )   parts.push( `saturate(${ String( b.saturate ).trim() })` );
	if ( b?.contrast )   parts.push( `contrast(${ String( b.contrast ).trim() })` );
	return parts.join( ' ' );
}

/** Wave D — mask builder: edge-fade / radial gradients. */
function maskBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) return v.trim();
	const m = v as any;
	const kind = String( m?.kind ?? '' ).trim();
	const size = String( m?.size ?? '20%' ).trim() || '20%';
	if ( kind === 'edge-fade' ) {
		const side = String( m?.side ?? 'right' ).trim();
		const toward = side === 'right' ? 'left' : side === 'left' ? 'right' : side === 'top' ? 'bottom' : 'top';
		return `linear-gradient(to ${ toward }, transparent, black ${ size })`;
	}
	if ( kind === 'edge-fade-both' ) {
		const axis = String( m?.axis ?? 'x' ).trim();
		return axis === 'y'
			? `linear-gradient(to bottom, transparent, black ${ size }, black calc(100% - ${ size }), transparent)`
			: `linear-gradient(to right, transparent, black ${ size }, black calc(100% - ${ size }), transparent)`;
	}
	if ( kind === 'radial' ) {
		const position = String( m?.position ?? 'center' ).trim() || 'center';
		return `radial-gradient(circle at ${ position }, black ${ size }, transparent)`;
	}
	return '';
}

/**
 * Safely produce a CSS `content` value. Plain text is quoted+escaped (so a stray `"`/`'` can't
 * break out of the declaration and swallow the rest of the rule); CSS keywords, `counter()`/
 * `attr()`/`var()`/`env()`, and already-quoted strings pass through (re-escaped). Mirror in PHP.
 */
function normalizeContent( raw: unknown ): string {
	const s = String( raw ?? '' ).replace( /</g, '' ).trim();
	if ( s === '' ) return '""';
	if ( /^(none|normal|inherit|initial|unset|revert|open-quote|close-quote|no-open-quote|no-close-quote)$/i.test( s ) ) {
		return s;
	}
	if ( /^(counter|counters|attr|var|env)\(/i.test( s ) ) return s;
	const quoted =
		s.length >= 2 &&
		( ( s.startsWith( '"' ) && s.endsWith( '"' ) ) || ( s.startsWith( "'" ) && s.endsWith( "'" ) ) );
	const inner = quoted ? s.slice( 1, -1 ) : s;
	return '"' + inner.replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ) + '"';
}

/** Wave F — pseudo-element decoration: returns the full `key:val;…` body (no surrounding braces). */
function decorationBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) return v.trim();
	if ( ! v || typeof v !== 'object' ) return '';
	const d = v as any;
	if ( d.enabled === false ) return '';
	const parts: string[] = [];
	parts.push( `content:${ normalizeContent( d.content ) }` );
	// Pseudo-elements need positioning to behave like overlays/orbs.
	parts.push( `position:${ String( d.position || 'absolute' ).trim() }` );
	if ( d.background ) {
		const bg = typeof d.background === 'object' ? gradientBuilder( d.background ) : String( d.background ).trim();
		if ( bg ) parts.push( `background:${ bg }` );
	}
	if ( d.bgColor ) parts.push( `background-color:${ String( d.bgColor ).trim() }` );
	if ( d.width  ) parts.push( `width:${ String( d.width ).trim() }` );
	if ( d.height ) parts.push( `height:${ String( d.height ).trim() }` );
	if ( d.inset !== undefined ) {
		if ( typeof d.inset === 'object' && d.inset !== null ) {
			const i = d.inset;
			parts.push( `top:${ String( i.top ?? 'auto' ) }` );
			parts.push( `right:${ String( i.right ?? 'auto' ) }` );
			parts.push( `bottom:${ String( i.bottom ?? 'auto' ) }` );
			parts.push( `left:${ String( i.left ?? 'auto' ) }` );
		} else {
			parts.push( `inset:${ String( d.inset ).trim() }` );
		}
	}
	if ( d.borderRadius ) parts.push( `border-radius:${ String( d.borderRadius ).trim() }` );
	if ( d.border ) parts.push( `border:${ String( d.border ).trim() }` );
	if ( d.padding ) parts.push( `padding:${ String( d.padding ).trim() }` );
	// Text / centering props — let a pseudo-element act as a badge, label, or numbered marker.
	if ( d.display ) parts.push( `display:${ String( d.display ).trim() }` );
	if ( d.alignItems ) parts.push( `align-items:${ String( d.alignItems ).trim() }` );
	if ( d.justifyContent ) parts.push( `justify-content:${ String( d.justifyContent ).trim() }` );
	if ( d.color ) parts.push( `color:${ String( d.color ).trim() }` );
	if ( d.fontSize ) parts.push( `font-size:${ String( d.fontSize ).trim() }` );
	if ( d.fontWeight ) parts.push( `font-weight:${ String( d.fontWeight ).trim() }` );
	if ( d.lineHeight ) parts.push( `line-height:${ String( d.lineHeight ).trim() }` );
	if ( d.letterSpacing ) parts.push( `letter-spacing:${ String( d.letterSpacing ).trim() }` );
	if ( d.textAlign ) parts.push( `text-align:${ String( d.textAlign ).trim() }` );
	if ( d.zIndex !== undefined ) parts.push( `z-index:${ String( d.zIndex ).trim() }` );
	if ( d.blur ) parts.push( `filter:blur(${ String( d.blur ).trim() })` );
	if ( d.opacity !== undefined ) parts.push( `opacity:${ String( d.opacity ).trim() }` );
	if ( d.mixBlendMode ) parts.push( `mix-blend-mode:${ String( d.mixBlendMode ).trim() }` );
	if ( d.transform ) parts.push( `transform:${ String( d.transform ).trim() }` );
	if ( d.pointerEvents ) parts.push( `pointer-events:${ String( d.pointerEvents ).trim() }` );
	// Extended box surface — a pseudo-element is a full styleable box. Pure pass-through props
	// (key → CSS property); kept in lock-step with the PHP mirror in ElementStyle::decorationBuilder.
	for ( const [ key, prop ] of DECO_EXTRA ) {
		const val = d[ key ];
		if ( val !== undefined && val !== null && String( val ).trim() !== '' ) {
			parts.push( `${ prop }:${ String( val ).trim() }` );
		}
	}
	// Vendor-prefixed pairs.
	if ( d.mask ) {
		const m = String( d.mask ).trim();
		parts.push( `-webkit-mask:${ m }`, `mask:${ m }` );
	}
	if ( d.backgroundClip ) {
		const c = String( d.backgroundClip ).trim();
		parts.push( `-webkit-background-clip:${ c }`, `background-clip:${ c }` );
	}
	return parts.length > 1 ? parts.join( ';' ) : '';
}

/** Extended pseudo-element props (pure pass-through key → CSS property). Order is part of the
 *  JS↔PHP contract — append only, never reorder, or scoped-CSS parity drifts. */
const DECO_EXTRA: Array< [ string, string ] > = [
	[ 'margin', 'margin' ],
	[ 'minWidth', 'min-width' ],
	[ 'maxWidth', 'max-width' ],
	[ 'minHeight', 'min-height' ],
	[ 'maxHeight', 'max-height' ],
	[ 'outline', 'outline' ],
	[ 'boxShadow', 'box-shadow' ],
	[ 'flexDirection', 'flex-direction' ],
	[ 'flexWrap', 'flex-wrap' ],
	[ 'gap', 'gap' ],
	[ 'fontFamily', 'font-family' ],
	[ 'fontStyle', 'font-style' ],
	[ 'textTransform', 'text-transform' ],
	[ 'textDecoration', 'text-decoration' ],
	[ 'whiteSpace', 'white-space' ],
	[ 'wordSpacing', 'word-spacing' ],
	[ 'backgroundImage', 'background-image' ],
	[ 'backgroundSize', 'background-size' ],
	[ 'backgroundPosition', 'background-position' ],
	[ 'backgroundRepeat', 'background-repeat' ],
	[ 'backdropFilter', 'backdrop-filter' ],
	[ 'clipPath', 'clip-path' ],
	[ 'filter', 'filter' ],
	[ 'transformOrigin', 'transform-origin' ],
	[ 'rotate', 'rotate' ],
	[ 'scale', 'scale' ],
	[ 'transition', 'transition' ],
	[ 'animation', 'animation' ],
	[ 'aspectRatio', 'aspect-ratio' ],
	[ 'overflow', 'overflow' ],
	[ 'cursor', 'cursor' ],
];

/** Wave D — transform builder: structured object → composed CSS string. Pass-through for strings/tokens. */
function transformBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) {
		const s = v.trim();
		if ( s === '' ) return '';
		return isToken( 'transform', s ) ? `var(--blicks-transform-${ s })` : s;
	}
	if ( ! v || typeof v !== 'object' ) return '';
	const t = v as any;
	const parts: string[] = [];
	if ( t.translateX || t.translateY || t.translateZ ) {
		parts.push( `translate3d(${ String( t.translateX || '0' ) }, ${ String( t.translateY || '0' ) }, ${ String( t.translateZ || '0' ) })` );
	}
	if ( t.rotate )  parts.push( `rotate(${ String( t.rotate ).trim() })` );
	if ( t.rotateX ) parts.push( `rotateX(${ String( t.rotateX ).trim() })` );
	if ( t.rotateY ) parts.push( `rotateY(${ String( t.rotateY ).trim() })` );
	if ( t.scale )   parts.push( `scale(${ String( t.scale ).trim() })` );
	if ( t.skewX )   parts.push( `skewX(${ String( t.skewX ).trim() })` );
	if ( t.skewY )   parts.push( `skewY(${ String( t.skewY ).trim() })` );
	return parts.join( ' ' );
}

// Builder categories are the extension point for structured values. Add future builders by
// registering one named function here (and the PHP mirror), then reference its category in STYLE_MAP.
const CSS_VALUE_BUILDERS: Record< string, CssValueBuilder > = {
	image: imageBuilder,
	boxShadow: boxShadowBuilder,
	textShadow: textShadowBuilder,
	gradient: gradientBuilder,
	// Wave D
	clipPath: clipPathBuilder,
	backdropFilter: backdropFilterBuilder,
	mask: maskBuilder,
	transform: transformBuilder,
	// Wave F
	decoration: decorationBuilder,
};

export function registerCssValueBuilder( category: string, builder: CssValueBuilder ): void {
	CSS_VALUE_BUILDERS[ category ] = builder;
}

export function cssValueForCategory( category: string | undefined, v: unknown ): string {
	const builder = category ? CSS_VALUE_BUILDERS[ category ] : undefined;
	if ( builder ) {
		return builder( v );
	}
	const s = String( v ?? '' ).trim();
	if ( category && isToken( category as any, s ) ) {
		return `var(--blicks-${ category }-${ s })`;
	}
	return s;
}

function slotKey( stateKey: string, bpKey: string ): string {
	return [ stateKey, bpKey ].filter( Boolean ).join( '-' );
}

function isSet( v: unknown ): boolean {
	return v !== undefined && v !== null && v !== '';
}

export interface ElementStyle {
	classes: string[];
	vars: Record< string, string >;
	/** Scoped per-instance CSS rules keyed to `.bl-{uniqueId}` (tier 3 / WA mechanisms). */
	scopedCss?: string[];
}

export interface BuildOptions {
	/** Block instance id, required to scope tier-3 rules. */
	uniqueId?: string;
}

/** The four sides / corners var keys for an expanded `kind`. */
function expandKeys( kind: StyleMapRule[ 'kind' ] ): Array< [ string, string ] > {
	return kind === 'corners' ? CORNERS : SIDES;
}

/** Pull a representative scalar value (default/base, else first set) from a control's value tree. */
function representativeValue( tree: any ): unknown {
	if ( ! tree || typeof tree !== 'object' ) return undefined;
	const base = tree?.default?.base;
	if ( isSet( base ) ) return base;
	for ( const byBp of Object.values< any >( tree ) ) {
		for ( const value of Object.values< any >( byBp ?? {} ) ) {
			if ( isSet( value ) ) return value;
		}
	}
	return undefined;
}

function wrapAtRule( rule: ScopedSpec, css: string ): string {
	return rule.atRule?.query ? `@${ rule.atRule.type } ${ rule.atRule.query }{${ css }}` : css;
}

function wrapMotionRule( rule: ScopedSpec, css: string ): string {
	return rule.keyframes ? `@media (prefers-reduced-motion: no-preference){${ css }}` : css;
}

/** Emit any scoped (tier-3) CSS for a rule that needs a real selector or `@property`. */
function emitScoped( rule: StyleMapRule, tree: any, uniqueId: string, scopedCss: string[] ): void {
	if ( rule.registerProperty ) {
		const name = rule.v.startsWith( '--' ) ? rule.v : `--bl-${ rule.v }`;
		scopedCss.push(
			`@property ${ name }{syntax:"${ rule.registerProperty.syntax }";initial-value:${ rule.registerProperty.initialValue };inherits:${ rule.registerProperty.inherits ? 'true' : 'false' }}`
		);
	}

	if ( ! rule.selectorSuffix && ! rule.atRule && ! rule.keyframes ) {
		return;
	}
	if ( ! rule.prop && ! rule.category ) return;
	if ( ! uniqueId ) return;

	const value = rule.keyframes ?? representativeValue( tree );
	if ( ! isSet( value ) ) return;

	const selector = `.bl-${ uniqueId }${ rule.selectorSuffix ?? '' }`;
	let body: string;
	if ( rule.prop ) {
		body = `${ selector }{${ rule.prop }:${ cssValueForCategory( rule.category, value ) }}`;
	} else {
		// Builder-only body: the builder returns the entire `key:val;…` payload (Wave F).
		const inner = cssValueForCategory( rule.category, value );
		if ( ! inner ) return;
		body = `${ selector }{${ inner }}`;
	}
	scopedCss.push( wrapMotionRule( rule, wrapAtRule( rule, body ) ) );
}

export function buildElementStyle( blicks: any, opts: BuildOptions = {} ): ElementStyle {
	const classes: string[] = [];
	const vars: Record< string, string > = {};
	const scopedCss: string[] = [];
	if ( ! blicks ) return { classes, vars };

	const uniqueId = String( opts.uniqueId ?? '' ).replace( /[^a-zA-Z0-9_-]/g, '' );

	for ( const rule of STYLE_MAP ) {
		const tree = blicks[ rule.attr ];
		if ( ! tree ) continue;

		// Scoped (tier-3) rules emit a real selector / @property instead of class+var.
		if ( rule.selectorSuffix || rule.atRule || rule.keyframes || rule.registerProperty ) {
			emitScoped( rule, tree, uniqueId, scopedCss );
			continue;
		}

		// Enum (library preset): one class `bl-{cls}--{slug}`, no var. Base/default look only.
		if ( rule.kind === 'enum' ) {
			const slug = String( representativeValue( tree ) ?? '' ).replace( /[^a-z0-9-]/g, '' );
			if ( slug ) classes.push( `bl-${ rule.cls }--${ slug }` );
			continue;
		}

		if ( rule.kind === 'single' ) {
			let hasValue = false;
			for ( const [ state, byBp ] of Object.entries< any >( tree ) ) {
				const stateKey = STATE_KEY[ state ] ?? '';
				for ( const [ bp, value ] of Object.entries< any >( byBp ) ) {
					if ( ! isSet( value ) ) continue;
					hasValue = true;
					const key = slotKey( stateKey, BP_KEY[ bp ] ?? '' );
					if ( key ) classes.push( `bl-${ rule.cls }--${ key }` );
					const suf = key ? `-${ key }` : '';
					vars[ `${ rule.v }${ suf }` ] = cssValueForCategory( rule.category, value );
				}
			}
			if ( hasValue ) classes.push( `bl-${ rule.cls }` );
			continue;
		}

		// Expanded box: sides / inset / corners. The class is present whenever the control is.
		classes.push( `bl-${ rule.cls }` );
		const keys = expandKeys( rule.kind );
		const dash = rule.kind === 'inset' ? '-' : '';
		for ( const [ state, byBp ] of Object.entries< any >( tree ) ) {
			const stateKey = STATE_KEY[ state ] ?? '';
			for ( const [ bp, rawValue ] of Object.entries< any >( byBp ) ) {
				if ( ! rawValue ) continue;
				const value = expandSideValue( rawValue, keys );
				const key = slotKey( stateKey, BP_KEY[ bp ] ?? '' );
				if ( key ) classes.push( `bl-${ rule.cls }--${ key }` );
				const suf = key ? `-${ key }` : '';
				for ( const [ prop, letter ] of keys ) {
					vars[ `--bl-${ rule.v }${ dash }${ letter }${ suf }` ] = rule.raw
						? rawOrToken( rule.category, ( value as any )[ prop ], rule.emptyValue ?? '0' )
						: valOrToken(
							rule.category ?? 'spacing',
							( value as any )[ prop ],
							rule.fallbackCategory
						);
				}
			}
		}
	}

	const result: ElementStyle = { classes: Array.from( new Set( classes ) ), vars };
	if ( scopedCss.length > 0 ) result.scopedCss = scopedCss;
	return result;
}
