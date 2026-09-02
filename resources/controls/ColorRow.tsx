import { useMemo, useState } from '@wordpress/element';
import { ColorPicker, Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ResetButton, announcePopoverOpen, useCloseOnOtherPopover } from '@/controls/common';
import { matchPalette, paletteStoreValue, useThemePalette } from '@/controls/color/palette';
import { hex8ToValue, pickerColorOf } from '@/controls/color/color-value';
import { resolveTokenValues } from '@/controls/token-utils';
import './value-field.scss';
import '@/controls/color/color.scss';

interface Props {
	/** Spelled-out name of the property, for the swatch's tooltip and its accessible name. */
	hint?: string;
	/** A palette slug, a `var()` reference, or a raw CSS colour. */
	value: string;
	onChange: ( value: string ) => void;
}

const CARET = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
		<path d="m6 9 6 6 6-6" />
	</svg>
);

/**
 * A colour as one row of the field frame: a round swatch, a caret, the colour's name, and a reset.
 *
 * The two ways of choosing a colour are two separate affordances rather than two tabs behind one
 * trigger. A theme colour and an arbitrary colour are not variations of one act — one is picking
 * from the design system, the other is leaving it — so the swatch opens the wheel and the caret
 * opens the palette, and neither hides the other behind a tab you have to find first.
 *
 * The swatch also stands in for the caption every other row carries. Every caller of this component
 * labels it "COLOR", so the word was spending a fifth of a 215px row restating what a colour swatch
 * already says; the per-property distinction (border colour vs shadow colour) lives in `hint`, on
 * the tooltip, where it is available without being permanently in the way.
 */
export function ColorRow( { hint, value, onChange }: Props ) {
	const [ open, setOpen ] = useState< null | 'picker' | 'list' >( null );
	const [ anchor, setAnchor ] = useState< Element | null >( null );
	const [ popoverId ] = useState( () => `bl-colorrow-${ Math.random().toString( 36 ).slice( 2 ) }` );
	useCloseOnOtherPopover( popoverId, () => setOpen( null ) );

	const palette = useThemePalette();
	// Concrete values behind the token slugs, so a swatch shows the colour rather than a var() name
	// the sidebar document cannot resolve. Read once — the palette is static per editor load.
	const resolved = useMemo( () => resolveTokenValues( 'color' ), [] );

	const entry = matchPalette( value, palette );
	// No theme colours to offer means no caret. A disclosure that opens onto nothing is a worse
	// answer than not offering one — the swatch still reaches every colour there is.
	const hasPalette = palette.length > 0;
	const colorOf = ( slug: string, fallback: string ) => resolved[ slug ] || fallback;
	const swatch = entry ? colorOf( entry.slug, entry.color ) : ( value || 'transparent' );
	const name = entry ? entry.name : ( value || __( 'Not set', 'blicks' ) );
	const label = hint ?? __( 'Colour', 'blicks' );

	const show = ( which: 'picker' | 'list' ) => {
		setOpen( ( current ) => {
			const next = current === which ? null : which;
			if ( next ) announcePopoverOpen( popoverId );
			return next;
		} );
	};

	return (
		<div
			className={ `bl-valuefield bl-valuefield--color ${ value ? 'is-set' : '' }` }
			ref={ ( node ) => setAnchor( node ) }
		>
			<button
				type="button"
				className={ `bl-colorrow__swatch ${ swatch === 'transparent' ? 'is-transparent' : '' }` }
				style={ { background: swatch } }
				title={ label }
				aria-label={ label }
				aria-haspopup="dialog"
				aria-expanded={ open === 'picker' }
				onClick={ () => show( 'picker' ) }
			/>
			{ hasPalette && (
				<button
					type="button"
					className={ `bl-colorrow__caret ${ open === 'list' ? 'is-open' : '' }` }
					title={ __( 'Theme colours', 'blicks' ) }
					aria-label={ __( 'Theme colours', 'blicks' ) }
					aria-haspopup="listbox"
					aria-expanded={ open === 'list' }
					onClick={ () => show( 'list' ) }
				>
					{ CARET }
				</button>
			) }
			{ /* The name opens whichever chooser the row actually has: the palette when there is one,
			     the wheel when there is not. A field's value is the thing people click to change it,
			     so it must never be the one part of the row that does nothing. */ }
			<button
				type="button"
				className="bl-colorrow__name"
				onClick={ () => show( hasPalette ? 'list' : 'picker' ) }
			>
				{ name }
			</button>
			<ResetButton idle={ ! value } onClick={ () => onChange( '' ) } />

			{ open === 'picker' && (
				<Popover
					anchor={ anchor }
					placement="left-start"
					offset={ 12 }
					flip
					resize
					noArrow
					focusOnMount={ false }
					onClose={ () => setOpen( null ) }
					className="bl-floating-popover bl-ins"
					variant="unstyled"
				>
					<div className="bl-color-picker-panel">
						<ColorPicker
							// A palette slug has no position on a colour wheel, so the picker opens on
							// the default rather than on a swatch that misrepresents where you are.
							color={ pickerColorOf( entry ? '' : value ) }
							enableAlpha
							onChange={ ( next: string ) => onChange( hex8ToValue( next ) ) }
						/>
					</div>
				</Popover>
			) }

			{ open === 'list' && palette.length > 0 && (
				<Popover
					anchor={ anchor }
					placement="bottom-start"
					offset={ 4 }
					flip
					resize
					noArrow
					focusOnMount={ false }
					onClose={ () => setOpen( null ) }
					className="bl-floating-popover bl-ins"
					variant="unstyled"
				>
					<div className="bl-combobox__panel">
						<div className="bl-combobox__list-title">{ __( 'THEME COLOURS', 'blicks' ) }</div>
						<ul className="bl-colorlist" role="listbox">
							{ palette.map( ( color ) => {
								const swatchColor = colorOf( color.slug, color.color );
								return (
									<li key={ color.slug }>
										<button
											type="button"
											role="option"
											aria-selected={ entry?.slug === color.slug }
											className={ `bl-colorlist__option ${ entry?.slug === color.slug ? 'is-active' : '' }` }
											title={ swatchColor ? `${ color.name } · ${ swatchColor }` : color.name }
											onClick={ () => {
												onChange( paletteStoreValue( color.slug ) );
												setOpen( null );
											} }
										>
											<span className="bl-colorlist__swatch" style={ { background: swatchColor } } />
											<span className="bl-colorlist__name">{ color.name }</span>
										</button>
									</li>
								);
							} ) }
						</ul>
					</div>
				</Popover>
			) }
		</div>
	);
}
