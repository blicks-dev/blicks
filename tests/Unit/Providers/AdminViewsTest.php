<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Providers;

use Blicks\Providers\AdminServiceProvider;
use PHPUnit\Framework\TestCase;

/**
 * The `blicks_admin_views` filter: one registration point for a whole admin page.
 *
 * The filter has to be hostile-callback-safe. Anything it returns reaches `add_submenu_page()`,
 * and a malformed entry there breaks the Blicks menu for every user of the site — so the failure
 * mode of a third-party bug must be "their page does not appear", never "our menu is gone".
 */
final class AdminViewsTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_filters();
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
    }

    /** @param callable $callback */
    private function filter($callback): void
    {
        blicks_test_add_filter('blicks_admin_views', $callback);
    }

    public function test_the_built_in_pages_carry_a_view_label_and_capability(): void
    {
        $views = AdminServiceProvider::views();

        $this->assertSame(['blicks', 'blicks-design', 'blicks-settings'], array_keys($views));

        foreach ($views as $slug => $page) {
            $this->assertIsString($page['view'], "{$slug} needs a view id");
            $this->assertNotSame('', $page['label'], "{$slug} needs a label");
            $this->assertSame('manage_options', $page['capability']);
        }
    }

    public function test_a_registered_page_joins_the_list(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-pro-license'] = [
                'view' => 'blicks-pro/license',
                'label' => 'Licence',
                'capability' => 'manage_options',
            ];
            return $views;
        });

        $views = AdminServiceProvider::views();

        $this->assertArrayHasKey('blicks-pro-license', $views);
        $this->assertSame('blicks-pro/license', $views['blicks-pro-license']['view']);
        $this->assertSame('Licence', $views['blicks-pro-license']['label']);

        // Order is menu order. A registered page goes after the built-ins, never above Overview.
        $this->assertSame(
            ['blicks', 'blicks-design', 'blicks-settings', 'blicks-pro-license'],
            array_keys($views)
        );
    }

    public function test_a_registered_page_reaches_the_slug_map_the_app_routes_on(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-pro-license'] = ['view' => 'blicks-pro/license', 'label' => 'Licence'];
            return $views;
        });

        $slugs = AdminServiceProvider::pageSlugs();

        $this->assertSame('blicks-pro-license', $slugs['blicks-pro/license'] ?? null);
        // The built-ins must still be there — this map is what every nav link is built from.
        $this->assertSame('blicks', $slugs['overview'] ?? null);
        $this->assertSame('blicks-design', $slugs['design'] ?? null);
    }

    public function test_a_registered_page_resolves_through_view_lookup(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-pro-license'] = ['view' => 'blicks-pro/license', 'label' => 'Licence'];
            return $views;
        });

        $this->assertSame('blicks-pro/license', AdminServiceProvider::viewForSlug('blicks-pro-license'));
        $this->assertSame('', AdminServiceProvider::viewForSlug('not-ours'));
    }

    public function test_capability_defaults_when_a_page_omits_it(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-pro-license'] = ['view' => 'blicks-pro/license', 'label' => 'Licence'];
            return $views;
        });

        $this->assertSame(
            AdminServiceProvider::DEFAULT_CAPABILITY,
            AdminServiceProvider::views()['blicks-pro-license']['capability']
        );
    }

    // --- Hostile and broken callbacks --------------------------------------------------------

    /**
     * A third party must not be able to delete the Settings screen, whether by returning a
     * shorter array, replacing it, or clobbering its capability.
     */
    public function test_a_callback_cannot_remove_or_replace_a_built_in_page(): void
    {
        $this->filter(static fn (): array => []);
        $this->assertSame(['blicks', 'blicks-design', 'blicks-settings'], array_keys(AdminServiceProvider::views()));

        blicks_test_reset_filters();
        $this->filter(static function (array $views): array {
            $views['blicks-settings'] = [
                'view' => 'hijacked',
                'label' => 'Hijacked',
                'capability' => 'do_not_allow',
            ];
            return $views;
        });

        $settings = AdminServiceProvider::views()['blicks-settings'];
        $this->assertSame('settings', $settings['view']);
        $this->assertSame('manage_options', $settings['capability']);
    }

    public function test_a_callback_returning_a_non_array_leaves_the_menu_intact(): void
    {
        $this->filter(static fn (): string => 'nonsense');

        $this->assertSame(['blicks', 'blicks-design', 'blicks-settings'], array_keys(AdminServiceProvider::views()));
    }

    /** @return array<string, array{mixed}> */
    public static function malformedPages(): array
    {
        return [
            'not an array' => ['just a string'],
            'missing view' => [['label' => 'Licence']],
            'missing label' => [['view' => 'blicks-pro/license']],
            'empty view' => [['view' => '   ', 'label' => 'Licence']],
            'empty label' => [['view' => 'blicks-pro/license', 'label' => '  ']],
            'non-string view' => [['view' => 42, 'label' => 'Licence']],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('malformedPages')]
    public function test_a_malformed_page_is_dropped_rather_than_registered(mixed $page): void
    {
        $this->filter(static function (array $views) use ($page): array {
            $views['blicks-pro-license'] = $page;
            return $views;
        });

        $views = AdminServiceProvider::views();

        $this->assertArrayNotHasKey('blicks-pro-license', $views);
        $this->assertCount(3, $views, 'the built-ins must survive a malformed entry');
    }

    public function test_a_page_with_an_unusable_slug_is_dropped(): void
    {
        $this->filter(static function (array $views): array {
            $views[''] = ['view' => 'blicks-pro/license', 'label' => 'Licence'];
            return $views;
        });

        $this->assertCount(3, AdminServiceProvider::views());
    }
}
