<?php
/**
 * Stubs for `Blicks\Studio\EntityRef`: posts and block templates held in globals a test fills.
 *
 * - `$GLOBALS['blicks_test_posts']`      id => object with post_type, post_title, post_content
 * - `$GLOBALS['blicks_test_templates']`  'wp_template' | 'wp_template_part' => list of objects
 *   with id, slug, title, content (and theme)
 * - `$GLOBALS['blicks_test_updates']`    every wp_update_post() call, as given
 */

declare(strict_types=1);

if (!function_exists('get_post')) {
    function get_post(int $id): ?object
    {
        return $GLOBALS['blicks_test_posts'][$id] ?? null;
    }
}

if (!function_exists('wp_slash')) {
    function wp_slash(mixed $value): mixed
    {
        return is_array($value) ? array_map('wp_slash', $value) : (is_string($value) ? addslashes($value) : $value);
    }
}

if (!function_exists('wp_update_post')) {
    function wp_update_post(array $post, bool $wpError = false): int
    {
        $GLOBALS['blicks_test_updates'][] = $post;
        $id = (int) $post['ID'];

        if (isset($GLOBALS['blicks_test_posts'][$id])) {
            $GLOBALS['blicks_test_posts'][$id]->post_content = stripslashes((string) $post['post_content']);
        }

        return $id;
    }
}

if (!function_exists('get_block_template')) {
    function get_block_template(string $id, string $type = 'wp_template'): ?object
    {
        foreach ($GLOBALS['blicks_test_templates'][$type] ?? [] as $template) {
            if ($template->id === $id) {
                return $template;
            }
        }

        return null;
    }
}

if (!function_exists('get_block_templates')) {
    function get_block_templates(array $query = [], string $type = 'wp_template'): array
    {
        return $GLOBALS['blicks_test_templates'][$type] ?? [];
    }
}
