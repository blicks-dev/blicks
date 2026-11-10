import { InspectorControls } from '@wordpress/block-editor';
import { useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';
import { getValue } from '@/framework/values';
import { ELEMENT_PART, PART_IDS, slotId } from '@/framework/parts';
import { PARTABLE_CONTROLS } from '@/framework/css/vars';
import { SpacingControl, SPACING_KEYWORDS } from '@/controls/spacing/SpacingControl';
import { LayoutControl, LAYOUT_KEYWORDS } from '@/controls/layout/LayoutControl';
import { BORDER_KEYWORDS, BorderControl } from '@/controls/border/BorderControl';
import { POSITION_KEYWORDS, PositionControl } from '@/controls/position/PositionControl';
import { FillControl } from '@/controls/fill/FillControl';
import { TYPOGRAPHY_KEYWORDS, TypographyControl } from '@/controls/typography/TypographyControl';
import { EFFECTS_KEYWORDS, EffectsControl } from '@/controls/effects/EffectsControl';
import { GridChildControl } from '@/controls/grid-child/GridChildControl';
import { FlexChildControl } from '@/controls/flex-child/FlexChildControl';
import { SceneChildControl } from '@/controls/scene-child/SceneChildControl';
import { SceneGridControl } from '@/controls/scene-grid/SceneGridControl';
import { SceneItemControl } from '@/controls/scene-item/SceneItemControl';
import { COLUMNS_KEYWORDS, ColumnsControl } from '@/controls/columns/ColumnsControl';
import { AnimationControl, MOTION_KEYWORDS } from '@/controls/animation/AnimationControl';
import { DecorationControl } from '@/controls/decoration/DecorationControl';
import { StatesControl } from '@/controls/states/StatesControl';
// The allow-list rule lives in its own module so PHP's mirror of it can be parity-tested
// without loading the editor — see control-allow.ts.
import { includesControl } from './control-allow';
import { SECTION_CONTROLS } from '@/engine/schema.gen';
import { AdvancedControls } from './AdvancedControls';
import { ContextBar } from './ContextBar';
import { SearchField } from './SearchField';
import { Tabs, type TabId } from './Tabs';
import { Rail, facetPanelId, facetTabId, type Facet } from './Rail';
import { ScenePanel } from './ScenePanel';
import { hasDisplayValue, resolveContexts } from './contexts';
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
	sceneChild: ico( <><rect x="3" y="4" width="18" height="16" rx="1" /><rect x="7" y="8" width="7" height="6" rx="1" /><path d="M5 4v2M5 18v2" /></> ),
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

export interface StyleSection {
	id: string;
	title: string;
	/** Generated from resources/engine/schema.json — a control's `section` there puts it here. */
	controlIds: readonly string[];
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
		controlIds: SECTION_CONTROLS.layout,
		Control: LayoutControl,
	},
	{
		id: 'spacing',
		title: __( 'Spacing', 'blicks' ),
		keywords: SPACING_KEYWORDS,
		// Margin and padding only. Gap is a property of the display mode, not of the box, so it
		// lives under Display in Layout.
		controlIds: SECTION_CONTROLS.spacing,
		Control: SpacingControl,
	},
	{
		id: 'typography',
		title: __( 'Typography', 'blicks' ),
		keywords: TYPOGRAPHY_KEYWORDS,
		controlIds: SECTION_CONTROLS.typography,
		Control: TypographyControl,
	},
	{
		id: 'background',
		title: __( 'Background', 'blicks' ),
		keywords: [ 'fill', 'background', 'colour', 'color', 'gradient', 'image', 'repeat', 'position', 'attachment', 'blend', 'clip', 'alpha', 'opacity' ],
		controlIds: SECTION_CONTROLS.background,
		Control: FillControl,
	},
	{
		id: 'borders',
		title: __( 'Border', 'blicks' ),
		keywords: BORDER_KEYWORDS,
		controlIds: SECTION_CONTROLS.borders,
		Control: BorderControl,
	},
	{
		id: 'position',
		title: __( 'Position', 'blicks' ),
		keywords: POSITION_KEYWORDS,
		controlIds: SECTION_CONTROLS.position,
		Control: PositionControl,
	},
	{
		id: 'columns',
		title: __( 'Multi-column', 'blicks' ),
		keywords: COLUMNS_KEYWORDS,
		controlIds: SECTION_CONTROLS.columns,
		Control: ColumnsControl,
	},
	{
		id: 'gridChild',
		title: __( 'Grid child', 'blicks' ),
		keywords: [ 'grid', 'child', 'span', 'column', 'row', 'area', 'self', 'order', 'snap' ],
		controlIds: SECTION_CONTROLS.gridChild,
		Control: GridChildControl,
		context: 'grid-parent',
	},
	{
		id: 'flexChild',
		title: __( 'Flex child', 'blicks' ),
		keywords: [ 'flex', 'child', 'grow', 'shrink', 'basis', 'self', 'order' ],
		controlIds: SECTION_CONTROLS.flexChild,
		Control: FlexChildControl,
		context: 'flex-parent',
	},
	{
		id: 'scene',
		title: __( 'Grid', 'blicks' ),
		keywords: [ 'scene', 'grid', 'columns', 'rows', 'tracks', 'gap', 'gutter', 'padding', 'radius', 'stage' ],
		controlIds: SECTION_CONTROLS.scene,
		Control: SceneGridControl,
	},
	{
		id: 'sceneChild',
		title: __( 'Scene item', 'blicks' ),
		keywords: [ 'scene', 'item', 'position', 'cell', 'column', 'row', 'span', 'place', 'rotate', 'scale', 'stage', 'layer' ],
		controlIds: SECTION_CONTROLS.sceneChild,
		Control: SceneChildControl,
		context: 'scene-parent',
	},
	{
		id: 'sceneItem',
		title: __( 'Place in box', 'blicks' ),
		keywords: [ 'scene', 'box', 'place', 'position', 'free', 'drag', 'x', 'y', 'size', 'item' ],
		controlIds: SECTION_CONTROLS.sceneItem,
		Control: SceneItemControl,
		// Only inside a Scene box. Everywhere else these ids are inert — nothing positions by them
		// — so a panel offering them would be four fields that do nothing. An unregistered context
		// is never met, which is what keeps this invisible on a site without the Scene block.
		context: 'scene-box-parent',
	},
	{
		id: 'effects',
		title: __( 'Effects', 'blicks' ),
		keywords: EFFECTS_KEYWORDS,
		controlIds: SECTION_CONTROLS.effects,
		Control: EffectsControl,
	},
	{
		id: 'animation',
		title: __( 'Animation', 'blicks' ),
		keywords: MOTION_KEYWORDS,
		controlIds: SECTION_CONTROLS.animation,
		Control: AnimationControl,
	},
	{
		id: 'decoration',
		title: __( 'Pseudo-elements', 'blicks' ),
		keywords: [ 'decoration', 'pseudo', 'element', 'before', 'after', 'content', 'counter', 'ornament' ],
		controlIds: SECTION_CONTROLS.decoration,
		Control: DecorationControl,
	},
	{
		id: 'states',
		title: __( 'States', 'blicks' ),
		keywords: [ 'state', 'states', 'pseudo', 'class', 'hover', 'focus', 'active', 'interaction', 'cursor', 'override', 'overrides' ],
		controlIds: SECTION_CONTROLS.states,
		Control: StatesControl,
	},
];

