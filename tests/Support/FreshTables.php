<?php
declare(strict_types=1);

namespace Blicks\Tests\Support;

use Blicks\Models\SettingModel;
use PHPUnit\Event\Test\PreparationStarted;
use PHPUnit\Event\Test\PreparationStartedSubscriber;
use PHPUnit\Runner\Extension\Extension;
use PHPUnit\Runner\Extension\Facade;
use PHPUnit\Runner\Extension\ParameterCollection;
use PHPUnit\TextUI\Configuration\Configuration;

/**
 * Before every test, before its setUp: empty tables, an empty object cache and an empty
 * SettingModel runtime cache, so nothing one test saves is read by the next. A test that wants its
 * own `$wpdb` still sets one in setUp, which runs after this.
 */
final class FreshTables implements Extension
{
    public function bootstrap(Configuration $configuration, Facade $facade, ParameterCollection $parameters): void
    {
        $facade->registerSubscriber(new class implements PreparationStartedSubscriber {
            public function notify(PreparationStarted $event): void
            {
                $GLOBALS['wpdb'] = new FakeTables();
                $GLOBALS['wp_object_cache'] = [];
                (new \ReflectionProperty(SettingModel::class, 'runtimeCache'))->setValue(null, []);
            }
        });
    }
}
