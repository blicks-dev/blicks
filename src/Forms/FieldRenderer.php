<?php
/**
 * Renders a Field block.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

use Blicks\Ai\Spec\Icons;
use Blicks\Style\ElementStyle;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Writes one Field's markup, exactly as `docs/blicks/plans/form-contracts.md` draws it: the form
 * behaviour and the server's validator read these class names, ids and data attributes.
 *
 * Every value goes out through `esc_attr()` / `esc_html()` here, at the point it is written.
 */
final class FieldRenderer {

	/** Text-like types drawn as an `<input>`. */
	private const LINE_TYPES = [ 'text', 'email', 'tel', 'number', 'date', 'time', 'range' ];

	/** Types an Input's icon is drawn inside: one-line boxes and the select. */
	private const ICON_TYPES = [ 'text', 'email', 'tel', 'number', 'date', 'time', 'select' ];

	/** Types whose min / max / step are written on the control. */
	private const BOUNDED_TYPES = [ 'number', 'date', 'time', 'range' ];

	/**
	 * @param array<string, mixed> $attributes The block's attributes.
	 * @param mixed                $block      The WP_Block being rendered, when there is one.
	 */
	public static function render( array $attributes, mixed $block = null ): string {
		$field = Schema::field( $attributes );

		if ( '' === $field['name'] ) {
			return '';
		}

		// Through the type's registered renderer; a type no plugin registers writes nothing.
		$render = FieldTypes::callbacks( $field['type'] )['render'] ?? null;

		if ( null === $render ) {
			return '';
		}

		if ( [ self::class, 'builtIn' ] === $render ) {
			return self::builtIn( $field, '', $block, $attributes );
		}

		$html = call_user_func( $render, $field, self::innerHtml( $block ), $block instanceof \WP_Block ? $block : null, $attributes );

		return is_string( $html ) ? $html : '';
	}

	/**
	 * Blicks' own types' `render` ({@see FieldTypes}). It draws the Field's inner blocks itself, so
	 * `$inner` is not read.
	 *
	 * @param array<string, mixed> $field      {@see Schema::field()}.
	 * @param mixed                $block      The WP_Block being rendered, when there is one.
	 * @param array<string, mixed> $attributes The block's attributes.
	 */
	public static function builtIn( array $field, string $inner, mixed $block = null, array $attributes = [] ): string {
		unset( $inner );

		if ( 'hidden' === $field['type'] ) {
			return self::hidden( $field, $block );
		}

		$marker = self::formMarker( $block );

		if ( $block instanceof \WP_Block && self::hasInput( $block ) ) {
			return self::composed( $attributes, $field, $block, $marker );
		}

		// Ids need a uid; a field saved without one (hand-written markup) still gets a working pair.
		$id = 'blf-' . ( '' !== $field['uid'] ? $field['uid'] : wp_unique_id( 'x' ) );
		$help = '' !== $field['help'] ? $id . '-help' : '';

		switch ( $field['type'] ) {
			case 'choice':
				$inner = self::choice( $field, $marker );
				$tag = 'fieldset';
				break;
			case 'consent':
				$inner = self::consent( $field, $id, $help );
				$tag = 'div';
				break;
			default:
				$inner = self::label( $field, $id, $marker ) . self::control( $field, $id, $help );
				$tag = 'div';
		}

		$inner .= self::help( $field, $help ) . '<p class="bl-field__error" id="' . esc_attr( $id . '-err' ) . '" hidden></p>';

		return '<' . $tag . ' ' . self::wrapper( $attributes, $field, $help, $block, $marker ) . '>' . $inner . '</' . $tag . '>';
	}

	/** A Field's inner blocks, rendered, for a companion type's renderer. */
	private static function innerHtml( mixed $block ): string {
		if ( ! $block instanceof \WP_Block ) {
			return '';
		}

		$html = '';
		foreach ( $block->inner_blocks as $inner ) {
			$html .= (string) $inner->render();
		}

		return $html;
	}

