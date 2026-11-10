import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { useToast } from './Toast';

const PATH = '/blicks/v1/forms/settings';

type ProviderId = 'recaptchaV3' | 'recaptchaV2' | 'turnstile';

type Stored = Record< ProviderId, { siteKey: string; hasSecret: boolean } > & { minScore: number };

type Draft = Record< ProviderId, { siteKey: string; secret: string; replacing: boolean } >;

const PROVIDERS: Array< { id: ProviderId; title: () => string; desc: () => string } > = [
	{ id: 'recaptchaV3', title: () => __( 'Google reCAPTCHA v3', 'blicks' ), desc: () => __( 'Invisible. Scores each send; low scores go to Spam.', 'blicks' ) },
	{ id: 'recaptchaV2', title: () => __( 'Google reCAPTCHA v2', 'blicks' ), desc: () => __( 'The “I’m not a robot” checkbox.', 'blicks' ) },
	{ id: 'turnstile', title: () => __( 'Cloudflare Turnstile', 'blicks' ), desc: () => __( 'A privacy-friendly check, usually without a puzzle.', 'blicks' ) },
];

const IDS = PROVIDERS.map( provider => provider.id );

const EMPTY: Stored = {
	recaptchaV3: { siteKey: '', hasSecret: false },
	recaptchaV2: { siteKey: '', hasSecret: false },
	turnstile: { siteKey: '', hasSecret: false },
	minScore: 0.5,
};

function normalize( data: unknown ): Stored {
	const raw = ( data && typeof data === 'object' ? data : {} ) as Record< string, unknown >;
	const out: Stored = { ...EMPTY };
	for ( const id of IDS ) {
		const pair = ( raw[ id ] && typeof raw[ id ] === 'object' ? raw[ id ] : {} ) as Record< string, unknown >;
		out[ id ] = { siteKey: typeof pair.siteKey === 'string' ? pair.siteKey : '', hasSecret: pair.hasSecret === true };
	}
	out.minScore = typeof raw.minScore === 'number' ? raw.minScore : 0.5;
	return out;
}

function toDraft( stored: Stored ): Draft {
	return Object.fromEntries( IDS.map( id => [ id, { siteKey: stored[ id ].siteKey, secret: '', replacing: false } ] ) ) as Draft;
}

/**
 * Keys for the optional spam challenges a Form can use. Saved through its own route, apart from
 * the page's Save: secrets are write-only, so the screen only ever learns whether one is set.
 */
