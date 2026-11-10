/**
 * Shared bits of the two scene facets: the stage's grid, and a child's place on it.
 *
 * Both are views of one cell model, so the validators live together — a span the grid control
 * accepts and the placement control rejects would be a bug nobody could see in either file.
 */

/**
 * Cell values are unitless integers, and that is enforced rather than suggested.
 *
 * A length here does not merely look wrong — it breaks the arithmetic. The stage divides its
 * usable width by the track count, and dividing a length by a length is the one shape that yields
 * a number; dividing by `12px` yields nothing and the whole declaration is dropped, silently. So
 * anything that is not a plain integer is discarded at the edge instead of being written.
 */
const CELL_PATTERN = /^\d{1,3}$/;

export function cleanCell( value: string ): string {
	const trimmed = value.trim();

	return CELL_PATTERN.test( trimmed ) ? String( parseInt( trimmed, 10 ) ) : '';
}

/** A span of zero is a box with no area, so the smallest meaningful span is one. */
export function cleanSpan( value: string ): string {
	const cleaned = cleanCell( value );

	return cleaned === '' || cleaned === '0' ? '' : cleaned;
}

export const SCALE_PATTERN = /^\d+(\.\d+)?$/;

const ROTATE_PATTERN = /^-?\d+(\.\d+)?(deg|turn|rad)$/;

export function clean( value: string, pattern: RegExp ): string {
	const trimmed = value.trim();

	return pattern.test( trimmed ) ? trimmed : '';
}

/** A bare number is read as degrees, which is what someone typing `45` into a rotation means. */
export function cleanRotate( value: string ): string {
	const trimmed = value.trim();

	if ( /^-?\d+(\.\d+)?$/.test( trimmed ) ) {
		return `${ trimmed }deg`;
	}

	return clean( trimmed, ROTATE_PATTERN );
}

/**
 * The stage's default track count.
 *
 * Three, not twelve. A new Scene is a thing to place a few boxes on, and a 3×3 grid is legible at
 * a glance — nine cells you can see and aim at. A twelve-track grid is a typographic column system
 * and reads as 144 near-invisible cells on an empty canvas, which is a worse first minute. The
 * control exists so a composition that needs finer tracks asks for them.
 */
export const DEFAULT_TRACKS = 3;
