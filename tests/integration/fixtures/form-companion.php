<?php
/**
 * A pretend companion plugin for the Form's extension points. Loaded only by
 * FormExtensionPointsTest; it uses nothing but the public hooks a real companion would.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Fixtures;

/**
 * Registers a `rating` field type, a `fixture/step` block a Form may hold, a `pending` entry
 * status and a filter on each step of a send, noting the order the send hooks run in.
 */
final class FormCompanion {

	/** @var list<string> The send hooks, in the order they ran. */
	public static array $calls = [];

	public static function boot(): void {
		self::$calls = [];

		add_filter(
			'blicks_form_field_types',
			static fn ( array $types ): array => array_merge( $types, [ 'rating' ] )
		);
		add_filter( 'blicks_form_field_type_rating', [ self::class, 'rating' ] );

		add_filter(
			'blicks_form_allowed_blocks',
			static fn ( array $blocks ): array => array_merge( $blocks, [ 'fixture/step' ] )
		);

		if ( ! \WP_Block_Type_Registry::get_instance()->is_registered( 'fixture/step' ) ) {
			register_block_type(
				'fixture/step',
				[
					'render_callback' => static fn ( array $attrs, string $content ): string => '<div class="fx-step">' . $content . '</div>',
				]
			);
		}

		add_filter(
			'blicks_entry_statuses',
			static fn ( array $statuses ): array => $statuses + [ 'pending' => 'Pending' ]
		);

		add_filter( 'blicks_form_values', [ self::class, 'values' ], 10, 2 );
		add_filter( 'blicks_form_errors', [ self::class, 'errors' ], 10, 3 );
		add_filter( 'blicks_form_entry', [ self::class, 'entry' ], 10, 2 );
		add_action( 'blicks_form_sent', [ self::class, 'sent' ], 10, 3 );
		add_filter( 'blicks_form_response', [ self::class, 'response' ], 10, 3 );
	}

	public static function shutdown(): void {
		if ( \WP_Block_Type_Registry::get_instance()->is_registered( 'fixture/step' ) ) {
			unregister_block_type( 'fixture/step' );
		}
	}

	/**
	 * @param array<string, callable> $callbacks
	 * @return array<string, callable>
	 */
	public static function rating( array $callbacks ): array {
		return $callbacks + [
			'render' => static function ( array $field, string $inner ): string {
				return '<div class="fx-rating" data-bl-field="' . esc_attr( $field['name'] ) . '">'
					. '<span>' . esc_html( $field['label'] ) . '</span>'
					. '<input type="number" name="' . esc_attr( $field['name'] ) . '" min="1" max="5">'
					. $inner . '</div>';
			},
			'validate' => static function ( array $field, mixed $raw ): array {
				if ( null === $raw || '' === $raw ) {
					return [
						'value' => '',
						'error' => $field['required'] ? 'Pick a rating.' : '',
					];
				}

				$ok = is_numeric( $raw ) && (int) $raw >= 1 && (int) $raw <= 5 && (string) (int) $raw === (string) $raw;

				return [
					'value' => $ok ? (int) $raw : '',
					'error' => $ok ? '' : 'Pick 1 to 5 stars.',
				];
			},
			'display' => static fn ( array $field, mixed $value ): string => is_int( $value ) ? $value . ' / 5' : '',
		];
	}

	/**
	 * @param array<string, mixed> $values
	 * @param array<string, mixed> $form
	 * @return array<string, mixed>
	 */
	public static function values( array $values, array $form ): array {
		self::$calls[] = 'values';
		unset( $form );

		// Logic would drop a hidden value here.
		unset( $values['dropme'] );

		return $values;
	}

	/**
	 * @param array<string, string> $errors
	 * @param array<string, mixed>  $values
	 * @param array<string, mixed>  $form
	 * @return array<string, string>
	 */
	public static function errors( array $errors, array $values, array $form ): array {
		self::$calls[] = 'errors';
		unset( $form );

		if ( 'Mallory' === ( $values['name'] ?? '' ) ) {
			$errors['name'] = 'Not you again.';
		}

		return $errors;
	}

	/**
	 * @param array<string, mixed> $entry
	 * @param array<string, mixed> $form
	 * @return array<string, mixed>
	 */
	public static function entry( array $entry, array $form ): array {
		self::$calls[] = 'entry';
		unset( $form );

		if ( 'new' === $entry['status'] ) {
			$entry['status'] = 'pending';
		}

		return $entry;
	}

	/**
	 * @param array<string, mixed> $form
	 * @param array<string, mixed> $values
	 */
	public static function sent( int $entryId, array $form, array $values ): void {
		unset( $entryId, $form, $values );
		self::$calls[] = 'sent';
	}

	/**
	 * @param array<string, mixed> $response
	 * @param array<string, mixed> $form
	 * @return array<string, mixed>
	 */
	public static function response( array $response, int $entryId, array $form ): array {
		self::$calls[] = 'response';
		unset( $form, $response['status'] );

		return $response + [ 'next' => 'entry-' . $entryId ];
	}
}
