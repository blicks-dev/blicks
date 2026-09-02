import { useRef, useState } from '@wordpress/element';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import { MoreSettings, ResetButton, announcePopoverOpen, useCloseOnOtherPopover, validateOrEmpty, validateSpaced } from '@/controls/common';
import { IconField, IconValueField, type IconChoice } from '@/controls/IconValueField';
import { OptionField, ValueField } from '@/controls/ValueField';
import { ColorRow } from '@/controls/ColorRow';
import { TokenLibrary } from '@/controls/TokenLibrary';
import { ColorPopover } from '@/controls/color/ColorControl';
import { tokenOptions } from '@/controls/token-utils';
import { clamp, defaultGradient, gradientCss, gradientStops, positionToNumber } from '@/controls/color/gradient-css';
import { PositionPad } from './PositionPad';
import { sourcesFor, type FillBinding, type FillSource } from './types';
import './fill.scss';

interface Props {
	binding: FillBinding;
	/** Narrow the offered sources further than the slots already do. */
	sources?: FillSource[];
	/** Which source is being edited, and how to change it. Held by the caller so a popover and its
	 *  trigger agree on what the swatch is showing. */
	source: FillSource;
	onSourceChange: ( next: FillSource ) => void;
	/** Label for the colour row — "Colour" as a background, "Font colour" as a text fill. */
	colorLabel?: string;
	/** Hide the clip-to-text toggle: a text fill manages it for the author, so offering it again
	 *  is offering a switch that is already thrown. */
	hideClip?: boolean;
	/** Hold disclosures open — a property search is running. */
	searching?: boolean;
}

const BG_SIZE_OPTIONS = [ 'cover', 'contain', 'auto', '100% auto', 'auto 100%' ].map( ( v ) => ( { value: v, label: v } ) );
const BG_SIZE_PATTERN = /^(cover|contain|auto|(?:\d+(\.\d+)?(px|%|em|rem|vw|vh)|auto)(\s+(?:\d+(\.\d+)?(px|%|em|rem|vw|vh)|auto))?)$/;
const BG_ANGLE_OPTIONS = [ '0deg', '45deg', '90deg', '135deg', '180deg' ].map( ( v ) => ( { value: v, label: v } ) );
const BG_ANGLE_PATTERN = /^-?\d+(\.\d+)?deg$/;
const BG_ORIGIN_OPTIONS = [ 'center', 'top left', 'top right', 'bottom left', 'bottom right' ].map( ( v ) => ( { value: v, label: v } ) );
const BLEND_MODES = [
	'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
	'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];
const ATTACHMENT_VALUES = [ 'scroll', 'fixed', 'local' ];


/** The three sources, drawn: a filled square, a ramp, a picture. */
const SOURCE_ICONS: Record< FillSource, JSX.Element > = {
	color: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
	),
	gradient: (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<defs>
				<linearGradient id="bl-fill-ramp" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
					<stop offset="100%" stopColor="currentColor" stopOpacity="1" />
				</linearGradient>
			</defs>
			<rect x="4" y="4" width="16" height="16" rx="2" fill="url(#bl-fill-ramp)" />
		</svg>
	),
	image: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
			<rect x="3.5" y="4.5" width="17" height="15" rx="2" />
			<path d="m4 17 4.5-4.5 3.5 3.5 3-3L20 17" />
			<circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
		</svg>
	),
};

const SOURCE_TITLES: Record< FillSource, string > = {
	color: __( 'Solid colour', 'blicks' ),
	gradient: __( 'Gradient', 'blicks' ),
	image: __( 'Image', 'blicks' ),
};

