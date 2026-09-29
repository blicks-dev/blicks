import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import { getValue, setValues } from '@/framework/values';
import { redirectToBox } from './drill-down';
import { hideReadout, showReadout } from './readout';
import './scene-item.scss';

/**
 * Move and resize for a scene item.
 *
 * Deliberately NOT React hooks. A block's `render` is shared between `edit()` and `save()`, and
 * `save()` is not a component render — a `useRef`/`useDispatch` on that path throws. So these are
 * plain functions using the non-hook `dispatch()` API, and the editor-only pieces return nothing
 * at all when `isEdit` is false.
 *
 * Three things are load-bearing throughout:
 *
 * 1. **Screen pixels are not design pixels.** The stage is laid out at its design size and then
 *    scaled, so a 100px pointer movement is 100 ÷ scale design pixels. The factor is read off the
 *    stage itself — `getBoundingClientRect().width` is the painted width, `offsetWidth` the
 *    unscaled layout width — so it needs no attribute plumbing and stays correct if the design
 *    size changes mid-session.
 *
 * 2. **A click must still edit text.** A move only begins once the pointer has travelled past a
 *    small threshold, and nothing is prevented before that, so a plain click reaches the RichText
 *    underneath and places the caret exactly as it would without this.
 *
 * 3. **One gesture is one undo step.** Every intermediate frame is flagged non-persistent, so the
 *    hundreds of updates a drag produces collapse into the single committed change on pointer-up.
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

/** Pointer travel, in screen pixels, before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 3;

/** Arrow key → the direction it nudges an item, in design pixels. */
const NUDGE: Record< string, { x: number; y: number } > = {
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 },
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
};

interface Options {
	attributes: any;
	setAttributes: ( a: any ) => void;
	/** Editor only — these return nothing at all on the save path. */
	isEdit: boolean;
	/**
	 * The element actually being moved, when that is not the thing under the pointer.
	 *
	 * The selection frame lives OUTSIDE the box's clipping layer so an item dragged out of view
	 * can still be grabbed. A gesture started there has to act on the item, not on the frame.
	 */
	itemFor?: ( event: React.PointerEvent< HTMLElement > ) => HTMLElement | null;
}

/**
 * Where the item's stored x/y sit within its own box, as a fraction. This is what the anchor
 * means, and every resize calculation below needs it: growing a centre-anchored item by 10px
 * moves each edge by 5, so the handle only tracks the pointer once the anchor is accounted for.
 */
const FRACTION: Record< string, number > = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };

function anchorFractions( raw: unknown ): { ax: number; ay: number } {
	const slug = String( raw ?? '' ).trim();
	if ( slug === '' ) return { ax: 0, ay: 0 };
	if ( slug === 'center' ) return { ax: 0.5, ay: 0.5 };
	const [ v, h ] = slug.split( '-' );
	return { ax: FRACTION[ h ] ?? 0, ay: FRACTION[ v ] ?? 0 };
}

/**
 * Resolve a stored coordinate to design pixels. A percentage is a share of the stage on that
 * axis; a bare number or `px` length is already design pixels. Anything else — a token slug, a
 * `calc()` — returns null, because a gesture would have to flatten deliberate authoring into a
 * plain length.
 */
function toDesignPx( raw: unknown, stageSize: number ): number | null {
	const value = String( raw ?? '' ).trim();
	if ( value === '' ) return 0;
	const percent = /^(-?\d+(?:\.\d+)?)%$/.exec( value );
	if ( percent ) return ( Number( percent[ 1 ] ) / 100 ) * stageSize;
	const px = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec( value );
	if ( px ) return Number( px[ 1 ] );
	return null;
}

const round = ( n: number ) => `${ Math.round( n ) }px`;

function markTransient(): void {
	( dispatch( 'core/block-editor' ) as any )?.__unstableMarkNextChangeAsNotPersistent?.();
}

/**
 * The BOX an item is positioned against, plus the factor between its painted and laid-out sizes.
 *
 * An item's coordinates are relative to its box, not to the stage — the box is the containing
 * block, so `left: 0` means the box's left edge. Every gesture therefore measures against the box:
 * the drag converts screen pixels through its scale, and snapping aligns to its edges.
 *
 * The scale is still the stage's, because a box is not independently transformed — it is laid out
 * inside a stage that is. Comparing the box's painted width to its own layout width yields the
 * same factor, and doing it here keeps the maths local to the element being moved.
 */
function stageOf( element: HTMLElement ): { stage: HTMLElement; scale: number } | null {
	// The CONTENT layer, not the box: it is the item's containing block, so `left: 0` is measured
	// from it. Same rect as the box (inset 0), so the numbers are identical either way — but
	// `:scope >` sibling lookups only work from the element the items are actually children of.
	const stage = element.closest( '.bl-scene-box__content' ) as HTMLElement | null;
	if ( ! stage ) return null;
	const painted = stage.getBoundingClientRect().width;
	const layout = stage.offsetWidth;
	if ( ! painted || ! layout ) return null;
	return { stage, scale: painted / layout };
}

