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
// `upper`, `prefix` and `suffix` are read for bindings saved before Case and Text before/after;
// the Data section writes `case` and the `before`/`after` args instead.
export const FORMATS = [ 'none', 'upper', 'case', 'truncate', 'number', 'currency', 'date', 'prefix', 'suffix', 'join' ] as const;

/** Each format's options (`args.opts`): the values each may take, the first the default. */
export const FORMAT_OPTS = {
	case: [ 'upper', 'lower', 'title' ],
	cut: [ 'word', 'char' ],
	decimals: [ 'auto', '0', '1', '2' ],
	group: [ ',', '.', ' ', '' ],
	point: [ '.', ',' ],
	compact: [ '', 'yes' ],
	show: [ 'symbol', 'code', 'code-after', 'both' ],
	style: [ 'short', 'long', 'us', 'dmy', 'mdy', 'iso', 'weekday', 'site', 'custom' ],
} as const;

/** Currency codes → the symbol shown for them. A code not here shows as itself. */
export const CURRENCY_SYMBOLS: Record< string, string > = {
	USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', NPR: 'Rs', LKR: 'Rs', PKR: 'Rs', BDT: '৳',
	AUD: 'A$', CAD: 'CA$', NZD: 'NZ$', HKD: 'HK$', SGD: 'S$', MXN: 'MX$', BRL: 'R$', ZAR: 'R', CHF: 'CHF',
	SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', TRY: '₺', RUB: '₽', KRW: '₩', THB: '฿', VND: '₫', PHP: '₱',
	IDR: 'Rp', MYR: 'RM', AED: 'AED', SAR: 'SAR', EGP: 'E£', KES: 'KSh', NGN: '₦', ILS: '₪',
};

/** The date styles as PHP date patterns, the same on both sides. `site` and `custom` come from elsewhere. */
export const DATE_STYLES: Record< string, string > = {
	short: 'j M Y', long: 'j F Y', us: 'M j, Y', dmy: 'd/m/Y', mdy: 'm/d/Y', iso: 'Y-m-d', weekday: 'D, j M',
};

let siteDateFormat = 'F j, Y';
/** The site's date format (Settings → General), for the `site` date style. */
export function setSiteDateFormat( pattern: string ): void {
	if ( pattern ) siteDateFormat = pattern;
}
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
	// A list is set when it has items: a list of objects joins to nothing (ItemPipeline::matches).
	if ( value !== null && typeof value === 'object' && ( op === 'set' || op === 'empty' ) ) {
		return ( Object.keys( value ).length > 0 ) === ( op === 'set' );
	}
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
const DAYS = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ];
const pad = ( n: number ): string => String( n ).padStart( 2, '0' );
const ordinal = ( n: number ): string => ( n % 100 >= 11 && n % 100 <= 13 ? 'th' : [ 'th', 'st', 'nd', 'rd' ][ n % 10 ] ?? 'th' );

/**
 * A date through a PHP date pattern, in UTC. Only the day, month and year letters below are read
 * (`\x` is a literal x); any other letter shows as itself, on the page as here.
 */
function date( v: string, pattern: string ): string {
	const t = Date.parse( v );
	if ( Number.isNaN( t ) ) return v;
	const d = new Date( t );
	const day = d.getUTCDate();
	const month = d.getUTCMonth();
	const tokens: Record< string, () => string > = {
		d: () => pad( day ), j: () => String( day ), S: () => ordinal( day ),
		D: () => DAYS[ d.getUTCDay() ].slice( 0, 3 ), l: () => DAYS[ d.getUTCDay() ],
		m: () => pad( month + 1 ), n: () => String( month + 1 ),
		M: () => MONTHS[ month ].slice( 0, 3 ), F: () => MONTHS[ month ],
		y: () => String( d.getUTCFullYear() ).slice( -2 ), Y: () => String( d.getUTCFullYear() ),
	};
	let out = '';
	for ( let i = 0; i < pattern.length; i++ ) {
		const c = pattern[ i ];
		if ( c === '\\' ) {
			out += pattern[ ++i ] ?? '';
			continue;
		}
		out += tokens[ c ] ? tokens[ c ]() : c;
	}
	return out;
}

