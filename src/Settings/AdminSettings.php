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

	public const THEME_JSON_SYNC = false;
	public const REGENERATE_EDITOR_CSS = true;

	/** Deleting a plugin should not silently destroy a site's design work, so this is opt-in. */
	public const DELETE_DATA_ON_UNINSTALL = false;

	/**
	 * The Studio library's Marketplace shelf asks showcase.blicks.dev for its list and loads
	 * preview frames from it, so it stays off until an administrator turns it on.
	 */
	public const MARKETPLACE = false;

	/** A site option rather than a row in the settings table: one switch, read on its own. */
	public const MARKETPLACE_OPTION = 'blicks_marketplace_enabled';

	private const KEYS = [
		'deleteDataOnUninstall' => 'admin.delete_data_on_uninstall',
		'themeJsonSync' => 'design_system.theme_json_sync',
		'regenerateEditorCss' => 'design_system.regenerate_editor_css',
		'updatedAt' => 'admin.updated_at',
	];

	/** @return array{deleteDataOnUninstall:bool,marketplace:bool,designSystem:array{themeJsonSync:bool,themeJsonSupported:bool}} */
	public static function snapshot(): array {
		$themeJsonSupported = self::themeJsonSupported();

		return [
			'deleteDataOnUninstall' => self::deleteDataOnUninstallEnabled(),
			'marketplace' => self::marketplaceEnabled(),
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
		if ( array_key_exists( 'deleteDataOnUninstall', $payload ) ) {
			SettingModel::setValue( self::KEYS['deleteDataOnUninstall'], (bool) $payload['deleteDataOnUninstall'] );
		}

		if ( array_key_exists( 'marketplace', $payload ) ) {
			update_option( self::MARKETPLACE_OPTION, (bool) $payload['marketplace'] ? '1' : '0', false );
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
		return (bool) wp_theme_has_theme_json();
	}

	public static function regenerateEditorCssEnabled(): bool {
		return (bool) SettingModel::getValue( self::KEYS['regenerateEditorCss'], self::REGENERATE_EDITOR_CSS );
	}

	/** Whether an administrator has turned the Marketplace shelf on. Off until they do. */
	public static function marketplaceEnabled(): bool {
		return '1' === (string) get_option( self::MARKETPLACE_OPTION, self::MARKETPLACE ? '1' : '0' );
	}
}
