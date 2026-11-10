<?php
/**
 * The Form and Field blocks' vocabulary, read from saved blocks.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * What a saved Form says. The PHP mirror of `resources/blocks/field/model.ts` and
 * `resources/blocks/form/model.ts`: every value added there is added here.
 *
 * The server acts only on what this class reads out of a **saved** block — who is emailed, which
 * fields exist, which are required, which options are allowed. A submit request supplies values,
 * never definitions.
 */
final class Schema {

	/**
	 * Blicks' own Field types. The full list, with companions' types, is
	 * {@see FieldTypes::types()} (`blicks_form_field_types`).
	 */
	public const TYPES = [ 'text', 'textarea', 'email', 'tel', 'number', 'date', 'time', 'range', 'select', 'choice', 'consent', 'hidden' ];

	/** Width → columns of the Form's 6-column grid. */
	public const WIDTHS = [
		'full' => 6,
		'two' => 4,
		'half' => 3,
		'third' => 2,
	];

	public const LOOKS = [ 'filled', 'outlined', 'line' ];
	public const LABELS = [ 'above', 'inside', 'hidden' ];

	/** How a Form marks fields: (optional), *, both, neither. */
	public const MARKERS = [ 'optional', 'required', 'both', 'none' ];

	/** How a type may be drawn; the first is the default (stored as ''). */
	public const APPEARANCES = [
		'choice' => [ 'list', 'chips', 'cards', 'segmented' ],
		'consent' => [ 'box', 'switch' ],
		'number' => [ 'field', 'stepper' ],
	];

	/** Types with a length limit. */
	public const LENGTH_TYPES = [ 'text', 'textarea', 'email', 'tel' ];
	public const AFTER = [ 'message', 'page', 'dialog' ];
	public const CHALLENGES = [ 'none', 'recaptcha-v3', 'recaptcha-v2', 'turnstile' ];

	/** The submit request's own keys; a field named one of these gets `_field` appended. */
	public const RESERVED = [ 'form', 'post', 'token', 'fields', 'hp', 'challenge', 'page', 'action' ];

	/** Hidden-field defaults the browser fills (a cached page cannot know them). */
	public const CLIENT_TOKENS = [ '{referrer}', '{utm_source}', '{utm_medium}', '{utm_campaign}', '{utm_term}', '{utm_content}' ];

	/** Hidden-field defaults filled when the page renders. */
	public const SERVER_TOKENS = [ '{page}', '{url}', '{title}' ];

	public const FORM_BLOCK = 'blicks/form';
	public const FIELD_BLOCK = 'blicks/field';

	/** True for a name entries and requests may use. */
	public static function isName( string $name ): bool {
		return 1 === preg_match( '/^[a-z][a-z0-9_]{0,39}$/', $name ) && ! in_array( $name, self::RESERVED, true );
	}

	/**
	 * A Field block's attributes, cleaned.
	 *
	 * @param array<string, mixed> $attrs
	 * @return array{uid: string, type: string, name: string, label: string, placeholder: string, help: string, required: bool, errorMessage: string, width: string, options: list<string>, multiple: bool, min: string, max: string, step: string, defaultValue: string}
	 */
	public static function field( array $attrs ): array {
		$type = self::type( $attrs['type'] ?? null );
		$label = self::text( $attrs['label'] ?? '' );
		$name = is_string( $attrs['name'] ?? null ) ? $attrs['name'] : '';
		$options = [];

		foreach ( is_array( $attrs['options'] ?? null ) ? $attrs['options'] : [] as $option ) {
			$option = is_scalar( $option ) ? trim( wp_strip_all_tags( (string) $option ) ) : '';
			if ( '' !== $option && ! in_array( $option, $options, true ) ) {
				$options[] = $option;
			}
		}

		$error = self::text( $attrs['errorMessage'] ?? '' );

		return [
			'uid' => self::uid( $attrs['uniqueId'] ?? '' ),
			'type' => $type,
			'name' => self::isName( $name ) ? $name : '',
			'label' => $label,
			'placeholder' => self::text( $attrs['placeholder'] ?? '' ),
			'help' => self::text( $attrs['help'] ?? '' ),
			'required' => 'hidden' !== $type && true === ( $attrs['required'] ?? false ),
			'errorMessage' => '' !== $error ? $error : self::defaultError( $type, $label ),
			'width' => 'consent' === $type ? 'full' : self::pick( $attrs['width'] ?? null, array_keys( self::WIDTHS ), 'full' ),
			'options' => $options,
			'multiple' => 'choice' === $type && true === ( $attrs['multiple'] ?? false ),
			'min' => self::text( $attrs['min'] ?? '' ),
			'max' => self::text( $attrs['max'] ?? '' ),
			'step' => self::text( $attrs['step'] ?? '' ),
			'defaultValue' => self::text( $attrs['defaultValue'] ?? '' ),
			'maxLength' => in_array( $type, self::LENGTH_TYPES, true ) && is_numeric( $attrs['maxLength'] ?? null ) ? max( 0, min( 100000, (int) $attrs['maxLength'] ) ) : 0,
			'optionNotes' => self::notes( $attrs, $options ),
			'appearance' => self::appearance( $type, $attrs['appearance'] ?? null ),
			'prefix' => self::text( $attrs['prefix'] ?? '' ),
			'suffix' => self::text( $attrs['suffix'] ?? '' ),
			'extensions' => self::extensions( $attrs ),
		];
	}

