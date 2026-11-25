<?php
/**
 * Runs a Blicks ability for the `wp blicks` command.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Cli;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Abilities\CoreAbilities;
use Blicks\Providers\McpServiceProvider;
use WP_Error;

/**
 * The abilities, called from a shell instead of over MCP.
 *
 * Nothing here is a second implementation. The table is {@see CoreAbilities::all()}, the input is
 * checked against each ability's own `input_schema`, the permission is the ability's own
 * declaration checked by {@see McpServiceProvider::permits()}, and the work is its own
 * `execute_callback`. A command that drifted from the MCP tool it mirrors would be a bug here, so
 * there is nothing here for it to drift in.
 *
 * **It runs as a WordPress account, never as nobody.** WP-CLI starts with no user, and the
 * abilities need one: listing scopes to what the account may edit, a write is checked against what
 * WordPress would strip for that account, a created draft is owned by it. So a call without
 * `--user` is refused rather than run with every capability check failing, or worse, skipped.
 *
 * **It does not need MCP access turned on.** That switch decides whether remote agents may connect.
 * Whoever runs `wp` already has the server; the account's capabilities are what still apply.
 *
 * Kept free of WP-CLI so the integration suite can drive it; {@see Command} is the thin layer that
 * reads arguments and prints.
 */
final class AbilityRunner {

	/**
	 * Every ability, by its short name (`list-blocks`), in the order the MCP server lists them.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function abilities(): array {
		$out = [];

		foreach ( CoreAbilities::all() as $name => $args ) {
			$out[ self::shortName( $name ) ] = $args;
		}

		return $out;
	}

	/** `blicks/list-blocks` → `list-blocks`. Anything else is returned as it was. */
	public static function shortName( string $name ): string {
		$prefix = CoreAbilities::NAMESPACE . '/';

		return str_starts_with( $name, $prefix ) ? substr( $name, strlen( $prefix ) ) : $name;
	}

	/** Does this ability change anything? Read from its own annotations, not listed again here. */
	public static function writes( string $name ): bool {
		$args = self::abilities()[ self::shortName( $name ) ] ?? null;

		return is_array( $args ) && false === ( $args['meta']['annotations']['readonly'] ?? true );
	}

	/** Does this ability destroy or replace something, so a person should confirm it first? */
	public static function destructive( string $name ): bool {
		$args = self::abilities()[ self::shortName( $name ) ] ?? null;

		return is_array( $args ) && true === ( $args['meta']['annotations']['destructive'] ?? false );
	}

	/**
	 * Run one ability as the current user.
	 *
	 * The ability's own answer comes back as it is, including one that reports a problem in its
	 * result (`error`, `errors`, `valid: false`) — {@see self::failed()} says which those are. A
	 * WP_Error means it did not run at all: unknown name, bad input, no user, or not allowed.
	 *
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>|WP_Error
	 */
	public static function run( string $name, array $input = [] ): array|WP_Error {
		$short = self::shortName( $name );
		$args = self::abilities()[ $short ] ?? null;

		if ( null === $args ) {
			return new WP_Error(
				'blicks_cli_unknown',
				sprintf(
					/* translators: 1: the name given, 2: comma-separated ability names. */
					__( '"%1$s" is not a Blicks ability. Available: %2$s.', 'blicks' ),
					$name,
					implode( ', ', array_keys( self::abilities() ) )
				)
			);
		}

		$invalid = self::checkInput( $args['input_schema'] ?? [], $input );

		if ( null !== $invalid ) {
			return $invalid;
		}

		if ( 0 === get_current_user_id() ) {
			return new WP_Error(
				'blicks_cli_user',
				__( 'Run this as a WordPress account: add --user=<login>. It can then do what that account could do in the editor, and nothing more.', 'blicks' )
			);
		}

		if ( ! McpServiceProvider::permits( $args['permission'] ?? null, $input ) ) {
			$user = wp_get_current_user();

			return new WP_Error(
				'blicks_cli_forbidden',
				sprintf(
					/* translators: 1: a user login, 2: an ability name such as blicks/get-post-layout. */
					__( '%1$s may not call %2$s with this input. A post that does not exist and one the account may not edit are refused alike.', 'blicks' ),
					$user->user_login,
					CoreAbilities::NAMESPACE . '/' . $short
				)
			);
		}

		$result = call_user_func( $args['execute_callback'], $input );

		return is_array( $result ) ? $result : [ 'result' => $result ];
	}

	/**
	 * Did the ability report a problem in its own result? Each says so its own way; these are all
	 * the ways {@see CoreAbilities} uses.
	 *
	 * @param array<string, mixed> $result
	 */
	public static function failed( array $result ): bool {
		return isset( $result['error'] )
			|| isset( $result['errors'] )
			|| false === ( $result['valid'] ?? null )
			|| false === ( $result['saved'] ?? null );
	}

	/**
	 * Check input against the ability's schema, as the Abilities API does before it runs one.
	 *
	 * The schema is round-tripped through JSON first: an empty `properties` is written as an object
	 * so it serialises as `{}`, and core's validator reads `properties` as an array.
	 *
	 * @param mixed                $schema
	 * @param array<string, mixed> $input
	 */
	private static function checkInput( mixed $schema, array $input ): ?WP_Error {
		if ( ! is_array( $schema ) || [] === $schema ) {
			return null;
		}

		$schema = json_decode( (string) wp_json_encode( $schema ), true );

		if ( ! is_array( $schema ) ) {
			return null;
		}

		$valid = rest_validate_value_from_schema( $input, $schema, 'input' );

		return is_wp_error( $valid ) ? $valid : null;
	}
}
