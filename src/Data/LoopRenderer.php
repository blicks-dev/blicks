<?php
/**
 * Renders a Loop block on the page.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Style\ElementStyle;
use WP_Block;
use WP_Block_Type_Registry;

/**
 * The Loop's markup: a list with one item per data item, each holding a copy of the card.
 *
 * ```html
 * <div class="bl-loop bl-loop--grid …" style="--bl-loop-cols-d:3;…">
 *   <ul class="bl-loop__items" role="list">
 *     <li class="bl-loop__item is-card-highlight" style="--bl-loop-c:2;--bl-loop-r:2">…card…</li>
 *   </ul>
 * </div>
 * ```
 *
 * Every layout value is narrowed here to a fixed set or a clamped number before it reaches a style
 * attribute; nothing from the data is ever part of the wrapper or the list markup.
 */
final class LoopRenderer {

	private const GAP = [
		'sm' => 'var(--blicks-spacing-sm, 0.75rem)',
		'md' => 'var(--blicks-spacing-md, 1rem)',
		'lg' => 'var(--blicks-spacing-lg, 1.5rem)',
	];

	private const LAYOUTS = [ 'grid', 'bento', 'list' ];

	/** The child block that holds what shows when there are no items. */
	public const EMPTY_BLOCK = 'blicks/loop-empty';

	/** A Dialog among the Loop's children: what a card opens, with that card's item. */
	public const DIALOG_BLOCK = 'blicks/dialog';

	/** Block context a card hands its blocks: the card's item, for a Loop inside it ({@see ItemSource}). */
	public const ITEM_CONTEXT = 'blicks/loopItem';

	/** Block context: how many Loops this one sits inside. */
	public const DEPTH_CONTEXT = 'blicks/loopDepth';

	private function __construct() {}

	/**
	 * @param array<string, mixed> $attributes
	 */
	public static function render( array $attributes, WP_Block $block ): string {
		$current = (int) ( $block->context['postId'] ?? ( function_exists( 'get_the_ID' ) ? get_the_ID() : 0 ) );
		$paging = Pager::sanitize( $attributes['pagination'] ?? null );
		$uniqueId = is_string( $attributes['uniqueId'] ?? null ) ? $attributes['uniqueId'] : '';
		$arg = Pager::arg( $uniqueId );
		$inherit = 'query' === ( $attributes['source'] ?? '' ) && is_array( $attributes['query'] ?? null ) && ! empty( $attributes['query']['inherit'] );
		// Loops inside cards inside cards stop at the cap, whatever their source.
		if ( self::depth( $block ) >= ItemSource::MAX_DEPTH ) {
			return '';
		}
		$parent = is_array( $block->context[ self::ITEM_CONTEXT ] ?? null ) ? $block->context[ self::ITEM_CONTEXT ] : null;
		$result = Loop::items( $attributes, $current, false, null === $paging ? 1 : Pager::requested( $arg, $inherit ), $parent );

		$inner = is_array( $block->parsed_block['innerBlocks'] ?? null ) ? $block->parsed_block['innerBlocks'] : [];
		$template = array_values( array_filter( $inner, static fn ( array $b ): bool => ! in_array( $b['blockName'] ?? '', [ self::EMPTY_BLOCK, self::DIALOG_BLOCK ], true ) ) );
		$empty = array_values( array_filter( $inner, static fn ( array $b ): bool => self::EMPTY_BLOCK === ( $b['blockName'] ?? '' ) ) );
		$dialogs = array_values( array_filter( $inner, static fn ( array $b ): bool => self::DIALOG_BLOCK === ( $b['blockName'] ?? '' ) ) );

		$items = is_wp_error( $result ) ? [] : $result['items'];
		// A paged Loop is a link target: its pages land on it, Load more on its first new item.
		$id = self::anchor( $attributes );
		if ( null !== $paging && '' === $id ) {
			$id = 'bl-' . $arg;
		}
		$more = null !== $paging && 'more' === $paging['mode'];
		$body = [] === $items || [] === $template
			? self::emptyState( $attributes, $empty, $block )
			: self::list( $attributes, $items, $template, $block, $dialogs[0] ?? null, $more ? $id : '', is_wp_error( $result ) ? 0 : $result['from'] );

		if ( null !== $paging && ! is_wp_error( $result ) && ( [] !== $items || $result['page'] > 1 ) ) {
			$body .= Pager::markup(
				$paging,
				[
					'page' => $result['page'],
					'pages' => $result['pages'],
					'shown' => $result['from'] + count( $items ),
					'total' => $result['found'],
					'arg' => $arg,
					'inherit' => $inherit,
					'id' => $id,
				]
			);
		}

		if ( '' === $body ) {
			return '';
		}

		$extra = null === $paging ? [] : [
			'id' => $id,
			'data-bl-loop' => substr( $arg, 5 ),
		];

		return '<div ' . self::wrapper( $attributes, $extra ) . '>' . $body . '</div>';
	}

