/**
 * What a `blicks/form` does in the browser, as plain functions on one `<form>`. The `form`
 * behaviour (./form.ts) calls them from the form's Interactivity directives; they import nothing,
 * so they are tested without the Interactivity runtime.
 *
 * The markup they read is written by Blicks\Forms\FormRenderer and FieldRenderer (see the form
 * contracts): a field wrapper carries `data-bl-field="<name>"` and `data-bl-error="<message>"`,
 * its control is `#blf-<uid>`, its error line `#blf-<uid>-err`.
 *
 * - Validation mirrors the server's (Blicks\Forms\Validator), with the block's own messages, so a
 *   send that passes here is not refused there for a reason the visitor could have been told.
 * - A send token is fetched on first focus and refetched when older than 90 minutes (the server
 *   accepts one for two hours).
 * - Strings the module writes come from `context.i18n` (translated at render), else English.
 * - A field inside an element with `hidden` or `inert` (a step not shown, a field logic hides) is
 *   not checked here; its value is still sent and the server decides.
 *
 * ## Events, for companion plugins
 *
 * Dispatched on the `<form>` as bubbling `CustomEvent`s, in this order on a send:
 *
 * - `blicks:form-input` — `{ field, name, value }` when a field changes (`field` is its wrapper).
 * - `blicks:form-validate` — `{ errors }`, a `Record< name, message >` from the checks here, before
 *   any is shown. Listeners may add or delete entries; what is left is shown (an entry naming no
 *   field is ignored), and any error stops the send.
 * - `blicks:form-beforesend` — cancelable. `{ payload, wait }`: `payload` is the request body
 *   (`post`, `fields`, `hp`, `challenge`; the token is added after) and may be changed or replaced;
 *   a listener may set `wait` to a Promise, which is awaited first. `preventDefault()` — then or once
 *   the wait settles — or a rejected wait stops the send quietly: the listener says why.
 * - `blicks:form-sent` — `{ response }`, the route's answer, before the after-send choice runs.
 */

export type AfterKind = 'message' | 'page' | 'dialog';
export type ChallengeKind = 'none' | 'recaptcha-v3' | 'recaptcha-v2' | 'turnstile';

export interface Strings {
	/** The summary title for one error. */
	fix1: string;
	/** The summary title for several; `%d` is the count. */
	fixN: string;
	/** The retry line after a network or server failure. */
	retry: string;
	/** The retry line after `429`. */
	busy: string;
	/** The retry line when a reCAPTCHA v2 / Turnstile check is not done yet. */
	challenge: string;
}

export interface FormContext {
	form: string;
	post: number;
	/** The token route's URL. */
	token: string;
	/** The entries route's URL. */
	entries: string;
	/** `wp_rest` nonce, logged-in visitors only. */
	nonce?: string;
	after?: { kind?: AfterKind; url?: string; dialog?: string };
	challenge?: { kind?: ChallengeKind; siteKey?: string };
	i18n?: Partial< Strings >;
	/** The form's "Wait at least" seconds; a send waits out what is left of it after the token. */
	minSeconds?: number;
}

export interface Deps {
	fetch: typeof fetch;
	now: () => number;
	wait: ( ms: number ) => Promise< void >;
	/** `location.assign`. */
	assign: ( url: string ) => void;
	/** Open a Blicks dialog by id; false when there is none to open. */
	openDialog: ( id: string ) => boolean;
	/** Where `grecaptcha` / `turnstile` live. */
	win: any;
}

export type Outcome = 'invalid' | 'sent' | 'rejected' | 'expired' | 'busy' | 'failed' | 'challenge' | 'sending' | 'cancelled';

export const EVENTS = {
	input: 'blicks:form-input',
	validate: 'blicks:form-validate',
	beforeSend: 'blicks:form-beforesend',
	sent: 'blicks:form-sent',
} as const;

export interface InputDetail {
	field: HTMLElement;
	name: string;
	value: string | string[];
}

export interface ValidateDetail {
	errors: Record< string, string >;
}

export interface BeforeSendDetail {
	payload: Record< string, unknown >;
	wait?: Promise< unknown >;
}

export interface SentDetail {
	response: unknown;
}

/** Dispatch one of the events above on the form; the event, so its detail can be read back. */
export function emit< T >( form: HTMLFormElement, type: string, detail: T, cancelable = false ): CustomEvent< T > {
	const event = new CustomEvent< T >( type, { detail, bubbles: true, cancelable } );
	form.dispatchEvent( event );
	return event;
}

