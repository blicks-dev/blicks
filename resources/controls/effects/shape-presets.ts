/**
 * Clip-path shape library — named polygons authored as percentage points, used both to build the
 * CSS `polygon(...)` value and a small SVG thumbnail so the picker is visual. Applied to the existing
 * `effects.clipPath` `{ shape: 'custom', custom }` slot, so no style-engine change is needed.
 */
export interface ShapePreset {
	id: string;
	label: string;
	/** Points as [x, y] percentages (0–100). */
	points: Array< [ number, number ] >;
}

export const SHAPE_PRESETS: ShapePreset[] = [
	{ id: 'triangle', label: 'Triangle', points: [ [ 50, 0 ], [ 100, 100 ], [ 0, 100 ] ] },
	{ id: 'triangle-down', label: 'Triangle down', points: [ [ 0, 0 ], [ 100, 0 ], [ 50, 100 ] ] },
	{ id: 'rhombus', label: 'Rhombus', points: [ [ 50, 0 ], [ 100, 50 ], [ 50, 100 ], [ 0, 50 ] ] },
	{ id: 'parallelogram', label: 'Parallelogram', points: [ [ 25, 0 ], [ 100, 0 ], [ 75, 100 ], [ 0, 100 ] ] },
	{ id: 'pentagon', label: 'Pentagon', points: [ [ 50, 0 ], [ 100, 38 ], [ 82, 100 ], [ 18, 100 ], [ 0, 38 ] ] },
	{ id: 'hexagon', label: 'Hexagon', points: [ [ 25, 0 ], [ 75, 0 ], [ 100, 50 ], [ 75, 100 ], [ 25, 100 ], [ 0, 50 ] ] },
	{
		id: 'star',
		label: 'Star',
		points: [ [ 50, 0 ], [ 61, 35 ], [ 98, 35 ], [ 68, 57 ], [ 79, 91 ], [ 50, 70 ], [ 21, 91 ], [ 32, 57 ], [ 2, 35 ], [ 39, 35 ] ],
	},
	{ id: 'arrow-right', label: 'Arrow', points: [ [ 0, 20 ], [ 60, 20 ], [ 60, 0 ], [ 100, 50 ], [ 60, 100 ], [ 60, 80 ], [ 0, 80 ] ] },
	{ id: 'chevron-right', label: 'Chevron', points: [ [ 0, 0 ], [ 75, 0 ], [ 100, 50 ], [ 75, 100 ], [ 0, 100 ], [ 25, 50 ] ] },
	{ id: 'message', label: 'Message', points: [ [ 0, 0 ], [ 100, 0 ], [ 100, 75 ], [ 35, 75 ], [ 15, 100 ], [ 20, 75 ], [ 0, 75 ] ] },
];

/** Build the CSS `polygon(...)` value for a shape. */
export function shapeToCss( points: Array< [ number, number ] > ): string {
	return `polygon(${ points.map( ( [ x, y ] ) => `${ x }% ${ y }%` ).join( ', ' ) })`;
}

/** Build SVG `<polygon points>` (viewBox 0 0 20 20) for the thumbnail. */
export function shapeToSvgPoints( points: Array< [ number, number ] > ): string {
	return points.map( ( [ x, y ] ) => `${ ( x / 5 ).toFixed( 2 ) },${ ( y / 5 ).toFixed( 2 ) }` ).join( ' ' );
}
