/**
 * The Studio design panel's model: every engine control a free block has, placed once in a
 * section, filtered by what the block, the state and the part allow, and resolved to the value it
 * will actually get. It reads and writes the same `blicks` tree as All settings — one value at a
 * time, through `setEntry`, so presets, other states and other screens stay as they were.
 */
import { __ } from '@wordpress/i18n';
import { CONTROL_FLAGS, CONTROL_VALUES, PART_CONTROLS, RELATIONS, SECTION_CONTROLS, STATE_CONTROLS } from '@/engine/schema.gen';
import { ELEMENT, entriesOf, keysOf, labelOf, propertyOf, slotKey, splitSlot, textOf } from './all-settings-model';
import type { Tree } from './style-model';

export type TabId = 'design' | 'effects' | 'motion';

export interface Group {
	key: string;
	title: string;
	/** Material Symbols name. */
	icon: string;
	tab: TabId;
	ids: readonly string[];
}

/** Every control a free block can carry: the engine's sections, without the Scene families. */
export const FREE_IDS: readonly string[] = [ ...new Set( Object.entries( SECTION_CONTROLS ).filter( ( [ section ] ) => ! section.startsWith( 'scene' ) ).flatMap( ( [ , ids ] ) => ids ) ) ];

/** Where each control sits in the panel. Every id in `FREE_IDS` appears exactly once (tested). */
export const GROUPS: readonly Group[] = [
	{ key: 'layout', title: __( 'Layout', 'blicks' ), icon: 'dashboard', tab: 'design', ids: [ 'layout.display', 'layout.flexDirection', 'layout.flexWrap', 'layout.justifyContent', 'layout.alignItems', 'layout.alignContent', 'layout.justifyItems', 'layout.gapRow', 'layout.gapColumn', 'layout.gridColumns', 'layout.gridRows', 'layout.gridAutoRows', 'layout.gridAutoFlow', 'layout.gridAreas', 'layout.group' ] },
	{ key: 'size', title: __( 'Size', 'blicks' ), icon: 'aspect_ratio', tab: 'design', ids: [ 'layout.width', 'layout.height', 'layout.minWidth', 'layout.maxWidth', 'layout.minHeight', 'layout.maxHeight', 'layout.aspectRatio', 'layout.objectFit', 'layout.boxSizing' ] },
	{ key: 'space', title: __( 'Space', 'blicks' ), icon: 'padding', tab: 'design', ids: [ 'spacing.margin', 'spacing.padding' ] },
	{ key: 'position', title: __( 'Position', 'blicks' ), icon: 'open_with', tab: 'design', ids: [ 'position.type', 'position.inset', 'position.zIndex' ] },
	{ key: 'text', title: __( 'Text', 'blicks' ), icon: 'text_fields', tab: 'design', ids: [ 'typography.role', 'typography.fontFamily', 'typography.fontSize', 'typography.fontWeight', 'typography.lineHeight', 'typography.letterSpacing', 'typography.textAlign', 'typography.textTransform', 'colors.text', 'typography.fontStyle', 'typography.textDecoration', 'typography.decorationColor', 'typography.wordSpacing', 'typography.textWrap', 'typography.whiteSpace', 'typography.textOverflow', 'layout.lineClamp', 'typography.writingMode', 'typography.textOrientation' ] },
	{ key: 'fill', title: __( 'Fill', 'blicks' ), icon: 'format_color_fill', tab: 'design', ids: [ 'colors.background', 'background.gradient', 'background.image', 'background.size', 'background.position', 'background.repeat', 'background.attachment', 'background.blendMode', 'colors.clipText', 'background.layers' ] },
	{ key: 'border', title: __( 'Border', 'blicks' ), icon: 'border_style', tab: 'design', ids: [ 'border.width', 'border.style', 'border.color', 'border.radius' ] },
	{ key: 'columns', title: __( 'Text columns', 'blicks' ), icon: 'view_column', tab: 'design', ids: [ 'columns.columnCount', 'columns.columnWidth', 'columns.columnGap', 'columns.breakInside' ] },
	{ key: 'gridChild', title: __( 'In a grid', 'blicks' ), icon: 'grid_view', tab: 'design', ids: [ 'gridChild.columnSpan', 'gridChild.rowSpan', 'gridChild.gridArea', 'gridChild.alignSelf', 'gridChild.justifySelf', 'gridChild.order', 'gridChild.scrollSnapAlign' ] },
	{ key: 'flexChild', title: __( 'In a row or column', 'blicks' ), icon: 'view_week', tab: 'design', ids: [ 'flexChild.grow', 'flexChild.shrink', 'flexChild.basis', 'flexChild.alignSelf', 'flexChild.order' ] },
	{ key: 'scroll', title: __( 'Overflow and scroll', 'blicks' ), icon: 'swipe_vertical', tab: 'design', ids: [ 'layout.overflow', 'layout.overflowX', 'layout.overflowY', 'layout.scrollSnapType', 'layout.scrollSnapStop', 'layout.scrollBehavior', 'layout.overscrollBehavior' ] },
	{ key: 'decoration', title: __( 'Content', 'blicks' ), icon: 'format_quote', tab: 'design', ids: [ 'decoration.content', 'decoration.counterReset', 'decoration.counterIncrement' ] },
	// Not "Advanced": WordPress already draws a panel by that name in the same sidebar.
	{ key: 'more', title: __( 'More', 'blicks' ), icon: 'settings', tab: 'design', ids: [ 'layout.visibility', 'layout.isolation', 'layout.containerType', 'layout.containerName', 'layout.contain', 'layout.contentVisibility', 'layout.containIntrinsicSize', 'layout.resize' ] },
	{ key: 'shadow', title: __( 'Shadow', 'blicks' ), icon: 'shadow', tab: 'effects', ids: [ 'effects.boxShadow', 'effects.textShadow' ] },
	{ key: 'look', title: __( 'Opacity and filters', 'blicks' ), icon: 'opacity', tab: 'effects', ids: [ 'effects.opacity', 'effects.blendMode', 'effects.filter', 'effects.backdropFilter' ] },
	{ key: 'transform', title: __( 'Transform', 'blicks' ), icon: 'open_with', tab: 'effects', ids: [ 'effects.transform', 'effects.transformOrigin', 'effects.perspective', 'effects.transformStyle', 'effects.backfaceVisibility' ] },
	{ key: 'shape', title: __( 'Clip and mask', 'blicks' ), icon: 'content_cut', tab: 'effects', ids: [ 'effects.clipPath', 'effects.mask' ] },
	{ key: 'pointer', title: __( 'Outline and cursor', 'blicks' ), icon: 'ads_click', tab: 'effects', ids: [ 'effects.outline', 'effects.outlineOffset', 'effects.cursor' ] },
	{ key: 'transition', title: __( 'Transition', 'blicks' ), icon: 'line_curve', tab: 'motion', ids: [ 'effects.transition' ] },
	{ key: 'animation', title: __( 'Animation', 'blicks' ), icon: 'animation', tab: 'motion', ids: [ 'animation.name', 'animation.duration', 'animation.delay', 'animation.easing', 'animation.iteration', 'animation.direction', 'animation.fillMode', 'animation.playState', 'animation.target' ] },
	{ key: 'entrance', title: __( 'Scroll timeline', 'blicks' ), icon: 'swipe_up', tab: 'motion', ids: [ 'animation.timeline', 'animation.range' ] },
];

