// @ts-nocheck — one-shot dev tool: uses node:fs/path + process.env, no @types/node in this tsconfig.
/**
 * One-shot specimen pattern generator (run via vitest, then delete). Emits recovery-safe pattern
 * markup by running the real `buildElementStyle` over authored value-trees, so saved HTML == save().
 */
import { it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildElementStyle } from './vars';

function classAttr( slug: string, blicks: any ): string {
	return [ `bl-${ slug }`, ...buildElementStyle( blicks, {} ).classes ].join( ' ' );
}
function styleAttr( blicks: any ): string {
	const entries = Object.entries( buildElementStyle( blicks, {} ).vars || {} );
	return entries.length ? ' style="' + entries.map( ( [ k, v ] ) => `${ k }:${ v }` ).join( ';' ) + '"' : '';
}
function attrsJson( blicks: any, extra: any = {} ): string {
	const obj: any = {};
	if ( blicks && Object.keys( blicks ).length ) obj.blicks = blicks;
	Object.assign( obj, extra );
	return Object.keys( obj ).length ? ' ' + JSON.stringify( obj ) : '';
}
function el( name: string, slug: string, tag: string, o: any = {} ): string {
	const blicks = o.blicks || {};
	return `<!-- wp:blicks/${ name }${ attrsJson( blicks, o.attrs || {} ) } -->
<${ tag } class="${ classAttr( slug, blicks ) }"${ styleAttr( blicks ) }>${ o.inner ?? '' }</${ tag }>
<!-- /wp:blicks/${ name } -->`;
}
function dynamic( name: string, o: any = {} ): string {
	return `<!-- wp:blicks/${ name }${ attrsJson( o.blicks || {}, o.attrs || {} ) } -->
${ o.inner ?? '' }
<!-- /wp:blicks/${ name } -->`;
}
const b = ( value: any ) => ( { default: { base: value } } );

// ─────────────────────────────────────────────────────────────────────────────
// css() — paste a CSS string, get a `blicks` value-tree. The fast path: a specimen
// block becomes a near-verbatim transcription of the mockup's CSS instead of a
// hand-authored value-tree. Handles shorthand expansion (padding/margin/border/
// border-radius) and gradient parsing. Unknown props throw (loud gaps, not silent).
// ─────────────────────────────────────────────────────────────────────────────

/** Split `s` on `sep` at the top level only — commas/spaces inside (...) are ignored. */
function splitTop( s: string, sep: string ): string[] {
	const out: string[] = [];
	let depth = 0, cur = '';
	for ( const ch of s ) {
		if ( ch === '(' ) depth++;
		else if ( ch === ')' ) depth--;
		if ( ch === sep && depth === 0 ) { out.push( cur ); cur = ''; }
		else cur += ch;
	}
	if ( cur.trim() !== '' ) out.push( cur );
	return out;
}

/** CSS 1–4 value shorthand → [top, right, bottom, left]. */
function expand4( v: string ): string[] {
	const p = v.trim().split( /\s+/ );
	if ( p.length === 1 ) return [ p[0], p[0], p[0], p[0] ];
	if ( p.length === 2 ) return [ p[0], p[1], p[0], p[1] ];
	if ( p.length === 3 ) return [ p[0], p[1], p[2], p[1] ];
	return [ p[0], p[1], p[2], p[3] ];
}
const sides = ( v: string ) => { const [ top, right, bottom, left ] = expand4( v ); return { top, right, bottom, left }; };
const corners = ( v: string ) => { const [ topLeft, topRight, bottomRight, bottomLeft ] = expand4( v ); return { topLeft, topRight, bottomRight, bottomLeft }; };

