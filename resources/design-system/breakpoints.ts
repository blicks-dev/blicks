import type { Breakpoint } from '@/framework/types';
import data from './breakpoints.json';

/**
 * WP-aligned default breakpoints. **Shared source of truth with PHP** —
 * `src/Style/Breakpoints.php` reads the same `breakpoints.json`. Desktop-first (max-width);
 * responsive attribute values are keyed by `id`.
 *
 * The first entry is the **base** (no media query). Order matters — the engine cascades
 * values down this list.
 */
export const DEFAULT_BREAKPOINTS = data as Breakpoint[];
