/**
 * The live measurement shown while something is being moved or resized.
 *
 * A ghost outline answers "roughly where" — this answers "exactly where". On a grid that is the
 * difference between nudging a box until it looks right and placing it at 4,2 because that is
 * what the other one is.
 *
 * Written straight to the DOM, like the alignment guides and for the same reason: it updates on
 * every pointer frame, and re-rendering a block tree to change a string of digits is work with
 * nothing to show for it. `position: fixed` keeps it out of the scaled stage, so the text stays
 * legible at any zoom without counter-scaling.
 */

const ID = 'bl-scene-readout';

function node(): HTMLElement {
	let el = document.getElementById( ID );
	if ( ! el ) {
		el = document.createElement( 'div' );
		el.id = ID;
		el.className = 'bl-scene-readout';
		el.setAttribute( 'aria-hidden', 'true' );
		document.body.appendChild( el );
	}
	return el;
}

/** Show `text` near the pointer, nudged clear of the cursor itself. */
export function showReadout( text: string, clientX: number, clientY: number ): void {
	const el = node();
	el.textContent = text;

	// Flip to the other side near the viewport edge rather than letting the readout clip, which
	// is exactly where a drag tends to end up.
	const pad = 14;
	const box = el.getBoundingClientRect();
	const left = clientX + pad + box.width > window.innerWidth ? clientX - pad - box.width : clientX + pad;
	const top = clientY + pad + box.height > window.innerHeight ? clientY - pad - box.height : clientY + pad;

	el.style.left = `${ Math.max( 0, left ) }px`;
	el.style.top = `${ Math.max( 0, top ) }px`;
}

export function hideReadout(): void {
	document.getElementById( ID )?.remove();
}