interface Manifest {
	controls?: string[];
	states?: string[];
	/**
	 * Narrows what may be styled on a part. Defaults to everything the engine can render on one —
	 * deliberately not `controls`, see PART_CONTROLS below.
	 */
	partControls?: string[];
}

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	manifest?: Manifest;
	clientId?: string;
	Controls?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
	Advanced?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
}


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
	return select( 'core/editor' )?.getDeviceType?.() ?? null;
}

function useNativeResponsiveBreakpoint() {
	const [ fallbackBreakpoint, setFallbackBreakpoint ] = useState< string >( DEFAULT_BREAKPOINTS[ 0 ].id );
	const nativeDeviceType = useSelect( getNativeDeviceType, [] );
	const editorDispatch = useDispatch( 'core/editor' ) as any;

	const nativeBreakpoint = deviceToBreakpoint( nativeDeviceType );
	const breakpoint = nativeBreakpoint ?? fallbackBreakpoint;

	const setBreakpoint = ( nextBreakpoint: string ) => {
		setFallbackBreakpoint( nextBreakpoint );
		const nextDevice = BREAKPOINT_TO_DEVICE[ nextBreakpoint ];
		if ( ! nextDevice ) return;

		editorDispatch?.setDeviceType?.( nextDevice );
	};

	return [ breakpoint, setBreakpoint ] as const;
}

/**
 * What the selected block calls itself, for the scene panel's header.
 *
 * Read from the block type rather than the block name so it is the translated, human title the
 * inserter shows — "Scene text", not `blicks/scene-text`. Falls back to the raw name, which is
 * still more use than an empty chip if a block type has somehow not registered.
 */
function useBlockLabel( clientId?: string ): string {
	return useSelect(
		( select: any ) => {
			if ( ! clientId ) return '';
			const name = select( 'core/block-editor' )?.getBlockName?.( clientId );
			if ( ! name ) return '';
			return select( 'core/blocks' )?.getBlockType?.( name )?.title ?? name;
		},
		[ clientId ]
	);
}

