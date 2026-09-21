<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Providers;

use Blicks\Providers\AdminServiceProvider;
use PHPUnit\Framework\TestCase;

/**
 * The support links, and the two surfaces that render them.
 *
 * These are the plugin's only route from "this is broken" to a report someone can act on, so the
 * failure that matters is not a wrong label — it is a link that silently goes nowhere, or one that
 * appears under every other plugin on the site.
 */
final class SupportLinksTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_filters();
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
    }

    public function test_every_link_carries_a_label_and_an_absolute_url(): void
    {
        $links = AdminServiceProvider::supportLinks();

        $this->assertNotEmpty($links);

        foreach ($links as $key => $link) {
            $this->assertNotSame('', $link['label'], "{$key} has no label");
            $this->assertMatchesRegularExpression('#^https://#', $link['url'], "{$key} is not an absolute https URL");
        }
    }

    public function test_the_issue_urls_name_the_forms_that_exist_in_the_repo(): void
    {
        $links = AdminServiceProvider::supportLinks();
        $dir = dirname(__DIR__, 3) . '/.github/ISSUE_TEMPLATE/';

        // A `?template=` naming a file that is not there does not error — GitHub quietly falls
        // back to the chooser, so renaming a form would degrade the CTA with nothing failing.
        foreach (['bug' => 'bug_report.yml', 'feature' => 'feature_request.yml'] as $key => $file) {
            $this->assertStringContainsString("template={$file}", $links[$key]['url']);
            $this->assertFileExists($dir . $file);
        }
    }

    public function test_the_row_meta_is_added_only_to_the_blicks_row(): void
    {
        $provider = new AdminServiceProvider();
        $meta = $provider->addRowMeta(['View details'], 'some-other-plugin/other.php');

        $this->assertSame(['View details'], $meta);
    }

    public function test_the_row_meta_carries_one_anchor_per_link(): void
    {
        $provider = new AdminServiceProvider();
        $links = AdminServiceProvider::supportLinks();
        $meta = $provider->addRowMeta(['View details'], \Blicks\Core\Plugin::basename());

        $this->assertCount(count($links) + 1, $meta);

        foreach (array_slice($meta, 1) as $html) {
            $this->assertStringStartsWith('<a href="https://', $html);
            // These leave wp-admin, so they open in a new tab — and `noopener` is what stops the
            // opened page reaching back through `window.opener`.
            $this->assertStringContainsString('rel="noreferrer noopener"', $html);
        }
    }

    public function test_a_filter_can_add_a_destination(): void
    {
        blicks_test_add_filter('blicks_support_links', static function (array $links): array {
            $links['forum'] = ['label' => 'Forum', 'url' => 'https://example.com/forum'];
            return $links;
        });

        $this->assertArrayHasKey('forum', AdminServiceProvider::supportLinks());
    }
}
