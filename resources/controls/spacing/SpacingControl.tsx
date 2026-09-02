import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import {
	LENGTH_PATTERN,
	LENGTH_SUGGESTIONS,
	NoMatches,
	ResetButton,
	clearSlots,
	makeMatcher,
	validateOrEmpty,
} from '@/controls/common';
import { lengthOrTokenPattern } from '@/controls/token-utils';
import { tokenComboboxOptions } from '@/controls/TokenCombobox';
import { ValueField } from '@/controls/ValueField';
import './spacing.scss';

// Lengths plus spacing-token slugs (`md`, `2xl`, …) — the engine resolves slugs
// to `var(--blicks-spacing-*)` via `valOrToken`.
const SPACING_PATTERN = lengthOrTokenPattern( 'spacing', LENGTH_PATTERN );

// The field's own dropdown IS the spacing library: literals first, then every token slug with its
// resolved px. That is why the groups no longer carry a separate library trigger.
const SPACING_OPTIONS = tokenComboboxOptions( 'spacing', LENGTH_SUGGESTIONS );

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

type Side = 'top' | 'right' | 'bottom' | 'left';

const SIDES: Side[] = [ 'top', 'right', 'bottom', 'left' ];

/** True when every side holds the same value — the only state where linking is lossless. */
function sidesAreUniform( current: Record< string, string > ): boolean {
	return new Set( SIDES.map( ( side ) => current[ side ] ?? '' ) ).size <= 1;
}

const SIDE_LABEL: Record< Side, string > = {
	top: __( 'top', 'blicks' ),
	right: __( 'right', 'blicks' ),
	bottom: __( 'bottom', 'blicks' ),
	left: __( 'left', 'blicks' ),
};

const LINK_ICON = (
	<svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
		<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
		<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
	</svg>
);

const GROUPS: { id: string; label: string; core: string }[] = [
	{ id: 'spacing.margin', label: __( 'Margin', 'blicks' ), core: 'MARGIN' },
	{ id: 'spacing.padding', label: __( 'Padding', 'blicks' ), core: 'PADDING' },
];

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two
 * can never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 */
const K = {
	margin: [ 'margin', 'space', 'outer', 'top', 'right', 'bottom', 'left' ],
	padding: [ 'padding', 'space', 'inner', 'inset', 'top', 'right', 'bottom', 'left' ],
};

export const SPACING_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * Spacing control — margin and padding, the two properties of the box itself.
 *
 * Margin and padding are **crosses**: four value fields ringing a centre tag, laid out where the
 * side they write actually is. The cross is why the fields carry no caption — position already
 * says `top`, and a `T` inside a ~68px cell would take a fifth of the room the value needs. Screen
 * readers get the side through `ariaLabel`, since position is exactly what they cannot see.
 *
 * Each cell is the same `ValueField` the rest of the inspector uses, so a spacing value is picked
 * the way every other value is: type a length, or take a token from the dropdown, which lists the
 * whole spacing scale with its resolved px.
 *
 * **Gap is not here.** It reads like spacing, but it only exists once a display mode has been
 * chosen and it means different things under flex and grid — so it belongs with that choice, under
 * Display in the Layout facet, not beside padding where it spent half its life inert behind an
 * empty state.
 */
export function SpacingControl( { attributes, setAttributes, state, breakpoint, query }: Props ) {
	const m = makeMatcher( query );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );

	const values: Record< string, Record< string, string > > = {
		'spacing.margin': getValue( attributes, 'spacing.margin', state, breakpoint ) || {},
		'spacing.padding': getValue( attributes, 'spacing.padding', state, breakpoint ) || {},
	};

	// Linked is the right default for an untouched value, but never for one whose sides already
	// disagree: the control would open linked over `8px 16px` and the first edit to any side would
	// silently flatten the other three. Derive it, and re-derive when the scope being edited
	// changes (a different state or breakpoint is a different set of four sides).
	const scope = `${ state }|${ breakpoint }`;
	const derivedLink = () => ( {
		'spacing.margin': sidesAreUniform( values[ 'spacing.margin' ] ),
		'spacing.padding': sidesAreUniform( values[ 'spacing.padding' ] ),
	} );
	const [ link, setLink ] = useState< Record< string, boolean > >( derivedLink );
	const [ linkScope, setLinkScope ] = useState( scope );

	if ( linkScope !== scope ) {
		setLinkScope( scope );
		setLink( derivedLink() );
	}

	const write = (
		controlId: string,
		current: Record< string, string >,
		side: Side,
		value: string
	) => {
		const next = link[ controlId ]
			? { top: value, right: value, bottom: value, left: value }
			: { ...current, [ side ]: value };
		setValue( attributes, setAttributes, controlId, state, breakpoint, next );
	};

	const cell = (
		controlId: string,
		label: string,
		current: Record< string, string >,
		side: Side
	) => (
		<div key={ side } className={ `bl-cross__cell b-${ side }` }>
			<ValueField
				value={ current[ side ] ?? '' }
				ariaLabel={ `${ label } ${ SIDE_LABEL[ side ] }` }
				options={ SPACING_OPTIONS }
				placeholder="0"
				listLabel="SPACING LIBRARY"
				modified={ Boolean( current[ side ] ) }
				onChange={ ( next ) => write( controlId, current, side, next ) }
				onCommit={ ( raw ) => write( controlId, current, side, validateOrEmpty( raw, SPACING_PATTERN ) ) }
			/>
		</div>
	);

	return (
		<div className="bl-spacing-control">
			{ ! anyMatch && <NoMatches query={ query ?? '' } /> }

			{ GROUPS.map( ( { id, label, core } ) => {
				const current = values[ id ];
				const key = id === 'spacing.margin' ? K.margin : K.padding;
				if ( ! m( key ) ) return null;
				const isSet = Object.values( current ).some( ( v ) => v !== undefined && v !== '' );
				return (
					<div key={ id } className="bl-spacing-group">
						<div className="bl-spacing-head">
							<span>{ label }</span>
							{ isSet && <span className="bl-mod-dot" aria-hidden="true" /> }
							<div className="bl-spacing-actions">
								<ResetButton
									idle={ ! isSet }
									onClick={ () => clearSlots( attributes, setAttributes, [ id ], state, breakpoint ) }
								/>
								<button
									type="button"
									className={ `bl-spacing-link ${ link[ id ] ? 'on' : '' }` }
									aria-pressed={ link[ id ] }
									aria-label={ `${ label } — ${ __( 'link all sides', 'blicks' ) }` }
									title={ __( 'Link all sides', 'blicks' ) }
									onClick={ () => setLink( ( v ) => ( { ...v, [ id ]: ! v[ id ] } ) ) }
								>
									{ LINK_ICON }
								</button>
							</div>
						</div>

						<div className="bl-cross">
							{ cell( id, label, current, 'top' ) }
							{ cell( id, label, current, 'left' ) }
							<span className="bl-cross__core">{ core }</span>
							{ cell( id, label, current, 'right' ) }
							{ cell( id, label, current, 'bottom' ) }
						</div>
					</div>
				);
			} ) }
		</div>
	);
}
