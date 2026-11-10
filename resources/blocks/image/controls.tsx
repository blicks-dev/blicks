import { useState } from 'react';
import { MediaReplaceFlow, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice, ToolbarLink } from '@/blocks/shared/toolbar';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Chips, Exact, Field, Icon, Opts, Row, SegIcons, SegText, Sec, Slider, Steps, SubView, Switch, type Option } from '@/framework/inspector-v2/kit';
import { DUOTONE_PRESETS, DuotoneFilter, isDuotone, type Duotone } from './duotone';
import { DataSec } from '@/blocks/loop/binding';
import {
	type Adjust,
	type Dim,
	type Hover,
	type Side,
	FOCUS_POINTS,
	WIDTH_PX,
	cleanAdjust,
	cleanAspectRatio,
	cleanDim,
	cleanFocus,
	cleanHover,
	cleanObjectFit,
	cleanSide,
	parseRatio,
	widthCss,
} from './model';

const RATIOS: Array< [ string, string, string ] > = [
	[ 'auto', __( 'Original', 'blicks' ), '5 / 3' ],
	[ '1/1', __( 'Square', 'blicks' ), '1' ],
	[ '4/3', __( 'Classic', 'blicks' ), '4 / 3' ],
	[ '16/9', __( 'Wide', 'blicks' ), '16 / 9' ],
	[ '3/4', __( 'Tall', 'blicks' ), '3 / 4' ],
];
const WIDTHS: Option[] = [ [ 'sm', __( 'Small', 'blicks' ) ], [ 'md', __( 'Medium', 'blicks' ) ], [ 'lg', __( 'Large', 'blicks' ) ], [ '', __( 'Full', 'blicks' ) ] ];
const LINE_UP: Option< Side >[] = [
	[ 'start', __( 'Left', 'blicks' ), 'M5 4v16M9 12h10' ],
	[ 'center', __( 'Center', 'blicks' ), 'M12 4v16M6 12h12' ],
	[ 'end', __( 'Right', 'blicks' ), 'M19 4v16M5 12h10' ],
];
const TEXT_ALIGN: Option< Side >[] = [
	[ 'start', __( 'Left', 'blicks' ), 'M4 6h16M4 12h10M4 18h13' ],
	[ 'center', __( 'Center', 'blicks' ), 'M4 6h16M7 12h10M5.5 18h13' ],
	[ 'end', __( 'Right', 'blicks' ), 'M4 6h16M10 12h10M7 18h13' ],
];
const LINKS: Option[] = [ [ 'none', __( 'None', 'blicks' ) ], [ 'media', __( 'Full size', 'blicks' ) ], [ 'custom', __( 'A page', 'blicks' ) ] ];
const SIZE_NAMES: Record< string, string > = { thumbnail: __( 'Small', 'blicks' ), medium: __( 'Medium', 'blicks' ), large: __( 'Large', 'blicks' ), full: __( 'Original', 'blicks' ) };
const DIMS: Option< Dim >[] = [ [ '', __( 'None', 'blicks' ) ], [ 'light', __( 'Light', 'blicks' ) ], [ 'medium', __( 'Medium', 'blicks' ) ], [ 'strong', __( 'Strong', 'blicks' ) ] ];
const HOVERS: Option< Hover >[] = [
	[ '', __( 'Nothing', 'blicks' ), 'M6 12h12' ],
	[ 'zoom', __( 'Zoom in', 'blicks' ), 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M11 8v6M8 11h6' ],
	[ 'lift', __( 'Lift', 'blicks' ), 'M12 18V6M7 11l5-5 5 5' ],
	[ 'brighten', __( 'Brighten', 'blicks' ), 'M12 3v2M12 19v2M3 12h2M19 12h2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' ],
];
const CAP_POS: Option[] = [ [ 'below', __( 'Below', 'blicks' ) ], [ 'over', __( 'On the image', 'blicks' ) ] ];
const LINK_ICON = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';

const named = ( list: Array< [ string, string, ...unknown[] ] >, v: string ) => list.find( ( q ) => q[ 0 ] === v )?.[ 1 ] ?? '';
const fileName = ( url: string ) => String( url || '' ).split( '/' ).pop()?.split( '?' )[ 0 ] ?? '';

function mediaAttrs( media: any ) {
	return {
		id: media?.id,
		url: media?.url || media?.sizes?.full?.url || '',
		alt: media?.alt || media?.alt_text || '',
		sizeSlug: 'full',
	};
}

/** Opens the Media Library; `render` draws whatever opens it. */
function Library( { id, onSelect, children }: { id?: number; onSelect: ( media: any ) => void; children: ( open: () => void ) => JSX.Element } ) {
	return (
		<MediaUploadCheck>
			<MediaUpload allowedTypes={ [ 'image' ] } value={ id } onSelect={ onSelect } render={ ( { open }: { open: () => void } ) => children( open ) } />
		</MediaUploadCheck>
	);
}

/**
 * The Image's Settings tab, as the Image inspector design draws it: the picture and what it says,
 * its shape and size, its caption and link. Each writes a plain attribute (model.ts).
 */
export function ImageSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const [ sub, setSub ] = useState< '' | 'media' | 'shape' | 'size' | 'caption' >( '' );
	const back = () => setSub( '' );
	const media = useSelect( ( select: any ) => ( attributes.id ? select( 'core' ).getMedia( attributes.id ) : null ), [ attributes.id ] ) as any;
	const sizes = ( media?.media_details?.sizes ?? null ) as Record< string, { source_url?: string; width?: number; height?: number; filesize?: number } > | null;
	const slugs = sizes ? Object.keys( sizes ) : [];
	const slug = slugs.includes( attributes.sizeSlug ) ? attributes.sizeSlug : 'full';
	const dims = sizes?.[ slug ]?.width ? `${ sizes[ slug ].width } × ${ sizes[ slug ].height }` : '';

	const ratio = cleanAspectRatio( attributes.aspectRatio );
	const fit = cleanObjectFit( attributes.objectFit );
	const focus = cleanFocus( attributes.focus ) || '50% 50%';
	const width = String( attributes.width || '' );
	const isStep = width === '' || width in WIDTH_PX;
	const lineUp = cleanSide( attributes.lineUp ) || 'center';
	const capAlign = cleanSide( attributes.capAlign );
	const isRatio = RATIOS.some( ( [ v ] ) => v === ratio );
	const ratioOpts = (
		<Opts
			columns={ 5 }
			value={ ratio }
			onChange={ ( aspectRatio ) => setAttributes( { aspectRatio } ) }
			options={ RATIOS.map( ( [ v, l, r ] ) => [ v, l, <span key={ v } className="rv" style={ { aspectRatio: r } } /> ] ) }
		/>
	);
	const widths = <Steps label={ __( 'Width', 'blicks' ) } options={ WIDTHS } value={ isStep ? width : null } onChange={ ( w ) => setAttributes( { width: w } ) } />;
	const capWhere = (
		<SegText label={ __( 'Caption', 'blicks' ) } options={ CAP_POS } value={ attributes.capPos === 'over' ? 'over' : 'below' } onChange={ ( capPos ) => setAttributes( { capPos } ) } />
	);

	if ( sub === 'media' ) {
		return (
			<SubView title={ __( 'Image', 'blicks' ) } onBack={ back } clearLabel={ __( 'Remove image', 'blicks' ) } onClear={ () => setAttributes( { id: undefined, url: '', alt: '', sizeSlug: 'full' } ) }>
				<Row label={ __( 'Image', 'blicks' ) } stack>
					<Library id={ attributes.id } onSelect={ ( m ) => { setAttributes( mediaAttrs( m ) ); back(); } }>
						{ ( open ) => (
							<button type="button" className="drop" onClick={ open }>
								<Icon d="M12 16V4M7 9l5-5 5 5M4 20h16" size={ 18 } />
								{ __( 'Upload or choose from the library', 'blicks' ) }
							</button>
						) }
					</Library>
				</Row>
				{ slugs.length > 1 && (
					<Row label={ __( 'File to load', 'blicks' ) } stack set={ slug !== 'full' } note={ `${ dims ? `${ dims }. ` : '' }${ __( 'Phones get a smaller copy on their own.', 'blicks' ) }` } noteIcon="smartphone">
						<SegText
							label={ __( 'File to load', 'blicks' ) }
							options={ slugs.map( ( s ) => [ s, SIZE_NAMES[ s ] ?? s ] as Option ) }
							value={ slug }
							onChange={ ( s ) => sizes?.[ s ]?.source_url && setAttributes( { sizeSlug: s, url: sizes[ s ].source_url } ) }
						/>
					</Row>
				) }
			</SubView>
		);
	}

	if ( sub === 'shape' ) {
		return (
			<SubView title={ __( 'Shape', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to the original shape', 'blicks' ) } onClear={ () => setAttributes( { aspectRatio: 'auto', objectFit: 'cover', focus: '' } ) }>
				<Row label={ __( 'Shape', 'blicks' ) } stack set={ ratio !== 'auto' } hint="aspect-ratio" note={ ratio === 'auto' ? __( 'Pick a shape to crop the image to it.', 'blicks' ) : undefined } noteIcon="info">
					{ ratioOpts }
				</Row>
				<RatioField value={ isRatio ? '' : ratio } onChange={ ( aspectRatio ) => setAttributes( { aspectRatio } ) } />
				{ ratio !== 'auto' && (
					<Row label={ __( 'Fill the shape', 'blicks' ) } stack set={ fit !== 'cover' } hint="object-fit">
						<SegText label={ __( 'Fill the shape', 'blicks' ) } options={ [ [ 'cover', __( 'Crop', 'blicks' ) ], [ 'contain', __( 'Show all', 'blicks' ) ], [ 'fill', __( 'Stretch', 'blicks' ) ] ] } value={ fit } onChange={ ( objectFit ) => setAttributes( { objectFit } ) } />
					</Row>
				) }
				{ ratio !== 'auto' && fit === 'cover' && (
					<Row label={ __( 'Keep in view', 'blicks' ) } set={ focus !== '50% 50%' } hint="object-position">
						<div className="dpad">
							{ FOCUS_POINTS.map( ( q ) => (
								<button key={ q } type="button" aria-pressed={ focus === q } aria-label={ q } onClick={ () => setAttributes( { focus: q === '50% 50%' ? '' : q } ) }><i /></button>
							) ) }
						</div>
					</Row>
				) }
			</SubView>
		);
	}

	if ( sub === 'size' ) {
		return (
			<SubView title={ __( 'Size', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to full width', 'blicks' ) } onClear={ () => setAttributes( { width: '', lineUp: '', phoneFull: true } ) }>
				<Row label={ __( 'Width', 'blicks' ) } stack set={ !! width } hint="max-width">{ widths }</Row>
				<Exact value={ width } isStep={ isStep } label={ __( 'Exact width', 'blicks' ) } placeholder="480px" onChange={ ( w ) => setAttributes( { width: w } ) } />
				{ widthCss( width ) && (
					<>
						<Row label={ __( 'Line up', 'blicks' ) } set={ lineUp !== 'center' }>
							<SegIcons label={ __( 'Line up', 'blicks' ) } options={ LINE_UP } value={ lineUp } onChange={ ( v ) => setAttributes( { lineUp: v === 'center' ? '' : v } ) } />
						</Row>
						<Switch label={ __( 'Full width on phones', 'blicks' ) } checked={ attributes.phoneFull !== false } onChange={ ( phoneFull ) => setAttributes( { phoneFull } ) } />
					</>
				) }
			</SubView>
		);
	}

	if ( sub === 'caption' ) {
		return (
			<SubView title={ __( 'Caption', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to below', 'blicks' ) } onClear={ () => setAttributes( { capPos: 'below', capAlign: '' } ) }>
				<Row label={ __( 'Where', 'blicks' ) } stack set={ attributes.capPos === 'over' } note={ attributes.capPos === 'over' ? __( 'A dark shade sits behind the words so they stay readable.', 'blicks' ) : undefined } noteIcon="info">
					{ capWhere }
				</Row>
				<Row label={ __( 'Line up', 'blicks' ) } set={ !! capAlign && capAlign !== 'center' } hint="text-align">
					<SegIcons label={ __( 'Line up', 'blicks' ) } options={ TEXT_ALIGN } value={ capAlign || 'center' } onChange={ ( v ) => setAttributes( { capAlign: v === 'center' ? '' : v } ) } />
				</Row>
			</SubView>
		);
	}

	const pictureRow = (
		<Row label={ __( 'Image', 'blicks' ) } stack set={ !! attributes.url }>
			{ attributes.url ? (
				<button type="button" className="mcard" onClick={ () => setSub( 'media' ) }>
					<span className="mthumb" style={ { backgroundImage: `url("${ attributes.url }")` } } />
					<span className="mmeta">
						<b>{ fileName( attributes.url ) }</b>
						{ dims && <small>{ dims }</small> }
					</span>
					<span className="mchg">{ __( 'Replace', 'blicks' ) }</span>
				</button>
			) : (
				<Library id={ attributes.id } onSelect={ ( m ) => setAttributes( mediaAttrs( m ) ) }>
					{ ( open ) => (
						<button type="button" className="drop" onClick={ open }>
							<Icon d="M12 16V4M7 9l5-5 5 5M4 20h16" size={ 18 } />
							{ __( 'Choose an image', 'blicks' ) }
						</button>
					) }
				</Library>
			) }
		</Row>
	);
	// Inside a Loop the picture can come from the data: a block-only section, after Content.
	const fromData = (
		<>
			<DataSec attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } attr="url" kind="image" label={ __( 'The picture', 'blicks' ) } title={ __( 'Picture from data', 'blicks' ) } />
			<DataSec attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } attr="alt" label={ __( 'The alt text', 'blicks' ) } title={ __( 'Alt text from data', 'blicks' ) } />
		</>
	);

	if ( ! attributes.url ) {
		return (
			<>
				<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">{ pictureRow }</Sec>
				{ fromData }
			</>
		);
	}

	const shapeCustom = ! isRatio || ( ratio !== 'auto' && ( fit !== 'cover' || focus !== '50% 50%' ) );
	const sizeCustom = ! isStep || ( !! width && ( lineUp !== 'center' || attributes.phoneFull === false ) );
	const capCustom = !! capAlign && capAlign !== 'center';
	const linkTo = [ 'none', 'media', 'custom' ].includes( attributes.linkTo ) ? attributes.linkTo : 'none';
	const door = ( custom: boolean, to: 'shape' | 'size' | 'caption' ) => ( { label: custom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setSub( to ) } );

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
				{ pictureRow }
				<Row
					label={ __( 'Caption', 'blicks' ) }
					stack
					set={ attributes.capPos === 'over' || capCustom }
					note={ attributes.caption ? __( 'Edit the words under the image on the page.', 'blicks' ) : __( 'Type a caption under the image on the page; leave it empty for none.', 'blicks' ) }
					noteIcon="info"
					action={ door( capCustom, 'caption' ) }
				>
					{ capWhere }
				</Row>
				<Switch label={ __( 'Load right away', 'blicks' ) } hint={ __( 'For the first image people see. Others load as they scroll near.', 'blicks' ) } checked={ !! attributes.eager } onChange={ ( eager ) => setAttributes( { eager } ) } />
			</Sec>
			<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio" value={ isStep ? named( WIDTHS as any, width ) : width } custom={ shapeCustom || sizeCustom }>
				<Row label={ __( 'Shape', 'blicks' ) } stack set={ ratio !== 'auto' } hint="aspect-ratio" note={ isRatio ? undefined : ratio } noteIcon="north_west" action={ door( shapeCustom, 'shape' ) }>
					{ ratioOpts }
				</Row>
				<Row label={ __( 'Width', 'blicks' ) } stack set={ !! width } hint="max-width" note={ isStep ? undefined : width } noteIcon="north_west" action={ door( sizeCustom, 'size' ) }>
					{ widths }
				</Row>
			</Sec>
			<Sec title={ __( 'Link', 'blicks' ) } icon="link" value={ named( LINKS as any, linkTo ) }>
				<Row label={ __( 'Links to', 'blicks' ) } stack set={ linkTo !== 'none' } note={ linkTo === 'media' ? __( 'Opens the image file, full size.', 'blicks' ) : undefined } noteIcon="info">
					<SegText label={ __( 'Links to', 'blicks' ) } options={ LINKS } value={ linkTo } onChange={ ( v ) => setAttributes( { linkTo: v } ) } />
				</Row>
				{ linkTo === 'custom' && (
					<Row label={ __( 'Address', 'blicks' ) } stack set={ !! attributes.href }>
						<Field icon={ LINK_ICON } value={ attributes.href || '' } placeholder={ __( 'Paste a link', 'blicks' ) } label={ __( 'Link', 'blicks' ) } onChange={ ( v ) => setAttributes( { href: v.trim() } ) } />
					</Row>
				) }
				{ linkTo === 'custom' && <Switch label={ __( 'Open in a new tab', 'blicks' ) } checked={ attributes.linkTarget === '_blank' } onChange={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '' } ) } /> }
			</Sec>
			{ /* Block-only sections go after the fixed ones, before Meaning and access. */ }
			{ fromData }
			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new">
				<Row label={ __( 'Description', 'blicks' ) } stack set={ ! attributes.decorative && !! attributes.alt } hint="alt" note={ attributes.decorative ? __( 'Decorative images have no description.', 'blicks' ) : undefined } noteIcon="info">
					<textarea
						className="ta"
						rows={ 2 }
						value={ attributes.decorative ? '' : attributes.alt || '' }
						disabled={ !! attributes.decorative }
						placeholder={ __( 'Say what the image shows', 'blicks' ) }
						aria-label={ __( 'Description for screen readers', 'blicks' ) }
						onChange={ ( e ) => setAttributes( { alt: e.currentTarget.value } ) }
					/>
				</Row>
				<Switch label={ __( 'Decorative only', 'blicks' ) } hint={ __( 'Screen readers skip it', 'blicks' ) } checked={ !! attributes.decorative } onChange={ ( decorative ) => setAttributes( { decorative } ) } />
			</Sec>
		</>
	);
}

/**
 * A typed shape such as 21/9, committed on Enter or on leaving the field. The kit's `Exact` takes
 * lengths only, so this keeps its own check (`parseRatio`) inside the same row.
 */
function RatioField( { value, onChange }: { value: string; onChange: ( v: string ) => void } ) {
	const [ draft, setDraft ] = useState( value );
	const [ invalid, setInvalid ] = useState( false );
	const commit = () => {
		if ( draft.trim() === '' || draft === value ) return setInvalid( false );
		const r = parseRatio( draft );
		setInvalid( ! r );
		if ( r ) onChange( r );
	};
	return (
		<Row label={ __( 'Exact', 'blicks' ) } set={ !! value } note={ invalid ? __( 'Use width/height, like 21/9', 'blicks' ) : undefined } noteIcon={ invalid ? 'warning' : undefined }>
			<label className={ `bui-fld${ invalid ? ' invalid' : '' }` }>
				<input value={ draft } placeholder="21/9" aria-label={ __( 'Exact shape, width/height', 'blicks' ) } aria-invalid={ invalid } spellCheck={ false } onChange={ ( e ) => setDraft( e.currentTarget.value ) } onBlur={ commit } onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) { e.preventDefault(); commit(); } } } />
			</label>
		</Row>
	);
}

