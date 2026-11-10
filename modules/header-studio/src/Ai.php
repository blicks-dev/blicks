<?php
/**
 * The header blocks for AI agents: catalogue entries and saved shapes.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Through `blicks_ai_block_catalog` agents can read the header blocks, and through
 * `blicks_spec_shapes` the serializer can write them, so an agent can build a header through MCP.
 *
 * The shapes are a PHP copy of each block's `save()` (resources/blocks/*.tsx, with the classes in
 * resources/model.ts). What keeps the copy honest is `tests/fixtures/shape-cases.json`, written by
 * the real JavaScript (tests/blocks.test.tsx) and reproduced byte for byte in ShapesTest.php.
 */
final class Ai {

	/** Option lists, the first the fallback: as `pick()` in resources/model.ts. */
	private const OPTIONS = [
		'drawerAt' => [ 'tablet', 'mobile', 'always', 'never' ],
		'mobile' => [ 'drill', 'accordion' ],
		'preset' => [ 'classic', 'centred', 'stacked', 'custom' ],
		'slot' => [ 'start', 'centre', 'end' ],
		'openOn' => [ 'hover', 'click' ],
		'width' => [ 'container', 'full', 'content' ],
		'animation' => [ 'fade', 'slide', 'none' ],
	];

	/**
	 * The catalogue with the header blocks added, each its decoded block.json.
	 *
	 * @param array<string, mixed> $blocks
	 * @return array<string, mixed>
	 */
	public static function catalog( array $blocks, string $dir ): array {
		foreach ( Module::BLOCKS as $name ) {
			$file = $dir . '/' . $name . '/block.json';
			$meta = is_readable( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file.

			if ( is_array( $meta ) && ! isset( $blocks[ $name ] ) ) {
				$blocks[ $name ] = $meta;
			}
		}

		return $blocks;
	}

	/**
	 * @param mixed $shapes The serializer's shapes so far, block name => shape.
	 * @return array<string, mixed>
	 */
	public static function shapes( mixed $shapes ): array {
		return ( is_array( $shapes ) ? $shapes : [] ) + self::all();
	}

	/** @return array<string, array<string, mixed>> */
	public static function all(): array {
		return [
			'blicks/header' => [
				'tag' => 'header',
				'classes' => static fn ( array $a ): array => array_values(
					array_filter(
						[
							self::truthy( $a['sticky'] ?? null ) ? 'bl-header--sticky' : '',
							self::truthy( $a['shrink'] ?? null ) ? 'bl-header--shrink' : '',
							self::truthy( $a['overHero'] ?? null ) ? 'bl-header--over' : '',
							self::truthy( $a['hideOnScroll'] ?? null ) ? 'bl-header--hide' : '',
							'accordion' === self::option( 'mobile', $a ) ? 'bl-header--accordion' : '',
							'tablet' !== self::option( 'drawerAt', $a ) ? 'bl-header--drawer-' . self::option( 'drawerAt', $a ) : '',
						]
					)
				),
			],
			'blicks/header-row' => [
				'tag' => 'div',
				'classes' => static fn ( array $a ): array => [ 'bl-header-row--' . self::option( 'preset', $a ) ],
			],
			'blicks/header-area' => [
				'tag' => 'div',
				'classes' => static fn ( array $a ): array => [ 'bl-header-area--' . self::option( 'slot', $a ) ],
			],
			'blicks/nav' => [
				'tag' => 'nav',
				'attrs' => static fn ( array $a ): array => [ 'aria-label' => self::truthy( $a['label'] ?? null ) ? (string) $a['label'] : 'Main' ],
				'inner' => static fn (): array => [
					'tag' => 'ul',
					'class' => 'bl-nav__list',
				],
			],
			// A link, or a disclosure button for its mega menu, ahead of the mega menu itself.
			'blicks/nav-item' => [
				'tag' => 'li',
				'classes' => static fn ( array $a ): array => self::truthy( $a['hasPanel'] ?? null ) ? [ 'has-panel' ] : [],
				'prepend' => static function ( array $a ): string {
					$label = (string) ( $a['label'] ?? '' );

					if ( self::truthy( $a['hasPanel'] ?? null ) ) {
						return '<button class="bl-nav-item__toggle" type="button" aria-expanded="false">' . $label . '</button>';
					}

					$url = trim( (string) ( $a['url'] ?? '' ) );
					$target = (string) ( $a['linkTarget'] ?? '' );
					$link = ( '' !== $url ? ' href="' . self::escape( $url ) . '"' : '' )
						. ( '' !== $target ? ' target="' . self::escape( $target ) . '"' : '' )
						. ( '_blank' === $target ? ' rel="noopener"' : '' );

					return '<a class="bl-nav-item__link"' . $link . '>' . $label . '</a>';
				},
			],
			'blicks/mega-panel' => [
				'tag' => 'div',
				'classes' => static fn ( array $a ): array => array_values(
					array_filter(
						[
							'click' === self::option( 'openOn', $a ) ? 'bl-mega-panel--on-click' : '',
							'container' !== self::option( 'width', $a ) ? 'bl-mega-panel--w-' . self::option( 'width', $a ) : '',
							'fade' !== self::option( 'animation', $a ) ? 'bl-mega-panel--m-' . self::option( 'animation', $a ) : '',
							self::truthy( $a['closeOnScroll'] ?? null ) ? 'bl-mega-panel--scroll-closes' : '',
						]
					)
				),
			],
			// Dynamic: saved as its settings only, a self-closing delimiter.
			'blicks/link-list' => [
				'empty' => static fn (): bool => true,
			],
		];
	}

	/**
	 * @param array<string, mixed> $a
	 */
	private static function option( string $key, array $a ): string {
		$value = $a[ $key ] ?? null;

		return in_array( $value, self::OPTIONS[ $key ], true ) ? (string) $value : self::OPTIONS[ $key ][0];
	}

	/** JavaScript's truthiness, for an attribute read as `a.x ? … : …`. */
	private static function truthy( mixed $value ): bool {
		return ! in_array( $value, [ null, false, 0, 0.0, '' ], true );
	}

	/** An attribute value as the editor's serializer escapes it (`@wordpress/escape-html`). */
	private static function escape( string $value ): string {
		$value = preg_replace( '/&(?!([a-z0-9]+|#[0-9]+|#x[a-f0-9]+);)/i', '&amp;', $value ) ?? '';

		return str_replace( [ '"', '<', '>' ], [ '&quot;', '&lt;', '&gt;' ], $value );
	}
}