/**
 * Run a pointer gesture: listeners on the element's OWN document (the editor renders blocks in an
 * iframe, so the top-level document never sees these events), a movement threshold before
 * anything is written, transient writes while moving and one persistent write at the end.
 */
function trackPointer(
	element: HTMLElement,
	start: { x: number; y: number },
	apply: ( dx: number, dy: number, persistent: boolean, event: PointerEvent ) => void
): void {
	const doc = element.ownerDocument;
	let dragging = false;

	const move = ( event: PointerEvent ) => {
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;

		if ( ! dragging ) {
			if ( Math.abs( dx ) < DRAG_THRESHOLD && Math.abs( dy ) < DRAG_THRESHOLD ) return;
			dragging = true;
		}

		// Past the threshold this is a gesture, not a text selection.
		event.preventDefault();
		apply( dx, dy, false, event );
	};

	const up = ( event: PointerEvent ) => {
		doc.removeEventListener( 'pointermove', move );
		doc.removeEventListener( 'pointerup', up );
		doc.removeEventListener( 'pointercancel', up );
		if ( ! dragging ) return;
		apply( event.clientX - start.x, event.clientY - start.y, true, event );
	};

	doc.addEventListener( 'pointermove', move );
	doc.addEventListener( 'pointerup', up );
	doc.addEventListener( 'pointercancel', up );
}


// ── Snapping ──────────────────────────────────────────────────────────────────

/** How close, in SCREEN pixels, an edge must come before it snaps. Converted to design px. */
const SNAP_PX = 6;

interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Every other item's box, in design pixels.
 *
 * Measured through `getBoundingClientRect` rather than `offsetLeft` on purpose: an item's anchor
 * is a `translate`, which moves what the author sees without touching its offset parent geometry.
 * Snapping has to line up the boxes people can see.
 */
function siblingBoxes( stage: HTMLElement, scale: number, exclude: HTMLElement ): Box[] {
	const stageRect = stage.getBoundingClientRect();
	return Array.from( stage.querySelectorAll< HTMLElement >( ':scope > .bl-scene-item' ) )
		.filter( ( el ) => el !== exclude && ! el.contains( exclude ) && ! exclude.contains( el ) )
		.map( ( el ) => {
			const r = el.getBoundingClientRect();
			return {
				left: ( r.left - stageRect.left ) / scale,
				top: ( r.top - stageRect.top ) / scale,
				width: r.width / scale,
				height: r.height / scale,
			};
		} );
}

/** The lines an edge can snap to on one axis: the stage's own thirds, plus every sibling edge. */
function candidates( boxes: Box[], stageSize: number, axis: 'x' | 'y' ): number[] {
	const out = [ 0, stageSize / 2, stageSize ];
	for ( const box of boxes ) {
		const start = axis === 'x' ? box.left : box.top;
		const size = axis === 'x' ? box.width : box.height;
		out.push( start, start + size / 2, start + size );
	}
	return out;
}

/** The nearest snap for any of `edges`, or a zero delta when nothing is within reach. */
function nearestSnap( edges: number[], lines: number[], threshold: number ): { delta: number; line: number | null } {
	let best: { delta: number; line: number | null; distance: number } = { delta: 0, line: null, distance: Infinity };
	for ( const edge of edges ) {
		for ( const line of lines ) {
			const delta = line - edge;
			const distance = Math.abs( delta );
			if ( distance <= threshold && distance < best.distance ) {
				best = { delta, line, distance };
			}
		}
	}
	return { delta: best.delta, line: best.line };
}

/**
 * Guides are drawn straight into the DOM rather than through React state.
 *
 * They update on every pointer frame, and re-rendering two block trees at that rate to move a pair
 * of 1px lines is work with nothing to show for it. This also keeps the guides working identically
 * whether the stage is in the canvas or in the full-screen surface.
 */
function guideLayer( stage: HTMLElement ): HTMLElement {
	let layer = stage.querySelector< HTMLElement >( ':scope > .bl-scene-guides' );
	if ( ! layer ) {
		layer = stage.ownerDocument.createElement( 'div' );
		layer.className = 'bl-scene-guides';
		layer.setAttribute( 'aria-hidden', 'true' );
		stage.appendChild( layer );
	}
	return layer;
}

function drawGuides( stage: HTMLElement, x: number | null, y: number | null ): void {
	const layer = guideLayer( stage );
	layer.textContent = '';
	const line = ( vertical: boolean, at: number ) => {
		const el = stage.ownerDocument.createElement( 'span' );
		el.className = `bl-scene-guides__line is-${ vertical ? 'v' : 'h' }`;
		el.style[ vertical ? 'left' : 'top' ] = `${ at }px`;
		layer.appendChild( el );
	};
	if ( x !== null ) line( true, x );
	if ( y !== null ) line( false, y );
}