const sameDuotone = ( a: Duotone | null, b: Duotone | null ) => ( ! a && ! b ) || !! ( a && b && a.shadows === b.shadows && a.highlights === b.highlights );
const presetId = ( i: number ) => `bl-duo-prev-${ i }`;

/** The duotone presets, each drawn on the image itself. */
function DuotoneTiles( { url, value, onChange }: { url: string; value: Duotone | null; onChange: ( v: Duotone | null ) => void } ) {
	return (
		<div className="dtiles">
			{ DUOTONE_PRESETS.map( ( p, i ) => (
				<button key={ p.name } type="button" className="dtile" aria-pressed={ sameDuotone( value, p.value ) } title={ p.name } onClick={ () => onChange( p.value ) }>
					{ p.value && <DuotoneFilter id={ presetId( i ) } value={ p.value } /> }
					<span className="dimg" style={ { backgroundImage: `url("${ url }")`, filter: p.value ? `url(#${ presetId( i ) })` : undefined } } />
					{ p.name }
				</button>
			) ) }
		</div>
	);
}

/** The Image's Style tab: its colour treatment and hover, then the frame the shared panel draws. */
export function ImageStyle( { attributes, setAttributes }: PanelProps ) {
	const [ edit, setEdit ] = useState( false );
	if ( ! attributes.url ) {
		return <p className="empty-note">{ __( 'Choose an image first. Its style comes after.', 'blicks' ) }</p>;
	}
	const duotone = isDuotone( attributes.duotone ) ? attributes.duotone : null;
	const setDuotone = ( next: Duotone | null ) => setAttributes( { duotone: next ?? undefined, hover: ! next && attributes.hover === 'colour' ? '' : attributes.hover } );
	const adjust = cleanAdjust( attributes.adjust );
	const a: Required< Adjust > = { b: 100, c: 100, s: 100, blur: 0, ...adjust };
	const setAdjust = ( patch: Adjust ) => setAttributes( { adjust: cleanAdjust( { ...a, ...patch } ) ?? undefined } );
	const dim = cleanDim( attributes.dim );
	const hover = cleanHover( attributes.hover );
	const capOver = attributes.capPos === 'over' && !! attributes.caption;
	const isPreset = DUOTONE_PRESETS.some( ( p ) => sameDuotone( duotone, p.value ) );

	if ( edit ) {
		const d = duotone ?? { shadows: '#000000', highlights: '#ffffff' };
		return (
			<SubView title={ __( 'Color', 'blicks' ) } onBack={ () => setEdit( false ) } clearLabel={ __( 'Original colors', 'blicks' ) } onClear={ () => setAttributes( { duotone: undefined, adjust: undefined, dim: '', hover: hover === 'colour' ? '' : attributes.hover } ) }>
				<Sec title={ __( 'Tint', 'blicks' ) } icon="palette">
					<Row label={ __( 'Color', 'blicks' ) } stack set={ !! duotone } hint="filter">
						<DuotoneTiles url={ attributes.url } value={ duotone } onChange={ setDuotone } />
					</Row>
					<Row label={ __( 'Two colors', 'blicks' ) } stack set={ !! duotone } note={ duotone ? undefined : __( 'Pick one above, then change its colors here.', 'blicks' ) } noteIcon="info">
						{ duotone && (
							<div className="duo-row">
								<label className="duo-c"><input type="color" value={ d.shadows } onChange={ ( e ) => setDuotone( { ...d, shadows: e.currentTarget.value } ) } /><span>{ __( 'Shadows', 'blicks' ) }</span></label>
								<label className="duo-c"><input type="color" value={ d.highlights } onChange={ ( e ) => setDuotone( { ...d, highlights: e.currentTarget.value } ) } /><span>{ __( 'Highlights', 'blicks' ) }</span></label>
							</div>
						) }
					</Row>
				</Sec>
				<Sec title={ __( 'Adjust', 'blicks' ) } icon="tune">
					<Slider label={ __( 'Brightness', 'blicks' ) } min={ 50 } max={ 150 } value={ a.b } unit="%" onChange={ ( b ) => setAdjust( { b } ) } />
					<Slider label={ __( 'Contrast', 'blicks' ) } min={ 50 } max={ 150 } value={ a.c } unit="%" onChange={ ( c ) => setAdjust( { c } ) } />
					{ ! duotone && <Slider label={ __( 'Saturation', 'blicks' ) } min={ 0 } max={ 200 } value={ a.s } unit="%" onChange={ ( s ) => setAdjust( { s } ) } /> }
					<Slider label={ __( 'Blur', 'blicks' ) } min={ 0 } max={ 12 } value={ a.blur } onChange={ ( blur ) => setAdjust( { blur } ) } />
					<Row label={ __( 'Darken', 'blicks' ) } stack set={ !! dim }>
						<Steps label={ __( 'Darken', 'blicks' ) } options={ DIMS } value={ dim } onChange={ ( v ) => setAttributes( { dim: v } ) } />
					</Row>
				</Sec>
			</SubView>
		);
	}

	const colourCustom = ! isPreset || !! adjust || ( !! dim && ! capOver );
	const hovers = duotone ? [ ...HOVERS, [ 'colour', __( 'Show color', 'blicks' ), 'M12 3a9 9 0 1 0 0 18z' ] as Option< Hover > ] : HOVERS;

	const before = (
		<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill" value={ DUOTONE_PRESETS.find( ( p ) => sameDuotone( duotone, p.value ) )?.name } custom={ colourCustom } onCustomise={ () => setEdit( true ) }>
			<Row label={ __( 'Color', 'blicks' ) } stack set={ !! duotone } hint="filter">
				<DuotoneTiles url={ attributes.url } value={ duotone } onChange={ setDuotone } />
			</Row>
			{ capOver && (
				<Row label={ __( 'Darken', 'blicks' ) } stack set={ !! dim } note={ __( 'Keeps the caption readable on a bright image.', 'blicks' ) } noteIcon="info">
					<Steps label={ __( 'Darken', 'blicks' ) } options={ DIMS } value={ dim } onChange={ ( v ) => setAttributes( { dim: v } ) } />
				</Row>
			) }
		</Sec>
	);
	return (
		<StylePanel
			attributes={ attributes }
			setAttributes={ setAttributes }
			kind="image"
			linked={ false }
			before={ before }
			after={
				<Sec title={ __( 'States', 'blicks' ) } icon="arrow_selector_tool">
					<Row label={ __( 'On hover', 'blicks' ) } stack set={ !! hover }>
						<Chips label={ __( 'On hover', 'blicks' ) } options={ hovers } value={ hover } onChange={ ( v ) => setAttributes( { hover: v } ) } />
					</Row>
				</Sec>
			}
		/>
	);
}

