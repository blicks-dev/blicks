import { isToken } from '@/design-system/tokens';
import { cleanCssUrl, cleanCssValue } from './css-value';
import {
	BP_KEY,
	BP_MAX,
	BP_ORDER,
	CORNERS,
	PART_CONTROLS,
	PART_PROPS,
	RULES,
	SIDES,
	STATE_KEY,
} from '@/engine/schema.gen';
import { allowedSlots, ELEMENT_PART, isElementSlot, isPart, parseSlot, partSuffix, selectorFor, slotMedia, slotSelectorSuffix } from '@/framework/parts';

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
 * render (dynamic). The tables come from resources/engine/schema.json, which also generates the PHP
 * mirror's (src/Style/Schema.php) and the runtime stylesheet's maps (resources/runtime/_engine.scss).
 */

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
interface StyleMapRule extends ScopedSpec {
	attr: string;
	cls: string;
	kind: 'sides' | 'inset' | 'corners' | 'single' | 'enum';
	/** Var letter (`p`, `bw`, `pos`, `br`) for sides/inset/corners; full var (`--bl-bg`) for single. */
	v: string;
	/** Token / builder category. sides/inset use `spacing`; corners use `radius`. */
	category?: string;
	/**
	 * sides/corners only: the value is a keyword or colour, not a length. Skips the length
	 * normaliser (no bare-number → `px`) and resolves token slugs through the same category lookup
	 * the `single` path uses.
	 */
	raw?: boolean;
	/** sides/corners only: what an unset side emits. Defaults to `0` (the length case). */
	emptyValue?: string;
	/**
	 * Renders only on a **part** — it has no runtime consumer class, so a value in an element slot
	 * emits nothing. `decoration.content` is the case: `content` on the block's own box is
	 * meaningless at best and destructive at worst.
	 */
	partOnly?: boolean;
}

/**
 * The attribute → CSS emission table, generated from resources/engine/schema.json — the one place
 * a control is declared (see scripts/gen-engine.mjs). Order matters only for the rare exact-array
 * class assertions (expanded boxes first, then singles). Copied so `pushRule()` and the parity
 * probes can extend it at runtime without touching the generated module.
 */
export const STYLE_MAP: StyleMapRule[] = RULES.map( ( rule ) => ( { ...rule } ) );

/**
 * The controls a **part** can render — those the scoped emitter has a property for. Generated with
 * the emitter's own table, so the inspector cannot offer a control the emitter would drop, nor hide
 * one it renders.
 */
export const PARTABLE_CONTROLS: ReadonlySet< string > = new Set( PART_CONTROLS );

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
	// Mirror of ElementStyle::rawOrToken(): a rejected side falls back to the property's initial
	// value, since an empty side would invalidate the whole shorthand.
	return cleanCssValue( s ) || empty;
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
function valOrToken( category: string, v: unknown ): string {
	const s = String( v ?? '' ).trim();
	if ( s === '' ) return '0';
	// A bare number is a literal length, NEVER a token slug. Critically, "0" must stay "0" — the
	// slug list contains "0" but no `--blicks-spacing-0` var is emitted, so token-wrapping it yields
	// an empty value that invalidates the whole `padding`/`margin` shorthand (dropping ALL sides).
	if ( /^-?\d*\.?\d+$/.test( s ) ) return s === '0' ? '0' : `${ s }px`;
	if ( isToken( category as any, s ) ) {
		return `var(--blicks-${ category }-${ s })`;
	}
	// Mirror of ElementStyle::valOrToken(): `0` for a rejected length.
	return cleanCssValue( s ) || '0';
}

type CssValueBuilder = ( value: unknown ) => string;

function imageBuilder( v: unknown ): string {
	const url = typeof v === 'string' ? v : ( v && typeof v === 'object' ? ( v as any ).url : '' );
	// Mirror of ElementStyle::imageBuilder(): http(s) or site-relative only, and nothing that could
	// leave the url("…") it is wrapped in.
	const clean = cleanCssUrl( url );
	return clean ? `url("${ clean }")` : '';
}

/** A colour that may be a palette token slug (`primary`) or any CSS colour. */
function colourOrToken( v: unknown ): string {
	const s = String( v ?? '' ).trim();
	if ( ! s ) return '';
	return isToken( 'color', s ) ? `var(--blicks-color-${ s })` : cleanCssValue( s );
}

