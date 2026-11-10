/**
 * The custom keyframes one Studio session is working with.
 *
 * **Edits are drafts until a door.** The library is site-wide: saving a keyframe the moment a
 * slider moves would restyle every block on the site that uses it, from inside a surface whose one
 * promise is that nothing reaches the site until you leave by Insert or Save. So the session holds
 * its edits, previews them through its own `<style>`, and `commit()` writes them when a door is
 * taken. Close without one and they are gone, as the tree is.
 *
 * One session at a time, so a module-level store rather than context: the Motion panel renders
 * through the rail's registry, which hands panels props, not providers. `begin()` resets it when a
 * Studio opens, which is also why the Studio does not `end()` it on unmount: React's development
 * mode unmounts and remounts every effect once, and a cleanup that ended the session left a live
 * Studio with an empty one — no built-ins, no drafts.
 */
import { useSyncExternalStore } from '@wordpress/element';
import type { BlockNode } from '../mount';
import { keyframesCss, nameOf, reconcile, renameIn, type Arrival, type Keyframes, type LibraryAnimation } from './keyframes';

export interface Draft {
	keyframes: Keyframes;
	/** The library slug it replaces, or null for a record that is new to this site. */
	replaces: string | null;
}

interface State {
	/** The site's own records, as last read or written. */
	library: Keyframes[];
	/** The built-ins, for the picker. Never edited, never committed. */
	builtins: LibraryAnimation[];
	drafts: Draft[];
	/** What the mounted tree brought with it, for the panel to report. */
	arrivals: Arrival[];
	/** Bumped on every change, for subscribers. */
	version: number;
}

export interface MotionSettings {
	/** Every property a step may set — `Animations::allowedProperties()`. */
	properties: string[];
	/** Whether this person may write to the library. */
	canEdit: boolean;
}

const STYLE_ID = 'blicks-studio-keyframes';

let state: State = { library: [], builtins: [], drafts: [], arrivals: [], version: 0 };
const listeners = new Set< () => void >();

function set( patch: Partial< State > ): void {
	state = { ...state, ...patch, version: state.version + 1 };
	paint();
	listeners.forEach( ( listener ) => listener() );
}

export function settings(): MotionSettings {
	const raw = ( window as unknown as { blicksStudioSettings?: { motion?: Partial< MotionSettings > } } ).blicksStudioSettings?.motion;

	return {
		properties: Array.isArray( raw?.properties ) ? raw.properties.map( String ) : [],
		canEdit: raw?.canEdit === true,
	};
}

/** The animation library the editor was given — built-ins and the site's own, in one list. */
export function editorLibrary(): LibraryAnimation[] {
	const list = ( window as unknown as { blicksEditorSettings?: { animations?: unknown } } ).blicksEditorSettings?.animations;

	return Array.isArray( list ) ? ( list as LibraryAnimation[] ).filter( ( a ) => a && typeof a.slug === 'string' && typeof a.name === 'string' ) : [];
}

const toRecord = ( a: LibraryAnimation ): Keyframes => ( {
	slug: a.slug,
	label: a.label || a.slug,
	...( a.defaults ? { defaults: a.defaults } : {} ),
	steps: Array.isArray( a.steps ) ? a.steps : [],
} );

/**
 * Open a session on a mounted tree, bringing in the keyframes it carries.
 *
 * Returns the tree to mount — renamed where an arrival clashed with this site's library.
 */
export function begin( blocks: BlockNode[], carried: Keyframes[] = [], library: LibraryAnimation[] = editorLibrary() ): BlockNode[] {
	const own = library.filter( ( a ) => ! a.builtin ).map( toRecord );
	const arrived = reconcile( blocks, carried, own );

	state = {
		library: own,
		builtins: library.filter( ( a ) => a.builtin ),
		drafts: arrived.arrivals.filter( ( a ) => a.kind !== 'same' ).map( ( a ) => ( { keyframes: a.keyframes, replaces: null } ) ),
		arrivals: arrived.arrivals,
		version: state.version + 1,
	};
	paint();
	listeners.forEach( ( listener ) => listener() );

	return arrived.blocks;
}

/**
 * Forget the session's drafts and arrivals.
 *
 * The `<style>` stays. It is the only declaration of anything committed during this page load —
 * the page's own stylesheet was printed before — and a post editor that is not iframed draws its
 * blocks in this same document. Leftover unsaved drafts in it are harmless: nothing outside the
 * Studio can name them.
 */
export function end(): void {
	state = { library: [], builtins: [], drafts: [], arrivals: [], version: state.version + 1 };
	listeners.forEach( ( listener ) => listener() );
}

/** Every custom record as the session sees it: drafts over the library. */
export function known(): Keyframes[] {
	const drafted = new Map( state.drafts.map( ( d ) => [ d.keyframes.slug, d.keyframes ] ) );
	const replaced = new Set( state.drafts.map( ( d ) => d.replaces ).filter( Boolean ) );

	return [
		...state.library.filter( ( k ) => ! drafted.has( k.slug ) && ! replaced.has( k.slug ) ),
		...state.drafts.map( ( d ) => d.keyframes ),
	];
}

