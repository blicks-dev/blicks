<?php
/**
 * Form block — dynamic render.
 *
 * @package Blicks
 */

declare( strict_types=1 );

/**
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- FormRenderer escapes every value it writes; $content is rendered inner blocks.
echo \Blicks\Forms\FormRenderer::render( $attributes, $content, $block );
