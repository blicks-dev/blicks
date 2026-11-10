/**
 * A saved dialog's settings while the Studio has it open: its triggers, its rules and whether it is
 * on. The blocks are the Studio's; these are the post's own meta and status, so the mode keeps them
 * here, loads them with the blocks and writes them with the blocks when "Save dialog" is pressed.
 *
 * One small observable map keyed by post id, so every panel shows the same draft and a panel
 * mounted later still finds what was loaded.
 */
import { useSyncExternalStore } from '@wordpress/element';
import { cleanRules, cleanTriggers, type Rules, type Triggers } from './settings';

export interface Draft {
	triggers: Triggers;
	rules: Rules;
	/** Published is on: shown on the site. */
	on: boolean;
	title: string;
	/** Changed since it was loaded or saved. */
	dirty: boolean;
}

type Fetch = ( options: { path: string; method?: string; data?: unknown } ) => Promise< unknown >;

const drafts = new Map< number, Draft >();
const listeners = new Set< () => void >();
const emit = (): void => listeners.forEach( ( l ) => l() );

export function getDraft( id: number ): Draft | undefined {
	return drafts.get( id );
}

export function setDraft( id: number, draft: Draft ): void {
	drafts.set( id, draft );
	emit();
}

/** Change part of a draft; marks it dirty. */
export function patchDraft( id: number, patch: Partial< Omit< Draft, 'dirty' > > ): void {
	const current = drafts.get( id );

	if ( current ) {
		drafts.set( id, { ...current, ...patch, dirty: true } );
		emit();
	}
}

export function useDraft( id: number | null ): Draft | undefined {
	return useSyncExternalStore(
		( listener ) => {
			listeners.add( listener );
			return () => listeners.delete( listener );
		},
		() => ( null === id ? undefined : drafts.get( id ) )
	);
}

/** A post as `wp/v2/<rest base>/<id>?context=edit` answers it, read into a draft. */
export function draftFrom( record: unknown ): Draft {
	const r = ( record ?? {} ) as { meta?: Record< string, unknown >; status?: unknown; title?: { raw?: unknown } | unknown };
	const meta = r.meta ?? {};
	const title = r.title && 'object' === typeof r.title ? ( r.title as { raw?: unknown } ).raw : r.title;

	return {
		triggers: cleanTriggers( meta.blicks_dialog_triggers ),
		rules: cleanRules( meta.blicks_dialog_rules ),
		on: 'publish' === r.status,
		title: 'string' === typeof title ? title : '',
		dirty: false,
	};
}

export const postPath = ( base: string, id: number, query = '' ): string => `/wp/v2/${ base }/${ id }${ query }`;

export async function loadDraft( fetch: Fetch, base: string, id: number ): Promise< Draft > {
	const draft = draftFrom( await fetch( { path: postPath( base, id, '?context=edit' ) } ) );
	setDraft( id, draft );

	return draft;
}

/** Write a draft's settings and status back, if they changed. */
export async function saveDraft( fetch: Fetch, base: string, id: number ): Promise< void > {
	const draft = drafts.get( id );

	if ( ! draft || ! draft.dirty ) {
		return;
	}

	await fetch( {
		path: postPath( base, id ),
		method: 'POST',
		data: {
			status: draft.on ? 'publish' : 'draft',
			title: draft.title,
			meta: { blicks_dialog_triggers: draft.triggers, blicks_dialog_rules: draft.rules },
		},
	} );

	// Only what was saved is clean: an edit made while the request ran stays dirty.
	if ( drafts.get( id ) === draft ) {
		drafts.set( id, { ...draft, dirty: false } );
		emit();
	}
}

/** For tests. */
export function resetDrafts(): void {
	drafts.clear();
	emit();
}