	/**
	 * The list of items.
	 *
	 * @param array<string, mixed>       $attributes
	 * @param list<array<string, mixed>> $items
	 * @param list<array<string, mixed>> $template
	 * @param array<string, mixed>|null  $dialog The card's `blicks/dialog` child, opened by each item.
	 * @param string                     $idBase Load more: each item gets the id `<idBase>-<number>`, counting from the first page.
	 * @param int                        $from   How many items come before the first one here.
	 */
	public static function list( array $attributes, array $items, array $template, WP_Block $block, ?array $dialog = null, string $idBase = '', int $from = 0 ): string {
		$layout = self::layout( $attributes );
		$bento = is_array( $attributes['bento'] ?? null ) ? $attributes['bento'] : [];
		$tiles = is_array( $bento['tiles'] ?? null ) ? $bento['tiles'] : [];
		$repeat = ! array_key_exists( 'repeat', $bento ) || (bool) $bento['repeat'];
		$rules = is_array( $attributes['rules'] ?? null ) ? $attributes['rules'] : [];
		$context = self::context( $block );
		$html = '';
		[ $shell, $dialogId ] = null !== $dialog ? self::dialogShell( $dialog, $context ) : [ '', '' ];

		foreach ( $items as $index => $item ) {
			$span = 'bento' === $layout ? Rules::slotSpan( $tiles, $index, $repeat ) : [ 1, 1 ];
			$fx = Rules::effects( $rules, $item, $index + 1, $span );
			if ( 'list' === $layout ) {
				$fx['span'] = [ 1, 1 ];
			}

			// The card's blocks get its item and their depth: a Loop inside reads its list from them.
			$cardContext = array_merge(
				$context,
				[
					self::ITEM_CONTEXT => $item,
					self::DEPTH_CONTEXT => self::depth( $block ) + 1,
				]
			);
			$card = '';
			foreach ( Bindings::apply( $template, $item, [ self::class, 'bindable' ], $fx['hide'] ) as $parsed ) {
				$card .= ( new WP_Block( $parsed, $cardContext ) )->render();
			}

			// The card's dialog: this item's blocks, ready for the dialog behaviour to copy in.
			$open = '';
			if ( '' !== $dialogId ) {
				$open = ' data-bl-dialog="' . esc_attr( $dialogId ) . '"';
				if ( ! empty( $attributes['itemInUrl'] ) ) {
					$open .= ' data-bl-item="' . esc_attr( self::itemKey( $item, $from + $index + 1 ) ) . '"';
				}
				// Which links in the card open the dialog: those to the item's own page.
				if ( is_string( $item['url'] ?? null ) && '' !== $item['url'] ) {
					$open .= ' data-bl-url="' . esc_url( $item['url'] ) . '"';
				}
				$card .= '<template class="bl-loop__dialog"' . self::dialogRules( $fx ) . '>' . self::dialogBody( $dialog, $item, $cardContext, $fx['hide'] ) . '</template>';
			}

			$html .= '<li' . ( '' !== $idBase ? ' id="' . esc_attr( $idBase . '-' . ( $from + $index + 1 ) ) . '" tabindex="-1"' : '' ) . self::itemAttributes( $fx ) . $open . '>' . $card . '</li>';
		}

		return '<ul class="bl-loop__items" role="list">' . $html . '</ul>' . $shell;
	}

