import { useSelect, useDispatch } from '@wordpress/data';
import { InspectorContent } from '@/framework/inspector/Inspector';
import { SceneControls, gridOf } from '@/blocks/scene/controls';
import { SceneTextControls } from '@/blocks/scene-text/controls';
import { SceneImageControls } from '@/blocks/scene-image/controls';
import { SceneBoxControls, SceneBoxEnter } from '@/blocks/scene-box/controls';

function BoxControls( props: any ) {
	const cols = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const parentId = props.clientId ? store?.getBlockRootClientId?.( props.clientId ) : null;
			const parent = parentId ? store?.getBlockAttributes?.( parentId ) : null;
			return gridOf( parent ).cols;
		},
		[ props.clientId ]
	);

	const rows = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const parentId = props.clientId ? store?.getBlockRootClientId?.( props.clientId ) : null;
			const parent = parentId ? store?.getBlockAttributes?.( parentId ) : null;
			return gridOf( parent ).rows;
		},
		[ props.clientId ]
	);

	return (
		<>
			<SceneBoxControls { ...props } cols={ cols } rows={ rows } />
			<SceneBoxEnter { ...props } />
		</>
	);
}

const BLOCK_CONTROLS: Record< string, React.ComponentType< any > > = {
	'blicks/scene': SceneControls,
	'blicks/scene-box': BoxControls,
	'blicks/scene-text': SceneTextControls,
	'blicks/scene-image': SceneImageControls,
};

interface Props {
	rootClientId: string;
}

/**
 * Inspector panel hosted inside the full-screen Scene editor.
 *
 * Inspects whichever block inside the Scene is currently selected (or the Scene stage itself if
 * nothing is selected), providing direct access to settings, positioning, typography, fill,
 * border, visual effects, and animations within the modal.
 */
export function SceneInspector( { rootClientId }: Props ) {
	const { selectedBlock, blockType } = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const id = store.getSelectedBlockClientId() || rootClientId;

			// Verify if the selected block is the root Scene or one of its descendants
			let cur: string | null = id;
			let belongs = id === rootClientId;
			while ( cur && ! belongs ) {
				cur = store.getBlockRootClientId( cur );
				if ( cur === rootClientId ) belongs = true;
			}

			const activeId = belongs ? id : rootClientId;
			const block = store.getBlock( activeId );
			const type = block ? select( 'core/blocks' ).getBlockType( block.name ) : null;

			return {
				selectedBlock: block,
				blockType: type,
			};
		},
		[ rootClientId ]
	);

	const { updateBlockAttributes } = useDispatch( 'core/block-editor' ) as any;

	if ( ! selectedBlock ) return null;

	const setAttributes = ( attrs: any ) =>
		updateBlockAttributes( selectedBlock.clientId, attrs );

	const Controls = BLOCK_CONTROLS[ selectedBlock.name ];

	return (
		<div className="bl-scene-inspector">
			<InspectorContent
				key={ selectedBlock.clientId }
				attributes={ selectedBlock.attributes }
				setAttributes={ setAttributes }
				clientId={ selectedBlock.clientId }
				manifest={ blockType?.supports?.blicks }
				Controls={ Controls }
			/>
		</div>
	);
}
