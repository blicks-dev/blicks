<?php
/**
 * Checks a block spec against what the plugin can actually emit.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Ai\Catalog\ControlCatalog;
use Blicks\Data\Bindings;
use Blicks\Data\EndpointRegistry;
use Blicks\Data\Formatter;
use Blicks\Data\JsonSource;
use Blicks\Data\Pager;
use Blicks\Data\QuerySource;
use Blicks\Style\CssValue;
use Blicks\Style\ElementStyle;
use Blicks\Style\Parts;
use Blicks\Style\Schema;

/**
 * Checks a spec against what the plugin can actually emit, and says what is wrong in terms the
 * caller can act on.
 *
 * **The style judgement is the engine's own.** Whether a value would be applied is decided by
 * {@see ElementStyle::problems()}, the same call the v2 inspector uses to say "N style values are
 * not used". Re-deciding it here would be a sixth copy of the style engine, and the first one to
 * drift would accept a value the page then silently drops. What this class adds is the *message*:
 * each finding is turned into a sentence naming what to write instead, and each carries the
 * engine's `reason` code so a client can branch on it without parsing prose.
 *
 * On top of that it checks what the engine cannot see: the block exists, its attributes are
 * declared and of the declared type, the states the block's stylesheet actually reacts to, the
 * keys of a sides or corners value, and the shape of the tree itself.
 *
 * Blocks this plugin does not own travel as stored markup ({@see BlockSpec::isOpaque()}). Those
 * are checked for being one well-formed block of the name they claim, and nothing more — their
 * content is WordPress's to judge, which it does with KSES on the way in.
 */
final class SpecValidator {

	/**
	 * Validate a spec. An empty list means it is safe to build.
	 *
	 * @param bool $inLoop The spec sits inside a Loop's card, so its blocks may bind to item fields.
	 * @return list<array{path: string, message: string, reason?: string}>
	 */
	public static function validate( BlockSpec $spec, string $path = 'root', bool $inLoop = false ): array {
		if ( $spec->isOpaque() ) {
			return self::checkOpaque( $spec, $path );
		}

		$block = BlockCatalog::describe( $spec->name );

		if ( null === $block ) {
			return [
				[
					'path' => $path,
					'reason' => 'unknown-block',
					'message' => '' === $spec->name
						? 'Every block needs a "name", e.g. "blicks/box".'
						: sprintf(
							'"%s" is not a Blicks block. Available: %s. A block from another plugin is sent as '
							. '{ "name", "markup" }, exactly as get-post-layout returned it.',
							$spec->name,
							implode( ', ', BlockCatalog::names() )
						),
				],
			];
		}

		$isLoop = 'blicks/loop' === $spec->name;
		$errors = array_merge(
			self::checkAttributes( $spec, $block, $path, $inLoop ),
			self::checkStyleTree( $spec, $block, $path ),
			'blicks/button' === $spec->name ? self::checkButtonContent( $spec, $path ) : [],
			$isLoop ? self::checkLoop( $spec, $path, $inLoop ) : []
		);

		foreach ( $spec->innerBlocks as $index => $child ) {
			$errors = array_merge(
				$errors,
				self::validate( $child, sprintf( '%s.innerBlocks[%d]', $path, $index ), $inLoop || $isLoop )
			);
		}

		return $errors;
	}

	/** Blocks a Button holds in Blocks mode, at any depth — `BUTTON_CHILDREN` in blocks/button/content.ts. */
	private const BUTTON_CHILDREN = [ 'blicks/text', 'blicks/icon', 'blicks/box', 'blicks/image' ];

