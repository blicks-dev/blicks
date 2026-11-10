/**
 * The world the work floats in.
 *
 * **Not a scrolling pane.** A scroller only moves along axes its content overflows, so a
 * composition narrower than the viewport cannot be moved at all, and one that is taller can only
 * be moved down. Both are wrong for a canvas: the point is that the work sits somewhere in a space
 * you move around freely, and the chrome floats above it rather than taking room from it.
 *
 * So there is no `overflow: auto` anywhere here. Pan is a transform, which means it works in every
 * direction regardless of content size, survives zoom without fighting scroll anchoring, and costs
 * one composited layer instead of a reflow.
 *
 * This is the shell's, not a mode's. Stage and Flow draw different things INSIDE the same world and
 * must agree about where the origin is, what zoom means and how fit is measured — which is exactly
 * the kind of agreement that rots when two modes each own a copy.
 */

import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from '@wordpress/element';

/**
 * Breathing room inside the clear area, so a fitted composition does not touch the chrome.
 *
 * The world is full-bleed and the chrome floats over it, so what the work has to fit is not the
 * world's box but what the chrome leaves of it — the `frame` the shell measures and hands in. This
 * is the margin on top of that.
 */
const INSET = 24;

/**
 * How far in from each edge of the world the chrome reaches, in pixels.
 *
 * Measured by the shell rather than known here: a sidebar's width depends on its toolbar's labels
 * and therefore on the translation, and the centre toolbar moves to the bottom on a narrow screen.
 */
