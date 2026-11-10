import { describe, expect, it } from 'vitest';
import { mcpSetup, mcpSetupPrompt, normalizeMcpAccess, PASSWORD_PLACEHOLDER } from './mcp';

const base = { endpoint: 'https://example.test/wp-json/blicks/mcp', serverName: 'example-blicks', username: 'admin', password: 'abcd efgh ijkl' };

describe( 'mcpSetup', () => {
	it( 'quotes every value for the shell in the Claude Code command', () => {
		const { text } = mcpSetup( { ...base, client: 'claude-code', username: "o'brien" } );

		expect( text ).toContain( "--env WP_API_USERNAME='o'\\''brien'" );
		expect( text ).toMatch( /npx -y @automattic\/mcp-wordpress-remote@\d+\.\d+\.\d+$/m );
		expect( text ).not.toContain( '@latest' );
	} );

	it( 'keeps the password out of the Claude Code command, so out of shell history', () => {
		const { text } = mcpSetup( { ...base, client: 'claude-code' } );

		expect( text ).not.toContain( base.password );
		expect( text.split( '\n' )[ 0 ] ).toBe( 'read -rs BLICKS_MCP_PASSWORD' );
		expect( text ).toContain( '--env WP_API_PASSWORD="$BLICKS_MCP_PASSWORD"' );
		expect( text ).toContain( 'unset BLICKS_MCP_PASSWORD' );
	} );

	it( 'writes valid JSON for Cursor and Claude Desktop', () => {
		for ( const client of [ 'cursor', 'claude-desktop', 'other' ] as const ) {
			const parsed = JSON.parse( mcpSetup( { ...base, client, username: 'a"b' } ).text );

			expect( parsed.mcpServers[ 'example-blicks' ].env ).toEqual( {
				WP_API_URL: base.endpoint,
				WP_API_USERNAME: 'a"b',
				WP_API_PASSWORD: base.password,
			} );
		}
	} );

	it( 'writes TOML strings for Codex', () => {
		const { text, path } = mcpSetup( { ...base, client: 'codex', username: 'a"b' } );

		expect( path ).toBe( '~/.codex/config.toml' );
		expect( text ).toContain( '[mcp_servers."example-blicks"]' );
		expect( text ).toContain( 'WP_API_USERNAME = "a\\"b"' );
	} );
} );

describe( 'mcpSetupPrompt', () => {
	it( 'never puts the password into the chat', () => {
		const prompt = mcpSetupPrompt( { ...base } );

		expect( prompt ).not.toContain( base.password );
		expect( prompt ).toContain( `WP_API_PASSWORD=${ PASSWORD_PLACEHOLDER }` );
		expect( prompt ).toContain( base.endpoint );
	} );
} );

describe( 'normalizeMcpAccess', () => {
	it( 'is off for anything malformed', () => {
		expect( normalizeMcpAccess( null ).enabled ).toBe( false );
		expect( normalizeMcpAccess( { enabled: 'yes' } ).enabled ).toBe( false );
	} );

	it( 'drops agents without an id and never carries a password', () => {
		const access = normalizeMcpAccess( {
			enabled: true,
			agents: [ { uuid: 'u1', name: 'A', password: 'secret' }, { name: 'no id' }, 'junk' ],
		} );

		expect( access.agents ).toHaveLength( 1 );
		expect( access.agents[ 0 ] ).not.toHaveProperty( 'password' );
	} );
} );
