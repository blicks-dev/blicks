/**
 * A Button in Blocks mode: what may go inside it, and how those blocks must save.
 *
 * The Button saves as one `<a>` (or `<button>`), and both only take phrasing content — a `<div>`,
 * `<p>` or `<figure>` inside is invalid HTML, and a link inside a link breaks keyboard and screen
 * reader use. So every block inside is saved inline (`tag: 'span'`, an Image's inline form) and
 * none of them carries a link of its own. The rules are data here, applied in the editor by
 * `useInlineChildren` and on the server by the MCP validator (`SpecValidator::checkButtonContent`).
 */

/** Blocks a Button holds in Blocks mode, at any depth. */
export const BUTTON_CHILDREN = [ 'blicks/text', 'blicks/icon', 'blicks/box', 'blicks/image' ];

export type ContentMode = 'label' | 'blocks';

export const cleanContentMode = ( value: unknown ): ContentMode => ( value === 'blocks' ? 'blocks' : 'label' );

/** A CSS length for the label-mode icon, or '' (the 1em default). A bare number is pixels. */
export function cleanIconSize( value: unknown ): string {
	const v = String( value ?? '' ).trim();
	if ( /^\d+(\.\d+)?$/.test( v ) ) return `${ v }px`;
	return /^\d+(\.\d+)?(px|em|rem)$/.test( v ) ? v : '';
}

interface Node {
	clientId: string;
	name: string;
	attributes: Record< string, any >;
	innerBlocks?: Node[];
}

/**
 * The attribute changes that make a block inline and link-free inside a Button, or null when it
 * already is. A Box loses its link and keeps everything else; an Image switches to its inline
 * form, which drops its caption and link on save.
 */
export function inlineFix( node: Pick< Node, 'name' | 'attributes' > ): Record< string, unknown > | null {
	const a = node.attributes ?? {};
	const fix: Record< string, unknown > = {};

	if ( node.name === 'blicks/text' && a.tag !== 'span' ) fix.tag = 'span';
	if ( node.name === 'blicks/box' ) {
		if ( a.tag !== 'span' ) fix.tag = 'span';
		if ( a.href ) Object.assign( fix, { href: '', linkTarget: '', rel: '', linkLabel: '' } );
	}
	if ( node.name === 'blicks/image' && a.inline !== true ) fix.inline = true;

	return Object.keys( fix ).length ? fix : null;
}

/** Every fix a Button's descendants need, depth first. */
export function inlineFixes( nodes: Node[] ): Array< { clientId: string; attributes: Record< string, unknown > } > {
	const out: Array< { clientId: string; attributes: Record< string, unknown > } > = [];
	const walk = ( list: Node[] ) => {
		for ( const node of list ) {
			const fix = inlineFix( node );
			if ( fix ) out.push( { clientId: node.clientId, attributes: fix } );
			walk( node.innerBlocks ?? [] );
		}
	};
	walk( nodes );
	return out;
}

/**
 * Going back to label mode keeps what a label can hold: the first Text's words and the first
 * Icon's glyph. Anything else is dropped, so the caller asks first when `lossy` is true.
 */
export function toLabel( nodes: Node[] ): { text: string; icon: string; lossy: boolean } {
	const flat: Node[] = [];
	const walk = ( list: Node[] ) => list.forEach( ( n ) => {
		flat.push( n );
		walk( n.innerBlocks ?? [] );
	} );
	walk( nodes );

	const text = flat.find( ( n ) => n.name === 'blicks/text' );
	const icon = flat.find( ( n ) => n.name === 'blicks/icon' );
	const kept = [ text, icon ].filter( Boolean ).length;

	return {
		text: String( text?.attributes.content ?? '' ),
		icon: String( icon?.attributes.icon ?? '' ),
		lossy: flat.length > kept,
	};
}
