/**
 * What every Studio sheet owes the keyboard, in one place.
 *
 * **A sheet owns Escape while it is up.** The Studio's escape ladder stands down whenever a sheet
 * is open, on the promise that the sheet closes itself; the Insert picker is drawn by the launcher,
 * outside the Studio, so the ladder does not even know it is there. Listening in the capture phase
 * and stopping the key there settles it before anything under the sheet sees it — whichever of the
 * two is underneath.
 *
 * Escape and a press on the scrim both mean "dismiss", which every caller defines as the safe way
 * out: none of them may lose work. Focus starts inside the sheet, Tab stays inside it, and focus
 * goes back to wherever it was when the sheet closes.
 */

import { useEffect, useRef } from '@wordpress/element';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface Sheet< T extends HTMLElement > {
	/** On the sheet itself, the element focus is kept inside. */
	sheet: React.RefObject< HTMLDivElement >;
	/** On whatever should hold focus first; without it, the sheet's first control does. */
	first: React.RefObject< T >;
	/** Spread onto the scrim. Only a press on the scrim itself dismisses, not one in the sheet. */
	scrim: { role: 'presentation'; onMouseDown: ( event: React.MouseEvent ) => void };
}

export function useSheet< T extends HTMLElement = HTMLElement >( onDismiss: () => void ): Sheet< T > {
	const sheet = useRef< HTMLDivElement >( null );
	const first = useRef< T >( null );
	const dismiss = useRef( onDismiss );
	dismiss.current = onDismiss;

	useEffect( () => {
		const doc = sheet.current?.ownerDocument ?? document;
		const before = doc.activeElement as HTMLElement | null;

		( first.current ?? sheet.current?.querySelector< HTMLElement >( FOCUSABLE ) )?.focus();

		const onKeyDown = ( event: KeyboardEvent ): void => {
			if ( 'Escape' === event.key ) {
				event.preventDefault();
				event.stopPropagation();
				dismiss.current();
				return;
			}

			if ( 'Tab' !== event.key || ! sheet.current ) {
				return;
			}

			const items = [ ...sheet.current.querySelectorAll< HTMLElement >( FOCUSABLE ) ];
			const head = items[ 0 ];
			const tail = items[ items.length - 1 ];
			const active = doc.activeElement;
			const outside = ! sheet.current.contains( active );

			if ( event.shiftKey && ( active === head || outside ) ) {
				event.preventDefault();
				tail?.focus();
			} else if ( ! event.shiftKey && ( active === tail || outside ) ) {
				event.preventDefault();
				head?.focus();
			}
		};

		doc.addEventListener( 'keydown', onKeyDown, true );

		return () => {
			doc.removeEventListener( 'keydown', onKeyDown, true );
			before?.focus?.();
		};
	}, [] );

	return {
		sheet,
		first,
		scrim: {
			role: 'presentation',
			onMouseDown: ( event ) => event.target === event.currentTarget && dismiss.current(),
		},
	};
}