export function clearGuides( stage: HTMLElement | null ): void {
	stage?.querySelector( ':scope > .bl-scene-guides' )?.remove();
}

// ── Move ────────────────────────────────────────────────────────────────────

export function sceneDragProps( { attributes, setAttributes, isEdit, itemFor }: Options ) {
	if ( ! isEdit ) return {};

	const onPointerDown = ( event: React.PointerEvent< HTMLElement > ) => {
		if ( event.button !== 0 ) return;

		// A box is a group: the first click into one selects the BOX, not whatever item happens to
		// be under the cursor. The event carries on to the box, which picks up the drag. Skipped
		// for the selection frame, which only exists once an item is already selected.
		if ( ! itemFor && redirectToBox( event ) ) return;

		const element = itemFor ? itemFor( event ) : event.currentTarget;
		if ( ! element ) return;
		const found = stageOf( element );
		if ( ! found ) return;
		const { stage, scale } = found;

		const startX = toDesignPx( getValue( attributes, 'sceneChild.x', 'default', 'base' ), stage.offsetWidth );
		const startY = toDesignPx( getValue( attributes, 'sceneChild.y', 'default', 'base' ), stage.offsetHeight );
		if ( startX === null || startY === null ) return;

		// Measured once, at the start: siblings do not move during the drag, and re-measuring every
		// frame would also read the dragged item's own in-flight position back as a snap target.
		const itemRect = element.getBoundingClientRect();
		const width = itemRect.width / scale;
		const height = itemRect.height / scale;
		const { ax, ay } = anchorFractions( getValue( attributes, 'sceneChild.anchor', 'default', 'base' ) );
		const boxes = siblingBoxes( stage, scale, element );
		const linesX = candidates( boxes, stage.offsetWidth, 'x' );
		const linesY = candidates( boxes, stage.offsetHeight, 'y' );
		const threshold = SNAP_PX / scale;

		trackPointer( element, { x: event.clientX, y: event.clientY }, ( dx, dy, persistent, moveEvent ) => {
			let nextX = startX + dx / scale;
			let nextY = startY + dy / scale;
			let guideX: number | null = null;
			let guideY: number | null = null;

			// Shift is the universal "ignore snapping" modifier — without an escape hatch, placing
			// something deliberately just off a guide becomes impossible.
			if ( ! moveEvent.shiftKey ) {
				// Stored coordinates address the ANCHOR point; snapping reasons about the visible
				// box, so convert out and back.
				const left = nextX - ax * width;
				const top = nextY - ay * height;
				const snapX = nearestSnap( [ left, left + width / 2, left + width ], linesX, threshold );
				const snapY = nearestSnap( [ top, top + height / 2, top + height ], linesY, threshold );
				nextX += snapX.delta;
				nextY += snapY.delta;
				guideX = snapX.line;
				guideY = snapY.line;
			}

			if ( persistent ) {
				clearGuides( stage );
				hideReadout();
			} else {
				drawGuides( stage, guideX, guideY );
				showReadout(
					`${ Math.round( nextX ) }, ${ Math.round( nextY ) }`,
					moveEvent.clientX,
					moveEvent.clientY
				);
			}

			if ( ! persistent ) markTransient();
			// x and y go in ONE write — see `setValues`. Two `setValue` calls from this handler
			// would derive both trees from the same stale snapshot, and the second would win.
			setValues( attributes, setAttributes, 'default', 'base', {
				'sceneChild.x': round( nextX ),
				'sceneChild.y': round( nextY ),
			} );
		} );
	};

	/**
	 * Arrow-key nudge: 1 design pixel, or 10 with Shift. Skipped whenever the key lands in text
	 * the author is editing, where the arrows belong to the caret — so this never fights typing.
	 */
	const onKeyDown = ( event: React.KeyboardEvent< HTMLElement > ) => {
		const step = NUDGE[ event.key ];
		if ( ! step ) return;

		const target = event.target as HTMLElement | null;
		if ( target?.isContentEditable || target?.closest?.( '[contenteditable="true"]' ) ) return;

		const element = event.currentTarget;
		const stage = element.closest( '.bl-scene__stage' ) as HTMLElement | null;
		if ( ! stage ) return;

		const x = toDesignPx( getValue( attributes, 'sceneChild.x', 'default', 'base' ), stage.offsetWidth );
		const y = toDesignPx( getValue( attributes, 'sceneChild.y', 'default', 'base' ), stage.offsetHeight );
		if ( x === null || y === null ) return;

		event.preventDefault();
		const distance = event.shiftKey ? 10 : 1;
		setValues( attributes, setAttributes, 'default', 'base', {
			'sceneChild.x': round( x + step.x * distance ),
			'sceneChild.y': round( y + step.y * distance ),
		} );
	};

	return { ...NO_NATIVE_DRAG, onPointerDown, onKeyDown };
}

