/**
 * Layout blocks keep a few settings twice: as an attribute (what Settings picks, and the default the
 * render writes) and as a style value (`layout.gapRow`, `layout.flexDirection`, …) that wins on the
 * page. The style value is the one source of truth. `withStyleLayout` reads it back into the
 * attribute's shape, so Settings shows — and builds on — what the page shows, whichever of the two
 * a person, a pattern or an agent wrote.
 */
type Reader = ( value: string ) => unknown;

const baseOf = ( attributes: any, id: string ): string | undefined => {
	const v = attributes?.blicks?.[ id ]?.default?.base;
	return typeof v === 'string' && v !== '' ? v : undefined;
};

/** `var(--blicks-spacing-md)` → `md`; anything else is not a step the attribute can name. */
export const gapToken = ( value: string ) => /^var\(--blicks-spacing-([a-z0-9]+)\)$/.exec( value )?.[ 1 ];
export const orientationOf = ( value: string ) => ( value.startsWith( 'column' ) ? 'vertical' : value.startsWith( 'row' ) ? 'horizontal' : undefined );
export const wrapOf = ( value: string ) => ( value === 'nowrap' ? false : value.startsWith( 'wrap' ) ? true : undefined );

/** The attributes, with each mapped key replaced by its style value when one is set and readable. */
export function withStyleLayout< T extends Record< string, any > >( attributes: T, readers: Record< string, [ string, Reader ] > ): T {
	const out: Record< string, any > = { ...attributes };
	for ( const [ attr, [ id, read ] ] of Object.entries( readers ) ) {
		const raw = baseOf( attributes, id );
		const value = raw === undefined ? undefined : read( raw );
		if ( value !== undefined ) out[ attr ] = value;
	}
	return out as T;
}