/**
 * Every tab the panel can show: the engine's three, plus Quick (a v2 block's own panels, the ones
 * the post editor draws) or Settings (a block still on the rail inspector, behind the gear).
 */
export type PanelTab = TabId | 'quick' | 'settings';

/**
 * The tab to open on, from the one last used on any block. Quick and Settings stand in for each
 * other — both hold the block's own controls — so moving between a v2 block and a rail block keeps
 * the person on "its own controls" rather than dropping them onto Design.
 */
export function resolveTab( last: PanelTab, has: { quick: boolean; settings: boolean } ): PanelTab {
	if ( last === 'quick' || last === 'settings' ) {
		if ( has.quick ) return 'quick';
		if ( has.settings ) return 'settings';
		return 'design';
	}
	return last;
}

export const TABS: ReadonlyArray< [ TabId, string, string ] > = [
	[ 'design', __( 'Design', 'blicks' ), 'tune' ],
	[ 'effects', __( 'Effects', 'blicks' ), 'auto_awesome' ],
	[ 'motion', __( 'Motion', 'blicks' ), 'animation' ],
];

/** The sections open on first sight, besides any that hold a value. */
export const OPEN_BY_DEFAULT = [ 'layout', 'size', 'space', 'text', 'shadow', 'transition' ];

export const groupOf = ( id: string ): Group | undefined => GROUPS.find( ( g ) => g.ids.includes( id ) );
export const groupsIn = ( tab: TabId ): Group[] => GROUPS.filter( ( g ) => g.tab === tab );
export const flagOf = ( id: string ): 'caution' | 'niche' | undefined => CONTROL_FLAGS[ id ];
export const shapeOf = ( id: string ): string => CONTROL_VALUES[ id ]?.shape ?? 'css';

