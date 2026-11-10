<?php
/**
 * Icon path data, for writing an icon into saved markup.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

use Blicks\Core\Plugin as BlicksPlugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reproduces `renderIcon()` from the icon registry, in PHP.
 *
 * The blocks that carry an icon inline the SVG into their saved markup, so writing one of those
 * blocks from a spec means writing the same SVG the editor would — the same attributes, in the same
 * order, with the same path data. Anything else is markup the editor rejects the next time the page
 * is opened.
 *
 * **The path data is not duplicated here.** It is read from `resources/framework/icons/svg.gen.json`
 * written by the same `pnpm gen:icons` run that writes the bundle's own copy,
 * with `svg-gen.test.ts` failing if the two disagree. That is the same arrangement `BlockCatalog`
 * has with `block.json`: one source, read rather than transcribed.
 */
final class Icons {

	/** @var array{fallback: string, aliases: array<string, string>, icons: array<string, string>}|null */
	private static ?array $cache = null;

	/** Forget the parsed artifact. For tests. */
	public static function reset(): void {
		self::$cache = null;
	}

	/**
	 * The generated artifact, or an empty registry when it cannot be read.
	 *
	 * Degrading to empty rather than throwing is deliberate, and safe because of where it surfaces:
	 * {@see self::has()} then reports every icon as unknown, {@see BlockShapes} refuses every
	 * icon-bearing block, and the caller is told by name that it cannot write them. A missing
	 * artifact therefore costs a feature, not a post.
	 *
	 * @return array{fallback: string, aliases: array<string, string>, icons: array<string, string>}
	 */
	private static function registry(): array {
		if ( null !== self::$cache ) {
			return self::$cache;
		}

		$empty = [
			'fallback' => '',
			'aliases' => [],
			'icons' => [],
		];

		if ( ! class_exists( BlicksPlugin::class ) ) {
			return $empty;
		}

		$path = BlicksPlugin::path( 'resources/framework/icons/svg.gen.json' );

		if ( ! is_readable( $path ) ) {
			self::$cache = $empty;

			return self::$cache;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reads a generated artifact bundled with the plugin, not a remote URL.
		$decoded = json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $decoded ) || ! is_array( $decoded['icons'] ?? null ) ) {
			self::$cache = $empty;

			return self::$cache;
		}

		self::$cache = [
			'fallback' => is_string( $decoded['fallback'] ?? null ) ? $decoded['fallback'] : '',
			'aliases' => is_array( $decoded['aliases'] ?? null ) ? $decoded['aliases'] : [],
			'icons' => $decoded['icons'],
		];

		return self::$cache;
	}

	/** Is there any icon data at all? */
	public static function available(): bool {
		return [] !== self::registry()['icons'];
	}

	/**
	 * Resolve an alias, exactly as `resolveIconName()` does.
	 *
	 * Aliases are why this cannot be a plain array lookup: a post saved with `bolt` renders `zap`,
	 * and a serializer that missed that would write an empty icon for markup that has one.
	 */
	public static function resolve( string $name ): string {
		return self::registry()['aliases'][ $name ] ?? $name;
	}

	/**
	 * The inner SVG for a name, following the registry's own fallback.
	 *
	 * `getIcon()` falls back to `star` for an unknown name and `renderIcon()` draws it, so an
	 * unknown name produces a star rather than an empty element. Returning nothing here instead
	 * would write markup that does not match, which is the failure this whole class exists to
	 * avoid — so the fallback is reproduced rather than treated as an error case.
	 */
	public static function body( mixed $name ): string {
		$registry = self::registry();
		$key = self::resolve( (string) ( $name ?? '' ) );

		if ( isset( $registry['icons'][ $key ] ) ) {
			return $registry['icons'][ $key ];
		}

		return $registry['icons'][ $registry['fallback'] ] ?? '';
	}

	/**
	 * Is this a real icon, by name or alias — not merely something the fallback would draw?
	 *
	 * `has()` answers "can it be written", which is true of any name because an unknown one draws
	 * the fallback star. A validator wants this instead: `mountain` is a typo or a missing icon,
	 * and a page that silently shows a star is the bug.
	 */
	public static function exists( mixed $name ): bool {
		return is_string( $name ) && isset( self::registry()['icons'][ self::resolve( $name ) ] );
	}

	/**
	 * Every icon name, for a client to choose from.
	 *
	 * @return list<string>
	 */
	public static function names(): array {
		return array_keys( self::registry()['icons'] );
	}

	/** Can this name be written — either directly, by alias, or through the fallback? */
	public static function has( mixed $name ): bool {
		return '' !== self::body( $name );
	}

	/**
	 * One icon as `renderIcon()` writes it.
	 *
	 * The attribute order is copied from the JSX and matters: React emits props in the order they
	 * are written, `{ ...props }` last, so `stroke-width` follows `focusable`. Reordering these
	 * produces an SVG that is identical to a browser and a mismatch to block validation.
	 */
	public static function svg( mixed $name, float $strokeWidth ): string {
		return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" '
			. 'stroke-linejoin="round" aria-hidden="true" focusable="false" stroke-width="'
			. self::number( $strokeWidth ) . '">'
			. self::body( $name )
			. '</svg>';
	}

	/**
	 * A number as JavaScript would print it: `2`, not `2.0`, and `1.5` kept.
	 *
	 * React stringifies a numeric prop with JavaScript's own rules, so `strokeWidth: 2` reaches the
	 * DOM as `"2"`. PHP's default float formatting would write `2` here too, but `number_format` or
	 * a cast to string with a locale set would not — this pins it.
	 */
	private static function number( float $value ): string {
		if ( (float) (int) $value === $value ) {
			return (string) (int) $value;
		}

		return rtrim( rtrim( sprintf( '%.10F', $value ), '0' ), '.' );
	}
}
