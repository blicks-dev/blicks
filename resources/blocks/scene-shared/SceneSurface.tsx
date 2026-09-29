import { __, sprintf } from '@wordpress/i18n';
import { dispatch, select, useDispatch, useSelect } from '@wordpress/data';
import { createPortal, useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { createSceneBox } from '@/blocks/scene-box';
import { firstFreeFrame, frameOf } from '@/blocks/scene-box/occupancy';
import { sceneMarqueeProps } from './scene-marquee';
import { createCentredItem } from './new-item';
import { setSceneEditorOpen } from './editor-state';
import { SceneLayers } from './SceneLayers';
import { SceneSelection } from './SceneSelection';
import { SceneInspector } from './SceneInspector';
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
	const [ fitted, setFitted ] = useState( false );
	// Resolved in an effect, NOT during render: the anchor ref is null on the first pass, so
	// reading it inline yields no portal target and the surface never mounts at all. Holding it in
	// state guarantees exactly one re-render once the ref exists.
	const [ doc, setDoc ] = useState< Document | null >( null );

	useEffect( () => {
		setDoc( surfaceDocument( anchor.current ) );
	}, [] );

	const close = useCallback( () => setSceneEditorOpen( clientId, false ), [ clientId ] );

	const { insertBlock } = useDispatch( 'core/block-editor' ) as any;
	const { count, boxes, cols, rows } = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const scene = store.getBlockAttributes( clientId ) ?? {};
			return {
				count: store.getBlockCount( clientId ),
				boxes: store.getBlocks( clientId ) ?? [],
				cols: Number( scene.cols ) || 16,
				rows: Number( scene.rows ) || 16,
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

	/** The zoom at which the whole stage is visible with a margin around it. */
	const fitZoom = useCallback( () => {
		const box = viewport.current?.getBoundingClientRect();
		if ( ! box || ! designWidth || ! designHeight ) return 1;
		return clampZoom(
			Math.min( ( box.width - FIT_MARGIN ) / designWidth, ( box.height - FIT_MARGIN ) / designHeight )
		);
	}, [ designWidth, designHeight ] );

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
			setZoom( fitZoom() );
			setFitted( true );
		};

		tryFit();
		const observer = new ResizeObserver( tryFit );
		observer.observe( node );
		return () => observer.disconnect();
	}, [ fitted, fitZoom, doc ] );

	useEffect( () => {
		if ( ! doc ) return;

		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( event.key === 'Escape' ) {
				// Let a nested popover or a text selection take Escape first.
				if ( ( event.target as HTMLElement )?.closest?.( '.components-popover' ) ) return;
				event.preventDefault();
				close();
				return;
			}
			const target = event.target as HTMLElement | null;
			if ( target?.isContentEditable || target?.closest?.( 'input, textarea, [contenteditable="true"]' ) ) return;

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
				setZoom( ( z ) => clampZoom( z * 1.2 ) );
			} else if ( event.key === '-' ) {
				event.preventDefault();
				setZoom( ( z ) => clampZoom( z / 1.2 ) );
			} else if ( event.key === '0' ) {
				event.preventDefault();
				setZoom( 1 );
			}
		};

		// Capture, so the surface's own shortcuts resolve before the editor's global ones see the
		// key at all. Anything this handler does not claim still bubbles on untouched.
		doc.addEventListener( 'keydown', onKeyDown, true );
		return () => doc.removeEventListener( 'keydown', onKeyDown, true );
	}, [ close, doc, clientId ] );

	const surface = (
		<div className="bl-scene-surface" role="region" aria-label={ __( 'Scene editor', 'blicks' ) }>
			<div className="bl-scene-surface__bar">
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
						onClick={ () => setZoom( ( z ) => clampZoom( z / 1.2 ) ) }
						aria-label={ __( 'Zoom out', 'blicks' ) }
						title={ __( 'Zoom out  ⌘−', 'blicks' ) }
					>
						{ icon( <path d="M5 12h14" /> ) }
					</button>
					<button
						type="button"
						className="bl-scene-surface__zoomvalue"
						onClick={ () => setZoom( fitZoom() ) }
						title={ __( 'Fit the stage to the window', 'blicks' ) }
					>
						{ sprintf( '%d%%', Math.round( zoom * 100 ) ) }
					</button>
					<button
						type="button"
						onClick={ () => setZoom( ( z ) => clampZoom( z * 1.2 ) ) }
						aria-label={ __( 'Zoom in', 'blicks' ) }
						title={ __( 'Zoom in  ⌘+', 'blicks' ) }
					>
						{ icon( <path d="M12 5v14M5 12h14" /> ) }
					</button>
					<button
						type="button"
						onClick={ () => setZoom( 1 ) }
						aria-label={ __( 'Actual size', 'blicks' ) }
						title={ __( 'Actual size  ⌘0', 'blicks' ) }
					>
						{ icon( <><rect x="4" y="6" width="16" height="12" rx="1" /><path d="M9 12h6" /></> ) }
					</button>
				</span>

				<button type="button" className="bl-scene-surface__done" onClick={ close }>
					{ __( 'Done', 'blicks' ) }
				</button>
			</div>

			<div className="bl-scene-surface__body">
				<SceneLayers clientId={ clientId } />

				<div className="bl-scene-surface__viewport" ref={ viewport }>
					{ /* The pasteboard scrolls; the stage sits in the middle of it at the chosen zoom. */ }
					<div
						className="bl-scene-surface__pasteboard"
						style={ {
							width: `${ designWidth * zoom }px`,
							height: `${ designHeight * zoom }px`,
						} }
					>
						<div
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
							<div { ...innerBlocksProps } { ...sceneMarqueeProps( { clientId, isEdit: true } ) } />
						</div>
					</div>
				</div>

				<SceneInspector rootClientId={ clientId } />
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
