<?php
/**
 * The PHP style engine that renders block attributes to CSS.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The single PHP style engine — port of resources/framework/css/vars.ts → buildElementStyle().
 *
 * Turns the `blicks` value tree into the class list + inline CSS vars the block root element
 * carries, plus any scoped per-instance CSS (tier-3 / WA mechanisms). Driven by one declarative
 * STYLE_MAP. The map is generated from resources/engine/schema.json ({@see Schema}); the value
 * builders below are hand-written and mirror vars.ts — change both together.
 */
final class ElementStyle {

	private const STATE_KEY = Schema::STATE_KEY;
	private const BP_KEY    = Schema::BP_KEY;

	/** [side-key, var-suffix] */
	private const SIDES   = Schema::SIDES;
	private const CORNERS = Schema::CORNERS;

	/** @var array<string, callable(mixed): string> */
	private static array $cssValueBuilders = [];

	/**
	 * Runtime-registered extra rules, merged after the built-in map. The extension seam for
	 * advanced/scoped capabilities (and the parity-test probe). Mirror of the mutable STYLE_MAP
	 * in vars.ts.
	 *
	 * @var list<array<string, mixed>>
	 */
	private static array $dynamicRules = [];

	/** @param array<string, mixed> $rule */
	public static function registerRule( array $rule ): void {
		self::$dynamicRules[] = $rule;
	}

	public static function clearDynamicRules(): void {
		self::$dynamicRules = [];
	}

	/**
	 * Every built-in rule — generated from resources/engine/schema.json into {@see Schema::RULES}, the
	 * same data the editor's engine reads — then any registered at runtime.
	 *
	 * @return list<array{attr:string,cls:string,kind:string,v:string,category?:string,prop?:string,selectorSuffix?:string,atRule?:array,registerProperty?:array,keyframes?:string}>
	 */
	private static function styleMap(): array {
		return array_merge( Schema::RULES, self::$dynamicRules );
	}

	/**
	 * Every control the engine can emit, as a narrow, stable projection of the rule table.
	 *
	 * Deliberately not `styleMap()` itself. That table is an internal shape — `cls`, `v`,
	 * `emptyValue` and the scoped descriptors are emission details that should stay free to
	 * change. What a caller outside the engine needs to know is only: which control ids exist,
	 * what shape of value each one takes, and which token category resolves its slugs. Committing
	 * to that smaller surface is what lets the table keep evolving.
	 *
	 * Computed on every call rather than cached because {@see self::registerRule()} lets a
	 * companion plugin add controls at runtime; a catalogue built once at boot would silently omit
	 * them.
	 *
	 * `valueShape` collapses `kind` into what a value must look like:
	 *  - `sides`   → `{ top, right, bottom, left }`, or a string meaning "the same on all four"
	 *  - `corners` → `{ topLeft, topRight, bottomRight, bottomLeft }`, or that same string form
	 *  - `scalar`  → a single value (`single` and `enum` rules alike)
	 *
	 * `valueSchema` is the full JSON Schema for one value — see {@see self::valueSchema()}.
	 *
	 * @return list<array{id: string, valueShape: string, category: string|null, scoped: bool, valueSchema: array<string, mixed>|null}>
	 */
	public static function controls(): array {
		$controls = [];

		foreach ( self::styleMap() as $rule ) {
			$kind = $rule['kind'] ?? 'single';

			$shape = 'scalar';
			if ( 'sides' === $kind || 'inset' === $kind ) {
				$shape = 'sides';
			} elseif ( 'corners' === $kind ) {
				$shape = 'corners';
			}

			$controls[] = [
				'id' => (string) ( $rule['attr'] ?? '' ),
				'valueShape' => $shape,
				'category' => isset( $rule['category'] ) ? (string) $rule['category'] : null,
				// A scoped rule emits a real selector or an @property registration instead of a
				// class plus inline var, which is what makes it tier-3.
				'scoped' => isset( $rule['selectorSuffix'] )
					|| isset( $rule['atRule'] )
					|| isset( $rule['keyframes'] )
					|| isset( $rule['registerProperty'] ),
				'valueSchema' => self::valueSchema( (string) ( $rule['attr'] ?? '' ) ),
			];
		}

		return $controls;
	}

	/**
	 * Every value in a style tree the engine would not apply, and why. build() drops these quietly so
	 * one bad value never breaks a page; this is the same judgement made out loud, for layout tools and
	 * agents to report. Pass the block's `supports.blicks.controls` to also catch controls the block
	 * does not allow. Mirror of findStyleProblems() in vars.ts.
	 *
	 * Reasons: `unknown-control`, `not-allowed`, `unknown-slot`, `unknown-breakpoint`, `not-on-part`
	 * (a pseudo-element cannot take that control) and `invalid-value` (it builds to nothing — for a
	 * shadow, one bad layer drops the whole shadow).
	 *
	 * @param list<string>|null $allowList
	 * @return list<array{id: string, reason: string, slot?: string, breakpoint?: string, value?: mixed}>
	 */
	public static function problems( mixed $blicks, ?array $allowList = null ): array {
		$problems = [];
		if ( ! is_array( $blicks ) ) {
			return $problems;
		}
		$rules = [];
		foreach ( self::styleMap() as $rule ) {
			$rules[ $rule['attr'] ] = $rule;
		}
		foreach ( $blicks as $id => $tree ) {
			$id = (string) $id;
			if ( str_starts_with( $id, 'meta.' ) ) {
				continue;
			}
			$rule = $rules[ $id ] ?? null;
			if ( null === $rule ) {
				$problems[] = [
					'id' => $id,
					'reason' => 'unknown-control',
				];
				continue;
			}
			if ( null !== $allowList && ! self::allowsControl( $id, $allowList ) ) {
				$problems[] = [
					'id' => $id,
					'reason' => 'not-allowed',
				];
				continue;
			}
			if ( ! is_array( $tree ) ) {
				continue;
			}
			foreach ( $tree as $slot => $byBp ) {
				$slot = (string) $slot;
				if ( str_contains( $slot, ':' ) ) {
					[ $part, $state ] = explode( ':', $slot, 2 );
				} elseif ( 'default' !== $slot && Parts::isPart( $slot ) ) {
					[ $part, $state ] = [ $slot, 'default' ];
				} else {
					[ $part, $state ] = [ Parts::ELEMENT, $slot ];
				}
				if ( ! Parts::isPart( $part ) || ! array_key_exists( $state, self::STATE_KEY ) ) {
					$problems[] = [
						'id' => $id,
						'slot' => $slot,
						'reason' => 'unknown-slot',
					];
					continue;
				}
				foreach ( is_array( $byBp ) ? $byBp : [] as $bp => $value ) {
					$bp   = (string) $bp;
					$here = [
						'id' => $id,
						'slot' => $slot,
						'breakpoint' => $bp,
					];
					if ( ! array_key_exists( $bp, self::BP_KEY ) ) {
						$problems[] = $here + [
							'reason' => 'unknown-breakpoint',
							'value' => $value,
						];
					} elseif ( Parts::ELEMENT !== $part && ! self::partable( $rule ) ) {
						$problems[] = $here + [
							'reason' => 'not-on-part',
							'value' => $value,
						];
					} elseif ( self::valueRejected( $rule, $value ) ) {
						$problems[] = $here + [
							'reason' => 'invalid-value',
							'value' => $value,
						];
					}
				}
			}
		}
		return $problems;
	}

