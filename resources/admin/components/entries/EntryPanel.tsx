import { useEffect, useRef } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { fieldRows, mailtoHref, receivedLabel, type Entry, type EntryStatus, type StatusInfo } from './model';
import { StatusTag, statusName } from './StatusTag';

type Props = {
	entry: Entry;
	/** The list route's statuses; the actions show only for those it names. */
	statuses: readonly StatusInfo[];
	busy: boolean;
	confirmDelete: boolean;
	onStatus: ( status: EntryStatus ) => void;
	onAskDelete: () => void;
	onCancelDelete: () => void;
	onDelete: () => void;
	onClose: () => void;
};

/**
 * The selected entry: who sent it, every field, the long text in a block of its own, what was
 * done with it, and what can be done next. Every value is rendered as text.
 */
export function EntryPanel( { entry, statuses, busy, confirmDelete, onStatus, onAskDelete, onCancelDelete, onDelete, onClose }: Props ): JSX.Element {
	const heading = useRef< HTMLHeadingElement >( null );
	const { short, long } = fieldRows( entry );
	const received = receivedLabel( entry.received );
	// translators: %s: the form's name, as the subject of a reply.
	const reply = mailtoHref( entry.email, entry.formTitle ? sprintf( __( 'Re: %s', 'blicks' ), entry.formTitle ) : '' );

	const has = ( slug: string ) => ! statuses.length || statuses.some( ( s ) => s.slug === slug );
	// translators: %s: a status name, e.g. Handled
	const mark = ( slug: EntryStatus ) => sprintf( __( 'Mark %s', 'blicks' ), statusName( slug, statuses ).toLowerCase() );

	// Focus follows the selection, so a keyboard user lands on what they opened.
	useEffect( () => {
		heading.current?.focus();
	}, [ entry.id ] );

	return (
		<aside className="en-panel card" aria-labelledby="en-panel-title">
			<div className="en-panel-t">
				<h2 id="en-panel-title" ref={ heading } tabIndex={ -1 }>
					{ entry.from || __( '(no name)', 'blicks' ) }
				</h2>
				<StatusTag status={ entry.status } statuses={ statuses } />
				<button type="button" className="icon-btn sm" aria-label={ __( 'Close entry', 'blicks' ) } onClick={ onClose }>
					<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
						<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
					</svg>
				</button>
			</div>

			<dl className="en-dl">
				<dt>{ __( 'Form', 'blicks' ) }</dt>
				<dd>{ entry.formTitle || entry.form }</dd>
				{ entry.page && (
					<>
						<dt>{ __( 'Page', 'blicks' ) }</dt>
						<dd>{ entry.page }</dd>
					</>
				) }
				<dt>{ __( 'Received', 'blicks' ) }</dt>
				<dd>{ received.full }</dd>
				{ short.map( ( row ) => (
					<FieldRow key={ row.name } label={ row.label } value={ row.value } />
				) ) }
			</dl>

			{ long.map( ( row ) => (
				<section key={ row.name } className="en-msg" aria-label={ row.label }>
					<span className="en-msg-l">{ row.label }</span>
					<p>{ row.value }</p>
				</section>
			) ) }

			{ entry.notes.length > 0 && (
				<ul className="en-notes" aria-label={ __( 'Why it was marked spam', 'blicks' ) }>
					{ entry.notes.map( ( note, i ) => <li key={ i }>{ note }</li> ) }
				</ul>
			) }

			{ entry.log.length > 0 && (
				<ul className="en-log" aria-label={ __( 'What was done with it', 'blicks' ) }>
					{ entry.log.map( ( line, i ) => (
						<li key={ i }>
							<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
							{ line }
						</li>
					) ) }
				</ul>
			) }

			{ entry.userAgent && <p className="en-ua" title={ entry.userAgent }>{ entry.userAgent }</p> }

			{ confirmDelete ? (
				<div className="confirm-del" role="alert">
					<span>{ __( 'Delete this entry for good?', 'blicks' ) }</span>
					<button type="button" className="pill sm" onClick={ onCancelDelete }>{ __( 'Keep it', 'blicks' ) }</button>
					<button type="button" className="pill sm pill--danger" disabled={ busy } onClick={ onDelete }>{ __( 'Delete', 'blicks' ) }</button>
				</div>
			) : (
				<div className="en-acts">
					{ reply && <a className="pill sm pill--filled" href={ reply }>{ __( 'Reply by email', 'blicks' ) }</a> }
					{ has( 'handled' ) && has( 'new' ) && entry.status === 'handled' && (
						<button type="button" className="pill sm" disabled={ busy } onClick={ () => onStatus( 'new' ) }>{ mark( 'new' ) }</button>
					) }
					{ has( 'handled' ) && entry.status !== 'handled' && (
						<button type="button" className="pill sm" disabled={ busy } onClick={ () => onStatus( 'handled' ) }>{ mark( 'handled' ) }</button>
					) }
					{ has( 'spam' ) && has( 'new' ) && entry.status === 'spam' && (
						<button type="button" className="pill sm" disabled={ busy } onClick={ () => onStatus( 'new' ) }>
							{ /* translators: %s: the name of the spam status, e.g. Spam */ sprintf( __( 'Not %s', 'blicks' ), statusName( 'spam', statuses ).toLowerCase() ) }
						</button>
					) }
					{ has( 'spam' ) && entry.status !== 'spam' && (
						<button type="button" className="pill sm" disabled={ busy } onClick={ () => onStatus( 'spam' ) }>{ statusName( 'spam', statuses ) }</button>
					) }
					<button type="button" className="pill sm pill--danger" disabled={ busy } onClick={ onAskDelete }>{ __( 'Delete', 'blicks' ) }</button>
				</div>
			) }
		</aside>
	);
}

function FieldRow( { label, value }: { label: string; value: string } ): JSX.Element {
	return (
		<>
			<dt>{ label }</dt>
			<dd>{ value || <span className="en-none">{ __( '(empty)', 'blicks' ) }</span> }</dd>
		</>
	);
}
