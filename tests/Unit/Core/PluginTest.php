<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\Plugin;
use PHPUnit\Framework\TestCase;

final class PluginTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_calls();
        Plugin::boot(dirname(__DIR__, 3) . '/blicks.php');
    }

    public function test_path_and_url_join_relative_targets_without_doubling_slashes(): void
    {
        $root = dirname(__DIR__, 3);

        $this->assertSame($root . '/build/index.js', Plugin::path('build/index.js'));
        $this->assertSame($root . '/build/index.js', Plugin::path('/build/index.js'));
        $this->assertSame($root . '/', Plugin::path());

        $this->assertStringEndsWith('/build/index.js', Plugin::url('build/index.js'));
        $this->assertStringEndsWith('/build/index.js', Plugin::url('/build/index.js'));
    }

    public function test_basename_is_the_folder_and_file(): void
    {
        $this->assertSame('blicks/blicks.php', Plugin::basename());
    }

    public function test_lifecycle_hooks_are_registered_against_the_plugin_file(): void
    {
        $callback = static fn (): null => null;

        Plugin::onActivate($callback);
        Plugin::onDeactivate($callback);
        Plugin::onUninstall($callback);

        foreach (['register_activation_hook', 'register_deactivation_hook', 'register_uninstall_hook'] as $fn) {
            $call = blicks_test_calls($fn)[0]['args'] ?? null;
            $this->assertNotNull($call, "{$fn} was never called");
            $this->assertStringEndsWith('/blicks.php', $call['file']);
            $this->assertSame($callback, $call['callback']);
        }
    }

    /**
     * version() reads BLICKS_VERSION rather than the plugin header, to keep get_plugin_data() off
     * every front-end request. The two must therefore never drift: a release that bumps one and not
     * the other would ship stale asset versions to every visitor.
     */
    public function test_the_version_constant_matches_the_plugin_header_and_readme_stable_tag(): void
    {
        $root = dirname(__DIR__, 3);
        $pluginFile = (string) file_get_contents($root . '/blicks.php');
        $readme = (string) file_get_contents($root . '/readme.txt');

        preg_match('/^\s*\*\s*Version:\s*(\S+)/m', $pluginFile, $header);
        preg_match("/define\(\s*'BLICKS_VERSION',\s*'([^']+)'/", $pluginFile, $constant);
        preg_match('/^Stable tag:\s*(\S+)/m', $readme, $stable);

        $this->assertSame($header[1], $constant[1], 'plugin header and BLICKS_VERSION disagree');
        $this->assertSame($header[1], $stable[1], 'readme Stable tag and the plugin header disagree');

        if (!defined('BLICKS_VERSION')) {
            define('BLICKS_VERSION', $constant[1]);
        }

        $this->assertSame($constant[1], Plugin::version());
    }
}