export function FormsSettings(): JSX.Element {
	const toast = useToast();
	const [ stored, setStored ] = useState< Stored >( EMPTY );
	const [ draft, setDraft ] = useState< Draft >( toDraft( EMPTY ) );
	const [ minScore, setMinScore ] = useState( 0.5 );
	const [ loaded, setLoaded ] = useState( false );
	const [ busy, setBusy ] = useState( false );

	const take = ( data: unknown ): void => {
		const next = normalize( data );
		setStored( next );
		setDraft( toDraft( next ) );
		setMinScore( next.minScore );
	};

	useEffect( () => {
		( apiFetch( { path: PATH } ) as Promise< unknown > )
			.then( take )
			.catch( () => toast( __( 'Could not load the form settings.', 'blicks' ) ) )
			.finally( () => setLoaded( true ) );
	}, [ toast ] );

	const dirty = minScore !== stored.minScore
		|| IDS.some( id => draft[ id ].siteKey.trim() !== stored[ id ].siteKey || draft[ id ].secret.trim() !== '' );

	const send = async ( data: Record< string, unknown >, done: string ): Promise< void > => {
		setBusy( true );
		try {
			take( await apiFetch( { path: PATH, method: 'PATCH', data } ) );
			toast( done );
		} catch {
			toast( __( 'Could not save the form settings.', 'blicks' ) );
		} finally {
			setBusy( false );
		}
	};

	const save = (): void => {
		const data: Record< string, unknown > = { minScore };
		for ( const id of IDS ) {
			data[ id ] = { siteKey: draft[ id ].siteKey.trim(), secret: draft[ id ].secret.trim() };
		}
		void send( data, __( 'Form settings saved.', 'blicks' ) );
	};

	const edit = ( id: ProviderId, patch: Partial< Draft[ ProviderId ] > ): void =>
		setDraft( current => ( { ...current, [ id ]: { ...current[ id ], ...patch } } ) );

	return (
		<section className="sp-sec" aria-labelledby="sp-forms">
			<header>
				<h2 id="sp-forms">{ __( 'Forms', 'blicks' ) }</h2>
				<p>{ __( 'Optional spam checks a Form can use. Off until a Form picks one; the provider’s script then loads only on pages with that form. Secret keys stay on your server.', 'blicks' ) }</p>
			</header>
			<div className="sp-rows">
				{ ! loaded ? (
					<p className="agents-empty">{ __( 'Loading…', 'blicks' ) }</p>
				) : (
					<form onSubmit={ ( event ) => { event.preventDefault(); save(); } }>
						{ PROVIDERS.map( ( provider ) => {
							const current = draft[ provider.id ];
							const has = stored[ provider.id ];
							const keyId = `fs-${ provider.id }-key`;
							const secretId = `fs-${ provider.id }-secret`;
							return (
								<div key={ provider.id } className="sp-row">
									<div className="sp-top">
										<div><b>{ provider.title() }</b><span>{ provider.desc() }</span></div>
										{ ( has.siteKey || has.hasSecret ) && (
											<button
												type="button"
												className="pill sm"
												disabled={ busy }
												aria-label={ sprintf( /* translators: %s: provider name. */ __( 'Clear the %s keys', 'blicks' ), provider.title() ) }
												onClick={ () => void send( { [ provider.id ]: { clear: true } }, __( 'Keys cleared.', 'blicks' ) ) }
											>{ __( 'Clear', 'blicks' ) }</button>
										) }
									</div>
									<label className="ds-field" htmlFor={ keyId }>
										<b>{ __( 'Site key', 'blicks' ) }</b>
										<span className="vfield">
											<input
												id={ keyId }
												type="text"
												value={ current.siteKey }
												maxLength={ 200 }
												autoComplete="off"
												spellCheck={ false }
												onChange={ ( event ) => edit( provider.id, { siteKey: event.target.value } ) }
											/>
										</span>
									</label>
									<div className="ds-field">
										<b id={ `${ secretId }-label` }>{ __( 'Secret key', 'blicks' ) }</b>
										{ has.hasSecret && ! current.replacing ? (
											<span className="vfield">
												<span>{ __( 'Set', 'blicks' ) } · <button type="button" className="link-btn" disabled={ busy } onClick={ () => edit( provider.id, { replacing: true } ) }>{ __( 'Replace', 'blicks' ) }</button></span>
											</span>
										) : (
											<span className="vfield">
												<input
													id={ secretId }
													type="password"
													value={ current.secret }
													maxLength={ 200 }
													autoComplete="off"
													spellCheck={ false }
													aria-labelledby={ `${ secretId }-label` }
													placeholder={ has.hasSecret ? __( 'Leave empty to keep the current one', 'blicks' ) : '' }
													onChange={ ( event ) => edit( provider.id, { secret: event.target.value } ) }
												/>
											</span>
										) }
									</div>
								</div>
							);
						} ) }
						<div className="sp-row">
							<label className="ds-field" htmlFor="fs-min-score">
								<b>{ __( 'Lowest reCAPTCHA v3 score', 'blicks' ) }</b>
								<span className="vfield">
									<select id="fs-min-score" value={ String( minScore ) } onChange={ ( event ) => setMinScore( Number( event.target.value ) ) }>
										{ [ 0.1, 0.3, 0.5, 0.7, 0.9 ].map( score => <option key={ score } value={ String( score ) }>{ score.toFixed( 1 ) }</option> ) }
										{ ! [ 0.1, 0.3, 0.5, 0.7, 0.9 ].includes( minScore ) && <option value={ String( minScore ) }>{ String( minScore ) }</option> }
									</select>
								</span>
								<small>{ __( 'The default for new forms. Sends scored below it are saved as Spam, never lost.', 'blicks' ) }</small>
							</label>
						</div>
						<div className="ds-acts">
							<button type="submit" className="pill pill--filled sm" disabled={ busy || ! dirty }>{ __( 'Save keys', 'blicks' ) }</button>
						</div>
					</form>
				) }
			</div>
		</section>
	);
}
