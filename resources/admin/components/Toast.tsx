import { __ } from '@wordpress/i18n';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from '@wordpress/element';

export type ShowToast = ( message: string, undo?: () => void ) => void;

const ToastContext = createContext< ShowToast >( () => {} );

/** Says what just happened, with an Undo when it can be taken back. */
export function useToast(): ShowToast {
	return useContext( ToastContext );
}

type ToastState = { id: number; message: string; undo?: () => void };

export function ToastProvider( { children }: { children: React.ReactNode } ): JSX.Element {
	const [ toast, setToast ] = useState< ToastState | null >( null );
	const timer = useRef< number >();

	const show = useCallback< ShowToast >( ( message, undo ) => {
		setToast( current => ( { id: ( current?.id ?? 0 ) + 1, message, undo } ) );
	}, [] );

	useEffect( () => {
		if ( ! toast ) return;
		window.clearTimeout( timer.current );
		timer.current = window.setTimeout( () => setToast( null ), toast.undo ? 8000 : 5000 );
		return () => window.clearTimeout( timer.current );
	}, [ toast ] );

	return (
		<ToastContext.Provider value={ show }>
			{ children }
			<div className="toast-slot" role="status" aria-live="polite">
				{ toast && (
					<div className="toast" key={ toast.id }>
						<span>{ toast.message }</span>
						{ toast.undo && (
							<button
								type="button"
								className="link-btn"
								onClick={ () => {
									const undo = toast.undo;
									setToast( null );
									undo?.();
								} }
							>
								{ __( 'Undo', 'blicks' ) }
							</button>
						) }
					</div>
				) }
			</div>
		</ToastContext.Provider>
	);
}
