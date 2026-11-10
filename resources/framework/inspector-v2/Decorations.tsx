import { __ } from '@wordpress/i18n';
import { Chips, Field, Row, SegText, Sec, Slider, SubView, Swatches, type Option, type Swatch } from './kit';
import { ANCHORS, PRESETS, readDecoration, writeDecoration, type Anchor, type DecoHover, type DecoPart, type Decoration, type Motion, type Place, type Shape } from './decor-model';
import type { Tree } from './style-model';

/**
 * The block's `::before` and `::after` in the Style tab, named by where they sit. Studio only:
 * the post editor keeps the simpler panel (see StylePanel).
 */

const PART_NAME: Record< DecoPart, string > = { before: __( 'Behind the content', 'blicks' ), after: __( 'In front', 'blicks' ) };

const PRESET_NAMES: Array< [ keyof typeof PRESETS, string ] > = [
	[ 'glow', __( 'Glow', 'blicks' ) ], [ 'ring', __( 'Ring', 'blicks' ) ], [ 'dot', __( 'Dot', 'blicks' ) ],
	[ 'shine', __( 'Shine', 'blicks' ) ], [ 'underline', __( 'Underline', 'blicks' ) ], [ 'blank', __( 'Blank', 'blicks' ) ],
];

const FILLS: Swatch[] = [
	{ value: '#34e08a', label: __( 'Green', 'blicks' ), css: '#34e08a' },
	{ value: '#6b5bff', label: __( 'Violet', 'blicks' ), css: '#6b5bff' },
	{ value: '#ff3d9a', label: __( 'Pink', 'blicks' ), css: '#ff3d9a' },
	{ value: '#ffffff', label: __( 'White', 'blicks' ), css: '#ffffff' },
	{ value: 'currentColor', label: __( 'Text color', 'blicks' ), css: 'currentColor' },
	{ value: 'linear-gradient(135deg, #6b5bff, #ff3d9a)', label: __( 'Violet to pink', 'blicks' ), css: 'linear-gradient(135deg, #6b5bff, #ff3d9a)' },
	{ value: 'conic-gradient(from 0deg, #00e5ff, #6b5bff, #ff3d9a, #ffb23d, #00e5ff)', label: __( 'Spectrum', 'blicks' ), css: 'conic-gradient(from 0deg, #00e5ff, #6b5bff, #ff3d9a, #ffb23d, #00e5ff)' },
];

const PLACES: Option< Place >[] = [ [ 'fill', __( 'Fit the block', 'blicks' ) ], [ 'spot', __( 'Own size', 'blicks' ) ], [ 'line', __( 'Line', 'blicks' ) ] ];
const SHAPES: Option< Shape >[] = [ [ 'match', __( 'Like the block', 'blicks' ) ], [ 'square', __( 'Square', 'blicks' ) ], [ 'rounded', __( 'Rounded', 'blicks' ) ], [ 'round', __( 'Round', 'blicks' ) ] ];
const MOTIONS: Option< Motion >[] = [ [ '', __( 'None', 'blicks' ) ], [ 'bl-ping', __( 'Ping', 'blicks' ) ], [ 'bl-spin', __( 'Spin', 'blicks' ) ], [ 'bl-float', __( 'Float', 'blicks' ) ], [ 'bl-pan', __( 'Pan', 'blicks' ) ] ];
const HOVERS: Option< DecoHover >[] = [ [ 'stays', __( 'Stays', 'blicks' ) ], [ 'grow', __( 'Grows', 'blicks' ) ], [ 'bright', __( 'Brightens', 'blicks' ) ], [ 'appear', __( 'Appears', 'blicks' ) ], [ 'draw', __( 'Draws in', 'blicks' ) ] ];

const ANCHOR_NAMES: Record< Anchor, string > = {
	tl: __( 'Top left', 'blicks' ), tc: __( 'Top', 'blicks' ), tr: __( 'Top right', 'blicks' ),
	ml: __( 'Left', 'blicks' ), mc: __( 'Center', 'blicks' ), mr: __( 'Right', 'blicks' ),
	bl: __( 'Bottom left', 'blicks' ), bc: __( 'Bottom', 'blicks' ), br: __( 'Bottom right', 'blicks' ),
};