	/** @param array<string, mixed> $rule */
	private static function partable( array $rule ): bool {
		$cls = (string) ( $rule['cls'] ?? '' );
		return 'enum' !== $rule['kind'] && ( isset( Schema::PART_PROPS[ $cls ] ) || in_array( $cls, Schema::PART_SPECIAL, true ) );
	}

	/**
	 * Would this one value build to nothing? Mirrors the emission paths in build().
	 *
	 * @param array<string, mixed> $rule
	 */
	private static function valueRejected( array $rule, mixed $value ): bool {
		if ( null === $value || '' === $value ) {
			return false;
		}
		if ( 'enum' === $rule['kind'] ) {
			return '' === preg_replace( '/[^a-z0-9-]/', '', (string) ( is_scalar( $value ) ? $value : '' ) );
		}
		if ( 'single' === $rule['kind'] ) {
			return '' === self::cssValueForCategory( $rule['category'] ?? null, $value );
		}
		if ( is_string( $value ) || is_int( $value ) || is_float( $value ) ) {
			return self::sideRejected( $rule, $value );
		}
		if ( ! is_array( $value ) ) {
			return true;
		}
		foreach ( $value as $side ) {
			if ( self::sideRejected( $rule, $side ) ) {
				return true;
			}
		}
		return false;
	}

	/** @param array<string, mixed> $rule */
	private static function sideRejected( array $rule, mixed $v ): bool {
		$s = trim( is_scalar( $v ) ? (string) $v : '' );
		if ( '' === $s ) {
			return ! is_scalar( $v ) && null !== $v;
		}
		$raw = ! empty( $rule['raw'] );
		if ( ! $raw && preg_match( '/^-?\d*\.?\d+$/', $s ) ) {
			return false;
		}
		$category = $raw ? ( $rule['category'] ?? null ) : ( $rule['category'] ?? 'spacing' );
		if ( null !== $category && Tokens::isToken( (string) $category, $s ) ) {
			return false;
		}
		return '' === CssValue::clean( $s );
	}

	/**
	 * The JSON Schema for one value of a control: its shape (object keys, accepted forms, examples),
	 * the token scale its slugs come from (`x-tokens`), and for an enum the names it takes. Values are
	 * stored per state and breakpoint around it — see {@see self::valueTree()}. Null for a control a
	 * companion plugin registered at runtime, which the schema does not describe.
	 *
	 * Mirror of valueSchema() in resources/engine/value-schema.ts; both read Schema::VALUE_SHAPES.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function valueSchema( string $id ): ?array {
		$c = Schema::CONTROL_VALUES[ $id ] ?? null;
		if ( null === $c ) {
			return null;
		}
		$schema = [ 'title' => $id ] + Schema::VALUE_SHAPES[ $c['shape'] ];
		if ( isset( $c['tokens'] ) ) {
			$schema['x-tokens'] = $c['tokens'];
		}
		if ( isset( $c['values'] ) ) {
			$schema['enum'] = $c['values'];
		}
		if ( isset( $c['property'] ) ) {
			$schema['x-property'] = $c['property'];
		}
		if ( isset( $c['note'] ) ) {
			$schema['description'] = ( $schema['description'] ?? '' ) . ' ' . $c['note'];
		}
		return $schema;
	}

	/**
	 * How every control's values are stored: `{ state: { breakpoint: value } }`.
	 *
	 * @return array<string, mixed>
	 */
	public static function valueTree(): array {
		return Schema::VALUE_TREE;
	}

	/**
	 * Does a block's `supports.blicks.controls` allow-list permit this control id?
	 *
	 * The list holds exact ids (`layout.gapRow`) and one-level globs (`spacing.*`). The prefix is
	 * taken at the FIRST dot, so `spacing.*` covers `spacing.padding.top` as much as
	 * `spacing.padding`, and a bare `*` is not a wildcard — nothing opts a block into every
	 * control at once.
	 *
	 * This rule decides what the inspector offers, and it lived only in JavaScript until something
	 * other than the inspector could write the style tree. `build()` emits whatever the tree
	 * contains, so a caller reaching past the allow-list is not refused — its control is simply
	 * ignored, which looks from the outside like a control that does not work. Anything writing
	 * the tree from the server side has to check here first.
	 *
	 * One quirk is copied from the JavaScript deliberately: an id with no dot is its own prefix,
	 * so `spacing` is allowed by `spacing.*`. That falls out of `split( '.' )[ 0 ]` rather than
	 * being intended, and it is unreachable while every control id is `category.name` — but a
	 * server *stricter* than the inspector is its own bug, where the user sets a control in the UI
	 * and is refused on save. `tests/fixtures/control-glob-cases.json` is the table both
	 * implementations run; change it in both places or neither.
	 *
	 * @param list<string> $allowList A block's `supports.blicks.controls`.
	 */
	public static function allowsControl( string $id, array $allowList ): bool {
		if ( in_array( $id, $allowList, true ) ) {
			return true;
		}

		$dot = strpos( $id, '.' );
		$prefix = false === $dot ? $id : substr( $id, 0, $dot );

		// A dotless id yields `.*` as its glob, which no sane allow-list holds; guarding on it
		// keeps an empty id from being granted by a stray `.*` entry.
		if ( '' === $prefix ) {
			return false;
		}

		return in_array( $prefix . '.*', $allowList, true );
	}

