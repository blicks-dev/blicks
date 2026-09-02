<?php
/**
 * Example table-backed model, kept as a scaffold reference.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Models;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\Database\Model;

/**
 * Example table-backed model, kept as a scaffold reference.
 */
final class ExampleModel extends Model {

	protected static string $table = 'blicks_examples';

	protected static array $casts = [
		// Cast entries go here, e.g. a JSON column decoded to an array.
	];

	public static function createTable(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();
		$table   = self::table();

		$sql = "CREATE TABLE IF NOT EXISTS {$table} (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
