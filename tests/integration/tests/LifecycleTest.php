<?php
/**
 * Activation, settings storage and the opt-in uninstall path.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Plugin;
use Blicks\Models\KitModel;
use Blicks\Models\SettingModel;
use WP_UnitTestCase;

final class LifecycleTest extends WP_UnitTestCase {

	/** Options the plugin claims as its own and removes on an opt-in uninstall. */
	private const OWNED_OPTIONS = [
		'blicks_design_system',
		'blicks_design_custom_slugs',
		'blicks_design_animations',
		'blicks_design_themes',
		'blicks_settings_schema_version',
	];

	/**
	 * SettingModel keeps what it read in a static, for the rest of the request. A test suite is
	 * one long request, so without this a setting one test wrote is still "on" in the next.
	 */
	public function set_up(): void {
		parent::set_up();
		( fn () => self::$runtimeCache = [] )->bindTo( null, SettingModel::class )();
	}

	public function test_activation_creates_the_settings_table(): void {
		global $wpdb;

		Plugin::activate();

		$table  = SettingModel::table();
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );

		$this->assertSame( $table, $exists, 'Activation did not create the settings table.' );
	}

	public function test_activation_creates_the_kits_table_and_uninstall_drops_it(): void {
		global $wpdb;

		Plugin::activate();
		$table = KitModel::table();
		$this->assertSame( $table, $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ), 'Activation did not create the kits table.' );

		SettingModel::setValue( 'admin.delete_data_on_uninstall', true );

		// WP_UnitTestCase rewrites DROP TABLE into DROP TEMPORARY TABLE, which leaves the real
		// table standing. Let this one drop reach MySQL, then put both tables back for the tests
		// after it.
		remove_filter( 'query', [ $this, '_drop_temporary_tables' ] );
		remove_filter( 'query', [ $this, '_create_temporary_tables' ] );

		try {
			Plugin::uninstall();
			$this->assertNull( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ), 'Uninstall left the kits table behind.' );
		} finally {
			Plugin::activate();
		}
	}

	public function test_settings_round_trip_through_the_database(): void {
		Plugin::activate();

		SettingModel::setValue( 'design_system.theme_json_sync', true );

		// Clear the object cache so the read comes from the database, not the write.
		wp_cache_flush();

		$this->assertTrue( SettingModel::getValue( 'design_system.theme_json_sync' ) );
	}

	/**
	 * Uninstall is destructive, so it is opt-in. With the setting off, nothing may be removed —
	 * a user who deletes the plugin to troubleshoot keeps their tokens.
	 */
	public function test_uninstall_keeps_data_by_default(): void {
		update_option( 'blicks_design_system', [ 'tokens' => [ 'color' => [ 'brand' => '#000' ] ] ] );

		Plugin::uninstall();

		$this->assertNotFalse(
			get_option( 'blicks_design_system', false ),
			'Uninstall removed design tokens without the opt-in setting enabled.'
		);
	}

	public function test_uninstall_removes_owned_options_when_opted_in(): void {
		Plugin::activate();
		SettingModel::setValue( 'admin.delete_data_on_uninstall', true );

		foreach ( self::OWNED_OPTIONS as $option ) {
			update_option( $option, 'set-by-test' );
		}

		Plugin::uninstall();

		foreach ( self::OWNED_OPTIONS as $option ) {
			$this->assertFalse(
				get_option( $option, false ),
				"Uninstall left {$option} behind."
			);
		}
	}

	public function test_uninstall_leaves_unrelated_options_alone(): void {
		Plugin::activate();
		SettingModel::setValue( 'admin.delete_data_on_uninstall', true );

		update_option( 'blogname', 'Someone Else Site' );
		update_option( 'some_other_plugin_option', 'keep me' );

		Plugin::uninstall();

		$this->assertSame( 'Someone Else Site', get_option( 'blogname' ) );
		$this->assertSame( 'keep me', get_option( 'some_other_plugin_option' ) );
	}
}