/** One `box-shadow` layer, or '' when any part of it fails validation. */
function shadowLayer( layer: any ): string {
	if ( ! layer || typeof layer !== 'object' ) return '';
	// A token layer: the theme's own shadow, stacked with drawn ones (a depth edge under it).
	if ( layer.token !== undefined ) {
		const slug = String( layer.token ).trim();
		return isToken( 'shadow', slug ) ? `var(--blicks-shadow-${ slug })` : '';
	}
	const parts = [ layer.x, layer.y, layer.blur, layer.spread ].map( ( n ) => cleanCssValue( n ?? '0px' ) || '' );
	const colour = colourOrToken( layer.color ?? 'rgba(0,0,0,0.1)' );
	if ( parts.some( ( p ) => ! p ) || ! colour ) return '';
	return `${ layer.inset ? 'inset ' : '' }${ parts.join( ' ' ) } ${ colour }`;
}

/**
 * `box-shadow`: a shadow-token slug (`md`), one layer `{ x, y, blur, spread, color, inset }`, or a
 * list of layers stacked first-on-top — depth, glow and the shadow setting share the property, so
 * they have to arrive as one value. A layer that fails validation drops the whole value rather than
 * shifting the stack.
 */
function boxShadowBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) {
		const slug = v.trim();
		return isToken( 'shadow', slug ) ? `var(--blicks-shadow-${ slug })` : '';
	}
	const layers = Array.isArray( v ) ? v : [ v ];
	const out = layers.map( shadowLayer );
	return out.length && out.every( Boolean ) ? out.join( ', ' ) : '';
}

const OUTLINE_STYLES = /^(solid|dashed|dotted|double|none)$/;

/**
 * `outline`: a raw outline string, or `{ width, style, color }` — width defaults to `2px`, style to
 * `solid`, colour to `currentColor` (a palette slug resolves). The offset is its own control.
 */
function outlineBuilder( v: unknown ): string {
	if ( typeof v === 'string' ) return v.trim();
	if ( ! v || typeof v !== 'object' ) return '';
	const o = v as any;
	const width = cleanCssValue( o.width ?? '2px' );
	const style = OUTLINE_STYLES.test( String( o.style ?? 'solid' ) ) ? String( o.style ?? 'solid' ) : '';
	const colour = colourOrToken( o.color ?? 'currentColor' );
	return width && style && colour ? `${ width } ${ style } ${ colour }` : '';
}

const BG_REPEAT = /^(repeat|no-repeat|repeat-x|repeat-y|space|round)$/;
const BG_ATTACH = /^(scroll|fixed|local)$/;

/** One background layer: a gradient, a picture or a flat tint, with its own placement. */
function backgroundLayer( layer: any ): string {
	if ( ! layer || typeof layer !== 'object' ) return '';
	let image = '';
	if ( layer.type === 'gradient' ) image = cleanCssValue( gradientBuilder( layer.value ) );
	else if ( layer.type === 'tint' ) {
		const colour = colourOrToken( layer.color );
		const opacity = Math.max( 0, Math.min( 100, Number( layer.opacity ?? 100 ) ) );
		if ( colour && Number.isFinite( opacity ) ) {
			const c = `color-mix(in srgb, ${ colour } ${ opacity }%, transparent)`;
			image = `linear-gradient(${ c }, ${ c })`;
		}
	} else if ( layer.type === 'image' ) {
		const url = cleanCssUrl( layer.url );
		if ( url ) {
			// A picture always carries its placement, so a later layer's defaults cannot leak into it.
			const position = cleanCssValue( layer.position ?? '0% 0%' ) || '0% 0%';
			const size = cleanCssValue( layer.size ?? 'auto' ) || 'auto';
			const repeat = BG_REPEAT.test( String( layer.repeat ?? '' ) ) ? layer.repeat : 'no-repeat';
			const attach = BG_ATTACH.test( String( layer.attachment ?? '' ) ) && layer.attachment !== 'scroll' ? ` ${ layer.attachment }` : '';
			return `url("${ url }") ${ position } / ${ size } ${ repeat }${ attach }`;
		}
	}
	return image;
}

