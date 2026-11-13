<?php
/**
 * The abilities this plugin registers.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Ai\Catalog\ControlCatalog;
use Blicks\Ai\Catalog\TokenCatalog;
use Blicks\Ai\Spec\BlockShapes;
use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\Icons;
use Blicks\Ai\Spec\Limits;
use Blicks\Ai\Spec\PostLayout;
use Blicks\Ai\Spec\SpecValidator;
use Blicks\Data\Bindings;
use Blicks\Data\EndpointRegistry;
use Blicks\Data\Formatter;
use Blicks\Data\Pager;
use Blicks\DesignSystem\Animations;
use Blicks\DesignSystem\Keyframes;
use Blicks\Mcp\Posts;
use Blicks\Style\ElementStyle;

/**
 * The abilities this plugin registers, as data.
 *
 * Each entry is the `$args` array {@see \wp_register_ability()} takes, keyed by the ability name.
 * Nothing here wraps the Abilities API — WordPress already defines this shape.
 *
 * **One deviation: `permission` instead of `permission_callback`.** Each entry *declares* who may
 * call it, and {@see \Blicks\Providers\McpServiceProvider} turns the declaration into the callback.
 * Declaring rather than writing closures keeps every rule in one readable table and testable as
 * data, and it means a new ability cannot hide something more permissive inside a callback. Forms:
 *
 * - `'edit_posts'` — a site-wide capability.
 * - `[ 'cap' => 'edit_post', 'arg' => 'id' ]` — a capability on the one post the input names. This
 *   is the form every tool touching a post uses: `edit_posts` would ask whether the caller may edit
 *   posts *in general* and hand over someone else's private draft.
 * - `[ 'cap' => 'edit_post', 'arg' => 'id', 'publishArg' => 'status' ]` — as above, plus
 *   `publish_post` on the same post when the requested status makes it public.
 * - `[ 'typeCap' => 'create_posts', 'typeArg' => 'postType' ]` — the post type's own capability.
 *
 * An entry with no `permission` is not registered at all. See the provider for why.
 *
 * **Annotations are a contract, not documentation.** A client reads `readonly` / `destructive` to
 * decide whether to ask the user first, so the three write tools say so and nothing else does.
 */
final class CoreAbilities {

	/** The ability namespace. Core requires `namespace/name`, and ours matches the plugin. */
	public const NAMESPACE = 'blicks';

	/** The category these are grouped under in the abilities registry. */
	public const CATEGORY = 'blicks';

	/**
	 * Capability for the read-only abilities: anyone who could already open the block editor.
	 *
	 * Public because the MCP transport is gated on it too: a caller who could not execute a single
	 * tool should not be able to list them either.
	 */
	public const READ = 'edit_posts';

	private const ON_POST = [
		'cap' => 'edit_post',
		'arg' => 'id',
	];

	/** One block as an agent sends it. Children are checked by the validator, not the schema. */
	private const BLOCK = [
		'type' => 'object',
		'properties' => [
			'name' => [
				'type' => 'string',
				'maxLength' => 100,
				'description' => 'Block name, e.g. "blicks/box".',
			],
			'attributes' => [
				'type' => 'object',
				'description' => 'The block\'s attributes, as describe-block lists them.',
			],
			'blicks' => [
				'type' => 'object',
				'description' => 'Style values: { "<control id>": { "<state>": { "<breakpoint>": value } } }.',
			],
			'innerBlocks' => [
				'type' => 'array',
				'maxItems' => Limits::MAX_BLOCKS,
				'items' => [ 'type' => 'object' ],
			],
			'markup' => [
				'type' => 'string',
				'maxLength' => Limits::MAX_BYTES,
				'description' => 'Only for a block from another plugin that is already in this post: its stored markup, '
					. 'exactly as get-post-layout returned it. Such blocks can be kept, moved or left out, not created or changed.',
			],
		],
		'required' => [ 'name' ],
		'additionalProperties' => false,
	];

	/**
	 * The category definition, for `wp_register_ability_category()`.
	 *
	 * @return array{slug: string, label: string, description: string}
	 */
	public static function category(): array {
		return [
			'slug' => self::CATEGORY,
			'label' => 'Blicks',
			'description' => 'Inspect Blicks blocks and the design system, validate layouts, and read or change the layout of posts you can edit.',
		];
	}

