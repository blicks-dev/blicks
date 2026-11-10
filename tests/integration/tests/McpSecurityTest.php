<?php
/**
 * Who may do what, to which post, through the Blicks MCP tools.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Ai\Abilities\McpServer;
use Blicks\Mcp\Access;
use Blicks\Providers\McpServiceProvider;
use WP_Application_Passwords;
use WP_UnitTestCase;

/**
 * The security model, against a real WordPress with real roles.
 *
 * The permission callbacks and execute callbacks are taken from the provider's own registration
 * table and called directly, exactly as the abilities registry calls them, so these tests exercise
 * the code that ships rather than a copy of its rules.
 */
final class McpSecurityTest extends WP_UnitTestCase {

	private int $admin;
	private int $editor;
	private int $author;
	private int $contributor;
	private int $subscriber;
	private ?string $remoteAddr = null;

	public function set_up(): void {
		parent::set_up();

		$this->admin = self::factory()->user->create( [ 'role' => 'administrator' ] );
		$this->editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		$this->author = self::factory()->user->create( [ 'role' => 'author' ] );
		$this->contributor = self::factory()->user->create( [ 'role' => 'contributor' ] );
		$this->subscriber = self::factory()->user->create( [ 'role' => 'subscriber' ] );

		// Multisite strips unfiltered_html from everyone but super admins; this suite is single site.
		Access::setEnabled( true );

		// A successful application-password sign-in records the client's IP, and the CLI that
		// runs this suite has none to record.
		$this->remoteAddr = $_SERVER['REMOTE_ADDR'] ?? null;
		$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
	}

	public function tear_down(): void {
		unset( $GLOBALS['wp_rest_application_password_uuid'], $GLOBALS['wp']->query_vars['rest_route'] );
		remove_all_filters( 'application_password_is_api_request' );
		Access::setEnabled( false );

		if ( null === $this->remoteAddr ) {
			unset( $_SERVER['REMOTE_ADDR'] );
		} else {
			$_SERVER['REMOTE_ADDR'] = $this->remoteAddr;
		}

		parent::tear_down();
	}

	/** @return array<string, mixed> */
	private function ability( string $name ): array {
		return McpServiceProvider::registrations()[ 'blicks/' . $name ];
	}

