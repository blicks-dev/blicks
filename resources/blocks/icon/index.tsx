import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { IconControls, cleanIconSize, cleanStrokeWidth } from './controls';
import { renderIcon } from '@/framework/icons/render';

defineBlock( metadata, {
	Controls: IconControls,
	render( { attributes, blockProps } ) {
		const label = String( attributes.label || '' ).trim();
		const style = {
			...( blockProps.style ?? {} ),
			'--bl-icon-size': cleanIconSize( attributes.size ),
		};

		return (
			<span { ...blockProps } style={ style } aria-label={ label || undefined } aria-hidden={ label ? undefined : true }>
				{ renderIcon( attributes.icon, { strokeWidth: cleanStrokeWidth( attributes.strokeWidth ) } ) }
			</span>
		);
	},
} );