/** Row names: by what the setting does, inside the section that already says what it is about. */
const LABEL: Record< string, string > = {
	'layout.flexDirection': __( 'Direction', 'blicks' ),
	'layout.justifyContent': __( 'Justify', 'blicks' ),
	'layout.alignItems': __( 'Align', 'blicks' ),
	'layout.gridColumns': __( 'Columns', 'blicks' ),
	'layout.gridRows': __( 'Rows', 'blicks' ),
	'layout.gridAutoRows': __( 'Auto rows', 'blicks' ),
	'layout.gridAutoFlow': __( 'Auto flow', 'blicks' ),
	'layout.gridAreas': __( 'Areas', 'blicks' ),
	'layout.group': __( 'Card', 'blicks' ),
	'layout.justifyItems': __( 'Justify items', 'blicks' ),
	'layout.alignContent': __( 'Align lines', 'blicks' ),
	'layout.flexWrap': __( 'Wrap', 'blicks' ),
	'layout.aspectRatio': __( 'Ratio', 'blicks' ),
	'layout.objectFit': __( 'Fit', 'blicks' ),
	'layout.lineClamp': __( 'Max lines', 'blicks' ),
	'position.type': __( 'Position', 'blicks' ),
	'position.zIndex': __( 'Stacking', 'blicks' ),
	'position.inset': __( 'Offsets', 'blicks' ),
	'typography.role': __( 'Type role', 'blicks' ),
	'typography.fontFamily': __( 'Font', 'blicks' ),
	'typography.fontStyle': __( 'Style', 'blicks' ),
	'typography.textDecoration': __( 'Decoration', 'blicks' ),
	'typography.decorationColor': __( 'Line color', 'blicks' ),
	'typography.textTransform': __( 'Case', 'blicks' ),
	'typography.textAlign': __( 'Align', 'blicks' ),
	'typography.whiteSpace': __( 'White space', 'blicks' ),
	'typography.textOverflow': __( 'Overflow', 'blicks' ),
	'colors.text': __( 'Color', 'blicks' ),
	'colors.background': __( 'Fill', 'blicks' ),
	'colors.clipText': __( 'Clip to text', 'blicks' ),
	'background.layers': __( 'Layers', 'blicks' ),
	'border.radius': __( 'Corners', 'blicks' ),
	'border.width': __( 'Width', 'blicks' ),
	'border.style': __( 'Style', 'blicks' ),
	'border.color': __( 'Color', 'blicks' ),
	'columns.columnCount': __( 'Count', 'blicks' ),
	'columns.columnWidth': __( 'Width', 'blicks' ),
	'columns.columnGap': __( 'Gap', 'blicks' ),
	'columns.breakInside': __( 'Break inside', 'blicks' ),
	'gridChild.columnSpan': __( 'Columns', 'blicks' ),
	'gridChild.rowSpan': __( 'Rows', 'blicks' ),
	'gridChild.gridArea': __( 'Area', 'blicks' ),
	'gridChild.alignSelf': __( 'Align', 'blicks' ),
	'gridChild.justifySelf': __( 'Justify', 'blicks' ),
	'gridChild.scrollSnapAlign': __( 'Snap', 'blicks' ),
	'flexChild.alignSelf': __( 'Align', 'blicks' ),
	'layout.overflowX': __( 'Overflow X', 'blicks' ),
	'layout.overflowY': __( 'Overflow Y', 'blicks' ),
	'layout.scrollSnapType': __( 'Snap', 'blicks' ),
	'layout.scrollSnapStop': __( 'Snap stop', 'blicks' ),
	'layout.scrollBehavior': __( 'Scrolling', 'blicks' ),
	'layout.overscrollBehavior': __( 'Overscroll', 'blicks' ),
	'decoration.content': __( 'Content', 'blicks' ),
	'decoration.counterReset': __( 'Counter reset', 'blicks' ),
	'decoration.counterIncrement': __( 'Counter step', 'blicks' ),
	'layout.containerType': __( 'Container', 'blicks' ),
	'layout.containerName': __( 'Container name', 'blicks' ),
	'layout.contentVisibility': __( 'Render', 'blicks' ),
	'layout.containIntrinsicSize': __( 'Placeholder size', 'blicks' ),
	'layout.boxSizing': __( 'Box sizing', 'blicks' ),
	'effects.boxShadow': __( 'Box shadow', 'blicks' ),
	'effects.textShadow': __( 'Text shadow', 'blicks' ),
	'effects.blendMode': __( 'Blend', 'blicks' ),
	'effects.backdropFilter': __( 'Backdrop', 'blicks' ),
	'effects.transformOrigin': __( 'Origin', 'blicks' ),
	'effects.transformStyle': __( '3D children', 'blicks' ),
	'effects.backfaceVisibility': __( 'Back face', 'blicks' ),
	'effects.clipPath': __( 'Clip', 'blicks' ),
	'effects.outlineOffset': __( 'Offset', 'blicks' ),
	'animation.name': __( 'Animation', 'blicks' ),
	'animation.iteration': __( 'Repeat', 'blicks' ),
	'animation.fillMode': __( 'Fill mode', 'blicks' ),
	'animation.playState': __( 'Playing', 'blicks' ),
	'animation.target': __( 'Runs on', 'blicks' ),
	'animation.timeline': __( 'Timeline', 'blicks' ),
	'animation.range': __( 'Range', 'blicks' ),
};

/** A row's name in the panel; All settings' own name where the panel has none. */
export const rowLabelOf = ( id: string ): string => LABEL[ id ] ?? labelOf( id );

/* ------------------------------------------------------------------ what a block can take */

/** The free controls a block's `supports.blicks.controls` allows (`x.*` wildcards); all when absent. */
export function allowedIds( controls?: readonly string[] ): Set< string > {
	const allowed = ( id: string ) => ! controls || controls.includes( id ) || controls.includes( `${ id.split( '.' )[ 0 ] }.*` );
	return new Set( FREE_IDS.filter( allowed ) );
}

/**
 * What the panel shows for this block, state and part: its allow-list, narrowed to what the state
 * may change (`STATE_CONTROLS`) and to what a ::before or ::after takes (`PART_CONTROLS`).
 */
export function visibleIds( controls: readonly string[] | undefined, state: string, part: string ): Set< string > {
	let ids = [ ...allowedIds( controls ) ];
	const forState = STATE_CONTROLS[ state ];
	if ( forState ) ids = ids.filter( ( id ) => forState.includes( id ) );
	if ( part !== ELEMENT ) ids = ids.filter( ( id ) => PART_CONTROLS.includes( id ) );
	return new Set( ids );
}

/* ------------------------------------------------------------------ what a setting depends on */

const OFF = new Set( [ '', 'none', 'normal', 'static', 'initial', 'unset', 'visible' ] );
const on = ( v: unknown ): boolean => v !== undefined && v !== null && ! OFF.has( String( v ).trim() );
const flexy = ( v: unknown ): boolean => /flex/.test( String( v ?? '' ) );
const griddy = ( v: unknown ): boolean => /grid/.test( String( v ?? '' ) );

/**
 * When a relation's source value switches its targets on, keyed `from>first target`. The schema
 * says which settings depend on which; it does not say which values count, so that lives here.
 * Unlisted relations count any value that is not a "nothing" keyword.
 */
