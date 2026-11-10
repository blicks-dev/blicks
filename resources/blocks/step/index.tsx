import { RichText } from '@wordpress/block-editor';
import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { getIcon } from '@/framework/icons';
import { iconMaskUrl } from '@/blocks/list/model';
import { cleanStepState, stepClasses } from '@/blocks/steps/model';
import { StepSettings } from './controls';
import { useStepPlace } from './place';

function StepToolbar( { attributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId?: string } ) {
	const { makeCurrent } = useStepPlace( clientId );
	if ( cleanStepState( attributes.state ) === 'cur' ) return null;
	return <ToolbarButton label={ __( 'Make current', 'blicks' ) } onClick={ makeCurrent }>{ __( 'Make current', 'blicks' ) }</ToolbarButton>;
}

defineBlock( metadata, {
	innerBlocks: {
		// A heading and a line of text to start; anything else may follow them.
		template: [ [ 'blicks/heading', { level: 3, placeholder: __( 'Step title', 'blicks' ) } ], [ 'blicks/text', { placeholder: __( 'What happens in this step', 'blicks' ) } ] ],
		templateLock: false,
		wrapperClassName: 'bl-step__body',
	},
	panels: {
		Settings: StepSettings,
		describe: ( attributes ) => ( { done: __( 'Done', 'blicks' ), cur: __( 'Current', 'blicks' ), next: __( 'Upcoming', 'blicks' ), '': '' } )[ cleanStepState( attributes.state ) ],
	},
	Toolbar: StepToolbar,
	render( { attributes, blockProps, innerBlocksProps, isEdit, setAttributes, context } ) {
		const state = cleanStepState( attributes.state );
		const style: Record< string, string > = { ...( blockProps.style ?? {} ) };
		if ( isEdit && attributes.icon ) {
			const svg = getIcon( attributes.icon )?.svg;
			if ( svg ) style[ '--bl-li-icon' ] = iconMaskUrl( svg );
		}
		const labels = isEdit && context?.[ 'blicks/stepsLabels' ] && context?.[ 'blicks/stepsLayout' ] === 'down';
		const label = String( attributes.label ?? '' );
		return (
			<li
				{ ...blockProps }
				className={ [ blockProps.className, ...stepClasses( attributes ) ].filter( Boolean ).join( ' ' ) }
				style={ Object.keys( style ).length ? style : undefined }
				aria-current={ state === 'cur' ? 'step' : undefined }
			>
				<span className="bl-step__marker" aria-hidden="true" />
				{ labels ? (
					<RichText tagName="span" className="bl-step__label" value={ label } onChange={ ( v: string ) => setAttributes( { label: v } ) } placeholder={ __( 'Label', 'blicks' ) } allowedFormats={ [] } disableLineBreaks />
				) : label && <RichText.Content tagName="span" className="bl-step__label" value={ label } /> }
				{ attributes.status && <span className="bl-step__status">{ attributes.status }</span> }
				<div { ...innerBlocksProps } />
			</li>
		);
	},
} );
