<?php
/**
 * Headers for AI agents, through MCP.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * What an agent needs to build or change a header, on the Blicks MCP server:
 *
 *  - `blicks-pro/list-headers`: the header template parts, with the post id of each one the site
 *    has saved (a part still only in the theme's files has none yet);
 *  - `blicks-pro/create-header`: a new header part from a starting layout, or a site copy of an
 *    existing one, so it has a post id;
 *  - header template parts open to the free plugin's own layout tools (`blicks_mcp_post_types`), so
 *    `blicks-get-post-layout`, `blicks-validate-layout` and `blicks-update-post-layout` read, check
 *    and write a header by that post id, with the shapes from {@see Ai}.
 *
 * Every call needs `edit_theme_options`, as the Site Editor does.
 */
final class Agents {

	public const CATEGORY = 'blicks-pro';

	public const LIST = 'blicks-pro/list-headers';

	public const CREATE = 'blicks-pro/create-header';

	public function __construct( private readonly Patterns $patterns ) {
	}

	public function register(): void {
		add_action( 'wp_abilities_api_categories_init', [ $this, 'category' ] );
		add_action( 'wp_abilities_api_init', [ $this, 'abilities' ] );
		add_filter( 'blicks_mcp_tools', [ self::class, 'tools' ] );
		add_filter( 'blicks_mcp_post_types', [ self::class, 'postTypes' ] );
	}

	public function category(): void {
		if ( function_exists( 'wp_register_ability_category' ) && ! ( function_exists( 'wp_has_ability_category' ) && wp_has_ability_category( self::CATEGORY ) ) ) {
			wp_register_ability_category(
				self::CATEGORY,
				[
					'label' => __( 'Blicks Pro', 'blicks-pro' ),
					'description' => __( 'Site parts built with Blicks Pro: headers.', 'blicks-pro' ),
				]
			);
		}
	}

	public function abilities(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		$can = static fn (): bool => current_user_can( 'edit_theme_options' ) && wp_is_block_theme();

		if ( ! ( function_exists( 'wp_has_ability' ) && wp_has_ability( self::LIST ) ) ) {
			wp_register_ability(
				self::LIST,
				[
					'label' => __( 'List headers', 'blicks-pro' ),
					'description' => 'The site\'s header template parts: id ("theme//slug"), title, whether it is a Header Studio header, the templates that use it, and postId, the id the layout tools take (null while the part is only in the theme\'s files; create-header with copyOf gives it one).',
					'category' => self::CATEGORY,
					'input_schema' => [
						'type' => 'object',
						'properties' => [],
					],
					'output_schema' => [ 'type' => 'object' ],
					'execute_callback' => [ $this, 'list' ],
					'permission_callback' => $can,
					'meta' => [
						'annotations' => [
							'readonly' => true,
							'destructive' => false,
						],
						'show_in_rest' => true,
					],
				]
			);
		}

		if ( ! ( function_exists( 'wp_has_ability' ) && wp_has_ability( self::CREATE ) ) ) {
			wp_register_ability(
				self::CREATE,
				[
					'label' => __( 'Create a header', 'blicks-pro' ),
					'description' => 'Create a header template part and answer its postId. Start from a layout: classic, centred or stacked, or a designed starter (minimal-centred, classic-split, announcement-bar, sticky-shrink, hide-on-scroll, search-first, simple-dropdown, two-tier-utility, mega-menu-columns), or give copyOf, a part id from list-headers, to make the site\'s own copy of it. Then write it with blicks-update-post-layout on that postId. It is used where a template places that part, which is chosen in the Site Editor.',
					'category' => self::CATEGORY,
					'input_schema' => [
						'type' => 'object',
						'properties' => [
							'title' => [
								'type' => 'string',
								'maxLength' => 80,
								'description' => 'The header\'s name, e.g. "Main header".',
							],
							'layout' => [
								'type' => 'string',
								'enum' => Patterns::LAYOUTS,
								'default' => 'classic',
							],
							'copyOf' => [
								'type' => 'string',
								'maxLength' => 200,
								'description' => 'A header part id ("theme//slug") to copy instead of a layout.',
							],
						],
						'required' => [ 'title' ],
					],
					'output_schema' => [ 'type' => 'object' ],
					'execute_callback' => [ $this, 'create' ],
					'permission_callback' => $can,
					'meta' => [
						'annotations' => [
							'readonly' => false,
							'destructive' => false,
						],
						'show_in_rest' => true,
					],
				]
			);
		}
	}