export const builtins = (): LibraryAnimation[] => state.builtins;
export const drafts = (): Draft[] => state.drafts;
export const arrivals = (): Arrival[] => state.arrivals;

/** Whether a slug is unsaved work in this session. */
export const isDraft = ( slug: string ): boolean => state.drafts.some( ( d ) => d.keyframes.slug === slug );

/**
 * Put an edited or new record in the session. `was` is the slug it had before this edit, so a
 * rename replaces its earlier self rather than leaving a twin behind.
 */
export function put( record: Keyframes, was: string | null = null ): void {
	const previous = state.drafts.find( ( d ) => d.keyframes.slug === ( was ?? record.slug ) );
	const inLibrary = state.library.some( ( k ) => k.slug === ( was ?? record.slug ) );
	const replaces = previous ? previous.replaces : inLibrary ? ( was ?? record.slug ) : null;
	const others = state.drafts.filter( ( d ) => d.keyframes.slug !== ( was ?? record.slug ) && d.keyframes.slug !== record.slug );

	set( { drafts: [ ...others, { keyframes: record, replaces } ] } );
}

/** Drop a draft: a new record vanishes, an edited one goes back to the library's version. */
export function discard( slug: string ): void {
	set( { drafts: state.drafts.filter( ( d ) => d.keyframes.slug !== slug ) } );
}

/**
 * "Use mine" on an arrival that clashed: point the tree back at this site's record and drop the
 * renamed copy. Returns the tree to write.
 */
export function useMine( blocks: BlockNode[], arrival: Arrival ): BlockNode[] {
	if ( arrival.kind !== 'renamed' || ! arrival.from ) {
		return blocks;
	}

	set( {
		drafts: state.drafts.filter( ( d ) => d.keyframes.slug !== arrival.keyframes.slug ),
		arrivals: state.arrivals.map( ( a ) => ( a === arrival ? { ...a, kind: 'same' as const, keyframes: { ...a.keyframes, slug: arrival.from! } } : a ) ),
	} );

	return renameIn( blocks, arrival.keyframes.slug, arrival.from );
}

export function useMotionSession(): number {
	return useSyncExternalStore(
		( listener ) => {
			listeners.add( listener );
			return () => listeners.delete( listener );
		},
		() => state.version
	);
}

/* ------------------------------------------------------------------ preview */

/**
 * Draw every custom record the session knows into one `<style>`, in this document and in the post
 * editor's canvas frame.
 *
 * The page's own stylesheet already declares the library as it was at load; this one comes later
 * in the cascade, so a draft wins over the record it edits. The canvas frame needs it too, so an
 * animation committed by Insert moves in the post right away rather than after a reload.
 */
function paint(): void {
	const css = keyframesCss( known(), settings().properties );

	for ( const doc of documents() ) {
		let tag = doc.getElementById( STYLE_ID );

		if ( ! tag ) {
			tag = doc.createElement( 'style' );
			tag.id = STYLE_ID;
			doc.head.appendChild( tag );
		}

		tag.textContent = css;
	}
}

function documents(): Document[] {
	const found = [ document ];

	document.querySelectorAll< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' ).forEach( ( frame ) => {
		try {
			if ( frame.contentDocument?.head ) {
				found.push( frame.contentDocument );
			}
		} catch {
			// A frame from another origin is not ours to style.
		}
	} );

	return found;
}

/* ------------------------------------------------------------------ the door */

type Fetch = < T >( options: { path: string; method?: string; data?: unknown } ) => Promise< T >;

const PATH = '/blicks/v1/design-system/animations';

/**
 * Write every draft to the library. Called by Insert and Save as pattern, before they do their own
 * work, so a tree never lands naming an animation the site does not have.
 *
 * Stops at the first failure and keeps that draft and everything after it — a half-saved session
 * with the unsaved part still in hand, rather than a session that claims to be done.
 */
export async function commit( fetch: Fetch ): Promise< void > {
	if ( state.drafts.length === 0 ) {
		return;
	}

	if ( ! settings().canEdit ) {
		throw new Error( 'Only an administrator can add animations to this site’s library.' );
	}

	let remaining = [ ...state.drafts ];

	while ( remaining.length > 0 ) {
		const draft = remaining[ 0 ]!;
		const response = await fetch< { library?: LibraryAnimation[] } >( {
			path: draft.replaces ? `${ PATH }/${ encodeURIComponent( draft.replaces ) }` : PATH,
			method: draft.replaces ? 'PATCH' : 'POST',
			data: draft.keyframes,
		} );

		remaining = remaining.slice( 1 );

		const library = Array.isArray( response?.library ) ? response.library : null;

		set( {
			drafts: remaining,
			...( library ? { library: library.filter( ( a ) => ! a.builtin ).map( toRecord ) } : {} ),
		} );
	}

	// The editor's own copy of the library, so the block Motion control lists what was just added.
	const editor = ( window as unknown as { blicksEditorSettings?: { animations?: unknown } } ).blicksEditorSettings;

	if ( editor ) {
		editor.animations = [ ...state.builtins, ...state.library.map( ( k ) => ( { ...k, name: nameOf( k.slug ), builtin: false, description: '' } ) ) ];
	}
}
