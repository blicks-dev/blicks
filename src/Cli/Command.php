<?php
/**
 * The `wp blicks` command.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Cli;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_CLI;
use WP_Error;

/**
 * Inspect Blicks blocks and the design system, validate layouts, and read or change the layout of posts.
 *
 * Every subcommand is one of the Blicks MCP tools, by the same name, taking the same input and
 * answering with the same JSON. Run as a WordPress account with --user: the command can do what that
 * account could do in the editor, and nothing more. MCP access does not need to be turned on.
 *
 * Layouts are read from a file, or from STDIN when the file is `-` or left out, so the output of
 * get-post-layout can be edited and piped back into update-post-layout.
 *
 * ## EXAMPLES
 *
 *     # Which blocks are there, and what does a Box take?
 *     $ wp blicks list-blocks --user=admin
 *     $ wp blicks describe-block box --user=admin
 *
 *     # Read a page, change it, check it, write it back.
 *     $ wp blicks get-post-layout 42 --user=admin > page.json
 *     $ wp blicks validate-layout page.json --user=admin
 *     $ wp blicks update-post-layout 42 page.json --dry-run --user=admin
 *     $ wp blicks update-post-layout 42 page.json --yes --user=admin
 *
 *     # Any ability by name, with its input as JSON.
 *     $ wp blicks run list-posts --input='{"postType":"post","perPage":5}' --user=admin
 *
 * Exit status is 0 when the ability ran and reported no problem, 1 otherwise. The JSON is still
 * printed when the ability itself reported the problem, so a script can read every error at once.
 *
 * @when after_wp_load
 */
final class Command {

	/** Pretty, and readable: no escaped slashes or Unicode in what a person or a model reads. */
	private const JSON_FLAGS = JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

	/**
	 * Register the command. Called on `cli_init`, so only ever under WP-CLI.
	 */
	public static function register(): void {
		WP_CLI::add_command( 'blicks', self::class );
	}

	/**
	 * List the abilities, with whether each changes anything.
	 *
	 * ## OPTIONS
	 *
	 * [--format=<format>]
	 * : Output format.
	 * ---
	 * default: table
	 * options:
	 *   - table
	 *   - json
	 *   - csv
	 *   - yaml
	 * ---
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function abilities( array $args, array $assoc ): void {
		$rows = [];

		foreach ( AbilityRunner::abilities() as $name => $ability ) {
			$rows[] = [
				'name' => $name,
				'label' => (string) ( $ability['label'] ?? '' ),
				'writes' => AbilityRunner::writes( $name ) ? 'yes' : 'no',
				'destructive' => AbilityRunner::destructive( $name ) ? 'yes' : 'no',
			];
		}

		WP_CLI\Utils\format_items( $assoc['format'] ?? 'table', $rows, [ 'name', 'label', 'writes', 'destructive' ] );
	}

	/**
	 * Run any Blicks ability by name.
	 *
	 * ## OPTIONS
	 *
	 * <ability>
	 * : Ability name, e.g. list-posts or blicks/list-posts.
	 *
	 * [<file>]
	 * : JSON file holding the input. `-` reads STDIN.
	 *
	 * [--input=<json>]
	 * : The input as a JSON object, instead of a file.
	 *
	 * [--yes]
	 * : Skip the confirmation a destructive ability asks for.
	 *
	 * ## EXAMPLES
	 *
	 *     $ wp blicks run describe-block --input='{"name":"blicks/box"}' --user=admin
	 *
	 * @param list<string>               $args
	 * @param array<string, string|bool> $assoc
	 */
	public function run( array $args, array $assoc ): void {
		$name = $args[0];
		$input = isset( $assoc['input'] ) ? self::decode( (string) $assoc['input'], '--input' ) : ( isset( $args[1] ) ? self::readJson( $args[1] ) : [] );

		if ( ! self::isObject( $input ) ) {
			WP_CLI::error( 'The input must be a JSON object.' );
		}

		$this->call( $name, $input, $assoc );
	}

