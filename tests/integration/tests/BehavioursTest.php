<?php
/**
 * The front-end behaviour registry: script modules, loaded only where a block uses one.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Behaviours\Behaviours;
use WP_UnitTestCase;

final class BehavioursTest extends WP_UnitTestCase {

	public function tear_down(): void {
		remove_all_filters( 'blicks_behaviours' );
		Behaviours::reset();
		parent::tear_down();
	}

	public function test_a_companion_adds_a_behaviour_and_bad_entries_are_dropped(): void {
		add_filter(
			'blicks_behaviours',
			static fn ( array $b ): array => $b + [
				'countdown' => [ 'src' => 'https://example.test/countdown.js', 'version' => '1.0.0', 'deps' => [ '@example/clock' ] ],
				'Bad Name' => [ 'src' => 'https://example.test/x.js' ],
				'no-src' => [ 'version' => '1' ],
			]
		);
		Behaviours::reset();

		$all = Behaviours::all();

		$this->assertArrayHasKey( 'countdown', $all );
		$this->assertSame( [ '@wordpress/interactivity', '@example/clock' ], $all['countdown']['deps'] );
		$this->assertArrayNotHasKey( 'Bad Name', $all );
		$this->assertArrayNotHasKey( 'no-src', $all );
	}

	public function test_only_registered_blicks_namespaces_count_as_used(): void {
		add_filter( 'blicks_behaviours', static fn ( array $b ): array => $b + [ 'countdown' => [ 'src' => 'https://example.test/c.js' ] ] );
		Behaviours::reset();

		$html = '<div data-wp-interactive="blicks/countdown"></div><div data-wp-interactive=\'blicks/unknown\'></div><div data-wp-interactive="core/image"></div>';

		$this->assertSame( [ 'countdown' ], Behaviours::used( $html ) );
		$this->assertSame( [], Behaviours::used( '<p>No directives</p>' ) );
	}

	public function test_a_namespaced_call_from_another_region_counts_as_used(): void {
		$html = '<li data-wp-interactive="blicks/disclosure" data-wp-on--pointerenter="blicks/hover-intent::actions.enter"></li><p data-wp-text="blicks/nope::state.x"></p>';

		$this->assertSame( [ 'disclosure', 'hover-intent' ], Behaviours::used( $html ) );
	}

	public function test_enqueue_refuses_an_unknown_behaviour(): void {
		$this->assertFalse( Behaviours::enqueue( 'nope' ) );
		$this->assertSame( '@blicks/dialog', Behaviours::moduleId( 'dialog' ) );
	}
}
