/** The Icon's attributes, cleaned for rendering. Kept apart from the panels so tests need no editor. */
export function cleanIconSize( value: unknown ): string {
	const raw = String( value || '1.5rem' ).trim().replace( /\s+/g, '' );
	if ( /^-?\d*\.?\d+(px|%|em|rem)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return '1.5rem';
}

export function cleanStrokeWidth( value: unknown ): number {
	const width = Number( value );
	if ( Number.isNaN( width ) ) return 2;
	return Math.min( 4, Math.max( 1, width ) );
}

/** A quarter turn, as 0, 90, 180 or 270; anything else is no turn. */
export function cleanTurn( value: unknown ): number {
	const turn = Number( value );
	return [ 90, 180, 270 ].includes( turn ) ? turn : 0;
}

/** The classes for a mirrored or turned icon. None are written for one drawn as it comes. */
export function iconClasses( attributes: any ): string[] {
	const turn = cleanTurn( attributes.turn );
	return [
		attributes.filled ? 'bl-icon--filled' : '',
		attributes.flipH ? 'bl-icon--flip-h' : '',
		attributes.flipV ? 'bl-icon--flip-v' : '',
		turn ? `bl-icon--turn-${ turn }` : '',
	].filter( Boolean );
}