	/** @param array<string, mixed> $input */
	private function allowed( string $name, array $input = [] ): bool {
		return (bool) call_user_func( $this->ability( $name )['permission_callback'], $input );
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	private function call( string $name, array $input = [] ): array {
		return call_user_func( $this->ability( $name )['execute_callback'], $input );
	}

	private function page( int $author, string $status = 'draft', string $content = '' ): int {
		return self::factory()->post->create(
			[
				'post_type' => 'page',
				'post_author' => $author,
				'post_status' => $status,
				'post_content' => $content,
			]
		);
	}

	// ── off by default ─────────────────────────────────────────────────────────

	public function test_access_is_off_until_an_administrator_turns_it_on(): void {
		Access::setEnabled( false );
		delete_option( 'blicks_settings_schema_version' );

		$this->assertFalse( Access::enabled() );
	}

	public function test_while_off_no_route_answers_and_every_gate_is_closed(): void {
		Access::setEnabled( false );
		wp_set_current_user( $this->admin );

		$this->assertArrayNotHasKey( '/' . McpServer::ROUTE_NAMESPACE . '/' . McpServer::ROUTE, rest_get_server()->get_routes() );
		$this->assertFalse( $this->allowed( 'list-blocks' ) );
		$this->assertFalse( $this->allowed( 'get-post-layout', [ 'id' => $this->page( $this->admin ) ] ) );
	}

	public function test_while_off_no_agent_password_can_be_created(): void {
		Access::setEnabled( false );

		$this->assertWPError( Access::createAgent( $this->admin, 'claude-code' ) );
	}

	public function test_only_an_administrator_reaches_the_switch(): void {
		foreach ( [ $this->editor, $this->author, $this->subscriber ] as $user ) {
			wp_set_current_user( $user );
			$request = new \WP_REST_Request( 'PATCH', '/blicks/v1/mcp-access' );
			$request->set_body_params( [ 'enabled' => true ] );

			$this->assertSame( 403, rest_get_server()->dispatch( $request )->get_status() );
		}
	}

	// ── who may call what ──────────────────────────────────────────────────────

	public function test_read_tools_need_the_editor_capability_not_a_login(): void {
		wp_set_current_user( $this->subscriber );
		$this->assertFalse( $this->allowed( 'list-blocks' ) );
		$this->assertFalse( $this->allowed( 'validate-layout' ) );

		wp_set_current_user( 0 );
		$this->assertFalse( $this->allowed( 'list-blocks' ) );

		wp_set_current_user( $this->contributor );
		$this->assertTrue( $this->allowed( 'list-blocks' ) );
	}

	public function test_a_post_is_read_and_written_only_by_someone_who_may_edit_that_post(): void {
		$adminDraft = $this->page( $this->admin );

		wp_set_current_user( $this->author );
		$this->assertFalse( $this->allowed( 'get-post-layout', [ 'id' => $adminDraft ] ), 'another user\'s draft is not readable' );
		$this->assertFalse( $this->allowed( 'update-post-layout', [ 'id' => $adminDraft ] ) );

		wp_set_current_user( $this->editor );
		$this->assertTrue( $this->allowed( 'update-post-layout', [ 'id' => $adminDraft ] ) );
	}

	public function test_a_missing_post_and_a_forbidden_one_look_the_same(): void {
		wp_set_current_user( $this->author );

		$this->assertFalse( $this->allowed( 'get-post-layout', [ 'id' => 999999 ] ) );
		$this->assertFalse( $this->allowed( 'get-post-layout', [] ) );
		$this->assertFalse( $this->allowed( 'get-post-layout', [ 'id' => 'abc' ] ) );
	}

	public function test_site_structure_is_out_of_reach_even_for_an_administrator(): void {
		$template = self::factory()->post->create(
			[
				'post_type' => 'wp_block',
				'post_status' => 'publish',
			]
		);
		wp_set_current_user( $this->admin );

		$this->assertFalse( $this->allowed( 'update-post-layout', [ 'id' => $template ] ) );
		$this->assertFalse( $this->allowed( 'create-page', [ 'postType' => 'wp_block' ] ) );
	}

	public function test_publishing_needs_publish_post_on_that_post(): void {
		wp_set_current_user( $this->contributor );
		$own = $this->page( $this->contributor );
		$ownPost = self::factory()->post->create( [ 'post_author' => $this->contributor, 'post_status' => 'draft' ] );

		$this->assertFalse( $this->allowed( 'set-post-status', [ 'id' => $ownPost, 'status' => 'publish' ] ) );
		$this->assertFalse( $this->allowed( 'set-post-status', [ 'id' => $ownPost, 'status' => 'private' ] ) );
		$this->assertTrue( $this->allowed( 'set-post-status', [ 'id' => $ownPost, 'status' => 'pending' ] ) );
		$this->assertFalse( $this->allowed( 'set-post-status', [ 'id' => $own, 'status' => 'pending' ] ), 'contributors cannot edit pages' );
	}

	public function test_creating_needs_the_post_types_own_capability(): void {
		wp_set_current_user( $this->contributor );
		$this->assertFalse( $this->allowed( 'create-page', [ 'postType' => 'page' ] ) );
		$this->assertTrue( $this->allowed( 'create-page', [ 'postType' => 'post' ] ) );

		wp_set_current_user( $this->subscriber );
		$this->assertFalse( $this->allowed( 'create-page', [ 'postType' => 'post' ] ) );
	}

	public function test_a_created_page_is_always_a_draft_owned_by_the_caller(): void {
		wp_set_current_user( $this->editor );
		$result = $this->call( 'create-page', [ 'title' => 'From an agent' ] );

		$this->assertTrue( $result['created'] );
		$this->assertSame( 'draft', get_post_status( $result['id'] ) );
		$this->assertSame( $this->editor, (int) get_post_field( 'post_author', $result['id'] ) );
	}

	// ── reads do not leak ──────────────────────────────────────────────────────

	public function test_listing_shows_only_posts_the_caller_may_edit_and_counts_only_those(): void {
		$this->page( $this->admin, 'draft' );
		$this->page( $this->admin, 'private' );
		$this->page( $this->admin, 'publish' );
		$mine = self::factory()->post->create( [ 'post_author' => $this->author ] );

		wp_set_current_user( $this->author );
		$pages = $this->call( 'list-posts', [ 'postType' => 'page' ] );
		$posts = $this->call( 'list-posts', [ 'postType' => 'post' ] );

		$this->assertSame( 0, $pages['total'] );
		$this->assertSame( [ $mine ], array_column( $posts['posts'], 'id' ) );
	}

	// ── writes ─────────────────────────────────────────────────────────────────

	public function test_a_write_keeps_the_previous_content_as_a_revision_and_names_it(): void {
		wp_set_current_user( $this->editor );
		$id = $this->page( $this->editor, 'draft', "<!-- wp:paragraph -->\n<p>Before</p>\n<!-- /wp:paragraph -->" );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => 'blicks/box' ] ] ] );

		$this->assertTrue( $result['written'] );
		$this->assertGreaterThan( 0, $result['revisionId'] );
		$this->assertStringContainsString( 'Before', get_post_field( 'post_content', $result['revisionId'] ) );
		$this->assertStringContainsString( 'wp:blicks/box', get_post_field( 'post_content', $id ) );
		$this->assertTrue( $result['storedAsSent'] );
	}

	public function test_a_dry_run_reports_and_writes_nothing(): void {
		wp_set_current_user( $this->editor );
		$id = $this->page( $this->editor, 'draft', 'Before' );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => 'blicks/box' ] ], 'dryRun' => true ] );

		$this->assertTrue( $result['dryRun'] );
		$this->assertTrue( $result['changed'] );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );
	}

	public function test_an_invalid_tree_is_refused_whole_and_reported(): void {
		wp_set_current_user( $this->editor );
		$id = $this->page( $this->editor, 'draft', 'Before' );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[ 'name' => 'blicks/box' ],
					[
						'name' => 'blicks/box',
						'blicks' => [ 'layout.gapRow' => [ 'default' => [ 'base' => 'url(https://evil.test/x)' ] ] ],
					],
				],
			]
		);

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'invalid-value', $result['errors'][0]['reason'] );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ), 'nothing is partly applied' );
	}

	public function test_what_kses_would_strip_is_refused_not_dropped(): void {
		wp_set_current_user( $this->author );
		$id = self::factory()->post->create( [ 'post_author' => $this->author, 'post_content' => 'Before' ] );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'blicks/icon',
						'attributes' => [ 'icon' => 'heart' ],
					],
				],
			]
		);

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'kses', $result['errors'][0]['reason'] );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );

		// The same block from an account WordPress trusts with unfiltered HTML is written intact.
		wp_set_current_user( $this->editor );
		$this->assertTrue( $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => 'blicks/icon', 'attributes' => [ 'icon' => 'heart' ] ] ] ] )['written'] );
		$this->assertStringContainsString( '<svg', get_post_field( 'post_content', $id ) );
	}

	public function test_an_unsafe_link_is_refused_even_for_an_administrator(): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'blicks/buttons',
						'innerBlocks' => [
							[
								'name' => 'blicks/button',
								'attributes' => [
									'text' => 'Go',
									'url' => 'javascript:alert(document.cookie)',
								],
							],
						],
					],
				],
			]
		);

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'unsafe-url', $result['errors'][0]['reason'] );
	}

	public function test_a_post_open_in_someone_elses_editor_is_not_written(): void {
		if ( ! function_exists( 'wp_set_post_lock' ) ) {
			require_once ABSPATH . 'wp-admin/includes/post.php';
		}

		$id = $this->page( $this->editor, 'draft', 'Before' );
		wp_set_current_user( $this->admin );
		wp_set_post_lock( $id );

		wp_set_current_user( $this->editor );
		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => 'blicks/box' ] ] ] );

		$this->assertFalse( $result['written'] );
		$this->assertStringContainsString( 'open in the editor', $result['error'] );
	}

	public function test_an_oversized_tree_is_refused_before_it_is_validated(): void {
		wp_set_current_user( $this->editor );
		$id = $this->page( $this->editor );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => array_fill( 0, 501, [ 'name' => 'blicks/box' ] ) ] );

		$this->assertSame( 'too-large', $result['errors'][0]['reason'] );
	}

	public function test_a_core_block_round_trips_untouched_beside_blicks_ones(): void {
		wp_set_current_user( $this->editor );
		$paragraph = "<!-- wp:paragraph -->\n<p>Keep <em>me</em> \\ as-is</p>\n<!-- /wp:paragraph -->";
		$id = $this->page( $this->editor, 'draft', wp_slash( $paragraph ) );

		$read = $this->call( 'get-post-layout', [ 'id' => $id ] );
		$blocks = $read['blocks'];
		$blocks[] = [ 'name' => 'blicks/box' ];
		$this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => $blocks ] );

		$this->assertStringStartsWith( $paragraph, get_post_field( 'post_content', $id ), 'a block from another plugin is kept byte for byte' );
	}

	public function test_the_escapes_in_block_attributes_survive_the_write(): void {
		wp_set_current_user( $this->editor );
		$id = $this->page( $this->editor );

		$this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'blicks/buttons',
						'innerBlocks' => [
							[
								'name' => 'blicks/button',
								'attributes' => [
									'text' => 'Go',
									'url' => '/a?x=1&y=2',
								],
							],
						],
					],
				],
			]
		);

		// `wp_update_post()` unslashes its input; unslashed, `\u0026` would be stored as `u0026`.
		$this->assertStringContainsString( '"url":"/a?x=1\\u0026y=2"', get_post_field( 'post_content', $id ) );
	}

	// ── agent passwords ────────────────────────────────────────────────────────

	public function test_an_agent_is_an_application_password_shown_once_and_stored_hashed(): void {
		$created = Access::createAgent( $this->admin, 'cursor' );
		$stored = WP_Application_Passwords::get_user_application_password( $this->admin, $created['agent']['uuid'] );

		$this->assertSame( 'Blicks MCP · Cursor', $created['agent']['name'] );
		$this->assertNotSame( str_replace( ' ', '', $created['password'] ), $stored['password'] );
		$plain = str_replace( ' ', '', $created['password'] );
		$this->assertTrue(
			function_exists( 'wp_verify_fast_hash' ) ? wp_verify_fast_hash( $plain, $stored['password'] ) : wp_check_password( $plain, $stored['password'] )
		);
		$this->assertArrayNotHasKey( 'password', Access::agents( $this->admin )[0] );
	}

	public function test_passwords_blicks_did_not_create_cannot_be_renamed_or_revoked_here(): void {
		[ , $foreign ] = WP_Application_Passwords::create_new_application_password( $this->admin, [ 'name' => 'Backup tool' ] );
		$theirs = Access::createAgent( $this->editor, 'codex' );

		$this->assertWPError( Access::revokeAgent( $this->admin, $foreign['uuid'] ) );
		$this->assertWPError( Access::renameAgent( $this->admin, $foreign['uuid'], 'x' ) );
		$this->assertWPError( Access::revokeAgent( $this->admin, $theirs['agent']['uuid'] ), 'another account\'s agent' );
		$this->assertSame( [], Access::agents( $this->admin ) );
	}

	public function test_a_revoked_agent_is_gone(): void {
		$created = Access::createAgent( $this->admin, 'claude-code' );

		$this->assertTrue( Access::revokeAgent( $this->admin, $created['agent']['uuid'] ) );
		$this->assertNull( WP_Application_Passwords::get_user_application_password( $this->admin, $created['agent']['uuid'] ) );
	}

	// ── M1: links are judged as the browser reads them ─────────────────────────

	/** @return array<string, array{string}> */
	public static function encodedScripts(): array {
		return [
			'decimal reference' => [ 'java&#115;cript:alert(1)' ],
			'named colon' => [ 'javascript&colon;alert(1)' ],
			'leading reference' => [ '&#106;avascript:alert(1)' ],
		];
	}

	/** @dataProvider encodedScripts */
	public function test_an_encoded_javascript_link_is_refused_even_for_an_administrator( string $url ): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ $this->button( $url ) ] ] );

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'unsafe-url', $result['errors'][0]['reason'] );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );
	}

	/** @return array<string, mixed> */
	private function button( string $url ): array {
		return [
			'name' => 'blicks/buttons',
			'innerBlocks' => [
				[
					'name' => 'blicks/button',
					'attributes' => [
						'text' => 'Go',
						'url' => $url,
					],
				],
			],
		];
	}

	// ── M2: no script from an agent, whoever it signs in as ────────────────────

	/** @return array<string, array{string}> */
	public static function scriptInRichText(): array {
		return [
			'a javascript link' => [ 'Read <a href="javascript:alert(1)">this</a>' ],
			'an encoded javascript link' => [ 'Read <a href="java&#115;cript:alert(1)">this</a>' ],
			'an event handler' => [ 'Hi <img src="/a.png" onerror="alert(1)">' ],
			'a script element' => [ 'Hi <script>alert(1)</script>' ],
			'an iframe' => [ '<iframe src="https://evil.test"></iframe>' ],
		];
	}

	/** @dataProvider scriptInRichText */
	public function test_script_in_rich_text_is_refused_even_for_an_administrator( string $content ): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'blicks/text',
						'attributes' => [ 'content' => $content ],
					],
				],
			]
		);

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'unsafe-markup', $result['errors'][0]['reason'] );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );
	}

	/** @return array<string, array{string, string}> */
	public static function smuggledMarkup(): array {
		return [
			'script after the block' => [ 'core/paragraph', "<!-- wp:paragraph -->\n<p>x</p>\n<!-- /wp:paragraph --><script>alert(1)</script>" ],
			'Blicks block inside a group' => [ 'core/group', "<!-- wp:group -->\n<div class=\"wp-block-group\"><!-- wp:blicks/box /--></div>\n<!-- /wp:group -->" ],
		];
	}

	/** @dataProvider smuggledMarkup */
	public function test_markup_for_another_plugins_block_carries_only_that_block( string $name, string $markup ): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => $name, 'markup' => $markup ] ] ] );

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'invalid-markup', $result['errors'][0]['reason'] );
	}

	public function test_a_custom_html_block_cannot_carry_script(): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'core/html',
						'markup' => "<!-- wp:html -->\n<div onclick=\"steal()\">x</div>\n<!-- /wp:html -->",
					],
				],
			]
		);

		$this->assertSame( 'not-in-post', $result['errors'][0]['reason'] );
	}

	public function test_ordinary_links_icons_and_core_blocks_still_write(): void {
		wp_set_current_user( $this->admin );
		$paragraph = "<!-- wp:paragraph -->\n<p>See <a href=\"https://example.test/a?x=1&amp;y=2\">the docs</a>.</p>\n<!-- /wp:paragraph -->";
		$id = $this->page( $this->admin, 'draft', wp_slash( $paragraph ) );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'core/paragraph',
						'markup' => $paragraph,
					],
					[
						'name' => 'blicks/text',
						'attributes' => [ 'content' => 'Mail <a href="mailto:hi@example.test">us</a> or go <a href="/about#team">here</a>.' ],
					],
					[
						'name' => 'blicks/buttons',
						'innerBlocks' => [
							[
								'name' => 'blicks/button',
								'attributes' => [
									'text' => 'Go',
									'url' => 'https://example.test',
									'icon' => 'arrowRight',
								],
							],
						],
					],
				],
			]
		);

		$this->assertTrue( $result['written'], wp_json_encode( $result ) );
	}

	// ── M3: an agent password is for the MCP server only ───────────────────────

	/** Sign in as `$user` the way a request carrying this application password is. */
	private function signInWith( int $user, string $uuid ): void {
		wp_set_current_user( $user );
		$GLOBALS['wp_rest_application_password_uuid'] = $uuid;
	}

	public function test_an_agent_password_reaches_no_other_rest_route(): void {
		$agent = Access::createAgent( $this->admin, 'claude-code' );
		$this->signInWith( $this->admin, $agent['agent']['uuid'] );

		$posts = rest_get_server()->dispatch( new \WP_REST_Request( 'GET', '/wp/v2/posts' ) );
		$settings = rest_get_server()->dispatch( new \WP_REST_Request( 'POST', '/wp/v2/settings' ) );

		$this->assertSame( 403, $posts->get_status() );
		$this->assertSame( 'blicks_mcp_only', $posts->get_data()['code'] );
		$this->assertSame( 403, $settings->get_status() );
	}

	public function test_an_agent_cannot_mint_itself_a_new_password_or_flip_the_switch(): void {
		$agent = Access::createAgent( $this->admin, 'claude-code' );
		$this->signInWith( $this->admin, $agent['agent']['uuid'] );

		$mint = new \WP_REST_Request( 'POST', '/blicks/v1/mcp-access/agents' );
		$mint->set_body_params( [ 'client' => 'cursor' ] );

		$this->assertSame( 403, rest_get_server()->dispatch( $mint )->get_status() );
		$this->assertCount( 1, Access::agents( $this->admin ) );
	}

	public function test_the_admin_routes_take_a_browser_session_not_any_application_password(): void {
		[ , $other ] = WP_Application_Passwords::create_new_application_password( $this->admin, [ 'name' => 'Backup tool' ] );
		$this->signInWith( $this->admin, $other['uuid'] );

		$this->assertSame( 403, rest_get_server()->dispatch( new \WP_REST_Request( 'GET', '/blicks/v1/mcp-access' ) )->get_status() );
	}

	public function test_an_agent_password_reaches_the_mcp_route_only_while_access_is_on(): void {
		$agent = Access::createAgent( $this->admin, 'claude-code' );
		$this->signInWith( $this->admin, $agent['agent']['uuid'] );
		$provider = new McpServiceProvider();
		$mcp = new \WP_REST_Request( 'POST', '/blicks/mcp' );

		$this->assertNull( $provider->limitAgentRoutes( null, rest_get_server(), $mcp ) );

		Access::setEnabled( false );
		$this->assertWPError( $provider->limitAgentRoutes( null, rest_get_server(), $mcp ) );
	}

	public function test_other_application_passwords_are_left_alone(): void {
		[ , $other ] = WP_Application_Passwords::create_new_application_password( $this->admin, [ 'name' => 'Backup tool' ] );
		$this->signInWith( $this->admin, $other['uuid'] );

		$this->assertSame( 200, rest_get_server()->dispatch( new \WP_REST_Request( 'GET', '/wp/v2/posts' ) )->get_status() );
	}

	/** Make this a REST request for `$route`, as WordPress would have parsed it. */
	private function restRequestFor( string $route ): void {
		if ( ! defined( 'REST_REQUEST' ) ) {
			define( 'REST_REQUEST', true );
		}

		$GLOBALS['wp']->query_vars['rest_route'] = $route;
	}

	public function test_turning_access_off_stops_agents_signing_in_at_all(): void {
		add_filter( 'application_password_is_api_request', '__return_true' );
		$this->restRequestFor( '/blicks/mcp' );
		$agent = Access::createAgent( $this->admin, 'claude-code' );
		[ , $other ] = WP_Application_Passwords::create_new_application_password( $this->admin, [ 'name' => 'Backup tool' ] );
		$login = get_userdata( $this->admin )->user_login;

		$this->assertInstanceOf( \WP_User::class, wp_authenticate_application_password( null, $login, $agent['password'] ) );

		Access::setEnabled( false );
		$refused = wp_authenticate_application_password( null, $login, $agent['password'] );

		$this->assertWPError( $refused );
		$this->assertSame( 'blicks_mcp_off', $refused->get_error_code() );
		$this->assertNotSame( 'blicks_mcp_off', is_wp_error( $o = wp_authenticate_application_password( null, $login, 'wrong' ) ) ? $o->get_error_code() : '' );
		unset( $other );
	}

	// ── L1: the trash is out of reach ──────────────────────────────────────────

	public function test_a_trashed_post_can_be_neither_restored_nor_rewritten(): void {
		$id = $this->page( $this->editor, 'draft', 'Before' );
		wp_trash_post( $id );
		wp_set_current_user( $this->editor );

		$this->assertTrue( current_user_can( 'edit_post', $id ), 'WordPress itself still says yes' );
		$this->assertFalse( $this->allowed( 'set-post-status', [ 'id' => $id, 'status' => 'draft' ] ) );
		$this->assertFalse( $this->allowed( 'update-post-layout', [ 'id' => $id ] ) );
		$this->assertFalse( $this->allowed( 'get-post-layout', [ 'id' => $id ] ) );
	}

	// ── second review ──────────────────────────────────────────────────────────

	/** @return array<string, array{string}> */
	public static function foreignContent(): array {
		return [
			'img in svg title' => [ '<svg><title><img src=x onerror=alert(1)></title></svg>' ],
			'img in svg textarea' => [ '<svg><textarea><img src=x onerror=alert(1)></textarea></svg>' ],
			'img in svg noembed' => [ '<svg><noembed><img src=x onerror=alert(1)></noembed></svg>' ],
			'img in svg xmp' => [ '<svg><xmp><img src=x onerror=alert(1)></xmp></svg>' ],
			'link in svg title' => [ '<svg><title><a href="javascript:alert(1)">x</a></title></svg>' ],
			'svg foreignObject' => [ '<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>' ],
			'svg use' => [ '<svg><use href="data:image/svg+xml,x"/></svg>' ],
			'mathml' => [ '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>' ],
			'unclosed attribute' => [ 'Hi <img src=x alt="' ],
		];
	}

	/** @dataProvider foreignContent */
	public function test_markup_the_tag_processor_reads_differently_from_a_browser_is_refused( string $content ): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		foreach ( [
			[
				'name' => 'blicks/text',
				'attributes' => [ 'content' => $content ],
			],
			[
				'name' => 'core/html',
				'markup' => "<!-- wp:html -->\n" . $content . "\n<!-- /wp:html -->",
			],
		] as $block ) {
			$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ $block ] ] );

			$this->assertFalse( $result['written'], $block['name'] );
			// Agents cannot author another plugin's block at all; a Blicks block's content meets the guard.
			$this->assertSame( 'core/html' === $block['name'] ? 'not-in-post' : 'unsafe-markup', $result['errors'][0]['reason'] ?? null, $block['name'] . ': ' . wp_json_encode( $result ) );
		}

		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );
	}

	public function test_a_tag_split_across_two_blocks_is_refused(): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'core/html',
						'markup' => "<!-- wp:html -->\n<img src=x alt=\"\n<!-- /wp:html -->",
					],
					[
						'name' => 'core/html',
						'markup' => "<!-- wp:html -->\n\" onerror=alert(1) >\n<!-- /wp:html -->",
					],
				],
			]
		);

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'not-in-post', $result['errors'][0]['reason'] );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );
	}

	public function test_rich_text_cannot_forge_a_block_delimiter(): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'blicks/text',
						'attributes' => [ 'content' => 'x</p><!-- /wp:blicks/text --><!-- wp:html --><p>y' ],
					],
				],
			]
		);

		$this->assertSame( 'invalid-markup', $result['errors'][0]['reason'] );
	}

	public function test_an_agent_password_signs_in_only_for_the_mcp_route(): void {
		add_filter( 'application_password_is_api_request', '__return_true' );
		$agent = Access::createAgent( $this->admin, 'claude-code' );
		[ $otherPassword ] = WP_Application_Passwords::create_new_application_password( $this->admin, [ 'name' => 'Backup tool' ] );
		$login = get_userdata( $this->admin )->user_login;

		// Another plugin's API that accepts application passwords: no REST route to /blicks/mcp.
		$this->restRequestFor( '/graphql' );
		$refused = wp_authenticate_application_password( null, $login, $agent['password'] );

		$this->assertWPError( $refused );
		$this->assertSame( 'blicks_mcp_only', $refused->get_error_code() );
		$this->assertInstanceOf( \WP_User::class, wp_authenticate_application_password( null, $login, $otherPassword ), 'other application passwords are untouched' );

		$this->restRequestFor( '/blicks/mcp' );
		$this->assertInstanceOf( \WP_User::class, wp_authenticate_application_password( null, $login, $agent['password'] ) );
	}

	public function test_an_earlier_rest_answer_does_not_reach_an_agent(): void {
		$agent = Access::createAgent( $this->admin, 'claude-code' );
		$this->signInWith( $this->admin, $agent['agent']['uuid'] );
		$cached = new \WP_REST_Response( [ 'from' => 'cache' ] );

		$result = ( new McpServiceProvider() )->limitAgentRoutes( $cached, rest_get_server(), new \WP_REST_Request( 'GET', '/wp/v2/posts' ) );

		$this->assertWPError( $result );
		$this->assertSame( 'blicks_mcp_only', $result->get_error_code() );
	}

	// ── third review: agents author Blicks blocks only ─────────────────────────

	/** @return array<string, array{string, string}> */
	public static function authoredForeignBlocks(): array {
		return [
			// A `>` in delimiter JSON that a regex strip missed, joining text into a tag at render.
			'delimiter differential' => [ 'core/group', '<!-- wp:group --><div class="wp-block-group"><<!-- wp:spacer {"x":">"} /-->img src=x onerror=alert(document.domain)></div><!-- /wp:group -->' ],
			// A pattern override WordPress binds into a button href without a scheme check.
			'pattern override' => [ 'core/block', '<!-- wp:block {"ref":1,"content":{"CTA":{"url":"javascript:alert(1)"}}} /-->' ],
			'a harmless paragraph' => [ 'core/paragraph', "<!-- wp:paragraph -->\n<p>New text</p>\n<!-- /wp:paragraph -->" ],
		];
	}

	/** @dataProvider authoredForeignBlocks */
	public function test_an_agent_cannot_author_another_plugins_block( string $name, string $markup ): void {
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', 'Before' );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => $name, 'markup' => $markup ] ] ] );

		$this->assertFalse( $result['written'] );
		$this->assertSame( 'not-in-post', $result['errors'][0]['reason'], wp_json_encode( $result ) );
		$this->assertSame( 'Before', get_post_field( 'post_content', $id ) );
	}

	public function test_a_block_already_in_the_post_is_kept_even_if_its_html_would_not_pass(): void {
		// Written by a person in the editor, not by an agent: keeping it unchanged is the agent's
		// only option, and refusing it would make the page impossible to edit over MCP.
		$embed = "<!-- wp:html -->\n<script src=\"https://example.test/widget.js\"></script>\n<!-- /wp:html -->";
		wp_set_current_user( $this->admin );
		$id = $this->page( $this->admin, 'draft', wp_slash( $embed ) );
		$this->assertStringContainsString( '<script', get_post_field( 'post_content', $id ), 'fixture: an administrator may store a script' );

		$blocks = $this->call( 'get-post-layout', [ 'id' => $id ] )['blocks'];
		$blocks[] = [ 'name' => 'blicks/box' ];
		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => $blocks ] );

		$this->assertTrue( $result['written'], wp_json_encode( $result ) );
		$this->assertStringStartsWith( $embed, get_post_field( 'post_content', $id ) );
	}

	public function test_a_block_already_in_the_post_cannot_be_changed(): void {
		$paragraph = "<!-- wp:paragraph -->\n<p>Original</p>\n<!-- /wp:paragraph -->";
		$id = $this->page( $this->admin, 'draft', $paragraph );
		wp_set_current_user( $this->admin );

		$result = $this->call(
			'update-post-layout',
			[
				'id' => $id,
				'blocks' => [
					[
						'name' => 'core/paragraph',
						'markup' => str_replace( 'Original', 'Changed', $paragraph ),
					],
				],
			]
		);

		$this->assertSame( 'not-in-post', $result['errors'][0]['reason'] );
		$this->assertSame( $paragraph, get_post_field( 'post_content', $id ) );
	}

	public function test_a_block_from_another_post_cannot_be_copied_in(): void {
		$paragraph = "<!-- wp:paragraph -->\n<p>Elsewhere</p>\n<!-- /wp:paragraph -->";
		$this->page( $this->admin, 'draft', $paragraph );
		$id = $this->page( $this->admin );
		wp_set_current_user( $this->admin );

		$result = $this->call( 'update-post-layout', [ 'id' => $id, 'blocks' => [ [ 'name' => 'core/paragraph', 'markup' => $paragraph ] ] ] );

		$this->assertSame( 'not-in-post', $result['errors'][0]['reason'] );
	}

	public function test_a_new_draft_takes_blicks_blocks_only(): void {
		wp_set_current_user( $this->editor );

		$result = $this->call(
			'create-page',
			[
				'title' => 'From an agent',
				'blocks' => [
					[
						'name' => 'core/paragraph',
						'markup' => "<!-- wp:paragraph -->\n<p>x</p>\n<!-- /wp:paragraph -->",
					],
				],
			]
		);

		$this->assertFalse( $result['created'] );
		$this->assertSame( 'not-in-post', $result['errors'][0]['reason'] );
	}
}
