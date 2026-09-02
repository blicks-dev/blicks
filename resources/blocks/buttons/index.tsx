import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import {
	ButtonsControls,
	buttonsDirection,
	buttonsGapValue,
	buttonsJustifyValue,
	setButtonsOrientation,
} from './controls';

function ButtonsToolbar( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const isVertical = attributes.orientation === 'vertical';
	return (
		<>
			<ToolbarButton
				icon="columns"
				label={ __( 'Arrange horizontally', 'blicks' ) }
				isPressed={ ! isVertical }
				onClick={ () => setButtonsOrientation( attributes, setAttributes, 'horizontal' ) }
			/>
			<ToolbarButton
				icon="editor-ul"
				label={ __( 'Arrange vertically', 'blicks' ) }
				isPressed={ isVertical }
				onClick={ () => setButtonsOrientation( attributes, setAttributes, 'vertical' ) }
			/>
		</>
	);
}

defineBlock( metadata, {
	innerBlocks: {
		allowedBlocks: [ 'blicks/button' ],
		// Seed one Button so a fresh Buttons block is never an empty shell (no placeholder here).
		template: [ [ 'blicks/button' ] ],
		// Select the seeded Button on insert, so the caret lands in its empty "Add text…" label.
		templateInsertUpdatesSelection: true,
		templateLock: false,
		orientation: ( attributes ) =>
			attributes.orientation === 'vertical' ? 'vertical' : 'horizontal',
	},
	Controls: ButtonsControls,
	Toolbar: ButtonsToolbar,
	render( { attributes, blockProps, children } ) {
		// Attr-derived vars are DEFAULTS; blockProps.style spreads last so the inline vars
		// written by Styles ▸ Layout (the blicks value tree) win over the Settings attrs.
		const style = {
			'--bl-fd': buttonsDirection( attributes.orientation ),
			'--bl-gap-r': buttonsGapValue( attributes.gap ),
			'--bl-gap-c': buttonsGapValue( attributes.gap ),
			'--bl-jc': buttonsJustifyValue( attributes.justify ),
			'--bl-fw': attributes.wrap ? 'wrap' : 'nowrap',
			...( blockProps.style ?? {} ),
		};

		return <div { ...blockProps } style={ style }>{ children }</div>;
	},
} );
