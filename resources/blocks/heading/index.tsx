import { ToolbarGroup } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import { TEXT_ALIGNS, alignIcon } from '@/blocks/shared/toolbar-align';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { HeadingMotion, HeadingSettings, HeadingStyle, LEVELS, LOOKS, cleanHeadingLevel, setHeadingAlignment, withHeadingLook } from './controls';
import { getValue } from '@/framework/values';
import { blicksBlockCompleter } from '@/blocks/shared/blicks-block-completer';
import { BoundValue, bindingOf } from '@/blocks/loop/binding';

function HeadingToolbar( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const level = cleanHeadingLevel( attributes.level );
	const alignment = getValue( attributes, 'typography.textAlign', 'default', 'base' ) || 'left';
	const role = String( attributes.blicks?.[ 'typography.role' ]?.default?.base ?? '' );
	return (
		<>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'Level', 'blicks' ) } value={ String( level ) } options={ LEVELS } onChange={ ( l ) => setAttributes( { level: Number( l ) } ) } />
				<ToolbarChoice label={ __( 'Looks like', 'blicks' ) } value={ LOOKS.some( ( [ v ] ) => v === role ) ? role : '' } options={ LOOKS } onChange={ ( v ) => setAttributes( withHeadingLook( attributes, v ) ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice
					label={ __( 'Line up', 'blicks' ) }
					iconOnly
					icon={ alignIcon( alignment ) }
					value={ alignment }
					options={ TEXT_ALIGNS.slice( 0, 3 ) }
					onChange={ ( a ) => setHeadingAlignment( attributes, setAttributes, a ) }
				/>
			</ToolbarGroup>
		</>
	);
}

defineBlock( metadata, {
	panels: {
		Settings: HeadingSettings,
		Style: HeadingStyle,
		Motion: HeadingMotion,
		describe: ( attributes ) => `H${ cleanHeadingLevel( attributes.level ) }`,
	},
	Toolbar: HeadingToolbar,
	render( { attributes, blockProps, richText, onReplace, clientId, isEdit } ) {
		const tagName = `h${ cleanHeadingLevel( attributes.level ) }`;

		const editable = () => richText( {
			attr: 'content',
			tagName,
			placeholder: __( 'Heading...', 'blicks' ),
			allowedFormats: [ 'core/bold', 'core/italic', 'core/link', 'blicks/text-style', 'blicks/inline-code', 'core/strikethrough', 'core/subscript', 'core/superscript' ],
			...blockProps,
			// Slash inserter scoped to Blicks blocks (replaces this block on select).
			identifier: 'content',
			onReplace,
			autocompleters: [ blicksBlockCompleter ],
		} );
		// Inside a Loop with its text bound to a field, the live card shows the current item's
		// value instead of the typed text (loop/binding.tsx). Saved markup is unchanged.
		if ( isEdit && bindingOf( attributes, 'content' ) ) {
			return <BoundValue attributes={ attributes } clientId={ clientId } attr="content" tagName={ tagName } props={ blockProps } fallback={ editable } />;
		}
		return editable();
	},
} );
