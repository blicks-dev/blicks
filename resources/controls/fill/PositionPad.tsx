import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { validateSpaced } from '@/controls/common';
import { FieldGroup, ValueField } from '@/controls/ValueField';
import {
	POSITION_OPTIONS,
	POSITION_PATTERN,
	formatPosition,
	parsePosition,
	positionFromDrag,
	resolveBackgroundSize,
	snap,
	snapTo,
	type Size,
} from './position';

interface Props {
	value: string;
	/** Shown behind the pad, so the handle is dragged over the actual picture. */
	preview?: string;
	/** The image's own `background-size` and `background-repeat`, so the pad previews the background
	 *  the block will actually paint rather than a stand-in of it. Empty means the CSS initial
	 *  value, which is what the block gets too. */
	size?: string;
	repeat?: string;
	/** The settings that belong to this one — size, repeat, attachment — nested under its field
	 *  rather than shown as a section of their own. See the `FieldGroup` note below. */
	children?: React.ReactNode;
	/** Something is set among those children, so a collapsed group still says so. */
	nestedSet?: boolean;
	/** A property search is running: hold the nested group open so a match is never hidden. */
	searching?: boolean;
	onChange: ( next: string ) => void;
	onReset: () => void;
}

/**
 * Background position as a pad you drag.
 *
 * It replaces a nine-cell grid, and the reason is not that the grid was ugly: the grid could only
 * say nine things, while the property takes any pair of percentages. Dragging says all of them,
 * and snaps to the nine when you want them.
 *
 * **You drag the picture, not a marker.** `background-position` is a ratio between the image and
 * the box, which is a genuinely awkward thing to hold in your head — and an unnecessary one, since
 * what an author actually wants is "move that bit into view". So the image moves under the pointer
 * and the percentage is derived from where it lands. The marker stays as a read-out of the anchor
 * the value names; it is not the thing you grab.
 *
 * When there is no image, or its size is not known yet, the pad falls back to placing that anchor
 * directly — the old behaviour, and the only honest one when there is nothing to push around.
 *
 * Full width and unlabelled by design. A pad IS the box; a caption reading "POS" beside it would
 * be telling you what a picture of a box already says, and taking a third of the row to do it.
 */
