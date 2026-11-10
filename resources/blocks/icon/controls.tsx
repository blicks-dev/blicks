import { useState } from 'react';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ToolbarChoice, ToolbarIcon, ToolbarSegments, outlineGlyph } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { ICON_COLOURS, StylePanel } from '@/framework/inspector-v2/StylePanel';
import { MotionPanel } from '@/framework/inspector-v2/MotionPanel';
import { Exact, Field, Icon, Row, Sec, SegText, Slider, Steps, Switch, Swatches, type Option } from '@/framework/inspector-v2/kit';
import { readStyle, writeStyle, colourCss } from '@/framework/inspector-v2/style-model';
import { IconPicker } from '@/controls/IconPicker';
import { getIcon } from '@/framework/icons';
import { cleanIconSize, cleanStrokeWidth, cleanTurn } from './model';

const SIZES: Option[] = [ [ '1rem', __( 'Small', 'blicks' ) ], [ '1.5rem', __( 'Medium', 'blicks' ) ], [ '2rem', __( 'Large', 'blicks' ) ], [ '3rem', __( 'Huge', 'blicks' ) ] ];
const STROKES: Record< string, string > = { 1.5: __( 'Fine', 'blicks' ), 2: __( 'Regular', 'blicks' ), 2.5: __( 'Bold', 'blicks' ), 3: __( 'Heavy', 'blicks' ) };
const DRAWN: Option[] = [ [ 'outline', __( 'Outline', 'blicks' ) ], [ 'filled', __( 'Filled', 'blicks' ) ] ];
const LINK_ICON = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';

/**
 * The Icon's Settings tab, as the Icon inspector design draws it: which icon and its colour, how big,
 * whether it is outlined or filled, which way it faces, where it links, and what a screen reader says for it.
 */