/** `radial-gradient(130% 130% at 100% 0%, rgba(...) 0%, transparent 55%)` → value-tree shape. */
function parseGradient( v: string ): any {
	if ( splitTop( v, ',' ).filter( ( p ) => /^\s*(linear|radial|conic)-gradient\(/.test( p ) ).length > 1 ) {
		throw new Error( `css(): multi-layer background not supported — use one gradient or a customCSS field: ${ v }` );
	}
	const m = v.trim().match( /^(linear|radial|conic)-gradient\((.*)\)$/s );
	if ( ! m ) throw new Error( `css(): unparseable gradient: ${ v }` );
	const type = m[1];
	const args = splitTop( m[2], ',' ).map( ( a ) => a.trim() );
	const toStop = ( a: string ) => {
		const parts = splitTop( a, ' ' ).map( ( p ) => p.trim() ).filter( Boolean );
		const last = parts[ parts.length - 1 ];
		const hasPos = /^-?[\d.]+(%|px|rem|em|vh|vw|fr)?$/.test( last ) && parts.length > 1;
		return hasPos
			? { color: parts.slice( 0, -1 ).join( ' ' ), position: last }
			: { color: parts.join( ' ' ) };
	};
	// Key order below is canonical (type, shape/angle, position, stops) so the emitted comment
	// JSON byte-matches hand-authored value-trees.
	if ( type === 'radial' ) {
		const isHead = / at /.test( args[0] ) && ! /^#|^rgb|^hsl|^[a-z]+$/.test( args[0] ) && splitTop( args[0], ' ' ).length > 1;
		const head = isHead ? args.shift()! : '';
		const out: any = { type: 'radial' };
		if ( head ) { const [ shape, pos ] = head.split( / at /, 2 ); out.shape = shape.trim(); if ( pos ) out.position = pos.trim(); }
		out.stops = args.map( toStop );
		return out;
	}
	if ( type === 'conic' ) {
		let angle, position;
		if ( /^from /.test( args[0] ) ) { const h = args.shift()!; const mm = h.match( /^from ([^]+?)(?: at ([^]+))?$/ ); angle = mm?.[1]?.trim(); position = mm?.[2]?.trim(); }
		const out: any = { type: 'conic' };
		if ( angle ) out.angle = angle; if ( position ) out.position = position;
		out.stops = args.map( toStop );
		return out;
	}
	// linear: optional leading angle / `to <side>`
	let angle = '';
	if ( /deg$/.test( args[0] ) || /^to /.test( args[0] ) ) angle = args.shift()!;
	const out: any = { type: 'linear' };
	if ( angle ) out.angle = angle.trim();
	out.stops = args.map( toStop );
	return out;
}

/** One CSS declaration → zero-or-more [controlId, value] pairs (handles shorthands). */
function declToTree( prop: string, value: string ): Array< [ string, any ] > {
	const v = value.trim();
	switch ( prop ) {
		case 'background':
		case 'background-color':
		case 'background-image':
			return /gradient\(/.test( v ) ? [ [ 'background.gradient', parseGradient( v ) ] ] : [ [ 'colors.background', v ] ];
		case 'color': return [ [ 'colors.text', v ] ];
		case 'padding': return [ [ 'spacing.padding', sides( v ) ] ];
		case 'margin': return [ [ 'spacing.margin', sides( v ) ] ];
		case 'border-radius': return [ [ 'border.radius', corners( v ) ] ];
		case 'border': {
			const [ width, style, ...rest ] = v.split( /\s+/ );
			return [
				[ 'border.width', sides( width ) ],
				[ 'border.style', style ],
				[ 'border.color', rest.join( ' ' ) ],
			];
		}
		case 'border-width': return [ [ 'border.width', sides( v ) ] ];
		case 'border-style': return [ [ 'border.style', v ] ];
		case 'border-color': return [ [ 'border.color', v ] ];
		case 'overflow': return [ [ 'layout.overflow', v ] ];
		case 'position': return [ [ 'position.type', v ] ];
		case 'width': return [ [ 'layout.width', v ] ];
		case 'height': return [ [ 'layout.height', v ] ];
		case 'display': return [ [ 'layout.display', v ] ];
		case 'flex-direction': return [ [ 'layout.flexDirection', v ] ];
		case 'justify-content': return [ [ 'layout.justifyContent', v ] ];
		case 'align-items': return [ [ 'layout.alignItems', v ] ];
		case 'flex-wrap': return [ [ 'layout.flexWrap', v ] ];
		case 'gap': return [ [ 'layout.gapRow', v ], [ 'layout.gapColumn', v ] ];
		case 'grid-column': return [ [ 'gridChild.columnSpan', v.replace( /^span\s+/, '' ) ] ];
		case 'grid-row': return [ [ 'gridChild.rowSpan', v.replace( /^span\s+/, '' ) ] ];
		case 'font-size': return [ [ 'typography.fontSize', v ] ];
		case 'line-height': return [ [ 'typography.lineHeight', v ] ];
		case 'font-weight': return [ [ 'typography.fontWeight', v ] ];
		case 'text-align': return [ [ 'typography.textAlign', v ] ];
		case 'text-transform': return [ [ 'typography.textTransform', v ] ];
		case 'letter-spacing': return [ [ 'typography.letterSpacing', v ] ];
		case 'backdrop-filter': return [ [ 'effects.backdropFilter', { blur: ( v.match( /blur\(([^)]+)\)/ )?.[1] ?? v ) } ] ];
		case 'font-family': return [ [ 'typography.fontFamily', v.replace( /"/g, "'" ) ] ]; // dbl-quotes break inline style=""
		case 'aspect-ratio': return [ [ 'layout.aspectRatio', v ] ];
		case 'grid-template-columns': return [ [ 'layout.gridColumns', v ] ];
		case 'grid-template-rows': return [ [ 'layout.gridRows', v ] ];
		case 'grid-auto-flow': return [ [ 'layout.gridAutoFlow', v ] ];
		case 'justify-items': return [ [ 'layout.justifyItems', v ] ];
		case 'grid-area': return [ [ 'gridChild.gridArea', v ] ];
		case 'align-self': return [ [ 'gridChild.alignSelf', v ] ];
		case 'justify-self': return [ [ 'gridChild.justifySelf', v ] ];
		case 'order': return [ [ 'gridChild.order', v ] ];
		case 'z-index': return [ [ 'position.zIndex', v ] ];
		case 'place-items': { const [ a, j = a ] = v.split( /\s+/ ); return [ [ 'layout.alignItems', a ], [ 'layout.justifyItems', j ] ]; }
		case 'clip-path': return [ [ 'effects.clipPath', v ] ];
		case 'transform': return [ [ 'effects.transform', v ] ];
		case 'transform-style': return [ [ 'effects.transformStyle', v ] ];
		case 'transform-origin': return [ [ 'effects.transformOrigin', v ] ];
		case 'perspective': return [ [ 'effects.perspective', v ] ];
		case 'filter': return [ [ 'effects.filter', v ] ];
		case 'opacity': return [ [ 'effects.opacity', v ] ];
		case 'cursor': return [ [ 'effects.cursor', v ] ];
		case 'box-shadow': {
			const t = splitTop( v, ' ' ).map( ( s ) => s.trim() ).filter( Boolean );
			const color = t.find( ( s ) => /^#|^rgb|^hsl|^[a-z]+$/.test( s ) && ! /^(inset)$/.test( s ) ) ?? 'rgba(0,0,0,0.1)';
			const lens = t.filter( ( s ) => s !== color && /^-?[\d.]/.test( s ) );
			return [ [ 'effects.boxShadow', { x: lens[0] ?? '0px', y: lens[1] ?? '0px', blur: lens[2] ?? '0px', color } ] ];
		}
		default: throw new Error( `css(): unmapped property "${ prop }" — add it to declToTree().` );
	}
}

/** Paste a CSS string → `blicks` value-tree (base state). */
function css( decls: string ): any {
	const tree: any = {};
	for ( const d of splitTop( decls, ';' ) ) {
		const i = d.indexOf( ':' );
		if ( i < 0 ) continue;
		const prop = d.slice( 0, i ).trim();
		const value = d.slice( i + 1 ).trim();
		if ( ! prop || ! value ) continue;
		for ( const [ id, val ] of declToTree( prop, value ) ) tree[ id ] = b( val );
	}
	return tree;
}

/** Lenient css(): map what we can, collect unmapped props as raw CSS leftover (no throw). */
function cssX( decls: string ): { tree: any; leftover: string[] } {
	const tree: any = {}; const leftover: string[] = [];
	for ( const d of splitTop( decls, ';' ) ) {
		const i = d.indexOf( ':' );
		if ( i < 0 ) continue;
		const prop = d.slice( 0, i ).trim();
		const value = d.slice( i + 1 ).trim();
		if ( ! prop || ! value || prop.startsWith( '--' ) ) continue; // custom-prop defs aren't element styles
		try { for ( const [ id, val ] of declToTree( prop, value ) ) tree[ id ] = b( val ); }
		catch { leftover.push( `${ prop }: ${ value }` ); }
	}
	return { tree, leftover: [ ...new Set( leftover ) ] };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML → specimen scaffold. Parse a mockup's HTML + its CSS cascade, map each node
// to the nearest Blicks block, style it via cssX(). Decorative subtrees (no text,
// pseudo-element art, 3D transforms) are flattened with loud warnings — the artistic
// bits are finished by hand. Output is recovery-safe: only value-tree styling (incl.
// tier-3 effects that regenerate at render) ever reaches a static block.
// ─────────────────────────────────────────────────────────────────────────────

interface HtmlNode { tag: string; classes: string[]; id: string; attrs: Record< string, string >; children: HtmlNode[]; text: string; }

const VOID_TAGS = new Set( [ 'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr' ] );

function decodeEntities( s: string ): string {
	return s.replace( /&nbsp;/g, ' ' ).replace( /&amp;/g, '&' ).replace( /&lt;/g, '<' ).replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' ).replace( /&#39;/g, "'" ).replace( /&mdash;/g, '—' ).replace( /&ndash;/g, '–' )
		.replace( /&hellip;/g, '…' ).replace( /\s+/g, ' ' );
}

function parseAttrs( raw: string ): Record< string, string > {
	const attrs: Record< string, string > = {};
	const re = /([\w:-]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
	let m: RegExpExecArray | null;
	while ( ( m = re.exec( raw ) ) ) { if ( m[1] ) attrs[ m[1].toLowerCase() ] = ( m[2] ?? m[3] ?? '' ); }
	return attrs;
}

/** Tolerant HTML → node tree. Returns the <body> node (or a synthetic root). */
function parseHTML( html: string ): HtmlNode {
	const root: HtmlNode = { tag: 'root', classes: [], id: '', attrs: {}, children: [], text: '' };
	const stack: HtmlNode[] = [ root ];
	const re = /<!--[\s\S]*?-->|<!\w[^>]*>|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
	let m: RegExpExecArray | null;
	while ( ( m = re.exec( html ) ) ) {
		const top = stack[ stack.length - 1 ];
		if ( m[5] !== undefined ) { // text
			const t = decodeEntities( m[5] ).trim();
			if ( t ) top.text = ( top.text ? top.text + ' ' : '' ) + t;
			continue;
		}
		if ( m[2] === undefined ) continue; // comment / doctype
		const closing = m[1] === '/'; const tag = m[2].toLowerCase();
		if ( closing ) { for ( let i = stack.length - 1; i > 0; i-- ) { if ( stack[i].tag === tag ) { stack.length = i; break; } } continue; }
		const attrs = parseAttrs( m[3] );
		const node: HtmlNode = {
			tag, attrs,
			classes: ( attrs.class || '' ).split( /\s+/ ).filter( Boolean ),
			id: attrs.id || '', children: [], text: '',
		};
		top.children.push( node );
		const selfClose = m[4] === '/' || VOID_TAGS.has( tag ) || tag === 'style' || tag === 'script';
		if ( ! selfClose ) stack.push( node );
		// swallow raw text inside style/script so it is not mis-parsed
		if ( tag === 'style' || tag === 'script' ) { const end = html.indexOf( `</${ tag }>`, re.lastIndex ); if ( end >= 0 ) re.lastIndex = end + tag.length + 3; }
	}
	return root;
}

interface CssRule { selector: string; decls: string; spec: number; order: number; }

/** Parse a stylesheet → flat rule list. Skips @-rules and pseudo/nth selectors (decorative). */
function parseCSS( css: string ): CssRule[] {
	const rules: CssRule[] = []; let order = 0;
	const body = css.replace( /\/\*[\s\S]*?\*\//g, '' ).replace( /@(media|supports|keyframes|font-face)[^{]*\{[\s\S]*?\}\s*\}/g, '' ).replace( /@import[^;]*;/g, '' );
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let m: RegExpExecArray | null;
	while ( ( m = re.exec( body ) ) ) {
		const decls = m[2].trim();
		for ( const sel of m[1].split( ',' ) ) {
			const s = sel.trim();
			if ( ! s || s.startsWith( '@' ) || /[:>~+*]|::|\[/.test( s ) ) continue; // skip at-rules (@property/@font-face), pseudo, unmodeled combinators, attr sels
			const spec = ( s.match( /#/g )?.length ?? 0 ) * 100 + ( s.match( /\./g )?.length ?? 0 ) * 10 + ( s.replace( /\.[\w-]+/g, '' ).match( /[a-z]/gi )?.length ? 1 : 0 );
			rules.push( { selector: s, decls, spec, order: order++ } );
		}
	}
	return rules;
}

/** Does a single compound (e.g. `.feat`, `h2`, `.feat__grid`) match this node? */
function matchCompound( comp: string, node: HtmlNode ): boolean {
	const tagM = comp.match( /^[a-z][\w-]*/i );
	const classes = comp.match( /\.[\w-]+/g )?.map( ( c ) => c.slice( 1 ) ) ?? [];
	if ( ! tagM && classes.length === 0 ) return false; // never universally match
	if ( tagM && node.tag !== tagM[0].toLowerCase() ) return false;
	return classes.every( ( c ) => node.classes.includes( c ) );
}

/** Resolve applied declarations for a node given its ancestor chain (descendant combinator only). */
function appliedDecls( node: HtmlNode, ancestors: HtmlNode[], rules: CssRule[] ): string {
	const chain = [ ...ancestors, node ];
	const winners = rules.filter( ( r ) => {
		const comps = r.selector.split( /\s+/ );
		if ( ! matchCompound( comps[ comps.length - 1 ], node ) ) return false;
		// every earlier compound must match some ancestor, in order
		let ci = 0;
		for ( let k = 0; k < comps.length - 1; k++ ) {
			while ( ci < chain.length - 1 && ! matchCompound( comps[k], chain[ ci ] ) ) ci++;
			if ( ci >= chain.length - 1 ) return false;
			ci++;
		}
		return true;
	} ).sort( ( a, b2 ) => a.spec - b2.spec || a.order - b2.order );
	return winners.map( ( r ) => r.decls ).join( '; ' );
}

const HEADING_TAGS: Record< string, number > = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };

function nodeHasText( n: HtmlNode ): boolean {
	return !! n.text || n.children.some( nodeHasText );
}

/** Map a node (and subtree) to Blicks block markup. Pushes human-facing warnings. */
function mapNode( node: HtmlNode, ancestors: HtmlNode[], rules: CssRule[], vars: Record< string, string >, warn: string[], depth = 0 ): string | null {
	const declRaw = resolveVars( appliedDecls( node, ancestors, rules ), vars );
	const { tree, leftover } = cssX( declRaw );
	const kids = [ ...ancestors, node ];
	const label = node.tag + ( node.classes.length ? '.' + node.classes.join( '.' ) : '' );
	if ( leftover.length ) warn.push( `${ label }: dropped unmapped CSS → ${ leftover.join( '; ' ) }` );

	// Heading
	if ( HEADING_TAGS[ node.tag ] ) {
		const level = HEADING_TAGS[ node.tag ];
		return el( 'heading', 'heading', node.tag, { blicks: tree, attrs: { level, content: node.text }, inner: node.text } );
	}
	// Text-ish leaves — skip empty/whitespace-only ones (decorative spans, pseudo-element hooks).
	if ( node.tag === 'p' || node.tag === 'span' || node.tag === 'li' || node.tag === 'small' || node.tag === 'strong' || node.tag === 'em' ) {
		if ( ! node.text.trim() && ! node.children.length ) return null;
		return el( 'text', 'text', 'p', { blicks: tree, attrs: { content: node.text }, inner: node.text } );
	}
	if ( node.tag === 'a' || node.tag === 'button' ) {
		warn.push( `${ label }: emitted as text — convert to blicks/button by hand (href=${ node.attrs.href ?? '' }).` );
		return el( 'text', 'text', 'p', { blicks: tree, attrs: { content: node.text }, inner: node.text } );
	}
	if ( node.tag === 'img' || node.tag === 'svg' || node.tag === 'canvas' || node.tag === 'video' ) {
		warn.push( `${ label }: media node skipped — add a blicks/image by hand.` );
		return null;
	}

	// Decorative subtree (no text anywhere) → flatten to one placeholder box, don't descend.
	if ( ! nodeHasText( node ) && node.children.length ) {
		warn.push( `${ label }: decorative subtree flattened to one box — rebuild art via Custom CSS on the section.` );
		return el( 'box', 'box', 'div', { blicks: tree, inner: '' } );
	}
	// Containers
	const childMarkup = node.children.map( ( c ) => mapNode( c, kids, rules, vars, warn, depth + 1 ) ).filter( Boolean ).join( '\n\n' );
	const display = ( declRaw.match( /display\s*:\s*([\w-]+)/ )?.[1] ) || '';
	if ( node.tag === 'section' && depth === 0 ) {
		return dynamic( 'section', { blicks: tree, attrs: { sectionSpace: 'lg' }, inner: childMarkup } );
	}
	const slug = display === 'flex' ? 'stack' : 'box';
	return el( slug, slug, 'div', { blicks: tree, inner: childMarkup } );
}

/** Parse `:root { --x: v }` declarations into a flat map (last wins). */
function parseRootVars( css: string ): Record< string, string > {
	const out: Record< string, string > = {};
	css = css.replace( /\/\*[\s\S]*?\*\//g, '' ); // strip comments so they don't swallow the next var
	const re = /:root\s*\{([^}]*)\}/g; let m: RegExpExecArray | null;
	while ( ( m = re.exec( css ) ) ) {
		for ( const d of m[1].split( ';' ) ) { const i = d.indexOf( ':' ); if ( i < 0 ) continue; const k = d.slice( 0, i ).trim(); const v = d.slice( i + 1 ).trim(); if ( k.startsWith( '--' ) ) out[ k ] = v; }
	}
	return out;
}

/** Replace var(--x[, fallback]) with resolved literals (recursive, depth-capped). */
function resolveVars( value: string, vars: Record< string, string >, depth = 0 ): string {
	if ( depth > 8 || ! value.includes( 'var(' ) ) return value;
	const out = value.replace( /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, ( _all, name, fb ) => {
		if ( vars[ name ] !== undefined ) return vars[ name ];
		return fb !== undefined ? fb.trim() : `var(${ name })`;
	} );
	return resolveVars( out, vars, depth + 1 );
}

function phpPattern( title: string, desc: string, keywords: string[], content: string, warnings: string[] = [] ): string {
	const esc = content.replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" );
	const kw = keywords.map( ( k ) => `'${ k }'` ).join( ', ' );
	const warnBlock = warnings.length
		? ' *\n * SCAFFOLD WARNINGS — review before shipping:\n' + warnings.map( ( w ) => ' *   - ' + w.replace( /\*\//g, '* /' ) ).join( '\n' ) + '\n'
		: ' * No scaffold warnings.\n';
	return `<?php
/**
 * Pattern: ${ title } (scaffolded from a mockup via specimen-gen.test.ts htmlToPattern).
 * Decorative art is flattened to placeholder boxes — finish it via Custom CSS on the section.
${ warnBlock } */
declare(strict_types=1);

return [
\t'title'       => __('${ title }', 'blicks'),
\t'description' => __('${ desc }', 'blicks'),
\t'keywords'    => [${ kw }],
\t'content'     => '${ esc }',
];
`;
}

/** End-to-end: mockup HTML + base CSS → pattern markup + warnings. */
function htmlToPattern( html: string, baseCss: string ): { content: string; warnings: string[] } {
	const styleBlocks = [ ...html.matchAll( /<style[^>]*>([\s\S]*?)<\/style>/g ) ].map( ( m ) => m[1] ).join( '\n' );
	const allCss = baseCss + '\n' + styleBlocks;
	const vars = parseRootVars( allCss );
	const rules = parseCSS( allCss );
	const root = parseHTML( html );
	const section = ( function find( n: HtmlNode ): HtmlNode | null { if ( n.tag === 'section' ) return n; for ( const c of n.children ) { const r = find( c ); if ( r ) return r; } return null; } )( root );
	const warnings: string[] = [];
	const content = section ? mapNode( section, [], rules, vars, warnings, 0 ) ?? '' : '';
	return { content, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Container blocks (stack / grid / buttons) emit ATTR-DERIVED vars as DEFAULTS, then
// spread the blicks-tree vars on top (blockProps.style spreads last in render()). So
// save() = { ...attrVars, ...blicksVars } with blicks winning per-key + utility classes.
// These helpers mirror that exactly — anything else recovers on insert.
// ─────────────────────────────────────────────────────────────────────────────
function serializeStyle( style: Record< string, string > ): string {
	const e = Object.entries( style );
	return e.length ? ' style="' + e.map( ( [ k, v ] ) => `${ k }:${ v }` ).join( ';' ) + '"' : '';
}
function container( name: string, attrVars: Record< string, string >, blicks: any, settingsAttrs: any, inner: string ): string {
	const built = buildElementStyle( blicks || {}, {} );
	const style = { ...attrVars, ...( built.vars || {} ) }; // blicks overrides attr defaults in place; new keys appended
	const cls = [ `bl-${ name }`, ...built.classes ].join( ' ' );
	return `<!-- wp:blicks/${ name }${ attrsJson( blicks, settingsAttrs ) } -->
<div class="${ cls }"${ serializeStyle( style ) }>${ inner }</div>
<!-- /wp:blicks/${ name } -->`;
}

const sp = ( token: string ) => `var(--blicks-spacing-${ token })`;

/** Stack: 6 attr-default vars (orientation/gap/align/justify/wrap), then blicks overrides. */
function stackBlock( o: any = {} ): string {
	const orientation = o.orientation ?? 'vertical', gap = o.gap ?? 'md', align = o.align ?? 'stretch', justify = o.justify ?? 'start', wrap = o.wrap ?? false;
	const attrVars = {
		'--bl-fd': orientation === 'horizontal' ? 'row' : 'column',
		'--bl-gap-r': sp( gap ), '--bl-gap-c': sp( gap ),
		'--bl-ai': align === 'stretch' ? 'stretch' : align, // default 'stretch'
		'--bl-jc': justify === 'start' ? 'flex-start' : justify, // default 'start' → flex-start
		'--bl-fw': wrap ? 'wrap' : 'nowrap',
	};
	const a: any = {};
	if ( orientation !== 'vertical' ) a.orientation = orientation;
	if ( gap !== 'md' ) a.gap = gap;
	if ( align !== 'stretch' ) a.align = align;
	if ( justify !== 'start' ) a.justify = justify;
	if ( wrap !== false ) a.wrap = wrap;
	return container( 'stack', attrVars, o.blicks || {}, a, o.inner ?? '' );
}

/** Grid: --bl-cols/grid-min/gap-r/gap-c from attrs (gap fixed md; override gap via blicks layout.gap*). */
function gridBlock( o: any = {} ): string {
	const columns = o.columns ?? 3, autoFit = o.autoFit ?? false, min = o.min ?? '16rem';
	const attrVars = {
		'--bl-cols': autoFit ? 'repeat(auto-fit, minmax(var(--bl-grid-min, 16rem), 1fr))' : `repeat(${ columns }, minmax(0, 1fr))`,
		'--bl-grid-min': min, '--bl-gap-r': sp( 'md' ), '--bl-gap-c': sp( 'md' ),
	};
	const a: any = {};
	if ( columns !== 3 ) a.columns = columns;
	if ( autoFit ) a.autoFit = true;
	if ( min !== '16rem' ) a.minColumnWidth = min;
	return container( 'grid', attrVars, o.blicks || {}, a, o.inner ?? '' );
}

/** Buttons: 5 attr-default vars (no --bl-ai). Defaults: row / gap sm / flex-start / wrap. */
function buttonsBlock( o: any = {} ): string {
	const orientation = o.orientation ?? 'horizontal', gap = o.gap ?? 'sm', justify = o.justify ?? 'flex-start', wrap = o.wrap ?? true;
	const attrVars = {
		'--bl-fd': orientation === 'vertical' ? 'column' : 'row',
		'--bl-gap-r': sp( gap ), '--bl-gap-c': sp( gap ),
		'--bl-jc': justify, '--bl-fw': wrap ? 'wrap' : 'nowrap',
	};
	const a: any = {};
	if ( orientation !== 'horizontal' ) a.orientation = orientation;
	if ( gap !== 'sm' ) a.gap = gap;
	if ( justify !== 'flex-start' ) a.justify = justify;
	if ( wrap !== true ) a.wrap = wrap;
	return container( 'buttons', attrVars, o.blicks || {}, a, o.inner ?? '' );
}

/** Button: <a class="bl-button bl-button--{variant} bl-button--{size}-size" href><span>label</span></a>. */
function button( text: string, url = '#', variant = 'default', size = 'default' ): string {
	const a: any = { text, url };
	if ( variant !== 'default' ) a.variant = variant;
	if ( size !== 'default' ) a.size = size;
	return `<!-- wp:blicks/button ${ JSON.stringify( a ) } -->
<a class="bl-button bl-button--${ variant } bl-button--${ size }-size" href="${ url }"><span class="bl-button__label">${ text }</span></a>
<!-- /wp:blicks/button -->`;
}

const C = { bg: '#0b0b14', dim: '#9aa0b5', line: '#2a2a3a', fg: '#ece9ff' };
const N = { ink2: '#14141f', line: '#23232f', dim: '#9aa0b5', num: '#f59e0b', glow: 'rgba(99,102,241,0.5)', fg: '#ece9ff' };

function specimen01(): string {
	const eyebrow = el( 'text', 'text', 'p', {
		blicks: {
			'typography.textTransform': b( 'uppercase' ),
			'typography.letterSpacing': b( '0.14em' ),
			'typography.fontSize': b( '0.8rem' ),
			'colors.text': b( C.dim ),
		},
		attrs: { content: 'Specimen 01 — Hero' },
		inner: 'Specimen 01 — Hero',
	} );
	const title = el( 'heading', 'heading', 'h1', {
		blicks: {
			'typography.fontSize': b( 'clamp(2.5rem, 6vw, 5.5rem)' ),
			'typography.lineHeight': b( '1.05' ),
			'typography.fontWeight': b( '600' ),
			'typography.textAlign': b( 'center' ),
			'background.gradient': b( {
				type: 'linear', angle: '100deg',
				stops: [
					{ color: '#8b5cf6', position: '0%' },
					{ color: '#6366f1', position: '35%' },
					{ color: '#ec4899', position: '70%' },
					{ color: '#f59e0b', position: '100%' },
				],
			} ),
			'colors.clipText': b( true ),
		},
		attrs: { level: 1, content: 'Designed in the dark, rendered in light.' },
		inner: 'Designed in the dark, rendered in light.',
	} );
	const chip = el( 'box', 'box', 'div', {
		blicks: {
			'border.width': b( { top: '1px', right: '1px', bottom: '1px', left: '1px' } ),
			'border.style': b( 'solid' ),
			'border.color': b( C.line ),
			'border.radius': b( { topLeft: '99px', topRight: '99px', bottomRight: '99px', bottomLeft: '99px' } ),
			'spacing.padding': b( { top: '0.4rem', right: '0.9rem', bottom: '0.4rem', left: '0.9rem' } ),
			'typography.textTransform': b( 'uppercase' ),
			'typography.letterSpacing': b( '0.12em' ),
			'typography.fontSize': b( '0.72rem' ),
			'effects.backdropFilter': b( { blur: '8px' } ),
		},
		inner: el( 'text', 'text', 'p', { attrs: { content: 'Now in private beta' }, inner: 'Now in private beta' } ),
	} );
	const para = el( 'text', 'text', 'p', {
		blicks: { 'colors.text': b( C.dim ), 'layout.width': b( '46ch' ) },
		attrs: { content: 'A kinetic headline masked from a moving gradient, lit by blurred orbs that drift on their own timeline. Zero images, zero JavaScript.' },
		inner: 'A kinetic headline masked from a moving gradient, lit by blurred orbs that drift on their own timeline. Zero images, zero JavaScript.',
	} );
	const foot = stackBlock( {
		blicks: {
			'layout.flexDirection': b( 'row' ),
			'layout.justifyContent': b( 'space-between' ),
			'layout.alignItems': b( 'flex-end' ),
			'layout.flexWrap': b( 'wrap' ),
			'layout.gapRow': b( 'var(--blicks-spacing-md)' ),
			'layout.gapColumn': b( 'var(--blicks-spacing-md)' ),
		},
		inner: chip + '\n\n' + para,
	} );
	const stack = stackBlock( {
		blicks: { 'layout.gapRow': b( 'var(--blicks-spacing-lg)' ), 'layout.gapColumn': b( 'var(--blicks-spacing-lg)' ) },
		inner: [ eyebrow, title, foot ].join( '\n\n' ),
	} );
	return dynamic( 'section', {
		blicks: {
			'colors.background': b( C.bg ),
			'colors.text': b( C.fg ),
			'layout.overflow': b( 'hidden' ),
			'position.type': b( 'relative' ),
		},
		attrs: { sectionSpace: 'lg' },
		inner: stack,
	} );
}

/** A single bento tile: numbered eyebrow + heading + body, stacked, with col/row span. */
function bentoCard( o: {
	num: string;
	title: string;
	body: string;
	colSpan: number;
	rowSpan?: number;
	gradient?: any;
} ): string {
	const num = el( 'text', 'text', 'p', {
		blicks: css( `text-transform:uppercase; letter-spacing:0.2em; font-size:0.72rem; color:${ N.num }` ),
		attrs: { content: o.num }, inner: o.num,
	} );
	const title = el( 'heading', 'heading', 'h3', {
		blicks: css( 'font-size:clamp(1.1rem, 2vw, 1.5rem); line-height:1.2; font-weight:600' ),
		attrs: { level: 3, content: o.title }, inner: o.title,
	} );
	const body = el( 'text', 'text', 'p', {
		blicks: css( `color:${ N.dim }` ), attrs: { content: o.body }, inner: o.body,
	} );
	const inner = stackBlock( {
		blicks: css( 'gap:var(--blicks-spacing-sm)' ),
		inner: [ num, title, body ].join( '\n\n' ),
	} );
	let card = css( `background:${ N.ink2 }; border:1px solid ${ N.line }; border-radius:12px; padding:1.6rem; overflow:hidden; position:relative; grid-column:span ${ o.colSpan }` );
	if ( o.rowSpan ) card = { ...card, ...css( `grid-row:span ${ o.rowSpan }` ) };
	if ( o.gradient ) card = { ...card, ...css( `background-image:${ o.gradient }` ) };
	return el( 'box', 'box', 'div', { blicks: card, inner } );
}

function specimen02(): string {
	const glow = 'radial-gradient(130% 130% at 100% 0%, rgba(99,102,241,0.55) 0%, transparent 55%)';
	const accentViolet = 'radial-gradient(120% 120% at 0% 100%, rgba(139,92,246,0.4) 0%, transparent 60%)';
	const accentPink = 'radial-gradient(120% 120% at 100% 100%, rgba(236,72,153,0.38) 0%, transparent 60%)';

	const heading = el( 'heading', 'heading', 'h2', {
		blicks: css( 'font-size:clamp(1.8rem, 4vw, 3rem); line-height:1.1; font-weight:600' ),
		attrs: { level: 2, content: 'Everything, in its cell.' }, inner: 'Everything, in its cell.',
	} );
	const lede = el( 'text', 'text', 'p', {
		blicks: css( `color:${ N.dim }; width:32ch` ),
		attrs: { content: 'Six tiles, three sizes, one grid — headers and footers align across every card no matter the body length.' },
		inner: 'Six tiles, three sizes, one grid — headers and footers align across every card no matter the body length.',
	} );
	const head = stackBlock( {
		blicks: css( 'flex-direction:row; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:var(--blicks-spacing-md)' ),
		inner: heading + '\n\n' + lede,
	} );

	const cards = [
		bentoCard( { num: '01 / Platform', title: 'The operating layer for ambitious teams', body: 'One surface where data, design and decisions live together — and stay aligned by construction.', colSpan: 4, rowSpan: 2, gradient: glow } ),
		bentoCard( { num: '02 / Speed', title: 'Sub-second everything', body: 'Edge-rendered, cache-aware, built to feel instant on the worst connection in the room.', colSpan: 2, rowSpan: 2, gradient: accentViolet } ),
		bentoCard( { num: '03', title: 'Secure by default', body: 'SOC 2, SSO, audit trails.', colSpan: 2 } ),
		bentoCard( { num: '04', title: 'Composable', body: 'Bring your own blocks.', colSpan: 2 } ),
		bentoCard( { num: '05 / Insight', title: 'Reports that read themselves', body: 'Plain-language summaries on top of every dashboard.', colSpan: 3 } ),
		bentoCard( { num: '06 / Scale', title: 'From seed to series F', body: 'The same surface, from your first user to your ten-millionth.', colSpan: 3, gradient: accentPink } ),
	].join( '\n\n' );
	const bento = gridBlock( { columns: 6, inner: cards } );

	const stack = stackBlock( {
		blicks: css( 'gap:var(--blicks-spacing-xl)' ),
		inner: head + '\n\n' + bento,
	} );
	return dynamic( 'section', {
		blicks: css( `background:${ C.bg }; color:${ N.fg }; position:relative` ),
		attrs: { sectionSpace: 'lg' }, inner: stack,
	} );
}

function php( content: string ): string {
	const esc = content.replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" );
	return `<?php
/**
 * Pattern: Hero — kinetic mask (nocturne specimen 01). Generated from value-trees via the style
 * engine (scripts/specimen — see git history). Target: mockups/specimens/01-hero-mask.html
 */
declare(strict_types=1);

return [
\t'title'       => __('Hero — kinetic mask', 'blicks'),
\t'description' => __('A nocturne hero: gradient-masked headline, eyebrow, status chip, and supporting text.', 'blicks'),
\t'keywords'    => ['hero', 'gradient', 'mask', 'nocturne', 'header'],
\t'content'     => '${ esc }',
];
`;
}

function php02( content: string ): string {
	const esc = content.replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" );
	return `<?php
/**
 * Pattern: Bento grid (nocturne specimen 02). Generated from value-trees via the style engine
 * (resources/framework/css/specimen-gen.test.ts). Target: mockups/specimens/02-bento.html
 */
declare(strict_types=1);

return [
\t'title'       => __('Bento — subgrid cells', 'blicks'),
\t'description' => __('A six-tile bento grid in three sizes: numbered eyebrows, headings, body copy, and radial-glow accents.', 'blicks'),
\t'keywords'    => ['bento', 'grid', 'features', 'cards', 'nocturne'],
\t'content'     => '${ esc }',
];
`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Pattern library — a cohesive modern dark landing-page set. Authored directly
// (design + content + css), emitted through the real style engine so saved markup
// == save() byte-for-byte. gated by GEN_SPECIMENS like the specimens above.
// ═════════════════════════════════════════════════════════════════════════════
const M = {
	bg: '#08080c', surface: '#0e0e16', surface2: '#13131d', line: '#23232f', lineSoft: '#1a1a24',
	text: '#f4f4f7', dim: '#9a9aac', faint: '#65656f',
	brand: '#7c6cff', brand2: '#a855f7', accent: '#22d3ee', rose: '#fb7185', gold: '#fbbf24',
};
const G = 'linear-gradient(105deg, #a78bfa 0%, #7c6cff 38%, #d946ef 72%, #fb7185 100%)';
const phpLib = ( title: string, desc: string, kw: string[], content: string ): string => {
	const esc = content.replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" );
	return `<?php
/**
 * Pattern: ${ title }. Authored via the Blicks style engine (resources/framework/css/specimen-gen.test.ts)
 * so saved markup matches save() byte-for-byte — inserts without recovery.
 */
declare(strict_types=1);

return [
\t'title'       => __('${ title }', 'blicks'),
\t'description' => __('${ desc }', 'blicks'),
\t'keywords'    => [${ kw.map( ( k ) => `'${ k }'` ).join( ', ' ) }],
\t'content'     => '${ esc }',
];
`;
};

const txt = ( content: string, decls: string, tag = 'p' ) => el( 'text', 'text', tag, { blicks: css( decls ), attrs: { content }, inner: content } );
const heading = ( level: number, content: string, decls: string, extra: any = {} ) =>
	el( 'heading', 'heading', `h${ level }`, { blicks: { ...css( decls ), ...extra }, attrs: { level, content }, inner: content } );
const boxEl = ( decls: string, inner: string ) => el( 'box', 'box', 'div', { blicks: css( decls ), inner } );

const eyebrow = ( t: string ) => txt( t, `text-transform:uppercase; letter-spacing:0.24em; font-size:0.76rem; font-weight:600; color:${ M.brand2 }` );
const chip = ( t: string ) => boxEl(
	`border:1px solid ${ M.line }; border-radius:99px; padding:0.4rem 0.95rem; backdrop-filter:blur(8px)`,
	txt( t, `text-transform:uppercase; letter-spacing:0.16em; font-size:0.72rem; color:${ M.dim }` ),
);
const gradHead = ( level: number, t: string, size: string ) =>
	heading( level, t, `background-image:${ G }; font-size:${ size }; line-height:1.04; font-weight:600; letter-spacing:-0.02em`, { 'colors.clipText': b( true ) } );
const lede = ( t: string, decls = '' ) => txt( t, `color:${ M.dim }; line-height:1.65; font-size:1.05rem${ decls }` );
const iconTile = ( glyph: string, grad: string ) => el( 'box', 'box', 'div', {
	blicks: css( `background-image:${ grad }; border-radius:12px; width:46px; height:46px; display:grid; place-items:center` ),
	inner: txt( glyph, 'color:#ffffff; font-size:1.15rem; line-height:1' ),
} );
const sectionDark = ( inner: string, attrs: any = { sectionSpace: 'lg' }, extra = '' ) =>
	dynamic( 'section', { blicks: css( `background:${ M.bg }; color:${ M.text }; position:relative${ extra }` ), attrs, inner } );

function patHero(): string {
	const cta = buttonsBlock( { gap: 'sm', justify: 'center', inner: button( 'Start free', '#', 'default' ) + '\n\n' + button( 'Book a demo', '#', 'outline' ) } );
	const inner = stackBlock( {
		align: 'center', gap: 'lg',
		inner: [
			chip( 'Now in public beta' ),
			gradHead( 1, 'Ship interfaces that feel inevitable.', 'clamp(2.6rem, 1.5rem + 5vw, 5.2rem)' ),
			lede( 'Compose clean, theme-native layouts from editable primitives — no page-builder lock-in, no relearning, no bloat.', '; text-align:center; width:54ch' ),
			cta,
		].join( '\n\n' ),
	} );
	return sectionDark( inner, { sectionSpace: 'lg' }, '; overflow:hidden' );
}

function patLogos(): string {
	const logos = [ 'NOVAMIRA', 'HELION', 'KESTREL', 'AURELIA', 'NIGHTSHIFT', 'OBSIDIAN' ]
		.map( ( n ) => txt( n, `color:${ M.faint }; font-weight:600; letter-spacing:0.12em; font-size:0.95rem` ) ).join( '\n\n' );
	const row = stackBlock( { orientation: 'horizontal', wrap: true, blicks: css( 'gap:2.6rem; justify-content:center; align-items:center' ), inner: logos } );
	const inner = stackBlock( { align: 'center', gap: 'md', inner: txt( 'Trusted by teams shipping after dark', `text-transform:uppercase; letter-spacing:0.22em; font-size:0.74rem; color:${ M.dim }; text-align:center` ) + '\n\n' + row } );
	return sectionDark( inner, { sectionSpace: 'lg' } );
}

function featureCard( glyph: string, grad: string, title: string, body: string ): string {
	const inner = stackBlock( { gap: 'md', inner: [ iconTile( glyph, grad ), heading( 3, title, `font-size:1.2rem; line-height:1.25; font-weight:600; color:${ M.text }` ), lede( body ) ].join( '\n\n' ) } );
	return boxEl( `background:${ M.surface }; border:1px solid ${ M.line }; border-radius:16px; padding:1.75rem; overflow:hidden; position:relative`, inner );
}
function patFeatures(): string {
	const header = stackBlock( { gap: 'sm', inner: [ eyebrow( 'Why Blicks' ), gradHead( 2, 'Primitives, not page-builders.', 'clamp(1.9rem, 1.2rem + 2.6vw, 3.2rem)' ), lede( 'Every block is a thin, composable trait on a shadcn-style design system. Style once, reuse everywhere.', '; width:46ch' ) ].join( '\n\n' ) } );
	const cards = [
		featureCard( '◇', 'linear-gradient(135deg, #7c6cff, #a855f7)', 'Token-first styling', 'Values resolve to theme.json tokens — your brand, not ours. Restyle the whole site from Global Styles.' ),
		featureCard( '⚡', 'linear-gradient(135deg, #22d3ee, #7c6cff)', 'Sub-second output', 'Class-first CSS in three tiers. No inline-style soup, no runtime, clean markup that ships fast.' ),
		featureCard( '◈', 'linear-gradient(135deg, #d946ef, #fb7185)', 'Nesting-safe', 'Every block initializes its own instance vars — nested blocks never leak styles into each other.' ),
		featureCard( '⬡', 'linear-gradient(135deg, #fbbf24, #fb7185)', 'FSE-native', 'theme.json is the source of truth. The default theme is a projection of the active theme.' ),
		featureCard( '⟁', 'linear-gradient(135deg, #34d399, #22d3ee)', 'Hybrid render', 'One universal CSS pipeline serves static and dynamic blocks alike via a single render filter.' ),
		featureCard( '✦', 'linear-gradient(135deg, #a855f7, #7c6cff)', 'Zero relearning', 'Build any UI in the market with the cleanest output and the least relearning. Promise.' ),
	].join( '\n\n' );
	return sectionDark( stackBlock( { blicks: css( 'gap:2.6rem' ), inner: header + '\n\n' + gridBlock( { columns: 3, inner: cards } ) } ) );
}

function stat( num: string, label: string ): string {
	return stackBlock( { gap: 'xs', blicks: css( 'gap:0.4rem' ), inner: gradHead( 2, num, 'clamp(2.4rem, 1.6rem + 2.6vw, 3.6rem)' ) + '\n\n' + txt( label, `color:${ M.dim }; font-size:0.95rem` ) } );
}
function patStats(): string {
	const header = stackBlock( { align: 'center', gap: 'sm', inner: [ eyebrow( 'By the numbers' ), heading( 2, 'Built for scale from day one.', `font-size:clamp(1.8rem, 1.2rem + 2.2vw, 2.8rem); line-height:1.1; font-weight:600; letter-spacing:-0.02em; color:${ M.text }; text-align:center` ) ].join( '\n\n' ) } );
	const grid = gridBlock( { columns: 4, inner: [ stat( '99.99%', 'Uptime SLA' ), stat( '4,000+', 'Teams shipping' ), stat( '120ms', 'P95 render' ), stat( '0', 'Lines of jQuery' ) ].join( '\n\n' ) } );
	return sectionDark( stackBlock( { blicks: css( 'gap:2.6rem' ), inner: header + '\n\n' + grid } ) );
}

function priceFeature( t: string ): string { return txt( '✓  ' + t, `color:${ M.dim }; font-size:0.95rem; line-height:1.5` ); }
function priceCard( tier: string, price: string, blurb: string, feats: string[], cta: string, featured: boolean ): string {
	const list = stackBlock( { gap: 'sm', blicks: css( 'gap:0.7rem' ), inner: feats.map( priceFeature ).join( '\n\n' ) } );
	const priceRow = stackBlock( { orientation: 'horizontal', gap: 'xs', blicks: css( 'align-items:flex-end; gap:0.35rem' ), inner: gradHead( 2, price, '2.8rem' ) + '\n\n' + txt( '/mo', `color:${ M.dim }; font-size:0.95rem` ) } );
	const head = stackBlock( { gap: 'sm', inner: [ txt( tier, `text-transform:uppercase; letter-spacing:0.16em; font-size:0.78rem; font-weight:600; color:${ featured ? M.brand2 : M.dim }` ), priceRow, txt( blurb, `color:${ M.dim }; font-size:0.92rem` ) ].join( '\n\n' ) } );
	const btn = buttonsBlock( { gap: 'sm', blicks: css( 'justify-content:stretch' ), inner: button( featured ? 'Start free trial' : 'Choose plan', '#', featured ? 'default' : 'outline' ) } );
	const border = featured ? M.brand : M.line;
	const bg = featured ? `${ M.surface2 }; background-image:radial-gradient(120% 80% at 50% 0%, rgba(124,108,255,0.18), transparent 60%)` : M.surface;
	return boxEl( `background:${ bg }; border:1px solid ${ border }; border-radius:18px; padding:1.9rem; overflow:hidden; position:relative`, [ head, list, btn ].join( '\n\n' ) );
}
function patPricing(): string {
	const header = stackBlock( { align: 'center', gap: 'sm', inner: [ eyebrow( 'Pricing' ), gradHead( 2, 'Simple, honest, scales with you.', 'clamp(1.9rem, 1.2rem + 2.6vw, 3.2rem)' ), lede( 'Start free. Upgrade when your team does. No seats games, no surprise invoices.', '; text-align:center; width:44ch' ) ].join( '\n\n' ) } );
	const cards = [
		priceCard( 'Starter', '$0', 'For solo builders and side projects.', [ 'Up to 3 projects', 'Core block library', 'Community support' ], '', false ),
		priceCard( 'Pro', '$29', 'For teams shipping in production.', [ 'Unlimited projects', 'Every block + pattern', 'Priority support', 'Custom design tokens' ], '', true ),
		priceCard( 'Scale', '$99', 'For agencies and platforms.', [ 'Everything in Pro', 'SSO + audit logs', 'Dedicated success engineer', 'SLA guarantee' ], '', false ),
	].join( '\n\n' );
	return sectionDark( stackBlock( { blicks: css( 'gap:2.6rem' ), inner: header + '\n\n' + gridBlock( { columns: 3, inner: cards } ) } ) );
}

function quoteCard( quote: string, name: string, role: string, grad: string ): string {
	const avatar = boxEl( `background-image:${ grad }; border-radius:99px; width:42px; height:42px`, '' );
	const who = stackBlock( { gap: 'xs', blicks: css( 'gap:0.1rem' ), inner: txt( name, `color:${ M.text }; font-weight:600; font-size:0.95rem` ) + '\n\n' + txt( role, `color:${ M.dim }; font-size:0.85rem` ) } );
	const author = stackBlock( { orientation: 'horizontal', gap: 'sm', blicks: css( 'align-items:center' ), inner: avatar + '\n\n' + who } );
	const inner = stackBlock( { gap: 'md', inner: [ txt( '★★★★★', `color:${ M.gold }; font-size:0.95rem; letter-spacing:0.15em` ), txt( quote, `color:${ M.text }; font-size:1.05rem; line-height:1.6` ), author ].join( '\n\n' ) } );
	return boxEl( `background:${ M.surface }; border:1px solid ${ M.line }; border-radius:16px; padding:1.6rem`, inner );
}
function patTestimonials(): string {
	const header = stackBlock( { gap: 'sm', inner: [ eyebrow( 'Loved in the dark' ), gradHead( 2, 'What night-shift teams say.', 'clamp(1.9rem, 1.2rem + 2.6vw, 3.2rem)' ) ].join( '\n\n' ) } );
	const cards = [
		quoteCard( 'We deleted our page builder and shipped a cleaner site in a weekend. The output is just HTML and tokens — finally.', 'Mara Vance', 'Eng lead, Helion', 'linear-gradient(135deg, #7c6cff, #d946ef)' ),
		quoteCard( 'The nesting-safe styling is the thing nobody else gets right. Drop a block anywhere and it just behaves.', 'Theo Park', 'Design systems, Kestrel', 'linear-gradient(135deg, #22d3ee, #7c6cff)' ),
		quoteCard( 'theme.json as the source of truth means our brand restyles the whole library in one move. Magic.', 'Iris Okonkwo', 'CTO, Aurelia', 'linear-gradient(135deg, #fbbf24, #fb7185)' ),
	].join( '\n\n' );
	return sectionDark( stackBlock( { blicks: css( 'gap:2.6rem' ), inner: header + '\n\n' + gridBlock( { columns: 3, inner: cards } ) } ) );
}

function patCta(): string {
	const cta = buttonsBlock( { gap: 'sm', justify: 'center', inner: button( 'Start building free', '#', 'default' ) + '\n\n' + button( 'Read the docs', '#', 'ghost' ) } );
	const band = boxEl(
		`background:${ M.surface }; background-image:radial-gradient(130% 130% at 50% 0%, rgba(124,108,255,0.38), transparent 60%); border:1px solid ${ M.line }; border-radius:24px; padding:3.5rem; overflow:hidden; position:relative`,
		stackBlock( { align: 'center', gap: 'md', inner: [
			heading( 2, 'Build something inevitable.', `font-size:clamp(2rem, 1.3rem + 2.6vw, 3.4rem); line-height:1.08; font-weight:600; letter-spacing:-0.02em; color:${ M.text }; text-align:center` ),
			lede( 'Join the teams composing cleaner interfaces with Blicks — free, open, and theme-native.', '; text-align:center; width:46ch' ),
			cta,
		].join( '\n\n' ) } ),
	);
	return sectionDark( band );
}

const LIBRARY: Array< [ string, string, string, string[], () => string ] > = [
	[ '01-hero', 'Hero — aurora', 'A dark hero: status chip, gradient headline, supporting copy, and dual CTA.', [ 'hero', 'header', 'cta', 'landing', 'gradient' ], patHero ],
	[ '02-logo-cloud', 'Logo cloud', 'A centered trust strip: eyebrow label and a wrapping row of wordmark logos.', [ 'logos', 'trust', 'social proof', 'brands' ], patLogos ],
	[ '03-feature-grid', 'Feature grid', 'A six-tile feature grid with gradient icon tiles, headings, and body copy.', [ 'features', 'grid', 'icons', 'bento' ], patFeatures ],
	[ '04-stats', 'Stats band', 'Four big gradient metrics with labels under a centered heading.', [ 'stats', 'metrics', 'numbers', 'kpi' ], patStats ],
	[ '05-pricing', 'Pricing tiers', 'Three pricing cards with a highlighted middle tier, feature lists, and CTAs.', [ 'pricing', 'plans', 'tiers', 'cta' ], patPricing ],
	[ '06-testimonials', 'Testimonials', 'Three quote cards with star ratings and author avatars.', [ 'testimonials', 'reviews', 'social proof', 'quotes' ], patTestimonials ],
	[ '07-cta', 'CTA — gradient band', 'A glowing gradient call-to-action band with heading, copy, and dual buttons.', [ 'cta', 'call to action', 'conversion', 'gradient' ], patCta ],
];
it( 'emits the pattern library', () => {
	for ( const [ slug, title, desc, kw, build ] of LIBRARY ) {
		const content = build();
		expect( content ).toContain( 'wp:blicks/section' );
		if ( process.env.GEN_SPECIMENS ) writeFileSync( resolve( `resources/patterns/${ slug }.php` ), phpLib( title, desc, kw, content ) );
	}
} );

// Dev tool, not an assertion of behavior: only writes the pattern file when GEN_SPECIMENS is set
// (`GEN_SPECIMENS=1 pnpm exec vitest run resources/framework/css/specimen-gen.test.ts`). On a normal
// `pnpm test` run it just sanity-checks the markup and writes nothing.
it( 'emits specimen 01', () => {
	const content = specimen01();
	if ( process.env.GEN_SPECIMENS ) {
		writeFileSync( resolve( 'resources/patterns/01-hero-mask.php' ), php( content ) );
	}
	expect( content ).toContain( 'wp:blicks/section' );
	expect( content ).toContain( 'bl-cliptext' );
} );

it( 'emits specimen 02', () => {
	const content = specimen02();
	if ( process.env.GEN_SPECIMENS ) {
		writeFileSync( resolve( 'resources/patterns/02-bento.php' ), php02( content ) );
	}
	expect( content ).toContain( 'wp:blicks/grid' );
	expect( content ).toContain( 'bl-gcs' );
	expect( content ).toContain( 'bl-grs' );
} );

// HTML → pattern scaffolder. Point it at any mockup:
//   SCAFFOLD=04-feature-diagonal pnpm exec vitest run resources/framework/css/specimen-gen.test.ts
// Writes resources/patterns/<slug>.php and prints warnings for nodes it could not map cleanly.
it( 'scaffolds a pattern from a mockup', () => {
	const slug = process.env.SCAFFOLD;
	if ( ! slug ) { expect( typeof htmlToPattern ).toBe( 'function' ); return; }
	const html = readFileSync( resolve( `mockups/specimens/${ slug }.html` ), 'utf8' );
	const baseCss = readFileSync( resolve( 'mockups/specimens/base.css' ), 'utf8' );
	const { content, warnings } = htmlToPattern( html, baseCss );
	const words = slug.replace( /^\d+-/, '' ).split( '-' );
	const title = words.map( ( w ) => w.charAt( 0 ).toUpperCase() + w.slice( 1 ) ).join( ' ' );
	writeFileSync(
		resolve( `resources/patterns/${ slug }.php` ),
		phpPattern( title, `Scaffolded from mockup ${ slug }.`, words, content, warnings ),
	);
	console.log( `\n[scaffold] wrote resources/patterns/${ slug }.php\n` + ( warnings.length ? warnings.map( ( w ) => '  ⚠ ' + w ).join( '\n' ) : '  (no warnings)' ) + '\n' );
	expect( content ).toContain( 'wp:blicks/section' );
} );
