<?php
/**
 * The WordPress functions the Loop data layer calls, faked just enough to test it.
 *
 * Transients live in `$GLOBALS['blicks_test_transients']`; HTTP answers are queued in
 * `$GLOBALS['blicks_test_http']` (one per request, each a response array or a WP_Error) and every
 * request is recorded in `$GLOBALS['blicks_test_http_log']`; scheduled events land in
 * `$GLOBALS['blicks_test_cron']`.
 */

declare(strict_types=1);

if (!class_exists('WP_Error')) {
    class WP_Error
    {
        public function __construct(public string $code = '', public string $message = '', public mixed $data = null) {}

        public function get_error_code(): string { return $this->code; }

        public function get_error_message(): string { return $this->message; }

        public function get_error_data(): mixed { return $this->data; }
    }
}

if (!function_exists('get_transient')) {
    function get_transient(string $key): mixed { return $GLOBALS['blicks_test_transients'][$key] ?? false; }
}
if (!function_exists('set_transient')) {
    function set_transient(string $key, mixed $value, int $ttl = 0): bool
    {
        $GLOBALS['blicks_test_transients'][$key] = $value;
        $GLOBALS['blicks_test_transient_ttl'][$key] = $ttl;

        return true;
    }
}
if (!function_exists('delete_transient')) {
    function delete_transient(string $key): bool
    {
        unset($GLOBALS['blicks_test_transients'][$key]);

        return true;
    }
}
if (!function_exists('wp_safe_remote_get')) {
    function wp_safe_remote_get(string $url, array $args = []): mixed
    {
        $GLOBALS['blicks_test_http_log'][] = ['url' => $url, 'args' => $args];

        return array_shift($GLOBALS['blicks_test_http']) ?? new WP_Error('http_request_failed', 'no stub');
    }
}
if (!function_exists('wp_remote_retrieve_response_code')) {
    function wp_remote_retrieve_response_code(mixed $r): int { return (int) ($r['response']['code'] ?? 0); }
}
if (!function_exists('wp_remote_retrieve_body')) {
    function wp_remote_retrieve_body(mixed $r): string { return (string) ($r['body'] ?? ''); }
}
if (!function_exists('wp_remote_retrieve_header')) {
    function wp_remote_retrieve_header(mixed $r, string $header): array|string
    {
        foreach ($r['headers'] ?? [] as $name => $value) {
            if (strtolower((string) $name) === strtolower($header)) {
                return $value;
            }
        }

        return '';
    }
}
if (!class_exists('WP_Http')) {
    /** Only make_absolute_url(): absolute and root-relative locations, as a redirect gives them. */
    class WP_Http
    {
        public static function make_absolute_url(string $maybe, string $url): string
        {
            if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $maybe) === 1) {
                return $maybe;
            }
            $parts = parse_url($url);

            return $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') . '/' . ltrim($maybe, '/');
        }
    }
}
if (!function_exists('home_url')) {
    function home_url(string $path = ''): string { return 'https://site.test' . $path; }
}
if (!function_exists('wp_check_invalid_utf8')) {
    function wp_check_invalid_utf8(string $text): string { return mb_check_encoding($text, 'UTF-8') ? $text : ''; }
}
if (!function_exists('wp_next_scheduled')) {
    function wp_next_scheduled(string $hook, array $args = []): int|false
    {
        foreach ($GLOBALS['blicks_test_cron'] ?? [] as $event) {
            if ($event['hook'] === $hook && $event['args'] === $args) {
                return $event['time'];
            }
        }

        return false;
    }
}
if (!function_exists('wp_schedule_single_event')) {
    function wp_schedule_single_event(int $time, string $hook, array $args = []): bool
    {
        $GLOBALS['blicks_test_cron'][] = ['time' => $time, 'hook' => $hook, 'args' => $args];

        return true;
    }
}
if (!function_exists('post_type_exists')) {
    function post_type_exists(string $type): bool { return in_array($type, ['post', 'page', 'product', 'secret'], true); }
}
if (!function_exists('is_post_type_viewable')) {
    function is_post_type_viewable(string $type): bool { return 'secret' !== $type; }
}
if (!function_exists('get_taxonomy')) {
    function get_taxonomy(string $name): object|false
    {
        $taxonomies = [
            'category' => (object) ['public' => true, 'object_type' => ['post']],
            'post_tag' => (object) ['public' => true, 'object_type' => ['post']],
            'product_cat' => (object) ['public' => true, 'object_type' => ['product']],
            'internal_flag' => (object) ['public' => false, 'object_type' => ['post']],
        ];

        return $taxonomies[$name] ?? false;
    }
}
if (!function_exists('is_protected_meta')) {
    function is_protected_meta(string $key, string $type = ''): bool { return str_starts_with($key, '_'); }
}
if (!function_exists('get_registered_meta_keys')) {
    function get_registered_meta_keys(string $type, string $subtype = ''): array
    {
        return 'product' === $subtype ? ['price' => ['show_in_rest' => true], 'supplier_note' => ['show_in_rest' => false]] : [];
    }
}
if (!function_exists('get_post_types')) {
    function get_post_types(array $args = []): array
    {
        return ['post' => 'post', 'page' => 'page', 'attachment' => 'attachment', 'product' => 'product'];
    }
}
if (!class_exists('WP_Query')) {
    /** Records each query in `$GLOBALS['blicks_test_queries']`; `found_posts` comes from `$GLOBALS['blicks_test_found']`. */
    class WP_Query
    {
        public int $found_posts;

        /** @var list<mixed> */
        public array $posts = [];

        public int $max_num_pages = 0;

        /** @var array<string, mixed> */
        public array $query_vars = [];

        /** @param array<string, mixed> $args */
        public function __construct(public array $query = [])
        {
            $GLOBALS['blicks_test_queries'][] = $query;
            $this->found_posts = (int) ($GLOBALS['blicks_test_found'] ?? 0);
            $this->query_vars = $query;
        }

        public function get(string $key, mixed $default = ''): mixed { return $this->query_vars[$key] ?? $default; }
    }
}
if (!function_exists('remove_filter')) {
    function remove_filter(string $hook, callable|array $callback, int $priority = 10): bool { return true; }
}

