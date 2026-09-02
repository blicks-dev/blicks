import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { ResetButton, announcePopoverOpen, useCloseOnOutsideClick } from '@/controls/common';
import { matchPalette, useThemePalette } from '@/controls/color/palette';
import { defaultGradient, gradientCss, gradientStops } from '@/controls/color/gradient-css';
import { FillEditor, gradientTokenLabel } from './FillEditor';
import { BACKGROUND_SLOTS, sourcesFor, type FillBinding, type FillSlots, type FillSource } from './types';
import './fill.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	/**
	 * Which `controlId` backs each part. Defaults to a block background. Pass `TEXT_FILL_SLOTS`
	 * for a font fill, or a hand-made map — `{ color: 'colors.border' }` is a perfectly good
	 * colour-only picker, and it needs no new variant here to be one.
	 */
	slots?: FillSlots;
	/** Narrow the offered sources further than the slots do. */
	sources?: FillSource[];
	/**
	 * `inline` renders the editor straight onto the panel — for a facet whose whole subject is the
	 * fill. `popover` renders one summary row that opens it — for a fill that is one setting among
	 * many, where an inline editor would bury the rest of the facet.
	 */
	layout?: 'inline' | 'popover';
	/**
	 * Names the fill. In the popover layout it is the row's name and is always needed. Inline it
	 * doubles as a section head, so it is left OFF when the fill is the facet's whole subject —
	 * the facet header already says "Background", and saying it twice is not a heading, it is a
	 * stutter.
	 */
	label?: string;
	/** Short caption on the popover trigger row, so it reads as a field like every row around it.
	 *  Defaults to `FILL`. */
	cap?: string;
	/**
	 * The fill IS the text: `clipText` is managed on the edge where a fill appears or is fully
	 * removed, and the manual clip toggle is hidden. Set for a font-colour picker.
	 */
	clipToText?: boolean;
	/** Property-search query from the Inspector — holds disclosures open while one is running. */
	query?: string;
	isAllowed?: ( controlId: string ) => boolean;
}

/**
 * A fill — colour, gradient or image — bound to the block's value tree.
 *
 * This is the layer that knows *where the value lives* and *how the picker is presented*; the
 * editing itself is `FillEditor`, which knows neither. So one picker covers every case the design
 * needs: the Background facet renders it inline with all three sources, Typography renders the
 * same editor in a popover, and a caller wanting only a colour passes a slot map with only a
 * colour in it and gets a plain colour row — no variant, no second component.
 */