/**
 * `background.layers`: a list of layers, top first, written as the `background` shorthand so each
 * layer keeps its own size, position, repeat and attachment. The flat colour stays with
 * `colors.background`, whose runtime rule comes after this one. Self-validating: every piece is
 * checked, and an unusable layer is dropped.
 */
function backgroundLayersBuilder( v: unknown ): string {
	if ( ! Array.isArray( v ) ) return '';
	return v.map( backgroundLayer ).filter( Boolean ).join( ', ' );
}

/** One text-shadow layer; a side is unset only when missing or empty (`"0"` is an offset). */
function textShadowLayer( s: any ): string {
	const set = ( x: unknown ) => ( typeof x === 'string' || typeof x === 'number' ) && String( x ) !== '';
	if ( ! s || typeof s !== 'object' || ( ! set( s.x ) && ! set( s.y ) ) ) return '';
	const part = ( k: string, fallback: string ) => ( set( s[ k ] ) ? String( s[ k ] ) : fallback );
	return `${ part( 'x', '0px' ) } ${ part( 'y', '0px' ) } ${ part( 'blur', '0px' ) } ${ part( 'color', 'rgba(0,0,0,0.1)' ) }`;
}

/** One layer `{ x, y, blur, color }`, or a list stacked first-on-top. */
function textShadowBuilder( v: unknown ): string {
	if ( ! v || typeof v !== 'object' ) return '';
	const layers = Array.isArray( v ) ? v : [ v ];
	const out = layers.map( textShadowLayer );
	return out.length && out.every( Boolean ) ? out.join( ', ' ) : '';
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
	// Control characters first: a newline ends a CSS string early and lets a `}` close the rule.
	// eslint-disable-next-line no-control-regex
	const s = String( raw ?? '' ).replace( /[\x00-\x1F\x7F]/g, '' ).replace( /</g, '' ).trim();
	if ( s === '' ) return '""';
	if ( /^(none|normal|inherit|initial|unset|revert|open-quote|close-quote|no-open-quote|no-close-quote)$/i.test( s ) ) {
		return s;
	}
	// Untyped `attr(name)` yields text in `content`, never a URL — accepted in exactly that shape.
	if ( /^attr\(\s*[A-Za-z][A-Za-z0-9_-]*\s*\)$/.test( s ) ) return s;
	// Any other function must validate whole, as ElementStyle::normalizeContent() requires.
	if ( /^(counter|counters|attr|var|env)\(/i.test( s ) ) return cleanCssValue( s ) ? s : '""';
	const quoted =
		s.length >= 2 &&
		( ( s.startsWith( '"' ) && s.endsWith( '"' ) ) || ( s.startsWith( "'" ) && s.endsWith( "'" ) ) );
	const inner = quoted ? s.slice( 1, -1 ) : s;
	return '"' + inner.replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ) + '"';
}


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
	outline: outlineBuilder,
	textShadow: textShadowBuilder,
	gradient: gradientBuilder,
	// Wave D
	clipPath: clipPathBuilder,
	backdropFilter: backdropFilterBuilder,
	mask: maskBuilder,
	transform: transformBuilder,
	// The part axis: a pseudo-element's `content`, quoted and escaped.
	content: normalizeContent,
	backgroundLayers: backgroundLayersBuilder,
};

export function registerCssValueBuilder( category: string, builder: CssValueBuilder ): void {
	CSS_VALUE_BUILDERS[ category ] = builder;
}

export function cssValueForCategory( category: string | undefined, v: unknown ): string {
	const builder = category ? CSS_VALUE_BUILDERS[ category ] : undefined;
	if ( builder ) {
		const built = builder( v );
		return SELF_VALIDATING_CATEGORIES.has( category as string ) ? built : cleanCssValue( built );
	}
	const s = String( v ?? '' ).trim();
	if ( category && isToken( category as any, s ) ) {
		return `var(--blicks-${ category }-${ s })`;
	}
	// Mirror of ElementStyle::cssValueForCategory(): uncategorised values are validated whole.
	return cleanCssValue( s );
}

/**
 * Builders whose output legitimately holds characters cleanCssValue() refuses — `content` is a
 * quoted string, `image` and `backgroundLayers` hold `url("…")` — and which validate their own
 * inputs instead. Mirror of
 * ElementStyle::SELF_VALIDATING_CATEGORIES.
 */
