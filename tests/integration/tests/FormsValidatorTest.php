<?php
/**
 * Values are checked and cleaned by the saved field's type.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Schema;
use Blicks\Forms\Validator;
use WP_UnitTestCase;

final class FormsValidatorTest extends WP_UnitTestCase {

	/** @param array<string, mixed> $attrs */
	private function check( array $attrs, mixed $value ): array {
		$field = Schema::field( $attrs + [ 'name' => 'f' ] );
		$result = Validator::validate( [ $field ], null === $value ? [] : [ 'f' => $value ] );

		return [ $result['values']['f'] ?? null, ! isset( $result['errors']['f'] ), $result['errors']['f'] ?? '' ];
	}

	public function test_required_and_its_message(): void {
		[ , $ok, $error ] = $this->check(
			[
				'type' => 'text',
				'required' => true,
				'errorMessage' => 'Tell us your name.',
			],
			'   '
		);

		$this->assertFalse( $ok );
		$this->assertSame( 'Tell us your name.', $error );

		[ $value, $ok ] = $this->check( [ 'type' => 'text' ], null );
		$this->assertTrue( $ok );
		$this->assertSame( '', $value );
	}

	public function test_text_is_sanitised_and_capped(): void {
		[ $value, $ok ] = $this->check( [ 'type' => 'text' ], '<b>Ada</b> <script>x</script>' );
		$this->assertTrue( $ok );
		$this->assertSame( 'Ada', $value );

		[ , $ok ] = $this->check( [ 'type' => 'text' ], str_repeat( 'a', 501 ) );
		$this->assertFalse( $ok );

		[ $value, $ok ] = $this->check( [ 'type' => 'textarea' ], "Line one\nLine two" );
		$this->assertTrue( $ok );
		$this->assertSame( "Line one\nLine two", $value );

		[ , $ok ] = $this->check( [ 'type' => 'textarea' ], str_repeat( 'a', 5001 ) );
		$this->assertFalse( $ok );
	}

	public function test_arrays_only_where_a_field_takes_several(): void {
		[ $value, $ok ] = $this->check( [ 'type' => 'text' ], [ 'a', 'b' ] );
		$this->assertFalse( $ok );
		$this->assertSame( '', $value );
	}

	public function test_email(): void {
		$this->assertTrue( $this->check( [ 'type' => 'email' ], 'ada@example.com' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'email' ], 'not an email' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'email' ], "ada@example.com\r\nBcc: x@y.z" )[1] );
	}

	public function test_tel(): void {
		$this->assertTrue( $this->check( [ 'type' => 'tel' ], '+1 (555) 010-0000' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'tel' ], 'call me' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'tel' ], '123' )[1] );
	}

	public function test_number_bounds_and_step(): void {
		$attrs = [
			'type' => 'number',
			'min' => '1',
			'max' => '10',
			'step' => '0.5',
		];

		$this->assertTrue( $this->check( $attrs, '2.5' )[1] );
		$this->assertFalse( $this->check( $attrs, '2.3' )[1] );
		$this->assertFalse( $this->check( $attrs, '0' )[1] );
		$this->assertFalse( $this->check( $attrs, '11' )[1] );
		$this->assertFalse( $this->check( $attrs, '1e2' )[1] );
		$this->assertFalse( $this->check( $attrs, 'five' )[1] );
	}

	public function test_date_format_and_bounds(): void {
		$this->assertTrue( $this->check( [ 'type' => 'date' ], '2026-02-28' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'date' ], '2026-02-30' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'date' ], '28/02/2026' )[1] );

		$today = wp_date( 'Y-m-d' );
		$yesterday = wp_date( 'Y-m-d', time() - DAY_IN_SECONDS );
		$future = [
			'type' => 'date',
			'min' => 'today',
		];

		$this->assertTrue( $this->check( $future, $today )[1] );
		$this->assertFalse( $this->check( $future, $yesterday )[1] );
		$this->assertFalse(
			$this->check(
				[
					'type' => 'date',
					'max' => '2020-01-01',
				],
				'2020-01-02'
			)[1]
		);
	}

	public function test_select_and_single_choice_take_only_saved_options(): void {
		foreach ( [ 'select', 'choice' ] as $type ) {
			$attrs = [
				'type' => $type,
				'options' => [ 'Morning', 'Evening' ],
			];

			$this->assertTrue( $this->check( $attrs, 'Morning' )[1], $type );
			$this->assertFalse( $this->check( $attrs, 'Midnight' )[1], $type );
			$this->assertFalse( $this->check( $attrs, [ 'Morning' ] )[1], $type );
		}
	}

	public function test_several_choices_are_a_subset(): void {
		$attrs = [
			'type' => 'choice',
			'multiple' => true,
			'options' => [ 'A', 'B', 'C' ],
			'required' => true,
		];

		[ $value, $ok ] = $this->check( $attrs, [ 'A', 'C', 'A' ] );
		$this->assertTrue( $ok );
		$this->assertSame( [ 'A', 'C' ], $value );

		$this->assertFalse( $this->check( $attrs, [ 'A', 'Z' ] )[1] );
		$this->assertFalse( $this->check( $attrs, [] )[1] );
		$this->assertFalse( $this->check( $attrs, [ [ 'A' ] ] )[1] );
	}

	public function test_consent(): void {
		$attrs = [
			'type' => 'consent',
			'required' => true,
		];

		$this->assertSame( [ 'Yes', true ], array_slice( $this->check( $attrs, 'yes' ), 0, 2 ) );
		$this->assertFalse( $this->check( $attrs, '' )[1] );
		$this->assertFalse( $this->check( $attrs, 'no' )[1] );
		$this->assertSame( [ '', true ], array_slice( $this->check( [ 'type' => 'consent' ], null ), 0, 2 ) );
	}

	public function test_hidden_is_text_and_never_fails(): void {
		[ $value, $ok ] = $this->check( [ 'type' => 'hidden' ], str_repeat( 'x', 600 ) . '<i>' );
		$this->assertTrue( $ok );
		$this->assertSame( 500, mb_strlen( $value ) );
	}

	public function test_unknown_names_are_dropped(): void {
		$fields = [ Schema::field( [ 'type' => 'text', 'name' => 'name' ] ) ];
		$result = Validator::validate(
			$fields,
			[
				'name' => 'Ada',
				'role' => 'admin',
			]
		);

		$this->assertSame( [ 'name' => 'Ada' ], $result['values'] );
	}

	public function test_time_format_and_bounds(): void {
		$this->assertSame( [ '09:30', true ], array_slice( $this->check( [ 'type' => 'time' ], '09:30' ), 0, 2 ) );
		foreach ( [ '24:00', '9:30', '09:60', '09:30:00', 'noon' ] as $bad ) {
			[ , $ok ] = $this->check( [ 'type' => 'time' ], $bad );
			$this->assertFalse( $ok, $bad );
		}

		$bounds = [ 'type' => 'time', 'min' => '09:00', 'max' => '17:30', 'errorMessage' => 'Office hours only.' ];
		$this->assertTrue( $this->check( $bounds, '17:30' )[1] );
		[ , $ok, $error ] = $this->check( $bounds, '08:59' );
		$this->assertFalse( $ok );
		$this->assertSame( 'Office hours only.', $error );
		$this->assertFalse( $this->check( $bounds, '17:31' )[1] );
		$this->assertSame( 'Pick a time.', $this->check( [ 'type' => 'time', 'required' => true ], '' )[2] );
	}

	public function test_range_defaults_to_0_to_100_by_1(): void {
		$this->assertSame( [ '50', true ], array_slice( $this->check( [ 'type' => 'range' ], '50' ), 0, 2 ) );
		$this->assertFalse( $this->check( [ 'type' => 'range' ], '101' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'range' ], '-1' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'range' ], '2.5' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'range' ], 'lots' )[1] );
		$this->assertTrue( $this->check( [ 'type' => 'range' ], null )[1] );
	}

	public function test_range_bounds_and_step(): void {
		$field = [ 'type' => 'range', 'min' => '150', 'max' => '1500', 'step' => '50', 'errorMessage' => 'Pick a budget.' ];

		$this->assertTrue( $this->check( $field, '1500' )[1] );
		$this->assertTrue( $this->check( $field, '200' )[1] );
		[ , $ok, $error ] = $this->check( $field, '175' );
		$this->assertFalse( $ok );
		$this->assertSame( 'Pick a budget.', $error );
		$this->assertFalse( $this->check( $field, '100' )[1] );
		$this->assertTrue( $this->check( [ 'type' => 'range', 'step' => 'any' ], '2.5' )[1] );
	}

	public function test_max_length_counts_characters(): void {
		$field = [ 'type' => 'text', 'maxLength' => '5', 'errorMessage' => 'Five at most.' ];

		$this->assertSame( [ 'héllo', true ], array_slice( $this->check( $field, 'héllo' ), 0, 2 ) );
		[ $value, $ok, $error ] = $this->check( $field, 'héllo!' );
		$this->assertFalse( $ok );
		$this->assertSame( 'héllo', $value );
		$this->assertSame( 'Five at most.', $error );

		$this->assertFalse( $this->check( [ 'type' => 'textarea', 'maxLength' => '3' ], 'abcd' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'email', 'maxLength' => '5' ], 'a@b.co' )[1] );
		$this->assertFalse( $this->check( [ 'type' => 'tel', 'maxLength' => '5' ], '123456' )[1] );
		// Not a length type: the limit is not read.
		$this->assertTrue( $this->check( [ 'type' => 'number', 'maxLength' => '1' ], '123' )[1] );
		$this->assertTrue( $this->check( [ 'type' => 'text', 'maxLength' => '' ], str_repeat( 'a', 400 ) )[1] );
	}
}
