import { __ } from '@wordpress/i18n';
import { OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';

const TAG_OPTIONS = [
	{ label: 'Div', value: 'div', hint: __( 'Generic', 'blicks' ) },
	{ label: 'Section', value: 'section', hint: __( 'Band', 'blicks' ) },
	{ label: 'Nav', value: 'nav', hint: __( 'Menu', 'blicks' ) },
	{ label: 'List', value: 'ul', hint: __( 'Items', 'blicks' ) },
];

const ORIENTATION_OPTIONS = [
	{ label: __( 'Vertical', 'blicks' ), value: 'vertical' },
	{ label: __( 'Horizontal', 'blicks' ), value: 'horizontal' },
];

const GAP_OPTIONS = [
	{ label: __( 'None', 'blicks' ), value: 'none' },
	{ label: __( 'XS', 'blicks' ), value: 'xs' },
	{ label: __( 'SM', 'blicks' ), value: 'sm' },
	{ label: __( 'MD', 'blicks' ), value: 'md' },
	{ label: __( 'LG', 'blicks' ), value: 'lg' },
];

const ALIGN_OPTIONS = [
	{ label: __( 'Start', 'blicks' ), value: 'flex-start' },
	{ label: __( 'Center', 'blicks' ), value: 'center' },
	{ label: __( 'End', 'blicks' ), value: 'flex-end' },
	{ label: __( 'Stretch', 'blicks' ), value: 'stretch' },
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

function directionForOrientation( orientation: string ): string {
	return orientation === 'horizontal' ? 'row' : 'column';
}

export function stackDirection( orientation: unknown ): string {
	return directionForOrientation( validOption( ORIENTATION_OPTIONS, orientation, 'vertical' ) );
}

export function stackGapValue( gap: unknown ): string {
	return gapValue( validOption( GAP_OPTIONS, gap, 'md' ) );
}

export function stackAlignValue( align: unknown ): string {
	return validOption( ALIGN_OPTIONS, align, 'stretch' );
}

export function stackJustifyValue( justify: unknown ): string {
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

function updateStackLayout(
	attributes: any,
	setAttributes: ( a: any ) => void,
	next: Partial< { orientation: string; gap: string; align: string; justify: string; wrap: boolean } >
) {
	const orientation = validOption( ORIENTATION_OPTIONS, next.orientation ?? attributes.orientation, 'vertical' );
	const gap = validOption( GAP_OPTIONS, next.gap ?? attributes.gap, 'md' );
	const align = validOption( ALIGN_OPTIONS, next.align ?? attributes.align, 'stretch' );
	const justify = validOption( JUSTIFY_OPTIONS, next.justify ?? attributes.justify, 'flex-start' );
	const wrap = Boolean( next.wrap ?? attributes.wrap );

	let blicks = { ...( attributes.blicks ?? {} ) };
	blicks = writeBaseValue( blicks, 'layout.flexDirection', directionForOrientation( orientation ) );
	blicks = writeBaseValue( blicks, 'layout.gapRow', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.gapColumn', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.alignItems', align );
	blicks = writeBaseValue( blicks, 'layout.justifyContent', justify );
	blicks = writeBaseValue( blicks, 'layout.flexWrap', wrap ? 'wrap' : 'nowrap' );

	setAttributes( { ...next, orientation, gap, align, justify, wrap, blicks } );
}

export function setStackOrientation(
	attributes: any,
	setAttributes: ( a: any ) => void,
	orientation: string
) {
	updateStackLayout( attributes, setAttributes, { orientation } );
}

export function StackControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const orientation = validOption( ORIENTATION_OPTIONS, attributes.orientation, 'vertical' );
	const gap = validOption( GAP_OPTIONS, attributes.gap, 'md' );
	const align = validOption( ALIGN_OPTIONS, attributes.align, 'stretch' );
	const justify = validOption( JUSTIFY_OPTIONS, attributes.justify, 'flex-start' );
	const wrap = attributes.wrap ? 'wrap' : 'nowrap';
	const help = useBlockHelp( 'stack' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Auto Layout', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'Direction', 'blicks' ) }
					help={ controlHelp.orientation }
					value={ orientation }
					options={ ORIENTATION_OPTIONS }
					onChange={ ( next ) => updateStackLayout( attributes, setAttributes, { orientation: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Gap', 'blicks' ) }
					help={ controlHelp.gap }
					value={ gap }
					options={ GAP_OPTIONS }
					onChange={ ( next ) => updateStackLayout( attributes, setAttributes, { gap: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Align', 'blicks' ) }
					help={ controlHelp.align }
					value={ align }
					options={ ALIGN_OPTIONS }
					onChange={ ( next ) => updateStackLayout( attributes, setAttributes, { align: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Distribute', 'blicks' ) }
					help={ controlHelp.justify }
					value={ justify }
					options={ JUSTIFY_OPTIONS }
					onChange={ ( next ) => updateStackLayout( attributes, setAttributes, { justify: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Wrapping', 'blicks' ) }
					help={ controlHelp.wrap }
					value={ wrap }
					options={ WRAP_OPTIONS }
					onChange={ ( next ) => updateStackLayout( attributes, setAttributes, { wrap: next === 'wrap' } ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Element', 'blicks' ) }>
				<OptionCards
					label={ __( 'HTML tag', 'blicks' ) }
					help={ controlHelp.tag }
					value={ attributes.tag || 'div' }
					options={ TAG_OPTIONS }
					columns={ 2 }
					onChange={ ( tag ) => setAttributes( { tag } ) }
				/>
			</SettingsCard>
		</>
	);
}
