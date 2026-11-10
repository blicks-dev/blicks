import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draftFrom, getDraft, loadDraft, patchDraft, resetDrafts, saveDraft } from './drafts';

beforeEach( resetDrafts );

const record = {
	status: 'draft',
	title: { raw: 'Newsletter' },
	meta: { blicks_dialog_triggers: { load: { on: true, delay: 4 } }, blicks_dialog_rules: { visitors: 'out' } },
};

describe( 'drafts', () => {
	it( 'reads a post into cleaned settings', () => {
		const draft = draftFrom( record );
		expect( draft.on ).toBe( false );
		expect( draft.title ).toBe( 'Newsletter' );
		expect( draft.triggers.load ).toEqual( { on: true, delay: 4 } );
		expect( draft.rules.visitors ).toBe( 'out' );
		expect( draft.dirty ).toBe( false );
	} );

	it( 'saves nothing until something changed, then status, title and meta together', async () => {
		const fetch = vi.fn( async ( options: { path: string } ) => ( options.path.includes( 'context=edit' ) ? record : {} ) );
		await loadDraft( fetch, 'blicks-dialogs', 12 );
		await saveDraft( fetch, 'blicks-dialogs', 12 );
		expect( fetch ).toHaveBeenCalledTimes( 1 );

		patchDraft( 12, { on: true } );
		await saveDraft( fetch, 'blicks-dialogs', 12 );

		expect( fetch ).toHaveBeenLastCalledWith( {
			path: '/wp/v2/blicks-dialogs/12',
			method: 'POST',
			data: { status: 'publish', title: 'Newsletter', meta: { blicks_dialog_triggers: getDraft( 12 )!.triggers, blicks_dialog_rules: getDraft( 12 )!.rules } },
		} );
		expect( getDraft( 12 )!.dirty ).toBe( false );
	} );
} );
