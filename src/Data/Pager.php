<?php
/**
 * Splits a Loop's items into pages: which page is asked for, the links to the others, and the
 * markup of the page links or the Load more button.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Plugin as BasePlugin;

/**
 * A Loop's pages.
 *
 * **The page is in the address.** Each Loop reads its own query arg, `loop-<uniqueId>`, so two
 * Loops on one page never clash and a link on one keeps the other's arg. A Loop that uses the
 * page's own query (`query.inherit`) follows the archive instead: WordPress has already run page
 * N, and the links are its own `/page/N/`.
 *
 * **Links first.** Page numbers and Load more are plain links the server renders, so both work
 * with no script. In Load more mode the arg means "pages 1 to N" ({@see self::window()}), so the
 * no-script link and a reload after loading show the same list; `resources/runtime/loop-more.ts`
 * only fetches that same link and appends what is new.
 *
 * Every setting is narrowed to a fixed set here; nothing from post content reaches a class name
 * or an attribute unescaped.
 */
final class Pager {

	public const MODES = [ 'pages', 'more' ];
	public const SHOWS = [ 'numbers', 'count' ];
	public const LOOKS = [ 'pills', 'boxes', 'text' ];
	public const BUTTONS = [ 'default', 'outline', 'secondary', 'ghost' ];
	public const ALIGNS = [ 'start', 'center', 'end', 'between' ];
	public const LABELS = [ 'prev', 'next', 'nav', 'more', 'status' ];

	/** Items per page when the Loop's limit is 0 ("every item"). */
	public const DEFAULT_PER_PAGE = 12;

	/** The most items one address renders in Load more mode: pages 1 to N, up to this many. */
	public const MAX_STACK = 200;

	/** Page numbers either side of the current one, on wide screens and on phones. */
	private const REACH_WIDE = 2;
	private const REACH_NARROW = 1;

	private const MAX_LABEL = 80;

	private function __construct() {}

	/**
	 * The `pagination` attribute narrowed to its allowed values, or null when the Loop is not paged.
	 *
	 * @return array{mode: string, show: string, look: string, button: string, align: string, infinite: bool, labels: array<string, string>}|null
	 */
	public static function sanitize( mixed $value ): ?array {
		if ( ! is_array( $value ) || ! in_array( $value['mode'] ?? null, self::MODES, true ) ) {
			return null;
		}

		$labels = [];
		$given = is_array( $value['labels'] ?? null ) ? $value['labels'] : [];
		foreach ( self::LABELS as $key ) {
			$text = is_string( $given[ $key ] ?? null ) ? trim( sanitize_text_field( $given[ $key ] ) ) : '';
			if ( '' !== $text ) {
				$labels[ $key ] = mb_substr( $text, 0, self::MAX_LABEL );
			}
		}

		return [
			'mode' => $value['mode'],
			'show' => self::pick( $value['show'] ?? null, self::SHOWS ),
			'look' => self::pick( $value['look'] ?? null, self::LOOKS ),
			'button' => self::pick( $value['button'] ?? null, self::BUTTONS, 'outline' ),
			'align' => self::pick( $value['align'] ?? null, self::ALIGNS, 'center' ),
			'infinite' => 'more' === $value['mode'] && ! empty( $value['infinite'] ),
			'labels' => $labels,
		];
	}

	/** Items per page: the Loop's limit, or {@see self::DEFAULT_PER_PAGE} when it shows every item. */
	public static function perPage( int $limit ): int {
		return $limit > 0 ? min( ItemPipeline::MAX_ITEMS, $limit ) : self::DEFAULT_PER_PAGE;
	}

	/**
	 * The pages one address renders, as `[first, count]`. Page numbers show page N alone; Load more
	 * shows pages 1 to N, or page N alone once that would pass {@see self::MAX_STACK} items.
	 *
	 * @return array{0: int, 1: int}
	 */
	public static function window( string $mode, int $page, int $perPage ): array {
		$page = max( 1, $page );

		if ( 'more' === $mode && $page * $perPage <= self::MAX_STACK ) {
			return [ 1, $page ];
		}

		return [ $page, 1 ];
	}

	/** How many pages `$count` items make. Never less than one, so page 1 always exists. */
	public static function count( int $count, int $perPage ): int {
		return max( 1, (int) ceil( max( 0, $count ) / max( 1, $perPage ) ) );
	}

	/**
	 * The query arg a Loop's page is read from: `loop-` and its block id. A Loop with no id (one
	 * written by hand without it) is numbered in page order instead.
	 */
	public static function arg( string $uniqueId ): string {
		static $unnamed = 0;

		$id = strtolower( (string) preg_replace( '/[^A-Za-z0-9]/', '', $uniqueId ) );

		return 'loop-' . ( '' !== $id ? substr( $id, 0, 16 ) : 'n' . ( ++$unnamed ) );
	}

