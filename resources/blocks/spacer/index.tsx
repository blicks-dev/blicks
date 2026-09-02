import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { SpacerControls, cleanSpacerOrientation, cleanSpacerSize } from './controls';

defineBlock( metadata, {
	Controls: SpacerControls,
	render( { attributes, blockProps, isEdit } ) {
		const orientation = cleanSpacerOrientation( attributes.orientation );
		const style = {
			...( blockProps.style ?? {} ),
			'--bl-spacer-size': cleanSpacerSize( attributes.size ),
		};
		const className = `${ blockProps.className } bl-spacer--${ orientation }`;

		return (
			<div { ...blockProps } className={ className } style={ style } aria-hidden="true">
				{ isEdit ? cleanSpacerSize( attributes.size ) : null }
			</div>
		);
	},
} );
