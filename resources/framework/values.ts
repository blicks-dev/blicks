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

/** One pending write: a control value in a specific (state, breakpoint) slot. */
export interface ValueWrite {
	controlId: string;
	state: string;
	breakpoint: string;
	value: unknown;
}

/**
 * Apply SEVERAL writes in one `setAttributes` call.
 *
 * Calling `setValue` twice in a row loses the first write: each call derives a fresh tree from the
 * `attributes` it was handed, and within one event handler that object is the same stale snapshot
 * both times — so the second `setAttributes` overwrites the first. Any interaction that moves more
 * than one control together has to come through here.
 *
 * Writes may target different slots, which is what an align control needs: it moves a coordinate
 * on whichever breakpoint is being edited while pinning the anchor to the base slot.
 */
export function setValueSlots(
	attributes: { blicks?: Tree },
	setAttributes: ( a: { blicks: Tree } ) => void,
	writes: ValueWrite[]
): void {
	const blicks: Tree = { ...( attributes.blicks ?? {} ) };

	for ( const { controlId, state, breakpoint, value } of writes ) {
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
	}

	setAttributes( { blicks } );
}

/** `setValueSlots` for the common case: several controls sharing one slot. */
export function setValues(
	attributes: { blicks?: Tree },
	setAttributes: ( a: { blicks: Tree } ) => void,
	state: string,
	breakpoint: string,
	entries: Record< string, unknown >
): void {
	setValueSlots(
		attributes,
		setAttributes,
		Object.entries( entries ).map( ( [ controlId, value ] ) => ( { controlId, state, breakpoint, value } ) )
	);
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
