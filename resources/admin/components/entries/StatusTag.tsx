import { __ } from '@wordpress/i18n';
import { statusLabel, type CoreStatus, type EntryStatus, type StatusInfo } from './model';

/** Free's own names for its statuses, used when the list route sends none. */
export function coreStatusName( status: CoreStatus ): string {
	if ( status === 'handled' ) return __( 'Handled', 'blicks' );
	if ( status === 'spam' ) return __( 'Spam', 'blicks' );
	return __( 'New', 'blicks' );
}

/** A status's name: the list route's label, else free's own, else the slug. */
export function statusName( status: EntryStatus, statuses: readonly StatusInfo[] = [] ): string {
	return statusLabel( status, statuses, coreStatusName );
}

/** An entry's status as a small tag; "New" carries a dot. */
export function StatusTag( { status, statuses = [] }: { status: EntryStatus; statuses?: readonly StatusInfo[] } ): JSX.Element {
	return (
		<span className={ `en-st is-${ status }` }>
			{ status === 'new' && <i aria-hidden="true" /> }
			{ statusName( status, statuses ) }
		</span>
	);
}
