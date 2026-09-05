<?php
/**
 * Wires the runtime style layer.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\ServiceProvider;
use UupCode\Utilities\Attributes\Action;
use UupCode\Utilities\Assets\Asset;
use UupCode\Utilities\Plugin as BasePlugin;
use Blicks\DesignSystem\CssVariables;
use Blicks\DesignSystem\Keyframes;
use Blicks\Style\ElementStyle;
use Blicks\Style\ScopedCss;
use Blicks\Style\Sanitize;

/**
 * Wires the runtime style layer:
 *
 *  - Enqueues the compiled runtime stylesheet (build/runtime.css) on both the
 *    front end and the block editor.
 *  - Collects, during render, each block's engine-emitted scoped CSS (tier-3
 *    pseudo-elements / container queries / @property / keyframes), then attaches the deduped
 *    accumulation to a registered stylesheet handle in the footer. Dynamic blocks also queue
 *    their scoped CSS via ElementStyle::blockProps(); ScopedCss dedupes the overlap.
 */
final class StyleServiceProvider extends ServiceProvider {

	/**
	 * Enqueue the static runtime stylesheet. `enqueue_block_assets` fires on BOTH the front end
	 * and inside the editor canvas iframe, so the consumer classes are available everywhere a
	 * Blicks block renders — with one registration.
	 */
	#[Action( 'enqueue_block_assets' )]
	public function enqueueRuntimeStyles(): void {
		$this->enqueueRuntime();
	}

	/**
	 * Collect a block's scoped CSS during render: the engine's tier-3 rules (pseudo-elements,
	 * container queries, @property, keyframes). Returns the block
	 * content unchanged (registered as a render_block filter). Covers static blocks, whose saved
	 * markup carries classes + vars but not scoped rules.
	 *
	 * @param string               $block_content
	 * @param array<string, mixed> $block
	 */
	#[Action( 'render_block', priority: 10, args: 2 )]
	public function collectScopedCss( string $block_content, array $block ): string {
		$name = $block['blockName'] ?? '';

		if ( ! is_string( $name ) || ! str_starts_with( $name, 'blicks/' ) ) {
			return $block_content;
		}

		$attributes = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
		$uniqueId   = is_string( $attributes['uniqueId'] ?? null ) ? $attributes['uniqueId'] : '';

		// Programmatic content (finalizer / AI createBlock / patterns) often has no uniqueId
		// because that's assigned by an editor edit effect. Scoped tier-3 rules
		// (::before/::after, @container, break-inside, @property) key to `.bl-{uniqueId}`, so
		// without one they would silently vanish. Derive a STABLE id from the block's styling so
		// the scoped rule and an injected wrapper class agree; identical config → identical id,
		// which is correct (same scoped output). Editor-authored blocks keep their real uniqueId.
		$injectId = '';
		$scopeId  = '' !== $uniqueId ? $uniqueId : self::derivedScopeId( $attributes );

		// Engine-emitted scoped rules (selectorSuffix / atRule / @property / keyframes).
		$blicks = $attributes['blicks'] ?? null;
		if ( is_array( $blicks ) ) {
			$built = ElementStyle::build( $blicks, $scopeId );
			if ( ! empty( $built['scopedCss'] ) ) {
				ScopedCss::addMany( $built['scopedCss'] );
				if ( '' === $uniqueId ) {
					$injectId = $scopeId;
				}
			}
		}

		$attrPairs = Sanitize::attributes( $attributes['htmlAttributes'] ?? null );
		if ( '' !== $injectId || [] !== $attrPairs ) {
			$block_content = self::updateWrapperAttributes( $block_content, $injectId, $attrPairs );
		}

		return $block_content;
	}

	/**
	 * Add generated scope classes and custom attributes to the rendered wrapper tag.
	 *
	 * @param array<string,string> $attrPairs
	 */
	private static function updateWrapperAttributes( string $blockContent, string $injectId, array $attrPairs ): string {
		if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $blockContent;
		}

		$processor = new \WP_HTML_Tag_Processor( $blockContent );
		if ( ! $processor->next_tag() ) {
			return $blockContent;
		}

		// The saved wrapper lacks `bl-{scopeId}` (no uniqueId at save time); add it so the
		// scoped selector matches. Front-end only — saved markup is untouched, so no recovery.
		if ( '' !== $injectId ) {
			$processor->add_class( 'bl-' . $injectId );
		}

		// Custom attributes (Advanced ▸ Custom attributes) — authoritative server-side gate.
		// Validated here and injected into the wrapper's opening tag; saved markup never carries
		// them, so this is the one place they're emitted (static + dynamic blocks alike).
		foreach ( $attrPairs as $attrName => $attrValue ) {
			$processor->set_attribute( $attrName, $attrValue );
		}

		return $processor->get_updated_html();
	}

	/**
	 * A stable scope id derived from a block's styling, for content that has no editor-assigned
	 * uniqueId. Prefixed `g` (generated) so it is a valid CSS ident and never collides with an
	 * editor id. Identical styling yields the same id, which is correct — the scoped output is
	 * identical, and ScopedCss dedupes the rule.
	 *
	 * @param array<string, mixed> $attributes
	 */
	private static function derivedScopeId( array $attributes ): string {
		$seed = wp_json_encode( [ 'b' => $attributes['blicks'] ?? null ] );

		return 'g' . substr( md5( (string) $seed ), 0, 8 );
	}

	/**
	 * Register the src-less handle that carries the per-page scoped CSS. Registering early means
	 * the handle exists whether or not any Blicks block ends up on the page; nothing is printed
	 * unless CSS is actually attached to it in the footer.
	 */
	#[Action( 'wp_enqueue_scripts', priority: 5 )]
	public function registerInlineStyleHandle(): void {
		wp_register_style( 'blicks-inline', false, [], BasePlugin::version() );
	}

	/**
	 * Attach the accumulated scoped CSS to the `blicks-inline` handle. This runs in `wp_footer`
	 * because the rules are only known after every block has rendered; core prints styles
	 * enqueued this late via `print_late_styles()`, which `_wp_footer_scripts()` calls from
	 * `wp_print_footer_scripts` (wp_footer, priority 20).
	 */
	#[Action( 'wp_footer', priority: 5 )]
	public function printInlineCss(): void {
		$css = ScopedCss::css();
		if ( '' === $css ) {
			return;
		}

		// `wp_enqueue_scripts` does not fire on every request that can still render blocks
		// (feeds, some REST previews), so make sure the handle exists before enqueuing it.
		if ( ! wp_style_is( 'blicks-inline', 'registered' ) ) {
			wp_register_style( 'blicks-inline', false, [], BasePlugin::version() );
		}

		wp_enqueue_style( 'blicks-inline' );
		wp_add_inline_style( 'blicks-inline', Sanitize::styleTagContent( $css ) );
	}

	private function enqueueRuntime(): void {
		if ( ! file_exists( BasePlugin::path( 'build/runtime.css' ) ) ) {
			return;
		}

		Asset::style( 'blicks-runtime', BasePlugin::url( 'build/runtime.css' ) )
			->version( BasePlugin::version() )
			->addInlineStyle( Sanitize::styleTagContent( CssVariables::css() . "\n" . Keyframes::css() ) )
			->enqueue();
	}
}
