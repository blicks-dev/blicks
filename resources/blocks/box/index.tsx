import { __ } from '@wordpress/i18n';
import { defineBlock } from '@/framework/define-block';
import metadata from './block.json';
import { BoxMotion, BoxSettings, BoxStyle, BoxToolbar, KINDS } from './controls';
import { cleanKind, cleanTag } from './model';
import { BoundValue, bindingOf } from '@/blocks/loop/binding';

defineBlock( metadata, {
	innerBlocks: true,
	Toolbar: BoxToolbar,
	panels: {
		Settings: BoxSettings,
		Style: BoxStyle,
		Motion: BoxMotion,
		// A spacer is empty room: nothing to style or move. A divider has a look but no motion.
		tabsFor: ( attributes ) => ( { spacer: [ 'settings' ], divider: [ 'settings', 'style' ] } as const )[ cleanKind( attributes.kind ) as 'spacer' ] ?? [ 'settings', 'style', 'motion' ],
		describe: ( attributes ) => KINDS.find( ( [ k ] ) => k === cleanKind( attributes.kind ) )?.[ 1 ] ?? '',
	},
	// A Box is routinely meant to stay empty — a rule, a swatch, a sized block of colour — so it gets
	// no starting-layout placeholder and no ghost add-slot, only WordPress's own appender while it is
	// selected. Its kinds and arrangements are in Settings, and they write ordinary style values.
	render( { attributes, blockProps, children, isEdit, richText, clientId } ) {
		const kind = cleanKind( attributes.kind );
		// A plain box carries no kind class, so its markup is just the wrapper and its style classes.
		const className = [ blockProps.className, kind !== 'plain' ? `bl-box--${ kind }` : '', attributes.layers ? 'bl-box--layers' : '' ]
			.filter( Boolean )
			.join( ' ' );
		const href = String( attributes.href || '' ).trim();
		const linkProps = {
			href,
			target: attributes.linkTarget || undefined,
			rel: attributes.rel || undefined,
			'aria-label': attributes.linkLabel || undefined,
		};

		// The leaf kinds hold no blocks. The Settings tab only offers them while the box is empty.
		if ( kind === 'divider' ) return <hr { ...blockProps } className={ className } />;
		if ( kind === 'spacer' ) return <div { ...blockProps } className={ className } aria-hidden="true" />;
		if ( kind === 'badge' ) {
			// A badge bound to a field an item leaves empty is hidden in the Loop's preview cards, as
			// it is on the front end (style.scss). The editor draws an empty RichText as a `<br>`, so
			// `:empty` can't see it there: the class says so instead. Editor only; saves nothing.
			const emptyBound = isEdit && !! bindingOf( attributes, 'text' ) && ! String( attributes.text ?? '' ).replace( /<[^>]*>/g, '' ).trim();
			// A linked badge is the link itself: a short label, so there is nothing to stretch over.
			const editable = () => richText( {
				attr: 'text',
				tagName: href && ! isEdit ? 'a' : 'span',
				placeholder: __( 'Badge', 'blicks' ),
				allowedFormats: [ 'core/bold', 'core/italic' ],
				...blockProps,
				className: emptyBound ? `${ className } is-empty` : className,
				...( href && ! isEdit ? linkProps : {} ),
			} );
			// Bound to a field in a Loop's live card: the current item's value, with a chip naming the
			// field, as a bound Text shows it (loop/binding.tsx). Saved markup is unchanged.
			if ( isEdit && bindingOf( attributes, 'text' ) ) {
				return <BoundValue attributes={ attributes } clientId={ clientId } attr="text" tagName="span" props={ { ...blockProps, className } } fallback={ editable } />;
			}
			return editable();
		}

		const Tag = cleanTag( attributes.tag ) as keyof JSX.IntrinsicElements;

		// Stretched-link overlay: the box stays a normal element (an <a> may not wrap block content)
		// and an absolutely-positioned <a> covers it, with inner links lifted above it in CSS. Inert
		// in the editor so the inner blocks stay selectable.
		const link = href ? (
			<a
				className="bl-box__link"
				{ ...linkProps }
				{ ...( isEdit ? { tabIndex: -1, style: { pointerEvents: 'none' }, onClick: ( e: any ) => e.preventDefault() } : {} ) }
			/>
		) : null;

		return (
			<Tag { ...blockProps } className={ [ className, href ? 'bl-box--linked' : '' ].filter( Boolean ).join( ' ' ) }>
				{ link }
				{ children }
			</Tag>
		);
	},
} );
