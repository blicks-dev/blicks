import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { SceneHandles, sceneDragProps } from '@/blocks/scene-shared/scene-item';
import { SceneTextControls, cleanSceneTextTag } from './controls';

defineBlock( metadata, {
	Controls: SceneTextControls,
	render( { attributes, setAttributes, blockProps, richText, isEdit } ) {
		const className = [ blockProps.className, 'bl-scene-item' ].filter( Boolean ).join( ' ' );

		// The item box, not the text element, carries the placement. That keeps every scene child
		// the same shape — one positioned box with content inside — so the resize handles, the
		// anchor offset and the rotation all attach in one place no matter what the child holds.
		return (
			<div
				{ ...blockProps }
				className={ className }
				// Editor only — returns nothing on the save path, so no handler reaches saved
				// markup. A press that never travels far enough still falls through to the caret.
				{ ...sceneDragProps( { attributes, setAttributes, isEdit } ) }
			>
				{ richText( {
					attr: 'content',
					tagName: cleanSceneTextTag( attributes.tag ),
					className: 'bl-scene-text__body',
					placeholder: __( 'Add text…', 'blicks' ),
					allowedFormats: [ 'core/bold', 'core/italic', 'core/link', 'blicks/text-style', 'core/strikethrough', 'core/subscript', 'core/superscript' ],
				} ) }
				<SceneHandles attributes={ attributes } setAttributes={ setAttributes } isEdit={ isEdit } />
			</div>
		);
	},
} );