export const STRINGS: Strings = {
	fix1: '1 field needs a fix',
	fixN: '%d fields need a fix',
	retry: 'That did not send. Check your connection and try again.',
	busy: 'Too many sends just now. Wait a moment and try again.',
	challenge: 'Complete the check above to send the form.',
};

const strings = ( ctx: FormContext ): Strings => ( { ...STRINGS, ...( ctx.i18n || {} ) } );

/* -------------------------------------------------------------------------------------------- */
/* Fields                                                                                        */
/* -------------------------------------------------------------------------------------------- */

const TYPES = [ 'textarea', 'email', 'tel', 'number', 'date', 'time', 'range', 'select', 'choice', 'consent', 'text' ];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The types a `maxlength` applies to (the server counts with `mb_strlen`, so code points). */
const COUNTED = [ 'text', 'textarea', 'email', 'tel' ];
const TEL = /^[0-9+()\-.\s]{5,30}$/;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const NAME = /^([a-z][a-z0-9_]{0,39})(\[\])?$/;

/** The visible field wrappers in a form (hidden fields are their own `<input>` and are skipped). */
export const fields = ( form: HTMLFormElement ): HTMLElement[] =>
	Array.from( form.querySelectorAll< HTMLElement >( '[data-bl-field]' ) ).filter( ( el ) => el.tagName !== 'INPUT' );

/** The field wrapper an element is in, if it is a visible field of this form. */
export function fieldOf( form: HTMLFormElement, target: EventTarget | null ): HTMLElement | null {
	if ( ! ( target instanceof Element ) ) return null;
	const field = target.closest< HTMLElement >( '[data-bl-field]' );
	return field && field.tagName !== 'INPUT' && form.contains( field ) ? field : null;
}

export function typeOf( field: Element ): string {
	return TYPES.find( ( t ) => field.classList.contains( `bl-field--${ t }` ) ) ?? 'text';
}

export const controls = ( field: Element ): Array< HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement > =>
	Array.from( field.querySelectorAll< HTMLInputElement >( 'input, select, textarea' ) );

/**
 * Whether a field sits in something hidden (`hidden` or `inert`) inside its form: a step not shown,
 * a field a logic rule hides. Such a field is not checked. The form itself being hidden (after it
 * was sent) does not count.
 */
export function isSkipped( field: Element ): boolean {
	const form = field.closest( 'form' );
	const hider = field.closest( '[hidden],[inert]' );
	return !! hider && hider !== form && ( ! form || form.contains( hider ) );
}

/** A field's value as it is sent: a box group's ticked values, else its control's value. */
export function fieldValue( field: Element ): string | string[] {
	const all = controls( field );
	if ( field.classList.contains( 'is-multiple' ) ) return all.filter( ( c ) => ( c as HTMLInputElement ).checked ).map( ( c ) => c.value );
	const boxes = all.filter( ( c ) => c instanceof HTMLInputElement && ( c.type === 'radio' || c.type === 'checkbox' ) );
	if ( boxes.length ) return boxes.find( ( c ) => ( c as HTMLInputElement ).checked )?.value ?? '';
	return all[ 0 ]?.value ?? '';
}

/** `blicks:form-input`, for a field that changed. */
export function announceInput( form: HTMLFormElement, field: HTMLElement ): void {
	emit< InputDetail >( form, EVENTS.input, { field, name: field.dataset.blField || '', value: fieldValue( field ) } );
}

const isRequired = ( field: Element ) =>
	field.classList.contains( 'is-required' ) || controls( field ).some( ( c ) => c.required );

const errorOf = ( field: Element ) => field.querySelector< HTMLElement >( '.bl-field__error' );

const today = () => {
	const d = new Date();
	return `${ d.getFullYear() }-${ String( d.getMonth() + 1 ).padStart( 2, '0' ) }-${ String( d.getDate() ).padStart( 2, '0' ) }`;
};

const bound = ( value: string | null ) => ( value === 'today' ? today() : value || '' );

/** A range's bounds and step, with the browser's (and the server's) defaults 0..100 step 1. */
const rangeOf = ( control: HTMLInputElement ) => {
	const num = ( name: string, fallback: number ) => {
		const v = control.getAttribute( name );
		return v !== null && v !== '' && Number.isFinite( Number( v ) ) ? Number( v ) : fallback;
	};
	const step = num( 'step', 1 );
	return { min: num( 'min', 0 ), max: num( 'max', 100 ), step: step > 0 ? step : 1 };
};

const offStep = ( n: number, base: number, step: number ) => {
	const units = ( n - base ) / step;
	return Math.abs( units - Math.round( units ) ) > 1e-9;
};