	/** How the Form around this Field marks its labels (`blicks/formMarker`), `optional` outside one. */
	private static function formMarker( mixed $block ): string {
		$value = $block instanceof \WP_Block && is_array( $block->context ) ? ( $block->context['blicks/formMarker'] ?? null ) : null;

		return is_string( $value ) && in_array( $value, Schema::MARKERS, true ) ? $value : 'optional';
	}

	/**
	 * The wrapper's attributes: the style engine's classes and vars, the field's own classes and
	 * the data the behaviour reads.
	 *
	 * @param array<string, mixed> $attributes
	 * @param array<string, mixed> $field
	 */
	private static function wrapper( array $attributes, array $field, string $help, mixed $block, string $marker, bool $composed = false, string $name = '' ): string {
		$props = ElementStyle::blockProps( $attributes['blicks'] ?? null, $field['uid'], 'field' );

		$classes = [ $props['class'], 'bl-field--' . $field['type'], 'bl-field--w-' . $field['width'] ];
		if ( $field['required'] ) {
			$classes[] = 'is-required';
		}
		if ( $field['multiple'] ) {
			$classes[] = 'is-multiple';
		}
		if ( $composed ) {
			$classes[] = 'bl-field--blocks';
		}
		if ( '' !== $field['appearance'] ) {
			$classes[] = 'bl-field--a-' . $field['appearance'];
		}
		// The default marker is today's markup, with no class of its own.
		if ( 'optional' !== $marker ) {
			$classes[] = 'bl-field--marker-' . $marker;
		}

		$args = [ 'class' => implode( ' ', $classes ) ];
		if ( '' !== $props['style'] ) {
			$args['style'] = $props['style'];
		}
		$args['data-bl-field'] = $field['name'];
		$args['data-bl-error'] = $field['errorMessage'];
		if ( 'choice' === $field['type'] && '' !== $help ) {
			$args['aria-describedby'] = $help;
		}
		// A group with no legend is named for screen readers from the field's label.
		if ( 'choice' === $field['type'] && '' !== $name ) {
			$args['aria-label'] = $name;
		}

		// Block supports (and their filters) only run while WordPress is rendering a block.
		if ( $block instanceof \WP_Block ) {
			return get_block_wrapper_attributes( $args );
		}

		$out = [];
		foreach ( $args as $key => $value ) {
			$out[] = $key . '="' . esc_attr( $value ) . '"';
		}

		return implode( ' ', $out );
	}

	/** @param array<string, mixed> $field */
	private static function label( array $field, string $id, string $marker ): string {
		return '<label class="bl-field__label" for="' . esc_attr( $id ) . '">' . esc_html( $field['label'] ) . self::marker( $field, $marker ) . '</label>';
	}

	/**
	 * What follows a label: "(optional)" on optional fields (the default), `*` on required ones,
	 * `*` and "Optional", or nothing. Never on a consent box, whose label is its own sentence.
	 *
	 * @param array<string, mixed> $field
	 */
	private static function marker( array $field, string $marker ): string {
		if ( 'consent' === $field['type'] || 'none' === $marker ) {
			return '';
		}

		$required = (bool) $field['required'];
		if ( 'optional' === $marker ) {
			return $required ? '' : '<span class="bl-field__opt"> ' . esc_html__( '(optional)', 'blicks' ) . '</span>';
		}
		if ( $required ) {
			return '<span class="bl-field__req" aria-hidden="true">*</span>';
		}

		return 'both' === $marker ? '<span class="bl-field__opt">' . esc_html__( 'Optional', 'blicks' ) . '</span>' : '';
	}

	/** @param array<string, mixed> $field */
	private static function help( array $field, string $help ): string {
		return '' === $help ? '' : '<p class="bl-field__help" id="' . esc_attr( $help ) . '">' . esc_html( $field['help'] ) . '</p>';
	}