const summary = ( d: Decoration ): string => [
	PLACES.find( ( [ v ] ) => v === d.place )?.[ 1 ],
	d.motion ? MOTIONS.find( ( [ v ] ) => v === d.motion )?.[ 1 ] ?? __( 'Animated', 'blicks' ) : '',
].filter( Boolean ).join( ' · ' );

/** The Style tab row: one entry per part, or an add button for an empty one. */
export function DecorationsSec( { tree, onOpen }: { tree: Tree; onOpen: ( part: DecoPart ) => void } ) {
	const parts: DecoPart[] = [ 'before', 'after' ];
	const used = parts.filter( ( p ) => readDecoration( tree, p ) );
	const free = parts.find( ( p ) => ! used.includes( p ) );
	return (
		<Sec title={ __( 'Decorations', 'blicks' ) } icon="layers" value={ used.length ? `${ used.length } / 2` : '' }>
			<div className="deco-list">
				{ used.map( ( part ) => {
					const d = readDecoration( tree, part )!;
					return (
						<button key={ part } type="button" className="deco-row" onClick={ () => onOpen( part ) }>
							<span className="deco-thumb" style={ { background: d.fill } } aria-hidden="true" />
							<span className="deco-txt"><b>{ PART_NAME[ part ] }</b><small>{ summary( d ) }</small></span>
							<span className="deco-chev" aria-hidden="true">›</span>
						</button>
					);
				} ) }
				{ free && (
					<button type="button" className="deco-row add" onClick={ () => onOpen( free ) }>
						<span className="deco-thumb empty" aria-hidden="true">+</span>
						<span className="deco-txt"><b>{ __( 'Add a decoration', 'blicks' ) }</b><small>{ __( 'A glow, ring, dot, shine…', 'blicks' ) }</small></span>
					</button>
				) }
			</div>
		</Sec>
	);
}

