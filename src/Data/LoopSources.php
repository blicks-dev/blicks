<?php
/**
 * Loop sources other plugins add.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Where a Loop's items come from, beyond the built-in pasted data, feed and WordPress query: a
 * companion plugin adds a source through the `blicks_loop_sources` filter.
 *
 * ```php
 * add_filter( 'blicks_loop_sources', function ( array $sources ): array {
 *     $sources['acme/trips'] = [
 *         'label'    => __( 'Trips', 'acme' ),
 *         'items'    => fn ( array $args, array $context ): array => acme_trips( $args ), // ordered, flat items
 *         'sanitize' => fn ( mixed $args ): array => acme_clean( $args ),               // the Loop's `sourceArgs`
 *         'sort'     => false, // the source orders its own items; the Loop's Sort does not apply
 *         'rules'    => true,  // the Loop's "Only show" rules still filter them
 *         'paged'    => false, // true: the source slices its own pages (below)
 *     ];
 *     return $sources;
 * } );
 * ```
 *
 * The Loop then treats the items like pasted data: its limit, offset and pages, and its own sort and
 * rules unless the source turns them off. An id is a namespaced slug (`vendor/name`), so it can never
 * be one of the built-ins.
 *
 * `$context` holds `current` (the post being shown or edited, 0 when none) and `parent` (the item of
 * the Loop card the Loop sits in, `null` outside a card), so a source can depend on the card around it.
 *
 * **A source that pages itself** (`'paged' => true`) is for lists longer than the
 * {@see ItemPipeline::MAX_ITEMS} a flat list is held to. Its `$context` also carries `offset` (items
 * to skip: the Loop's offset plus the pages before this one) and `limit` (how many to return), and
 * it returns `[ 'items' => …, 'total' => N ]`, N being every item it has, before the offset. It orders
 * its own items: the Loop's Order by never reorders a page. A Loop with an "Only show" rule can't be
 * paged by the source (the rule would change the count), so it gets no `offset` or `limit` and reads
 * a flat list, as any source does; a flat list returned to a paged call is read that way too.
 */
final class LoopSources {

	/** A registered source's id: `vendor/name`, lower case. */
	public const ID = '/^[a-z0-9-]+\/[a-z0-9-]+$/';

	/** @var array<string, array{label: string, items: callable, sanitize: callable|null, sort: bool, rules: bool, paged: bool}>|null */
	private static ?array $sources = null;

	private function __construct() {}

	/**
	 * Every registered source, by id. Read once per request.
	 *
	 * @return array<string, array{label: string, items: callable, sanitize: callable|null, sort: bool, rules: bool, paged: bool}>
	 */
	public static function all(): array {
		if ( null !== self::$sources ) {
			return self::$sources;
		}

		/**
		 * Filters the Loop sources other plugins add. Keyed by a namespaced id (`vendor/name`).
		 *
		 * @param array<string, array<string, mixed>> $sources
		 */
		$raw = apply_filters( 'blicks_loop_sources', [] );

		$out = [];
		foreach ( is_array( $raw ) ? $raw : [] as $id => $source ) {
			if ( ! is_string( $id ) || 1 !== preg_match( self::ID, $id ) || ! is_array( $source ) || ! is_callable( $source['items'] ?? null ) ) {
				continue;
			}
			$out[ $id ] = [
				'label' => is_string( $source['label'] ?? null ) && '' !== $source['label'] ? $source['label'] : $id,
				'items' => $source['items'],
				'sanitize' => is_callable( $source['sanitize'] ?? null ) ? $source['sanitize'] : null,
				'sort' => (bool) ( $source['sort'] ?? true ),
				'rules' => (bool) ( $source['rules'] ?? true ),
				'paged' => (bool) ( $source['paged'] ?? false ),
			];
		}

		self::$sources = $out;

		return $out;
	}

	/** @return array{label: string, items: callable, sanitize: callable|null, sort: bool, rules: bool, paged: bool}|null */
	public static function get( string $id ): ?array {
		return self::all()[ $id ] ?? null;
	}

	/** Whether a value is shaped like a registered source's id, registered or not (its plugin may be off). */
	public static function isId( mixed $id ): bool {
		return is_string( $id ) && 1 === preg_match( self::ID, $id );
	}

	/**
	 * A source's arguments, cleaned by the source. An unregistered source keeps nothing.
	 *
	 * @return array<string, mixed>
	 */
	public static function args( string $id, mixed $args ): array {
		$source = self::get( $id );
		if ( null === $source ) {
			return [];
		}

		$clean = null === $source['sanitize'] ? ( is_array( $args ) ? $args : [] ) : ( $source['sanitize'] )( $args );

		return is_array( $clean ) ? $clean : [];
	}

	/**
	 * A source's items: flat arrays, in the source's order, at most `ItemPipeline::MAX_ITEMS`.
	 * Anything else it returns is dropped, and a source that throws reads as empty.
	 *
	 * @param array<string, mixed> $args
	 * @param array{current: int, parent: array<string, mixed>|null} $context
	 * @return list<array<string, mixed>>
	 */
	public static function items( string $id, array $args, array $context ): array {
		return self::read( $id, $args, $context )['items'];
	}

	/**
	 * A source's items and, from a source that pages itself and was asked for a page (`offset` and
	 * `limit` in `$context`), how many it has in all. `total` is null for a flat list, which is held
	 * to `ItemPipeline::MAX_ITEMS`; a page is held to its `limit` and to {@see Pager::MAX_STACK}.
	 *
	 * @param array<string, mixed> $args
	 * @param array<string, mixed> $context `current`, `parent`, and for a page `offset` and `limit`.
	 * @return array{items: list<array<string, mixed>>, total: int|null}
	 */
	public static function read( string $id, array $args, array $context ): array {
		$source = self::get( $id );
		if ( null === $source ) {
			return [
				'items' => [],
				'total' => null,
			];
		}

		try {
			$got = ( $source['items'] )( $args, $context );
		} catch ( \Throwable $e ) {
			$got = [];
		}

		$asked = $source['paged'] && isset( $context['limit'] );
		$paged = $asked && is_array( $got ) && array_key_exists( 'items', $got ) && is_array( $got['items'] ) && is_numeric( $got['total'] ?? null );
		$items = $paged ? $got['items'] : $got;
		$cap = $paged ? min( Pager::MAX_STACK, max( 1, (int) $context['limit'] ) ) : ItemPipeline::MAX_ITEMS;

		$out = [];
		foreach ( is_array( $items ) ? $items : [] as $item ) {
			if ( is_array( $item ) ) {
				$out[] = $item;
			}
			if ( count( $out ) >= $cap ) {
				break;
			}
		}

		return [
			'items' => $out,
			'total' => $paged ? max( count( $out ), (int) $got['total'] ) : null,
		];
	}

	/**
	 * The sources as the editor lists them: id and label.
	 *
	 * @return list<array{id: string, label: string}>
	 */
	public static function describe(): array {
		$out = [];
		foreach ( self::all() as $id => $source ) {
			$out[] = [
				'id' => $id,
				'label' => $source['label'],
			];
		}

		return $out;
	}

	/** Forget what was read, so a test or a late registration is seen. */
	public static function reset(): void {
		self::$sources = null;
	}
}