	/**
	 * The input, textarea or select of a one-value field, with what is drawn around it: an Input's
	 * icon, a number's stepper, a range's value and bounds, a textarea's counter.
	 *
	 * @param array<string, mixed>  $field
	 * @param array<string, string> $props The Input's style classes and vars, when it is a block.
	 * @param string                $icon  The Input's icon as an SVG, '' for none.
	 */
	private static function control( array $field, string $id, string $help, array $props = [], string $icon = '' ): string {
		$type = $field['type'];
		$attrs = self::styled( $props, 'bl-field__control' ) + [
			'id' => $id,
			'name' => $field['name'],
		];

		if ( in_array( $type, self::LINE_TYPES, true ) ) {
			$attrs['type'] = $type;
		}

		$tail = [];
		if ( $field['required'] ) {
			$tail['required'] = true;
		}
		if ( ! in_array( $type, [ 'select', 'date', 'time', 'range' ], true ) && '' !== $field['placeholder'] ) {
			$tail['placeholder'] = $field['placeholder'];
		}

		$autocomplete = self::autocomplete( $type, $field['name'] );
		if ( '' !== $autocomplete ) {
			$tail['autocomplete'] = $autocomplete;
		}
		if ( 'tel' === $type ) {
			$tail['inputmode'] = 'tel';
		} elseif ( 'number' === $type ) {
			$tail['inputmode'] = 'decimal';
		}

		if ( 'range' === $type ) {
			$range = self::range( $field );
			$tail += [
				'min' => $range['min'],
				'max' => $range['max'],
			];
			if ( '' !== $range['step'] ) {
				$tail['step'] = $range['step'];
			}
			$tail['value'] = $range['value'];
			$tail['aria-valuetext'] = $range['text'];
		} elseif ( in_array( $type, self::BOUNDED_TYPES, true ) ) {
			foreach ( [ 'min', 'max', 'step' ] as $key ) {
				$value = self::bound( $type, $key, (string) $field[ $key ] );
				if ( '' !== $value ) {
					$tail[ $key ] = $value;
				}
			}
		}

		$max = (int) $field['maxLength'];
		if ( $max > 0 ) {
			$tail['maxlength'] = (string) $max;
		}
		$count = 'textarea' === $type && $max > 0 ? $id . '-count' : '';

		$described = trim( $help . ' ' . $count );
		if ( '' !== $described ) {
			$tail['aria-describedby'] = $described;
		}

		$attrs = self::attrs( $attrs + $tail );

		if ( 'textarea' === $type ) {
			$html = '<textarea ' . $attrs . ' rows="5"></textarea>';

			return '' === $count ? $html : $html . '<p class="bl-field__count" id="' . esc_attr( $count ) . '"><span class="bl-field__count-n">0</span> / ' . esc_html( (string) $max ) . '</p>';
		}

		if ( 'select' === $type ) {
			$empty = '' !== $field['placeholder'] ? $field['placeholder'] : __( 'Choose one', 'blicks' );
			$options = '<option value="">' . esc_html( $empty ) . '</option>';
			foreach ( $field['options'] as $option ) {
				$options .= '<option value="' . esc_attr( $option ) . '">' . esc_html( $option ) . '</option>';
			}

			return self::withIcon( '<select ' . $attrs . '>' . $options . '</select>', $icon );
		}

		$html = '<input ' . $attrs . '>';

		if ( 'range' === $type ) {
			return '<div class="bl-range">' . $html
				. '<output ' . self::attrs( self::output( $field, $id ) ) . '>' . esc_html( $range['text'] ) . '</output>'
				. '<span class="bl-range__min">' . esc_html( $range['minText'] ) . '</span>'
				. '<span class="bl-range__max">' . esc_html( $range['maxText'] ) . '</span></div>';
		}

		if ( 'number' === $type && 'stepper' === $field['appearance'] ) {
			return '<span class="bl-stepper">'
				. self::stepButton( $id, -1 ) . $html . self::stepButton( $id, 1 )
				. '</span>';
		}

		return self::withIcon( $html, in_array( $type, self::ICON_TYPES, true ) ? $icon : '' );
	}

