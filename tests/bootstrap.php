<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__DIR__) . '/');
}

require_once dirname(__DIR__) . '/vendor/autoload.php';

if (!defined('ARRAY_A')) {
    define('ARRAY_A', 'ARRAY_A');
}

if (!defined('HOUR_IN_SECONDS')) {
    define('HOUR_IN_SECONDS', 3600);
}

/**
 * The plugin's own `BLICKS_*_URI` constants, lifted out of `blicks.php`.
 *
 * `blicks.php` cannot be included here — it boots the whole plugin — but code under test reads
 * these constants, and restating the URLs in this file would mean a changed domain passes the
 * suite while shipping the old one. Parsing the source keeps one definition.
 */
foreach (
    (function (): array {
        $source = (string) file_get_contents(dirname(__DIR__) . '/blicks.php');
        preg_match_all("/define\(\s*'(BLICKS_[A-Z_]*URI)'\s*,\s*'([^']+)'/", $source, $matches, PREG_SET_ORDER);

        return $matches;
    })() as $constant
) {
    if (!defined($constant[1])) {
        define($constant[1], $constant[2]);
    }
}

if (!class_exists('WP_Error')) {
    class WP_Error
    {
        public function __construct(private string $code = '', private string $message = '')
        {
        }

        public function get_error_code(): string
        {
            return $this->code;
        }

        public function get_error_message(): string
        {
            return $this->message;
        }
    }
}

if (!class_exists('WP_REST_Response')) {
    class WP_REST_Response
    {
        public function __construct(private mixed $data = null, private int $status = 200)
        {
        }

        public function get_data(): mixed
        {
            return $this->data;
        }

        public function get_status(): int
        {
            return $this->status;
        }
    }
}

if (!class_exists('WP_REST_Request')) {
    class WP_REST_Request
    {
        /** @param array<string,mixed>|null $json */
        public function __construct(private ?array $json = null, private array $body = [])
        {
        }

        public function get_json_params(): ?array
        {
            return $this->json;
        }

        public function get_body_params(): array
        {
            return $this->body;
        }

        public function get_param(string $key): mixed
        {
            return $this->json[$key] ?? $this->body[$key] ?? null;
        }
    }
}

// Minimal WordPress function stubs so pure-logic classes (e.g. AI sanitizers) can be
// unit-tested without a full WP runtime. Guarded so a real WP environment wins.
if (!function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        return $text;
    }
}

if (!function_exists('esc_url_raw')) {
    function esc_url_raw(string $url): string
    {
        $url = trim($url);
        return preg_match('~^(https?:|/|#|mailto:)~i', $url) === 1 ? $url : '';
    }
}

if (!function_exists('wp_parse_url')) {
    function wp_parse_url(string $url, int $component = -1): mixed
    {
        return parse_url($url, $component);
    }
}

if (!function_exists('wp_kses_post')) {
    function wp_kses_post(string $text): string
    {
        return strip_tags($text, '<a><br><div><em><figcaption><figure><h1><h2><h3><h4><h5><h6><hr><img><li><ol><p><section><span><strong><ul>');
    }
}

if (!function_exists('wp_strip_all_tags')) {
    function wp_strip_all_tags(string $text, bool $remove_breaks = false): string
    {
        $text = strip_tags($text);
        return $remove_breaks ? preg_replace('/[\r\n\t ]+/', ' ', $text) ?? $text : $text;
    }
}

if (!function_exists('wp_json_encode')) {
    function wp_json_encode(mixed $data, int $flags = 0): string|false
    {
        return json_encode($data, $flags);
    }
}

if (!function_exists('is_wp_error')) {
    function is_wp_error(mixed $value): bool
    {
        return $value instanceof WP_Error;
    }
}

if (!function_exists('get_option')) {
    function get_option(string $option, mixed $default = false): mixed
    {
        return $GLOBALS['wp_options'][$option] ?? $default;
    }
}

if (!function_exists('update_option')) {
    function update_option(string $option, mixed $value, ?bool $autoload = null): bool
    {
        $GLOBALS['wp_options'][$option] = $value;
        return true;
    }
}

if (!function_exists('sanitize_text_field')) {
    function sanitize_text_field(string $value): string
    {
        return trim(strip_tags($value));
    }
}