const GRADIENT_TYPES: IconChoice[] = [
	{
		value: 'linear',
		title: __( 'Linear', 'blicks' ),
		isActive: ( current ) => current !== 'radial' && current !== 'conic',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<defs><linearGradient id="bl-grad-lin" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="currentColor" stopOpacity="0.15" /><stop offset="100%" stopColor="currentColor" /></linearGradient></defs>
				<rect x="3" y="6" width="18" height="12" rx="1.5" fill="url(#bl-grad-lin)" />
			</svg>
		),
	},
	{
		value: 'radial',
		title: __( 'Radial', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<defs><radialGradient id="bl-grad-rad"><stop offset="0%" stopColor="currentColor" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.15" /></radialGradient></defs>
				<circle cx="12" cy="12" r="8.5" fill="url(#bl-grad-rad)" />
			</svg>
		),
	},
	{
		value: 'conic',
		title: __( 'Conic', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
				<circle cx="12" cy="12" r="8.5" />
				<path d="M12 3.5v17" />
				<path d="M12 12 19.4 7.8" />
			</svg>
		),
	},
];

const REPEAT_CHOICES: IconChoice[] = [
	{
		value: 'no-repeat',
		title: __( 'No repeat', 'blicks' ),
		icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" /></svg>,
	},
	{
		value: 'repeat',
		title: __( 'Tile', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
				<rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
			</svg>
		),
	},
	{
		value: 'repeat-x',
		title: __( 'Tile across', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<rect x="3" y="8" width="8" height="8" rx="1" /><rect x="13" y="8" width="8" height="8" rx="1" />
			</svg>
		),
	},
	{
		value: 'repeat-y',
		title: __( 'Tile down', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<rect x="8" y="3" width="8" height="8" rx="1" /><rect x="8" y="13" width="8" height="8" rx="1" />
			</svg>
		),
	},
];
const REPEAT_OPTIONS = [ 'no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round' ]
	.map( ( value ) => ( { value, label: value } ) );

/**
 * Is there a media library to open?
 *
 * `MediaUpload` needs `wp.media`, which only exists inside WordPress admin. Outside it — the
 * playground, and any context where the frame is not enqueued — the button renders and does
 * nothing at all. Checking lets the control offer a URL field there instead of a dead click.
 */
function hasMediaFrame() {
	return typeof ( window as any ).wp?.media === 'function';
}

/** A name for a pasted URL. Only the last segment if it looks like a file — `…/400/300` ends in
 *  `300`, which is a size, not a name, and displaying it as one is worse than saying "Image". */
