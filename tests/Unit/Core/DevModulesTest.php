<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\DevModules;
use PHPUnit\Framework\TestCase;

/**
 * `BLICKS_DEV_MODULES`: which Pro modules a development install loads. The value becomes part of a
 * file path, so anything but a plain module name is dropped.
 */
final class DevModulesTest extends TestCase
{
    public function test_reads_a_comma_separated_list_of_names(): void
    {
        $this->assertSame(['header-studio', 'dialog-studio'], DevModules::names(' header-studio, dialog-studio ,header-studio'));
    }

    public function test_drops_anything_that_is_not_a_plain_name(): void
    {
        $this->assertSame(['example'], DevModules::names('../src,Example,example,1x,a/b,'));
        $this->assertSame([], DevModules::names(true));
        $this->assertSame([], DevModules::names(''));
    }
}
