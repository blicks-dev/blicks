<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\ShadowText;
use Blicks\Ai\Spec\SpecValidator;
use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Core\Plugin as BlicksPlugin;
use PHPUnit\Framework\TestCase;

/** Shadows an agent writes as CSS, read into the layers the editor saves. */
final class ShadowTextTest extends TestCase
{
    protected function setUp(): void
    {
        BlicksPlugin::boot(dirname(__DIR__, 3) . '/blicks.php');
        BlockCatalog::reset();
    }

    public function test_a_box_shadow_with_two_layers_and_an_inset_reads_first_on_top(): void
    {
        $this->assertSame(
            [
                ['x' => '0', 'y' => '1px', 'blur' => '0', 'color' => 'rgba(255, 255, 255, 0.4)', 'inset' => true],
                ['x' => '0', 'y' => '12px', 'blur' => '32px', 'spread' => '-12px', 'color' => '#000'],
            ],
            ShadowText::box('inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 12px 32px -12px #000')
        );
    }

    public function test_one_layer_is_an_object_and_bare_numbers_are_pixels(): void
    {
        $this->assertSame(['x' => '2px', 'y' => '4px', 'blur' => '8px', 'color' => 'red'], ShadowText::box('2 4 8 red'));
    }

    public function test_a_text_shadow_is_one_layer_or_a_list(): void
    {
        $this->assertSame(['x' => '0', 'y' => '1px', 'blur' => '1px', 'color' => 'rgba(0, 40, 80, 0.6)'], ShadowText::text('0 1px 1px rgba(0, 40, 80, 0.6)'));
        $this->assertSame([['x' => '0', 'y' => '1px', 'color' => 'red'], ['x' => '0', 'y' => '2px', 'color' => 'blue']], ShadowText::text('0 1px red, 0 2px blue'));
        $this->assertNull(ShadowText::text('0 1px red, url(x)'));
    }

    public function test_a_math_function_is_a_length(): void
    {
        $this->assertSame(['x' => '0', 'y' => '0', 'blur' => 'clamp(20px, 4vw, 60px)', 'color' => 'red'], ShadowText::box('0 0 clamp(20px, 4vw, 60px) red'));
    }

    public function test_radius_shorthand_becomes_corners(): void
    {
        $at = static fn (string $v): array|string => ShadowText::normalize(['border.radius' => ['default' => ['base' => $v]]])['border.radius']['default']['base'];

        $this->assertSame(['topLeft' => '4% 6%', 'topRight' => '4% 6%', 'bottomRight' => '4% 6%', 'bottomLeft' => '4% 6%'], $at('4% / 6%'));
        $this->assertSame(['topLeft' => '8px', 'topRight' => '16px', 'bottomRight' => '8px', 'bottomLeft' => '16px'], $at('8px 16px'));
        $this->assertSame('lg', $at('lg'), 'a token stays a token');
    }

    public function test_unitless_zero_text_shadow_builds(): void
    {
        $spec = BlockSpec::fromArray(['name' => 'blicks/text', 'blicks' => ['effects.textShadow' => ['default' => ['base' => '0 0 24px red, 0 0 2px blue']]]]);

        $this->assertSame([], SpecValidator::validate($spec));
    }

    public function test_text_that_is_not_a_shadow_is_left_for_the_validator(): void
    {
        $this->assertNull(ShadowText::box('url(x) 1px'));
        $this->assertNull(ShadowText::box('1px'));
    }

    public function test_a_spec_with_css_shadows_validates_and_a_token_stays_a_token(): void
    {
        $spec = BlockSpec::fromArray([
            'name' => 'blicks/box',
            'blicks' => [
                'effects.boxShadow' => ['default' => ['base' => '0 12px 32px -12px rgba(0, 0, 0, 0.4)'], 'hover' => ['base' => 'md']],
            ],
        ]);

        $this->assertSame('md', $spec->blicks['effects.boxShadow']['hover']['base']);
        $this->assertSame('-12px', $spec->blicks['effects.boxShadow']['default']['base']['spread']);
        $this->assertSame([], SpecValidator::validate($spec));
    }
}
