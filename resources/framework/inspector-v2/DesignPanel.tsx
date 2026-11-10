/**
 * The Studio design panel: every style setting the engine has for the selected block, by section,
 * with the control that suits it. It replaces the Style tab's quick choices in the Studio only;
 * the post editor keeps those, with a door here when a block has values they cannot show.
 *
 * It reads and writes the block's `blicks` tree, one value at a time (`setEntry`), and every value
 * goes through the engine's own validator first: a refused value is not saved, and the row says
 * why. Nothing new is stored, so what the panel writes renders the same on the page.
 *
 * Model: `design-model.ts`. Controls: `design-controls.tsx`. Styles: `design-panel.scss`, drawn in
 * the Blicks UI system.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { buildElementStyle } from '@/framework/css/vars';
import { tokenOptions } from '@/controls/token-utils';
import { CONTROL_VALUES, STATE_CONTROLS } from '@/engine/schema.gen';
import { BREAKPOINTS, ELEMENT, entriesOf, keysOf, msOf, PARTS, problemOf, propertyOf, quickSourceOf, setEntry, textOf, tokensOf, valueOf } from './all-settings-model';
import { BP_NAME, PART_NAME, STATE_NAME, WHY } from './labels';
import {
	allowedIds,
	BASE,
	COMPOSITES,
	flagOf,
	groupOf,
	groupsIn,
	infoOf,
	keywordLabel,
	keywordsOf,
	mootOf,
	narrower,
	OPEN_BY_DEFAULT,
	parseInput,
	readTransition,
	resolve,
	resolveTab,
	rowLabelOf,
	screenCountOf,
	setCountOf,
	shapeOf,
	stateCountOf,
	tabCountOf,
	TABS,
	unitOf,
	visibleIds,
	type Info,
	type Moot,
	type PanelTab,
	type TabId,
	type Where,
} from './design-model';
import { exposeDesignPanel, onFocusRequest, requestFocus, takeFocus, takeTab } from './design-focus';
import { BoxModel, Colour, Fld, LengthField, PartField, Sel, Seg, Shadow, Sym, Transition, useShow, type Choice, type Ctl } from './design-controls';
import type { Tree } from './style-model';
import './design-panel.scss';

exposeDesignPanel();

const STATE_ICON: Record< string, string > = {
	default: 'crop_square',
	hover: 'arrow_selector_tool',
	focus: 'keyboard',
	active: 'touch_app',
	group: 'dashboard',
	groupActive: 'dashboard',
	on: 'touch_app',
	groupOn: 'dashboard',
	play: 'play_arrow',
	reduced: 'motion_photos_off',
};
const BP_ICON: Record< string, string > = { base: 'desktop_windows', tablet: 'tablet_mac', mobile: 'smartphone' };
const PART_ICON: Record< string, string > = { [ ELEMENT ]: 'check_box_outline_blank', before: 'flip_to_back', after: 'flip_to_front' };
const TYPE_ICON: Record< string, string > = {
	box: 'check_box_outline_blank',
	section: 'check_box_outline_blank',
	stack: 'view_agenda',
	grid: 'grid_view',
	text: 'notes',
	heading: 'title',
	buttons: 'smart_button',
	button: 'smart_button',
	image: 'image',
	list: 'list',
	steps: 'format_list_numbered',
};

/** What the panel was showing, kept across blocks: picking another block keeps the tab and state. */
let sticky: { tab: PanelTab; where: Where; only: boolean } = { tab: 'quick', where: BASE, only: false };

interface Ancestor {
	clientId: string;
	name: string;
	tree: Tree;
}

/** The parents of a block, nearest first, with the name the panel calls them. */
function useAncestors( clientId: string ): Ancestor[] {
	const ids: string[] = useSelect( ( select: any ) => select( blockEditorStore ).getBlockParents( clientId ), [ clientId ] );
	// The store's own references (a name string, an attributes object), so an unchanged parent
	// compares equal and does not re-render the panel.
	const names: Array< string | null > = useSelect( ( select: any ) => ids.map( ( id ) => select( blockEditorStore ).getBlockName( id ) ), [ ids ] );
	const attrs: Array< Record< string, any > | null > = useSelect( ( select: any ) => ids.map( ( id ) => select( blockEditorStore ).getBlockAttributes( id ) ), [ ids ] );
	return useMemo(
		() => ids.map( ( id, i ) => ( { clientId: id, name: nameOf( names[ i ] ?? '', attrs[ i ] ?? {} ), tree: attrs[ i ]?.blicks ?? {} } ) ).reverse(),
		[ ids, names, attrs ]
	);
}

const nameOf = ( blockName: string, attributes: Record< string, any > ): string => attributes?.metadata?.name || ( getBlockType( blockName ) as any )?.title || blockName;

/**
 * Show the block in another state for a moment: the state's values written over Normal, through the
 * engine's own class and variable builder, on the element in the canvas — so its transition runs
 * as it would on the page. Nothing is saved; the element is put back as it was.
 */
function playState( clientId: string, attributes: Record< string, any >, state: string, breakpoint: string ): boolean {
	const docs: Array< Document | null > = [ document, ...Array.from( document.querySelectorAll( 'iframe' ) ).map( ( f ) => {
		try {
			return f.contentDocument;
		} catch {
			return null;
		}
	} ) ];
	const el = docs.map( ( d ) => d?.getElementById( `block-${ clientId }` ) ).find( Boolean ) as HTMLElement | undefined;
	if ( ! el ) return false;
	const tree: Tree = attributes.blicks ?? {};
	let preview = tree;
	for ( const e of entriesOf( tree ) ) if ( e.part === ELEMENT && e.state === state ) preview = setEntry( preview, e.id, ELEMENT, 'default', e.breakpoint, e.value );
	const opts = { uniqueId: attributes.uniqueId };
	const now = buildElementStyle( tree, opts );
	const then = buildElementStyle( preview, opts );
	const className = el.className;
	const style = el.getAttribute( 'style' );
	now.classes.forEach( ( c ) => el.classList.remove( c ) );
	then.classes.forEach( ( c ) => el.classList.add( c ) );
	Object.entries( then.vars ).forEach( ( [ k, v ] ) => el.style.setProperty( k, v ) );
	const run = msOf( readTransition( infoOf( tree, 'effects.transition', { ...BASE, breakpoint } ).value ).duration ) ?? 200;
	window.setTimeout( () => {
		el.className = className;
		if ( style === null ) el.removeAttribute( 'style' );
		else el.setAttribute( 'style', style );
	}, Math.min( 3000, Math.max( 900, run + 700 ) ) );
	return true;
}