const SELF_VALIDATING_CATEGORIES = new Set( [ 'content', 'image', 'backgroundLayers' ] );

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

/**
 * Pull a representative scalar value (default/base, else first set) from a control's value tree.
 *
 * Only **element** slots count. The rules that read this — library presets and the child-selector
 * rules — describe the element or its subtree, so a value set on `::before` must not become the
 * element's: a type role picked for a pseudo-element would otherwise land on the block.
 */
function representativeValue( tree: any ): unknown {
	if ( ! tree || typeof tree !== 'object' ) return undefined;
	const base = tree?.default?.base;
	if ( isSet( base ) ) return base;
	for ( const [ slot, byBp ] of Object.entries< any >( tree ) ) {
		if ( ! isElementSlot( slot ) ) continue;
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
	const body = rule.prop
		? `${ selector }{${ rule.prop }:${ cssValueForCategory( rule.category, value ) }}`
		: `${ selector }{${ cssValueForCategory( rule.category, value ) }}`;
	scopedCss.push( wrapMotionRule( rule, wrapAtRule( rule, body ) ) );
}

/** `border-radius` → its corner longhands in CORNERS order (tl, tr, br, bl). */
function cornerLonghands( prop: string ): string[] {
	const [ head, ...rest ] = prop.split( '-' );
	return [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ].map( ( c ) => `${ head }-${ c }-${ rest.join( '-' ) }` );
}

/** `position.inset`'s four properties, in SIDES order. */
const INSET_PROPS = [ 'top', 'right', 'bottom', 'left' ];

/** `layout.lineClamp` truncates nothing without the -webkit-box hack its runtime rule carries. */
const LINE_CLAMP_FIXED = 'display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;';

/** `colors.clipText`'s static trio — the value is a toggle, not a property value. */
const CLIP_TEXT_DECLS = 'background-clip:text;-webkit-background-clip:text;color:transparent';

/** The guards runtime.scss wraps round animation on the element, reproduced for parts. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: no-preference)';
const TIMELINE_SUPPORTS = '(animation-timeline: scroll())';
/** runtime.scss's `at-state` guard on hover rules: a tap on a touch screen must not leave them stuck on. */
const HOVER_QUERY = '(hover: hover)';

/** One declaration, with the `-webkit-` twin the property needs (mirrors `webkit: true` in SCSS). */
function partDecl( prop: string, value: string, webkit?: boolean ): string {
	if ( ! value ) return '';
	return webkit ? `-webkit-${ prop }:${ value };${ prop }:${ value }` : `${ prop }:${ value }`;
}

/**
 * What one rule contributes to a scoped **part** rule — the declarations the static consumer class
 * would have applied, written out because a pseudo-element has no class to carry.
 *
 * Returns `''` for anything a part cannot express (see `PART_CONTROLS`).
 */
function partDeclarations( rule: StyleMapRule, rawValue: unknown ): string {
	if ( ! PARTABLE_CONTROLS.has( rule.attr ) ) return '';
	const part = PART_PROPS[ rule.cls ];

	if ( rule.kind === 'single' ) {
		if ( ! isSet( rawValue ) ) return '';
		if ( rule.cls === 'cliptext' ) return CLIP_TEXT_DECLS;
		const value = cssValueForCategory( rule.category, rawValue );
		if ( ! value ) return '';
		if ( rule.cls === 'lc' ) return `${ LINE_CLAMP_FIXED }-webkit-line-clamp:${ value }`;
		return part ? partDecl( part.prop, value, part.webkit ) : '';
	}

	// Expanded box: sides / inset / corners, resolved exactly as the tier-1/2 path resolves them.
	if ( ! rawValue ) return '';
	const keys = expandKeys( rule.kind );
	const value = expandSideValue( rawValue, keys ) as any;
	const sides = keys.map( ( [ side ] ) => {
		// Four properties, not the `inset` shorthand: an unset side has to stay `auto`, which is
		// what the runtime rule falls back to.
		if ( rule.kind === 'inset' && ! isSet( value[ side ] ) ) return 'auto';
		return rule.raw
			? rawOrToken( rule.category, value[ side ], rule.emptyValue ?? '0' )
			: valOrToken( rule.category ?? 'spacing', value[ side ] );
	} );

	if ( rule.kind === 'inset' ) return INSET_PROPS.map( ( prop, i ) => `${ prop }:${ sides[ i ] }` ).join( ';' );
	// Longhands for corners, as on the element: a two-value corner is invalid in the shorthand.
	if ( rule.kind === 'corners' && part ) return cornerLonghands( part.prop ).map( ( prop, i ) => `${ prop }:${ sides[ i ] }` ).join( ';' );
	return part ? `${ part.prop }:${ sides.join( ' ' ) }` : '';
}

/** The guard a declaration's property sits behind on the element, if any. */
const GUARD_BY_PROP: Record< string, string > = Object.fromEntries(
	Object.values( PART_PROPS ).filter( ( p ) => p.guard ).map( ( p ) => [ p.prop, p.guard as string ] )
);

/**
 * Turn the declarations collected per (breakpoint, selector suffix) into scoped CSS rules.
 *
 * Grouped rather than emitted per control, so a pseudo-element with twelve properties set is one
 * rule, and breakpoints come out widest first whatever order the value tree iterated in.
 */
function emitPartRules( buckets: Map< string, string[] >, uniqueId: string, scopedCss: string[], styled: Set< string >, authored: Set< string > ): void {
	// A pseudo-element with no `content` generates no box, so everything set on it would do
	// nothing. Default `content:""` into the base slot of each styled part the user gave none to.
	for ( const part of styled ) {
		if ( authored.has( part ) ) continue;
		const key = `|${ partSuffix( part ) }`;
		buckets.set( key, [ 'content:""', ...( buckets.get( key ) ?? [] ) ] );
	}

	for ( const bpKey of BP_ORDER ) {
		for ( const [ key, decls ] of buckets ) {
			const [ bucketBp, suffix ] = key.split( '|' );
			if ( bucketBp !== bpKey || decls.length === 0 ) continue;

			// Reproduce what runtime.scss wraps animation in on the element, so a `::before` does
			// not animate through a reduced-motion preference the block itself honours.
			const groups: Record< string, string[] > = { plain: [], motion: [], timeline: [] };
			for ( const decl of decls ) groups[ GUARD_BY_PROP[ decl.slice( 0, decl.indexOf( ':' ) ) ] ?? 'plain' ].push( decl );

			// Plain CSS cannot nest two @media rules, so a guard under a breakpoint is one `and` query.
			const hover = ( suffix ?? '' ).startsWith( ':hover' ) ? HOVER_QUERY : '';
			const media = slotMedia( suffix ?? '' );
			const wrap = ( body: string, extra = '' ): string => {
				const query = [ hover, media, bpKey ? `(max-width: ${ BP_MAX[ bpKey ] })` : '', extra ].filter( Boolean ).join( ' and ' );
				return query ? `@media ${ query }{${ body }}` : body;
			};
			const rule = ( list: string[] ): string => `${ selectorFor( `.bl-${ uniqueId }`, suffix ?? '' ) }{${ list.join( ';' ) }}`;

			if ( groups.plain.length ) scopedCss.push( wrap( rule( groups.plain ) ) );
			if ( groups.motion.length ) scopedCss.push( wrap( rule( groups.motion ), REDUCED_MOTION_QUERY ) );
			if ( groups.timeline.length ) {
				scopedCss.push( wrap( `@supports ${ TIMELINE_SUPPORTS }{${ rule( groups.timeline ) }}`, REDUCED_MOTION_QUERY ) );
			}
		}
	}
}

export function buildElementStyle( blicks: any, opts: BuildOptions = {} ): ElementStyle {
	const classes: string[] = [];
	const vars: Record< string, string > = {};
	const scopedCss: string[] = [];
	if ( ! blicks ) return { classes, vars };

	const uniqueId = String( opts.uniqueId ?? '' ).replace( /[^a-zA-Z0-9_-]/g, '' );

	/** `${bpKey}|${selectorSuffix}` → declarations, for every part slot. */
	const partBuckets = new Map< string, string[] >();
	/** Parts that got at least one declaration, and those the user gave `content` to. */
	const styledParts = new Set< string >();
	const authoredContent = new Set< string >();

	/**
	 * Route one slot's value to the part buckets. Returns false when the slot styles the element
	 * itself — the tier-1/2 path. A part slot changes only `scopedCss`, never a class or var:
	 * otherwise styling a pseudo-element would quietly restyle its host.
	 */
	const collectPart = ( rule: StyleMapRule, slot: string, bp: string, value: unknown ): boolean => {
		const { part } = parseSlot( slot );
		if ( part === ELEMENT_PART ) return false;
		// Without an instance id there is no selector to hang the rule on. Dropping beats emitting
		// `.bl-::before`, which would match every Blicks block on the page.
		if ( ! uniqueId ) return true;
		const decls = partDeclarations( rule, value );
		if ( ! decls ) return true;
		styledParts.add( part );
		if ( rule.partOnly && rule.category === 'content' ) authoredContent.add( part );
		const key = `${ BP_KEY[ bp ] ?? '' }|${ slotSelectorSuffix( slot ) }`;
		partBuckets.set( key, [ ...( partBuckets.get( key ) ?? [] ), decls ] );
		return true;
	};

	for ( const rule of STYLE_MAP ) {
		const tree = blicks[ rule.attr ] && typeof blicks[ rule.attr ] === 'object' ? allowedSlots( rule.attr, blicks[ rule.attr ] ) : blicks[ rule.attr ];
		if ( ! tree ) continue;

		// Part-only controls never reach the element.
		if ( rule.partOnly ) {
			for ( const [ slot, byBp ] of Object.entries< any >( tree ) ) {
				for ( const [ bp, value ] of Object.entries< any >( byBp ?? {} ) ) collectPart( rule, slot, bp, value );
			}
			continue;
		}

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
			for ( const [ slot, byBp ] of Object.entries< any >( tree ) ) {
				const stateKey = STATE_KEY[ slot ] ?? '';
				for ( const [ bp, value ] of Object.entries< any >( byBp ) ) {
					if ( collectPart( rule, slot, bp, value ) ) continue;
					if ( ! isSet( value ) ) continue;
					// A value that fails validation writes no var, so it gets no class either: a
					// consumer class with nothing behind it applies its fallback (`background: none`)
					// and would undo the theme instead of doing nothing.
					const css = cssValueForCategory( rule.category, value );
					if ( css === '' ) continue;
					hasValue = true;
					const key = slotKey( stateKey, BP_KEY[ bp ] ?? '' );
					if ( key ) classes.push( `bl-${ rule.cls }--${ key }` );
					const suf = key ? `-${ key }` : '';
					vars[ `${ rule.v }${ suf }` ] = css;
				}
			}
			if ( hasValue ) classes.push( `bl-${ rule.cls }` );
			continue;
		}

		// Expanded box: sides / inset / corners. The class is present whenever the control has an
		// element slot — NOT when every slot is a part. `.bl-pad` with no `--bl-pt` behind it is
		// invalid at computed-value time, which would drop the host's padding to 0.
		if ( Object.keys( tree ).some( isElementSlot ) ) classes.push( `bl-${ rule.cls }` );
		const keys = expandKeys( rule.kind );
		const dash = rule.kind === 'inset' ? '-' : '';
		for ( const [ slot, byBp ] of Object.entries< any >( tree ) ) {
			const stateKey = STATE_KEY[ slot ] ?? '';
			for ( const [ bp, rawValue ] of Object.entries< any >( byBp ) ) {
				if ( collectPart( rule, slot, bp, rawValue ) ) continue;
				if ( ! rawValue ) continue;
				const value = expandSideValue( rawValue, keys );
				const key = slotKey( stateKey, BP_KEY[ bp ] ?? '' );
				if ( key ) classes.push( `bl-${ rule.cls }--${ key }` );
				const suf = key ? `-${ key }` : '';
				for ( const [ prop, letter ] of keys ) {
					const side = ( value as any )[ prop ];
					// An unset inset side is `auto`, as on a part: `0` would pin that edge too, and a
					// box placed by two sides would stretch to the other two.
					vars[ `--bl-${ rule.v }${ dash }${ letter }${ suf }` ] = rule.kind === 'inset' && ! isSet( side )
						? 'auto'
						: rule.raw
							? rawOrToken( rule.category, side, rule.emptyValue ?? '0' )
							: valOrToken( rule.category ?? 'spacing', side );
				}
			}
		}
	}

	emitPartRules( partBuckets, uniqueId, scopedCss, styledParts, authoredContent );

	const result: ElementStyle = { classes: Array.from( new Set( classes ) ), vars };
	if ( scopedCss.length > 0 ) result.scopedCss = scopedCss;
	return result;
}