	/**
	 * A range output's attributes: the prefix and suffix the behaviour writes around the value.
	 *
	 * @param array<string, mixed> $field
	 * @return array<string, string>
	 */
	private static function output( array $field, string $id ): array {
		$attrs = [
			'class' => 'bl-range__value',
			'for' => $id,
		];
		if ( '' !== $field['prefix'] ) {
			$attrs['data-bl-prefix'] = $field['prefix'];
		}
		if ( '' !== $field['suffix'] ) {
			$attrs['data-bl-suffix'] = $field['suffix'];
		}

		return $attrs;
	}

	/** A control inside the wrap its icon is drawn in; the control alone without one. */
	private static function withIcon( string $html, string $icon ): string {
		return '' === $icon ? $html : '<span class="bl-input-wrap has-icon">' . $icon . $html . '</span>';
	}

	/** One of a stepper's two buttons, the one that takes a step down (-1) or up (1). */
	private static function stepButton( string $id, int $step ): string {
		$label = $step < 0 ? __( 'Decrease', 'blicks' ) : __( 'Increase', 'blicks' );

		return '<button type="button" class="bl-stepper__btn" data-bl-step="' . esc_attr( (string) $step ) . '" aria-label="' . esc_attr( $label ) . '" aria-controls="' . esc_attr( $id ) . '">'
			. ( $step < 0 ? '&minus;' : '+' ) . '</button>';
	}

	/**
	 * A range's bounds and start value, and those values as words: the prefix and suffix around
	 * each number. Without bounds it runs 0 to 100; without a start value it starts in the middle.
	 *
	 * @param array<string, mixed> $field
	 * @return array{min: string, max: string, step: string, value: string, text: string, minText: string, maxText: string}
	 */
	private static function range( array $field ): array {
		$min = self::bound( 'range', 'min', (string) $field['min'] );
		$max = self::bound( 'range', 'max', (string) $field['max'] );
		$step = self::bound( 'range', 'step', (string) $field['step'] );
		$low = '' !== $min ? (float) $min : 0.0;
		$high = '' !== $max ? (float) $max : 100.0;
		if ( $high < $low ) {
			$high = $low;
		}
		$size = is_numeric( $step ) && (float) $step > 0 ? (float) $step : ( 'any' === $step ? 0.0 : 1.0 );

		$default = trim( (string) $field['defaultValue'] );
		if ( is_numeric( $default ) ) {
			$value = min( $high, max( $low, (float) $default ) );
		} else {
			$half = ( $high - $low ) / 2;
			$value = $size > 0 ? $low + round( $half / $size ) * $size : $low + $half;
			$value = min( $high, $value );
		}

		$places = max( self::places( (string) $low ), self::places( $size > 0 ? (string) $size : '' ), is_numeric( $default ) ? self::places( $default ) : 0 );
		$value = round( $value, $places );

		return [
			'min' => self::plain( $low, $places ),
			'max' => self::plain( $high, $places ),
			'step' => $step,
			'value' => self::plain( $value, $places ),
			'text' => self::words( $field, $value, $places ),
			'minText' => self::words( $field, $low, $places ),
			'maxText' => self::words( $field, $high, $places ),
		];
	}

	/**
	 * A range number as people read it: the prefix, the number in the site's locale, the suffix.
	 *
	 * @param array<string, mixed> $field
	 */
	private static function words( array $field, float $value, int $places ): string {
		return $field['prefix'] . number_format_i18n( $value, $places ) . $field['suffix'];
	}

	/** A number as the browser takes it, with no grouping and no trailing zeros past its places. */
	private static function plain( float $value, int $places ): string {
		$text = number_format( $value, $places, '.', '' );

		return str_contains( $text, '.' ) ? rtrim( rtrim( $text, '0' ), '.' ) : $text;
	}

	/** How many decimal places a number is written with. */
	private static function places( string $number ): int {
		$dot = strpos( $number, '.' );

		return false === $dot ? 0 : min( 10, strlen( rtrim( substr( $number, $dot + 1 ), '0' ) ) );
	}

	/**
	 * Radios (one answer) or checkboxes (several), inside the fieldset the wrapper is.
	 *
	 * @param array<string, mixed> $field
	 */
	private static function choice( array $field, string $marker ): string {
		return '<legend class="bl-field__label">' . esc_html( $field['label'] ) . self::marker( $field, $marker ) . '</legend>' . self::choices( $field );
	}

