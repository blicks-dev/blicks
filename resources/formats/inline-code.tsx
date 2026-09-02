import { registerFormatType, toggleFormat } from '@wordpress/rich-text';
import { RichTextToolbarButton } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

const FORMAT = 'blicks/inline-code';

const codeIcon = (
	<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt" strokeLinejoin="miter">
			<path d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
		</g>
	</svg>
);

/**
 * Inline `<code>` mark for RichText — the one inline format Blicks lacked (text-style does color +
 * highlight, but not code). Toggles a `<code class="bl-inline-code">` span styled with the mono font +
 * a subtle token background. Scoped to Blicks blocks so it doesn't clutter core block toolbars.
 */
function Edit( { value, onChange, isActive }: any ) {
	const isBlicksBlock = useSelect( ( select: any ) => {
		const be = select( 'core/block-editor' );
		const id = be.getSelectedBlockClientId?.();
		return id ? String( be.getBlockName?.( id ) || '' ).startsWith( 'blicks/' ) : false;
	}, [] );

	if ( ! isBlicksBlock ) {
		return null;
	}

	return (
		<RichTextToolbarButton
			icon={ codeIcon }
			title={ __( 'Inline code', 'blicks' ) }
			isActive={ isActive }
			onClick={ () => onChange( toggleFormat( value, { type: FORMAT } ) ) }
		/>
	);
}

registerFormatType( FORMAT, {
	title: __( 'Inline code', 'blicks' ),
	tagName: 'code',
	className: 'bl-inline-code',
	edit: Edit,
} );
