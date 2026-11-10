<?php
/**
 * Whether MCP access is on, and the agents that may use it.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Mcp;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Abilities\McpServer;
use Blicks\Models\SettingModel;
use WP_Application_Passwords;
use WP_Error;

/**
 * MCP access: one switch, and the agents connected through it.
 *
 * **Off by default, and off means absent.** While the switch is off no ability is registered, no
 * MCP server or route exists, and no agent password can be created. There is nothing to probe.
 *
 * **An agent is a WordPress Application Password**, created for the signed-in account and named
 * after the client. Blicks stores no credential of its own: WordPress hashes the password, shows it
 * once, records when it was last used, and lets the account owner revoke it from their profile as
 * well as from here. An agent therefore acts as that account — it can do what the account can do
 * in wp-admin, and nothing more.
 *
 * Each client gets a fixed `app_id`, which is how this class recognises its own passwords among the
 * account's others and refuses to rename or revoke one it did not create.
 */
final class Access {

	private const ENABLED = 'mcp.enabled';

	/** `app_id` per client. Fixed, so a password made by one release is recognised by the next. */
	public const CLIENTS = [
		'claude-code' => [ '1b6d0a52-5f0e-4c3e-9a51-2f6a1c7e0b01', 'Claude Code' ],
		'claude-desktop' => [ '1b6d0a52-5f0e-4c3e-9a51-2f6a1c7e0b02', 'Claude Desktop' ],
		'codex' => [ '1b6d0a52-5f0e-4c3e-9a51-2f6a1c7e0b03', 'Codex' ],
		'cursor' => [ '1b6d0a52-5f0e-4c3e-9a51-2f6a1c7e0b04', 'Cursor' ],
		'other' => [ '1b6d0a52-5f0e-4c3e-9a51-2f6a1c7e0b05', 'Other' ],
	];

	/** Is MCP access on? Read directly so it works before the plugin has booted. */
	public static function enabled(): bool {
		global $wpdb;

		if ( ! is_object( $wpdb ) ) {
			return false;
		}

		return true === SettingModel::getValue( self::ENABLED, false );
	}

	public static function setEnabled( bool $enabled ): void {
		SettingModel::setValue( self::ENABLED, $enabled );
	}

	/** The address a client connects to. */
	public static function endpoint(): string {
		return rest_url( ltrim( McpServer::restPath(), '/' ) );
	}

	/** Can this account have application passwords at all? Sites and hosts can turn them off. */
	public static function passwordsAvailable( int $userId ): bool {
		$user = get_userdata( $userId );

		return false !== $user && wp_is_application_passwords_available_for_user( $user );
	}

	/**
	 * The screen's view of access: the switch, the address, and this account's agents.
	 *
	 * @return array<string, mixed>
	 */
	public static function snapshot( int $userId ): array {
		$user = get_userdata( $userId );

		return [
			'enabled' => self::enabled(),
			'endpoint' => self::endpoint(),
			'serverName' => sanitize_title( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) . '-blicks',
			'username' => false !== $user ? $user->user_login : '',
			'passwordsAvailable' => self::passwordsAvailable( $userId ),
			'profileUrl' => admin_url( 'profile.php#application-passwords-section' ),
			'agents' => self::agents( $userId ),
		];
	}

	/**
	 * This account's agent passwords, newest first. Never the password itself — WordPress keeps
	 * only its hash.
	 *
	 * @return list<array{uuid: string, name: string, client: string, created: string, lastUsed: string}>
	 */
	public static function agents( int $userId ): array {
		$agents = [];

		foreach ( WP_Application_Passwords::get_user_application_passwords( $userId ) as $item ) {
			$client = self::clientFor( (string) ( $item['app_id'] ?? '' ) );

			if ( null === $client ) {
				continue;
			}

			$agents[] = [
				'uuid' => (string) $item['uuid'],
				'name' => (string) $item['name'],
				'client' => self::CLIENTS[ $client ][1],
				'created' => self::date( $item['created'] ?? null ),
				'lastUsed' => self::date( $item['last_used'] ?? null ),
			];
		}

		usort( $agents, static fn ( array $a, array $b ): int => strcmp( $b['created'], $a['created'] ) );

		return $agents;
	}