/**
 * The fallback allow-list, for a block that declares no `supports.blicks.controls` at all.
 *
 * This used to be applied unconditionally, as a temporary way to audit the whole inspector before
 * filtering per block. That override is gone: while it was in place every block showed every
 * control, so a manifest was decorative — trimming one changed nothing on screen, and a block like
 * a Scene box offered spacing, effects and decoration it has no use for.
 */
const ALL_CONTROLS = [
	'layout.*', 'gridChild.*', 'flexChild.*', 'sceneChild.*', 'columns.*', 'spacing.*', 'border.*',
	'position.*', 'colors.*', 'background.*', 'typography.*', 'effects.*', 'animation.*',
	'decoration.*',
];

/**
 * Whether the block's **own** box lays its children out as a grid / flex container — the frame of
 * reference a pseudo-element needs. A `::before`'s parent is the block itself, so "is this box a
 * grid item?" is answered by the block's display, not its parent's.
 */
function useSelfLayout( attributes: any ): { grid: boolean; flex: boolean } {
	return {
		grid: hasDisplayValue( attributes, [ 'grid', 'inline-grid' ] ),
		flex: hasDisplayValue( attributes, [ 'flex', 'inline-flex' ] ),
	};
}

/**
 * What may be styled on a **part**, when a block does not narrow it.
 *
 * Not the block's own `controls`. That list says which properties of *this block's box* a user may
 * change, for reasons of the block's semantics — a Button withholds `layout.display` and
 * `position.*` because it lays itself out inside Buttons. A `::before` is a new decorative box,
 * and exactly the box that wants `position: absolute`, a gradient and a transform. So the default
 * is everything the engine can render on a part; a block narrows it with
 * `supports.blicks.partControls`.
 */
const PART_CONTROLS = [ ...PARTABLE_CONTROLS ];

