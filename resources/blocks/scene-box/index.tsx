import { createBlock } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { SceneBoxControls, SceneBoxEnter, cleanCell, cleanSpan } from './controls';
import { SceneBoxHandles, sceneBoxDragProps } from './gestures';
import { SceneBoxInserter } from './Inserter';
import { SceneItemFrame } from './ItemFrame';

/**
 * Grid placement, as CSS custom properties.
 *
 * Only the box's OWN four numbers are emitted. The grid size is not among them: the Scene sets
 * `--bl-scene-cols` / `--bl-scene-rows` on the stage and custom properties inherit, so the box
 * divides by whatever its parent declares without ever being told.
 *
 * That matters beyond tidiness. Block context is editor-only — undefined during `save()` — so a
 * box that computed its percentage from context would bake the wrong fraction into saved markup
 * for any scene whose grid is not the default. Inheritance has no such split.
 */
function boxVars( attributes: any ): Record< string, string > {
	return {
		'--bl-box-col': String( cleanCell( attributes.col, 0 ) ),
		'--bl-box-row': String( cleanCell( attributes.row, 0 ) ),
		'--bl-box-cw': String( cleanSpan( attributes.colSpan, 4 ) ),
		'--bl-box-rh': String( cleanSpan( attributes.rowSpan, 4 ) ),
	};
}

/** The parent Scene's grid — editor only, and only for clamping the number fields. */
function useSceneGrid( clientId?: string ): { cols: number; rows: number } {
	return useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const parentId = clientId ? store?.getBlockRootClientId?.( clientId ) : null;
			const parent = parentId ? store?.getBlockAttributes?.( parentId ) : null;
			return {
				cols: Number( parent?.cols ) || 16,
				rows: Number( parent?.rows ) || 16,
			};
		},
		[ clientId ]
	);
}

function BoxControls( props: any ) {
	const { cols, rows } = useSceneGrid( props.clientId );
	return (
		<>
			<SceneBoxControls { ...props } cols={ cols } rows={ rows } />
			<SceneBoxEnter { ...props } />
		</>
	);
}

defineBlock( metadata, {
	innerBlocks: {
		allowedBlocks: [ 'blicks/scene-text', 'blicks/scene-image' ],
		templateLock: false,
		// Items live in their own layer so the box can clip THEM without clipping its editor
		// chrome. The resize grips sit on the box's edges and the "Add element" bar above it —
		// `overflow: hidden` on the box itself would cut both off.
		wrapperClassName: 'bl-scene-box__content',
	},
	appender: 'ghost',
	Controls: BoxControls,
	render( { attributes, setAttributes, blockProps, innerBlocksProps, isEdit, clientId } ) {
		// No className concat: the factory already emits `bl-{slug}`, which for this block IS
		// `bl-scene-box`. Appending it again only duplicated the class in saved markup.
		return (
			<div
				{ ...blockProps }
				style={ { ...blockProps.style, ...boxVars( attributes ) } }
				// Editor only — returns nothing on the save path, so no handler reaches saved markup.
				{ ...sceneBoxDragProps( { attributes, setAttributes, isEdit, clientId } ) }
			>
				<div { ...innerBlocksProps } />
				{ /* Guarded by `isEdit` so these elements never exist in the SAVE tree at all.
				     `render` is shared between edit and save, and WordPress walks the saved tree
				     outside a React render — anything with a hook in it throws "Invalid hook call"
				     there, which is exactly what the inserter's `useSelect` did. Returning null
				     from inside the component is not enough; the element must not be created. */ }
				{ isEdit && (
					<>
						<SceneItemFrame clientId={ clientId } isEdit={ isEdit } />
						<SceneBoxInserter clientId={ clientId } isEdit={ isEdit } row={ cleanCell( attributes.row, 0 ) } />
						<SceneBoxHandles attributes={ attributes } setAttributes={ setAttributes } isEdit={ isEdit } clientId={ clientId } />
					</>
				) }
			</div>
		);
	},
} );

/** A box seeded at a given cell — used by the Scene's presets and by the surface inserter. */
export function createSceneBox(
	placement: { col: number; row: number; colSpan: number; rowSpan: number },
	inner: any[] = []
) {
	return createBlock( 'blicks/scene-box', placement, inner );
}
