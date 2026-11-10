<?php
/**
 * Reads and writes one post's blocks as specs.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Abilities\CoreAbilities;

/**
 * Reads one post's content as a block tree, and replaces it.
 *
 * **Permission is not checked here.** Every ability that calls this declares `edit_post` against
 * the id, and the abilities registry enforces it before the callback runs. A second check here
 * would be a second place to get it wrong.
 *
 * What this side owes in exchange is that the worst outcome of a write is a refusal, never a
 * damaged page. {@see self::prepare()} runs every check before anything is saved, and every one of
 * them reports rather than repairs:
 *
 * 1. Size limits, then {@see SpecValidator} on the whole tree.
 * 2. {@see SpecSerializer} refuses any block it cannot reproduce byte for byte.
 * 3. **KSES, for an account without `unfiltered_html`.** WordPress filters content on save for such
 *    an account, and would quietly remove — say — the SVG of a button's icon, leaving a block the
 *    editor then calls invalid. The markup is run through the same filter first; if it would
 *    change, the write is refused with the block named.
 * 4. A post another user has open in the editor is not written under them.
 */
final class PostLayout {

	/**
	 * One post, as its blocks. Null when there is no such post.
	 *
	 * @return array{id: int, title: string, type: string, status: string, modified: string, blockCount: int, blocks: list<array<string, mixed>>}|null
	 */
	public static function read( int $id ): ?array {
		$post = get_post( $id );

		if ( null === $post ) {
			return null;
		}

		$specs = SpecParser::fromMarkup( (string) $post->post_content );

		return [
			'id' => (int) $post->ID,
			'title' => (string) $post->post_title,
			'type' => (string) $post->post_type,
			'status' => (string) $post->post_status,
			'modified' => self::modified( $post ),
			'blockCount' => self::count( $specs ),
			'blocks' => array_map( static fn ( BlockSpec $spec ): array => $spec->toArray(), $specs ),
		];
	}

	/**
	 * Check a tree and turn it into the markup that would be stored — or say why not.
	 *
	 * **Agents author Blicks blocks only.** A block from another plugin travels as its stored
	 * markup, and markup cannot be judged the way the browser will render it: WordPress renders
	 * many blocks on the server from the JSON in their delimiters, binds pattern overrides into
	 * attributes, and runs shortcodes, none of which an HTML check sees. So such a block is
	 * accepted only byte for byte as it already stands in the post being written — kept, moved
	 * or left out, never created or changed. Everything an agent does author is markup this
	 * plugin generated itself, which {@see MarkupGuard} can judge.
	 *
	 * @param list<mixed> $blocks   Raw blocks as decoded from the request.
	 * @param string      $existing The post's content now; '' for a post that does not exist yet.
	 * @return array{markup: string, blockCount: int}|array{errors: list<array<string, string>>}
	 */
	public static function prepare( array $blocks, string $existing = '' ): array {
		$checked = CoreAbilities::validate( $blocks );

		if ( false === $checked['valid'] ) {
			return [ 'errors' => $checked['errors'] ?? [] ];
		}

		$specs = self::withIds( array_map( static fn ( array $block ): BlockSpec => BlockSpec::fromArray( $block ), $blocks ) );
		$foreign = self::notFromPost( $specs, $existing );

		if ( [] !== $foreign ) {
			return [ 'errors' => $foreign ];
		}

		$unsupported = SpecSerializer::unsupported( $specs );

		if ( [] !== $unsupported ) {
			return [
				'errors' => [
					[
						'path' => 'blocks',
						'reason' => 'unsupported',
						'message' => sprintf(
							'Cannot write %s here: only the editor can produce that markup. Leave it out, or make this change in the editor.',
							implode( ', ', $unsupported )
						),
					],
				],
			];
		}

		try {
			$parts = array_map( static fn ( BlockSpec $spec ): string => SpecSerializer::toMarkup( [ $spec ] ), $specs );
		} catch ( UnsupportedBlock $e ) {
			return [
				'errors' => [
					[
						'path' => 'blocks',
						'reason' => 'unsupported',
						'message' => $e->getMessage(),
					],
				],
			];
		}

		$unsafe = self::unsafeMarkup( $parts, $specs );

		if ( [] !== $unsafe ) {
			return [ 'errors' => $unsafe ];
		}

		$stripped = self::strippedByKses( $parts, $specs );

		if ( [] !== $stripped ) {
			return [ 'errors' => $stripped ];
		}

		return [
			'markup' => implode( "\n\n", $parts ),
			'blockCount' => self::count( $specs ),
		];
	}

