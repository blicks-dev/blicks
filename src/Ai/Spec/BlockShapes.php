<?php
/**
 * How each block writes itself down.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The element each block saves, as data.
 *
 * **This is a second implementation of something that already exists in JavaScript**, and that is
 * worth being uncomfortable about. Every block's saved markup comes from its `render()` in
 * `resources/blocks/<slug>/index.tsx`, run through `defineBlock`'s save path; what follows is a
 * PHP mirror of the same thing. Two implementations of one output is exactly the duplication the
 * golden-markup discipline exists to catch.
 *
 * It is here because the alternative was worse. An MCP client that can compose a layout but cannot
 * save it is half a feature, and the only other way to save one is to emit markup that approximates
 * what the block would have produced — which shows the author "this block contains unexpected or
 * invalid content" on a page that used to work.
 *
 * **What keeps it honest is `resources/blocks/__golden__/`.** Those twelve fixtures are the real
 * saved output of the real JavaScript. `SpecSerializerGoldenTest` parses each one and serializes it
 * back through this table, byte for byte. Drift between the two implementations is therefore a test
 * failure rather than a corrupted post, which is the only basis on which keeping two is defensible.
 *
 * **What cannot be reproduced is refused, not guessed.** A block absent from this table, or a
 * shape whose `refuse` names a reason — an image with a duotone filter, whose SVG carries floats
 * this side does not promise to print as JavaScript does — stops {@see SpecSerializer} with a
 * message naming the block. A near-miss is a broken post.
 *
 * `image` is checked against `tests/fixtures/serializer-cases.json` as well as the goldens: its
 * golden holds only the default instance, an empty delimiter, so the cases file carries the variants the JavaScript `save()` actually produced.
 *
 * `button` and `icon` inline Lucide path data, which {@see Icons} reads from the artifact the free
 * plugin generates. They are covered while that artifact is readable and refused when it is not —
 * see `needsIcons` below.
 */
final class BlockShapes {

	/** @var array<string, array<string, mixed>>|null */
	private static ?array $companions = null;

