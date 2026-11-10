import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import { TEXT_ALIGNS, alignIcon } from '@/blocks/shared/toolbar-align';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { getValue, setValue } from '@/framework/values';
import { blicksBlockCompleter } from '@/blocks/shared/blicks-block-completer';
import { BoundValue, bindingOf } from '@/blocks/loop/binding';
import { KINDS, TextMotion, TextSettings, TextStyle, cleanTextTag, cleanTextVariant, textKind, withTextKind } from './controls';

function TextToolbar( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const alignment = getValue( attributes, 'typography.textAlign', 'default', 'base' ) || 'left';
	return (
		<>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'Kind', 'blicks' ) } value={ textKind( attributes ) } options={ KINDS } onChange={ ( k ) => setAttributes( withTextKind( attributes, k ) ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice
					label={ __( 'Line up', 'blicks' ) }
					iconOnly
					icon={ alignIcon( alignment ) }
					value={ alignment }
					options={ TEXT_ALIGNS }
					onChange={ ( a ) => setValue( attributes, setAttributes, 'typography.textAlign', 'default', 'base', a === 'left' ? undefined : a ) }
				/>
				<ToolbarButton label={ __( 'Drop cap', 'blicks' ) } isPressed={ !! attributes.dropCap } onClick={ () => setAttributes( { dropCap: ! attributes.dropCap } ) }>
					{ __( 'Drop cap', 'blicks' ) }
				</ToolbarButton>
			</ToolbarGroup>
		</>
	);
}

defineBlock( metadata, {
	panels: {
		Settings: TextSettings,
		Style: TextStyle,
		Motion: TextMotion,
		describe: ( attributes ) => textKind( attributes ).replace( /^./, ( c ) => c.toUpperCase() ),
	},
	Toolbar: TextToolbar,
	render( { attributes, blockProps, richText, onReplace, clientId, isEdit } ) {
		const className = [
			blockProps.className,
			cleanTextVariant( attributes.variant ) === 'lead' ? 'bl-text--lead' : '',
			attributes.dropCap ? 'bl-text--dropcap' : '',
		]
			.filter( Boolean )
			.join( ' ' );
		const editable = () => richText( {
			attr: 'content',
			tagName: cleanTextTag( attributes.tag ),
			placeholder: __( 'Type "/" to insert a Blicks block…', 'blicks' ),
			allowedFormats: [ 'core/bold', 'core/italic', 'core/link', 'blicks/text-style', 'blicks/inline-code', 'core/strikethrough', 'core/subscript', 'core/superscript' ],
			...blockProps,
			className,
			// Slash inserter scoped to Blicks blocks (replaces this block on select).
			identifier: 'content',
			onReplace,
			autocompleters: [ blicksBlockCompleter ],
			// "- ", "* " or "1. " at the start turns the Text into a List (List's prefix transforms).
			__unstableAllowPrefixTransformations: true,
		} );
		// Inside a Loop with its text bound to a field, the live card shows the current item's
		// value instead of the typed text (loop/binding.tsx). Saved markup is unchanged.
		if ( isEdit && bindingOf( attributes, 'content' ) ) {
			return <BoundValue attributes={ attributes } clientId={ clientId } attr="content" tagName={ cleanTextTag( attributes.tag ) } props={ { ...blockProps, className } } fallback={ editable } />;
		}
		return editable();
	},
} );
