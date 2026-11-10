/**
 * The design panel's door for things outside it: a value to open on, and Find.
 *
 * The panel renders in the editor bundle (it is a block's `InspectorControls` fill); the Studio's
 * Layers rail and the post editor's "Edit in Studio" live elsewhere — Layers in the Studio's own
 * entry, which may not import from this one (the bundles are IIFEs; a shared module is emitted
 * twice). So they meet at runtime, on `window.blicks.designPanel`, the way the Studio's own API is
 * published on `window.blicks.studio`.
 *
 * A focus request names the block it is for. The panel that mounts for that block takes it once;
 * a request nobody takes within a few seconds lapses, so a stale one cannot open a later block on
 * the wrong value.
 */
import { hasScreenValues, hasStateValues, matchesOf, type PanelTab, type Where } from './design-model';

export interface FocusRequest extends Where {
	/** The block the panel should be showing. */
	clientId: string;
	/** The setting to reveal and flash. */
	id: string;
}

const LAPSE_MS = 4000;
let pending: { request: FocusRequest; at: number } | null = null;
const listeners = new Set< () => void >();

/** Ask the panel for `clientId` to open on a value. Select the block as well; this does not. */
export function requestFocus( request: FocusRequest ): void {
	pending = { request, at: Date.now() };
	listeners.forEach( ( l ) => l() );
}

/** The request for this block, if one is waiting; taking it clears it. */
export function takeFocus( clientId: string ): FocusRequest | null {
	if ( ! pending || pending.request.clientId !== clientId ) return null;
	const { request, at } = pending;
	pending = null;
	return Date.now() - at <= LAPSE_MS ? request : null;
}

let pendingTab: { clientId: string; tab: PanelTab; at: number } | null = null;

/**
 * Announced on `window` with every tab request, for the Studio shell: it lives in another bundle
 * and owns whether the inspector is open, so it opens the inspector when this fires. The name is
 * repeated in `studio/Studio.tsx`; change both together.
 */
export const DESIGN_TAB_EVENT = 'blicks:design-panel-tab';

/**
 * Ask the panel for `clientId` to show a tab — the Button's toolbar opens Quick this way. Same
 * lapse as a focus request, so a stale one cannot switch a later block's panel.
 */
export function requestTab( clientId: string, tab: PanelTab ): void {
	pendingTab = { clientId, tab, at: Date.now() };
	listeners.forEach( ( l ) => l() );
	if ( typeof window !== 'undefined' ) window.dispatchEvent( new CustomEvent( DESIGN_TAB_EVENT, { detail: { clientId, tab } } ) );
}

/** The tab asked for this block, if one is waiting; taking it clears it. */
export function takeTab( clientId: string ): PanelTab | null {
	if ( ! pendingTab || pendingTab.clientId !== clientId ) return null;
	const { tab, at } = pendingTab;
	pendingTab = null;
	return Date.now() - at <= LAPSE_MS ? tab : null;
}

export function onFocusRequest( listener: () => void ): () => void {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

/** What `window.blicks.designPanel` offers. Additive only: Layers checks each member it uses. */
export const designPanelApi = Object.freeze( {
	version: 1,
	matchesOf,
	hasStateValues,
	hasScreenValues,
	requestFocus,
} );

export type DesignPanelApi = typeof designPanelApi;

/** Publish the API, spread over whatever other bundles already put on `window.blicks`. */
export function exposeDesignPanel(): void {
	if ( typeof window === 'undefined' ) return;
	const host = window as unknown as { blicks?: Record< string, unknown > };
	host.blicks = { ...( host.blicks ?? {} ), designPanel: designPanelApi };
}
