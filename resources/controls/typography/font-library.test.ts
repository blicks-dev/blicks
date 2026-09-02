import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	findFontFamily,
	getFontLibrary,
	onFontLibraryChange,
	refreshFontLibrary,
	setFontLibrary,
} from './font-library';

declare global {
	var window: Window & typeof globalThis;
}

function stubWindow(): Window & typeof globalThis {
	const target = new EventTarget() as unknown as Window & typeof globalThis;
	( target as unknown as { blicks?: { fontLibrary?: unknown } } ).blicks = undefined;
	( target as unknown as { blicksEditorSettings?: unknown } ).blicksEditorSettings = undefined;
	( globalThis as unknown as { window: Window & typeof globalThis } ).window = target;
	return target;
}

afterEach( () => {
	refreshFontLibrary();
	delete ( globalThis as unknown as { window?: Window & typeof globalThis } ).window;
} );

describe( 'font-library reader', () => {
	it( 'returns an empty list when no window bridge is set', () => {
		stubWindow();
		expect( getFontLibrary() ).toEqual( [] );
	} );

	it( 'reads families from window.blicksEditorSettings', () => {
		const win = stubWindow();
		( win as unknown as { blicksEditorSettings: { fontLibrary: unknown[] } } ).blicksEditorSettings = {
			fontLibrary: [
				{ slug: 'inter', name: 'Inter', fontFamily: '"Inter", sans-serif', source: 'user' },
				{ slug: 'broken' }, // missing fontFamily — must be filtered out
				'oops',
			],
		};
		refreshFontLibrary();
		const list = getFontLibrary();
		expect( list ).toHaveLength( 1 );
		expect( list[ 0 ].slug ).toBe( 'inter' );
		expect( findFontFamily( 'inter' )?.name ).toBe( 'Inter' );
	} );

	it( 'caches and exposes setFontLibrary updates + emits change event', () => {
		const win = stubWindow();
		const calls = vi.fn();
		const off = onFontLibraryChange( calls );
		setFontLibrary( [
			{ slug: 'inter', name: 'Inter', fontFamily: '"Inter", sans-serif', source: 'user' },
		] );
		expect( getFontLibrary() ).toHaveLength( 1 );
		expect( ( win as unknown as { blicks: { fontLibrary: unknown[] } } ).blicks.fontLibrary ).toHaveLength( 1 );
		expect( calls ).toHaveBeenCalledTimes( 1 );
		off();
	} );
} );
