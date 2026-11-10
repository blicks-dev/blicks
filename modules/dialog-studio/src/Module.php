<?php
/**
 * Dialog Studio's provider: every hook the module adds, in one place.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Public hooks only. The editor script is one bundle (`build/index.js`) registered under two
 * handles: with the Studio in the block editor, where it adds the dialog mode, its panels, its
 * "+ New" item and the saved dialogs in the Button's picker; and with the Blicks admin app, where it
 * adds the Dialogs view. It checks which of `window.blicks.studio` and `window.blicks.admin` it found.
 */
final class Module {

	public const HANDLE = 'blicks-pro-dialog-studio';

	public const ADMIN_HANDLE = 'blicks-pro-dialog-studio-admin';

	private Printer $printer;

	public function __construct( private readonly string $dir ) {
		$this->printer = Printer::shared();
	}

	public function register(): void {
		add_action( 'init', [ PostType::class, 'register' ] );
		add_filter( 'blicks_studio_entity_types', [ PostType::class, 'entityTypes' ] );
		add_filter( 'blicks_studio_entity_used_on', [ Openers::class, 'usedOn' ], 10, 2 );
		add_action( 'wp_after_insert_post', [ $this, 'saved' ], 10, 1 );

		// The page.
		add_filter( 'render_block', [ $this->printer, 'openers' ], 25, 2 );
		add_action( 'blicks_dialog_missing', [ $this->printer, 'missing' ] );
		add_filter( 'blicks_dialog_markup', [ $this->printer, 'markup' ], 10, 1 );
		add_action( 'init', [ $this, 'registerAutoModule' ] );
		add_action( 'wp_enqueue_scripts', [ $this->printer, 'enqueue' ] );
		// With the free plugin's own footer step (4), before the scoped CSS is gathered (5).
		add_action( 'wp_footer', [ $this->printer, 'footer' ], 4 );

		// Counts and the Dialogs view.
		add_action( 'rest_api_init', [ Stats::class, 'routes' ] );
		add_action( 'rest_api_init', [ AdminView::class, 'routes' ] );
		add_action( 'admin_init', [ Stats::class, 'install' ] );
		add_filter( 'blicks_admin_views', [ AdminView::class, 'views' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueueAdmin' ], 20 );
		add_filter( 'script_module_data_' . Printer::AUTO, [ $this, 'autoData' ] );

		// The editor: before the Studio enqueues (priority 10), so the handle is registered when named.
		add_action( 'enqueue_block_editor_assets', [ $this, 'registerEditorScript' ], 5 );
		add_filter( 'blicks_studio_modes', [ $this, 'modes' ] );
	}

	public function printer(): Printer {
		return $this->printer;
	}

	/** @param mixed $postId */
	public function saved( mixed $postId ): void {
		Library::sync( (int) $postId );
	}

	/** `@blicks-pro/dialog-auto`, the automatic triggers: a script module beside `@blicks/dialog`. */
	public function registerAutoModule(): void {
		$asset = $this->dir . '/build/view/auto.asset.php';

		if ( ! is_readable( $asset ) ) {
			return;
		}

		$manifest = require $asset;

		wp_register_script_module(
			Printer::AUTO,
			plugins_url( 'build/view/auto.js', $this->dir . '/module.php' ),
			[ '@wordpress/interactivity', Printer::BEHAVIOUR ],
			is_array( $manifest ) ? ( $manifest['version'] ?? false ) : false
		);
	}

	/**
	 * What `@blicks-pro/dialog-auto` reads from the page: where to send a shown or converted event.
	 *
	 * @param mixed $data
	 * @return array<string, mixed>
	 */
	public function autoData( mixed $data ): array {
		return [
			...( is_array( $data ) ? $data : [] ),
			'events' => rest_url( Stats::NS . '/dialogs/' ),
		];
	}

	/** Blicks › Dialogs: the bundle, with the free admin app it registers its view in. */
	public function enqueueAdmin(): void {
		if ( ! AdminView::current() || ! current_user_can( 'edit_theme_options' ) || ! wp_script_is( 'blicks-admin', 'enqueued' ) ) {
			return;
		}

		if ( $this->registerScript( self::ADMIN_HANDLE, 'blicks-admin' ) ) {
			wp_add_inline_script( self::ADMIN_HANDLE, 'window.blicksDialogStudio = ' . wp_json_encode( $this->editorData() ) . ';', 'before' );
			wp_enqueue_script( self::ADMIN_HANDLE );
		}
	}

	public function registerEditorScript(): void {
		if ( ! $this->registerScript( self::HANDLE, 'blicks-studio' ) ) {
			return;
		}

		wp_add_inline_script( self::HANDLE, 'window.blicksDialogStudio = ' . wp_json_encode( $this->editorData() ) . ';', 'before' );
	}

	/**
	 * @param mixed $handles The Studio's mode handles so far.
	 * @return list<string>
	 */
	public function modes( mixed $handles ): array {
		return [ ...( is_array( $handles ) ? $handles : [] ), self::HANDLE ];
	}

	/** @return array<string, mixed> */
	private function editorData(): array {
		return [
			'targets' => current_user_can( 'edit_posts' ) ? Library::targets() : [],
			'canManage' => current_user_can( 'edit_theme_options' ),
			'restBase' => 'blicks-dialogs',
			'postType' => Library::TYPE,
		];
	}

	/** Register the module's bundle under a handle, depending on one of the free plugin's. */
	private function registerScript( string $handle, string $host ): bool {
		$asset = $this->dir . '/build/index.asset.php';

		if ( ! is_readable( $asset ) ) {
			return false;
		}

		$manifest = require $asset;

		wp_register_script(
			$handle,
			plugins_url( 'build/index.js', $this->dir . '/module.php' ),
			array_values( array_unique( array_merge( [ $host ], (array) ( $manifest['dependencies'] ?? [] ) ) ) ),
			$manifest['version'] ?? false,
			[ 'in_footer' => true ]
		);
		wp_set_script_translations( $handle, 'blicks-pro' );

		if ( is_readable( $this->dir . '/build/index.css' ) ) {
			wp_enqueue_style( $handle, plugins_url( 'build/index.css', $this->dir . '/module.php' ), [], $manifest['version'] ?? false );
		}

		return true;
	}
}
