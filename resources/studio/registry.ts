/**
 * What a companion plugin may add to the Studio.
 *
 * **Version 2** (2026-10-31) adds `registerSource` — an async shelf for the library — and gives rail
 * panels the selection and the Play clock. Every version-1 registration keeps its shape.
 *
 * **Version 3** (2026-11-04) lets a mode own more of the Studio: focus scopes (`focus()`,
 * `unfocus()`), a tree stored somewhere other than the post (`persist`, opened with `openRef()`),
 * its own phone form (`CanvasProps.compact`) and its own names in Layers (`tree`). Every field is
 * optional, so a version-2 mode registers unchanged.
 *
 * The Studio ships in the free plugin with one way of composing, the Section. Everything beyond it —
 * a Board and its Stage canvas, its patterns, an assistant in the rail — arrives through the four
 * registries here, published on `window.blicks.studio`. The Studio never names a feature it does not
 * ship: it asks these lists what exists.
 *
 * Every registration is validated and refused with a console error rather than thrown. A companion's
 * mistake must not be able to take the Studio down, and a refusal names what was wrong.
 *
 * A companion declares `blicks-studio` as a script dependency, so it runs after these exist and
 * before the Studio is first opened.
 */
import { useSyncExternalStore } from '@wordpress/element';
import type { ComponentType } from 'react';
import type { BlockNode } from './mount';
import type { PatternEntry } from './library';
import type { Keyframes } from './motion/keyframes';
import type { WidthId } from './modes/FlowMode';

/* ------------------------------------------------------------------ a small observable list */

interface Registry< T extends { id: string } > {
	register: ( item: unknown ) => boolean;
	unregister: ( id: string ) => void;
	list: () => readonly T[];
	use: () => readonly T[];
}

function registry< T extends { id: string } >( name: string, accept: ( item: Partial< T > ) => string ): Registry< T > {
	let items: readonly T[] = [];
	const listeners = new Set< () => void >();
	const emit = (): void => listeners.forEach( ( listener ) => listener() );
	const subscribe = ( listener: () => void ): ( () => void ) => {
		listeners.add( listener );
		return () => listeners.delete( listener );
	};
	const list = (): readonly T[] => items;

	return {
		register( item: unknown ): boolean {
			const candidate = ( item ?? {} ) as Partial< T >;
			const problem = typeof candidate.id !== 'string' || candidate.id.trim() === '' ? 'an id' : accept( candidate );
			if ( problem ) {
				console.error( `blicks: studio.${ name }() needs ${ problem }.`, item );
				return false;
			}
			items = [ ...items.filter( ( existing ) => existing.id !== candidate.id ), candidate as T ];
			emit();
			return true;
		},
		unregister( id: string ): void {
			const next = items.filter( ( existing ) => existing.id !== id );
			if ( next.length !== items.length ) {
				items = next;
				emit();
			}
		},
		list,
		use: () => useSyncExternalStore( subscribe, list ),
	};
}

const isFn = ( v: unknown ): boolean => typeof v === 'function';
const isText = ( v: unknown ): boolean => typeof v === 'string' && v.trim() !== '';

/* ------------------------------------------------------------------ modes */

/** What the shell hands a mode's canvas. */
export interface CanvasProps {
	/** The preview width the author picked, for a mode that offers widths. */
	width: WidthId;
	/** The canvas zoom, in percent. */
	zoom: number;
	/** Bumped each time Play is pressed; a mode that animates restarts on change. */
	playing: number;
	/**
	 * The preview is a phone. A mode with a phone form of its own (a header's drawer, a dialog's
	 * bottom sheet) draws that instead of its wide form at 390px. Since API 3.
	 */
	compact: boolean;
	/** The block the Studio is focused on, or null. Since API 3. */
	focus: FocusScope | null;
}

/* ------------------------------------------------------------------ focus scopes */

/**
 * One block the Studio is narrowed to: a header's mega panel, a dialog's content, a Loop's card.
 *
 * While a scope is set, Layers, the breadcrumb and the inserter show only that block's inner
 * blocks, and the rest of the canvas is dimmed; clicking it leaves. It is a view, not a separate
 * edit: Undo and the doors still act on the whole tree. Since API 3.
 */
export interface FocusScope {
	/** The block, by its client id in the mounted tree. */
	clientId: string;
	/** What the scope is called in Layers and the breadcrumb: "Products panel". */
	label: string;
	/** The button that leaves it: "Back to the header". */
	exitLabel: string;
}

