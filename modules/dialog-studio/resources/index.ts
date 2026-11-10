/**
 * Dialog Studio's editor bundle. One script, loaded in two places by `src/Module.php`: with the
 * Studio in the block editor, and with the Blicks admin app. It registers whatever it finds the
 * host for.
 */
import { addFilter } from '@wordpress/hooks';
import { admin, studio } from './host';
import { registerAdmin } from './admin';
import { registerStudio } from './studio';
import { withSaved } from './targets';
import './editor.css';

const host = studio();

if ( host && host.version >= 3 ) {
	registerStudio( host );
	addFilter( 'blicks.dialog.targets', 'blicks-pro/dialog-studio', withSaved );
}

const adminHost = admin();

if ( adminHost ) {
	registerAdmin( adminHost );
}
