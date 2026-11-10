<?php
/**
 * Turns validated specs into the block markup WordPress stores.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

use Blicks\Style\ElementStyle;
use Blicks\Ai\Catalog\BlockCatalog;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Writes a spec tree as saved block markup.
 *
 * The inverse of {@see SpecParser}, and the piece that makes a headless write possible at all: a
 * client can already compose and validate a layout, but a post stores markup, not specs.
 *
 * **Byte-identical or nothing.** WordPress validates stored markup against what the block's
 * `save()` would produce today, and anything short of an exact match shows the author "this block
 * contains unexpected or invalid content" on a page that was fine a moment ago. So this does not
 * aim for equivalent markup, or valid markup — it aims for the same bytes, and refuses outright
 * where it cannot promise them. {@see BlockShapes} says which blocks those are and why.
 *
 * Nothing here decides what is *allowed*. {@see SpecValidator} does that, and it runs first: this
 * assumes a spec that has already been through it and concerns itself only with writing it down.
 */
final class SpecSerializer {

	/**
	 * A tree of specs as post content.
	 *
	 * Sibling blocks are separated by a blank line, which is not cosmetic — it is what the editor's
	 * serializer emits, so anything else is a diff against the markup this content will be compared
	 * to the moment someone opens it.
	 *
	 * @param list<BlockSpec> $specs
	 * @throws UnsupportedBlock When the tree names a block this side cannot reproduce exactly.
	 */
	public static function toMarkup( array $specs ): string {
		return implode( "\n\n", array_map( [ self::class, 'block' ], $specs ) );
	}

	/**
	 * Every block in a tree that cannot be written, in the order they appear.
	 *
	 * Offered separately from {@see self::toMarkup()} so a caller can report all of them at once.
	 * A client told about one unsupported block per attempt learns the limit one round trip at a
	 * time; told about all of them, it can rewrite the layout in a single turn.
	 *
	 * @param list<BlockSpec> $specs
	 * @return list<string> Block names, deduplicated.
	 */
	public static function unsupported( array $specs ): array {
		$names = [];

		foreach ( $specs as $spec ) {
			foreach ( $spec->walk() as $node ) {
				if ( $node->isOpaque() ) {
					continue;
				}

				if ( ! BlockShapes::supports( $node->name ) ) {
					$names[] = $node->name;
					continue;
				}

				$refuse = BlockShapes::for( $node->name )['refuse'] ?? null;
				$reason = is_callable( $refuse ) ? $refuse( self::merged( $node ) ) : null;

				if ( is_string( $reason ) ) {
					$names[] = sprintf( '%s (with %s)', $node->name, $reason );
				}
			}
		}

		return array_values( array_unique( $names ) );
	}

	/**
	 * One block, delimiters and all.
	 *
	 * @throws UnsupportedBlock When this block has no shape.
	 */
	private static function block( BlockSpec $spec ): string {
		if ( $spec->isOpaque() ) {
			return (string) $spec->markup;
		}

		$shape = BlockShapes::for( $spec->name );

		if ( null === $shape ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- escaped in the exception, where the message is built.
			throw new UnsupportedBlock( $spec->name );
		}

		// A block whose `save()` returns null for these attributes is stored as a bare,
		// self-closing delimiter.
		if ( is_callable( $shape['empty'] ?? null ) && true === $shape['empty']( self::merged( $spec ) ) ) {
			return '<!-- wp:' . self::shortName( $spec->name ) . self::attributes( $spec ) . ' /-->';
		}

		$open = '<!-- wp:' . self::shortName( $spec->name ) . self::attributes( $spec ) . ' -->';
		$close = '<!-- /wp:' . self::shortName( $spec->name ) . ' -->';
		$inner = self::element( $spec, $shape );

		// A block with no saved element of its own — a dynamic one — writes its children between
		// bare delimiters, with no element and no surrounding blank line.
		if ( '' === $inner ) {
			return $open . "\n" . self::toMarkup( $spec->innerBlocks ) . "\n" . $close;
		}

		return $open . "\n" . $inner . "\n" . $close;
	}

