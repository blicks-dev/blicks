/**
 * CSS build/parse for the `blicks/text-style` inline format — the pure half of `text-style.tsx`.
 *
 * A styled selection is one `<span>` carrying an inline `style`. It holds **two independent
 * fills**: the text fill (painted into the glyphs) and the highlight (painted behind them). Both
 * live in the same background box, so they can only coexist as separate **background layers** —
 * see `buildStyle` for the rules that makes work.
 */
import { getValue } from '@/framework/values';
import { tokenOptions } from '@/controls/token-utils';
import { gradientCss } from '@/controls/color/gradient-css';

export type Target = 'text' | 'highlight';
/** One synthetic `blicks` value-tree per target, driven by a `ColorControl` each. */
export type Trees = Record< Target, any >;

export const EMPTY_TREES: Trees = { text: {}, highlight: {} };

/** A theme token slug resolves to its `var()`; anything else (hex/rgba) passes through. */
function toCss( value: string ): string {
	return tokenOptions( 'color' ).find( ( option ) => option.slug === value )?.css ?? value;
}

/** Wrap a raw value into the `{ <id>: { default: { base } } }` shape ColorControl reads/writes. */
function slot( value: unknown ) {
	return value === undefined || value === '' ? undefined : { default: { base: value } };
}

/** Split a CSS list on top-level separators — separators inside `rgba()` / `url()` don't count. */
export function splitTop( value: string, separator = ',' ): string[] {
	const out: string[] = [];
	let depth = 0;
	let quote = '';
	let current = '';
	for ( const char of value ) {
		if ( quote ) {
			if ( char === quote ) quote = '';
		} else if ( char === '"' || char === "'" ) {
			quote = char;
		} else if ( char === '(' ) {
			depth++;
		} else if ( char === ')' ) {
			depth--;
		} else if ( char === separator && depth === 0 ) {
			out.push( current );
			current = '';
			continue;
		}
		current += char;
	}
	out.push( current );
	return out.map( ( part ) => part.trim() ).filter( ( part ) => part !== '' );
}

/**
 * Compose the chosen fill into a CSS paint value from the synthetic background tree.
 * Priority mirrors the style engine: image → gradient → color.
 */
function fillFromTree( tree: any ): { paint: string; isImage: boolean; size?: string; position?: string } | null {
	const synth = { blicks: tree };
	const image = getValue( synth, 'background.image', 'default', 'base' ) as any;
	const gradient = getValue( synth, 'background.gradient', 'default', 'base' );
	const color = getValue( synth, 'colors.background', 'default', 'base' ) as string;

	if ( image?.url ) {
		return {
			paint: `url("${ image.url }")`,
			isImage: true,
			size: ( getValue( synth, 'background.size', 'default', 'base' ) as string ) || 'cover',
			position: ( getValue( synth, 'background.position', 'default', 'base' ) as string ) || 'center',
		};
	}
	// A theme gradient preset is stored as a bare slug; a customised one as a stops object.
	if ( gradient ) {
		return {
			paint: typeof gradient === 'string' ? `var(--blicks-gradient-${ gradient })` : gradientCss( gradient ),
			isImage: true,
		};
	}
	if ( color ) return { paint: toCss( color ), isImage: false };
	return null;
}

/**
 * Build the inline `style` for both fills at once.
 *
 * A gradient/image text fill and a highlight can share one span only through **background
 * layers**: `background-clip` takes one value per `background-image` layer, so layer 1 (the text
 * fill) is clipped to the glyphs while layer 2 (the highlight) still paints the whole box. Two
 * rules this depends on:
 *   - the clip list must have an entry per layer — a lone `text` repeats onto the highlight layer
 *     and clips that to the glyphs too;
 *   - a solid highlight cannot use `background-color`: that is clipped by the *last* layer's clip
 *     box, so next to a clipped layer it disappears. It becomes a flat gradient layer instead.
 * A *solid* text fill needs no layer at all — plain `color` paints the glyphs and leaves the
 * background box free, so the common no-clip output stays as simple as it was.
 */
export function buildStyle( trees: Trees ): string {
	const text = fillFromTree( trees.text );
	const highlight = fillFromTree( trees.highlight );
	if ( ! text && ! highlight ) return '';

	const decls: string[] = [];
	const layers: string[] = [];
	const sizes: string[] = [];
	const positions: string[] = [];
	const clips: string[] = [];
	const clipsText = Boolean( text?.isImage );

	if ( text ) {
		if ( text.isImage ) {
			layers.push( text.paint );
			sizes.push( text.size || 'auto' );
			positions.push( text.position || 'center' );
			clips.push( 'text' );
			// `color` is the fallback that survives anything filtering unknown properties;
			// `-webkit-text-fill-color` wins where both are kept and spares `currentColor`.
			decls.push( 'color:transparent', '-webkit-text-fill-color:transparent' );
		} else {
			decls.push( `color:${ text.paint }` );
		}
	}

	if ( highlight ) {
		if ( ! highlight.isImage && ! clipsText ) {
			decls.push( `background-color:${ highlight.paint }` );
		} else {
			layers.push( highlight.isImage ? highlight.paint : `linear-gradient(${ highlight.paint },${ highlight.paint })` );
			sizes.push( ( highlight.isImage && highlight.size ) || 'auto' );
			positions.push( ( highlight.isImage && highlight.position ) || 'center' );
			clips.push( 'border-box' );
		}
	}

	if ( layers.length ) {
		decls.push( `background-image:${ layers.join( ',' ) }` );
		if ( sizes.some( ( size ) => size !== 'auto' ) ) decls.push( `background-size:${ sizes.join( ',' ) }` );
		if ( positions.some( ( position ) => position !== 'center' ) ) decls.push( `background-position:${ positions.join( ',' ) }` );
		if ( clipsText ) {
			decls.push( `-webkit-background-clip:${ clips.join( ',' ) }`, `background-clip:${ clips.join( ',' ) }` );
		}
	}

	if ( highlight ) {
		decls.push( 'padding:0 .15em', 'border-radius:.2em', '-webkit-box-decoration-break:clone', 'box-decoration-break:clone' );
	}

	return decls.join( ';' );
}

