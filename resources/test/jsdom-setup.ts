/**
 * jsdom shims for tests that import `@wordpress/block-editor`.
 *
 * The block editor pulls in components that touch browser APIs jsdom does not implement
 * at module-eval time. None of these are exercised by the assertions — they only need to
 * exist so the import graph loads.
 */

class NoopObserver {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
	takeRecords(): unknown[] {
		return [];
	}
}

const g = globalThis as any;

g.ResizeObserver ??= NoopObserver;
g.IntersectionObserver ??= NoopObserver;

if ( typeof window !== 'undefined' ) {
	window.matchMedia ??= ( ( query: string ) => ( {
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	} ) ) as any;

	// jsdom implements CSS.supports only partially; the style pipeline feature-detects with it.
	g.CSS ??= {};
	g.CSS.supports ??= () => false;

	window.scrollTo ??= ( () => {} ) as any;
}
