<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Animations;
use PHPUnit\Framework\TestCase;

/**
 * The keyframe library is authored by users and emitted into a stylesheet that loads on every
 * front-end page, so validation is a whitelist. These cover the shape rules and the guards.
 */
final class AnimationsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
    }

    private function save(array $payload, string $original = ''): array
    {
        return Animations::save($payload, $original);
    }

    private function valid(array $overrides = []): array
    {
        return array_merge([
            'slug' => 'pulse-glow',
            'label' => 'Pulse glow',
            'defaults' => ['duration' => '600ms', 'easing' => 'ease-out', 'iteration' => '1'],
            'steps' => [
                ['offset' => 0, 'declarations' => ['opacity' => '0']],
                ['offset' => 100, 'declarations' => ['opacity' => '1']],
            ],
        ], $overrides);
    }

    public function testStoresAValidAnimation(): void
    {
        $result = $this->save($this->valid());

        $this->assertTrue($result['ok']);
        $this->assertCount(1, $result['animations']);
        $this->assertSame('pulse-glow', $result['animations'][0]['slug']);
        $this->assertSame('600ms', $result['animations'][0]['defaults']['duration']);
    }

    public function testSlugIsNormalisedToKebab(): void
    {
        $result = $this->save($this->valid(['slug' => '  Pulse Glow!! ']));

        $this->assertTrue($result['ok']);
        $this->assertSame('pulse-glow', $result['animations'][0]['slug']);
    }

    public function testBuiltInNamesAreReserved(): void
    {
        $result = $this->save($this->valid(['slug' => 'spin']));

        $this->assertFalse($result['ok']);
        $this->assertSame('invalid', $result['error']);
    }

    public function testRejectsAnAnimationWithNoUsableStep(): void
    {
        $result = $this->save($this->valid(['steps' => [
            ['offset' => 0, 'declarations' => ['position' => 'fixed']],
        ]]));

        $this->assertFalse($result['ok']);
    }

    public function testDropsNonWhitelistedPropertiesButKeepsTheRest(): void
    {
        $result = $this->save($this->valid(['steps' => [
            ['offset' => 0, 'declarations' => ['opacity' => '0', 'position' => 'fixed', 'behavior' => 'url(x.htc)']],
            ['offset' => 100, 'declarations' => ['opacity' => '1']],
        ]]));

        $this->assertTrue($result['ok']);
        $this->assertSame(['opacity' => '0'], $result['animations'][0]['steps'][0]['declarations']);
    }

    public function testAllowsOwnCustomProperties(): void
    {
        $result = $this->save($this->valid(['steps' => [
            ['offset' => 0, 'declarations' => ['--bl-p' => '0']],
            ['offset' => 100, 'declarations' => ['--bl-p' => '1', '--evil-thing' => '2']],
        ]]));

        $this->assertTrue($result['ok']);
        $this->assertSame(['--bl-p' => '1'], $result['animations'][0]['steps'][1]['declarations']);
    }

    /** A value able to close the declaration, the rule, or the surrounding <style> is refused. */
    public function testRejectsEscapingValues(): void
    {
        foreach (['red; } body { display: none', 'url(http://evil.test/x.png)', '</style><script>', 'expression(alert(1))'] as $hostile) {
            $result = $this->save($this->valid([
                'slug' => 'hostile',
                'steps' => [
                    ['offset' => 0, 'declarations' => ['color' => $hostile]],
                    ['offset' => 100, 'declarations' => ['opacity' => '1']],
                ],
            ]));

            $declarations = $result['ok'] ? $result['animations'][0]['steps'][0]['declarations'] : [];
            $value = $declarations['color'] ?? '';

            $this->assertStringNotContainsString('}', $value);
            $this->assertStringNotContainsString('<', $value);
            $this->assertStringNotContainsString(';', $value);
            $this->assertDoesNotMatchRegularExpression('/url\s*\(|expression\s*\(/i', $value);

            $GLOBALS['wp_options'] = [];
        }
    }

    public function testOffsetsAreClampedSortedAndDeduped(): void
    {
        $result = $this->save($this->valid(['steps' => [
            ['offset' => 100, 'declarations' => ['opacity' => '1']],
            ['offset' => 140, 'declarations' => ['opacity' => '9']],
            ['offset' => -5, 'declarations' => ['opacity' => '8']],
            ['offset' => 50, 'declarations' => ['opacity' => '.5']],
            ['offset' => 0, 'declarations' => ['opacity' => '0']],
        ]]));

        $this->assertTrue($result['ok']);
        $this->assertSame([0, 50, 100], array_column($result['animations'][0]['steps'], 'offset'));
    }

    public function testRejectsADuplicateSlug(): void
    {
        $this->save($this->valid());
        $result = $this->save($this->valid(['label' => 'Another']));

        $this->assertFalse($result['ok']);
        $this->assertSame('duplicate', $result['error']);
    }

    public function testUpdateReplacesInPlaceAndCanRename(): void
    {
        $this->save($this->valid());
        $result = $this->save($this->valid(['slug' => 'pulse-soft', 'label' => 'Pulse soft']), 'pulse-glow');

        $this->assertTrue($result['ok']);
        $this->assertCount(1, $result['animations']);
        $this->assertSame('pulse-soft', $result['animations'][0]['slug']);
    }

    public function testDeleteRemovesOnlyTheNamedAnimation(): void
    {
        $this->save($this->valid());
        $this->save($this->valid(['slug' => 'drift', 'label' => 'Drift']));

        $remaining = Animations::delete('pulse-glow');

        $this->assertCount(1, $remaining);
        $this->assertSame('drift', $remaining[0]['slug']);
    }

    /**
     * The predefined list is a mirror of `resources/runtime/_keyframes.scss` — one of those
     * (`bl-marquee`) is consumed directly by the Marquee block's stylesheet, so a name drifting
     * apart would break a block, not just the picker.
     */
    public function testBuiltinsMatchTheKeyframesDeclaredInCss(): void
    {
        $scss = (string) file_get_contents(dirname(__DIR__, 3) . '/resources/runtime/_keyframes.scss');
        preg_match_all('/@keyframes\s+(bl-[a-z0-9-]+)/', $scss, $matches);

        $declared = array_values(array_unique($matches[1]));
        $listed = array_column(Animations::builtins(), 'name');

        sort($declared);
        sort($listed);

        $this->assertSame($declared, $listed);
    }

    public function testLibraryPutsPredefinedFirstAndFlagsOwnership(): void
    {
        $this->save($this->valid());
        $library = Animations::library();

        $this->assertCount(count(Animations::builtins()) + 1, $library);
        $this->assertTrue($library[0]['builtin']);
        $this->assertSame('bl-spin', $library[0]['name']);

        $last = end($library);
        $this->assertFalse($last['builtin']);
        $this->assertSame('bl-anim-pulse-glow', $last['name']);
    }

    /** Built-ins live in runtime.scss, so re-emitting them would duplicate every rule. */
    public function testEmittedCssCoversOnlyTheUsersOwnAnimations(): void
    {
        $this->save($this->valid());
        $css = \Blicks\DesignSystem\Keyframes::css();

        $this->assertStringContainsString('bl-anim-pulse-glow', $css);
        $this->assertStringNotContainsString('@keyframes bl-spin', $css);
    }

    public function testDefaultsRejectNonsenseTimings(): void
    {
        $result = $this->save($this->valid(['defaults' => [
            'duration' => 'soon',
            'iteration' => 'lots',
            'direction' => 'sideways',
            'fillMode' => 'both',
        ]]));

        $this->assertTrue($result['ok']);
        $this->assertSame(['fillMode' => 'both'], $result['animations'][0]['defaults']);
    }
}
