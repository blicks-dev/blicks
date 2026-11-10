import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { timeAgo } from '../data';
import {
	EMPTY_MCP_ACCESS,
	MCP_CLIENTS,
	mcpSetup,
	mcpSetupPrompt,
	PASSWORD_PLACEHOLDER,
	mcpTestPrompt,
	normalizeMcpAccess,
	type McpAccess,
	type McpClient,
} from '../mcp';
import { useToast } from './Toast';

const PATH = '/blicks/v1/mcp-access';

/** A freshly made agent password. Held in memory only, and only until the page is left. */
type Made = { client: McpClient; uuid: string; password: string };

const clientName = ( id: McpClient ): string => MCP_CLIENTS.find( ( [ value ] ) => value === id )?.[ 1 ] ?? id;

function copy( text: string, label: string, toast: ( message: string ) => void ): void {
	const blocked = (): void => toast( __( 'Copy was blocked here. Select the text and copy it.', 'blicks' ) );

	try {
		// translators: %s: what was copied, e.g. "Server address".
		navigator.clipboard.writeText( text ).then( () => toast( sprintf( __( '%s copied', 'blicks' ), label ) ), blocked );
	} catch {
		blocked();
	}
}

/**
 * Connect an AI agent. A real sequence, so it is numbered, and each step opens only once the one
 * before it has what it needs. What an agent may do is said before access is turned on.
 */