	/**
	 * List every Blicks block on this site.
	 *
	 * ## OPTIONS
	 *
	 * [--format=<format>]
	 * : Output format.
	 * ---
	 * default: table
	 * options:
	 *   - table
	 *   - json
	 *   - csv
	 *   - yaml
	 * ---
	 *
	 * @subcommand list-blocks
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function list_blocks( array $args, array $assoc ): void {
		$this->listing( 'list-blocks', [], 'blocks', [ 'name', 'title', 'description' ], $assoc );
	}

	/**
	 * Everything needed to build one block: attributes, style controls and their value schemas, tokens.
	 *
	 * ## OPTIONS
	 *
	 * <block>
	 * : Block name, e.g. blicks/box. A bare slug like box also works.
	 *
	 * @subcommand describe-block
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function describe_block( array $args, array $assoc ): void {
		$this->call( 'describe-block', [ 'name' => $args[0] ], $assoc );
	}

	/**
	 * This site's design tokens, breakpoints and keyframe library.
	 *
	 * @subcommand get-design-system
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function get_design_system( array $args, array $assoc ): void {
		$this->call( 'get-design-system', [], $assoc );
	}

	/**
	 * Add a keyframe animation to the design system, or replace the one with the same slug.
	 *
	 * ## OPTIONS
	 *
	 * [<file>]
	 * : JSON file with slug, steps and optionally label and defaults. `-` or nothing reads STDIN.
	 *
	 * @subcommand save-animation
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function save_animation( array $args, array $assoc ): void {
		$input = self::readJson( $args[0] ?? '-' );

		if ( ! self::isObject( $input ) ) {
			WP_CLI::error( 'Expected a JSON object with slug and steps.' );
		}

		$this->call( 'save-animation', $input, $assoc );
	}

	/**
	 * Check a layout against what this site can render, without changing anything.
	 *
	 * ## OPTIONS
	 *
	 * [<file>]
	 * : JSON file with a list of blocks, one block, or get-post-layout's output. `-` or nothing reads STDIN.
	 *
	 * @subcommand validate-layout
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function validate_layout( array $args, array $assoc ): void {
		$this->call( 'validate-layout', [ 'blocks' => self::blocks( self::readJson( $args[0] ?? '-' ) ) ], $assoc );
	}

	/**
	 * List the posts and pages you can edit, newest change first.
	 *
	 * ## OPTIONS
	 *
	 * [--post_type=<type>]
	 * : A post type.
	 * ---
	 * default: page
	 * ---
	 *
	 * [--search=<search>]
	 * : Only posts matching this.
	 *
	 * [--page=<page>]
	 * : Page of results.
	 *
	 * [--per_page=<per_page>]
	 * : Results per page.
	 *
	 * [--format=<format>]
	 * : Output format.
	 * ---
	 * default: table
	 * options:
	 *   - table
	 *   - json
	 *   - csv
	 *   - yaml
	 * ---
	 *
	 * @subcommand list-posts
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function list_posts( array $args, array $assoc ): void {
		$input = [ 'postType' => (string) ( $assoc['post_type'] ?? 'page' ) ];

		if ( isset( $assoc['search'] ) ) {
			$input['search'] = (string) $assoc['search'];
		}

		foreach ( [
			'page' => 'page',
			'per_page' => 'perPage',
		] as $flag => $key ) {
			if ( isset( $assoc[ $flag ] ) ) {
				$input[ $key ] = self::positiveInt( (string) $assoc[ $flag ], '--' . $flag );
			}
		}

		$this->listing( 'list-posts', $input, 'posts', null, $assoc );
	}

	/**
	 * Read one post's layout as a block tree, with the style values set on each block.
	 *
	 * ## OPTIONS
	 *
	 * <id>
	 * : The post or page ID.
	 *
	 * @subcommand get-post-layout
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function get_post_layout( array $args, array $assoc ): void {
		$this->call( 'get-post-layout', [ 'id' => self::positiveInt( $args[0], 'id' ) ], $assoc );
	}

	/**
	 * Replace the whole content of one post with the blocks given.
	 *
	 * The previous content is kept as a revision. Nothing is written if anything is wrong; every
	 * problem is reported instead.
	 *
	 * ## OPTIONS
	 *
	 * <id>
	 * : The post or page ID.
	 *
	 * [<file>]
	 * : JSON file with the complete block tree, or get-post-layout's output. `-` or nothing reads STDIN.
	 *
	 * [--dry-run]
	 * : Check everything, including what WordPress would strip for this account, without saving.
	 *
	 * [--yes]
	 * : Do not ask for confirmation.
	 *
	 * @subcommand update-post-layout
	 *
	 * @param list<string>               $args
	 * @param array<string, string|bool> $assoc
	 */
	public function update_post_layout( array $args, array $assoc ): void {
		$input = [
			'id' => self::positiveInt( $args[0], 'id' ),
			'blocks' => self::blocks( self::readJson( $args[1] ?? '-' ) ),
		];

		if ( true === WP_CLI\Utils\get_flag_value( $assoc, 'dry-run', false ) ) {
			$input['dryRun'] = true;
		}

		$this->call( 'update-post-layout', $input, $assoc );
	}