function badNumber( control: HTMLInputElement, raw: string ): boolean {
	if ( ! /^-?(\d+\.?\d*|\.\d+)$/.test( raw ) ) return true;
	const n = Number( raw );
	if ( control.type === 'range' ) {
		const { min, max, step } = rangeOf( control );
		return n < min || n > max || offStep( n, min, step );
	}
	const min = control.getAttribute( 'min' );
	const max = control.getAttribute( 'max' );
	const step = control.getAttribute( 'step' );
	if ( min !== null && min !== '' && n < Number( min ) ) return true;
	if ( max !== null && max !== '' && n > Number( max ) ) return true;
	if ( step && step !== 'any' && Number( step ) > 0 ) {
		if ( offStep( n, min ? Number( min ) : 0, Number( step ) ) ) return true;
	}
	return false;
}

function badTime( control: HTMLInputElement, raw: string ): boolean {
	if ( ! TIME.test( raw ) ) return true;
	const min = control.getAttribute( 'min' ) || '';
	const max = control.getAttribute( 'max' ) || '';
	return ( !! min && raw < min ) || ( !! max && raw > max );
}

/** Code points, as `mb_strlen` counts them. */
const length = ( value: string ) => Array.from( value ).length;

function badDate( control: HTMLInputElement, raw: string ): boolean {
	if ( ! /^\d{4}-\d{2}-\d{2}$/.test( raw ) || Number.isNaN( Date.parse( raw ) ) ) return true;
	const min = bound( control.getAttribute( 'min' ) );
	const max = bound( control.getAttribute( 'max' ) );
	return ( !! min && raw < min ) || ( !! max && raw > max );
}

/** Whether a field's value would be refused: its message, or `''` when it is fine. */
export function validate( field: Element ): string {
	const message = ( field as HTMLElement ).dataset.blError || 'Fill in this field.';
	const type = typeOf( field );
	const required = isRequired( field );
	const all = controls( field );

	if ( type === 'choice' || type === 'consent' ) {
		const ticked = all.some( ( c ) => ( c as HTMLInputElement ).checked );
		return required && ! ticked ? message : '';
	}

	const control = all[ 0 ];
	if ( ! control ) return '';
	const raw = control.value.trim();
	if ( ! raw ) return required ? message : '';

	const max = Number( control.getAttribute( 'maxlength' ) );
	if ( COUNTED.includes( type ) && max > 0 && length( raw ) > max ) return message;

	switch ( type ) {
		case 'email':
			return EMAIL.test( raw ) ? '' : message;
		case 'tel':
			return TEL.test( raw ) ? '' : message;
		case 'number':
		case 'range':
			return badNumber( control as HTMLInputElement, raw ) ? message : '';
		case 'time':
			return badTime( control as HTMLInputElement, raw ) ? message : '';
		case 'date':
			return badDate( control as HTMLInputElement, raw ) ? message : '';
		case 'select': {
			const options = Array.from( ( control as HTMLSelectElement ).options ).map( ( o ) => o.value );
			return options.includes( control.value ) ? '' : message;
		}
		default:
			return '';
	}
}

/** The element carrying the field's `aria-describedby`: a choice's fieldset, else its control. */
const describer = ( field: Element ): Element | undefined => ( field.tagName === 'FIELDSET' ? field : controls( field )[ 0 ] );

