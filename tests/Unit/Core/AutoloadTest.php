<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use PHPUnit\Framework\TestCase;

/**
 * Every class ships under one PSR-4 root, `Blicks\` => `src/`, resolved by Composer's autoloader.
 * These tests check that mapping by hand rather than through Composer's generated classmap, so a
 * class whose file path does not match its namespace fails here instead of fatally on whichever
 * request first needs it — a classmap built from the current tree would hide exactly that.
 */
final class AutoloadTest extends TestCase
{
    /** The PSR-4 mapping composer.json declares, applied literally. */
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

    /**
     * The autoloader must be in place before anything else in blicks.php runs: WordPress includes
     * this file by itself during an uninstall and then calls the stored callback, so
     * Blicks\Plugin::uninstall() has to resolve with nothing else loaded.
     */
    public function test_plugin_file_loads_the_autoloader_before_booting(): void
    {
        $source = (string) file_get_contents(dirname(__DIR__, 3) . '/blicks.php');

        $this->assertLessThan(
            strpos($source, "\nPlugin::boot( __FILE__ );"),
            strpos($source, "require_once __DIR__ . '/vendor/autoload.php'"),
            'the autoloader must be required before Plugin::boot()'
        );
    }

    /** The PSR-4 root the tests assume is the one composer.json actually declares. */
    public function test_composer_maps_the_blicks_namespace_to_src(): void
    {
        $composer = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/composer.json'), true);

        $this->assertSame(['Blicks\\' => 'src/'], $composer['autoload']['psr-4']);
        $this->assertSame(['php' => '>=8.1'], $composer['require'], 'the plugin must ship no production dependencies');
    }
}
