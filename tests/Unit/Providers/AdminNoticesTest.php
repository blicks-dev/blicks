<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Providers;

use Blicks\Providers\AdminServiceProvider;
use PHPUnit\Framework\TestCase;

/**
 * Admin notices are kept off the Blicks pages, and only off them.
 *
 * The failure that matters is the scope: emptying the notice hooks on any other screen would
 * swallow every plugin's and core's notices across wp-admin.
 */
final class AdminNoticesTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_filters();
        blicks_test_reset_calls();
        $GLOBALS['blicks_test_is_admin'] = true;
        $GLOBALS['pagenow'] = 'admin.php';
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
        blicks_test_reset_calls();
        unset($GLOBALS['blicks_test_is_admin'], $GLOBALS['pagenow'], $_GET['page']);
    }

    /** @return list<string> */
    private function clearedHooks(): array
    {
        return array_map(
            static fn (array $call): string => $call['args']['hook'],
            blicks_test_calls('remove_all_actions')
        );
    }

    public function test_every_notice_hook_is_emptied_on_a_blicks_page(): void
    {
        $_GET['page'] = 'blicks-settings';

        (new AdminServiceProvider())->hideAdminNotices();

        $this->assertSame(AdminServiceProvider::NOTICE_HOOKS, $this->clearedHooks());
    }

    public function test_a_registered_page_counts_as_a_blicks_page(): void
    {
        blicks_test_add_filter('blicks_admin_views', static function (array $views): array {
            $views['blicks-pro-license'] = ['view' => 'blicks-pro/license', 'label' => 'Licence'];
            return $views;
        });
        $_GET['page'] = 'blicks-pro-license';

        $this->assertTrue(AdminServiceProvider::isBlicksScreen());
    }

    public function test_another_plugins_page_keeps_its_notices(): void
    {
        $_GET['page'] = 'woocommerce';

        (new AdminServiceProvider())->hideAdminNotices();

        $this->assertSame([], $this->clearedHooks());
    }

    public function test_a_screen_without_a_page_keeps_its_notices(): void
    {
        $GLOBALS['pagenow'] = 'edit.php';

        (new AdminServiceProvider())->hideAdminNotices();

        $this->assertSame([], $this->clearedHooks());
    }

    public function test_a_blicks_slug_outside_admin_php_keeps_its_notices(): void
    {
        $GLOBALS['pagenow'] = 'options-general.php';
        $_GET['page'] = 'blicks';

        $this->assertFalse(AdminServiceProvider::isBlicksScreen());
    }
}
