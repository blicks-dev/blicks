/**
 * Blicks › Entries: the shapes the routes answer with (EntriesController) and the pure helpers the
 * screen draws from. Everything here is read defensively: a value that is not what it should be
 * becomes empty, never an error.
 */

export const ENTRIES_PATH = '/blicks/v1/forms/entries';

/** Free's own statuses. The list route may name more (`blicks_entry_statuses`, e.g. `paid`). */
export type CoreStatus = 'new' | 'handled' | 'spam';
export type EntryStatus = CoreStatus | ( string & {} );

export type StatusFilter = '' | EntryStatus;

export const STATUSES: CoreStatus[] = [ 'new', 'handled', 'spam' ];

/** A status as the list route describes it: slug, label (translated by the server), count. */
export type StatusInfo = { slug: EntryStatus; label: string; count: number };

const STATUS_SLUG = /^[a-z][a-z0-9_-]{0,31}$/;

export type Entry = {
	id: number;
	form: string;
	formTitle: string;
	post: number;
	page: string;
	fields: Record< string, string | string[] >;
	labels: Record< string, string >;
	/** Each value as text for people (file links, signatures…), when the server gives one. */
	display: Record< string, string >;
	status: EntryStatus;
	notes: string[];
	received: string;
	log: string[];
	from: string;
	email: string;
	says: string;
	challenge: string;
	userAgent?: string;
};

export type FormSummary = { id: string; title: string; count: number };

export type EntryList = {
	items: Entry[];
	total: number;
	pages: number;
	forms: FormSummary[];
	counts: Record< string, number >;
	/** The statuses to filter by and label with, in order. Free's three when the route names none. */
	statuses: StatusInfo[];
	csvUrl: string;
};

export type Query = { form: string; status: StatusFilter; search: string; page: number };

export const PER_PAGE = 20;

const record = ( value: unknown ): Record< string, unknown > =>
	value && typeof value === 'object' && ! Array.isArray( value ) ? ( value as Record< string, unknown > ) : {};

const str = ( value: unknown ): string => ( typeof value === 'string' ? value : typeof value === 'number' ? String( value ) : '' );

const int = ( value: unknown ): number => {
	const n = typeof value === 'number' ? value : parseInt( str( value ), 10 );
	return Number.isFinite( n ) && n > 0 ? Math.floor( n ) : 0;
};

const strings = ( value: unknown ): string[] => ( Array.isArray( value ) ? value.filter( ( v ): v is string => typeof v === 'string' ) : [] );

/** A status slug: one of free's, or any well-formed one a plugin added. */
export const isStatus = ( value: unknown ): value is EntryStatus => typeof value === 'string' && STATUS_SLUG.test( value );

export function normalizeEntry( value: unknown ): Entry | null {
	const raw = record( value );
	const id = int( raw.id );
	if ( ! id ) return null;

	const fields: Entry[ 'fields' ] = {};
	for ( const [ name, field ] of Object.entries( record( raw.fields ) ) ) {
		fields[ name ] = Array.isArray( field ) ? strings( field ) : str( field );
	}

	const labels: Entry[ 'labels' ] = {};
	for ( const [ name, label ] of Object.entries( record( raw.labels ) ) ) {
		if ( typeof label === 'string' ) labels[ name ] = label;
	}

	const display: Entry[ 'display' ] = {};
	for ( const [ name, text ] of Object.entries( record( raw.display ) ) ) {
		if ( typeof text === 'string' ) display[ name ] = text;
	}

	const entry: Entry = {
		id,
		form: str( raw.form ),
		formTitle: str( raw.formTitle ),
		post: int( raw.post ),
		page: str( raw.page ),
		fields,
		labels,
		display,
		status: isStatus( raw.status ) ? raw.status : 'new',
		notes: strings( raw.notes ),
		received: str( raw.received ),
		log: strings( raw.log ),
		from: str( raw.from ),
		email: str( raw.email ),
		says: str( raw.says ),
		challenge: str( raw.challenge ),
	};

	if ( typeof raw.userAgent === 'string' ) entry.userAgent = raw.userAgent;

	return entry;
}

/** Free's statuses, labelled by `label` (the screen's translations), for a route that names none. */
export function defaultStatuses( label: ( slug: CoreStatus ) => string = ( s ) => s ): StatusInfo[] {
	return STATUSES.map( ( slug ) => ( { slug, label: label( slug ), count: 0 } ) );
}

/** The route's `statuses`, cleaned; empty when it sent none (the screen then uses free's three). */
export function normalizeStatuses( value: unknown ): StatusInfo[] {
	if ( ! Array.isArray( value ) ) return [];
	const seen = new Set< string >();
	const out: StatusInfo[] = [];
	for ( const item of value ) {
		const s = record( item );
		const slug = str( s.slug );
		if ( ! isStatus( slug ) || seen.has( slug ) ) continue;
		seen.add( slug );
		out.push( { slug, label: str( s.label ) || slug, count: int( s.count ) } );
	}
	return out;
}

