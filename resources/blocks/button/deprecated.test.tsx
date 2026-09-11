/**
 * @vitest-environment jsdom
 *
 * Button's earlier saved shapes.
 *
 * v1 — `text` defaulted to "Get started" and is not a sourced attribute, so a Button left at the
 * default wrote its label into the markup and omitted `text` from the block comment. Today's
 * default is `""`, which reproduces as an empty label.
 *
 * v2 — the icon `<svg>` gained `bl-button__icon` when the Icon element landed, so every
 * already-saved button WITH an icon has a bare `<svg>` where save() now emits a classed one.
 *
 * Either would take every affected post to "This block contains unexpected or invalid content"
 * without the deprecations registered in `./index.tsx`.
 *
 * The golden file cannot guard these: it is re-recorded whenever the saved shape changes, so it
 * only ever holds the newest one. These are the frozen copies of what is in users' databases.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@wordpress/blocks';

import '@/block-library';

/** Byte-for-byte what a Button at the old default saved — note the absent `text` attribute. */
const V1_MARKUP = `<!-- wp:blicks/buttons {"uniqueId":"03ebd15f"} -->
<div class="bl-buttons bl-03ebd15f" style="--bl-fd:row;--bl-gap-r:var(--blicks-spacing-sm);--bl-gap-c:var(--blicks-spacing-sm);--bl-jc:flex-start;--bl-fw:wrap"><!-- wp:blicks/button {"uniqueId":"444900f6"} -->
<button class="bl-button bl-444900f6 bl-button--default bl-button--default-size" type="button"><span class="bl-button__label">Get started</span></button>
<!-- /wp:blicks/button --></div>
<!-- /wp:blicks/buttons -->`;

describe( 'blicks/button — v1 saved shape', () => {
	const [ buttons ] = parse( V1_MARKUP );
	const button = buttons?.innerBlocks?.[ 0 ];

	it( 'parses without a validation warning', () => {
		expect( buttons.isValid ).toBe( true );
		expect( button?.name ).toBe( 'blicks/button' );
		expect( button?.isValid ).toBe( true );
	} );

	it( 'recovers the label the old default baked into the markup', () => {
		// Not just "valid": the point of the deprecation is that the author keeps their text.
		expect( button?.attributes?.text ).toBe( 'Get started' );
	} );
} );

/** A pre-elements Button with an icon: the `<svg>` carries no `bl-button__icon`. */
const V2_MARKUP = `<!-- wp:blicks/buttons {"uniqueId":"03ebd15f"} -->
<div class="bl-buttons bl-03ebd15f" style="--bl-fd:row;--bl-gap-r:var(--blicks-spacing-sm);--bl-gap-c:var(--blicks-spacing-sm);--bl-jc:flex-start;--bl-fw:wrap"><!-- wp:blicks/button {"uniqueId":"444900f6","text":"Get started","icon":"arrowRight","iconPosition":"trailing"} -->
<button class="bl-button bl-444900f6 bl-button--default bl-button--default-size" type="button"><span class="bl-button__label">Get started</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" stroke-width="2"><path d="M5 12h14"/> <path d="m12 5 7 7-7 7"/></svg></button>
<!-- /wp:blicks/button --></div>
<!-- /wp:blicks/buttons -->`;

describe( 'blicks/button — v2 saved shape (icon before `bl-button__icon`)', () => {
	const [ buttons ] = parse( V2_MARKUP );
	const button = buttons?.innerBlocks?.[ 0 ];

	it( 'parses without a validation warning', () => {
		expect( buttons.isValid ).toBe( true );
		expect( button?.isValid ).toBe( true );
	} );

	it( 'keeps the icon the author chose', () => {
		expect( button?.attributes?.icon ).toBe( 'arrowRight' );
		expect( button?.attributes?.iconPosition ).toBe( 'trailing' );
	} );
} );
