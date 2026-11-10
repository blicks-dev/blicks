import { __, _n, sprintf } from '@wordpress/i18n';
import { timeAgo } from './data';

/**
 * The site's data endpoints, as the Settings screen edits them. The server owns the list
 * (`src/Data/EndpointRegistry.php`): it checks every address, makes the id and answers with the
 * whole list after each change, so this file only reads what comes back and words it.
 */

export const DATA_SOURCES_PATH = '/blicks/v1/data-endpoints';

/** How many posts use an endpoint, asked before it is removed: `?endpoint=<id>`. */
export const DATA_SOURCES_USAGE_PATH = '/blicks/v1/loop/usage';

/** The section's anchor, so a Loop's "Add one" link lands on it: `#settings/data-sources`. */
export const DATA_SOURCES_ANCHOR = 'data-sources';

export type CacheTime = '5m' | '1h' | '6h' | '1d';

/**
 * How the last fetch went, read from the server's cache (`EndpointSource::status()`); listing never
 * fetches. Times are Unix seconds, 0 when unknown.
 */
export type FetchStatus = {
	state: 'fresh' | 'stale' | 'failed' | 'never';
	fetchedAt: number;
	failedAt: number;
	error: string;
};

export type DataSource = {
	id: string;
	name: string;
	url: string;
	cache: CacheTime;
	keepLastGood: boolean;
	/** Administrators only; absent from an editor-level answer. */
	status?: FetchStatus;
};

/** What the form holds. `id` is empty while adding. */
export type DataSourceDraft = Omit< DataSource, 'id' | 'status' > & { id: string };

export type FieldErrors = Partial< Record< 'name' | 'url' | 'id', string > >;

export type TestResult = { ok: true; ms: number; bytes: number; fetchedAt: number } | { ok: false; ms: number; message: string };

const CACHE_TIMES: readonly CacheTime[] = [ '5m', '1h', '6h', '1d' ];

export function cacheLabel( cache: CacheTime ): string {
	return {
		'5m': __( 'Every 5 minutes', 'blicks' ),
		'1h': __( 'Every hour', 'blicks' ),
		'6h': __( 'Every 6 hours', 'blicks' ),
		'1d': __( 'Once a day', 'blicks' ),
	}[ cache ];
}

export const CACHE_OPTIONS: ReadonlyArray< [ CacheTime, () => string ] > = CACHE_TIMES.map( ( cache ) => [ cache, () => cacheLabel( cache ) ] );

export const EMPTY_DRAFT: DataSourceDraft = { id: '', name: '', url: '', cache: '1h', keepLastGood: true };

const isRecord = ( value: unknown ): value is Record< string, unknown > => typeof value === 'object' && value !== null && ! Array.isArray( value );

/** The list out of any answer the routes give (`{ endpoints: [...] }`), dropping what is malformed. */
export function normalizeDataSources( raw: unknown ): DataSource[] {
	const list = isRecord( raw ) && Array.isArray( raw.endpoints ) ? raw.endpoints : [];
	return list.flatMap( ( entry ): DataSource[] => {
		if ( ! isRecord( entry ) || typeof entry.id !== 'string' || typeof entry.name !== 'string' ) {
			return [];
		}
		const source: DataSource = {
			id: entry.id,
			name: entry.name,
			url: typeof entry.url === 'string' ? entry.url : '',
			cache: CACHE_TIMES.includes( entry.cache as CacheTime ) ? entry.cache as CacheTime : '1h',
			keepLastGood: entry.keepLastGood !== false,
		};
		const status = normalizeStatus( entry.status );
		return [ status ? { ...source, status } : source ];
	} );
}

const STATES: ReadonlyArray< FetchStatus[ 'state' ] > = [ 'fresh', 'stale', 'failed', 'never' ];

function normalizeStatus( raw: unknown ): FetchStatus | undefined {
	if ( ! isRecord( raw ) || ! STATES.includes( raw.state as FetchStatus[ 'state' ] ) ) {
		return undefined;
	}
	const seconds = ( value: unknown ): number => ( typeof value === 'number' && value > 0 ? value : 0 );
	return {
		state: raw.state as FetchStatus[ 'state' ],
		fetchedAt: seconds( raw.fetchedAt ),
		failedAt: seconds( raw.failedAt ),
		error: typeof raw.error === 'string' ? raw.error : '',
	};
}

/** The status a test leaves behind, so the list updates without asking the server again. */
export function statusAfterTest( was: FetchStatus | undefined, result: TestResult, now = Math.floor( Date.now() / 1000 ) ): FetchStatus {
	if ( result.ok ) {
		return { state: 'fresh', fetchedAt: result.fetchedAt || now, failedAt: 0, error: '' };
	}
	return { state: 'failed', fetchedAt: was?.fetchedAt ?? 0, failedAt: now, error: result.message };
}

