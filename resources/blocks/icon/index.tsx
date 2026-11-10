import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { cleanHref } from '@/framework/sanitize';
import { getIcon } from '@/framework/icons';
import { IconMotion, IconSettings, IconStyle, IconToolbar } from './controls';
import { cleanIconSize, cleanStrokeWidth, iconClasses } from './model';
import { renderIcon } from '@/framework/icons/render';

defineBlock( metadata, {
	panels: {
		Settings: IconSettings,
		Style: IconStyle,
		Motion: IconMotion,
		describe: ( attributes ) => getIcon( attributes.icon )?.label ?? '',
	},
	Toolbar: IconToolbar,
	render( { attributes, blockProps } ) {
		const label = String( attributes.label || '' ).trim();
		const href = cleanHref( attributes.url );
		const style = {
			...( blockProps.style ?? {} ),
			'--bl-icon-size': cleanIconSize( attributes.size ),
		};
		const className = [ blockProps.className, ...iconClasses( attributes ) ].filter( Boolean ).join( ' ' );
		const glyph = renderIcon( attributes.icon, { strokeWidth: cleanStrokeWidth( attributes.strokeWidth ) } );

		// A link is never hidden from screen readers; it carries the label as its name.
		if ( href ) {
			return (
				<a { ...blockProps } className={ className } style={ style } href={ href } target={ attributes.linkTarget || undefined } rel={ attributes.rel || undefined } aria-label={ label || undefined }>
					{ glyph }
				</a>
			);
		}

		return (
			<span { ...blockProps } className={ className } style={ style } aria-label={ label || undefined } aria-hidden={ label ? undefined : true }>
				{ glyph }
			</span>
		);
	},
} );