const GATES: Record< string, ( v: unknown ) => boolean > = {
	'layout.display>layout.flexDirection': flexy,
	'layout.display>layout.gridColumns': griddy,
	'layout.display>layout.gapRow': ( v ) => flexy( v ) || griddy( v ),
	'layout.display>gridChild.columnSpan': griddy,
	'layout.display>flexChild.grow': flexy,
	'layout.display>columns.columnCount': ( v ) => flexy( v ) || griddy( v ),
	'layout.overflow>layout.scrollSnapType': ( v ) => /auto|scroll/.test( String( v ?? '' ) ),
	'layout.contentVisibility>layout.containIntrinsicSize': ( v ) => v === 'auto',
	'typography.writingMode>typography.textOrientation': ( v ) => /vertical|sideways/.test( String( v ?? '' ) ),
	'animation.name>animation.target': ( v ) => v === 'bl-fill',
	'animation.timeline>animation.range': ( v ) => on( v ) && v !== 'auto',
};
const gateOf = ( from: string, to: readonly string[] ) => GATES[ `${ from }>${ to[ 0 ] }` ] ?? on;

export interface Moot {
	/** `off`: the setting does nothing here. `clash`: another value overrides it. */
	kind: 'off' | 'clash';
	/** The setting it depends on or clashes with. */
	from: string;
	/** The schema's reason, as written there. */
	note: string;
}

/**
 * Whether a setting does anything, from the schema's `RELATIONS`: an `enables` target is off until
 * its source holds a value that switches it on, an `enablesChildren` target is off until the parent
 * block's source does, and a `conflicts` target clashes once its source is set. `read` gives the
 * block's own value as it applies here; `readParent` the parent block's.
 */
export function mootOf( id: string, read: ( id: string ) => unknown, readParent: ( id: string ) => unknown ): Moot | null {
	for ( const r of RELATIONS ) {
		if ( ! r.to.includes( id ) ) continue;
		const gate = gateOf( r.from, r.to );
		if ( r.kind === 'enables' && ! gate( read( r.from ) ) ) return { kind: 'off', from: r.from, note: r.note };
		if ( r.kind === 'enablesChildren' && ! gate( readParent( r.from ) ) ) return { kind: 'off', from: r.from, note: r.note };
	}
	for ( const r of RELATIONS ) {
		if ( r.kind === 'conflicts' && r.to.includes( id ) && gateOf( r.from, r.to )( read( r.from ) ) ) return { kind: 'clash', from: r.from, note: r.note };
	}
	return null;
}

/* ------------------------------------------------------------------ where a value comes from */

export interface Where {
	part: string;
	state: string;
	breakpoint: string;
}

export const BASE: Where = { part: ELEMENT, state: 'default', breakpoint: 'base' };

/** A narrower screen falls back to the next wider one, then to desktop. */
export const BP_FALLBACK: Record< string, readonly string[] > = { base: [ 'base' ], tablet: [ 'tablet', 'base' ], mobile: [ 'mobile', 'tablet', 'base' ] };

/** Text settings a child takes from its parent when it sets none of its own. */
export const INHERITS: ReadonlySet< string > = new Set( [ 'colors.text', 'typography.fontFamily', 'typography.fontSize', 'typography.lineHeight', 'typography.letterSpacing', 'typography.fontWeight', 'typography.fontStyle', 'typography.textAlign', 'typography.textTransform', 'typography.wordSpacing', 'typography.whiteSpace', 'typography.writingMode' ] );

const at = ( tree: Tree, id: string, slot: string ): Record< string, unknown > | undefined => tree?.[ id ]?.[ slot ];

/** The value a slot has on this screen, from the nearest screen that sets it. */
export function resolve( tree: Tree, id: string, slot: string, breakpoint: string ): { value: unknown; breakpoint: string } | null {
	const byBp = at( tree, id, slot );
	if ( ! byBp ) return null;
	for ( const bp of BP_FALLBACK[ breakpoint ] ?? [ breakpoint ] ) if ( byBp[ bp ] !== undefined ) return { value: byBp[ bp ], breakpoint: bp };
	return null;
}

export interface Info {
	/** Set here: this part, state and screen. */
	set: boolean;
	/** The value it will get: set here, or where it falls back to. */
	value: unknown;
	/** Why an unset value is what it is: a wider screen, the Normal state, or a parent block. */
	why?: 'bp' | 'normal' | 'parent';
	/** `bp`: the screen the value comes from. */
	breakpoint?: string;
	/** `parent`: the index in `ancestors` (nearest first) of the block that sets it. */
	from?: number;
}

/**
 * What a setting is here, and when it is not set here, what it falls back to: a wider screen, then
 * the Normal state (or the part's own Normal), then — for text settings on the block itself — the
 * nearest parent that sets it. `ancestors` are the parents' trees, nearest first.
 */
export function infoOf( tree: Tree, id: string, where: Where, ancestors: readonly Tree[] = [] ): Info {
	const slot = slotKey( where.part, where.state );
	const here = at( tree, id, slot )?.[ where.breakpoint ];
	if ( here !== undefined ) return { set: true, value: here };
	const wider = resolve( tree, id, slot, where.breakpoint );
	if ( wider ) return { set: false, value: wider.value, why: 'bp', breakpoint: wider.breakpoint };
	if ( where.state !== 'default' ) {
		const normal = resolve( tree, id, slotKey( where.part, 'default' ), where.breakpoint );
		if ( normal ) return { set: false, value: normal.value, why: 'normal' };
	}
	if ( where.part === ELEMENT && INHERITS.has( id ) ) {
		for ( let i = 0; i < ancestors.length; i++ ) {
			const parent = resolve( ancestors[ i ]!, id, 'default', where.breakpoint );
			if ( parent ) return { set: false, value: parent.value, why: 'parent', from: i };
		}
	}
	return { set: false, value: undefined };
}

