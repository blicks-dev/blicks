import { InspectorControls } from '@wordpress/block-editor';
import { useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';
import { getValue } from '@/framework/values';
import { SpacingControl, SPACING_KEYWORDS } from '@/controls/spacing/SpacingControl';
import { LayoutControl, LAYOUT_KEYWORDS } from '@/controls/layout/LayoutControl';
import { BORDER_KEYWORDS, BorderControl } from '@/controls/border/BorderControl';
import { POSITION_KEYWORDS, PositionControl } from '@/controls/position/PositionControl';
import { FillControl } from '@/controls/fill/FillControl';
import { TYPOGRAPHY_KEYWORDS, TypographyControl } from '@/controls/typography/TypographyControl';
import { EFFECTS_KEYWORDS, EffectsControl } from '@/controls/effects/EffectsControl';
import { GridChildControl } from '@/controls/grid-child/GridChildControl';
import { FlexChildControl } from '@/controls/flex-child/FlexChildControl';
import { COLUMNS_KEYWORDS, ColumnsControl } from '@/controls/columns/ColumnsControl';
import { AnimationControl, MOTION_KEYWORDS } from '@/controls/animation/AnimationControl';
import { DecorationControl } from '@/controls/decoration/DecorationControl';
import { StatesControl } from '@/controls/states/StatesControl';
import { AdvancedControls } from './AdvancedControls';
import { CssPanel } from './CssPanel';
import { ContextBar } from './ContextBar';
import { SearchField } from './SearchField';
import { Tabs, type TabId } from './Tabs';
import { Rail, facetPanelId, facetTabId, type Facet } from './Rail';
import './inspector.scss';

const ico = ( path: JSX.Element ): JSX.Element => (
	<svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
		{ path }
	</svg>
);

/** One icon per facet (rail + facet-title). */
const FACET_ICONS: Record< string, JSX.Element > = {
	settings: ico( <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.5 7.5 0 0 0 0-2l1.6-1.3-2-3.4-2 .8a7.5 7.5 0 0 0-1.7-1l-.3-2.1h-4l-.3 2.1a7.5 7.5 0 0 0-1.7 1l-2-.8-2 3.4L4.6 11a7.5 7.5 0 0 0 0 2l-1.6 1.3 2 3.4 2-.8a7.5 7.5 0 0 0 1.7 1l.3 2.1h4l.3-2.1a7.5 7.5 0 0 0 1.7-1l2 .8 2-3.4z" /></> ),
	layout: ico( <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18M9 21V9" /></> ),
	spacing: ico( <><rect x="3" y="3" width="18" height="18" rx="1" /><rect x="8" y="8" width="8" height="8" /></> ),
	typography: ico( <path d="M4 7V5h16v2M9 19h6M12 5v14" /> ),
	background: ico( <><path d="M19 11l-8-8-8 8 8 8z" /><path d="M5 11h14" /></> ),
	borders: ico( <rect x="3" y="3" width="18" height="18" rx="2" /> ),
	position: ico( <><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="3" /></> ),
	columns: ico( <><rect x="4" y="4" width="6" height="16" rx="1" /><rect x="14" y="4" width="6" height="16" rx="1" /></> ),
	states: ico( <><path d="M5 3.5 19 10l-5.5 2L11.5 17z" /><path d="m13.5 15 5 5" /></> ),
	gridChild: ico( <><rect x="3" y="3" width="18" height="18" rx="1" /><rect x="3" y="3" width="10" height="10" /></> ),
	flexChild: ico( <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M8 3v18M14 3v18" /></> ),
	effects: ico( <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1" /> ),
	animation: ico( <path d="M5 3l14 9-14 9z" /> ),
	decoration: ico( <><rect x="8" y="8" width="12" height="12" rx="1" /><rect x="3" y="3" width="8" height="8" rx="1" strokeDasharray="2.5 2" /></> ),
	advanced: ico( <path d="m8 6-6 6 6 6M16 6l6 6-6 6" /> ),
};

/*
 * There is deliberately NO separate map of short rail labels.
 *
 * There used to be, and it disagreed with the facet headers on six of thirteen
 * facets — not by abbreviating them but by renaming them: the rail said "Fill",
 * "Motion" and "Decoration" in front of panels headed "Background", "Animation" and
 * "Pseudo-elements". Clicking one name and landing on another is a navigation bug,
 * and since the rail label is also the tab's accessible name, sighted and
 * screen-reader users were given two different names for the same thing.
 *
 * The rail's label track is 108px (a 152px button less the fixed 44px icon block)
 * and every title fits at 11px/600 — "Pseudo-elements", the longest, needs ~96px —
 * so there is nothing to abbreviate and no second name to keep in sync. The rail
 * renders `section.title`.
 *
 * The old short labels survive where they were actually useful: as search terms.
 * "fill", "motion" and "decoration" are all in their facets' `keywords`.
 */

interface StyleSection {
	id: string;
	title: string;
	controlIds: string[];
	Control: React.ComponentType< any >;
	context?: string;
	/** Free-text terms the property search matches this facet on (beyond its title/label). */
	keywords: string[];
}

/**
 * The control registry. Each entry = one **facet** mapping to one or more control ids. Facets
 * render only if the block's manifest includes at least one of their controls (the allow-list),
 * so the rail length is per-block. Order here = order in the rail (under the "Style" group).
 */
const SECTIONS: StyleSection[] = [
	{
		id: 'layout',
		title: __( 'Layout', 'blicks' ),
		// Owned by the control itself so the rail filter and the body filter agree by construction.
		keywords: LAYOUT_KEYWORDS,
		controlIds: [
			'layout.display',
			'layout.flexDirection',
			'layout.justifyContent',
			'layout.alignItems',
			'layout.flexWrap',
			// Gap and the grid track model are display-mode settings, so they are edited under the
			// Display field here rather than from a Spacing or Grid facet of their own.
			'layout.gapRow',
			'layout.gapColumn',
			'layout.gridColumns',
			'layout.gridRows',
			'layout.gridAutoColumns',
			'layout.gridAutoRows',
			'layout.gridAreas',
			'layout.gridAutoFlow',
			'layout.justifyItems',
			'layout.alignContent',
			'layout.width',
			'layout.height',
			'layout.minWidth',
			'layout.maxWidth',
			'layout.minHeight',
			'layout.maxHeight',
			'layout.boxSizing',
			'layout.resize',
			'layout.lineClamp',
			'layout.overflow',
			'layout.overflowX',
			'layout.overflowY',
			'layout.scrollSnapType',
			'layout.scrollSnapStop',
			'layout.scrollBehavior',
			'layout.overscrollBehavior',
			'layout.containerType',
			'layout.containerName',
			'layout.contain',
			'layout.contentVisibility',
			'layout.containIntrinsicSize',
			'layout.aspectRatio',
			'layout.objectFit',
			'layout.visibility',
			'layout.float',
			'layout.clear',
			'layout.isolation',
			'layout.direction',
		],
		Control: LayoutControl,
	},
	{
		id: 'spacing',
		title: __( 'Spacing', 'blicks' ),
		keywords: SPACING_KEYWORDS,
		// Margin and padding only. Gap is a property of the display mode, not of the box, so it
		// lives under Display in Layout.
		controlIds: [ 'spacing.padding', 'spacing.margin' ],
		Control: SpacingControl,
	},
	{
		id: 'typography',
		title: __( 'Typography', 'blicks' ),
		keywords: TYPOGRAPHY_KEYWORDS,
		controlIds: [
			// Heading-only (the facet passes `showTypeRole`), but it must be registered here or
			// the facet's Reset and its "styled" dot cannot see a role the user has set.
			'typography.role',
			'typography.fontFamily',
			'typography.fontSize',
			'typography.lineHeight',
			'typography.fontWeight',
			'typography.fontStyle',
			'typography.letterSpacing',
			'typography.wordSpacing',
			'typography.textTransform',
			'typography.textDecoration',
			'typography.textAlign',
			'typography.writingMode',
			'typography.textOrientation',
			// The facet's font-colour field: a solid colour lands here, a gradient/image in the
			// `background.*` attrs the Background facet also owns.
			'colors.text',
		],
		Control: TypographyControl,
	},
	{
		id: 'background',
		title: __( 'Background', 'blicks' ),
		keywords: [ 'fill', 'background', 'colour', 'color', 'gradient', 'image', 'repeat', 'position', 'attachment', 'blend', 'clip', 'alpha', 'opacity' ],
		controlIds: [
			'colors.background',
			'background.image',
			'background.gradient',
			'background.size',
			'background.position',
			'background.repeat',
			'background.attachment',
			'background.blendMode',
			'colors.clipText',
		],
		Control: FillControl,
	},
	{
		id: 'borders',
		title: __( 'Border', 'blicks' ),
		keywords: BORDER_KEYWORDS,
		controlIds: [ 'border.width', 'border.style', 'border.color', 'border.radius' ],
		Control: BorderControl,
	},
	{
		id: 'position',
		title: __( 'Position', 'blicks' ),
		keywords: POSITION_KEYWORDS,
		controlIds: [ 'position.type', 'position.inset', 'position.zIndex' ],
		Control: PositionControl,
	},
	{
		id: 'columns',
		title: __( 'Multi-column', 'blicks' ),
		keywords: COLUMNS_KEYWORDS,
		controlIds: [
			'columns.columnCount',
			'columns.columnWidth',
			'columns.columnGap',
			'columns.breakInside',
		],
		Control: ColumnsControl,
	},
	{
		id: 'gridChild',
		title: __( 'Grid child', 'blicks' ),
		keywords: [ 'grid', 'child', 'span', 'column', 'row', 'area', 'self', 'order', 'snap' ],
		controlIds: [
			'gridChild.columnSpan',
			'gridChild.rowSpan',
			'gridChild.alignSelf',
			'gridChild.justifySelf',
			'gridChild.order',
			'gridChild.gridArea',
			'gridChild.scrollSnapAlign',
		],
		Control: GridChildControl,
		context: 'grid-parent',
	},
	{
		id: 'flexChild',
		title: __( 'Flex child', 'blicks' ),
		keywords: [ 'flex', 'child', 'grow', 'shrink', 'basis', 'self', 'order' ],
		controlIds: [
			'flexChild.grow',
			'flexChild.shrink',
			'flexChild.basis',
			'flexChild.alignSelf',
			'flexChild.order',
		],
		Control: FlexChildControl,
		context: 'flex-parent',
	},
	{
		id: 'effects',
		title: __( 'Effects', 'blicks' ),
		keywords: EFFECTS_KEYWORDS,
		controlIds: [
			'effects.opacity', 'effects.cursor', 'effects.blendMode',
			'effects.boxShadow', 'effects.textShadow',
			'effects.transition', 'effects.transform', 'effects.filter',
			'effects.clipPath', 'effects.backdropFilter', 'effects.mask',
			'effects.transformOrigin', 'effects.transformStyle', 'effects.perspective',
		],
		Control: EffectsControl,
	},
	{
		id: 'animation',
		title: __( 'Animation', 'blicks' ),
		keywords: MOTION_KEYWORDS,
		controlIds: [
			'animation.name', 'animation.duration', 'animation.easing', 'animation.iteration',
			'animation.direction', 'animation.fillMode', 'animation.delay',
			'animation.timeline', 'animation.range', 'animation.targetAngle', 'animation.target',
		],
		Control: AnimationControl,
	},
	{
		id: 'decoration',
		title: __( 'Pseudo-elements', 'blicks' ),
		keywords: [ 'decoration', 'pseudo', 'element', 'before', 'after', 'content', 'counter', 'ornament' ],
		controlIds: [
			'decoration.before',
			'decoration.after',
			'decoration.counterReset',
			'decoration.counterIncrement',
		],
		Control: DecorationControl,
	},
	{
		id: 'states',
		title: __( 'States', 'blicks' ),
		keywords: [ 'state', 'states', 'pseudo', 'class', 'hover', 'focus', 'active', 'interaction', 'cursor', 'override', 'overrides' ],
		controlIds: [ 'effects.cursor' ],
		Control: StatesControl,
	},
];

interface Manifest {
	controls?: string[];
	states?: string[];
}

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	manifest?: Manifest;
	clientId?: string;
	Controls?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
	Advanced?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
}

const includesControl = ( controls: string[], id: string ): boolean =>
	controls.includes( id ) || controls.includes( id.split( '.' )[ 0 ] + '.*' );

const BREAKPOINT_TO_DEVICE: Record< string, string > = {
	base: 'Desktop',
	tablet: 'Tablet',
	mobile: 'Mobile',
};

const DEVICE_TO_BREAKPOINT: Record< string, string > = {
	desktop: 'base',
	tablet: 'tablet',
	mobile: 'mobile',
};

function deviceToBreakpoint( deviceType: unknown ): string | null {
	if ( typeof deviceType !== 'string' ) return null;
	return DEVICE_TO_BREAKPOINT[ deviceType.toLowerCase() ] ?? null;
}

function getNativeDeviceType( select: any ): string | null {
	const stores = [
		select( 'core/editor' ),
		select( 'core/edit-post' ),
		select( 'core/block-editor' ),
	];

	for ( const store of stores ) {
		const deviceType =
			store?.getDeviceType?.() ??
			store?.__experimentalGetPreviewDeviceType?.();
		if ( deviceType ) return deviceType;
	}

	return null;
}

function useNativeResponsiveBreakpoint() {
	const [ fallbackBreakpoint, setFallbackBreakpoint ] = useState< string >( DEFAULT_BREAKPOINTS[ 0 ].id );
	const nativeDeviceType = useSelect( getNativeDeviceType, [] );
	const editorDispatch = useDispatch( 'core/editor' ) as any;
	const editPostDispatch = useDispatch( 'core/edit-post' ) as any;
	const blockEditorDispatch = useDispatch( 'core/block-editor' ) as any;

	const nativeBreakpoint = deviceToBreakpoint( nativeDeviceType );
	const breakpoint = nativeBreakpoint ?? fallbackBreakpoint;

	const setBreakpoint = ( nextBreakpoint: string ) => {
		setFallbackBreakpoint( nextBreakpoint );
		const nextDevice = BREAKPOINT_TO_DEVICE[ nextBreakpoint ];
		if ( ! nextDevice ) return;

		const setNativeDevice =
			editorDispatch?.setDeviceType ??
			editorDispatch?.__experimentalSetPreviewDeviceType ??
			editPostDispatch?.__experimentalSetPreviewDeviceType ??
			editPostDispatch?.setDeviceType ??
			blockEditorDispatch?.setDeviceType ??
			blockEditorDispatch?.__experimentalSetPreviewDeviceType;

		setNativeDevice?.( nextDevice );
	};

	return [ breakpoint, setBreakpoint ] as const;
}

function hasDisplayValue( attributes: any, values: readonly string[] ): boolean {
	const display = attributes?.blicks?.[ 'layout.display' ];
	if ( ! display || typeof display !== 'object' ) return false;
	const byBreakpoint = display.default;
	if ( ! byBreakpoint || typeof byBreakpoint !== 'object' ) return false;
	return Object.values( byBreakpoint ).some( ( v ) => values.includes( v as string ) );
}

function useHasGridParent( clientId?: string ): boolean {
	return useSelect(
		( select: any ) => {
			if ( ! clientId ) return false;
			const store = select( 'core/block-editor' );
			const parentId = store?.getBlockRootClientId?.( clientId );
			if ( ! parentId ) return false;
			const parentName = store?.getBlockName?.( parentId );
			if ( parentName === 'blicks/grid' ) return true;
			return hasDisplayValue( store?.getBlockAttributes?.( parentId ), [ 'grid', 'inline-grid' ] );
		},
		[ clientId ]
	);
}

function useHasFlexParent( clientId?: string ): boolean {
	return useSelect(
		( select: any ) => {
			if ( ! clientId ) return false;
			const store = select( 'core/block-editor' );
			const parentId = store?.getBlockRootClientId?.( clientId );
			if ( ! parentId ) return false;
			const parentName = store?.getBlockName?.( parentId );
			if ( parentName === 'blicks/stack' ) return true;
			return hasDisplayValue( store?.getBlockAttributes?.( parentId ), [ 'flex', 'inline-flex' ] );
		},
		[ clientId ]
	);
}

/**
 * TEMP: force every section/control on for all blocks, ignoring each block's
 * `supports.blicks.controls` allow-list. Lets us audit the full inspector and
 * filter per-block afterward. Remove this and restore `manifest?.controls` to
 * honor each block's manifest again.
 */
const ALL_CONTROLS = [
	'layout.*', 'gridChild.*', 'flexChild.*', 'columns.*', 'spacing.*', 'border.*', 'position.*',
	'colors.*', 'background.*', 'typography.*', 'effects.*', 'animation.*', 'decoration.*',
];

export function Inspector( { attributes, setAttributes, manifest, clientId, Controls, Advanced }: Props ) {
	const controls = ALL_CONTROLS; // TEMP override — see ALL_CONTROLS note above
	const states = manifest?.states ?? [ 'default' ];

	const [ tab, setTab ] = useState< TabId >( Controls ? 'settings' : 'style' );
	const [ active, setActive ] = useState< string >( '' );
	const [ query, setQuery ] = useState< string >( '' );
	const [ state, setState ] = useState< string >( 'default' );
	const [ breakpoint, setBreakpoint ] = useNativeResponsiveBreakpoint();
	const hasGridParent = useHasGridParent( clientId );
	const hasFlexParent = useHasFlexParent( clientId );
	const CONTEXT_MET: Record< string, boolean > = { 'grid-parent': hasGridParent, 'flex-parent': hasFlexParent };

	const allow = ( controlId: string ) => includesControl( controls, controlId );

	const visibleSections = SECTIONS.filter(
		( s ) =>
			s.controlIds.some( ( id ) => includesControl( controls, id ) ) &&
			( ! s.context || CONTEXT_MET[ s.context ] )
	);

	/** Facets whose label, title or keywords match the search. Empty query → everything. */
	const q = query.trim().toLowerCase();
	const matchedSections = ! q
		? visibleSections
		: visibleSections.filter( ( s ) =>
				[ s.title, ...s.keywords ].some( ( term ) =>
					term.toLowerCase().includes( q )
				)
		  );

	/** Any value set in this facet's controls (any state/breakpoint) — drives the rail "styled" dot. */
	const facetHasValue = ( controlIds: string[] ): boolean =>
		controlIds.some( ( id ) => {
			const control = attributes?.blicks?.[ id ];
			return (
				!! control &&
				Object.values( control ).some(
					( slot: any ) => slot && Object.keys( slot ).length > 0
				)
			);
		} );

	/** Any value in the *current* state+breakpoint slot — drives the per-facet Reset affordance. */
	const facetSlotHasValue = ( controlIds: string[] ): boolean =>
		controlIds.some( ( id ) => getValue( attributes, id, state, breakpoint ) !== undefined );

	/** Clear a facet's controls at the current state+breakpoint in one batched write. */
	const resetFacet = ( controlIds: string[] ): void => {
		const blicks: Record< string, any > = { ...( attributes.blicks ?? {} ) };
		let changed = false;
		for ( const id of controlIds ) {
			const control = blicks[ id ];
			const slot = control?.[ state ];
			if ( ! slot || ! ( breakpoint in slot ) ) continue;
			const nextSlot = { ...slot };
			delete nextSlot[ breakpoint ];
			const nextControl = { ...control };
			if ( Object.keys( nextSlot ).length ) nextControl[ state ] = nextSlot;
			else delete nextControl[ state ];
			if ( Object.keys( nextControl ).length ) blicks[ id ] = nextControl;
			else delete blicks[ id ];
			changed = true;
		}
		if ( changed ) setAttributes( { blicks } );
	};

	const facets: Facet[] = matchedSections.map( ( s ) => ( {
		id: s.id,
		label: s.title,
		icon: FACET_ICONS[ s.id ],
		conditional: Boolean( s.context ),
		hasValue: facetHasValue( s.controlIds ),
	} ) );

	const activeFacet = facets.find( ( f ) => f.id === active ) ?? facets[ 0 ];

	const TABS: { id: TabId; label: string }[] = [
		{ id: 'settings', label: __( 'Settings', 'blicks' ) },
		{ id: 'style', label: __( 'Style', 'blicks' ) },
		{ id: 'advanced', label: __( 'Advanced', 'blicks' ) },
		{ id: 'css', label: __( 'CSS', 'blicks' ) },
	];

	const renderStyleFacet = () => {
		if ( ! activeFacet ) {
			return (
				<p className="bl-ins-note">
					{ /* translators: %s: the user's search term */
					  __( 'No properties match “%s”.', 'blicks' ).replace( '%s', query.trim() ) }
				</p>
			);
		}
		const section = matchedSections.find( ( s ) => s.id === activeFacet.id );
		if ( ! section ) return null;
		const Control = section.Control;
		return (
			<>
				{ /* A real heading: this is the title of the whole panel, and it was a <div>
					     while the same role elsewhere in the inspector used an <h3> — so the one
					     landmark most worth jumping to was the one heading navigation skipped. */ }
				<h3 className="ins-facet__title">
					<span className="ins-facet__ico" aria-hidden="true">{ FACET_ICONS[ section.id ] }</span>
					<span>{ section.title }</span>
					{ facetSlotHasValue( section.controlIds ) && (
						<button
							type="button"
							className="ins-facet__reset"
							onClick={ () => resetFacet( section.controlIds ) }
						>
							{ __( 'Reset', 'blicks' ) }
						</button>
					) }
				</h3>
				<Control
					attributes={ attributes }
					setAttributes={ setAttributes }
					state={ state }
					breakpoint={ breakpoint }
					isAllowed={ allow }
					states={ states }
					setState={ setState }
					query={ query }
				/>
			</>
		);
	};

	const renderTab = () => {
		if ( tab === 'settings' ) {
			return Controls ? (
				<Controls attributes={ attributes } setAttributes={ setAttributes } />
			) : (
				<p className="bl-ins-note">{ __( 'No settings for this block.', 'blicks' ) }</p>
			);
		}
		if ( tab === 'advanced' ) {
			return (
				<AdvancedControls
					attributes={ attributes }
					setAttributes={ setAttributes }
					BlockAdvanced={ Advanced }
				/>
			);
		}
		if ( tab === 'css' ) {
			return <CssPanel attributes={ attributes } setAttributes={ setAttributes } />;
		}
		return renderStyleFacet();
	};

	const isStyle = tab === 'style';
	const bpLabel = DEFAULT_BREAKPOINTS.find( ( b ) => b.id === breakpoint )?.label ?? breakpoint;

	return (
		<InspectorControls>
			<div className="bl-ins">
				<Tabs tabs={ TABS } active={ tab } onSelect={ setTab } />
				<div className="ins-body">
					{ isStyle && <Rail facets={ facets } active={ activeFacet?.id ?? '' } onSelect={ setActive } /> }
					{ /* Without the rail there is no 44px column to leave room for, so the pane takes
					     the whole sidebar. */ }
					<div className={ `ins-pane ${ isStyle ? '' : 'is-full' }` }>
						{ isStyle && (
							<>
								<ContextBar
									states={ states }
									state={ state }
									setState={ setState }
									breakpoint={ breakpoint }
									setBreakpoint={ setBreakpoint }
								/>
								<SearchField value={ query } onChange={ setQuery } />
							</>
						) }
						{ /* The other half of the rail's tab pattern. Only a Style facet is a real
						     tabpanel — the Settings/Advanced tabs are not in that tablist, so
						     labelling them as its panels would be a lie. */ }
						<div
							className="ins-facet"
							key={ `${ tab }:${ activeFacet?.id ?? '' }` }
							{ ...( isStyle && activeFacet
								? {
										role: 'tabpanel',
										id: facetPanelId( activeFacet.id ),
										'aria-labelledby': facetTabId( activeFacet.id ),
										tabIndex: 0,
								  }
								: {} ) }
						>
							{ renderTab() }
						</div>
						{ isStyle && (
							<div className="ins-footer">
								{ /* translators: %s: the current breakpoint, e.g. Desktop */
								  __( 'Editing %s — cascades down', 'blicks' ).replace( '%s', bpLabel ) }
							</div>
						) }
					</div>
				</div>
			</div>
		</InspectorControls>
	);
}