	/**
	 * Create an agent password. The plain password is in the result and nowhere else, ever.
	 *
	 * @return array{password: string, agent: array<string, string>}|WP_Error
	 */
	public static function createAgent( int $userId, string $client ): array|WP_Error {
		if ( ! self::enabled() ) {
			return new WP_Error( 'blicks_mcp_off', __( 'Turn on MCP access first.', 'blicks' ), [ 'status' => 409 ] );
		}

		if ( ! isset( self::CLIENTS[ $client ] ) ) {
			return new WP_Error( 'blicks_mcp_client', __( 'Unknown client.', 'blicks' ), [ 'status' => 400 ] );
		}

		if ( ! self::passwordsAvailable( $userId ) ) {
			return new WP_Error( 'blicks_mcp_passwords_off', __( 'Application passwords are turned off for this account or site.', 'blicks' ), [ 'status' => 409 ] );
		}

		[ $appId, $label ] = self::CLIENTS[ $client ];

		$created = WP_Application_Passwords::create_new_application_password(
			$userId,
			[
				/* translators: %s: an AI client's name, e.g. "Claude Code". */
				'name' => sprintf( __( 'Blicks MCP · %s', 'blicks' ), $label ),
				'app_id' => $appId,
			]
		);

		if ( is_wp_error( $created ) ) {
			return $created;
		}

		[ $password, $item ] = $created;

		return [
			'password' => WP_Application_Passwords::chunk_password( $password ),
			'agent' => [
				'uuid' => (string) $item['uuid'],
				'name' => (string) $item['name'],
				'client' => $label,
				'created' => self::date( $item['created'] ?? null ),
				'lastUsed' => '',
			],
		];
	}

	/**
	 * Rename one of this account's agent passwords.
	 *
	 * @return true|WP_Error True on success. Declared `bool` natively: a standalone `true` type needs PHP 8.2.
	 */
	public static function renameAgent( int $userId, string $uuid, string $name ): bool|WP_Error {
		$name = trim( sanitize_text_field( $name ) );

		if ( '' === $name || mb_strlen( $name ) > 100 ) {
			return new WP_Error( 'blicks_mcp_name', __( 'Give it a name of up to 100 characters.', 'blicks' ), [ 'status' => 400 ] );
		}

		$owned = self::owned( $userId, $uuid );

		if ( is_wp_error( $owned ) ) {
			return $owned;
		}

		$result = WP_Application_Passwords::update_application_password( $userId, $uuid, [ 'name' => $name ] );

		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * Revoke one of this account's agent passwords. It stops working on the next request.
	 *
	 * @return true|WP_Error True on success. Declared `bool` natively: a standalone `true` type needs PHP 8.2.
	 */
	public static function revokeAgent( int $userId, string $uuid ): bool|WP_Error {
		$owned = self::owned( $userId, $uuid );

		if ( is_wp_error( $owned ) ) {
			return $owned;
		}

		$result = WP_Application_Passwords::delete_application_password( $userId, $uuid );

		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * Is this one of the account's Blicks agent passwords? Anything else — another plugin's
	 * password, another account's — is answered as "not found", never touched.
	 *
	 * @return true|WP_Error True when owned. Declared `bool` natively: a standalone `true` type needs PHP 8.2.
	 */
	private static function owned( int $userId, string $uuid ): bool|WP_Error {
		$item = WP_Application_Passwords::get_user_application_password( $userId, $uuid );

		if ( ! is_array( $item ) || null === self::clientFor( (string) ( $item['app_id'] ?? '' ) ) ) {
			return new WP_Error( 'blicks_mcp_agent', __( 'No such agent.', 'blicks' ), [ 'status' => 404 ] );
		}

		return true;
	}

	/**
	 * Is this application-password record one of the agent passwords Blicks made?
	 *
	 * @param array<string, mixed> $item As WordPress stores it.
	 */
	public static function isAgentItem( array $item ): bool {
		return null !== self::clientFor( (string) ( $item['app_id'] ?? '' ) );
	}

	/** Is the password with this uuid, on this account, a Blicks agent password? */
	public static function isAgentPassword( int $userId, string $uuid ): bool {
		$item = WP_Application_Passwords::get_user_application_password( $userId, $uuid );

		return is_array( $item ) && self::isAgentItem( $item );
	}

	private static function clientFor( string $appId ): ?string {
		foreach ( self::CLIENTS as $client => [ $id ] ) {
			if ( $id === $appId ) {
				return $client;
			}
		}

		return null;
	}

	private static function date( mixed $timestamp ): string {
		return is_numeric( $timestamp ) && (int) $timestamp > 0 ? gmdate( DATE_ATOM, (int) $timestamp ) : '';
	}
}
