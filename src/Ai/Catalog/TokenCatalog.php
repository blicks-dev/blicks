<?php
/**
 * The site's live design tokens, described for a machine reader.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Catalog;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Catalogue;

/**
 * The design tokens this site actually has, with the values they currently resolve to.
 *
 * This is the difference between a layout that looks like the site and one that looks like every
 * other AI-generated page. A model given no tokens writes `#4f46e5` and `24px`; a model given
 * `primary` and `lg` writes `var(--blicks-color-primary)` and `var(--blicks-spacing-lg)`, and the
 * result re-themes with the site instead of fossilising today's palette. Handing over the resolved
 * values as well as the slugs is what lets it choose sensibly — `sm` versus `xl` means nothing
 * until you can see that one is `0.5rem` and the other `3rem`.
 *
 * Every category the snapshot carries is included, `color` and `fontFamily` among them.
 * {@see Catalogue::tokenCatalogue()} deliberately omits those two because the editor bridges them
 * separately for its pickers; here they are the most useful entries there are, and a fixed list of
 * categories would go stale the first time one is added.
 *
 * The split mirrors {@see \Blicks\Ai\Spec\SpecParser}: {@see self::fromSnapshot()} is a pure
 * projection and carries the tests, while {@see self::all()} is the thin call into WordPress.
 */
final class TokenCatalog {

	/**
	 * Every token on this site: category → slug → resolved CSS value.
	 *
	 * Needs WordPress — the snapshot reads Global Styles and the plugin's own options. Not cached:
	 * a token edited in the admin must be visible to the next request without a flush, and the
	 * snapshot does its own work anyway.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function all(): array {
		return self::fromSnapshot( Catalogue::snapshot() );
	}

	/**
	 * Project a design-system snapshot into category → slug → value.
	 *
	 * A slug with no resolved value is kept with an empty string rather than dropped. It is a real
	 * token — the inspector offers it — and silently omitting it would tell a caller the slug does
	 * not exist, which is a worse answer than "it exists and currently resolves to nothing".
	 *
	 * @param array<string, mixed> $snapshot As returned by `Catalogue::snapshot()`.
	 * @return array<string, array<string, string>>
	 */
	public static function fromSnapshot( array $snapshot ): array {
		$tokens = is_array( $snapshot['tokens'] ?? null ) ? $snapshot['tokens'] : [];
		$values = is_array( $snapshot['values'] ?? null ) ? $snapshot['values'] : [];

		$catalogue = [];

		foreach ( $tokens as $category => $slugs ) {
			if ( ! is_string( $category ) || ! is_array( $slugs ) ) {
				continue;
			}

			$byCategory = is_array( $values[ $category ] ?? null ) ? $values[ $category ] : [];
			$rows = [];

			foreach ( $slugs as $slug ) {
				if ( ! is_string( $slug ) || '' === $slug ) {
					continue;
				}

				$value = $byCategory[ $slug ] ?? '';
				$rows[ $slug ] = is_scalar( $value ) ? (string) $value : '';
			}

			$catalogue[ $category ] = $rows;
		}

		ksort( $catalogue );

		return $catalogue;
	}

	/**
	 * The token categories this site has — `color`, `spacing`, `radius` and the rest.
	 *
	 * @param array<string, array<string, string>>|null $catalogue Reuse one already computed.
	 * @return list<string>
	 */
	public static function categories( ?array $catalogue = null ): array {
		return array_keys( $catalogue ?? self::all() );
	}

	/**
	 * The slugs in one category, or an empty list if the category is unknown.
	 *
	 * @param array<string, array<string, string>>|null $catalogue Reuse one already computed.
	 * @return list<string>
	 */
	public static function slugs( string $category, ?array $catalogue = null ): array {
		$catalogue ??= self::all();

		return array_keys( $catalogue[ $category ] ?? [] );
	}

	/**
	 * Is this a real slug in this category?
	 *
	 * Not the same question as `Tokens::isToken()`, which the spec validator uses. That reads the
	 * plugin's compiled catalogue; this reads what the *active theme* projects, which is a
	 * different and usually larger set — a theme's own palette slugs live here and not there.
	 *
	 * @param array<string, array<string, string>>|null $catalogue Reuse one already computed.
	 */
	public static function has( string $category, string $slug, ?array $catalogue = null ): bool {
		$catalogue ??= self::all();

		return isset( $catalogue[ $category ][ $slug ] );
	}

	/**
	 * The site's breakpoints, as id → label and max width.
	 *
	 * Sits here rather than on the control catalogue because it is site configuration, not engine
	 * capability: `ControlCatalog::BREAKPOINTS` says which axes exist, this says what they mean.
	 *
	 * They are **max** widths, and the direction matters to anything writing responsive values:
	 * `base` is the unbounded default (`maxWidth` null), `tablet` applies at 782px and below, and
	 * `mobile` at 600px and below. So a value set on `base` is what wide screens get, and the
	 * narrower keys override it downward — the opposite of a mobile-first framework, and an easy
	 * thing to get backwards when generating a layout.
	 *
	 * @param array<string, mixed>|null $snapshot Reuse one already computed.
	 * @return array<string, array{label: string, maxWidth: int|null}>
	 */
	public static function breakpoints( ?array $snapshot = null ): array {
		$snapshot ??= Catalogue::snapshot();
		$breakpoints = is_array( $snapshot['breakpoints'] ?? null ) ? $snapshot['breakpoints'] : [];

		$out = [];

		// A list of `{ id, label, max }` rows, keyed here by id so a caller can look one up
		// without scanning.
		foreach ( $breakpoints as $row ) {
			if ( ! is_array( $row ) || ! is_string( $row['id'] ?? null ) || '' === $row['id'] ) {
				continue;
			}

			$max = $row['max'] ?? null;

			$out[ $row['id'] ] = [
				'label' => is_string( $row['label'] ?? null ) ? $row['label'] : $row['id'],
				'maxWidth' => is_numeric( $max ) ? (int) $max : null,
			];
		}

		return $out;
	}
}