	/**
	 * Port of buildElementStyle() — turns the `blicks` attribute value tree into classes + vars,
	 * plus scoped per-instance CSS rules (tier 3) when a rule needs a real selector / `@property`.
	 *
	 * @param mixed  $blicks   The block's `blicks` attribute (decoded JSON object → assoc array)
	 * @param string $uniqueId Block instance id, required to scope tier-3 rules
	 * @return array{classes: list<string>, vars: array<string, string>, scopedCss?: list<string>}
	 */
	public static function build( mixed $blicks, string $uniqueId = '' ): array {
		if ( ! is_array( $blicks ) || empty( $blicks ) ) {
			return [
				'classes' => [],
				'vars' => [],
			];
		}

		/** @var array<string, true> $classSet */
		$classSet = [];
		/** @var array<string, string> $vars */
		$vars = [];
		/** @var list<string> $scopedCss */
		$scopedCss = [];
		$uid = self::scopedId( $uniqueId );
		/** @var array<string, list<string>> $partBuckets `{bpKey}|{selectorSuffix}` → declarations. */
		$partBuckets = [];
		/** @var array<string, true> $styledParts */
		$styledParts = [];
		/** @var array<string, true> $authoredContent */
		$authoredContent = [];
		$parts = [
			'uid'      => $uid,
			'buckets'  => &$partBuckets,
			'styled'   => &$styledParts,
			'authored' => &$authoredContent,
		];

		foreach ( self::styleMap() as $rule ) {
			$tree = $blicks[ $rule['attr'] ] ?? null;
			if ( ! is_array( $tree ) ) {
				continue;
			}
			// Slots a limited state may not style are dropped before either tier — see allowedSlots().
			$tree = Parts::allowedSlots( $rule['attr'], $tree );

			// Part-only controls never reach the element.
			if ( ! empty( $rule['partOnly'] ) ) {
				foreach ( $tree as $slot => $byBp ) {
					foreach ( is_array( $byBp ) ? $byBp : [] as $bp => $value ) {
						self::collectPart( $rule, (string) $slot, (string) $bp, $value, $parts );
					}
				}
				continue;
			}

			// Scoped (tier-3) rules emit a real selector / @property instead of class + var.
			if ( isset( $rule['selectorSuffix'] ) || isset( $rule['atRule'] ) || isset( $rule['keyframes'] ) || isset( $rule['registerProperty'] ) ) {
				self::emitScoped( $rule, $tree, $uid, $scopedCss );
				continue;
			}

			// Enum (library preset): one class `bl-{cls}--{slug}`, no var. Base/default look only.
			if ( 'enum' === $rule['kind'] ) {
				$slug = preg_replace( '/[^a-z0-9-]/', '', (string) self::representativeValue( $tree ) );
				if ( '' !== $slug && null !== $slug ) {
					$classSet[ 'bl-' . $rule['cls'] . '--' . $slug ] = true;
				}
				continue;
			}

			if ( 'single' === $rule['kind'] ) {
				$hasValue = false;
				foreach ( $tree as $slot => $byBp ) {
					if ( ! is_array( $byBp ) ) {
						continue;
					}
					$sk = self::STATE_KEY[ $slot ] ?? '';
					foreach ( $byBp as $bp => $value ) {
						if ( self::collectPart( $rule, (string) $slot, (string) $bp, $value, $parts ) ) {
							continue;
						}
						if ( null === $value || '' === $value || ( is_array( $value ) && empty( $value ) ) ) {
							continue;
						}
						// No var, no class — mirror of vars.ts: a consumer class with nothing behind it
						// applies its fallback and would undo the theme instead of doing nothing.
						$css = self::cssValueForCategory( $rule['category'] ?? null, $value );
						if ( '' === $css ) {
							continue;
						}
						$hasValue = true;
						$key = self::slot( $sk, self::BP_KEY[ $bp ] ?? '' );
						if ( '' !== $key ) {
							$classSet[ 'bl-' . $rule['cls'] . '--' . $key ] = true;
						}
						$suf = '' !== $key ? '-' . $key : '';
						$vars[ $rule['v'] . $suf ] = $css;
					}
				}
				if ( $hasValue ) {
					$classSet[ 'bl-' . $rule['cls'] ] = true;
				}
				continue;
			}

			// Expanded box: sides / inset / corners. The class is present whenever the control has an
			// element slot — NOT when every slot is a part (`.bl-pad` with no `--bl-pt` behind it would
			// drop the host's padding to 0). Mirror of vars.ts.
			foreach ( array_keys( $tree ) as $slot ) {
				if ( Parts::isElementSlot( (string) $slot ) ) {
					$classSet[ 'bl-' . $rule['cls'] ] = true;
					break;
				}
			}
			$keys = 'corners' === $rule['kind'] ? self::CORNERS : self::SIDES;
			$dash = 'inset' === $rule['kind'] ? '-' : '';
			$cat  = $rule['category'] ?? 'spacing';
			$raw   = ! empty( $rule['raw'] );
			$empty = $rule['emptyValue'] ?? '0';
			foreach ( $tree as $slot => $byBp ) {
				if ( ! is_array( $byBp ) ) {
					continue;
				}
				$sk = self::STATE_KEY[ $slot ] ?? '';
				foreach ( $byBp as $bp => $value ) {
					if ( self::collectPart( $rule, (string) $slot, (string) $bp, $value, $parts ) ) {
						continue;
					}
					// A bare string means "the same on every side" — how border.style/border.color
					// were stored before they became per-side. Mirrors expandSideValue() in vars.ts.
					if ( is_string( $value ) && '' !== $value ) {
						$value = array_fill_keys( array_column( $keys, 0 ), $value );
					}
					if ( ! is_array( $value ) || empty( $value ) ) {
						continue;
					}
					$key = self::slot( $sk, self::BP_KEY[ $bp ] ?? '' );
					if ( '' !== $key ) {
						$classSet[ 'bl-' . $rule['cls'] . '--' . $key ] = true;
					}
					$suf = '' !== $key ? '-' . $key : '';
					foreach ( $keys as [$prop, $letter] ) {
						$v = $value[ $prop ] ?? null;
						if ( 'inset' === $rule['kind'] && ( null === $v || '' === $v ) ) {
							// An unset inset side is `auto`, as on a part — see vars.ts.
							$vars[ '--bl-' . $rule['v'] . $dash . $letter . $suf ] = 'auto';
						} elseif ( $raw ) {
							// Keyword/colour sides always emit — an unset side gets the property's
							// own initial value, never the length path's `0`.
							$vars[ '--bl-' . $rule['v'] . $dash . $letter . $suf ] = self::rawOrToken( $rule['category'] ?? null, $v, $empty );
						} else {
							// An unset length side is `0`, exactly as vars.ts writes it: saved markup holds
							// the editor's output, so a server write that differs would open as invalid.
							$vars[ '--bl-' . $rule['v'] . $dash . $letter . $suf ] = self::valOrToken( $cat, $v );
						}
					}
				}
			}
		}

		self::emitPartRules( $partBuckets, $uid, $scopedCss, $styledParts, $authoredContent );

		$result = [
			'classes' => array_keys( $classSet ),
			'vars' => $vars,
		];
		if ( [] !== $scopedCss ) {
			$result['scopedCss'] = $scopedCss;
		}

		return $result;
	}

