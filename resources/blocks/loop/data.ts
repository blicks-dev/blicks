/**
 * The Loop's data steps in the editor: the same filter, sort, formats and rules as the page
 * (src/Data/ItemPipeline.php, Formatter.php, Rules.php), so a preview can update while someone
 * types instead of waiting for the server.
 *
 * The server stays the truth — the editor shows the items `blicks/v1/loop/items` returns — and
 * both sides are held to tests/fixtures/loop-cases.json. Change a case there before either side.
 */

export type Item = Record< string, unknown >;

export const OPS = [ 'is', 'not', 'has', 'gt', 'lt', 'set', 'empty' ] as const;
export const FORMATS = [ 'none', 'upper', 'truncate', 'number', 'currency', 'date', 'prefix', 'suffix', 'join' ] as const;
export const ACTIONS = {
	size: [ '1x1', '2x1', '1x2', '2x2', '3x2', '4x1' ],
	card: [ 'highlight', 'dark', 'muted' ],
	badge: [ 'brand', 'success', 'warn', 'danger' ],
	heading: [ 'lg', 'xl' ],
} as const;

export interface Effects {
	span: [ number, number ];
	card: string;
	hide: string[];
	badge: string;
	heading: string;
	rules: number[];
}

const isList = ( v: unknown ): v is unknown[] => Array.isArray( v );
const isObject = ( v: unknown ): v is Record< string, unknown > => !! v && typeof v === 'object' && ! Array.isArray( v );

/** Any value as text: booleans as "true"/"false", anything not a scalar as "". */
export function scalar( v: unknown ): string {
	if ( typeof v === 'boolean' ) return v ? 'true' : 'false';
	if ( typeof v === 'number' ) return Number.isFinite( v ) ? String( v ) : '';
	if ( typeof v === 'string' ) return v;
	return '';
}

const text = ( v: unknown ): string => ( isList( v ) ? v.map( scalar ).join( ', ' ) : scalar( v ) );
const isNumeric = ( s: string ): boolean => s.trim() !== '' && Number.isFinite( Number( s ) );

export function matches( value: unknown, op: string, want: string ): boolean {
	const s = text( value );
	switch ( op ) {
		case 'is': return s.toLowerCase() === want.toLowerCase();
		case 'not': return s.toLowerCase() !== want.toLowerCase();
		case 'has': return want === '' || s.toLowerCase().includes( want.toLowerCase() );
		case 'gt': return isNumeric( s ) && isNumeric( want ) && Number( s ) > Number( want );
		case 'lt': return isNumeric( s ) && isNumeric( want ) && Number( s ) < Number( want );
		case 'set': return s !== '';
		case 'empty': return s === '';
	}
	return false;
}

function sortable( v: unknown ): number | string | null {
	if ( typeof v === 'number' ) return v;
	if ( typeof v === 'boolean' ) return v ? 1 : 0;
	if ( typeof v === 'string' && v !== '' ) return v;
	if ( isList( v ) && v.length ) return v.map( scalar ).join( ', ' );
	return null;
}

const collator = new Intl.Collator( 'en', { numeric: true, sensitivity: 'base' } );

export function compare( a: unknown, b: unknown ): number {
	const x = sortable( a );
	const y = sortable( b );
	if ( x === null && y === null ) return 0;
	if ( x === null ) return 1;
	if ( y === null ) return -1;
	if ( typeof x === 'number' && typeof y === 'number' ) return Math.sign( x - y );
	return Math.sign( collator.compare( String( x ), String( y ) ) );
}

export interface PipelineConfig {
	filter?: { field?: string; op?: string; value?: unknown } | null;
	sort?: { field?: string; dir?: string } | null;
	offset?: number;
	limit?: number;
}

