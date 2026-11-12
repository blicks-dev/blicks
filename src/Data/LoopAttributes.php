<?php
/**
 * The Loop settings that decide which items show, narrowed to their allowed shapes.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One sanitiser for a Loop's data settings, used by the page render and the editor's preview.
 *
 * Block attributes come from post content, which anyone who can edit the post can write by hand,
 * so the page trusts them no more than a REST request. Both paths run through here and get the
 * same result: the editor must never preview items the page would not show.
 *
 * Not {@see \Blicks\Http\RestArgs::object()}: that strips tags and collapses whitespace in every
 * string, which would rewrite pasted JSON (a value with `<b>` in it, or meaningful spaces) and
 * make the preview disagree with the page. `data` is kept byte for byte and only ever decoded
 * as JSON — it is never printed — and every other key is narrowed to its allow-list.
 */
final class LoopAttributes {

	private const MAX_OFFSET = 1000;
	private const MAX_FIELD = 64;

	private function __construct() {}

	/**
	 * @param mixed $attrs
	 * @return array<string, mixed>
	 */
	public static function sanitize( mixed $attrs ): array {
		$attrs = is_array( $attrs ) ? $attrs : [];
		$source = is_string( $attrs['source'] ?? null ) && ( in_array( $attrs['source'], Loop::SOURCES, true ) || LoopSources::isId( $attrs['source'] ) ) ? $attrs['source'] : 'json';

		$out = [
			'source' => $source,
			'path' => self::path( $attrs['path'] ?? '' ),
			'limit' => min( ItemPipeline::MAX_ITEMS, max( 0, (int) ( $attrs['limit'] ?? 0 ) ) ),
			'offset' => min( self::MAX_OFFSET, max( 0, (int) ( $attrs['offset'] ?? 0 ) ) ),
			'filter' => self::condition( $attrs['filter'] ?? null ),
			'sort' => self::sort( $attrs['sort'] ?? null ),
			'pagination' => Pager::sanitize( $attrs['pagination'] ?? null ),
		];

		if ( 'json' === $source ) {
			$data = is_string( $attrs['data'] ?? null ) ? $attrs['data'] : '';
			// Over the cap is refused when decoded; invalid UTF-8 is refused here.
			$out['data'] = '' === wp_check_invalid_utf8( $data ) && '' !== $data ? '' : $data;
		} elseif ( LoopSources::isId( $source ) ) {
			// Another plugin's source: its own arguments, cleaned by it. Kept as the source's id
			// even while its plugin is inactive, so turning it back on restores the Loop.
			$out['sourceArgs'] = LoopSources::args( $source, $attrs['sourceArgs'] ?? null );
		} elseif ( 'endpoint' === $source ) {
			$out['endpoint'] = is_string( $attrs['endpoint'] ?? null ) ? (string) preg_replace( '/[^a-z0-9-]/', '', $attrs['endpoint'] ) : '';
		} else {
			$out['query'] = self::query( $attrs['query'] ?? null );
		}

		return $out;
	}

	/** A dot path of plain keys ("data.items"). */
	private static function path( mixed $path ): string {
		return is_string( $path ) && 1 === preg_match( '/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/', $path ) && strlen( $path ) <= 200 ? $path : '';
	}

	/** A field name as it appears in the data: any printable text, no control characters. */
	private static function field( mixed $field ): string {
		return is_string( $field ) ? mb_substr( (string) preg_replace( '/[\x00-\x1F\x7F]/', '', $field ), 0, self::MAX_FIELD ) : '';
	}

	/** @return array{field: string, op: string, value: string}|null */
	private static function condition( mixed $filter ): ?array {
		if ( ! is_array( $filter ) ) {
			return null;
		}

		$field = self::field( $filter['field'] ?? '' );
		if ( '' === $field ) {
			return null;
		}

		return [
			'field' => $field,
			'op' => is_string( $filter['op'] ?? null ) && in_array( $filter['op'], ItemPipeline::OPS, true ) ? $filter['op'] : 'is',
			'value' => mb_substr( ItemPipeline::scalar( $filter['value'] ?? '' ), 0, 200 ),
		];
	}

	/** @return array{field: string, dir: string}|null */
	private static function sort( mixed $sort ): ?array {
		if ( ! is_array( $sort ) ) {
			return null;
		}

		$field = self::field( $sort['field'] ?? '' );

		return '' === $field ? null : [
			'field' => $field,
			'dir' => 'desc' === ( $sort['dir'] ?? 'asc' ) ? 'desc' : 'asc',
		];
	}

	/**
	 * The query settings. Values are only narrowed here; {@see QuerySource::args()} decides which
	 * post types, taxonomies and meta keys are allowed at all.
	 *
	 * @return array<string, mixed>
	 */
	private static function query( mixed $query ): array {
		if ( ! is_array( $query ) ) {
			return [];
		}

		if ( ! empty( $query['inherit'] ) ) {
			return [ 'inherit' => true ];
		}

		$out = [
			'postType' => sanitize_key( is_string( $query['postType'] ?? null ) ? $query['postType'] : 'post' ),
			'orderBy' => is_string( $query['orderBy'] ?? null ) ? mb_substr( (string) preg_replace( '/[^A-Za-z0-9_:-]/', '', $query['orderBy'] ), 0, 80 ) : 'date',
			'order' => 'asc' === ( $query['order'] ?? 'desc' ) ? 'asc' : 'desc',
			'sticky' => is_string( $query['sticky'] ?? null ) && in_array( $query['sticky'], QuerySource::STICKY, true ) ? $query['sticky'] : 'include',
			'excludeCurrent' => ! empty( $query['excludeCurrent'] ),
		];

		$author = (int) ( $query['author'] ?? 0 );
		if ( $author > 0 ) {
			$out['author'] = $author;
		}

		if ( is_array( $query['taxonomy'] ?? null ) ) {
			$tax = [];
			foreach ( array_slice( $query['taxonomy'], 0, 5, true ) as $name => $terms ) {
				$name = sanitize_key( (string) $name );
				$list = array_values( array_filter( array_map( static fn ( $t ): string => sanitize_title( ItemPipeline::scalar( $t ) ), (array) $terms ) ) );
				if ( '' !== $name && [] !== $list ) {
					$tax[ $name ] = array_slice( $list, 0, 10 );
				}
			}
			if ( [] !== $tax ) {
				$out['taxonomy'] = $tax;
			}
		}

		$meta = self::condition(
			is_array( $query['meta'] ?? null ) ? [
				'field' => $query['meta']['key'] ?? '',
				'op' => $query['meta']['op'] ?? 'is',
				'value' => $query['meta']['value'] ?? '',
			] : null
		);
		if ( null !== $meta ) {
			$out['meta'] = [
				'key' => $meta['field'],
				'op' => $meta['op'],
				'value' => $meta['value'],
			];
		}

		return $out;
	}
}
