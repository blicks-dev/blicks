<?php
/**
 * The Field types a Form knows, and how each is drawn, checked and shown.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The registry every Field type goes through, Blicks' own included.
 *
 * A type is **registered** when it is in the `blicks_form_field_types` list. Each registered type
 * has three callbacks, read from the `blicks_form_field_type_{type}` filter:
 *
 *   render   ( array $field, string $inner, ?\WP_Block $block, array $attributes ): string
 *            The Field's front-end markup. `$inner` is its inner blocks, rendered. The callback
 *            escapes what it writes. `$attributes` are the Field block's raw attributes.
 *   validate ( array $field, mixed $raw ): array{value: mixed, error: string}
 *            The cleaned value to store and the error to show ('' when it passes). `$raw` is what
 *            the request sent under the field's name, null when nothing was.
 *   display  ( array $field, mixed $value ): string
 *            A stored value as one line of plain text, for Blicks › Entries, the email and the
 *            CSV. The caller escapes it.
 *
 * A Field whose type is not registered — a companion's type with the companion off — renders
 * nothing, is not validated (no value, no error) and so never reaches an entry. Values already
 * stored under such a type are shown as plain text.
 */
final class FieldTypes {

	/**
	 * Every registered type, Blicks' own first.
	 *
	 * @return list<string>
	 */
	public static function types(): array {
		/**
		 * The Field types a Form accepts. Add a type here and supply its callbacks through
		 * `blicks_form_field_type_{type}`; a saved Field of a type not in this list renders
		 * nothing and sends nothing.
		 *
		 * @param list<string> $types Blicks' own types ({@see Schema::TYPES}).
		 */
		$types = apply_filters( 'blicks_form_field_types', Schema::TYPES );
		$out = [];

		foreach ( is_array( $types ) ? $types : [] as $type ) {
			$type = is_string( $type ) ? sanitize_key( $type ) : '';

			if ( '' !== $type && ! in_array( $type, $out, true ) ) {
				$out[] = $type;
			}
		}

		return $out;
	}

	public static function registered( string $type ): bool {
		return '' !== $type && in_array( $type, self::types(), true );
	}

	public static function builtIn( string $type ): bool {
		return in_array( $type, Schema::TYPES, true );
	}

	/**
	 * A registered type's callbacks, each one callable; null for a type that is not registered.
	 * A callback a companion leaves out is missing from the result.
	 *
	 * @return array{render?: callable, validate?: callable, display?: callable}|null
	 */
	public static function callbacks( string $type ): ?array {
		if ( ! self::registered( $type ) ) {
			return null;
		}

		$defaults = self::builtIn( $type )
			? [
				'render' => [ FieldRenderer::class, 'builtIn' ],
				'validate' => [ Validator::class, 'builtIn' ],
				'display' => [ self::class, 'text' ],
			]
			: [];

		/**
		 * How one Field type is drawn, checked and shown. The dynamic part is the type, e.g.
		 * `blicks_form_field_type_rating`. Blicks' own types pass their callbacks in, so a
		 * companion can replace one (say, `display`) and keep the others.
		 *
		 * @param array{render?: callable, validate?: callable, display?: callable} $callbacks
		 *        render   ( array $field, string $inner, ?WP_Block $block, array $attributes ): string
		 *        validate ( array $field, mixed $raw ): array{value: mixed, error: string}
		 *        display  ( array $field, mixed $value ): string
		 * @param string $type The type.
		 */
		$callbacks = apply_filters( "blicks_form_field_type_{$type}", $defaults, $type );
		$out = [];

		foreach ( [ 'render', 'validate', 'display' ] as $key ) {
			if ( is_array( $callbacks ) && isset( $callbacks[ $key ] ) && is_callable( $callbacks[ $key ] ) ) {
				$out[ $key ] = $callbacks[ $key ];
			}
		}

		return $out;
	}

	/**
	 * A Field's front-end markup through its type's `render`; '' when the type is not registered
	 * or has no renderer.
	 *
	 * @param array<string, mixed> $field      {@see Schema::field()}.
	 * @param array<string, mixed> $attributes The Field block's attributes.
	 */
	public static function render( array $field, string $inner, mixed $block, array $attributes ): string {
		$render = self::callbacks( (string) ( $field['type'] ?? '' ) )['render'] ?? null;

		if ( null === $render ) {
			return '';
		}

		$html = call_user_func( $render, $field, $inner, $block instanceof \WP_Block ? $block : null, $attributes );

		return is_string( $html ) ? $html : '';
	}

	/**
	 * One value through its type's `validate`; null when the field is not checked at all (its
	 * type is not registered or has no validator), so it gets no value and no error.
	 *
	 * @param array<string, mixed> $field
	 * @return array{value: mixed, error: string}|null
	 */
	public static function validate( array $field, mixed $raw ): ?array {
		$validate = self::callbacks( (string) ( $field['type'] ?? '' ) )['validate'] ?? null;

		if ( null === $validate ) {
			return null;
		}

		$result = call_user_func( $validate, $field, $raw );

		if ( ! is_array( $result ) ) {
			return [
				'value' => '',
				'error' => (string) ( $field['errorMessage'] ?? '' ),
			];
		}

		$error = $result['error'] ?? '';

		return [
			'value' => $result['value'] ?? '',
			'error' => is_scalar( $error ) ? (string) $error : '',
		];
	}

	/**
	 * A stored value as one line of plain text, through the type's `display` and then
	 * `blicks_entry_display`. A type that is not registered (or has no `display`) shows as text.
	 *
	 * @param array<string, mixed>      $field Its definition: at least name, type and label.
	 * @param array<string, mixed>|null $entry The entry ({@see Entries::get()}), null before one is stored.
	 */
	public static function display( array $field, mixed $value, ?array $entry = null ): string {
		$callback = self::callbacks( (string) ( $field['type'] ?? '' ) )['display'] ?? [ self::class, 'text' ];
		$display = call_user_func( $callback, $field, $value );
		$display = is_scalar( $display ) ? (string) $display : self::text( $field, $value );

		/**
		 * One value as Blicks › Entries, the email and the CSV show it: plain text, escaped where it
		 * is written.
		 *
		 * @param string                    $display What the type's `display` returned.
		 * @param mixed                     $value   The stored value.
		 * @param array<string, mixed>      $field   The field's definition at send time.
		 * @param array<string, mixed>|null $entry   The entry, null when it is not stored (yet).
		 */
		$display = apply_filters( 'blicks_entry_display', $display, $value, $field, $entry );

		return is_scalar( $display ) ? (string) $display : '';
	}

	/**
	 * Built-in display: a value as one line, a list joined with commas.
	 *
	 * @param array<string, mixed> $field
	 */
	public static function text( array $field, mixed $value ): string {
		unset( $field );

		if ( is_array( $value ) ) {
			return implode( ', ', array_map( static fn ( $v ): string => is_scalar( $v ) ? (string) $v : '', $value ) );
		}

		return is_scalar( $value ) ? (string) $value : '';
	}
}
