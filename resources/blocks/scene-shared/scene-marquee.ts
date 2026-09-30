import { dispatch } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { fits, siblingFrames } from '@/blocks/scene-box/occupancy';

/**
 * Draw a new box by dragging across empty grid cells.
 *
 * This is the gesture that makes the grid feel like a grid: a box is defined by the cells it
 * covers, so the most direct way to make one is to sweep those cells. The numeric fields in the
 * inspector stay as the precise fallback.
 *
 * A plain function, not a hook — the Scene's `render` is shared with `save()`, where hooks throw.
 */

/** Below this the sweep was a click, not a draw, and creating a box would be a surprise. */
const DRAW_THRESHOLD = 4;

interface Options {
	clientId: string;
	isEdit: boolean;
}

interface Frame {
	col: number;
	row: number;
	colSpan: number;
	rowSpan: number;
}

const clamp = ( n: number, min: number, max: number ) => Math.min( max, Math.max( min, n ) );

/**
 * Which track a position falls in, given the track sizes the browser resolved.
 *
 * Walks the tracks accumulating their widths plus the gap between them, rather than dividing the
 * stage by a count. Dividing only works while every track is identical and nothing sits between
 * them — with a gutter, an outer margin or an uneven list it puts the pointer in the wrong cell,
 * and the further along the axis it is the further out it lands.
 */
function trackAt( sizes: number[], gap: number, start: number, position: number ): number {
	let edge = start;
	for ( let i = 0; i < sizes.length; i++ ) {
		edge += sizes[ i ];
		// Inside the gutter AFTER a track still belongs to that track: there is no cell to land in
		// between two, and the alternative is a sweep that skips.
		if ( position < edge + gap / 2 ) return i;
		edge += gap;
	}
	return Math.max( 0, sizes.length - 1 );
}

/** The px sizes of a resolved `grid-template-*`, which is always a plain list of lengths. */
function resolvedTracks( value: string ): number[] {
	return value.split( /\s+/ ).map( parseFloat ).filter( ( n ) => Number.isFinite( n ) );
}

/** The cell under a pointer position, as whole indices clamped to the grid. */
function cellAt(
	stage: HTMLElement,
	scale: number,
	cols: number,
	rows: number,
	clientX: number,
	clientY: number
): { col: number; row: number } {
	const rect = stage.getBoundingClientRect();
	const x = ( clientX - rect.left ) / scale;
	const y = ( clientY - rect.top ) / scale;

	const style = getComputedStyle( stage );
	const colSizes = resolvedTracks( style.gridTemplateColumns );
	const rowSizes = resolvedTracks( style.gridTemplateRows );
	const colGap = parseFloat( style.columnGap ) || 0;
	const rowGap = parseFloat( style.rowGap ) || 0;
	const padLeft = parseFloat( style.paddingLeft ) || 0;
	const padTop = parseFloat( style.paddingTop ) || 0;

	// The resolved template is the source of truth; the counts are only a fallback for the frame
	// before the grid has laid out.
	if ( ! colSizes.length || ! rowSizes.length ) {
		return {
			col: clamp( Math.floor( x / ( stage.offsetWidth / cols ) ), 0, cols - 1 ),
			row: clamp( Math.floor( y / ( stage.offsetHeight / rows ) ), 0, rows - 1 ),
		};
	}

	return {
		col: clamp( trackAt( colSizes, colGap, padLeft, x ), 0, colSizes.length - 1 ),
		row: clamp( trackAt( rowSizes, rowGap, padTop, y ), 0, rowSizes.length - 1 ),
	};
}

/** The rectangle between two cells, inclusive of both — so a single cell is a valid 1×1 box. */
function frameBetween( a: { col: number; row: number }, b: { col: number; row: number } ): Frame {
	return {
		col: Math.min( a.col, b.col ),
		row: Math.min( a.row, b.row ),
		colSpan: Math.abs( a.col - b.col ) + 1,
		rowSpan: Math.abs( a.row - b.row ) + 1,
	};
}

/**
 * The preview rectangle, written straight to the DOM.
 *
 * Same reasoning as the alignment guides: this updates on every pointer frame, and re-rendering
 * the block tree at that rate to move one outline would be work with nothing to show for it.
 */