/** The options `studio.focus()` takes. */
export interface FocusOptions {
	label: string;
	exitLabel?: string;
}

/**
 * A focus request checked the way registrations are: refused with a console error naming the
 * problem, never thrown. A missing exit label falls back to a generic one rather than refusing.
 */
export function focusScope( clientId: unknown, options: unknown, fallbackExit: string ): FocusScope | null {
	const opts = ( options ?? {} ) as Partial< FocusOptions >;
	const problem = ! isText( clientId ) ? 'a block client id' : ! isText( opts.label ) ? 'a label' : '';

	if ( problem ) {
		console.error( `blicks: studio.focus() needs ${ problem }.`, clientId, options );
		return null;
	}

	return {
		clientId: clientId as string,
		label: ( opts.label as string ).trim(),
		exitLabel: isText( opts.exitLabel ) ? ( opts.exitLabel as string ).trim() : fallbackExit,
	};
}

/* ------------------------------------------------------------------ persistence */

/**
 * Where a stored tree is, in the persisting mode's own terms: `{ kind: 'template-part', id: … }`.
 * Plain JSON, so it can travel in an address. The shell never reads inside it.
 */
export type StudioRef = Record< string, unknown >;

/** What loading a stored tree yields: its blocks, and optionally what to call it. */
export interface PersistLoad {
	blocks: BlockNode[];
	/** What the chrome calls it ("Main header"). Falls back to the mode's label. */
	label?: string;
	/** A line under it: "Used on 12 pages". */
	note?: string;
}

/**
 * A mode whose tree lives somewhere other than the post that opened the Studio: a template part,
 * a saved dialog. The Studio's filled door becomes `label` and calls `save` instead of Insert, and
 * the Studio stays open afterwards. Since API 3.
 */
export interface StudioPersist {
	/** The door: "Save header". */
	label: string;
	load: ( ref: StudioRef ) => Promise< PersistLoad >;
	/** Resolve when stored; reject with an Error whose message a person can act on. */
	save: ( blocks: BlockNode[], ref: StudioRef ) => Promise< unknown >;
}

/* ------------------------------------------------------------------ mode tree */

/**
 * A row in Layers as a mode names it. The rows still follow the block tree and select by client
 * id; a node only renames its block ("Top bar", "Products · Mega"). Since API 3.
 */
export interface TreeNode {
	clientId: string;
	label: string;
	/** A short note after the label: "Mega", "3 areas". */
	note?: string;
	children?: TreeNode[];
}

/** A mode's tree as a lookup by client id. Anything malformed is skipped, never thrown. */
export function treeLabels( nodes: unknown ): Map< string, { label: string; note: string } > {
	const out = new Map< string, { label: string; note: string } >();

	const walk = ( list: unknown ): void => {
		if ( ! Array.isArray( list ) ) {
			return;
		}

		for ( const node of list as Partial< TreeNode >[] ) {
			if ( node && isText( node.clientId ) && isText( node.label ) ) {
				out.set( node.clientId as string, { label: ( node.label as string ).trim(), note: isText( node.note ) ? ( node.note as string ).trim() : '' } );
			}

			walk( node?.children );
		}
	};

	walk( nodes );

	return out;
}

/**
 * A way of composing: how a mounted tree is recognised, and what draws it.
 *
 * The mode is read off what is mounted, never chosen — the first registered mode whose `matches`
 * accepts the tree wins, highest `priority` first. The Section mode matches everything at priority
 * 0, so it is what any tree falls back to.
 */
export interface StudioMode {
	id: string;
	/** What the header calls it: "Section", "Board". */
	label: string;
	priority?: number;
	matches: ( blocks: BlockNode[] ) => boolean;
	Canvas: ComponentType< CanvasProps >;
	/** Offer Desktop / Tablet / Phone. A composition with a fixed shape does not. */
	widths?: boolean;
	/** Offer Play, for a mode whose blocks animate. */
	play?: boolean;
	/** Offer zoom in the header. */
	zoom?: boolean;
	/** Facts about the mounted tree a rail panel may need, e.g. a board's grid size. */
	context?: ( blocks: BlockNode[] ) => Record< string, unknown >;
	/** Load from and save to a stored entity rather than the post. Since API 3. */
	persist?: StudioPersist;
	/** Name the Layers rows in the mode's own words. Since API 3. */
	tree?: ( blocks: BlockNode[] ) => TreeNode[];
	/**
	 * Rail tabs that mean nothing in this mode, by panel id, e.g. `[ 'motion' ]` for a header,
	 * which has no keyframes to play. Since API 3; additive.
	 */
	hidePanels?: string[];
}