	/**
	 * The boxes of a choice field. Each option is its own label, with its note under it; an Input
	 * block's style classes and vars go on every option (a card, a chip, a segment), not the row.
	 *
	 * @param array<string, mixed>  $field
	 * @param array<string, string> $props The Input's style classes and vars, when it is a block.
	 */
	private static function choices( array $field, array $props = [] ): string {
		$multiple = (bool) $field['multiple'];
		$out = '<div class="bl-field__choices">';
		$option = self::attrs( self::styled( $props, 'bl-field__choice' ) );

		foreach ( $field['options'] as $i => $value ) {
			$attrs = [
				'type' => $multiple ? 'checkbox' : 'radio',
				'name' => $multiple ? $field['name'] . '[]' : $field['name'],
				'value' => $value,
			];
			// A required group of checkboxes is checked by the behaviour and the server: `required`
			// on each box would demand every one of them.
			if ( $field['required'] && ! $multiple ) {
				$attrs['required'] = true;
			}

			$note = (string) ( $field['optionNotes'][ $i ] ?? '' );
			$text = '<span class="bl-field__choice-label">' . esc_html( $value ) . '</span>';
			if ( '' !== $note ) {
				$text .= '<span class="bl-field__choice-note">' . esc_html( $note ) . '</span>';
			}

			$out .= '<label ' . $option . '><input ' . self::attrs( $attrs ) . '><span class="bl-field__choice-text">' . $text . '</span></label>';
		}

		return $out . '</div>';
	}

	/** @param array<string, mixed> $field */
	private static function consent( array $field, string $id, string $help ): string {
		return '<label class="bl-field__choice" for="' . esc_attr( $id ) . '"><input ' . self::attrs( self::checkAttrs( $field, $id, $help ) ) . '> <span>' . esc_html( $field['label'] ) . '</span></label>';
	}

	/**
	 * A consent box's attributes.
	 *
	 * @param array<string, mixed> $field
	 * @return array<string, string|bool>
	 */
	private static function checkAttrs( array $field, string $id, string $help ): array {
		$attrs = [
			'type' => 'checkbox',
			'id' => $id,
			'name' => $field['name'],
			'value' => 'yes',
		];
		if ( $field['required'] ) {
			$attrs['required'] = true;
		}
		if ( 'switch' === $field['appearance'] ) {
			$attrs['role'] = 'switch';
		}
		if ( '' !== $help ) {
			$attrs['aria-describedby'] = $help;
		}

		return $attrs;
	}

	/**
	 * An Input block: a Field's control, drawn from what its Field says through block context, with
	 * the Input's own style classes on the control itself.
	 *
	 * @param array<string, mixed> $attributes The Input block's attributes.
	 * @param mixed                $block      The WP_Block being rendered, when there is one.
	 */
	public static function input( array $attributes, mixed $block = null ): string {
		$context = $block instanceof \WP_Block && is_array( $block->context ) ? $block->context : [];
		$field = Schema::field( self::fromContext( $context ) );

		// Only Blicks' own types have an Input; a companion type draws its Field whole.
		if ( '' === $field['name'] || 'hidden' === $field['type'] || ! FieldTypes::builtIn( $field['type'] ) || ! FieldTypes::registered( $field['type'] ) ) {
			return '';
		}

		$props = ElementStyle::blockProps( $attributes['blicks'] ?? null, Schema::uid( $attributes['uniqueId'] ?? '' ), 'input' );
		$id = 'blf-' . ( '' !== $field['uid'] ? $field['uid'] : wp_unique_id( 'x' ) );

		switch ( $field['type'] ) {
			case 'choice':
				return self::choices( $field, $props );
			case 'consent':
				return '<input ' . self::attrs( self::styled( $props, 'bl-field__check' ) + self::checkAttrs( $field, $id, '' ) ) . '>';
			default:
				return self::control( $field, $id, '', $props, self::icon( $attributes['icon'] ?? '' ) );
		}
	}

