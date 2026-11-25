<?php
/**
 * The `wp blicks` command's runner: the MCP tools, from a shell, under the same rules.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Cli\AbilityRunner;
use Blicks\Mcp\Access;
use WP_Error;
use WP_UnitTestCase;

/**
 * Drives {@see AbilityRunner} as the command does, against real roles, with MCP access left off.
 */
final class CliAbilityRunnerTest extends WP_UnitTestCase {

	private int $editor;
	private int $author;
	private int $subscriber;

	public function set_up(): void {
		parent::set_up();

		$this->editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		$this->author = self::factory()->user->create( [ 'role' => 'author' ] );
		$this->subscriber = self::factory()->user->create( [ 'role' => 'subscriber' ] );

		Access::setEnabled( false );
	}

	public function tear_down(): void {
		wp_set_current_user( 0 );
		parent::tear_down();
	}

	private function page( int $author ): int {
		return self::factory()->post->create(
			[
				'post_type' => 'page',
				'post_author' => $author,
				'post_status' => 'draft',
				'post_content' => '',
			]
		);
	}

	public function test_every_mcp_tool_is_a_subcommand_by_the_same_name(): void {
		$this->assertSame(
			[ 'list-blocks', 'describe-block', 'get-design-system', 'save-animation', 'validate-layout', 'list-posts', 'get-post-layout', 'update-post-layout', 'create-page', 'set-post-status' ],
			array_keys( AbilityRunner::abilities() )
		);
	}

	public function test_it_runs_with_mcp_access_off(): void {
		wp_set_current_user( $this->editor );

		$result = AbilityRunner::run( 'list-blocks' );

		$this->assertIsArray( $result );
		$this->assertNotEmpty( $result['blocks'] );
		$this->assertFalse( AbilityRunner::failed( $result ) );
	}

	public function test_the_full_ability_name_works_too(): void {
		wp_set_current_user( $this->editor );

		$this->assertIsArray( AbilityRunner::run( 'blicks/list-blocks' ) );
	}

	public function test_it_refuses_to_run_as_nobody(): void {
		$result = AbilityRunner::run( 'list-blocks' );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'blicks_cli_user', $result->get_error_code() );
	}

	public function test_an_unknown_ability_names_the_real_ones(): void {
		wp_set_current_user( $this->editor );

		$result = AbilityRunner::run( 'delete-everything' );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'blicks_cli_unknown', $result->get_error_code() );
		$this->assertStringContainsString( 'list-blocks', $result->get_error_message() );
	}

	public function test_input_is_checked_against_the_abilitys_own_schema(): void {
		wp_set_current_user( $this->editor );

		$this->assertInstanceOf( WP_Error::class, AbilityRunner::run( 'describe-block', [] ) );
		$this->assertInstanceOf( WP_Error::class, AbilityRunner::run( 'list-blocks', [ 'extra' => 1 ] ) );
		$this->assertInstanceOf( WP_Error::class, AbilityRunner::run( 'set-post-status', [ 'id' => 1, 'status' => 'trash' ] ) );
	}

	public function test_the_account_needs_the_same_capability_it_would_over_mcp(): void {
		wp_set_current_user( $this->subscriber );

		$result = AbilityRunner::run( 'list-blocks' );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'blicks_cli_forbidden', $result->get_error_code() );
	}

	public function test_a_post_is_read_only_by_someone_who_may_edit_it(): void {
		$page = $this->page( $this->editor );

		wp_set_current_user( $this->author );
		$refused = AbilityRunner::run( 'get-post-layout', [ 'id' => $page ] );
		$this->assertInstanceOf( WP_Error::class, $refused );
		$this->assertSame( 'blicks_cli_forbidden', $refused->get_error_code() );

		wp_set_current_user( $this->editor );
		$read = AbilityRunner::run( 'get-post-layout', [ 'id' => $page ] );
		$this->assertIsArray( $read );
		$this->assertFalse( AbilityRunner::failed( $read ) );
	}

	public function test_publishing_needs_publish_rights_on_that_post(): void {
		$contributor = self::factory()->user->create( [ 'role' => 'contributor' ] );
		$page = self::factory()->post->create(
			[
				'post_type' => 'post',
				'post_author' => $contributor,
				'post_status' => 'draft',
			]
		);

		wp_set_current_user( $contributor );

		$this->assertInstanceOf( WP_Error::class, AbilityRunner::run( 'set-post-status', [ 'id' => $page, 'status' => 'publish' ] ) );
		$this->assertSame( 'draft', get_post_status( $page ) );
	}

	public function test_a_layout_the_ability_rejects_comes_back_as_a_failed_result(): void {
		wp_set_current_user( $this->editor );

		$result = AbilityRunner::run( 'validate-layout', [ 'blocks' => [ [ 'name' => 'blicks/not-a-block' ] ] ] );

		$this->assertIsArray( $result );
		$this->assertFalse( $result['valid'] );
		$this->assertTrue( AbilityRunner::failed( $result ) );
	}

	public function test_a_dry_run_writes_nothing(): void {
		$page = $this->page( $this->editor );

		wp_set_current_user( $this->editor );
		$result = AbilityRunner::run(
			'update-post-layout',
			[
				'id' => $page,
				'blocks' => [ [ 'name' => 'blicks/heading', 'attributes' => [ 'content' => 'Hi' ] ] ],
				'dryRun' => true,
			]
		);

		$this->assertIsArray( $result );
		$this->assertTrue( $result['dryRun'] ?? false, (string) wp_json_encode( $result ) );
		$this->assertSame( '', get_post( $page )->post_content );
	}

	public function test_what_needs_confirming_is_read_from_the_annotations(): void {
		$this->assertFalse( AbilityRunner::writes( 'list-posts' ) );
		$this->assertTrue( AbilityRunner::writes( 'create-page' ) );
		$this->assertFalse( AbilityRunner::destructive( 'create-page' ) );
		$this->assertTrue( AbilityRunner::destructive( 'update-post-layout' ) );
		$this->assertTrue( AbilityRunner::destructive( 'blicks/set-post-status' ) );
	}

	public function test_the_mcp_gate_still_needs_access_turned_on(): void {
		wp_set_current_user( $this->editor );

		$callback = \Blicks\Providers\McpServiceProvider::registrations()['blicks/list-blocks']['permission_callback'];

		$this->assertFalse( $callback( [] ) );

		Access::setEnabled( true );
		$this->assertTrue( $callback( [] ) );
		Access::setEnabled( false );
	}
}