export function IconSettings( { attributes, setAttributes }: PanelProps ) {
	const size = cleanIconSize( attributes.size );
	const isStep = SIZES.some( ( [ v ] ) => v === size );
	const [ exact, setExact ] = useState( ! isStep );
	const stroke = cleanStrokeWidth( attributes.strokeWidth );
	const filled = !! attributes.filled;
	const turn = cleanTurn( attributes.turn );
	const url = String( attributes.url || '' );
	const label = String( attributes.label || '' );
	// A link must say where it goes, so it is always read out; otherwise a label makes it heard.
	const [ speaks, setSpeaks ] = useState( !! label );
	const heard = speaks || !! label || !! url;

	const tree = attributes.blicks ?? {};
	const opts = { kind: 'icon', linked: !! url };
	const { look } = readStyle( tree, opts );
	const colour = ( text: string ) => setAttributes( { blicks: writeStyle( tree, { ...look, text }, opts ) } );
	const turned = !! ( attributes.flipH || attributes.flipV || turn );
	const flip = ( k: string, l: string, d: string, on: boolean, toggle: () => void ) => (
		<button key={ k } type="button" role="switch" aria-checked={ on } title={ l } aria-label={ l } onClick={ toggle }><Icon d={ d } /></button>
	);

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
				<Row label={ __( 'Icon', 'blicks' ) } stack set={ !! attributes.icon && attributes.icon !== 'star' }>
					<IconPicker value={ String( attributes.icon || 'star' ) } onChange={ ( icon ) => setAttributes( { icon: icon || 'star' } ) } />
				</Row>
				<Row label={ __( 'Color', 'blicks' ) } stack set={ !! look.text }>
					<Swatches swatches={ ICON_COLOURS.map( ( [ v, l ] ) => ( v ? { value: v, label: l, css: colourCss( v ) } : { value: '', label: l } ) ) } empty="auto" value={ look.text } onChange={ colour } />
				</Row>
			</Sec>
			<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ filled ? __( 'Filled', 'blicks' ) : STROKES[ String( stroke ) ] ?? String( stroke ) }>
				<Row label={ __( 'Drawn as', 'blicks' ) } set={ filled } note={ filled ? __( 'Fills the shape in. Best for closed shapes such as stars, hearts and circles.', 'blicks' ) : undefined } noteIcon="info">
					<SegText label={ __( 'Drawn as', 'blicks' ) } options={ DRAWN } value={ filled ? 'filled' : 'outline' } onChange={ ( v ) => setAttributes( { filled: v === 'filled' } ) } />
				</Row>
				{ ! filled && (
					<Row label={ __( 'Weight', 'blicks' ) } stack set={ stroke !== 2 } hint="stroke-width">
						<Slider label={ __( 'Weight', 'blicks' ) } min={ 1.5 } max={ 3 } step={ 0.5 } value={ Math.min( 3, Math.max( 1.5, stroke ) ) } display={ STROKES[ String( stroke ) ] ?? String( stroke ) } onChange={ ( strokeWidth ) => setAttributes( { strokeWidth } ) } />
					</Row>
				) }
			</Sec>
			<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ turn ? `${ turn }°` : '' }>
				<Row label={ __( 'Flip and turn', 'blicks' ) } stack set={ turned } hint="transform">
					<div className="bui-seg full" role="group" aria-label={ __( 'Flip and turn', 'blicks' ) }>
						{ flip( 'h', __( 'Mirror left to right', 'blicks' ), 'M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z', !! attributes.flipH, () => setAttributes( { flipH: ! attributes.flipH } ) ) }
						{ flip( 'v', __( 'Mirror top to bottom', 'blicks' ), 'M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z', !! attributes.flipV, () => setAttributes( { flipV: ! attributes.flipV } ) ) }
						{ flip( 'r', __( 'Turn a quarter', 'blicks' ), 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', turn !== 0, () => setAttributes( { turn: ( turn + 90 ) % 360 } ) ) }
					</div>
					{ turned && <button type="button" className="link-x muted" onClick={ () => setAttributes( { flipH: false, flipV: false, turn: 0 } ) }>{ __( 'Back to how it was drawn', 'blicks' ) }</button> }
				</Row>
			</Sec>
			<Sec title={ __( 'Size', 'blicks' ) } icon="aspect_ratio" value={ isStep ? SIZES.find( ( [ v ] ) => v === size )?.[ 1 ] : size } custom={ ! isStep } onCustomise={ exact ? undefined : () => setExact( true ) }>
				<Row label={ __( 'Size', 'blicks' ) } stack set={ size !== '1.5rem' } hint="font-size">
					<Steps label={ __( 'Icon size', 'blicks' ) } options={ SIZES } value={ isStep ? size : null } onChange={ ( s ) => setAttributes( { size: s } ) } />
				</Row>
				{ exact && <Exact value={ size } isStep={ isStep } label={ __( 'Exact icon size', 'blicks' ) } placeholder="40px" onChange={ ( s ) => setAttributes( { size: s } ) } /> }
			</Sec>
			<Sec title={ __( 'Link', 'blicks' ) } icon="link">
				<Row label={ __( 'Address', 'blicks' ) } stack set={ !! url }>
					<Field icon={ LINK_ICON } value={ url } placeholder={ __( 'Paste a link', 'blicks' ) } label={ __( 'Link', 'blicks' ) } onChange={ ( v ) => setAttributes( { url: v.trim(), ...( v.trim() && ! label.trim() ? { label: getIcon( attributes.icon )?.label ?? '' } : {} ) } ) } />
				</Row>
				{ url && <Switch label={ __( 'Open in a new tab', 'blicks' ) } checked={ attributes.linkTarget === '_blank' } onChange={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '', rel: on ? 'noreferrer noopener' : '' } ) } /> }
			</Sec>
			<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new">
				<Switch
					label={ __( 'Read out to screen readers', 'blicks' ) }
					hint={ url ? __( 'Needed for links', 'blicks' ) : undefined }
					checked={ heard }
					disabled={ !! url }
					onChange={ ( on ) => { setSpeaks( on ); if ( ! on ) setAttributes( { label: '' } ); } }
				/>
				{ heard && (
					<Row
						label={ __( 'Name', 'blicks' ) }
						stack
						set={ !! label }
						hint="aria-label"
						note={ url && ! label.trim() ? __( 'Say where the link goes. Without it, a screen reader only says “link”.', 'blicks' ) : undefined }
						noteIcon="warning"
					>
						<Field value={ label } placeholder={ __( 'What it means, e.g. “Free changes”', 'blicks' ) } label={ __( 'What a screen reader says', 'blicks' ) } onChange={ ( v ) => setAttributes( { label: v } ) } />
					</Row>
				) }
			</Sec>
		</>
	);
}

/** The Icon's Style tab. Click only means something once the icon links somewhere. */
export function IconStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="icon" linked={ !! attributes.url } />;
}

/** The Icon's Motion tab: its entrance, and the timing of its hover and click looks. */
export function IconMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } kind="icon" linked={ !! attributes.url } />;
}

const turnGlyph = outlineGlyph( 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5' );

/** The Icon's toolbar: which icon, Size, Outline or Filled, and a quarter turn — as Settings writes them. */
export function IconToolbar( { attributes, setAttributes }: PanelProps ) {
	return (
		<>
			<ToolbarGroup>
				<ToolbarIcon value={ String( attributes.icon || 'star' ) } onChange={ ( icon ) => setAttributes( { icon: icon || 'star' } ) } />
				<ToolbarChoice label={ __( 'Size', 'blicks' ) } value={ cleanIconSize( attributes.size ) } options={ SIZES } onChange={ ( size ) => setAttributes( { size } ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarSegments value={ attributes.filled ? 'filled' : 'outline' } options={ DRAWN } onChange={ ( v ) => setAttributes( { filled: v === 'filled' } ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarButton icon={ turnGlyph } label={ __( 'Turn a quarter', 'blicks' ) } onClick={ () => setAttributes( { turn: ( cleanTurn( attributes.turn ) + 90 ) % 360 } ) } />
			</ToolbarGroup>
		</>
	);
}
