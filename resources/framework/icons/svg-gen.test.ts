import { describe, it, expect } from 'vitest';
import { LUCIDE_ICONS } from './lucide.gen';
import NAMES from './names.gen.json';
import SVG from './svg.gen.json';
import { getIcon, getIconName } from './index';
import './bootstrap';

/**
 * `svg.gen.json` exists so PHP can reproduce an icon's markup when it writes a block into a post.
 *
 * That makes it a second copy of path data the bundle already carries, and a second copy is only
 * safe while something fails when the two disagree. Both come out of one `pnpm gen:icons` run, so
 * a mismatch means the artifact was not regenerated — and the symptom without this test is not an
 * error, it is saved markup that fails block validation for one icon on one page.
 */
describe( 'svg.gen.json', () => {
	it( 'carries exactly the icons the bundle registers', () => {
		expect( Object.keys( SVG.icons ).sort() ).toEqual( Object.keys( LUCIDE_ICONS ).sort() );
	} );

	it( 'carries byte-identical path data', () => {
		for ( const [ name, def ] of Object.entries( LUCIDE_ICONS ) ) {
			expect( ( SVG.icons as Record< string, string > )[ name ] ).toBe( def.svg );
		}
	} );

	it( 'resolves the same aliases', () => {
		expect( SVG.aliases ).toEqual( NAMES.aliases );

		for ( const [ alias, target ] of Object.entries( SVG.aliases ) ) {
			expect( getIcon( alias )?.svg ).toBe( ( SVG.icons as Record< string, string > )[ target ] );
		}
	} );

	/**
	 * The fallback is the part most easily got wrong on the PHP side, because nothing draws
	 * attention to it: an unknown name renders `star` rather than nothing, so a reimplementation
	 * that returns an empty body writes markup the editor rejects.
	 */
	it( 'names the fallback the registry actually uses', () => {
		expect( SVG.fallback ).toBe( getIconName( 'no-such-icon-anywhere' ) );
		expect( ( SVG.icons as Record< string, string > )[ SVG.fallback ] ).toBeTruthy();
	} );
} );