export function FillControl( {
	attributes,
	setAttributes,
	state,
	breakpoint,
	slots = BACKGROUND_SLOTS,
	sources,
	layout = 'inline',
	label,
	cap = 'FILL',
	clipToText,
	query,
	isAllowed,
}: Props ) {
	const palette = useThemePalette();
	const searching = Boolean( query && query.trim() );

	// A slot the block's manifest has switched off is a slot this picker does not have — which is
	// the same statement as "there is no such slot", so it drops out of `sources` for free.
	const activeSlots = useMemo( () => {
		if ( ! isAllowed ) return slots;
		const next: FillSlots = {};
		for ( const [ key, controlId ] of Object.entries( slots ) ) {
			if ( controlId && isAllowed( controlId ) ) next[ key as keyof FillSlots ] = controlId;
		}
		return next;
	}, [ slots, isAllowed ] );

	const binding: FillBinding = useMemo( () => ( {
		slots: activeSlots,
		has: ( slot ) => Boolean( activeSlots[ slot ] ),
		get: ( slot ) => {
			const controlId = activeSlots[ slot ];
			return controlId ? getValue( attributes, controlId, state, breakpoint ) || '' : '';
		},
		set: ( slot, value ) => {
			const controlId = activeSlots[ slot ];
			if ( ! controlId ) return;
			setValue( attributes, setAttributes, controlId, state, breakpoint, value );
		},
	} ), [ activeSlots, attributes, setAttributes, state, breakpoint ] );

	const available = sourcesFor( activeSlots, sources );

	const color = String( binding.get( 'color' ) || '' );
	const storedGradient = binding.get( 'gradient' ) || null;
	const image = binding.get( 'image' ) || null;

	// Which source is on show. Seeded from what is actually stored, so re-opening a block lands on
	// the fill it has rather than on the first tab.
	const [ source, setSource ] = useState< FillSource >(
		image ? 'image' : storedGradient ? 'gradient' : available[ 0 ] ?? 'color'
	);
	const shownSource = available.includes( source ) ? source : available[ 0 ] ?? 'color';

	/**
	 * One fill, one source.
	 *
	 * Picking a source clears the others, because the alternative is a lie: a stored gradient and a
	 * stored image both reach the stylesheet, so a panel showing the image editor while the canvas
	 * paints the gradient is a panel disagreeing with the block. Clearing on the switch keeps the
	 * swatch, the editor and the canvas saying the same thing.
	 */
	const changeSource = ( next: FillSource ) => {
		setSource( next );
		for ( const other of available ) {
			if ( other !== next ) binding.set( other, '' );
		}
		// Gradient seeds a default — an empty gradient panel has no rail to drag and reads as
		// broken. Colour and image have real empty states, so they seed nothing.
		if ( next === 'gradient' && ! storedGradient ) binding.set( 'gradient', defaultGradient() );
	};

	// Text fill: clip on the edge where a fill appears, off on the edge where the last one goes.
	// Only a fill painted as a *background* needs clipping — a solid `colors.text` is already a
	// plain `color:`, so it must not drag the clip on.
	const solidPaintsBackground = activeSlots.color !== 'colors.text';
	const prevHadFill = useRef< boolean | null >( null );
	useEffect( () => {
		if ( ! clipToText || ! activeSlots.clipText ) return;
		const hasFill = Boolean( ( solidPaintsBackground && color ) || storedGradient || image );
		if ( prevHadFill.current === null ) {
			prevHadFill.current = hasFill;
			return;
		}
		const current = getValue( attributes, activeSlots.clipText, state, breakpoint );
		if ( hasFill && ! prevHadFill.current && current !== 'on' ) {
			setValue( attributes, setAttributes, activeSlots.clipText, state, breakpoint, 'on' );
		} else if ( ! hasFill && prevHadFill.current && current ) {
			setValue( attributes, setAttributes, activeSlots.clipText, state, breakpoint, '' );
		}
		prevHadFill.current = hasFill;
	}, [ clipToText, solidPaintsBackground, color, storedGradient, image, state, breakpoint ] );

	// ---- summary (the popover trigger, and the inline head's dot) ----
	const hasGradientToken = typeof storedGradient === 'string' && storedGradient !== '';
	const gradientValue = { ...defaultGradient(), ...( hasGradientToken ? {} : storedGradient || {} ) };
	const paletteEntry = matchPalette( color, palette );
	const hasAny = Boolean( color || storedGradient || image );

	const swatchStyle: React.CSSProperties = image
		? { backgroundImage: `url("${ image.thumbnail || image.url }")`, backgroundSize: 'cover', backgroundPosition: 'center' }
		: storedGradient
			? { background: hasGradientToken
				? `var(--blicks-gradient-${ storedGradient })`
				: gradientCss( { ...gradientValue, stops: gradientStops( gradientValue ) } ) }
			: color
				? { background: paletteEntry ? paletteEntry.color : color }
				: {};

	const summary = image
		? ( image.filename || image.title || __( 'Image', 'blicks' ) )
		: storedGradient
			? ( hasGradientToken
				? gradientTokenLabel( storedGradient as string )
				: gradientValue.type === 'radial'
					? __( 'Radial gradient', 'blicks' )
					: gradientValue.type === 'conic'
						? __( 'Conic gradient', 'blicks' )
						: __( 'Linear gradient', 'blicks' ) )
			: paletteEntry
				? paletteEntry.name
				: ( color || __( 'Not set', 'blicks' ) );

	const clearAll = () => {
		for ( const slot of Object.keys( activeSlots ) as Array< keyof FillSlots > ) {
			binding.set( slot, '' );
		}
	};

	// ---- popover plumbing ----
	const [ open, setOpen ] = useState( false );
	const [ anchor, setAnchor ] = useState< Element | null >( null );
	const [ popoverId ] = useState( () => `bl-fill-popover-${ Math.random().toString( 36 ).slice( 2 ) }` );
	// Deliberately NOT registered with `useCloseOnOtherPopover`: this popover's own children (the
	// colour picker, a gradient stop) announce themselves when they open, which would snap their
	// parent shut underneath them. Outside-click and Escape do the dismissing.
	useCloseOnOutsideClick( open, () => setOpen( false ), anchor );
	const toggle = () => {
		setOpen( ( current ) => {
			const next = ! current;
			if ( next ) announcePopoverOpen( popoverId );
			return next;
		} );
	};

	if ( available.length === 0 ) return null;

	const editor = (
		<FillEditor
			binding={ binding }
			sources={ sources }
			source={ shownSource }
			onSourceChange={ changeSource }
			colorLabel={ label ?? __( 'Fill colour', 'blicks' ) }
			hideClip={ clipToText }
			searching={ searching }
		/>
	);

	if ( layout === 'popover' ) {
		return (
			<div className="bl-fill-control">
				<div
					className={ `bl-valuefield bl-valuefield--picker bl-fill-trigger ${ hasAny ? 'is-set' : '' }` }
					ref={ ( node ) => setAnchor( node ) }
				>
					<span className="bl-valuefield__cap" title={ label ?? __( 'Fill', 'blicks' ) }>{ cap }</span>
					<button
						type="button"
						className={ `bl-fill-swatch ${ hasAny ? '' : 'is-transparent' }` }
						style={ swatchStyle }
						aria-label={ label ?? __( 'Fill', 'blicks' ) }
						aria-haspopup="dialog"
						aria-expanded={ open }
						onClick={ toggle }
					/>
					<button type="button" className="bl-valuefield__pick" onClick={ toggle }>
						{ summary }
					</button>
					<ResetButton idle={ ! hasAny } onClick={ clearAll } />
					<button
						type="button"
						className={ `lib-btn ${ open ? 'is-open' : '' }` }
						tabIndex={ -1 }
						aria-hidden="true"
						title={ __( 'Edit fill', 'blicks' ) }
						onClick={ toggle }
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
					</button>
				</div>

				{ open && (
					<Popover
						anchor={ anchor }
						placement="left-start"
						offset={ 12 }
						flip
						resize
						noArrow
						focusOnMount={ false }
						onClose={ () => setOpen( false ) }
						className="bl-floating-popover bl-ins"
						variant="unstyled"
					>
						<div className="bl-fill-popover">{ editor }</div>
					</Popover>
				) }
			</div>
		);
	}

	return (
		<div className="bl-fill-control bl-fill-group">
			{ label && (
				<div className="bl-spacing-head">
					<span>{ label }</span>
					{ hasAny && <span className="bl-mod-dot" aria-hidden="true" /> }
					<div className="bl-spacing-actions">
						<ResetButton idle={ ! hasAny } onClick={ clearAll } />
					</div>
				</div>
			) }
			{ editor }
		</div>
	);
}
