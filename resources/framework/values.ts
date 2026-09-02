/**
 * Read/write a control value in the `blicks` attribute tree:
 *   attributes.blicks[controlId][state][breakpoint] = value
 *
 * Writes are immutable and prune empty branches, so the stored tree stays sparse.
 */

type Tree = Record< string, Record< string, Record< string, unknown > > >;

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
