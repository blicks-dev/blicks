/**
 * HTML → Blicks block-tree mapper (Mockup→Blicks, Phase B). Deterministic: walks pasted HTML, maps
 * each element to a Blicks block, and routes its inline CSS through the Phase-A analyzer — safe
 * single-value controls become `blicks` attributes (editable), everything else is preserved in the
 * block's scoped Custom CSS (always renders), with a fidelity report.
 *
 * Output is a plain `BlockDescriptor` tree (testable, no WP deps); the editor turns it into real
 * blocks via `createBlock()` (recovery-safe). v1 reads inline `style` only — matching a pasted
 * stylesheet to elements is a Phase B.1 follow-up.
 */
import { STYLE_MAP } from '@/framework/css/vars';
import { classifyDeclaration, parseDeclarations } from './css-coverage';

export interface BlockDescriptor {
	name: string;
	attributes: Record< string, any >;
	innerBlocks: BlockDescriptor[];
}

export interface ImportReport {
	nodes: number;
	/** Declarations that map to a Blicks control (whether or not auto-applied). */
	controlled: number;
	/** Declarations with no control (Custom CSS fallback). */
	custom: number;
	/** Declarations auto-applied as editable `blicks` attributes. */
	autoMapped: number;
	/** Distinct properties that fell back to Custom CSS. */
	fallback: string[];
}

// attr → rule shape, so we only auto-map controls whose value engine accepts a raw CSS string.
const ATTR_INFO = new Map< string, { kind: string; category?: string } >(
	STYLE_MAP.map( ( r ) => [ r.attr, { kind: r.kind, category: ( r as any ).category } ] )
);
const SAFE_CATEGORIES = new Set( [ 'color', 'fontSize', 'fontFamily' ] );

/** A control is safe to auto-apply from a raw value only if it's a plain `single` (or a known
 *  string-safe category). Structured controls (sides/corners/inset, gradients, transforms…) would
 *  need value-shaping, so they go to Custom CSS in v1 — correct render, just not yet a control. */
function isSafeSingle( attr: string ): boolean {
	const info = ATTR_INFO.get( attr );
	if ( ! info || info.kind !== 'single' ) {
		return false;
	}
	return info.category === undefined || SAFE_CATEGORIES.has( info.category );
}

export interface CssMapResult {
	blicks: Record< string, any >;
	customCss: string;
	controlled: number;
	custom: number;
	autoMapped: number;
	fallback: string[];
}

/** Convert a list of CSS declarations into `blicks` attrs (safe controls) + Custom CSS (the rest). */
export function cssToBlicks( declarations: Array< { property: string; value: string } > ): CssMapResult {
	const blicks: Record< string, any > = {};
	const customParts: string[] = [];
	const fallback: string[] = [];
	let controlled = 0;
	let custom = 0;
	let autoMapped = 0;

	for ( const { property, value } of declarations ) {
		const c = classifyDeclaration( property, value );
		if ( c.kind === 'control' ) {
			controlled++;
			if ( isSafeSingle( c.attr ) ) {
				blicks[ c.attr ] = { default: { base: value } };
				autoMapped++;
				continue;
			}
		} else {
			custom++;
		}
		customParts.push( `${ property }: ${ value }` );
		fallback.push( property );
	}

	const customCss = customParts.length ? `selector {\n\t${ customParts.join( ';\n\t' ) };\n}` : '';
	return { blicks, customCss, controlled, custom, autoMapped, fallback };
}

