import { select } from '@wordpress/data';

/**
 * Boxes may not overlap.
 *
 * A box is a region of the grid, and two boxes claiming the same cell has no meaning: an item
 * inside either one would be positioned against a region that is also something else. So the rule
 * is enforced at every placement path — drag, resize, draw and the numeric fields — from this one
 * definition, rather than re-derived in four places that could disagree.
 *
 * Plain functions using the non-hook `select`, because the gestures that call them run outside
 * React entirely.
 */

export interface Frame {
	col: number;
	row: number;
	colSpan: number;
	rowSpan: number;
}

export function frameOf( attributes: any ): Frame {
	return {
		col: Number( attributes?.col ?? 0 ),
		row: Number( attributes?.row ?? 0 ),
		colSpan: Number( attributes?.colSpan ?? 4 ),
		rowSpan: Number( attributes?.rowSpan ?? 4 ),
	};
}

/**
 * Half-open interval overlap on both axes.
 *
 * A box occupying columns 0–3 ends BEFORE column 4, so `a.col + a.colSpan <= b.col` is touching,
 * not overlapping. Getting this boundary wrong is what makes adjacent boxes refuse to sit flush.
 */
export function overlaps( a: Frame, b: Frame ): boolean {
	return (
		a.col < b.col + b.colSpan &&
		b.col < a.col + a.colSpan &&
		a.row < b.row + b.rowSpan &&
		b.row < a.row + a.rowSpan
	);
}

/** Every other box in the same Scene, as frames. */
export function siblingFrames( sceneId: string | null, excludeId?: string ): Frame[] {
	if ( ! sceneId ) return [];
	const store = select( 'core/block-editor' ) as any;
	const boxes = store?.getBlocks?.( sceneId ) ?? [];
	return boxes
		.filter( ( block: any ) => block.clientId !== excludeId && block.name === 'blicks/scene-box' )
		.map( ( block: any ) => frameOf( block.attributes ) );
}

/** The Scene a box belongs to. */
export function sceneOf( boxId?: string ): string | null {
	if ( ! boxId ) return null;
	const store = select( 'core/block-editor' ) as any;
	return store?.getBlockRootClientId?.( boxId ) ?? null;
}

export function fits( frame: Frame, others: Frame[] ): boolean {
	return ! others.some( ( other ) => overlaps( frame, other ) );
}

/**
 * The first free region of a given size, scanning row by row.
 *
 * Used when a box is created without the author pointing at a spot — the inserter button. Reading
 * order is the least surprising search: the new box appears at the first gap you would look at.
 */
export function firstFreeFrame(
	others: Frame[],
	cols: number,
	rows: number,
	colSpan: number,
	rowSpan: number
): Frame | null {
	const w = Math.min( colSpan, cols );
	const h = Math.min( rowSpan, rows );
	for ( let row = 0; row <= rows - h; row++ ) {
		for ( let col = 0; col <= cols - w; col++ ) {
			const candidate = { col, row, colSpan: w, rowSpan: h };
			if ( fits( candidate, others ) ) return candidate;
		}
	}
	return null;
}
