import { registerFormatType, applyFormat, removeFormat } from '@wordpress/rich-text';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { ColorControl } from '@/controls/color/ColorControl';
import { buildStyle, styleToTrees, EMPTY_TREES, type Target, type Trees } from './text-style-css';
import './text-style.scss';

const FORMAT = 'blicks/text-style';

/**
 * Inline text-style format for RichText (Heading / Text / Accordion). Reuses the full Blicks
 * background control (color / gradient / image) inside a selection-aware inspector panel, then
 * paints it onto the selected words — clipped to the glyphs (Text fill), behind them (Highlight),
 * or both at once. The CSS itself is built/parsed in `text-style-css.ts`.
 */
function Edit( { value, onChange, isActive, activeAttributes }: any ) {
	const hasSelection = value?.start != null && value?.end != null && value.start !== value.end;
	const editable = hasSelection || isActive;

	// The format is registered globally, so its edit also mounts on native (core/*) blocks whose
	// RichText doesn't restrict formats. Scope the panel to Blicks blocks only — we don't want it
	// cluttering the inspector of core blocks.
	const isBlicksBlock = useSelect( ( select: any ) => {
		const be = select( 'core/block-editor' );
		const id = be.getSelectedBlockClientId?.();
		return id ? String( be.getBlockName?.( id ) || '' ).startsWith( 'blicks/' ) : false;
	}, [] );

	const [ trees, setTrees ] = useState< Trees >( EMPTY_TREES );

	// Reflect the active span back into the synthetic trees when the selection changes.
	const styleAttr = String( activeAttributes?.style || '' );
	useEffect( () => {
		setTrees( styleToTrees( styleAttr ) );
		// Re-sync only when the selection itself moves — not on every value edit (would fight the picker).
	}, [ value?.start, value?.end ] );

	const apply = ( nextTrees: Trees ) => {
		const style = buildStyle( nextTrees );
		onChange(
			style
				? applyFormat( value, { type: FORMAT, attributes: { style } } )
				: removeFormat( value, FORMAT )
		);
	};

	// Synthetic attributes/setAttributes so each ColorControl drives one of our local trees
	// instead of a block's attributes.
	const setSynthetic = ( target: Target ) => ( patch: any ) => {
		const nextTrees = { ...trees, [ target ]: patch.blicks ?? trees[ target ] };
		setTrees( nextTrees );
		apply( nextTrees );
	};

	const clearAll = () => {
		setTrees( EMPTY_TREES );
		onChange( removeFormat( value, FORMAT ) );
	};

	if ( ! isBlicksBlock ) return null;

	return (
		<InspectorControls>
			<PanelBody title={ __( 'Selection style', 'blicks' ) } initialOpen={ editable } className="bl-ins">
				{ ! editable ? (
					<p className="bl-ts__hint">
						{ __( 'Select words in the text to fill them with a color, gradient, or image — and to highlight them.', 'blicks' ) }
					</p>
				) : (
					// Each picker is keyed on the selection so it remounts when the caret moves — its
					// color/gradient/image mode tab is derived on mount from the tree it is given.
					<div className="bl-ts">
						<ColorControl
							key={ `text-${ value?.start }-${ value?.end }` }
							attributes={ { blicks: trees.text } }
							setAttributes={ setSynthetic( 'text' ) }
							state="default"
							breakpoint="base"
							variant="textFill"
							label={ __( 'Text fill', 'blicks' ) }
						/>
						<ColorControl
							key={ `highlight-${ value?.start }-${ value?.end }` }
							attributes={ { blicks: trees.highlight } }
							setAttributes={ setSynthetic( 'highlight' ) }
							state="default"
							breakpoint="base"
							variant="textFill"
							label={ __( 'Highlight', 'blicks' ) }
						/>
						<button type="button" className="bl-ts__clear" onClick={ clearAll }>
							{ __( 'Clear selection style', 'blicks' ) }
						</button>
					</div>
				) }
			</PanelBody>
		</InspectorControls>
	);
}

registerFormatType( FORMAT, {
	title: __( 'Color & gradient', 'blicks' ),
	tagName: 'span',
	className: 'bl-text-style',
	attributes: { style: 'style' },
	edit: Edit,
} );
