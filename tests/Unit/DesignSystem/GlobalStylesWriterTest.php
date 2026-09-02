<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\GlobalStylesWriter;
use Blicks\DesignSystem\ThemeProjection;
use Blicks\DesignSystem\TypeRoleProjection;
use Blicks\DesignSystem\TypeRoles;
use PHPUnit\Framework\TestCase;

final class GlobalStylesWriterTest extends TestCase
{
    public function test_merge_settings_writes_all_token_kinds_and_round_trips_through_projection(): void
    {
        $settings = GlobalStylesWriter::mergeSettings([
            'color' => [
                'palette' => [
                    ['slug' => 'primary', 'name' => 'Primary', 'color' => '#111111'],
                    ['slug' => 'theme-only', 'name' => 'Theme Only', 'color' => '#eeeeee'],
                ],
            ],
        ], [
            'color' => ['primary' => '#123456'],
            'spacing' => ['md' => '1.25rem'],
            'fontSize' => ['base' => '17px'],
            'fontFamily' => ['sans' => 'Inter, sans-serif'],
            'radius' => ['lg' => '14px'],
            'shadow' => ['md' => '0 2px 10px rgb(0 0 0 / 0.2)'],
            'transition' => ['fast' => 'opacity 120ms ease'],
            'transform' => ['lift' => 'translateY(-4px)'],
            'filter' => ['blur' => 'blur(8px)'],
            'content' => ['size' => '1180px'],
        ], [
            'tablet' => 900,
            'mobile' => 640,
        ]);

        $projected = ThemeProjection::fromSettings($settings, [
            'color' => ['primary'],
            'spacing' => ['md'],
            'fontSize' => ['base'],
            'fontFamily' => ['sans'],
            'radius' => ['lg'],
            'shadow' => ['md'],
            'transition' => ['fast'],
            'transform' => ['lift'],
            'filter' => ['blur'],
            'content' => ['size'],
        ]);

        $this->assertSame('#123456', $projected['color']['primary']);
        $this->assertSame('1.25rem', $projected['spacing']['md']);
        $this->assertSame('17px', $projected['fontSize']['base']);
        $this->assertSame('Inter, sans-serif', $projected['fontFamily']['sans']);
        $this->assertSame('14px', $projected['radius']['lg']);
        $this->assertSame('0 2px 10px rgb(0 0 0 / 0.2)', $projected['shadow']['md']);
        $this->assertSame('opacity 120ms ease', $projected['transition']['fast']);
        $this->assertSame('translateY(-4px)', $projected['transform']['lift']);
        $this->assertSame('blur(8px)', $projected['filter']['blur']);
        $this->assertSame('1180px', $projected['content']['size']);

        $breakpoints = ThemeProjection::breakpointsFromSettings($settings, [
            ['id' => 'base', 'label' => 'Desktop', 'max' => null],
            ['id' => 'tablet', 'label' => 'Tablet', 'max' => 782],
            ['id' => 'mobile', 'label' => 'Mobile', 'max' => 600],
        ]);
        $this->assertSame(900, $breakpoints[1]['max']);
        $this->assertSame(640, $breakpoints[2]['max']);

        $this->assertSame('#eeeeee', $settings['color']['palette'][1]['color']);
    }

    public function test_merge_settings_round_trips_phase2_token_groups(): void
    {
        $tokens = [
            'gradient' => ['brand' => 'linear-gradient(135deg, #002bff, #5b7bff)'],
            'zIndex' => ['toast' => '1000'],
            'opacity' => ['scrim' => '0.55'],
            'borderWidth' => ['strong' => '2px'],
            'borderStyle' => ['dashed' => '1px dashed #002bff'],
            'ring' => ['brand' => '0 0 0 3px rgba(0, 43, 255, 0.35)'],
            'width' => ['wide' => '1360px'],
            'aspect' => ['wide' => '16 / 9'],
            'leading' => ['snug' => '1.3'],
        ];

        $settings = GlobalStylesWriter::mergeSettings([], $tokens, []);

        // gradient is a native v3 preset (settings.color.gradients), not a custom.
        $this->assertSame('brand', $settings['color']['gradients'][0]['slug']);
        $this->assertSame('linear-gradient(135deg, #002bff, #5b7bff)', $settings['color']['gradients'][0]['gradient']);
        // customs land under settings.custom.blicks.<group>.
        $this->assertSame('1000', $settings['custom']['blicks']['zIndex']['toast']);
        $this->assertSame('0.55', $settings['custom']['blicks']['opacity']['scrim']);
        $this->assertSame('16 / 9', $settings['custom']['blicks']['aspect']['wide']);

        $catalogue = [];
        foreach ($tokens as $category => $values) {
            $catalogue[$category] = array_keys($values);
        }
        $projected = ThemeProjection::fromSettings($settings, $catalogue);

        foreach ($tokens as $category => $values) {
            foreach ($values as $slug => $value) {
                $this->assertSame($value, $projected[$category][$slug], "$category.$slug round-trip");
            }
        }
    }

    public function test_merge_type_roles_writes_styles_and_custom_and_round_trips(): void
    {
        $data = GlobalStylesWriter::mergeTypeRoles([
            'styles' => [
                'elements' => [
                    'h2' => ['color' => ['text' => '#abcdef']], // unrelated sibling — must survive
                ],
            ],
        ], [
            'h1' => ['fontWeight' => '800', 'fontFamily' => 'sans'],   // slug → preset var
            'body' => ['fontSize' => '17px'],
            'caption' => ['letterSpacing' => '0.04em'],
            'lead' => ['fontSize' => '1.4rem'],                        // custom → settings
            'code' => ['fontFamily' => 'Fira Code, monospace'],
        ]);

        // Native roles land in styles.* with family slug resolved to a preset var.
        $this->assertSame('800', $data['styles']['elements']['h1']['typography']['fontWeight']);
        $this->assertSame('var(--wp--preset--font-family--sans)', $data['styles']['elements']['h1']['typography']['fontFamily']);
        $this->assertSame('17px', $data['styles']['typography']['fontSize']);
        $this->assertSame('0.04em', $data['styles']['elements']['caption']['typography']['letterSpacing']);

        // Unrelated sibling preserved (no clobber).
        $this->assertSame('#abcdef', $data['styles']['elements']['h2']['color']['text']);

        // Custom roles land in settings.custom.blicks.typeRoles.* with kebab props.
        $this->assertSame('1.4rem', $data['settings']['custom']['blicks']['typeRoles']['lead']['font-size']);
        $this->assertSame('Fira Code, monospace', $data['settings']['custom']['blicks']['typeRoles']['code']['font-family']);

        // Round-trip: projection reads exactly what the writer wrote.
        $projected = TypeRoleProjection::fromStylesAndSettings($data['styles'], $data['settings']);
        $this->assertSame('800', $projected['h1']['fontWeight']);
        $this->assertSame('var(--wp--preset--font-family--sans)', $projected['h1']['fontFamily']);
        $this->assertSame('17px', $projected['body']['fontSize']);
        $this->assertSame('1.4rem', $projected['lead']['fontSize']);
        $this->assertSame('Fira Code, monospace', $projected['code']['fontFamily']);
        // Untouched prop still resolves to the role default.
        $this->assertSame(TypeRoles::DEFAULTS['h1']['lineHeight'], $projected['h1']['lineHeight']);
    }
}
