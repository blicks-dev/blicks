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
 * STYLE_MAP, mirroring the JS engine — update both together when the map or serialisers change.
 *
 * Naming stays in sync with resources/runtime/runtime.scss.
 */
final class ElementStyle {

	private const STATE_KEY = [
		'default' => '',
		'hover' => 'hov',
		'focus' => 'foc',
		'active' => 'act',
	];
	private const BP_KEY    = [
		'base' => '',
		'tablet' => 'tab',
		'mobile' => 'mob',
	];

	/** [side-key, var-suffix] */
	private const SIDES   = [ [ 'top', 't' ], [ 'right', 'r' ], [ 'bottom', 'b' ], [ 'left', 'l' ] ];
	private const CORNERS = [ [ 'topLeft', 'tl' ], [ 'topRight', 'tr' ], [ 'bottomRight', 'br' ], [ 'bottomLeft', 'bl' ] ];

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
	 * Single-value properties — `kind: single`. Expanded box-model controls (padding/margin/border
	 * width/radius/inset) are prepended in styleMap(). Mirror of SINGLES in vars.ts.
	 *
	 * @var array<string, array{cls: string, var: string, category?: string}>
	 */
	private const SINGLE_PROPS = [
		'layout.display'            => [
			'cls' => 'd',
			'var' => '--bl-d',
		],
		'layout.flexDirection'      => [
			'cls' => 'fd',
			'var' => '--bl-fd',
		],
		'layout.justifyContent'     => [
			'cls' => 'jc',
			'var' => '--bl-jc',
		],
		'layout.alignItems'         => [
			'cls' => 'ai',
			'var' => '--bl-ai',
		],
		'layout.flexWrap'           => [
			'cls' => 'fw',
			'var' => '--bl-fw',
		],
		'layout.gapRow'             => [
			'cls' => 'gap-r',
			'var' => '--bl-gap-r',
			'category' => 'spacing',
		],
		'layout.gapColumn'          => [
			'cls' => 'gap-c',
			'var' => '--bl-gap-c',
			'category' => 'spacing',
		],
		'layout.gridColumns'        => [
			'cls' => 'cols',
			'var' => '--bl-cols',
		],
		'layout.gridRows'           => [
			'cls' => 'rows',
			'var' => '--bl-rows',
		],
		'layout.justifyItems'       => [
			'cls' => 'ji',
			'var' => '--bl-ji',
		],
		'layout.width'              => [
			'cls' => 'w',
			'var' => '--bl-w',
			'category' => 'width',
		],
		'layout.height'             => [
			'cls' => 'h',
			'var' => '--bl-h',
			'category' => 'width',
		],
		'layout.overflow'           => [
			'cls' => 'ov',
			'var' => '--bl-ov',
		],
		// NB: border.style / border.color are NOT single props — they're `sides` rules (see rules()).
		'position.type'             => [
			'cls' => 'pos',
			'var' => '--bl-pos',
		],
		'position.zIndex'           => [
			'cls' => 'zi',
			'var' => '--bl-zi',
			'category' => 'zIndex',
		],
		'colors.background'         => [
			'cls' => 'bg',
			'var' => '--bl-bg',
			'category' => 'color',
		],
		'colors.text'               => [
			'cls' => 'tx',
			'var' => '--bl-tx',
			'category' => 'color',
		],
		'background.image'          => [
			'cls' => 'bg-img',
			'var' => '--bl-bg-img',
			'category' => 'image',
		],
		'background.gradient'       => [
			'cls' => 'bg-grad',
			'var' => '--bl-bg-grad',
			'category' => 'gradient',
		],
		'background.size'           => [
			'cls' => 'bg-size',
			'var' => '--bl-bg-size',
		],
		'background.position'       => [
			'cls' => 'bg-pos',
			'var' => '--bl-bg-pos',
		],
		'background.repeat'         => [
			'cls' => 'bg-repeat',
			'var' => '--bl-bg-repeat',
		],
		'background.attachment'     => [
			'cls' => 'bg-attach',
			'var' => '--bl-bg-attach',
		],
		// Wave C — color/background extensions.
		'background.blendMode'      => [
			'cls' => 'bg-blend',
			'var' => '--bl-bg-blend',
		],
		'colors.clipText'           => [
			'cls' => 'cliptext',
			'var' => '--bl-cliptext',
		],
		'typography.fontFamily'     => [
			'cls' => 'ff',
			'var' => '--bl-ff',
			'category' => 'fontFamily',
		],
		'typography.fontSize'       => [
			'cls' => 'fs',
			'var' => '--bl-fs',
			'category' => 'fontSize',
		],
		'typography.lineHeight'     => [
			'cls' => 'lh',
			'var' => '--bl-lh',
			'category' => 'leading',
		],
		'typography.fontWeight'     => [
			'cls' => 'fwt',
			'var' => '--bl-fwt',
		],
		'typography.fontStyle'      => [
			'cls' => 'fst',
			'var' => '--bl-fst',
		],
		'typography.letterSpacing'  => [
			'cls' => 'ls',
			'var' => '--bl-ls',
		],
		'typography.wordSpacing'    => [
			'cls' => 'ws',
			'var' => '--bl-ws',
		],
		'typography.textTransform'  => [
			'cls' => 'tt',
			'var' => '--bl-tt',
		],
		'typography.textDecoration' => [
			'cls' => 'td',
			'var' => '--bl-td',
		],
		'typography.textAlign'      => [
			'cls' => 'ta',
			'var' => '--bl-ta',
		],
		// Wave C — typography extensions.
		'typography.writingMode'     => [
			'cls' => 'wm',
			'var' => '--bl-wm',
		],
		'typography.textOrientation' => [
			'cls' => 'to',
			'var' => '--bl-to',
		],
		'effects.opacity'           => [
			'cls' => 'op',
			'var' => '--bl-op',
			'category' => 'opacity',
		],
		'effects.cursor'            => [
			'cls' => 'cur',
			'var' => '--bl-cur',
		],
		'effects.blendMode'         => [
			'cls' => 'bm',
			'var' => '--bl-bm',
		],
		'effects.boxShadow'         => [
			'cls' => 'bsh',
			'var' => '--bl-bsh',
			'category' => 'boxShadow',
		],
		'effects.textShadow'        => [
			'cls' => 'tsh',
			'var' => '--bl-tsh',
			'category' => 'textShadow',
		],
		'effects.transition'        => [
			'cls' => 'tr',
			'var' => '--bl-tr',
			'category' => 'transition',
		],
		'effects.transform'         => [
			'cls' => 'tfm',
			'var' => '--bl-tfm',
			'category' => 'transform',
		],
		'effects.filter'            => [
			'cls' => 'flt',
			'var' => '--bl-flt',
			'category' => 'filter',
		],
		// Wave D — effects extensions.
		'effects.clipPath'          => [
			'cls' => 'clip',
			'var' => '--bl-clip',
			'category' => 'clipPath',
		],
		'effects.backdropFilter'    => [
			'cls' => 'bdf',
			'var' => '--bl-bdf',
			'category' => 'backdropFilter',
		],
		'effects.mask'              => [
			'cls' => 'mask',
			'var' => '--bl-mask',
			'category' => 'mask',
		],
		'effects.transformOrigin'   => [
			'cls' => 'tfo',
			'var' => '--bl-tfo',
		],
		'effects.transformStyle'    => [
			'cls' => 'tfs',
			'var' => '--bl-tfs',
		],
		'effects.perspective'       => [
			'cls' => 'psp',
			'var' => '--bl-psp',
		],
		// Wave E — animation section.
		'animation.name'         => [
			'cls' => 'anim-name',
			'var' => '--bl-anim-name',
		],
		'animation.duration'     => [
			'cls' => 'anim-dur',
			'var' => '--bl-anim-dur',
		],
		'animation.easing'       => [
			'cls' => 'anim-ease',
			'var' => '--bl-anim-ease',
		],
		'animation.iteration'    => [
			'cls' => 'anim-iter',
			'var' => '--bl-anim-iter',
		],
		'animation.direction'    => [
			'cls' => 'anim-dir',
			'var' => '--bl-anim-dir',
		],
		'animation.fillMode'     => [
			'cls' => 'anim-fill',
			'var' => '--bl-anim-fill',
		],
		'animation.delay'        => [
			'cls' => 'anim-delay',
			'var' => '--bl-anim-delay',
		],
		'animation.timeline'     => [
			'cls' => 'anim-tl',
			'var' => '--bl-anim-tl',
		],
		'animation.range'        => [
			'cls' => 'anim-range',
			'var' => '--bl-anim-range',
		],
		'animation.targetAngle'  => [
			'cls' => 'anim-ang',
			'var' => '--bl-ang',
		],
		'animation.target'       => [
			'cls' => 'anim-p',
			'var' => '--bl-p-target',
		],
		// Wave F — counters.
		'decoration.counterReset'     => [
			'cls' => 'cnt-r',
			'var' => '--bl-cnt-r',
		],
		'decoration.counterIncrement' => [
			'cls' => 'cnt-i',
			'var' => '--bl-cnt-i',
		],
		'gridChild.columnSpan'      => [
			'cls' => 'gcs',
			'var' => '--bl-gcs',
		],
		'gridChild.rowSpan'         => [
			'cls' => 'grs',
			'var' => '--bl-grs',
		],
		'gridChild.alignSelf'       => [
			'cls' => 'gas',
			'var' => '--bl-gas',
		],
		'gridChild.justifySelf'     => [
			'cls' => 'gjs',
			'var' => '--bl-gjs',
		],
		'gridChild.order'           => [
			'cls' => 'go',
			'var' => '--bl-go',
		],
		// Wave B — grid-child extensions.
		'gridChild.gridArea'        => [
			'cls' => 'ga',
			'var' => '--bl-ga',
		],
		'gridChild.scrollSnapAlign' => [
			'cls' => 'ssa',
			'var' => '--bl-ssa',
		],
		// Wave B — layout extensions.
		'layout.overflowX'          => [
			'cls' => 'ovx',
			'var' => '--bl-ovx',
		],
		'layout.overflowY'          => [
			'cls' => 'ovy',
			'var' => '--bl-ovy',
		],
		'layout.scrollSnapType'     => [
			'cls' => 'sst',
			'var' => '--bl-sst',
		],
		'layout.gridAreas'          => [
			'cls' => 'areas',
			'var' => '--bl-areas',
		],
		'layout.gridAutoFlow'       => [
			'cls' => 'gaf',
			'var' => '--bl-gaf',
		],
		'layout.containerType'      => [
			'cls' => 'ct',
			'var' => '--bl-ct',
		],
		'layout.containerName'      => [
			'cls' => 'cn',
			'var' => '--bl-cn',
		],
		'layout.aspectRatio'        => [
			'cls' => 'ar',
			'var' => '--bl-ar',
			'category' => 'aspect',
		],
		'layout.objectFit'          => [
			'cls' => 'of',
			'var' => '--bl-of',
		],
		// Wave B — columns section.
		'columns.columnCount'       => [
			'cls' => 'cc',
			'var' => '--bl-cc',
		],
		'columns.columnWidth'       => [
			'cls' => 'cw',
			'var' => '--bl-cw',
			'category' => 'width',
		],
		'columns.columnGap'         => [
			'cls' => 'cgap',
			'var' => '--bl-cgap',
			'category' => 'spacing',
		],
		// Wave G — flex-child (the flexbox parallel to gridChild).
		'flexChild.grow'            => [
			'cls' => 'fg',
			'var' => '--bl-fg',
		],
		'flexChild.shrink'          => [
			'cls' => 'fsk',
			'var' => '--bl-fsk',
		],
		'flexChild.basis'           => [
			'cls' => 'fb',
			'var' => '--bl-fb',
			'category' => 'width',
		],
		'flexChild.alignSelf'       => [
			'cls' => 'fas',
			'var' => '--bl-fas',
		],
		'flexChild.order'           => [
			'cls' => 'fco',
			'var' => '--bl-fco',
		],
		// Wave G — layout completeness (align-content, grid auto tracks, box sizing, box
		// behavior, scroll extras, direction).
		'layout.alignContent'       => [
			'cls' => 'ac',
			'var' => '--bl-ac',
		],
		'layout.gridAutoColumns'    => [
			'cls' => 'gac',
			'var' => '--bl-gac',
		],
		'layout.gridAutoRows'       => [
			'cls' => 'gar',
			'var' => '--bl-gar',
		],
		'layout.minWidth'           => [
			'cls' => 'miw',
			'var' => '--bl-miw',
			'category' => 'width',
		],
		'layout.maxWidth'           => [
			'cls' => 'maw',
			'var' => '--bl-maw',
			'category' => 'width',
		],
		'layout.minHeight'          => [
			'cls' => 'mih',
			'var' => '--bl-mih',
			'category' => 'width',
		],
		'layout.maxHeight'          => [
			'cls' => 'mah',
			'var' => '--bl-mah',
			'category' => 'width',
		],
		'layout.boxSizing'          => [
			'cls' => 'bxz',
			'var' => '--bl-bxz',
		],
		'layout.visibility'         => [
			'cls' => 'vis',
			'var' => '--bl-vis',
		],
		'layout.float'              => [
			'cls' => 'flt2',
			'var' => '--bl-flt2',
		],
		'layout.clear'              => [
			'cls' => 'clr',
			'var' => '--bl-clr',
		],
		'layout.isolation'          => [
			'cls' => 'iso',
			'var' => '--bl-iso',
		],
		'layout.resize'             => [
			'cls' => 'rsz',
			'var' => '--bl-rsz',
		],
		'layout.scrollBehavior'     => [
			'cls' => 'sb',
			'var' => '--bl-sb',
		],
		'layout.overscrollBehavior' => [
			'cls' => 'osb',
			'var' => '--bl-osb',
		],
		'layout.scrollSnapStop'     => [
			'cls' => 'sss',
			'var' => '--bl-sss',
		],
		'layout.direction'          => [
			'cls' => 'dir',
			'var' => '--bl-dir',
		],
		// Wave H — containment/perf + truncation (high real-world usage).
		'layout.contain'              => [
			'cls' => 'ctn',
			'var' => '--bl-ctn',
		],
		'layout.contentVisibility'    => [
			'cls' => 'cv',
			'var' => '--bl-cv',
		],
		'layout.containIntrinsicSize' => [
			'cls' => 'cis',
			'var' => '--bl-cis',
		],
		'layout.lineClamp'            => [
			'cls' => 'lc',
			'var' => '--bl-lc',
		],
	];

