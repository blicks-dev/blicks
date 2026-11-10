import { ToolbarGroup } from '@wordpress/components';
import { ToolbarLink, newTabAttributes } from '@/blocks/shared/toolbar';
import { InnerBlocks } from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type RenderCtx } from '@/framework/define-block';
import { ButtonMotion, ButtonQuickBar, ButtonSettings, ButtonStyle, buttonAction, cleanButtonSize, cleanButtonVariant, cleanButtonWidth } from './controls';
import { renderIcon } from '@/framework/icons/render';
import { BUTTON_CHILDREN, cleanContentMode, cleanIconSize, inlineFixes } from './content';
import { WithBound, bindingOf } from '@/blocks/loop/binding';

/*
 * Only inline blocks go inside a Button, at any depth: `allowedBlocks` covers its direct children,
 * and this covers a Box nested inside it, whose own list is "anything".
 */
addFilter(
	'blockEditor.__unstableCanInsertBlockType',
	'blicks/button-inline-children',
	( canInsert: boolean, blockType: any, rootClientId: string | null, { getBlock, getBlockParentsByBlockName }: any ) => {
		if ( ! canInsert || ! rootClientId ) return canInsert;
		const inButton = getBlock( rootClientId )?.name === 'blicks/button'
			|| getBlockParentsByBlockName( rootClientId, 'blicks/button' ).length > 0;
		return inButton ? BUTTON_CHILDREN.includes( typeof blockType === 'string' ? blockType : blockType?.name ) : canInsert;
	}
);

/** Keeps every block inside a Blocks-mode Button inline and link-free, whatever it was inserted as. */
function useInlineChildren( { attributes, clientId }: { attributes: any; clientId: string } ) {
	const blocksMode = cleanContentMode( attributes.content ) === 'blocks';
	const tree = useSelect(
		( select: any ) => ( blocksMode ? select( 'core/block-editor' ).getBlock( clientId )?.innerBlocks ?? [] : [] ),
		[ clientId, blocksMode ]
	);
	const { updateBlockAttributes } = useDispatch( 'core/block-editor' ) as any;

	useEffect( () => {
		for ( const fix of inlineFixes( tree ) ) updateBlockAttributes( fix.clientId, fix.attributes );
	}, [ tree, updateBlockAttributes ] );
}

function ButtonToolbar( { attributes, setAttributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId?: string } ) {
	const inStudio = useSelect( ( select: any ) => !! select( 'core/block-editor' ).getSettings()?.blicksStudio, [] );
	return (
		<>
			<ButtonQuickBar attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } inStudio={ inStudio } />
			{ buttonAction( attributes ) === 'link' && (
				<ToolbarGroup>
					<ToolbarLink
						url={ String( attributes.url || '' ) }
						newTab={ attributes.linkTarget === '_blank' }
						onUrl={ ( url ) => setAttributes( { url } ) }
						onNewTab={ ( on ) => setAttributes( newTabAttributes( on ) ) }
						onUnlink={ () => setAttributes( { url: '', linkTarget: '', rel: '' } ) }
					/>
				</ToolbarGroup>
			) }
		</>
	);
}

/** The Button's markup, editor and save alike. */
function drawButton( { attributes, blockProps, richText, children }: RenderCtx ): JSX.Element {
		const action = buttonAction( attributes );
		const Tag = action === 'link' && attributes.url ? 'a' : 'button';
		const blocksMode = cleanContentMode( attributes.content ) === 'blocks';
		const variant = cleanButtonVariant( attributes.variant );
		const size = cleanButtonSize( attributes.size );
		const className = [
			blockProps.className,
			`bl-button--${ variant }`,
			`bl-button--${ size === 'default' ? 'default-size' : size }`,
			// Fit is the default and writes nothing, so buttons saved before Width keep their markup.
			cleanButtonWidth( attributes.width ) ? `bl-button--w-${ cleanButtonWidth( attributes.width ) }` : '',
			blocksMode ? 'bl-button--blocks' : '',
		].filter( Boolean ).join( ' ' );
		// Open dialog and Close dialog are the browser's invoker commands. Close names no dialog:
		// the one it sits in is filled in when the page renders (Blicks\Blocks\Dialogs).
		const tagProps: Record< string, unknown > = Tag === 'a'
			? { href: attributes.url, target: attributes.linkTarget || undefined, rel: attributes.rel || undefined }
			: {
				// Send form is the one `type="submit"` and Clear form the one `type="reset"`; everything
				// else must not send a form it sits in.
				type: action === 'submit' || action === 'reset' ? action : 'button',
				...( action === 'dialog' ? { commandfor: `dialog-${ attributes.dialog }`, command: 'show-modal' } : {} ),
				...( action === 'close' ? { command: 'close' } : {} ),
			};

		// Blocks mode: the inner blocks are the content. Its accessible name is their text.
		if ( blocksMode ) {
			return (
				<Tag { ...blockProps } { ...tagProps } aria-label={ attributes.label || undefined } className={ className }>
					{ children }
				</Tag>
			);
		}

		// Written only when set, so buttons saved before Icon size keep their markup.
		const iconSize = cleanIconSize( attributes.iconSize );
		const style = iconSize ? { ...blockProps.style, '--bl-button-icon-size': iconSize } : blockProps.style;
		const icon = attributes.icon ? renderIcon( attributes.icon, { strokeWidth: 2 } ) : null;
		const label = richText( {
			attr: 'text',
			tagName: 'span',
			placeholder: __( 'Add text…', 'blicks' ),
			allowedFormats: [ 'core/bold', 'core/italic' ],
			className: 'bl-button__label',
		} );
		// An icon-only button has no words, so it carries its name for screen readers.
		const name = size === 'icon' && attributes.label ? { 'aria-label': attributes.label } : {};

		return (
			<Tag { ...blockProps } { ...tagProps } { ...name } className={ className } style={ style }>
				{ attributes.iconPosition !== 'trailing' && icon }
				{ size !== 'icon' && label }
				{ attributes.iconPosition === 'trailing' && icon }
			</Tag>
		);
}

defineBlock( metadata, {
	panels: {
		Settings: ButtonSettings,
		Style: ButtonStyle,
		Motion: ButtonMotion,
		look: { kind: 'button', linked: true },
		describe: ( attributes ) => String( attributes.text || '' ).replace( /<[^>]*>/g, '' ).slice( 0, 32 ),
	},
	Toolbar: ButtonToolbar,
	innerBlocks: {
		allowedBlocks: BUTTON_CHILDREN,
		orientation: 'horizontal',
		renderAppender: InnerBlocks.ButtonBlockAppender,
		active: ( attributes ) => cleanContentMode( attributes.content ) === 'blocks',
	},
	useEdit: useInlineChildren,
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
	render( ctx ) {
		// Inside a Loop with its label or link bound to a field, the live card draws the current
		// item's values (loop/binding.tsx). Saved markup is unchanged.
		const label = bindingOf( ctx.attributes, 'text' );
		if ( ctx.isEdit && ( label || bindingOf( ctx.attributes, 'url' ) ) ) {
			return (
				<WithBound attributes={ ctx.attributes } clientId={ ctx.clientId } kinds={ { text: 'text', url: 'url' } }>
					{ ( attributes ) => drawButton( {
						...ctx,
						attributes,
						richText: label
							? ( opts: any ) => <span className={ `${ opts.className ?? '' } is-bound` }><span className="bl-bound-chip" aria-hidden="true">{ label.key }</span>{ attributes.text }</span>
							: ctx.richText,
					} ) }
				</WithBound>
			);
		}
		return drawButton( ctx );
	},
} );