if (!function_exists('sanitize_key')) {
    function sanitize_key(string $key): string
    {
        return preg_replace('/[^a-z0-9_-]/', '', strtolower($key)) ?? '';
    }
}

if (!function_exists('sanitize_title')) {
    function sanitize_title(string $title): string
    {
        $title = strtolower(trim($title));
        $title = preg_replace('/[^a-z0-9_-]+/', '-', $title) ?? '';
        return trim($title, '-');
    }
}

if (!function_exists('wp_cache_get')) {
    function wp_cache_get(string $key, string $group = '', bool $force = false, ?bool &$found = null): mixed
    {
        $cacheKey = $group . ':' . $key;
        $found = array_key_exists($cacheKey, $GLOBALS['wp_object_cache'] ?? []);
        return $found ? $GLOBALS['wp_object_cache'][$cacheKey] : false;
    }
}

if (!function_exists('wp_cache_set')) {
    function wp_cache_set(string $key, mixed $value, string $group = '', int $expire = 0): bool
    {
        $GLOBALS['wp_object_cache'][$group . ':' . $key] = $value;
        return true;
    }
}

if (!function_exists('wp_cache_delete')) {
    function wp_cache_delete(string $key, string $group = ''): bool
    {
        unset($GLOBALS['wp_object_cache'][$group . ':' . $key]);
        return true;
    }
}


if (!function_exists('parse_blocks')) {
    /** @return list<array<string, mixed>> */
    function parse_blocks(string $content): array
    {
        if (preg_match_all('/<!-- wp:([^\s]+)(?:\s+({.*?}))? -->(.*?)<!-- \/wp:\1 -->/s', $content, $matches, PREG_SET_ORDER) === false) {
            return [];
        }

        $blocks = [];
        foreach ($matches as $match) {
            $name = str_contains($match[1], '/') ? $match[1] : 'core/' . $match[1];
            $inner = $match[3];
            $blocks[] = [
                'blockName' => $name,
                'attrs' => isset($match[2]) && $match[2] !== '' ? json_decode($match[2], true) : [],
                'innerBlocks' => [],
                'innerHTML' => $inner,
                'innerContent' => [$inner],
            ];
        }

        return $blocks;
    }
}

if (!function_exists('serialize_blocks')) {
    /** @param list<array<string, mixed>> $blocks */
    function serialize_blocks(array $blocks): string
    {
        return implode('', array_map('serialize_block', $blocks));
    }
}

if (!function_exists('serialize_block')) {
    /** @param array<string, mixed> $block */
    function serialize_block(array $block): string
    {
        $name = (string) ($block['blockName'] ?? '');
        $commentName = str_starts_with($name, 'core/') ? substr($name, 5) : $name;
        $inner = implode('', array_map(
            static fn ($part) => is_string($part) ? $part : '',
            (array) ($block['innerContent'] ?? [])
        ));

        return '<!-- wp:' . $commentName . ' -->' . $inner . '<!-- /wp:' . $commentName . ' -->';
    }
}

/**
 * Recording stubs for the WordPress functions Blicks\Core wraps.
 *
 * Each one appends to $GLOBALS['blicks_test_calls'] so a test can assert exactly what the core
 * classes handed to WordPress. Reset with blicks_test_reset_calls() in setUp().
 */
$GLOBALS['blicks_test_calls'] = [];

function blicks_test_reset_calls(): void
{
    $GLOBALS['blicks_test_calls'] = [];
}

/** @return list<array<string, mixed>> */
function blicks_test_calls(string $function = ''): array
{
    $calls = $GLOBALS['blicks_test_calls'] ?? [];

    return '' === $function
        ? $calls
        : array_values(array_filter($calls, static fn (array $c): bool => $c['fn'] === $function));
}

function blicks_test_record(string $function, array $args): void
{
    $GLOBALS['blicks_test_calls'][] = ['fn' => $function, 'args' => $args];
}

if (!function_exists('add_action')) {
    function add_action(string $hook, callable|array $callback, int $priority = 10, int $args = 1): bool
    {
        blicks_test_record('add_action', compact('hook', 'callback', 'priority', 'args'));

        return true;
    }
}