	/**
	 * A Form block's attributes, cleaned.
	 *
	 * @param array<string, mixed> $attrs
	 * @return array{uid: string, name: string, error: string, template: string, look: string, labels: string, save: bool, email: array{on: bool, to: string, subject: string, replyTo: bool}, after: array{kind: string, title: string, message: string, page: int, dialog: string}, spam: array{minSeconds: int, challenge: string, minScore: float}}
	 */
	public static function settings( array $attrs ): array {
		$email = is_array( $attrs['email'] ?? null ) ? $attrs['email'] : [];
		$after = is_array( $attrs['after'] ?? null ) ? $attrs['after'] : [];
		$spam = is_array( $attrs['spam'] ?? null ) ? $attrs['spam'] : [];
		$seconds = is_numeric( $spam['minSeconds'] ?? null ) ? (int) round( (float) $spam['minSeconds'] ) : 3;
		$score = is_numeric( $spam['minScore'] ?? null ) ? (float) $spam['minScore'] : 0.5;
		$dialog = is_string( $after['dialog'] ?? null ) ? preg_replace( '/^dialog-/', '', $after['dialog'] ) : '';

		return [
			'uid' => self::uid( $attrs['uniqueId'] ?? '' ),
			'name' => self::text( $attrs['name'] ?? '' ),
			'error' => is_string( $attrs['errorColour'] ?? null ) ? sanitize_key( $attrs['errorColour'] ) : '',
			'template' => is_string( $attrs['template'] ?? null ) ? sanitize_key( $attrs['template'] ) : '',
			'look' => self::pick( $attrs['look'] ?? null, self::LOOKS, 'filled' ),
			'labels' => self::pick( $attrs['labels'] ?? null, self::LABELS, 'above' ),
			'marker' => self::pick( $attrs['marker'] ?? null, self::MARKERS, 'optional' ),
			'save' => false !== ( $attrs['save'] ?? true ),
			'email' => [
				'on' => false !== ( $email['on'] ?? true ),
				'to' => is_string( $email['to'] ?? null ) ? trim( $email['to'] ) : '',
				'subject' => self::text( $email['subject'] ?? '' ),
				'replyTo' => false !== ( $email['replyTo'] ?? true ),
			],
			'after' => [
				'kind' => self::pick( $after['kind'] ?? null, self::AFTER, 'message' ),
				'title' => self::text( $after['title'] ?? '' ),
				'message' => is_string( $after['message'] ?? null ) ? sanitize_textarea_field( $after['message'] ) : '',
				'page' => is_numeric( $after['page'] ?? null ) ? max( 0, (int) $after['page'] ) : 0,
				'dialog' => is_string( $dialog ) && 1 === preg_match( '/^[a-z0-9-]+$/', $dialog ) ? $dialog : '',
			],
			'spam' => [
				'minSeconds' => min( 60, max( 0, $seconds ) ),
				'challenge' => self::pick( $spam['challenge'] ?? null, self::CHALLENGES, 'none' ),
				'minScore' => min( 1.0, max( 0.0, $score ) ),
			],
			'extensions' => self::extensions( $attrs ),
		];
	}

	/**
	 * The fields of a parsed `blicks/form` block, depth-first, in page order. A field with no usable
	 * name is skipped; when two share a name, the first wins.
	 *
	 * @param array<string, mixed> $formBlock A block as `parse_blocks()` returns it.
	 * @return list<array<string, mixed>>
	 */
	public static function fields( array $formBlock ): array {
		$fields = [];
		$seen = [];

		$walk = static function ( array $blocks ) use ( &$walk, &$fields, &$seen ): void {
			foreach ( $blocks as $block ) {
				if ( ! is_array( $block ) ) {
					continue;
				}

				$name = $block['blockName'] ?? '';

				// A form inside a form is its own: its fields are not this one's.
				if ( self::FORM_BLOCK === $name ) {
					continue;
				}

				if ( self::FIELD_BLOCK === $name ) {
					$field = self::field( is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [] );

					if ( '' !== $field['name'] && ! isset( $seen[ $field['name'] ] ) ) {
						$seen[ $field['name'] ] = true;
						$fields[] = $field;
					}
				}

				if ( is_array( $block['innerBlocks'] ?? null ) ) {
					$walk( $block['innerBlocks'] );
				}
			}
		};

		$walk( is_array( $formBlock['innerBlocks'] ?? null ) ? $formBlock['innerBlocks'] : [] );

		return $fields;
	}

