import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { GridControls, gridColumnsValue, gridGapValue, gridMinWidth } from './controls';

defineBlock( metadata, {
	innerBlocks: {
		templateLock: false,
	},
	// A Grid is a free-form container that's valid empty (children flow into the columns you set), so
	// no starting-layout placeholder — just the ghost "add" slot in place of WP's corner appender.
	appender: 'ghost',
	Controls: GridControls,
	render( { attributes, blockProps, children } ) {
		const Tag = ( attributes.tag || 'div' ) as keyof JSX.IntrinsicElements;
		// Attr-derived vars are DEFAULTS; blockProps.style spreads last so the inline vars
		// written by Styles ▸ Layout (the blicks value tree) win over the Settings attrs.
		const style = {
			'--bl-cols': gridColumnsValue( attributes.columns, attributes.autoFit ),
			'--bl-grid-min': gridMinWidth( attributes ),
			'--bl-gap-r': gridGapValue( attributes.gap ),
			'--bl-gap-c': gridGapValue( attributes.gap ),
			...( blockProps.style ?? {} ),
		};
		const className = [
			blockProps.className,
			attributes.dense ? 'bl-grid--dense' : '',
		].filter( Boolean ).join( ' ' );

		return (
			<Tag { ...blockProps } className={ className } style={ style }>
				{ children }
			</Tag>
		);
	},
} );