	/**
	 * Replace one post's content with a spec tree.
	 *
	 * @param list<mixed> $blocks
	 * @return array<string, mixed>
	 */
	public static function write( int $id, array $blocks, bool $dryRun = false ): array {
		$post = get_post( $id );

		if ( null === $post ) {
			return [ 'error' => sprintf( 'Post %d could not be read.', $id ) ];
		}

		$prepared = self::prepare( $blocks, (string) $post->post_content );

		if ( isset( $prepared['errors'] ) ) {
			return [
				'written' => false,
				'errors' => $prepared['errors'],
			];
		}

		$refusal = self::refusal( $post );

		if ( null !== $refusal ) {
			return [
				'written' => false,
				'error' => $refusal,
			];
		}

		$markup = $prepared['markup'];
		$changed = (string) $post->post_content !== $markup;

		if ( $dryRun ) {
			return [
				'written' => false,
				'dryRun' => true,
				'valid' => true,
				'changed' => $changed,
				'blockCount' => $prepared['blockCount'],
				'bytes' => strlen( $markup ),
			];
		}

		if ( ! $changed ) {
			return [
				'id' => $id,
				'written' => false,
				'changed' => false,
				'blockCount' => $prepared['blockCount'],
			];
		}

		// The version the author had before an agent touched the page goes into Revisions first.
		// WordPress stores one on update too, but that one holds the *new* content.
		$revision = wp_save_post_revision( $id );
		$revision = is_int( $revision ) ? $revision : self::latestRevision( $id );

		// `wp_update_post()` expects slashed input and unslashes it. Unslashed block markup loses
		// every backslash — the `<` escapes in its attribute JSON among them.
		$updated = wp_update_post(
			wp_slash(
				[
					'ID' => $id,
					'post_content' => $markup,
				]
			),
			true
		);

		if ( is_wp_error( $updated ) ) {
			return [
				'written' => false,
				'error' => $updated->get_error_message(),
			];
		}

		$stored = (string) get_post_field( 'post_content', $id, 'raw' );

		/**
		 * Fires after an agent replaced a post's layout through MCP.
		 *
		 * For an audit log. The post's own revision history already records who changed what.
		 *
		 * @param int $id         The post.
		 * @param int $revisionId The revision holding the content as it was, or 0.
		 * @param int $userId     The account the agent signed in as.
		 */
		do_action( 'blicks_mcp_post_layout_written', $id, $revision, get_current_user_id() );

		return [
			'id' => $id,
			'written' => true,
			'blockCount' => $prepared['blockCount'],
			'revisionId' => $revision,
			// Something outside this plugin — a `content_save_pre` filter — changed the markup on
			// the way in. Said rather than hidden: the editor may now flag a block as invalid.
			'storedAsSent' => $stored === $markup,
		];
	}

	/**
	 * Why this post must not be written right now, or null.
	 */
	public static function refusal( \WP_Post $post ): ?string {
		if ( ! function_exists( 'wp_check_post_lock' ) ) {
			require_once ABSPATH . 'wp-admin/includes/post.php';
		}

		$holder = wp_check_post_lock( $post );

		if ( false !== $holder ) {
			$user = get_userdata( (int) $holder );

			return sprintf(
				'%s has this post open in the editor. Writing now would overwrite their unsaved work; try again when they have closed it.',
				false !== $user ? $user->display_name : 'Another user'
			);
		}

		if ( ! wp_revisions_enabled( $post ) ) {
			return 'Revisions are turned off for this post, so the change could not be undone. Refusing to write it.';
		}

		return null;
	}

