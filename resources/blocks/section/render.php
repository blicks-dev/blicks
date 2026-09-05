<?php
/**
 * Section block — dynamic render.
 *
 * @package Blicks
 */

declare( strict_types=1 );

/**
 * Section block — dynamic render.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Style\Dimension;
use Blicks\Style\ElementStyle;

$blicks_props = ElementStyle::blockProps(
	$attributes['blicks'] ?? null,
	$attributes['uniqueId'] ?? '',
	'section'
);

$blicks_surface_options = [ 'plain', 'muted', 'card', 'outline' ];
$blicks_space_options   = [ 'none', 'sm', 'md', 'lg' ];

$blicks_surface = in_array( $attributes['surface'] ?? 'plain', $blicks_surface_options, true )
	? ( $attributes['surface'] ?? 'plain' )
	: 'plain';
$blicks_space = in_array( $attributes['sectionSpace'] ?? 'md', $blicks_space_options, true )
	? ( $attributes['sectionSpace'] ?? 'md' )
	: 'md';

$blicks_class = trim(
	$blicks_props['class']
	. ' bl-section--surface-' . $blicks_surface
	. ' bl-section--space-' . $blicks_space
);

$blicks_dimension_vars = [
	'--bl-section-width'             => Dimension::clean( $attributes['sectionWidth'] ?? null, 'auto' ),
	'--bl-section-height'            => Dimension::clean( $attributes['sectionHeight'] ?? null, 'auto' ),
	'--bl-section-content-width'     => Dimension::clean( $attributes['contentWidth'] ?? null, '100%' ),
	'--bl-section-content-min-width' => Dimension::clean( $attributes['contentMinWidth'] ?? null, '0' ),
	'--bl-section-content-max-width' => Dimension::clean( $attributes['contentMaxWidth'] ?? null, 'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))' ),
];

$blicks_style = $blicks_props['style'];
foreach ( $blicks_dimension_vars as $blicks_prop => $blicks_value ) {
	$blicks_style .= ( '' !== $blicks_style ? ';' : '' ) . $blicks_prop . ':' . $blicks_value;
}

$blicks_wrapper_args = [
	'class' => $blicks_class,
	'style' => $blicks_style,
];

// `anchor` support adds the HTML id at save() for static blocks, but not for dynamic ones —
// inject it here so the Advanced ▸ HTML anchor field works on the front end.
$blicks_anchor = trim( (string) ( $attributes['anchor'] ?? '' ) );
if ( '' !== $blicks_anchor ) {
	$blicks_wrapper_args['id'] = $blicks_anchor;
}

$blicks_wrapper_attrs = get_block_wrapper_attributes( $blicks_wrapper_args );
?>
<?php
// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped
// $blicks_wrapper_attrs is built and escaped by get_block_wrapper_attributes(); $content is the
// inner block content already rendered and sanitized by core. Escaping either would corrupt
// valid markup — this is the standard dynamic-block render contract.
?>
<section <?php echo $blicks_wrapper_attrs; ?>><div class="bl-section__inner"><?php echo $content; ?></div></section>
<?php
// phpcs:enable WordPress.Security.EscapeOutput.OutputNotEscaped