	/**
	 * The block's own element, or an empty string when it saves only its children.
	 *
	 * @param array<string, mixed> $shape
	 */
	private static function element( BlockSpec $spec, array $shape ): string {
		if ( true === ( $shape['dynamic'] ?? false ) ) {
			return '';
		}

		$attributes = self::merged( $spec );
		$tag = $shape['tag'] ?? 'div';
		// A string is a tag name, never a function to call: `header` is both.
		$tag = ! is_string( $tag ) && is_callable( $tag ) ? (string) $tag( $attributes ) : (string) $tag;

		$props = ElementStyle::blockProps(
			$spec->blicks,
			(string) ( $attributes['uniqueId'] ?? '' ),
			BlockCatalog::slug( $spec->name )
		);

		$classes = array_merge(
			'' !== $props['class'] ? explode( ' ', $props['class'] ) : [],
			self::visibility( $attributes['visibility'] ?? null ),
			is_callable( $shape['classes'] ?? null ) ? $shape['classes']( $attributes ) : []
		);

		$style = self::style( $props['style'], $shape, $attributes );

		$html = '<' . $tag . ' class="' . self::escapeAttribute( implode( ' ', $classes ) ) . '"';

		if ( '' !== $style ) {
			$html .= ' style="' . self::escapeAttribute( $style ) . '"';
		}

		foreach ( is_callable( $shape['attrs'] ?? null ) ? $shape['attrs']( $attributes ) : [] as $key => $value ) {
			$html .= ' ' . $key . '="' . self::escapeAttribute( (string) $value ) . '"';
		}

		$void = $shape['void'] ?? false;

		if ( true === ( is_callable( $void ) ? $void( $attributes ) : $void ) ) {
			return $html . '/>';
		}

		// A block whose children are neither rich text nor inner blocks — a button's label and
		// icon, say — builds its own inside. Null means "not for these attributes": a box builds
		// a badge's text but leaves a card's inner blocks to the branches below.
		$built = is_callable( $shape['html'] ?? null ) ? $shape['html']( $attributes ) : null;

		if ( is_string( $built ) ) {
			$content = $built;
		} elseif ( is_string( $shape['content'] ?? null ) ) {
			// Rich text is stored as HTML and written as given: re-escaping it would turn a bold word
			// into visible tags and into markup the block no longer validates against. It is *not*
			// trusted for that — an agent's input has been through nothing yet. `MarkupGuard`
			// checks the finished markup, for every account, before anything is saved.
			$content = (string) ( $attributes[ $shape['content'] ] ?? '' );
		} else {
			$content = self::toMarkup( $spec->innerBlocks );
		}

		// An element the children sit in, inside the block's own: a navigation's list.
		$wrap = is_callable( $shape['inner'] ?? null ) ? $shape['inner']( $attributes ) : null;

		if ( is_array( $wrap ) && is_string( $wrap['tag'] ?? null ) && 1 === preg_match( '/^[a-z][a-z0-9]*$/', $wrap['tag'] ) ) {
			$class = is_string( $wrap['class'] ?? null ) && '' !== $wrap['class'] ? ' class="' . self::escapeAttribute( $wrap['class'] ) . '"' : '';
			$content = '<' . $wrap['tag'] . $class . '>' . $content . '</' . $wrap['tag'] . '>';
		}

		// Markup written ahead of the children, inside the element — a linked box's overlay link.
		$prepend = is_callable( $shape['prepend'] ?? null ) ? (string) $shape['prepend']( $attributes ) : '';

		return $html . '>' . $prepend . $content . '</' . $tag . '>';
	}

	/**
	 * The element's `style` attribute.
	 *
	 * The merge order is the whole point. Most blocks spread their attribute-derived custom
	 * properties *first* and the style tree after, so a value set in Styles wins over the same
	 * thing set in Settings. A few do the reverse. Getting this backwards
	 * produces markup that is valid, plausible, and styled wrong.
	 *
	 * @param array<string, mixed> $shape
	 * @param array<string, mixed> $attributes
	 */
	private static function style( string $treeStyle, array $shape, array $attributes ): string {
		$fromTree = self::parseStyle( $treeStyle );
		$fromAttrs = is_callable( $shape['vars'] ?? null ) ? $shape['vars']( $attributes ) : [];

		$merged = true === ( $shape['varsWin'] ?? false )
			? array_merge( $fromTree, $fromAttrs )
			: array_merge( $fromAttrs, $fromTree );

		$parts = [];

		foreach ( $merged as $property => $value ) {
			$parts[] = $property . ':' . $value;
		}

		return implode( ';', $parts );
	}

