import { __ } from '@wordpress/i18n';
import { ToolbarGroup, ToolbarDropdownMenu } from '@wordpress/components';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';

const tagGlyph = (
	<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
		<g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
			<path d="M9 8l-4 4 4 4" />
			<path d="M15 8l4 4-4 4" />
		</g>
	</svg>
);

const TAG_OPTIONS = [
	{ label: 'Div', value: 'div', hint: __( 'Generic', 'blicks' ) },
	{ label: 'Section', value: 'section', hint: __( 'Section', 'blicks' ) },
	{ label: 'Article', value: 'article', hint: __( 'Card', 'blicks' ) },
	{ label: 'Aside', value: 'aside', hint: __( 'Aside', 'blicks' ) },
	{ label: 'Header', value: 'header', hint: __( 'Header', 'blicks' ) },
	{ label: 'Footer', value: 'footer', hint: __( 'Footer', 'blicks' ) },
	{ label: 'Nav', value: 'nav', hint: __( 'Nav', 'blicks' ) },
	{ label: 'Main', value: 'main', hint: __( 'Main', 'blicks' ) },
	{ label: 'Figure', value: 'figure', hint: __( 'Media', 'blicks' ) },
	{ label: 'Span', value: 'span', hint: __( 'Inline', 'blicks' ) },
];

export function cleanBoxTag( tag: unknown ): string {
	const value = String( tag || 'div' );
	return TAG_OPTIONS.some( ( option ) => option.value === value ) ? value : 'div';
}

export function BoxControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const help = useBlockHelp( 'box' );
	const controlHelp = help?.controls ?? {};

	return (
		<SettingsCard title={ __( 'Box', 'blicks' ) } help={ help?.description }>
			<OptionCards
				label={ __( 'HTML tag', 'blicks' ) }
				help={ controlHelp.tag }
				value={ cleanBoxTag( attributes.tag ) }
				options={ TAG_OPTIONS }
				columns={ 2 }
				onChange={ ( tag ) => setAttributes( { tag } ) }
			/>
		</SettingsCard>
	);
}

export function BoxAdvanced( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const opensNew = attributes.linkTarget === '_blank';
	const hasLink = !! String( attributes.href || '' ).trim();

	return (
		<SettingsCard title={ __( 'Link', 'blicks' ) } help={ __( 'Make the whole box clickable (stretched link).', 'blicks' ) }>
			<FieldRow label={ __( 'URL', 'blicks' ) }>
				<input
					type="url"
					value={ attributes.href || '' }
					placeholder="https://"
					onChange={ ( event ) => setAttributes( { href: event.currentTarget.value } ) }
				/>
			</FieldRow>
			{ hasLink && (
				<>
					<SegmentedSetting
						label={ __( 'Target', 'blicks' ) }
						value={ opensNew ? 'blank' : 'same' }
						options={ [
							{ label: __( 'Same tab', 'blicks' ), value: 'same' },
							{ label: __( 'New tab', 'blicks' ), value: 'blank' },
						] }
						onChange={ ( target ) => setAttributes( {
							linkTarget: target === 'blank' ? '_blank' : '',
							rel: target === 'blank' ? 'noreferrer noopener' : '',
						} ) }
					/>
					<FieldRow label={ __( 'Link label', 'blicks' ) } help={ __( 'Accessible name for the link (screen readers).', 'blicks' ) }>
						<input
							value={ attributes.linkLabel || '' }
							placeholder={ __( 'e.g. Read the case study', 'blicks' ) }
							onChange={ ( event ) => setAttributes( { linkLabel: event.currentTarget.value } ) }
						/>
					</FieldRow>
				</>
			) }
		</SettingsCard>
	);
}

export function BoxToolbar( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const current = cleanBoxTag( attributes.tag );
	return (
		<ToolbarGroup>
			<ToolbarDropdownMenu
				icon={ tagGlyph }
				text={ current }
				label={ __( 'HTML tag', 'blicks' ) }
				controls={ TAG_OPTIONS.map( ( option ) => ( {
					title: `${ option.label } — ${ option.hint }`,
					isActive: current === option.value,
					onClick: () => setAttributes( { tag: option.value } ),
				} ) ) }
			/>
		</ToolbarGroup>
	);
}