	/** The page a visitor asked for: the Loop's own arg, or the archive's page for an inheriting Loop. */
	public static function requested( string $arg, bool $inherit ): int {
		if ( $inherit ) {
			return max( 1, (int) get_query_var( 'paged' ) );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a page number read for display, like ?paged.
		$raw = isset( $_GET[ $arg ] ) && is_scalar( $_GET[ $arg ] ) ? sanitize_text_field( wp_unslash( (string) $_GET[ $arg ] ) ) : '';

		return 1 === preg_match( '/^\d{1,6}$/', $raw ) ? max( 1, (int) $raw ) : 1;
	}

	/**
	 * The page numbers to show around `$current`, for wide screens and phones at once.
	 *
	 * Each entry is a page number or a gap (`n` null, placed after page `after`), with which
	 * screens show it: `wide` (reach 2) and `narrow` (reach 1). One list, so the markup is the same
	 * everywhere and CSS hides the wide-only entries on phones. Shared with the editor through
	 * `tests/fixtures/loop-cases.json` ("pages").
	 *
	 * @return list<array{n: int|null, after: int, wide: bool, narrow: bool}>
	 */
	public static function sequence( int $current, int $count ): array {
		$count = max( 1, $count );
		$current = min( max( 1, $current ), $count );
		$entries = [];

		$reaches = [
			'wide' => self::REACH_WIDE,
			'narrow' => self::REACH_NARROW,
		];

		foreach ( $reaches as $screen => $reach ) {
			$last = 0;
			for ( $n = 1; $n <= $count; $n++ ) {
				if ( 1 !== $n && $count !== $n && abs( $n - $current ) > $reach ) {
					continue;
				}
				if ( $last > 0 && $n - $last > 1 ) {
					$entries[ 'g' . $last ] ??= [
						'n' => null,
						'after' => $last,
						'key' => $last + 0.5,
					];
					$entries[ 'g' . $last ][ $screen ] = true;
				}
				$entries[ 'p' . $n ] ??= [
					'n' => $n,
					'after' => $n,
					'key' => (float) $n,
				];
				$entries[ 'p' . $n ][ $screen ] = true;
				$last = $n;
			}
		}

		usort( $entries, static fn ( array $a, array $b ): int => $a['key'] <=> $b['key'] );

		return array_map(
			static fn ( array $e ): array => [
				'n' => $e['n'],
				'after' => $e['after'],
				'wide' => ! empty( $e['wide'] ),
				'narrow' => ! empty( $e['narrow'] ),
			],
			$entries
		);
	}

	/**
	 * The address of page `$n`: the archive's own for an inheriting Loop, else this address with
	 * the Loop's arg set (page 1 has none, so the plain address stays the canonical one). Other
	 * query args, another Loop's among them, are kept.
	 */
	public static function url( int $n, string $arg, bool $inherit, string $fragment = '' ): string {
		if ( $inherit ) {
			$url = get_pagenum_link( $n, false );
		} else {
			$url = $n > 1 ? add_query_arg( $arg, $n ) : remove_query_arg( $arg );
		}

		return $url . ( '' !== $fragment ? '#' . $fragment : '' );
	}

	/**
	 * The page links or the Load more button for a Loop.
	 *
	 * @param array{mode: string, show: string, look: string, button: string, align: string, infinite: bool, labels: array<string, string>} $settings
	 * @param array{page: int, pages: int, shown: int, total: int, arg: string, inherit: bool, id: string} $state
	 *   `shown` is the number of the last item on the page (Load more), `id` the wrapper's id.
	 */
	public static function markup( array $settings, array $state ): string {
		if ( 'more' === $settings['mode'] ) {
			return self::more( $settings, $state );
		}

		return $state['pages'] > 1 ? self::pages( $settings, $state ) : '';
	}

	/**
	 * @param array{mode: string, show: string, look: string, button: string, align: string, infinite: bool, labels: array<string, string>} $settings
	 * @param array{page: int, pages: int, shown: int, total: int, arg: string, inherit: bool, id: string} $state
	 */
	private static function pages( array $settings, array $state ): string {
		$labels = $settings['labels'];
		$page = $state['page'];
		$pages = $state['pages'];
		$link = static fn ( int $n ): string => esc_url( self::url( $n, $state['arg'], $state['inherit'], $state['id'] ) );

		$prev = $labels['prev'] ?? __( 'Previous', 'blicks' );
		$next = $labels['next'] ?? __( 'Next', 'blicks' );
		// Past the last page, Previous leads back to the last one.
		$html = self::step( 'prev', $prev, $page > 1 ? $link( min( $pages, $page - 1 ) ) : '' );

		if ( 'count' === $settings['show'] ) {
			$html .= '<span class="bl-loop__count">' . esc_html(
				sprintf(
					/* translators: 1: the current page, 2: how many pages there are. */
					__( 'Page %1$d of %2$d', 'blicks' ),
					min( $page, $pages ),
					$pages
				)
			) . '</span>';
		} else {
			foreach ( self::sequence( $page, $pages ) as $entry ) {
				$class = $entry['narrow'] ? '' : ' is-wide';
				if ( null === $entry['n'] ) {
					$class .= $entry['wide'] ? '' : ' is-narrow';
					$html .= '<span class="bl-loop__gap' . $class . '" aria-hidden="true">…</span>';
					continue;
				}

				$current = $entry['n'] === $page;
				$html .= sprintf(
					'<a class="bl-loop__page%1$s" href="%2$s" aria-label="%3$s"%4$s>%5$d</a>',
					$current ? ' is-current' . $class : $class,
					$link( $entry['n'] ),
					/* translators: %d: a page number. */
					esc_attr( sprintf( __( 'Page %d', 'blicks' ), $entry['n'] ) ),
					$current ? ' aria-current="page"' : '',
					$entry['n']
				);
			}
		}

		$html .= self::step( 'next', $next, $page < $pages ? $link( $page + 1 ) : '' );

		return sprintf(
			'<nav class="bl-loop__pages is-%1$s is-align-%2$s" aria-label="%3$s">%4$s</nav>',
			esc_attr( $settings['look'] ),
			esc_attr( $settings['align'] ),
			esc_attr( $labels['nav'] ?? __( 'Pages', 'blicks' ) ),
			$html
		);
	}

	/** Previous or Next: a link, or an inert placeholder at either end so the row keeps its shape. */
	private static function step( string $which, string $label, string $href ): string {
		$arrow = 'prev' === $which ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5';
		$icon = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' . $arrow . '"/></svg>';
		$word = '<span class="bl-loop__word">' . esc_html( $label ) . '</span>';
		$inside = 'prev' === $which ? $icon . $word : $word . $icon;

		if ( '' === $href ) {
			return '<span class="bl-loop__page bl-loop__' . $which . ' is-off" aria-hidden="true">' . $inside . '</span>';
		}

		return '<a class="bl-loop__page bl-loop__' . $which . '" href="' . $href . '" rel="' . $which . '">' . $inside . '</a>';
	}

	/**
	 * The count and the Load more link. The link opens the next page's address, which renders
	 * pages 1 to N + 1, and its fragment lands on the first new item.
	 *
	 * @param array{mode: string, show: string, look: string, button: string, align: string, infinite: bool, labels: array<string, string>} $settings
	 * @param array{page: int, pages: int, shown: int, total: int, arg: string, inherit: bool, id: string} $state
	 */
	private static function more( array $settings, array $state ): string {
		$labels = $settings['labels'];
		/* translators: {shown} and {total} are replaced with numbers: "Showing 12 of 34". Keep the braces. */
		$template = $labels['status'] ?? __( 'Showing {shown} of {total}', 'blicks' );
		$status = strtr(
			$template,
			[
				'{shown}' => (string) min( $state['shown'], $state['total'] ),
				'{total}' => (string) $state['total'],
			]
		);

		$html = '<p class="bl-loop__status" role="status">' . esc_html( $status ) . '</p>';

		if ( $state['page'] < $state['pages'] ) {
			$html .= sprintf(
				'<a class="bl-loop__load bl-button bl-button--%1$s bl-button--default-size" href="%2$s" data-bl-loop-more%3$s><span class="bl-button__label">%4$s</span></a>',
				esc_attr( $settings['button'] ),
				esc_url( self::url( $state['page'] + 1, $state['arg'], $state['inherit'], $state['id'] . '-' . ( $state['shown'] + 1 ) ) ),
				$settings['infinite'] ? ' data-bl-auto' : '',
				esc_html( $labels['more'] ?? __( 'Load more', 'blicks' ) )
			);
			self::enqueueScript();
		}

		return '<div class="bl-loop__more is-align-' . esc_attr( $settings['align'] ) . '">' . $html . '</div>';
	}

	/** The Load more script (resources/runtime/loop-more.ts) and the Button block's styles it borrows. */
	private static function enqueueScript(): void {
		if ( wp_style_is( 'blicks-button-style', 'registered' ) ) {
			wp_enqueue_style( 'blicks-button-style' );
		}

		if ( wp_script_is( 'blicks-loop-more', 'enqueued' ) || ! file_exists( BasePlugin::path( 'build/loop-more.js' ) ) ) {
			return;
		}

		$asset = is_readable( BasePlugin::path( 'build/loop-more.asset.php' ) ) ? include BasePlugin::path( 'build/loop-more.asset.php' ) : [];

		wp_enqueue_script(
			'blicks-loop-more',
			BasePlugin::url( 'build/loop-more.js' ),
			[],
			is_array( $asset ) ? (string) ( $asset['version'] ?? '' ) : '',
			true
		);
	}

	/** @param list<string> $allowed */
	private static function pick( mixed $value, array $allowed, string $default = '' ): string {
		return is_string( $value ) && in_array( $value, $allowed, true ) ? $value : ( '' !== $default ? $default : $allowed[0] );
	}
}
