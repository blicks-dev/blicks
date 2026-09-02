/**
 * Core framework types shared across the engine, controls, and design system.
 */

/** A responsive breakpoint. Desktop-first by default (`max`); `min` enables mobile-first. */
export interface Breakpoint {
	id: string;
	label: string;
	max?: number | null;
	min?: number | null;
}

/** A value that may vary per breakpoint, keyed by breakpoint id (e.g. `{ base, tablet }`). */
export type Responsive< T > = Record< string, T >;

/** Design-token categories the engine can recognise. */
export type TokenCategory =
	| 'color'
	| 'spacing'
	| 'radius'
	| 'shadow'
	| 'fontSize'
	| 'fontFamily'
	| 'transition'
	| 'transform'
	| 'filter'
	| 'borderWidth'
	| 'zIndex'
	| 'width'
	| 'aspect'
	| 'leading'
	| 'gradient'
	| 'opacity';
