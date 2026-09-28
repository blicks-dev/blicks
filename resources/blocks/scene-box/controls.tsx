import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { FieldRow, SettingsCard, SegmentedSetting, type Option } from '@/blocks/shared/settings-ui';
import { getValue, setValueSlots } from '@/framework/values';
import { fits, frameOf, sceneOf, siblingFrames } from './occupancy';

/**
 * A grid coordinate is a whole number of cells. It is the numerator of a percentage, so a
 * fractional or negative value would put the box somewhere the grid cannot describe.
 */
export function cleanCell( value: unknown, fallback: number, max = Infinity ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 0 && n <= max ? n : fallback;
}

export function cleanSpan( value: unknown, fallback: number, max = Infinity ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 1 && n <= max ? n : fallback;
}

export function SceneBoxControls( {
	attributes,
	setAttributes,
	clientId,
	cols = 16,
	rows = 16,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
	clientId?: string;
	cols?: number;
	rows?: number;
} ) {
	const col = cleanCell( attributes.col, 0, cols - 1 );
	const row = cleanCell( attributes.row, 0, rows - 1 );
	const colSpan = cleanSpan( attributes.colSpan, 4, cols );
	const rowSpan = cleanSpan( attributes.rowSpan, 4, rows );

	const [ refused, setRefused ] = useState( false );

	/**
	 * Boxes may not overlap, so a typed value is checked the same way a dragged one is. A refusal
	 * leaves the field where it was and says why — silently reverting a number someone just typed
	 * reads as a broken input.
	 */
	const apply = ( change: Partial< Record< 'col' | 'row' | 'colSpan' | 'rowSpan', number > > ) => {
		const next = { ...frameOf( attributes ), ...change };
		if ( ! fits( next, siblingFrames( sceneOf( clientId ), clientId ) ) ) {
			setRefused( true );
			return;
		}
		setRefused( false );
		setAttributes( change );
	};

	const num = ( value: number, min: number, max: number, onChange: ( n: number ) => void ) => (
		<input
			type="number"
			min={ min }
			max={ max }
			step={ 1 }
			value={ value }
			onChange={ ( event ) => onChange( Number( event.currentTarget.value ) ) }
		/>
	);

	return (
		<SettingsCard
			title={ __( 'Grid placement', 'blicks' ) }
			help={ __( 'Where this box sits on the scene grid, in cells. Everything inside it is positioned relative to the box.', 'blicks' ) }
		>
			<FieldRow label={ __( 'Column', 'blicks' ) }>
				{ num( col, 0, cols - 1, ( n ) => apply( { col: cleanCell( n, col, cols - 1 ) } ) ) }
			</FieldRow>
			<FieldRow label={ __( 'Row', 'blicks' ) }>
				{ num( row, 0, rows - 1, ( n ) => apply( { row: cleanCell( n, row, rows - 1 ) } ) ) }
			</FieldRow>
			<FieldRow label={ __( 'Width in cells', 'blicks' ) }>
				{ num( colSpan, 1, cols, ( n ) => apply( { colSpan: cleanSpan( n, colSpan, cols ) } ) ) }
			</FieldRow>
			<FieldRow label={ __( 'Height in cells', 'blicks' ) }>
				{ num( rowSpan, 1, rows, ( n ) => apply( { rowSpan: cleanSpan( n, rowSpan, rows ) } ) ) }
			</FieldRow>
			{ refused && (
				<p className="bl-setting__note">
					{ __( 'That would overlap another box. Boxes each own their own cells.', 'blicks' ) }
				</p>
			) }
		</SettingsCard>
	);
}


/**
 * Entrances, at the BOX level.
 *
 * PaneFlow splits motion in two: a group gets an Enter and an Exit, and individual elements get
 * the full animation controls. The same split makes sense here — the composition arrives as a
 * unit, and fiddling with timelines and fill modes per item to achieve that is the wrong level
 * of detail.
 *
 * So this writes ordinary `animation.*` values rather than inventing a parallel system. An author
 * who wants more can open the Animation facet and find exactly what this set.
 */
const ENTER_OPTIONS: Option[] = [
	{ label: __( 'None', 'blicks' ), value: '' },
	{ label: __( 'Fade', 'blicks' ), value: 'bl-fade-in' },
	{ label: __( 'Up', 'blicks' ), value: 'bl-slide-up' },
	{ label: __( 'Down', 'blicks' ), value: 'bl-slide-down' },
	{ label: __( 'Left', 'blicks' ), value: 'bl-slide-left' },
	{ label: __( 'Right', 'blicks' ), value: 'bl-slide-right' },
	{ label: __( 'Zoom', 'blicks' ), value: 'bl-zoom-in' },
];

/**
 * A view timeline means the entrance plays as the box scrolls into frame rather than on page load
 * — which is what a "box enters" almost always means on a long page. `both` fill keeps the box at
 * the keyframe's start state before it enters, so nothing flashes at full opacity first.
 */
function enterWrites( name: string ) {
	const on = Boolean( name );
	return [
		{ controlId: 'animation.name', state: 'default', breakpoint: 'base', value: name || undefined },
		{ controlId: 'animation.timeline', state: 'default', breakpoint: 'base', value: on ? 'view()' : undefined },
		{ controlId: 'animation.range', state: 'default', breakpoint: 'base', value: on ? 'entry 0% cover 35%' : undefined },
		{ controlId: 'animation.fillMode', state: 'default', breakpoint: 'base', value: on ? 'both' : undefined },
	];
}

export function SceneBoxEnter( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const current = String( getValue( attributes, 'animation.name', 'default', 'base' ) ?? '' );
	const known = ENTER_OPTIONS.some( ( option ) => option.value === current );

	return (
		<SettingsCard
			title={ __( 'Enter', 'blicks' ) }
			help={ __( 'How this box arrives as it scrolls into view. Individual items can still animate on their own.', 'blicks' ) }
		>
			<SegmentedSetting
				label={ __( 'Enter from', 'blicks' ) }
				value={ known ? current : '' }
				options={ ENTER_OPTIONS }
				onChange={ ( value ) => setValueSlots( attributes, setAttributes, enterWrites( value ) ) }
			/>
			{ ! known && current && (
				<p className="bl-setting__note">
					{ __( 'This box uses a custom animation, set in the Animation panel.', 'blicks' ) }
				</p>
			) }
		</SettingsCard>
	);
}
