import { describe, expect, it } from 'vitest';
import { keywordPattern, validateSpaced } from './validate';

describe( 'keywordPattern', () => {
	const objectFit = keywordPattern( [ 'cover', 'contain', 'fill', 'none', 'scale-down' ] );

	it( 'accepts a value from the list', () => {
		expect( validateSpaced( 'cover', objectFit ) ).toBe( 'cover' );
		expect( validateSpaced( 'scale-down', objectFit ) ).toBe( 'scale-down' );
	} );

	it( 'is case-insensitive and trims', () => {
		expect( validateSpaced( '  Cover  ', objectFit ) ).toBe( 'Cover' );
	} );

	it( 'drops a value from another property’s value space', () => {
		// The bug this guards: `object-fit: 12px` committed happily and emitted CSS the browser
		// throws away, so the block looked unstyled with nothing to point at.
		expect( validateSpaced( '12px', objectFit ) ).toBe( '' );
		expect( validateSpaced( '600ms', objectFit ) ).toBe( '' );
		expect( validateSpaced( '3', objectFit ) ).toBe( '' );
	} );

	it( 'keeps CSS-wide keywords and token / computed references', () => {
		expect( validateSpaced( 'inherit', objectFit ) ).toBe( 'inherit' );
		expect( validateSpaced( 'revert-layer', objectFit ) ).toBe( 'revert-layer' );
		expect( validateSpaced( 'var(--blicks-fit)', objectFit ) ).toBe( 'var(--blicks-fit)' );
		expect( validateSpaced( 'calc(1px + 1px)', objectFit ) ).toBe( 'calc(1px + 1px)' );
	} );

	it( 'rejects a combination unless the property takes one', () => {
		const single = keywordPattern( [ 'layout', 'paint' ] );
		const multi = keywordPattern( [ 'layout', 'paint', 'size', 'none' ], { multi: true } );

		expect( validateSpaced( 'layout paint', single ) ).toBe( '' );
		expect( validateSpaced( 'layout paint', multi ) ).toBe( 'layout paint' );
		expect( validateSpaced( 'layout   paint  size', multi ) ).toBe( 'layout paint size' );
		expect( validateSpaced( 'layout 12px', multi ) ).toBe( '' );
	} );

	it( 'escapes regex metacharacters in the listed values', () => {
		const ratio = keywordPattern( [ '16/9', '1.5' ] );
		expect( validateSpaced( '16/9', ratio ) ).toBe( '16/9' );
		// `.` in `1.5` must match a literal dot, not any character.
		expect( validateSpaced( '145', ratio ) ).toBe( '' );
	} );
} );