const tokens = ( el: Element ) => ( el.getAttribute( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );

export function showError( field: Element, message: string ): void {
	const error = errorOf( field );
	if ( ! error ) return;
	error.textContent = message;
	error.hidden = false;
	for ( const c of controls( field ) ) c.setAttribute( 'aria-invalid', 'true' );
	const el = describer( field );
	if ( el && error.id ) {
		const ids = tokens( el );
		if ( ! ids.includes( error.id ) ) el.setAttribute( 'aria-describedby', [ ...ids, error.id ].join( ' ' ) );
	}
}

export function clearError( field: Element ): void {
	const error = errorOf( field );
	if ( error ) {
		error.textContent = '';
		error.hidden = true;
	}
	for ( const c of controls( field ) ) c.removeAttribute( 'aria-invalid' );
	const el = describer( field );
	if ( el && error?.id ) {
		const ids = tokens( el ).filter( ( id ) => id !== error.id );
		if ( ids.length ) el.setAttribute( 'aria-describedby', ids.join( ' ' ) );
		else el.removeAttribute( 'aria-describedby' );
	}
}

export const showsError = ( field: Element ): boolean => errorOf( field )?.hidden === false;

/** Validate one field and show or clear its error. True when it is fine. A skipped field is fine. */
export function check( field: Element ): boolean {
	const message = isSkipped( field ) ? '' : validate( field );
	if ( message ) showError( field, message );
	else clearError( field );
	return ! message;
}

/** The key a field's error goes under in `blicks:form-validate`: its name, else its control id. */
export const errorKey = ( field: Element ): string => ( field as HTMLElement ).dataset.blField || controlId( field );

/**
 * Validate every field that is not skipped, let `blicks:form-validate` listeners change the
 * errors, then show what is left; the fields with an error, in page order.
 */
export function checkAll( form: HTMLFormElement ): HTMLElement[] {
	const all = fields( form );
	const errors: Record< string, string > = {};
	for ( const field of all ) {
		if ( isSkipped( field ) ) continue;
		const message = validate( field );
		if ( message ) errors[ errorKey( field ) ] = message;
	}
	const { detail } = emit< ValidateDetail >( form, EVENTS.validate, { errors } );
	const final = detail && detail.errors && typeof detail.errors === 'object' ? detail.errors : {};
	const failed: HTMLElement[] = [];
	for ( const field of all ) {
		const message = final[ errorKey( field ) ];
		if ( typeof message === 'string' && message ) {
			showError( field, message );
			failed.push( field );
		} else clearError( field );
	}
	return failed;
}

/* -------------------------------------------------------------------------------------------- */
/* Stepper, range output, counter                                                                */
/* -------------------------------------------------------------------------------------------- */

/** The number of decimals in a step, so `0.1 + 0.2` lands on `0.3`. */
const decimals = ( n: number ) => ( String( n ).split( '.' )[ 1 ] || '' ).length;

/**
 * A stepper button was pressed (`[data-bl-step]`): move its control one step up or down, kept
 * within min/max, and fire `input` so the field re-checks and listeners hear it. True when the
 * click was a stepper's.
 */
export function step( form: HTMLFormElement, target: EventTarget | null ): boolean {
	const button = target instanceof Element ? target.closest< HTMLElement >( '[data-bl-step]' ) : null;
	if ( ! button || ! form.contains( button ) ) return false;
	const id = button.getAttribute( 'aria-controls' );
	const control = ( ( id && document.getElementById( id ) ) || button.closest( '.bl-stepper' )?.querySelector( 'input' ) ) as HTMLInputElement | null;
	if ( ! control || control.disabled || control.readOnly ) return true;
	const dir = Number( button.dataset.blStep ) < 0 ? -1 : 1;
	const attr = ( name: string ) => {
		const v = control.getAttribute( name );
		return v !== null && v !== '' && Number.isFinite( Number( v ) ) ? Number( v ) : null;
	};
	const min = attr( 'min' );
	const max = attr( 'max' );
	const given = attr( 'step' );
	const by = given && given > 0 ? given : 1;
	const raw = control.value.trim();
	const current = raw !== '' && Number.isFinite( Number( raw ) ) ? Number( raw ) : null;
	// An empty stepper starts at its minimum (or 0), as the browser's own arrows do.
	let next = current === null ? min ?? 0 : current + dir * by;
	if ( min !== null ) next = Math.max( min, next );
	if ( max !== null ) next = Math.min( max, next );
	const value = String( Number( next.toFixed( Math.max( decimals( by ), decimals( min ?? 0 ) ) ) ) );
	if ( value === control.value ) return true;
	control.value = value;
	control.dispatchEvent( new Event( 'input', { bubbles: true } ) );
	return true;
}

/** A range output's prefix and suffix: `data-bl-prefix`/`-suffix`, else read off its first text. */
const affixes = new WeakMap< Element, [ string, string ] >();

function affixOf( output: HTMLElement, control: HTMLInputElement ): [ string, string ] {
	let known = affixes.get( output );
	if ( ! known ) {
		const { blPrefix, blSuffix } = output.dataset;
		if ( blPrefix !== undefined || blSuffix !== undefined ) known = [ blPrefix || '', blSuffix || '' ];
		else {
			const text = output.textContent || '';
			const at = control.value ? text.indexOf( control.value ) : -1;
			const match = at >= 0 ? null : /-?[\d.,]+/.exec( text );
			const start = at >= 0 ? at : match ? match.index : text.length;
			const end = at >= 0 ? at + control.value.length : match ? match.index + match[ 0 ].length : text.length;
			known = [ text.slice( 0, start ), text.slice( end ) ];
		}
		affixes.set( output, known );
	}
	return known;
}

/** Bring a field's live text up to date: a range's output and `aria-valuetext`, a textarea's count. */
export function syncField( field: Element ): void {
	const range = field.querySelector< HTMLInputElement >( 'input[type="range"]' );
	const output = field.querySelector< HTMLElement >( '.bl-range__value' );
	if ( range && output ) {
		const [ prefix, suffix ] = affixOf( output, range );
		// Grouped as the server writes it (number_format_i18n), in the page's language.
		const n = Number( range.value );
		const shown = Number.isFinite( n ) ? n.toLocaleString( document.documentElement.lang || undefined, { maximumFractionDigits: 10 } ) : range.value;
		const text = prefix + shown + suffix;
		output.textContent = text;
		range.setAttribute( 'aria-valuetext', text );
	}
	const count = field.querySelector( '.bl-field__count-n' );
	const box = field.querySelector( 'textarea' );
	if ( count && box ) count.textContent = String( length( box.value ) );
}

/** `syncField` for every field of the form. */
export function sync( form: HTMLFormElement ): void {
	for ( const field of fields( form ) ) syncField( field );
}

/* -------------------------------------------------------------------------------------------- */
/* Summary, retry line, busy state                                                               */
/* -------------------------------------------------------------------------------------------- */

const labelOf = ( field: Element ): string => {
	const label = field.querySelector( '.bl-field__label' ) ?? field.querySelector( '.bl-field__choice span' );
	// A field made of blocks with its label switched off is named by `aria-label` instead.
	if ( ! label ) return ( field.getAttribute( 'aria-label' ) || describer( field )?.getAttribute( 'aria-label' ) || ( field as HTMLElement ).dataset.blField || '' ).trim();
	const copy = label.cloneNode( true ) as Element;
	copy.querySelectorAll( '.bl-field__opt' ).forEach( ( el ) => el.remove() );
	return ( copy.textContent || '' ).trim() || ( field as HTMLElement ).dataset.blField || '';
};

/** `blf-<uid>`, from the field's error id. */
const controlId = ( field: Element ): string => ( errorOf( field )?.id || '' ).replace( /-err$/, '' );

/** Focus a field's control (a choice's first box). */
export function focusField( field: Element ): void {
	const id = controlId( field );
	const target = ( id && document.getElementById( id ) ) || controls( field )[ 0 ];
	( target as HTMLElement | undefined )?.focus();
}

const summaryOf = ( form: HTMLFormElement ) => form.querySelector< HTMLElement >( '.bl-form__summary' );

/** Write the error summary for these fields, show it and focus it. */
export function summarise( form: HTMLFormElement, failed: Element[], ctx: FormContext ): void {
	const summary = summaryOf( form );
	if ( ! summary ) {
		if ( failed[ 0 ] ) focusField( failed[ 0 ] );
		return;
	}
	const t = strings( ctx );
	const title = document.createElement( 'p' );
	title.className = 'bl-form__summary-title';
	title.textContent = failed.length === 1 ? t.fix1 : t.fixN.replace( '%d', String( failed.length ) );
	const list = document.createElement( 'ul' );
	for ( const field of failed ) {
		const link = document.createElement( 'a' );
		link.href = `#${ controlId( field ) }`;
		link.textContent = labelOf( field );
		link.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			focusField( field );
		} );
		const item = document.createElement( 'li' );
		item.append( link );
		list.append( item );
	}
	summary.replaceChildren( title, list );
	summary.setAttribute( 'role', 'alert' );
	summary.hidden = false;
	summary.focus();
}

