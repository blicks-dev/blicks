import { describe, expect, it } from 'vitest';
import { withoutProblems } from './Problems';

describe( 'withoutProblems', () => {
	it( 'drops a whole control, or only the slot and breakpoint named', () => {
		const tree = {
			'layout.display': { default: { base: 'grid' } },
			'spacing.padding': { default: { base: '1px', desktop: '2px' }, hover: { base: '3px' } },
			'colors.text': { wobble: { base: 'red' }, default: { base: 'blue' } },
		};
		expect( withoutProblems( tree, [
			{ id: 'layout.display', reason: 'not-allowed' },
			{ id: 'spacing.padding', slot: 'default', breakpoint: 'desktop', reason: 'unknown-breakpoint' },
			{ id: 'colors.text', slot: 'wobble', reason: 'unknown-slot' },
		] ) ).toEqual( {
			'spacing.padding': { default: { base: '1px' }, hover: { base: '3px' } },
			'colors.text': { default: { base: 'blue' } },
		} );
	} );
} );
