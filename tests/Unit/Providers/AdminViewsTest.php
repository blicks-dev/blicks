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

        $this->assertSame(['blicks', 'blicks-design', 'blicks-entries', 'blicks-settings', 'blicks-mcp'], array_keys($views));

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

        // Order is menu order. A page that names no group or order goes last in `build`, the
        // first group — never above Overview, and before the `system` pages.
        $this->assertSame(
            ['blicks', 'blicks-design', 'blicks-entries', 'blicks-pro-license', 'blicks-settings', 'blicks-mcp'],
            array_keys($views)
        );
        $this->assertSame('build', $views['blicks-pro-license']['group']);
        $this->assertSame(AdminServiceProvider::DEFAULT_ORDER, $views['blicks-pro-license']['order']);
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
        $this->assertSame(['blicks', 'blicks-design', 'blicks-entries', 'blicks-settings', 'blicks-mcp'], array_keys(AdminServiceProvider::views()));

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

        $this->assertSame(['blicks', 'blicks-design', 'blicks-entries', 'blicks-settings', 'blicks-mcp'], array_keys(AdminServiceProvider::views()));
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
        $this->assertCount(5, $views, 'the built-ins must survive a malformed entry');
    }

    public function test_a_page_with_an_unusable_slug_is_dropped(): void
    {
        $this->filter(static function (array $views): array {
            $views[''] = ['view' => 'blicks-pro/license', 'label' => 'Licence'];
            return $views;
        });

        $this->assertCount(5, AdminServiceProvider::views());
    }

    // --- Groups and order --------------------------------------------------------------------

    public function test_the_built_ins_are_grouped_build_then_system(): void
    {
        $groups = array_map(static fn (array $page): string => $page['group'], AdminServiceProvider::views());

        $this->assertSame(
            ['blicks' => 'build', 'blicks-design' => 'build', 'blicks-entries' => 'build', 'blicks-settings' => 'system', 'blicks-mcp' => 'system'],
            $groups
        );
    }

    public function test_a_page_lands_in_its_group_at_its_order(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-kits'] = ['view' => 'kits', 'label' => 'Kits', 'group' => 'build', 'order' => 30];
            $views['blicks-pro-license'] = ['view' => 'blicks-pro/license', 'label' => 'Licence', 'group' => 'system', 'order' => 30];
            return $views;
        });

        $this->assertSame(
            ['blicks', 'blicks-design', 'blicks-kits', 'blicks-entries', 'blicks-settings', 'blicks-mcp', 'blicks-pro-license'],
            array_keys(AdminServiceProvider::views())
        );
    }

    public function test_pages_with_the_same_order_keep_the_order_they_registered_in(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-b'] = ['view' => 'b', 'label' => 'B', 'group' => 'system', 'order' => 50];
            $views['blicks-a'] = ['view' => 'a', 'label' => 'A', 'group' => 'system', 'order' => 50];
            return $views;
        });

        $keys = array_keys(AdminServiceProvider::views());

        $this->assertSame(['blicks-b', 'blicks-a'], array_slice($keys, -2));
    }

    public function test_an_unknown_group_falls_back_to_build_and_a_low_order_cannot_pass_overview(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-x'] = ['view' => 'x', 'label' => 'X', 'group' => 'nowhere', 'order' => -50];
            $views['blicks-y'] = ['view' => 'y', 'label' => 'Y', 'order' => 'soon'];
            return $views;
        });

        $views = AdminServiceProvider::views();

        $this->assertSame('blicks', array_key_first($views), 'Overview stays first');
        $this->assertSame('build', $views['blicks-x']['group']);
        $this->assertSame(1, $views['blicks-x']['order']);
        $this->assertSame(AdminServiceProvider::DEFAULT_ORDER, $views['blicks-y']['order']);
    }

    public function test_a_callback_cannot_regroup_or_reorder_a_built_in_page(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-settings']['group'] = 'build';
            $views['blicks-settings']['order'] = 1;
            return $views;
        });

        $views = AdminServiceProvider::views();

        $this->assertSame('system', $views['blicks-settings']['group']);
        $this->assertSame(10, $views['blicks-settings']['order']);
    }

    public function test_the_menu_lists_every_page_in_order_with_its_group(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-kits'] = ['view' => 'kits', 'label' => 'Kits', 'group' => 'build', 'order' => 30];
            return $views;
        });

        $menu = AdminServiceProvider::menu();

        $this->assertSame(
            ['overview', 'design', 'kits', 'entries', 'settings', 'mcp'],
            array_column($menu, 'id')
        );
        $this->assertSame(['id' => 'kits', 'label' => 'Kits', 'slug' => 'blicks-kits', 'group' => 'build'], $menu[2]);
    }

    public function test_external_views_leave_out_every_built_in(): void
    {
        $this->filter(static function (array $views): array {
            $views['blicks-kits'] = ['view' => 'kits', 'label' => 'Kits'];
            return $views;
        });

        $this->assertSame(['kits'], array_column(AdminServiceProvider::externalViews(), 'id'));
    }
}
