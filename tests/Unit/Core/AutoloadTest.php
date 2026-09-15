<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use PHPUnit\Framework\TestCase;

/**
 * The shipped plugin has no Composer autoloader: blicks.php registers its own PSR-4 loader for the
 * `Blicks\` prefix. These tests exercise THAT loader, not the one Composer generates for the test
 * run, so a class whose file path does not match its namespace fails here instead of fatally on
 * whichever request first needs it.
 */
final class AutoloadTest extends TestCase
{
    /** The same mapping blicks.php registers. */
    private static function resolve(string $class): ?string
    {
        if (! str_starts_with($class, 'Blicks\\')) {
            return null;
        }

        $relative = str_replace('\\', '/', substr($class, strlen('Blicks\\')));
        $file     = dirname(__DIR__, 3) . '/src/' . $relative . '.php';

        return is_readable($file) ? $file : null;
    }

    /** @return list<array{string, string}> [class, file] for every class shipped in src/. */
    private static function shippedClasses(): array
    {
        $root  = dirname(__DIR__, 3) . '/src';
        $found = [];

        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));
        foreach ($files as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            $source = (string) file_get_contents($file->getPathname());
            if (
                ! preg_match('/^namespace\s+([^;]+);/m', $source, $namespace)
                || ! preg_match('/^(?:final\s+|abstract\s+)?(?:class|interface|trait|enum)\s+(\w+)/m', $source, $name)
            ) {
                continue;
            }

            $found[] = [trim($namespace[1]) . '\\' . $name[1], $file->getPathname()];
        }

        return $found;
    }

    public function test_every_shipped_class_resolves_through_the_plugin_autoloader(): void
    {
        $classes = self::shippedClasses();
        $this->assertGreaterThan(30, count($classes), 'sanity: src/ should hold many classes');

        foreach ($classes as [$class, $file]) {
            $resolved = self::resolve($class);
            $this->assertNotNull($resolved, "{$class} is not resolvable by the plugin autoloader");
            $this->assertSame(
                realpath($file),
                realpath($resolved),
                "{$class} resolves to a different file than the one declaring it"
            );
        }
    }

    /** The loader must ignore classes it does not own rather than claiming them. */
    public function test_foreign_prefixes_are_ignored(): void
    {
        $this->assertNull(self::resolve('WP_REST_Request'));
        $this->assertNull(self::resolve('Composer\\Autoload\\ClassLoader'));
        $this->assertNull(self::resolve('Blicks\\NoSuchClass'));
    }

    /** blicks.php must register the loader itself — an uninstall request loads nothing else. */
    public function test_plugin_file_registers_the_autoloader_before_booting(): void
    {
        $source = (string) file_get_contents(dirname(__DIR__, 3) . '/blicks.php');

        $this->assertStringNotContainsString('vendor/autoload.php', $source);
        $this->assertLessThan(
            strpos($source, 'Plugin::boot('),
            strpos($source, 'spl_autoload_register('),
            'the autoloader must be registered before Plugin::boot()'
        );
    }
}