export function clearSummary( form: HTMLFormElement ): void {
	const summary = summaryOf( form );
	if ( ! summary ) return;
	summary.replaceChildren();
	summary.hidden = true;
}

export function showRetry( form: HTMLFormElement, text: string ): void {
	const line = form.querySelector< HTMLElement >( '.bl-form__retry' );
	if ( ! line ) return;
	line.textContent = text;
	line.hidden = false;
}

export function clearRetry( form: HTMLFormElement ): void {
	const line = form.querySelector< HTMLElement >( '.bl-form__retry' );
	if ( ! line ) return;
	line.textContent = '';
	line.hidden = true;
}

export const isSending = ( form: HTMLFormElement ) => form.classList.contains( 'is-sending' );

export function setSending( form: HTMLFormElement, on: boolean ): void {
	form.classList.toggle( 'is-sending', on );
	if ( on ) form.setAttribute( 'aria-busy', 'true' );
	else form.removeAttribute( 'aria-busy' );
	for ( const button of form.querySelectorAll< HTMLButtonElement | HTMLInputElement >( 'button[type="submit"], input[type="submit"], button:not([type])' ) ) {
		button.disabled = on;
	}
}

/* -------------------------------------------------------------------------------------------- */
/* Values                                                                                        */
/* -------------------------------------------------------------------------------------------- */