	/**
	 * Create a draft page or post owned by you, optionally with blocks.
	 *
	 * ## OPTIONS
	 *
	 * --title=<title>
	 * : The title.
	 *
	 * [<file>]
	 * : JSON file with the blocks it starts with. `-` reads STDIN. Left out, the draft is empty.
	 *
	 * [--post_type=<type>]
	 * : page or post.
	 * ---
	 * default: page
	 * ---
	 *
	 * @subcommand create-page
	 *
	 * @param list<string>          $args
	 * @param array<string, string> $assoc
	 */
	public function create_page( array $args, array $assoc ): void {
		$input = [
			'title' => (string) $assoc['title'],
			'postType' => (string) ( $assoc['post_type'] ?? 'page' ),
		];

		if ( isset( $args[0] ) ) {
			$input['blocks'] = self::blocks( self::readJson( $args[0] ) );
		}

		$this->call( 'create-page', $input, $assoc );
	}

	/**
	 * Publish or unpublish one post.
	 *
	 * ## OPTIONS
	 *
	 * <id>
	 * : The post or page ID.
	 *
	 * <status>
	 * : The new status: publish, draft, pending or private.
	 *
	 * [--yes]
	 * : Do not ask for confirmation.
	 *
	 * @subcommand set-post-status
	 *
	 * @param list<string>               $args
	 * @param array<string, string|bool> $assoc
	 */
	public function set_post_status( array $args, array $assoc ): void {
		$this->call(
			'set-post-status',
			[
				'id' => self::positiveInt( $args[0], 'id' ),
				'status' => $args[1],
			],
			$assoc
		);
	}

	/**
	 * Run an ability, print its JSON, and exit 1 when it did not run or reported a problem.
	 *
	 * @param array<string, mixed>       $input
	 * @param array<string, string|bool> $assoc
	 */
	private function call( string $name, array $input, array $assoc ): void {
		$result = $this->execute( $name, $input, $assoc );

		WP_CLI::line( (string) wp_json_encode( $result, self::JSON_FLAGS ) );

		if ( AbilityRunner::failed( $result ) ) {
			WP_CLI::halt( 1 );
		}
	}

