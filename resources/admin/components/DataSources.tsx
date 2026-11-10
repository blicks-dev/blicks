import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	CACHE_OPTIONS,
	DATA_SOURCES_ANCHOR,
	DATA_SOURCES_PATH,
	DATA_SOURCES_USAGE_PATH,
	EMPTY_DRAFT,
	cacheLabel,
	fieldErrors,
	normalizeDataSources,
	normalizeTest,
	normalizeUsage,
	removeWarning,
	shortUrl,
	statusAfterTest,
	statusLine,
	testSummary,
	type DataSource,
	type DataSourceDraft,
	type FieldErrors,
	type TestResult,
} from '../data-sources';
import { useToast } from './Toast';

/**
 * The addresses a Loop may read. Administrators add one here and a Loop stores only its id, so no
 * author can point the server at an address of their choosing (`EndpointRegistry`).
 *
 * Unlike the rest of Settings, each change saves on its own: the routes keep the list, and holding
 * an endpoint back until the page's Save would leave a Loop pointing at an id that does not exist.
 */
export function DataSources(): JSX.Element {
	const toast = useToast();
	const section = useRef< HTMLElement >( null );
	const [ sources, setSources ] = useState< DataSource[] >( [] );
	const [ loaded, setLoaded ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const [ draft, setDraft ] = useState< DataSourceDraft | null >( null );
	const [ errors, setErrors ] = useState< FieldErrors & { form?: string } >( {} );
	const [ remove, setRemove ] = useState< string | null >( null );
	const [ tests, setTests ] = useState< Record< string, TestResult | 'running' > >( {} );
	const [ usage, setUsage ] = useState< Record< string, number | null | 'loading' > >( {} );

	const request = useCallback( async ( options: { path?: string; method?: string; data?: unknown } = {} ): Promise< unknown > => {
		setBusy( true );
		try {
			return await apiFetch( { path: options.path ?? DATA_SOURCES_PATH, method: options.method ?? 'GET', data: options.data } );
		} finally {
			setBusy( false );
		}
	}, [] );

	useEffect( () => {
		request()
			.then( ( data ) => setSources( normalizeDataSources( data ) ) )
			.catch( () => toast( __( 'Could not load the data sources.', 'blicks' ) ) )
			.finally( () => setLoaded( true ) );
	}, [ request, toast ] );

	// A Loop's "Add one in Settings" link lands here.
	useEffect( () => {
		if ( loaded && window.location.hash.endsWith( `/${ DATA_SOURCES_ANCHOR }` ) ) {
			section.current?.scrollIntoView( { block: 'start' } );
		}
	}, [ loaded ] );

	const open = ( next: DataSourceDraft ): void => {
		setDraft( next );
		setErrors( {} );
		setRemove( null );
	};

	const save = async (): Promise< void > => {
		if ( ! draft ) return;
		const editing = draft.id !== '';
		try {
			const data = await request( {
				path: editing ? `${ DATA_SOURCES_PATH }/${ draft.id }` : DATA_SOURCES_PATH,
				method: editing ? 'PATCH' : 'POST',
				data: { name: draft.name, url: draft.url.trim(), cache: draft.cache, keepLastGood: draft.keepLastGood },
			} );
			setSources( normalizeDataSources( data ) );
			setDraft( null );
			setErrors( {} );
			// translators: %s: data source name.
			toast( sprintf( editing ? __( '%s saved', 'blicks' ) : __( '%s added. Test it to fetch its first answer.', 'blicks' ), draft.name.trim() ) );
		} catch ( error ) {
			const { fields, message } = fieldErrors( error );
			setErrors( { ...fields, form: message || fields.id } );
		}
	};

	// Asked each time the confirmation opens: the server keeps the count until a post changes.
	const askRemove = ( source: DataSource ): void => {
		setRemove( source.id );
		setDraft( null );
		setUsage( ( was ) => ( { ...was, [ source.id ]: 'loading' } ) );
		( apiFetch( { path: `${ DATA_SOURCES_USAGE_PATH }?endpoint=${ encodeURIComponent( source.id ) }` } ) as Promise< unknown > )
			.then( normalizeUsage, () => null )
			.then( ( count ) => setUsage( ( was ) => ( { ...was, [ source.id ]: count } ) ) );
	};

	const removeSource = async ( source: DataSource ): Promise< void > => {
		try {
			setSources( normalizeDataSources( await request( { path: `${ DATA_SOURCES_PATH }/${ source.id }`, method: 'DELETE' } ) ) );
			setRemove( null );
			// translators: %s: data source name.
			toast( sprintf( __( '%s removed', 'blicks' ), source.name ) );
		} catch {
			toast( __( 'That did not work. Try again.', 'blicks' ) );
		}
	};

	const test = async ( source: DataSource ): Promise< void > => {
		setTests( ( was ) => ( { ...was, [ source.id ]: 'running' } ) );
		let result: TestResult;
		try {
			result = normalizeTest( await apiFetch( { path: `${ DATA_SOURCES_PATH }/${ source.id }/test`, method: 'POST' } ) );
		} catch ( error ) {
			result = normalizeTest( { ok: false, message: ( error as { message?: string } )?.message } );
		}
		setTests( ( was ) => ( { ...was, [ source.id ]: result } ) );
		setSources( ( was ) => was.map( ( entry ) => ( entry.id === source.id ? { ...entry, status: statusAfterTest( entry.status, result ) } : entry ) ) );
	};

	const form = ( current: DataSourceDraft ): JSX.Element => (
		<form className="ds-form" onSubmit={ ( event ) => { event.preventDefault(); void save(); } } noValidate>
			<label className="ds-field">
				<b>{ __( 'Name', 'blicks' ) }</b>
				<span className="vfield">
					<input
						value={ current.name }
						maxLength={ 60 }
						autoComplete="off"
						className={ errors.name ? 'is-invalid' : undefined }
						aria-invalid={ !! errors.name }
						aria-describedby={ errors.name ? 'ds-name-err' : undefined }
						placeholder={ __( 'Product cards', 'blicks' ) }
						onChange={ ( event ) => setDraft( { ...current, name: event.target.value } ) }
					/>
				</span>
				{ errors.name ? <em id="ds-name-err" className="ds-err">{ errors.name }</em> : <small>{ __( 'Authors pick it by this name in a Loop.', 'blicks' ) }</small> }
			</label>
			<label className="ds-field">
				<b>{ __( 'Address', 'blicks' ) }</b>
				<span className="vfield">
					<input
						type="url"
						inputMode="url"
						value={ current.url }
						maxLength={ 2048 }
						autoComplete="off"
						spellCheck={ false }
						className={ errors.url ? 'is-invalid' : undefined }
						aria-invalid={ !! errors.url }
						aria-describedby={ errors.url ? 'ds-url-err' : undefined }
						placeholder="https://api.example.com/cards"
						onChange={ ( event ) => setDraft( { ...current, url: event.target.value } ) }
					/>
				</span>
				{ errors.url ? <em id="ds-url-err" className="ds-err">{ errors.url }</em> : <small>{ __( 'An https address that answers with JSON. Authors never see it.', 'blicks' ) }</small> }
			</label>
			<label className="ds-field">
				<b>{ __( 'Fetch again', 'blicks' ) }</b>
				<span className="vfield">
					<select value={ current.cache } onChange={ ( event ) => setDraft( { ...current, cache: event.target.value as DataSourceDraft[ 'cache' ] } ) }>
						{ CACHE_OPTIONS.map( ( [ value, label ] ) => <option key={ value } value={ value }>{ label() }</option> ) }
					</select>
				</span>
				<small>{ __( 'Visitors get the kept answer; a fresh one is fetched in the background.', 'blicks' ) }</small>
			</label>
			<label className="ds-check">
				<input type="checkbox" checked={ current.keepLastGood } onChange={ ( event ) => setDraft( { ...current, keepLastGood: event.target.checked } ) } />
				<span><b>{ __( 'Keep the last good answer', 'blicks' ) }</b>{ __( 'If a fetch fails, Loops keep showing what they had instead of going empty.', 'blicks' ) }</span>
			</label>
			{ errors.form && <div className="result bad" role="alert">{ errors.form }</div> }
			<div className="ds-acts">
				<button type="button" className="pill sm" onClick={ () => { setDraft( null ); setErrors( {} ); } }>{ __( 'Cancel', 'blicks' ) }</button>
				<button type="submit" className="pill pill--filled sm" disabled={ busy || ! current.name.trim() || ! current.url.trim() }>
					{ current.id ? __( 'Save', 'blicks' ) : __( 'Add data source', 'blicks' ) }
				</button>
			</div>
		</form>
	);

	return (
		<section className="sp-sec" id={ DATA_SOURCES_ANCHOR } ref={ section } aria-labelledby="sp-sources">
			<header>
				<h2 id="sp-sources">{ __( 'Data sources', 'blicks' ) }</h2>
				<p>{ __( 'Web addresses a Loop can show. The server fetches each one and keeps the answer, so visitors never wait on the API. Changes here save right away.', 'blicks' ) }</p>
			</header>
			<div className="sp-rows">
				{ ! loaded ? (
					<p className="agents-empty">{ __( 'Loading…', 'blicks' ) }</p>
				) : sources.length === 0 && ! draft ? (
					<div className="ds-empty">
						<b>{ __( 'No data sources yet', 'blicks' ) }</b>
						<span>{ __( 'Add the address of an API that answers with a list, such as products, team members or events. Each item becomes one card in a Loop.', 'blicks' ) }</span>
					</div>
				) : (
					<ul className="agents ds-list">
						{ sources.map( ( source ) => {
							const result = tests[ source.id ];
							if ( draft?.id === source.id ) {
								return <li key={ source.id } className="is-editing">{ form( draft ) }</li>;
							}
							return (
								<li key={ source.id }>
									<div>
										<b>{ source.name }</b>
										<span className="ds-url" title={ source.url }>{ shortUrl( source.url ) }</span>
										<span>{ cacheLabel( source.cache ) }{ source.keepLastGood ? '' : ` · ${ __( 'goes empty when a fetch fails', 'blicks' ) }` }</span>
										{ source.status && ! result && (
											<span className={ `ds-status is-${ source.status.state }` }>{ statusLine( source.status ) }</span>
										) }
									</div>
									<div className="acts">
										<button type="button" className="pill sm" disabled={ result === 'running' } onClick={ () => void test( source ) }>
											{ result === 'running' ? __( 'Testing…', 'blicks' ) : __( 'Test now', 'blicks' ) }
										</button>
										<button type="button" className="pill sm" onClick={ () => open( { ...source } ) }>{ __( 'Edit', 'blicks' ) }</button>
										<button type="button" className="pill sm" onClick={ () => askRemove( source ) }>{ __( 'Remove', 'blicks' ) }</button>
									</div>
									{ result && result !== 'running' && (
										<div className={ `result ${ result.ok ? 'ok' : 'bad' }` } role={ result.ok ? 'status' : 'alert' }>{ testSummary( result ) }</div>
									) }
									{ remove === source.id && (
										<div className="confirm-del" role="alert">
											<span>{ removeWarning( source.name, usage[ source.id ] ?? null ) }</span>
											<button type="button" className="pill sm" onClick={ () => setRemove( null ) }>{ __( 'Keep', 'blicks' ) }</button>
											<button type="button" className="pill sm pill--danger" disabled={ busy } onClick={ () => void removeSource( source ) }>{ __( 'Remove', 'blicks' ) }</button>
										</div>
									) }
								</li>
							);
						} ) }
						{ draft && draft.id === '' && <li className="is-editing">{ form( draft ) }</li> }
					</ul>
				) }
				{ loaded && ! draft && (
					<div className="ds-foot">
						<button type="button" className="pill pill--filled sm" onClick={ () => open( { ...EMPTY_DRAFT } ) }>{ __( 'Add data source', 'blicks' ) }</button>
						<span>{ __( 'https only · JSON under 1 MB · answers within 8 seconds · no sign-in headers', 'blicks' ) }</span>
					</div>
				) }
			</div>
		</section>
	);
}