export function normalizeList( value: unknown ): EntryList {
	const raw = record( value );
	const rawCounts = record( raw.counts );
	const statuses = normalizeStatuses( raw.statuses );
	const counts: Record< string, number > = { new: 0, handled: 0, spam: 0 };
	for ( const [ slug, n ] of Object.entries( rawCounts ) ) if ( isStatus( slug ) ) counts[ slug ] = int( n );
	for ( const s of statuses ) if ( ! ( s.slug in rawCounts ) ) counts[ s.slug ] = s.count;

	return {
		items: ( Array.isArray( raw.items ) ? raw.items : [] ).map( normalizeEntry ).filter( ( e ): e is Entry => e !== null ),
		total: int( raw.total ),
		pages: int( raw.pages ),
		forms: ( Array.isArray( raw.forms ) ? raw.forms : [] )
			.map( ( f ) => record( f ) )
			.filter( ( f ) => str( f.id ) !== '' )
			.map( ( f ) => ( { id: str( f.id ), title: str( f.title ) || str( f.id ), count: int( f.count ) } ) ),
		counts,
		statuses,
		csvUrl: str( raw.csvUrl ),
	};
}

/** The list route's path for a query; empty filters are left out (the route refuses an empty form). */
export function listPath( query: Query ): string {
	const params = new URLSearchParams();
	if ( query.form ) params.set( 'form', query.form );
	if ( query.status ) params.set( 'status', query.status );
	if ( query.search.trim() ) params.set( 'search', query.search.trim() );
	if ( query.page > 1 ) params.set( 'page', String( query.page ) );
	params.set( 'per_page', String( PER_PAGE ) );

	return `${ ENTRIES_PATH }?${ params.toString() }`;
}

/** The CSV link: the nonce-carrying URL the list gave, narrowed to the chosen form. */
export function csvHref( csvUrl: string, form: string ): string {
	if ( ! csvUrl ) return '';
	return form ? `${ csvUrl }${ csvUrl.includes( '?' ) ? '&' : '?' }form=${ encodeURIComponent( form ) }` : csvUrl;
}

/** Reply by email: only for a real-looking address, so the link can never carry anything else. */
export function mailtoHref( email: string, subject: string ): string {
	const address = email.trim();
	if ( ! /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[^\s@<>()"',;:\\]+$/.test( address ) ) return '';

	return `mailto:${ encodeURIComponent( address ).replace( '%40', '@' ) }${ subject ? `?subject=${ encodeURIComponent( subject ) }` : '' }`;
}

/** One stored value as text. */
export function valueText( value: string | string[] | undefined ): string {
	return Array.isArray( value ) ? value.join( ', ' ) : value ?? '';
}

/** A value long enough (or multi-line) to be shown as a block of its own rather than in the list. */
export function isLong( value: string ): boolean {
	return value.length > 120 || value.includes( '\n' );
}

/** The entry's fields in stored order, label first, split into short ones and long ones. */
export function fieldRows( entry: Entry ): { short: Array< { name: string; label: string; value: string } >; long: Array< { name: string; label: string; value: string } > } {
	const short: Array< { name: string; label: string; value: string } > = [];
	const long: typeof short = [];

	for ( const [ name, value ] of Object.entries( entry.fields ) ) {
		// The server's text for people when it gave one (a file's name, "Signed"), else the raw value.
		const text = typeof entry.display?.[ name ] === 'string' ? entry.display[ name ] : valueText( value );
		const row = { name, label: entry.labels[ name ] || name, value: text };
		( isLong( text ) ? long : short ).push( row );
	}

	return { short, long };
}

/** Apply a status to some entries in a list, for the optimistic change. */
export function withStatus( items: Entry[], ids: number[], status: EntryStatus ): Entry[] {
	const set = new Set( ids );
	return items.map( ( entry ) => ( set.has( entry.id ) ? { ...entry, status } : entry ) );
}

/** Move counts as an optimistic status change would. */
export function shiftCounts( counts: EntryList[ 'counts' ], items: Entry[], ids: number[], status: EntryStatus ): EntryList[ 'counts' ] {
	const next = { ...counts };
	const set = new Set( ids );
	for ( const entry of items ) {
		if ( ! set.has( entry.id ) || entry.status === status ) continue;
		next[ entry.status ] = Math.max( 0, ( next[ entry.status ] ?? 0 ) - 1 );
		next[ status ] = ( next[ status ] ?? 0 ) + 1;
	}
	return next;
}

/** A status's label: the route's, else free's own (`fallback`), else the slug. */
export function statusLabel( slug: EntryStatus, statuses: readonly StatusInfo[], fallback: ( slug: CoreStatus ) => string ): string {
	const listed = statuses.find( ( s ) => s.slug === slug );
	if ( listed ) return listed.label;
	return ( STATUSES as string[] ).includes( slug ) ? fallback( slug as CoreStatus ) : slug;
}

/** "10:42" today, "4 Nov" this year, "4 Nov 2025" before; the full date and time for a title. */
export function receivedLabel( iso: string, now: Date = new Date(), locale?: string ): { short: string; full: string } {
	const date = new Date( iso );
	if ( ! iso || Number.isNaN( date.getTime() ) ) return { short: '', full: '' };

	const sameDay = date.toDateString() === now.toDateString();
	const sameYear = date.getFullYear() === now.getFullYear();
	const short = sameDay
		? date.toLocaleTimeString( locale, { hour: '2-digit', minute: '2-digit' } )
		: date.toLocaleDateString( locale, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' } );

	return { short, full: date.toLocaleString( locale, { dateStyle: 'medium', timeStyle: 'short' } ) };
}