/** One of an option's allowed values, or its default (the first). */
function opt< K extends keyof typeof FORMAT_OPTS >( opts: Record< string, unknown >, key: K, fallback?: string ): string {
	const allowed = FORMAT_OPTS[ key ] as readonly string[];
	const v = scalar( opts[ key ] ?? '' );
	if ( opts[ key ] !== undefined && allowed.includes( v ) ) return v;
	return fallback !== undefined && allowed.includes( fallback ) ? fallback : allowed[ 0 ];
}

/** A number rounded to `decimals` places, in decimal (1.005 → 1.01, as PHP's round does). */
const rounded = ( n: number, decimals: number ): number => Number( Math.round( Number( `${ n }e${ decimals }` ) ) + `e-${ decimals }` );

/** A non-negative number with its thousands grouped and its decimal mark. */
function digits( n: number, decimals: number, group: string, point: string ): string {
	const [ whole, frac ] = rounded( n, decimals ).toFixed( decimals ).split( '.' );
	const grouped = whole.replace( /\B(?=(\d{3})+(?!\d))/g, group );
	return frac ? grouped + point + frac : grouped;
}

/** `auto` decimals: none for a whole number, two otherwise. */
const places = ( n: number, decimals: string ): number => ( decimals === 'auto' ? ( n % 1 === 0 ? 0 : 2 ) : Number( decimals ) );

function compact( n: number, point: string ): string | null {
	for ( const [ size, unit ] of [ [ 1e9, 'B' ], [ 1e6, 'M' ], [ 1e3, 'K' ] ] as const ) {
		if ( n >= size ) return digits( n / size, 1, '', point ).replace( new RegExp( `\\${ point }0$` ), '' ) + unit;
	}
	return null;
}

/** A symbol that ends in a letter (`Rs`, `CHF`) is kept apart from the number. */
const glue = ( symbol: string ): string => ( /\p{L}$/u.test( symbol ) ? symbol + ' ' : symbol );

function money( n: number, arg: string, opts: Record< string, unknown >, item: Item ): string {
	const field = scalar( opts.currencyField ?? '' );
	let currency = field ? scalar( item[ field ] ?? '' ).trim() : '';
	// Typed in the Data section, else the symbol saved before options (`formatArg`), else US dollars.
	if ( ! currency ) currency = scalar( opts.currency ?? '' ).trim() || arg.trim() || 'USD';
	const isCode = /^[A-Za-z]{3}$/.test( currency );
	const code = isCode ? currency.toUpperCase() : currency;
	const symbol = isCode ? CURRENCY_SYMBOLS[ code ] ?? code : currency;
	const abs = Math.abs( n );
	const num = digits( abs, places( abs, opt( opts, 'decimals' ) ), opt( opts, 'group' ), opt( opts, 'point' ) );
	let out: string;
	switch ( opt( opts, 'show' ) ) {
		case 'code': out = `${ code } ${ num }`; break;
		case 'code-after': out = `${ num } ${ code }`; break;
		case 'both': out = symbol === code ? `${ code } ${ num }` : `${ glue( symbol ) }${ num } ${ code }`; break;
		default: out = glue( symbol ) + num;
	}
	return ( n < 0 ? '-' : '' ) + out;
}

function cased( s: string, how: string ): string {
	if ( how === 'lower' ) return s.toLowerCase();
	if ( how === 'title' ) return s.toLowerCase().replace( /(^|[\s-])(\p{L})/gu, ( _m, a: string, b: string ) => a + b.toUpperCase() );
	return s.toUpperCase();
}


/**
 * One value through one format. `arg` is the single setting saved before options (`formatArg`);
 * `opts` are the format's options; `item` is the whole item, for a currency read from a field.
 * A format that cannot read the value leaves it as it was.
 */
