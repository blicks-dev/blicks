import { describe, expect, it } from 'vitest';
import { summary } from './summary';
import { cleanRules, cleanTriggers } from './settings';

describe( 'summary', () => {
	it( 'says a click-only dialog is only opened by a click', () => {
		expect( summary( cleanTriggers( {} ), cleanRules( {} ) ) ).toBe( 'Only when a Button or link opens it.' );
	} );

	it( 'reads triggers and rules as one sentence', () => {
		const text = summary(
			cleanTriggers( { load: { on: true, delay: 5 }, exit: { on: true } } ),
			cleanRules( { visitors: 'out', frequency: 'days', days: 7, screens: { phone: false }, schedule: { on: true, from: '2026-11-20', to: '2026-12-01' } } )
		);
		expect( text ).toBe( 'By itself 5 s after a page loads, or when they are about to leave, on every page, to logged-out visitors on desktops and tablets, at most once every 7 days, never after they convert, from 2026-11-20 to 2026-12-01.' );
	} );
} );
