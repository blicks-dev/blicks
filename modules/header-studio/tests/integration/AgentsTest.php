<?php
/**
 * Headers for agents: patterns, the two header tools, and the layout tools on header parts.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio\Tests;

use Blicks\Ai\Abilities\McpServer;
use Blicks\Mcp\Posts;
use BlicksPro\HeaderStudio\Agents;
use BlicksPro\HeaderStudio\Patterns;
use WP_UnitTestCase;

require_once dirname( __DIR__ ) . '/support.php';

final class AgentsTest extends WP_UnitTestCase {

	private Agents $agents;

	public function set_up(): void {
		parent::set_up();
		$this->agents = new Agents( new Patterns( dirname( __DIR__, 2 ) ) );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}

	public function test_each_layout_is_a_header_pattern(): void {
		$patterns = new Patterns( dirname( __DIR__, 2 ) );

		foreach ( Patterns::LAYOUTS as $layout ) {
			$this->assertStringStartsWith( '<!-- wp:blicks/header', $patterns->markup( $layout ) );
		}

		$this->assertSame( '', $patterns->markup( '../../wp-config' ) );
	}

	public function test_a_new_header_is_a_header_part_with_a_post_id(): void {
		$made = $this->agents->create(
			[
				'title' => 'Shop header',
				'layout' => 'centred',
			]
		);

		$this->assertIsArray( $made );
		$this->assertTrue( $made['created'] );
		$this->assertSame( get_stylesheet() . '//shop-header', $made['id'] );

		$part = get_block_template( $made['id'], 'wp_template_part' );
		$this->assertSame( 'header', $part->area );
		$this->assertStringContainsString( 'bl-header-row--centred', $part->content );
		$this->assertSame( $made['postId'], Agents::postId( $made['id'] ) );

		$again = $this->agents->create( [ 'title' => 'Shop header' ] );
		$this->assertSame( get_stylesheet() . '//shop-header-2', $again['id'] );
	}

	public function test_copying_a_part_twice_answers_the_same_copy(): void {
		$made = $this->agents->create( [ 'title' => 'Main' ] );
		$copy = $this->agents->create(
			[
				'title' => 'Main',
				'copyOf' => $made['id'],
			]
		);

		$this->assertFalse( $copy['created'] );
		$this->assertSame( $made['postId'], $copy['postId'] );
	}

	public function test_a_copy_keeps_its_slug_when_another_theme_has_the_same_part(): void {
		$other = self::factory()->post->create(
			[
				'post_type' => 'wp_template_part',
				'post_name' => 'top',
				'post_status' => 'publish',
			]
		);
		wp_set_post_terms( $other, 'another-theme', 'wp_theme' );

		$made = $this->agents->create( [ 'title' => 'Top' ] );

		$this->assertSame( get_stylesheet() . '//top', $made['id'] );
	}

	public function test_bad_input_is_refused_by_name(): void {
		$this->assertWPError( $this->agents->create( [] ) );
		$this->assertWPError( $this->agents->create( [ 'title' => 'X', 'layout' => 'sideways' ] ) );
		$this->assertWPError( $this->agents->create( [ 'title' => 'X', 'copyOf' => 'nope//nothing' ] ) );
	}

	public function test_header_parts_open_to_the_layout_tools_and_the_tools_to_the_server(): void {
		$this->assertContains( 'wp_template_part', Agents::postTypes( [ 'page' ] ) );
		$this->assertSame( [ 'a/b', Agents::LIST, Agents::CREATE ], Agents::tools( [ 'a/b' ] ) );

		if ( ! has_filter( 'blicks_mcp_post_types', [ Agents::class, 'postTypes' ] ) ) {
			add_filter( 'blicks_mcp_post_types', [ Agents::class, 'postTypes' ] );
		}

		$this->assertTrue( Posts::isAllowedType( 'wp_template_part' ) );
		$this->assertIsArray( McpServer::tools() );
	}

	public function test_the_list_gives_post_ids_for_saved_parts(): void {
		if ( ! wp_get_theme( 'twentytwentyfive' )->exists() ) {
			$this->markTestSkipped( 'Needs a block theme.' );
		}

		$theme = get_stylesheet();
		switch_theme( 'twentytwentyfive' );
		$made = $this->agents->create( [ 'title' => 'Listed' ] );
		$rows = array_column( $this->agents->list()['headers'], null, 'id' );

		$this->assertSame( $made['postId'], $rows[ $made['id'] ]['postId'] );
		$this->assertTrue( $rows[ $made['id'] ]['studio'] );
		$this->assertArrayHasKey( 'twentytwentyfive//header', $rows );
		$this->assertNull( $rows['twentytwentyfive//header']['postId'] );

		switch_theme( $theme );
	}
}
