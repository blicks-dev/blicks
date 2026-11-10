<?php
/**
 * Loop block — dynamic render.
 *
 * @package Blicks
 */

declare( strict_types=1 );

/**
 * Loop block — dynamic render.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- LoopRenderer escapes every value it writes; the cards are rendered blocks.
echo \Blicks\Data\LoopRenderer::render( $attributes, $block );
