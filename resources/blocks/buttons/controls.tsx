import { __ } from '@wordpress/i18n';
import { SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';

const ORIENTATION_OPTIONS = [
	{ label: __( 'Horizontal', 'blicks' ), value: 'horizontal' },
	{ label: __( 'Vertical', 'blicks' ), value: 'vertical' },
];

const GAP_OPTIONS = [
	{ label: __( 'XS', 'blicks' ), value: 'xs' },
	{ label: __( 'SM', 'blicks' ), value: 'sm' },
	{ label: __( 'MD', 'blicks' ), value: 'md' },
	{ label: __( 'LG', 'blicks' ), value: 'lg' },
];

const JUSTIFY_OPTIONS = [
	{ label: __( 'Start', 'blicks' ), value: 'flex-start' },
	{ label: __( 'Center', 'blicks' ), value: 'center' },
	{ label: __( 'End', 'blicks' ), value: 'flex-end' },
	{ label: __( 'Between', 'blicks' ), value: 'space-between' },
];

const WRAP_OPTIONS = [
	{ label: __( 'No wrap', 'blicks' ), value: 'nowrap' },
	{ label: __( 'Wrap', 'blicks' ), value: 'wrap' },
];

export function buttonsDirection( orientation: unknown ): string {
	return validOption( ORIENTATION_OPTIONS, orientation, 'horizontal' ) === 'vertical' ? 'column' : 'row';
}

export function buttonsGapValue( gap: unknown ): string {
	return gapValue( validOption( GAP_OPTIONS, gap, 'sm' ) );
}

export function buttonsJustifyValue( justify: unknown ): string {
	return validOption( JUSTIFY_OPTIONS, justify, 'flex-start' );
}

function gapValue( gap: string ): string {
	return `var(--blicks-spacing-${ gap })`;
}

function validOption( options: Array< { value: string } >, value: unknown, fallback: string ): string {
	const next = String( value || fallback );
	return options.some( ( option ) => option.value === next ) ? next : fallback;
}

function writeBaseValue( tree: any, controlId: string, value: string ) {
	return {
		...tree,
		[ controlId ]: {
			...( tree?.[ controlId ] ?? {} ),
			default: {
				...( tree?.[ controlId ]?.default ?? {} ),
				base: value,
			},
		},
	};
}

function updateButtonsLayout(
	attributes: any,
	setAttributes: ( a: any ) => void,
	next: Partial< { orientation: string; gap: string; justify: string; wrap: boolean } >
) {
	const orientation = validOption( ORIENTATION_OPTIONS, next.orientation ?? attributes.orientation, 'horizontal' );
	const gap = validOption( GAP_OPTIONS, next.gap ?? attributes.gap, 'sm' );
	const justify = validOption( JUSTIFY_OPTIONS, next.justify ?? attributes.justify, 'flex-start' );
	const wrap = Boolean( next.wrap ?? attributes.wrap );

	let blicks = { ...( attributes.blicks ?? {} ) };
	blicks = writeBaseValue( blicks, 'layout.flexDirection', orientation === 'vertical' ? 'column' : 'row' );
	blicks = writeBaseValue( blicks, 'layout.gapRow', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.gapColumn', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.justifyContent', justify );
	blicks = writeBaseValue( blicks, 'layout.flexWrap', wrap ? 'wrap' : 'nowrap' );

	setAttributes( { ...next, orientation, gap, justify, wrap, blicks } );
}

export function setButtonsOrientation(
	attributes: any,
	setAttributes: ( a: any ) => void,
	orientation: string
) {
	updateButtonsLayout( attributes, setAttributes, { orientation } );
}

export function ButtonsControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const orientation = validOption( ORIENTATION_OPTIONS, attributes.orientation, 'horizontal' );
	const gap = validOption( GAP_OPTIONS, attributes.gap, 'sm' );
	const justify = validOption( JUSTIFY_OPTIONS, attributes.justify, 'flex-start' );
	const wrap = attributes.wrap ? 'wrap' : 'nowrap';
	const help = useBlockHelp( 'buttons' );
	const controlHelp = help?.controls ?? {};

	return (
		<SettingsCard title={ __( 'Layout', 'blicks' ) }>
			<SegmentedSetting
				label={ __( 'Direction', 'blicks' ) }
				help={ controlHelp.orientation }
				value={ orientation }
				options={ ORIENTATION_OPTIONS }
				onChange={ ( next ) => updateButtonsLayout( attributes, setAttributes, { orientation: next } ) }
			/>
			<SegmentedSetting
				label={ __( 'Gap', 'blicks' ) }
				help={ controlHelp.gap }
				value={ gap }
				options={ GAP_OPTIONS }
				onChange={ ( next ) => updateButtonsLayout( attributes, setAttributes, { gap: next } ) }
			/>
			<SegmentedSetting
				label={ __( 'Distribute', 'blicks' ) }
				help={ controlHelp.justify }
				value={ justify }
				options={ JUSTIFY_OPTIONS }
				onChange={ ( next ) => updateButtonsLayout( attributes, setAttributes, { justify: next } ) }
			/>
			<SegmentedSetting
				label={ __( 'Wrapping', 'blicks' ) }
				help={ controlHelp.wrap }
				value={ wrap }
				options={ WRAP_OPTIONS }
				onChange={ ( next ) => updateButtonsLayout( attributes, setAttributes, { wrap: next === 'wrap' } ) }
			/>
		</SettingsCard>
	);
}
