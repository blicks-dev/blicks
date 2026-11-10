import { __, sprintf } from '@wordpress/i18n';

/**
 * The MCP page's data: what the server reports, and the setup text for each client.
 *
 * Kept apart from the component so the one part with real rules in it — the configuration a user
 * pastes into a client, password included — is unit-tested rather than eyeballed.
 */

export type McpClient = 'claude-code' | 'claude-desktop' | 'codex' | 'cursor' | 'other';

export const MCP_CLIENTS: ReadonlyArray< [ McpClient, string ] > = [
	[ 'claude-code', 'Claude Code' ],
	[ 'claude-desktop', 'Claude Desktop' ],
	[ 'codex', 'Codex' ],
	[ 'cursor', 'Cursor' ],
	[ 'other', __( 'Other', 'blicks' ) ],
];

export type McpAgent = { uuid: string; name: string; client: string; created: string; lastUsed: string };

export type McpAccess = {
	enabled: boolean;
	endpoint: string;
	serverName: string;
	username: string;
	passwordsAvailable: boolean;
	profileUrl: string;
	agents: McpAgent[];
};

export const EMPTY_MCP_ACCESS: McpAccess = {
	enabled: false,
	endpoint: '',
	serverName: 'blicks',
	username: '',
	passwordsAvailable: false,
	profileUrl: '',
	agents: [],
};

const str = ( value: unknown ): string => ( typeof value === 'string' ? value : '' );

/** The REST response, with anything malformed dropped rather than rendered. */
export function normalizeMcpAccess( value: unknown ): McpAccess {
	if ( typeof value !== 'object' || value === null ) return EMPTY_MCP_ACCESS;

	const raw = value as Record< string, unknown >;
	const agents = Array.isArray( raw.agents ) ? raw.agents : [];

	return {
		enabled: raw.enabled === true,
		endpoint: str( raw.endpoint ),
		serverName: str( raw.serverName ) || EMPTY_MCP_ACCESS.serverName,
		username: str( raw.username ),
		passwordsAvailable: raw.passwordsAvailable === true,
		profileUrl: str( raw.profileUrl ),
		agents: agents
			.filter( ( a ): a is Record< string, unknown > => typeof a === 'object' && a !== null && str( ( a as Record< string, unknown > ).uuid ) !== '' )
			.map( ( a ) => ( {
				uuid: str( a.uuid ),
				name: str( a.name ),
				client: str( a.client ),
				created: str( a.created ),
				lastUsed: str( a.lastUsed ),
			} ) ),
	};
}

/** The bridge every client runs: it speaks MCP over stdio and calls the site over HTTPS. */
// Pinned, not `@latest`: npx fetches it on every launch with the site password in its environment,
// so a new release should reach users only after it has been checked against this server.
const BRIDGE = '@automattic/mcp-wordpress-remote@0.5.4';

export type McpSetup = { where: string; path: string; alt: string; text: string };

type SetupInput = { client: McpClient; endpoint: string; serverName: string; username: string; password: string };

