import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type RenderCtx } from '@/framework/define-block';
import { ButtonControls, buttonVariations, cleanButtonSize, cleanButtonVariant } from './controls';
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

/**
 * Button markup, shared by today's `render` and the v2 deprecation below.
 *
 * `iconClass` is the only difference between the two. The icon now always carries
 * `bl-button__icon` — a stable hook for the author's own custom CSS, and the node the **Icon**
 * element's styling lands on — but that class was not in markup saved before elements existed, so
 * the deprecation replays this same body without it.
 */
function renderButton(
	{ attributes, blockProps, richText, elementProps }: RenderCtx,
	iconClass: string
) {
	const Tag = attributes.url ? 'a' : 'button';
	const variant = cleanButtonVariant( attributes.variant );
	const size = cleanButtonSize( attributes.size );
	const className = [
		blockProps.className,
		`bl-button--${ variant }`,
		`bl-button--${ size === 'default' ? 'default-size' : size }`,
	].join( ' ' );

	// Element styling — empty for a button nobody has styled that way, so the markup is unchanged.
	const iconStyle = elementProps( 'icon' );
	const labelStyle = elementProps( 'label' );

	const iconClassName = [ iconClass, iconStyle.className ].filter( Boolean ).join( ' ' );
	const icon = attributes.icon
		? renderIcon( attributes.icon, {
				strokeWidth: 2,
				...( iconClassName ? { className: iconClassName } : {} ),
				...( iconStyle.style ? { style: iconStyle.style } : {} ),
		  } )
		: null;

	const label = richText( {
		attr: 'text',
		tagName: 'span',
		placeholder: __( 'Add text…', 'blicks' ),
		allowedFormats: [ 'core/bold', 'core/italic' ],
		className: [ 'bl-button__label', labelStyle.className ].filter( Boolean ).join( ' ' ),
		...( labelStyle.style ? { style: labelStyle.style } : {} ),
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
}

defineBlock( metadata, {
	Controls: ButtonControls,
	Toolbar: ButtonToolbar,
	variations: buttonVariations,
	// Let authors save a styled button as a reusable preset. Only the design attributes travel — never
	// the label, URL or link target (those are per-instance content).
	userPresets: true,
	presetAttributes: [ 'blicks', 'variant', 'size', 'icon', 'iconPosition' ],
	deprecated: [
		{
			// v2 — the icon gained `bl-button__icon` when the Icon element landed. Every already-saved
			// button WITH an icon carries a bare `<svg>`, so without this its markup no longer matches
			// what save() produces and the block goes invalid. Attribute metadata is unchanged; only
			// the markup moved, which is exactly the case `render` exists for.
			render: ( ctx ) => renderButton( ctx, '' ),
		},
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
			// v1 predates the icon class too, so it replays the same pre-element markup.
			render: ( ctx ) => renderButton( ctx, '' ),
		},
	],
	render: ( ctx ) => renderButton( ctx, 'bl-button__icon' ),
} );