/** The Image's Motion tab: how it arrives. Its own hover zoom is timed by the block's stylesheet. */
export function ImageMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="image" timed={ false } />;
}

/**
 * The Image's toolbar: Replace, Shape, Size and Link — the writes its Settings tab makes. An image
 * not picked yet shows its placeholder instead, so the toolbar waits for one.
 */
export function ImageToolbar( { attributes, setAttributes }: PanelProps ) {
	if ( ! attributes.url ) return null;
	const linkTo = [ 'none', 'media', 'custom' ].includes( attributes.linkTo ) ? attributes.linkTo : 'none';
	return (
		<>
			<ToolbarGroup>
				<MediaReplaceFlow mediaId={ attributes.id } mediaURL={ attributes.url } allowedTypes={ [ 'image' ] } accept="image/*" onSelect={ ( m: any ) => setAttributes( mediaAttrs( m ) ) } name={ __( 'Replace', 'blicks' ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'Shape', 'blicks' ) } value={ cleanAspectRatio( attributes.aspectRatio ) } options={ RATIOS } onChange={ ( aspectRatio ) => setAttributes( { aspectRatio } ) } />
				<ToolbarChoice label={ __( 'Size', 'blicks' ) } value={ String( attributes.width || '' ) } options={ WIDTHS } onChange={ ( width ) => setAttributes( { width } ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'Link', 'blicks' ) } value={ linkTo } options={ LINKS } onChange={ ( v ) => setAttributes( { linkTo: v } ) } />
				{ linkTo === 'custom' && (
					<ToolbarLink
						url={ String( attributes.href || '' ) }
						newTab={ attributes.linkTarget === '_blank' }
						onUrl={ ( v ) => setAttributes( { href: v.trim() } ) }
						onNewTab={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '' } ) }
					/>
				) }
			</ToolbarGroup>
		</>
	);
}