	/**
	 * Read `ElementStyle::blockProps()`'s style string back into pairs so it can be merged.
	 *
	 * Splitting a string that was just built from an array is round-about, and the alternative —
	 * calling `ElementStyle::build()` and using its `vars` directly — was tried first. It does not
	 * work: `blockProps()` also queues the scoped CSS a block needs, and skipping it drops every
	 * tier-3 rule. Better one parse here than a second code path that silently loses styling.
	 *
	 * @return array<string, string>
	 */
	private static function parseStyle( string $style ): array {
		$vars = [];

		foreach ( array_filter( explode( ';', $style ) ) as $declaration ) {
			$colon = strpos( $declaration, ':' );

			if ( false === $colon ) {
				continue;
			}

			$vars[ substr( $declaration, 0, $colon ) ] = substr( $declaration, $colon + 1 );
		}

		return $vars;
	}

	/**
	 * The `bl-hide-*` classes a block's visibility attribute produces on save.
	 *
	 * The editor writes `bl-eh-*` for the same attribute so a hidden block stays visible while you
	 * are editing it. Only the saved form belongs here.
	 *
	 * @return list<string>
	 */
	private static function visibility( mixed $visibility ): array {
		if ( ! is_array( $visibility ) ) {
			return [];
		}

		$classes = [];

		foreach ( $visibility as $id => $hidden ) {
			if ( $hidden ) {
				$classes[] = 'bl-hide-' . $id;
			}
		}

		return $classes;
	}

	/**
	 * The block's attributes with its `blicks` tree folded back in and defaults applied.
	 *
	 * @return array<string, mixed>
	 */
	private static function merged( BlockSpec $spec ): array {
		return array_merge( BlockCatalog::defaults( $spec->name ), $spec->wpAttributes() );
	}

	/**
	 * The attributes as the delimiter carries them: only what differs from the block's defaults,
	 * in the order `block.json` declares them.
	 *
	 * Both halves matter for byte-identity. The editor omits an attribute equal to its default, so
	 * writing it out produces a delimiter that does not match what a re-save would write; and it
	 * emits them in declaration order, so an alphabetical or insertion-ordered JSON object is a
	 * diff even when every value agrees.
	 */
	private static function attributes( BlockSpec $spec ): string {
		$defaults = BlockCatalog::defaults( $spec->name );
		$given = $spec->wpAttributes();
		$out = [];

		foreach ( array_keys( BlockCatalog::describe( $spec->name )['attributes'] ?? [] ) as $key ) {
			if ( ! array_key_exists( $key, $given ) ) {
				continue;
			}

			if ( array_key_exists( $key, $defaults ) && $defaults[ $key ] === $given[ $key ] ) {
				continue;
			}

			$out[ $key ] = $given[ $key ];
		}

		// `lock` and `metadata` are not in any block.json: WordPress adds them to every block, after
		// the block's own attributes, which is where the editor writes them. A Field's Input is
		// locked against removal; `metadata` carries a Loop card's bindings and a Field part's role.
		if ( is_array( $given['lock'] ?? null ) && [] !== $given['lock'] ) {
			$out['lock'] = $given['lock'];
		}

		if ( is_array( $given['metadata'] ?? null ) && [] !== $given['metadata'] ) {
			$out['metadata'] = $given['metadata'];
		}

		if ( [] === $out ) {
			return '';
		}

		return ' ' . serialize_block_attributes( $out );
	}

	/**
	 * An attribute value escaped exactly as the editor's serializer escapes it.
	 *
	 * Not `esc_attr()`. That also encodes `'`, which `@wordpress/escape-html` leaves alone, so a
	 * link to `/o'brien` would come out one entity different from the markup the editor compares
	 * it against — valid HTML, and an invalid block. This is `escapeAttribute()` from that package:
	 * an ampersand that does not already start an entity, then `"`, `<` and `>`. Inside a
	 * double-quoted attribute that is what safety needs.
	 */
	public static function escapeAttribute( string $value ): string {
		$value = preg_replace( '/&(?!([a-z0-9]+|#[0-9]+|#x[a-f0-9]+);)/i', '&amp;', $value ) ?? '';

		return str_replace( [ '"', '<', '>' ], [ '&quot;', '&lt;', '&gt;' ], $value );
	}

	/** `blicks/box` as the delimiter writes it. */
	private static function shortName( string $name ): string {
		return str_starts_with( $name, 'core/' ) ? substr( $name, 5 ) : $name;
	}
}
