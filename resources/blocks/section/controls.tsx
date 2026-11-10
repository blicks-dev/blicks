import { useEffect, useState } from 'react';
import { ToolbarGroup } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Chips, Row, SegText, Sec, Steps, type Option } from '@/framework/inspector-v2/kit';
import { SECTION_DEFAULTS, SPACES, SURFACES, cleanSectionDimension, cleanSectionSpace, cleanSectionSurface, isSectionDimension } from './model';

/** `align`: the band runs edge to edge, or sits in the content column like any block. */
const ALIGNS: Option[] = [
	[ 'full', __( 'Edge to edge', 'blicks' ) ],
	[ '', __( 'In the column', 'blicks' ) ],
];

const SECTION_WIDTHS: Option[] = [
	[ 'auto', __( 'Auto', 'blicks' ) ],
	[ '100%', __( 'Full', 'blicks' ) ],
	[ '100vw', __( 'Screen', 'blicks' ) ],
	[ 'fit-content', __( 'Fit content', 'blicks' ) ],
];

export const SECTION_HEIGHTS: Option[] = [
	[ 'auto', __( 'Fit', 'blicks' ) ],
	[ '50vh', __( 'Half screen', 'blicks' ) ],
	[ '80vh', __( 'Most of the screen', 'blicks' ) ],
	[ '100svh', __( 'Full screen', 'blicks' ) ],
];

const CONTENT_MAX_WIDTHS: Option[] = [
	[ SECTION_DEFAULTS.contentMaxWidth, __( 'Theme', 'blicks' ) ],
	[ '640px', __( 'Narrow', 'blicks' ) ],
	[ '768px', __( 'Medium', 'blicks' ) ],
	[ '1024px', __( 'Wide', 'blicks' ) ],
	[ '1280px', __( 'Extra wide', 'blicks' ) ],
	[ 'none', __( 'No limit', 'blicks' ) ],
];

/**
 * A typed size, as its own row. Unlike the kit's `Exact` it takes everything the section
 * attributes take — keywords, `calc()`, `var()` — and shows the value whenever no choice matches it.
 */
function Size( { value, isChoice, label, placeholder, row = __( 'Exact', 'blicks' ), onChange }: {
	value: string;
	isChoice: boolean;
	label: string;
	placeholder: string;
	/** The row's own label: "Exact" under a set of choices, or the setting's name on its own. */
	row?: string;
	onChange: ( v: string ) => void;
} ) {
	const shown = isChoice ? '' : value;
	const [ draft, setDraft ] = useState( shown );
	const [ invalid, setInvalid ] = useState( false );
	useEffect( () => setDraft( shown ), [ shown ] );
	const commit = () => {
		if ( draft.trim() === '' || draft === shown ) return setInvalid( false );
		const ok = isSectionDimension( draft );
		setInvalid( ! ok );
		if ( ok ) onChange( cleanSectionDimension( draft, placeholder ) );
	};
	return (
		<Row label={ row } set={ ! isChoice && !! value && value !== placeholder } note={ invalid ? __( 'Use a size like 640px, 80vh, 100% or auto', 'blicks' ) : undefined } noteIcon={ invalid ? 'warning' : undefined }>
			<label className={ `bui-fld${ invalid ? ' invalid' : '' }` }>
				<input
					value={ draft }
					placeholder={ placeholder }
					aria-label={ label }
					aria-invalid={ invalid }
					spellCheck={ false }
					onChange={ ( e ) => setDraft( e.currentTarget.value ) }
					onBlur={ commit }
					onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) { e.preventDefault(); commit(); } } }
				/>
			</label>
		</Row>
	);
}

const named = ( list: Option[], v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ];

/** A row of choices with a typed size under it, for one dimension attribute. */
function SizeChoice( { title, hint, note, options, value, label, fallback, onChange }: {
	title: string;
	hint?: string;
	note?: string;
	options: Option[];
	value: string;
	label: string;
	fallback: string;
	onChange: ( v: string ) => void;
} ) {
	const isChoice = options.some( ( [ v ] ) => v === value );
	return (
		<>
			<Row label={ title } stack set={ value !== fallback } hint={ hint } note={ note } noteIcon="info">
				<Chips label={ label } options={ options } value={ isChoice ? value : null } onChange={ onChange } />
			</Row>
			<Size value={ value } isChoice={ isChoice } label={ label } placeholder={ fallback } onChange={ onChange } />
		</>
	);
}

