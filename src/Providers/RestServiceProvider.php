<?php
/**
 * Registers the plugin's REST API routes.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\ServiceProvider;
use Blicks\Core\Attributes\Action;
use Blicks\Core\Http\Rest;
use Blicks\Http\RestArgs;
use Blicks\Http\Controllers\AnimationsController;
use Blicks\Http\Controllers\DashboardController;
use Blicks\Http\Controllers\DesignSystemController;
use Blicks\Http\Controllers\DiagnosticsController;
use Blicks\Http\Controllers\SettingsController;
use Blicks\Http\Controllers\DesignLanguageController;
use Blicks\Http\Controllers\KitsController;
use Blicks\Http\Controllers\MarketplaceController;
use Blicks\Http\Controllers\ThemesController;
use Blicks\Http\Controllers\LoopController;
use Blicks\Http\Controllers\EntriesController;
use Blicks\Http\Controllers\FormsController;
use Blicks\Http\Controllers\FormsSettingsController;
use Blicks\Data\EndpointRegistry;
use Blicks\Data\LoopAttributes;
use Blicks\Studio\EntityRef;

/**
 * Registers the plugin's REST API routes.
 */
final class RestServiceProvider extends ServiceProvider {

	// Declared on `init` (not `rest_api_init`): the Rest facade collects routes now and
	// registers them on its own `rest_api_init` hook, which must be attached beforehand.
	//
	// Every argument below carries a sanitize_callback (see Blicks\Http\RestArgs) — a bare
	// 'type' is advisory and does not cause WordPress to sanitize anything. Structured payloads
	// are narrowed a second time by the allowlist validators that own each shape.
	#[Action( 'init' )]
	public function registerRoutes(): void {
		Rest::get( 'blicks/v1', 'dashboard', [ DashboardController::class, 'summary' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::get( 'blicks/v1', 'diagnostics', [ DiagnosticsController::class, 'run' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::get( 'blicks/v1', 'design-system', [ DesignSystemController::class, 'show' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::patch( 'blicks/v1', 'design-system', [ DesignSystemController::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'tokens' => RestArgs::object(),
					'breakpoints' => RestArgs::object(),
					'typeRoles' => RestArgs::object(),
					'customSlugs' => RestArgs::object(),
					'reset' => RestArgs::list(),
				]
			);

		// The design language: a layer of shape values under the saved ones.
		Rest::get( 'blicks/v1', 'design-system/language', [ DesignLanguageController::class, 'index' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::post( 'blicks/v1', 'design-system/language', [ DesignLanguageController::class, 'choose' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		// Kits: a design language, a palette and someone's own values, saved together.
		Rest::get( 'blicks/v1', 'design-system/kits', [ KitsController::class, 'index' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::post( 'blicks/v1', 'design-system/kits', [ KitsController::class, 'create' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'name' => RestArgs::text( true ) ] );

		Rest::patch( 'blicks/v1', 'design-system/kits/(?P<id>[A-Za-z0-9_-]+)', [ KitsController::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'id' => RestArgs::identifier( true ),
					'name' => RestArgs::text( true ),
				]
			);

		Rest::delete( 'blicks/v1', 'design-system/kits/(?P<id>[A-Za-z0-9_-]+)', [ KitsController::class, 'remove' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		Rest::post( 'blicks/v1', 'design-system/kits/(?P<id>[A-Za-z0-9_-]+)/apply', [ KitsController::class, 'apply' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		// Named local design themes (snapshot / switch / delete).
		Rest::get( 'blicks/v1', 'design-system/themes', [ ThemesController::class, 'index' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::post( 'blicks/v1', 'design-system/themes', [ ThemesController::class, 'create' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'name' => RestArgs::text( true ),
					'tokens' => RestArgs::object(),
					'breakpoints' => RestArgs::object(),
					'typeRoles' => RestArgs::object(),
				]
			);

		Rest::patch( 'blicks/v1', 'design-system/themes/(?P<id>[A-Za-z0-9_-]+)', [ ThemesController::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'id' => RestArgs::identifier( true ),
					'name' => RestArgs::text(),
					'tokens' => RestArgs::object(),
					'breakpoints' => RestArgs::object(),
					'typeRoles' => RestArgs::object(),
				]
			);

		Rest::delete( 'blicks/v1', 'design-system/themes/(?P<id>[A-Za-z0-9_-]+)', [ ThemesController::class, 'remove' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		Rest::post( 'blicks/v1', 'design-system/themes/(?P<id>[A-Za-z0-9_-]+)/apply', [ ThemesController::class, 'apply' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		Rest::post( 'blicks/v1', 'design-system/themes/(?P<id>[A-Za-z0-9_-]+)/reset', [ ThemesController::class, 'reset' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		// The Studio library's Marketplace shelf, proxied so a Pro licence never reaches the browser.
		Rest::get( 'blicks/v1', 'marketplace/items', [ MarketplaceController::class, 'items' ] )
			->permission( fn () => current_user_can( 'edit_posts' ) );

		Rest::get( 'blicks/v1', 'marketplace/terms', [ MarketplaceController::class, 'terms' ] )
			->permission( fn () => current_user_can( 'edit_posts' ) );

		Rest::get( 'blicks/v1', 'marketplace/items/(?P<slug>[a-z0-9-]+)/content', [ MarketplaceController::class, 'content' ] )
			->permission( fn () => current_user_can( 'edit_posts' ) );

		// The custom keyframe library — records with add/rename/delete, so CRUD rather than the
		// design-system PATCH bag (see docs/plans/custom-animations.md).
		Rest::get( 'blicks/v1', 'design-system/animations', [ AnimationsController::class, 'index' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::post( 'blicks/v1', 'design-system/animations', [ AnimationsController::class, 'create' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'slug' => RestArgs::identifier( true ),
					'label' => RestArgs::text(),
					'defaults' => RestArgs::object(),
					'steps' => RestArgs::list( true ),
				]
			);

		Rest::patch( 'blicks/v1', 'design-system/animations/(?P<slug>[A-Za-z0-9_-]+)', [ AnimationsController::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'slug' => RestArgs::identifier( true ),
					'label' => RestArgs::text(),
					'defaults' => RestArgs::object(),
					'steps' => RestArgs::list(),
				]
			);

		Rest::delete( 'blicks/v1', 'design-system/animations/(?P<slug>[A-Za-z0-9_-]+)', [ AnimationsController::class, 'remove' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'slug' => RestArgs::identifier( true ) ] );

		Rest::get( 'blicks/v1', 'settings', [ SettingsController::class, 'show' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::patch( 'blicks/v1', 'settings', [ SettingsController::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'deleteDataOnUninstall' => RestArgs::boolean(),
					'marketplace' => RestArgs::boolean(),
					'designSystem' => RestArgs::object(),
				]
			);

		// A stored entity's blocks for the Studio (`studio.openRef()`): a template part, or a post
		// of a type a companion opted in. Who may call it is who may edit that entity.
		$entityRef = [
			'kind' => RestArgs::enum( [ EntityRef::TEMPLATE_PART, EntityRef::POST ] ),
			// `theme//slug` for a template part, a post id for a post: either shape, as a string.
			'id' => [
				'type' => [ 'string', 'integer' ],
				'required' => true,
				'sanitize_callback' => static fn ( $value ): string => is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '',
				'validate_callback' => static fn ( $value ): bool => is_string( $value ) || is_int( $value ),
			],
			'type' => RestArgs::identifier(),
		];

		Rest::get( 'blicks/v1', 'studio/entity', [ EntityRef::class, 'show' ] )
			->permission( [ EntityRef::class, 'permission' ] )
			->schema( $entityRef );

		Rest::post( 'blicks/v1', 'studio/entity', [ EntityRef::class, 'update' ] )
			->permission( [ EntityRef::class, 'permission' ] )
			->schema(
				$entityRef + [
					// Block markup, kept whole: `wp_update_post()` and core's template route run it
					// through kses for a user without `unfiltered_html`, as the editor's save does.
					'content' => [
						'type' => 'string',
						'required' => true,
						'sanitize_callback' => static fn ( $value ): string => is_string( $value ) ? $value : '',
						'validate_callback' => static fn ( $value ): bool => is_string( $value ),
					],
				]
			);

		// Loop previews: the editor posts a Loop's attributes and gets back the page's items.
		// `attributes` has its own sanitiser (LoopAttributes), not RestArgs::object(): pasted
		// JSON must reach the decoder byte for byte, or the preview drifts from the page.
		Rest::post( 'blicks/v1', 'loop/items', [ LoopController::class, 'items' ] )
			->permission( [ LoopController::class, 'canPreview' ] )
			->schema(
				[
					'attributes' => [
						'type' => 'object',
						'required' => true,
						'sanitize_callback' => static fn ( $value ): array => LoopAttributes::sanitize( $value ),
						'validate_callback' => static fn ( $value ): bool => is_array( $value ),
					],
					'postId' => [
						'type' => 'integer',
						'sanitize_callback' => 'absint',
					],
					// The page the editor previews, for a paged Loop.
					'page' => [
						'type' => 'integer',
						'default' => 1,
						'sanitize_callback' => static fn ( $value ): int => max( 1, min( 100000, absint( $value ) ) ),
					],
					'refresh' => RestArgs::boolean(),
				]
			);

		// How many posts use an endpoint, for the warning before an administrator removes it.
		Rest::get( 'blicks/v1', 'loop/usage', [ LoopController::class, 'usage' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'endpoint' => RestArgs::identifier( true ) ] );

		// The site's data endpoints. Editors read names to pick one; only administrators write.
		Rest::get( 'blicks/v1', 'data-endpoints', [ LoopController::class, 'endpoints' ] )
			->permission( fn () => current_user_can( 'edit_posts' ) );

		$endpointFields = [
			'name' => RestArgs::text(),
			// Not RestArgs::text(): sanitize_text_field() strips %XX octets, so `?q=a%20b` would be
			// saved as `?q=ab`. EndpointRegistry::save() checks the address and stores it esc_url_raw()'d.
			'url' => [
				'type' => 'string',
				'sanitize_callback' => static fn ( $value ): string => is_string( $value ) ? trim( $value ) : '',
			],
			'cache' => RestArgs::enum( array_keys( EndpointRegistry::CACHE ) ),
			'keepLastGood' => RestArgs::boolean(),
		];

		Rest::post( 'blicks/v1', 'data-endpoints', [ LoopController::class, 'create' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( $endpointFields );

		Rest::patch( 'blicks/v1', 'data-endpoints/(?P<id>[a-z0-9-]+)', [ LoopController::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] + $endpointFields );

		Rest::delete( 'blicks/v1', 'data-endpoints/(?P<id>[a-z0-9-]+)', [ LoopController::class, 'remove' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		Rest::post( 'blicks/v1', 'data-endpoints/(?P<id>[a-z0-9-]+)/test', [ LoopController::class, 'test' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema( [ 'id' => RestArgs::identifier( true ) ] );

		// Forms: the public token and send routes, the entries screen, and Settings › Forms. Each
		// controller declares its own (docs: form-contracts in the workspace plans).
		FormsController::routes();
		EntriesController::routes();
		FormsSettingsController::routes();
	}
}