	/** An Input's icon as an SVG marked `bl-input__icon`; '' when it names no icon there is. */
	private static function icon( mixed $name ): string {
		if ( ! is_string( $name ) || '' === $name || ! Icons::exists( $name ) ) {
			return '';
		}

		$processor = new \WP_HTML_Tag_Processor( Icons::svg( $name, 2.0 ) );
		if ( ! $processor->next_tag( 'svg' ) ) {
			return '';
		}
		$processor->add_class( 'bl-input__icon' );
		$processor->set_attribute( 'aria-hidden', 'true' );

		return $processor->get_updated_html();
	}

	/**
	 * The Field attributes an Input reads from its block context.
	 *
	 * @param array<string, mixed> $context
	 * @return array<string, mixed>
	 */
	private static function fromContext( array $context ): array {
		$keys = [
			'uniqueId' => 'blicks/fieldUid',
			'type' => 'blicks/fieldType',
			'name' => 'blicks/fieldName',
			'label' => 'blicks/fieldLabel',
			'required' => 'blicks/fieldRequired',
			'placeholder' => 'blicks/fieldPlaceholder',
			'options' => 'blicks/fieldOptions',
			'multiple' => 'blicks/fieldMultiple',
			'min' => 'blicks/fieldMin',
			'max' => 'blicks/fieldMax',
			'step' => 'blicks/fieldStep',
			'defaultValue' => 'blicks/fieldDefault',
			'maxLength' => 'blicks/fieldMaxLength',
			'optionNotes' => 'blicks/fieldOptionNotes',
			'appearance' => 'blicks/fieldAppearance',
			'prefix' => 'blicks/fieldPrefix',
			'suffix' => 'blicks/fieldSuffix',
		];

		$attrs = [];
		foreach ( $keys as $attr => $key ) {
			if ( array_key_exists( $key, $context ) ) {
				$attrs[ $attr ] = $context[ $key ];
			}
		}

		return $attrs;
	}

	/** Whether a Field block holds an Input: the composed shape, label and help as Text blocks. */
	private static function hasInput( \WP_Block $block ): bool {
		foreach ( $block->inner_blocks as $inner ) {
			if ( 'input' === self::role( $inner ) ) {
				return true;
			}
		}

		return false;
	}

	/** What an inner block of a Field is: `label`, `help`, `input`, or '' for anything else. */
	private static function role( \WP_Block $inner ): string {
		if ( 'blicks/input' === $inner->name ) {
			return 'input';
		}
		if ( 'blicks/text' !== $inner->name ) {
			return '';
		}

		$meta = $inner->attributes['metadata'] ?? ( $inner->parsed_block['attrs']['metadata'] ?? null );
		$role = is_array( $meta ) ? ( $meta['blicksRole'] ?? '' ) : '';

		return in_array( $role, [ 'label', 'help' ], true ) ? $role : '';
	}

