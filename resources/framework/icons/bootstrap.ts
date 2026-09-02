/**
 * Boots the curated Lucide library into the icon registry. Import this once from any
 * entry that needs the picker (editor bundle, admin SPA, tests). The registry itself
 * lives in `./index` and is intentionally free of side-effects so circular imports
 * don't TDZ the `LIBRARIES` map.
 */
import { registerIconLibrary } from './index';
import { LUCIDE_ICONS } from './lucide.gen';

registerIconLibrary( { id: 'lucide', label: 'Lucide', priority: 10, icons: LUCIDE_ICONS } );