export function format( value: unknown, fmt: string, arg: string, opts: Record< string, unknown > = {}, item: Item = {} ): string {
	switch ( fmt ) {
		case 'upper': return text( value ).toUpperCase();
		case 'case': return cased( text( value ), opt( opts, 'case' ) );
		case 'truncate': {
			const limit = Math.max( 1, parseInt( arg === '' ? '80' : arg, 10 ) || 1 );
			const s = text( value );
			const chars = Array.from( s );
			if ( chars.length <= limit ) return s;
			const cut = chars.slice( 0, limit ).join( '' );
			return ( opt( opts, 'cut' ) === 'char' ? cut : cut.replace( /\s+\S*$/u, '' ) ) + '…';
		}
		case 'number': {
			const s = text( value );
			if ( ! isNumeric( s ) ) return s;
			const n = Number( s );
			const abs = Math.abs( n );
			const point = opt( opts, 'point' );
			const short = opt( opts, 'compact' ) === 'yes' ? compact( abs, point ) : null;
			// No Decimals option: the setting saved before options (0–6), else none.
			const decimals = opts.decimals !== undefined ? places( abs, opt( opts, 'decimals' ) ) : Math.max( 0, Math.min( 6, parseInt( arg, 10 ) || 0 ) );
			return ( n < 0 ? '-' : '' ) + ( short ?? digits( abs, decimals, opt( opts, 'group' ), point ) );
		}
		case 'currency': {
			const s = text( value );
			return isNumeric( s ) ? money( Number( s ), arg, opts, item ) : s;
		}
		case 'date': {
			const style = opt( opts, 'style', arg === 'long' ? 'long' : 'short' );
			const pattern = style === 'site' ? siteDateFormat : style === 'custom' ? scalar( opts.pattern ?? '' ) || DATE_STYLES.short : DATE_STYLES[ style ];
			return date( text( value ), pattern );
		}
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

export interface BindingArgs {
	key?: string;
	fallback?: unknown;
	format?: string;
	formatArg?: unknown;
	/** The format's options ({@see FORMAT_OPTS}, plus `currency`, `currencyField` and `pattern`). */
	opts?: Record< string, unknown >;
	/** Text around the value, whatever the format; not around the fallback. */
	before?: unknown;
	after?: unknown;
}

/**
 * A binding saved before format options, in today's shape: Upper case → Case, "Add text
 * before/after" → the Text before/after fields, a currency symbol, decimals or date style kept in
 * `formatArg` → its option. Shows the same text; the Data section writes this shape back.
 */
export function upgrade( args: BindingArgs ): BindingArgs {
	const next: BindingArgs = { ...args, opts: { ...( args.opts ?? {} ) } };
	const arg = args.formatArg === undefined ? '' : String( args.formatArg );
	const opts = next.opts as Record< string, unknown >;
	const take = () => delete next.formatArg;
	switch ( args.format ) {
		case 'upper':
			next.format = 'case';
			opts.case = 'upper';
			break;
		case 'prefix':
			next.before = arg + String( args.before ?? '' );
			delete next.format;
			take();
			break;
		case 'suffix':
			next.after = String( args.after ?? '' ) + arg;
			delete next.format;
			take();
			break;
		case 'currency':
			if ( arg && opts.currency === undefined ) {
				opts.currency = arg;
				take();
			}
			break;
		case 'number':
			if ( [ '0', '1', '2' ].includes( arg ) && opts.decimals === undefined ) {
				opts.decimals = arg;
				take();
			}
			break;
		case 'date':
			if ( arg && opts.style === undefined ) {
				opts.style = arg === 'long' ? 'long' : 'short';
				take();
			}
			break;
	}
	if ( ! Object.keys( opts ).length ) delete next.opts;
	return next;
}

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
	const opts = isObject( args.opts ) ? args.opts : {};
	let out = scalar( args.before ?? '' ) + format( value, fmt, arg, opts, item ) + scalar( args.after ?? '' );
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
