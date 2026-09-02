import { __ } from '@wordpress/i18n';
import { Notice, TextareaControl } from '@wordpress/components';
import { SettingsCard } from '@/blocks/shared/settings-ui';
import { sanitizeCss } from '@/framework/sanitize';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
}

/**
 * The **CSS** tab — per-block scoped custom CSS. Lifted out of Advanced so the escape hatch is
 * one click from anywhere rather than buried under Visibility and Custom attributes.
 */
export function CssPanel( { attributes, setAttributes }: Props ) {
	const blocked = sanitizeCss( attributes.customCSS ).blocked;

	return (
		<SettingsCard
			title={ __( 'Custom CSS', 'blicks' ) }
			help={ __( 'Scoped to this block. Use `selector` for the block root — e.g. `selector { }`, `selector:hover { }`, `selector > * { }`.', 'blicks' ) }
		>
			<TextareaControl
				__nextHasNoMarginBottom
				value={ attributes.customCSS || '' }
				rows={ 10 }
				placeholder={ 'selector {\n\n}' }
				onChange={ ( customCSS ) => setAttributes( { customCSS } ) }
			/>
			{ blocked.length > 0 && (
				<Notice status="warning" isDismissible={ false }>
					{ __( 'Removed for safety:', 'blicks' ) + ' ' + blocked.join( ', ' ) }
				</Notice>
			) }
		</SettingsCard>
	);
}