export function PositionPad( {
	value,
	preview,
	size,
	repeat,
	children,
	nestedSet,
	searching,
	onChange,
	onReset,
}: Props ) {
	const padRef = useRef< HTMLDivElement >( null );
	const [ dragging, setDragging ] = useState( false );
	/**
	 * Where the drag is right now, at full precision.
	 *
	 * The pad renders from this rather than from the stored value, which decouples how smoothly the
	 * image moves from how often the block is written to. One is a 60fps concern; the other is a
	 * whole editor re-render, and they should not be the same event.
	 */
	const [ live, setLive ] = useState< { x: number; y: number } | null >( null );
	const stored = parsePosition( value );
	const { x, y } = live ?? stored;

	// The image's intrinsic size, which only the browser can tell us — and only after it has the
	// file. Until then the pad is in anchor mode, which is why this is state rather than a ref.
	const [ natural, setNatural ] = useState< Size | null >( null );
	useEffect( () => {
		if ( ! preview ) {
			setNatural( null );
			return;
		}
		let live = true;
		const probe = new window.Image();
		probe.onload = () => {
			if ( live ) setNatural( { w: probe.naturalWidth, h: probe.naturalHeight } );
		};
		probe.onerror = () => {
			if ( live ) setNatural( null );
		};
		probe.src = preview;
		return () => {
			live = false;
		};
	}, [ preview ] );

	/** Everything the drag needs, captured once at pointer-down: the pointer, the percentages at
	 *  that moment, the pad's box, and the image's rendered size. None of it can change while a
	 *  drag is in flight, so none of it is worth re-reading per frame. */
	const drag = useRef< {
		pointerId: number;
		clientX: number;
		clientY: number;
		x: number;
		y: number;
		rect: { left: number; top: number; w: number; h: number };
		image: Size | null;
		startValue: string;
	} | null >( null );
	/** The last value actually written, so a frame that rounds to what is already stored writes
	 *  nothing at all. */
	const committed = useRef( value );

	/**
	 * The image's rendered size inside the pad.
	 *
	 * Exact for `cover`, `contain` and percentage sizes, because those are ratios of the box and a
	 * ratio does not care that the pad is a miniature. `auto` renders at intrinsic pixels, which the
	 * real element sizes differently — so there the drag is proportionally right rather than
	 * pixel-exact, and the canvas is the thing that settles it.
	 */
	const renderedSize = ( box: { w: number; h: number } ): Size | null => {
		if ( ! natural ) return null;
		const out = resolveBackgroundSize( box, natural, size || '' );
		return out.w && out.h ? out : null;
	};

	/**
	 * Commit, but only when the stored value would actually differ.
	 *
	 * Every write goes through the block's attributes, which re-renders the editor and restyles the
	 * canvas — perfectly affordable a few times a second, and the reason the pad stuttered when it
	 * happened on every pointer event. Since what gets stored is whole percent, most frames of a
	 * slow drag round to the value already there and need no write at all.
	 */
	const commit = ( nextX: number, nextY: number ) => {
		const next = formatPosition( Math.round( nextX ), Math.round( nextY ) );
		if ( next === committed.current ) return;
		committed.current = next;
		onChange( next );
	};

	/** Paint at full precision, store at whole percent. */
	const apply = ( nextX: number, nextY: number ) => {
		setLive( { x: nextX, y: nextY } );
		commit( nextX, nextY );
	};

	const dragImage = ( clientX: number, clientY: number ) => {
		const start = drag.current;
		if ( ! start?.image ) return;

		const nextX = positionFromDrag( start.rect.w, start.image.w, start.x, clientX - start.clientX );
		const nextY = positionFromDrag( start.rect.h, start.image.h, start.y, clientY - start.clientY );
		// A null axis has no slack to move along — keep whatever it already said rather than
		// writing a number that renders identically.
		apply(
			nextX === null ? start.x : snapTo( nextX, 3 ),
			nextY === null ? start.y : snapTo( nextY, 3 )
		);
	};

	const pointTo = ( clientX: number, clientY: number ) => {
		const start = drag.current;
		if ( ! start ) return;
		const clamp = ( v: number ) => Math.min( 100, Math.max( 0, v ) );
		apply(
			clamp( snapTo( ( ( clientX - start.rect.left ) / start.rect.w ) * 100 ) ),
			clamp( snapTo( ( ( clientY - start.rect.top ) / start.rect.h ) * 100 ) )
		);
	};

	const canDragImage = Boolean( preview && natural );

	const onPointerDown = ( event: React.PointerEvent< HTMLDivElement > ) => {
		// A second finger mid-drag would otherwise fight the first for the same value.
		if ( drag.current ) return;
		event.preventDefault();
		( event.currentTarget as HTMLElement ).setPointerCapture( event.pointerId );

		// The pad cannot move or resize mid-drag, so its box and the image's rendered size are read
		// once here. Reading them per pointer event forces a layout flush on every frame, which is
		// the other half of why this stuttered.
		const box = ( event.currentTarget as HTMLElement ).getBoundingClientRect();
		const rect = { left: box.left, top: box.top, w: box.width, h: box.height };
		drag.current = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			x,
			y,
			rect,
			image: canDragImage ? renderedSize( { w: rect.w, h: rect.h } ) : null,
			startValue: value,
		};
		committed.current = value;
		setDragging( true );

		// Grabbing the image must not teleport it under the cursor first — the whole point is that
		// it stays where it is and follows the hand from there. Placing the anchor is the opposite:
		// there, the press IS the placement.
		if ( ! canDragImage ) pointTo( event.clientX, event.clientY );
	};

	const onPointerMove = ( event: React.PointerEvent< HTMLDivElement > ) => {
		if ( drag.current?.pointerId !== event.pointerId ) return;
		if ( canDragImage ) {
			dragImage( event.clientX, event.clientY );
			return;
		}
		pointTo( event.clientX, event.clientY );
	};

	const endDrag = ( event: React.PointerEvent< HTMLDivElement > ) => {
		if ( drag.current?.pointerId !== event.pointerId ) return;
		( event.currentTarget as HTMLElement ).releasePointerCapture?.( event.pointerId );
		drag.current = null;
		setDragging( false );
		// Drop back to the stored value: it is the rounded one, and holding the live float would
		// leave the pad showing a position the block does not have.
		setLive( null );
	};

	/** Escape puts it back where the drag started — the standard escape hatch for a direct
	 *  manipulation you have thought better of halfway through. */
	const cancelDrag = () => {
		const start = drag.current;
		if ( ! start ) return;
		drag.current = null;
		setDragging( false );
		setLive( null );
		if ( start.startValue !== committed.current ) onChange( start.startValue );
	};

	// Arrows nudge by a step, Shift by a third — so the keyboard can reach every value the pointer
	// can, including the corners.
	const onKeyDown = ( event: React.KeyboardEvent< HTMLDivElement > ) => {
		const step = event.shiftKey ? 50 : 5;
		const moves: Record< string, [ number, number ] > = {
			ArrowLeft: [ -step, 0 ],
			ArrowRight: [ step, 0 ],
			ArrowUp: [ 0, -step ],
			ArrowDown: [ 0, step ],
		};
		if ( event.key === 'Escape' ) {
			cancelDrag();
			return;
		}
		const move = moves[ event.key ];
		if ( ! move ) return;
		event.preventDefault();
		onChange( formatPosition(
			Math.min( 100, Math.max( 0, snap( x + move[ 0 ] ) ) ),
			Math.min( 100, Math.max( 0, snap( y + move[ 1 ] ) ) )
		) );
	};

	// Honest preview: the same declarations the style engine emits, initial values included. A
	// background with no size really is `auto` and really does tile, and a pad that quietly showed
	// everything as a single `cover` image would flatter settings the page will not honour.
	const imageStyle: React.CSSProperties = {
		backgroundImage: preview ? `url("${ preview }")` : undefined,
		backgroundSize: size || 'auto',
		backgroundRepeat: repeat || 'repeat',
		// Whole percent while at rest — it is what the block holds — and full precision while
		// dragging, so the picture glides instead of stepping.
		backgroundPosition: live ? `${ live.x.toFixed( 2 ) }% ${ live.y.toFixed( 2 ) }%` : value || 'center center',
	};

	const field = ( toggle?: React.ReactNode ) => (
		<ValueField
			className="bl-fill-pad__input"
			affix={ toggle }
			value={ value }
			options={ POSITION_OPTIONS }
			placeholder="center center"
			listLabel="POSITIONS"
			ariaLabel={ __( 'Image position', 'blicks' ) }
			modified={ Boolean( value ) }
			onChange={ onChange }
			onCommit={ ( raw ) => onChange( validateSpaced( raw.toLowerCase(), POSITION_PATTERN ) ) }
			onReset={ onReset }
		/>
	);

	return (
		<div className="bl-fill-pad">
			<div
				ref={ padRef }
				className={ `bl-fill-pad__field ${ canDragImage ? 'is-movable' : '' } ${ dragging ? 'is-dragging' : '' }` }
				role="application"
				tabIndex={ 0 }
				aria-label={ canDragImage
					? __( 'Image position — drag the image, or use the arrow keys', 'blicks' )
					: __( 'Image position — drag, or use the arrow keys', 'blicks' ) }
				onPointerDown={ onPointerDown }
				onPointerMove={ onPointerMove }
				onPointerUp={ endDrag }
				onPointerCancel={ endDrag }
				onKeyDown={ onKeyDown }
			>
				{ /* The image is its own layer so the pad keeps its chequerboard underneath — which is
				     also what makes a `contain` or an un-tiled image read as sitting *in* a box. */ }
				<span className="bl-fill-pad__img" style={ imageStyle } aria-hidden="true" />
				{ /* Thirds, so the nine keyword positions stay visible as targets on a surface that is
				     otherwise continuous. */ }
				<span className="bl-fill-pad__thirds" aria-hidden="true" />
				<span
					className={ `bl-fill-pad__handle ${ canDragImage ? 'is-marker' : '' }` }
					style={ { left: `${ x.toFixed( 2 ) }%`, top: `${ y.toFixed( 2 ) }%` } }
				/>
			</div>
			{ /* Typed as well as dragged: the pad cannot express `2rem 40px`, and someone matching a
			     design token by hand should not have to approximate it with a pointer.

			     Size, repeat and attachment hang off THIS field rather than off a section of their
			     own. They are not a separate topic you go and visit — they are the rest of how this
			     image is placed, and the same nesting carries min and max under Width and the insets
			     under Position. A collapsed group keeps a dot when it holds something. */ }
			{ children ? (
				<FieldGroup
					title={ __( 'Size, tiling and scrolling', 'blicks' ) }
					constrained={ nestedSet }
					defaultOpen={ nestedSet }
					forceOpen={ searching }
					field={ ( toggle ) => field( toggle ) }
				>
					{ children }
				</FieldGroup>
			) : (
				field()
			) }
		</div>
	);
}
