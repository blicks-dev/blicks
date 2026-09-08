import { defineBlock } from '@/framework/define-block';
import metadata from './block.json';
import { BoxAdvanced, BoxControls, BoxToolbar, cleanBoxTag } from './controls';

defineBlock( metadata, {
	innerBlocks: true,
	Controls: BoxControls,
	Toolbar: BoxToolbar,
	Advanced: BoxAdvanced,
	// A Box is a free-form wrapper that's valid empty (spacer, decorative panel), so it gets no
	// starting-layout placeholder — a plain wrapper has no layout of its own to explain — and no
	// ghost "Add block" slot either: it uses WordPress's own default appender like a plain
	// InnerBlocks container.
	render( { attributes, blockProps, children, isEdit } ) {
		const Tag = cleanBoxTag( attributes.tag ) as keyof JSX.IntrinsicElements;
		const href = String( attributes.href || '' ).trim();
		const className = [ blockProps.className, href ? 'bl-box--linked' : '' ]
			.filter( Boolean )
			.join( ' ' );

		// Stretched-link overlay: the box stays a normal element (no invalid <a> wrapping inner
		// blocks); an absolutely-positioned <a> covers it. Inner links/buttons sit above it via
		// CSS z-index. In the editor the overlay is inert (pointer-events off) so blocks stay
		// selectable; save() renders the live link, so editor != saved markup is fine (only
		// save output is validated).
		const link = href ? (
			<a
				className="bl-box__link"
				href={ href }
				target={ attributes.linkTarget || undefined }
				rel={ attributes.rel || undefined }
				aria-label={ attributes.linkLabel || undefined }
				{ ...( isEdit
					? { tabIndex: -1, style: { pointerEvents: 'none' }, onClick: ( e: any ) => e.preventDefault() }
					: {} ) }
			/>
		) : null;

		return (
			<Tag { ...blockProps } className={ className }>
				{ link }
				{ children }
			</Tag>
		);
	},
} );
