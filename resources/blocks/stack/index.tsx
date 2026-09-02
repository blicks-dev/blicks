import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import {
	StackControls,
	setStackOrientation,
	stackAlignValue,
	stackDirection,
	stackGapValue,
	stackJustifyValue,
} from './controls';

function StackToolbar( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const isHorizontal = attributes.orientation === 'horizontal';
	return (
		<>
			<ToolbarButton
				icon="editor-ul"
				label={ __( 'Stack vertically', 'blicks' ) }
				isPressed={ ! isHorizontal }
				onClick={ () => setStackOrientation( attributes, setAttributes, 'vertical' ) }
			/>
			<ToolbarButton
				icon="columns"
				label={ __( 'Stack horizontally', 'blicks' ) }
				isPressed={ isHorizontal }
				onClick={ () => setStackOrientation( attributes, setAttributes, 'horizontal' ) }
			/>
		</>
	);
}

defineBlock( metadata, {
	innerBlocks: {
		templateLock: false,
		orientation: ( attributes ) =>
			attributes.orientation === 'horizontal' ? 'horizontal' : 'vertical',
	},
	// A Stack is a free-form one-axis wrapper that's valid empty, so no starting-layout placeholder —
	// just the ghost "add" slot in place of WP's corner appender.
	appender: 'ghost',
	Controls: StackControls,
	Toolbar: StackToolbar,
	render( { attributes, blockProps, children } ) {
		const Tag = ( attributes.tag || 'div' ) as keyof JSX.IntrinsicElements;
		// Attr-derived vars are DEFAULTS; blockProps.style spreads last so the inline vars
		// written by Styles ▸ Layout (the blicks value tree) win over the Settings attrs.
		const style = {
			'--bl-fd': stackDirection( attributes.orientation ),
			'--bl-gap-r': stackGapValue( attributes.gap ),
			'--bl-gap-c': stackGapValue( attributes.gap ),
			'--bl-ai': stackAlignValue( attributes.align ),
			'--bl-jc': stackJustifyValue( attributes.justify ),
			'--bl-fw': attributes.wrap ? 'wrap' : 'nowrap',
			...( blockProps.style ?? {} ),
		};

		return <Tag { ...blockProps } style={ style }>{ children }</Tag>;
	},
} );