/** `linear-gradient(c,c)` — the flat layer a solid highlight is emitted as. Returns `c`. */
function flatGradientColor( layer: string ): string | null {
	const match = layer.match( /^linear-gradient\((.*)\)$/s );
	if ( ! match ) return null;
	const parts = splitTop( match[ 1 ] );
	return parts.length === 2 && parts[ 0 ] === parts[ 1 ] ? parts[ 0 ] : null;
}

/** Reverse of `gradientCss` — back into the stops object the gradient editor edits. */
export function parseGradient( layer: string ): any | null {
	const match = layer.match( /^(linear|radial|conic)-gradient\((.*)\)$/s );
	if ( ! match ) return null;
	const type = match[ 1 ];
	const parts = splitTop( match[ 2 ] );
	if ( parts.length < 2 ) return null;

	// A leading angle / `to …` / `circle at …` / `from …` is the head; otherwise it's already a stop.
	const hasHead = type === 'linear' ? /^(-?[\d.]+(deg|rad|turn|grad)\b|to\s+)/.test( parts[ 0 ] ) : true;
	const head = hasHead ? parts[ 0 ] : '';
	const stopParts = hasHead ? parts.slice( 1 ) : parts;
	if ( stopParts.length < 2 ) return null;

	const stops = stopParts.map( ( raw ) => {
		const position = raw.match( /\s+(-?[\d.]+(?:%|px|r?em))$/ );
		return {
			color: position ? raw.slice( 0, raw.length - position[ 0 ].length ).trim() : raw,
			position: position ? position[ 1 ] : '',
		};
	} );

	if ( type === 'radial' ) {
		const at = head.match( /^(.*?)\s+at\s+(.*)$/ );
		return { type, shape: ( at ? at[ 1 ] : head ).trim() || 'circle', position: at ? at[ 2 ].trim() : '', stops };
	}
	if ( type === 'conic' ) {
		const from = head.match( /^from\s+(\S+)(?:\s+at\s+(.*))?$/ );
		return { type, angle: from ? from[ 1 ] : '0deg', position: from?.[ 2 ]?.trim() || '', stops };
	}
	return { type: 'linear', angle: head || '90deg', stops };
}

/** Fold one background layer back into a synthetic tree. */
function layerToTree( tree: any, layer: string, size?: string, position?: string ) {
	const url = layer.match( /^url\(\s*["']?([^"')]+)["']?\s*\)$/ );
	if ( url ) {
		tree[ 'background.image' ] = slot( { url: url[ 1 ] } );
		if ( size && size !== 'auto' ) tree[ 'background.size' ] = slot( size );
		if ( position && position !== 'center' ) tree[ 'background.position' ] = slot( position );
		return;
	}
	const token = layer.match( /^var\(\s*--blicks-gradient-([a-zA-Z0-9-]+)\s*\)$/ );
	if ( token ) {
		tree[ 'background.gradient' ] = slot( token[ 1 ] );
		return;
	}
	const flat = flatGradientColor( layer );
	if ( flat ) {
		tree[ 'colors.background' ] = slot( flat );
		return;
	}
	const gradient = parseGradient( layer );
	if ( gradient ) tree[ 'background.gradient' ] = slot( gradient );
}

/** Best-effort reconstruct both synthetic trees from an applied style string. */
export function styleToTrees( style: string ): Trees {
	const trees: Trees = { text: {}, highlight: {} };
	if ( ! style ) return trees;

	const decls = new Map< string, string >();
	for ( const declaration of splitTop( style, ';' ) ) {
		const colon = declaration.indexOf( ':' );
		if ( colon < 0 ) continue;
		decls.set( declaration.slice( 0, colon ).trim().toLowerCase(), declaration.slice( colon + 1 ).trim() );
	}

	const color = decls.get( 'color' );
	const transparentText = color === 'transparent' || decls.get( '-webkit-text-fill-color' ) === 'transparent';
	if ( color && color !== 'transparent' ) trees.text[ 'colors.background' ] = slot( color );

	const backgroundColor = decls.get( 'background-color' );
	if ( backgroundColor ) trees.highlight[ 'colors.background' ] = slot( backgroundColor );

	const images = splitTop( decls.get( 'background-image' ) || '' );
	if ( ! images.length ) return trees;

	const sizes = splitTop( decls.get( 'background-size' ) || '' );
	const positions = splitTop( decls.get( 'background-position' ) || '' );
	const clips = splitTop( decls.get( 'background-clip' ) || decls.get( '-webkit-background-clip' ) || '' );
	// Pre-layer output: one layer + transparent text and a single (or absent) clip meant "text".
	const legacyText = images.length === 1 && clips.length <= 1 && transparentText;

	images.forEach( ( layer, index ) => {
		// Shorter background lists repeat cyclically — mirror that when reading them back.
		const clip = clips.length ? clips[ index % clips.length ] : '';
		const target: Target = legacyText || clip === 'text' ? 'text' : 'highlight';
		layerToTree(
			trees[ target ],
			layer,
			sizes.length ? sizes[ index % sizes.length ] : undefined,
			positions.length ? positions[ index % positions.length ] : undefined
		);
	} );

	return trees;
}