	/**
	 * The parsed `blicks/form` block with this `uniqueId`, anywhere in a block list.
	 *
	 * @param array<int, mixed> $blocks
	 * @return array<string, mixed>|null
	 */
	public static function find( array $blocks, string $formId ): ?array {
		if ( '' === $formId ) {
			return null;
		}

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			if ( self::FORM_BLOCK === ( $block['blockName'] ?? '' ) && ( $block['attrs']['uniqueId'] ?? null ) === $formId ) {
				return $block;
			}

			if ( is_array( $block['innerBlocks'] ?? null ) ) {
				$found = self::find( $block['innerBlocks'], $formId );

				if ( null !== $found ) {
					return $found;
				}
			}
		}

		return null;
	}

	/** The message shown when a field is missing or wrong and the author wrote none. */
	public static function defaultError( string $type, string $label ): string {
		switch ( $type ) {
			case 'email':
				return __( 'Enter an email address like name@example.com.', 'blicks' );
			case 'tel':
				return __( 'Enter a phone number.', 'blicks' );
			case 'number':
				return __( 'Enter a number.', 'blicks' );
			case 'date':
				return __( 'Pick a date.', 'blicks' );
			case 'time':
				return __( 'Pick a time.', 'blicks' );
			case 'range':
				return __( 'Pick a value.', 'blicks' );
			case 'select':
			case 'choice':
				return __( 'Choose an option.', 'blicks' );
			case 'consent':
				return __( 'Tick this box to send the form.', 'blicks' );
		}

		$what = strtolower( trim( $label ) );

		return '' !== $what
			/* translators: %s: a field's label, in lower case, e.g. "your name" */
			? sprintf( __( 'Fill in %s.', 'blicks' ), $what )
			: __( 'Fill in this field.', 'blicks' );
	}

	/** A uniqueId as the factory writes it: lower-case hex/alphanumerics, at most 32. */
	public static function uid( mixed $value ): string {
		return is_string( $value ) && 1 === preg_match( '/^[a-z0-9]{1,32}$/', $value ) ? $value : '';
	}

	/**
	 * One note per option, in option order ('' where none): a description or a price.
	 *
	 * @param array<string, mixed> $attrs
	 * @param list<string>         $options
	 * @return list<string>
	 */
	private static function notes( array $attrs, array $options ): array {
		$raw = is_array( $attrs['optionNotes'] ?? null ) ? array_values( $attrs['optionNotes'] ) : [];
		$notes = [];

		foreach ( array_keys( $options ) as $i ) {
			$notes[] = isset( $raw[ $i ] ) && is_scalar( $raw[ $i ] ) ? sanitize_text_field( (string) $raw[ $i ] ) : '';
		}

		return $notes;
	}

	/** A type's appearance, '' for its default or anything it does not offer. */
	public static function appearance( string $type, mixed $value ): string {
		$list = self::APPEARANCES[ $type ] ?? [];

		return is_string( $value ) && in_array( $value, $list, true ) && $list[0] !== $value ? $value : '';
	}

	/**
	 * A Field's type as saved, key-sanitised but never swapped for another: a type no plugin
	 * registers ({@see FieldTypes::types()}) is kept, so its Field renders nothing instead of
	 * turning into a text box. A missing type is `text`, the block's default.
	 */
	public static function type( mixed $value ): string {
		$type = is_string( $value ) ? sanitize_key( $value ) : '';

		return '' !== $type ? $type : 'text';
	}

	/**
	 * A block's `extensions` attribute, passed through untouched for companion plugins (Blicks
	 * never reads it); `[]` when it is not an object.
	 *
	 * @param array<string, mixed> $attrs
	 * @return array<string, mixed>
	 */
	private static function extensions( array $attrs ): array {
		return is_array( $attrs['extensions'] ?? null ) ? $attrs['extensions'] : [];
	}

	/** @param list<string> $allowed */
	private static function pick( mixed $value, array $allowed, string $fallback ): string {
		return is_string( $value ) && in_array( $value, $allowed, true ) ? $value : $fallback;
	}

	private static function text( mixed $value ): string {
		return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
	}
}
