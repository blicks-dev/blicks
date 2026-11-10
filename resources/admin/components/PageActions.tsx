import { __, _n, sprintf } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { useToast } from './Toast';
import type { DesignChange } from '../design-model';
import type { useDesignSystem } from '../hooks/useDesignSystem';

type DesignSystemApi = ReturnType< typeof useDesignSystem >;

/** Put one change back to what is saved. */
export function revertChange( ds: DesignSystemApi, change: DesignChange ): void {
	if ( change.kind === 'token' ) {
		if ( change.saved === undefined ) ds.resetTokenDraft( change.category, change.slug );
		else ds.updateTokenDraft( change.category, change.slug, change.saved );
	} else if ( change.kind === 'role' && change.prop ) {
		if ( change.saved === undefined ) ds.resetTypeRoleDraft( change.slug, change.prop );
		else ds.updateTypeRoleDraft( change.slug, change.prop, change.saved );
	} else if ( change.kind === 'breakpoint' ) {
		const breakpoint = ds.snapshot.breakpoints.find( bp => bp.id === change.slug );
		if ( change.saved === undefined ) ds.resetBreakpointDraft( change.slug );
		else if ( breakpoint ) ds.updateBreakpointDraft( breakpoint, change.saved );
	}
}

/**
 * The Design System's save controls, in the page bar: how many changes are waiting (which opens
 * the list of them), Discard and Save. ⌘S / Ctrl-S saves too.
 */
export function DesignActions( { ds, changes }: { ds: DesignSystemApi; changes: DesignChange[] } ): JSX.Element {
	const toast = useToast();
	const [ open, setOpen ] = useState( false );
	const buttonRef = useRef< HTMLButtonElement >( null );
	const popRef = useRef< HTMLDivElement >( null );
	const count = changes.length;
	const { isSaving, saveOverrides } = ds;

	useEffect( () => {
		const onKey = ( event: KeyboardEvent ): void => {
			if ( ( event.metaKey || event.ctrlKey ) && event.key.toLowerCase() === 's' ) {
				event.preventDefault();
				if ( count > 0 && ! isSaving ) void saveOverrides();
			}
		};
		window.addEventListener( 'keydown', onKey );
		return () => window.removeEventListener( 'keydown', onKey );
	}, [ count, isSaving, saveOverrides ] );

	useEffect( () => {
		if ( count === 0 ) setOpen( false );
	}, [ count ] );

	useEffect( () => {
		if ( ! open ) return;
		const onDown = ( event: MouseEvent ): void => {
			const target = event.target as Node;
			if ( ! popRef.current?.contains( target ) && ! buttonRef.current?.contains( target ) ) setOpen( false );
		};
		const onKey = ( event: KeyboardEvent ): void => {
			if ( event.key === 'Escape' ) {
				setOpen( false );
				buttonRef.current?.focus();
			}
		};
		document.addEventListener( 'mousedown', onDown );
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'mousedown', onDown );
			document.removeEventListener( 'keydown', onKey );
		};
	}, [ open ] );

	return (
		<>
			{ count > 0 && (
				<button
					ref={ buttonRef }
					type="button"
					className="pill pill--tonal"
					aria-haspopup="dialog"
					aria-expanded={ open }
					onClick={ () => setOpen( current => ! current ) }
				>
					<i className="pdot" aria-hidden="true" />
					{ sprintf(
						/* translators: %d: number of unsaved changes. */
						_n( '%d unsaved', '%d unsaved', count, 'blicks' ),
						count
					) }
				</button>
			) }
			<button
				type="button"
				className="pill"
				disabled={ count === 0 || isSaving }
				onClick={ () => {
					const before = ds.captureDraft();
					ds.discardDraft();
					toast(
						sprintf(
							/* translators: %d: number of changes thrown away. */
							_n( '%d change discarded', '%d changes discarded', count, 'blicks' ),
							count
						),
						() => ds.restoreDraft( before )
					);
				} }
			>
				{ __( 'Discard', 'blicks' ) }
			</button>
			<button type="button" className="pill pill--filled" disabled={ count === 0 || isSaving } onClick={ () => void saveOverrides() }>
				{ isSaving ? __( 'Saving…', 'blicks' ) : __( 'Save', 'blicks' ) }
			</button>

			{ open && count > 0 && (
				<div className="changes-pop" role="dialog" aria-label={ __( 'Unsaved changes', 'blicks' ) } ref={ popRef }>
					<h3>{ __( 'Unsaved changes', 'blicks' ) }</h3>
					{ changes.map( change => (
						<div className="ch" key={ change.key }>
							<div style={ { minWidth: 0 } }>
								<b>{ change.label }</b>
								<span title={ `${ change.from } → ${ change.to }` }><s>{ change.from }</s> → { change.to }</span>
							</div>
							<button type="button" className="pill sm" onClick={ () => revertChange( ds, change ) }>
								{ __( 'Undo', 'blicks' ) }
							</button>
						</div>
					) ) }
				</div>
			) }
		</>
	);
}

export function SettingsActions( {
	count,
	isSaving,
	onDiscard,
	onSave,
}: {
	count: number;
	isSaving: boolean;
	onDiscard: () => void;
	onSave: () => void;
} ): JSX.Element {
	return (
		<>
			{ count > 0 && (
				<span className="unsaved-n">
					{ sprintf(
						/* translators: %d: number of unsaved settings. */
						_n( '%d unsaved', '%d unsaved', count, 'blicks' ),
						count
					) }
				</span>
			) }
			<button type="button" className="pill" disabled={ count === 0 || isSaving } onClick={ onDiscard }>
				{ __( 'Discard', 'blicks' ) }
			</button>
			<button type="button" className="pill pill--filled" disabled={ count === 0 || isSaving } onClick={ onSave }>
				{ isSaving ? __( 'Saving…', 'blicks' ) : __( 'Save settings', 'blicks' ) }
			</button>
		</>
	);
}