export interface Values {
	fields: Record< string, string | string[] >;
	hp: string;
	post: number;
}

/**
 * The form's values as the entries route takes them: `name[]` boxes become arrays, the trap goes
 * to `hp`, every other `_bl_*` and anything that is not a field name (a challenge widget's own
 * response input) is left out.
 */
export function collect( form: HTMLFormElement ): Values {
	const out: Values = { fields: {}, hp: '', post: 0 };
	for ( const [ key, value ] of new FormData( form ) ) {
		if ( typeof value !== 'string' ) continue;
		if ( key === '_bl_hp' ) {
			out.hp = value;
			continue;
		}
		if ( key === '_bl_post' ) {
			out.post = Number( value ) || 0;
			continue;
		}
		const match = NAME.exec( key );
		if ( ! match ) continue;
		const [ , name, many ] = match;
		if ( many ) {
			const list = out.fields[ name ];
			out.fields[ name ] = Array.isArray( list ) ? [ ...list, value ] : [ value ];
		} else out.fields[ name ] = value;
	}
	// A box group with nothing ticked is still a field the server should see as empty.
	for ( const field of fields( form ) ) {
		const name = field.dataset.blField || '';
		if ( name && field.classList.contains( 'is-multiple' ) && ! ( name in out.fields ) ) out.fields[ name ] = [];
	}
	return out;
}

/** Fill hidden fields the server could not know (a cached page): the referrer and utm params. */
export function fill( form: HTMLFormElement, where: { search: string; referrer: string } ): void {
	const params = new URLSearchParams( where.search );
	for ( const input of form.querySelectorAll< HTMLInputElement >( 'input[data-bl-fill]' ) ) {
		if ( input.value ) continue;
		const kind = input.dataset.blFill || '';
		const value = kind === 'referrer' ? where.referrer : /^utm_[a-z]+$/.test( kind ) ? params.get( kind ) : null;
		if ( value ) input.value = value.slice( 0, 500 );
	}
}

/* -------------------------------------------------------------------------------------------- */
/* Token                                                                                         */
/* -------------------------------------------------------------------------------------------- */

export const TOKEN_LIFE = 90 * 60 * 1000;

interface TokenState {
	value?: string;
	at?: number;
	pending?: Promise< string >;
}

const tokenStates = new WeakMap< HTMLFormElement, TokenState >();

const tokenState = ( form: HTMLFormElement ): TokenState => {
	let state = tokenStates.get( form );
	if ( ! state ) tokenStates.set( form, ( state = {} ) );
	return state;
};

export const isFresh = ( at: number | undefined, now: number ): boolean => at !== undefined && now - at < TOKEN_LIFE;

export function dropToken( form: HTMLFormElement ): void {
	tokenStates.set( form, {} );
}

/** When the held token was fetched, if one is held. */
export const tokenAt = ( form: HTMLFormElement ): number | undefined => tokenStates.get( form )?.at;

export function tokenUrl( ctx: FormContext ): string {
	const url = new URL( ctx.token, document.baseURI );
	if ( ctx.post && ! url.searchParams.has( 'post' ) ) url.searchParams.set( 'post', String( ctx.post ) );
	return url.toString();
}

/** The form's send token: the one held while fresh, else a new one (one request at a time). */
export function ensureToken( form: HTMLFormElement, ctx: FormContext, deps: Deps ): Promise< string > {
	const state = tokenState( form );
	if ( state.value && isFresh( state.at, deps.now() ) ) return Promise.resolve( state.value );
	if ( state.pending ) return state.pending;
	const pending = ( async () => {
		const res = await deps.fetch( tokenUrl( ctx ), { credentials: 'same-origin', headers: { Accept: 'application/json' } } );
		if ( ! res.ok ) throw new Error( `token ${ res.status }` );
		const body = await res.json();
		if ( ! body || typeof body.token !== 'string' ) throw new Error( 'token' );
		return body.token as string;
	} )();
	state.pending = pending;
	const at = deps.now();
	pending.then(
		( value ) => {
			if ( tokenStates.get( form ) === state ) Object.assign( state, { value, at, pending: undefined } );
		},
		() => {
			if ( tokenStates.get( form ) === state ) state.pending = undefined;
		}
	);
	return pending;
}

/* -------------------------------------------------------------------------------------------- */
/* Challenge                                                                                     */
/* -------------------------------------------------------------------------------------------- */