/** What is wrong with a mode's `persist`, or ''. */
function persistProblem( persist: unknown ): string {
	if ( undefined === persist ) {
		return '';
	}

	const p = ( persist ?? {} ) as Partial< StudioPersist >;

	return ! isText( p.label ) ? 'a persist.label' : ! isFn( p.load ) ? 'a persist.load( ref ) function' : ! isFn( p.save ) ? 'a persist.save( blocks, ref ) function' : '';
}

export const modes = registry< StudioMode >( 'registerMode', ( m ) =>
	! isText( m.label )
		? 'a label'
		: ! isFn( m.matches )
		? 'a matches( blocks ) function'
		: ! isFn( m.Canvas )
		? 'a Canvas component'
		: undefined !== m.tree && ! isFn( m.tree )
		? 'tree to be a function'
		: undefined !== m.hidePanels && ! ( Array.isArray( m.hidePanels ) && m.hidePanels.every( isText ) )
		? 'hidePanels to be a list of panel ids'
		: persistProblem( m.persist )
);

/** A mode's tree labels, or none when it has no `tree` or the call throws. */
export function modeTree( mode: StudioMode, blocks: BlockNode[] ): Map< string, { label: string; note: string } > {
	if ( ! mode.tree ) {
		return new Map();
	}

	try {
		return treeLabels( mode.tree( blocks ) );
	} catch ( failure ) {
		console.error( `blicks: the Studio mode "${ mode.id }" failed to name its tree.`, failure );
		return new Map();
	}
}

/** The mode for a tree: the highest-priority registered mode that accepts it. */
export function modeFor( blocks: BlockNode[] ): StudioMode | undefined {
	return [ ...modes.list() ]
		.sort( ( a, b ) => ( b.priority ?? 0 ) - ( a.priority ?? 0 ) )
		.find( ( m ) => {
			try {
				return m.matches( blocks );
			} catch {
				return false;
			}
		} );
}

/* ------------------------------------------------------------------ "+ New" */

/** What starting something new produces: a tree to mount, or nothing if the author backed out. */
export interface NewStart {
	blocks: BlockNode[];
	label: string;
}

/**
 * One entry in the library's "+ New" menu beside the built-in Section.
 *
 * Either `start()` returns the tree straight away, or a `Picker` asks first (a board's shape) and
 * calls `onStart` with it. The Studio draws the picker in its own sheet.
 */
export interface StudioNewItem {
	id: string;
	label: string;
	/** One line under the label: what you get and what it is for. */
	description: string;
	/** An SVG path on a 24×24 grid, drawn as a stroke. */
	icon?: string;
	start?: () => NewStart | null;
	Picker?: ComponentType< { onStart: ( start: NewStart ) => void; onCancel: () => void } >;
}

export const newItems = registry< StudioNewItem >( 'registerNewItem', ( n ) =>
	! isText( n.label ) ? 'a label' : ! isText( n.description ) ? 'a description' : ! isFn( n.start ) && ! isFn( n.Picker ) ? 'a start() function or a Picker component' : ''
);

/* ------------------------------------------------------------------ patterns */

/**
 * A set of patterns shipped by a companion, shelved with the built-ins.
 *
 * Entries keep their own `kind` and `collection`, so a companion's "Boards" become a Kind filter like
 * any other. A pattern needing a block this site lacks is the companion's to mark `locked`.
 */
export interface StudioPatternSet {
	id: string;
	entries: PatternEntry[];
}

export const patternSets = registry< StudioPatternSet >( 'registerPatterns', ( p ) =>
	! Array.isArray( p.entries ) ? 'an entries list' : p.entries.some( ( e ) => ! e || ! isText( e.id ) || ! isText( e.title ) || ! Array.isArray( e.blocks ) ) ? 'entries with an id, a title and blocks' : ''
);

/** Every registered pattern, as built-ins. */
export function registeredPatterns( sets: readonly StudioPatternSet[] ): PatternEntry[] {
	return sets.flatMap( ( set ) => set.entries.map( ( entry ) => ( { ...entry, source: 'builtin' as const } ) ) );
}

/* ------------------------------------------------------------------ rail panels */