/** One part's sub-view: presets while it is empty, then its controls. */
export function DecorationEditor( { tree, part, setTree, onBack }: { tree: Tree; part: DecoPart; setTree: ( t: Tree ) => void; onBack: () => void } ) {
	const d = readDecoration( tree, part );
	const set = ( patch: Partial< Decoration > ) => setTree( writeDecoration( tree, part, { ...d!, ...patch } ) );

	if ( ! d ) {
		return (
			<SubView title={ __( 'Add a decoration', 'blicks' ) } onBack={ onBack }>
				<Sec title={ __( 'Start from', 'blicks' ) } icon="auto_awesome">
					<Row label={ __( 'Ready-made', 'blicks' ) } stack note={ PART_NAME[ part ] } noteIcon="info">
						<div className="deco-presets">
							{ PRESET_NAMES.map( ( [ key, label ] ) => (
								<button key={ key } type="button" className={ `deco-pre is-${ key }` } onClick={ () => setTree( writeDecoration( tree, part, PRESETS[ key ].deco ) ) }>
									<span className="deco-pv" aria-hidden="true" />
									{ label }
								</button>
							) ) }
						</div>
					</Row>
				</Sec>
			</SubView>
		);
	}

	const fillListed = FILLS.some( ( f ) => f.value === d.fill );
	return (
		<SubView title={ PART_NAME[ part ] } onBack={ onBack } preview={ { background: d.fill } } clearLabel={ __( 'Remove decoration', 'blicks' ) } onClear={ () => { setTree( writeDecoration( tree, part, null ) ); onBack(); } }>
			<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill">
				<Row label={ __( 'Color', 'blicks' ) } hint="background" stack>
					<Swatches swatches={ FILLS } value={ fillListed ? d.fill : null } onChange={ ( fill ) => fill && set( { fill } ) } custom={ fillListed || ! d.fill ? undefined : { css: d.fill, label: __( 'Custom fill', 'blicks' ), onEdit: () => {} } } />
				</Row>
				<Row label={ __( 'Exact', 'blicks' ) } hint="background" set={ ! fillListed && !! d.fill }>
					<Field value={ d.fill } placeholder={ __( 'Any color or gradient', 'blicks' ) } label={ __( 'Fill', 'blicks' ) } onChange={ ( fill ) => fill.trim() && set( { fill: fill.trim() } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Size and place', 'blicks' ) } icon="open_with">
				<Row label={ __( 'Place', 'blicks' ) } stack>
					<SegText label={ __( 'Place', 'blicks' ) } options={ PLACES } value={ d.place } onChange={ ( place ) => set( { place, anchor: place === 'line' ? 'bc' : d.anchor } ) } />
				</Row>
				{ d.place !== 'fill' && (
					<Row label={ __( 'Where', 'blicks' ) } hint="inset">
						<div className="deco-pad" role="radiogroup" aria-label={ __( 'Where', 'blicks' ) }>
							{ ANCHORS.map( ( a ) => (
								<button key={ a } type="button" role="radio" aria-checked={ d.anchor === a } aria-label={ ANCHOR_NAMES[ a ] } title={ ANCHOR_NAMES[ a ] } disabled={ d.place === 'line' && a[ 1 ] !== 'c' } onClick={ () => set( { anchor: a } ) } />
							) ) }
						</div>
					</Row>
				) }
				{ d.place !== 'fill' && <Slider label={ d.place === 'line' ? __( 'Thickness', 'blicks' ) : __( 'Size', 'blicks' ) } min={ 1 } max={ 160 } value={ d.size } onChange={ ( size ) => set( { size } ) } /> }
				<Slider label={ d.place === 'fill' ? __( 'Reach outside', 'blicks' ) : __( 'From the edge', 'blicks' ) } min={ -40 } max={ 40 } value={ d.place === 'fill' ? -d.offset : d.offset } onChange={ ( n ) => set( { offset: d.place === 'fill' ? -n : n } ) } />
			</Sec>
			<Sec title={ __( 'Shape', 'blicks' ) } icon="crop_square">
				<Row label={ __( 'Corners', 'blicks' ) } hint="border-radius" stack>
					<SegText label={ __( 'Corners', 'blicks' ) } options={ SHAPES } value={ d.shape } onChange={ ( shape ) => set( { shape } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Softness', 'blicks' ) } icon="blur_on">
				<Slider label={ __( 'Blur', 'blicks' ) } min={ 0 } max={ 40 } value={ d.blur } onChange={ ( blur ) => set( { blur } ) } />
				<Slider label={ __( 'Opacity', 'blicks' ) } min={ 0 } max={ 100 } step={ 5 } unit="%" value={ d.opacity } onChange={ ( opacity ) => set( { opacity } ) } />
			</Sec>
			<Sec title={ __( 'Motion', 'blicks' ) } icon="animation">
				<Row
					label={ __( 'Animation', 'blicks' ) }
					hint="animation"
					stack
					set={ !! d.motion }
					note={ d.motion && ! MOTIONS.some( ( [ v ] ) => v === d.motion ) ? __( 'Plays a custom animation. Pick one above to replace it.', 'blicks' ) : undefined }
					noteIcon={ d.motion && ! MOTIONS.some( ( [ v ] ) => v === d.motion ) ? 'info' : undefined }
				>
					<Chips label={ __( 'Animation', 'blicks' ) } options={ MOTIONS } value={ MOTIONS.some( ( [ v ] ) => v === d.motion ) ? d.motion : null } onChange={ ( motion ) => set( { motion } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'On hover', 'blicks' ) } icon="arrow_selector_tool">
				<Row label={ __( 'Effect', 'blicks' ) } stack set={ d.hover !== 'stays' }>
					<Chips label={ __( 'On hover', 'blicks' ) } options={ d.place === 'line' ? HOVERS : HOVERS.filter( ( [ v ] ) => v !== 'draw' ) } value={ d.hover } onChange={ ( hover ) => set( { hover } ) } />
				</Row>
			</Sec>
		</SubView>
	);
}
