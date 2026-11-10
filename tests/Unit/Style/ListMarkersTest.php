<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Ai\Spec\Icons;
use Blicks\Style\ListMarkers;
use Blicks\Style\ScopedCss;
use PHPUnit\Framework\TestCase;

final class ListMarkersTest extends TestCase
{
    protected function setUp(): void
    {
        if (! Icons::available()) {
            $this->markTestSkipped('The icon registry is not built (resources/framework/icons/svg.gen.json).');
        }
    }

    protected function tearDown(): void
    {
        ScopedCss::reset();
    }

    public function test_an_icon_list_asks_for_its_icon_and_defaults_to_a_check(): void
    {
        $this->assertSame('star', ListMarkers::iconFor(['blockName' => 'blicks/list', 'attrs' => ['kind' => 'icons', 'icon' => 'star']]));
        $this->assertSame('check', ListMarkers::iconFor(['blockName' => 'blicks/list', 'attrs' => ['kind' => 'icons']]));
    }

    public function test_other_lists_and_inner_lists_ask_for_nothing(): void
    {
        $this->assertSame('', ListMarkers::iconFor(['blockName' => 'blicks/list', 'attrs' => ['icon' => 'star']]));
        $this->assertSame('', ListMarkers::iconFor(['blockName' => 'blicks/list', 'attrs' => ['kind' => 'icons', 'nested' => true]]));
        $this->assertSame('', ListMarkers::iconFor(['blockName' => 'blicks/text', 'attrs' => ['icon' => 'star']]));
    }

    public function test_an_item_asks_only_for_its_own_icon(): void
    {
        $this->assertSame('heart', ListMarkers::iconFor(['blockName' => 'blicks/list-item', 'attrs' => ['icon' => 'heart']]));
        $this->assertSame('', ListMarkers::iconFor(['blockName' => 'blicks/list-item', 'attrs' => []]));
    }

    public function test_steps_share_the_icon_rules(): void
    {
        $this->assertSame('flag', ListMarkers::iconFor(['blockName' => 'blicks/steps', 'attrs' => ['marker' => 'icons', 'icon' => 'flag']]));
        $this->assertSame('', ListMarkers::iconFor(['blockName' => 'blicks/steps', 'attrs' => ['icon' => 'flag']]));
        $this->assertSame('rocket', ListMarkers::iconFor(['blockName' => 'blicks/step', 'attrs' => ['icon' => 'rocket']]));
    }

    public function test_names_resolve_as_the_editor_saves_them(): void
    {
        // `bolt` is an alias of `zap`; the editor saved `bl-li-ic-zap`, so the rule must name it.
        $this->assertSame('zap', ListMarkers::iconName('bolt'));
        $this->assertSame('star', ListMarkers::iconName('no-such-icon'));
    }

    public function test_the_rule_sets_the_mask_for_its_class(): void
    {
        $rule = ListMarkers::rule('check');

        $this->assertStringStartsWith('.bl-li-ic-check{--bl-li-icon:url("data:image/svg+xml,', $rule);
        $this->assertStringEndsWith('")}', $rule);
        $this->assertStringContainsString(rawurlencode(Icons::body('check')), $rule);
        $this->assertStringNotContainsString('<', $rule);
    }

    public function test_one_rule_per_icon_however_many_lists_use_it(): void
    {
        $list = ['blockName' => 'blicks/list', 'attrs' => ['kind' => 'icons', 'icon' => 'check']];
        ListMarkers::collect($list);
        ListMarkers::collect($list);
        ListMarkers::collect(['blockName' => 'blicks/list-item', 'attrs' => ['icon' => 'star']]);

        $this->assertSame(ListMarkers::rule('check') . ListMarkers::rule('star'), ScopedCss::css());
    }
}
