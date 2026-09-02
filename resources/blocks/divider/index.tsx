import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import {
	DividerControls,
	cleanDividerAlign,
	cleanDividerColor,
	cleanDividerLength,
	cleanDividerOrientation,
	cleanDividerStyle,
	cleanDividerThickness,
} from './controls';

defineBlock( metadata, {
	Controls: DividerControls,
	render( { attributes, blockProps } ) {
		const orientation = cleanDividerOrientation( attributes.orientation );
		const length = cleanDividerLength( attributes.length );
		const align = cleanDividerAlign( attributes.align );
		const style = {
			...( blockProps.style ?? {} ),
			'--bl-divider-thickness': cleanDividerThickness( attributes.thickness ),
			'--bl-divider-style': cleanDividerStyle( attributes.lineStyle ),
			'--bl-divider-color': cleanDividerColor( attributes.color ),
			...( length ? { '--bl-divider-length': length } : {} ),
		};
		const className = [
			blockProps.className,
			`bl-divider--${ orientation }`,
			orientation === 'horizontal' && length ? `bl-divider--align-${ align }` : '',
		].filter( Boolean ).join( ' ' );

		return <hr { ...blockProps } className={ className } style={ style } />;
	},
} );
