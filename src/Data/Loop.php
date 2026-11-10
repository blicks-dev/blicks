<?php
/**
 * A Loop's items, from whichever source it reads.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Error;

/**
 * The one way to get a Loop's items: the block's render and the editor's preview both come here,
 * so the editor shows exactly what the page will.
 */
final class Loop {

	public const SOURCES = [ 'json', 'endpoint', 'query' ];

	private function __construct() {}

	/**
	 * The items a Loop shows, after its filter, sort, offset and limit — and, for a paged Loop, the
	 * page asked for.
	 *
	 * A paged Loop ({@see Pager}) takes its limit as the items per page. `page` is the page asked
	 * for, `pages` how many there are, `found` how many items there are on every page together
	 * (the "of M" a visitor reads) and `from` how many come before the first one returned. An
	 * unpaged Loop returns page 1 of 1, with `found` the items that match.
	 *
	 * @param array<string, mixed> $attrs   The Loop block's attributes.
	 * @param int                  $current The post the Loop is on, for "leave out the current page".
	 * @param bool                 $wait    Refresh an endpoint now rather than from the background queue.
	 * @param int                  $page    The page asked for; ignored unless the Loop is paged.
	 * @return array{items: list<array<string, mixed>>, fields: list<array{key: string, type: string}>, total: int, matched: int, path: string, lists: list<array{path: string, count: int}>, endpoint: array{fetchedAt: int, stale: bool, error: string}|null, page: int, pages: int, perPage: int, found: int, from: int}|WP_Error
	 */
	public static function items( array $attrs, int $current = 0, bool $wait = false, int $page = 1 ): array|WP_Error {
		$attrs = LoopAttributes::sanitize( $attrs );
		$source = $attrs['source'];
		$path = $attrs['path'];
		$paging = $attrs['pagination'];
		$page = null === $paging ? 1 : max( 1, $page );
		$limit = (int) ( $attrs['limit'] ?? 0 );
		$offset = (int) ( $attrs['offset'] ?? 0 );
		$perPage = null === $paging ? $limit : Pager::perPage( $limit );
		[ $first, $span ] = null === $paging ? [ 1, 1 ] : Pager::window( $paging['mode'], $page, $perPage );
		$from = ( $first - 1 ) * $perPage;
		$config = [
			'filter' => $attrs['filter'] ?? null,
			'sort' => 'query' === $source ? null : ( $attrs['sort'] ?? null ),
			'offset' => $offset + ( null === $paging ? 0 : $from ),
			'limit' => null === $paging ? $limit : $span * $perPage,
			'max' => null === $paging ? ItemPipeline::MAX_ITEMS : $span * $perPage,
		];

		if ( 'query' === $source ) {
			$query = is_array( $attrs['query'] ?? null ) ? $attrs['query'] : [];

			if ( null !== $paging && ! empty( $query['inherit'] ) ) {
				// The archive decides the page size; the window is redrawn on its pages.
				$main = QuerySource::inherited( 1, 1 );
				$perPage = $main['perPage'];
				[ $first, $span ] = Pager::window( $paging['mode'], $page, $perPage );
				$read = 1 === $first ? QuerySource::inherited( 1, $span ) : $main;
				$from = ( $first - 1 ) * $perPage;
				$found = $read['found'];
				$pages = $read['pages'];
				$config['max'] = $span * $perPage;
			} elseif ( ! empty( $query['inherit'] ) ) {
				// Unpaged on the page's own query: whatever the archive found, as before pages.
				$read = [ 'items' => QuerySource::items( $query, $limit, $offset, $current ) ];
				$found = count( $read['items'] );
				$pages = 1;
			} else {
				$read = QuerySource::read( $query, (int) $config['limit'], (int) $config['offset'], $current, null !== $paging );
				$found = max( 0, $read['found'] - ( null === $paging ? 0 : $offset ) );
				$pages = null === $paging ? 1 : Pager::count( $found, $perPage );
			}

			$all = $read['items'];
			$run = ItemPipeline::run( $all, $config, true );

			return $run + [
				'fields' => ItemPipeline::fields( $all ),
				'path' => '',
				'lists' => [],
				'endpoint' => null,
				'page' => $page,
				'pages' => $pages,
				'perPage' => $perPage,
				'found' => null === $paging ? $run['matched'] : $found,
				'from' => $from,
			];
		}

		$endpoint = null;

		if ( 'endpoint' === $source ) {
			$read = EndpointSource::read( is_string( $attrs['endpoint'] ?? null ) ? $attrs['endpoint'] : '', $wait );
			if ( is_wp_error( $read ) ) {
				return $read;
			}
			$value = $read['value'];
			$endpoint = [
				'fetchedAt' => $read['fetchedAt'],
				'stale' => $read['stale'],
				'error' => $read['error'],
			];
		} else {
			$value = JsonSource::decode( is_string( $attrs['data'] ?? null ) ? $attrs['data'] : '' );
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}

		$found = JsonSource::items( $value, $path );
		if ( is_wp_error( $found ) ) {
			return $found;
		}

		// Paged on the server, over the whole list after its filter and sort: an endpoint is read
		// once and cached, so page N costs no request, and "of M" is known.
		$run = ItemPipeline::run( $found['items'], $config );
		$count = max( 0, $run['matched'] - $offset );

		return $run + [
			'fields' => ItemPipeline::fields( $found['items'] ),
			'path' => $found['path'],
			'lists' => JsonSource::lists( $value ),
			'endpoint' => $endpoint,
			'page' => $page,
			'pages' => null === $paging ? 1 : Pager::count( $count, $perPage ),
			'perPage' => $perPage,
			'found' => null === $paging ? $run['matched'] : $count,
			'from' => $from,
		];
	}
}
