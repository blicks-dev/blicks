import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { normalizeAnimations, normalizeLibrary } from '../data';
import type { CustomAnimation, LibraryAnimation } from '../types';

const PATH = '/blicks/v1/design-system/animations';
const STYLE_ID = 'blicks-custom-keyframes';

/**
 * Owns the custom keyframe library. Unlike the token bag there is no draft/save cycle — these are
 * records, so each create/update/delete persists immediately (see docs/plans/custom-animations.md).
 *
 * The server returns the rendered CSS with every mutation; we swap it into a <style> tag so the
 * admin's own previews animate with the new definition without a reload.
 */
export function useAnimations(): {
	animations: CustomAnimation[];
	library: LibraryAnimation[];
	isLoading: boolean;
	isSaving: boolean;
	error: string;
	save: ( animation: CustomAnimation, originalSlug?: string ) => Promise< boolean >;
	remove: ( slug: string ) => Promise< void >;
	clearError: () => void;
} {
	const [ animations, setAnimations ] = useState< CustomAnimation[] >( [] );
	// Predefined ∪ custom — what the block Motion control sees, mirrored here so the section can
	// show the whole set rather than only the editable half.
	const [ library, setLibrary ] = useState< LibraryAnimation[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const adopt = useCallback( ( data: unknown ): void => {
		setAnimations( normalizeAnimations( data ) );
		setLibrary( normalizeLibrary( data ) );

		const css = typeof data === 'object' && data !== null && typeof ( data as { css?: unknown } ).css === 'string'
			? ( data as { css: string } ).css
			: '';

		let tag = document.getElementById( STYLE_ID );
		if ( ! tag ) {
			tag = document.createElement( 'style' );
			tag.id = STYLE_ID;
			document.head.appendChild( tag );
		}
		tag.textContent = css;
	}, [] );

	useEffect( () => {
		let alive = true;

		apiFetch( { path: PATH } )
			.then( ( data: unknown ) => { if ( alive ) adopt( data ); } )
			.catch( () => { if ( alive ) setError( __( 'Could not load the animation library.', 'blicks' ) ); } )
			.finally( () => { if ( alive ) setIsLoading( false ); } );

		return () => { alive = false; };
	}, [ adopt ] );

	const save = useCallback( async ( animation: CustomAnimation, originalSlug = '' ): Promise< boolean > => {
		setIsSaving( true );
		setError( '' );

		try {
			const data = await apiFetch( {
				path: originalSlug ? `${ PATH }/${ encodeURIComponent( originalSlug ) }` : PATH,
				method: originalSlug ? 'PATCH' : 'POST',
				data: animation,
			} );
			adopt( data );
			return true;
		} catch ( failure ) {
			const message = failure instanceof Error
				? failure.message
				: typeof failure === 'object' && failure !== null && typeof ( failure as { message?: unknown } ).message === 'string'
					? ( failure as { message: string } ).message
					: '';
			setError( message || __( 'Could not save that animation.', 'blicks' ) );
			return false;
		} finally {
			setIsSaving( false );
		}
	}, [ adopt ] );

	const remove = useCallback( async ( slug: string ): Promise< void > => {
		setIsSaving( true );
		setError( '' );

		try {
			adopt( await apiFetch( { path: `${ PATH }/${ encodeURIComponent( slug ) }`, method: 'DELETE' } ) );
		} catch {
			setError( __( 'Could not delete that animation.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}, [ adopt ] );

	return { animations, library, isLoading, isSaving, error, save, remove, clearError: () => setError( '' ) };
}
