<?php
/**
 * Every registered Blicks block, described for a machine reader.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Catalog;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Plugin as BlicksPlugin;

/**
 * Every Blicks block, described well enough for something that has never seen the codebase to
 * construct a valid block: its attributes and their defaults, and — expanded from the globs
 * `block.json` stores — the concrete list of style controls it accepts.
 *
 * Read from `block.json` rather than from the WordPress block registry on purpose. The registry
 * is only populated once `init` has run and only inside a request that registered the blocks; the
 * metadata files are always there, which keeps this usable from a unit test with no WordPress
 * loaded.
 */
final class BlockCatalog {

	/**
	 * Parsed `block.json` per slug, for the life of the request.
	 *
	 * @var array<string, array<string, mixed>>|null
	 */
	private static ?array $cache = null;

	/** Forget the parsed metadata. For tests. */
	public static function reset(): void {
		self::$cache = null;
	}

	/**
	 * This plugin's directory holding one subdirectory per block.
	 *
	 * `build/blocks` is what the release zip ships and what the blocks are registered from;
	 * `resources/blocks` is not in the zip, so reading it there left every MCP tool with an empty
	 * catalogue. The source copy is the fallback for a checkout that has not been built, which is
	 * where the PHP unit tests run. Both hold the same `block.json`.
	 */
	private static function blocksDir(): string {
		$built = BlicksPlugin::path( 'build/blocks' );

		return is_dir( $built ) ? $built : BlicksPlugin::path( 'resources/blocks' );
	}

	/**
	 * Raw `block.json` for every block, keyed by slug.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function metadata(): array {
		if ( null !== self::$cache ) {
			return self::$cache;
		}

		$blocks = [];
		$dir = self::blocksDir();

		// `__golden__` and the shared helpers sit alongside the blocks in that directory, so the
		// presence of a block.json — not the directory listing — is what defines a block.
		foreach ( (array) glob( $dir . '/*/block.json' ) as $file ) {
			if ( ! is_string( $file ) ) {
				continue;
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reads a block.json bundled with the plugin, not a remote URL.
			$decoded = json_decode( (string) file_get_contents( $file ), true );
			if ( ! is_array( $decoded ) || ! isset( $decoded['name'] ) ) {
				continue;
			}

			$blocks[ self::slug( (string) $decoded['name'] ) ] = $decoded;
		}

		ksort( $blocks );
		self::$cache = $blocks + self::companions( $blocks );