	/**
	 * The values an option attribute may hold, block → attribute → allowed (the first is the
	 * fallback `render()` uses for anything else). One table so the shapes below, the validator
	 * and describe-block cannot disagree about what `tag: "a"` means: it means nothing, and the
	 * block quietly becomes a div.
	 */
	public const OPTIONS = [
		'blicks/box' => [
			'kind' => [ 'plain', 'card', 'panel', 'cover', 'badge', 'divider', 'spacer' ],
			'tag' => [ 'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'span' ],
		],
		'blicks/text' => [
			'tag' => [ 'p', 'span', 'div', 'blockquote', 'pre' ],
			'variant' => [ 'default', 'lead' ],
		],
		'blicks/button' => [
			'variant' => [ 'default', 'secondary', 'destructive', 'outline', 'ghost', 'link' ],
			'size' => [ 'default', 'sm', 'lg', 'icon' ],
			'iconPosition' => [ 'leading', 'trailing' ],
			'content' => [ 'label', 'blocks' ],
		],
		'blicks/loop' => [
			'source' => [ 'json', 'endpoint', 'query' ],
			'layout' => [ 'grid', 'bento', 'list' ],
			'gap' => [ 'md', 'sm', 'lg' ],
		],
		'blicks/dialog' => [
			'kind' => [ 'modal', 'drawer', 'sheet', 'full' ],
			'side' => [ 'end', 'start' ],
			'place' => [ 'center', 'top' ],
			'phone' => [ 'keep', 'sheet', 'full' ],
			'backdrop' => [ 'dark', 'light', 'none' ],
			'motion' => [ 'rise', 'scale', 'fade', 'none' ],
			'focus' => [ '', 'close' ],
		],
		'blicks/image' => [
			'objectFit' => [ 'cover', 'contain', 'fill' ],
		],
		// The Form vocabulary is Blicks\Forms\Schema's; restated here as the table describe-block
		// and the validator read, and pinned to it by a test.
		'blicks/form' => [
			'look' => [ 'filled', 'outlined', 'line' ],
			'labels' => [ 'above', 'inside', 'hidden' ],
			'marker' => [ 'optional', 'required', 'both', 'none' ],
		],
		'blicks/field' => [
			'type' => [ 'text', 'textarea', 'email', 'tel', 'number', 'date', 'time', 'range', 'select', 'choice', 'consent', 'hidden' ],
			'appearance' => [ '', 'chips', 'cards', 'segmented', 'switch', 'stepper' ],
			'width' => [ 'full', 'two', 'half', 'third' ],
		],
	];

	/** Attributes holding an icon name, which must be a real one. */
	public const ICON_ATTRIBUTES = [
		'blicks/icon' => [ 'icon' ],
		'blicks/button' => [ 'icon' ],
	];

	/**
	 * Every block this side can reproduce exactly, keyed by block name.
	 *
	 * Each entry may carry:
	 *
	 * - `tag`      — the element, a string or a callable taking the attributes.
	 * - `dynamic`  — the block saves only its children (no wrapper element at all).
	 * - `void`     — the element is self-closing and holds nothing; a bool or a callable.
	 * - `classes`  — extra classes, appended *after* the shared ones, as `render()` does.
	 * - `vars`     — attr-derived custom properties.
	 * - `varsWin`  — true when the block's own vars are spread after the style tree's rather
	 *                than before, which is the difference between an attribute being a default
	 *                and being an override. Both orders occur in the blocks as written.
	 * - `content`  — the attribute holding rich text, written inside the element as stored.
	 * - `html`     — builds the element's inside itself, for a block whose children are neither
	 *                inner blocks nor a single rich-text field. Returning null falls through to
	 *                `content` or the inner blocks.
	 * - `prepend`  — markup written inside the element ahead of its children.
	 * - `inner`    — an element the children are written in, inside the block's own: a callable
	 *                taking the attributes and returning `[ 'tag' => 'ul', 'class' => '…' ]`, or
	 *                null for none. For a block whose save wraps its inner blocks, as a
	 *                navigation's `<nav><ul>…</ul></nav>` does.
	 * - `needsIcons` — the shape only works while {@see Icons} has path data to read.
	 * - `attrs`    — extra HTML attributes.
	 * - `empty`    — the block saves nothing for these attributes, so it is a bare delimiter.
	 * - `refuse`   — names what about these attributes cannot be reproduced, or null.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function all(): array {
		return [
			'blicks/section' => [
				// Dynamic: its save() is `<InnerBlocks.Content />` and the wrapper is rendered in
				// PHP at display time. Nothing about the section element belongs in stored markup.
				'dynamic' => true,
			],

			// Dynamic too: render.php repeats the card once per item. What is stored is the card
			// (its inner blocks), with `metadata.bindings` on the blocks that show a field.
			'blicks/loop' => [
				'dynamic' => true,
			],

			// Dynamic: kses has no `form`, so render.php writes the `<form>` and its page-side parts
			// (Blicks\Forms\FormRenderer). What is stored is the fields, headings and button inside.
			'blicks/form' => [
				'dynamic' => true,
			],

			// Dynamic: save() is its parts (a label Text, the Input, a help Text) and render.php
			// writes the wrapper around them (Blicks\Forms\FieldRenderer).
			'blicks/field' => [
				'dynamic' => true,
			],

			// Dynamic and childless: save() is null, so the block is a self-closing delimiter and
			// render.php writes the control from its Field's context (FieldRenderer::input()).
			'blicks/input' => [
				'dynamic' => true,
				'empty' => static fn (): bool => true,
			],

			// The leaf kinds save their own element: a divider an `<hr/>`, a spacer an empty
			// `aria-hidden` div, a badge its rich text in a span — or an `<a>` when linked, since a
			// short label has nothing for an overlay to stretch over. Every other kind wraps its
			// inner blocks, with an overlay link ahead of them when it has an href.
			'blicks/box' => [
				'tag' => static function ( array $a ): string {
					switch ( self::boxKind( $a ) ) {
						case 'divider':
							return 'hr';
						case 'spacer':
							return 'div';
						case 'badge':
							return '' !== self::boxHref( $a ) ? 'a' : 'span';
					}

					return self::option( $a['tag'] ?? null, self::OPTIONS['blicks/box']['tag'], 'div' );
				},
				'void' => static fn ( array $a ): bool => 'divider' === self::boxKind( $a ),
				'classes' => static function ( array $a ): array {
					$kind = self::boxKind( $a );

					return array_merge(
						'plain' !== $kind ? [ 'bl-box--' . $kind ] : [],
						self::truthy( $a['layers'] ?? null ) ? [ 'bl-box--layers' ] : [],
						! in_array( $kind, self::BOX_LEAF_KINDS, true ) && '' !== self::boxHref( $a ) ? [ 'bl-box--linked' ] : []
					);
				},
				'attrs' => static function ( array $a ): array {
					$kind = self::boxKind( $a );

					if ( 'spacer' === $kind ) {
						return [ 'aria-hidden' => 'true' ];
					}

					return 'badge' === $kind && '' !== self::boxHref( $a ) ? self::boxLinkAttrs( $a ) : [];
				},
				// Rich text, written as stored — see SpecSerializer::element().
				'html' => static fn ( array $a ): ?string => 'badge' === self::boxKind( $a ) ? (string) ( $a['text'] ?? '' ) : null,
				'prepend' => static function ( array $a ): string {
					if ( in_array( self::boxKind( $a ), self::BOX_LEAF_KINDS, true ) || '' === self::boxHref( $a ) ) {
						return '';
					}

					$html = '<a class="bl-box__link"';

					foreach ( self::boxLinkAttrs( $a ) as $key => $value ) {
						$html .= ' ' . $key . '="' . SpecSerializer::escapeAttribute( $value ) . '"';
					}

					return $html . '></a>';
				},
			],

			'blicks/buttons' => [
				'tag' => 'div',
				'vars' => static fn ( array $a ): array => [
					'--bl-fd' => 'vertical' === self::option( $a['orientation'] ?? null, [ 'horizontal', 'vertical' ], 'horizontal' )
						? 'column'
						: 'row',
					'--bl-gap-r' => self::gap( $a['gap'] ?? null, [ 'xs', 'sm', 'md', 'lg' ], 'sm' ),
					'--bl-gap-c' => self::gap( $a['gap'] ?? null, [ 'xs', 'sm', 'md', 'lg' ], 'sm' ),
					'--bl-jc' => self::option( $a['justify'] ?? null, [ 'flex-start', 'center', 'flex-end', 'space-between' ], 'flex-start' ),
					'--bl-fw' => ! empty( $a['wrap'] ) ? 'wrap' : 'nowrap',
				],
			],

			'blicks/heading' => [
				'tag' => static fn ( array $a ): string => 'h' . self::level( $a['level'] ?? 2 ),
				'content' => 'content',
			],

			'blicks/text' => [
				'tag' => static fn ( array $a ): string => self::option( $a['tag'] ?? null, self::OPTIONS['blicks/text']['tag'], 'p' ),
				'classes' => static function ( array $a ): array {
					$classes = [];

					if ( 'lead' === self::option( $a['variant'] ?? null, self::OPTIONS['blicks/text']['variant'], 'default' ) ) {
						$classes[] = 'bl-text--lead';
					}

					if ( ! empty( $a['dropCap'] ) ) {
						$classes[] = 'bl-text--dropcap';
					}

					return $classes;
				},
				'content' => 'content',
			],

			'blicks/button' => [
				'needsIcons' => true,
				// A button with a link is an anchor. The block decides this from the attribute
				// alone, so the element changes under a caller that only set `url`.
				// Open dialog, Close dialog, Send form and Clear form are always a `<button>`, whatever `url` holds.
				'tag' => static fn ( array $a ): string => 'link' === self::buttonAction( $a ) && '' !== (string) ( $a['url'] ?? '' ) ? 'a' : 'button',
				'classes' => static function ( array $a ): array {
					$size = self::option( $a['size'] ?? null, self::OPTIONS['blicks/button']['size'], 'default' );

					$classes = [
						'bl-button--' . self::option( $a['variant'] ?? null, self::OPTIONS['blicks/button']['variant'], 'default' ),
						// `default` becomes `default-size`, so the size class cannot collide with
						// the variant class of the same name.
						'bl-button--' . ( 'default' === $size ? 'default-size' : $size ),
					];
					$width = self::jsString( $a['width'] ?? null, '' );

					// Fit is the default and writes nothing.
					if ( in_array( $width, [ 'wide', 'full' ], true ) ) {
						$classes[] = 'bl-button--w-' . $width;
					}

					if ( self::buttonBlocks( $a ) ) {
						$classes[] = 'bl-button--blocks';
					}

					return $classes;
				},
				// The label-mode icon size, after the style tree's vars as `{ ...style, var }` puts it.
				'varsWin' => true,
				'vars' => static function ( array $a ): array {
					$size = self::buttonIconSize( $a['iconSize'] ?? null );

					return ! self::buttonBlocks( $a ) && '' !== $size ? [ '--bl-button-icon-size' => $size ] : [];
				},
				'attrs' => static function ( array $a ): array {
					$url = (string) ( $a['url'] ?? '' );
					$action = self::buttonAction( $a );

					if ( 'link' !== $action || '' === $url ) {
						$attrs = [ 'type' => in_array( $action, [ 'submit', 'reset' ], true ) ? $action : 'button' ];

						// The browser's invoker commands. Close names no dialog: the one it sits in
						// is filled in at render (Blicks\Blocks\Dialogs).
						if ( 'dialog' === $action ) {
							$attrs['commandfor'] = 'dialog-' . (string) $a['dialog'];
							$attrs['command'] = 'show-modal';
						} elseif ( 'close' === $action ) {
							$attrs['command'] = 'close';
						}
					} else {
						$attrs = [ 'href' => $url ];

						// Absent rather than empty: React drops an undefined prop, so an empty
						// `linkTarget` produces no attribute at all, not `target=""`.
						if ( '' !== (string) ( $a['linkTarget'] ?? '' ) ) {
							$attrs['target'] = (string) $a['linkTarget'];
						}

						if ( '' !== (string) ( $a['rel'] ?? '' ) ) {
							$attrs['rel'] = (string) $a['rel'];
						}
					}

					// An icon-only button has no words, so it carries its name for screen readers.
					$size = self::option( $a['size'] ?? null, self::OPTIONS['blicks/button']['size'], 'default' );

					// Blocks mode names itself from its inner text, or `label` when set (an icon-only one).
					if ( self::buttonBlocks( $a ) ? self::truthy( $a['label'] ?? null ) : 'icon' === $size && self::truthy( $a['label'] ?? null ) ) {
						$attrs['aria-label'] = (string) $a['label'];
					}

					return $attrs;
				},
				// Blocks mode: null, so the inner blocks are written instead.
				'html' => static function ( array $a ): ?string {
					if ( self::buttonBlocks( $a ) ) {
						return null;
					}

					$icon = (string) ( $a['icon'] ?? '' );
					// The stroke width is hard-coded in the block, not an attribute.
					$svg = '' !== $icon ? Icons::svg( $icon, 2 ) : '';
					$trailing = 'trailing' === ( $a['iconPosition'] ?? '' );
					// An icon-sized button is the icon alone — the label is dropped, not hidden.
					$label = 'icon' === self::option( $a['size'] ?? null, self::OPTIONS['blicks/button']['size'], 'default' )
						? ''
						: '<span class="bl-button__label">' . (string) ( $a['text'] ?? '' ) . '</span>';

					return $trailing ? $label . $svg : $svg . $label;
				},
			],

			'blicks/icon' => [
				'needsIcons' => true,
				// A link when it has a safe URL; otherwise a span.
				'tag' => static fn ( array $a ): string => '' !== self::href( $a['url'] ?? '' ) ? 'a' : 'span',
				'classes' => static function ( array $a ): array {
					$turn = is_numeric( $a['turn'] ?? null ) && in_array( (float) $a['turn'], [ 90.0, 180.0, 270.0 ], true ) ? (int) $a['turn'] : 0;

					return array_values(
						array_filter(
							[
								self::truthy( $a['filled'] ?? null ) ? 'bl-icon--filled' : '',
								self::truthy( $a['flipH'] ?? null ) ? 'bl-icon--flip-h' : '',
								self::truthy( $a['flipV'] ?? null ) ? 'bl-icon--flip-v' : '',
								$turn ? 'bl-icon--turn-' . $turn : '',
							]
						)
					);
				},
				// The style tree first, the size after: the attribute is this block's whole point.
				'varsWin' => true,
				'vars' => static fn ( array $a ): array => [
					'--bl-icon-size' => self::iconSize( $a['size'] ?? null ),
				],
				'attrs' => static function ( array $a ): array {
					$label = trim( self::jsString( $a['label'] ?? null, '' ) );
					$href = self::href( $a['url'] ?? '' );

					// A link is never hidden from screen readers; it carries the label as its name.
					if ( '' !== $href ) {
						$attrs = [ 'href' => $href ];

						if ( self::truthy( $a['linkTarget'] ?? null ) ) {
							$attrs['target'] = (string) $a['linkTarget'];
						}

						if ( self::truthy( $a['rel'] ?? null ) ) {
							$attrs['rel'] = (string) $a['rel'];
						}

						if ( '' !== $label ) {
							$attrs['aria-label'] = $label;
						}

						return $attrs;
					}

					// Labelled or hidden, never both and never neither: an icon with no accessible
					// name that is not hidden is announced as nothing by a screen reader.
					return '' !== $label ? [ 'aria-label' => $label ] : [ 'aria-hidden' => 'true' ];
				},
				'html' => static fn ( array $a ): string => Icons::svg(
					$a['icon'] ?? '',
					self::strokeWidth( $a['strokeWidth'] ?? null )
				),
			],

			'blicks/image' => [
				// Inline (inside a Button): a span with the picture only — see `inline` in index.tsx.
				// `save()` returns null until there is a picture, which stores as `<!-- wp:… /-->`.
				'empty' => static fn ( array $a ): bool => '' === (string) ( $a['url'] ?? '' ),
				'refuse' => static fn ( array $a ): ?string => self::isDuotone( $a['duotone'] ?? null ) ? 'a duotone filter' : null,
				'tag' => static fn ( array $a ): string => true === ( $a['inline'] ?? false ) ? 'span' : 'figure',
				'classes' => static fn ( array $a ): array => true === ( $a['inline'] ?? false ) ? [ 'bl-image--inline' ] : array_merge(
					'auto' !== self::aspectRatio( $a['aspectRatio'] ?? null ) ? [ 'has-aspect-ratio' ] : [],
					self::figureLook( $a )['classes']
				),
				// The figure's own look is spread over the style tree's, and only when it has any.
				'varsWin' => true,
				'vars' => static fn ( array $a ): array => true === ( $a['inline'] ?? false ) ? [] : self::figureLook( $a )['style'],
				'html' => static fn ( array $a ): string => self::imageInner( $a ),
			],

			// A native `<dialog>`, its options as classes in model.ts's order, its close button ahead
			// of the children. Its name from the first heading is written at render, not saved.
			'blicks/dialog' => [
				'tag' => 'dialog',
				'classes' => static function ( array $a ): array {
					$kind = self::option( $a['kind'] ?? null, self::OPTIONS['blicks/dialog']['kind'], 'modal' );
					$phone = self::option( $a['phone'] ?? null, self::OPTIONS['blicks/dialog']['phone'], 'keep' );
					$backdrop = self::option( $a['backdrop'] ?? null, self::OPTIONS['blicks/dialog']['backdrop'], 'dark' );
					$motion = self::option( $a['motion'] ?? null, self::OPTIONS['blicks/dialog']['motion'], 'rise' );
					$modal = false !== ( $a['modal'] ?? true );

					return array_values(
						array_filter(
							[
								'bl-dialog--' . $kind,
								'drawer' === $kind ? 'bl-dialog--from-' . self::option( $a['side'] ?? null, self::OPTIONS['blicks/dialog']['side'], 'end' ) : '',
								'modal' === $kind && 'top' === self::option( $a['place'] ?? null, self::OPTIONS['blicks/dialog']['place'], 'center' ) ? 'bl-dialog--top' : '',
								'modal' === $kind && 'keep' !== $phone ? 'bl-dialog--phone-' . $phone : '',
								$modal ? 'is-modal' : '',
								$modal && 'dark' !== $backdrop ? 'bl-dialog--bd-' . $backdrop : '',
								$modal && self::truthy( $a['blur'] ?? null ) ? 'bl-dialog--blur' : '',
								'rise' !== $motion ? 'bl-dialog--m-' . $motion : '',
							]
						)
					);
				},
				'attrs' => static function ( array $a ): array {
					$attrs = [
						'id' => self::dialogId( $a ),
						'closedby' => false === ( $a['outsideCloses'] ?? true ) ? 'closerequest' : 'any',
					];

					if ( self::truthy( $a['label'] ?? null ) ) {
						$attrs['aria-label'] = (string) $a['label'];
					}

					return $attrs;
				},
				'prepend' => static function ( array $a ): string {
					if ( false === ( $a['closeButton'] ?? true ) ) {
						return '';
					}

					$id = SpecSerializer::escapeAttribute( self::dialogId( $a ) );
					$label = SpecSerializer::escapeAttribute( self::truthy( $a['closeLabel'] ?? 'Close' ) ? (string) ( $a['closeLabel'] ?? 'Close' ) : 'Close' );
					$focus = 'close' === ( $a['focus'] ?? '' ) ? ' autofocus' : '';

					return '<button type="button" class="bl-dialog__close" commandfor="' . $id . '" command="close" aria-label="' . $label . '"' . $focus . '></button>';
				},
			],

			// One link: an optional icon, the label with its description under it, a badge after.
			'blicks/menu-link' => [
				'needsIcons' => true,
				'tag' => 'a',
				'attrs' => static function ( array $a ): array {
					$attrs = [];

					foreach ( [
						'href' => 'url',
						'target' => 'linkTarget',
						'rel' => 'rel',
					] as $html => $key ) {
						$value = 'url' === $key ? trim( (string) ( $a[ $key ] ?? '' ) ) : (string) ( $a[ $key ] ?? '' );

						if ( '' !== $value ) {
							$attrs[ $html ] = $value;
						}
					}

					return $attrs;
				},
				'html' => static function ( array $a ): string {
					$icon = (string) ( $a['icon'] ?? '' );
					$description = (string) ( $a['description'] ?? '' );
					$badge = (string) ( $a['badge'] ?? '' );

					return ( '' !== $icon ? '<span class="bl-menu-link__icon">' . Icons::svg( $icon, 2 ) . '</span>' : '' )
						. '<span class="bl-menu-link__text"><span class="bl-menu-link__label">' . (string) ( $a['label'] ?? '' ) . '</span>'
						. ( '' !== $description ? '<span class="bl-menu-link__desc">' . $description . '</span>' : '' )
						. '</span>'
						. ( '' !== $badge ? '<span class="bl-menu-link__badge">' . self::text( $badge ) . '</span>' : '' );
				},
			],
		];
	}

	/**
	 * The shape for one block, or null when this side cannot reproduce it.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function for( string $name ): ?array {
		return self::all()[ $name ] ?? self::companions()[ $name ] ?? null;
	}

	/**
	 * Shapes a companion plugin adds for its own blocks, through `blicks_spec_shapes`.
	 *
	 * The same keys as {@see self::all()}, keyed by block name, so agents can write a companion's
	 * blocks through MCP. Goldens for those shapes live with the companion, which is what keeps
	 * them honest there as `__golden__/` does here. The plugin's own shapes are restored after
	 * filtering: a companion adds shapes, never replaces how one of ours is written. Read once per
	 * request.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function companions(): array {
		if ( null !== self::$companions ) {
			return self::$companions;
		}

		$own = self::all();

		/**
		 * More block shapes for the spec serializer: block name => shape.
		 *
		 * @param array<string, array<string, mixed>> $shapes The plugin's own shapes.
		 */
		$filtered = apply_filters( 'blicks_spec_shapes', $own );
		$added = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $name => $shape ) {
			if ( is_string( $name ) && str_starts_with( $name, 'blicks/' ) && ! isset( $own[ $name ] ) && is_array( $shape ) ) {
				$added[ $name ] = $shape;
			}
		}

