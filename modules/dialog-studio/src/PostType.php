<?php
/**
 * The `blicks_dialog` post type and its meta.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Saved dialogs are a post type of their own, not template parts or synced patterns (dialog plan,
 * decision 5): an automatic dialog is placed nowhere in content, it carries its own triggers and
 * rules, and it must not show in the pattern inserter.
 *
 * No public address, and the capability is `edit_theme_options`, as for a template part: a dialog
 * can appear on every page of the site. Published is on, draft is off.
 */
final class PostType {

	public static function register(): void {
		$cap = 'edit_theme_options';

		register_post_type(
			Library::TYPE,
			[
				'labels' => [
					'name' => __( 'Dialogs', 'blicks-pro' ),
					'singular_name' => __( 'Dialog', 'blicks-pro' ),
					'add_new_item' => __( 'New dialog', 'blicks-pro' ),
					'edit_item' => __( 'Edit dialog', 'blicks-pro' ),
				],
				'public' => false,
				'publicly_queryable' => false,
				'exclude_from_search' => true,
				'show_ui' => true,
				// Listed by Blicks › Dialogs, not by a menu of its own.
				'show_in_menu' => false,
				'show_in_rest' => true,
				'rest_base' => 'blicks-dialogs',
				'rewrite' => false,
				'query_var' => false,
				'can_export' => true,
				'supports' => [ 'title', 'editor', 'custom-fields', 'revisions' ],
				'template' => [ [ 'blicks/dialog' ] ],
				'template_lock' => 'insert',
				'map_meta_cap' => false,
				'capabilities' => [
					'edit_post' => $cap,
					'read_post' => $cap,
					'delete_post' => $cap,
					'edit_posts' => $cap,
					'edit_others_posts' => $cap,
					'delete_posts' => $cap,
					'publish_posts' => $cap,
					'read_private_posts' => $cap,
					'create_posts' => $cap,
					'delete_others_posts' => $cap,
					'delete_published_posts' => $cap,
					'edit_published_posts' => $cap,
				],
			]
		);

		$auth = static fn (): bool => current_user_can( $cap );

		register_post_meta(
			Library::TYPE,
			Settings::TRIGGERS,
			[
				'type' => 'object',
				'single' => true,
				'default' => Settings::triggerDefaults(),
				'sanitize_callback' => [ Settings::class, 'triggers' ],
				'auth_callback' => $auth,
				'show_in_rest' => [ 'schema' => Settings::triggersSchema() ],
			]
		);

		register_post_meta(
			Library::TYPE,
			Settings::RULES,
			[
				'type' => 'object',
				'single' => true,
				'default' => Settings::ruleDefaults(),
				'sanitize_callback' => [ Settings::class, 'rules' ],
				'auth_callback' => $auth,
				'show_in_rest' => [ 'schema' => Settings::rulesSchema() ],
			]
		);
	}

	/**
	 * Open `blicks_dialog` posts to the Studio's entity route (`Blicks\Studio\EntityRef`).
	 *
	 * @param mixed $types
	 * @return list<string>
	 */
	public static function entityTypes( mixed $types ): array {
		return [ ...( is_array( $types ) ? $types : [] ), Library::TYPE ];
	}
}