	/**
	 * Every ability, keyed by name.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function all(): array {
		return [
			self::NAMESPACE . '/list-blocks' => self::listBlocks(),
			self::NAMESPACE . '/describe-block' => self::describeBlock(),
			self::NAMESPACE . '/get-design-system' => self::getDesignSystem(),
			self::NAMESPACE . '/save-animation' => self::saveAnimation(),
			self::NAMESPACE . '/validate-layout' => self::validateLayout(),
			self::NAMESPACE . '/list-posts' => self::listPosts(),
			self::NAMESPACE . '/get-post-layout' => self::getPostLayout(),
			self::NAMESPACE . '/update-post-layout' => self::updatePostLayout(),
			self::NAMESPACE . '/create-page' => self::createPage(),
			self::NAMESPACE . '/set-post-status' => self::setPostStatus(),
		];
	}

	/**
	 * `meta` for an ability.
	 *
	 * `mcp.public` is false on purpose: the MCP Adapter's default server exposes every ability
	 * marked public through its generic `execute-ability` tool, with a transport any logged-in user
	 * can reach. These are offered on this plugin's own server only, behind its own gate — one door,
	 * not two. `show_in_rest` stays at core's default (off) for the same reason.
	 *
	 * @return array<string, mixed>
	 */
	private static function meta( bool $readonly, bool $destructive = false, bool $idempotent = true ): array {
		return [
			// `readonly` / `destructive` / `idempotent`, which core normalises into MCP's hint
			// names. Passing the hint names straight through leaves the real keys null.
			'annotations' => [
				'readonly' => $readonly,
				'destructive' => $destructive,
				'idempotent' => $idempotent,
			],
			'mcp' => [
				'public' => false,
				'type' => 'tool',
			],
		];
	}

	/** An input schema taking no arguments. */
	private static function noInput(): array {
		return [
			'type' => 'object',
			'properties' => (object) [],
			'additionalProperties' => false,
		];
	}

	/** @return array<string, mixed> */
	private static function postId( string $description ): array {
		return [
			'type' => 'integer',
			'minimum' => 1,
			'description' => $description,
		];
	}

	/** @return array<string, mixed> */
	private static function blocksInput( string $description ): array {
		return [
			'type' => 'array',
			'maxItems' => Limits::MAX_BLOCKS,
			'description' => $description,
			'items' => self::BLOCK,
		];
	}

	/** @return array<string, mixed> */
	private static function listBlocks(): array {
		return [
			'label' => 'List Blicks blocks',
			'description' => 'List every Blicks block on this site with a one-line description. Call this first when '
				. 'building a layout, then describe-block for the one you need.',
			'category' => self::CATEGORY,
			'input_schema' => self::noInput(),
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static function (): array {
				$blocks = [];

				foreach ( BlockCatalog::all() as $name => $described ) {
					$blocks[] = [
						'name' => $name,
						'title' => $described['title'],
						'description' => $described['description'],
					];
				}

				return [ 'blocks' => $blocks ];
			},
			'permission' => self::READ,
			'meta' => self::meta( true ),
		];
	}