// ── Resize ────────────────────────────────────────────────────────────────────

/** Which edges a handle drags, as a signed direction per axis. */
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

/** Below this a box is too small to grab a handle on and get back out of. */
const MIN_SIZE = 8;

/**
 * Resize handles for the selected item. Rendered whenever the block is in the editor; the
 * stylesheet reveals them only on `.is-selected`, which keeps this free of a selection
 * subscription — and `.is-selected` never appears in saved markup.
 *
 * The maths is anchor-aware. With `x` marking the anchor point and `ax` its fraction across the
 * box, the left edge is `x - ax·w` and the right edge `x + (1-ax)·w`. Dragging the right edge by
 * `d` while the left stays put gives `w' = w + d` and `x' = x + ax·d`; dragging the left edge
 * gives `w' = w - d` and `x' = x + (1-ax)·d`. Without the `x` correction a centre-anchored item
 * would slide out from under the pointer as it grew.
 */
export function SceneHandles( { attributes, setAttributes, isEdit, itemFor }: Options ) {
	if ( ! isEdit ) return null;

	const onPointerDown = ( handle: typeof HANDLES[ number ] ) => ( event: React.PointerEvent< HTMLElement > ) => {
		if ( event.button !== 0 ) return;
		// The handle sits on top of the item; without this the move gesture starts too.
		event.stopPropagation();

		const element = itemFor
			? itemFor( event )
			: ( event.currentTarget.closest( '.bl-scene-item' ) as HTMLElement | null );
		if ( ! element ) return;
		const found = stageOf( element );
		if ( ! found ) return;
		const { stage, scale } = found;

		const startX = toDesignPx( getValue( attributes, 'sceneChild.x', 'default', 'base' ), stage.offsetWidth );
		const startY = toDesignPx( getValue( attributes, 'sceneChild.y', 'default', 'base' ), stage.offsetHeight );
		if ( startX === null || startY === null ) return;

		// An unset width or height is whatever the content currently measures — `offsetWidth` is
		// the UNSCALED layout size, which is already design pixels.
		const startW = toDesignPx( getValue( attributes, 'sceneChild.width', 'default', 'base' ), stage.offsetWidth )
			|| element.offsetWidth;
		const startH = toDesignPx( getValue( attributes, 'sceneChild.height', 'default', 'base' ), stage.offsetHeight )
			|| element.offsetHeight;

		const { ax, ay } = anchorFractions( getValue( attributes, 'sceneChild.anchor', 'default', 'base' ) );

		trackPointer( element, { x: event.clientX, y: event.clientY }, ( dxRaw, dyRaw, persistent, moveEvent ) => {
			const dx = dxRaw / scale;
			const dy = dyRaw / scale;

			let w = startW;
			let h = startH;
			let x = startX;
			let y = startY;

			if ( handle.sx === 1 ) {
				w = Math.max( MIN_SIZE, startW + dx );
				x = startX + ax * ( w - startW );
			} else if ( handle.sx === -1 ) {
				w = Math.max( MIN_SIZE, startW - dx );
				x = startX + ( 1 - ax ) * ( startW - w );
			}

			if ( handle.sy === 1 ) {
				h = Math.max( MIN_SIZE, startH + dy );
				y = startY + ay * ( h - startH );
			} else if ( handle.sy === -1 ) {
				h = Math.max( MIN_SIZE, startH - dy );
				y = startY + ( 1 - ay ) * ( startH - h );
			}

			if ( persistent ) hideReadout();
			else showReadout( `${ Math.round( w ) } x ${ Math.round( h ) }`, moveEvent.clientX, moveEvent.clientY );

			// Up to four controls move together here, so they must land in one write.
			const changes: Record< string, string > = {};
			if ( handle.sx !== 0 ) {
				changes[ 'sceneChild.width' ] = round( w );
				changes[ 'sceneChild.x' ] = round( x );
			}
			if ( handle.sy !== 0 ) {
				changes[ 'sceneChild.height' ] = round( h );
				changes[ 'sceneChild.y' ] = round( y );
			}

			if ( persistent ) clearGuides( stage );
			if ( ! persistent ) markTransient();
			setValues( attributes, setAttributes, 'default', 'base', changes );
		} );
	};

	return (
		<span className="bl-scene-handles" aria-hidden="true">
			{ HANDLES.map( ( handle ) => (
				<span
					key={ handle.id }
					role="button"
					aria-label={ handle.label }
					className={ `bl-scene-handles__grip is-${ handle.id }` }
					onPointerDown={ onPointerDown( handle ) }
				/>
			) ) }
		</span>
	);
}