	/**
	 * The single source of truth — expanded box-model controls first (exact class-order assertions
	 * depend on it), then the single-value props. Mirror of STYLE_MAP in vars.ts.
	 *
	 * @return list<array{attr:string,cls:string,kind:string,v:string,category?:string,prop?:string,selectorSuffix?:string,atRule?:array,registerProperty?:array,keyframes?:string}>
	 */
	private static function styleMap(): array {
		$rules = [
			[
				'attr' => 'spacing.padding',
				'cls' => 'pad',
				'kind' => 'sides',
				'v' => 'p',
				'category' => 'spacing',
			],
			[
				'attr' => 'spacing.margin',
				'cls' => 'mar',
				'kind' => 'sides',
				'v' => 'm',
				'category' => 'spacing',
			],
			[
				'attr' => 'border.width',
				'cls' => 'bw',
				'kind' => 'sides',
				'v' => 'bw',
				'category' => 'borderWidth',
				'fallbackCategory' => 'spacing',
			],
			// Style/colour are per-side too (4-value shorthands). `raw` keeps the length normaliser
			// away from them: an unset side falls back to the property's initial value, not `0`.
			[
				'attr' => 'border.style',
				'cls' => 'bs',
				'kind' => 'sides',
				'v' => 'bs',
				'raw' => true,
				'emptyValue' => 'none',
			],
			[
				'attr' => 'border.color',
				'cls' => 'bc',
				'kind' => 'sides',
				'v' => 'bc',
				'category' => 'color',
				'raw' => true,
				'emptyValue' => 'currentcolor',
			],
			[
				'attr' => 'border.radius',
				'cls' => 'br',
				'kind' => 'corners',
				'v' => 'br',
				'category' => 'radius',
			],
			[
				'attr' => 'position.inset',
				'cls' => 'inset',
				'kind' => 'inset',
				'v' => 'pos',
				'category' => 'spacing',
			],
			// Library preset: a picked type role → global class `bl-type--{role}` (runtime.scss). No var.
			[
				'attr' => 'typography.role',
				'cls' => 'type',
				'kind' => 'enum',
				'v' => '',
			],
		];

		foreach ( self::SINGLE_PROPS as $attr => $cfg ) {
			$rules[] = [
				'attr'     => $attr,
				'cls'      => $cfg['cls'],
				'kind'     => 'single',
				'v'        => $cfg['var'],
				'category' => $cfg['category'] ?? null,
			];
		}

		// Wave B: columns break-inside emits a child selector rule, not a class+var on the element.
		$rules[] = [
			'attr' => 'columns.breakInside',
			'cls' => 'cbi',
			'kind' => 'single',
			'v' => '--bl-cbi',
			'prop' => 'break-inside',
			'selectorSuffix' => ' > *',
		];

		// Wave F: pseudo-element decoration — builder returns the full body.
		$rules[] = [
			'attr' => 'decoration.before',
			'cls' => 'deco-b',
			'kind' => 'single',
			'v' => '--bl-deco-b',
			'category' => 'decoration',
			'selectorSuffix' => '::before',
		];
		$rules[] = [
			'attr' => 'decoration.after',
			'cls' => 'deco-a',
			'kind' => 'single',
			'v' => '--bl-deco-a',
			'category' => 'decoration',
			'selectorSuffix' => '::after',
		];

		return array_merge( $rules, self::$dynamicRules );
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

		foreach ( self::styleMap() as $rule ) {
			$tree = $blicks[ $rule['attr'] ] ?? null;
			if ( ! is_array( $tree ) ) {
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
				foreach ( $tree as $state => $byBp ) {
					if ( ! is_array( $byBp ) ) {
						continue;
					}
					$sk = self::STATE_KEY[ $state ] ?? '';
					foreach ( $byBp as $bp => $value ) {
						if ( null === $value || '' === $value || ( is_array( $value ) && empty( $value ) ) ) {
							continue;
						}
						$hasValue = true;
						$key = self::slot( $sk, self::BP_KEY[ $bp ] ?? '' );
						if ( '' !== $key ) {
							$classSet[ 'bl-' . $rule['cls'] . '--' . $key ] = true;
						}
						$suf = '' !== $key ? '-' . $key : '';
						$css = self::cssValueForCategory( $rule['category'] ?? null, $value );
						if ( '' !== $css ) {
							$vars[ $rule['v'] . $suf ] = $css;
						}
					}
				}
				if ( $hasValue ) {
					$classSet[ 'bl-' . $rule['cls'] ] = true;
				}
				continue;
			}

			// Expanded box: sides / inset / corners. The class is present whenever the control is.
			$classSet[ 'bl-' . $rule['cls'] ] = true;
			$keys = 'corners' === $rule['kind'] ? self::CORNERS : self::SIDES;
			$dash = 'inset' === $rule['kind'] ? '-' : '';
			$cat  = $rule['category'] ?? 'spacing';
			$fallbackCat = $rule['fallbackCategory'] ?? null;
			$raw   = ! empty( $rule['raw'] );
			$empty = $rule['emptyValue'] ?? '0';
			foreach ( $tree as $state => $byBp ) {
				if ( ! is_array( $byBp ) ) {
					continue;
				}
				$sk = self::STATE_KEY[ $state ] ?? '';
				foreach ( $byBp as $bp => $value ) {
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
						if ( $raw ) {
							// Keyword/colour sides always emit — an unset side gets the property's
							// own initial value, never the length path's `0`.
							$vars[ '--bl-' . $rule['v'] . $dash . $letter . $suf ] = self::rawOrToken( $rule['category'] ?? null, $v, $empty );
						} elseif ( null !== $v && '' !== $v ) {
							$vars[ '--bl-' . $rule['v'] . $dash . $letter . $suf ] = self::valOrToken( $cat, $v, $fallbackCat );
						}
					}
				}
			}
		}

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
	 *  - `decoration` emits a whole `key:val;…` declaration list, so it legitimately contains the
	 *    `:` and `;` that clean() refuses. It validates each of its own values instead.
	 *  - `image` emits `url("…")`, and a URL legitimately contains `:` and `/`. imageBuilder()
	 *    validates the URL with CssValue::url() before building the function.
	 */
	private const SELF_VALIDATING_CATEGORIES = [ 'decoration', 'image' ];

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

