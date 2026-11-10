import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { renderIcon } from '@/framework/icons/render';
import { MenuLinkSettings, MenuLinkStyle, MenuLinkToolbar } from './controls';

/**
 * One link of a menu or a link column: a label, an optional line of description under it, an
 * optional icon before it and a badge after it. The whole row is the link, so its target is the
 * size of the row. Every part is a class, so a theme or a header can style it; a phone drawer
 * drops the description, for instance.
 *
 * Saved markup (golden `menu-link.html`):
 *
 *   <a class="bl-menu-link bl-…" href="…">
 *     <span class="bl-menu-link__icon"><svg …/></span>
 *     <span class="bl-menu-link__text">
 *       <span class="bl-menu-link__label">Analytics</span>
 *       <span class="bl-menu-link__desc">Dashboards and reports</span>
 *     </span>
 *     <span class="bl-menu-link__badge">New</span>
 *   </a>
 */
defineBlock( metadata, {
	panels: {
		Settings: MenuLinkSettings,
		Style: MenuLinkStyle,
		describe: ( attributes ) => String( attributes.label || '' ).replace( /<[^>]*>/g, '' ),
	},
	Toolbar: MenuLinkToolbar,
	render( { attributes, blockProps, richText, isEdit } ) {
		const url = String( attributes.url || '' ).trim();
		const icon = String( attributes.icon || '' );
		const badge = String( attributes.badge || '' );
		const description = String( attributes.description || '' );
		const link = {
			...( url ? { href: url } : {} ),
			...( attributes.linkTarget ? { target: attributes.linkTarget } : {} ),
			...( attributes.rel ? { rel: attributes.rel } : {} ),
		};

		return (
			<a { ...blockProps } { ...link }>
				{ icon && <span className="bl-menu-link__icon">{ renderIcon( icon, { strokeWidth: 2 } ) }</span> }
				<span className="bl-menu-link__text">
					{ richText( {
						attr: 'label',
						tagName: 'span',
						className: 'bl-menu-link__label',
						placeholder: __( 'Link', 'blicks' ),
						allowedFormats: [],
					} ) }
					{ ( description || isEdit ) &&
						richText( {
							attr: 'description',
							tagName: 'span',
							className: 'bl-menu-link__desc',
							placeholder: __( 'Add a description…', 'blicks' ),
							allowedFormats: [],
						} ) }
				</span>
				{ badge && <span className="bl-menu-link__badge">{ badge }</span> }
			</a>
		);
	},
} );
