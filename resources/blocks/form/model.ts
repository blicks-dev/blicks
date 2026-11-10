import { applyFilters } from '@wordpress/hooks';

/**
 * The Form block's settings, cleaned. `src/Forms/Schema.php::settings()` is the PHP mirror and is
 * what the server acts on: nothing the browser sends overrides it.
 */
export type Look = 'filled' | 'outlined' | 'line';
export type Labels = 'above' | 'inside' | 'hidden';
export type AfterKind = 'message' | 'page' | 'dialog';
export type ChallengeKind = 'none' | 'recaptcha-v3' | 'recaptcha-v2' | 'turnstile';

export const LOOKS: readonly Look[] = [ 'filled', 'outlined', 'line' ];
export const LABELS: readonly Labels[] = [ 'above', 'inside', 'hidden' ];
export const AFTER_KINDS: readonly AfterKind[] = [ 'message', 'page', 'dialog' ];
export const CHALLENGES: readonly ChallengeKind[] = [ 'none', 'recaptcha-v3', 'recaptcha-v2', 'turnstile' ];

/** The blocks a Form holds directly. Fields may also sit inside a Box in it. */
export const FORM_CHILDREN = [ 'blicks/field', 'blicks/button', 'blicks/buttons', 'blicks/heading', 'blicks/text', 'blicks/box' ];

/**
 * The filter a companion plugin uses to let its own blocks sit directly in a Form (a step block,
 * say). `@wordpress/hooks`, so from a plugin:
 *
 * ```js
 * wp.hooks.addFilter( 'blicks.form.allowedBlocks', 'my-plugin/step', ( blocks ) => [ ...blocks, 'my-plugin/step' ] );
 * ```
 *
 * It is read when the Form block registers and again each time a Form is drawn in the editor, so
 * add it before the `blicks-editor` script runs (declare `wp-hooks` as your dependency and load
 * earlier) or on the `blicks.forms.ready` action; either way the next draw picks it up. PHP has its
 * mirror on `block_type_metadata`.
 */
export const ALLOWED_BLOCKS_FILTER = 'blicks.form.allowedBlocks';

let allowedKey = '';
let allowed: string[] = [ ...FORM_CHILDREN ];

/**
 * The blocks a Form holds directly: FORM_CHILDREN through `blicks.form.allowedBlocks`. Anything
 * that is not a list of block names is ignored (free's own list stands). The same array is returned
 * until the answer changes, so the editor does not see a new setting on every draw.
 */
export function formAllowedBlocks(): string[] {
	const out = applyFilters( ALLOWED_BLOCKS_FILTER, [ ...FORM_CHILDREN ] ) as unknown;
	const list = Array.isArray( out ) ? Array.from( new Set( out.filter( ( n ): n is string => typeof n === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test( n ) ) ) ) : [ ...FORM_CHILDREN ];
	const key = list.join( ' ' );
	if ( key !== allowedKey ) {
		allowedKey = key;
		allowed = list;
	}
	return allowed;
}

export interface EmailAction { on: boolean; to: string; subject: string; replyTo: boolean }
export interface After { kind: AfterKind; title: string; message: string; page: number; dialog: string }
export interface Spam { minSeconds: number; challenge: ChallengeKind; minScore: number }

const pick = < T extends string >( list: readonly T[], value: unknown, fallback: T ): T =>
	list.includes( value as T ) ? ( value as T ) : fallback;

const obj = ( value: unknown ): Record< string, unknown > =>
	value && typeof value === 'object' && ! Array.isArray( value ) ? ( value as Record< string, unknown > ) : {};

export const cleanLook = ( value: unknown ) => pick( LOOKS, value, 'filled' );
export const cleanLabels = ( value: unknown ) => pick( LABELS, value, 'above' );
export const MARKERS = [ 'optional', 'required', 'both', 'none' ] as const;
export type Marker = typeof MARKERS[ number ];
export const cleanMarker = ( value: unknown ): Marker => pick( MARKERS, value, 'optional' );

export function cleanEmail( value: unknown ): EmailAction {
	const v = obj( value );
	return {
		on: v.on !== false,
		to: typeof v.to === 'string' ? v.to : '',
		subject: typeof v.subject === 'string' ? v.subject : '',
		replyTo: v.replyTo !== false,
	};
}

export function cleanAfter( value: unknown ): After {
	const v = obj( value );
	return {
		kind: pick( AFTER_KINDS, v.kind, 'message' ),
		title: typeof v.title === 'string' ? v.title : '',
		message: typeof v.message === 'string' ? v.message : '',
		page: Math.max( 0, Math.floor( Number( v.page ) || 0 ) ),
		dialog: typeof v.dialog === 'string' ? v.dialog.replace( /^dialog-/, '' ) : '',
	};
}

/** 0–60 seconds; score 0–1. */
export function cleanSpam( value: unknown ): Spam {
	const v = obj( value );
	const seconds = Number( v.minSeconds );
	const score = Number( v.minScore );
	return {
		minSeconds: Number.isFinite( seconds ) ? Math.min( 60, Math.max( 0, Math.round( seconds ) ) ) : 3,
		challenge: pick( CHALLENGES, v.challenge, 'none' ),
		minScore: Number.isFinite( score ) ? Math.min( 1, Math.max( 0, score ) ) : 0.5,
	};
}

/** The Form's classes after `bl-form bl-<uid>`, in this order (FormRenderer writes the same). */
export function formClasses( attributes: any ): string[] {
	return [ `bl-form--${ cleanLook( attributes.look ) }`, `bl-form--labels-${ cleanLabels( attributes.labels ) }` ];
}

/** The form's own name for its entries and emails: one line, trimmed. Empty means the page's title. */
export const cleanName = ( value: unknown ): string => ( typeof value === 'string' ? value.replace( /\s+/g, ' ' ).trim() : '' );

/** A theme colour slug, as `sanitize_key` keeps it; anything else is no colour. */
export const cleanErrorColour = ( value: unknown ): string => ( typeof value === 'string' ? value.toLowerCase().replace( /[^a-z0-9_-]/g, '' ) : '' );

/** The wrapper's style with the error colour set as `--bl-form-error`, as FormRenderer writes it. */
export function withErrorColour< T extends Record< string, unknown > | undefined >( style: T, colour: unknown ): T | Record< string, unknown > {
	const slug = cleanErrorColour( colour );
	return slug ? { ...( style ?? {} ), '--bl-form-error': `var(--blicks-color-${ slug })` } : style;
}