export function DesignPanel( { attributes, setAttributes, clientId, name, quick, settings, look }: {
	attributes: Record< string, any >;
	setAttributes: ( a: Record< string, unknown > ) => void;
	clientId: string;
	name: string;
	/** A v2 block's own panels, the post editor's choices by name: the first tab, Quick. */
	quick?: ReactNode;
	/** A rail-inspector block's own settings (tag, link, more), behind the gear in the last tab. */
	settings?: ReactNode;
	/** The block's Quick look (`InspectorPanels.look`): rows a Quick choice wrote say so. */
	look?: { kind: string; linked?: boolean };
} ) {
	const tree: Tree = attributes.blicks ?? {};
	const supports = ( getBlockType( name )?.supports as any )?.blicks ?? {};
	const controls: string[] | undefined = supports.controls;
	const blockStates: string[] = supports.states ?? [ 'default' ];
	const ancestors = useAncestors( clientId );
	const { selectBlock } = useDispatch( blockEditorStore ) as any;

	const [ tab, setTabState ] = useState< PanelTab >( () => resolveTab( sticky.tab, { quick: !! quick, settings: !! settings } ) );
	// Quick and Settings hold the block's own controls; the engine's state and screen do not apply.
	const own = tab === 'quick' || tab === 'settings';
	const [ where, setWhereState ] = useState< Where >( sticky.where );
	const [ only, setOnlyState ] = useState( sticky.only );
	const [ open, setOpen ] = useState< Record< string, boolean > >( {} );
	const [ more, setMore ] = useState< Record< string, boolean > >( {} );
	const [ pop, setPop ] = useState< string | null >( null );
	const [ flash, setFlash ] = useState< string | null >( null );
	const [ refused, setRefused ] = useState< { id: string; why: string } | null >( null );
	const [ adding, setAdding ] = useState( '' );
	const [ played, setPlayed ] = useState< boolean | null >( null );
	const sheet = useRef< HTMLDivElement >( null );

	const setTab = ( t: PanelTab ) => {
		sticky = { ...sticky, tab: t };
		setTabState( t );
		setPop( null );
	};
	const setWhere = ( w: Where ) => {
		sticky = { ...sticky, where: w };
		setWhereState( w );
		setPop( null );
		setRefused( null );
	};
	const setOnly = ( o: boolean ) => {
		sticky = { ...sticky, only: o };
		setOnlyState( o );
	};

	// A state this block does not take (sticky from another block) falls back to Normal.
	const state = blockStates.includes( where.state ) ? where.state : 'default';
	const here: Where = { ...where, state };
	const vis = useMemo( () => visibleIds( controls, state, where.part ), [ controls, state, where.part ] );
	const allowed = useMemo( () => allowedIds( controls ), [ controls ] );
	// A tab with nothing this block takes is not offered (a header row has no Motion), unless a
	// value somehow sits in it, which must stay reachable to be cleared.
	const tabs = TABS.filter( ( [ k ] ) => tabCountOf( tree, k ) > 0 || groupsIn( k ).some( ( g ) => g.ids.some( ( id ) => allowed.has( id ) ) ) );
	const hidden = ! own && tabs.length > 0 && ! tabs.some( ( [ k ] ) => k === tab );
	useEffect( () => {
		if ( hidden ) setTabState( tabs[ 0 ][ 0 ] );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ hidden ] );
	const info = ( id: string ): Info => infoOf( tree, id, here, ancestors.map( ( a ) => a.tree ) );
	// The schema's relations: a setting that does nothing here (a flex field on a block that is not
	// flex, a grid child's span outside a grid) is left out unless it holds a value to clear.
	const moot = ( id: string ): Moot | null =>
		mootOf( id, ( x ) => info( x ).value, ( x ) => ( ancestors[ 0 ] ? resolve( ancestors[ 0 ].tree, x, 'default', here.breakpoint )?.value : undefined ) );

	/** Write one value here, or remove it; the engine's validator decides whether it is saved. */
	const write = ( id: string, value: unknown ) => {
		if ( value !== undefined ) {
			const reason = problemOf( id, here.part, here.state, here.breakpoint, value, controls );
			if ( reason ) {
				setRefused( { id, why: WHY[ reason ] } );
				return;
			}
		}
		setRefused( null );
		setFlash( id );
		setAttributes( { blicks: setEntry( tree, id, here.part, here.state, here.breakpoint, value ) } );
	};

	/** Open on one value: its tab, its section (and its fold), then scroll to it and flash it. */
	const reveal = ( id: string ) => {
		const g = groupOf( id );
		if ( ! g ) return;
		setTab( g.tab );
		setOpen( ( o ) => ( { ...o, [ g.key ]: true } ) );
		if ( flagOf( id ) === 'niche' ) setMore( ( m ) => ( { ...m, [ g.key ]: true } ) );
		setFlash( id );
		window.requestAnimationFrame( () => sheet.current?.querySelector( `[data-row~="${ id }"]` )?.scrollIntoView( { block: 'center' } ) );
	};

	// A Find hit or a door asked for a value in this block.
	useEffect( () => {
		const take = () => {
			const t = takeTab( clientId );
			if ( t ) setTab( resolveTab( t, { quick: !! quick, settings: !! settings } ) );
			const f = takeFocus( clientId );
			if ( ! f ) return;
			setWhere( { part: f.part, state: f.state, breakpoint: f.breakpoint } );
			setOnly( false );
			reveal( f.id );
		};
		take();
		return onFocusRequest( take );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ clientId ] );

	const blockSlug = name.replace( /^blicks\//, '' );
	const crumbs = [ ...ancestors ].reverse();

	return (
		<div className="bui bui-dp" data-type={ blockSlug }>
			<div className="bui-dp-top">
			<div className="bui-dp-head">
				{ crumbs.length > 0 && (
					<nav className="bui-crumbs" aria-label={ __( 'Parents', 'blicks' ) }>
						{ crumbs.map( ( a ) => (
							<span key={ a.clientId }>
								<button type="button" onClick={ () => selectBlock( a.clientId ) }>{ a.name }</button>
								<Sym name="chevron_right" className="sm" />
							</span>
						) ) }
					</nav>
				) }
				<div className="bui-who">
					<Sym name={ TYPE_ICON[ blockSlug ] ?? 'check_box_outline_blank' } />
					<strong>{ nameOf( name, attributes ) }</strong>
					<code>{ name }</code>
					<span className="cnt" title={ __( 'Settings set · settings this block takes', 'blicks' ) }>
						{ sprintf( /* translators: 1: settings set, 2: settings the block takes */ __( '%1$d of %2$d', 'blicks' ), setCountOf( tree ), allowed.size ) }
					</span>
				</div>
				<div className={ `bui-tabs${ settings ? ' has-settings' : '' }` } role="tablist" aria-label={ __( 'Design panel', 'blicks' ) }>
					{ quick && (
						<button type="button" role="tab" aria-selected={ tab === 'quick' } title={ __( 'The choices the post editor shows', 'blicks' ) } onClick={ () => setTab( 'quick' ) }>
							<Sym name="bolt" />
							<span>{ __( 'Quick', 'blicks' ) }</span>
						</button>
					) }
					{ tabs.map( ( [ k, label, icon ] ) => {
						const n = tabCountOf( tree, k );
						return (
							<button key={ k } type="button" role="tab" aria-selected={ tab === k } onClick={ () => setTab( k ) }>
								<Sym name={ icon } />
								<span>{ label }</span>
								{ n > 0 && <em className="bui-badge">{ n }</em> }
							</button>
						);
					} ) }
					{ settings && (
						<button type="button" role="tab" aria-selected={ tab === 'settings' } aria-label={ __( 'Block settings', 'blicks' ) } title={ __( 'Block settings', 'blicks' ) } onClick={ () => setTab( 'settings' ) }>
							<Sym name="settings" />
						</button>
					) }
				</div>
			</div>
			{ tab === 'quick' && <p className="bui-sum bui-dp-qnote">{ __( 'The post editor’s choices. They set the resting look on every screen.', 'blicks' ) }</p> }
			{ ! own && <Context tree={ tree } where={ here } setWhere={ setWhere } states={ blockStates } only={ only } setOnly={ setOnly } parts={ allowed.has( 'decoration.content' ) } /> }
			</div>

			{ tab === 'quick' ? (
				<div className="bui-dp-settings">{ quick }</div>
			) : tab === 'settings' ? (
				<div className="bui-dp-settings">{ settings }</div>
			) : (
				<>
					<div className="bui-dp-sheet" ref={ sheet }>
						{ tab === 'motion' && (
							<div className="bui-play">
								<button
									type="button"
									className="bui-btn primary"
									onClick={ () => setPlayed( playState( clientId, attributes, here.state === 'default' ? 'hover' : here.state, here.breakpoint ) ) }
								>
									<Sym name="play_arrow" />
									{ sprintf( /* translators: %s: a state, e.g. Hover */ __( 'Play %s', 'blicks' ), STATE_NAME[ here.state === 'default' ? 'hover' : here.state ] ) }
								</button>
								<span>{ played === false ? __( 'This block is not on the canvas.', 'blicks' ) : __( 'Runs the transition once on the canvas.', 'blicks' ) }</span>
							</div>
						) }
						<Sheet
							tab={ tab }
							tree={ tree }
							where={ here }
							vis={ vis }
							only={ only }
							info={ info }
							moot={ moot }
							write={ write }
							refused={ refused }
							pop={ pop }
							setPop={ setPop }
							open={ open }
							setOpen={ setOpen }
							more={ more }
							setMore={ setMore }
							flash={ flash }
							kind={ blockSlug }
							quickOf={ ( id ) => ( look ? quickSourceOf( tree, look, id, here ) : null ) }
							ancestors={ ancestors }
							onJump={ ( a, id ) => {
								requestFocus( { clientId: a.clientId, id, ...BASE } );
								selectBlock( a.clientId );
							} }
						/>
						{ only && <AddSetting tab={ tab } vis={ vis } info={ info } query={ adding } setQuery={ setAdding } onPick={ ( id ) => {
							setAdding( '' );
							setOnly( false );
							reveal( id );
						} } /> }
						<p className="bui-legend">
							<span><b>{ __( 'Blue', 'blicks' ) }</b> { __( 'set on this block', 'blicks' ) }</span>
							<span>{ __( 'Gray: where it falls back to', 'blicks' ) }</span>
							<span><Sym name="smartphone" className="sm" /> { __( 'changes on a smaller screen', 'blicks' ) }</span>
							<span><Sym name="warning" className="sm" /> { __( 'use with care', 'blicks' ) }</span>
						</p>
					</div>
				</>
			) }
		</div>
	);
}

/** State, screen, part, and whether to show every setting or only those set. */
function Context( { tree, where, setWhere, states, only, setOnly, parts }: {
	tree: Tree;
	where: Where;
	setWhere: ( w: Where ) => void;
	states: string[];
	only: boolean;
	setOnly: ( o: boolean ) => void;
	parts: boolean;
} ) {
	const list = Object.keys( STATE_NAME ).filter( ( s ) => states.includes( s ) || stateCountOf( tree, where.part, s ) > 0 );
	return (
		<div className="bui-ctx">
			<div className="r">
				<label className="bui-select lead" title={ __( 'State', 'blicks' ) }>
					<Sym name={ STATE_ICON[ where.state ] ?? 'crop_square' } className="sm" />
					<select value={ where.state } aria-label={ __( 'State', 'blicks' ) } onChange={ ( e ) => setWhere( { ...where, state: e.currentTarget.value } ) }>
						{ list.map( ( s ) => {
							const n = stateCountOf( tree, where.part, s );
							return <option key={ s } value={ s }>{ n ? `${ STATE_NAME[ s ] } · ${ n }` : STATE_NAME[ s ] }</option>;
						} ) }
					</select>
					<Sym name="expand_more" className="sm" />
				</label>
				<div className="bui-seg" role="group" aria-label={ __( 'Screen size', 'blicks' ) }>
					{ BREAKPOINTS.map( ( bp ) => {
						const n = screenCountOf( tree, where.part, where.state, bp );
						return (
							<button key={ bp } type="button" aria-pressed={ where.breakpoint === bp } title={ BP_NAME[ bp ] } onClick={ () => setWhere( { ...where, breakpoint: bp } ) }>
								<Sym name={ BP_ICON[ bp ]! } label={ BP_NAME[ bp ] } />
								{ bp !== 'base' && n > 0 && <sup>{ n }</sup> }
							</button>
						);
					} ) }
				</div>
			</div>
			<div className="r">
				{ parts ? (
					<div className="bui-seg" role="group" aria-label={ __( 'Part', 'blicks' ) }>
						{ [ ELEMENT, ...PARTS ].map( ( p ) => (
							<button key={ p } type="button" aria-pressed={ where.part === p } onClick={ () => setWhere( { ...where, part: p } ) }>
								<Sym name={ PART_ICON[ p ]! } className="sm" />
								<span>{ PART_NAME[ p ] }</span>
							</button>
						) ) }
					</div>
				) : <span /> }
				<div className="bui-seg" role="group" aria-label={ __( 'Show', 'blicks' ) }>
					<button type="button" aria-pressed={ ! only } onClick={ () => setOnly( false ) }>{ __( 'All', 'blicks' ) }</button>
					<button type="button" aria-pressed={ only } onClick={ () => setOnly( true ) }>{ __( 'Set', 'blicks' ) }</button>
				</div>
			</div>
		</div>
	);
}

interface SheetProps {
	tab: TabId;
	tree: Tree;
	where: Where;
	vis: Set< string >;
	only: boolean;
	info: ( id: string ) => Info;
	/** Whether the schema's relations make a setting do nothing here, or clash with another. */
	moot: ( id: string ) => Moot | null;
	write: ( id: string, value: unknown ) => void;
	refused: { id: string; why: string } | null;
	pop: string | null;
	setPop: ( id: string | null ) => void;
	open: Record< string, boolean >;
	setOpen: ( f: ( o: Record< string, boolean > ) => Record< string, boolean > ) => void;
	more: Record< string, boolean >;
	setMore: ( f: ( m: Record< string, boolean > ) => Record< string, boolean > ) => void;
	flash: string | null;
	kind: string;
	/** The Quick section that wrote a value in the current slot, or null. */
	quickOf: ( id: string ) => string | null;
	ancestors: Ancestor[];
	onJump: ( a: Ancestor, id: string ) => void;
}

/** The tab's sections. A section shows its common settings; niche ones wait behind "N more". */
function Sheet( props: SheetProps ) {
	const { tab, only, info, moot, open, setOpen, more, setMore, where } = props;
	const vis = new Set( [ ...props.vis ].filter( ( id ) => info( id ).set || moot( id )?.kind !== 'off' ) );
	const groups = groupsIn( tab ).filter( ( g ) => g.ids.some( ( id ) => vis.has( id ) ) );
	if ( ! groups.length ) {
		const why = where.state !== 'default' ? __( 'This block takes none of these in this state.', 'blicks' ) : where.part !== ELEMENT ? __( 'A decoration takes none of these.', 'blicks' ) : __( 'This block takes none of these.', 'blicks' );
		return <div className="bui-empty"><Sym name={ TABS.find( ( t ) => t[ 0 ] === tab )![ 2 ] } /><span>{ why }</span></div>;
	}
	const total = groups.reduce( ( n, g ) => n + g.ids.filter( ( id ) => vis.has( id ) ).length, 0 );
	const forState = STATE_CONTROLS[ where.state ];
	const sections = groups.map( ( g ) => {
		const shown = g.ids.filter( ( id ) => vis.has( id ) );
		const set = shown.filter( ( id ) => info( id ).set );
		const common = shown.filter( ( id ) => flagOf( id ) !== 'niche' || info( id ).set );
		const niche = shown.filter( ( id ) => ! common.includes( id ) );
		const list = only ? set : more[ g.key ] ? [ ...common, ...niche ] : common;
		if ( only && ! set.length ) return null;
		const isOpen = only || ( open[ g.key ] ?? ( set.length > 0 || OPEN_BY_DEFAULT.includes( g.key ) ) );
		return (
			<section key={ g.key } className={ `bui-sec${ isOpen ? '' : ' closed' }` }>
				<h3>
					<button type="button" className="bui-sec-h" aria-expanded={ isOpen } onClick={ () => setOpen( ( o ) => ( { ...o, [ g.key ]: ! isOpen } ) ) }>
						<Sym name={ g.icon } />
						{ g.title }
						{ set.length > 0 && <em className="bui-badge">{ set.length }</em> }
						<span className="tot">{ shown.length }</span>
						<Sym name="expand_more" className="chev sm" />
					</button>
				</h3>
				{ isOpen && (
					<div className="bui-sec-b">
						{ rowsOf( list, vis ).map( ( ids ) => <Row key={ ids[ 0 ] } { ...props } ids={ ids } label={ ids.length > 1 ? PAIRS[ ids[ 0 ]! ]!.label : rowLabelOf( ids[ 0 ]! ) } /> ) }
						{ ! only && niche.length > 0 && (
							<button type="button" className="bui-more" aria-expanded={ !! more[ g.key ] } onClick={ () => setMore( ( m ) => ( { ...m, [ g.key ]: ! m[ g.key ] } ) ) }>
								<Sym name={ more[ g.key ] ? 'expand_less' : 'expand_more' } className="sm" />
								{ more[ g.key ]
									? __( 'Fewer', 'blicks' )
									: sprintf( /* translators: 1: number of settings, 2: their names */ _n( '%1$d more: %2$s', '%1$d more: %2$s', niche.length, 'blicks' ), niche.length, niche.map( rowLabelOf ).join( ', ' ) ) }
							</button>
						) }
					</div>
				) }
			</section>
		);
	} );
	return (
		<>
			<p className="bui-sum">
				{ sprintf( /* translators: 1: settings, 2: sections */ __( '%1$d settings in %2$d sections', 'blicks' ), total, groups.length ) }
				{ forState ? ` · ${ sprintf( /* translators: 1: a state, 2: number of settings */ __( '%1$s takes %2$d', 'blicks' ), STATE_NAME[ where.state ], forState.length ) }` : '' }
			</p>
			{ sections.some( Boolean ) ? sections : <div className="bui-empty"><Sym name="crop_square" /><span>{ __( 'Nothing set here yet.', 'blicks' ) }</span></div> }
		</>
	);
}

/* ------------------------------------------------------------------ rows */

/** Settings shown together in one row, under one name. */
const PAIRS: Record< string, { ids: string[]; label: string } > = {
	'layout.gapRow': { ids: [ 'layout.gapRow', 'layout.gapColumn' ], label: __( 'Gap', 'blicks' ) },
	'layout.width': { ids: [ 'layout.width', 'layout.height' ], label: __( 'Size', 'blicks' ) },
	'layout.minWidth': { ids: [ 'layout.minWidth', 'layout.maxWidth' ], label: __( 'Width limits', 'blicks' ) },
	'layout.minHeight': { ids: [ 'layout.minHeight', 'layout.maxHeight' ], label: __( 'Height limits', 'blicks' ) },
	'spacing.margin': { ids: [ 'spacing.margin', 'spacing.padding' ], label: '' },
	'typography.fontSize': { ids: [ 'typography.fontSize', 'typography.fontWeight' ], label: __( 'Size', 'blicks' ) },
	'typography.lineHeight': { ids: [ 'typography.lineHeight', 'typography.letterSpacing' ], label: __( 'Spacing', 'blicks' ) },
	'animation.duration': { ids: [ 'animation.duration', 'animation.delay' ], label: __( 'Timing', 'blicks' ) },
};
/** Rows whose control takes the full width, under their name. */
const STACKED = new Set( [ 'effects.boxShadow', 'effects.textShadow', 'effects.filter', 'effects.backdropFilter', 'effects.transform', 'effects.outline', 'effects.transition' ] );
const SIDE_ICON: Record< string, string > = { top: 'border_top', right: 'border_right', bottom: 'border_bottom', left: 'border_left', topLeft: 'north_west', topRight: 'north_east', bottomRight: 'south_east', bottomLeft: 'south_west' };
const RATIOS: Array< [ string, string ] > = [ [ 'auto', __( 'Auto', 'blicks' ) ], [ '1 / 1', '1:1' ], [ '4 / 3', '4:3' ], [ '3 / 2', '3:2' ], [ '16 / 9', '16:9' ], [ '21 / 9', '21:9' ], [ '4 / 5', '4:5' ] ];
const TARGETS: Array< [ string, string ] > = [ [ 'self', __( 'This block', 'blicks' ) ], [ 'children', __( 'Each child, in turn', 'blicks' ) ], [ 'letters', __( 'Each letter', 'blicks' ) ], [ 'words', __( 'Each word', 'blicks' ) ] ];

/** The animations the design system offers, as the post editor's Motion tab lists them. */
const animations = (): Array< [ string, string ] > => {
	const list = ( window as unknown as { blicksEditorSettings?: { animations?: Array< { name?: string; label?: string } > } } ).blicksEditorSettings?.animations;
	return ( Array.isArray( list ) ? list : [] ).filter( ( a ) => a?.name ).map( ( a ) => [ a.name!, a.label || a.name! ] );
};

/**
 * The section's settings as rows: a paired setting brings its partner into one row (when the block
 * takes it and it is in the list), and is not drawn again on its own.
 */
function rowsOf( list: string[], vis: Set< string > ): string[][] {
	const used = new Set< string >();
	const rows: string[][] = [];
	for ( const id of list ) {
		if ( used.has( id ) ) continue;
		const pairs = Object.values( PAIRS ).find( ( p ) => p.ids.includes( id ) );
		const ids = ( pairs ? pairs.ids : [ id ] ).filter( ( x ) => vis.has( x ) && list.includes( x ) );
		ids.forEach( ( x ) => used.add( x ) );
		if ( ids.length ) rows.push( ids );
	}
	return rows;
}

function Row( { ids, label, info, moot, write, refused, pop, setPop, flash, kind, quickOf, ancestors, onJump, where, tree }: SheetProps & { ids: string[]; label: string } ) {
	const first = ids[ 0 ]!;
	const show = useShow( first );
	const infos = ids.map( info );
	const set = infos.some( ( i ) => i.set );
	const ctl = ( x: string ): Ctl => ( { id: x, info: info( x ), write: ( v ) => write( x, v ), invalid: refused?.id === x } );
	const box = first === 'spacing.margin' || first === 'spacing.padding';
	const stacked = STACKED.has( first );
	const control = controlFor( first, ids, ctl, show, { pop, setPop, kind } );
	const fallback = infos.find( ( i ) => ! i.set && i.why );
	const flag = ids.map( flagOf ).find( Boolean );
	const phone = ids.some( ( x ) => narrower( tree, x, where ) );
	const fromQuick = set ? ids.map( quickOf ).find( Boolean ) : null;
	const bad = refused && ids.includes( refused.id ) ? refused.why : null;
	// Only a set value says it clashes or does nothing: an unset one that does nothing is not drawn.
	const clash = set ? ids.map( moot ).find( Boolean ) : null;
	const remove = (
		<button type="button" className="rm" aria-label={ sprintf( /* translators: %s: a setting */ __( 'Remove %s', 'blicks' ), label || rowLabelOf( first ) ) } title={ __( 'Remove', 'blicks' ) } onClick={ () => ids.forEach( ( x ) => info( x ).set && write( x, undefined ) ) }>
			<Sym name="close" className="sm" />
		</button>
	);
	const note = fallback && ! set ? (
		<div className="note">
			{ fallback.why === 'parent' && ancestors[ fallback.from! ] && (
				<>
					<Sym name="north_west" className="sm" />
					{ __( 'Set on', 'blicks' ) }
					<button type="button" onClick={ () => onJump( ancestors[ fallback.from! ]!, first ) }>{ ancestors[ fallback.from! ]!.name }</button>
				</>
			) }
			{ fallback.why === 'bp' && (
				<span className="bui-badge quiet"><Sym name={ BP_ICON[ fallback.breakpoint! ] ?? 'desktop_windows' } className="sm" />{ sprintf( /* translators: %s: a screen size */ __( '%s value', 'blicks' ), BP_NAME[ fallback.breakpoint! ] ) }</span>
			) }
			{ fallback.why === 'normal' && <span className="bui-badge quiet"><Sym name="crop_square" className="sm" />{ __( 'Same as Normal', 'blicks' ) }</span> }
		</div>
	) : null;
	const marks = (
		<>
			{ flag === 'caution' && <span className="mk warn" title={ __( 'Use with care: this can hide content or break the layout on some screens.', 'blicks' ) }><Sym name="warning" label={ __( 'Use with care', 'blicks' ) } className="sm" /></span> }
			{ phone && <span className="mk" title={ __( 'Changes on smaller screens', 'blicks' ) }><Sym name="smartphone" label={ __( 'Changes on smaller screens', 'blicks' ) } className="sm" /></span> }
		</>
	);
	const cls = `bui-row${ set ? ' set' : '' }${ stacked ? ' stack' : '' }${ box ? ' box' : '' }${ control.wide ? ' wide' : '' }${ ids.includes( flash ?? '' ) ? ' flash' : '' }`;
	const title = ids.map( propertyOf ).join( ' · ' );
	return (
		<div className={ cls } data-row={ ids.join( ' ' ) }>
			{ box ? (
				<div className="lb box-lb">
					<span>{ __( 'Space', 'blicks' ) }</span>
					{ marks }
					{ set && remove }
				</div>
			) : (
				<span className="lb" title={ title }>
					{ /* A section of one setting already says its name. */ }
					{ groupOf( first )?.title !== label && <span className="nm">{ label }</span> }
					{ marks }
					{ set && remove }
				</span>
			) }
			<div className="ctl">{ control.node }</div>
			{ note }
			{ fromQuick && (
				<div className="note from-quick">
					<Sym name="bolt" className="sm" />
					{ sprintf( /* translators: %s: a section of the Quick tab, e.g. Corners */ __( 'From Quick, %s', 'blicks' ), fromQuick ) }
				</div>
			) }
			{ clash && (
				<div className="note moot">
					<Sym name={ clash.kind === 'off' ? 'block' : 'swap_horiz' } className="sm" />
					{ clash.kind === 'off'
						? sprintf( /* translators: %s: the setting it depends on */ __( 'Does nothing until %s is set', 'blicks' ), rowLabelOf( clash.from ) )
						: sprintf( /* translators: %s: the setting it clashes with */ __( '%s overrides this', 'blicks' ), rowLabelOf( clash.from ) ) }
				</div>
			) }
			{ bad && <p className="bad" role="alert"><Sym name="warning" className="sm" />{ bad }</p> }
		</div>
	);
}

/** The control for a row: hand-built for the settings people reach for, else by value shape. */
function controlFor( id: string, ids: string[], ctl: ( x: string ) => Ctl, show: ( v: unknown ) => string, ui: { pop: string | null; setPop: ( id: string | null ) => void; kind: string } ): { node: ReactNode; wide?: boolean } {
	const len = ( x: string, lead?: ReactNode, side?: string ) => <LengthField key={ `${ x }${ side ?? '' }` } ctl={ ctl( x ) } lead={ lead } side={ side } label={ side ? `${ rowLabelOf( x ) } ${ side }` : rowLabelOf( x ) } defaultUnit={ unitOf( x ) } parse={ ( t ) => parseInput( x, t ) } show={ show } />;
	const seg = ( x: string, options: Choice[], text?: boolean ) => <Seg ctl={ ctl( x ) } options={ options } text={ text } />;
	const sel = ( x: string, options: Array< [ string, string ] > ) => <Sel ctl={ ctl( x ) } options={ options } label={ rowLabelOf( x ) } show={ show } />;
	const colour = ( x: string ) => {
		const c = ctl( x );
		return <Colour value={ c.info.value } set={ c.info.set } open={ ui.pop === x } onToggle={ () => ui.setPop( ui.pop === x ? null : x ) } onPick={ ( v ) => c.write( v ) } label={ rowLabelOf( x ) } invalid={ c.invalid } />;
	};
	const has = ( x: string ) => ids.includes( x );
	const icon = ( name: string ) => <Sym name={ name } className="sm" />;
	const kw = ( x: string ) => ( keywordsOf( x ) ?? [] ).map( ( k ) => [ k, keywordLabel( k ) ] as [ string, string ] );

	switch ( id ) {
		case 'layout.flexDirection':
			return { node: seg( id, [ [ 'column', 'south', __( 'Stack down', 'blicks' ) ], [ 'row', 'east', __( 'Side by side', 'blicks' ) ], [ 'column-reverse', 'north', __( 'Stack up', 'blicks' ) ], [ 'row-reverse', 'west', __( 'Side by side, reversed', 'blicks' ) ] ] ) };
		case 'layout.alignItems':
			return { node: seg( id, [ [ 'start', 'align_horizontal_left', __( 'Start', 'blicks' ) ], [ 'center', 'align_horizontal_center', __( 'Center', 'blicks' ) ], [ 'end', 'align_horizontal_right', __( 'End', 'blicks' ) ], [ 'stretch', 'width', __( 'Stretch', 'blicks' ) ], [ 'baseline', 'text_fields', __( 'Baseline', 'blicks' ) ] ] ) };
		case 'layout.justifyContent':
			return { node: seg( id, [ [ 'start', 'align_justify_flex_start', __( 'Start', 'blicks' ) ], [ 'center', 'align_justify_center', __( 'Center', 'blicks' ) ], [ 'end', 'align_justify_flex_end', __( 'End', 'blicks' ) ], [ 'space-between', 'align_justify_space_between', __( 'Space between', 'blicks' ) ] ] ) };
		case 'layout.gridColumns':
			return { node: <>{ seg( id, [ [ '1fr', '1', __( '1 column', 'blicks' ) ], [ '1fr 1fr', '2', __( '2 columns', 'blicks' ) ], [ 'repeat(3, 1fr)', '3', __( '3 columns', 'blicks' ) ], [ 'repeat(4, 1fr)', '4', __( '4 columns', 'blicks' ) ] ], true ) }{ len( id ) }</>, wide: true };
		case 'layout.gapRow':
		case 'layout.gapColumn':
			return { node: <>{ has( 'layout.gapRow' ) && len( 'layout.gapRow', icon( 'vertical_distribute' ) ) }{ has( 'layout.gapColumn' ) && len( 'layout.gapColumn', icon( 'horizontal_distribute' ) ) }</> };
		case 'layout.width':
		case 'layout.height':
			return { node: <>{ has( 'layout.width' ) && len( 'layout.width', 'W' ) }{ has( 'layout.height' ) && len( 'layout.height', 'H' ) }</> };
		case 'layout.minWidth':
		case 'layout.maxWidth':
			return { node: <>{ has( 'layout.minWidth' ) && len( 'layout.minWidth', __( 'Min', 'blicks' ) ) }{ has( 'layout.maxWidth' ) && len( 'layout.maxWidth', __( 'Max', 'blicks' ) ) }</> };
		case 'layout.minHeight':
		case 'layout.maxHeight':
			return { node: <>{ has( 'layout.minHeight' ) && len( 'layout.minHeight', __( 'Min', 'blicks' ) ) }{ has( 'layout.maxHeight' ) && len( 'layout.maxHeight', __( 'Max', 'blicks' ) ) }</> };
		case 'layout.aspectRatio':
			return { node: sel( id, RATIOS ) };
		case 'layout.group':
			return { node: seg( id, [ [ '', '—', __( 'Not a card', 'blicks' ) ], [ 'card', __( 'Card', 'blicks' ), __( 'A card: its children can react to its hover', 'blicks' ) ] ], true ) };
		case 'spacing.margin':
		case 'spacing.padding':
			return { node: <BoxModel margin={ has( 'spacing.margin' ) ? ctl( 'spacing.margin' ) : undefined } padding={ has( 'spacing.padding' ) ? ctl( 'spacing.padding' ) : undefined } kind={ ui.kind } show={ show } parse={ parseInput } />, wide: true };
		case 'typography.role':
			return { node: sel( id, ( CONTROL_VALUES[ id ]?.values ?? [] ).map( ( k ) => [ k, k.length <= 2 ? k.toUpperCase() : keywordLabel( k ) ] ) ) };
		case 'typography.fontFamily':
			return { node: sel( id, tokenOptions( 'fontFamily' as never ).map( ( t ) => [ t.value, t.label ] ) ) };
		case 'typography.fontSize':
		case 'typography.fontWeight':
			return { node: <>{ has( 'typography.fontSize' ) && len( 'typography.fontSize', icon( 'format_size' ) ) }{ has( 'typography.fontWeight' ) && sel( 'typography.fontWeight', kw( 'typography.fontWeight' ) ) }</> };
		case 'typography.lineHeight':
		case 'typography.letterSpacing':
			return { node: <>{ has( 'typography.lineHeight' ) && len( 'typography.lineHeight', icon( 'format_line_spacing' ) ) }{ has( 'typography.letterSpacing' ) && len( 'typography.letterSpacing', icon( 'format_letter_spacing' ) ) }</> };
		case 'typography.textAlign':
			return { node: seg( id, [ [ 'start', 'format_align_left', __( 'Left', 'blicks' ) ], [ 'center', 'format_align_center', __( 'Center', 'blicks' ) ], [ 'end', 'format_align_right', __( 'Right', 'blicks' ) ], [ 'justify', 'format_align_justify', __( 'Justify', 'blicks' ) ] ] ) };
		case 'typography.textTransform':
			return { node: seg( id, [ [ 'none', '—', __( 'As typed', 'blicks' ) ], [ 'uppercase', 'AA', __( 'Upper case', 'blicks' ) ], [ 'lowercase', 'aa', __( 'Lower case', 'blicks' ) ], [ 'capitalize', 'Aa', __( 'Capitalize', 'blicks' ) ] ], true ) };
		case 'typography.fontStyle':
			return { node: seg( id, [ [ 'normal', __( 'Upright', 'blicks' ), __( 'Upright', 'blicks' ) ], [ 'italic', __( 'Italic', 'blicks' ), __( 'Italic', 'blicks' ) ] ], true ) };
		case 'typography.textDecoration':
			return { node: seg( id, [ [ 'none', '—', __( 'None', 'blicks' ) ], [ 'underline', 'U', __( 'Underline', 'blicks' ) ], [ 'line-through', 'S', __( 'Strike through', 'blicks' ) ], [ 'overline', 'O', __( 'Overline', 'blicks' ) ] ], true ) };
		case 'border.style':
			return { node: sel( id, [ [ 'solid', __( 'Solid', 'blicks' ) ], [ 'dashed', __( 'Dashed', 'blicks' ) ], [ 'dotted', __( 'Dotted', 'blicks' ) ], [ 'double', __( 'Double', 'blicks' ) ], [ 'none', __( 'None', 'blicks' ) ] ] ) };
		case 'effects.boxShadow':
		case 'effects.textShadow': {
			const c = ctl( id );
			const parts = c.info.value;
			const layer = Array.isArray( parts ) ? parts[ 0 ] : parts;
			const colourValue = layer && typeof layer === 'object' ? ( layer as Record< string, unknown > ).color : undefined;
			const key = `${ id }:color`;
			return {
				node: <Shadow ctl={ c } colour={ <Colour value={ colourValue } set={ c.info.set && colourValue !== undefined } open={ ui.pop === key } onToggle={ () => ui.setPop( ui.pop === key ? null : key ) } onPick={ ( v ) => c.write( COMPOSITES[ id ]!.write( c.info.value, 'color', v ) ) } label={ __( 'Shadow color', 'blicks' ) } /> } />,
			};
		}
		case 'effects.opacity': {
			const c = ctl( id );
			const n = Number( c.info.value ?? 1 );
			return {
				node: (
					<span className="bui-slider">
						<input type="range" min={ 0 } max={ 1 } step={ 0.05 } value={ Number.isFinite( n ) ? n : 1 } aria-label={ rowLabelOf( id ) } onChange={ ( e ) => c.write( e.currentTarget.value ) } />
						{ len( id ) }
					</span>
				),
			};
		}
		case 'effects.filter':
			return { node: <div className="bui-grid2"><PartField ctl={ ctl( id ) } part="blur" lead={ icon( 'blur_on' ) } label={ __( 'Blur', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="brightness" lead={ icon( 'light_mode' ) } label={ __( 'Brightness', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="saturate" lead={ icon( 'palette' ) } label={ __( 'Saturation', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="grayscale" lead={ icon( 'filter_b_and_w' ) } label={ __( 'Grayscale', 'blicks' ) } /></div> };
		case 'effects.backdropFilter':
			return { node: <div className="bui-grid2"><PartField ctl={ ctl( id ) } part="blur" lead={ icon( 'blur_on' ) } label={ __( 'Blur behind', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="saturate" lead={ icon( 'palette' ) } label={ __( 'Saturation behind', 'blicks' ) } /></div> };
		case 'effects.transform':
			return { node: <div className="bui-grid2"><PartField ctl={ ctl( id ) } part="translateX" lead="X" label={ __( 'Move across', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="translateY" lead="Y" label={ __( 'Move down', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="rotate" lead={ icon( 'rotate_right' ) } label={ __( 'Rotate', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="scale" lead={ icon( 'zoom_in' ) } label={ __( 'Scale', 'blicks' ) } /></div> };
		case 'effects.outline':
			return { node: <div className="bui-grid2"><PartField ctl={ ctl( id ) } part="width" lead="W" label={ __( 'Width', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="style" lead={ icon( 'border_style' ) } label={ __( 'Style', 'blicks' ) } /><PartField ctl={ ctl( id ) } part="color" lead={ icon( 'format_color_fill' ) } label={ __( 'Color', 'blicks' ) } /></div> };
		case 'effects.transition':
			return { node: <Transition ctl={ ctl( id ) } /> };
		case 'animation.duration':
		case 'animation.delay':
			return { node: <>{ has( 'animation.duration' ) && len( 'animation.duration', icon( 'timer' ) ) }{ has( 'animation.delay' ) && len( 'animation.delay', icon( 'hourglass_empty' ) ) }</> };
		case 'animation.iteration':
			return { node: seg( id, [ [ '1', '1×', __( 'Once', 'blicks' ) ], [ '2', '2×', __( 'Twice', 'blicks' ) ], [ '3', '3×', __( 'Three times', 'blicks' ) ], [ 'infinite', '∞', __( 'Forever', 'blicks' ) ] ], true ) };
		case 'animation.target':
			return { node: sel( id, TARGETS ) };
		case 'animation.name':
			return { node: sel( id, animations() ) };
	}
	return generic( id, ctl, { colour, len, seg, sel, kw, icon } );
}

/** A control for any other setting, chosen by its value shape and its CSS property. */
function generic( id: string, ctl: ( x: string ) => Ctl, h: {
	colour: ( x: string ) => ReactNode;
	len: ( x: string, lead?: ReactNode, side?: string ) => ReactNode;
	seg: ( x: string, options: Choice[], text?: boolean ) => ReactNode;
	sel: ( x: string, options: Array< [ string, string ] > ) => ReactNode;
	kw: ( x: string ) => Array< [ string, string ] >;
	icon: ( name: string ) => ReactNode;
} ): { node: ReactNode; wide?: boolean } {
	const shape = shapeOf( id );
	if ( tokensOf( id ) === 'color' ) return { node: h.colour( id ) };
	if ( shape === 'enum' ) return { node: h.sel( id, ( CONTROL_VALUES[ id ]?.values ?? [] ).map( ( k ) => [ k, keywordLabel( k ) ] ) ) };
	const keys = keysOf( id );
	if ( keys ) return { node: <div className="bui-grid2">{ keys.map( ( k ) => h.len( id, h.icon( SIDE_ICON[ k ] ?? 'crop_square' ), k ) ) }</div>, wide: true };
	if ( [ 'gradient', 'backgroundLayers', 'clipPath', 'mask', 'content', 'image' ].includes( shape ) ) return { node: <CodeField ctl={ ctl( id ) } icon={ shape === 'content' ? 'format_quote' : shape === 'gradient' ? 'gradient' : shape === 'image' ? 'image' : 'code' } />, wide: true };
	const words = h.kw( id );
	// Buttons only while the words fit the track; a longer list, or longer words, is a dropdown.
	if ( words.length ) return { node: words.length <= 3 && words.reduce( ( n, [ , l ] ) => n + l.length, 0 ) <= 20 ? h.seg( id, words.map( ( [ k, l ] ) => [ k, l, l ] ), true ) : h.sel( id, words ) };
	return { node: h.len( id ) };
}

/** A structured or free value typed as CSS (or JSON for the few object values), read back the same way. */
function CodeField( { ctl, icon }: { ctl: Ctl; icon: string } ) {
	const text = textOf( ctl.id, ctl.info.set ? ctl.info.value : undefined );
	const fall = textOf( ctl.id, ctl.info.value );
	return (
		<span className="bui-code">
			<FldText value={ text } placeholder={ fall || '—' } icon={ icon } label={ rowLabelOf( ctl.id ) } invalid={ ctl.invalid } onCommit={ ( t ) => {
				const v = valueOf( ctl.id, t );
				if ( v === undefined && ! ctl.info.set ) return;
				ctl.write( v === null ? t : v );
			} } />
		</span>
	);
}

const FldText = ( { value, placeholder, icon, label, invalid, onCommit }: { value: string; placeholder: string; icon: string; label: string; invalid?: boolean; onCommit: ( t: string ) => void } ) => (
	<Fld value={ value } placeholder={ placeholder } lead={ <Sym name={ icon } className="sm" /> } label={ label } invalid={ invalid } wide onCommit={ onCommit } />
);

/** "Add a setting" under the Set list: any setting this tab has that is not set here yet. */
function AddSetting( { tab, vis, info, query, setQuery, onPick }: { tab: TabId; vis: Set< string >; info: ( id: string ) => Info; query: string; setQuery: ( q: string ) => void; onPick: ( id: string ) => void } ) {
	const ids = groupsIn( tab ).flatMap( ( g ) => g.ids ).filter( ( id ) => vis.has( id ) && ! info( id ).set );
	const q = query.trim().toLowerCase();
	const list = q ? ids.filter( ( id ) => `${ rowLabelOf( id ) } ${ propertyOf( id ) } ${ id }`.toLowerCase().includes( q ) ).slice( 0, 8 ) : [];
	return (
		<div className="bui-add">
			<label className="bui-search">
				<Sym name="search" className="sm" />
				<input type="search" value={ query } onChange={ ( e ) => setQuery( e.currentTarget.value ) } placeholder={ sprintf( /* translators: %d: number of settings */ __( 'Add a setting (%d more)', 'blicks' ), ids.length ) } aria-label={ __( 'Add a setting', 'blicks' ) } />
			</label>
			{ list.map( ( id ) => (
				<button key={ id } type="button" className="bui-opt" onClick={ () => onPick( id ) }>
					<span>{ rowLabelOf( id ) }</span>
					<code>{ propertyOf( id ) }</code>
				</button>
			) ) }
		</div>
	);
}
