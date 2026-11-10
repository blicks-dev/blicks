/**
 * The design languages, as the Studio sees them: the site's own, and the one being viewed.
 *
 * One view for the whole session, shared by the library and the canvas. Picking Glassmorphism to
 * browse patterns and then opening one should not drop you back into the site's language — the
 * pattern you chose because of how it looked in glass would arrive looking like something else.
 *
 * The server sends every language's custom properties computed against THIS site's palette
 * (`StudioServiceProvider::settings()`), so a view is the site in another language, not a stock
 * sample. Each `css` is one `:root { … }` block; `scopeCss` re-roots it on whatever should wear it.
 */

import { useEffect, useState } from '@wordpress/element';

export interface LanguageView {
	id: string;
	name: string;
	description: string;
	css: string;
}

const SETTINGS = ( window as unknown as {
	blicksStudioSettings?: { site?: string; languages?: LanguageView[] };
} ).blicksStudioSettings;

export const LANGUAGES: LanguageView[] = SETTINGS?.languages ?? [];

export function languageById( id: string ): LanguageView | undefined {
	return LANGUAGES.find( ( l ) => l.id === id );
}

export const nameOf = ( id: string ): string => languageById( id )?.name ?? id;

/** A language's variables, declared on `selector` instead of the document root. */
export function scopeCss( css: string, selector: string ): string {
	return css.replace( /:root\b/g, selector );
}

/** One custom property's value as the language declares it, or ''. */
export function varOf( css: string, name: string ): string {
	const match = new RegExp( `--${ name }:\\s*([^;]+);` ).exec( css );

	return match ? match[ 1 ]!.trim() : '';
}

/** The two things that most tell languages apart in a sentence: corners and headings. */
export function factsOf( css: string ): { corners: string; headings: string } {
	const corners = [ varOf( css, 'blicks-radius-md' ), varOf( css, 'blicks-radius-lg' ) ].filter( Boolean ).join( ' / ' );
	const headings = [ varOf( css, 'blicks-type-h1-font-weight' ), varOf( css, 'blicks-type-h1-letter-spacing' ) ].filter( Boolean ).join( ', ' );

	return { corners, headings };
}

let site = SETTINGS?.site ?? LANGUAGES[ 0 ]?.id ?? '';
let lens = site;
const listeners = new Set< () => void >();

const emit = (): void => listeners.forEach( ( listener ) => listener() );

export function setLens( id: string ): void {
	lens = id;
	emit();
}

/** After the site adopted a language: it is now both the site's and the one being viewed. */
export function setSite( id: string ): void {
	site = id;
	lens = id;
	emit();
}

/** The site's language and the one being viewed, re-rendering when either changes. */
export function useLanguages(): { site: string; lens: string } {
	const [ , bump ] = useState( 0 );

	useEffect( () => {
		const listener = (): void => bump( ( n ) => n + 1 );
		listeners.add( listener );

		return () => {
			listeners.delete( listener );
		};
	}, [] );

	return { site, lens };
}