export function run( items: Item[], config: PipelineConfig, sliced = false ): { items: Item[]; total: number; matched: number } {
	const total = items.length;
	let rows = items.slice();
	const field = config.filter?.field ?? '';
	if ( field ) {
		const op = config.filter?.op ?? 'is';
		const want = scalar( config.filter?.value ?? '' );
		rows = rows.filter( ( r ) => matches( r[ field ], op, want ) );
	}
	const matched = rows.length;
	const by = config.sort?.field ?? '';
	if ( by ) {
		const dir = config.sort?.dir === 'desc' ? -1 : 1;
		// Array.prototype.sort is stable, as PHP's usort is from 8.0: ties keep their order.
		rows.sort( ( a, b ) => compare( a[ by ], b[ by ] ) * dir );
	}
	if ( ! sliced ) {
		const offset = Math.max( 0, Number( config.offset ) || 0 );
		const limit = Number( config.limit ) || 0;
		rows = rows.slice( offset, limit > 0 ? offset + limit : undefined );
	}
	return { items: rows.slice( 0, 50 ), total, matched };
}

export function typeOf( key: string, v: unknown ): string {
	if ( isList( v ) ) return 'list';
	if ( isObject( v ) ) return 'object';
	if ( typeof v === 'boolean' ) return 'yes/no';
	if ( typeof v === 'number' ) return 'number';
	if ( typeof v === 'string' ) {
		if ( /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i.test( v ) || /image|photo|avatar|thumb/i.test( key ) ) return 'image';
		if ( /^(https?:)?\/\//i.test( v ) || v.startsWith( '/' ) || /url|link|href|profile/i.test( key ) ) return 'link';
		if ( /^\d{4}-\d{2}-\d{2}/.test( v ) ) return 'date';
	}
	return 'text';
}

/** Every list of objects inside a value, with its dot path and length, in document order. */
export function lists( value: unknown ): Array< { path: string; count: number } > {
	const out: Array< { path: string; count: number } > = [];
	( function walk( v: unknown, path: string, depth: number ) {
		if ( depth > 6 || ! v || typeof v !== 'object' ) return;
		if ( isList( v ) ) {
			if ( v.length && v.every( ( x ) => isObject( x ) || ( isList( x ) && x.length === 0 ) ) ) out.push( { path, count: v.length } );
			return;
		}
		for ( const k of Object.keys( v ) ) walk( ( v as Record< string, unknown > )[ k ], path ? `${ path }.${ k }` : k, depth + 1 );
	} )( value, '', 0 );
	return out;
}

const MONTHS = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];

function date( v: string, long: boolean ): string {
	const t = Date.parse( v );
	if ( Number.isNaN( t ) ) return v;
	const d = new Date( t );
	const month = MONTHS[ d.getUTCMonth() ];
	return `${ d.getUTCDate() } ${ long ? month : month.slice( 0, 3 ) } ${ d.getUTCFullYear() }`;
}

const grouped = ( n: number, decimals: number ): string =>
	n.toLocaleString( 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals } );

export function format( value: unknown, fmt: string, arg: string ): string {
	switch ( fmt ) {
		case 'upper': return text( value ).toUpperCase();
		case 'truncate': {
			const limit = Math.max( 1, parseInt( arg === '' ? '80' : arg, 10 ) || 1 );
			const s = text( value );
			const chars = Array.from( s );
			if ( chars.length <= limit ) return s;
			return chars.slice( 0, limit ).join( '' ).replace( /\s+\S*$/u, '' ) + '…';
		}
		case 'number': {
			const s = text( value );
			if ( ! isNumeric( s ) ) return s;
			return grouped( Number( s ), Math.max( 0, Math.min( 6, parseInt( arg, 10 ) || 0 ) ) );
		}
		case 'currency': {
			const s = text( value );
			if ( ! isNumeric( s ) ) return s;
			const n = Number( s );
			return ( arg === '' ? '$' : arg ) + grouped( n, n % 1 === 0 ? 0 : 2 );
		}
		case 'date': return date( text( value ), arg === 'long' );
		case 'prefix': return arg + text( value );
		case 'suffix': return text( value ) + arg;
		case 'join': return isList( value ) ? value.map( scalar ).join( arg === '' ? ', ' : arg ) : text( value );
	}
	return text( value );
}

