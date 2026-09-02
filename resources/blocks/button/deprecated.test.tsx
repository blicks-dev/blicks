/**
 * @vitest-environment jsdom
 *
 * Button's v1 saved shape.
 *
 * `text` defaulted to "Get started" and is not a sourced attribute, so a Button left at the
 * default wrote its label into the markup and omitted `text` from the block comment. Today's
 * default is `""`, which reproduces as an empty label — every such post would go invalid
 * without the deprecation registered in `./index.tsx`.
 *
 * The golden file cannot guard this: it was re-recorded when the deprecation landed, so it now
 * holds the new shape. This is the frozen copy of the old one.
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