const widgets = new WeakMap< Element, unknown >();

/**
 * Render a reCAPTCHA v2 / Turnstile widget into the form's challenge box, once its provider's
 * script (loaded async) is there. True when there is nothing (left) to do.
 */
export function mountChallenge( form: HTMLFormElement, ctx: FormContext, win: any ): boolean {
	const kind = ctx.challenge?.kind;
	const sitekey = ctx.challenge?.siteKey || '';
	if ( ( kind !== 'recaptcha-v2' && kind !== 'turnstile' ) || ! sitekey ) return true;
	const box = form.querySelector< HTMLElement >( '.bl-form__challenge' );
	if ( ! box || widgets.has( box ) ) return true;
	const api = kind === 'turnstile' ? win?.turnstile : win?.grecaptcha;
	if ( typeof api?.render !== 'function' ) return false;
	try {
		widgets.set( box, api.render( box, { sitekey } ) );
	} catch {
		return false;
	}
	return true;
}

/** Keep trying `mountChallenge` while the provider script loads. Returns a stop function. */
export function watchChallenge( form: HTMLFormElement, ctx: FormContext, win: any, every = 250, tries = 40 ): () => void {
	if ( mountChallenge( form, ctx, win ) ) return () => {};
	let left = tries;
	const attempt = () => {
		if ( mountChallenge( form, ctx, win ) || --left <= 0 ) stop();
	};
	const timer = setInterval( attempt, every );
	win?.addEventListener?.( 'load', attempt );
	function stop() {
		clearInterval( timer );
		win?.removeEventListener?.( 'load', attempt );
	}
	return stop;
}

/** The challenge answer to send: a fresh v3 token, or the v2 / Turnstile widget's response. */
export async function challengeToken( form: HTMLFormElement, ctx: FormContext, win: any ): Promise< string > {
	const kind = ctx.challenge?.kind;
	if ( kind === 'recaptcha-v3' ) {
		const api = win?.grecaptcha;
		if ( typeof api?.execute !== 'function' ) return '';
		try {
			if ( typeof api.ready === 'function' ) await new Promise< void >( ( done ) => api.ready( done ) );
			return String( ( await api.execute( ctx.challenge?.siteKey, { action: 'blicks_form' } ) ) || '' );
		} catch {
			return '';
		}
	}
	if ( kind === 'recaptcha-v2' || kind === 'turnstile' ) {
		const name = kind === 'turnstile' ? 'cf-turnstile-response' : 'g-recaptcha-response';
		const input = form.querySelector< HTMLInputElement >( `.bl-form__challenge [name="${ name }"]` );
		return input?.value || '';
	}
	return '';
}

/** A v2 / Turnstile answer is good once: reset the widget after it was used. */
export function resetChallenge( form: HTMLFormElement, ctx: FormContext, win: any ): void {
	const box = form.querySelector( '.bl-form__challenge' );
	if ( ! box || ! widgets.has( box ) ) return;
	const api = ctx.challenge?.kind === 'turnstile' ? win?.turnstile : win?.grecaptcha;
	try {
		api?.reset?.( widgets.get( box ) );
	} catch {
		// The widget is the provider's; a failed reset leaves it as it is.
	}
}

/* -------------------------------------------------------------------------------------------- */
/* Submit                                                                                        */
/* -------------------------------------------------------------------------------------------- */

const attempts = new WeakSet< HTMLFormElement >();

/** Whether a send was tried: from then on a field is checked when focus leaves it. */
export const attempted = ( form: HTMLFormElement ) => attempts.has( form );

/** Clear every field error, the summary and the retry line, and forget the attempt. */
export function resetState( form: HTMLFormElement ): void {
	for ( const field of fields( form ) ) clearError( field );
	clearSummary( form );
	clearRetry( form );
	attempts.delete( form );
}

/**
 * The form's `reset` event (a "Clear form" button, or `form.reset()`): clear what the module wrote
 * now, then re-sync outputs and counts once the browser has put the values back (`reset` fires
 * before it does).
 */
export function reset( form: HTMLFormElement, later: ( fn: () => void ) => void = ( fn ) => setTimeout( fn, 0 ) ): void {
	resetState( form );
	later( () => sync( form ) );
}

/** Apply the form's after-send choice. */
export function afterSend( form: HTMLFormElement, ctx: FormContext, deps: Deps ): void {
	const after = ctx.after || {};
	if ( after.kind === 'page' && after.url ) {
		deps.assign( after.url );
		return;
	}
	if ( after.kind === 'dialog' && after.dialog && deps.openDialog( after.dialog ) ) {
		form.reset();
		resetState( form );
		return;
	}
	resetState( form );
	form.classList.add( 'is-sent' );
	const sent = form.querySelector< HTMLElement >( '.bl-form__sent' );
	if ( sent ) {
		sent.hidden = false;
		sent.focus();
	}
}