	public static function registerCssValueBuilder( string $category, callable $builder ): void {
		self::$cssValueBuilders[ $category ] = $builder;
	}

	/**
	 * Categories whose builder output is already validated and must NOT be run through
	 * CssValue::clean() again:
	 *
	 *  - `content` emits a quoted CSS string, which clean() refuses. normalizeContent() strips control
	 *    characters and `<`, escapes quotes and backslashes, and validates any function whole.
	 *  - `image` and `backgroundLayers` emit `url("…")`, and a URL legitimately contains `:` and `/`. imageBuilder()
	 *    validates the URL with CssValue::url() before building the function.
	 */
	private const SELF_VALIDATING_CATEGORIES = [ 'content', 'image', 'backgroundLayers' ];

	public static function cssValueForCategory( ?string $category, mixed $v ): string {
		self::ensureCssValueBuilders();
		if ( null !== $category && isset( self::$cssValueBuilders[ $category ] ) ) {
			$built = (string) call_user_func( self::$cssValueBuilders[ $category ], $v );

			return in_array( $category, self::SELF_VALIDATING_CATEGORIES, true )
				? $built
				: CssValue::clean( $built );
		}

		$s = trim( (string) ( $v ?? '' ) );
		if ( null !== $category && Tokens::isToken( $category, $s ) ) {
			return 'var(--blicks-' . $category . '-' . $s . ')';
		}

		// Uncategorised `single` rules land here, which is most of them. Returning $s raw
		// let a stored attribute close its own declaration and append arbitrary ones to the
		// wrapper's style attribute.
		return CssValue::clean( $s );
	}

	/**
	 * Returns the block root element's `class` and `style` attribute values for use in render.php,
	 * and queues any scoped per-instance CSS for the page footer.
	 *
	 * Usage in render.php:
	 *   $props = ElementStyle::blockProps($attributes['blicks'] ?? null, $attributes['uniqueId'] ?? '', 'container');
	 *   echo '<div class="' . esc_attr($props['class']) . '" style="' . esc_attr($props['style']) . '">';
	 *
	 * @param list<string> $scopedCss Extra already-scoped rules to queue (e.g. from a block's own render).
	 * @return array{class: string, style: string}
	 */
	public static function blockProps( mixed $blicks, string $uniqueId, string $blockName, array $scopedCss = [] ): array {
		$result = self::build( $blicks, $uniqueId );
		ScopedCss::addMany( array_merge( $result['scopedCss'] ?? [], $scopedCss ) );

		$classes = array_unique(
			array_merge(
				[ 'bl-' . $blockName ],
				'' !== $uniqueId ? [ 'bl-' . $uniqueId ] : [],
				$result['classes']
			)
		);

		$styleParts = [];
		foreach ( $result['vars'] as $prop => $val ) {
			$styleParts[] = $prop . ':' . $val;
		}

		return [
			'class' => implode( ' ', $classes ),
			'style' => implode( ';', $styleParts ),
		];
	}

	private static function slot( string $state, string $bp ): string {
		return implode( '-', array_filter( [ $state, $bp ] ) );
	}

	/**
	 * Normalise a length or resolve a token. Port of valOrToken() in vars.ts.
	 *
	 * @param mixed $v
	 */
	/**
	 * Non-length side value (`raw` rules): a keyword (`solid`) or colour passes through, a token
	 * slug resolves against the rule's category, and an unset side falls back to the property's own
	 * initial value — `border-style: 0` would invalidate the whole shorthand. Mirror of
	 * rawOrToken() in vars.ts.
	 */
	private static function rawOrToken( ?string $category, mixed $v, string $empty ): string {
		$s = trim( (string) ( $v ?? '' ) );
		if ( '' === $s ) {
			return $empty;
		}
		if ( null !== $category && Tokens::isToken( $category, $s ) ) {
			return 'var(--blicks-' . $category . '-' . $s . ')';
		}

		// A rejected side falls back to the property's own initial value rather than an empty
		// string: `border-style:` with no value invalidates the whole shorthand, dropping the
		// sides that were fine.
		$clean = CssValue::clean( $s );
		return '' !== $clean ? $clean : $empty;
	}

	private static function valOrToken( string $category, mixed $v ): string {
		$s = trim( (string) ( $v ?? '' ) );
		if ( '' === $s ) {
			return '0';
		}
		// A bare number is a literal length, NEVER a token slug. "0" must stay "0" — the slug list
		// contains "0" but no `--blicks-spacing-0` var is emitted, so token-wrapping it yields an
		// empty value that invalidates the whole padding/margin shorthand (dropping ALL sides).
		if ( preg_match( '/^-?\d*\.?\d+$/', $s ) ) {
			return '0' === $s ? '0' : $s . 'px';
		}
		if ( Tokens::isToken( $category, $s ) ) {
			return 'var(--blicks-' . $category . '-' . $s . ')';
		}

		// `0` for a rejected length, matching the empty-value behaviour above: a side with no
		// value at all would invalidate the shorthand and drop the other three.
		$clean = CssValue::clean( $s );
		return '' !== $clean ? $clean : '0';
	}

	// ── The part axis — mirror of collectPart()/partDeclarations()/emitPartRules() in vars.ts ──

