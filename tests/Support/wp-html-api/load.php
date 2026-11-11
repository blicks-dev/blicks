<?php
/**
 * WordPress core's HTML tag processor, for the unit suite only.
 *
 * The unit suite runs without WordPress, and `Blicks\Data\Markup` is built on
 * `WP_HTML_Tag_Processor`. Stubbing the processor would test the stub, so these are core's own
 * files, copied unchanged from WordPress 7.1.4 (`wp-includes/html-api/` and
 * `wp-includes/class-wp-token-map.php`, GPL-2.0-or-later). They are never shipped: `tests/` is
 * outside the release bundle. Below are the three core functions the processor calls that the
 * suite does not already stub, copied from the same release.
 */
declare(strict_types=1);

if (class_exists('WP_HTML_Tag_Processor')) {
    return;
}

if (!function_exists('wp_kses_uri_attributes')) {
    /** From wp-includes/kses.php, without the filter. */
    function wp_kses_uri_attributes(): array
    {
        return ['action', 'archive', 'background', 'cite', 'classid', 'codebase', 'data', 'formaction', 'href', 'icon', 'longdesc', 'manifest', 'poster', 'profile', 'src', 'usemap', 'xmlns'];
    }
}

if (!function_exists('wp_has_noncharacters')) {
    /** From wp-includes/utf8.php. */
    function wp_has_noncharacters(string $text): bool
    {
        return 1 === preg_match(
            '~
                \xEF(?:\xB7[\x90-\xAF]|\xBF[\xBE\xBF])
                |
                (?:\xF0[\x9F\xAF\xBF]|[\xF1-\xF3][\x8F\x9F\xAF\xBF]|\xF4\x8F)\xBF[\xBE\xBF]
            ~x',
            $text
        );
    }
}

require_once __DIR__ . '/class-wp-token-map.php';
require_once __DIR__ . '/html5-named-character-references.php';
require_once __DIR__ . '/class-wp-html-decoder.php';
require_once __DIR__ . '/class-wp-html-attribute-token.php';
require_once __DIR__ . '/class-wp-html-span.php';
require_once __DIR__ . '/class-wp-html-text-replacement.php';
require_once __DIR__ . '/class-wp-html-tag-processor.php';