const ago = ( seconds: number ): string => timeAgo( new Date( seconds * 1000 ).toISOString() );

/** One line for the list: "Fetched 5 minutes ago", "Stale · fetched 2 days ago", "Failed 1 hour ago: …". */
export function statusLine( status: FetchStatus ): string {
	switch ( status.state ) {
		case 'fresh':
			/* translators: %s: how long ago, e.g. "5 minutes ago". */
			return sprintf( __( 'Fetched %s', 'blicks' ), ago( status.fetchedAt ) );
		case 'stale':
			/* translators: %s: how long ago, e.g. "2 days ago". */
			return sprintf( __( 'Stale · last fetched %s; a fresh copy is fetched on the next visit', 'blicks' ), ago( status.fetchedAt ) );
		case 'failed':
			return status.error
				/* translators: 1: how long ago, e.g. "1 hour ago", 2: the error, e.g. "The endpoint answered with status 503." */
				? sprintf( __( 'Failed %1$s: %2$s', 'blicks' ), ago( status.failedAt ), status.error )
				/* translators: %s: how long ago, e.g. "1 hour ago". */
				: sprintf( __( 'Failed %s', 'blicks' ), ago( status.failedAt ) );
		default:
			return __( 'Not fetched yet', 'blicks' );
	}
}

/** The count out of a `loop/usage` answer, or null when it could not be read. */
export function normalizeUsage( raw: unknown ): number | null {
	return isRecord( raw ) && typeof raw.count === 'number' && raw.count >= 0 ? Math.floor( raw.count ) : null;
}

/** The remove confirmation, with how many posts go empty when the count is known. */
export function removeWarning( name: string, count: number | null | 'loading' ): string {
	if ( count === 0 ) {
		/* translators: %s: data source name. */
		return sprintf( __( 'Remove “%s”? No posts use it.', 'blicks' ), name );
	}
	if ( typeof count === 'number' ) {
		return sprintf(
			/* translators: 1: data source name, 2: number of posts and pages. */
			_n( 'Remove “%1$s”? Used on %2$d page. Its Loops go empty until an author picks another.', 'Remove “%1$s”? Used on %2$d pages. Their Loops go empty until an author picks another.', count, 'blicks' ),
			name,
			count
		);
	}
	/* translators: %s: data source name. */
	return sprintf( __( 'Remove “%s”? Loops that use it go empty until an author picks another.', 'blicks' ), name );
}

/**
 * The per-field messages out of a refused save. The server answers 422 with
 * `{ errors: { name?, url?, id? } }`; anything else (no network, a 500) becomes one message on
 * the form as a whole.
 */
export function fieldErrors( error: unknown ): { fields: FieldErrors; message: string } {
	const fields: FieldErrors = {};
	if ( isRecord( error ) && isRecord( error.errors ) ) {
		for ( const key of [ 'name', 'url', 'id' ] as const ) {
			const value = error.errors[ key ];
			if ( typeof value === 'string' && value !== '' ) {
				fields[ key ] = value;
			}
		}
	}
	if ( Object.keys( fields ).length > 0 ) {
		return { fields, message: '' };
	}
	const message = isRecord( error ) && typeof error.message === 'string' ? error.message : '';
	return { fields, message: message || __( 'That did not save. Try again.', 'blicks' ) };
}

export function normalizeTest( raw: unknown ): TestResult {
	const ms = isRecord( raw ) && typeof raw.ms === 'number' ? raw.ms : 0;
	if ( isRecord( raw ) && raw.ok === true ) {
		return { ok: true, ms, bytes: typeof raw.bytes === 'number' ? raw.bytes : 0, fetchedAt: typeof raw.fetchedAt === 'number' ? raw.fetchedAt : 0 };
	}
	const message = isRecord( raw ) && typeof raw.message === 'string' ? raw.message : '';
	return { ok: false, ms, message: message || __( 'The endpoint did not answer.', 'blicks' ) };
}

function size( bytes: number ): string {
	if ( bytes < 1024 ) {
		/* translators: %d: size in bytes. */
		return sprintf( __( '%d bytes', 'blicks' ), bytes );
	}
	/* translators: %s: size in kilobytes, e.g. 12.4. */
	return sprintf( __( '%s KB', 'blicks' ), ( bytes / 1024 ).toFixed( bytes < 10240 ? 1 : 0 ) );
}

export function testSummary( result: TestResult ): string {
	if ( result.ok ) {
		/* translators: 1: response time in milliseconds, 2: response size, e.g. "12 KB". */
		return sprintf( __( 'Answered in %1$d ms with %2$s of JSON. Loops using it now show this answer.', 'blicks' ), result.ms, size( result.bytes ) );
	}
	return result.message;
}

/** The address without its scheme, for the list: `api.example.com/cards?limit=12`. */
export function shortUrl( url: string ): string {
	return url.replace( /^https:\/\//i, '' );
}
