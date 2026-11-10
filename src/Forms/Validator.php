<?php
/**
 * Checks and cleans the values of a send.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates and sanitises submitted values against the **saved** field definitions
 * ({@see Schema::fields()}). Only the saved fields are read: an unknown name is dropped, and an
 * array is accepted only by a choice field that allows several.
 *
 * Every saved field of a registered type ({@see FieldTypes}) gets a cleaned value (an empty one
 * when nothing usable was sent), and every field that is missing or wrong gets its own error
 * message, the one the author wrote or {@see Schema::defaultError()}. A field whose type is not
 * registered gets neither: it is not on the page, so nothing is asked of it.
 */
final class Validator {

	public const TEXT_MAX = 500;
	public const TEXTAREA_MAX = 5000;
	public const EMAIL_MAX = 254;

	/**
	 * @param list<array<string, mixed>> $fields Saved field definitions.
	 * @param array<mixed>               $input  `name => value` as sent.
	 * @return array{values: array<string, mixed>, errors: array<string, string>}
	 */
	public static function validate( array $fields, array $input ): array {
		$values = [];
		$errors = [];

		foreach ( $fields as $field ) {
			$name = (string) ( $field['name'] ?? '' );

			if ( '' === $name ) {
				continue;
			}

			// Through the type's registered validator; a type no plugin registers is skipped.
			$result = FieldTypes::validate( $field, $input[ $name ] ?? null );

			if ( null === $result ) {
				continue;
			}

			$values[ $name ] = $result['value'];

			if ( '' !== $result['error'] ) {
				$errors[ $name ] = $result['error'];
			}
		}

		return [
			'values' => $values,
			'errors' => $errors,
		];
	}

	/**
	 * Blicks' own types' `validate` ({@see FieldTypes}): the cleaned value, and the field's error
	 * message when it fails.
	 *
	 * @param array<string, mixed> $field
	 * @return array{value: string|list<string>, error: string}
	 */
	public static function builtIn( array $field, mixed $raw ): array {
		[ $value, $ok ] = self::one( $field, $raw );
		[ $value, $ok ] = self::length( $field, $value, $ok );

		return [
			'value' => $value,
			'error' => $ok ? '' : (string) ( $field['errorMessage'] ?? '' ),
		];
	}

	/**
	 * One field: its cleaned value, and whether it passes.
	 *
	 * @param array<string, mixed> $field
	 * @return array{0: string|list<string>, 1: bool}
	 */
	private static function one( array $field, mixed $raw ): array {
		$type = (string) ( $field['type'] ?? 'text' );
		$required = true === ( $field['required'] ?? false );
		$options = array_values( array_filter( is_array( $field['options'] ?? null ) ? $field['options'] : [], 'is_string' ) );

		if ( 'choice' === $type && true === ( $field['multiple'] ?? false ) ) {
			return self::several( $raw, $options, $required );
		}

		// Arrays only where a field takes several values.
		if ( null !== $raw && ! is_scalar( $raw ) ) {
			return [ '', false ];
		}

		$text = is_bool( $raw ) ? ( $raw ? '1' : '' ) : trim( (string) $raw );

		if ( 'consent' === $type ) {
			$checked = 'yes' === strtolower( $text );

			return [ $checked ? 'Yes' : '', $checked || ! $required ];
		}

		if ( 'hidden' === $type ) {
			return [ self::cut( sanitize_text_field( $text ), self::TEXT_MAX ), true ];
		}

		if ( '' === $text ) {
			return [ '', ! $required ];
		}

		switch ( $type ) {
			case 'textarea':
				$clean = sanitize_textarea_field( $text );
				return [ self::cut( $clean, self::TEXTAREA_MAX ), '' !== $clean && mb_strlen( $clean ) <= self::TEXTAREA_MAX ];

			case 'email':
				$clean = sanitize_email( $text );
				return [ $clean, strlen( $text ) <= self::EMAIL_MAX && false !== is_email( $text ) && $clean === $text ];

			case 'tel':
				$ok = 1 === preg_match( '/^[0-9+()\-.\s]{5,30}$/', $text );
				return [ $ok ? sanitize_text_field( $text ) : self::cut( sanitize_text_field( $text ), 30 ), $ok ];

			case 'number':
				return self::number( $text, $field );

			case 'date':
				return self::date( $text, $field );

			case 'time':
				return self::time( $text, $field );

			case 'range':
				return self::range( $text, $field );

			case 'select':
			case 'choice':
				$clean = self::cut( sanitize_text_field( $text ), self::TEXT_MAX );
				return [ $clean, in_array( $text, $options, true ) ];
		}

		$clean = sanitize_text_field( $text );

		return [ self::cut( $clean, self::TEXT_MAX ), '' !== $clean && mb_strlen( $clean ) <= self::TEXT_MAX ];
	}