	/**
	 * A Field made of blocks: the wrapper, then each part in the author's order — the label Text
	 * as the `<label>` (the `<legend>`, first, for choices), the help Text with its id, the Input's
	 * control wired to both — then the error line.
	 *
	 * @param array<string, mixed> $attributes
	 * @param array<string, mixed> $field
	 */
	private static function composed( array $attributes, array $field, \WP_Block $block, string $marker ): string {
		$id = 'blf-' . ( '' !== $field['uid'] ? $field['uid'] : wp_unique_id( 'x' ) );
		$choice = 'choice' === $field['type'];
		$optional = self::marker( $field, $marker );

		// Each part once, in order; the first label and help are the field's, any more are text.
		$parts = [];
		$label = -1;
		$help = -1;
		foreach ( $block->inner_blocks as $inner ) {
			$role = self::role( $inner );
			$html = (string) $inner->render();

			if ( 'label' === $role && $label < 0 ) {
				$html = self::asLabel( $html, $choice ? 'legend' : 'label', $choice ? '' : $id, $optional );
				$label = '' !== $html ? count( $parts ) : -1;
			} elseif ( 'help' === $role && $help < 0 ) {
				$html = self::asHelp( $html, $id . '-help' );
				$help = '' !== $html ? count( $parts ) : -1;
			} elseif ( 'label' === $role || 'help' === $role ) {
				$role = '';
			}

			$parts[] = [ $role, $html ];
		}

		$helpId = $help >= 0 ? $id . '-help' : '';
		// Without a label block, the field's `label` is the control's (or the group's) name.
		$name = $label < 0 ? $field['label'] : '';

		$legend = '';
		$inner = '';
		foreach ( $parts as $i => [ $role, $html ] ) {
			if ( $choice && $i === $label ) {
				// A legend is the fieldset's first child, wherever the author put it.
				$legend = $html;
				continue;
			}
			if ( 'input' === $role && ! $choice ) {
				$html = self::wire( $html, $id, $helpId, $name );
			}
			$inner .= $html;
		}

		$inner = $legend . $inner . '<p class="bl-field__error" id="' . esc_attr( $id . '-err' ) . '" hidden></p>';
		$tag = $choice ? 'fieldset' : 'div';

		return '<' . $tag . ' ' . self::wrapper( $attributes, $field, $helpId, $block, $marker, true, $choice ? $name : '' ) . '>' . $inner . '</' . $tag . '>';
	}

	/**
	 * A label Text's element as a `<label for>` (or `<legend>`), keeping the Text's own classes,
	 * vars and attributes and adding `bl-field__label`. Only the outer element is rewritten. ''
	 * when the Text wrote nothing, or nothing with words in it.
	 */
	private static function asLabel( string $html, string $tag, string $for, string $optional ): string {
		$html = trim( $html );
		$attr = '(?:[^>"\']|"[^"]*"|\'[^\']*\')*';
		if ( 1 !== preg_match( '/^<([a-zA-Z][a-zA-Z0-9]*)(' . $attr . ')>(.*)<\/\1>$/s', $html, $m ) ) {
			return '';
		}
		if ( '' === trim( wp_strip_all_tags( $m[3] ) ) ) {
			return '';
		}

		$processor = new \WP_HTML_Tag_Processor( '<' . $tag . $m[2] . '>' );
		if ( ! $processor->next_tag() ) {
			return '';
		}
		$processor->add_class( 'bl-field__label' );
		if ( '' !== $for ) {
			$processor->set_attribute( 'for', $for );
		}

		return $processor->get_updated_html() . $m[3] . $optional . '</' . $tag . '>';
	}

	/** A help Text's element with the id the control points to and `bl-field__help`. */
	private static function asHelp( string $html, string $id ): string {
		$processor = new \WP_HTML_Tag_Processor( trim( $html ) );
		if ( ! $processor->next_tag() ) {
			return '';
		}
		$processor->set_attribute( 'id', $id );
		$processor->add_class( 'bl-field__help' );

		return $processor->get_updated_html();
	}

	/** An Input's control with the field's id, its help and, with no label block, its name. */
	private static function wire( string $html, string $id, string $help, string $name ): string {
		$processor = new \WP_HTML_Tag_Processor( $html );
		while ( $processor->next_tag() ) {
			if ( ! in_array( $processor->get_tag(), [ 'INPUT', 'SELECT', 'TEXTAREA' ], true ) ) {
				continue;
			}
			$processor->set_attribute( 'id', $id );
			// The help first, then what the Input already points to (a textarea's counter).
			$own = $processor->get_attribute( 'aria-describedby' );
			$described = trim( $help . ' ' . ( is_string( $own ) ? $own : '' ) );
			if ( '' !== $described ) {
				$processor->set_attribute( 'aria-describedby', $described );
			}
			if ( '' !== $name ) {
				$processor->set_attribute( 'aria-label', $name );
			}
			break;
		}

		return $processor->get_updated_html();
	}