export function McpPanel(): JSX.Element {
	const toast = useToast();
	const [ access, setAccess ] = useState< McpAccess >( EMPTY_MCP_ACCESS );
	const [ loaded, setLoaded ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const [ consent, setConsent ] = useState( false );
	const [ ack, setAck ] = useState( false );
	const [ confirmOff, setConfirmOff ] = useState( false );
	const [ client, setClient ] = useState< McpClient >( 'claude-code' );
	const [ how, setHow ] = useState< 'prompt' | 'manual' >( 'prompt' );
	const [ made, setMade ] = useState< Made | null >( null );
	const [ test, setTest ] = useState< 'ok' | 'waiting' | null >( null );
	const [ rename, setRename ] = useState< { uuid: string; text: string } | null >( null );
	const [ revoke, setRevoke ] = useState< string | null >( null );

	const request = useCallback( async ( options: { path?: string; method?: string; data?: unknown } = {} ): Promise< unknown > => {
		setBusy( true );
		try {
			const data = await apiFetch( { path: options.path ?? PATH, method: options.method ?? 'GET', data: options.data } );
			return data;
		} finally {
			setBusy( false );
		}
	}, [] );

	const refresh = useCallback( async (): Promise< McpAccess > => {
		const next = normalizeMcpAccess( await request() );
		setAccess( next );
		return next;
	}, [ request ] );

	useEffect( () => {
		refresh()
			.catch( () => toast( __( 'Could not load MCP access.', 'blicks' ) ) )
			.finally( () => setLoaded( true ) );
	}, [ refresh, toast ] );

	const fail = ( error: unknown ): void => {
		const message = typeof error === 'object' && error !== null && 'message' in error ? String( ( error as { message: unknown } ).message ) : '';
		toast( message || __( 'That did not work. Try again.', 'blicks' ) );
	};

	const setEnabled = async ( enabled: boolean ): Promise< void > => {
		try {
			setAccess( normalizeMcpAccess( await request( { method: 'PATCH', data: { enabled } } ) ) );
			setConsent( false );
			setConfirmOff( false );
			setAck( false );
			toast( enabled ? __( 'MCP access is on', 'blicks' ) : __( 'MCP access is off', 'blicks' ) );
		} catch ( error ) {
			fail( error );
		}
	};

	const makePassword = async (): Promise< void > => {
		try {
			const created = await request( { path: `${ PATH }/agents`, method: 'POST', data: { client } } ) as { password?: unknown; agent?: { uuid?: unknown } };
			if ( typeof created.password !== 'string' || typeof created.agent?.uuid !== 'string' ) throw new Error();
			setMade( { client, uuid: created.agent.uuid, password: created.password } );
			setTest( null );
			await refresh();
		} catch ( error ) {
			fail( error );
		}
	};

	// WordPress records an application password's first use, so "connected" is answered by the
	// site itself rather than by reading back whatever the user pastes.
	const checkConnection = async (): Promise< void > => {
		if ( ! made ) return;
		try {
			const next = await refresh();
			const agent = next.agents.find( ( entry ) => entry.uuid === made.uuid );
			setTest( agent?.lastUsed ? 'ok' : 'waiting' );
		} catch ( error ) {
			fail( error );
		}
	};

	const saveName = async (): Promise< void > => {
		if ( ! rename ) return;
		try {
			setAccess( normalizeMcpAccess( await request( { path: `${ PATH }/agents/${ rename.uuid }`, method: 'PATCH', data: { name: rename.text } } ) ) );
			setRename( null );
			toast( __( 'Name saved', 'blicks' ) );
		} catch ( error ) {
			fail( error );
		}
	};

	const revokeAgent = async ( uuid: string, name: string ): Promise< void > => {
		try {
			setAccess( normalizeMcpAccess( await request( { path: `${ PATH }/agents/${ uuid }`, method: 'DELETE' } ) ) );
			setRevoke( null );
			if ( made?.uuid === uuid ) setMade( null );
			// translators: %s: agent name.
			toast( sprintf( __( '%s can no longer connect', 'blicks' ), name ) );
		} catch ( error ) {
			fail( error );
		}
	};

	const head = (
		<div className="mc-head">
			<div>
				<h1>{ __( 'MCP', 'blicks' ) }</h1>
				<p>{ __( 'Let an AI agent work with your Blicks blocks, design system and pages. Each agent you connect signs in with its own WordPress application password, which you can rename or revoke here.', 'blicks' ) }</p>
			</div>
		</div>
	);

	const perm = (
		<div className="perm" role="list">
			<div role="listitem"><i aria-hidden="true">R</i><div><b>{ __( 'Can read your site', 'blicks' ) }</b><span>{ __( 'Design system values, Blicks blocks, and the pages and posts your account can edit.', 'blicks' ) }</span></div></div>
			<div role="listitem" className="perm-w"><i aria-hidden="true">W</i><div><b>{ __( 'Can change your site', 'blicks' ) }</b><span>{ __( 'Pages and posts, the way you could in the editor. Every change is saved as a revision first.', 'blicks' ) }</span></div></div>
			<div role="listitem"><i aria-hidden="true">@</i><div><b>{ __( 'Acts as you', 'blicks' ) }</b><span>{
				// translators: %s: the signed-in username.
				sprintf( __( 'Agents sign in with your account, %s, so they can do what you can do and nothing more.', 'blicks' ), access.username || __( 'your account', 'blicks' ) )
			}</span></div></div>
		</div>
	);

	if ( ! loaded ) {
		return <div className="page mc"><div className="mc-in">{ head }</div></div>;
	}

	if ( ! access.enabled ) {
		return (
			<div className="page mc">
				<div className="mc-in">
					{ head }
					{ consent ? (
						<section className="consent" aria-labelledby="mcConsentH">
							<h2 id="mcConsentH">{ __( 'Before you turn on MCP access', 'blicks' ) }</h2>
							{ perm }
							<label className="ack">
								<input type="checkbox" checked={ ack } onChange={ ( event ) => setAck( event.target.checked ) } />
								{ __( 'I understand that connected agents can change my site as me. I can turn this off at any time.', 'blicks' ) }
							</label>
							<div className="row">
								<button type="button" className="pill" onClick={ () => setConsent( false ) }>{ __( 'Cancel', 'blicks' ) }</button>
								<button type="button" className="pill pill--filled" disabled={ ! ack || busy } onClick={ () => void setEnabled( true ) }>{ __( 'Turn on MCP access', 'blicks' ) }</button>
							</div>
						</section>
					) : (
						<div className="mc-off">
							<p><b>{ __( 'MCP access is off.', 'blicks' ) }</b> { __( 'Nothing outside WordPress can reach Blicks through MCP.', 'blicks' ) }</p>
							{ perm }
							<button type="button" className="pill pill--filled" onClick={ () => { setConsent( true ); setAck( false ); } }>{ __( 'Turn on MCP access', 'blicks' ) }</button>
						</div>
					) }
				</div>
			</div>
		);
	}

	const setupInput = made ? { endpoint: access.endpoint, serverName: access.serverName, username: access.username, password: made.password } : null;
	const setup = made && setupInput ? mcpSetup( { ...setupInput, client: made.client } ) : null;
	const tested = test === 'ok';
	const step = ( done: boolean, now: boolean ): string => ( done ? ' done' : now ? ' now' : ' locked' );
	const check = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;
	const agentCount = access.agents.length;

	return (
		<div className="page mc">
			<div className="mc-in">
				{ head }

				<section className="card" aria-labelledby="mcStatusH">
					<div className="mc-status">
						<div>
							<b id="mcStatusH"><i className="live" aria-hidden="true" />{ __( 'MCP access is on', 'blicks' ) }</b>
							<span>{ sprintf( /* translators: %d: number of agents. */ _n( '%d agent connected', '%d agents connected', agentCount, 'blicks' ), agentCount ) }</span>
						</div>
						<button type="button" className="sw2" role="switch" aria-checked="true" aria-label={ __( 'MCP access', 'blicks' ) } disabled={ busy } onClick={ () => setConfirmOff( true ) } />
						<div className="urlbox"><code>{ access.endpoint }</code><button type="button" className="pill sm" onClick={ () => copy( access.endpoint, __( 'Server address', 'blicks' ), toast ) }>{ __( 'Copy', 'blicks' ) }</button></div>
					</div>
					{ confirmOff && (
						<div className="mc-confirm">
							<div className="confirm warn" role="alert">
								<p>{ __( 'Turn off MCP access? Connected agents lose access until you turn it back on. Their passwords stay, so they reconnect without setting up again.', 'blicks' ) }</p>
								<button type="button" className="pill" onClick={ () => setConfirmOff( false ) }>{ __( 'Keep it on', 'blicks' ) }</button>
								<button type="button" className="pill pill--filled" disabled={ busy } onClick={ () => void setEnabled( false ) }>{ __( 'Turn off', 'blicks' ) }</button>
							</div>
						</div>
					) }
				</section>

				<section className="card" aria-labelledby="mcConnH">
					<div className="card-h">
						<h2 id="mcConnH">{ __( 'Connect an agent', 'blicks' ) }</h2>
						{ made && <button type="button" className="link-btn" onClick={ () => { setMade( null ); setTest( null ); } }>{ __( 'Connect another', 'blicks' ) }</button> }
					</div>
					{ ! access.passwordsAvailable ? (
						<p className="agents-empty">{ __( 'Application passwords are turned off for your account or this site, so an agent cannot sign in. They need HTTPS, and a security plugin or host setting may have disabled them.', 'blicks' ) }</p>
					) : (
						<ol className="connect">
							<li className={ `cstep${ step( !! made, ! made ) }` }>
								<span className="num">{ made ? check : 1 }</span>
								<div className="cstep-b">
									<b>{ __( 'Choose your client', 'blicks' ) }</b>
									<div className="clients" role="radiogroup" aria-label={ __( 'AI client', 'blicks' ) }>
										{ MCP_CLIENTS.map( ( [ id, label ] ) => (
											<button key={ id } type="button" role="radio" aria-checked={ ( made ? made.client : client ) === id } disabled={ !! made } onClick={ () => setClient( id ) }>{ label }</button>
										) ) }
									</div>
								</div>
							</li>
							<li className={ `cstep${ step( tested, ! tested ) }` }>
								<span className="num">{ tested ? check : 2 }</span>
								<div className="cstep-b">
									<b>{ __( 'Connect it', 'blicks' ) }</b>
									<div className="how" role="tablist" aria-label={ __( 'How to connect', 'blicks' ) }>
										<button type="button" role="tab" aria-selected={ how === 'prompt' } onClick={ () => setHow( 'prompt' ) }>{ __( 'Setup prompt', 'blicks' ) }</button>
										<button type="button" role="tab" aria-selected={ how === 'manual' } onClick={ () => setHow( 'manual' ) }>{ __( 'Set it up by hand', 'blicks' ) }</button>
									</div>
									{ ! made || ! setup || ! setupInput ? (
										<>
											<span>{ sprintf( /* translators: %s: client name. */ __( 'Creates an application password named “Blicks MCP · %s” for your account.', 'blicks' ), clientName( client ) ) }</span>
											<div className="row"><button type="button" className="pill pill--filled sm" disabled={ busy } onClick={ () => void makePassword() }>{ __( 'Create password and show setup', 'blicks' ) }</button></div>
										</>
									) : (
										<>
											<div className="once" role="note"><b>!</b><span>{ __( 'The password is shown once. Copy it now; you can revoke it below at any time. Never paste it into a chat with the agent.', 'blicks' ) }</span></div>
											<div className="cfg-path">
												{ __( 'Application password', 'blicks' ) }
												<div className="urlbox"><code>{ made.password }</code><button type="button" className="pill sm" onClick={ () => copy( made.password, __( 'Password', 'blicks' ), toast ) }>{ __( 'Copy password', 'blicks' ) }</button></div>
											</div>
											{ how === 'prompt' ? (
												<>
													<span>{ sprintf(
														/* translators: 1: client name, 2: placeholder text. */
														__( 'Paste this into %1$s. It adds the server with %2$s where the password goes and tells you which file to open; replace it there with the password above.', 'blicks' ),
														clientName( made.client ),
														PASSWORD_PLACEHOLDER
													) }</span>
													<pre className="cfg" tabIndex={ 0 }>{ mcpSetupPrompt( setupInput ) }</pre>
													<div className="row"><button type="button" className="pill pill--filled sm" onClick={ () => copy( mcpSetupPrompt( setupInput ), __( 'Setup prompt', 'blicks' ), toast ) }>{ __( 'Copy setup prompt', 'blicks' ) }</button></div>
												</>
											) : (
												<>
													<span>{ setup.where }</span>
													{ setup.path && (
														<div className="cfg-path">
															{ __( 'Configuration file', 'blicks' ) }
															<div className="urlbox"><code>{ setup.path }</code><button type="button" className="pill sm" onClick={ () => copy( setup.path, __( 'File path', 'blicks' ), toast ) }>{ __( 'Copy path', 'blicks' ) }</button></div>
															{ setup.alt && <span>{ setup.alt }</span> }
														</div>
													) }
													<pre className="cfg" tabIndex={ 0 }>{ setup.text }</pre>
													<div className="row"><button type="button" className="pill pill--filled sm" onClick={ () => copy( setup.text, __( 'Configuration', 'blicks' ), toast ) }>{ __( 'Copy configuration', 'blicks' ) }</button></div>
												</>
											) }
										</>
									) }
								</div>
							</li>
							<li className={ `cstep${ step( tested, !! made && ! tested ) }` }>
								<span className="num">{ tested ? check : 3 }</span>
								<div className="cstep-b">
									<b>{ __( 'Check the connection', 'blicks' ) }</b>
									{ made ? (
										<>
											<span>{ sprintf( /* translators: %s: client name. */ __( 'Run this prompt in %s, then check. WordPress notes the first time the new password signs in.', 'blicks' ), clientName( made.client ) ) }</span>
											<div className="row">
												<button type="button" className="pill sm" onClick={ () => copy( mcpTestPrompt( access.serverName ), __( 'Test prompt', 'blicks' ), toast ) }>{ __( 'Copy test prompt', 'blicks' ) }</button>
												<button type="button" className="pill pill--filled sm" disabled={ busy } onClick={ () => void checkConnection() }>{ __( 'Check connection', 'blicks' ) }</button>
											</div>
											{ test === 'ok' && <div className="result ok" role="status">{ sprintf( /* translators: %s: client name. */ __( 'Connected. %s can reach the Blicks MCP server.', 'blicks' ), clientName( made.client ) ) }</div> }
											{ test === 'waiting' && <div className="result bad" role="alert">{ __( 'The password has not signed in yet. Run the test prompt in your client, then check again.', 'blicks' ) }</div> }
										</>
									) : (
										<span>{ __( 'Opens once the agent has its setup.', 'blicks' ) }</span>
									) }
								</div>
							</li>
						</ol>
					) }
				</section>

				<section className="card" aria-labelledby="mcAgH">
					<div className="card-h"><h2 id="mcAgH">{ __( 'Connected agents', 'blicks' ) }</h2><span className="aside">{ __( 'Each has its own password', 'blicks' ) }</span></div>
					{ access.agents.length ? (
						<ul className="agents">
							{ access.agents.map( ( agent ) => (
								<li key={ agent.uuid }>
									<div>
										<b>{ agent.name }</b>
										<span>{ sprintf(
											/* translators: 1: client, 2: when created, 3: when last used. */
											__( '%1$s · created %2$s · last used %3$s', 'blicks' ),
											agent.client,
											timeAgo( agent.created ) || __( 'just now', 'blicks' ),
											agent.lastUsed ? timeAgo( agent.lastUsed ) : __( 'not yet', 'blicks' )
										) }</span>
									</div>
									<div className="acts">
										<button type="button" className="pill sm" onClick={ () => { setRename( { uuid: agent.uuid, text: agent.name } ); setRevoke( null ); } }>{ __( 'Rename', 'blicks' ) }</button>
										<button type="button" className="pill sm" onClick={ () => { setRevoke( agent.uuid ); setRename( null ); } }>{ __( 'Revoke', 'blicks' ) }</button>
									</div>
									{ rename?.uuid === agent.uuid && (
										<div className="rename">
											<label className="vfield"><input value={ rename.text } maxLength={ 100 } onChange={ ( event ) => setRename( { uuid: agent.uuid, text: event.target.value } ) } aria-label={ sprintf( /* translators: %s: agent name. */ __( 'New name for %s', 'blicks' ), agent.name ) } autoComplete="off" /></label>
											<button type="button" className="pill sm" onClick={ () => setRename( null ) }>{ __( 'Cancel', 'blicks' ) }</button>
											<button type="button" className="pill pill--filled sm" disabled={ busy || ! rename.text.trim() } onClick={ () => void saveName() }>{ __( 'Save name', 'blicks' ) }</button>
										</div>
									) }
									{ revoke === agent.uuid && (
										<div className="confirm-del" role="alert">
											<span>{ sprintf( /* translators: %s: agent name. */ __( 'Revoke “%s”? It loses access right away. Connect it again to give it a new password.', 'blicks' ), agent.name ) }</span>
											<button type="button" className="pill sm" onClick={ () => setRevoke( null ) }>{ __( 'Keep', 'blicks' ) }</button>
											<button type="button" className="pill sm pill--danger" disabled={ busy } onClick={ () => void revokeAgent( agent.uuid, agent.name ) }>{ __( 'Revoke', 'blicks' ) }</button>
										</div>
									) }
								</li>
							) ) }
						</ul>
					) : (
						<p className="agents-empty">{ __( 'No agents yet. Connect one above.', 'blicks' ) }</p>
					) }
				</section>
			</div>
		</div>
	);
}
