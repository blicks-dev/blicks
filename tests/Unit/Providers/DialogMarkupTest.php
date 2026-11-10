<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Providers;

use Blicks\Providers\DialogServiceProvider;
use PHPUnit\Framework\TestCase;

/**
 * `blicks_dialog_markup`: a rendered dialog's HTML, for a companion to add its own attributes. Its
 * contract is the arguments it is given and that a broken callback cannot blank the dialog.
 */
final class DialogMarkupTest extends TestCase
{
    private const HTML = '<dialog id="dialog-newsletter" class="bl-dialog"><h2>Join</h2></dialog>';

    protected function setUp(): void
    {
        blicks_test_reset_filters();
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
    }

    public function test_unchanged_without_a_filter(): void
    {
        $this->assertSame(self::HTML, DialogServiceProvider::markup(self::HTML, ['blockName' => 'blicks/dialog']));
    }

    public function test_the_filter_gets_the_html_the_id_and_the_block(): void
    {
        $seen = [];
        blicks_test_add_filter('blicks_dialog_markup', static function (string $html, string $id, array $block) use (&$seen): string {
            $seen = [$id, $block['blockName']];

            return str_replace('<dialog ', '<dialog data-acme="1" ', $html);
        });

        $html = DialogServiceProvider::markup(self::HTML, ['blockName' => 'blicks/dialog']);

        $this->assertSame(['dialog-newsletter', 'blicks/dialog'], $seen);
        $this->assertStringStartsWith('<dialog data-acme="1" id="dialog-newsletter"', $html);
    }

    public function test_an_id_less_dialog_is_passed_an_empty_id(): void
    {
        $seen = null;
        blicks_test_add_filter('blicks_dialog_markup', static function (string $html, string $id) use (&$seen): string {
            $seen = $id;

            return $html;
        });

        DialogServiceProvider::markup('<dialog class="bl-dialog"></dialog>', []);

        $this->assertSame('', $seen);
    }

    public function test_a_filter_that_returns_nonsense_is_ignored(): void
    {
        blicks_test_add_filter('blicks_dialog_markup', static fn (): ?string => null);

        $this->assertSame(self::HTML, DialogServiceProvider::markup(self::HTML, []));
    }
}
