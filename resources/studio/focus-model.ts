/**
 * The focus scope's decisions, apart from its markup so they are testable without a DOM: where a
 * block is, what the breadcrumb says, and which part of the canvas is dimmed.
 */
import type { BlockNode } from './mount';

/** The block with this client id, at any depth, or null. */
export function findBlock( nodes: BlockNode[], clientId: string ): BlockNode | null {
	for ( const node of nodes ) {
		if ( node.clientId === clientId ) {
			return node;
		}

		const inner = findBlock( node.innerBlocks ?? [], clientId );

		if ( inner ) {
			return inner;
		}
	}

	return null;
}

/** The blocks from the top of the tree down to `clientId`, both ends included; [] when absent. */
export function pathOf( nodes: BlockNode[], clientId: string ): BlockNode[] {
	for ( const node of nodes ) {
		if ( node.clientId === clientId ) {
			return [ node ];
		}

		const below = pathOf( node.innerBlocks ?? [], clientId );

		if ( below.length > 0 ) {
			return [ node, ...below ];
		}
	}

	return [];
}

/** One step of the breadcrumb. */
export interface Crumb {
	clientId: string;
	label: string;
	/** `outside` leaves the scope when chosen; `scope` is the scope itself; `inside` is within it. */
	where: 'outside' | 'scope' | 'inside';
}

/**
 * The breadcrumb while focused: the way down to the scope, the scope under its own label, then
 * the way down to the selected block inside it. Empty when the scope is not in the tree.
 */
export function crumbsOf(
	nodes: BlockNode[],
	scope: { clientId: string; label: string },
	selected: string | null,
	name: ( node: BlockNode ) => string
): Crumb[] {
	const toScope = pathOf( nodes, scope.clientId );

	if ( 0 === toScope.length ) {
		return [];
	}

	const crumbs: Crumb[] = toScope.slice( 0, -1 ).map( ( node ) => ( { clientId: node.clientId ?? '', label: name( node ), where: 'outside' } ) );

	crumbs.push( { clientId: scope.clientId, label: scope.label, where: 'scope' } );

	if ( selected && selected !== scope.clientId ) {
		const inside = pathOf( toScope[ toScope.length - 1 ]!.innerBlocks ?? [], selected );

		for ( const node of inside ) {
			crumbs.push( { clientId: node.clientId ?? '', label: name( node ), where: 'inside' } );
		}
	}

	return crumbs;
}

/** Whether `clientId` is the scope or inside it. */
export function isInScope( nodes: BlockNode[], scope: string, clientId: string ): boolean {
	const root = findBlock( nodes, scope );

	return !! root && ( scope === clientId || null !== findBlock( root.innerBlocks ?? [], clientId ) );
}

/**
 * The stylesheet that dims everything but the scope.
 *
 * Every block outside the scope is in core's `disabled` editing mode while focused, which gives it
 * `.is-editing-disabled`. That class is also on the scope's ancestors, which must not be dimmed —
 * the scope is inside them, and opacity on an ancestor is opacity on the scope. And dimming a
 * dimmed block's children compounds (0.4 inside 0.4 is 0.16). So: the disabled blocks that do not
 * hold the scope, and are not inside one that is already dimmed.
 */
export function dimCss( scope: string, within: string ): string {
	const held = `[data-block="${ scope.replace( /["\\]/g, '' ) }"]`;
	const dim = `.is-editing-disabled:not(:has(${ held }))`;

	return `${ within } ${ dim }:not(${ dim } *){opacity:.4;cursor:pointer;transition:opacity 120ms}${ within } ${ dim }:not(${ dim } *):hover{opacity:.62}`;
}