	/** @return array<string, mixed> */
	private static function describeBlock(): array {
		return [
			'label' => 'Describe a Blicks block',
			'description' => 'Everything needed to build one block: its attributes and their defaults, every style '
				. 'control it accepts with the JSON Schema of that control\'s value, the states it can be styled in, '
				. 'how values are stored per state and breakpoint, and the token slugs each scale offers. A '
				. 'control that is not listed here is dropped by the style engine.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'name' => [
						'type' => 'string',
						'maxLength' => 100,
						'description' => 'Block name, e.g. "blicks/box". A bare slug like "box" also works.',
					],
				],
				'required' => [ 'name' ],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static function ( array $input ): array {
				$described = self::describe( is_string( $input['name'] ?? null ) ? $input['name'] : '' );

				if ( isset( $described['controls'] ) ) {
					$described['tokens'] = self::tokenScales( $described['controls'] );
				}

				return $described;
			},
			'permission' => self::READ,
			'meta' => self::meta( true ),
		];
	}

	/**
	 * The body of `describe-block`, testable without WordPress.
	 *
	 * Each control carries its `valueSchema` — the engine's own JSON Schema for one value, with
	 * examples and the token scale it reads (`x-tokens`) — so a caller writes a value the engine
	 * keeps on the first try instead of learning the shape from refusals.
	 *
	 * An unknown name is answered, not thrown: a model handed the real names fixes it next turn.
	 *
	 * @return array<string, mixed>
	 */
	public static function describe( string $name ): array {
		$block = BlockCatalog::describe( $name );

		if ( null === $block ) {
			return [
				'error' => sprintf(
					'"%s" is not a Blicks block. Available: %s.',
					$name,
					implode( ', ', BlockCatalog::names() )
				),
			];
		}

		$controls = [];

		foreach ( $block['controls'] as $id ) {
			$control = ControlCatalog::get( $id );
			$controls[] = [
				'id' => $id,
				'valueShape' => $control['valueShape'] ?? 'scalar',
				'valueSchema' => ElementStyle::valueSchema( $id ),
			];
		}

		$block['controls'] = $controls;

		foreach ( BlockShapes::OPTIONS[ $name ] ?? [] as $attribute => $allowed ) {
			if ( isset( $block['attributes'][ $attribute ] ) && is_array( $block['attributes'][ $attribute ] ) ) {
				$block['attributes'][ $attribute ]['enum'] = $allowed;
			}
		}

		if ( isset( BlockShapes::ICON_ATTRIBUTES[ $name ] ) && Icons::available() ) {
			$block['icons'] = Icons::names();
		}

		if ( 'blicks/loop' === $block['name'] ) {
			$block['loop'] = self::loopGuide();
		}

		return $block + [
			'valueTree' => ElementStyle::valueTree(),
			'breakpoints' => ControlCatalog::BREAKPOINTS,
		];
	}

	/**
	 * How to build a Loop, which no attribute list can say on its own: where items come from, how
	 * a block in the card shows a field, and a spec that validates as it stands.
	 *
	 * Endpoints are listed by id and name only — the addresses are for administrators, and an agent
	 * only ever needs the id ({@see \Blicks\Http\Controllers\LoopController::endpoints()}).
	 *
	 * @return array<string, mixed>
	 */
	public static function loopGuide(): array {
		$bindable = [];
		foreach ( BlockCatalog::all() as $blockName => $described ) {
			$attributes = array_keys( array_filter( $described['attributes'], static fn ( $schema ): bool => is_array( $schema ) && is_array( $schema['bindable'] ?? null ) ) );
			if ( [] !== $attributes ) {
				$bindable[ $blockName ] = $attributes;
			}
		}

		$bind = static fn ( string $key, array $more = [] ): array => [
			'source' => Bindings::SOURCE,
			'args' => [ 'key' => $key ] + $more,
		];

		return [
			'about' => 'A Loop repeats its inner blocks (the card) once per item. Set "source" and its settings: '
				. '"json" with "data" (a JSON string holding a list of objects) and optional "path" to the list ("data.items"); '
				. '"endpoint" with "endpoint" (an id from `endpoints`) and optional "path"; '
				. '"query" with "query": { postType, orderBy, order, taxonomy: { <taxonomy>: <term slug> } } for published posts. '
				. 'A block in the card shows an item field through "metadata": { "bindings": { "<attribute>": { "source": "'
				. Bindings::SOURCE . '", "args": { "key": "<field>", "format"?, "formatArg"?, "opts"?, "before"?, "after"?, "fallback"? } } } } '
				. '("format": case, truncate, number, currency, date or join; "opts" per format, e.g. currency { "currency": "USD" or "currencyField": "<field>", "show": "symbol"|"code"|"code-after"|"both", "decimals": "auto"|"0"|"2" }, '
				. 'number { "decimals", "group": ","|"."|" "|"", "point": "."|",", "compact": "yes" }, date { "style": "short"|"long"|"us"|"dmy"|"mdy"|"iso"|"weekday"|"site"|"custom", "pattern" }, case { "case": "upper"|"lower"|"title" }; '
				. '"before"/"after" wrap the value); its own value is '
				. 'what the editor shows until items load. Query items have the fields id, title, excerpt, url, date, modified, '
				. 'author, author_url, featured_image, featured_image_alt, category, categories, tags and comment_count. '
				. 'A Loop shows at most 50 items unless it is paged: "pagination": { "mode": "pages" (page links) or "more" (a Load more '
				. 'button), "show"?: "numbers"|"count", "look"?: "pills"|"boxes"|"text", "button"?: a blicks/button variant '
				. '(default, outline, secondary, ghost), "align"?: "start"|"center"|"end"|"between", "infinite"?: true to also load '
				. 'on scroll (Load more only), "labels"?: { prev, next, nav, more, status } }. Its "limit" is then the items per page. '
				. 'With "query": { "inherit": true } the pages follow the archive\'s own /page/N/ and posts per page. '
				. 'Cards open a dialog when one of the Loop\'s inner blocks is a blicks/dialog (one per Loop, with an "anchor"): '
				. 'its blocks are the item\'s details, bound to fields like the card\'s. On the page, a plain click on any link in '
				. 'the card to the item\'s "url" field opens that dialog with the item; other links (author, category) and '
				. 'Ctrl/Cmd-clicks keep their target. "itemInUrl": true adds ?item=<slug, else id, else position> while it is open. '
				. 'Card rules ("rules") apply to the dialog\'s blocks too: "hide" takes a uniqueId of a card or a dialog block, '
				. 'and badge and heading colours carry over.',
			'pagination' => [
				'modes' => Pager::MODES,
				'show' => Pager::SHOWS,
				'look' => Pager::LOOKS,
				'button' => Pager::BUTTONS,
				'align' => Pager::ALIGNS,
				'labels' => Pager::LABELS,
			],
			'endpoints' => array_map(
				static fn ( array $e ): array => [
					'id' => $e['id'],
					'name' => $e['name'],
				],
				EndpointRegistry::all()
			),
			'bindable' => $bindable,
			'formats' => Formatter::FORMATS,
			'example' => [
				'name' => 'blicks/loop',
				'attributes' => [
					'source' => 'json',
					'data' => (string) wp_json_encode(
						[
							[
								'title' => 'Arc floor lamp',
								'price' => 189,
							],
							[
								'title' => 'Oak side table',
								'price' => 240,
							],
						]
					),
					'columns' => [
						'desktop' => 3,
						'tablet' => 2,
						'phone' => 1,
					],
				],
				'innerBlocks' => [
					[
						'name' => 'blicks/box',
						'attributes' => [
							'kind' => 'card',
							'tag' => 'article',
						],
						'innerBlocks' => [
							[
								'name' => 'blicks/heading',
								'attributes' => [
									'level' => 3,
									'content' => 'Item title',
									'metadata' => [ 'bindings' => [ 'content' => $bind( 'title' ) ] ],
								],
							],
							[
								'name' => 'blicks/text',
								'attributes' => [
									'content' => '$0',
									'metadata' => [
										'bindings' => [
											'content' => $bind(
												'price',
												[
													'format' => 'currency',
													'formatArg' => '$',
												]
											),
										],
									],
								],
							],
						],
					],
				],
			],
		];
	}

	/**
	 * The slugs of every token scale the controls read, so `x-tokens: "spacing"` can be resolved
	 * without a second call. Reads the live design system, so it is added outside {@see describe()}.
	 *
	 * @param list<array{valueSchema: array<string, mixed>|null}> $controls
	 * @return array<string, list<string>>
	 */
	private static function tokenScales( array $controls ): array {
		$scales = [];

		foreach ( $controls as $control ) {
			$scale = $control['valueSchema']['x-tokens'] ?? null;

			if ( is_string( $scale ) && ! isset( $scales[ $scale ] ) ) {
				$scales[ $scale ] = TokenCatalog::slugs( $scale );
			}
		}

		return $scales;
	}

	/** @return array<string, mixed> */
	private static function getDesignSystem(): array {
		return [
			'label' => 'Get the Blicks design system',
			'description' => 'This site\'s design tokens — colours, spacing, typography, radius and the rest — as slugs '
				. 'with the values they resolve to, plus the breakpoints. Prefer a token slug over a literal value: '
				. 'a slug follows the site when the theme changes. Breakpoints are MAX widths, so "base" is the '
				. 'wide default and narrower keys override it. `animations` is the keyframe library: '
				. '`animation.name` takes an entry\'s `name` (`bl-spin`, `bl-anim-…`), and nothing else animates. '
				. 'Each entry\'s `defaults` are the duration, easing and the rest it was designed for.',
			'category' => self::CATEGORY,
			'input_schema' => self::noInput(),
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static fn (): array => [
				'tokens' => TokenCatalog::all(),
				'breakpoints' => TokenCatalog::breakpoints(),
				'animations' => self::animations(),
			],
			'permission' => self::READ,
			'meta' => self::meta( true ),
		];
	}

	/**
	 * The keyframe library as an agent needs it: what to write in `animation.name`, and for a
	 * custom entry the steps, so it can be read back and changed rather than guessed at.
	 *
	 * @return list<array<string, mixed>>
	 */
	private static function animations(): array {
		return array_map(
			static fn ( array $animation ): array => array_filter(
				[
					'name' => $animation['name'],
					'slug' => $animation['slug'],
					'label' => $animation['label'],
					'description' => $animation['description'],
					'builtin' => $animation['builtin'],
					'defaults' => $animation['defaults'],
					'steps' => $animation['builtin'] ? null : $animation['steps'],
				],
				static fn ( mixed $value ): bool => null !== $value && '' !== $value
			),
			Animations::library()
		);
	}

	/**
	 * Adding a keyframe to the design system, so a layout can name it.
	 *
	 * Gated as the Design System screen's own animation routes are — `manage_options` — because the
	 * library is site-wide: every block naming the animation changes with it. Saving an existing
	 * slug replaces that entry, so a retry is harmless.
	 *
	 * @return array<string, mixed>
	 */
	private static function saveAnimation(): array {
		return [
			'label' => 'Save a design system animation',
			'description' => 'Add a keyframe animation to this site\'s design system, or replace the one with the same slug. '
				. 'Use it when no entry in get-design-system\'s `animations` moves the way a layout needs. Returns the '
				. '`name` to write in `animation.name`. Site-wide: every block already naming it changes too.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'slug' => [
						'type' => 'string',
						'pattern' => '^[a-z0-9]+(-[a-z0-9]+)*$',
						'maxLength' => 40,
						'description' => 'Lowercase kebab-case. Not a built-in slug (spin, float, ping, rise, pan, marquee, fill).',
					],
					'label' => [
						'type' => 'string',
						'maxLength' => 60,
					],
					'defaults' => [
						'type' => 'object',
						'description' => 'What a block naming it starts with: duration, easing, iteration, direction, fillMode, delay.',
						'additionalProperties' => [ 'type' => 'string' ],
					],
					'steps' => [
						'type' => 'array',
						'minItems' => 1,
						'maxItems' => 20,
						'description' => 'Keyframe steps, e.g. [{"offset":0,"declarations":{"translate":"-100% 0"}},{"offset":45,"declarations":{"translate":"100% 0"}}].',
						'items' => [
							'type' => 'object',
							'properties' => [
								'offset' => [
									'type' => 'number',
									'minimum' => 0,
									'maximum' => 100,
								],
								'offsets' => [
									'type' => 'array',
									'items' => [
										'type' => 'number',
										'minimum' => 0,
										'maximum' => 100,
									],
									'description' => 'Several offsets with the same declarations, as CSS writes `0%, 40%, 100% { … }`. Use instead of `offset`.',
								],
								'declarations' => [
									'type' => 'object',
									'description' => 'Property → value. Allowed properties: ' . implode( ', ', Animations::allowedProperties() ) . '.',
									'additionalProperties' => [ 'type' => 'string' ],
								],
							],
							'required' => [ 'declarations' ],
							'additionalProperties' => false,
						],
					],
				],
				'required' => [ 'slug', 'steps' ],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static function ( array $input ): array {
				$slug = (string) $input['slug'];
				// A step with `offsets` is one step per offset, sharing its declarations.
				$input['steps'] = array_merge(
					...array_map(
						static fn ( $step ): array => is_array( $step ) && is_array( $step['offsets'] ?? null )
							? array_map(
								static fn ( $o ): array => [
									'offset' => $o,
									'declarations' => $step['declarations'] ?? [],
								],
								$step['offsets']
							)
							: [ $step ],
						(array) ( $input['steps'] ?? [] )
					)
				);
				$result = Animations::save( $input, $slug );

				if ( ! $result['ok'] ) {
					return [
						'saved' => false,
						'error' => 'invalid' === ( $result['error'] ?? '' )
							? 'Nothing usable to save: check the slug is not a built-in one and every step has an allowed property with a value.'
							: (string) ( $result['error'] ?? 'not saved' ),
					];
				}

				$saved = Animations::find( $slug );

				return [
					'saved' => true,
					'name' => Keyframes::name( $slug ),
					'steps' => $saved['steps'] ?? [],
				];
			},
			'permission' => 'manage_options',
			'meta' => self::meta( false, false, true ),
		];
	}

	/** @return array<string, mixed> */
	private static function validateLayout(): array {
		return [
			'label' => 'Validate a Blicks layout',
			'description' => 'Check blocks against what this site can render, without changing anything. Returns '
				. 'valid:true, or every problem with where it is, why (`reason`), and what to write instead — '
				. 'including style values the engine would silently drop. Free to call; use it before writing.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'blocks' => self::blocksInput( 'The blocks to check, as update-post-layout takes them.' ),
					'block' => self::BLOCK,
				],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static function ( array $input ): array {
				$blocks = is_array( $input['blocks'] ?? null ) ? $input['blocks'] : [];

				if ( is_array( $input['block'] ?? null ) ) {
					$blocks[] = $input['block'];
				}

				return self::validate( $blocks );
			},
			'permission' => self::READ,
			'meta' => self::meta( true ),
		];
	}

	/**
	 * The body of `validate-layout`, testable without WordPress.
	 *
	 * @param list<mixed> $blocks
	 * @return array{valid: bool, errors?: list<array<string, string>>}
	 */
	public static function validate( array $blocks ): array {
		$errors = Limits::check( $blocks );

		if ( [] === $errors ) {
			foreach ( array_values( $blocks ) as $index => $block ) {
				$errors = array_merge(
					$errors,
					is_array( $block )
						? SpecValidator::validate( BlockSpec::fromArray( $block ), sprintf( 'blocks[%d]', $index ) )
						: [
							[
								'path' => sprintf( 'blocks[%d]', $index ),
								'message' => 'Each block must be an object.',
								'reason' => 'invalid-shape',
							],
						]
				);
			}
		}

		return [] === $errors ? [ 'valid' => true ] : [
			'valid' => false,
			'errors' => $errors,
		];
	}

	/** @return array<string, mixed> */
	private static function listPosts(): array {
		return [
			'label' => 'List posts you can edit',
			'description' => 'Find pages and posts to work on: only ones your account may edit, newest change first, '
				. 'with whether each already uses Blicks blocks. Use the id with get-post-layout.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'postType' => [
						'type' => 'string',
						'maxLength' => 40,
						'description' => 'A post type, e.g. "page" (default) or "post".',
					],
					'search' => [
						'type' => 'string',
						'maxLength' => 200,
					],
					'page' => [
						'type' => 'integer',
						'minimum' => 1,
						'maximum' => 100,
					],
					'perPage' => [
						'type' => 'integer',
						'minimum' => 1,
						'maximum' => Posts::MAX_PER_PAGE,
					],
				],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static fn ( array $input = [] ): array => Posts::list( $input ),
			'permission' => self::READ,
			'meta' => self::meta( true ),
		];
	}

	/** @return array<string, mixed> */
	private static function getPostLayout(): array {
		return [
			'label' => 'Read a post\'s Blicks layout',
			'description' => 'Read one post or page you can edit and return its blocks as a tree, with the style values '
				. 'set on each. Blocks from other plugins come back as { name, markup }; send them back unchanged '
				. 'to keep them — they cannot be edited over MCP. Read before you change a page.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [ 'id' => self::postId( 'The post or page ID.' ) ],
				'required' => [ 'id' ],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static function ( array $input ): array {
				$layout = PostLayout::read( (int) $input['id'] );

				// Unreachable in practice: `edit_post` is false for an id with no post, so a missing
				// post is refused by the permission gate first, and "no such post" stays
				// indistinguishable from "not yours". This covers a post deleted in between.
				return $layout ?? [ 'error' => sprintf( 'Post %d could not be read.', (int) $input['id'] ) ];
			},
			'permission' => self::ON_POST,
			'meta' => self::meta( true ),
		];
	}

	/** @return array<string, mixed> */
	private static function updatePostLayout(): array {
		return [
			'label' => 'Replace a post\'s Blicks layout',
			'description' => 'Replace the whole content of one post or page with the blocks given. Read it with '
				. 'get-post-layout first and send back every block that should stay. You author Blicks blocks; '
				. 'blocks from other plugins can only be kept exactly as they are. Nothing is written if '
				. 'anything is wrong — every problem is returned instead. Set dryRun to check the write, '
				. 'including what WordPress would strip for your account, without saving. The previous content '
				. 'is kept as a revision; the response names it so the change can be undone from the editor.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'id' => self::postId( 'The post or page ID to rewrite.' ),
					'blocks' => self::blocksInput( 'The complete block tree the post should contain, in order.' ),
					'dryRun' => [
						'type' => 'boolean',
						'description' => 'Check everything and report, but do not save.',
					],
				],
				'required' => [ 'id', 'blocks' ],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static fn ( array $input ): array => PostLayout::write(
				(int) $input['id'],
				array_values( (array) $input['blocks'] ),
				true === ( $input['dryRun'] ?? false )
			),
			'permission' => self::ON_POST,
			'meta' => self::meta( false, true, false ),
		];
	}

	/** @return array<string, mixed> */
	private static function createPage(): array {
		return [
			'label' => 'Create a draft page',
			'description' => 'Create a new page (or post) as a draft owned by you, optionally with Blicks blocks, '
				. 'validated exactly as update-post-layout validates them. It is never published by this tool; use '
				. 'set-post-status when the user asks for that.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'title' => [
						'type' => 'string',
						'maxLength' => 200,
					],
					'postType' => [
						'type' => 'string',
						'maxLength' => 40,
						'description' => '"page" (default) or "post".',
					],
					'blocks' => self::blocksInput( 'The blocks the draft starts with.' ),
				],
				'required' => [ 'title' ],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static fn ( array $input ): array => Posts::create(
				(string) $input['title'],
				is_string( $input['postType'] ?? null ) ? $input['postType'] : 'page',
				array_values( (array) ( $input['blocks'] ?? [] ) )
			),
			'permission' => [
				'typeCap' => 'create_posts',
				'typeArg' => 'postType',
			],
			'meta' => self::meta( false, false, false ),
		];
	}

	/** @return array<string, mixed> */
	private static function setPostStatus(): array {
		return [
			'label' => 'Publish or unpublish a post',
			'description' => 'Change one post\'s status: "publish" puts it live, "draft" or "pending" takes it down, '
				. '"private" limits it to editors. Publishing needs your account to be allowed to publish it. '
				. 'Only call this when the user asked for the status change.',
			'category' => self::CATEGORY,
			'input_schema' => [
				'type' => 'object',
				'properties' => [
					'id' => self::postId( 'The post or page ID.' ),
					'status' => [
						'type' => 'string',
						'enum' => Posts::STATUSES,
					],
				],
				'required' => [ 'id', 'status' ],
				'additionalProperties' => false,
			],
			'output_schema' => [ 'type' => 'object' ],
			'execute_callback' => static fn ( array $input ): array => Posts::setStatus( (int) $input['id'], (string) $input['status'] ),
			'permission' => self::ON_POST + [ 'publishArg' => 'status' ],
			'meta' => self::meta( false, true, true ),
		];
	}
}