	/**
	 * A listing ability, printed as rows unless JSON was asked for.
	 *
	 * @param array<string, mixed>       $input
	 * @param list<string>|null          $fields Null: every key of the first row.
	 * @param array<string, string|bool> $assoc
	 */
	private function listing( string $name, array $input, string $key, ?array $fields, array $assoc ): void {
		$format = (string) ( $assoc['format'] ?? 'table' );

		if ( 'json' === $format ) {
			$this->call( $name, $input, $assoc );
			return;
		}

		$result = $this->execute( $name, $input, $assoc );

		if ( AbilityRunner::failed( $result ) ) {
			WP_CLI::error( (string) ( $result['error'] ?? wp_json_encode( $result ) ) );
		}

		$rows = array_map(
			static fn ( $row ): array => array_map(
				static fn ( $value ) => match ( true ) {
					is_bool( $value ) => $value ? 'yes' : 'no',
					is_scalar( $value ) || null === $value => $value,
					default => wp_json_encode( $value ),
				},
				(array) $row
			),
			is_array( $result[ $key ] ?? null ) ? $result[ $key ] : []
		);

		if ( [] === $rows ) {
			WP_CLI::log( 'Nothing found.' );
			return;
		}

		WP_CLI\Utils\format_items( $format, $rows, $fields ?? array_keys( $rows[0] ) );
	}

	/**
	 * Confirm a destructive call, then run it. A refusal to run at all is an error.
	 *
	 * @param array<string, mixed>       $input
	 * @param array<string, string|bool> $assoc
	 * @return array<string, mixed>
	 */
	private function execute( string $name, array $input, array $assoc ): array {
		if ( AbilityRunner::destructive( $name ) && true !== ( $input['dryRun'] ?? false ) ) {
			WP_CLI::confirm(
				sprintf( 'Run %s? It changes content on this site.', AbilityRunner::shortName( $name ) ),
				$assoc
			);
		}

		$result = AbilityRunner::run( $name, $input );

		if ( $result instanceof WP_Error ) {
			WP_CLI::error( $result->get_error_message() );
		}

		return $result;
	}

	/**
	 * The block list from what a person or a previous command handed over: a list of blocks, one
	 * block, or an object with `blocks` (get-post-layout's output, so it pipes straight back in).
	 *
	 * @return list<mixed>
	 */
	private static function blocks( mixed $json ): array {
		if ( is_array( $json ) && array_is_list( $json ) ) {
			return $json;
		}

		if ( is_array( $json ) && is_array( $json['blocks'] ?? null ) ) {
			return array_values( $json['blocks'] );
		}

		if ( is_array( $json ) && isset( $json['name'] ) ) {
			return [ $json ];
		}

		WP_CLI::error( 'Expected a list of blocks, one block, or an object with "blocks".' );
	}

	/** Read JSON from a file, or from STDIN for `-`. */
	private static function readJson( string $path ): mixed {
		if ( '-' === $path ) {
			$raw = stream_get_contents( STDIN );
			$label = 'STDIN';
		} else {
			if ( ! is_file( $path ) || ! is_readable( $path ) ) {
				WP_CLI::error( sprintf( 'Cannot read %s.', $path ) );
			}

			// A local file named on the command line, read once; WP_Filesystem is for writing
			// into the site and adds nothing here.
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$raw = file_get_contents( $path );
			$label = $path;
		}

		return self::decode( false === $raw ? '' : $raw, $label );
	}

	private static function decode( string $raw, string $label ): mixed {
		if ( '' === trim( $raw ) ) {
			WP_CLI::error( sprintf( '%s is empty: expected JSON.', $label ) );
		}

		try {
			return json_decode( $raw, true, 512, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			WP_CLI::error( sprintf( '%s is not valid JSON: %s', $label, $e->getMessage() ) );
		}
	}

	/** A JSON object decodes to an associative array; `{}` decodes to an empty one. */
	private static function isObject( mixed $value ): bool {
		return is_array( $value ) && ( [] === $value || ! array_is_list( $value ) );
	}

	private static function positiveInt( string $value, string $label ): int {
		if ( ! ctype_digit( $value ) || (int) $value < 1 ) {
			WP_CLI::error( sprintf( '%s must be a positive whole number.', $label ) );
		}

		return (int) $value;
	}
}
