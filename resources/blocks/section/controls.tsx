import { __ } from '@wordpress/i18n';
import { FieldRow, SegmentedSetting, SettingsCard, useBlockHelp, type Option } from '@/blocks/shared/settings-ui';
import { Combobox } from '@/blocks/shared/combobox';

const WIDTH_OPTIONS: Option[] = [
	{ label: __( 'Auto', 'blicks' ), value: 'auto', hint: __( 'default', 'blicks' ) },
	{ label: __( 'Full width', 'blicks' ), value: '100%', hint: '100%' },
	{ label: __( 'Viewport', 'blicks' ), value: '100vw', hint: '100vw' },
	{ label: __( 'Fit content', 'blicks' ), value: 'fit-content', hint: 'fit-content' },
	{ label: __( 'Narrow', 'blicks' ), value: '640px', hint: '640px' },
	{ label: __( 'Medium', 'blicks' ), value: '768px', hint: '768px' },
	{ label: __( 'Wide', 'blicks' ), value: '1024px', hint: '1024px' },
	{ label: __( 'Extra wide', 'blicks' ), value: '1280px', hint: '1280px' },
];

const SURFACE_OPTIONS = [
	{ label: __( 'Plain', 'blicks' ), value: 'plain' },
	{ label: __( 'Muted', 'blicks' ), value: 'muted' },
	{ label: __( 'Card', 'blicks' ), value: 'card' },
	{ label: __( 'Outline', 'blicks' ), value: 'outline' },
];

const SPACE_OPTIONS = [
	{ label: __( 'None', 'blicks' ), value: 'none' },
	{ label: __( 'SM', 'blicks' ), value: 'sm' },
	{ label: __( 'MD', 'blicks' ), value: 'md' },
	{ label: __( 'LG', 'blicks' ), value: 'lg' },
];

export function cleanSectionSurface( surface: unknown ): string {
	const value = String( surface || 'plain' );
	return SURFACE_OPTIONS.some( ( option ) => option.value === value ) ? value : 'plain';
}

export function cleanSectionSpace( space: unknown ): string {
	const value = String( space || 'md' );
	return SPACE_OPTIONS.some( ( option ) => option.value === value ) ? value : 'md';
}

const DIMENSION_KEYWORDS = [
	'auto', 'none', 'fit-content', 'max-content', 'min-content',
	// CSS-wide global keywords
	'inherit', 'initial', 'unset', 'revert', 'revert-layer',
];

/** Any CSS function call with balanced parens — `calc()`, `clamp()`, `min()`, `max()`, `var()`, `env()`, … */
function isCssFunction( raw: string ): boolean {
	if ( ! /^[a-z][a-z0-9-]*\(/i.test( raw ) || ! raw.endsWith( ')' ) ) return false;
	let depth = 0;
	for ( const char of raw ) {
		if ( char === '(' ) depth++;
		else if ( char === ')' && --depth < 0 ) return false;
	}
	return depth === 0;
}

function cleanDimension( value: unknown, fallback: string ): string {
	const raw = String( value ?? '' ).trim();
	if ( raw === '' ) return fallback;
	if ( raw === '0' ) return '0';
	if ( DIMENSION_KEYWORDS.includes( raw ) || isCssFunction( raw ) ) return raw;
	if ( /^-?\d*\.?\d+(px|%|em|rem|vw|vh|svh|dvh|lvh|ch|fr)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return fallback;
}

export function cleanSectionDimension( value: unknown, fallback: string ): string {
	return cleanDimension( value, fallback );
}

/** True for an empty field or any CSS length/keyword/function `cleanDimension` accepts. */
function isValidDimension( value: string ): boolean {
	const raw = value.trim();
	if ( raw === '' || raw === '0' ) return true;
	if ( DIMENSION_KEYWORDS.includes( raw ) || isCssFunction( raw ) ) return true;
	return /^-?\d*\.?\d+(px|%|em|rem|vw|vh|svh|dvh|lvh|ch|fr)?$/.test( raw );
}

const CONTENT_MAX_WIDTH_DEFAULT = 'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))';

function DimensionInput( {
	label,
	help,
	value,
	fallback,
	onChange,
}: {
	label: string;
	help?: string;
	value: string;
	fallback: string;
	onChange: ( value: string ) => void;
} ) {
	return (
		<FieldRow label={ label } help={ help }>
			<input
				value={ value || fallback }
				onChange={ ( event ) => onChange( event.currentTarget.value ) }
				onBlur={ () => onChange( cleanDimension( value, fallback ) ) }
			/>
		</FieldRow>
	);
}

export function SectionControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const help = useBlockHelp( 'section' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Section', 'blicks' ) }>
				<Combobox
					label={ __( 'Width', 'blicks' ) }
					help={ controlHelp.sectionWidth }
					value={ attributes.sectionWidth ?? '' }
					options={ WIDTH_OPTIONS }
					placeholder="auto"
					validate={ ( raw ) =>
						isValidDimension( raw ) ? true : __( 'Enter a length like 640px, 100%, or auto.', 'blicks' )
					}
					onChange={ ( sectionWidth ) => setAttributes( { sectionWidth } ) }
					onCommit={ ( raw ) =>
						setAttributes( { sectionWidth: raw.trim() === '' ? '' : cleanDimension( raw, 'auto' ) } )
					}
				/>
				<DimensionInput
					label={ __( 'Min height', 'blicks' ) }
					help={ controlHelp.sectionHeight }
					value={ attributes.sectionHeight || 'auto' }
					fallback="auto"
					onChange={ ( sectionHeight ) => setAttributes( { sectionHeight } ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Content', 'blicks' ) }>
				<DimensionInput
					label={ __( 'Content width', 'blicks' ) }
					help={ controlHelp.contentWidth }
					value={ attributes.contentWidth || '100%' }
					fallback="100%"
					onChange={ ( contentWidth ) => setAttributes( { contentWidth } ) }
				/>
				<DimensionInput
					label={ __( 'Content min width', 'blicks' ) }
					help={ controlHelp.contentMinWidth }
					value={ attributes.contentMinWidth || '0' }
					fallback="0"
					onChange={ ( contentMinWidth ) => setAttributes( { contentMinWidth } ) }
				/>
				<DimensionInput
					label={ __( 'Content max width', 'blicks' ) }
					help={ controlHelp.contentMaxWidth }
					value={ attributes.contentMaxWidth || CONTENT_MAX_WIDTH_DEFAULT }
					fallback={ CONTENT_MAX_WIDTH_DEFAULT }
					onChange={ ( contentMaxWidth ) => setAttributes( { contentMaxWidth } ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Surface', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'Treatment', 'blicks' ) }
					help={ controlHelp.surface }
					value={ cleanSectionSurface( attributes.surface ) }
					options={ SURFACE_OPTIONS }
					onChange={ ( surface ) => setAttributes( { surface } ) }
				/>
				<SegmentedSetting
					label={ __( 'Section padding', 'blicks' ) }
					help={ controlHelp.sectionSpace }
					value={ cleanSectionSpace( attributes.sectionSpace ) }
					options={ SPACE_OPTIONS }
					onChange={ ( sectionSpace ) => setAttributes( { sectionSpace } ) }
				/>
			</SettingsCard>
		</>
	);
}
