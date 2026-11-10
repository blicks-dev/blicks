<?php
/**
 * Stored entities the Studio opens and saves: template parts and posts of a registered type.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Studio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The server half of `studio.openRef()`: read and write a stored entity's blocks with the
 * capability that entity asks for, and say where it is used.
 *
 * A Studio mode that persists (`StudioMode.persist`) names what it opened with a ref, and the
 * browser sends that ref here (`resources/studio/entity.ts`). Two kinds, so the helper is general
 * from the start rather than shaped by its first user:
 *
 * - `{ kind: 'template-part', id: 'theme//slug' }` — a block theme template part, such as a
 *   header. Needs `edit_theme_options`, as the Site Editor does. Written through core's own
 *   template-parts route, so a part still in the theme's files becomes a customised copy exactly
 *   as it would from the Site Editor.
 * - `{ kind: 'post', type: 'blicks_dialog', id: 12 }` — a post of a type a companion registered
 *   and opted in through `blicks_studio_entity_types`. Needs `edit_post` on that post, which is
 *   whatever capabilities the type was registered with.
 *
 * No type is allowed by default: the Studio rewrites a post's whole content, so a type has to ask
 * for that, rather than every type with `show_in_rest` being open to it.
 */
final class EntityRef {

	public const TEMPLATE_PART = 'template-part';

	public const POST = 'post';

	/** `theme//slug`, as core identifies a block template. */
	private const TEMPLATE_ID = '#^[A-Za-z0-9_.-]+//[A-Za-z0-9_-]+$#';

	/**
	 * A ref from the browser, checked and narrowed to what this class reads, or null.
	 *
	 * @param array<string, mixed> $raw
	 * @return array{kind: string, id: string|int, type: string}|null
	 */
	public static function from( array $raw ): ?array {
		$kind = is_string( $raw['kind'] ?? null ) ? $raw['kind'] : '';

		if ( self::TEMPLATE_PART === $kind ) {
			$id = is_string( $raw['id'] ?? null ) ? trim( $raw['id'] ) : '';

			return 1 === preg_match( self::TEMPLATE_ID, $id ) ? [
				'kind' => $kind,
				'id' => $id,
				'type' => 'wp_template_part',
			] : null;
		}

		if ( self::POST === $kind ) {
			$id = is_numeric( $raw['id'] ?? null ) ? (int) $raw['id'] : 0;
			$type = is_string( $raw['type'] ?? null ) ? sanitize_key( $raw['type'] ) : '';

			return $id > 0 && in_array( $type, self::postTypes(), true ) ? [
				'kind' => $kind,
				'id' => $id,
				'type' => $type,
			] : null;
		}

		return null;
	}

	/**
	 * The post types the Studio may open, from `blicks_studio_entity_types`. Only registered types
	 * are kept, so a companion that is switched off leaves nothing open behind it.
	 *
	 * @return list<string>
	 */
	public static function postTypes(): array {
		/**
		 * Post types whose posts a Studio mode may open and save whole. For example:
		 * `add_filter( 'blicks_studio_entity_types', fn ( $types ) => [ ...$types, 'blicks_dialog' ] );`
		 *
		 * @param list<string> $types
		 */
		$filtered = apply_filters( 'blicks_studio_entity_types', [] );
		$types = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $type ) {
			if ( is_string( $type ) && '' !== $type && sanitize_key( $type ) === $type && post_type_exists( $type ) ) {
				$types[] = $type;
			}
		}