/** Map an element tag + its declared `display` to a Blicks block name (+ seed attributes). */
export function pickBlock(
	tag: string,
	declarations: Array< { property: string; value: string } >
): { name: string; extra?: Record< string, any > } {
	const t = tag.toLowerCase();
	if ( /^h[1-6]$/.test( t ) ) {
		return { name: 'blicks/heading', extra: { level: Number( t[ 1 ] ) } };
	}
	if ( t === 'p' ) {
		return { name: 'blicks/text' };
	}
	if ( t === 'ul' || t === 'ol' ) {
		return { name: 'blicks/list', extra: { marker: t === 'ol' ? 'decimal' : 'disc' } };
	}
	if ( t === 'li' ) {
		return { name: 'blicks/list-item' };
	}
	if ( t === 'img' ) {
		return { name: 'blicks/image' };
	}
	if ( t === 'hr' ) {
		return { name: 'blicks/divider' };
	}
	if ( t === 'button' ) {
		return { name: 'blicks/button' };
	}
	const display = ( declarations.find( ( d ) => d.property.toLowerCase() === 'display' )?.value ?? '' ).toLowerCase();
	if ( display.includes( 'grid' ) ) {
		return { name: 'blicks/grid' };
	}
	if ( display.includes( 'flex' ) ) {
		return { name: 'blicks/stack' };
	}
	return { name: 'blicks/box' };
}

/** Block names that carry their text as `content` (leaf text blocks). */
const TEXT_BLOCKS = new Set( [ 'blicks/heading', 'blicks/text', 'blicks/button' ] );

/** Browser-only: parse pasted HTML into a Blicks block-tree descriptor + a fidelity report. */
export function htmlToBlockTree( html: string ): { blocks: BlockDescriptor[]; report: ImportReport } {
	const report: ImportReport = { nodes: 0, controlled: 0, custom: 0, autoMapped: 0, fallback: [] };
	const doc = new DOMParser().parseFromString( String( html ?? '' ), 'text/html' );

	const walk = ( el: Element ): BlockDescriptor => {
		report.nodes++;
		const decls = parseDeclarations( el.getAttribute( 'style' ) || '' );
		const css = cssToBlicks( decls );
		report.controlled += css.controlled;
		report.custom += css.custom;
		report.autoMapped += css.autoMapped;
		css.fallback.forEach( ( p ) => { if ( ! report.fallback.includes( p ) ) report.fallback.push( p ); } );

		const { name, extra } = pickBlock( el.tagName, decls );
		const attributes: Record< string, any > = { ...( extra || {} ) };
		if ( Object.keys( css.blicks ).length ) {
			attributes.blicks = css.blicks;
		}
		if ( css.customCss ) {
			attributes.customCSS = css.customCss;
		}

		if ( name === 'blicks/image' ) {
			const src = el.getAttribute( 'src' );
			if ( src ) attributes.url = src;
			const alt = el.getAttribute( 'alt' );
			if ( alt ) attributes.alt = alt;
			return { name, attributes, innerBlocks: [] };
		}
		if ( TEXT_BLOCKS.has( name ) ) {
			const text = ( el.textContent || '' ).trim();
			attributes[ name === 'blicks/button' ? 'text' : 'content' ] = text;
			return { name, attributes, innerBlocks: [] };
		}

		// Container: recurse element children; loose text nodes become text blocks.
		const inner: BlockDescriptor[] = [];
		el.childNodes.forEach( ( node ) => {
			if ( node.nodeType === 1 ) {
				inner.push( walk( node as Element ) );
			} else if ( node.nodeType === 3 ) {
				const text = ( node.textContent || '' ).trim();
				if ( text ) {
					inner.push( { name: 'blicks/text', attributes: { content: text }, innerBlocks: [] } );
				}
			}
		} );
		return { name, attributes, innerBlocks: inner };
	};

	const blocks: BlockDescriptor[] = [];
	doc.body.childNodes.forEach( ( node ) => {
		if ( node.nodeType === 1 ) {
			blocks.push( walk( node as Element ) );
		} else if ( node.nodeType === 3 ) {
			const text = ( node.textContent || '' ).trim();
			if ( text ) {
				blocks.push( { name: 'blicks/text', attributes: { content: text }, innerBlocks: [] } );
			}
		}
	} );
	return { blocks, report };
}
