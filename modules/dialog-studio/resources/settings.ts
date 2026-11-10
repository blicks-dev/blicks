/**
 * A saved dialog's triggers and display rules, cleaned: the browser's copy of
 * `src/Settings.php`. Both are run against `tests/settings-cases.json`, so they cannot drift.
 */

export interface Triggers {
	load: { on: boolean; delay: number };
	scroll: { on: boolean; percent: number };
	exit: { on: boolean };
	idle: { on: boolean; seconds: number };
}

export type Visitors = 'all' | 'out' | 'in';
export type Frequency = 'view' | 'session' | 'days' | 'once';

export interface Rules {
	where: 'all' | 'some';
	include: string[];
	exclude: string[];
	screens: { desktop: boolean; tablet: boolean; phone: boolean };
	visitors: Visitors;
	frequency: Frequency;
	days: number;
	stopAfterConvert: boolean;
	schedule: { on: boolean; from: string; to: string };
}

export const VISITORS: Visitors[] = [ 'all', 'out', 'in' ];
export const FREQUENCIES: Frequency[] = [ 'view', 'session', 'days', 'once' ];

export const triggerDefaults = (): Triggers => ( {
	load: { on: false, delay: 5 },
	scroll: { on: false, percent: 50 },
	exit: { on: false },
	idle: { on: false, seconds: 30 },
} );

export const ruleDefaults = (): Rules => ( {
	where: 'all',
	include: [],
	exclude: [],
	screens: { desktop: true, tablet: true, phone: true },
	visitors: 'all',
	frequency: 'session',
	days: 7,
	stopAfterConvert: true,
	schedule: { on: false, from: '', to: '' },
} );

type Obj = Record< string, unknown >;

function object( raw: unknown ): Obj {
	if ( 'string' === typeof raw && '' !== raw ) {
		try {
			raw = JSON.parse( raw );
		} catch {
			return {};
		}
	}

	return raw && 'object' === typeof raw && ! Array.isArray( raw ) ? ( raw as Obj ) : {};
}

function flag( raw: unknown, fallback: boolean ): boolean {
	if ( 'boolean' === typeof raw ) return raw;
	if ( 1 === raw || '1' === raw || 'true' === raw ) return true;
	if ( 0 === raw || '0' === raw || 'false' === raw ) return false;
	return fallback;
}

function int( raw: unknown, fallback: number, min: number, max: number ): number {
	const numeric = ( 'number' === typeof raw && Number.isFinite( raw ) ) || ( 'string' === typeof raw && '' !== raw.trim() && Number.isFinite( Number( raw ) ) );
	// PHP rounds half away from zero; Math.round rounds half up. Matched for negatives too.
	const n = numeric ? Math.sign( Number( raw ) ) * Math.round( Math.abs( Number( raw ) ) ) : fallback;
	return Math.max( min, Math.min( max, n ) );
}

function date( raw: unknown ): string {
	if ( 'string' !== typeof raw ) return '';
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec( raw );
	if ( ! m ) return '';
	const [ y, mo, d ] = [ Number( m[ 1 ] ), Number( m[ 2 ] ), Number( m[ 3 ] ) ];
	const real = new Date( Date.UTC( y, mo - 1, d ) );
	return y >= 1 && real.getUTCFullYear() === y && real.getUTCMonth() === mo - 1 && real.getUTCDate() === d ? raw : '';
}

export function places( raw: unknown ): string[] {
	const out: string[] = [];

	for ( const place of Array.isArray( raw ) ? raw : [] ) {
		if ( 'string' === typeof place && ( 'front' === place || /^type:[a-z0-9_-]{1,20}$/.test( place ) || /^post:[1-9][0-9]{0,19}$/.test( place ) ) && ! out.includes( place ) ) {
			out.push( place );
		}
	}

	return out.slice( 0, 50 );
}

export function cleanTriggers( raw: unknown ): Triggers {
	const r = object( raw );
	const load = object( r.load );
	const scroll = object( r.scroll );
	const exit = object( r.exit );
	const idle = object( r.idle );
	const d = triggerDefaults();

	return {
		load: { on: flag( load.on, false ), delay: int( load.delay, d.load.delay, 0, 600 ) },
		scroll: { on: flag( scroll.on, false ), percent: int( scroll.percent, d.scroll.percent, 1, 100 ) },
		exit: { on: flag( exit.on, false ) },
		idle: { on: flag( idle.on, false ), seconds: int( idle.seconds, d.idle.seconds, 5, 600 ) },
	};
}

export function cleanRules( raw: unknown ): Rules {
	const r = object( raw );
	const d = ruleDefaults();
	const screens = object( r.screens );
	const schedule = object( r.schedule );
	let from = date( schedule.from );
	let to = date( schedule.to );

	if ( '' !== from && '' !== to && from > to ) [ from, to ] = [ to, from ];

	return {
		where: 'all' === r.where || 'some' === r.where ? r.where : d.where,
		include: places( r.include ),
		exclude: places( r.exclude ),
		screens: { desktop: flag( screens.desktop, true ), tablet: flag( screens.tablet, true ), phone: flag( screens.phone, true ) },
		visitors: VISITORS.includes( r.visitors as Visitors ) ? ( r.visitors as Visitors ) : d.visitors,
		frequency: FREQUENCIES.includes( r.frequency as Frequency ) ? ( r.frequency as Frequency ) : d.frequency,
		days: int( r.days, d.days, 1, 365 ),
		stopAfterConvert: flag( r.stopAfterConvert, true ),
		schedule: { on: flag( schedule.on, false ), from, to },
	};
}

export const automatic = ( triggers: Triggers ): boolean => triggers.load.on || triggers.scroll.on || triggers.exit.on || triggers.idle.on;