		return array_values( array_unique( $types ) );
	}

	/**
	 * The capability check for a ref, as `current_user_can()` arguments.
	 *
	 * @param array{kind: string, id: string|int, type: string} $ref
	 * @return list<string|int>
	 */
	public static function capability( array $ref ): array {
		return self::TEMPLATE_PART === $ref['kind'] ? [ 'edit_theme_options' ] : [ 'edit_post', (int) $ref['id'] ];
	}

	/** @param array{kind: string, id: string|int, type: string} $ref */
	public static function canEdit( array $ref ): bool {
		if ( self::POST === $ref['kind'] ) {
			$post = get_post( (int) $ref['id'] );

			// The type is part of the check: a ref naming an allowed type must not reach a post of
			// another type by its id.
			if ( ! $post || $post->post_type !== $ref['type'] ) {
				return false;
			}
		}

		return current_user_can( ...self::capability( $ref ) );
	}

	/**
	 * The entity's blocks, title and where it is used.
	 *
	 * @param array{kind: string, id: string|int, type: string} $ref
	 * @return array{content: string, title: string, usedOn: list<array{id: string, title: string, kind: string}>}|WP_Error
	 */
	public static function read( array $ref ): array|WP_Error {
		if ( self::TEMPLATE_PART === $ref['kind'] ) {
			$part = get_block_template( (string) $ref['id'], 'wp_template_part' );

			if ( ! $part ) {
				return new WP_Error( 'blicks_entity_missing', __( 'That template part does not exist in this theme.', 'blicks' ) );
			}

			return [
				'content' => (string) $part->content,
				'title' => (string) ( '' !== (string) $part->title ? $part->title : $part->slug ),
				'usedOn' => self::usedOn( $ref ),
			];
		}

		$post = get_post( (int) $ref['id'] );

		if ( ! $post || $post->post_type !== $ref['type'] ) {
			return new WP_Error( 'blicks_entity_missing', __( 'That item does not exist.', 'blicks' ) );
		}

		return [
			'content' => (string) $post->post_content,
			'title' => (string) $post->post_title,
			'usedOn' => self::usedOn( $ref ),
		];
	}

	/**
	 * Replace the entity's blocks.
	 *
	 * @param array{kind: string, id: string|int, type: string} $ref
	 * @return array{content: string, title: string, usedOn: list<array{id: string, title: string, kind: string}>}|WP_Error
	 */
	public static function write( array $ref, string $content ): array|WP_Error {
		if ( self::TEMPLATE_PART === $ref['kind'] ) {
			// Core's route: it turns a part still in the theme's files into a customised copy, and
			// checks `edit_theme_options` again on its own.
			$request = new WP_REST_Request( 'POST', '/wp/v2/template-parts/' . $ref['id'] );
			$request->set_body_params( [ 'content' => $content ] );
			$response = rest_do_request( $request );

			if ( $response->is_error() ) {
				return $response->as_error();
			}

			return self::read( $ref );
		}

		// Slashed: wp_update_post() unslashes, and a block's JSON attributes carry backslashes.
		$saved = wp_update_post(
			wp_slash(
				[
					'ID' => (int) $ref['id'],
					'post_content' => $content,
				]
			),
			true
		);

		return is_wp_error( $saved ) ? $saved : self::read( $ref );
	}

	/**
	 * Where the entity is used, for "Used on 12 pages".
	 *
	 * A template part is used by the templates that place it by slug — the theme's and the site's
	 * own. A post's use is its type's business, so a companion answers through
	 * `blicks_studio_entity_used_on` (a saved dialog counts the buttons that open it).
	 *
	 * @param array{kind: string, id: string|int, type: string} $ref
	 * @return list<array{id: string, title: string, kind: string}>
	 */
	public static function usedOn( array $ref ): array {
		if ( self::TEMPLATE_PART === $ref['kind'] ) {
			[ $theme, $slug ] = explode( '//', (string) $ref['id'], 2 );
			$used = [];

			foreach ( get_block_templates( [], 'wp_template' ) as $template ) {
				if ( self::places( parse_blocks( (string) $template->content ), $theme, $slug ) ) {
					$used[] = [
						'id' => (string) $template->id,
						'title' => (string) ( '' !== (string) $template->title ? $template->title : $template->slug ),
						'kind' => 'template',
					];
				}
			}

			return $used;
		}

		/**
		 * Where a post the Studio opened is used.
		 *
		 * @param list<array{id: string, title: string, kind: string}> $used
		 * @param array{kind: string, id: int, type: string}           $ref
		 */
		$filtered = apply_filters( 'blicks_studio_entity_used_on', [], $ref );
		$used = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $entry ) {
			if ( is_array( $entry ) && is_scalar( $entry['id'] ?? null ) && is_string( $entry['title'] ?? null ) ) {
				$used[] = [
					'id' => (string) $entry['id'],
					'title' => $entry['title'],
					'kind' => is_string( $entry['kind'] ?? null ) ? $entry['kind'] : 'post',
				];
			}
		}

		return $used;
	}

	/**
	 * Whether these blocks place the template part, at any depth. A placement without a `theme`
	 * attribute means the active theme's part, which is the only one a template can mean.
	 *
	 * @param list<array<string, mixed>> $blocks
	 */
	private static function places( array $blocks, string $theme, string $slug ): bool {
		foreach ( $blocks as $block ) {
			$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];

			$placed = 'core/template-part' === ( $block['blockName'] ?? null ) && ( $attrs['slug'] ?? null ) === $slug;

			// phpcs:ignore WordPress.PHP.YodaConditions.NotYoda -- both sides are variables.
			if ( $placed && ( $attrs['theme'] ?? $theme ) === $theme ) {
				return true;
			}

			if ( self::places( is_array( $block['innerBlocks'] ?? null ) ? $block['innerBlocks'] : [], $theme, $slug ) ) {
				return true;
			}
		}

		return false;
	}

	/* ------------------------------------------------------------------ REST */

	/** `GET blicks/v1/studio/entity` */
	public static function show( WP_REST_Request $request ): WP_REST_Response {
		return self::respond( self::read( (array) self::fromRequest( $request ) ) );
	}

	/** `POST blicks/v1/studio/entity` */
	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$content = $request->get_param( 'content' );

		if ( ! is_string( $content ) ) {
			return self::respond( new WP_Error( 'blicks_entity_content', __( 'Nothing was sent to save.', 'blicks' ) ) );
		}

		return self::respond( self::write( (array) self::fromRequest( $request ), $content ) );
	}

	/** Who may call either route: whoever may edit the entity the ref names. */
	public static function permission( WP_REST_Request $request ): bool {
		$ref = self::fromRequest( $request );

		return null !== $ref && self::canEdit( $ref );
	}

	/** @return array{kind: string, id: string|int, type: string}|null */
	private static function fromRequest( WP_REST_Request $request ): ?array {
		return self::from(
			[
				'kind' => $request->get_param( 'kind' ),
				'id' => $request->get_param( 'id' ),
				'type' => $request->get_param( 'type' ),
			]
		);
	}

	/** @param array<string, mixed>|WP_Error $result */
	private static function respond( array|WP_Error $result ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				[
					'code' => $result->get_error_code(),
					'message' => $result->get_error_message(),
				],
				'blicks_entity_missing' === $result->get_error_code() ? 404 : 422
			);
		}

		return new WP_REST_Response( $result, 200 );
	}
}
