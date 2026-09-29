import { __ } from '@wordpress/i18n';
import { cleanCell, cleanSpan } from './controls';
import { fits, sceneOf, siblingFrames, type Frame } from './occupancy';
import { wasRedirected } from '@/blocks/scene-shared/drill-down';
import { hideReadout, showReadout } from '@/blocks/scene-shared/readout';
import './gestures.scss';

/**
 * Move and resize for a BOX.
 *
 * Deliberately separate from the item gestures, because a box moves in whole CELLS while an item
 * moves in design pixels. Sharing one code path would mean a continuous gesture pretending to be
 * discrete, and the rounding would live in the wrong place.
 *
 * Plain functions rather than hooks, for the same reason as the item gestures: a block's `render`
 * is shared with `save()`, where hooks are illegal.
 */

/**
 * WordPress marks a selected block `draggable="true"` for its own reorder-by-dragging. On a stage
 * that is actively harmful: a real mouse press starts a native HTML5 drag, pointer events stop
 * firing, and WP moves the block in the tree instead of letting it be positioned.
 *
 * Disabled here rather than in CSS because only the DOM attribute stops `dragstart`. The
 * `onDragStart` guard covers the case where something re-adds the attribute after mount.
 *
 * Nothing is lost: a scene block's place in the document does not determine where it appears —
 * its coordinates do — and z-order has its own controls in the layers panel.
 */
const NO_NATIVE_DRAG = {
	draggable: false,
	onDragStart: ( event: React.DragEvent ) => event.preventDefault(),
};

/** Pointer travel, in screen pixels, before a press becomes a gesture rather than a click. */
const DRAG_THRESHOLD = 3;

interface Options {
	attributes: any;
	setAttributes: ( a: any ) => void;
	isEdit: boolean;
	/** Needed to find the sibling boxes this one may not overlap. */
	clientId?: string;
}

interface Grid {
	stage: HTMLElement;
	cols: number;
	rows: number;
	/** One cell, in the same units the pointer deltas are converted into. */
	cellW: number;
	cellH: number;
	scale: number;
}

/**
 * The grid a box sits on.
 *
 * The cell size is read from the STAGE's laid-out size, not from the box — a box's own size is
 * what the gesture is changing, so measuring against it would make each step depend on the last.
 */
function gridOf( box: HTMLElement ): Grid | null {
	const stage = box.closest( '.bl-scene__stage' ) as HTMLElement | null;
	if ( ! stage ) return null;

	const painted = stage.getBoundingClientRect().width;
	const layout = stage.offsetWidth;
	if ( ! painted || ! layout ) return null;

	const styles = getComputedStyle( stage );
	const cols = Number( styles.getPropertyValue( '--bl-scene-cols' ) ) || 16;
	const rows = Number( styles.getPropertyValue( '--bl-scene-rows' ) ) || 16;

	return {
		stage,
		cols,
		rows,
		cellW: layout / cols,
		cellH: stage.offsetHeight / rows,
		scale: painted / layout,
	};
}

const clamp = ( n: number, min: number, max: number ) => Math.min( max, Math.max( min, n ) );

/**
 * Run a pointer gesture, reporting BOTH the raw pixel delta and the rounded cell delta.
 *
 * Both, because a grid gesture has two different jobs at once. Rounding every frame is what makes
 * a drag feel like it is fighting you: the box teleports a whole cell at a time and never sits
 * under the cursor. So the raw delta drives what the author sees moving, and the rounded delta
 * only decides where it will land — drawn as a ghost, and committed on release.
 *
 * Deltas are in LAYOUT pixels, not screen pixels: the stage is scaled, and the element being moved
 * lives inside that scale, so a translate of one layout pixel is what tracks one design pixel.
 */
function trackGesture(
	element: HTMLElement,
	grid: Grid,
	start: { x: number; y: number },
	apply: (
		raw: { dx: number; dy: number },
		cells: { dCol: number; dRow: number },
		persistent: boolean,
		pointer: { x: number; y: number }
	) => void
): void {
	const doc = element.ownerDocument;
	let dragging = false;

	const measure = ( event: PointerEvent ) => {
		const dx = ( event.clientX - start.x ) / grid.scale;
		const dy = ( event.clientY - start.y ) / grid.scale;
		return {
			raw: { dx, dy },
			cells: { dCol: Math.round( dx / grid.cellW ), dRow: Math.round( dy / grid.cellH ) },
		};
	};

	const move = ( event: PointerEvent ) => {
		if ( ! dragging ) {
			if (
				Math.abs( event.clientX - start.x ) < DRAG_THRESHOLD &&
				Math.abs( event.clientY - start.y ) < DRAG_THRESHOLD
			) {
				return;
			}
			dragging = true;
		}
		event.preventDefault();
		const { raw, cells } = measure( event );
		apply( raw, cells, false, { x: event.clientX, y: event.clientY } );
	};

	const up = ( event: PointerEvent ) => {
		doc.removeEventListener( 'pointermove', move );
		doc.removeEventListener( 'pointerup', up );
		doc.removeEventListener( 'pointercancel', up );
		if ( ! dragging ) {
			// A press that never moved still has to undo any live styling it applied.
			apply( { dx: 0, dy: 0 }, { dCol: 0, dRow: 0 }, true, { x: event.clientX, y: event.clientY } );
			return;
		}
		const { raw, cells } = measure( event );
		apply( raw, cells, true, { x: event.clientX, y: event.clientY } );
	};

	doc.addEventListener( 'pointermove', move );
	doc.addEventListener( 'pointerup', up );
	doc.addEventListener( 'pointercancel', up );
}