export function safeUrl( url: string ): string {
	const u = url.trim();
	return /^(https?:\/\/\S+|\/(?!\/)\S*|#\S*)$/i.test( u ) ? u : '';
}

export interface BindingArgs { key?: string; fallback?: unknown; format?: string; formatArg?: unknown }

export function resolve( item: Item, args: BindingArgs, kind: string = 'text' ): { text: string; from: 'field' | 'fallback' } {
	const key = typeof args.key === 'string' ? args.key : '';
	const isUrl = kind === 'url' || kind === 'image';
	// The fallback comes from post content too, so an address gets the same check as a field.
	const fallback = isUrl ? safeUrl( scalar( args.fallback ?? '' ) ) : scalar( args.fallback ?? '' );
	const fmt = ( FORMATS as readonly string[] ).includes( args.format ?? '' ) ? ( args.format as string ) : 'none';
	const arg = scalar( args.formatArg ?? '' );
	let value: unknown = key ? item[ key ] : undefined;
	if ( isList( value ) && fmt !== 'join' ) value = value.map( scalar ).join( ', ' );
	if ( isObject( value ) ) value = undefined;
	if ( value === undefined || value === null || value === '' || ( isList( value ) && ! value.length ) ) return { text: fallback, from: 'fallback' };
	let out = format( value, fmt, arg );
	if ( isUrl ) {
		out = safeUrl( out );
		if ( ! out ) return { text: fallback, from: 'fallback' };
	}
	return { text: out, from: 'field' };
}

export interface Rule { when?: { field?: string; op?: string; value?: unknown; position?: string }; then?: Array< Record< string, string > > }

export function hits( rule: Rule, item: Item, position: number ): boolean {
	const when = rule.when ?? {};
	if ( when.position !== undefined ) {
		const n = Math.max( 1, parseInt( scalar( when.value ?? 1 ), 10 ) || 1 );
		if ( when.position === 'every' ) return position % n === 0;
		if ( when.position === 'first' ) return position <= n;
		if ( when.position === 'is' ) return position === n;
		return false;
	}
	const field = typeof when.field === 'string' ? when.field : '';
	return field ? matches( item[ field ], when.op ?? 'is', scalar( when.value ?? '' ) ) : false;
}

export function effects( rules: Rule[], item: Item, position: number, span: [ number, number ] = [ 1, 1 ] ): Effects {
	const fx: Effects = { span, card: '', hide: [], badge: '', heading: '', rules: [] };
	rules.slice( 0, 12 ).forEach( ( rule, i ) => {
		if ( ! rule || ! hits( rule, item, position ) ) return;
		fx.rules.push( i + 1 );
		for ( const action of ( rule.then ?? [] ).slice( 0, 6 ) ) {
			for ( const [ type, value ] of Object.entries( action ?? {} ) ) {
				if ( type === 'hide' ) {
					if ( typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test( value ) ) fx.hide.push( value );
					continue;
				}
				const allowed = ( ACTIONS as Record< string, readonly string[] > )[ type ];
				if ( ! allowed || ! allowed.includes( value ) ) continue;
				if ( type === 'size' ) fx.span = value.split( 'x' ).map( Number ) as [ number, number ];
				else ( fx as any )[ type ] = value;
			}
		}
	} );
	fx.hide = [ ...new Set( fx.hide ) ];
	return fx;
}

export function slotSpan( tiles: unknown[], slot: number, repeat: boolean ): [ number, number ] {
	const good = tiles.filter( ( t ): t is string => typeof t === 'string' && /^[1-4]x[1-3]$/.test( t ) );
	if ( ! good.length || ( slot >= good.length && ! repeat ) ) return [ 1, 1 ];
	return good[ slot % good.length ].split( 'x' ).map( Number ) as [ number, number ];
}