		// Uncategorised `single` rules land here, which is most of SINGLE_PROPS. Returning $s raw
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

	private static function valOrToken( string $category, mixed $v, ?string $fallbackCategory = null ): string {
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
		if ( null !== $fallbackCategory && Tokens::isToken( $fallbackCategory, $s ) ) {
			return 'var(--blicks-' . $fallbackCategory . '-' . $s . ')';
		}

		// `0` for a rejected length, matching the empty-value behaviour above: a side with no
		// value at all would invalidate the shorthand and drop the other three.
		$clean = CssValue::clean( $s );
		return '' !== $clean ? $clean : '0';
	}

	// ── Scoped (tier-3 / WA) emission — mirror of emitScoped() in vars.ts ───────────

	private static function scopedId( string $value ): string {
		return preg_replace( '/[^a-zA-Z0-9_-]/', '', $value ) ?? '';
	}

	/** Pull a representative scalar (default/base, else first set) from a control's value tree. */
	private static function representativeValue( mixed $tree ): mixed {
		if ( ! is_array( $tree ) ) {
			return null;
		}
		$base = $tree['default']['base'] ?? null;
		if ( null !== $base && '' !== $base ) {
			return $base;
		}
		foreach ( $tree as $byBp ) {
			if ( ! is_array( $byBp ) ) {
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
		if ( ! empty( $rule['prop'] ) ) {
			$body = $selector . '{' . $rule['prop'] . ':' . self::cssValueForCategory( $rule['category'] ?? null, $value ) . '}';
		} else {
			// Builder-only body: the builder returns the entire `key:val;…` payload (Wave F).
			$inner = self::cssValueForCategory( $rule['category'] ?? null, $value );
			if ( '' === $inner ) {
				return;
			}
			$body = $selector . '{' . $inner . '}';
		}
		$scopedCss[] = self::wrapMotionRule( $rule, self::wrapAtRule( $rule, $body ) );
	}

	private static function ensureCssValueBuilders(): void {
		if ( [] !== self::$cssValueBuilders ) {
			return;
		}

		self::$cssValueBuilders = [
			'image' => [ self::class, 'imageBuilder' ],
			'boxShadow' => [ self::class, 'boxShadowBuilder' ],
			'textShadow' => [ self::class, 'textShadowBuilder' ],
			'gradient' => [ self::class, 'gradientBuilder' ],
			// Wave D.
			'clipPath'       => [ self::class, 'clipPathBuilder' ],
			'backdropFilter' => [ self::class, 'backdropFilterBuilder' ],
			'mask'           => [ self::class, 'maskBuilder' ],
			'transform'      => [ self::class, 'transformBuilder' ],
			// Wave F.
			'decoration'     => [ self::class, 'decorationBuilder' ],
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

	private static function boxShadowBuilder( mixed $v ): string {
		// A bare string is a shadow-token slug (`md`) → resolve to the alias var.
		if ( is_string( $v ) ) {
			$slug = trim( $v );
			return Tokens::isToken( 'shadow', $slug ) ? "var(--blicks-shadow-{$slug})" : '';
		}
		if ( ! is_array( $v ) || ( empty( $v['x'] ) && empty( $v['y'] ) ) ) {
			return '';
		}
		$inset = ! empty( $v['inset'] ) ? 'inset ' : '';
		return $inset
			. ( $v['x'] ?? '0px' ) . ' '
			. ( $v['y'] ?? '0px' ) . ' '
			. ( $v['blur'] ?? '0px' ) . ' '
			. ( $v['spread'] ?? '0px' ) . ' '
			. ( $v['color'] ?? 'rgba(0,0,0,0.1)' );
	}

	private static function textShadowBuilder( mixed $v ): string {
		if ( ! is_array( $v ) || ( empty( $v['x'] ) && empty( $v['y'] ) ) ) {
			return '';
		}
		return ( $v['x'] ?? '0px' ) . ' '
			. ( $v['y'] ?? '0px' ) . ' '
			. ( $v['blur'] ?? '0px' ) . ' '
			. ( $v['color'] ?? 'rgba(0,0,0,0.1)' );
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

	/** Wave F — pseudo-element decoration: full `key:val;…` body, no surrounding braces. */
	/** Safe CSS `content` value — mirror of normalizeContent() in vars.ts. */
	private static function normalizeContent( mixed $raw ): string {
		$s = trim( str_replace( '<', '', (string) ( $raw ?? '' ) ) );
		if ( '' === $s ) {
			return '""';
		}
		if ( preg_match( '/^(none|normal|inherit|initial|unset|revert|open-quote|close-quote|no-open-quote|no-close-quote)$/i', $s ) ) {
			return $s;
		}
		// A function value must validate as a WHOLE. Testing only that it *starts* with `var(`
		// also accepts `var(--a); background-image:url(…)`, which closes the content declaration
		// and appends its own — the same defect the dimension validator was hardened against.
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

	/**
	 * One declaration for the pseudo-element rule, or `''` when the value does not validate.
	 *
	 * Every value here is interpolated into `.bl-{id}::before{ … }`. Before validation a `}` in
	 * any of them closed the rule and let the rest of the string start a new one with an arbitrary
	 * selector, on every page that rendered the block.
	 */
	private static function decoPart( string $prop, mixed $value ): string {
		$clean = CssValue::clean( $value );
		return '' !== $clean ? $prop . ':' . $clean : '';
	}

	private static function decorationBuilder( mixed $v ): string {
		if ( is_string( $v ) ) {
			return trim( $v );
		}
		if ( ! is_array( $v ) ) {
			return '';
		}
		if ( false === ( $v['enabled'] ?? null ) ) {
			return '';
		}

		$parts = [];
		$parts[] = 'content:' . self::normalizeContent( $v['content'] ?? null );

		$position = CssValue::clean( $v['position'] ?? 'absolute' );
		$parts[]  = 'position:' . ( '' !== $position ? $position : 'absolute' );

		if ( ! empty( $v['background'] ) ) {
			$bg = is_array( $v['background'] ) ? self::gradientBuilder( $v['background'] ) : $v['background'];
			$parts[] = self::decoPart( 'background', $bg );
		}
		$parts[] = self::decoPart( 'background-color', $v['bgColor'] ?? null );
		$parts[] = self::decoPart( 'width', $v['width'] ?? null );
		$parts[] = self::decoPart( 'height', $v['height'] ?? null );

		if ( array_key_exists( 'inset', $v ) ) {
			$inset = $v['inset'];
			if ( is_array( $inset ) ) {
				foreach ( [ 'top', 'right', 'bottom', 'left' ] as $side ) {
					$val = CssValue::clean( $inset[ $side ] ?? 'auto' );
					$parts[] = $side . ':' . ( '' !== $val ? $val : 'auto' );
				}
			} else {
				$parts[] = self::decoPart( 'inset', $inset );
			}
		}

		$parts[] = self::decoPart( 'border-radius', $v['borderRadius'] ?? null );
		$parts[] = self::decoPart( 'border', $v['border'] ?? null );
		$parts[] = self::decoPart( 'padding', $v['padding'] ?? null );
		// Text / centering props — let a pseudo-element act as a badge, label, or numbered marker.
		$parts[] = self::decoPart( 'display', $v['display'] ?? null );
		$parts[] = self::decoPart( 'align-items', $v['alignItems'] ?? null );
		$parts[] = self::decoPart( 'justify-content', $v['justifyContent'] ?? null );
		$parts[] = self::decoPart( 'color', $v['color'] ?? null );
		$parts[] = self::decoPart( 'font-size', $v['fontSize'] ?? null );
		$parts[] = self::decoPart( 'font-weight', $v['fontWeight'] ?? null );
		$parts[] = self::decoPart( 'line-height', $v['lineHeight'] ?? null );
		$parts[] = self::decoPart( 'letter-spacing', $v['letterSpacing'] ?? null );
		$parts[] = self::decoPart( 'text-align', $v['textAlign'] ?? null );

		if ( array_key_exists( 'zIndex', $v ) && '' !== $v['zIndex'] && null !== $v['zIndex'] ) {
			$parts[] = self::decoPart( 'z-index', $v['zIndex'] );
		}
		if ( ! empty( $v['blur'] ) ) {
			$blur = CssValue::clean( $v['blur'] );
			if ( '' !== $blur ) {
				$parts[] = 'filter:blur(' . $blur . ')';
			}
		}
		if ( array_key_exists( 'opacity', $v ) && '' !== $v['opacity'] && null !== $v['opacity'] ) {
			$parts[] = self::decoPart( 'opacity', $v['opacity'] );
		}
		$parts[] = self::decoPart( 'mix-blend-mode', $v['mixBlendMode'] ?? null );
		$parts[] = self::decoPart( 'transform', $v['transform'] ?? null );
		$parts[] = self::decoPart( 'pointer-events', $v['pointerEvents'] ?? null );

		// Extended box surface — pass-through props, each validated as a whole value. Mirror of
		// DECO_EXTRA in vars.ts; append only, never reorder, or scoped-CSS parity with the JS
		// engine drifts.
		$extra = [
			'margin' => 'margin',
			'minWidth' => 'min-width',
			'maxWidth' => 'max-width',
			'minHeight' => 'min-height',
			'maxHeight' => 'max-height',
			'outline' => 'outline',
			'boxShadow' => 'box-shadow',
			'flexDirection' => 'flex-direction',
			'flexWrap' => 'flex-wrap',
			'gap' => 'gap',
			'fontFamily' => 'font-family',
			'fontStyle' => 'font-style',
			'textTransform' => 'text-transform',
			'textDecoration' => 'text-decoration',
			'whiteSpace' => 'white-space',
			'wordSpacing' => 'word-spacing',
			'backgroundImage' => 'background-image',
			'backgroundSize' => 'background-size',
			'backgroundPosition' => 'background-position',
			'backgroundRepeat' => 'background-repeat',
			'backdropFilter' => 'backdrop-filter',
			'clipPath' => 'clip-path',
			'filter' => 'filter',
			'transformOrigin' => 'transform-origin',
			'rotate' => 'rotate',
			'scale' => 'scale',
			'transition' => 'transition',
			'animation' => 'animation',
			'aspectRatio' => 'aspect-ratio',
			'overflow' => 'overflow',
			'cursor' => 'cursor',
		];
		foreach ( $extra as $key => $prop ) {
			if ( isset( $v[ $key ] ) && '' !== trim( (string) $v[ $key ] ) ) {
				$parts[] = self::decoPart( $prop, $v[ $key ] );
			}
		}
		if ( ! empty( $v['mask'] ) ) {
			$m = CssValue::clean( $v['mask'] );
			if ( '' !== $m ) {
				$parts[] = '-webkit-mask:' . $m;
				$parts[] = 'mask:' . $m;
			}
		}
		if ( ! empty( $v['backgroundClip'] ) ) {
			$c = CssValue::clean( $v['backgroundClip'] );
			if ( '' !== $c ) {
				$parts[] = '-webkit-background-clip:' . $c;
				$parts[] = 'background-clip:' . $c;
			}
		}

		// decoPart() yields '' for a value that failed validation; drop those rather than
		// emitting a bare `prop:`.
		$parts = array_values( array_filter( $parts, static fn ( string $part ): bool => '' !== $part ) );

		return count( $parts ) > 1 ? implode( ';', $parts ) : '';
	}
}
