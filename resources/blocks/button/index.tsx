import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { ButtonControls, cleanButtonSize, cleanButtonVariant } from './controls';
import { renderIcon } from '@/framework/icons/render';

function ButtonToolbar( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	return (
		<ToolbarButton
			icon="admin-links"
			label={ __( 'Clear link', 'blicks' ) }
			disabled={ ! attributes.url }
			onClick={ () => setAttributes( { url: '', linkTarget: '', rel: '' } ) }
		/>
	);
}

defineBlock( metadata, {
	Controls: ButtonControls,
	Toolbar: ButtonToolbar,
	deprecated: [
		{
			// `text` used to default to "Get started", and it is not a sourced attribute — so a
			// Button left at the default saved its label into the markup and omitted `text` from
			// the block comment. Parsed against today's `default: ""`, that markup reproduces as
			// an empty label and the block goes invalid.
			//
			// The saved shape is otherwise unchanged, so this needs no `save` of its own: the
			// factory's, run with the old default, is byte-for-byte what is in those posts.
			attributes: {
				...metadata.attributes,
				text: { ...metadata.attributes.text, default: 'Get started' },
			},
		},
	],
	render( { attributes, blockProps, richText } ) {
		const Tag = attributes.url ? 'a' : 'button';
		const variant = cleanButtonVariant( attributes.variant );
		const size = cleanButtonSize( attributes.size );
		const className = [
			blockProps.className,
			`bl-button--${ variant }`,
			`bl-button--${ size === 'default' ? 'default-size' : size }`,
		].join( ' ' );
		const icon = attributes.icon ? renderIcon( attributes.icon, { strokeWidth: 2 } ) : null;
		const label = richText( {
			attr: 'text',
			tagName: 'span',
			placeholder: __( 'Add text…', 'blicks' ),
			allowedFormats: [ 'core/bold', 'core/italic' ],
			className: 'bl-button__label',
		} );
		const tagProps = Tag === 'a'
			? { href: attributes.url, target: attributes.linkTarget || undefined, rel: attributes.rel || undefined }
			: { type: 'button' };

		return (
			<Tag { ...blockProps } { ...tagProps } className={ className }>
				{ attributes.iconPosition !== 'trailing' && icon }
				{ size !== 'icon' && label }
				{ attributes.iconPosition === 'trailing' && icon }
			</Tag>
		);
	},
} );
