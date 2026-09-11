/**
 * @vitest-environment jsdom
 *
 * Button's declared elements, end to end: `blicks` attribute tree → saved markup.
 *
 * The engine tests (resources/framework/css/vars.test.ts) prove the scoped build returns the right
 * classes and vars. This proves the rest of the chain actually carries them: the manifest is read,
 * `elementProps` reaches the block's `render`, and the result lands on the icon's own node rather
 * than the wrapper — which is the part a unit test of the engine cannot see.
 */

import { describe, expect, it } from 'vitest';
import { createBlock, serialize } from '@wordpress/blocks';

import '@/block-library';

/** A Button styled at the wrapper AND on its icon, including a parent-driven hover. */
const styledButton = () =>
	createBlock( 'blicks/button', {
		uniqueId: 'btn1',
		text: 'Go',
		icon: 'arrowRight',
		blicks: {
			'colors.text': { default: { base: 'primary' } },
			'icon:colors.text': { default: { base: 'accent' } },
			'icon:effects.transform': { hover: { base: { translateX: '4px' } } },
		},
	} );

describe( 'blicks/button — element styling in saved markup', () => {
	it( 'puts the icon\'s styling on the icon, not on the wrapper', () => {
		const markup = serialize( [ styledButton() ] );
		const [ , svg ] = markup.split( '<svg' );

		// The icon carries its own colour…
		expect( svg ).toContain( '--bl-tx:var(--blicks-color-accent)' );
		expect( svg ).toContain( 'bl-button__icon' );

		// …while the wrapper keeps the block's, and never sees the icon's.
		const wrapper = markup.slice( 0, markup.indexOf( '<svg' ) );
		expect( wrapper ).toContain( '--bl-tx:var(--blicks-color-primary)' );
		expect( wrapper ).not.toContain( 'var(--blicks-color-accent)' );
	} );

	it( 'marks the wrapper so parent-driven states can match', () => {
		const markup = serialize( [ styledButton() ] );

		// `.bl-ph:hover .bl-tfm--phov` — the marker is on the button, the override on the icon, so
		// hovering the BUTTON is what moves the icon.
		expect( markup.slice( 0, markup.indexOf( '<svg' ) ) ).toContain( 'bl-ph' );

		const [ , svg ] = markup.split( '<svg' );
		expect( svg ).toContain( 'bl-tfm--phov' );
		expect( svg ).toContain( '--bl-tfm-phov:translate3d(4px, 0, 0)' );
	} );

	it( 'leaves an unstyled button\'s markup alone apart from the icon hook', () => {
		const markup = serialize( [
			createBlock( 'blicks/button', { uniqueId: 'btn2', text: 'Go', icon: 'arrowRight' } ),
		] );

		// No element values → no marker, no element classes, no stray empty attributes.
		expect( markup ).not.toContain( 'bl-ph' );
		expect( markup ).not.toContain( 'bl-tfm' );
		expect( markup ).not.toContain( 'style=""' );
		expect( markup ).not.toContain( 'class=""' );
		// The one deliberate addition, covered by the v2 deprecation in ./deprecated.test.tsx.
		expect( markup ).toContain( 'bl-button__icon' );
	} );
} );