export interface Frame {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/** Zoom bounds. Wide enough to inspect a detail, tight enough that a stray gesture cannot lose the work. */
const MIN_ZOOM = 10;
const MAX_ZOOM = 400;

interface Props {
	zoom: number;
	onZoom: ( zoom: number ) => void;
	/** Changes when the thing being framed changes size, so Fit can re-run. */
	fitKey: string;
	/** What the floating chrome covers. Fit frames the work in what is left. */
	frame: Frame;
	/** How many times the author has zoomed from outside the canvas (the toolbar's − and +). */
	zoomedBy: number;
	children: React.ReactNode;
}

export function StudioCanvas( { zoom, onZoom, fitKey, frame, zoomedBy, children }: Props ): JSX.Element {
	const world = useRef< HTMLDivElement | null >( null );
	const content = useRef< HTMLDivElement | null >( null );

	/**
	 * Whether the author has taken the view for the thing currently mounted.
	 *
	 * **Fit owns the view until someone pans or zooms, and this is the flag that says when that
	 * happened.** The first version latched on "one fit has measured something non-zero", which
	 * sounds equivalent and is not: a Scene lays out its text before it has a stage, so the first
	 * real measurement was 429×52 rather than 1440×800. Fit framed that honestly, latched, and a
	 * full-size stage then sat at 100% in the corner of a canvas three times too narrow for it.
	 *
	 * Non-zero is not the same as finished, and there is no way to ask an element whether it has
	 * stopped changing size. So the condition is about intent instead, which is knowable: re-fit
	 * on every size change until a gesture says the view is no longer ours to decide.
	 */
	const touched = useRef( false );
	const [ pan, setPan ] = useState( { x: 0, y: 0 } );
	const [ panning, setPanning ] = useState( false );
	/** Set while a re-fit glides the work to make room for a sidebar. Never set for a gesture. */
	const [ easing, setEasing ] = useState( false );


	/**
	 * Frame the content in the part of the world the chrome leaves clear.
	 *
	 * The world runs under the sidebars, so centring in its own box would sit the composition a
	 * third of the way under one of them. The frame is subtracted first, then the margin.
	 *
	 * Never changes the zoom from 100%, in either direction: how big someone's design looks is
	 * theirs to decide with the zoom controls, not the tool's to decide from the window size.
	 */
	/** The zoom as last set, read by handlers that can run several times before a render. */
	const zoomNow = useRef( zoom );
	zoomNow.current = zoom;

	/** What the last fit measured: the world's box and the content's layout width. */
	const fitted = useRef< { worldW: number; worldH: number; w: number } | null >( null );

	/** The frame as last measured, for the observer, which is set up once per thing framed. */
	const frameNow = useRef( frame );
	frameNow.current = frame;

	const fit = useCallback( () => {
		const box = world.current?.getBoundingClientRect();

		if ( ! box || box.width === 0 || box.height === 0 ) {
			return;
		}

		const clearW = box.width - frame.left - frame.right - INSET * 2;
		const clearH = box.height - frame.top - frame.bottom - INSET * 2;

		if ( clearW <= 0 || clearH <= 0 ) {
			return;
		}

		/*
		 * The content's layout size, which a transform does not touch. Dividing the scaled rect
		 * by the zoom state looked equivalent and was not: two fits can land between a zoom being
		 * set and its transform being drawn, and the second then measured the old scale against
		 * the new zoom and compounded — straight down to the minimum.
		 */
		const naturalW = content.current?.offsetWidth ?? 0;
		const naturalH = content.current?.offsetHeight ?? 0;

		if ( naturalW === 0 || naturalH === 0 ) {
			return;
		}

		/*
		 * Always 100%. Shrinking the work to fit the window made a 1440 Section open at 60% on a
		 * laptop, where nothing could be read or clicked with any accuracy — the size the author
		 * designs at is the size they should see. Work wider than the clear area starts with its
		 * left edge beside the sidebar, so its beginning is on screen and the rest is a pan away.
		 */
		const next = 100;

		fitted.current = { worldW: box.width, worldH: box.height, w: naturalW };
		zoomNow.current = next;

		setPan( {
			x: frame.left + INSET + Math.max( 0, ( clearW - naturalW ) / 2 ),
			y: frame.top + INSET + Math.max( 0, ( clearH - naturalH ) / 2 ),
		} );

		onZoom( next );
	}, [ onZoom, frame ] );

	/** The current `fit`, for observers and effects set up once that must not frame with a stale frame. */
	const latestFit = useRef( fit );
	latestFit.current = fit;

	/*
	 * The toolbar's own − and + never come through this component, so a zoom set there would be
	 * quietly undone by the next re-fit. The shell counts those presses and the count arriving is
	 * somebody taking the view.
	 *
	 * Counted rather than inferred. "Any zoom that is not the one fit just chose" read the same
	 * thing off the zoom value, and misfired whenever two fits landed before a render — the shell
	 * opening with its sidebars measured a beat after the first fit — which left the work framed
	 * under a sidebar and the view marked as taken.
	 */
	useEffect( () => {
		if ( zoomedBy > 0 ) {
			touched.current = true;
		}
	}, [ zoomedBy ] );

	// Frame once per thing framed. `fit` is deliberately not a dependency: it changes with the
	// frame, and the frame has its own effect below that knows whether the view is still ours.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useLayoutEffect( () => {
		touched.current = false;
		fit();
	}, [ fitKey ] );

	/*
	 * Re-frame while the view is still ours.
	 *
	 * Both sides arrive at their size late, each for its own reason. The world is a flex child, so
	 * it has no height until the body resolves one. The content is a Scene, which takes its width
	 * from `--bl-scene-w` and lays out its text before it has a stage — so it is briefly a small
	 * box with a real, wrong size. Watching only the world, and stopping at the first non-zero
	 * measurement, framed that wrong box and kept it.
	 *
	 * Re-fitting is safe precisely because `touched` stops it the moment anyone pans or zooms. A
	 * fit does not feed itself: it changes a transform, and `ResizeObserver` reports layout boxes,
	 * which a transform does not alter.
	 */
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useLayoutEffect( () => {
		const observer = new ResizeObserver( () => {
			if ( touched.current ) {
				return;
			}

			/*
			 * The work only grew or shrank in height — a block selected, a panel shown — at the same
			 * width, in the same world, and still fits at the zoom it has: leave the view alone.
			 * Re-centring it would move the work under the pointer every time something is
			 * selected, which is the one thing selecting must never do.
			 */
			const last = fitted.current;
			const box = world.current?.getBoundingClientRect();
			const w = content.current?.offsetWidth ?? 0;
			const h = content.current?.offsetHeight ?? 0;

			if ( last && box && last.worldW === box.width && last.worldH === box.height && last.w === w ) {
				const clearH = box.height - frameNow.current.top - frameNow.current.bottom - INSET * 2;

				if ( h * ( zoomNow.current / 100 ) <= clearH ) {
					return;
				}
			}

			latestFit.current();
		} );

		if ( world.current ) {
			observer.observe( world.current );
		}

		if ( content.current ) {
			observer.observe( content.current );
		}

		return () => observer.disconnect();
	}, [ fitKey ] );

	/*
	 * A sidebar opened or closed: re-frame, gliding rather than jumping, while the view is still
	 * ours. Once someone has panned or zoomed the work stays exactly where they put it — a sidebar
	 * opening over it is the chrome moving, not a reason to move the work.
	 */
	const frameKey = `${ frame.top }:${ frame.right }:${ frame.bottom }:${ frame.left }`;
	const framed = useRef( frameKey );

	useEffect( () => {
		if ( framed.current === frameKey ) {
			return;
		}

		framed.current = frameKey;

		if ( touched.current ) {
			return;
		}

		setEasing( true );
		latestFit.current();

		const done = window.setTimeout( () => setEasing( false ), 400 );

		return () => window.clearTimeout( done );
	}, [ frameKey ] );

	/**
	 * Wheel pans; wheel with the primary modifier zooms about the pointer.
	 *
	 * Zooming about the POINTER rather than the centre is what makes a canvas feel like a map: the
	 * thing under the cursor stays under the cursor. Zooming about the centre makes every zoom a
	 * zoom plus a hunt for what you were looking at.
	 */
	useEffect( () => {
		const element = world.current;

		if ( ! element ) {
			return;
		}

		const onWheel = ( event: WheelEvent ): void => {
			event.preventDefault();

			touched.current = true;
			setEasing( false );

			if ( ! event.ctrlKey && ! event.metaKey ) {
				setPan( ( p ) => ( { x: p.x - event.deltaX, y: p.y - event.deltaY } ) );
				return;
			}

			const box = element.getBoundingClientRect();
			const px = event.clientX - box.left;
			const py = event.clientY - box.top;

			// A trackpad pinch reports deltas around 1–10; a mouse wheel reports 100+. Scaling by
			// the raw delta makes one notch of a mouse jump from 80% to 200%, so it is clamped
			// before it is applied rather than after.
			//
			// The zoom is read from a ref, not the render's value: a pinch sends several events per
			// frame, and each one scaled the pan by a ratio against the same stale zoom, so the pan
			// compounded while the zoom did not and the work slid out of view.
			const current = zoomNow.current;
			const step = Math.max( -40, Math.min( 40, event.deltaY ) );
			const next = Math.max( MIN_ZOOM, Math.min( MAX_ZOOM, Math.round( current * ( 1 - step / 200 ) ) ) );

			if ( next === current ) {
				return;
			}

			const ratio = next / current;

			zoomNow.current = next;
			setPan( ( p ) => ( { x: px - ( px - p.x ) * ratio, y: py - ( py - p.y ) * ratio } ) );
			onZoom( next );
		};

		// Not passive: this prevents the page behind from scrolling and the browser from zooming.
		element.addEventListener( 'wheel', onWheel, { passive: false } );

		return () => element.removeEventListener( 'wheel', onWheel );
	}, [ onZoom ] );

	/*
	 * Selecting must not move the camera. Focusing a block makes the browser scroll every ancestor
	 * to show it — the world included, `overflow: hidden` or not — which slid the whole work under
	 * the sidebars. Any such scroll is undone, and a block focused outside the clear area is brought
	 * into it by panning, the least that shows it, never by zooming.
	 */
	useEffect( () => {
		const element = world.current;

		if ( ! element ) {
			return;
		}

		const onScroll = (): void => {
			if ( element.scrollTop !== 0 || element.scrollLeft !== 0 ) {
				element.scrollTop = 0;
				element.scrollLeft = 0;
			}
		};

		const onFocus = ( event: FocusEvent ): void => {
			const target = event.target as HTMLElement | null;

			if ( ! target || ! content.current?.contains( target ) ) {
				return;
			}

			onScroll();

			const box = element.getBoundingClientRect();
			const r = target.getBoundingClientRect();
			const left = box.left + frame.left;
			const right = box.right - frame.right;
			const top = box.top + frame.top;
			const bottom = box.bottom - frame.bottom;
			// Off-screen means not visible at all: a block partly in view is left where it is.
			const off = r.right < left || r.left > right || r.bottom < top || r.top > bottom;

			if ( ! off ) {
				return;
			}

			const dx = r.left < left ? left + INSET - r.left : r.right > right ? right - INSET - r.right : 0;
			const dy = r.top < top ? top + INSET - r.top : r.bottom > bottom ? bottom - INSET - r.bottom : 0;

			touched.current = true;
			setPan( ( p ) => ( { x: p.x + dx, y: p.y + dy } ) );
		};

		element.addEventListener( 'scroll', onScroll );
		element.addEventListener( 'focusin', onFocus );

		return () => {
			element.removeEventListener( 'scroll', onScroll );
			element.removeEventListener( 'focusin', onFocus );
		};
	}, [ frame ] );

	/**
	 * Drag the empty world to move it.
	 *
	 * Only when the gesture starts on the world itself, never on the work: a drag that begins on a
	 * block belongs to the block — selecting, or moving it once Stage can. Middle-button drags pan
	 * from anywhere, which is what people who pan a lot reach for.
	 */
	const onPointerDown = ( event: React.PointerEvent< HTMLDivElement > ): void => {
		const onBackground = event.target === world.current || event.target === content.current;

		if ( ! onBackground && 1 !== event.button ) {
			return;
		}

		const start = { x: event.clientX, y: event.clientY };
		const from = { ...pan };

		/*
		 * No `setPointerCapture`. Move and release are listened for on `window`, which already
		 * catches a pointer that leaves the element — capture would add nothing, and it throws
		 * outright for a pointer id the browser has no record of, aborting the gesture before the
		 * listeners below are ever attached.
		 */
		touched.current = true;
		setEasing( false );
		setPanning( true );

		const move = ( e: PointerEvent ): void => {
			setPan( { x: from.x + ( e.clientX - start.x ), y: from.y + ( e.clientY - start.y ) } );
		};

		const up = (): void => {
			setPanning( false );
			window.removeEventListener( 'pointermove', move );
			window.removeEventListener( 'pointerup', up );
		};

		window.addEventListener( 'pointermove', move );
		window.addEventListener( 'pointerup', up );
	};

	return (
		<div
			ref={ world }
			className={ panning ? 'bl-studio__world bl-studio__world--panning' : 'bl-studio__world' }
			onPointerDown={ onPointerDown }
			/*
			 * The clear area, for the hint: it sits at the foot of what the chrome leaves, not of the
			 * window, so an open sidebar never covers it.
			 */
			style={ {
				[ '--bl-studio-clear-top' as string ]: `${ frame.top }px`,
				[ '--bl-studio-clear-right' as string ]: `${ frame.right }px`,
				[ '--bl-studio-clear-bottom' as string ]: `${ frame.bottom }px`,
				[ '--bl-studio-clear-left' as string ]: `${ frame.left }px`,
			} }
		>
			<div
				ref={ content }
				className={ easing ? 'bl-studio__viewport bl-studio__viewport--easing' : 'bl-studio__viewport' }
				style={ {
					transform: `translate3d(${ pan.x }px, ${ pan.y }px, 0) scale(${ zoom / 100 })`,
					transformOrigin: '0 0',
				} }
			>
				{ children }
			</div>
			{ /* How to get around, where the getting around happens. Never in the way: it takes no pointer. */ }
			<p className="bl-studio__hint">
				{ __( 'Click to select · drag empty space or scroll to move around · ⌘ or Ctrl + scroll to zoom', 'blicks' ) }
			</p>
		</div>
	);
}