/** Map a `422`'s `errors` onto the fields; the fields it named, in page order. */
export function applyErrors( form: HTMLFormElement, errors: Record< string, unknown > ): HTMLElement[] {
	const failed: HTMLElement[] = [];
	for ( const field of fields( form ) ) {
		const message = errors[ field.dataset.blField || '' ];
		if ( typeof message === 'string' && message ) {
			showError( field, message );
			failed.push( field );
		}
	}
	return failed;
}

async function post( ctx: FormContext, deps: Deps, body: unknown ): Promise< { status: number; data: any } > {
	const headers: Record< string, string > = { 'Content-Type': 'application/json', Accept: 'application/json' };
	if ( ctx.nonce ) headers[ 'X-WP-Nonce' ] = ctx.nonce;
	const res = await deps.fetch( ctx.entries, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify( body ) } );
	let data: any = null;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	return { status: res.status, data };
}

/**
 * The whole send: validate, then token, challenge and POST, then apply the answer. Resolves to
 * what happened; never rejects.
 */
export async function submit( form: HTMLFormElement, ctx: FormContext, deps: Deps ): Promise< Outcome > {
	if ( isSending( form ) ) return 'sending';
	attempts.add( form );
	clearRetry( form );
	const t = strings( ctx );

	const failed = checkAll( form );
	if ( failed.length ) {
		summarise( form, failed, ctx );
		return 'invalid';
	}
	clearSummary( form );

	setSending( form, true );
	try {
		const challenge = await challengeToken( form, ctx, deps.win );
		const kind = ctx.challenge?.kind;
		if ( ! challenge && ( kind === 'recaptcha-v2' || kind === 'turnstile' ) && ctx.challenge?.siteKey ) {
			showRetry( form, t.challenge );
			return 'challenge';
		}
		const values = collect( form );
		const before = emit< BeforeSendDetail >(
			form,
			EVENTS.beforeSend,
			{ payload: { post: ctx.post || values.post, fields: values.fields, hp: values.hp, challenge } },
			true
		);
		if ( before.defaultPrevented ) return 'cancelled';
		const wait = before.detail.wait;
		if ( wait && typeof ( wait as Promise< unknown > ).then === 'function' ) {
			try {
				await wait;
			} catch {
				return 'cancelled'; // the listener that set it says why
			}
			if ( before.defaultPrevented ) return 'cancelled';
		}
		const payload = before.detail.payload && typeof before.detail.payload === 'object' ? before.detail.payload : {};

		for ( let round = 0; round < 2; round++ ) {
			const token = await ensureToken( form, ctx, deps );
			// The server refuses a token younger than the form's wait; wait out what is left of it.
			const left = ( tokenAt( form ) ?? deps.now() ) + ( ctx.minSeconds || 0 ) * 1000 - deps.now();
			if ( left > 0 ) await deps.wait( left );

			const { status, data } = await post( ctx, deps, { ...payload, token } );

			if ( status >= 200 && status < 300 ) {
				resetChallenge( form, ctx, deps.win );
				dropToken( form ); // used: the server accepts a token once
				setSending( form, false );
				emit< SentDetail >( form, EVENTS.sent, { response: data } );
				afterSend( form, ctx, deps );
				return 'sent';
			}
			// A page cached for a signed-in visitor carries a nonce that has since run out; WordPress
			// then refuses the cookie outright. Send again as a visitor: the token is the permission.
			if ( status === 403 && ctx.nonce && data && data.code === 'rest_cookie_invalid_nonce' ) {
				ctx.nonce = '';
				if ( round === 0 ) continue;
			}
			if ( status === 403 ) {
				dropToken( form );
				if ( round === 0 ) continue;
				showRetry( form, t.retry );
				return 'expired';
			}
			if ( status === 422 && data && data.errors && typeof data.errors === 'object' ) {
				const named = applyErrors( form, data.errors );
				if ( named.length ) {
					summarise( form, named, ctx );
					return 'rejected';
				}
			}
			if ( status === 429 ) {
				showRetry( form, t.busy );
				return 'busy';
			}
			showRetry( form, t.retry );
			return 'failed';
		}
		return 'failed';
	} catch {
		showRetry( form, t.retry );
		return 'failed';
	} finally {
		if ( isSending( form ) ) setSending( form, false );
	}
}