	/**
	 * An element's class (and style) when it is an Input block: the block's own classes first, then
	 * the one the field's look is drawn by.
	 *
	 * @param array<string, string> $props
	 * @return array<string, string>
	 */
	private static function styled( array $props, string $class ): array {
		$out = [ 'class' => trim( ( $props['class'] ?? '' ) . ' ' . $class ) ];
		if ( '' !== ( $props['style'] ?? '' ) ) {
			$out['style'] = $props['style'];
		}

		return $out;
	}

	/**
	 * A hidden input. Page facts resolve here; what only the browser knows (where the visitor came
	 * from, campaign tags) is left empty and named in `data-bl-fill` for the behaviour.
	 *
	 * @param array<string, mixed> $field
	 */
	private static function hidden( array $field, mixed $block ): string {
		$value = (string) $field['defaultValue'];
		$fill = '';

		if ( in_array( $value, Schema::CLIENT_TOKENS, true ) ) {
			$fill = trim( $value, '{}' );
			$value = '';
		} elseif ( in_array( $value, Schema::SERVER_TOKENS, true ) ) {
			$value = self::pageFact( $value, $block );
		}

		$attrs = [
			'type' => 'hidden',
			'class' => 'bl-field bl-field--hidden',
			'name' => $field['name'],
			'value' => $value,
			'data-bl-field' => $field['name'],
		];
		if ( '' !== $fill ) {
			$attrs['data-bl-fill'] = $fill;
		}

		return '<input ' . self::attrs( $attrs ) . '>';
	}

	/** `{page}` the page's path, `{url}` its permalink, `{title}` its title — of the post being shown. */
	private static function pageFact( string $token, mixed $block ): string {
		$post = 0;
		if ( $block instanceof \WP_Block && is_numeric( $block->context['postId'] ?? null ) ) {
			$post = (int) $block->context['postId'];
		}
		if ( ! $post ) {
			$post = (int) get_the_ID();
		}
		if ( ! $post ) {
			$post = (int) get_queried_object_id();
		}

		switch ( $token ) {
			case '{page}':
				$path = $post ? wp_parse_url( (string) get_permalink( $post ), PHP_URL_PATH ) : '';
				return is_string( $path ) ? $path : '';
			case '{url}':
				$url = $post ? get_permalink( $post ) : false;
				return is_string( $url ) ? $url : home_url( '/' );
			case '{title}':
				return $post ? wp_strip_all_tags( get_the_title( $post ) ) : wp_strip_all_tags( wp_get_document_title() );
		}

		return '';
	}

	private static function autocomplete( string $type, string $name ): string {
		if ( 'email' === $type ) {
			return 'email';
		}
		if ( 'tel' === $type ) {
			return 'tel';
		}

		return 'text' === $type && in_array( $name, [ 'name', 'full_name' ], true ) ? 'name' : '';
	}

	/** A min / max / step as the browser takes it, or '' when it is not one. */
	private static function bound( string $type, string $key, string $value ): string {
		$value = trim( $value );
		if ( '' === $value ) {
			return '';
		}

		if ( 'number' === $type || 'range' === $type ) {
			return is_numeric( $value ) || ( 'step' === $key && 'any' === $value ) ? $value : '';
		}

		// Time: a step is a number of seconds; min and max a time of day.
		if ( 'time' === $type ) {
			if ( 'step' === $key ) {
				return ctype_digit( $value ) || 'any' === $value ? $value : '';
			}

			return 1 === preg_match( '/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $value ) ? $value : '';
		}

		// Date: a step is a number of days; min and max a date, or today in the site's timezone.
		if ( 'step' === $key ) {
			return ctype_digit( $value ) ? $value : '';
		}
		if ( 'today' === strtolower( $value ) ) {
			return (string) wp_date( 'Y-m-d' );
		}

		return 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Attributes as HTML, escaped. `true` writes a bare boolean attribute.
	 *
	 * @param array<string, string|bool> $attrs
	 */
	private static function attrs( array $attrs ): string {
		$out = [];
		foreach ( $attrs as $key => $value ) {
			$out[] = true === $value ? $key : $key . '="' . esc_attr( (string) $value ) . '"';
		}

		return implode( ' ', $out );
	}
}
