import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { getValue, setValue } from '@/framework/values';
import { blicksBlockCompleter } from '@/blocks/shared/blicks-block-completer';
import { TextControls, cleanTextTag, cleanTextVariant } from './controls';

const ALIGNMENTS = [
	{ value: 'left', label: __( 'Align left', 'blicks' ), icon: 'editor-alignleft' },
	{ value: 'center', label: __( 'Align center', 'blicks' ), icon: 'editor-aligncenter' },
	{ value: 'right', label: __( 'Align right', 'blicks' ), icon: 'editor-alignright' },
	{ value: 'justify', label: __( 'Justify', 'blicks' ), icon: 'editor-justify' },
];

function TextToolbar( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const alignment = getValue( attributes, 'typography.textAlign', 'default', 'base' ) || 'left';
	return (
		<>
			{ ALIGNMENTS.map( ( option ) => (
				<ToolbarButton
					key={ option.value }
					icon={ option.icon as any }
					label={ option.label }
					isPressed={ alignment === option.value }
					onClick={ () => setValue( attributes, setAttributes, 'typography.textAlign', 'default', 'base', option.value ) }
				/>
			) ) }
		</>
	);
}

defineBlock( metadata, {
	Controls: TextControls,
	Toolbar: TextToolbar,
	render( { attributes, blockProps, richText, onReplace } ) {
		const className = [
			blockProps.className,
			cleanTextVariant( attributes.variant ) === 'lead' ? 'bl-text--lead' : '',
			attributes.dropCap ? 'bl-text--dropcap' : '',
		]
			.filter( Boolean )
			.join( ' ' );
		return richText( {
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
		} );
	},
} );
