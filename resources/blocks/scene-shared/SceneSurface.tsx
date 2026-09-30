import { __, sprintf } from '@wordpress/i18n';
import { dispatch, select, useDispatch, useSelect } from '@wordpress/data';
import { createPortal, useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { createSceneBox } from '@/blocks/scene-box';
import { gridOf } from '@/blocks/scene/controls';
import { firstFreeFrame, frameOf } from '@/blocks/scene-box/occupancy';
import { sceneMarqueeProps } from './scene-marquee';
import { createCentredItem } from './new-item';
import { setSceneEditorOpen } from './editor-state';
import { SceneLayers } from './SceneLayers';
import { SceneSelection } from './SceneSelection';
import { SceneInspector } from './SceneInspector';
import { SceneEmpty } from './SceneEmpty';
import { SceneShortcuts } from './SceneShortcuts';
import { SceneCells } from './SceneCells';
import './scene-surface.scss';

interface Props {
	clientId: string;
	designWidth: number;
	designHeight: number;
	/** The live `useInnerBlocksProps` object — the SAME one the in-canvas stage would spread. */
	innerBlocksProps: any;
	className: string;
	style: Record< string, unknown >;
}

const ZOOM_STEPS = [ 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2 ];
const MIN_ZOOM = ZOOM_STEPS[ 0 ];
const MAX_ZOOM = ZOOM_STEPS[ ZOOM_STEPS.length - 1 ];

/** Padding kept between the stage and the surface edge when fitting. */
const FIT_MARGIN = 96;

const clampZoom = ( z: number ) => Math.min( MAX_ZOOM, Math.max( MIN_ZOOM, z ) );

/**
 * Whether each rail is open, remembered between sessions.
 *
 * An authoring preference, so it belongs to the PERSON, not to the post — putting it in a block
 * attribute would write one author's panel layout into everyone's saved markup. `localStorage` is
 * per-browser, which is exactly the right scope, and every access is guarded because it throws
 * outright in a private window with site data blocked.
 */
const RAILS_KEY = 'blicks.scene.rails';

function readRails(): { left: boolean; right: boolean } {
	try {
		const raw = JSON.parse( window.localStorage.getItem( RAILS_KEY ) ?? '' );
		return { left: raw.left !== false, right: raw.right !== false };
	} catch {
		return { left: true, right: true };
	}
}

function writeRails( rails: { left: boolean; right: boolean } ): void {
	try {
		window.localStorage.setItem( RAILS_KEY, JSON.stringify( rails ) );
	} catch {
		// A preference that cannot be saved is not worth taking the editor down for.
	}
}

/**
 * The document the surface mounts into.
 *
 * It must cover the WINDOW, not the canvas. A block renders inside the editor's iframe, where
 * `position: fixed` is bounded by that iframe — mounting there leaves the surface trapped in the
 * canvas area. So this walks out to the top-level admin document. Same-origin, so to React it is
 * just another DOM node.
 */
function surfaceDocument( node: HTMLElement | null ): Document | null {
	const own = node?.ownerDocument ?? null;
	try {
		return own?.defaultView?.parent?.document ?? own;
	} catch {
		// A cross-origin parent should be impossible here, but a thrown access must not take the
		// editor down — fall back to the iframe and merely look confined.
		return own;
	}
}

const icon = ( path: JSX.Element ) => (
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		{ path }
	</svg>
);

/**
 * The full-screen Scene editor.
 *
 * It renders the REAL inner blocks, not a preview: `innerBlocksProps` is the same object the
 * in-canvas stage would have spread, just mounted somewhere else. React context travels through a
 * portal regardless of where the DOM node lands, so the block-editor store, selection and every
 * existing interaction (drag, resize, nudge, RichText) keep working untouched.
 *
 * The portal targets the block's OWN document. In the editor that is the canvas iframe, which
 * matters twice over: the iframe is where the editor stylesheets live, so the stage looks right
 * without re-injecting anything, and it is the document whose pointer events the drag code already
 * listens on.
 */
export function SceneSurface( { clientId, designWidth, designHeight, innerBlocksProps, className, style }: Props ) {
	const anchor = useRef< HTMLDivElement | null >( null );
	const viewport = useRef< HTMLDivElement | null >( null );
	const [ zoom, setZoom ] = useState( 1 );
	// Where the world sits under the viewport, in SCREEN pixels. The canvas is infinite: there is
	// no scroll container and no content box to be bounded by, so the only record of where an
	// author has moved to is this offset.
	const [ pan, setPan ] = useState( { x: 0, y: 0 } );
	const [ panning, setPanning ] = useState( false );
	// A mirror of `pan`, so a gesture can read where it started without a side-effecting state
	// updater. React may invoke an updater more than once, which would make an updater that writes
	// to a closure variable a coin toss.
	const panRef = useRef( { x: 0, y: 0 } );
	// Space is the hold-to-pan modifier every canvas tool uses. Held state, not a keypress, so it
	// lives outside React's render path — a re-render per keydown would fight the pointer.
	const spaceHeld = useRef( false );
	// Bumped on every Play. Used as a React key on the stage wrapper so the whole subtree
	// remounts, which is the only reliable way to restart a CSS animation that has already
	// finished — toggling a class leaves `animation-fill-mode: both` holding the end state.
	const [ playToken, setPlayToken ] = useState( 0 );
	const [ previewing, setPreviewing ] = useState( false );
	const [ shortcuts, setShortcuts ] = useState( false );
	const [ rails, setRails ] = useState( readRails );

	const toggleRail = useCallback( ( side: 'left' | 'right' ) => {
		setRails( ( current ) => {
			const next = { ...current, [ side ]: ! current[ side ] };
			writeRails( next );
			return next;
		} );
	}, [] );
	const [ fitted, setFitted ] = useState( false );
	// Resolved in an effect, NOT during render: the anchor ref is null on the first pass, so
	// reading it inline yields no portal target and the surface never mounts at all. Holding it in
	// state guarantees exactly one re-render once the ref exists.
	const [ doc, setDoc ] = useState< Document | null >( null );

	useEffect( () => {
		setDoc( surfaceDocument( anchor.current ) );
	}, [] );

	const close = useCallback( () => setSceneEditorOpen( clientId, false ), [ clientId ] );

	/**
	 * Play the composition from the start.
	 *
	 * Entrances are authored on a `view()` timeline, which drives them from scroll position — and
	 * nothing scrolls in the editor, so they would otherwise sit frozen at their first frame. In
	 * preview the stylesheet forces `animation-timeline: auto`, putting them back on the clock.
	 */
	const play = useCallback( () => {
		setPreviewing( true );
		setPlayToken( ( n ) => n + 1 );
	}, [] );

	const { insertBlock } = useDispatch( 'core/block-editor' ) as any;
	const { count, boxes, cols, rows, showGrid } = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const scene = store.getBlockAttributes( clientId ) ?? {};
			return {
				count: store.getBlockCount( clientId ),
				boxes: store.getBlocks( clientId ) ?? [],
				// Derived, never read raw: a custom track list overrides the count, and the cells
				// have to be drawn against the grid that actually exists.
				...gridOf( scene ),
				// Editor chrome, so it is read here rather than rendered into the block. Putting it
				// on the surface root keeps it out of saved markup entirely.
				showGrid: scene.showGrid !== false,
			};
		},
		[ clientId ]
	);

	/** The box an item should go into: whichever one is selected, or contains the selection. */
	const targetBox = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const id = store.getSelectedBlockClientId();
			if ( ! id ) return null;
			if ( store.getBlockName( id ) === 'blicks/scene-box' ) return id;
			const parent = store.getBlockRootClientId( id );
			return parent && store.getBlockName( parent ) === 'blicks/scene-box' ? parent : null;
		},
		[]
	);

	/**
	 * A new box lands on a free run of the grid rather than on top of the last one, so clicking
	 * "Box" twice gives two boxes instead of a stack of one.
	 */
	const addBox = () => {
		// Boxes may not overlap, so the button places the new one in the first gap that fits
		// rather than wherever the last box happened to end.
		const frame = firstFreeFrame(
			boxes.map( ( b: any ) => frameOf( b.attributes ) ),
			cols,
			rows,
			Math.min( 6, cols ),
			Math.min( 4, rows )
		);
		if ( ! frame ) return;
		insertBlock( createSceneBox( frame ), count, clientId, true );
	};

	/**
	 * Items belong to a box, so adding one needs a box to put it in. With none selected the newest
	 * box is the sensible target — it is the one the author just made.
	 */
	const addItem = ( name: string ) => {
		const box = targetBox ?? boxes[ boxes.length - 1 ]?.clientId;
		if ( ! box ) {
			// Nothing to hold it yet. Make the box first rather than refusing the click.
			const frame = firstFreeFrame(
				boxes.map( ( b: any ) => frameOf( b.attributes ) ),
				cols,
				rows,
				Math.min( 6, cols ),
				Math.min( 4, rows )
			);
			if ( ! frame ) return;
			insertBlock( createSceneBox( frame, [ createCentredItem( name ) ] ), count, clientId, true );
			return;
		}
		insertBlock( createCentredItem( name ), undefined, box, true );
	};

	/**
	 * Zoom about a point, keeping whatever is under it pinned there.
	 *
	 * Scaling alone moves the composition out from under the cursor, which is what makes a canvas
	 * feel like it is fighting you. Solving for the pan that holds the world point still is the
	 * whole difference between "zoom" and "zoom where I am looking".
	 */
	const zoomAt = useCallback( ( factor: number, clientX?: number, clientY?: number ) => {
		const rect = viewport.current?.getBoundingClientRect();
		if ( ! rect ) return;
		const px = ( clientX ?? rect.left + rect.width / 2 ) - rect.left;
		const py = ( clientY ?? rect.top + rect.height / 2 ) - rect.top;

		setZoom( ( current ) => {
			const next = clampZoom( current * factor );
			// Bail before touching pan: at the clamp the ratio is 1 and the arithmetic is a no-op,
			// but setting pan anyway would still cost a render on every wheel tick at the limit.
			if ( next === current ) return current;
			const ratio = next / current;
			setPan( ( p ) => ( {
				x: px - ( px - p.x ) * ratio,
				y: py - ( py - p.y ) * ratio,
			} ) );
			return next;
		} );
	}, [] );

	/**
	 * The part of the viewport nothing is floating over.
	 *
	 * The rails overlay the canvas rather than sitting beside it, so the viewport's own box is no
	 * longer what an author can actually see. Fitting to it put the composition underneath both
	 * panels — technically "fitted", and a third of it unreachable. Measured from the DOM rather
	 * than from the width tokens so a panel that is hidden, resized or absent simply gives its
	 * space back.
	 */
	const clearArea = useCallback( () => {
		const box = viewport.current?.getBoundingClientRect();
		if ( ! box ) return null;
		const root = viewport.current?.closest( '.bl-scene-surface' );
		const left = root?.querySelector( '.bl-scene-layers' )?.getBoundingClientRect();
		const right = root?.querySelector( '.bl-scene-inspector' )?.getBoundingClientRect();
		const x = left ? Math.max( box.left, left.right ) : box.left;
		const r = right ? Math.min( box.right, right.left ) : box.right;
		return { x, y: box.top, width: Math.max( 120, r - x ), height: box.height, box };
	}, [] );

	/** The zoom at which the whole stage is visible, with a margin, in the space that is clear. */
	const fitZoom = useCallback( () => {
		const area = clearArea();
		if ( ! area || ! designWidth || ! designHeight ) return 1;
		return clampZoom(
			Math.min(
				( area.width - FIT_MARGIN ) / designWidth,
				( area.height - FIT_MARGIN ) / designHeight
			)
		);
	}, [ designWidth, designHeight, clearArea ] );

	/** Fit AND centre. With no scroll container, centring is the pan that puts the slack either side. */
	const fitView = useCallback( () => {
		const area = clearArea();
		const next = fitZoom();
		setZoom( next );
		if ( area ) {
			// Centred on the CLEAR area, then expressed relative to the viewport, which is what the
			// world's translate is measured against.
			setPan( {
				x: ( area.x - area.box.left ) + ( area.width - designWidth * next ) / 2,
				y: ( area.height - designHeight * next ) / 2,
			} );
		}
	}, [ fitZoom, clearArea, designWidth, designHeight ] );

	// Open at "fit" — but only once the viewport has a real size.
	//
	// A single `requestAnimationFrame` is not enough: the surface is portalled into another
	// document, so on the frame after mount the viewport can still measure 0 and the fit silently
	// resolves to 100%. Observing it instead waits for whichever frame actually lays out. The
	// observer disconnects after the first fit, deliberately — once an author has chosen a zoom,
	// resizing the window must not throw it away.
	useEffect( () => {
		const node = viewport.current;
		if ( ! node || fitted || ! doc ) return;

		const tryFit = () => {
			const box = node.getBoundingClientRect();
			if ( box.width < 1 || box.height < 1 ) return;
			fitView();
			setFitted( true );
		};

		tryFit();
		const observer = new ResizeObserver( tryFit );
		observer.observe( node );
		return () => observer.disconnect();
	}, [ fitted, fitView, doc ] );

	/**
	 * Wheel: pan by default, zoom with the modifier.
	 *
	 * This is the trackpad contract every canvas tool shares — two fingers move the canvas, pinch
	 * (which the browser reports as ctrl+wheel) scales it. `passive: false` and an unconditional
	 * `preventDefault` are both load-bearing: without them the page behind the surface scrolls and
	 * the browser's own page zoom fires on the pinch.
	 */
	// `doc` is in the deps for the same reason the fit effect observes: the surface is PORTALLED,
	// so on the first commit `viewport.current` is still null and a listener attached then would
	// never exist. `doc` goes null → set once the portal target resolves, which re-runs this after
	// the viewport is really in the tree. Measured: without it neither wheel gesture fired at all.
	useEffect( () => {
		const node = viewport.current;
		if ( ! node ) return;

		const onWheel = ( event: WheelEvent ) => {
			event.preventDefault();

			if ( event.ctrlKey || event.metaKey ) {
				// Clamped BEFORE damping, because the two devices that land here are not on the
				// same scale: a trackpad pinch reports deltas of a few units, a mouse wheel notch
				// reports about 120. Undamped, one notch took 82% straight to the 200% ceiling.
				// The clamp caps a notch at roughly 1.25x while leaving a pinch fine-grained.
				// Negative delta is "spread", which is zoom in.
				const damped = Math.max( -60, Math.min( 60, event.deltaY ) );
				zoomAt( Math.exp( -damped * 0.004 ), event.clientX, event.clientY );
				return;
			}

			setPan( ( p ) => ( { x: p.x - event.deltaX, y: p.y - event.deltaY } ) );
		};

		node.addEventListener( 'wheel', onWheel, { passive: false } );
		return () => node.removeEventListener( 'wheel', onWheel );
	}, [ zoomAt, doc ] );

	/**
	 * Drag to pan, on space-hold or the middle button.
	 *
	 * Left-drag on empty stage is already marquee select, so panning needs its own entry or the two
	 * gestures collide. Space-hold and middle-drag are what authors arrive expecting.
	 */
	useEffect( () => {
		const node = viewport.current;
		if ( ! node ) return;

		const onPointerDown = ( event: PointerEvent ) => {
			if ( ! spaceHeld.current && event.button !== 1 ) return;
			// Claim the gesture before the marquee or a box drag sees it.
			event.preventDefault();
			event.stopPropagation();
			setPanning( true );

			const startX = event.clientX;
			const startY = event.clientY;
			const origin = panRef.current;

			const onMove = ( move: PointerEvent ) => {
				setPan( { x: origin.x + ( move.clientX - startX ), y: origin.y + ( move.clientY - startY ) } );
			};
			const onUp = () => {
				setPanning( false );
				doc?.removeEventListener( 'pointermove', onMove );
				doc?.removeEventListener( 'pointerup', onUp );
			};
			doc?.addEventListener( 'pointermove', onMove );
			doc?.addEventListener( 'pointerup', onUp );
		};

		node.addEventListener( 'pointerdown', onPointerDown, true );
		return () => node.removeEventListener( 'pointerdown', onPointerDown, true );
	}, [ doc ] );

	/**
	 * A resize holds the CENTRE of the view, rather than its top-left corner.
	 *
	 * The zoom an author chose survives a resize deliberately — see the fit effect. Pan has to
	 * survive it too, but keeping the raw offset is not the same as keeping the view: the corner
	 * stays put while everything the author was looking at slides away from the middle. On a
	 * canvas with no scrollbars and no bounds, a big enough resize pushes the composition clean off
	 * screen with nothing to indicate which way it went. Shifting by half the delta keeps whatever
	 * was in the middle in the middle.
	 */
	useEffect( () => {
		const node = viewport.current;
		if ( ! node || ! doc ) return;

		let last = node.getBoundingClientRect();
		const observer = new ResizeObserver( () => {
			const next = node.getBoundingClientRect();
			const dw = next.width - last.width;
			const dh = next.height - last.height;
			last = next;
			if ( ! dw && ! dh ) return;
			setPan( ( p ) => ( { x: p.x + dw / 2, y: p.y + dh / 2 } ) );
		} );
		observer.observe( node );
		return () => observer.disconnect();
	}, [ doc ] );

	useEffect( () => {
		if ( ! doc ) return;

		const editable = ( target: EventTarget | null ) => {
			const el = target as HTMLElement | null;
			return Boolean( el?.isContentEditable || el?.closest?.( 'input, textarea, [contenteditable="true"]' ) );
		};

		// Space is only the pan modifier when it is not a space character someone is typing.
		const onSpaceDown = ( event: KeyboardEvent ) => {
			if ( event.code !== 'Space' || editable( event.target ) ) return;
			event.preventDefault();
			spaceHeld.current = true;
			setPanning( ( on ) => on || false );
			doc.body.classList.add( 'bl-scene-panready' );
		};
		const onSpaceUp = ( event: KeyboardEvent ) => {
			if ( event.code !== 'Space' ) return;
			spaceHeld.current = false;
			doc.body.classList.remove( 'bl-scene-panready' );
		};
		// A window blur mid-hold would otherwise leave the canvas stuck in pan mode.
		const onBlur = () => {
			spaceHeld.current = false;
			doc.body.classList.remove( 'bl-scene-panready' );
		};

		doc.addEventListener( 'keydown', onSpaceDown );
		doc.addEventListener( 'keyup', onSpaceUp );
		doc.defaultView?.addEventListener( 'blur', onBlur );
		return () => {
			doc.removeEventListener( 'keydown', onSpaceDown );
			doc.removeEventListener( 'keyup', onSpaceUp );
			doc.defaultView?.removeEventListener( 'blur', onBlur );
			doc.body.classList.remove( 'bl-scene-panready' );
		};
	}, [ doc ] );

	useEffect( () => {
		if ( ! doc ) return;

		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( event.key === 'Escape' ) {
				// Let a nested popover or a text selection take Escape first.
				if ( ( event.target as HTMLElement )?.closest?.( '.components-popover' ) ) return;
				event.preventDefault();
				// Escape steps back one level, outermost thing first: the shortcut list, then the
				// preview, then the editor. Closing straight to the page would lose an author's
				// place mid-review.
				if ( shortcuts ) setShortcuts( false );
				else if ( previewing ) setPreviewing( false );
				else close();
				return;
			}
			const target = event.target as HTMLElement | null;
			if ( target?.isContentEditable || target?.closest?.( 'input, textarea, [contenteditable="true"]' ) ) return;

			// Both rails at once. Any rail open means "hide"; only when both are already gone does
			// it bring them back, so one key reliably clears the canvas.
			if ( ( event.metaKey || event.ctrlKey ) && event.key === '\\' ) {
				event.preventDefault();
				setRails( ( current ) => {
					const open = current.left || current.right;
					const next = { left: ! open, right: ! open };
					writeRails( next );
					return next;
				} );
				return;
			}

			// `?` is the near-universal "what can I press here". Checked on the character rather
			// than the physical key so it works on layouts that put it somewhere else.
			if ( event.key === '?' ) {
				event.preventDefault();
				setShortcuts( ( open ) => ! open );
				return;
			}

			const store = select( 'core/block-editor' ) as any;
			const dispatchEditor = dispatch( 'core/block-editor' ) as any;
			const selected = store?.getSelectedBlockClientId?.();
			const inThisScene = selected && selected !== clientId
				&& ( store?.getBlockParents?.( selected ) ?? [] ).includes( clientId );

			// Delete removes what is selected. Guarded on the selection being INSIDE this scene so
			// the key never reaches past the surface and deletes something on the page behind it.
			if ( ( event.key === 'Delete' || event.key === 'Backspace' ) && inThisScene ) {
				event.preventDefault();
				// Measured: without this the block is removed TWICE — once here and once by the
				// editor's own delete handling — so deleting one box emptied the whole scene.
				// Capture phase plus `stopPropagation` means this runs first and is the only one.
				event.stopPropagation();
				dispatchEditor.removeBlock( selected );
				return;
			}

			// Duplicate in place. The copy lands on top of the original, which is what makes the
			// next drag feel like pulling a second one off the stack.
			if ( ( event.metaKey || event.ctrlKey ) && event.key.toLowerCase() === 'd' && inThisScene ) {
				event.preventDefault();
				event.stopPropagation();
				dispatchEditor.duplicateBlocks( [ selected ] );
				return;
			}

			// The usual zoom shortcuts.
			if ( ! ( event.metaKey || event.ctrlKey ) ) return;
			if ( event.key === '=' || event.key === '+' ) {
				event.preventDefault();
				zoomAt( 1.2 );
			} else if ( event.key === '-' ) {
				event.preventDefault();
				zoomAt( 1 / 1.2 );
			} else if ( event.key === '0' ) {
				event.preventDefault();
				zoomAt( 1 / zoom );
			}
		};

		// Capture, so the surface's own shortcuts resolve before the editor's global ones see the
		// key at all. Anything this handler does not claim still bubbles on untouched.
		doc.addEventListener( 'keydown', onKeyDown, true );
		return () => doc.removeEventListener( 'keydown', onKeyDown, true );
	}, [ close, doc, clientId, previewing, shortcuts, zoomAt, zoom ] );

	panRef.current = pan;

	const surface = (
		<div
			className={ `bl-scene-surface${ previewing ? ' is-previewing' : '' }${ showGrid ? '' : ' is-gridless' }` }
			style={ {
				// Consumed by anything that has to clear the left rail — the shortcut panel today.
				// Zero when it is away, so those offsets collapse with it instead of leaving a gap
				// against a panel that is no longer there.
				'--bl-scene-rail-l': rails.left ? 'var(--bl-scene-rail)' : '0px',
			} as any }
			role="region"
			aria-label={ __( 'Scene editor', 'blicks' ) }
		>
			<div className="bl-scene-surface__bar">
				<button
					type="button"
					className={ `bl-scene-surface__rail-toggle${ rails.left ? ' is-on' : '' }` }
					onClick={ () => toggleRail( 'left' ) }
					aria-pressed={ rails.left }
					aria-label={ __( 'Layers panel', 'blicks' ) }
					title={ __( 'Layers panel', 'blicks' ) }
				>
					{ icon( <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M9 4v16" /></> ) }
				</button>

				<span className="bl-scene-surface__title">{ __( 'Scene', 'blicks' ) }</span>

				<span className="bl-scene-surface__add">
					<button type="button" onClick={ addBox } title={ __( 'Add a box to the grid', 'blicks' ) }>
						{ icon( <><rect x="3" y="4" width="18" height="16" rx="1" /><rect x="6.5" y="7.5" width="8" height="6" rx="1" /></> ) }
						{ __( 'Box', 'blicks' ) }
					</button>
					<button type="button" onClick={ () => addItem( 'blicks/scene-text' ) }>
						{ icon( <path d="M4 7h16M4 12h11M4 17h7" /> ) }
						{ __( 'Text', 'blicks' ) }
					</button>
					<button type="button" onClick={ () => addItem( 'blicks/scene-image' ) }>
						{ icon( <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.3" /><path d="M5 17l4.5-4.5 3 3 2-2L19 17" /></> ) }
						{ __( 'Image', 'blicks' ) }
					</button>
				</span>

				<SceneSelection clientId={ clientId } />

				<span className="bl-scene-surface__zoom">
					<button
						type="button"
						onClick={ () => zoomAt( 1 / 1.2 ) }
						aria-label={ __( 'Zoom out', 'blicks' ) }
						title={ __( 'Zoom out  ⌘−', 'blicks' ) }
					>
						{ icon( <path d="M5 12h14" /> ) }
					</button>
					<button
						type="button"
						className="bl-scene-surface__zoomvalue"
						onClick={ fitView }
						title={ __( 'Fit the stage to the window', 'blicks' ) }
					>
						{ sprintf( '%d%%', Math.round( zoom * 100 ) ) }
					</button>
					<button
						type="button"
						onClick={ () => zoomAt( 1.2 ) }
						aria-label={ __( 'Zoom in', 'blicks' ) }
						title={ __( 'Zoom in  ⌘+', 'blicks' ) }
					>
						{ icon( <path d="M12 5v14M5 12h14" /> ) }
					</button>
					<button
						type="button"
						onClick={ () => zoomAt( 1 / zoom ) }
						aria-label={ __( 'Actual size', 'blicks' ) }
						title={ __( 'Actual size  ⌘0', 'blicks' ) }
					>
						{ icon( <><rect x="4" y="6" width="16" height="12" rx="1" /><path d="M9 12h6" /></> ) }
					</button>
				</span>

				<button
					type="button"
					className={ `bl-scene-surface__play${ previewing ? ' is-on' : '' }` }
					onClick={ previewing ? () => setPreviewing( false ) : play }
					aria-label={ previewing ? __( 'Stop preview', 'blicks' ) : __( 'Play', 'blicks' ) }
					title={
						previewing
							? __( 'Stop the preview  Esc', 'blicks' )
							: __( 'Play the composition from the start', 'blicks' )
					}
				>
					{ previewing
						? icon( <><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></> )
						: icon( <path d="M7 4.5 19 12 7 19.5z" /> ) }
				</button>

				<button
					type="button"
					className={ `bl-scene-surface__rail-toggle${ rails.right ? ' is-on' : '' }` }
					onClick={ () => toggleRail( 'right' ) }
					aria-pressed={ rails.right }
					aria-label={ __( 'Settings panel', 'blicks' ) }
					title={ __( 'Settings panel', 'blicks' ) }
				>
					{ icon( <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M15 4v16" /></> ) }
				</button>

				<button
					type="button"
					className={ `bl-scene-surface__help${ shortcuts ? ' is-on' : '' }` }
					onClick={ () => setShortcuts( ( open ) => ! open ) }
					aria-label={ __( 'Keyboard shortcuts', 'blicks' ) }
					title={ __( 'Keyboard shortcuts  ?', 'blicks' ) }
				>
					{ icon( <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.4" /><path d="M12 16.8h.01" /></> ) }
				</button>

				<button
					type="button"
					className="bl-scene-surface__done"
					onClick={ close }
					title={ __( 'Close the Scene editor  Esc', 'blicks' ) }
				>
					{ __( 'Done', 'blicks' ) }
				</button>
			</div>

			<div className="bl-scene-surface__body">
				<div
					className={ `bl-scene-surface__viewport${ panning ? ' is-panning' : '' }` }
					ref={ viewport }
					style={ {
						'--bl-scene-pan-x': `${ pan.x }px`,
						'--bl-scene-pan-y': `${ pan.y }px`,
					} as any }
				>
					{ /* The world. Infinite by construction: it has no size and no scroll container,
					     only an offset, so there is nowhere the canvas runs out. Pan lives here and
					     zoom stays on the stage below, because the resize grips counter-scale off
					     `--bl-scene-scale` and would have to unpick a combined matrix otherwise. */ }
					<div
						className="bl-scene-surface__world"
						style={ { transform: `translate(${ pan.x }px, ${ pan.y }px)` } }
					>
						<div
							key={ playToken }
							className={ `${ className } bl-scene-surface__scene` }
							style={ {
								...style,
								// The WRAPPER carries the zoom, and the stylesheet neutralises the
								// stage's own transform inside the surface — otherwise the two
								// compose and the painted size stops matching the pasteboard box.
								// The var still carries the zoom because the resize grips read it
								// to keep themselves a constant size.
								'--bl-scene-scale': String( zoom ),
								transform: `scale(${ zoom })`,
								width: `${ designWidth }px`,
								height: `${ designHeight }px`,
							} as any }
						>
							{ /* The stage's own children, plus a placeholder for every free cell. Split out
						     of `innerBlocksProps` rather than wrapped, because the cells have to be
						     SIBLINGS of the boxes: the stage is the CSS grid, so anything that wants
						     grid placement — box or placeholder — has to be a direct child of it. */ }
						{ ( () => {
							const { children, ...rest } = innerBlocksProps as any;
							return (
								<div { ...rest } { ...sceneMarqueeProps( { clientId, isEdit: true } ) }>
									{ children }
									<SceneCells
										cols={ cols }
										rows={ rows }
										frames={ boxes.map( ( b: any ) => frameOf( b.attributes ) ) }
										onPlace={ ( frame ) => insertBlock( createSceneBox( frame ), count, clientId, true ) }
									/>
								</div>
							);
						} )() }
						</div>
					</div>
					{ count === 0 && <SceneEmpty onAddBox={ addBox } /> }
				</div>

				<div className={ `bl-scene-rail is-left${ rails.left ? '' : ' is-collapsed' }` } aria-hidden={ ! rails.left }>
					<SceneLayers clientId={ clientId } />
				</div>

				{ /* A child of the BODY, offset past the layers rail. Anchored to the surface it
				     covered the whole inspector — the panel an author is most likely to be
				     reaching for while reading a shortcut; anchored to the viewport it scrolled
				     away with the pasteboard. Here it holds still over empty pasteboard and
				     leaves the layers list, the inspector and most of the stage reachable. */ }
				{ shortcuts && <SceneShortcuts onClose={ () => setShortcuts( false ) } /> }

				<div className={ `bl-scene-rail is-right${ rails.right ? '' : ' is-collapsed' }` } aria-hidden={ ! rails.right }>
					<SceneInspector rootClientId={ clientId } />
				</div>
			</div>
		</div>
	);

	return (
		<>
			{ /* Stays in the canvas so the block keeps a position in the document and we have a
			     handle on the right document to portal into. */ }
			<div ref={ anchor } className="bl-scene-surface__anchor" aria-hidden="true" />
			{ doc ? createPortal( surface, doc.body ) : null }
		</>
	);
}