function previewLayer( stage: HTMLElement ): HTMLElement {
	let layer = stage.querySelector< HTMLElement >( ':scope > .bl-scene-marquee' );
	if ( ! layer ) {
		layer = stage.ownerDocument.createElement( 'div' );
		layer.className = 'bl-scene-marquee';
		layer.setAttribute( 'aria-hidden', 'true' );
		stage.appendChild( layer );
	}
	return layer;
}

function drawPreview( stage: HTMLElement, frame: Frame, cols: number, rows: number, valid: boolean ): void {
	const layer = previewLayer( stage );
	layer.classList.toggle( 'is-blocked', ! valid );
	layer.style.left = `${ ( frame.col / cols ) * 100 }%`;
	layer.style.top = `${ ( frame.row / rows ) * 100 }%`;
	layer.style.width = `${ ( frame.colSpan / cols ) * 100 }%`;
	layer.style.height = `${ ( frame.rowSpan / rows ) * 100 }%`;
	layer.textContent = `${ frame.colSpan } × ${ frame.rowSpan }`;
}

function clearPreview( stage: HTMLElement ): void {
	stage.querySelector( ':scope > .bl-scene-marquee' )?.remove();
}

export function sceneMarqueeProps( { clientId, isEdit }: Options ) {
	if ( ! isEdit ) return {};

	const onPointerDown = ( event: React.PointerEvent< HTMLElement > ) => {
		if ( event.button !== 0 ) return;

		// A press that starts on an existing box belongs to that box's own move gesture.
		const target = event.target as HTMLElement | null;
		if ( target?.closest( '.bl-scene-box' ) ) return;

		const stage = event.currentTarget;
		const painted = stage.getBoundingClientRect().width;
		const layout = stage.offsetWidth;
		if ( ! painted || ! layout ) return;
		const scale = painted / layout;

		const styles = getComputedStyle( stage );
		const cols = Number( styles.getPropertyValue( '--bl-scene-cols' ) ) || 16;
		const rows = Number( styles.getPropertyValue( '--bl-scene-rows' ) ) || 16;

		const others = siblingFrames( clientId );
		const origin = cellAt( stage, scale, cols, rows, event.clientX, event.clientY );

		// A sweep that starts on an occupied cell was never going to produce anything legal.
		if ( ! fits( { ...origin, colSpan: 1, rowSpan: 1 }, others ) ) return;
		const startX = event.clientX;
		const startY = event.clientY;
		const doc = stage.ownerDocument;
		let drawing = false;
		let frame: Frame | null = null;

		const move = ( moveEvent: PointerEvent ) => {
			if ( ! drawing ) {
				if (
					Math.abs( moveEvent.clientX - startX ) < DRAW_THRESHOLD &&
					Math.abs( moveEvent.clientY - startY ) < DRAW_THRESHOLD
				) {
					return;
				}
				drawing = true;
			}
			moveEvent.preventDefault();
			frame = frameBetween( origin, cellAt( stage, scale, cols, rows, moveEvent.clientX, moveEvent.clientY ) );
			// Shown as blocked rather than silently clamped: the author is sweeping a region, and
			// snapping it to some smaller legal rectangle mid-gesture is harder to follow than
			// simply saying no.
			drawPreview( stage, frame, cols, rows, fits( frame, others ) );
		};

		const up = () => {
			doc.removeEventListener( 'pointermove', move );
			doc.removeEventListener( 'pointerup', up );
			doc.removeEventListener( 'pointercancel', up );
			clearPreview( stage );

			// Boxes may not overlap, so a blocked sweep creates nothing at all.
			if ( ! drawing || ! frame || ! fits( frame, others ) ) return;

			( dispatch( 'core/block-editor' ) as any ).insertBlock(
				createBlock( 'blicks/scene-box', { ...frame } ),
				undefined,
				clientId,
				true
			);
		};

		doc.addEventListener( 'pointermove', move );
		doc.addEventListener( 'pointerup', up );
		doc.addEventListener( 'pointercancel', up );
	};

	return { onPointerDown };
}
