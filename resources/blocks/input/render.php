<?php
/**
 * Input block — dynamic render.
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

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- FieldRenderer escapes every value it writes.
echo \Blicks\Forms\FieldRenderer::input( $attributes, $block );