/*
 * Paging: the request's address is `$GLOBALS['blicks_test_url']` (query args included), the
 * archive's page `$GLOBALS['blicks_test_paged']`.
 */
if (!function_exists('add_query_arg')) {
    function add_query_arg(string $key, mixed $value, ?string $url = null): string
    {
        $parts = parse_url($url ?? ($GLOBALS['blicks_test_url'] ?? '/'));
        parse_str($parts['query'] ?? '', $query);
        $query[$key] = (string) $value;

        return ($parts['path'] ?? '/') . '?' . http_build_query($query);
    }
}
if (!function_exists('remove_query_arg')) {
    function remove_query_arg(string $key, ?string $url = null): string
    {
        $parts = parse_url($url ?? ($GLOBALS['blicks_test_url'] ?? '/'));
        parse_str($parts['query'] ?? '', $query);
        unset($query[$key]);

        return ($parts['path'] ?? '/') . ([] === $query ? '' : '?' . http_build_query($query));
    }
}
if (!function_exists('get_pagenum_link')) {
    function get_pagenum_link(int $page = 1, bool $escape = true): string
    {
        return 'https://site.test/archive/' . ($page > 1 ? "page/{$page}/" : '');
    }
}
if (!function_exists('get_query_var')) {
    function get_query_var(string $name, mixed $default = ''): mixed
    {
        return 'paged' === $name ? ($GLOBALS['blicks_test_paged'] ?? 0) : $default;
    }
}
if (!function_exists('wp_unslash')) {
    function wp_unslash(mixed $value): mixed { return is_string($value) ? stripslashes($value) : $value; }
}
if (!function_exists('wp_style_is')) {
    function wp_style_is(string $handle, string $status = 'enqueued'): bool { return 'registered' === $status; }
}
if (!function_exists('wp_script_is')) {
    // Registered: whatever a test put in `blicks_test_scripts`. Nothing is ever enqueued.
    function wp_script_is(string $handle, string $status = 'enqueued'): bool
    {
        return 'registered' === $status && in_array($handle, $GLOBALS['blicks_test_scripts'] ?? [], true);
    }
}