	/**
	 * A choice that allows several: a list, every value one of the saved options.
	 *
	 * @param list<string> $options
	 * @return array{0: list<string>, 1: bool}
	 */
	private static function several( mixed $raw, array $options, bool $required ): array {
		if ( null === $raw || '' === $raw ) {
			$raw = [];
		} elseif ( is_scalar( $raw ) ) {
			$raw = [ $raw ];
		}

		if ( ! is_array( $raw ) ) {
			return [ [], false ];
		}

		$picked = [];
		$ok = true;

		foreach ( $raw as $item ) {
			$text = is_scalar( $item ) ? trim( (string) $item ) : '';

			if ( '' === $text ) {
				continue;
			}

			if ( ! in_array( $text, $options, true ) ) {
				$ok = false;
				continue;
			}

			if ( ! in_array( $text, $picked, true ) ) {
				$picked[] = $text;
			}
		}

		return [ $picked, $ok && ( [] !== $picked || ! $required ) ];
	}

	/**
	 * @param array<string, mixed> $field
	 * @return array{0: string, 1: bool}
	 */
	private static function number( string $text, array $field ): array {
		if ( 1 !== preg_match( '/^-?\d{1,15}(\.\d{1,10})?$/', $text ) ) {
			return [ '', false ];
		}

		$value = (float) $text;
		$min = self::bound( $field['min'] ?? '' );
		$max = self::bound( $field['max'] ?? '' );
		$step = self::bound( $field['step'] ?? '' );

		if ( ( null !== $min && $value < $min ) || ( null !== $max && $value > $max ) ) {
			return [ $text, false ];
		}

		if ( null !== $step && $step > 0 ) {
			$steps = ( $value - ( $min ?? 0.0 ) ) / $step;

			if ( abs( $steps - round( $steps ) ) > 1e-9 ) {
				return [ $text, false ];
			}
		}

		return [ $text, true ];
	}

	/**
	 * The author's length limit on a text type, counted in characters: a longer value is cut to it
	 * and fails.
	 *
	 * @param array<string, mixed> $field
	 * @param string|list<string>  $value
	 * @return array{0: string|list<string>, 1: bool}
	 */
	private static function length( array $field, string|array $value, bool $ok ): array {
		$max = is_numeric( $field['maxLength'] ?? null ) ? (int) $field['maxLength'] : 0;

		if ( $max <= 0 || ! is_string( $value ) || ! in_array( (string) ( $field['type'] ?? '' ), Schema::LENGTH_TYPES, true ) ) {
			return [ $value, $ok ];
		}

		return mb_strlen( $value ) > $max ? [ mb_substr( $value, 0, $max ), false ] : [ $value, $ok ];
	}

	/**
	 * A time of day as `HH:MM`, within the field's min and max.
	 *
	 * @param array<string, mixed> $field
	 * @return array{0: string, 1: bool}
	 */
	private static function time( string $text, array $field ): array {
		if ( ! self::isTime( $text ) ) {
			return [ '', false ];
		}

		$min = (string) ( $field['min'] ?? '' );
		$max = (string) ( $field['max'] ?? '' );
		$min = self::isTime( $min ) ? $min : '';
		$max = self::isTime( $max ) ? $max : '';

		// HH:MM sorts as text.
		$ok = ( '' === $min || strcmp( $text, $min ) >= 0 ) && ( '' === $max || strcmp( $text, $max ) <= 0 );

		return [ $text, $ok ];
	}

	private static function isTime( string $text ): bool {
		return 1 === preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $text );
	}

	/**
	 * A slider's value: a number within its min and max (0 to 100 when unset), on its step (1).
	 *
	 * @param array<string, mixed> $field
	 * @return array{0: string, 1: bool}
	 */
	private static function range( string $text, array $field ): array {
		$step = (string) ( $field['step'] ?? '' );

		return self::number(
			$text,
			[
				'min' => self::bound( $field['min'] ?? '' ) ?? 0,
				'max' => self::bound( $field['max'] ?? '' ) ?? 100,
				'step' => 'any' === $step ? '' : ( self::bound( $step ) ?? 1 ),
			]
		);
	}

	/**
	 * @param array<string, mixed> $field
	 * @return array{0: string, 1: bool}
	 */
	private static function date( string $text, array $field ): array {
		if ( ! self::isDate( $text ) ) {
			return [ '', false ];
		}

		$min = self::day( (string) ( $field['min'] ?? '' ) );
		$max = self::day( (string) ( $field['max'] ?? '' ) );

		// Y-m-d sorts as text.
		$ok = ( '' === $min || strcmp( $text, $min ) >= 0 ) && ( '' === $max || strcmp( $text, $max ) <= 0 );

		return [ $text, $ok ];
	}

	/** A date bound as Y-m-d: `today` in the site's timezone, '' when unset or invalid. */
	private static function day( string $bound ): string {
		if ( 'today' === $bound ) {
			return (string) wp_date( 'Y-m-d' );
		}

		return self::isDate( $bound ) ? $bound : '';
	}

	private static function isDate( string $text ): bool {
		if ( 1 !== preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $text, $m ) ) {
			return false;
		}

		return checkdate( (int) $m[2], (int) $m[3], (int) $m[1] );
	}

	private static function bound( mixed $value ): ?float {
		if ( is_int( $value ) || is_float( $value ) ) {
			return (float) $value;
		}

		return is_string( $value ) && '' !== $value && is_numeric( $value ) ? (float) $value : null;
	}

	private static function cut( string $text, int $max ): string {
		return mb_strlen( $text ) > $max ? mb_substr( $text, 0, $max ) : $text;
	}
}