/**
 * The outline showing where a box will land once released.
 *
 * Written straight to the DOM for the same reason the alignment guides are: it moves on every
 * pointer frame, and re-rendering the block tree to reposition one rectangle is work with nothing
 * to show for it.
 */
function ghostFor( stage: HTMLElement ): HTMLElement {
	let ghost = stage.querySelector< HTMLElement >( ':scope > .bl-scene-ghost' );
	if ( ! ghost ) {
		ghost = stage.ownerDocument.createElement( 'div' );
		ghost.className = 'bl-scene-ghost';
		ghost.setAttribute( 'aria-hidden', 'true' );
		stage.appendChild( ghost );
	}
	return ghost;
}

function drawGhost( grid: Grid, frame: Frame ): void {
	const ghost = ghostFor( grid.stage );
	ghost.style.left = `${ ( frame.col / grid.cols ) * 100 }%`;
	ghost.style.top = `${ ( frame.row / grid.rows ) * 100 }%`;
	ghost.style.width = `${ ( frame.colSpan / grid.cols ) * 100 }%`;
	ghost.style.height = `${ ( frame.rowSpan / grid.rows ) * 100 }%`;
}

function clearGhost( stage: HTMLElement ): void {
	stage.querySelector( ':scope > .bl-scene-ghost' )?.remove();
}

// ── Move ──────────────────────────────────────────────────────────────────────

export function sceneBoxDragProps( { attributes, setAttributes, isEdit, clientId }: Options ) {
	if ( ! isEdit ) return {};

	const onPointerDown = ( event: React.PointerEvent< HTMLElement > ) => {
		if ( event.button !== 0 ) return;

		const target = event.target as HTMLElement | null;
		if ( target?.closest( '.bl-scene-box-handles' ) ) return;

		// A press that lands on an item belongs to that item — unless the item stood down because
		// the box was not yet selected, in which case this gesture is the box's. Without the first
		// half, every item drag would drag its container too; without the second, the first click
		// into a box would select it but refuse to move it.
		if ( target?.closest( '.bl-scene-item' ) && ! wasRedirected( event ) ) return;

		const element = event.currentTarget;
		const grid = gridOf( element );
		if ( ! grid ) return;

		const startCol = cleanCell( attributes.col, 0 );
		const startRow = cleanCell( attributes.row, 0 );
		const colSpan = cleanSpan( attributes.colSpan, 4 );
		const rowSpan = cleanSpan( attributes.rowSpan, 4 );

		const others = siblingFrames( sceneOf( clientId ), clientId );
		// The last position that was legal. A blocked drag holds here rather than snapping back to
		// the start, so pushing a box against a neighbour parks it flush instead of undoing it.
		let settled: Frame = { col: startCol, row: startRow, colSpan, rowSpan };

		trackGesture( element, grid, { x: event.clientX, y: event.clientY }, ( raw, cells, persistent, pointer ) => {
			const candidate: Frame = {
				// A box cannot leave the grid, and its far edge is what would go over — so the
				// ceiling is the grid size minus the box's own span, not the grid size.
				col: clamp( startCol + cells.dCol, 0, grid.cols - colSpan ),
				row: clamp( startRow + cells.dRow, 0, grid.rows - rowSpan ),
				colSpan,
				rowSpan,
			};

			if ( fits( candidate, others ) ) settled = candidate;

			if ( ! persistent ) {
				// Follow the pointer exactly. Nothing is written to the block while the gesture is
				// live — the box is only moved visually, and the ghost says where it will land.
				element.style.translate = `${ raw.dx }px ${ raw.dy }px`;
				element.classList.add( 'is-dragging' );
				drawGhost( grid, settled );
				showReadout( `${ settled.col }, ${ settled.row }`, pointer.x, pointer.y );
				return;
			}

			element.style.translate = '';
			element.classList.remove( 'is-dragging' );
			clearGhost( grid.stage );
			hideReadout();
			// One write, on release — so one undo step, and no cell-by-cell jumping on the way.
			setAttributes( { col: settled.col, row: settled.row } );
		} );
	};

	return { ...NO_NATIVE_DRAG, onPointerDown };
}

// ── Resize ────────────────────────────────────────────────────────────────────

