/**
 * Header Studio's editor bundle: the header blocks, through the free plugin's `defineBlock`, and,
 * where the Studio is loaded (`blicks-studio`, which the provider then puts ahead of this script),
 * the header mode. Everything is read off `window.blicks`.
 */
import { blicks } from './blicks';
import { registerBlocks } from './blocks';
import { admin, studio } from './studio/host';
import { registerAdmin } from './admin';
import { registerStudio } from './studio';
import './style.scss';

const api = blicks();

if ( api ) {
	registerBlocks( api );

	const host = studio();
	if ( host && host.version >= 3 ) {
		registerStudio( host );
	}

	const adminHost = admin();
	if ( adminHost ) {
		registerAdmin( adminHost );
	}
} else {
	console.error( 'Header Studio needs Blicks with its block API (window.blicks.blocks).' );
}
