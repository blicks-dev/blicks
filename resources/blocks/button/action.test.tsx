/**
 * @vitest-environment jsdom
 *
 * Clear form: a Button whose action is `reset` saves `type="reset"`, and parses back as itself.
 * The other actions keep their markup (the golden file covers the default Button).
 */
import { describe, expect, it } from 'vitest';
import { createBlock, parse, serialize } from '@wordpress/blocks';

import '@/block-library';
import { buttonAction } from './controls';

describe( 'blicks/button — Clear form', () => {
	it( 'is its own action', () => {
		expect( buttonAction( { action: 'reset' } ) ).toBe( 'reset' );
		expect( buttonAction( { action: 'submit' } ) ).toBe( 'submit' );
		expect( buttonAction( { action: 'reset', url: 'https://example.com' } ) ).toBe( 'reset' );
	} );

	it( 'saves a reset button and parses back valid', () => {
		const html = serialize( [ createBlock( 'blicks/button', { uniqueId: 'a1b2c3d4', text: 'Clear', action: 'reset' } ) ] );
		expect( html ).toContain( 'type="reset"' );
		expect( html ).not.toContain( 'type="submit"' );
		const [ block ] = parse( html );
		expect( block.isValid ).toBe( true );
		expect( block.attributes.action ).toBe( 'reset' );
	} );

	it( 'leaves Send form and plain buttons as they were', () => {
		expect( serialize( [ createBlock( 'blicks/button', { uniqueId: 'a1b2c3d4', text: 'Send', action: 'submit' } ) ] ) ).toContain( 'type="submit"' );
		expect( serialize( [ createBlock( 'blicks/button', { uniqueId: 'a1b2c3d4', text: 'Go' } ) ] ) ).toContain( 'type="button"' );
	} );
} );