	private const INSET_PROPS          = [ 'top', 'right', 'bottom', 'left' ];
	private const LINE_CLAMP_FIXED     = 'display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;';
	private const CLIP_TEXT_DECLS      = 'background-clip:text;-webkit-background-clip:text;color:transparent';
	private const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: no-preference)';
	private const TIMELINE_SUPPORTS    = '(animation-timeline: scroll())';
	/** The hover guard runtime.scss's `at-state` puts on hover rules — see HOVER_QUERY in vars.ts. */
	private const HOVER_QUERY          = '(hover: hover)';

	/**
	 * Route one slot's value to the part buckets. False means the slot styles the element and the
	 * caller's tier-1/2 path runs; a part slot only ever adds scoped CSS.
	 *
	 * @param array<string,mixed> $rule
	 * @param array<string,mixed> $acc  uid plus references to the buckets / styled / authored sets.
	 */
	private static function collectPart( array $rule, string $slot, string $bp, mixed $value, array &$acc ): bool {
		$part = Parts::parseSlot( $slot )['part'];
		if ( Parts::ELEMENT === $part ) {
			return false;
		}
		// Without an instance id there is no selector; `.bl-::before` would match every block.
		if ( '' === $acc['uid'] ) {
			return true;
		}

		$decls = self::partDeclarations( $rule, $value );
		if ( '' === $decls ) {
			return true;
		}

		$acc['styled'][ $part ] = true;
		if ( ! empty( $rule['partOnly'] ) && 'content' === ( $rule['category'] ?? null ) ) {
			$acc['authored'][ $part ] = true;
		}
		$key = ( self::BP_KEY[ $bp ] ?? '' ) . '|' . Parts::slotSelectorSuffix( $slot );
		$acc['buckets'][ $key ][] = $decls;

		return true;
	}

	/**
	 * The declarations the static consumer class would have applied, written out for a part.
	 *
	 * @param array<string,mixed> $rule
	 */
	private static function partDeclarations( array $rule, mixed $value ): string {
		$cls = $rule['cls'];
		if ( 'enum' === $rule['kind'] || ( ! isset( Schema::PART_PROPS[ $cls ] ) && ! in_array( $cls, Schema::PART_SPECIAL, true ) ) ) {
			return '';
		}
		$part = Schema::PART_PROPS[ $cls ] ?? null;

		if ( 'single' === $rule['kind'] ) {
			if ( null === $value || '' === $value || ( is_array( $value ) && empty( $value ) ) ) {
				return '';
			}
			if ( 'cliptext' === $cls ) {
				return self::CLIP_TEXT_DECLS;
			}
			$css = self::cssValueForCategory( $rule['category'] ?? null, $value );
			if ( '' === $css ) {
				return '';
			}
			if ( 'lc' === $cls ) {
				return self::LINE_CLAMP_FIXED . '-webkit-line-clamp:' . $css;
			}
			if ( null === $part ) {
				return '';
			}

			return ! empty( $part['webkit'] )
				? '-webkit-' . $part['prop'] . ':' . $css . ';' . $part['prop'] . ':' . $css
				: $part['prop'] . ':' . $css;
		}

		$keys = 'corners' === $rule['kind'] ? self::CORNERS : self::SIDES;
		if ( is_string( $value ) && '' !== $value ) {
			$value = array_fill_keys( array_column( $keys, 0 ), $value );
		}
		if ( ! is_array( $value ) || empty( $value ) ) {
			return '';
		}

		$sides = [];
		foreach ( $keys as [$side] ) {
			$v = $value[ $side ] ?? null;
			if ( 'inset' === $rule['kind'] && ( null === $v || '' === $v ) ) {
				// An unset side stays `auto`, what the runtime rule falls back to.
				$sides[] = 'auto';
			} elseif ( ! empty( $rule['raw'] ) ) {
				$sides[] = self::rawOrToken( $rule['category'] ?? null, $v, $rule['emptyValue'] ?? '0' );
			} else {
				$sides[] = self::valOrToken( $rule['category'] ?? 'spacing', $v );
			}
		}

		if ( 'inset' === $rule['kind'] ) {
			$out = [];
			foreach ( self::INSET_PROPS as $i => $prop ) {
				$out[] = $prop . ':' . $sides[ $i ];
			}

			return implode( ';', $out );
		}

		// Longhands for corners, as on the element: a two-value corner is invalid in the shorthand.
		if ( 'corners' === $rule['kind'] && null !== $part ) {
			[ $head, $rest ] = explode( '-', $part['prop'], 2 );
			$out             = [];
			foreach ( [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ] as $i => $corner ) {
				$out[] = $head . '-' . $corner . '-' . $rest . ':' . $sides[ $i ];
			}

			return implode( ';', $out );
		}

		return null !== $part ? $part['prop'] . ':' . implode( ' ', $sides ) : '';
	}

	/**
	 * Turn the collected part declarations into scoped rules, widest breakpoint first, with the
	 * reduced-motion and timeline guards runtime.scss puts round animation on the element.
	 *
	 * @param array<string, list<string>> $buckets
	 * @param list<string>                $scopedCss
	 * @param array<string, true>         $styled
	 * @param array<string, true>         $authored
	 */
	private static function emitPartRules( array $buckets, string $uid, array &$scopedCss, array $styled, array $authored ): void {
		// A pseudo-element with no `content` generates no box: default `content:""` into the base
		// slot of each styled part the user gave none to.
		foreach ( array_keys( $styled ) as $part ) {
			if ( isset( $authored[ $part ] ) ) {
				continue;
			}
			$key             = '|' . Parts::partSuffix( (string) $part );
			$buckets[ $key ] = array_merge( [ 'content:""' ], $buckets[ $key ] ?? [] );
		}

		$guardByProp = [];
		foreach ( Schema::PART_PROPS as $part ) {
			if ( isset( $part['guard'] ) ) {
				$guardByProp[ $part['prop'] ] = $part['guard'];
			}
		}

		foreach ( Schema::BP_ORDER as $bpKey ) {
			foreach ( $buckets as $key => $decls ) {
				[ $bucketBp, $suffix ] = explode( '|', (string) $key, 2 );
				if ( $bucketBp !== $bpKey || [] === $decls ) {
					continue;
				}

				$groups = [
					'plain'    => [],
					'motion'   => [],
					'timeline' => [],
				];
				foreach ( $decls as $decl ) {
					$groups[ $guardByProp[ substr( $decl, 0, (int) strpos( $decl, ':' ) ) ] ?? 'plain' ][] = $decl;
				}

				$selector = Parts::selectorFor( '.bl-' . $uid, $suffix );
				$bpQuery  = implode(
					' and ',
					array_filter(
						[
							str_starts_with( (string) $suffix, ':hover' ) ? self::HOVER_QUERY : '',
							Parts::slotMedia( (string) $suffix ),
							'' !== $bpKey ? '(max-width: ' . Schema::BP_MAX[ $bpKey ] . ')' : '',
						]
					)
				);

				if ( [] !== $groups['plain'] ) {
					$scopedCss[] = self::wrapQuery( $bpQuery, '', $selector . '{' . implode( ';', $groups['plain'] ) . '}' );
				}
				if ( [] !== $groups['motion'] ) {
					$scopedCss[] = self::wrapQuery( $bpQuery, self::REDUCED_MOTION_QUERY, $selector . '{' . implode( ';', $groups['motion'] ) . '}' );
				}
				if ( [] !== $groups['timeline'] ) {
					$scopedCss[] = self::wrapQuery(
						$bpQuery,
						self::REDUCED_MOTION_QUERY,
						'@supports ' . self::TIMELINE_SUPPORTS . '{' . $selector . '{' . implode( ';', $groups['timeline'] ) . '}}'
					);
				}
			}
		}
	}

	/** Wrap a rule in one `@media` — plain CSS cannot nest two, so queries join with `and`. */
	private static function wrapQuery( string $bpQuery, string $extra, string $body ): string {
		$query = implode( ' and ', array_filter( [ $bpQuery, $extra ], static fn ( string $q ): bool => '' !== $q ) );

		return '' !== $query ? '@media ' . $query . '{' . $body . '}' : $body;
	}

	// ── Scoped (tier-3 / WA) emission — mirror of emitScoped() in vars.ts ───────────

	private static function scopedId( string $value ): string {
		return preg_replace( '/[^a-zA-Z0-9_-]/', '', $value ) ?? '';
	}

	/**
	 * Pull a representative scalar (default/base, else first set) from a control's value tree.
	 * Element slots only — mirror of representativeValue() in vars.ts.
	 */
	private static function representativeValue( mixed $tree ): mixed {
		if ( ! is_array( $tree ) ) {
			return null;
		}
		$base = $tree['default']['base'] ?? null;
		if ( null !== $base && '' !== $base ) {
			return $base;
		}
		foreach ( $tree as $slot => $byBp ) {
			if ( ! is_array( $byBp ) || ! Parts::isElementSlot( (string) $slot ) ) {
				continue;
			}
			foreach ( $byBp as $value ) {
				if ( null !== $value && '' !== $value ) {
					return $value;
				}
			}
		}
		return null;
	}

	/** @param array<string,mixed> $rule */
	private static function wrapAtRule( array $rule, string $css ): string {
		$atRule = $rule['atRule'] ?? null;
		if ( ! is_array( $atRule ) || empty( $atRule['query'] ) || empty( $atRule['type'] ) ) {
			return $css;
		}
		return '@' . $atRule['type'] . ' ' . $atRule['query'] . '{' . $css . '}';
	}

	/** @param array<string,mixed> $rule */
	private static function wrapMotionRule( array $rule, string $css ): string {
		return isset( $rule['keyframes'] )
			? '@media (prefers-reduced-motion: no-preference){' . $css . '}'
			: $css;
	}

	/**
	 * @param array<string,mixed> $rule
	 * @param list<string>        $scopedCss
	 */
	private static function emitScoped( array $rule, mixed $tree, string $uniqueId, array &$scopedCss ): void {
		$registerProperty = $rule['registerProperty'] ?? null;
		if ( is_array( $registerProperty ) ) {
			$name = str_starts_with( $rule['v'], '--' ) ? $rule['v'] : '--bl-' . $rule['v'];
			$scopedCss[] = '@property ' . $name
				. '{syntax:"' . ( $registerProperty['syntax'] ?? '*' ) . '";'
				. 'initial-value:' . ( $registerProperty['initialValue'] ?? 'initial' ) . ';'
				. 'inherits:' . ( ! empty( $registerProperty['inherits'] ) ? 'true' : 'false' ) . '}';
		}

		if ( ! isset( $rule['selectorSuffix'] ) && ! isset( $rule['atRule'] ) && ! isset( $rule['keyframes'] ) ) {
			return;
		}
		if ( empty( $rule['prop'] ) && empty( $rule['category'] ) ) {
			return;
		}
		if ( '' === $uniqueId ) {
			return;
		}

		$value = $rule['keyframes'] ?? self::representativeValue( $tree );
		if ( null === $value || '' === $value ) {
			return;
		}

		$selector = '.bl-' . $uniqueId . ( $rule['selectorSuffix'] ?? '' );
		$css      = self::cssValueForCategory( $rule['category'] ?? null, $value );
		$body     = $selector . '{' . ( ! empty( $rule['prop'] ) ? $rule['prop'] . ':' . $css : $css ) . '}';
		$scopedCss[] = self::wrapMotionRule( $rule, self::wrapAtRule( $rule, $body ) );
	}

	private static function ensureCssValueBuilders(): void {
		if ( [] !== self::$cssValueBuilders ) {
			return;
		}

		self::$cssValueBuilders = [
			'image' => [ self::class, 'imageBuilder' ],
			'boxShadow' => [ self::class, 'boxShadowBuilder' ],
			'outline' => [ self::class, 'outlineBuilder' ],
			'textShadow' => [ self::class, 'textShadowBuilder' ],
			'gradient' => [ self::class, 'gradientBuilder' ],
			// Wave D.
			'clipPath'       => [ self::class, 'clipPathBuilder' ],
			'backdropFilter' => [ self::class, 'backdropFilterBuilder' ],
			'mask'           => [ self::class, 'maskBuilder' ],
			'transform'      => [ self::class, 'transformBuilder' ],
			// The part axis: a pseudo-element's `content`, quoted and escaped.
			'content'        => [ self::class, 'normalizeContent' ],
			'backgroundLayers' => [ self::class, 'backgroundLayersBuilder' ],
		];
	}

	private static function imageBuilder( mixed $v ): string {
		$url = is_string( $v ) ? $v : ( is_array( $v ) ? (string) ( $v['url'] ?? '' ) : '' );

		// CssValue::url() accepts only absolute http(s) URLs and site-relative paths, and refuses
		// anything carrying a quote, backslash, paren or whitespace — so the value cannot break
		// out of the url("…") it is about to be wrapped in.
		$clean = CssValue::url( $url );

		return '' !== $clean ? 'url("' . $clean . '")' : '';
	}

	/** A colour that may be a palette token slug (`primary`) or any CSS colour — mirror of vars.ts. */
	private static function colourOrToken( mixed $v ): string {
		$s = trim( is_scalar( $v ) ? (string) $v : '' );
		if ( '' === $s ) {
			return '';
		}

		return Tokens::isToken( 'color', $s ) ? 'var(--blicks-color-' . $s . ')' : CssValue::clean( $s );
	}

	/** One `box-shadow` layer, or '' when any part of it fails validation. */
	private static function shadowLayer( mixed $layer ): string {
		if ( ! is_array( $layer ) ) {
			return '';
		}
		// A token layer: the theme's own shadow, stacked with drawn ones.
		if ( array_key_exists( 'token', $layer ) ) {
			$slug = trim( is_scalar( $layer['token'] ) ? (string) $layer['token'] : '' );

			return Tokens::isToken( 'shadow', $slug ) ? 'var(--blicks-shadow-' . $slug . ')' : '';
		}
		$parts = [];
		foreach ( [ 'x', 'y', 'blur', 'spread' ] as $key ) {
			$parts[] = CssValue::clean( $layer[ $key ] ?? '0px' );
		}
		$colour = self::colourOrToken( $layer['color'] ?? 'rgba(0,0,0,0.1)' );
		if ( in_array( '', $parts, true ) || '' === $colour ) {
			return '';
		}

		return ( ! empty( $layer['inset'] ) ? 'inset ' : '' ) . implode( ' ', $parts ) . ' ' . $colour;
	}

	/**
	 * `box-shadow`: a shadow-token slug, one layer, or a list of layers stacked first-on-top. A layer
	 * that fails validation drops the whole value rather than shifting the stack. Mirror of vars.ts.
	 */
	private static function boxShadowBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			$slug = trim( $v );
			return Tokens::isToken( 'shadow', $slug ) ? "var(--blicks-shadow-{$slug})" : '';
		}
		if ( ! is_array( $v ) || [] === $v ) {
			return '';
		}
		$layers = array_is_list( $v ) ? $v : [ $v ];
		$out    = array_map( [ self::class, 'shadowLayer' ], $layers );

		return in_array( '', $out, true ) ? '' : implode( ', ', $out );
	}

	/** One background layer: a gradient, a picture or a flat tint — mirror of vars.ts. */
	private static function backgroundLayer( mixed $layer ): string {
		if ( ! is_array( $layer ) ) {
			return '';
		}
		$type = $layer['type'] ?? '';
		if ( 'gradient' === $type ) {
			return CssValue::clean( self::gradientBuilder( $layer['value'] ?? '' ) );
		}
		if ( 'tint' === $type ) {
			$colour  = self::colourOrToken( $layer['color'] ?? '' );
			$opacity = is_numeric( $layer['opacity'] ?? 100 ) ? max( 0, min( 100, (float) ( $layer['opacity'] ?? 100 ) ) ) : null;
			if ( '' === $colour || null === $opacity ) {
				return '';
			}
			$c = 'color-mix(in srgb, ' . $colour . ' ' . ( $opacity + 0 ) . '%, transparent)';

			return 'linear-gradient(' . $c . ', ' . $c . ')';
		}
		if ( 'image' === $type ) {
			$url = CssValue::url( (string) ( $layer['url'] ?? '' ) );
			if ( '' === $url ) {
				return '';
			}
			$position = CssValue::clean( $layer['position'] ?? '0% 0%' );
			$size     = CssValue::clean( $layer['size'] ?? 'auto' );
			$repeat   = (string) ( $layer['repeat'] ?? '' );
			$attach   = (string) ( $layer['attachment'] ?? '' );

			return 'url("' . $url . '") '
				. ( '' !== $position ? $position : '0% 0%' ) . ' / '
				. ( '' !== $size ? $size : 'auto' ) . ' '
				. ( 1 === preg_match( '/^(repeat|no-repeat|repeat-x|repeat-y|space|round)$/', $repeat ) ? $repeat : 'no-repeat' )
				. ( 1 === preg_match( '/^(fixed|local)$/', $attach ) ? ' ' . $attach : '' );
		}

		return '';
	}

	/** `background.layers`: layers top first, as the `background` shorthand. Mirror of vars.ts. */
	private static function backgroundLayersBuilder( mixed $v ): string {
		if ( ! is_array( $v ) || ! array_is_list( $v ) ) {
			return '';
		}

		return implode( ', ', array_filter( array_map( [ self::class, 'backgroundLayer' ], $v ), static fn ( string $l ): bool => '' !== $l ) );
	}

	/** One layer `{ x, y, blur, color }`, or a list stacked first-on-top — mirror of vars.ts. */
	private static function textShadowBuilder( mixed $v ): string {
		if ( ! is_array( $v ) || [] === $v ) {
			return '';
		}
		$layers = array_is_list( $v ) ? $v : [ $v ];
		$out = array_map( [ self::class, 'textShadowLayer' ], $layers );

		return in_array( '', $out, true ) ? '' : implode( ', ', $out );
	}

	/**
	 * One text-shadow layer. A side is unset only when it is missing or empty: `"0"` is a real
	 * offset, which `empty()` would have dropped along with the whole shadow.
	 */
	private static function textShadowLayer( mixed $v ): string {
		$set = static fn ( mixed $x ): bool => is_scalar( $x ) && '' !== (string) $x;
		if ( ! is_array( $v ) || ( ! $set( $v['x'] ?? null ) && ! $set( $v['y'] ?? null ) ) ) {
			return '';
		}
		$part = static fn ( string $k, string $fallback ): string => $set( $v[ $k ] ?? null ) ? (string) $v[ $k ] : $fallback;

		return $part( 'x', '0px' ) . ' ' . $part( 'y', '0px' ) . ' ' . $part( 'blur', '0px' ) . ' ' . $part( 'color', 'rgba(0,0,0,0.1)' );
	}

	private static function gradientBuilder( mixed $v ): string {
		// A theme gradient preset is stored as a bare token slug (picked via the gradient token
		// library) — everything else is a custom stops object.
		if ( is_string( $v ) ) {
			$slug = trim( $v );
			if ( '' === $slug ) {
				return '';
			}
			return Tokens::isToken( 'gradient', $slug ) ? 'var(--blicks-gradient-' . $slug . ')' : $slug;
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		$rawType = (string) ( $v['type'] ?? 'linear' );
		$type    = 'radial' === $rawType ? 'radial' : ( 'conic' === $rawType ? 'conic' : 'linear' );
		$rawStops = is_array( $v['stops'] ?? null ) && count( $v['stops'] ) >= 2
			? $v['stops']
			: [
				[
					'color' => $v['from'] ?? '#6366f1',
					'position' => $v['fromPos'] ?? '0%',
				],
				[
					'color' => $v['to'] ?? '#ec4899',
					'position' => $v['toPos'] ?? '100%',
				],
			];
		$n     = count( $rawStops );
		$stops = [];
		foreach ( $rawStops as $i => $stop ) {
			$fallback = round( ( $i / max( $n - 1, 1 ) ) * 100 ) . '%';
			$stops[]  = trim( (string) ( $stop['color'] ?? '#000000' ) )
				. ' ' . trim( (string) ( $stop['position'] ?? $fallback ) );
		}
		$stopsStr = implode( ', ', $stops );

		$positionRaw = $v['position'] ?? null;
		$position    = is_string( $positionRaw ) && '' !== trim( $positionRaw ) ? trim( $positionRaw ) : '';

		if ( 'radial' === $type ) {
			$shape = trim( (string) ( $v['shape'] ?? 'circle' ) );
			if ( '' === $shape ) {
				$shape = 'circle';
			}
			$head = '' !== $position ? $shape . ' at ' . $position : $shape;
			return 'radial-gradient(' . $head . ', ' . $stopsStr . ')';
		}

		if ( 'conic' === $type ) {
			$angle = trim( (string) ( $v['angle'] ?? '0deg' ) );
			$head  = '' !== $position ? 'from ' . $angle . ' at ' . $position : 'from ' . $angle;
			return 'conic-gradient(' . $head . ', ' . $stopsStr . ')';
		}

		return 'linear-gradient(' . trim( (string) ( $v['angle'] ?? '90deg' ) ) . ', ' . $stopsStr . ')';
	}

	// ── Wave D builders — mirror of vars.ts ────────────────────────────────────

	private static function clipPathBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			return trim( $v );
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		$shape  = trim( (string) ( $v['shape'] ?? '' ) );
		$amount = trim( (string) ( $v['amount'] ?? '20%' ) );
		if ( '' === $amount ) {
			$amount = '20%';
		}

		return match ( $shape ) {
			'diagonal'         => 'polygon(0 0, 100% 0, 100% calc(100% - ' . $amount . '), 0 100%)',
			'diagonal-reverse' => 'polygon(0 ' . $amount . ', 100% 0, 100% 100%, 0 100%)',
			'notch'            => 'polygon(0 0, 100% 0, 100% 100%, calc(50% + ' . $amount . ') 100%, 50% calc(100% - ' . $amount . '), calc(50% - ' . $amount . ') 100%, 0 100%)',
			'chevron'          => 'polygon(0 0, 100% 0, calc(100% - ' . $amount . ') 50%, 100% 100%, 0 100%, ' . $amount . ' 50%)',
			'fold'             => 'polygon(0 0, calc(100% - ' . $amount . ') 0, 100% ' . $amount . ', 100% 100%, 0 100%)',
			'circle'           => 'circle(' . $amount . ' at center)',
			'ellipse'          => 'ellipse(' . $amount . ' ' . $amount . ' at center)',
			'inset'            => 'inset(' . $amount . ')',
			'custom'           => trim( (string) ( $v['custom'] ?? '' ) ),
			default            => '',
		};
	}

	/**
	 * `outline`: a raw outline string, or `{ width, style, color }`. Mirror of outlineBuilder() in vars.ts.
	 */
	private static function outlineBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			return trim( $v );
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		$width  = CssValue::clean( $v['width'] ?? '2px' );
		$style  = (string) ( $v['style'] ?? 'solid' );
		$style  = preg_match( '/^(solid|dashed|dotted|double|none)$/', $style ) ? $style : '';
		$colour = self::colourOrToken( $v['color'] ?? 'currentColor' );
		return ( '' !== $width && '' !== $style && '' !== $colour ) ? $width . ' ' . $style . ' ' . $colour : '';
	}

	private static function backdropFilterBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			return trim( $v );
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		$parts = [];
		foreach ( [ 'blur', 'brightness', 'saturate', 'contrast' ] as $fn ) {
			if ( ! empty( $v[ $fn ] ) ) {
				$parts[] = $fn . '(' . trim( (string) $v[ $fn ] ) . ')';
			}
		}
		return implode( ' ', $parts );
	}

	private static function maskBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			return trim( $v );
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		$kind = trim( (string) ( $v['kind'] ?? '' ) );
		$size = trim( (string) ( $v['size'] ?? '20%' ) );
		if ( '' === $size ) {
			$size = '20%';
		}

		if ( 'edge-fade' === $kind ) {
			$side   = trim( (string) ( $v['side'] ?? 'right' ) );
			$toward = match ( $side ) {
				'right' => 'left',
				'left'  => 'right',
				'top'   => 'bottom',
				default => 'top',
			};
			return 'linear-gradient(to ' . $toward . ', transparent, black ' . $size . ')';
		}

		if ( 'edge-fade-both' === $kind ) {
			$axis = trim( (string) ( $v['axis'] ?? 'x' ) );
			return 'y' === $axis
				? 'linear-gradient(to bottom, transparent, black ' . $size . ', black calc(100% - ' . $size . '), transparent)'
				: 'linear-gradient(to right, transparent, black ' . $size . ', black calc(100% - ' . $size . '), transparent)';
		}

		if ( 'radial' === $kind ) {
			$position = trim( (string) ( $v['position'] ?? 'center' ) );
			if ( '' === $position ) {
				$position = 'center';
			}
			return 'radial-gradient(circle at ' . $position . ', black ' . $size . ', transparent)';
		}

		return '';
	}

	private static function transformBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			$s = trim( $v );
			if ( '' === $s ) {
				return '';
			}
			return Tokens::isToken( 'transform', $s ) ? 'var(--blicks-transform-' . $s . ')' : $s;
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		$parts = [];
		if ( ! empty( $v['translateX'] ) || ! empty( $v['translateY'] ) || ! empty( $v['translateZ'] ) ) {
			$parts[] = 'translate3d('
				. trim( (string) ( $v['translateX'] ?? '0' ) ) . ', '
				. trim( (string) ( $v['translateY'] ?? '0' ) ) . ', '
				. trim( (string) ( $v['translateZ'] ?? '0' ) ) . ')';
		}
		foreach ( [ 'rotate', 'rotateX', 'rotateY', 'scale', 'skewX', 'skewY' ] as $fn ) {
			if ( ! empty( $v[ $fn ] ) ) {
				$parts[] = $fn . '(' . trim( (string) $v[ $fn ] ) . ')';
			}
		}
		return implode( ' ', $parts );
	}

	/** Safe CSS `content` value — mirror of normalizeContent() in vars.ts. */
	private static function normalizeContent( mixed $raw ): string {
		// Control characters go first: a newline ends a CSS string early, after which a `}` in
		// the same value closes the rule and the rest parses as a new one.
		$s = (string) preg_replace( '/[\x00-\x1F\x7F]/', '', is_scalar( $raw ) ? (string) $raw : '' );
		$s = trim( str_replace( '<', '', $s ) );
		if ( '' === $s ) {
			return '""';
		}
		if ( preg_match( '/^(none|normal|inherit|initial|unset|revert|open-quote|close-quote|no-open-quote|no-close-quote)$/i', $s ) ) {
			return $s;
		}
		// A function value must validate as a WHOLE. Testing only that it *starts* with `var(`
		// also accepts `var(--a); background-image:url(…)`, which closes the content declaration
		// and appends its own — the same defect the dimension validator was hardened against.
		// Untyped `attr(name)` yields text in `content`, never a URL, so it is accepted in exactly
		// that shape. CssValue refuses `attr()` everywhere else.
		if ( preg_match( '/^attr\(\s*[A-Za-z][A-Za-z0-9_-]*\s*\)$/', $s ) ) {
			return $s;
		}
		if ( preg_match( '/^(counter|counters|attr|var|env)\(/i', $s ) ) {
			return CssValue::clean( $s ) !== '' ? $s : '""';
		}
		$quoted = strlen( $s ) >= 2
			&& ( ( str_starts_with( $s, '"' ) && str_ends_with( $s, '"' ) )
				|| ( str_starts_with( $s, "'" ) && str_ends_with( $s, "'" ) ) );
		$inner = $quoted ? substr( $s, 1, -1 ) : $s;
		$inner = str_replace( '\\', '\\\\', $inner );
		$inner = str_replace( '"', '\\"', $inner );
		return '"' . $inner . '"';
	}
}
