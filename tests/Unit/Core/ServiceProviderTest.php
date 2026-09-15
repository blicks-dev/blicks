<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\Attributes\Action;
use Blicks\Core\Attributes\Filter;
use Blicks\Core\ServiceProvider;
use PHPUnit\Framework\TestCase;

final class ProviderFixture extends ServiceProvider
{
    #[Action('init')]
    public function onInit(): void
    {
    }

    #[Action('wp_footer', priority: 5)]
    public function late(): void
    {
    }

    /** A method may serve several hooks — the attribute is repeatable. */
    #[Action('wp_head', priority: 20, args: 2)]
    #[Action('admin_head')]
    public function both(): void
    {
    }

    #[Filter('the_content', priority: 11, args: 1)]
    public function filterContent(string $content): string
    {
        return $content;
    }

    /** Not attributed: must never be hooked. */
    public function helper(): void
    {
    }

    protected function hidden(): void
    {
    }
}

final class ServiceProviderTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_calls();
    }

    public function test_registers_every_attributed_method_with_its_hook_priority_and_args(): void
    {
        (new ProviderFixture())->register();

        $actions = array_map(
            static fn (array $c): array => [$c['args']['hook'], $c['args']['priority'], $c['args']['args'], $c['args']['callback'][1]],
            blicks_test_calls('add_action')
        );
        sort($actions);

        $this->assertSame([
            ['admin_head', 10, 1, 'both'],
            ['init', 10, 1, 'onInit'],
            ['wp_footer', 5, 1, 'late'],
            ['wp_head', 20, 2, 'both'],
        ], $actions);
    }

    public function test_filters_go_through_add_filter(): void
    {
        (new ProviderFixture())->register();

        $filters = blicks_test_calls('add_filter');
        $this->assertCount(1, $filters);
        $this->assertSame('the_content', $filters[0]['args']['hook']);
        $this->assertSame(11, $filters[0]['args']['priority']);
        $this->assertSame('filterContent', $filters[0]['args']['callback'][1]);
    }

    public function test_unattributed_and_non_public_methods_are_never_hooked(): void
    {
        (new ProviderFixture())->register();

        $names = array_map(
            static fn (array $c): string => $c['args']['callback'][1],
            [...blicks_test_calls('add_action'), ...blicks_test_calls('add_filter')]
        );

        $this->assertNotContains('helper', $names);
        $this->assertNotContains('hidden', $names);
    }

    /** The callback must be bound to the instance, or the hook fires on nothing. */
    public function test_callbacks_are_bound_to_the_provider_instance(): void
    {
        $provider = new ProviderFixture();
        $provider->register();

        foreach (blicks_test_calls('add_action') as $call) {
            $this->assertSame($provider, $call['args']['callback'][0]);
        }
    }
}
