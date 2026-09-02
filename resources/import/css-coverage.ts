/**
 * CSS coverage analyzer (Mockup→Blicks, Phase A).
 *
 * Answers, for any CSS declaration: does Blicks have a dedicated CONTROL for it (→ which section +
 * `blicks` attr), or is it a CUSTOM-CSS fallback (valid CSS, no control — goes to the per-block
 * Custom CSS field)? This is the engine behind "flag unsupported CSS" + "suggest controls".
 *
 * `PROPERTY_MAP` is curated to mirror `STYLE_MAP` (css/vars.ts); a unit test asserts every STYLE_MAP
 * attr is represented here, so the two can't silently drift.
 */

export type Section =
	| 'layout'
	| 'spacing'
	| 'border'
	| 'position'
	| 'colors'
	| 'background'
	| 'typography'
	| 'effects'
	| 'animation'
	| 'gridChild'
	| 'flexChild'
	| 'columns'
	| 'decoration';

export interface ControlRef {
	section: Section;
	attr: string;
}

/** Base CSS property → the Blicks control that produces it. */
export const PROPERTY_MAP: Record< string, ControlRef > = {
	// Layout
	display: { section: 'layout', attr: 'layout.display' },
	'flex-direction': { section: 'layout', attr: 'layout.flexDirection' },
	'justify-content': { section: 'layout', attr: 'layout.justifyContent' },
	'align-items': { section: 'layout', attr: 'layout.alignItems' },
	'justify-items': { section: 'layout', attr: 'layout.justifyItems' },
	'flex-wrap': { section: 'layout', attr: 'layout.flexWrap' },
	'row-gap': { section: 'layout', attr: 'layout.gapRow' },
	gap: { section: 'layout', attr: 'layout.gapRow' },
	'grid-template-columns': { section: 'layout', attr: 'layout.gridColumns' },
	'grid-template-rows': { section: 'layout', attr: 'layout.gridRows' },
	'grid-template-areas': { section: 'layout', attr: 'layout.gridAreas' },
	'grid-auto-flow': { section: 'layout', attr: 'layout.gridAutoFlow' },
	width: { section: 'layout', attr: 'layout.width' },
	height: { section: 'layout', attr: 'layout.height' },
	overflow: { section: 'layout', attr: 'layout.overflow' },
	'overflow-x': { section: 'layout', attr: 'layout.overflowX' },
	'overflow-y': { section: 'layout', attr: 'layout.overflowY' },
	'scroll-snap-type': { section: 'layout', attr: 'layout.scrollSnapType' },
	'container-type': { section: 'layout', attr: 'layout.containerType' },
	'container-name': { section: 'layout', attr: 'layout.containerName' },
	'aspect-ratio': { section: 'layout', attr: 'layout.aspectRatio' },
	'object-fit': { section: 'layout', attr: 'layout.objectFit' },
	'align-content': { section: 'layout', attr: 'layout.alignContent' },
	'grid-auto-columns': { section: 'layout', attr: 'layout.gridAutoColumns' },
	'grid-auto-rows': { section: 'layout', attr: 'layout.gridAutoRows' },
	'min-width': { section: 'layout', attr: 'layout.minWidth' },
	'max-width': { section: 'layout', attr: 'layout.maxWidth' },
	'min-height': { section: 'layout', attr: 'layout.minHeight' },
	'max-height': { section: 'layout', attr: 'layout.maxHeight' },
	'box-sizing': { section: 'layout', attr: 'layout.boxSizing' },
	visibility: { section: 'layout', attr: 'layout.visibility' },
	float: { section: 'layout', attr: 'layout.float' },
	clear: { section: 'layout', attr: 'layout.clear' },
	isolation: { section: 'layout', attr: 'layout.isolation' },
	resize: { section: 'layout', attr: 'layout.resize' },
	'scroll-behavior': { section: 'layout', attr: 'layout.scrollBehavior' },
	'overscroll-behavior': { section: 'layout', attr: 'layout.overscrollBehavior' },
	'scroll-snap-stop': { section: 'layout', attr: 'layout.scrollSnapStop' },
	direction: { section: 'layout', attr: 'layout.direction' },
	contain: { section: 'layout', attr: 'layout.contain' },
	'content-visibility': { section: 'layout', attr: 'layout.contentVisibility' },
	'contain-intrinsic-size': { section: 'layout', attr: 'layout.containIntrinsicSize' },
	'-webkit-line-clamp': { section: 'layout', attr: 'layout.lineClamp' },

	// Spacing
	padding: { section: 'spacing', attr: 'spacing.padding' },
	margin: { section: 'spacing', attr: 'spacing.margin' },

	// Border
	'border-width': { section: 'border', attr: 'border.width' },
	'border-style': { section: 'border', attr: 'border.style' },
	'border-color': { section: 'border', attr: 'border.color' },
	'border-radius': { section: 'border', attr: 'border.radius' },
	border: { section: 'border', attr: 'border.width' },

	// Position
	position: { section: 'position', attr: 'position.type' },
	inset: { section: 'position', attr: 'position.inset' },
	'z-index': { section: 'position', attr: 'position.zIndex' },

	// Colors / background
	color: { section: 'colors', attr: 'colors.text' },
	'background-color': { section: 'colors', attr: 'colors.background' },
	background: { section: 'colors', attr: 'colors.background' },
	'background-image': { section: 'background', attr: 'background.image' },
	'background-size': { section: 'background', attr: 'background.size' },
	'background-position': { section: 'background', attr: 'background.position' },
	'background-repeat': { section: 'background', attr: 'background.repeat' },
	'background-attachment': { section: 'background', attr: 'background.attachment' },
	'background-blend-mode': { section: 'background', attr: 'background.blendMode' },
	'background-clip': { section: 'colors', attr: 'colors.clipText' },
	'mix-blend-mode': { section: 'effects', attr: 'effects.blendMode' },

	// Typography
	'font-family': { section: 'typography', attr: 'typography.fontFamily' },
	'font-size': { section: 'typography', attr: 'typography.fontSize' },
	'line-height': { section: 'typography', attr: 'typography.lineHeight' },
	'font-weight': { section: 'typography', attr: 'typography.fontWeight' },
	'font-style': { section: 'typography', attr: 'typography.fontStyle' },
	'letter-spacing': { section: 'typography', attr: 'typography.letterSpacing' },
	'word-spacing': { section: 'typography', attr: 'typography.wordSpacing' },
	'text-transform': { section: 'typography', attr: 'typography.textTransform' },
	'text-decoration': { section: 'typography', attr: 'typography.textDecoration' },
	'text-align': { section: 'typography', attr: 'typography.textAlign' },
	'writing-mode': { section: 'typography', attr: 'typography.writingMode' },
	'text-orientation': { section: 'typography', attr: 'typography.textOrientation' },

	// Effects
	opacity: { section: 'effects', attr: 'effects.opacity' },
	cursor: { section: 'effects', attr: 'effects.cursor' },
	'box-shadow': { section: 'effects', attr: 'effects.boxShadow' },
	'text-shadow': { section: 'effects', attr: 'effects.textShadow' },
	transition: { section: 'effects', attr: 'effects.transition' },
	transform: { section: 'effects', attr: 'effects.transform' },
	filter: { section: 'effects', attr: 'effects.filter' },
	'clip-path': { section: 'effects', attr: 'effects.clipPath' },
	'backdrop-filter': { section: 'effects', attr: 'effects.backdropFilter' },
	mask: { section: 'effects', attr: 'effects.mask' },
	'transform-origin': { section: 'effects', attr: 'effects.transformOrigin' },
	'transform-style': { section: 'effects', attr: 'effects.transformStyle' },
	perspective: { section: 'effects', attr: 'effects.perspective' },

	// Animation
	'animation-name': { section: 'animation', attr: 'animation.name' },
	'animation-duration': { section: 'animation', attr: 'animation.duration' },
	'animation-timing-function': { section: 'animation', attr: 'animation.easing' },
	'animation-iteration-count': { section: 'animation', attr: 'animation.iteration' },
	'animation-direction': { section: 'animation', attr: 'animation.direction' },
	'animation-fill-mode': { section: 'animation', attr: 'animation.fillMode' },
	'animation-delay': { section: 'animation', attr: 'animation.delay' },
	'animation-timeline': { section: 'animation', attr: 'animation.timeline' },
	'animation-range': { section: 'animation', attr: 'animation.range' },

	// Grid child
	'grid-column': { section: 'gridChild', attr: 'gridChild.columnSpan' },
	'grid-row': { section: 'gridChild', attr: 'gridChild.rowSpan' },
	'align-self': { section: 'gridChild', attr: 'gridChild.alignSelf' },
	'justify-self': { section: 'gridChild', attr: 'gridChild.justifySelf' },
	order: { section: 'gridChild', attr: 'gridChild.order' },
	'grid-area': { section: 'gridChild', attr: 'gridChild.gridArea' },
	'scroll-snap-align': { section: 'gridChild', attr: 'gridChild.scrollSnapAlign' },

	// Flex child — `align-self`/`order` are shared with Grid child above and stay mapped there
	// (a raw CSS paste can't disambiguate flex vs. grid context); flex-grow/shrink/basis are
	// unambiguous.
	'flex-grow': { section: 'flexChild', attr: 'flexChild.grow' },
	'flex-shrink': { section: 'flexChild', attr: 'flexChild.shrink' },
	'flex-basis': { section: 'flexChild', attr: 'flexChild.basis' },

	// Multi-column
	'column-count': { section: 'columns', attr: 'columns.columnCount' },
	'column-width': { section: 'columns', attr: 'columns.columnWidth' },
	'column-gap': { section: 'columns', attr: 'columns.columnGap' },
	'break-inside': { section: 'columns', attr: 'columns.breakInside' },
};

