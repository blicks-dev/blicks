<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Abilities\CoreAbilities;
use Blicks\Ai\Abilities\McpServer;
use PHPUnit\Framework\TestCase;

final class McpServerTest extends TestCase
{
    public function test_its_tools_are_exactly_the_registered_abilities(): void
    {
        $this->assertSame(array_keys(CoreAbilities::all()), McpServer::tools());
    }

    public function test_a_companion_adds_tools_but_cannot_remove_or_garble_them(): void
    {
        blicks_test_reset_filters();
        blicks_test_add_filter('blicks_mcp_tools', static fn (array $tools): array => ['acme/make-header', 'Bad Name', 42, 'acme/make-header']);

        $tools = McpServer::tools();
        blicks_test_reset_filters();

        $this->assertSame([...array_keys(CoreAbilities::all()), 'acme/make-header'], $tools);
    }

    /** The address users paste into a client. Unversioned, so a release never breaks it. */
    public function test_it_answers_on_wp_json_blicks_mcp(): void
    {
        $this->assertSame('/blicks/mcp', McpServer::restPath());
    }

    /** An older Blicks Pro registers a server called `blicks`; ids must not collide. */
    public function test_its_id_does_not_collide_with_older_pro_builds(): void
    {
        $this->assertNotSame('blicks', McpServer::ID);
    }
}
