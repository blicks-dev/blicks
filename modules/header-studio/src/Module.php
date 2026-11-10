<?php
/**
 * Registers the Header Studio blocks, their script and styles, and their hooks.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The provider. Public hooks only, as Blicks Pro will load it after the move:
 *
 *  - one editor script, after the free plugin's `blicks-editor`, which registers the blocks through
 *    `window.blicks.blocks.defineBlock`, and one stylesheet for the page and the editor;
 *  - each block from its own `blocks/<name>/block.json`;
 *  - `render_block`, before the behaviour registry reads the page (priority 100), for the drawer
 *    and the behaviours' directives ({@see Render});
 *  - `blicks_ai_block_catalog` and `blicks_spec_shapes` ({@see Ai});
 *  - with the Studio, the header mode (`blicks_studio_modes`, which also puts `blicks-studio` ahead
 *    of the script), and Blicks › Headers (`blicks_admin_views`, {@see AdminView});
 *  - header patterns for the Site Editor ({@see Patterns}), and the agents' header tools on the
 *    Blicks MCP server ({@see Agents}).
 */
final class Module {

	public const HANDLE = 'blicks-pro-header-studio';

	public const ADMIN_HANDLE = 'blicks-pro-header-studio-admin';

	/** The blocks, by folder under `blocks/`. */
	public const BLOCKS = [ 'header', 'header-row', 'header-area', 'nav', 'nav-item', 'mega-panel', 'link-list' ];

	public function __construct( private readonly string $dir ) {
	}

	public function register(): void {
		add_action( 'init', [ $this, 'registerAssets' ], 9 );
		add_action( 'init', [ $this, 'registerBlocks' ] );
		add_filter( 'render_block', [ Render::class, 'block' ], 30, 2 );
		add_filter( 'blicks_ai_block_catalog', [ $this, 'catalog' ] );
		add_filter( 'blicks_spec_shapes', [ Ai::class, 'shapes' ] );
		add_filter( 'blicks_studio_modes', [ $this, 'modes' ] );
		add_filter( 'blicks_admin_views', [ AdminView::class, 'views' ] );
		add_action( 'rest_api_init', [ AdminView::class, 'routes' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueueAdmin' ], 20 );

		$patterns = new Patterns( $this->dir );
		add_action( 'init', [ $patterns, 'register' ], 20 );
		( new Agents( $patterns ) )->register();
	}

	/**
	 * Where the Studio loads, the header mode loads with it: the script now needs `blicks-studio`
	 * ahead of it, so it finds `window.blicks.studio`.
	 *
	 * @param mixed $handles The Studio's mode handles so far.
	 * @return list<string>
	 */
	public function modes( mixed $handles ): array {
		$script = wp_scripts()->query( self::HANDLE );

		if ( $script && ! in_array( 'blicks-studio', $script->deps, true ) ) {
			$script->deps[] = 'blicks-studio';
		}

		return [ ...( is_array( $handles ) ? $handles : [] ), self::HANDLE ];
	}

	/** Blicks › Headers: the bundle, with the free admin app it registers its view in. */
	public function enqueueAdmin(): void {
		if ( ! AdminView::current() || ! current_user_can( 'edit_theme_options' ) || ! wp_script_is( 'blicks-admin', 'enqueued' ) ) {
			return;
		}

		$asset = $this->dir . '/build/index.asset.php';
		$manifest = is_readable( $asset ) ? require $asset : [];
		$version = is_array( $manifest ) && is_string( $manifest['version'] ?? null ) ? $manifest['version'] : false;

		wp_enqueue_script(
			self::ADMIN_HANDLE,
			plugins_url( 'build/index.js', $this->dir . '/module.php' ),
			array_values( array_unique( array_merge( [ 'blicks-admin' ], is_array( $manifest['dependencies'] ?? null ) ? $manifest['dependencies'] : [] ) ) ),
			$version,
			[ 'in_footer' => true ]
		);
		wp_add_inline_script( self::ADMIN_HANDLE, self::dataScript(), 'before' );
		wp_set_script_translations( self::ADMIN_HANDLE, 'blicks-pro' );
	}

	/** What the editor bundle reads first: the theme, the capability, the Site Editor's address. */
	public static function dataScript(): string {
		return 'window.blicksHeaderStudio = ' . wp_json_encode(
			[
				'theme' => get_stylesheet(),
				'canManage' => current_user_can( 'edit_theme_options' ) && wp_is_block_theme(),
				'siteEditor' => admin_url( 'site-editor.php' ),
			]
		) . ';';
	}

	public function registerAssets(): void {
		$asset = $this->dir . '/build/index.asset.php';
		$manifest = is_readable( $asset ) ? require $asset : [];
		$version = is_array( $manifest ) && is_string( $manifest['version'] ?? null ) ? $manifest['version'] : false;
		$deps = is_array( $manifest ) && is_array( $manifest['dependencies'] ?? null ) ? $manifest['dependencies'] : [];

		wp_register_script(
			self::HANDLE,
			plugins_url( 'build/index.js', $this->dir . '/module.php' ),
			array_values( array_unique( array_merge( [ 'blicks-editor' ], $deps ) ) ),
			$version,
			[ 'in_footer' => true ]
		);
		wp_set_script_translations( self::HANDLE, 'blicks-pro' );
		wp_add_inline_script( self::HANDLE, self::dataScript(), 'before' );

		wp_register_style( self::HANDLE, plugins_url( 'build/index.css', $this->dir . '/module.php' ), [], $version );
	}

	public function registerBlocks(): void {
		foreach ( self::BLOCKS as $name ) {
			register_block_type(
				$this->dir . '/blocks/' . $name,
				'link-list' === $name ? [ 'render_callback' => [ LinkList::class, 'render' ] ] : []
			);
		}
	}

	/**
	 * @param mixed $blocks The catalogue so far, slug => decoded block.json.
	 * @return array<string, mixed>
	 */
	public function catalog( mixed $blocks ): array {
		return Ai::catalog( is_array( $blocks ) ? $blocks : [], $this->dir . '/blocks' );
	}
}