/** The Section's Settings tab: how the band sits on the page and how wide its content runs. */
export function SectionSettings( { attributes, setAttributes }: PanelProps ) {
	const dim = ( key: 'sectionWidth' | 'sectionHeight' | 'contentWidth' | 'contentMinWidth' | 'contentMaxWidth' ) =>
		cleanSectionDimension( attributes[ key ], SECTION_DEFAULTS[ key ] );
	const align = attributes.align === undefined ? SECTION_DEFAULTS.align : String( attributes.align || '' );
	const width = dim( 'sectionWidth' );
	const height = dim( 'sectionHeight' );
	const contentWidth = dim( 'contentWidth' );
	const contentMin = dim( 'contentMinWidth' );
	const contentMax = dim( 'contentMaxWidth' );
	const surface = cleanSectionSurface( attributes.surface );
	const space = cleanSectionSpace( attributes.sectionSpace );

	return (
		<>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ named( SURFACES, surface ) }>
				<Row label={ __( 'Band', 'blicks' ) } stack set={ align !== SECTION_DEFAULTS.align }>
					<SegText label={ __( 'Band', 'blicks' ) } options={ ALIGNS } value={ align === 'full' ? 'full' : '' } onChange={ ( a ) => setAttributes( { align: a } ) } />
				</Row>
				<Row label={ __( 'Surface', 'blicks' ) } stack set={ surface !== SECTION_DEFAULTS.surface }>
					<SegText label={ __( 'Surface', 'blicks' ) } options={ SURFACES } value={ surface } onChange={ ( v ) => setAttributes( { surface: v } ) } />
				</Row>
			</Sec>

			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ named( SPACES, space ) }>
				<Row label={ __( 'Space above and below', 'blicks' ) } stack set={ space !== SECTION_DEFAULTS.sectionSpace } hint="padding-block">
					<Steps label={ __( 'Space above and below', 'blicks' ) } options={ SPACES } value={ space } onChange={ ( v ) => setAttributes( { sectionSpace: v } ) } />
				</Row>
			</Sec>

			<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio" value={ named( SECTION_HEIGHTS, height ) ?? height }>
				<SizeChoice title={ __( 'Width', 'blicks' ) } hint="width" options={ SECTION_WIDTHS } value={ width } label={ __( 'Exact section width', 'blicks' ) } fallback={ SECTION_DEFAULTS.sectionWidth } onChange={ ( sectionWidth ) => setAttributes( { sectionWidth } ) } />
				<SizeChoice
					title={ __( 'Height', 'blicks' ) }
					hint="min-height"
					note={ __( 'At least this tall. Content taller than this still shows in full.', 'blicks' ) }
					options={ SECTION_HEIGHTS }
					value={ height }
					label={ __( 'Exact section height, at least', 'blicks' ) }
					fallback={ SECTION_DEFAULTS.sectionHeight }
					onChange={ ( sectionHeight ) => setAttributes( { sectionHeight } ) }
				/>
			</Sec>

			<Sec title={ __( 'Content width', 'blicks' ) } icon="width" value={ named( CONTENT_MAX_WIDTHS, contentMax ) ?? contentMax }>
				<SizeChoice
					title={ __( 'At most', 'blicks' ) }
					hint="max-width"
					note={ __( '“Theme” follows the design system’s content size, then the WordPress theme’s.', 'blicks' ) }
					options={ CONTENT_MAX_WIDTHS }
					value={ contentMax }
					label={ __( 'Exact content width, at most', 'blicks' ) }
					fallback={ SECTION_DEFAULTS.contentMaxWidth }
					onChange={ ( contentMaxWidth ) => setAttributes( { contentMaxWidth } ) }
				/>
				<Size row={ __( 'Width', 'blicks' ) } value={ contentWidth } isChoice={ false } label={ __( 'Content width', 'blicks' ) } placeholder={ SECTION_DEFAULTS.contentWidth } onChange={ ( v ) => setAttributes( { contentWidth: v } ) } />
				<Size row={ __( 'At least', 'blicks' ) } value={ contentMin } isChoice={ false } label={ __( 'Content width, at least', 'blicks' ) } placeholder={ SECTION_DEFAULTS.contentMinWidth } onChange={ ( v ) => setAttributes( { contentMinWidth: v } ) } />
			</Sec>
		</>
	);
}

/** The Section's Style tab: the shared Style panel, as a Box draws it. */
export function SectionStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked={ false } />;
}

/** The Section's Motion tab: how the band arrives and reacts. A section is never a link. */
export function SectionMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="box" />;
}

/**
 * The Section's toolbar: Surface, Space and Height, the writes its Settings tab makes. Edge to
 * edge needs nothing here, as `supports.align` already puts it on the toolbar.
 */
export function SectionToolbar( { attributes, setAttributes }: PanelProps ) {
	return (
		<ToolbarGroup>
			<ToolbarChoice label={ __( 'Surface', 'blicks' ) } value={ cleanSectionSurface( attributes.surface ) } options={ SURFACES } onChange={ ( surface ) => setAttributes( { surface } ) } />
			<ToolbarChoice label={ __( 'Space above and below', 'blicks' ) } value={ cleanSectionSpace( attributes.sectionSpace ) } options={ SPACES } onChange={ ( sectionSpace ) => setAttributes( { sectionSpace } ) } />
			<ToolbarChoice label={ __( 'Height, at least', 'blicks' ) } value={ cleanSectionDimension( attributes.sectionHeight, SECTION_DEFAULTS.sectionHeight ) } options={ SECTION_HEIGHTS } onChange={ ( sectionHeight ) => setAttributes( { sectionHeight } ) } />
		</ToolbarGroup>
	);
}
