<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Modules;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * The PHP side of the module rule (modules/README.md): a Pro module uses the free plugin through
 * public hooks and a short list of documented classes, never by reaching into its internals. Every
 * `use Blicks\…` line, and every fully qualified `\Blicks\…` name, outside the allow-list fails here.
 *
 * Also checked, because each is a rename at the move if it slips: the module's code lives under
 * the `BlicksPro\` namespace, and its strings are in the `blicks-pro` text domain.
 */
final class ModuleBoundaryTest extends TestCase
{
    /** Classes a module may use: documented, and staying in the free plugin. */
    private const ALLOWED = [
        'Blicks\\Studio\\EntityRef',
    ];

    /**
     * What is wrong with one PHP file's source, as messages.
     *
     * @return list<string>
     */
    public static function problems(string $source): array
    {
        $found = [];

        preg_match_all('/^\s*use\s+\\\\?(Blicks\\\\[A-Za-z0-9_\\\\]+)/m', $source, $uses);
        preg_match_all('/(?<![A-Za-z0-9_\\\\])\\\\(Blicks\\\\[A-Za-z0-9_\\\\]+)/', $source, $qualified);

        foreach (array_unique([...$uses[1], ...$qualified[1]]) as $class) {
            if (!in_array($class, self::ALLOWED, true)) {
                $found[] = "uses {$class}";
            }
        }

        if (preg_match('/^\s*namespace\s+([A-Za-z0-9_\\\\]+)/m', $source, $namespace) && !str_starts_with($namespace[1], 'BlicksPro\\')) {
            $found[] = "is in namespace {$namespace[1]}";
        }

        if (preg_match('/,\s*[\'"]blicks[\'"]\s*\)/', $source)) {
            $found[] = 'uses the blicks text domain';
        }

        return $found;
    }

    /** @return list<string> */
    private static function moduleFiles(): array
    {
        $root = dirname(__DIR__, 3) . '/modules';
        $files = [];

        if (!is_dir($root)) {
            return [];
        }

        $walk = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS));

        foreach ($walk as $file) {
            $path = (string) $file;

            if (str_ends_with($path, '.php') && !preg_match('#/(build|vendor|node_modules|tests)/#', $path)) {
                $files[] = $path;
            }
        }

        sort($files);

        return $files;
    }

    public function test_every_module_file_keeps_to_the_public_surface(): void
    {
        $failures = [];

        foreach (self::moduleFiles() as $file) {
            foreach (self::problems((string) file_get_contents($file)) as $problem) {
                $failures[] = substr($file, strlen(dirname(__DIR__, 3)) + 1) . " {$problem}";
            }
        }

        $this->assertSame([], $failures);
    }

    public function test_the_scan_catches_a_reach_into_the_plugin(): void
    {
        $this->assertSame(['uses Blicks\\Style\\Tokens'], self::problems("<?php\nnamespace BlicksPro\\X;\nuse Blicks\\Style\\Tokens;\n"));
        $this->assertSame(['uses Blicks\\Core\\Plugin'], self::problems("<?php\nnamespace BlicksPro\\X;\n\$u = \\Blicks\\Core\\Plugin::url( 'x' );\n"));
        $this->assertSame([], self::problems("<?php\nnamespace BlicksPro\\X;\nuse Blicks\\Studio\\EntityRef;\nuse BlicksPro\\X\\Y;\n"));
    }

    public function test_the_scan_catches_a_free_namespace_or_text_domain(): void
    {
        $this->assertSame(['is in namespace Blicks\\Header'], self::problems("<?php\nnamespace Blicks\\Header;\n"));
        $this->assertSame(['uses the blicks text domain'], self::problems("<?php\nnamespace BlicksPro\\X;\n__( 'Header', 'blicks' );\n"));
        $this->assertSame([], self::problems("<?php\nnamespace BlicksPro\\X;\n__( 'Header', 'blicks-pro' );\n"));
    }
}
