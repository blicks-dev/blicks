import { __ } from '@wordpress/i18n';
import { FieldRow, SegmentedSetting, SettingsCard, type Option } from '@/blocks/shared/settings-ui';

/**
 * Design presets. A scene is authored at ONE size and scaled everywhere else, so the choice here
 * is really "what shape is this band" rather than "how big is it" — the numbers only set the
 * coordinate space the items are placed in.
 */
const PRESETS: Option[] = [
	{ label: __( 'Wide', 'blicks' ), value: '1440x800', hint: '16:9' },
	{ label: __( 'Banner', 'blicks' ), value: '1440x520', hint: __( 'short', 'blicks' ) },
	{ label: __( 'Square', 'blicks' ), value: '1080x1080', hint: '1:1' },
	{ label: __( 'Custom', 'blicks' ), value: 'custom' },
];

const UPSCALE_OPTIONS: Option[] = [
	{ label: __( 'Cap at design width', 'blicks' ), value: 'cap', hint: __( 'default', 'blicks' ) },
	{ label: __( 'Fill', 'blicks' ), value: 'fill' },
];

/**
 * A design dimension is a plain positive integer — it is the denominator of the stage's scale
 * factor, so a zero or a unit string would take the whole composition out with it.
 */
export function cleanDesignSize( value: unknown, fallback: number ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 200 && n <= 10000 ? n : fallback;
}

/** The grid is the denominator of every box's position, so it must be a sane whole number. */
export function cleanGrid( value: unknown, fallback = 16 ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 2 && n <= 64 ? n : fallback;
}

function presetValue( width: number, height: number ): string {
	const key = `${ width }x${ height }`;
	return PRESETS.some( ( preset ) => preset.value === key ) ? key : 'custom';
}

export function SceneControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const width = cleanDesignSize( attributes.designWidth, 1440 );
	const height = cleanDesignSize( attributes.designHeight, 800 );
	const preset = presetValue( width, height );

	const applyPreset = ( value: string ) => {
		if ( value === 'custom' ) return;
		const [ w, h ] = value.split( 'x' ).map( Number );
		setAttributes( { designWidth: w, designHeight: h } );
	};

	return (
		<>
			<SettingsCard
				title={ __( 'Stage', 'blicks' ) }
				help={ __( 'Items are placed in these coordinates. The whole stage scales to fit, so the composition holds at every screen width.', 'blicks' ) }
			>
				<SegmentedSetting
					label={ __( 'Shape', 'blicks' ) }
					value={ preset }
					options={ PRESETS }
					onChange={ applyPreset }
				/>
				<FieldRow label={ __( 'Design width', 'blicks' ) }>
					<input
						type="number"
						min={ 200 }
						max={ 10000 }
						step={ 10 }
						value={ width }
						onChange={ ( event ) =>
							setAttributes( { designWidth: cleanDesignSize( event.currentTarget.value, width ) } )
						}
					/>
				</FieldRow>
				<FieldRow label={ __( 'Design height', 'blicks' ) }>
					<input
						type="number"
						min={ 200 }
						max={ 10000 }
						step={ 10 }
						value={ height }
						onChange={ ( event ) =>
							setAttributes( { designHeight: cleanDesignSize( event.currentTarget.value, height ) } )
						}
					/>
				</FieldRow>
			</SettingsCard>

			<SettingsCard title={ __( 'Scaling', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'Beyond design width', 'blicks' ) }
					help={ __( 'Fill keeps growing the stage on wide monitors. Cap stops it at its design size and centres it.', 'blicks' ) }
					value={ attributes.upscale === false ? 'cap' : 'fill' }
					options={ UPSCALE_OPTIONS }
					onChange={ ( value ) => setAttributes( { upscale: value !== 'cap' } ) }
				/>
			</SettingsCard>
		</>
	);
}