// ── problems ─────────────────────────────────────────────────────────────────

export type StyleProblemReason = 'unknown-control' | 'not-allowed' | 'unknown-slot' | 'unknown-breakpoint' | 'not-on-part' | 'invalid-value';

export interface StyleProblem {
	id: string;
	slot?: string;
	breakpoint?: string;
	reason: StyleProblemReason;
	/** The value that will not be applied, where there is one. */
	value?: unknown;
}

/** One side or corner the box path would replace with its fallback. */
function sideRejected( rule: StyleMapRule, v: unknown ): boolean {
	const s = String( v ?? '' ).trim();
	if ( s === '' ) return false;
	if ( ! rule.raw && /^-?\d*\.?\d+$/.test( s ) ) return false;
	const category = rule.raw ? rule.category : rule.category ?? 'spacing';
	if ( category && isToken( category as any, s ) ) return false;
	return cleanCssValue( s ) === '';
}

/** Would this one value build to nothing? Mirrors the emission paths above. */
function valueRejected( rule: StyleMapRule, value: unknown ): boolean {
	if ( ! isSet( value ) ) return false;
	if ( rule.kind === 'enum' ) return ! String( value ).replace( /[^a-z0-9-]/g, '' );
	if ( rule.kind === 'single' ) return cssValueForCategory( rule.category, value ) === '';
	if ( typeof value === 'string' || typeof value === 'number' ) return sideRejected( rule, value );
	if ( ! value || typeof value !== 'object' ) return true;
	return Object.values( value as Record< string, unknown > ).some( ( v ) => sideRejected( rule, v ) );
}