		self::$companions = $added;

		return $added;
	}

	/** Forget the companions' shapes. For tests. */
	public static function reset(): void {
		self::$companions = null;
	}

	/**
	 * Can this side write that block right now?
	 *
	 * "Right now" rather than "in principle": a shape marked `needsIcons` is only usable while the
	 * generated icon artifact is readable. Treating a missing artifact as "unsupported" routes it
	 * through the refusal path that already exists, so the caller is told by name instead of being
	 * handed a button with an empty icon.
	 */
	public static function supports( string $name ): bool {
		$shape = self::for( $name );

		if ( null === $shape ) {
			return false;
		}

		return true !== ( $shape['needsIcons'] ?? false ) || Icons::available();
	}

	/**
	 * Plain text as React writes it between tags: an ampersand that starts no entity, and `<`. Not
	 * `esc_html()`, which also encodes quotes that React leaves alone.
	 */
	private static function text( string $value ): string {
		$value = preg_replace( '/&(?!([a-z0-9]+|#[0-9]+|#x[a-f0-9]+);)/i', '&amp;', $value ) ?? '';

		return str_replace( '<', '&lt;', $value );
	}

	/** Box kinds that hold no inner blocks, as `LEAF_KINDS` in `blocks/box/model.ts`. */
	private const BOX_LEAF_KINDS = [ 'badge', 'divider', 'spacer' ];

	/** `cleanKind()` from `blocks/box/model.ts`. */
	/** A Button whose content is its inner blocks. */
	private static function buttonBlocks( array $a ): bool {
		return 'blocks' === ( $a['content'] ?? null );
	}

	/** `cleanIconSize()` from `blocks/button/content.ts`: a length, a bare number as px, or ''. */
	private static function buttonIconSize( mixed $value ): string {
		$v = trim( is_scalar( $value ) ? (string) $value : '' );

		if ( 1 === preg_match( '/^\d+(\.\d+)?$/', $v ) ) {
			return $v . 'px';
		}

		return 1 === preg_match( '/^\d+(\.\d+)?(px|em|rem)$/', $v ) ? $v : '';
	}

	private static function boxKind( array $a ): string {
		return self::option( $a['kind'] ?? null, self::OPTIONS['blicks/box']['kind'], 'plain' );
	}

	private static function boxHref( array $a ): string {
		return trim( (string) ( $a['href'] ?? '' ) );
	}

	/**
	 * A box's link attributes in the order `render()` spreads them, empty ones left out as React
	 * leaves out `undefined`.
	 *
	 * @return array<string, string>
	 */
	private static function boxLinkAttrs( array $a ): array {
		return array_filter(
			[
				'href' => self::boxHref( $a ),
				'target' => (string) ( $a['linkTarget'] ?? '' ),
				'rel' => (string) ( $a['rel'] ?? '' ),
				'aria-label' => (string) ( $a['linkLabel'] ?? '' ),
			],
			static fn ( string $v ): bool => '' !== $v
		);
	}

	/**
	 * Mirror of the `validOption` helper the blocks share: an unrecognised value is the fallback,
	 * never itself. A block never saves a value its own inspector could not have produced.
	 *
	 * @param list<string> $allowed
	 */
	/** What a Button's click does, as `buttonAction()` in resources/blocks/button/controls.tsx decides it. */
	private static function buttonAction( array $a ): string {
		if ( 'close' === ( $a['action'] ?? '' ) ) {
			return 'close';
		}

		if ( 'submit' === ( $a['action'] ?? '' ) ) {
			return 'submit';
		}

		if ( 'reset' === ( $a['action'] ?? '' ) ) {
			return 'reset';
		}

		return 'dialog' === ( $a['action'] ?? '' ) && '' !== (string) ( $a['dialog'] ?? '' ) ? 'dialog' : 'link';
	}

	/** A dialog's id, as `dialogId()` in resources/blocks/dialog/model.ts writes it. */
	private static function dialogId( array $a ): string {
		$slug = self::slug( (string) ( $a['anchor'] ?? '' ) );
		$slug = '' !== $slug ? $slug : self::slug( (string) ( $a['uniqueId'] ?? '' ) );

		return 'dialog-' . ( '' !== $slug ? $slug : 'dialog' );
	}

	/** `slugify()` in resources/blocks/dialog/model.ts, for the ASCII it is given in practice. */
	private static function slug( string $value ): string {
		$value = function_exists( 'remove_accents' ) ? remove_accents( $value ) : $value;
		$value = trim( (string) preg_replace( '/[^a-z0-9]+/', '-', strtolower( $value ) ), '-' );

		return substr( $value, 0, 48 );
	}

	private static function option( mixed $value, array $allowed, string $fallback ): string {
		$candidate = (string) ( $value ?? '' );

		if ( '' === $candidate ) {
			$candidate = $fallback;
		}

		return in_array( $candidate, $allowed, true ) ? $candidate : $fallback;
	}

	/** A gap slug as the spacing token it refers to. */
	private static function gap( mixed $value, array $allowed, string $fallback ): string {
		return 'var(--blicks-spacing-' . self::option( $value, $allowed, $fallback ) . ')';
	}

	/** Mirror of `cleanStrokeWidth`: clamped to 1–4, and 2 for anything unreadable. */
	private static function strokeWidth( mixed $value ): float {
		if ( ! is_numeric( $value ) ) {
			return 2.0;
		}

		return max( 1.0, min( 4.0, (float) $value ) );
	}

	/** Mirror of `cleanHeadingLevel`. */
	private static function level( mixed $value ): int {
		if ( ! is_numeric( $value ) ) {
			return 2;
		}

		return max( 1, min( 6, (int) round( (float) $value ) ) );
	}

	/** The image sizes a `width` step stands for. Mirror of `WIDTH_PX` in `image/model.ts`. */
	private const IMAGE_WIDTHS = [
		'sm' => '240px',
		'md' => '400px',
		'lg' => '560px',
	];

	/** The shade strengths. Mirror of `DIM_PCT`. */
	private const IMAGE_DIM = [
		'light' => 20,
		'medium' => 40,
		'strong' => 60,
	];

	/** The "Keep in view" focus points. Mirror of `FOCUS_POINTS`. */
	private const IMAGE_FOCUS = [ '20% 20%', '50% 20%', '80% 20%', '20% 50%', '50% 50%', '80% 50%', '20% 80%', '50% 80%', '80% 80%' ];

	/** Mirror of `cleanAspectRatio`. */
	private static function aspectRatio( mixed $value ): string {
		$ratio = trim( self::jsString( $value, 'auto' ) );

		return in_array( $ratio, [ 'auto', '1/1', '4/3', '16/9', '3/4' ], true ) || 1 === preg_match( '#^\d+(\.\d+)?/\d+(\.\d+)?$#', $ratio )
			? $ratio
			: 'auto';
	}

	/** Mirror of `isDuotone`: usable only with both colours as strings. */
	private static function isDuotone( mixed $value ): bool {
		return is_array( $value ) && is_string( $value['shadows'] ?? null ) && is_string( $value['highlights'] ?? null );
	}

	/** Mirror of `cleanSide`. */
	private static function side( mixed $value ): string {
		return in_array( $value, [ 'start', 'center', 'end' ], true ) ? $value : '';
	}

	/**
	 * Mirror of `figureLook()`: the figure's own classes and custom properties.
	 *
	 * @param array<string, mixed> $a
	 * @return array{classes: list<string>, style: array<string, string>}
	 */
	private static function figureLook( array $a ): array {
		$classes = [];
		$style = [];
		$width = self::imageWidth( $a['width'] ?? null );

		if ( '' !== $width ) {
			$style['--bl-img-w'] = $width;
			$classes[] = 'bl-image--w';
			$align = self::side( $a['lineUp'] ?? null );

			if ( '' !== $align && 'center' !== $align ) {
				$classes[] = 'bl-image--' . $align;
			}

			if ( false === ( $a['phoneFull'] ?? true ) ) {
				$classes[] = 'bl-image--keep-phone';
			}
		}

		if ( 'over' === ( $a['capPos'] ?? null ) && self::truthy( $a['caption'] ?? null ) ) {
			$classes[] = 'bl-image--cap-over';
		}

		$capAlign = self::side( $a['capAlign'] ?? null );

		if ( '' !== $capAlign ) {
			$classes[] = 'bl-image--cap-' . $capAlign;
		}

		$dim = self::dim( $a['dim'] ?? null );

		if ( '' !== $dim ) {
			$classes[] = 'bl-image--dim';
			$style['--bl-img-dim'] = self::IMAGE_DIM[ $dim ] . '%';
		}

		$hover = self::hover( $a['hover'] ?? null );

		if ( '' !== $hover ) {
			$classes[] = 'bl-image--hover-' . $hover;
		}

		return [
			'classes' => $classes,
			'style' => $style,
		];
	}

	/** Mirror of `widthCss`. */
	private static function imageWidth( mixed $value ): string {
		$v = trim( self::jsString( $value, '' ) );

		if ( isset( self::IMAGE_WIDTHS[ $v ] ) ) {
			return self::IMAGE_WIDTHS[ $v ];
		}

		return 1 === preg_match( '/^\d*\.?\d+(px|rem|em|%|vw|ch)$/', $v ) ? $v : '';
	}

	private static function dim( mixed $value ): string {
		return in_array( $value, [ 'light', 'medium', 'strong' ], true ) ? $value : '';
	}

	private static function hover( mixed $value ): string {
		return in_array( $value, [ 'zoom', 'lift', 'brighten', 'colour' ], true ) ? $value : '';
	}

	/**
	 * The picture, its link, its frame and its caption — the inside of `<figure>`.
	 *
	 * @param array<string, mixed> $a
	 */
	private static function imageInner( array $a ): string {
		$ratio = self::aspectRatio( $a['aspectRatio'] ?? null );
		$fit = self::option( $a['objectFit'] ?? null, self::OPTIONS['blicks/image']['objectFit'], 'cover' );
		$focus = 'auto' !== $ratio && 'cover' === $fit && in_array( $a['focus'] ?? null, self::IMAGE_FOCUS, true ) ? (string) $a['focus'] : '';

		$style = [];

		if ( 'auto' !== $ratio ) {
			$style[] = 'aspect-ratio:' . $ratio;
		}

		$style[] = 'object-fit:' . $fit;

		if ( '' !== $focus ) {
			$style[] = 'object-position:' . $focus;
		}

		$filter = self::filter( $a['adjust'] ?? null );

		if ( '' !== $filter ) {
			$style[] = 'filter:' . $filter;
		}

		$img = '<img src="' . SpecSerializer::escapeAttribute( (string) $a['url'] ) . '"'
			. ' alt="' . SpecSerializer::escapeAttribute( true === ( $a['decorative'] ?? false ) ? '' : self::jsString( $a['alt'] ?? null, '' ) ) . '"'
			. ' style="' . SpecSerializer::escapeAttribute( implode( ';', $style ) ) . '"'
			. ( true === ( $a['eager'] ?? false ) ? ' loading="eager" fetchpriority="high"' : '' )
			. '/>';

		if ( true === ( $a['inline'] ?? false ) ) {
			return $img;
		}

		$linkTo = $a['linkTo'] ?? null;
		$href = 'media' === $linkTo ? self::href( $a['url'] ?? '' ) : ( 'custom' === $linkTo ? self::href( $a['href'] ?? '' ) : '' );

		if ( '' !== $href ) {
			$newTab = 'custom' === $linkTo && '_blank' === ( $a['linkTarget'] ?? null );
			$img = '<a href="' . SpecSerializer::escapeAttribute( $href ) . '"'
				. ( $newTab ? ' target="_blank" rel="noreferrer noopener"' : '' )
				. '>' . $img . '</a>';
		}

		$hasCaption = self::truthy( $a['caption'] ?? null );
		$caption = $hasCaption ? '<figcaption class="wp-element-caption">' . (string) $a['caption'] . '</figcaption>' : '';
		$over = 'over' === ( $a['capPos'] ?? null );
		$frame = '' !== self::dim( $a['dim'] ?? null ) || ( $over && $hasCaption ) || '' !== self::hover( $a['hover'] ?? null );

		if ( $frame ) {
			return '<span class="bl-image__frame">' . $img . ( $over ? $caption : '' ) . '</span>' . ( $over ? '' : $caption );
		}

		return $img . $caption;
	}

	/** Mirror of `cleanAdjust` + `filterCss` without a duotone: the img's `filter`, or ''. */
	private static function filter( mixed $adjust ): string {
		if ( ! is_array( $adjust ) || [] === $adjust ) {
			return '';
		}

		$b = self::clamp( $adjust, 'b', 50, 150, 100 );
		$c = self::clamp( $adjust, 'c', 50, 150, 100 );
		$s = self::clamp( $adjust, 's', 0, 200, 100 );
		$blur = self::clamp( $adjust, 'blur', 0, 12, 0 );
		$parts = [];

		if ( 100.0 !== $b ) {
			$parts[] = 'brightness(' . self::jsNumber( $b / 100 ) . ')';
		}

		if ( 100.0 !== $c ) {
			$parts[] = 'contrast(' . self::jsNumber( $c / 100 ) . ')';
		}

		if ( 100.0 !== $s ) {
			$parts[] = 'saturate(' . self::jsNumber( $s / 100 ) . ')';
		}

		if ( 0.0 !== $blur ) {
			$parts[] = 'blur(' . self::jsNumber( $blur ) . 'px)';
		}

		return implode( ' ', $parts );
	}

	/**
	 * Mirror of the model's `clamp`, including JavaScript's `Number()`: a missing field is the
	 * default (`Number(undefined)` is NaN), but null and '' are 0 and a boolean is 0 or 1.
	 *
	 * @param array<string, mixed> $source
	 */
	private static function clamp( array $source, string $key, float $lo, float $hi, float $default ): float {
		if ( ! array_key_exists( $key, $source ) ) {
			return $default;
		}

		$value = $source[ $key ];

		if ( null === $value || '' === $value ) {
			$number = 0.0;
		} elseif ( is_bool( $value ) ) {
			$number = $value ? 1.0 : 0.0;
		} elseif ( is_numeric( $value ) ) {
			$number = (float) $value;
		} else {
			return $default;
		}

		return min( $hi, max( $lo, $number ) );
	}

	/**
	 * Mirror of `cleanHref`: control characters and script schemes out, unsafe schemes refused.
	 *
	 * One step stricter than the JavaScript: a link whose scheme is unsafe once character
	 * references are decoded ({@see Links}) is dropped too. The validator refuses those before
	 * anything is written, so this never makes saved markup differ from the editor's; it only
	 * keeps this function safe for any other caller.
	 */
	public static function href( mixed $value ): string {
		$v = preg_replace( '/[\x00-\x1F\x7F]/', '', self::jsString( $value, '' ) ) ?? '';
		$v = trim( preg_replace( '/(?:javascript|vbscript)\s*:/i', '', $v ) ?? '' );

		if ( strlen( $v ) > 500 ) {
			$v = substr( $v, 0, 500 );
		}

		if ( ! Links::isSafe( $v ) ) {
			return '';
		}

		if ( '' === $v || 1 !== preg_match( '/^[a-z][a-z0-9+.-]*:/i', $v, $scheme ) ) {
			return $v;
		}

		return in_array( strtolower( $scheme[0] ), [ 'http:', 'https:', 'mailto:', 'tel:' ], true ) ? $v : '';
	}

	/** Mirror of `cleanIconSize`: narrower than the shared length rule, no viewport units. */
	private static function iconSize( mixed $value ): string {
		$raw = preg_replace( '/\s+/', '', trim( self::jsString( $value, '1.5rem' ) ) ) ?? '';

		if ( 1 === preg_match( '/^-?\d*\.?\d+(px|%|em|rem)$/', $raw ) ) {
			return $raw;
		}

		return 1 === preg_match( '/^-?\d*\.?\d+$/', $raw ) ? $raw . 'px' : '1.5rem';
	}

	/** `String( value || fallback )`, as the blocks write it. */
	private static function jsString( mixed $value, string $fallback ): string {
		if ( ! self::truthy( $value ) ) {
			return $fallback;
		}

		if ( is_bool( $value ) ) {
			return 'true';
		}

		return is_scalar( $value ) ? (string) $value : $fallback;
	}

	/** JavaScript truthiness for a decoded JSON value. */
	private static function truthy( mixed $value ): bool {
		return ! ( null === $value || false === $value || '' === $value || 0 === $value || 0.0 === $value );
	}

	/** A number as JavaScript prints it: `1.2`, `2`, never `2.0`. */
	private static function jsNumber( float $value ): string {
		if ( (float) (int) $value === $value ) {
			return (string) (int) $value;
		}

		// JSON prints the shortest round-tripping form, which is JavaScript's `String( number )`.
		return (string) wp_json_encode( $value );
	}
}
