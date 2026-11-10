/**
 * The Dialog's settings, cleaned. Every option is saved as a class on the `<dialog>`, so a value
 * outside its list falls back to the default rather than writing a class no rule styles.
 */

export const KINDS = [ 'modal', 'drawer', 'sheet', 'full' ] as const;
export const SIDES = [ 'end', 'start' ] as const;
export const PLACES = [ 'center', 'top' ] as const;
export const PHONE_FORMS = [ 'keep', 'sheet', 'full' ] as const;
export const BACKDROPS = [ 'dark', 'light', 'none' ] as const;
export const MOTIONS = [ 'rise', 'scale', 'fade', 'none' ] as const;
export const FOCUS = [ '', 'close' ] as const;

export type Kind = ( typeof KINDS )[ number ];

function pick< T extends string >( list: readonly T[], value: unknown ): T {
	return list.includes( value as T ) ? ( value as T ) : list[ 0 ];
}

export const cleanKind = ( v: unknown ): Kind => pick( KINDS, v );
export const cleanSide = ( v: unknown ) => pick( SIDES, v );
export const cleanPlace = ( v: unknown ) => pick( PLACES, v );
export const cleanPhone = ( v: unknown ) => pick( PHONE_FORMS, v );
export const cleanBackdrop = ( v: unknown ) => pick( BACKDROPS, v );
export const cleanMotion = ( v: unknown ) => pick( MOTIONS, v );
export const cleanFocus = ( v: unknown ) => pick( FOCUS, v );

/** `Size guide!` → `size-guide`. The slug part of the dialog's id. */
export function slugify( value: unknown ): string {
	return String( value ?? '' )
		.normalize( 'NFKD' )
		.replace( /[̀-ͯ]/g, '' )
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' )
		.slice( 0, 48 );
}

/** The `<dialog>`'s id: what a Button's `commandfor` and a `#dialog-…` link name. */
export function dialogId( attributes: { anchor?: unknown; uniqueId?: unknown } ): string {
	const slug = slugify( attributes.anchor ) || slugify( attributes.uniqueId ) || 'dialog';
	return `dialog-${ slug }`;
}

/**
 * The option classes, in a fixed order — the order is saved markup. A setting at its default
 * that only one kind reads (the drawer's side, the modal's place and phone form) writes nothing
 * for the other kinds, so switching kinds back and forth never leaves a stray class.
 */
export function dialogClasses( attributes: any ): string[] {
	const kind = cleanKind( attributes.kind );
	const backdrop = cleanBackdrop( attributes.backdrop );
	const motion = cleanMotion( attributes.motion );
	const modal = attributes.modal !== false;

	return [
		`bl-dialog--${ kind }`,
		kind === 'drawer' ? `bl-dialog--from-${ cleanSide( attributes.side ) }` : '',
		kind === 'modal' && cleanPlace( attributes.place ) === 'top' ? 'bl-dialog--top' : '',
		kind === 'modal' && cleanPhone( attributes.phone ) !== 'keep' ? `bl-dialog--phone-${ cleanPhone( attributes.phone ) }` : '',
		modal ? 'is-modal' : '',
		modal && backdrop !== 'dark' ? `bl-dialog--bd-${ backdrop }` : '',
		modal && attributes.blur ? 'bl-dialog--blur' : '',
		motion !== 'rise' ? `bl-dialog--m-${ motion }` : '',
	].filter( Boolean );
}