/** Whether a narrower screen than this one has its own value for the setting. */
export function narrower( tree: Tree, id: string, where: Where ): boolean {
	const byBp = at( tree, id, slotKey( where.part, where.state ) );
	if ( ! byBp ) return false;
	if ( where.breakpoint === 'base' ) return byBp.tablet !== undefined || byBp.mobile !== undefined;
	return where.breakpoint === 'tablet' && byBp.mobile !== undefined;
}

/* ------------------------------------------------------------------ counts */

const styleIds = ( tree: Tree ): string[] => Object.keys( tree ?? {} ).filter( ( id ) => ! id.startsWith( 'meta.' ) );

/** Settings the block sets anywhere, for "N of M". */
export const setCountOf = ( tree: Tree ): number => styleIds( tree ).length;

/** Settings set anywhere among a tab's controls. */
export function tabCountOf( tree: Tree, tab: TabId ): number {
	const ids = new Set( groupsIn( tab ).flatMap( ( g ) => g.ids ) );
	return styleIds( tree ).filter( ( id ) => ids.has( id ) ).length;
}

/** Settings with a value in this part and state, on any screen. */
export const stateCountOf = ( tree: Tree, part: string, state: string ): number => styleIds( tree ).filter( ( id ) => at( tree, id, slotKey( part, state ) ) ).length;

/** Settings with a value in this part and state on exactly this screen. */
export const screenCountOf = ( tree: Tree, part: string, state: string, breakpoint: string ): number =>
	styleIds( tree ).filter( ( id ) => at( tree, id, slotKey( part, state ) )?.[ breakpoint ] !== undefined ).length;

/** Whether the block has a value in any state but Normal, or on a narrower screen (Layers' markers). */
export const hasStateValues = ( tree: Tree ): boolean => entriesOf( tree ).some( ( e ) => e.state !== 'default' );
export const hasScreenValues = ( tree: Tree ): boolean => entriesOf( tree ).some( ( e ) => e.breakpoint !== 'base' );

/* ------------------------------------------------------------------ Find */

/** A row's name outside its section, for Find: "Border · Width". */
export function findLabelOf( id: string ): string {
	const row = rowLabelOf( id );
	const section = groupOf( id )?.title;
	return section && section !== row ? `${ section } · ${ row }` : row;
}

/** A theme variable by its slug: `var(--blicks-color-border)` reads "border". */
const tokenWords = ( text: string ): string => text.replace( /var\(--blicks-[a-zA-Z]+-([\w-]+)\)/g, '$1' ).replace( /var\(--wp--preset--[\w-]+--([\w-]+)\)/g, '$1' );

/** A value in as few words as CSS shorthand would use: four equal sides read as one. */
export function shortTextOf( id: string, value: unknown ): string {
	const keys = keysOf( id );
	if ( keys && value && typeof value === 'object' && ! Array.isArray( value ) ) {
		const v = keys.map( ( k ) => tokenWords( String( ( value as Record< string, unknown > )[ k ] ?? '0' ) ) );
		if ( v.every( ( x ) => x === v[ 0 ] ) ) return v[ 0 ]!;
		if ( v[ 0 ] === v[ 2 ] && v[ 1 ] === v[ 3 ] ) return `${ v[ 0 ] } ${ v[ 1 ] }`;
		return v.join( ' ' );
	}
	return tokenWords( textOf( id, value ) );
}

export interface Match {
	id: string;
	part: string;
	state: string;
	breakpoint: string;
	/** The value as the panel writes it. */
	text: string;
	label: string;
}

/**
 * The values in one block that a Find query hits: by the setting's name, its CSS property, its id,
 * the state or screen, or the value itself. "border" hits every border value and every radius.
 */
export function matchesOf( tree: Tree, query: string ): Match[] {
	const q = query.trim().toLowerCase();
	if ( ! q ) return [];
	return entriesOf( tree ).flatMap( ( e ) => {
		const text = textOf( e.id, e.value );
		const hay = [ rowLabelOf( e.id ), labelOf( e.id ), propertyOf( e.id ), e.id, e.part === ELEMENT ? '' : e.part, e.state === 'default' ? '' : e.state, e.breakpoint === 'mobile' ? 'phone' : e.breakpoint === 'base' ? '' : e.breakpoint, text ].join( ' ' ).toLowerCase();
		return hay.includes( q ) ? [ { id: e.id, part: e.part, state: e.state, breakpoint: e.breakpoint, text: shortTextOf( e.id, e.value ), label: findLabelOf( e.id ) } ] : [];
	} );
}

/* ------------------------------------------------------------------ typed input */

const UNITLESS = new Set( [ 'layout.lineClamp', 'position.zIndex', 'flexChild.grow', 'flexChild.shrink', 'gridChild.order', 'flexChild.order', 'columns.columnCount', 'typography.lineHeight', 'typography.fontWeight', 'effects.opacity', 'animation.iteration', 'gridChild.columnSpan', 'gridChild.rowSpan' ] );
const MS = new Set( [ 'animation.duration', 'animation.delay' ] );
const NO_UNIT_TOKENS = [ 'color', 'opacity', 'zIndex', 'aspect', 'fontFamily', 'transition', 'filter', 'leading', 'shadow' ];
const PX_IDS = new Set( [ 'typography.letterSpacing', 'typography.wordSpacing', 'effects.outlineOffset', 'effects.perspective' ] );