/**
 * Every value in a style tree that the engine would not apply, and why. `buildElementStyle` drops
 * these quietly so one bad value never breaks a page; this is the same judgement made out loud, for
 * the editor to show and for layout tools to report. Pass the block's `supports.blicks.controls` to
 * also catch controls the block does not allow. Mirror of ElementStyle::problems().
 */
export function findStyleProblems( blicks: any, allowList?: readonly string[] ): StyleProblem[] {
	const problems: StyleProblem[] = [];
	if ( ! blicks || typeof blicks !== 'object' ) return problems;
	const allowed = ( id: string ) => ! allowList || allowList.includes( id ) || allowList.includes( `${ id.split( '.' )[ 0 ] }.*` );
	for ( const [ id, tree ] of Object.entries< any >( blicks ) ) {
		if ( id.startsWith( 'meta.' ) ) continue;
		const rule = STYLE_MAP.find( ( r ) => r.attr === id );
		if ( ! rule ) {
			problems.push( { id, reason: 'unknown-control' } );
			continue;
		}
		if ( ! allowed( id ) ) {
			problems.push( { id, reason: 'not-allowed' } );
			continue;
		}
		if ( ! tree || typeof tree !== 'object' ) continue;
		for ( const [ slot, byBp ] of Object.entries< any >( tree ) ) {
			const [ part, state ] = slot.includes( ':' ) ? slot.split( ':' ) : isPart( slot ) && slot !== 'default' ? [ slot, 'default' ] : [ ELEMENT_PART, slot ];
			if ( ! isPart( part ) || ! ( state in STATE_KEY ) ) {
				problems.push( { id, slot, reason: 'unknown-slot' } );
				continue;
			}
			for ( const [ bp, value ] of Object.entries< any >( byBp ?? {} ) ) {
				if ( ! ( bp in BP_KEY ) ) problems.push( { id, slot, breakpoint: bp, reason: 'unknown-breakpoint', value } );
				else if ( part !== ELEMENT_PART && ! PARTABLE_CONTROLS.has( id ) ) problems.push( { id, slot, breakpoint: bp, reason: 'not-on-part', value } );
				else if ( valueRejected( rule, value ) ) problems.push( { id, slot, breakpoint: bp, reason: 'invalid-value', value } );
			}
		}
	}
	return problems;
}