		return self::$cache;
	}

	/**
	 * Blocks a companion plugin adds to the catalogue, through `blicks_ai_block_catalog`.
	 *
	 * A companion's blocks (a header, its rows and menu items) are blocks agents should be able to
	 * describe and build, so they join the catalogue in the same shape: a `block.json` decoded,
	 * keyed by slug. The plugin's own entries win a clash and are restored after filtering — a
	 * companion can add a block here, never redefine one of ours. An entry without a `blicks/`
	 * name is dropped: the catalogue is keyed by slug, so `acme/box` would shadow `blicks/box`.
	 *
	 * Writing a companion block through MCP also needs its saved shape ({@see BlockShapes},
	 * `blicks_spec_shapes`); without one it is described but refused on save, by name.
	 *
	 * @param array<string, array<string, mixed>> $own
	 * @return array<string, array<string, mixed>>
	 */
	private static function companions( array $own ): array {
		/**
		 * More blocks for the AI catalogue: slug => decoded `block.json`.
		 *
		 * @param array<string, array<string, mixed>> $blocks The plugin's own blocks.
		 */
		$filtered = apply_filters( 'blicks_ai_block_catalog', $own );
		$added = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $meta ) {
			$name = is_array( $meta ) && is_string( $meta['name'] ?? null ) ? $meta['name'] : '';

			if ( ! str_starts_with( $name, 'blicks/' ) || isset( $own[ self::slug( $name ) ] ) ) {
				continue;
			}

			$added[ self::slug( $name ) ] = $meta;
		}

		ksort( $added );

		return $added;
	}

	/** `blicks/box` → `box`. A slug that is already bare is returned unchanged. */
	public static function slug( string $name ): string {
		$slash = strpos( $name, '/' );

		return false === $slash ? $name : substr( $name, $slash + 1 );
	}

	/**
	 * Every block name, fully qualified (`blicks/box`).
	 *
	 * @return list<string>
	 */
	public static function names(): array {
		return array_map(
			static fn ( array $meta ): string => (string) $meta['name'],
			array_values( self::metadata() )
		);
	}

	public static function has( string $name ): bool {
		return isset( self::metadata()[ self::slug( $name ) ] );
	}

	/**
	 * One block, described for a caller that has to build it.
	 *
	 * `controls` is the expanded list, not the globs `block.json` stores: a caller checking
	 * whether it may set `spacing.padding` should not have to know that the block declared
	 * `spacing.*`, nor which ids that covers. {@see ControlCatalog::expand()} resolves it against
	 * the rules the engine can actually emit, so an id that appears here is one that will survive
	 * to the page.
	 *
	 * @return array{
	 *     name: string,
	 *     title: string,
	 *     description: string,
	 *     attributes: array<string, mixed>,
	 *     controls: list<string>,
	 *     states: list<string>
	 * }|null
	 */
	public static function describe( string $name ): ?array {
		$meta = self::metadata()[ self::slug( $name ) ] ?? null;

		if ( null === $meta ) {
			return null;
		}

		$blicks = $meta['supports']['blicks'] ?? [];
		$allowList = is_array( $blicks['controls'] ?? null ) ? array_values( $blicks['controls'] ) : [];
		$states = is_array( $blicks['states'] ?? null ) ? array_values( $blicks['states'] ) : [];

		return [
			'name' => (string) $meta['name'],
			'title' => (string) ( $meta['title'] ?? '' ),
			'description' => (string) ( $meta['description'] ?? '' ),
			'attributes' => self::attributes( $meta ),
			'controls' => ControlCatalog::expand( array_map( 'strval', $allowList ) ),
			// A block that names no states gets the default-only axis. Writing a hover value on
			// such a block is not an error the engine would report — it would emit a `hov` class
			// the block's stylesheet never reacts to — so the list is stated rather than implied.
			'states' => [] === $states ? [ 'default' ] : array_map( 'strval', $states ),
		];
	}

	/**
	 * A block's `supports.blicks.controls` as `block.json` declares it, globs and all — the
	 * allow-list {@see \Blicks\Style\ElementStyle::problems()} judges against. Empty for an
	 * unknown block, which allows nothing.
	 *
	 * @return list<string>
	 */
	public static function allowList( string $name ): array {
		$controls = self::metadata()[ self::slug( $name ) ]['supports']['blicks']['controls'] ?? [];

		return is_array( $controls ) ? array_values( array_map( 'strval', $controls ) ) : [];
	}

	/**
	 * A block's attribute schemas, with empty object defaults kept as objects.
	 *
	 * `json_decode( …, true )` cannot tell `{}` from `[]`, so `"blicks": { "default": {} }` in
	 * `block.json` comes back as an empty PHP array and re-encodes as `[]`. That is not cosmetic:
	 * a caller shown `"default": []` for an object-typed attribute will write `"blicks": []`, and
	 * be refused by the validator for doing exactly what it was told. Restored by casting on the
	 * way out, where the attribute's own declared `type` says which it should be.
	 *
	 * @param array<string, mixed> $meta
	 * @return array<string, mixed>
	 */
	private static function attributes( array $meta ): array {
		if ( ! is_array( $meta['attributes'] ?? null ) ) {
			return [];
		}

		$attributes = [];

		foreach ( $meta['attributes'] as $name => $spec ) {
			if ( is_array( $spec ) && 'object' === ( $spec['type'] ?? null ) && [] === ( $spec['default'] ?? null ) ) {
				$spec['default'] = (object) [];
			}

			$attributes[ (string) $name ] = $spec;
		}

		// Every block also gets these from `defineBlock`, after its own, in this order: hiding it per
		// device, and custom HTML attributes (where Studio interactions live, as `data-bl-*`).
		$attributes['visibility'] = [
			'type' => 'object',
			'default' => (object) [],
		];
		$attributes['htmlAttributes'] = [
			'type' => 'array',
			'default' => [],
		];

		return $attributes;
	}

	/**
	 * Every block, described. The shape {@see self::describe()} returns, keyed by block name.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function all(): array {
		$described = [];

		foreach ( self::names() as $name ) {
			$one = self::describe( $name );
			if ( null !== $one ) {
				$described[ $name ] = $one;
			}
		}

		return $described;
	}

	/**
	 * The attribute defaults `block.json` declares, which are the values WordPress fills in for
	 * any attribute a caller leaves unset.
	 *
	 * @return array<string, mixed>
	 */
	public static function defaults( string $name ): array {
		$meta = self::metadata()[ self::slug( $name ) ] ?? null;

		if ( null === $meta || ! is_array( $meta['attributes'] ?? null ) ) {
			return [];
		}

		$defaults = [];

		foreach ( $meta['attributes'] as $attribute => $spec ) {
			if ( is_array( $spec ) && array_key_exists( 'default', $spec ) ) {
				$defaults[ (string) $attribute ] = $spec['default'];
			}
		}

		return $defaults;
	}
}