/**
 * Reduce a longhand/side/corner property to the base property a control covers
 * (`padding-top`→`padding`, `border-top-left-radius`→`border-radius`, `top`→`inset`, `font`→handled).
 */
export function normalizeProperty( property: string ): string {
	const p = property.trim().toLowerCase();

	// Physical inset longhands → the `inset` control.
	if ( p === 'top' || p === 'right' || p === 'bottom' || p === 'left' ) {
		return 'inset';
	}
	// padding-*/margin-* → padding/margin.
	const box = p.match( /^(padding|margin)-(top|right|bottom|left|block|inline)/ );
	if ( box ) {
		return box[ 1 ];
	}
	// border radius corners → border-radius.
	if ( /^border-(top|bottom)-(left|right)-radius$/.test( p ) ) {
		return 'border-radius';
	}
	// border side longhands → the matching border sub-property (width/style/color). Style and colour
	// are per-side attributes now, so this fold is lossier than it needs to be — a paste of
	// `border-top-color` could carry the side through. Follow-up, not a blocker: the fold still
	// classifies the declaration into the right control.
	const borderSide = p.match( /^border-(top|right|bottom|left|block|inline)(?:-\w+)?-(width|style|color)$/ );
	if ( borderSide ) {
		return `border-${ borderSide[ 2 ] }`;
	}
	// font / background shorthands → a representative covered base.
	if ( p === 'font' ) {
		return 'font-size';
	}
	// `flex` shorthand isn't a single control; leave as-is (→ custom).
	return p;
}