/** Quote for a POSIX shell: single quotes, with any single quote closed, escaped and reopened. */
function shellQuote( value: string ): string {
	return `'${ value.replace( /'/g, `'\\''` ) }'`;
}

/** TOML basic string. */
function tomlString( value: string ): string {
	return JSON.stringify( value );
}

/**
 * What to paste where, for one client.
 *
 * The values are the site's own — the endpoint, the account, a password WordPress just made — but
 * a username or site address can still hold a quote, so each format quotes them properly instead
 * of interpolating them raw.
 */
export function mcpSetup( { client, endpoint, serverName, username, password }: SetupInput ): McpSetup {
	const env = { WP_API_URL: endpoint, WP_API_USERNAME: username, WP_API_PASSWORD: password };
	const json = JSON.stringify( { mcpServers: { [ serverName ]: { command: 'npx', args: [ '-y', BRIDGE ], env } } }, null, 2 );

	switch ( client ) {
		case 'claude-code':
			// The password is read at a silent prompt rather than written into the command, so it
			// stays out of the shell's history file. Paste it when the terminal waits, then Enter.
			return {
				where: __( 'Run this in a terminal, in the folder you work in. When it waits, paste the password and press Enter — it is not shown, and it stays out of your shell history.', 'blicks' ),
				path: '',
				alt: '',
				text: [
					'read -rs BLICKS_MCP_PASSWORD',
					`claude mcp add ${ shellQuote( serverName ) } \\`,
					`  --env WP_API_URL=${ shellQuote( endpoint ) } \\`,
					`  --env WP_API_USERNAME=${ shellQuote( username ) } \\`,
					'  --env WP_API_PASSWORD="$BLICKS_MCP_PASSWORD" \\',
					`  -- npx -y ${ BRIDGE }`,
					'unset BLICKS_MCP_PASSWORD',
				].join( '\n' ),
			};
		case 'claude-desktop':
			return {
				where: __( 'Add this to Claude Desktop’s configuration file, then restart Claude Desktop. If the file already has an mcpServers block, add the entry inside it.', 'blicks' ),
				path: '~/Library/Application Support/Claude/claude_desktop_config.json',
				alt: __( 'On Windows: %APPDATA%\\Claude\\claude_desktop_config.json', 'blicks' ),
				text: json,
			};
		case 'cursor':
			return {
				where: __( 'Add this to Cursor’s MCP file, then restart Cursor.', 'blicks' ),
				path: '~/.cursor/mcp.json',
				alt: '',
				text: json,
			};
		case 'codex':
			return {
				where: __( 'Add this to Codex’s configuration file, then restart Codex.', 'blicks' ),
				path: '~/.codex/config.toml',
				alt: '',
				text: [
					`[mcp_servers.${ tomlString( serverName ) }]`,
					'command = "npx"',
					`args = ["-y", ${ tomlString( BRIDGE ) }]`,
					`env = { WP_API_URL = ${ tomlString( endpoint ) }, WP_API_USERNAME = ${ tomlString( username ) }, WP_API_PASSWORD = ${ tomlString( password ) } }`,
				].join( '\n' ),
			};
		default:
			return {
				where: __( 'Most clients read an mcpServers block like this one. Check your client’s documentation for where it goes.', 'blicks' ),
				path: '',
				alt: '',
				text: json,
			};
	}
}

/** What the setup prompt puts where the password goes, for the user to replace. */
export const PASSWORD_PLACEHOLDER = 'PASTE-PASSWORD-HERE';

/**
 * One message the user pastes into the agent, which then sets itself up.
 *
 * **It never carries the password.** A chat message is sent to the AI provider and kept in the
 * conversation; a site password does not belong in either. The agent writes a placeholder and says
 * where it is, and the user pastes the password into that file themselves.
 */
export function mcpSetupPrompt( { endpoint, serverName, username }: Omit< SetupInput, 'client' | 'password' > ): string {
	return sprintf(
		/* translators: 1: server name, 2: bridge package, 3: endpoint, 4: username, 5: placeholder. */
		__( 'Connect to my WordPress site’s Blicks MCP server. Add an MCP server named "%1$s" to your configuration. It runs: npx -y %2$s, with these environment variables: WP_API_URL=%3$s, WP_API_USERNAME=%4$s, WP_API_PASSWORD=%5$s. Leave %5$s exactly as written — I will replace it with the password myself. Do not ask me for the password in this chat. When you have added it, tell me which file and line to edit.', 'blicks' ),
		serverName,
		BRIDGE,
		endpoint,
		username,
		PASSWORD_PLACEHOLDER
	);
}

/** A first task that proves the connection works end to end. */
export function mcpTestPrompt( serverName: string ): string {
	return sprintf(
		/* translators: %s: server name. */
		__( 'Use the %s MCP server to read the Blicks design system, then tell me how many color tokens it has.', 'blicks' ),
		serverName
	);
}
