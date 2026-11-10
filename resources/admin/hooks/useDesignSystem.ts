import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { COLOR_FALLBACKS, TYPE_ROLE_DEFAULTS } from '../constants';
import { FALLBACK_SNAPSHOT } from '../fallbacks';
import { cloneTokens, defaultBreakpointMax, hasBreakpointChanges, hasTokenChanges, normalizeKits, normalizeSnapshot, normalizeThemes } from '../data';
import type { Breakpoint, DesignKit, DesignSystemSnapshot, DesignTheme, ThemesState, TypeRoleValues } from '../types';

export type DesignDraft = {
	tokens: Record< string, Record< string, string > >;
	breakpoints: Record< string, number >;
	typeRoles: TypeRoleValues;
};

// Owns the Design System tab: the live snapshot, the per-category override drafts, the saved
// themes, and every edit/save/apply/reset flow.
export function useDesignSystem() {
	const [ snapshot, setSnapshot ] = useState< DesignSystemSnapshot >( FALLBACK_SNAPSHOT );
	const [ apiStatus, setApiStatus ] = useState< 'loading' | 'ready' | 'fallback' >( 'loading' );
	const [ tokenDraft, setTokenDraft ] = useState< Record< string, Record< string, string > > >( {} );
	const [ themes, setThemes ] = useState< ThemesState >( { active: 'indigo', themes: [] } );
	const [ kits, setKits ] = useState< DesignKit[] >( [] );
	const [ breakpointDraft, setBreakpointDraft ] = useState< Record< string, number > >( {} );
	const [ typeRoleDraft, setTypeRoleDraft ] = useState< TypeRoleValues >( {} );
	const [ isSaving, setIsSaving ] = useState( false );
	// A notice is an event, not a value: the same message twice must still be announced, so each
	// one carries a sequence number the app keys its toast on.
	const [ notice, setNoticeState ] = useState( { text: '', seq: 0 } );
	const setNotice = ( text: string ): void => {
		if ( text ) setNoticeState( current => ( { text, seq: current.seq + 1 } ) );
	};

	const colorTokens = snapshot.tokens.color;
	const tokensDirty = hasTokenChanges( tokenDraft, snapshot.overrides.tokens );
	const breakpointDirty = hasBreakpointChanges( breakpointDraft, snapshot.overrides.breakpoints );
	const typeRolesDirty = hasTokenChanges( typeRoleDraft, snapshot.overrides.typeRoles );
	const isDirty = tokensDirty || breakpointDirty || typeRolesDirty;

	useEffect( () => {
		let alive = true;

		apiFetch( { path: '/blicks/v1/design-system' } )
			.then( ( data: unknown ) => {
				if ( ! alive ) return;
				const next = normalizeSnapshot( data );
				setSnapshot( next );
				setTokenDraft( cloneTokens( next.overrides.tokens ) );
				setBreakpointDraft( { ...next.overrides.breakpoints } );
				setTypeRoleDraft( cloneTokens( next.overrides.typeRoles ) );
				setApiStatus( 'ready' );
			} )
			.catch( () => {
				if ( ! alive ) return;
				setApiStatus( 'fallback' );
			} );

		return () => {
			alive = false;
		};
	}, [] );

	useEffect( () => {
		let alive = true;
		apiFetch( { path: '/blicks/v1/design-system/kits' } )
			.then( ( data: unknown ) => { if ( alive ) setKits( normalizeKits( data ) ); } )
			.catch( () => {} );
		return () => {
			alive = false;
		};
	}, [] );

	useEffect( () => {
		let alive = true;

		apiFetch( { path: '/blicks/v1/design-system/themes' } )
			.then( ( data: unknown ) => {
				if ( ! alive ) return;
				setThemes( normalizeThemes( data ) );
			} )
			.catch( () => {
				if ( alive ) setNotice( __( 'Could not load saved palettes.', 'blicks' ) );
			} );

		return () => {
			alive = false;
		};
	}, [] );

	function updateTokenDraft( category: string, token: string, value: string ): void {
		setTokenDraft( current => {
			const cat = { ...( current[ category ] ?? {} ) };
			const base = ( snapshot.baseValues as Record< string, Record< string, string > > )[ category ]?.[ token ] ?? ( category === 'color' ? COLOR_FALLBACKS[ token ] ?? '' : '' );
			const normalized = value.trim();

			if ( normalized === '' || normalized === base ) {
				delete cat[ token ];
			} else {
				cat[ token ] = value;
			}

			const next = { ...current };
			if ( Object.keys( cat ).length > 0 ) {
				next[ category ] = cat;
			} else {
				delete next[ category ];
			}

			return next;
		} );
		setNotice( '' );
	}

	function resetTokenDraft( category: string, token?: string ): void {
		setTokenDraft( current => {
			const next = { ...current };
			if ( token ) {
				const cat = { ...( next[ category ] ?? {} ) };
				delete cat[ token ];
				if ( Object.keys( cat ).length > 0 ) {
					next[ category ] = cat;
				} else {
					delete next[ category ];
				}
			} else {
				delete next[ category ];
			}

			return next;
		} );
	}

	function updateBreakpointDraft( breakpoint: Breakpoint, value: string ): void {
		if ( breakpoint.max === null ) return;

		setBreakpointDraft( current => {
			const next = { ...current };
			const parsed = Number.parseInt( value, 10 );
			const base = defaultBreakpointMax( breakpoint.id );

			if ( value.trim() === '' || Number.isNaN( parsed ) || parsed === base ) {
				delete next[ breakpoint.id ];
			} else if ( parsed >= 320 && parsed <= 2400 ) {
				next[ breakpoint.id ] = parsed;
			}

			return next;
		} );
		setNotice( '' );
	}

	function resetBreakpointDraft( breakpointId?: string ): void {
		setBreakpointDraft( current => {
			if ( breakpointId ) {
				const next = { ...current };
				delete next[ breakpointId ];
				return next;
			}

			return {};
		} );
	}

	function updateTypeRoleDraft( role: string, prop: string, value: string ): void {
		setTypeRoleDraft( current => {
			const roleDraft = { ...( current[ role ] ?? {} ) };
			const base = snapshot.typeRoles.base[ role ]?.[ prop ] ?? TYPE_ROLE_DEFAULTS[ role ]?.[ prop ] ?? '';
			const normalized = value.trim();

			if ( normalized === '' || normalized === base ) {
				delete roleDraft[ prop ];
			} else {
				roleDraft[ prop ] = value;
			}

			const next = { ...current };
			if ( Object.keys( roleDraft ).length > 0 ) {
				next[ role ] = roleDraft;
			} else {
				delete next[ role ];
			}

			return next;
		} );
		setNotice( '' );
	}

	function resetTypeRoleDraft( role: string, prop?: string ): void {
		setTypeRoleDraft( current => {
			const next = { ...current };
			if ( prop ) {
				const roleDraft = { ...( next[ role ] ?? {} ) };
				delete roleDraft[ prop ];
				if ( Object.keys( roleDraft ).length > 0 ) {
					next[ role ] = roleDraft;
				} else {
					delete next[ role ];
				}
			} else {
				delete next[ role ];
			}

			return next;
		} );
	}

	/** Everything the draft holds right now, so a discard can be undone. */
	function captureDraft(): DesignDraft {
		return { tokens: cloneTokens( tokenDraft ), breakpoints: { ...breakpointDraft }, typeRoles: cloneTokens( typeRoleDraft ) };
	}

	function restoreDraft( draft: DesignDraft ): void {
		setTokenDraft( cloneTokens( draft.tokens ) );
		setBreakpointDraft( { ...draft.breakpoints } );
		setTypeRoleDraft( cloneTokens( draft.typeRoles ) );
	}

	/**
	 * Back to what is saved. The draft is seeded from the saved overrides, so emptying it — what
	 * the old Discard did — also threw away every value saved before, and the next save wrote
	 * that loss to the database.
	 */
	function discardDraft(): void {
		restoreDraft( { tokens: snapshot.overrides.tokens, breakpoints: snapshot.overrides.breakpoints, typeRoles: snapshot.overrides.typeRoles } );
	}

	async function saveOverrides(): Promise< void > {
		if ( ! isDirty || isSaving ) return;

		setIsSaving( true );
		setNotice( '' );

		const tokens: Record< string, Record< string, string > > = {};
		for ( const [ category, values ] of Object.entries( tokenDraft ) ) {
			if ( values && Object.keys( values ).length > 0 ) {
				tokens[ category ] = values;
			}
		}

		const typeRoles: TypeRoleValues = {};
		for ( const [ role, props ] of Object.entries( typeRoleDraft ) ) {
			if ( props && Object.keys( props ).length > 0 ) {
				typeRoles[ role ] = props;
			}
		}

		// User-added slugs (not in the catalogue) must be registered so their values survive save.
		const customSlugs: Record< string, string[] > = {};
		for ( const [ category, values ] of Object.entries( tokens ) ) {
			const known = new Set< string >( ( snapshot.tokens as Record< string, readonly string[] > )[ category ] ?? [] );
			const extra = Object.keys( values ).filter( slug => ! known.has( slug ) );
			if ( extra.length > 0 ) {
				customSlugs[ category ] = extra;
			}
		}

		try {
			const data = await apiFetch( {
				path: '/blicks/v1/design-system',
				method: 'PATCH',
				data: {
					tokens,
					breakpoints: breakpointDraft,
					typeRoles,
					customSlugs,
				},
			} );
			const next = normalizeSnapshot( data );
			setSnapshot( next );
			setTokenDraft( cloneTokens( next.overrides.tokens ) );
			setBreakpointDraft( { ...next.overrides.breakpoints } );
			setTypeRoleDraft( cloneTokens( next.overrides.typeRoles ) );
			setApiStatus( 'ready' );
			const rejected = rejectedPaths( data );
			if ( rejected.length > 0 ) {
				setNotice( sprintf(
					/* translators: %s: comma-separated list of setting paths, e.g. "tokens.color.primary". */
					__( 'Saved, except values that are not valid CSS and were not kept: %s', 'blicks' ),
					rejected.join( ', ' )
				) );
			} else {
				setNotice( snapshot.source.globalStyles ? __( 'Saved. Synced tokens now read from theme.json.', 'blicks' ) : __( 'Saved.', 'blicks' ) );
			}
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not save design-system overrides.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	function adoptSnapshot( data: unknown ): void {
		const next = normalizeSnapshot( data );
		setSnapshot( next );
		setTokenDraft( cloneTokens( next.overrides.tokens ) );
		setBreakpointDraft( { ...next.overrides.breakpoints } );
		setTypeRoleDraft( cloneTokens( next.overrides.typeRoles ) );
		setApiStatus( 'ready' );
	}

	/**
	 * Choose a design language. It is a layer under the saved values, so the server's values and
	 * overrides come back unchanged apart from the base: unsaved edits are kept as they are.
	 */
	async function chooseLanguage( id: string ): Promise< boolean > {
		if ( isSaving || id === snapshot.language.active ) return false;
		setIsSaving( true );
		setNotice( '' );
		try {
			const data = await apiFetch( { path: '/blicks/v1/design-system/language', method: 'POST', data: { id } } );
			setSnapshot( normalizeSnapshot( data ) );
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not change the design language.', 'blicks' ) );
			return false;
		} finally {
			setIsSaving( false );
		}
	}

	/** Save the language, palette and values in use now as a kit. */
	async function saveKit( name: string ): Promise< boolean > {
		try {
			setKits( normalizeKits( await apiFetch( { path: '/blicks/v1/design-system/kits', method: 'POST', data: { name } } ) ) );
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not save the kit.', 'blicks' ) );
			return false;
		}
	}

	async function renameKit( id: string, name: string ): Promise< boolean > {
		try {
			setKits( normalizeKits( await apiFetch( { path: `/blicks/v1/design-system/kits/${ id }`, method: 'PATCH', data: { name } } ) ) );
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not rename the kit.', 'blicks' ) );
			return false;
		}
	}

	async function deleteKit( id: string ): Promise< boolean > {
		try {
			setKits( normalizeKits( await apiFetch( { path: `/blicks/v1/design-system/kits/${ id }`, method: 'DELETE' } ) ) );
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not delete the kit.', 'blicks' ) );
			return false;
		}
	}

	/** Use a kit: its language, palette and values replace the ones in use (unsaved edits too). */
	async function useKit( id: string ): Promise< boolean > {
		if ( isSaving ) return false;
		setIsSaving( true );
		setNotice( '' );
		try {
			const data = await apiFetch( { path: `/blicks/v1/design-system/kits/${ id }/apply`, method: 'POST' } );
			adoptSnapshot( data );
			if ( data && typeof data === 'object' && 'themes' in data ) {
				setThemes( normalizeThemes( ( data as { themes: unknown } ).themes ) );
			}
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not use the kit.', 'blicks' ) );
			return false;
		} finally {
			setIsSaving( false );
		}
	}

	async function applyTheme( id: string ): Promise< void > {
		if ( isSaving ) return;
		setIsSaving( true );
		setNotice( '' );
		try {
			const data = await apiFetch( { path: `/blicks/v1/design-system/themes/${ id }/apply`, method: 'POST' } );
			adoptSnapshot( data );
			if ( data && typeof data === 'object' && 'themes' in data ) {
				setThemes( normalizeThemes( ( data as { themes: unknown } ).themes ) );
			}
			setNotice( __( 'Palette in use.', 'blicks' ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not use the palette.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	async function createThemeFromCurrent( name: string ): Promise< boolean > {
		if ( name.trim() === '' ) return false;
		try {
			const data = await apiFetch( {
				path: '/blicks/v1/design-system/themes',
				method: 'POST',
				data: {
					name,
					tokens: snapshot.overrides.tokens,
					breakpoints: snapshot.overrides.breakpoints,
					typeRoles: snapshot.overrides.typeRoles,
				},
			} );
			setThemes( normalizeThemes( data ) );
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not save the palette.', 'blicks' ) );
			return false;
		}
	}

	/** Puts a deleted theme back, as a new record with the same name and values. */
	async function restoreTheme( theme: DesignTheme ): Promise< void > {
		try {
			const data = await apiFetch( {
				path: '/blicks/v1/design-system/themes',
				method: 'POST',
				data: { name: theme.name, ...theme.tokens },
			} );
			setThemes( normalizeThemes( data ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not restore the palette.', 'blicks' ) );
		}
	}

	async function deleteTheme( id: string ): Promise< boolean > {
		try {
			const data = await apiFetch( { path: `/blicks/v1/design-system/themes/${ id }`, method: 'DELETE' } );
			setThemes( normalizeThemes( data ) );
			return true;
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not delete the palette.', 'blicks' ) );
			return false;
		}
	}

	async function resetTheme( id: string ): Promise< void > {
		if ( isSaving ) return;
		setIsSaving( true );
		setNotice( '' );
		try {
			const data = await apiFetch( { path: `/blicks/v1/design-system/themes/${ id }/reset`, method: 'POST' } );
			adoptSnapshot( data );
			if ( data && typeof data === 'object' && 'themes' in data ) {
				setThemes( normalizeThemes( ( data as { themes: unknown } ).themes ) );
			}
			setNotice( __( 'Palette reset to how Blicks ships it.', 'blicks' ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not reset the theme.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	async function resetGroup( category: string ): Promise< void > {
		if ( isSaving ) return;
		setIsSaving( true );
		setNotice( '' );
		try {
			const data = await apiFetch( { path: '/blicks/v1/design-system', method: 'PATCH', data: { reset: [ category ] } } );
			adoptSnapshot( data );
			setNotice( __( 'Group reset to the palette’s values.', 'blicks' ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not reset the group.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	return {
		snapshot,
		apiStatus,
		tokenDraft,
		breakpointDraft,
		typeRoleDraft,
		colorTokens,
		themes,
		isSaving,
		isDirty,
		notice,
		updateTokenDraft,
		resetTokenDraft,
		updateBreakpointDraft,
		resetBreakpointDraft,
		updateTypeRoleDraft,
		resetTypeRoleDraft,
		captureDraft,
		restoreDraft,
		discardDraft,
		saveOverrides,
		chooseLanguage,
		kits,
		saveKit,
		renameKit,
		deleteKit,
		useKit,
		applyTheme,
		createThemeFromCurrent,
		restoreTheme,
		deleteTheme,
		resetTheme,
		resetGroup,
	};
}

/** Paths the save endpoint refused (see Overrides::rejectedPaths() in PHP). */
function rejectedPaths( data: unknown ): string[] {
	const list = ( data as { rejected?: unknown } | null )?.rejected;
	return Array.isArray( list ) ? list.filter( ( item ): item is string => typeof item === 'string' ) : [];
}
