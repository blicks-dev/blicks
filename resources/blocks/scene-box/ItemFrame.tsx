import { useDispatch, useSelect } from '@wordpress/data';
import { useLayoutEffect, useRef, useState } from '@wordpress/element';
import { SceneHandles, sceneDragProps } from '@/blocks/scene-shared/scene-item';
import './item-frame.scss';

interface Props {
	/** The box that owns the frame. */
	clientId?: string;
	isEdit: boolean;
}

interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * The selection frame for the item currently selected inside this box.
 *
 * It exists because the box CLIPS its contents. An item dragged past the box edge disappears, and
 * with it every handle — measured: 8 grips rendered, 0 of them inside the clip, and hit-testing at
 * the item's centre returned the stage. The item became unreachable, with no way to bring it back.
 *
 * So the frame is rendered as a sibling of the clipping layer rather than inside it, and mirrors
 * the item's geometry. The item's own pixels stay clipped — which is the point of a box — while
 * its outline and grips remain visible and grabbable wherever it has been dragged.
 */
export function SceneItemFrame( { clientId, isEdit }: Props ) {
	const { itemId, itemAttributes } = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const selected = store.getSelectedBlockClientId();
			if ( ! selected || ! clientId ) return { itemId: null, itemAttributes: null };
			// Only when the selection is an item OF THIS BOX — every box renders a frame, and
			// without this check they would all draw one for the same item.
			const parent = store.getBlockRootClientId( selected );
			if ( parent !== clientId ) return { itemId: null, itemAttributes: null };
			return { itemId: selected, itemAttributes: store.getBlockAttributes( selected ) };
		},
		[ clientId ]
	);

	const { updateBlockAttributes } = useDispatch( 'core/block-editor' ) as any;
	const host = useRef< HTMLDivElement | null >( null );
	const [ rect, setRect ] = useState< Rect | null >( null );

	/**
	 * Measured rather than computed from the attributes, because an item's size is often implicit
	 * — text sizes to its own content, an image to its natural dimensions — so there is nothing to
	 * compute from. Re-runs whenever the item's placement changes, which includes every frame of a
	 * drag, so the frame tracks the item rather than lagging it.
	 */
	useLayoutEffect( () => {
		const anchor = host.current;
		if ( ! anchor || ! itemId ) {
			setRect( null );
			return;
		}
		const content = anchor.parentElement?.querySelector< HTMLElement >( ':scope > .bl-scene-box__content' );
		const item = content?.querySelector< HTMLElement >( `[data-block="${ itemId }"]` );
		if ( ! content || ! item ) {
			setRect( null );
			return;
		}
		const cr = content.getBoundingClientRect();
		const ir = item.getBoundingClientRect();
		// The stage is scaled, so painted pixels must come back to layout pixels before they can
		// be used as `left`/`top` on an element inside that same scaled stage.
		const scale = cr.width / content.offsetWidth || 1;
		setRect( {
			left: ( ir.left - cr.left ) / scale,
			top: ( ir.top - cr.top ) / scale,
			width: ir.width / scale,
			height: ir.height / scale,
		} );
	}, [ itemId, itemAttributes ] );

	if ( ! isEdit || ! itemId ) return <div ref={ host } className="bl-scene-item-frame__host" />;

	/** Resolve the gesture's real target: the item, which lives in the clipped layer. */
	const itemFor = ( event: React.PointerEvent< HTMLElement > ): HTMLElement | null => {
		const box = event.currentTarget.closest( '.bl-scene-box' );
		return box?.querySelector< HTMLElement >( `[data-block="${ itemId }"]` ) ?? null;
	};

	// The frame drives the same gesture code the item does; it just reports a different element
	// and writes through the store instead of a block's own `setAttributes`.
	const gestureProps = {
		attributes: itemAttributes ?? {},
		setAttributes: ( next: any ) => updateBlockAttributes( itemId, next ),
		isEdit: true,
		itemFor,
	};

	const drag = sceneDragProps( gestureProps ) as {
		onPointerDown?: ( event: React.PointerEvent< HTMLElement > ) => void;
	};

	return (
		<div ref={ host } className="bl-scene-item-frame__host">
			{ rect && (
				<div
					className="bl-scene-item-frame"
					style={ {
						left: `${ rect.left }px`,
						top: `${ rect.top }px`,
						width: `${ rect.width }px`,
						height: `${ rect.height }px`,
					} }
					{ ...drag }
					onPointerDown={ ( event ) => {
						event.stopPropagation();
						drag.onPointerDown?.( event );
					} }
					onMouseDown={ ( event ) => {
						// The one that actually matters. WordPress selects a block on MOUSEDOWN,
						// not pointerdown — measured: the selection jumped from the item to the
						// box the instant the button went down, unmounting this frame mid-drag.
						// `preventDefault` additionally stops the focus change that would do the
						// same thing by another route.
						event.stopPropagation();
						event.preventDefault();
					} }
				>
					<SceneHandles { ...gestureProps } />
				</div>
			) }
		</div>
	);
}
