import { __, sprintf } from '@wordpress/i18n';
import { useRef } from '@wordpress/element';
import { overlaps, type Frame } from '@/blocks/scene-box/occupancy';

interface Props {
	cols: number;
	rows: number;
	frames: Frame[];
	onPlace: ( frame: Frame ) => void;
}

/**
 * Every free cell of the grid, as a standing placeholder.
 *
 * The grid used to be painted as two repeating gradients behind the stage — a picture of a grid,
 * with nothing to click. Sweeping across cells made a box, but nothing said so, and a single cell
 * could not be filled at all.
 *
 * These are real elements, and they are direct children of the stage, which is itself the CSS
 * grid. That is the whole trick: a placeholder is placed by `grid-column`/`grid-row` exactly like
 * a box, so gutters, an outer margin and uneven track lists apply to it for free. The painted
 * gradient could represent none of those — it assumed every track was the same width, so the
 * moment a gutter existed the drawn grid disagreed with the one boxes actually snapped to.
 *
 * Occupied cells are simply absent: a box covers its own region, so drawing a cell underneath it
 * would only show through the gaps between them.
 */

/** Past this, a placeholder per cell costs more than it gives; the cells stop being clickable. */
const MAX_CELLS = 2048;

/** A press that travelled this far was a sweep, and the marquee has already handled it. */
const CLICK_SLOP = 4;

export function SceneCells( { cols, rows, frames, onPlace }: Props ) {
	// Where the press started, so a click that was really the end of a drag can be ignored. The
	// marquee draws a box from the same gesture; without this, finishing a sweep would also place
	// a one-cell box wherever the pointer happened to come to rest.
	const origin = useRef< { x: number; y: number } | null >( null );

	if ( cols * rows > MAX_CELLS ) return null;

	const cells = [];
	for ( let row = 0; row < rows; row++ ) {
		for ( let col = 0; col < cols; col++ ) {
			const frame = { col, row, colSpan: 1, rowSpan: 1 };
			if ( frames.some( ( taken ) => overlaps( frame, taken ) ) ) continue;

			cells.push(
				<button
					type="button"
					key={ `${ col }-${ row }` }
					className="bl-scene-cell"
					style={ { gridColumn: col + 1, gridRow: row + 1 } }
					// Every cell carries the same label as the grid it belongs to, so a screen
					// reader gets a coordinate rather than 256 identical "Add" buttons.
					aria-label={ sprintf(
						/* translators: 1: column number, 2: row number. */
						__( 'Place a box at column %1$d, row %2$d', 'blicks' ),
						col + 1,
						row + 1
					) }
					onPointerDown={ ( event ) => {
						origin.current = { x: event.clientX, y: event.clientY };
					} }
					onClick={ ( event ) => {
						const from = origin.current;
						origin.current = null;
						if (
							from &&
							( Math.abs( event.clientX - from.x ) > CLICK_SLOP ||
								Math.abs( event.clientY - from.y ) > CLICK_SLOP )
						) {
							return;
						}
						onPlace( frame );
					} }
				/>
			);
		}
	}

	return <>{ cells }</>;
}
