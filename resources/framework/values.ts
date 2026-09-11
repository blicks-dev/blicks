/**
 * Read/write a control value in the `blicks` attribute tree:
 *   attributes.blicks[controlId][state][breakpoint] = value
 *
 * Writes are immutable and prune empty branches, so the stored tree stays sparse.
 *
 * A block's own styling uses bare control ids (`colors.text`). A block **element** — a sub-part
 * the block declares in `supports.blicks.elements`, e.g. a Button's icon — stores its styling in
 * the SAME tree under a scope-prefixed id (`icon:colors.text`). Nothing else in the pipeline needs
 * to know: `getValue`/`setValue` treat the id as opaque, and both style engines look values up by
 * the ids in their style map, so a prefixed key is invisible to the block-level pass and cannot
 * leak into wrapper styling. It also means element styling rides along in user presets and block
 * variations for free, since those store the whole `blicks` attribute.
 */

type Tree = Record< string, Record< string, Record< string, unknown > > >;

/** Separates an element scope from the control id. Never appears in a control id itself. */
export const SCOPE_SEP = ':';

/** `''` (the block itself) or the element name a scoped key belongs to. */
function keyScope( key: string ): string {
	const at = key.indexOf( SCOPE_SEP );
	return at === -1 ? '' : key.slice( 0, at );
}

function unscopedKey( key: string ): string {
	const at = key.indexOf( SCOPE_SEP );
	return at === -1 ? key : key.slice( at + 1 );
}

/**
 * One scope's slice of the tree, with the prefix stripped — so a consumer that knows nothing about
 * elements (every inspector control, the whole style engine) sees an ordinary value tree.
 * `scope: ''` yields the block's own values, excluding every element's.
 */
export function scopeTree( blicks: Tree | undefined, scope: string ): Tree {
	const out: Tree = {};
	for ( const [ key, value ] of Object.entries( blicks ?? {} ) ) {
		if ( keyScope( key ) !== scope ) continue;
		out[ unscopedKey( key ) ] = value;
	}
	return out;
}

/**
 * The inverse: fold an edited single-scope tree back into the full one, re-applying the prefix and
 * leaving every other scope untouched. Pairs with `scopeTree` to give a scoped `setAttributes`.
 */
export function mergeScopeTree( blicks: Tree | undefined, scope: string, sub: Tree | undefined ): Tree {
	const out: Tree = {};
	for ( const [ key, value ] of Object.entries( blicks ?? {} ) ) {
		if ( keyScope( key ) === scope ) continue;
		out[ key ] = value;
	}
	for ( const [ key, value ] of Object.entries( sub ?? {} ) ) {
		out[ scope === '' ? key : `${ scope }${ SCOPE_SEP }${ key }` ] = value;
	}
	return out;
}

/** True when any element (any scope but the block's own) carries a value. */
export function hasElementValues( blicks: Tree | undefined ): boolean {
	return Object.keys( blicks ?? {} ).some( ( key ) => keyScope( key ) !== '' );
}

export function getValue(
	attributes: { blicks?: Tree },
	controlId: string,
	state: string,
	breakpoint: string
): any {
	return attributes?.blicks?.[ controlId ]?.[ state ]?.[ breakpoint ];
}

export function setValue(
	attributes: { blicks?: Tree },
	setAttributes: ( a: { blicks: Tree } ) => void,
	controlId: string,
	state: string,
	breakpoint: string,
	value: unknown
): void {
	const blicks: Tree = { ...( attributes.blicks ?? {} ) };
	const control = { ...( blicks[ controlId ] ?? {} ) };
	const stateSlot = { ...( control[ state ] ?? {} ) };

	const empty = value === undefined || value === null || value === '';
	if ( empty ) {
		delete stateSlot[ breakpoint ];
	} else {
		stateSlot[ breakpoint ] = value;
	}

	if ( Object.keys( stateSlot ).length ) {
		control[ state ] = stateSlot;
	} else {
		delete control[ state ];
	}
	if ( Object.keys( control ).length ) {
		blicks[ controlId ] = control;
	} else {
		delete blicks[ controlId ];
	}

	setAttributes( { blicks } );
}

/** True when this control has any value outside the given (state, breakpoint) slot. */
export function hasOverrides(
	attributes: { blicks?: Tree },
	controlId: string,
	state: string,
	breakpoint: string
): boolean {
	const control = attributes?.blicks?.[ controlId ];
	if ( ! control ) return false;
	for ( const s of Object.keys( control ) ) {
		for ( const b of Object.keys( control[ s ] ) ) {
			if ( ! ( s === state && b === breakpoint ) ) return true;
		}
	}
	return false;
}
