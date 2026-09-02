import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { COLOR_FALLBACKS, TYPE_ROLE_DEFAULTS, TYPE_ROLE_LABELS } from '../constants';
import { FALLBACK_SNAPSHOT } from '../fallbacks';
import { cloneTokens, defaultBreakpointMax, hasBreakpointChanges, hasTokenChanges, normalizeSnapshot, normalizeThemes, titleCase } from '../data';
import type { Breakpoint, DesignSystemSnapshot, ThemesState, TypeRoleValues } from '../types';

// Owns the Design System tab: the live snapshot, the per-category override drafts, the saved
// themes, and every edit/save/apply/reset flow.
export function useDesignSystem() {
	const [ snapshot, setSnapshot ] = useState< DesignSystemSnapshot >( FALLBACK_SNAPSHOT );
	const [ apiStatus, setApiStatus ] = useState< 'loading' | 'ready' | 'fallback' >( 'loading' );
	const [ tokenDraft, setTokenDraft ] = useState< Record< string, Record< string, string > > >( {} );
	const [ themes, setThemes ] = useState< ThemesState >( { active: 'indigo', themes: [] } );
	const [ breakpointDraft, setBreakpointDraft ] = useState< Record< string, number > >( {} );
	const [ typeRoleDraft, setTypeRoleDraft ] = useState< TypeRoleValues >( {} );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ notice, setNotice ] = useState( '' );

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

		apiFetch( { path: '/blicks/v1/design-system/themes' } )
			.then( ( data: unknown ) => {
				if ( ! alive ) return;
				setThemes( normalizeThemes( data ) );
			} )
			.catch( () => {
				if ( alive ) setNotice( __( 'Could not load saved themes.', 'blicks' ) );
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
		setNotice( token ? sprintf( __( '%s will return to the active theme value.', 'blicks' ), titleCase( token ) ) : __( 'Overrides cleared in draft.', 'blicks' ) );
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
		setNotice( breakpointId ? sprintf( __( '%s breakpoint will return to the default value.', 'blicks' ), titleCase( breakpointId ) ) : __( 'Breakpoint overrides cleared in draft.', 'blicks' ) );
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
		setNotice( sprintf( __( '%s will return to the active theme value.', 'blicks' ), TYPE_ROLE_LABELS[ role ] ?? role ) );
	}

	function resetDraft(): void {
		setTokenDraft( {} );
		setBreakpointDraft( {} );
		setTypeRoleDraft( {} );
		setNotice( __( 'Overrides cleared in draft.', 'blicks' ) );
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
			const activeName = themes.themes.find( t => t.id === themes.active )?.name;
			setNotice( activeName ? sprintf( __( 'Saved to %s.', 'blicks' ), activeName ) : ( snapshot.source.globalStyles ? __( 'Saved to Global Styles. Synced tokens now read from theme.json.', 'blicks' ) : __( 'Saved design-system overrides.', 'blicks' ) ) );
			// Editing the active theme can flip its "edited" flag (e.g. a built-in now diverges from its
			// preset); refresh the list so the reset affordance + marker stay accurate.
			apiFetch( { path: '/blicks/v1/design-system/themes' } ).then( ( d: unknown ) => setThemes( normalizeThemes( d ) ) ).catch( () => {} );
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
			setNotice( __( 'Theme applied to the token set.', 'blicks' ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not apply the theme.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	async function createThemeFromCurrent( name: string ): Promise< void > {
		if ( name.trim() === '' ) return;
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
			setNotice( __( 'Theme saved from the current token values.', 'blicks' ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not save the theme.', 'blicks' ) );
		}
	}

	async function deleteTheme( id: string ): Promise< void > {
		try {
			const data = await apiFetch( { path: `/blicks/v1/design-system/themes/${ id }`, method: 'DELETE' } );
			setThemes( normalizeThemes( data ) );
		} catch ( error ) {
			setNotice( error instanceof Error ? error.message : __( 'Could not delete the theme.', 'blicks' ) );
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
			setNotice( __( 'Theme reset to its preset values.', 'blicks' ) );
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
			setNotice( __( 'Group reset to the active theme values.', 'blicks' ) );
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
		resetDraft,
		saveOverrides,
		applyTheme,
		createThemeFromCurrent,
		deleteTheme,
		resetTheme,
		resetGroup,
	};
}