const HANDLES: Array< { id: string; sx: -1 | 0 | 1; sy: -1 | 0 | 1; label: string } > = [
	{ id: 'nw', sx: -1, sy: -1, label: __( 'Resize from top left', 'blicks' ) },
	{ id: 'n', sx: 0, sy: -1, label: __( 'Resize from top', 'blicks' ) },
	{ id: 'ne', sx: 1, sy: -1, label: __( 'Resize from top right', 'blicks' ) },
	{ id: 'e', sx: 1, sy: 0, label: __( 'Resize from right', 'blicks' ) },
	{ id: 'se', sx: 1, sy: 1, label: __( 'Resize from bottom right', 'blicks' ) },
	{ id: 's', sx: 0, sy: 1, label: __( 'Resize from bottom', 'blicks' ) },
	{ id: 'sw', sx: -1, sy: 1, label: __( 'Resize from bottom left', 'blicks' ) },
	{ id: 'w', sx: -1, sy: 0, label: __( 'Resize from left', 'blicks' ) },
];

/**
 * Resize grips for the selected box, in whole cells.
 *
 * Dragging a leading edge moves the origin AND changes the span, so that the opposite edge stays
 * put — the same relationship the item resize has, but in cells and with no anchor to account for,
 * because a box is always addressed from its top-left corner.
 */
export function SceneBoxHandles( { attributes, setAttributes, isEdit, clientId }: Options ) {
	if ( ! isEdit ) return null;

	const onPointerDown = ( handle: typeof HANDLES[ number ] ) => ( event: React.PointerEvent< HTMLElement > ) => {
		if ( event.button !== 0 ) return;
		event.stopPropagation();

		const element = event.currentTarget.closest( '.bl-scene-box' ) as HTMLElement | null;
		if ( ! element ) return;
		const grid = gridOf( element );
		if ( ! grid ) return;

		const startCol = cleanCell( attributes.col, 0 );
		const startRow = cleanCell( attributes.row, 0 );
		const startCW = cleanSpan( attributes.colSpan, 4 );
		const startRH = cleanSpan( attributes.rowSpan, 4 );

		const others = siblingFrames( sceneOf( clientId ), clientId );
		let settled: Frame = { col: startCol, row: startRow, colSpan: startCW, rowSpan: startRH };

		trackGesture( element, grid, { x: event.clientX, y: event.clientY }, ( raw, cells, persistent, pointer ) => {
			let col = startCol;
			let row = startRow;
			let colSpan = startCW;
			let rowSpan = startRH;

			if ( handle.sx === 1 ) {
				colSpan = clamp( startCW + cells.dCol, 1, grid.cols - startCol );
			} else if ( handle.sx === -1 ) {
				col = clamp( startCol + cells.dCol, 0, startCol + startCW - 1 );
				colSpan = startCol + startCW - col;
			}

			if ( handle.sy === 1 ) {
				rowSpan = clamp( startRH + cells.dRow, 1, grid.rows - startRow );
			} else if ( handle.sy === -1 ) {
				row = clamp( startRow + cells.dRow, 0, startRow + startRH - 1 );
				rowSpan = startRow + startRH - row;
			}

			// A resize that would swallow a neighbour stops at the last size that did not.
			const candidate: Frame = { col, row, colSpan, rowSpan };
			if ( fits( candidate, others ) ) settled = candidate;

			if ( ! persistent ) {
				showReadout( `${ settled.colSpan } x ${ settled.rowSpan }`, pointer.x, pointer.y );
				// Live edges follow the pointer in unrounded cell fractions, so the box stretches
				// under the cursor instead of stepping a cell at a time.
				const fCol = raw.dx / grid.cellW;
				const fRow = raw.dy / grid.cellH;
				const live = {
					col: handle.sx === -1 ? startCol + fCol : startCol,
					row: handle.sy === -1 ? startRow + fRow : startRow,
					colSpan: handle.sx === 1 ? startCW + fCol : handle.sx === -1 ? startCW - fCol : startCW,
					rowSpan: handle.sy === 1 ? startRH + fRow : handle.sy === -1 ? startRH - fRow : startRH,
				};
				element.style.left = `${ ( live.col / grid.cols ) * 100 }%`;
				element.style.top = `${ ( live.row / grid.rows ) * 100 }%`;
				element.style.width = `${ ( Math.max( live.colSpan, 0.2 ) / grid.cols ) * 100 }%`;
				element.style.height = `${ ( Math.max( live.rowSpan, 0.2 ) / grid.rows ) * 100 }%`;
				element.classList.add( 'is-dragging' );
				drawGhost( grid, settled );
				return;
			}

			// Hand the geometry back to the stylesheet before the attributes change, or the inline
			// overrides would win and the box would keep the half-cell size it was dragged to.
			element.style.left = '';
			element.style.top = '';
			element.style.width = '';
			element.style.height = '';
			element.classList.remove( 'is-dragging' );
			clearGhost( grid.stage );
			hideReadout();
			setAttributes( { ...settled } );
		} );
	};

	return (
		<span className="bl-scene-box-handles" aria-hidden="true">
			{ HANDLES.map( ( handle ) => (
				<span
					key={ handle.id }
					role="button"
					aria-label={ handle.label }
					className={ `bl-scene-box-handles__grip is-${ handle.id }` }
					onPointerDown={ onPointerDown( handle ) }
				/>
			) ) }
		</span>
	);
}