export function InspectorContent( { attributes, setAttributes, manifest, clientId, Controls, Advanced }: Props ) {
	const controls = manifest?.controls ?? ALL_CONTROLS;
	const states = manifest?.states ?? [ 'default' ];
	const flat = Boolean( ( manifest as any )?.flat );
	// A block that allows the Pseudo-elements facet gets the parts; the element is always in.
	const parts = includesControl( controls, 'decoration.content' ) ? PART_IDS : [ ELEMENT_PART ];
	const partControls = manifest?.partControls?.length ? manifest.partControls : PART_CONTROLS;

	const [ tab, setTab ] = useState< TabId >( Controls ? 'settings' : 'style' );
	const [ active, setActive ] = useState< string >( '' );
	const [ query, setQuery ] = useState< string >( '' );
	const [ state, setState ] = useState< string >( 'default' );
	const [ part, setPart ] = useState< string >( ELEMENT_PART );
	const [ breakpoint, setBreakpoint ] = useNativeResponsiveBreakpoint();
	const blockLabel = useBlockLabel( clientId );
	const selfLayout = useSelfLayout( attributes );
	// Every registered context at once. `useSelect` shallow-compares the result, and these are all
	// booleans, so a fresh object of the same answers does not re-render.
	const registered = useSelect(
		( select: any ) => resolveContexts( clientId, select ),
		[ clientId ]
	);

	// A block that stopped offering parts while one was selected must not keep writing into it.
	const activePart = parts.includes( part ) ? part : ELEMENT_PART;
	const onPart = activePart !== ELEMENT_PART;

	// "Is this box a grid/flex item?", asked about whichever box is being styled: a part's parent
	// is the block itself, so on a part the block's own display answers it.
	const CONTEXT_MET: Record< string, boolean > = onPart
		? { ...registered, 'grid-parent': selfLayout.grid, 'flex-parent': selfLayout.flex }
		: registered;
	const hasSceneParent = ! onPart && Boolean( registered[ 'scene-parent' ] );

	/**
	 * The value-tree slot every control reads and writes. Controls receive it as `state` and are
	 * otherwise unaware of parts, so the whole facet library works on a pseudo-element.
	 */
	const slot = slotId( activePart, state );

	const allow = ( controlId: string ) =>
		onPart
			? PARTABLE_CONTROLS.has( controlId ) && includesControl( partControls, controlId )
			: includesControl( controls, controlId );
	const bpLabel = DEFAULT_BREAKPOINTS.find( ( b ) => b.id === breakpoint )?.label ?? breakpoint;

	const visibleSections = SECTIONS.filter(
		( s ) => s.controlIds.some( allow ) && ( ! s.context || CONTEXT_MET[ s.context ] )
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
	const facetHasValue = ( controlIds: readonly string[] ): boolean =>
		controlIds.some( ( id ) => {
			const control = attributes?.blicks?.[ id ];
			return (
				!! control &&
				Object.values( control ).some(
					( slot: any ) => slot && Object.keys( slot ).length > 0
				)
			);
		} );

	/** Any value in the *current* slot+breakpoint — drives the per-facet Reset affordance. */
	const facetSlotHasValue = ( controlIds: readonly string[] ): boolean =>
		controlIds.some( ( id ) => getValue( attributes, id, slot, breakpoint ) !== undefined );

	/** Clear a facet's controls at the current slot+breakpoint in one batched write. */
	const resetFacet = ( controlIds: readonly string[] ): void => {
		const blicks: Record< string, any > = { ...( attributes.blicks ?? {} ) };
		let changed = false;
		for ( const id of controlIds ) {
			const control = blicks[ id ];
			const byBp = control?.[ slot ];
			if ( ! byBp || ! ( breakpoint in byBp ) ) continue;
			const nextSlot = { ...byBp };
			delete nextSlot[ breakpoint ];
			const nextControl = { ...control };
			if ( Object.keys( nextSlot ).length ) nextControl[ slot ] = nextSlot;
			else delete nextControl[ slot ];
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
					state={ slot }
					breakpoint={ breakpoint }
					isAllowed={ allow }
					states={ states }
					setState={ setState }
					part={ activePart }
					setPart={ setPart }
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
		if ( hasSceneParent ) {
			return (
				<ScenePanel
					sections={ matchedSections }
					blockLabel={ blockLabel }
					controlProps={ {
						attributes,
						setAttributes,
						state: slot,
						breakpoint,
						isAllowed: allow,
						states,
						setState,
						query,
					} }
					facetHasValue={ facetHasValue }
					resetFacet={ resetFacet }
				/>
			);
		}

		return renderStyleFacet();
	};

	/**
	 * A FLAT panel: one column, no Settings / Style / Advanced tabs.
	 *
	 * Declared per block through `supports.blicks.flat`, not hardcoded to a block name, so any
	 * block whose whole inspector fits on one screen can opt in. A Scene box has six settings; three
	 * tabs to reach them meant grid placement lived in one, fill in another and the CSS class in a
	 * third. The tabs earn their keep on a Section with nine facets, and get in the way here.
	 *
	 * Everything is the existing machinery: `ScenePanel` already draws every allowed group at once,
	 * so the block's own settings go above it and the advanced field below it.
	 */
	if ( flat ) {
		return (
			<div className="bl-ins is-flat">
				<div className="ins-body">
					<div className="ins-pane is-full">
						{ /* Kept even though the prototype had no room for it: dropping it would
						     silently remove hover and per-breakpoint authoring, which is capability
						     loss rather than simplification. */ }
						<ContextBar
							states={ states }
							state={ state }
							setState={ setState }
							breakpoint={ breakpoint }
							setBreakpoint={ setBreakpoint }
						/>
						<div className="ins-facet">
							<ScenePanel
								sections={ matchedSections }
								blockLabel={ blockLabel }
								controlProps={ {
									attributes,
									setAttributes,
									state: slot,
									breakpoint,
									isAllowed: allow,
									states,
									setState,
									query,
								} }
								facetHasValue={ facetHasValue }
								resetFacet={ resetFacet }
								lead={
									Controls ? (
										<Controls attributes={ attributes } setAttributes={ setAttributes } />
									) : null
								}
								// No Advanced tail. Its four cards — Visibility, Custom attributes,
								// Accessibility, Reset — are longer than everything above them put
								// together, which would undo the point of a flat panel. Visibility is
								// the one with a real use on a box, and the layers list already has it
								// on the eye icon, writing the same attribute.
							/>
						</div>
						<div className="ins-footer">
							{ /* translators: %s: the current breakpoint, e.g. Desktop */
							  __( 'Editing %s — cascades down', 'blicks' ).replace( '%s', bpLabel ) }
						</div>
					</div>
				</div>
			</div>
		);
	}

	// The rail is the facet picker. A scene child shows every group at once instead, so there is
	// nothing to pick and no 44px column to leave room for.
	const isStyle = tab === 'style';
	const showRail = isStyle && ! hasSceneParent;

	return (
		<div className="bl-ins">
			<Tabs tabs={ TABS } active={ tab } onSelect={ setTab } />
			<div className="ins-body">
				{ showRail && <Rail facets={ facets } active={ activeFacet?.id ?? '' } onSelect={ setActive } /> }
				{ /* Without the rail there is no 44px column to leave room for, so the pane takes
				     the whole sidebar. */ }
				<div className={ `ins-pane ${ showRail ? '' : 'is-full' }` }>
					{ isStyle && (
						<>
							<ContextBar
								states={ states }
								state={ state }
								setState={ setState }
								breakpoint={ breakpoint }
								setBreakpoint={ setBreakpoint }
								parts={ parts }
								part={ activePart }
								setPart={ setPart }
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
	);
}

export function Inspector( props: Props ) {
	return (
		<InspectorControls>
			<InspectorContent { ...props } />
		</InspectorControls>
	);
}