export type Classification =
	| { property: string; value: string; kind: 'control'; section: Section; attr: string }
	| { property: string; value: string; kind: 'custom' };

/** Classify one declaration against the control map. */
export function classifyDeclaration( property: string, value: string ): Classification {
	const ref = PROPERTY_MAP[ normalizeProperty( property ) ];
	if ( ref ) {
		return { property, value, kind: 'control', section: ref.section, attr: ref.attr };
	}
	return { property, value, kind: 'custom' };
}

export interface CoverageReport {
	controlled: Extract< Classification, { kind: 'control' } >[];
	custom: Extract< Classification, { kind: 'custom' } >[];
	summary: { total: number; controlled: number; custom: number; coverage: number };
}

/** Analyze a set of declarations into a fidelity report. */
export function analyzeDeclarations( declarations: Array< { property: string; value: string } > ): CoverageReport {
	const controlled: CoverageReport[ 'controlled' ] = [];
	const custom: CoverageReport[ 'custom' ] = [];
	for ( const { property, value } of declarations ) {
		const c = classifyDeclaration( property, value );
		if ( c.kind === 'control' ) {
			controlled.push( c );
		} else {
			custom.push( c );
		}
	}
	const total = controlled.length + custom.length;
	return {
		controlled,
		custom,
		summary: {
			total,
			controlled: controlled.length,
			custom: custom.length,
			coverage: total === 0 ? 1 : Math.round( ( controlled.length / total ) * 100 ) / 100,
		},
	};
}

/** Parse a CSS declaration block (`a: b; c: d`) into property/value pairs. */
export function parseDeclarations( cssText: string ): Array< { property: string; value: string } > {
	return String( cssText ?? '' )
		.split( ';' )
		.map( ( d ) => d.trim() )
		.filter( Boolean )
		.map( ( d ) => {
			const i = d.indexOf( ':' );
			if ( i < 0 ) {
				return null;
			}
			return { property: d.slice( 0, i ).trim(), value: d.slice( i + 1 ).trim() };
		} )
		.filter( ( x ): x is { property: string; value: string } => !! x && x.property !== '' );
}