	/** The newest revision of a post, or 0 — for when the content already matched it. */
	private static function latestRevision( int $id ): int {
		$revisions = wp_get_post_revisions(
			$id,
			[
				'posts_per_page' => 1,
				'fields' => 'ids',
			]
		);

		return [] === $revisions ? 0 : (int) reset( $revisions );
	}

	/**
	 * Blocks from other plugins that are not, byte for byte, already in the post — see
	 * {@see self::prepare()} for why nothing else is accepted.
	 *
	 * @param list<BlockSpec> $specs
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function notFromPost( array $specs, string $existing ): array {
		$kept = [];

		foreach ( SpecParser::fromMarkup( $existing ) as $spec ) {
			foreach ( self::opaque( $spec ) as $block ) {
				$kept[ (string) $block->markup ] = true;
			}
		}

		$errors = [];

		foreach ( $specs as $index => $spec ) {
			foreach ( self::opaque( $spec, sprintf( 'blocks[%d]', $index ) ) as $path => $block ) {
				if ( isset( $kept[ (string) $block->markup ] ) ) {
					continue;
				}

				$errors[] = [
					'path' => $path,
					'reason' => 'not-in-post',
					'message' => sprintf(
						'"%s" is not a block from this post as it stands. Blocks from other plugins can be kept, moved or '
						. 'left out — sent back exactly as get-post-layout returned them — but agents cannot create or change '
						. 'them. Build with Blicks blocks, or make this change in the editor.',
						$block->name
					),
				];
			}
		}

		return $errors;
	}

	/**
	 * Every block carried as markup in a tree, keyed by its path.
	 *
	 * @return array<string, BlockSpec>
	 */
	private static function opaque( BlockSpec $spec, string $path = '' ): array {
		if ( $spec->isOpaque() ) {
			return [ $path => $spec ];
		}

		$found = [];

		foreach ( $spec->innerBlocks as $index => $child ) {
			$found += self::opaque( $child, sprintf( '%s.innerBlocks[%d]', $path, $index ) );
		}

		return $found;
	}

	/**
	 * What an agent authored carrying script or an unsafe link, for every account — see
	 * {@see MarkupGuard}. A top-level block from another plugin is not checked: {@see notFromPost()}
	 * has already established it is the post's own, unchanged.
	 *
	 * @param list<string>    $parts One serialized top-level block each.
	 * @param list<BlockSpec> $specs The same blocks, as specs.
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function unsafeMarkup( array $parts, array $specs ): array {
		$errors = [];
		$authored = [];

		foreach ( $parts as $index => $markup ) {
			if ( ! $specs[ $index ]->isOpaque() ) {
				$authored[] = $markup;
			}
		}

		// Each block on its own, then everything authored as the browser receives it — built
		// with WordPress's own block parser, so a tag opened in one block and finished in the
		// next cannot hide in the seam between them.
		$whole = MarkupGuard::problems( self::rendered( implode( "\n\n", $authored ) ) );

		foreach ( $parts as $index => $markup ) {
			if ( $specs[ $index ]->isOpaque() ) {
				continue;
			}

			$problems = MarkupGuard::problems( $markup );

			if ( [] === $problems ) {
				continue;
			}

			$errors[] = [
				'path' => sprintf( 'blocks[%d]', $index ),
				'reason' => 'unsafe-markup',
				'message' => sprintf(
					'"%s" contains %s. Agents may not add scripts, event handlers, embedded frames or forms, '
					. 'or links other than http, https, mailto and tel — whichever account they sign in as. Nothing was written.',
					$specs[ $index ]->name,
					implode( ', ', $problems )
				),
			];
		}

		if ( [] === $errors && [] !== $whole ) {
			$errors[] = [
				'path' => 'blocks',
				'reason' => 'unsafe-markup',
				'message' => sprintf(
					'Together, these blocks render as %s — markup split across blocks. Nothing was written.',
					implode( ', ', $whole )
				),
			];
		}

		return $errors;
	}

	/**
	 * Block markup with its delimiters removed the way rendering removes them: each block's
	 * `innerContent` with its children spliced in, as `parse_blocks()` read them.
	 */
	private static function rendered( string $markup ): string {
		$flatten = static function ( array $block ) use ( &$flatten ): string {
			$out = '';
			$child = 0;

			foreach ( (array) ( $block['innerContent'] ?? [] ) as $chunk ) {
				$out .= is_string( $chunk ) ? $chunk : $flatten( (array) ( $block['innerBlocks'][ $child++ ] ?? [] ) );
			}

			return $out;
		};

		return implode( '', array_map( $flatten, parse_blocks( $markup ) ) );
	}

