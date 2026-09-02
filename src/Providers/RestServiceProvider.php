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

use UupCode\Utilities\ServiceProvider;
use UupCode\Utilities\Attributes\Action;
use UupCode\Utilities\Http\Rest;
use Blicks\Http\RestArgs;
use Blicks\Http\Controllers\AnimationsController;
use Blicks\Http\Controllers\DashboardController;
use Blicks\Http\Controllers\DesignSystemController;
use Blicks\Http\Controllers\DiagnosticsController;
use Blicks\Http\Controllers\SettingsController;
use Blicks\Http\Controllers\ThemesController;

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
					'defaultInspectorPanel' => RestArgs::enum( [ 'settings', 'styles', 'advanced' ] ),
					'helpVisibility' => RestArgs::enum( [ 'show', 'hide' ] ),
					'deleteDataOnUninstall' => RestArgs::boolean(),
					'designSystem' => RestArgs::object(),
				]
			);
	}
}
