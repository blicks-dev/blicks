import { useMemo, useState } from '@wordpress/element';
import { ColorPicker, Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FillControl } from '@/controls/fill/FillControl';
import { BACKGROUND_SLOTS, TEXT_FILL_SLOTS } from '@/controls/fill/types';
import { useCloseOnOutsideClick } from '@/controls/common';
import { resolveTokenValues, tokenOptions } from '@/controls/token-utils';
import { useThemePalette, matchPalette, paletteStoreValue, isThemeColorValue } from './palette';
import { gradientCss } from './gradient-css';
import { hex8ToValue, pickerColorOf } from './color-value';
import './color.scss';

export { gradientCss };
export { parseHex, toRgba, hex8ToValue } from './color-value';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	/** `background` (default) = the block's background. `textFill` = the same color/gradient/image
	 *  editor, but the fill is clipped to the text (gradient/image text) — `colors.clipText` is
	 *  managed automatically, so the manual clip checkbox is hidden and the label reads "Font color". */
	variant?: 'background' | 'textFill';
	/** Override the field label (defaults per variant). */
	label?: string;
	/**
	 * Where a *solid* colour is stored. Defaults to `colors.background` (painted as a background,
	 * hence clipped to the glyphs in the `textFill` variant). Typography passes `colors.text` so a
	 * plain font colour stays a plain `color:` declaration — no background layer, no clip. Gradients
	 * and images always live in `background.*` regardless, since only a background can carry them.
	 */
	solidAttr?: string;
}

/**
 * The full color-token library, straight from the shared catalogue. `color` is a
 * plain var() reference — the runtime stylesheet's inline `:root` aliases resolve
 * it in both the editor page and the canvas iframe.
 */
export const THEME_COLORS = tokenOptions( 'color' ).map( option => ( {
	name: option.label,
	slug: option.slug,
	color: option.css,
} ) );

export function ColorPopover( {
	value,
	onChange,
	anchor,
	onClose,
}: {
	value: string;
	onChange: ( v: string ) => void;
	anchor?: Element | null;
	onClose?: () => void;
} ) {
	const palette = useThemePalette();
	const [ tab, setTab ] = useState< 'theme' | 'custom' >(
		isThemeColorValue( value ) ? 'theme' : 'custom'
	);
	useCloseOnOutsideClick( true, () => onClose?.(), anchor ?? null );
	// Concrete values for tooltips/swatches, read once per popover open.
	const resolvedColors = useMemo( () => resolveTokenValues( 'color' ), [] );

	const isCustom = ! isThemeColorValue( value );
	const selectedSlug = matchPalette( value, palette )?.slug;
	// A theme colour has no position on the wheel, so the picker opens on the default instead.
	const initialColor = pickerColorOf( isCustom ? value : '' );

	return (
		<Popover
			anchor={ anchor }
			placement="left-start"
			offset={ 12 }
			flip
			resize
			noArrow
			focusOnMount={ false }
			onClose={ onClose }
			className="bl-floating-popover bl-ins"
			variant="unstyled"
		>
		<div className="bl-color-popover">
			<div className="pop-tabs">
				<button
					type="button"
					className={ `pop-tab ${ tab === 'theme' ? 'is-active' : '' }` }
					onClick={ () => setTab( 'theme' ) }
				>
					{ __( 'Theme', 'blicks' ) }
				</button>
				<button
					type="button"
					className={ `pop-tab ${ tab === 'custom' ? 'is-active' : '' }` }
					onClick={ () => setTab( 'custom' ) }
				>
					{ __( 'Custom', 'blicks' ) }
				</button>
			</div>

			{ tab === 'theme' && (
				<div className="token-grid">
					{ palette.map( ( c ) => (
						<button
							type="button"
							key={ c.slug }
							className={ `token ${ selectedSlug === c.slug ? 'is-selected' : '' }` }
							style={ { background: resolvedColors[ c.slug ] || c.color } }
							title={ resolvedColors[ c.slug ] ? `${ c.name } · ${ resolvedColors[ c.slug ] }` : c.name }
							onClick={ () => onChange( paletteStoreValue( c.slug ) ) }
						/>
					) ) }
				</div>
			) }

			{ tab === 'custom' && (
				<ColorPicker
					color={ initialColor }
					enableAlpha
					onChange={ ( nextColor: string ) => onChange( hex8ToValue( nextColor ) ) }
				/>
			) }
		</div>
		</Popover>
	);
}

export function ColorControl( {
	attributes,
	setAttributes,
	state,
	breakpoint,
	variant = 'background',
	label: labelProp,
	solidAttr,
}: Props ) {
	const isTextFill = variant === 'textFill';
	const slots = isTextFill ? TEXT_FILL_SLOTS : BACKGROUND_SLOTS;

	return (
		<FillControl
			attributes={ attributes }
			setAttributes={ setAttributes }
			state={ state }
			breakpoint={ breakpoint }
			slots={ solidAttr ? { ...slots, color: solidAttr } : slots }
			layout="popover"
			label={ labelProp ?? ( isTextFill ? __( 'Font colour', 'blicks' ) : __( 'Background', 'blicks' ) ) }
			clipToText={ isTextFill }
		/>
	);
}
