import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	ENTRIES_PATH,
	csvHref,
	defaultStatuses,
	listPath,
	normalizeEntry,
	normalizeList,
	receivedLabel,
	shiftCounts,
	withStatus,
	type Entry,
	type EntryList,
	type EntryStatus,
	type Query,
	type StatusInfo,
} from './entries/model';
import { EntryPanel } from './entries/EntryPanel';
import { StatusTag, coreStatusName, statusName } from './entries/StatusTag';
import { useToast } from './Toast';
import { parseHash } from '../routing';

const FIRST: Query = { form: '', status: '', search: '', page: 1 };

/** The status tabs: the list route's `statuses` (a plugin may add some), else free's three. */
const statusesOf = ( list: EntryList | null ): StatusInfo[] => ( list?.statuses.length ? list.statuses : defaultStatuses( coreStatusName ) );

/**
 * Blicks › Entries: every sent form, newest first. Pick one to read it in the side panel; tick
 * several to mark them handled or spam, or delete them, together. Status changes show at once
 * and are undone if the server refuses them.
 */
export function EntriesView(): JSX.Element {
	const toast = useToast();
	const [ query, setQuery ] = useState< Query >( FIRST );
	const [ searchText, setSearchText ] = useState( '' );
	const [ list, setList ] = useState< EntryList | null >( null );
	const [ loading, setLoading ] = useState( true );
	const [ selected, setSelected ] = useState< Entry | null >( null );
	const [ checked, setChecked ] = useState< number[] >( [] );
	const [ confirm, setConfirm ] = useState< 'one' | 'bulk' | null >( null );
	const [ busy, setBusy ] = useState( false );
	const latest = useRef( 0 );

	const load = useCallback( async ( next: Query, quiet = false ): Promise< void > => {
		const call = ++latest.current;
		if ( ! quiet ) setLoading( true );
		try {
			const data = normalizeList( await apiFetch( { path: listPath( next ) } ) );
			if ( call === latest.current ) setList( data );
		} catch {
			if ( call === latest.current ) toast( __( 'Could not load the entries.', 'blicks' ) );
		} finally {
			if ( call === latest.current ) setLoading( false );
		}
	}, [ toast ] );

	useEffect( () => {
		void load( query );
		setChecked( [] );
		setConfirm( null );
	}, [ load, query ] );

	// Search as you type, once typing pauses.
	useEffect( () => {
		const timer = window.setTimeout( () => {
			setQuery( ( was ) => ( was.search === searchText ? was : { ...was, search: searchText, page: 1 } ) );
		}, 300 );
		return () => window.clearTimeout( timer );
	}, [ searchText ] );

	// Escape closes the panel.
	useEffect( () => {
		if ( ! selected ) return;
		const onKey = ( event: KeyboardEvent ): void => {
			if ( event.key === 'Escape' ) setSelected( null );
		};
		document.addEventListener( 'keydown', onKey );
		return () => document.removeEventListener( 'keydown', onKey );
	}, [ selected ] );

	const open = ( entry: Entry ): void => {
		setSelected( entry );
		setConfirm( null );
		// The single read adds the user agent; the list's copy is shown meanwhile.
		( apiFetch( { path: `${ ENTRIES_PATH }/${ entry.id }` } ) as Promise< unknown > )
			.then( ( data ) => {
				const full = normalizeEntry( data );
				if ( full ) setSelected( ( was ) => ( was?.id === full.id ? full : was ) );
			} )
			.catch( () => {} );
	};

	// A link to one entry (`#entries/<id>`, as the notification email writes it) opens it.
	useEffect( () => {
		const id = Number( parseHash().section );
		if ( ! Number.isInteger( id ) || id <= 0 ) return;
		( apiFetch( { path: `${ ENTRIES_PATH }/${ id }` } ) as Promise< unknown > )
			.then( ( data ) => {
				const entry = normalizeEntry( data );
				if ( entry ) setSelected( entry );
			} )
			.catch( () => toast( __( 'That entry is no longer here.', 'blicks' ) ) );
	}, [ toast ] );

	const changeStatus = async ( ids: number[], status: EntryStatus ): Promise< void > => {
		if ( ! list || ids.length === 0 ) return;
		const before = list;
		const beforeSelected = selected;

		setList( { ...list, items: withStatus( list.items, ids, status ), counts: shiftCounts( list.counts, list.items, ids, status ) } );
		setSelected( ( was ) => ( was && ids.includes( was.id ) ? { ...was, status } : was ) );

		try {
			if ( ids.length === 1 ) {
				await apiFetch( { path: `${ ENTRIES_PATH }/${ ids[ 0 ] }`, method: 'PATCH', data: { status } } );
			} else {
				await apiFetch( { path: `${ ENTRIES_PATH }/bulk`, method: 'POST', data: { ids, do: status } } );
			}
			setChecked( [] );
			void load( query, true );
		} catch {
			setList( before );
			setSelected( beforeSelected );
			toast( __( 'That did not work. Try again.', 'blicks' ) );
		}
	};

	const remove = async ( ids: number[] ): Promise< void > => {
		if ( ids.length === 0 ) return;
		setBusy( true );
		try {
			if ( ids.length === 1 ) {
				await apiFetch( { path: `${ ENTRIES_PATH }/${ ids[ 0 ] }`, method: 'DELETE' } );
			} else {
				await apiFetch( { path: `${ ENTRIES_PATH }/bulk`, method: 'POST', data: { ids, do: 'delete' } } );
			}
			setConfirm( null );
			setChecked( [] );
			setSelected( ( was ) => ( was && ids.includes( was.id ) ? null : was ) );
			// translators: %d: how many entries were deleted.
			toast( sprintf( _n( '%d entry deleted', '%d entries deleted', ids.length, 'blicks' ), ids.length ) );
			void load( query, true );
		} catch {
			toast( __( 'That did not work. Try again.', 'blicks' ) );
		} finally {
			setBusy( false );
		}
	};

	const items = list?.items ?? [];
	const filtered = query.form !== '' || query.status !== '' || query.search !== '';
	const allChecked = items.length > 0 && items.every( ( entry ) => checked.includes( entry.id ) );
	const toggle = ( id: number ): void => setChecked( ( was ) => ( was.includes( id ) ? was.filter( ( x ) => x !== id ) : [ ...was, id ] ) );
	const csv = list ? csvHref( list.csvUrl, query.form ) : '';
	const newCount = list?.counts.new ?? 0;
	const statuses = statusesOf( list );
	const listed = list?.statuses ?? [];
	const offers = ( slug: string ) => statuses.some( ( st ) => st.slug === slug );
	const allCount = list ? list.forms.reduce( ( sum, f ) => sum + f.count, 0 ) : 0;

	return (
		<div className="page">
			<div className="page-in en-in">
				<header className="page-head en-head">
					<h1>{ __( 'Entries', 'blicks' ) }</h1>
					{ newCount > 0 && (
						<span className="en-badge">
							{ /* translators: %d: how many entries are new. */ }
							{ sprintf( _n( '%d new', '%d new', newCount, 'blicks' ), newCount ) }
						</span>
					) }
					{ csv && allCount > 0 && (
						<a className="pill sm en-csv" href={ csv }>
							<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
							{ __( 'Export CSV', 'blicks' ) }
						</a>
					) }
				</header>

				{ list && ( allCount > 0 || filtered ) && (
					<div className="en-tools">
						<label className="vfield en-form">
							<span className="screen-reader-text">{ __( 'Form', 'blicks' ) }</span>
							<select value={ query.form } onChange={ ( event ) => setQuery( { ...query, form: event.target.value, page: 1 } ) }>
								{ /* translators: %d: how many entries in all. */ }
								<option value="">{ sprintf( __( 'All forms · %d', 'blicks' ), allCount ) }</option>
								{ list.forms.map( ( f ) => (
									<option key={ f.id } value={ f.id }>{ `${ f.title } · ${ f.count }` }</option>
								) ) }
							</select>
						</label>
						<div className="en-seg" role="group" aria-label={ __( 'Status', 'blicks' ) }>
							<button type="button" aria-pressed={ query.status === '' } onClick={ () => setQuery( { ...query, status: '', page: 1 } ) }>
								{ __( 'All', 'blicks' ) }
							</button>
							{ statuses.map( ( st ) => (
								<button
									key={ st.slug }
									type="button"
									aria-pressed={ query.status === st.slug }
									onClick={ () => setQuery( { ...query, status: st.slug, page: 1 } ) }
								>
									{ st.label }
									{ ( list.counts[ st.slug ] ?? 0 ) > 0 && <span className="en-seg-n">{ list.counts[ st.slug ] }</span> }
								</button>
							) ) }
						</div>
						<label className="vfield en-search">
							<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
							<span className="screen-reader-text">{ __( 'Search entries', 'blicks' ) }</span>
							<input type="search" value={ searchText } placeholder={ __( 'Search entries', 'blicks' ) } onChange={ ( event ) => setSearchText( event.target.value ) } />
						</label>
					</div>
				) }

				{ checked.length > 0 && (
					<div className="en-bulk" role="region" aria-label={ __( 'Selected entries', 'blicks' ) }>
						{ /* translators: %d: how many entries are ticked. */ }
						<b>{ sprintf( _n( '%d selected', '%d selected', checked.length, 'blicks' ), checked.length ) }</b>
						{ confirm === 'bulk' ? (
							<div className="confirm-del" role="alert">
								{ /* translators: %d: how many entries will be deleted. */ }
								<span>{ sprintf( _n( 'Delete %d entry for good?', 'Delete %d entries for good?', checked.length, 'blicks' ), checked.length ) }</span>
								<button type="button" className="pill sm" onClick={ () => setConfirm( null ) }>{ __( 'Keep them', 'blicks' ) }</button>
								<button type="button" className="pill sm pill--danger" disabled={ busy } onClick={ () => void remove( checked ) }>{ __( 'Delete', 'blicks' ) }</button>
							</div>
						) : (
							<>
								{ offers( 'handled' ) && (
									<button type="button" className="pill sm" onClick={ () => void changeStatus( checked, 'handled' ) }>
										{ /* translators: %s: a status name, e.g. Handled */ sprintf( __( 'Mark %s', 'blicks' ), statusName( 'handled', listed ).toLowerCase() ) }
									</button>
								) }
								{ offers( 'spam' ) && (
									<button type="button" className="pill sm" onClick={ () => void changeStatus( checked, 'spam' ) }>{ statusName( 'spam', listed ) }</button>
								) }
								<button type="button" className="pill sm pill--danger" onClick={ () => setConfirm( 'bulk' ) }>{ __( 'Delete', 'blicks' ) }</button>
								<button type="button" className="link-btn" onClick={ () => setChecked( [] ) }>{ __( 'Clear', 'blicks' ) }</button>
							</>
						) }
					</div>
				) }

				{ ! list && loading && <div className="card loading">{ __( 'Loading entries…', 'blicks' ) }</div> }

				{ list && list.total === 0 && ! loading && (
					<div className="card empty en-empty">
						{ filtered ? (
							<>
								<p>{ __( 'No entries match.', 'blicks' ) }</p>
								<button
									type="button"
									className="link-btn"
									onClick={ () => {
										setSearchText( '' );
										setQuery( FIRST );
									} }
								>
									{ __( 'Show every entry', 'blicks' ) }
								</button>
							</>
						) : (
							<p>{ __( 'No entries yet. When someone sends a form, it is listed here.', 'blicks' ) }</p>
						) }
					</div>
				) }

				{ list && list.total > 0 && (
					<div className={ `en-split${ selected ? ' has-panel' : '' }` }>
						<div className="card en-table-card" aria-busy={ loading }>
							<div className="en-scroll">
								<table className="en-table">
									<thead>
										<tr>
											<th scope="col" className="en-check">
												<input
													type="checkbox"
													checked={ allChecked }
													aria-label={ __( 'Select every entry on this page', 'blicks' ) }
													onChange={ () => setChecked( allChecked ? [] : items.map( ( e ) => e.id ) ) }
												/>
											</th>
											<th scope="col">{ __( 'Form', 'blicks' ) }</th>
											<th scope="col">{ __( 'From', 'blicks' ) }</th>
											<th scope="col">{ __( 'Says', 'blicks' ) }</th>
											<th scope="col">{ __( 'Page', 'blicks' ) }</th>
											<th scope="col">{ __( 'Received', 'blicks' ) }</th>
											<th scope="col">{ __( 'Status', 'blicks' ) }</th>
										</tr>
									</thead>
									<tbody>
										{ items.map( ( entry ) => {
											const when = receivedLabel( entry.received );
											const on = selected?.id === entry.id;
											return (
												<tr key={ entry.id } className={ `${ entry.status === 'new' ? 'is-new' : '' }${ on ? ' is-on' : '' }`.trim() || undefined }>
													<td className="en-check">
														<input
															type="checkbox"
															checked={ checked.includes( entry.id ) }
															// translators: %s: who sent the entry.
															aria-label={ sprintf( __( 'Select the entry from %s', 'blicks' ), entry.from || __( '(no name)', 'blicks' ) ) }
															onChange={ () => toggle( entry.id ) }
														/>
													</td>
													<td className="en-formc">{ entry.formTitle || entry.form }</td>
													<td className="en-from">
														<button type="button" className="en-open" aria-pressed={ on } onClick={ () => ( on ? setSelected( null ) : open( entry ) ) }>
															{ entry.from || __( '(no name)', 'blicks' ) }
														</button>
													</td>
													<td><span className="en-says">{ entry.says }</span></td>
													<td className="en-mono">{ entry.page }</td>
													<td className="en-mono"><time dateTime={ entry.received } title={ when.full }>{ when.short }</time></td>
													<td><StatusTag status={ entry.status } statuses={ listed } /></td>
												</tr>
											);
										} ) }
									</tbody>
								</table>
							</div>
							{ list.pages > 1 && (
								<nav className="en-pages" aria-label={ __( 'Entry pages', 'blicks' ) }>
									<button type="button" className="pill sm" disabled={ query.page <= 1 } onClick={ () => setQuery( { ...query, page: query.page - 1 } ) }>
										{ __( 'Previous', 'blicks' ) }
									</button>
									{ /* translators: 1: this page, 2: how many pages. */ }
									<span>{ sprintf( __( 'Page %1$d of %2$d', 'blicks' ), query.page, list.pages ) }</span>
									<button type="button" className="pill sm" disabled={ query.page >= list.pages } onClick={ () => setQuery( { ...query, page: query.page + 1 } ) }>
										{ __( 'Next', 'blicks' ) }
									</button>
								</nav>
							) }
						</div>

						{ selected && (
							<EntryPanel
								entry={ selected }
								statuses={ listed }
								busy={ busy }
								confirmDelete={ confirm === 'one' }
								onStatus={ ( status ) => void changeStatus( [ selected.id ], status ) }
								onAskDelete={ () => setConfirm( 'one' ) }
								onCancelDelete={ () => setConfirm( null ) }
								onDelete={ () => void remove( [ selected.id ] ) }
								onClose={ () => setSelected( null ) }
							/>
						) }
					</div>
				) }
			</div>
		</div>
	);
}