export interface StudioPanelProps {
	/** The mounted tree, as the shell holds it. */
	blocks: BlockNode[];
	/** What the current mode reports about the tree (its `context`), or an empty object. */
	context: Record< string, unknown >;
	/**
	 * Run a burst of writes as ONE history step, labelled with the panel's name. Eleven changes that
	 * cost eleven ⌘Zs to take back is not something anyone accepts casually.
	 */
	applyBurst: ( run: () => void ) => void;
	/** The block selected on the canvas, or null. Since API 2. */
	selection: { clientId: string; name: string } | null;
	/** The Play button's clock: bumped on each press, and a way to press it. Since API 2. */
	play: { count: number; replay: () => void };
	/** The id of the mode the tree is open in. Since API 3. */
	mode: string;
	/**
	 * The stored entity the tree was opened from (`studio.openRef()`), or null for a tree from the
	 * post. A panel that edits the entity's own settings (a saved dialog's triggers) reads which
	 * one it is here. Since API 3.
	 */
	ref: StudioRef | null;
}

/**
 * A tab in the right rail, beside the inspector. It shares the rail rather than getting one of its
 * own, and renders inside the Studio's block-editor provider, so its store is the mounted tree.
 */
export interface StudioPanel {
	id: string;
	label: string;
	render: ( props: StudioPanelProps ) => JSX.Element | null;
	/**
	 * The modes the tab shows in, by id. Left out, it shows in every mode. A panel about one mode's
	 * trees (a dialog's triggers) names that mode, so its tab is not in the rail of every other.
	 * Since API 3.
	 */
	modes?: string[];
}

/** Whether a panel's tab belongs in the rail of this mode: the panel names the mode, and the mode does not hide it. */
export function panelShows( panel: StudioPanel, mode: string ): boolean {
	const hidden = modes.list().find( ( m ) => m.id === mode )?.hidePanels;
	return ( ! Array.isArray( panel.modes ) || panel.modes.includes( mode ) ) && ! ( Array.isArray( hidden ) && hidden.includes( panel.id ) );
}

/** The inspector's own tab. A panel may not take its id. */
export const INSPECTOR_TAB = 'inspector';

export const panels = registry< StudioPanel >( 'registerPanel', ( p ) =>
	p.id === INSPECTOR_TAB
		? `an id other than "${ INSPECTOR_TAB }"`
		: ! isText( p.label )
		? 'a label'
		: ! isFn( p.render )
		? 'a render function'
		: undefined !== p.modes && ( ! Array.isArray( p.modes ) || p.modes.some( ( m ) => ! isText( m ) ) )
		? 'modes to be a list of mode ids'
		: ''
);

/* ------------------------------------------------------------------ sources */

/** What a source's shelf holds after a load. */
export interface SourceLoad {
	entries: PatternEntry[];
	/** Why the shelf is empty or out of date, in a sentence a person can act on. */
	error?: string;
	/** When the entries were fetched, if they are an older copy shown because a fresh one failed. */
	stale?: string | null;
	/** A link that fixes the empty shelf, where there is one (the Marketplace's switch in Settings). */
	action?: { label: string; href: string };
}

/** What opening an entry yields: the tree to mount and the keyframes it carries. */
export interface SourceOpen {
	blocks: BlockNode[];
	keyframes?: Keyframes[];
}

/**
 * A shelf that arrives asynchronously — a remote catalogue. Its entries carry their own `open()`,
 * since there is no tree in hand until one is asked for. Since API 2.
 *
 * For now every registered source shelves under the library's remote row ("Marketplace"); the
 * built-in and saved shelves keep their own loaders.
 */
export interface StudioSource {
	id: string;
	label: string;
	load: () => Promise< SourceLoad >;
}

export const sources = registry< StudioSource >( 'registerSource', ( src ) =>
	! isText( src.label ) ? 'a label' : ! isFn( src.load ) ? 'a load() function' : ''
);

/* ------------------------------------------------------------------ the published surface */

/** Bumped when a registration shape changes, so a companion can check before it registers. */
export const STUDIO_API_VERSION = 3;

export const studioApi = Object.freeze( {
	version: STUDIO_API_VERSION,
	registerMode: modes.register,
	unregisterMode: modes.unregister,
	registerNewItem: newItems.register,
	unregisterNewItem: newItems.unregister,
	registerPatterns: patternSets.register,
	unregisterPatterns: patternSets.unregister,
	registerPanel: panels.register,
	unregisterPanel: panels.unregister,
	registerSource: sources.register,
	unregisterSource: sources.unregister,
} );
