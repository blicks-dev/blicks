import type { TokenCategory } from '@/framework/types';
import catalogue from './tokens.json';

/**
 * Catalogue of design-token slugs per category. **Shared source of truth with PHP** —
 * `src/Style/Tokens.php` reads the same `tokens.json`. Used by the engine to tell a token
 * value (e.g. background = "primary") apart from a literal (e.g. "#ff0000").
 *
 * The CSS *values* live as `--blicks-<category>-<slug>` aliases in runtime CSS (which point at
 * theme.json `--wp--*` vars); this catalogue is only the set of recognised slugs.
 */
export const TOKENS = catalogue as Record< TokenCategory, readonly string[] >;

/** Whether `value` is a known token slug in `category`. */
export function isToken( category: TokenCategory, value: unknown ): boolean {
	return typeof value === 'string' && TOKENS[ category ].includes( value );
}