	/**
	 * What may be inside a Button, mirroring the editor's rules in blocks/button/content.ts.
	 *
	 * The Button saves as one `<a>` or `<button>`, which only takes phrasing content: so its blocks
	 * must be inline (`tag: "span"`, an Image's `inline`) and carry no link of their own. In label
	 * mode it holds nothing — its words are `text`.
	 *
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkButtonContent( BlockSpec $spec, string $path ): array {
		if ( [] === $spec->innerBlocks ) {
			return [];
		}

		if ( 'blocks' !== ( $spec->attributes['content'] ?? null ) ) {
			return [
				[
					'path' => $path . '.innerBlocks',
					'reason' => 'button-content',
					'message' => 'A Button holds blocks only with "content": "blocks". Otherwise its words are the "text" attribute and its icon "icon".',
				],
			];
		}

		$errors = [];
		$walk = static function ( array $children, string $at ) use ( &$walk, &$errors ): void {
			foreach ( $children as $index => $child ) {
				$here = sprintf( '%s.innerBlocks[%d]', $at, $index );
				$a = $child->attributes;

				if ( ! in_array( $child->name, self::BUTTON_CHILDREN, true ) ) {
					$errors[] = [
						'path' => $here,
						'reason' => 'button-content',
						'message' => sprintf( '%s cannot go inside a Button. Use %s — they stay inline inside its link.', $child->name, implode( ', ', self::BUTTON_CHILDREN ) ),
					];
					continue;
				}

				if ( in_array( $child->name, [ 'blicks/text', 'blicks/box' ], true ) && 'span' !== ( $a['tag'] ?? null ) ) {
					$errors[] = [
						'path' => $here . '.attributes.tag',
						'reason' => 'button-content',
						'message' => sprintf( 'Inside a Button, %s needs "tag": "span" — a div or p inside a link is invalid HTML.', $child->name ),
					];
				}

				if ( 'blicks/box' === $child->name && '' !== trim( (string) ( $a['href'] ?? '' ) ) ) {
					$errors[] = [
						'path' => $here . '.attributes.href',
						'reason' => 'button-content',
						'message' => 'A Box inside a Button cannot have its own link: the Button is the link.',
					];
				}

				if ( 'blicks/image' === $child->name && true !== ( $a['inline'] ?? false ) ) {
					$errors[] = [
						'path' => $here . '.attributes.inline',
						'reason' => 'button-content',
						'message' => 'Inside a Button, an Image needs "inline": true — a figure inside a link is invalid HTML.',
					];
				}

				$walk( $child->innerBlocks, $here );
			}
		};

		$walk( $spec->innerBlocks, $path );

		return $errors;
	}

	/**
	 * A block carried as markup: it must be exactly one block, of the name it claims.
	 *
	 * A Blicks block may not travel this way. Its markup is what this plugin generates, and letting
	 * it through verbatim would skip every check on this page — the allow-list, the value cleaning,
	 * the byte-for-byte serializer — for whoever thought to send markup instead of a spec.
	 *
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkOpaque( BlockSpec $spec, string $path ): array {
		$fail = static fn ( string $message ): array => [
			[
				'path' => $path . '.markup',
				'message' => $message,
				'reason' => 'invalid-markup',
			],
		];

		if ( str_starts_with( $spec->name, 'blicks/' ) ) {
			return $fail( sprintf( '"%s" is a Blicks block: send it as { name, attributes, blicks, innerBlocks }, not as markup.', $spec->name ) );
		}

		if ( 1 !== preg_match( '#^[a-z][a-z0-9-]*/[a-z][a-z0-9-]*$#', $spec->name ) ) {
			return $fail( sprintf( '"%s" is not a block name. Names look like "core/paragraph".', $spec->name ) );
		}

		if ( ! function_exists( 'parse_blocks' ) ) {
			return [];
		}

		$all = parse_blocks( (string) $spec->markup );
		$parsed = [];

		foreach ( $all as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			if ( null !== ( $block['blockName'] ?? null ) ) {
				$parsed[] = $block;
				continue;
			}

			// Anything between or around blocks is freeform HTML that no block owns — and that
			// no check would otherwise look at. Whitespace is all a single block's markup has.
			if ( '' !== trim( (string) ( $block['innerHTML'] ?? '' ) ) ) {
				return $fail( '"markup" may hold only the block itself: there is content outside its delimiters.' );
			}
		}

		if ( 1 !== count( $parsed ) || $parsed[0]['blockName'] !== $spec->name ) {
			return $fail(
				sprintf(
					'"markup" must hold exactly one "%s" block, delimiters included, as get-post-layout returned it.',
					$spec->name
				)
			);
		}

		// A Blicks block nested inside another plugin's block would reach the page without the
		// validator or the serializer ever seeing it.
		if ( self::nestsBlicks( $parsed[0] ) ) {
			return $fail(
				sprintf(
					'"%s" contains Blicks blocks. Send those as specs: move them out of the "%s" block, or make this change in the editor.',
					$spec->name,
					$spec->name
				)
			);
		}

		return [];
	}

	/**
	 * Does a parsed block hold a Blicks block anywhere inside it?
	 *
	 * @param array<string, mixed> $block
	 */
	private static function nestsBlicks( array $block ): bool {
		foreach ( (array) ( $block['innerBlocks'] ?? [] ) as $child ) {
			if ( ! is_array( $child ) ) {
				continue;
			}

			if ( str_starts_with( (string) ( $child['blockName'] ?? '' ), 'blicks/' ) || self::nestsBlicks( $child ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Attributes the block does not declare, or of the wrong type.
	 *
	 * Both are silent losses otherwise. WordPress drops an undeclared attribute when it parses the
	 * block back, and drops one whose JSON type does not match the declaration — so a `level` sent
	 * as `"2"` reaches the page as the default heading level, with nothing to say why.
	 *
	 * @param array<string, mixed> $block
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkAttributes( BlockSpec $spec, array $block, string $path, bool $inLoop = false ): array {
		$errors = [];
		$declared = (array) $block['attributes'];

		foreach ( $spec->attributes as $name => $value ) {
			$name = (string) $name;
			$at = sprintf( '%s.attributes.%s', $path, $name );

			// Every block has `metadata` from WordPress, not from block.json. Here it carries only
			// what a Loop card needs: bindings to item fields, and the name the editor shows.
			if ( 'metadata' === $name ) {
				$errors = array_merge( $errors, self::checkMetadata( $spec, $declared, $value, $at, $inLoop ) );
				continue;
			}

			// `lock` is WordPress's too: which of moving and removing the block the editor allows.
			if ( 'lock' === $name ) {
				$valid = is_array( $value ) && ! array_is_list( $value ) && [] === array_diff( array_keys( $value ), [ 'move', 'remove' ] )
					&& [] === array_filter( $value, static fn ( mixed $v ): bool => ! is_bool( $v ) );
				if ( ! $valid ) {
					$errors[] = [
						'path' => $at,
						'reason' => 'invalid-shape',
						'message' => '"lock" is { "move"?: bool, "remove"?: bool }, e.g. { "remove": true } on a Field\'s Input.',
					];
				}
				continue;
			}

			if ( ! array_key_exists( $name, $declared ) ) {
				$errors[] = [
					'path' => $at,
					'reason' => 'unknown-attribute',
					'message' => sprintf(
						'"%s" has no attribute "%s". It accepts: %s.',
						$spec->name,
						$name,
						implode( ', ', array_keys( $declared ) )
					),
				];
				continue;
			}

			// A link attribute must use a scheme a link may have, for every account. `save()` writes
			// a Button's URL as given, and an administrator's content skips KSES, so without this
			// an agent steered by text on some page could plant `javascript:` on the site.
			if ( in_array( $name, self::LINK_ATTRIBUTES, true ) && is_string( $value ) && ! Links::isSafe( $value ) ) {
				$errors[] = [
					'path' => $at,
					'reason' => 'unsafe-url',
					'message' => sprintf( '"%s" must be a relative link or use http, https, mailto or tel.', $name ),
				];
				continue;
			}

			// Rich text is written into the page as given, so a comment opener in it could forge
			// a block delimiter — `<!-- /wp:text --><!-- wp:… {…} -->` — and close this block early
			// or start one the validator never saw. Nothing a Blicks attribute holds needs one.
			if ( is_string( $value ) && 1 === preg_match( '/<!|<\?|-->/', $value ) ) {
				$errors[] = [
					'path' => $at,
					'reason' => 'invalid-markup',
					'message' => sprintf( '"%s" may not contain an HTML comment, `<!` or `<?`.', $name ),
				];
				continue;
			}

			$allowed = BlockShapes::OPTIONS[ $spec->name ][ $name ] ?? null;

			// An option outside its list is not refused by WordPress — `render()` quietly writes the
			// fallback instead, so `tag: "a"` saves a div and nobody is told.
			if ( null !== $allowed && is_string( $value ) && ! in_array( $value, $allowed, true ) ) {
				$errors[] = [
					'path' => $at,
					'reason' => 'invalid-option',
					'message' => sprintf( '"%s" is not a %s for %s. Use one of: %s.', $value, $name, $spec->name, implode( ', ', $allowed ) ),
				];
				continue;
			}

			// An unknown icon draws the fallback star rather than failing, which reads as a bug on
			// the page. `''` is "no icon" on a Button and is fine.
			if ( in_array( $name, BlockShapes::ICON_ATTRIBUTES[ $spec->name ] ?? [], true ) && is_string( $value ) && '' !== $value
				&& Icons::available() && ! Icons::exists( $value ) ) {
				$errors[] = [
					'path' => $at,
					'reason' => 'unknown-icon',
					'message' => sprintf( '"%s" is not an icon on this site. describe-block lists the icon names under `icons`.', $value ),
				];
				continue;
			}

			$type = is_array( $declared[ $name ] ) ? ( $declared[ $name ]['type'] ?? null ) : null;

			if ( is_string( $type ) && null !== $value && ! self::isType( $value, $type ) ) {
				$errors[] = [
					'path' => $at,
					'reason' => 'wrong-type',
					'message' => sprintf( '"%s" must be a %s. WordPress drops a value of any other type.', $name, $type ),
				];
			}
		}

		return $errors;
	}

	/**
	 * A Loop: its source must be one the page can read, and it needs a card to repeat.
	 *
	 * Checked here rather than left to the page because a Loop with a bad source renders its empty
	 * state without complaint, and an agent would report a page that shows nothing as done.
	 *
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkLoop( BlockSpec $spec, string $path, bool $inLoop ): array {
		$errors = [];
		$a = $spec->attributes;
		$source = is_string( $a['source'] ?? null ) ? $a['source'] : 'json';

		if ( $inLoop ) {
			$errors[] = [
				'path' => $path,
				'reason' => 'nested-loop',
				'message' => 'A Loop cannot sit inside another Loop. Put the second Loop next to the first.',
			];
		}

		if ( [] === $spec->innerBlocks ) {
			$errors[] = [
				'path' => $path . '.innerBlocks',
				'reason' => 'empty-loop',
				'message' => 'A Loop repeats its inner blocks once per item. Give it a card, e.g. a blicks/box with "kind": "card" holding a heading bound to a field.',
			];
		}

		if ( 'json' === $source && is_string( $a['data'] ?? null ) ) {
			$decoded = JsonSource::decode( $a['data'] );
			$problem = is_wp_error( $decoded ) ? $decoded->get_error_message() : '';
			if ( '' === $problem && is_wp_error( JsonSource::items( $decoded, is_string( $a['path'] ?? null ) ? $a['path'] : '' ) ) ) {
				$problem = 'It holds no list of objects to repeat over.';
			}
			if ( '' !== $problem ) {
				$errors[] = [
					'path' => $path . '.attributes.data',
					'reason' => 'invalid-json',
					'message' => '"data" must be a JSON string holding a list of objects, e.g. "[{\"title\":\"One\"}]". ' . $problem,
				];
			}
		}

		if ( 'endpoint' === $source ) {
			$id = is_string( $a['endpoint'] ?? null ) ? $a['endpoint'] : '';
			$ids = array_column( EndpointRegistry::all(), 'id' );
			if ( ! in_array( $id, $ids, true ) ) {
				$errors[] = [
					'path' => $path . '.attributes.endpoint',
					'reason' => 'unknown-endpoint',
					'message' => [] === $ids
						? 'This site has no data endpoints. An administrator adds them in Blicks → Settings → Data sources; until then use "source": "json" or "query".'
						: sprintf( '"endpoint" must be the id of one of this site\'s data endpoints: %s.', implode( ', ', $ids ) ),
				];
			}
		}

		if ( array_key_exists( 'pagination', $a ) && null === Pager::sanitize( $a['pagination'] ) ) {
			$errors[] = [
				'path' => $path . '.attributes.pagination',
				'reason' => 'invalid-pagination',
				'message' => sprintf( '"pagination" must be an object whose "mode" is one of: %s. Leave it out for a Loop without pages.', implode( ', ', Pager::MODES ) ),
			];
		}

		if ( 'query' === $source ) {
			$query = is_array( $a['query'] ?? null ) ? $a['query'] : [];
			if ( null === QuerySource::args( $query, 1, 0, 0 ) ) {
				$errors[] = [
					'path' => $path . '.attributes.query.postType',
					'reason' => 'invalid-query',
					'message' => '"query.postType" must be a public post type, e.g. "post", "page" or "product".',
				];
			}
		}

		return $errors;
	}

	/** What `metadata` may hold on a block an agent writes. */
	private const METADATA_KEYS = [ 'bindings', 'name', 'blicksRole' ];

	/** What a Text inside a Field may be: its label or its help (`metadata.blicksRole`). */
	private const ROLES = [ 'label', 'help' ];

	/** What a binding's `args` may hold ({@see Formatter::resolve()}). */
	private const BINDING_ARGS = [ 'key', 'fallback', 'format', 'formatArg' ];

	/**
	 * `metadata.bindings`: attribute → `{ source: "blicks/item", args: { key, format?, formatArg?, fallback? } }`.
	 *
	 * Only attributes the block declares `bindable` can be bound, and only inside a Loop — outside
	 * one there is no item, and the page would show the typed value with nothing to say why.
	 *
	 * @param array<string, mixed> $declared
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkMetadata( BlockSpec $spec, array $declared, mixed $value, string $at, bool $inLoop ): array {
		if ( ! is_array( $value ) || ( [] !== $value && array_is_list( $value ) ) ) {
			return [ self::metadataError( $at, '"metadata" must be an object, e.g. { "bindings": { "content": { "source": "blicks/item", "args": { "key": "title" } } } }.' ) ];
		}

		$errors = [];
		foreach ( array_diff( array_keys( $value ), self::METADATA_KEYS ) as $key ) {
			$errors[] = self::metadataError( $at . '.' . $key, sprintf( '"metadata" may hold only %s.', implode( ' and ', self::METADATA_KEYS ) ) );
		}
		if ( array_key_exists( 'name', $value ) && ! is_string( $value['name'] ) ) {
			$errors[] = self::metadataError( $at . '.name', '"metadata.name" must be a string.' );
		}
		if ( array_key_exists( 'blicksRole', $value ) && ! in_array( $value['blicksRole'], self::ROLES, true ) ) {
			$errors[] = self::metadataError( $at . '.blicksRole', sprintf( '"metadata.blicksRole" marks a Text inside a Field as its %s.', implode( ' or ', self::ROLES ) ) );
		}

		$bindings = $value['bindings'] ?? [];
		if ( ! is_array( $bindings ) || ( [] !== $bindings && array_is_list( $bindings ) ) ) {
			return array_merge( $errors, [ self::metadataError( $at . '.bindings', '"bindings" must be an object of attribute → binding.' ) ] );
		}
		if ( [] !== $bindings && ! $inLoop ) {
			return array_merge( $errors, [ self::metadataError( $at . '.bindings', 'Only blocks inside a blicks/loop can show item fields. Put this block in a Loop\'s card, or remove its bindings.', 'not-in-loop' ) ] );
		}

		$bindable = array_keys( array_filter( $declared, static fn ( $schema ): bool => is_array( $schema ) && is_array( $schema['bindable'] ?? null ) ) );

		foreach ( $bindings as $attribute => $binding ) {
			$here = sprintf( '%s.bindings.%s', $at, $attribute );

			if ( ! in_array( $attribute, $bindable, true ) ) {
				$errors[] = self::metadataError(
					$here,
					[] === $bindable
						? sprintf( '%s has no attribute that can show a field.', $spec->name )
						: sprintf( '%s can show a field in: %s.', $spec->name, implode( ', ', $bindable ) ),
					'not-bindable'
				);
				continue;
			}

			$args = is_array( $binding ) ? ( $binding['args'] ?? null ) : null;
			if ( ! is_array( $binding ) || Bindings::SOURCE !== ( $binding['source'] ?? null ) || ! is_array( $args ) || ! is_string( $args['key'] ?? null ) || '' === $args['key'] ) {
				$errors[] = self::metadataError( $here, sprintf( 'A binding is { "source": "%s", "args": { "key": "<field>" } }, with optional "format", "formatArg" and "fallback".', Bindings::SOURCE ) );
				continue;
			}

			foreach ( $args as $key => $arg ) {
				if ( ! in_array( $key, self::BINDING_ARGS, true ) ) {
					$errors[] = self::metadataError( $here . '.args.' . $key, sprintf( 'A binding\'s "args" may hold only: %s.', implode( ', ', self::BINDING_ARGS ) ) );
				} elseif ( 'format' === $key && ! in_array( $arg, Formatter::FORMATS, true ) ) {
					$errors[] = self::metadataError( $here . '.args.format', sprintf( '"format" must be one of: %s.', implode( ', ', Formatter::FORMATS ) ) );
				} elseif ( 'format' !== $key && ! is_string( $arg ) ) {
					$errors[] = self::metadataError( $here . '.args.' . $key, sprintf( '"%s" must be a string.', $key ) );
				} elseif ( 'fallback' === $key && in_array( $declared[ $attribute ]['bindable']['kind'] ?? 'text', [ 'url', 'image' ], true ) && '' !== $arg && '' === Formatter::safeUrl( $arg ) ) {
					$errors[] = self::metadataError( $here . '.args.fallback', 'A link or picture\'s fallback must be an http(s) address, a path on this site or a #fragment.', 'unsafe-url' );
				} elseif ( is_string( $arg ) && 1 === preg_match( '/<!|<\?|-->/', $arg ) ) {
					$errors[] = self::metadataError( $here . '.args.' . $key, sprintf( '"%s" may not contain an HTML comment, `<!` or `<?`.', $key ), 'invalid-markup' );
				}
			}
		}

		return $errors;
	}

	/** @return array{path: string, message: string, reason: string} */
	private static function metadataError( string $path, string $message, string $reason = 'invalid-metadata' ): array {
		return [
			'path' => $path,
			'reason' => $reason,
			'message' => $message,
		];
	}

	/** Attributes that become an `href` or `src`. */
	private const LINK_ATTRIBUTES = [ 'url', 'href' ];

	/** JSON type check, as WordPress applies it to block attributes. */
	private static function isType( mixed $value, string $type ): bool {
		return match ( $type ) {
			'string' => is_string( $value ),
			'boolean' => is_bool( $value ),
			'number' => is_int( $value ) || is_float( $value ),
			'integer' => is_int( $value ),
			'object' => is_array( $value ) && ( [] === $value || ! array_is_list( $value ) ),
			'array' => is_array( $value ) && array_is_list( $value ),
			default => true,
		};
	}

	/**
	 * The `blicks` tree: control id → state or part → breakpoint → value.
	 *
	 * @param array<string, mixed> $block
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkStyleTree( BlockSpec $spec, array $block, string $path ): array {
		$errors = [];
		$flagged = [];

		foreach ( ElementStyle::problems( $spec->blicks, BlockCatalog::allowList( $spec->name ) ) as $problem ) {
			$errors[] = self::describeProblem( $problem, $spec->name, $path );

			if ( in_array( $problem['reason'], [ 'unknown-control', 'not-allowed' ], true ) ) {
				$flagged[ $problem['id'] ] = true;
			}
		}

		/** @var list<string> $states */
		$states = (array) $block['states'];

		foreach ( $spec->blicks as $id => $tree ) {
			$id = (string) $id;

			if ( isset( $flagged[ $id ] ) || str_starts_with( $id, 'meta.' ) ) {
				continue;
			}

			$errors = array_merge( $errors, self::checkShape( $id, $tree, $states, sprintf( '%s.blicks.%s', $path, $id ) ) );
		}

		return $errors;
	}

	/**
	 * What the engine does not judge because it never gets that far: a tree that is not an object,
	 * a state the block's stylesheet ignores, a side or corner that does not exist.
	 *
	 * @param list<string> $states
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkShape( string $id, mixed $tree, array $states, string $at ): array {
		if ( ! is_array( $tree ) ) {
			return [
				[
					'path' => $at,
					'reason' => 'invalid-shape',
					'message' => sprintf( '"%s" must be an object of state → breakpoint → value, e.g. {"default":{"base":…}}.', $id ),
				],
			];
		}

		$control = ControlCatalog::get( $id );
		$errors = [];

		foreach ( $tree as $slot => $byBreakpoint ) {
			$slot = (string) $slot;
			$slotAt = sprintf( '%s.%s', $at, $slot );
			$state = Parts::parseSlot( $slot )['state'];

			// A state the engine knows but this block does not style emits a marker class that
			// nothing in the block's stylesheet reacts to — visibly nothing happens.
			if ( isset( Schema::STATE_KEY[ $state ] ) && ! in_array( $state, $states, true ) ) {
				$errors[] = [
					'path' => $slotAt,
					'reason' => 'state-not-styled',
					'message' => sprintf(
						'This block does not style the "%s" state. It supports: %s.',
						$state,
						implode( ', ', $states )
					),
				];
				continue;
			}

			// A state limited to what it is for (`stateControls`): the value would be dropped.
			if ( ! Parts::stateAllows( $state, $id ) ) {
				$families = array_values( array_unique( array_map( static fn ( string $c ): string => strtok( $c, '.' ) . '.*', Schema::STATE_CONTROLS[ $state ] ?? [] ) ) );
				$errors[] = [
					'path' => $slotAt,
					'reason' => 'state-not-for-control',
					'message' => sprintf( 'The "%s" state does not style "%s". It styles: %s.', $state, $id, implode( ', ', $families ) ),
				];
				continue;
			}

			if ( ! is_array( $byBreakpoint ) ) {
				$errors[] = [
					'path' => $slotAt,
					'reason' => 'invalid-shape',
					'message' => sprintf( '"%s" must be an object keyed by breakpoint, e.g. {"base":…}.', $slot ),
				];
				continue;
			}

			if ( null === $control ) {
				continue;
			}

			foreach ( $byBreakpoint as $breakpoint => $value ) {
				$errors = array_merge(
					$errors,
					self::checkValueShape( $value, $control, sprintf( '%s.%s', $slotAt, $breakpoint ) )
				);
			}
		}

		return $errors;
	}

	/**
	 * A sides or corners value's keys, and a scalar control given an object.
	 *
	 * @param array{id: string, valueShape: string} $control
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	private static function checkValueShape( mixed $value, array $control, string $path ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		if ( 'scalar' === $control['valueShape'] ) {
			// Several scalar controls take structured values (a shadow list, a background
			// layer); their schema says so and the engine judges them. Only a plain-string
			// control handed an object is wrong in shape.
			$schema = ElementStyle::valueSchema( $control['id'] );

			if ( null !== $schema && 'string' === ( $schema['type'] ?? null ) ) {
				return [
					[
						'path' => $path,
						'reason' => 'invalid-shape',
						'message' => sprintf( '"%s" takes a single value, not an object.', $control['id'] ),
					],
				];
			}

			return [];
		}

		$keys = 'corners' === $control['valueShape'] ? ControlCatalog::CORNERS : ControlCatalog::SIDES;
		$errors = [];

		foreach ( array_keys( $value ) as $key ) {
			if ( in_array( (string) $key, $keys, true ) ) {
				continue;
			}

			$errors[] = [
				'path' => sprintf( '%s.%s', $path, $key ),
				'reason' => 'invalid-shape',
				'message' => sprintf(
					'"%s" takes %s — "%s" is not one of them.',
					$control['id'],
					implode( ', ', $keys ),
					$key
				),
			];
		}

		return $errors;
	}

	/**
	 * One engine finding as a sentence that says what to write instead.
	 *
	 * @param array{id: string, reason: string, slot?: string, breakpoint?: string, value?: mixed} $problem
	 * @return array{path: string, message: string, reason: string}
	 */
	private static function describeProblem( array $problem, string $blockName, string $path ): array {
		$id = $problem['id'];
		$at = sprintf( '%s.blicks.%s', $path, $id );

		if ( isset( $problem['slot'] ) ) {
			$at .= '.' . $problem['slot'];
		}

		if ( isset( $problem['breakpoint'] ) ) {
			$at .= '.' . $problem['breakpoint'];
		}

		$message = match ( $problem['reason'] ) {
			'unknown-control' => sprintf( '"%s" is not a style control. %s', $id, self::didYouMean( $id ) ),
			'not-allowed' => sprintf( '"%s" does not support "%s". %s', $blockName, $id, self::blocksSupporting( $id ) ),
			'unknown-slot' => sprintf(
				'"%s" is not a state. Use one of: %s — or a part (%s), optionally with a state, e.g. "before:hover".',
				$problem['slot'] ?? '',
				implode( ', ', array_keys( Schema::STATE_KEY ) ),
				implode( ', ', array_keys( Schema::PARTS ) )
			),
			'unknown-breakpoint' => sprintf(
				'"%s" is not a breakpoint. Use one of: %s.',
				$problem['breakpoint'] ?? '',
				implode( ', ', array_keys( Schema::BP_KEY ) )
			),
			'not-on-part' => sprintf( '"%s" cannot be set on the "%s" part.', $id, $problem['slot'] ?? '' ),
			default => self::invalidValue( $id, $problem['value'] ?? null ),
		};

		return [
			'path' => $at,
			'message' => $message,
			'reason' => $problem['reason'],
		];
	}

	/**
	 * Naming the token scale is the whole value of this message: "sm is not valid CSS" sends a
	 * caller looking for a unit, when what it needed was a slug from a scale it had not been shown.
	 */
	private static function invalidValue( string $id, mixed $value ): string {
		$shown = is_scalar( $value ) ? (string) $value : (string) wp_json_encode( $value );
		$schema = ElementStyle::valueSchema( $id );
		$control = ControlCatalog::get( $id );
		$category = $control['category'] ?? null;

		$examples = is_array( $schema['examples'] ?? null ) ? array_slice( $schema['examples'], 0, 3 ) : [];
		$examplesText = [] !== $examples
			? ' Examples: ' . implode( ', ', array_map( static fn ( $e ): string => (string) wp_json_encode( $e ), $examples ) ) . '.'
			: '';

		// A gradient is valid CSS for `background-image`, but the engine keeps gradients in their
		// own control; "not valid CSS" would send the caller hunting for a syntax error.
		if ( is_string( $value ) && 1 === preg_match( '/^\s*(repeating-)?(linear|radial|conic)-gradient\(/i', $value ) && 'background.gradient' !== $id ) {
			return sprintf( '"%s" takes no gradients — put this value in "background.gradient" (the same state and breakpoint).', $id );
		}

		// A structured control (shadow layers, transforms…) given CSS text: the CSS may be perfectly
		// valid, so say what shape is wanted instead of calling it invalid.
		if ( is_string( $value ) && null !== $schema && ! self::acceptsString( $schema ) ) {
			return sprintf(
				'"%s" does not take a CSS string — %s%s',
				$id,
				is_string( $schema['description'] ?? null ) ? $schema['description'] : 'see describe-block for its value schema.',
				$examplesText
			);
		}

		if ( is_string( $value ) && strlen( $value ) > CssValue::MAX ) {
			return sprintf( '"%s" is %d characters; the style engine keeps values up to %d. Spread the layers over the block\'s `before` and `after` parts.', $id, strlen( $value ), CssValue::MAX );
		}

		if ( is_string( $value ) && str_starts_with( trim( $value ), 'data:' ) ) {
			return sprintf( '"%s" takes a link to an image (https:// or a site path), not a data: URI.', $id );
		}

		$property = is_string( $schema['x-property'] ?? null ) ? $schema['x-property'] : '';
		$message = null === $category
			? sprintf( '"%s" is not a valid value for "%s"%s; the style engine would drop it.', $shown, $id, '' !== $property ? sprintf( ' (CSS `%s`)', $property ) : '' )
			: sprintf(
				'"%s" is neither a %s token nor valid CSS%s; the style engine would drop it. Use a slug from the %s scale, or one CSS value%s.',
				$shown,
				$category,
				'' !== $property ? sprintf( ' for `%s`', $property ) : '',
				$category,
				// "12px" only helps where a length is what is wanted.
				in_array( $category, [ 'spacing', 'radius', 'fontSize', 'borderWidth', 'width' ], true ) ? ' like "12px"' : ''
			);

		return $message . $examplesText;
	}

	/**
	 * Does a value schema accept a bare string anywhere — directly or as one `oneOf`/`anyOf` branch?
	 *
	 * @param array<string, mixed> $schema
	 */
	private static function acceptsString( array $schema ): bool {
		$type = $schema['type'] ?? null;

		if ( 'string' === $type || ( is_array( $type ) && in_array( 'string', $type, true ) ) ) {
			return true;
		}

		foreach ( [ 'oneOf', 'anyOf' ] as $key ) {
			foreach ( is_array( $schema[ $key ] ?? null ) ? $schema[ $key ] : [] as $branch ) {
				if ( is_array( $branch ) && self::acceptsString( $branch ) ) {
					return true;
				}
			}
		}

		// No `type` and no branches: an open schema, which takes anything.
		return null === $type && ! isset( $schema['oneOf'] ) && ! isset( $schema['anyOf'] );
	}

	/** Controls sharing a prefix with an unknown id — usually the caller invented a leaf. */
	private static function didYouMean( string $id ): string {
		$dot = strpos( $id, '.' );
		$prefix = false === $dot ? $id : substr( $id, 0, $dot );

		$siblings = array_values(
			array_filter(
				ControlCatalog::ids(),
				static fn ( string $known ): bool => str_starts_with( $known, $prefix . '.' )
			)
		);

		if ( [] === $siblings ) {
			return 'No control starts with "' . $prefix . '".';
		}

		return sprintf( 'Controls under "%s": %s.', $prefix, implode( ', ', $siblings ) );
	}

	/** Which blocks do accept a control the caller put on one that does not. */
	private static function blocksSupporting( string $id ): string {
		$names = [];

		foreach ( BlockCatalog::all() as $name => $described ) {
			if ( in_array( $id, (array) $described['controls'], true ) ) {
				$names[] = $name;
			}
		}

		return [] === $names
			? 'No block supports it.'
			: sprintf( 'Blocks that do: %s.', implode( ', ', $names ) );
	}
}