	/**
	 * Blocks WordPress would change on save for this account, as validator errors.
	 *
	 * Checked per top-level block so the message can say *which* one: a page-wide "something was
	 * removed" is not something a caller can fix.
	 *
	 * @param list<string>    $parts One serialized top-level block each.
	 * @param list<BlockSpec> $specs The same blocks, as specs.
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function strippedByKses( array $parts, array $specs ): array {
		if ( current_user_can( 'unfiltered_html' ) ) {
			return [];
		}

		$errors = [];

		foreach ( $parts as $index => $markup ) {
			if ( wp_kses_post( $markup ) === $markup ) {
				continue;
			}

			$errors[] = [
				'path' => sprintf( 'blocks[%d]', $index ),
				'reason' => 'kses',
				'message' => sprintf(
					'WordPress would remove part of "%s" when your account saves it (your role cannot post unfiltered HTML) — '
					. 'typically an icon\'s SVG or an attribute. Nothing was written. Leave that part out, or ask an editor '
					. 'or administrator to make this change.',
					$specs[ $index ]->name
				),
			];
		}

		return $errors;
	}

	/**
	 * Give every Blicks block without a `uniqueId` one.
	 *
	 * The editor stamps one on every block from its client id, and the block's scoped styles hang
	 * off it (`.bl-<id>`). A block written without one renders, but loses its tier-3 styles until
	 * someone opens the page in the editor. Ids are 8 hex characters, as the editor makes them.
	 *
	 * @param list<BlockSpec> $specs
	 * @param array<string, true> $taken
	 * @return list<BlockSpec>
	 */
	private static function withIds( array $specs, array &$taken = [] ): array {
		if ( [] === $taken ) {
			foreach ( $specs as $spec ) {
				foreach ( $spec->walk() as $node ) {
					$id = $node->attributes['uniqueId'] ?? null;

					if ( is_string( $id ) && '' !== $id ) {
						$taken[ $id ] = true;
					}
				}
			}
		}

		$out = [];

		foreach ( $specs as $spec ) {
			if ( $spec->isOpaque() || ! str_starts_with( $spec->name, 'blicks/' ) ) {
				$out[] = $spec;
				continue;
			}

			$attributes = $spec->attributes;

			if ( ! is_string( $attributes['uniqueId'] ?? null ) || '' === $attributes['uniqueId'] ) {
				do {
					$id = substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 8 );
				} while ( isset( $taken[ $id ] ) );

				$taken[ $id ] = true;
				$attributes = [ 'uniqueId' => $id ] + $attributes;
			}

			$out[] = new BlockSpec( $spec->name, $attributes, $spec->blicks, self::withIds( $spec->innerBlocks, $taken ) );
		}

		return $out;
	}

	/**
	 * How many blocks a tree holds, counting children.
	 *
	 * @param list<BlockSpec> $specs
	 */
	public static function count( array $specs ): int {
		$total = 0;

		foreach ( $specs as $spec ) {
			$total += count( $spec->walk() );
		}

		return $total;
	}

	/** When a post last changed. Drafts carry no GMT date, which `get_post_datetime()` accounts for. */
	private static function modified( \WP_Post $post ): string {
		$date = get_post_datetime( $post, 'modified' );

		return false === $date ? '' : $date->format( DATE_ATOM );
	}
}
