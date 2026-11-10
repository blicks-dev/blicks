import { header } from './header';
import { headerRow } from './header-row';
import { headerArea } from './header-area';
import { nav } from './nav';
import { navItem } from './nav-item';
import { megaPanel } from './mega-panel';
import { linkList } from './link-list';
import { hasKit, type BlicksApi, type Panels } from '../blicks';

/** Every Header Studio block, registered through the free plugin's `defineBlock`. */
export function registerBlocks( api: BlicksApi ): void {
	// The v2 panels are drawn with the free plugin's kit; an older free plugin without it gets the
	// blocks with no settings of their own rather than a broken inspector.
	const panels = ( p: Panels ): { panels?: Panels } => ( hasKit() ? { panels: p } : {} );
	for ( const define of [ header, headerRow, headerArea, nav, navItem, megaPanel, linkList ] ) {
		define( api.blocks.defineBlock, panels );
	}
}