	/**
	 * The Loop's dialog, once, without its blocks: a card fills it with its own item's on open.
	 *
	 * @param array<string, mixed> $dialog  The parsed `blicks/dialog` child.
	 * @param array<string, mixed> $context
	 * @return array{0: string, 1: string} The rendered dialog and its id ('' when it has none).
	 */
	private static function dialogShell( array $dialog, array $context ): array {
		$dialog['innerBlocks'] = [];
		$dialog['innerContent'] = [ implode( '', array_filter( is_array( $dialog['innerContent'] ?? null ) ? $dialog['innerContent'] : [], 'is_string' ) ) ];
		$html = ( new WP_Block( $dialog, $context ) )->render();

		$p = new \WP_HTML_Tag_Processor( $html );
		$id = $p->next_tag( 'DIALOG' ) ? (string) $p->get_attribute( 'id' ) : '';

		return [ '' !== $id ? $html : '', $id ];
	}

	/**
	 * One item's dialog blocks, with that item's values written in as a card's are.
	 *
	 * @param array<string, mixed> $dialog
	 * @param array<string, mixed> $item
	 * @param array<string, mixed> $context
	 * @param list<string>         $hide    The uniqueIds the card's rules hide for this item.
	 */
	private static function dialogBody( array $dialog, array $item, array $context, array $hide = [] ): string {
		$inner = is_array( $dialog['innerBlocks'] ?? null ) ? $dialog['innerBlocks'] : [];
		$html = '';

		foreach ( Bindings::apply( $inner, $item, [ self::class, 'bindable' ], $hide ) as $parsed ) {
			$html .= ( new WP_Block( $parsed, $context ) )->render();
		}

		return $html;
	}

	/**
	 * What `?item=` names an item by: its `slug`, else its `id`, else its place in the Loop.
	 *
	 * @param array<string, mixed> $item
	 */
	private static function itemKey( array $item, int $position ): string {
		foreach ( [ 'slug', 'id' ] as $field ) {
			$value = $item[ $field ] ?? null;
			$key = is_scalar( $value ) ? sanitize_title( (string) $value ) : '';
			if ( '' !== $key ) {
				return $key;
			}
		}

		return (string) $position;
	}

	/**
	 * The attribute → `bindable` spec map for a block type, from its block.json.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function bindable( string $name ): array {
		static $cache = [];

		if ( ! isset( $cache[ $name ] ) ) {
			$type = WP_Block_Type_Registry::get_instance()->get_registered( $name );
			$specs = [];

			foreach ( $type && is_array( $type->attributes ) ? $type->attributes : [] as $attr => $def ) {
				if ( is_array( $def['bindable'] ?? null ) ) {
					$specs[ $attr ] = $def['bindable'];
				}
			}

			$cache[ $name ] = $specs;
		}

		return $cache[ $name ];
	}

	/**
	 * The rule classes an item's dialog takes from its card: badge and heading, not the card's own
	 * style. The dialog behaviour puts them on the blocks it copies in.
	 *
	 * @param array{badge: string, heading: string} $fx
	 */
	private static function dialogRules( array $fx ): string {
		$classes = [];
		foreach ( [ 'badge', 'heading' ] as $kind ) {
			if ( '' !== $fx[ $kind ] ) {
				$classes[] = 'is-' . $kind . '-' . $fx[ $kind ];
			}
		}

		return [] === $classes ? '' : ' data-rules="' . esc_attr( implode( ' ', $classes ) ) . '"';
	}

	/** @param array{span: array{0: int, 1: int}, card: string, badge: string, heading: string} $fx */
	private static function itemAttributes( array $fx ): string {
		$classes = [ 'bl-loop__item' ];
		foreach ( [ 'card', 'badge', 'heading' ] as $kind ) {
			if ( '' !== $fx[ $kind ] ) {
				$classes[] = 'is-' . $kind . '-' . $fx[ $kind ];
			}
		}

		[ $cols, $rows ] = $fx['span'];
		$style = 1 === $cols && 1 === $rows ? '' : sprintf( ' style="--bl-loop-c:%d;--bl-loop-r:%d"', min( 4, max( 1, $cols ) ), min( 3, max( 1, $rows ) ) );

		return ' class="' . esc_attr( implode( ' ', $classes ) ) . '"' . $style;
	}

