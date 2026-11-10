/**
 * A paged Loop's settings and page numbers, as src/Data/Pager.php has them. The editor draws the
 * same page links the page will under its preview; both sides are held to the "pages" cases in
 * tests/fixtures/loop-cases.json.
 */

export type PagerMode = 'pages' | 'more';

export interface Pagination {
	mode?: PagerMode;
	show?: 'numbers' | 'count';
	look?: 'pills' | 'boxes' | 'text';
	button?: 'default' | 'outline' | 'secondary' | 'ghost';
	align?: 'start' | 'center' | 'end' | 'between';
	infinite?: boolean;
	labels?: Partial< Record< 'prev' | 'next' | 'nav' | 'more' | 'status', string > >;
}

export interface PageEntry {
	n: number | null;
	after: number;
	wide: boolean;
	narrow: boolean;
}

/** Items per page when the Loop's limit is 0 ("every item"); Pager::DEFAULT_PER_PAGE. */
export const DEFAULT_PER_PAGE = 12;

const REACH = { wide: 2, narrow: 1 } as const;

/** The Loop's pagination when it is on, else null: Pager::sanitize() decides the rest. */
export function paging( attributes: { pagination?: Pagination } ): Pagination | null {
	const p = attributes.pagination;
	return p && ( p.mode === 'pages' || p.mode === 'more' ) ? p : null;
}

export function perPage( limit: unknown ): number {
	const n = Number( limit ) || 0;
	return n > 0 ? Math.min( 50, n ) : DEFAULT_PER_PAGE;
}

/** Pager::sequence(): the page numbers and gaps around `current`, for wide screens and phones. */
export function sequence( current: number, count: number ): PageEntry[] {
	count = Math.max( 1, count );
	current = Math.min( Math.max( 1, current ), count );
	const entries = new Map< string, PageEntry & { key: number } >();

	for ( const screen of [ 'wide', 'narrow' ] as const ) {
		let last = 0;
		for ( let n = 1; n <= count; n++ ) {
			if ( n !== 1 && n !== count && Math.abs( n - current ) > REACH[ screen ] ) continue;
			if ( last > 0 && n - last > 1 ) {
				const gap = entries.get( `g${ last }` ) ?? { n: null, after: last, key: last + 0.5, wide: false, narrow: false };
				gap[ screen ] = true;
				entries.set( `g${ last }`, gap );
			}
			const page = entries.get( `p${ n }` ) ?? { n, after: n, key: n, wide: false, narrow: false };
			page[ screen ] = true;
			entries.set( `p${ n }`, page );
			last = n;
		}
	}

	return [ ...entries.values() ].sort( ( a, b ) => a.key - b.key ).map( ( { key: _key, ...e } ) => e );
}

/** The Load more count, `{shown}` and `{total}` filled in. */
export function statusText( template: string, shown: number, total: number ): string {
	return template.replace( /\{shown\}/g, String( Math.min( shown, total ) ) ).replace( /\{total\}/g, String( total ) );
}
