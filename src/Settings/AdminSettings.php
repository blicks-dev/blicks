<?php
/**
 * Typed accessors and defaults for the plugin's stored settings.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Models\SettingModel;

/**
 * Typed accessors, defaults and persistence for the plugin's settings.
 */
final class AdminSettings {

	public const DEFAULT_INSPECTOR_PANEL = 'styles';
	public const HELP_VISIBILITY = 'show';
	public const THEME_JSON_SYNC = false;
	public const REGENERATE_EDITOR_CSS = true;

	/** Deleting a plugin should not silently destroy a site's design work, so this is opt-in. */
	public const DELETE_DATA_ON_UNINSTALL = false;

	private const KEYS = [
		'defaultInspectorPanel' => 'admin.default_inspector_panel',
		'helpVisibility' => 'admin.help_visibility',
		'deleteDataOnUninstall' => 'admin.delete_data_on_uninstall',
		'themeJsonSync' => 'design_system.theme_json_sync',
		'regenerateEditorCss' => 'design_system.regenerate_editor_css',
		'updatedAt' => 'admin.updated_at',
	];

	/** @return array{defaultInspectorPanel:string,helpVisibility:string,deleteDataOnUninstall:bool,designSystem:array{themeJsonSync:bool,themeJsonSupported:bool}} */
	public static function snapshot(): array {
		$themeJsonSupported = self::themeJsonSupported();

		return [
			'defaultInspectorPanel' => self::validChoice(
				SettingModel::getValue( self::KEYS['defaultInspectorPanel'], self::DEFAULT_INSPECTOR_PANEL ),
				[ 'settings', 'styles', 'advanced' ],
				self::DEFAULT_INSPECTOR_PANEL
			),
			'helpVisibility' => self::validChoice(
				SettingModel::getValue( self::KEYS['helpVisibility'], self::HELP_VISIBILITY ),
				[ 'show', 'hide' ],
				self::HELP_VISIBILITY
			),
			'deleteDataOnUninstall' => self::deleteDataOnUninstallEnabled(),
			'designSystem' => [
				'themeJsonSync' => self::themeJsonSyncEnabled() && $themeJsonSupported,
				'themeJsonSupported' => $themeJsonSupported,
				'regenerateEditorCss' => self::regenerateEditorCssEnabled(),
			],
			'updatedAt' => self::updatedAt(),
		];
	}

	/** ATOM timestamp of the last settings save, or null if they have never been saved. */
	public static function updatedAt(): ?string {
		$stamp = (int) SettingModel::getValue( self::KEYS['updatedAt'], 0 );

		return $stamp > 0 ? gmdate( DATE_ATOM, $stamp ) : null;
	}

	/** @param array<string,mixed> $payload */
	public static function save( array $payload ): array {
		if ( array_key_exists( 'defaultInspectorPanel', $payload ) ) {
			SettingModel::setValue(
				self::KEYS['defaultInspectorPanel'],
				self::validChoice( $payload['defaultInspectorPanel'], [ 'settings', 'styles', 'advanced' ], self::DEFAULT_INSPECTOR_PANEL )
			);
		}

		if ( array_key_exists( 'helpVisibility', $payload ) ) {
			SettingModel::setValue(
				self::KEYS['helpVisibility'],
				self::validChoice( $payload['helpVisibility'], [ 'show', 'hide' ], self::HELP_VISIBILITY )
			);
		}

		if ( array_key_exists( 'deleteDataOnUninstall', $payload ) ) {
			SettingModel::setValue( self::KEYS['deleteDataOnUninstall'], (bool) $payload['deleteDataOnUninstall'] );
		}

		$designSystem = $payload['designSystem'] ?? null;
		if ( is_array( $designSystem ) && array_key_exists( 'themeJsonSync', $designSystem ) ) {
			SettingModel::setValue(
				self::KEYS['themeJsonSync'],
				self::themeJsonSupported() && (bool) $designSystem['themeJsonSync']
			);
		}

		if ( is_array( $designSystem ) && array_key_exists( 'regenerateEditorCss', $designSystem ) ) {
			SettingModel::setValue( self::KEYS['regenerateEditorCss'], (bool) $designSystem['regenerateEditorCss'] );
		}

		// Stamped so the dashboard's activity feed can report a real "settings saved" time
		// instead of inventing one.
		SettingModel::setValue( self::KEYS['updatedAt'], time() );

		return self::snapshot();
	}

	/**
	 * Read directly, guarding on $wpdb: this is called from the uninstall hook, where the
	 * plugin's own bootstrap has not run and the settings table may already be gone.
	 */
	public static function deleteDataOnUninstallEnabled(): bool {
		global $wpdb;
		if ( ! is_object( $wpdb ) ) {
			return self::DELETE_DATA_ON_UNINSTALL;
		}

		return (bool) SettingModel::getValue(
			self::KEYS['deleteDataOnUninstall'],
			self::DELETE_DATA_ON_UNINSTALL
		);
	}

	public static function themeJsonSyncEnabled(): bool {
		global $wpdb;
		if ( ! is_object( $wpdb ) ) {
			return self::THEME_JSON_SYNC;
		}

		return (bool) SettingModel::getValue( self::KEYS['themeJsonSync'], self::THEME_JSON_SYNC );
	}

	public static function themeJsonSupported(): bool {
		return function_exists( 'wp_theme_has_theme_json' ) ? (bool) wp_theme_has_theme_json() : false;
	}

	public static function regenerateEditorCssEnabled(): bool {
		return (bool) SettingModel::getValue( self::KEYS['regenerateEditorCss'], self::REGENERATE_EDITOR_CSS );
	}

	/** @param list<string> $allowed */
	private static function validChoice( mixed $value, array $allowed, string $fallback ): string {
		$value = is_string( $value ) ? sanitize_key( $value ) : '';
		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}
}