if (!function_exists('add_filter')) {
    function add_filter(string $hook, callable|array $callback, int $priority = 10, int $args = 1): bool
    {
        blicks_test_record('add_filter', compact('hook', 'callback', 'priority', 'args'));

        return true;
    }
}

if (!function_exists('register_rest_route')) {
    function register_rest_route(string $namespace, string $route, array $args = []): bool
    {
        blicks_test_record('register_rest_route', compact('namespace', 'route', 'args'));

        return true;
    }
}

if (!function_exists('wp_enqueue_script')) {
    function wp_enqueue_script(string $handle, string $src = '', array $deps = [], string|bool|null $ver = null, bool $inFooter = false): void
    {
        blicks_test_record('wp_enqueue_script', compact('handle', 'src', 'deps', 'ver', 'inFooter'));
    }
}

if (!function_exists('wp_enqueue_style')) {
    function wp_enqueue_style(string $handle, string $src = '', array $deps = [], string|bool|null $ver = null, string $media = 'all'): void
    {
        blicks_test_record('wp_enqueue_style', compact('handle', 'src', 'deps', 'ver', 'media'));
    }
}

if (!function_exists('wp_add_inline_style')) {
    function wp_add_inline_style(string $handle, string $css): bool
    {
        blicks_test_record('wp_add_inline_style', compact('handle', 'css'));

        return true;
    }
}

if (!function_exists('plugin_dir_path')) {
    function plugin_dir_path(string $file): string
    {
        return rtrim(dirname($file), '/') . '/';
    }
}

if (!function_exists('plugin_dir_url')) {
    function plugin_dir_url(string $file): string
    {
        return 'https://example.test/wp-content/plugins/' . basename(dirname($file)) . '/';
    }
}

if (!function_exists('plugin_basename')) {
    function plugin_basename(string $file): string
    {
        return basename(dirname($file)) . '/' . basename($file);
    }
}

if (!function_exists('register_activation_hook')) {
    function register_activation_hook(string $file, callable $callback): void
    {
        blicks_test_record('register_activation_hook', compact('file', 'callback'));
    }
}

if (!function_exists('register_deactivation_hook')) {
    function register_deactivation_hook(string $file, callable $callback): void
    {
        blicks_test_record('register_deactivation_hook', compact('file', 'callback'));
    }
}

if (!function_exists('register_uninstall_hook')) {
    function register_uninstall_hook(string $file, callable $callback): void
    {
        blicks_test_record('register_uninstall_hook', compact('file', 'callback'));
    }
}

if (!function_exists('_doing_it_wrong')) {
    function _doing_it_wrong(string $function, string $message, string $version): void
    {
        blicks_test_record('_doing_it_wrong', compact('function', 'message', 'version'));
    }
}

if (!function_exists('__return_false')) {
    function __return_false(): bool
    {
        return false;
    }
}

if (!function_exists('esc_html')) {
    function esc_html(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('esc_url')) {
    function esc_url(string $url): string
    {
        return htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('untrailingslashit')) {
    function untrailingslashit(string $value): string
    {
        return rtrim($value, '/\\');
    }
}

/**
 * A real (if tiny) filter registry.
 *
 * `add_filter()` above only records the call, which is right for asserting that a provider wired
 * a hook. `blicks_admin_views` needs the other half — callbacks that actually run — so the tests
 * can prove what a third-party callback can and cannot do to the admin menu.
 *
 * @var array<string, list<callable>> $GLOBALS['blicks_test_filters']
 */
$GLOBALS['blicks_test_filters'] = [];

function blicks_test_add_filter(string $hook, callable $callback): void
{
    $GLOBALS['blicks_test_filters'][$hook][] = $callback;
}

function blicks_test_reset_filters(): void
{
    $GLOBALS['blicks_test_filters'] = [];
}

if (!function_exists('apply_filters')) {
    function apply_filters(string $hook, $value, ...$args)
    {
        foreach ($GLOBALS['blicks_test_filters'][$hook] ?? [] as $callback) {
            $value = $callback($value, ...$args);
        }

        return $value;
    }
}

if (!function_exists('current_user_can')) {
    function current_user_can(string $capability, ...$args): bool
    {
        // Denied by name, so a test can prove a page the user cannot open is withheld.
        return 'do_not_allow' !== $capability;
    }
}