function urlFilename( url: string ) {
	const last = url.split( /[?#]/ )[ 0 ].split( '/' ).filter( Boolean ).pop() || '';
	return /\.[a-z0-9]{2,5}$/i.test( last ) ? last : __( 'Image', 'blicks' );
}

function mediaToImage( media: any ) {
	return {
		id: media?.id,
		url: media?.url,
		alt: media?.alt || media?.alt_text || '',
		title: media?.title || media?.filename || __( 'Background image', 'blicks' ),
		filename: media?.filename || media?.title || __( 'Image', 'blicks' ),
		thumbnail: media?.sizes?.thumbnail?.url || media?.sizes?.medium?.url || media?.url,
	};
}

function pointerPercent( event: React.MouseEvent< HTMLElement > ) {
	const rect = event.currentTarget.getBoundingClientRect();
	return Math.round( clamp( ( ( event.clientX - rect.left ) / rect.width ) * 100 ) );
}

/**
 * The fill editor: a source switch and whichever source is active, on the shared field frame.
 *
 * It knows nothing about where the value lives (that is the `binding`) and nothing about whether
 * it is on a panel or in a popover (that is `FillControl`). Both ignorances are the point — this
 * is the single body that the inline Background facet and the popover Font colour both render, so
 * the two can never drift into different pickers for the same job.
 */
export function FillEditor( {
	binding,
	sources,
	source,
	onSourceChange,
	colorLabel = __( 'Colour', 'blicks' ),
	hideClip,
	searching,
}: Props ) {
	const available = sourcesFor( binding.slots, sources );

	// ---- gradient state (selection + drag are UI, not stored) ----
	const [ selectedStop, setSelectedStop ] = useState( 0 );
	const [ stopPopover, setStopPopover ] = useState< number | null >( null );
	const [ stopAnchor, setStopAnchor ] = useState< Element | null >( null );
	const [ stopPopoverId ] = useState( () => `bl-fill-stop-${ Math.random().toString( 36 ).slice( 2 ) }` );
	const [ dragAt, setDragAt ] = useState< string | null >( null );
	useCloseOnOtherPopover( stopPopoverId, () => setStopPopover( null ) );

	const railRef = useRef< HTMLDivElement >( null );
	const bindingRef = useRef( binding );
	bindingRef.current = binding;

	const storedGradient = binding.get( 'gradient' ) || null;
	// A theme gradient preset is stored as a bare slug; a customised one as a stops object.
	const hasGradientToken = typeof storedGradient === 'string' && storedGradient !== '';
	const gradient = { ...defaultGradient(), ...( hasGradientToken ? {} : storedGradient || {} ) };
	const stops = gradientStops( gradient );
	const stopsRef = useRef< any[] >( [] );
	stopsRef.current = stops;
	const gradientRef = useRef< any >( null );
	gradientRef.current = gradient;

	const updateGradient = ( patch: Record< string, unknown > ) =>
		binding.set( 'gradient', { ...gradient, ...patch } );

	const updateStop = ( index: number, patch: Record< string, string > ) =>
		updateGradient( { stops: stops.map( ( s: any, i: number ) => ( i === index ? { ...s, ...patch } : s ) ) } );

	const addStopAt = ( percent: number ) => {
		const next = { color: stops[ selectedStop ]?.color || '#ffffff', position: `${ percent }%` };
		const nextStops = [ ...stops, next ].sort(
			( a: any, b: any ) => parseFloat( a.position ) - parseFloat( b.position )
		);
		updateGradient( { stops: nextStops } );
		setSelectedStop( nextStops.indexOf( next ) );
	};

	const removeStop = ( index: number ) => {
		if ( stops.length <= 2 ) return;
		const nextStops = stops.filter( ( _: any, i: number ) => i !== index );
		updateGradient( { stops: nextStops } );
		setSelectedStop( Math.min( selectedStop, nextStops.length - 1 ) );
		if ( stopPopover === index ) setStopPopover( null );
	};

	// Drag a stop along the rail; a press that never moved opens that stop's colour instead.
	const onStopMouseDown = ( event: React.MouseEvent< HTMLButtonElement >, index: number ) => {
		event.stopPropagation();
		event.preventDefault();
		setSelectedStop( index );
		const el = event.currentTarget;
		const startX = event.clientX;
		let moved = false;

		const onMove = ( e: MouseEvent ) => {
			if ( ! railRef.current ) return;
			if ( Math.abs( e.clientX - startX ) > 3 ) moved = true;
			const rect = railRef.current.getBoundingClientRect();
			const pct = Math.round( clamp( ( ( e.clientX - rect.left ) / rect.width ) * 100 ) );
			setDragAt( `${ pct }%` );
			bindingRef.current.set( 'gradient', {
				...gradientRef.current,
				stops: stopsRef.current.map( ( s: any, i: number ) => ( i === index ? { ...s, position: `${ pct }%` } : s ) ),
			} );
		};
		const onUp = () => {
			document.removeEventListener( 'mousemove', onMove );
			document.removeEventListener( 'mouseup', onUp );
			setDragAt( null );
			if ( ! moved ) {
				setStopAnchor( el );
				setStopPopover( index );
				announcePopoverOpen( stopPopoverId );
			}
		};
		document.addEventListener( 'mousemove', onMove );
		document.addEventListener( 'mouseup', onUp );
	};

	// ---- image ----
	const image = binding.get( 'image' ) || null;
	const imageUrl = image?.url || '';
	const imageThumb = image?.thumbnail || imageUrl;
	const imageName = image?.filename || image?.title || __( 'Image selected', 'blicks' );
	const mediaOpenRef = useRef< ( () => void ) | null >( null );
	const canPickMedia = hasMediaFrame();

	const placementCount = [ binding.get( 'size' ), binding.get( 'repeat' ), binding.get( 'attachment' ) ]
		.filter( Boolean ).length;

	const blendMode = String( binding.get( 'blendMode' ) || '' );
	const clip = binding.get( 'clipText' );
	const showExtras = binding.has( 'blendMode' ) || ( binding.has( 'clipText' ) && ! hideClip );
	const extrasCount = [ blendMode, hideClip ? '' : clip ].filter( Boolean ).length;

	return (
		<div className="bl-fill-editor">
			{ /* The media frame is mounted here unconditionally rather than inside the image panel:
			     wp.media renders blank if its host unmounts while the modal is open, which is exactly
			     what switching source or closing a popover does. */ }
			{ binding.has( 'image' ) && canPickMedia && (
				<MediaUploadCheck>
					<MediaUpload
						allowedTypes={ [ 'image' ] }
						value={ image?.id }
						onSelect={ ( media: any ) => binding.set( 'image', mediaToImage( media ) ) }
						render={ ( { open }: { open: () => void } ) => {
							mediaOpenRef.current = open;
							return null;
						} }
					/>
				</MediaUploadCheck>
			) }

			<div className="bl-fields">
				{ /* One source? Then there is no choice to offer — a colour-only picker is a colour
				     row, not a colour row wearing a one-button switch. */ }
				{ available.length > 1 && (
					<div className="bl-valuefield bl-valuefield--icons bl-fill-source">
						<span className="bl-valuefield__cap" title={ __( 'What paints this fill', 'blicks' ) }>FILL</span>
						<div className="bl-valuefield__icons">
							<div className="seg-row">
								{ available.map( ( id ) => (
									<button
										key={ id }
										type="button"
										className={ source === id ? 'is-active' : '' }
										title={ SOURCE_TITLES[ id ] }
										aria-pressed={ source === id }
										onClick={ () => onSourceChange( id ) }
									>
										{ SOURCE_ICONS[ id ] }
									</button>
								) ) }
							</div>
						</div>
					</div>
				) }

				{ source === 'color' && binding.has( 'color' ) && (
					<ColorRow
						hint={ colorLabel }
						value={ String( binding.get( 'color' ) || '' ) }
						onChange={ ( next ) => binding.set( 'color', next ) }
					/>
				) }

				{ source === 'gradient' && binding.has( 'gradient' ) && (
					<div className="bl-fill-gradient">
						<div className="bl-fill-subhead">
							<span>{ __( 'Gradient', 'blicks' ) }</span>
							<div className="bl-fill-subhead__actions">
								<TokenLibrary
									category="gradient"
									value={ hasGradientToken ? ( storedGradient as string ) : '' }
									title={ __( 'Gradient token library', 'blicks' ) }
									onSelect={ ( slug ) => binding.set( 'gradient', slug ) }
								/>
								<ResetButton idle={ ! storedGradient } onClick={ () => binding.set( 'gradient', '' ) } />
							</div>
						</div>

						{ hasGradientToken ? (
							<>
								<div className="bl-fill-rail" style={ { background: `var(--blicks-gradient-${ storedGradient })` } } />
								<button
									type="button"
									className="bl-fill-link"
									onClick={ () => binding.set( 'gradient', defaultGradient() ) }
								>
									{ __( 'Customise', 'blicks' ) }
								</button>
							</>
						) : (
							<>
								{ /* The rail is the control: click the track to add a stop, drag a handle to
								     move it, click a handle to recolour it. A list of stop rows would need
								     three fields to say what one drag says. */ }
								<div
									ref={ railRef }
									className="bl-fill-rail is-editable"
									style={ { background: gradientCss( { ...gradient, stops } ) } }
									onClick={ ( event ) => {
										if ( event.target !== event.currentTarget ) return;
										addStopAt( pointerPercent( event ) );
									} }
								>
									{ stops.map( ( stop: any, index: number ) => (
										<button
											key={ `${ index }-${ stop.position }` }
											type="button"
											className={ `bl-fill-stop ${ selectedStop === index ? 'is-active' : '' }` }
											style={ { left: `${ positionToNumber( stop.position ) }%`, background: stop.color } }
											title={ __( 'Drag to move, click to recolour', 'blicks' ) }
											onMouseDown={ ( event ) => onStopMouseDown( event, index ) }
											onClick={ ( event ) => event.stopPropagation() }
											onDoubleClick={ ( event ) => { event.stopPropagation(); removeStop( index ); } }
										/>
									) ) }
									{ dragAt && <div className="bl-fill-railtip">{ dragAt }</div> }
								</div>

								<div className="bl-fields">
									<IconField
										label="TYPE"
										hint={ __( 'Gradient type', 'blicks' ) }
										value={ String( gradient.type || 'linear' ) }
										choices={ GRADIENT_TYPES }
										onChange={ ( next ) => updateGradient( { type: next || 'linear' } ) }
										onReset={ () => updateGradient( { type: 'linear' } ) }
									/>
									{ gradient.type !== 'radial' && (
										<ValueField
											affix={ <span className="bl-valuefield__cap" title={ __( 'Gradient angle', 'blicks' ) }>ANGLE</span> }
											value={ String( gradient.angle || '' ) }
											options={ BG_ANGLE_OPTIONS }
											placeholder={ gradient.type === 'conic' ? '0deg' : '90deg' }
											listLabel="ANGLES"
											modified={ Boolean( gradient.angle ) }
											onChange={ ( next ) => updateGradient( { angle: next } ) }
											onCommit={ ( raw ) => updateGradient( { angle: validateOrEmpty( raw, BG_ANGLE_PATTERN ) } ) }
										/>
									) }
									{ ( gradient.type === 'radial' || gradient.type === 'conic' ) && (
										<ValueField
											affix={ <span className="bl-valuefield__cap" title={ __( 'Where the gradient starts', 'blicks' ) }>ORIGIN</span> }
											value={ String( gradient.position || '' ) }
											options={ BG_ORIGIN_OPTIONS }
											placeholder="center"
											listLabel="ORIGINS"
											modified={ Boolean( gradient.position ) }
											onChange={ ( next ) => updateGradient( { position: next } ) }
										/>
									) }
								</div>
							</>
						) }

						{ stopPopover !== null && (
							<ColorPopover
								anchor={ stopAnchor }
								value={ stops[ stopPopover ]?.color || '' }
								onClose={ () => setStopPopover( null ) }
								onChange={ ( next ) => updateStop( stopPopover, { color: next } ) }
							/>
						) }
					</div>
				) }

				{ source === 'image' && binding.has( 'image' ) && (
					<div className="bl-fill-image">
						<div className={ `bl-fill-media ${ imageUrl ? '' : 'is-empty' }` }>
							<button
								type="button"
								className="bl-fill-thumb"
								style={ imageThumb ? { backgroundImage: `url("${ imageThumb }")` } : undefined }
								onClick={ () => mediaOpenRef.current?.() }
								disabled={ ! canPickMedia }
								aria-label={ imageUrl ? __( 'Replace image', 'blicks' ) : __( 'Choose image', 'blicks' ) }
							/>
							<div className="bl-fill-media__meta">
								<div className="bl-fill-media__name">{ imageUrl ? imageName : __( 'No image selected', 'blicks' ) }</div>
								<div className="bl-fill-media__actions">
									{ canPickMedia && (
										<button type="button" className="bl-fill-link" onClick={ () => mediaOpenRef.current?.() }>
											{ imageUrl ? __( 'Replace', 'blicks' ) : __( 'Choose', 'blicks' ) }
										</button>
									) }
									{ imageUrl && (
										<button type="button" className="bl-fill-link is-danger" onClick={ () => binding.set( 'image', '' ) }>
											{ __( 'Remove', 'blicks' ) }
										</button>
									) }
								</div>
							</div>
						</div>

						{ /* No media library here — offer the one thing that still works rather than a
						     button that cannot open anything. Same field either way, so a URL typed in
						     the playground is the same value the media frame would have written. */ }
						{ ! canPickMedia && (
							<ValueField
								affix={ <span className="bl-valuefield__cap" title={ __( 'Image URL', 'blicks' ) }>URL</span> }
								value={ imageUrl }
								options={ [] }
								placeholder="https://…"
								modified={ Boolean( imageUrl ) }
								onChange={ ( next ) => binding.set( 'image', next ? { url: next, thumbnail: next, filename: urlFilename( next ) } : '' ) }
								onReset={ () => binding.set( 'image', '' ) }
							/>
						) }

						{ /* No image, no pad: it is a picture of a box with nothing in it, and the thing it
						     positions does not exist yet. It appears with the image. */ }
						{ /* Size, repeat and attachment describe how an image is *painted*, so with no image
						     they are three fields that cannot do anything. With one, they belong to the
						     placement the pad is already showing — so they nest under its field rather
						     than forming a topic of their own. */ }
						{ imageUrl && binding.has( 'position' ) && (
							<PositionPad
								value={ String( binding.get( 'position' ) || '' ) }
								preview={ imageThumb }
								size={ String( binding.get( 'size' ) || '' ) }
								repeat={ String( binding.get( 'repeat' ) || '' ) }
								nestedSet={ placementCount > 0 }
								searching={ searching }
								onChange={ ( next ) => binding.set( 'position', next ) }
								onReset={ () => binding.set( 'position', '' ) }
							>
						<div className="bl-fields">
							{ binding.has( 'size' ) && (
								<ValueField
									affix={ <span className="bl-valuefield__cap" title={ __( 'Background size', 'blicks' ) }>SIZE</span> }
									value={ String( binding.get( 'size' ) || '' ) }
									options={ BG_SIZE_OPTIONS }
									placeholder="cover"
									listLabel="SIZES"
									modified={ Boolean( binding.get( 'size' ) ) }
									onChange={ ( next ) => binding.set( 'size', next ) }
									onCommit={ ( raw ) => binding.set( 'size', validateSpaced( raw, BG_SIZE_PATTERN ) ) }
									onReset={ () => binding.set( 'size', '' ) }
								/>
							) }
							{ binding.has( 'repeat' ) && (
								<IconValueField
									label="TILE"
									hint={ __( 'Background repeat', 'blicks' ) }
									value={ String( binding.get( 'repeat' ) || '' ) }
									choices={ REPEAT_CHOICES }
									options={ REPEAT_OPTIONS }
									placeholder="repeat"
									listLabel="REPEATS"
									onChange={ ( next ) => binding.set( 'repeat', next ) }
								/>
							) }
							{ binding.has( 'attachment' ) && (
								<OptionField
									label="ATTACH"
									hint={ __( 'Background attachment', 'blicks' ) }
									values={ ATTACHMENT_VALUES }
									value={ String( binding.get( 'attachment' ) || '' ) }
									placeholder="scroll"
									onChange={ ( next ) => binding.set( 'attachment', next ) }
									onReset={ () => binding.set( 'attachment', '' ) }
								/>
							) }
						</div>
							</PositionPad>
						) }
					</div>
				) }
			</div>

			{ showExtras && (
				<MoreSettings
					label={ __( 'Blend', 'blicks' ) }
					badge={ extrasCount }
					defaultOpen={ extrasCount > 0 }
					forceOpen={ searching }
				>
					<div className="bl-fields">
						{ binding.has( 'blendMode' ) && (
							<OptionField
								label="BLEND"
								hint={ __( 'How this fill blends with what is behind it', 'blicks' ) }
								values={ BLEND_MODES }
								value={ blendMode }
								placeholder="normal"
								onChange={ ( next ) => binding.set( 'blendMode', next ) }
								onReset={ () => binding.set( 'blendMode', '' ) }
							/>
						) }
						{ binding.has( 'clipText' ) && ! hideClip && (
							<label className="bl-fill-check">
								<input
									type="checkbox"
									checked={ clip === 'on' }
									onChange={ ( event ) => binding.set( 'clipText', event.target.checked ? 'on' : '' ) }
								/>
								<span className="bl-fill-check__box">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
								</span>
								<span>{ __( 'Clip this fill to the text', 'blicks' ) }</span>
							</label>
						) }
					</div>
				</MoreSettings>
			) }
		</div>
	);
}

/** The gradient token catalogue, for a summary that can name a preset rather than call it "gradient". */
export function gradientTokenLabel( slug: string ) {
	return tokenOptions( 'gradient' ).find( ( option ) => option.slug === slug )?.label ?? slug;
}
