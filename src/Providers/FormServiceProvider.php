<?php
/**
 * Wires the Form block's server side.
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
use Blicks\Core\Attributes\Filter;
use Blicks\Forms\Entries;
use Blicks\Forms\EntriesCsv;
use Blicks\Forms\Locator;
use Blicks\Forms\Privacy;
use Blicks\Forms\Schema;
use WP_Post;

/**
 * Forms: the entries post type, the index of which post holds which form, personal-data export and
 * erase, and the CSV download. The REST routes are declared with the others (RestServiceProvider).
 */
final class FormServiceProvider extends ServiceProvider {

	#[Action( 'init' )]
	public function registerPostType(): void {
		Entries::register();
	}

	/** Note which forms a saved post holds, so a send can find its form ({@see Locator}). */
	#[Action( 'save_post', priority: 10, args: 2 )]
	public function index( int $postId, WP_Post $post ): void {
		Locator::index( $postId, $post );
	}

	/**
	 * @param array<string, mixed> $exporters
	 * @return array<string, mixed>
	 */
	#[Filter( 'wp_privacy_personal_data_exporters' )]
	public function exporters( array $exporters ): array {
		return Privacy::exporters( $exporters );
	}

	/**
	 * @param array<string, mixed> $erasers
	 * @return array<string, mixed>
	 */
	#[Filter( 'wp_privacy_personal_data_erasers' )]
	public function erasers( array $erasers ): array {
		return Privacy::erasers( $erasers );
	}

	#[Action( 'admin_init' )]
	public function policy(): void {
		Privacy::policy();
	}

	/**
	 * Which blocks may sit directly in a Form, filterable on the server as in the editor.
	 *
	 * The Form's block.json sets no `allowedBlocks` today, so any block may sit in it and this is a
	 * no-op: the editor's list (the JS `blicks.form.allowedBlocks` filter) is the authority. When
	 * block.json gains a list, `blicks_form_allowed_blocks` lets a companion add its own blocks
	 * (a step, say) without patching it.
	 *
	 * @param array<string, mixed> $metadata
	 * @return array<string, mixed>
	 */
	#[Filter( 'block_type_metadata' )]
	public function allowedBlocks( array $metadata ): array {
		if ( Schema::FORM_BLOCK !== ( $metadata['name'] ?? '' ) || ! is_array( $metadata['allowedBlocks'] ?? null ) ) {
			return $metadata;
		}

		/**
		 * The blocks that may sit directly in a Form (block names).
		 *
		 * @param list<string> $allowed From the Form's block.json.
		 */
		$allowed = apply_filters( 'blicks_form_allowed_blocks', $metadata['allowedBlocks'] );
		$list = [];

		foreach ( is_array( $allowed ) ? $allowed : [] as $name ) {
			if ( is_string( $name ) && 1 === preg_match( '#^[a-z0-9-]+/[a-z0-9-]+$#', $name ) && ! in_array( $name, $list, true ) ) {
				$list[] = $name;
			}
		}

		$metadata['allowedBlocks'] = $list;

		return $metadata;
	}

	#[Action( 'admin_post_blicks_entries_csv' )]
	public function csv(): void {
		EntriesCsv::download();
	}
}
