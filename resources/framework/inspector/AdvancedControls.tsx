import { __ } from '@wordpress/i18n';
import { Button, Notice, ToggleControl } from '@wordpress/components';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';
import { SettingsCard } from '@/blocks/shared/settings-ui';
import { MoreSettings } from '@/controls/common';
import { isAttrNameInvalid } from '@/framework/sanitize';

interface HtmlAttr {
	name: string;
	value: string;
}

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	BlockAdvanced?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
}

/** ARIA fields are ordinary HTML attributes — they ride the existing `htmlAttributes` array
 *  rather than inventing parallel block attributes for the same output. */
const A11Y_FIELDS: { attr: string; label: string; placeholder: string }[] = [
	{ attr: 'role', label: __( 'Role', 'blicks' ), placeholder: 'region' },
	{ attr: 'aria-label', label: __( 'Label', 'blicks' ), placeholder: __( 'Accessible name', 'blicks' ) },
	{ attr: 'tabindex', label: __( 'Tab index', 'blicks' ), placeholder: '0' },
];

/**
 * The shared **Advanced** tab, shown for every block. Carries the capabilities native WordPress
 * doesn't offer (Visibility, Accessibility, Custom attributes) plus the whole-element reset.
 * Block-specific advanced controls render above via the optional `BlockAdvanced` slot.
 *
 * Custom CSS moved out to its own **CSS** tab; state×breakpoint styling (Effects, Motion,
 * Decoration, States) lives in the Style tab's facets.
 */
export function AdvancedControls( { attributes, setAttributes, BlockAdvanced }: Props ) {
	const visibility: Record< string, boolean > = attributes.visibility ?? {};
	const htmlAttributes: HtmlAttr[] = Array.isArray( attributes.htmlAttributes )
		? attributes.htmlAttributes
		: [];

	/** Read/write a single named attribute inside the shared `htmlAttributes` array. */
	const namedAttr = ( name: string ): string =>
		htmlAttributes.find( ( a ) => a.name === name )?.value ?? '';

	const setNamedAttr = ( name: string, value: string ) => {
		const rest = htmlAttributes.filter( ( a ) => a.name !== name );
		setAttributes( {
			htmlAttributes: value ? [ ...rest, { name, value } ] : rest,
		} );
	};

	const hasOverrides = Object.keys( attributes.blicks ?? {} ).length > 0;

	const resetAll = () => {
		const ok = typeof window === 'undefined' || window.confirm(
			__( 'Clear every style override on this block? This cannot be undone from here.', 'blicks' )
		);
		if ( ok ) setAttributes( { blicks: {} } );
	};

	const setHidden = ( bpId: string, hidden: boolean ) => {
		const next = { ...visibility };
		if ( hidden ) {
			next[ bpId ] = true;
		} else {
			delete next[ bpId ];
		}
		setAttributes( { visibility: next } );
	};

	const setAttr = ( index: number, patch: Partial< HtmlAttr > ) =>
		setAttributes( {
			htmlAttributes: htmlAttributes.map( ( a, i ) => ( i === index ? { ...a, ...patch } : a ) ),
		} );
	const addAttr = () =>
		setAttributes( { htmlAttributes: [ ...htmlAttributes, { name: '', value: '' } ] } );
	const removeAttr = ( index: number ) =>
		setAttributes( { htmlAttributes: htmlAttributes.filter( ( _, i ) => i !== index ) } );

	return (
		<>
			{ BlockAdvanced && (
				<BlockAdvanced attributes={ attributes } setAttributes={ setAttributes } />
			) }

			<SettingsCard
				title={ __( 'Visibility', 'blicks' ) }
				help={ __( 'Hide this block at chosen screen sizes (front end).', 'blicks' ) }
			>
				{ DEFAULT_BREAKPOINTS.map( ( bp ) => (
					<ToggleControl
						key={ bp.id }
						__nextHasNoMarginBottom
						label={ __( 'Hide on', 'blicks' ) + ' ' + bp.label }
						checked={ !! visibility[ bp.id ] }
						onChange={ ( hidden ) => setHidden( bp.id, hidden ) }
					/>
				) ) }
			</SettingsCard>

			<SettingsCard
				title={ __( 'Custom attributes', 'blicks' ) }
				help={ __( 'Extra data-*, aria-*, role, title, id, lang, or dir attributes on the block wrapper.', 'blicks' ) }
			>
				{ htmlAttributes.map( ( attr, index ) => (
					// Role / aria-label / tabindex have dedicated fields in Accessibility above —
					// rendering them here too would give one value two editors.
					A11Y_FIELDS.some( ( f ) => f.attr === attr.name ) ? null : (
					<div className="bl-attr-row" key={ index }>
						<input
							className={ `bl-attr-row__name ${ isAttrNameInvalid( attr.name ) ? 'is-invalid' : '' }` }
							value={ attr.name }
							placeholder="data-…"
							aria-invalid={ isAttrNameInvalid( attr.name ) }
							onChange={ ( e ) => setAttr( index, { name: e.currentTarget.value } ) }
						/>
						<input
							className="bl-attr-row__value"
							value={ attr.value }
							placeholder={ __( 'value', 'blicks' ) }
							onChange={ ( e ) => setAttr( index, { value: e.currentTarget.value } ) }
						/>
						<Button
							className="bl-attr-row__remove"
							icon="no-alt"
							label={ __( 'Remove attribute', 'blicks' ) }
							onClick={ () => removeAttr( index ) }
						/>
					</div>
					)
				) ) }
				<Button variant="secondary" onClick={ addAttr }>
					{ __( 'Add attribute', 'blicks' ) }
				</Button>
				{ htmlAttributes.some( ( a ) => isAttrNameInvalid( a.name ) ) && (
					<Notice status="warning" isDismissible={ false }>
						{ __( 'Only data-*, aria-*, role, title, id, lang, and dir are allowed. Invalid rows are dropped.', 'blicks' ) }
					</Notice>
				) }
			</SettingsCard>

			<SettingsCard
				title={ __( 'Accessibility', 'blicks' ) }
				help={ __( 'Only set these when the block needs a role or name the markup does not already convey.', 'blicks' ) }
			>
				<MoreSettings
					label={ __( 'Role and label', 'blicks' ) }
					defaultOpen={ A11Y_FIELDS.some( ( f ) => namedAttr( f.attr ) ) }
				>
					{ A11Y_FIELDS.map( ( f ) => (
						<div className="bl-attr-row bl-attr-row--named" key={ f.attr }>
							<span className="bl-attr-row__label">{ f.label }</span>
							<input
								className="bl-attr-row__value"
								value={ namedAttr( f.attr ) }
								placeholder={ f.placeholder }
								onChange={ ( e ) => setNamedAttr( f.attr, e.currentTarget.value ) }
							/>
						</div>
					) ) }
				</MoreSettings>
			</SettingsCard>

			<SettingsCard
				title={ __( 'Reset', 'blicks' ) }
				help={ __( 'Clears every style override on this block, across all states and breakpoints.', 'blicks' ) }
			>
				<Button variant="secondary" isDestructive disabled={ ! hasOverrides } onClick={ resetAll }>
					{ __( 'Reset all overrides on this element', 'blicks' ) }
				</Button>
			</SettingsCard>
		</>
	);
}