/** The unit a bare number typed into this setting means: px for lengths, ms for times, none else. */
export function unitOf( id: string ): string {
	if ( UNITLESS.has( id ) ) return '';
	if ( MS.has( id ) ) return 'ms';
	if ( PX_IDS.has( id ) ) return 'px';
	const spec = CONTROL_VALUES[ id ];
	if ( spec && [ 'tokenOrCss', 'sides', 'corners', 'inset' ].includes( spec.shape ) && spec.tokens && ! NO_UNIT_TOKENS.includes( spec.tokens ) ) return 'px';
	return '';
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** What was typed into a field, as the value to write: a bare number gets the setting's unit. */
export function parseInput( id: string, raw: string ): string | undefined {
	const s = raw.trim();
	if ( ! s ) return undefined;
	const unit = unitOf( id );
	if ( NUMBER.test( s ) && unit && ! ( Number( s ) === 0 && unit !== 'ms' ) ) return s + unit;
	return s;
}

/** A length split into number and unit for a field, or the whole text when it is not one. */
export function splitUnit( value: unknown ): [ string, string ] {
	const s = value === undefined || value === null ? '' : String( value );
	const m = /^(-?(?:\d+\.?\d*|\.\d+))(px|em|rem|%|ch|vw|vh|ms|s|deg|fr)$/.exec( s );
	return m ? [ m[ 1 ]!, m[ 2 ]! ] : [ s, '' ];
}

/** One value for every side or corner of a four-sided setting; anything else unchanged. */
export function everySide( id: string, value: unknown ): unknown {
	const keys = keysOf( id );
	return keys && typeof value !== 'object' && value !== undefined ? Object.fromEntries( keys.map( ( k ) => [ k, value ] ) ) : value;
}

/** A four-sided value with one side changed; an unset side becomes `0`, as CSS shorthand would. */
export function withSide( id: string, current: unknown, side: string, value: string | undefined ): unknown {
	const keys = keysOf( id ) ?? [];
	const base: Record< string, unknown > = current && typeof current === 'object' ? { ...( current as Record< string, unknown > ) } : Object.fromEntries( keys.map( ( k ) => [ k, current ?? '0' ] ) );
	base[ side ] = value ?? '0';
	return base;
}

/* ------------------------------------------------------------------ keyword lists */

/** Keywords for plain CSS settings, by property: a short list is buttons, a long one a dropdown. */
export const KEYWORDS: Record< string, readonly string[] > = {
	display: [ 'block', 'flex', 'grid', 'inline-flex', 'inline-block', 'inline', 'contents', 'none' ],
	'flex-wrap': [ 'nowrap', 'wrap', 'wrap-reverse' ],
	'align-content': [ 'start', 'center', 'end', 'space-between', 'space-around', 'stretch' ],
	'justify-items': [ 'start', 'center', 'end', 'stretch' ],
	'grid-auto-flow': [ 'row', 'column', 'dense', 'row dense', 'column dense' ],
	'object-fit': [ 'fill', 'contain', 'cover', 'none', 'scale-down' ],
	'box-sizing': [ 'border-box', 'content-box' ],
	position: [ 'static', 'relative', 'absolute', 'fixed', 'sticky' ],
	'font-weight': [ '100', '200', '300', '400', '500', '600', '700', '800', '900' ],
	'font-style': [ 'normal', 'italic' ],
	'text-decoration': [ 'none', 'underline', 'line-through', 'overline' ],
	'text-wrap': [ 'wrap', 'balance', 'pretty', 'nowrap' ],
	'white-space': [ 'normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces' ],
	'text-overflow': [ 'clip', 'ellipsis' ],
	'writing-mode': [ 'horizontal-tb', 'vertical-rl', 'vertical-lr' ],
	'text-orientation': [ 'mixed', 'upright', 'sideways' ],
	'background-size': [ 'auto', 'cover', 'contain' ],
	'background-position': [ 'center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right' ],
	'background-repeat': [ 'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round' ],
	'background-attachment': [ 'scroll', 'fixed', 'local' ],
	'background-blend-mode': [ 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color', 'luminosity' ],
	'background-clip': [ 'border-box', 'padding-box', 'content-box', 'text' ],
	'column-count': [ '1', '2', '3', '4' ],
	'break-inside': [ 'auto', 'avoid' ],
	'align-self': [ 'auto', 'start', 'center', 'end', 'stretch', 'baseline' ],
	'justify-self': [ 'auto', 'start', 'center', 'end', 'stretch' ],
	'scroll-snap-align': [ 'none', 'start', 'center', 'end' ],
	overflow: [ 'visible', 'hidden', 'clip', 'auto', 'scroll' ],
	'overflow-x': [ 'visible', 'hidden', 'clip', 'auto', 'scroll' ],
	'overflow-y': [ 'visible', 'hidden', 'clip', 'auto', 'scroll' ],
	'scroll-snap-type': [ 'none', 'x mandatory', 'y mandatory', 'x proximity', 'y proximity' ],
	'scroll-snap-stop': [ 'normal', 'always' ],
	'scroll-behavior': [ 'auto', 'smooth' ],
	'overscroll-behavior': [ 'auto', 'contain', 'none' ],
	visibility: [ 'visible', 'hidden', 'collapse' ],
	isolation: [ 'auto', 'isolate' ],
	'container-type': [ 'normal', 'inline-size', 'size' ],
	contain: [ 'none', 'layout', 'paint', 'content', 'strict' ],
	'content-visibility': [ 'visible', 'auto', 'hidden' ],
	resize: [ 'none', 'both', 'horizontal', 'vertical' ],
	'mix-blend-mode': [ 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion', 'color', 'luminosity' ],
	'transform-origin': [ 'center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right' ],
	'transform-style': [ 'flat', 'preserve-3d' ],
	'backface-visibility': [ 'visible', 'hidden' ],
	cursor: [ 'auto', 'default', 'pointer', 'text', 'move', 'grab', 'not-allowed', 'help', 'zoom-in' ],
	'animation-timing-function': [ 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out' ],
	'animation-direction': [ 'normal', 'reverse', 'alternate', 'alternate-reverse' ],
	'animation-fill-mode': [ 'none', 'forwards', 'backwards', 'both' ],
	'animation-play-state': [ 'running', 'paused' ],
	'animation-timeline': [ 'auto', 'view()', 'scroll()' ],
};

/** The keyword list a setting picks from, by its CSS property. */
export const keywordsOf = ( id: string ): readonly string[] | undefined => KEYWORDS[ propertyOf( id ) ];

const KW_LABEL: Record< string, string > = {
	'view()': __( 'Scrolls into view', 'blicks' ),
	'scroll()': __( 'Page scroll', 'blicks' ),
	100: __( 'Thin', 'blicks' ),
	200: __( 'Extra light', 'blicks' ),
	300: __( 'Light', 'blicks' ),
	400: __( 'Regular', 'blicks' ),
	500: __( 'Medium', 'blicks' ),
	600: __( 'Semibold', 'blicks' ),
	700: __( 'Bold', 'blicks' ),
	800: __( 'Extra bold', 'blicks' ),
	900: __( 'Black', 'blicks' ),
};

/** `space-between` → "Space between". */
export const keywordLabel = ( k: string ): string => KW_LABEL[ k ] ?? ( k.charAt( 0 ).toUpperCase() + k.slice( 1 ) ).replace( /-/g, ' ' );

/* ------------------------------------------------------------------ settings edited as parts */

/** Split on a separator outside parentheses: `rgba(0, 0, 0, .4)` stays one token. */
export function splitTop( text: string, separator: ' ' | ',' ): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for ( const ch of text ) {
		if ( ch === '(' ) depth++;
		else if ( ch === ')' ) depth--;
		if ( depth === 0 && ( separator === ' ' ? /\s/.test( ch ) : ch === separator ) ) {
			if ( cur.trim() ) out.push( cur.trim() );
			cur = '';
			continue;
		}
		cur += ch;
	}
	if ( cur.trim() ) out.push( cur.trim() );
	return out;
}

/** `blur(4px) saturate(1.2)` as ordered function/argument pairs. */
function functionsOf( text: string ): Array< [ string, string ] > {
	return splitTop( text, ' ' ).map( ( t ) => {
		const m = /^([\w-]+)\((.*)\)$/.exec( t );
		return m ? ( [ m[ 1 ]!, m[ 2 ]! ] as [ string, string ] ) : ( [ t, '' ] as [ string, string ] );
	} );
}

type Parts = Record< string, string >;
const obj = ( v: unknown ): Record< string, unknown > | null => ( v && typeof v === 'object' && ! Array.isArray( v ) ? ( v as Record< string, unknown > ) : null );
const str = ( v: unknown ): string => ( v === undefined || v === null ? '' : String( v ) );

export interface Composite {
	/** The parts, in the order the panel shows them, with the unit a bare number means. */
	parts: ReadonlyArray< [ key: string, unit: string ] >;
	read: ( value: unknown ) => Parts;
	/** The value with one part changed; anything else the value holds is kept. Undefined when empty. */
	write: ( value: unknown, key: string, part: string | undefined ) => unknown;
}

/** A filter-like string: change one function, keep the others where they are. */
function functionList( names: readonly string[] ): Composite['read'] {
	return ( value ) => {
		const o = obj( value );
		if ( o ) return Object.fromEntries( names.map( ( n ) => [ n, str( o[ n ] ) ] ) );
		const fns = functionsOf( str( value ) );
		return Object.fromEntries( names.map( ( n ) => [ n, fns.find( ( [ f ] ) => f === n )?.[ 1 ] ?? '' ] ) );
	};
}

function writeFunction( value: unknown, key: string, part: string | undefined ): string | undefined {
	const fns = functionsOf( str( value ) ).filter( ( [ f ] ) => f !== 'none' );
	const at = fns.findIndex( ( [ f ] ) => f === key );
	if ( part === undefined ) {
		if ( at >= 0 ) fns.splice( at, 1 );
	} else if ( at >= 0 ) fns[ at ] = [ key, part ];
	else fns.push( [ key, part ] );
	const text = fns.map( ( [ f, a ] ) => ( a || /\(/.test( f ) ? `${ f }(${ a })` : f ) ).join( ' ' );
	return text || undefined;
}

/** An object-shaped value: change one key, keep the rest. A raw string becomes the object. */
function writeKey( read: Composite['read'] ) {
	return ( value: unknown, key: string, part: string | undefined ): unknown => {
		const next: Record< string, unknown > = { ...( obj( value ) ?? Object.fromEntries( Object.entries( read( value ) ).filter( ( [ , v ] ) => v !== '' ) ) ) };
		if ( part === undefined ) delete next[ key ];
		else next[ key ] = part;
		return Object.keys( next ).length ? next : undefined;
	};
}

function readShadow( value: unknown ): Parts {
	const layer = obj( Array.isArray( value ) ? value[ 0 ] : value );
	if ( layer ) return { x: str( layer.x ), y: str( layer.y ), blur: str( layer.blur ), spread: str( layer.spread ), color: str( layer.color ) };
	return { x: '', y: '', blur: '', spread: '', color: '' };
}

function writeShadow( value: unknown, key: string, part: string | undefined ): unknown {
	const layers = Array.isArray( value ) ? [ ...value ] : obj( value ) ? [ value ] : [];
	const first: Record< string, unknown > = { ...( obj( layers[ 0 ] ) ?? {} ) };
	// A theme shadow (a token string) edited by hand becomes a layer of its own.
	delete first.token;
	if ( part === undefined ) delete first[ key ];
	else first[ key ] = part;
	if ( first.x === undefined && first.y === undefined && first.blur === undefined && first.spread === undefined ) return layers.length > 1 ? layers.slice( 1 ) : undefined;
	first.x ??= '0';
	first.y ??= '0';
	layers[ 0 ] = first;
	return layers.length === 1 ? layers[ 0 ] : layers;
}

function readTransform( value: unknown ): Parts {
	const o = obj( value );
	if ( o ) return { translateX: str( o.translateX ), translateY: str( o.translateY ), rotate: str( o.rotate ), scale: str( o.scale ) };
	const s = str( value );
	const fn = ( name: string ) => new RegExp( `${ name }\\(([^)]+)\\)` ).exec( s )?.[ 1 ] ?? '';
	const both = /translate\(([^,)]+),?\s*([^)]*)\)/.exec( s );
	return { translateX: both ? both[ 1 ]!.trim() : fn( 'translateX' ), translateY: both ? both[ 2 ]!.trim() : fn( 'translateY' ), rotate: fn( 'rotate' ), scale: fn( 'scale' ) };
}

function readOutline( value: unknown ): Parts {
	const o = obj( value );
	if ( o ) return { width: str( o.width ), style: str( o.style ), color: str( o.color ) };
	const bits = splitTop( str( value ), ' ' );
	const isStyle = ( t: string ) => /^(solid|dashed|dotted|double|auto|none)$/.test( t );
	return { width: bits.find( ( t ) => /^[\d.]/.test( t ) ) ?? '', style: bits.find( isStyle ) ?? '', color: bits.filter( ( t ) => ! /^[\d.]/.test( t ) && ! isStyle( t ) ).join( ' ' ) };
}

export const COMPOSITES: Record< string, Composite > = {
	'effects.boxShadow': { parts: [ [ 'x', 'px' ], [ 'y', 'px' ], [ 'blur', 'px' ], [ 'spread', 'px' ] ], read: readShadow, write: writeShadow },
	'effects.textShadow': { parts: [ [ 'x', 'px' ], [ 'y', 'px' ], [ 'blur', 'px' ] ], read: readShadow, write: writeShadow },
	'effects.transform': { parts: [ [ 'translateX', 'px' ], [ 'translateY', 'px' ], [ 'rotate', 'deg' ], [ 'scale', '' ] ], read: readTransform, write: writeKey( readTransform ) },
	'effects.filter': { parts: [ [ 'blur', 'px' ], [ 'brightness', '%' ], [ 'saturate', '%' ], [ 'grayscale', '%' ] ], read: functionList( [ 'blur', 'brightness', 'saturate', 'grayscale' ] ), write: writeFunction },
	'effects.backdropFilter': { parts: [ [ 'blur', 'px' ], [ 'saturate', '' ] ], read: functionList( [ 'blur', 'saturate' ] ), write: writeKey( functionList( [ 'blur', 'brightness', 'saturate', 'contrast' ] ) ) },
	'effects.outline': { parts: [ [ 'width', 'px' ], [ 'style', '' ], [ 'color', '' ] ], read: readOutline, write: writeKey( readOutline ) },
};

/** A part as typed, with its unit when it is a bare number. */
export function parsePart( raw: string, unit: string ): string | undefined {
	const s = raw.trim();
	if ( ! s ) return undefined;
	return NUMBER.test( s ) && unit && Number( s ) !== 0 ? s + unit : s;
}

/** What a transition is said to change, by the properties it names. */
export const CHANGES: ReadonlyArray< [ key: string, props: readonly string[] ] > = [
	[ 'colours', [ 'background', 'color', 'border-color' ] ],
	[ 'movement', [ 'transform' ] ],
	[ 'shadow', [ 'box-shadow' ] ],
];

export interface TransitionParts {
	duration: string;
	ease: string;
	changes: string[];
}

const TIME = /^-?[\d.]+m?s$/;

export function readTransition( value: unknown ): TransitionParts {
	const layers = splitTop( str( value ), ',' ).map( ( l ) => splitTop( l, ' ' ) );
	const props = layers.map( ( l ) => l[ 0 ] ?? '' );
	const first = layers[ 0 ] ?? [];
	return {
		duration: first.find( ( t ) => TIME.test( t ) ) ?? '',
		ease: first.slice( 1 ).find( ( t ) => ! TIME.test( t ) ) ?? '',
		changes: CHANGES.filter( ( [ , ps ] ) => props.includes( 'all' ) || ps.some( ( p ) => props.includes( p ) ) ).map( ( [ k ] ) => k ),
	};
}

/** A transition from its parts: one layer per property the chosen changes name. */
export function writeTransition( parts: TransitionParts ): string | undefined {
	if ( ! parts.changes.length ) return undefined;
	const props = CHANGES.filter( ( [ k ] ) => parts.changes.includes( k ) ).flatMap( ( [ , ps ] ) => ps );
	return props.map( ( p ) => `${ p } ${ parts.duration || '200ms' } ${ parts.ease || 'ease-out' }` ).join( ', ' );
}

/** The tree's slot a Find hit or a door opens on, as panel coordinates. */
export const whereOf = ( slot: string, breakpoint: string ): Where => {
	const [ part, state ] = splitSlot( slot );
	return { part, state, breakpoint };
};