	/**
	 * @param mixed $tools
	 * @return mixed
	 */
	public static function tools( mixed $tools ): mixed {
		return is_array( $tools ) ? [ ...$tools, self::LIST, self::CREATE ] : $tools;
	}

	/**
	 * @param mixed $types
	 * @return mixed
	 */
	public static function postTypes( mixed $types ): mixed {
		return is_array( $types ) ? array_values( array_unique( [ ...$types, 'wp_template_part' ] ) ) : $types;
	}

	/**
	 * @return array<string, mixed>
	 */
	public function list(): array {
		$rows = AdminView::rows();

		foreach ( $rows as &$row ) {
			$row['postId'] = self::postId( $row['id'] );
		}

		return [ 'headers' => $rows ];
	}

	/**
	 * @param mixed $input
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( mixed $input = null ): array|WP_Error {
		$input = is_array( $input ) ? $input : [];
		$title = trim( sanitize_text_field( (string) ( $input['title'] ?? '' ) ) );
		$copyOf = (string) ( $input['copyOf'] ?? '' );

		if ( '' === $title ) {
			return new WP_Error( 'blicks_pro_header_title', 'Give the header a title.' );
		}

		if ( '' !== $copyOf ) {
			$part = get_block_template( $copyOf, 'wp_template_part' );

			if ( ! $part || 'header' !== $part->area ) {
				return new WP_Error( 'blicks_pro_header_missing', sprintf( 'There is no header part "%s". list-headers names them.', $copyOf ) );
			}

			// The site's copy of a theme part keeps its slug, as the Site Editor's does.
			$existing = self::postId( $copyOf );
			$slug = (string) $part->slug;
			$content = (string) $part->content;
		} else {
			$layout = (string) ( $input['layout'] ?? 'classic' );
			$content = $this->patterns->markup( $layout );

			if ( '' === $content ) {
				return new WP_Error( 'blicks_pro_header_layout', sprintf( 'Choose a layout: %s.', implode( ', ', Patterns::LAYOUTS ) ) );
			}

			$existing = null;
			$slug = self::freeSlug( sanitize_title( $title ) );
		}

		if ( null !== $existing ) {
			return self::answer( $existing, false );
		}

		$id = wp_insert_post(
			wp_slash(
				[
					'post_type' => 'wp_template_part',
					'post_status' => 'publish',
					'post_title' => $title,
					'post_name' => $slug,
					'post_content' => $content,
					'tax_input' => [
						'wp_theme' => [ get_stylesheet() ],
						'wp_template_part_area' => [ 'header' ],
					],
				]
			),
			true
		);

		if ( is_wp_error( $id ) ) {
			return $id;
		}

		// `tax_input` needs the account to assign terms; set them outright, as core's route does.
		wp_set_post_terms( $id, get_stylesheet(), 'wp_theme' );
		wp_set_post_terms( $id, 'header', 'wp_template_part_area' );

		// A slug is unique per theme, which WordPress can tell only once the theme term is set: a
		// copy of another theme's `header` part came back `header-2`.
		if ( get_post_field( 'post_name', $id ) !== $slug ) {
			wp_update_post(
				[
					'ID' => $id,
					'post_name' => $slug,
				]
			);
		}

		return self::answer( $id, true );
	}

	/** @return array<string, mixed> */
	private static function answer( int $postId, bool $created ): array {
		$post = get_post( $postId );

		return [
			'postId' => $postId,
			'id' => get_stylesheet() . '//' . ( $post ? $post->post_name : '' ),
			'title' => $post ? $post->post_title : '',
			'created' => $created,
		];
	}

	/** The post id of a part the site has saved, or null. */
	public static function postId( string $partId ): ?int {
		$part = get_block_template( $partId, 'wp_template_part' );

		return $part && 'custom' === $part->source && is_int( $part->wp_id ) && $part->wp_id > 0 ? $part->wp_id : null;
	}

	/** A slug no part of the theme has: `main-header`, `main-header-2`… */
	private static function freeSlug( string $base ): string {
		$base = '' !== $base ? $base : 'header';
		$taken = array_map( static fn ( $p ): string => (string) $p->slug, get_block_templates( [], 'wp_template_part' ) );
		$slug = $base;

		$n = 2;

		while ( in_array( $slug, $taken, true ) ) {
			$slug = $base . '-' . $n++;
		}

		return $slug;
	}
}
