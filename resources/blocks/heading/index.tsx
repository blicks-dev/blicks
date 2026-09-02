import { ToolbarButton } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { HeadingControls, cleanHeadingLevel, setHeadingAlignment } from './controls';
import { getValue } from '@/framework/values';
import { blicksBlockCompleter } from '@/blocks/shared/blicks-block-completer';

const ALIGNMENTS = [
	{ value: 'left', label: __( 'Align left', 'blicks' ), icon: 'editor-alignleft' },
	{ value: 'center', label: __( 'Align center', 'blicks' ), icon: 'editor-aligncenter' },
	{ value: 'right', label: __( 'Align right', 'blicks' ), icon: 'editor-alignright' },
];

function HeadingToolbar( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const level = cleanHeadingLevel( attributes.level );
	const alignment = getValue( attributes, 'typography.textAlign', 'default', 'base' ) || 'left';
	const nextLevel = level === 6 ? 1 : level + 1;

	return (
		<>
			<ToolbarButton
				label={ sprintf( __( 'Change heading level. Current level: %d', 'blicks' ), level ) }
				onClick={ () => setAttributes( { level: nextLevel } ) }
			>
				H{ level }
			</ToolbarButton>
			{ ALIGNMENTS.map( ( option ) => (
				<ToolbarButton
					key={ option.value }
					icon={ option.icon as any }
					label={ option.label }
					isPressed={ alignment === option.value }
					onClick={ () => setHeadingAlignment( attributes, setAttributes, option.value ) }
				/>
			) ) }
		</>
	);
}

defineBlock( metadata, {
	Controls: HeadingControls,
	Toolbar: HeadingToolbar,
	render( { attributes, blockProps, richText, onReplace } ) {
		const tagName = `h${ cleanHeadingLevel( attributes.level ) }`;

		return richText( {
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
	},
} );