	/**
	 * What shows when there are no items: the Empty area's blocks, the message, or nothing.
	 *
	 * @param array<string, mixed>       $attributes
	 * @param list<array<string, mixed>> $empty
	 */
	private static function emptyState( array $attributes, array $empty, WP_Block $block ): string {
		if ( [] !== $empty ) {
			$context = self::context( $block );
			$html = '';
			foreach ( is_array( $empty[0]['innerBlocks'] ?? null ) ? $empty[0]['innerBlocks'] : [] as $parsed ) {
				$html .= ( new WP_Block( $parsed, $context ) )->render();
			}

			return '' === trim( $html ) ? '' : '<div class="bl-loop__empty">' . $html . '</div>';
		}

		$text = trim( is_string( $attributes['emptyText'] ?? null ) ? $attributes['emptyText'] : '' );

		return '' === $text ? '' : '<p class="bl-loop__empty">' . esc_html( $text ) . '</p>';
	}

	/**
	 * @param array<string, mixed>  $attributes
	 * @param array<string, string> $extra Attributes a paged Loop adds: its id and `data-bl-loop`.
	 */
	private static function wrapper( array $attributes, array $extra = [] ): string {
		$layout = self::layout( $attributes );
		$props = ElementStyle::blockProps( $attributes['blicks'] ?? null, is_string( $attributes['uniqueId'] ?? null ) ? $attributes['uniqueId'] : '', 'loop' );
		$columns = is_array( $attributes['columns'] ?? null ) ? $attributes['columns'] : [];
		$bento = is_array( $attributes['bento'] ?? null ) ? $attributes['bento'] : [];
		$gap = is_string( $attributes['gap'] ?? null ) && isset( self::GAP[ $attributes['gap'] ] ) ? $attributes['gap'] : 'md';

		$vars = [
			'--bl-loop-cols-d' => self::cols( $columns['desktop'] ?? 3, 3 ),
			'--bl-loop-cols-t' => self::cols( $columns['tablet'] ?? 2, 2 ),
			'--bl-loop-cols-p' => self::cols( $columns['phone'] ?? 1, 1 ),
			'--bl-loop-gap' => self::GAP[ $gap ],
		];
		if ( 'bento' === $layout ) {
			$vars['--bl-loop-row'] = min( 480, max( 80, (int) ( $bento['rowHeight'] ?? 180 ) ) ) . 'px';
		}

		$style = $props['style'];
		foreach ( $vars as $prop => $value ) {
			$style .= ( '' !== $style ? ';' : '' ) . $prop . ':' . $value;
		}

		$class = $props['class'] . ' bl-loop--' . $layout . ( 'bento' !== $layout && false === ( $attributes['equalHeights'] ?? true ) ? ' bl-loop--top' : '' );
		$args = [
			'class' => $class,
			'style' => $style,
		];

		$anchor = self::anchor( $attributes );
		if ( '' !== $anchor ) {
			$args['id'] = $anchor;
		}

		return get_block_wrapper_attributes( $extra + $args );
	}

	/** @param array<string, mixed> $attributes */
	private static function anchor( array $attributes ): string {
		return trim( is_string( $attributes['anchor'] ?? null ) ? $attributes['anchor'] : '' );
	}

	/** @param array<string, mixed> $attributes */
	private static function layout( array $attributes ): string {
		return is_string( $attributes['layout'] ?? null ) && in_array( $attributes['layout'], self::LAYOUTS, true ) ? $attributes['layout'] : 'grid';
	}

	private static function cols( mixed $value, int $default ): int {
		$n = (int) $value;

		return $n >= 1 && $n <= 6 ? $n : $default;
	}

	/**
	 * The context the card's blocks render with: what the Loop received (postId, postType), so a
	 * core block inside a card behaves as it would outside.
	 *
	 * @return array<string, mixed>
	 */
	private static function context( WP_Block $block ): array {
		return is_array( $block->context ) ? $block->context : [];
	}

	/** How many Loops this one sits inside: 0 for a Loop on the page itself. */
	private static function depth( WP_Block $block ): int {
		return max( 0, (int) ( $block->context[ self::DEPTH_CONTEXT ] ?? 0 ) );
	}
}
