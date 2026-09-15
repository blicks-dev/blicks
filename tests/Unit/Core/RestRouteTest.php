<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\Http\Rest;
use Blicks\Core\Http\RestRoute;
use PHPUnit\Framework\TestCase;

final class RestRouteTest extends TestCase
{
    /** Stand-in route handler; never invoked. */
    public static function handler(): void
    {
    }

    protected function setUp(): void
    {
        blicks_test_reset_calls();
        Rest::reset();
    }

    protected function tearDown(): void
    {
        Rest::reset();
    }

    public function test_builds_the_register_rest_route_arguments(): void
    {
        $permission = static fn (): bool => true;
        $args = (new RestRoute('blicks/v1', 'settings', 'PATCH', [self::class, 'handler']))
            ->permission($permission)
            ->schema(['name' => ['type' => 'string']])
            ->toArgs();

        $this->assertSame('PATCH', $args['methods']);
        $this->assertSame([self::class, 'handler'], $args['callback']);
        $this->assertSame($permission, $args['permission_callback']);
        $this->assertSame(['name' => ['type' => 'string']], $args['args']);
    }

    public function test_omits_args_when_no_schema_was_given(): void
    {
        $args = (new RestRoute('blicks/v1', 'ping', 'GET', [self::class, 'handler']))
            ->permission(static fn (): bool => true)
            ->toArgs();

        $this->assertArrayNotHasKey('args', $args);
    }

    /**
     * A route with no permission callback fails CLOSED. The previous library defaulted to
     * is_user_logged_in(), which would have exposed a forgotten route to every subscriber.
     */
    public function test_a_route_without_a_permission_callback_is_denied(): void
    {
        $args = (new RestRoute('blicks/v1', 'oops', 'GET', [self::class, 'handler']))->toArgs();

        $this->assertSame('__return_false', $args['permission_callback']);
        $this->assertFalse(call_user_func($args['permission_callback']));
    }

    public function test_routes_register_once_on_rest_api_init_with_a_leading_slash(): void
    {
        Rest::get('blicks/v1', 'dashboard', [self::class, 'handler'])->permission(static fn (): bool => true);
        Rest::patch('blicks/v1', '/settings', [self::class, 'handler'])->permission(static fn (): bool => true);

        $hooks = blicks_test_calls('add_action');
        $this->assertCount(1, $hooks, 'the rest_api_init listener is attached exactly once');
        $this->assertSame('rest_api_init', $hooks[0]['args']['hook']);

        call_user_func($hooks[0]['args']['callback']);

        $registered = array_map(
            static fn (array $c): array => [$c['args']['namespace'], $c['args']['route'], $c['args']['args']['methods']],
            blicks_test_calls('register_rest_route')
        );

        $this->assertSame([
            ['blicks/v1', '/dashboard', 'GET'],
            ['blicks/v1', '/settings', 'PATCH'],
        ], $registered);
    }
}
