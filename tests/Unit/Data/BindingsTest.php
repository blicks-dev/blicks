<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\Bindings;
use Blicks\Data\Markup;
use PHPUnit\Framework\TestCase;

/**
 * Bound values are written into each block's saved markup, as text or a safe address. These run
 * against markup in the shape Blicks blocks actually save (resources/blocks/__golden__).
 */
final class BindingsTest extends TestCase
{
    /** The `bindable` specs from block.json, as LoopRenderer::bindable() reads them. */
    public static function specs(string $name): array
    {
        $file = dirname(__DIR__, 3) . '/resources/blocks/' . substr($name, 7) . '/block.json';
        $json = is_file($file) ? json_decode((string) file_get_contents($file), true) : [];
        $out = [];

        foreach ($json['attributes'] ?? [] as $attr => $def) {
            if (isset($def['bindable'])) {
                $out[$attr] = $def['bindable'];
            }
        }

        return $out;
    }

    private static function bind(string $attr, string $key, array $more = []): array
    {
        return [$attr => ['source' => 'blicks/item', 'args' => ['key' => $key] + $more]];
    }

    private static function leaf(string $name, array $attrs, string $html, array $bindings): array
    {
        return [
            'blockName' => $name,
            'attrs' => $attrs + ['metadata' => ['bindings' => $bindings]],
            'innerBlocks' => [],
            'innerHTML' => $html,
            'innerContent' => [$html],
        ];
    }

    private static function apply(array $blocks, array $item, array $hide = []): array
    {
        return Bindings::apply($blocks, $item, [self::class, 'specs'], $hide);
    }

    public function testWritesAHeadingsText(): void
    {
        $block = self::leaf('blicks/heading', ['uniqueId' => 'h1'], '<h2 class="bl-heading bl-h1">Item title</h2>', self::bind('content', 'title'));

        [$out] = self::apply([$block], ['title' => 'Arc floor lamp']);

        $this->assertSame('<h2 class="bl-heading bl-h1">Arc floor lamp</h2>', $out['innerContent'][0]);
        $this->assertSame('Arc floor lamp', $out['attrs']['content']);
        $this->assertSame($out['innerContent'][0], $out['innerHTML']);
    }

    public function testWritesDataAsTextNeverMarkup(): void
    {
        $block = self::leaf('blicks/text', [], '<p class="bl-text">x</p>', self::bind('content', 'title'));

        [$out] = self::apply([$block], ['title' => '<img src=x onerror=alert(1)> & "quotes"']);

        $this->assertSame('<p class="bl-text">&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;</p>', $out['innerContent'][0]);
    }

    public function testReplacesFormattedTemplateTextWhole(): void
    {
        $block = self::leaf('blicks/text', [], '<p class="bl-text">Some <strong>bold <em>nested</em></strong> text</p>', self::bind('content', 'd'));

        [$out] = self::apply([$block], ['d' => 'Plain']);

        $this->assertSame('<p class="bl-text">Plain</p>', $out['innerContent'][0]);
    }

    public function testWritesAButtonsLabelAndLinkWithoutTouchingItsIcon(): void
    {
        $html = '<a class="bl-button bl-b1 bl-button--default" href="#"><span class="bl-button__label">View</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg></a>';
        $block = self::leaf('blicks/button', [], $html, self::bind('text', 'cta') + self::bind('url', 'url'));

        [$out] = self::apply([$block], ['cta' => 'Buy now', 'url' => 'https://shop.example/oak?ref=a&b=1']);

        $this->assertSame(
            '<a class="bl-button bl-b1 bl-button--default" href="https://shop.example/oak?ref=a&amp;b=1"><span class="bl-button__label">Buy now</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg></a>',
            $out['innerContent'][0]
        );
    }

    public function testDropsAnUnsafeLinkToTheFallback(): void
    {
        $html = '<a class="bl-button" href="#"><span class="bl-button__label">View</span></a>';
        $block = self::leaf('blicks/button', [], $html, self::bind('url', 'url', ['fallback' => '/shop']));

        [$out] = self::apply([$block], ['url' => 'javascript:alert(1)']);

        $this->assertStringContainsString('href="/shop"', $out['innerContent'][0]);
        $this->assertStringNotContainsString('javascript', $out['innerContent'][0]);
    }

    public function testAnEmptyLinkRemovesTheHref(): void
    {
        $block = self::leaf('blicks/button', [], '<a class="bl-button" href="#"><span class="bl-button__label">View</span></a>', self::bind('url', 'url'));

        [$out] = self::apply([$block], ['url' => '']);

        $this->assertSame('<a class="bl-button"><span class="bl-button__label">View</span></a>', $out['innerContent'][0]);
    }

    public function testWritesAnImagesAddressAndAltAndDropsTheTemplatesSources(): void
    {
        $html = '<figure class="bl-image"><img src="https://site.test/a.jpg" srcset="https://site.test/a-300.jpg 300w" sizes="100vw" alt="Template" style="aspect-ratio:4 / 3"/></figure>';
        $block = self::leaf('blicks/image', [], $html, self::bind('url', 'image') + self::bind('alt', 'title'));

        [$out] = self::apply([$block], ['image' => 'https://cdn.example/p/lamp.jpg', 'title' => 'Arc "floor" lamp']);

        $this->assertSame('<figure class="bl-image"><img src="https://cdn.example/p/lamp.jpg" alt="Arc &quot;floor&quot; lamp" style="aspect-ratio:4 / 3"/></figure>', $out['innerContent'][0]);
    }

    public function testDropsAnImageWithNoPicture(): void
    {
        $block = self::leaf('blicks/image', [], '<figure class="bl-image"><img src="a.jpg" alt=""/></figure>', self::bind('url', 'image'));

        $this->assertSame([], self::apply([$block], ['image' => '']));
        $this->assertSame([], self::apply([$block], ['image' => 'data:image/png;base64,AAAA']));
    }

    public function testBindsABoxsTextOnlyWhenItIsABadge(): void
    {
        $badge = self::leaf('blicks/box', ['kind' => 'badge'], '<span class="bl-box bl-box--badge">New</span>', self::bind('text', 'cat'));
        $card = self::leaf('blicks/box', ['kind' => 'card'], '<article class="bl-box">Inner</article>', self::bind('text', 'cat'));

        [$a, $b] = self::apply([$badge, $card], ['cat' => 'Lighting']);

        $this->assertSame('<span class="bl-box bl-box--badge">Lighting</span>', $a['innerContent'][0]);
        $this->assertSame('<article class="bl-box">Inner</article>', $b['innerContent'][0], 'a card’s children are never wiped');
    }

    public function testIgnoresBindingsFromOtherSourcesAndUnbindableAttributes(): void
    {
        $block = self::leaf('blicks/heading', [], '<h2 class="bl-heading">Keep</h2>', [
            'content' => ['source' => 'core/post-meta', 'args' => ['key' => 'title']],
            'level' => ['source' => 'blicks/item', 'args' => ['key' => 'title']],
        ]);

        [$out] = self::apply([$block], ['title' => 'Nope']);

        $this->assertSame('<h2 class="bl-heading">Keep</h2>', $out['innerContent'][0]);
    }

    public function testBindsInsideNestedBlocksAndRemovesHiddenOnes(): void
    {
        $title = self::leaf('blicks/heading', ['uniqueId' => 't'], '<h3 class="bl-heading">T</h3>', self::bind('content', 'title'));
        $price = self::leaf('blicks/text', ['uniqueId' => 'p'], '<p class="bl-text">$0</p>', self::bind('content', 'price', ['format' => 'currency']));
        $button = self::leaf('blicks/button', ['uniqueId' => 'b'], '<a class="bl-button" href="#"><span class="bl-button__label">View</span></a>', []);
        $card = [
            'blockName' => 'blicks/box',
            'attrs' => ['uniqueId' => 'c', 'kind' => 'card'],
            'innerBlocks' => [$title, $price, $button],
            'innerHTML' => '<article class="bl-box"></article>',
            'innerContent' => ['<article class="bl-box">', null, "\n", null, "\n", null, '</article>'],
        ];

        [$out] = self::apply([$card], ['title' => 'Oak table', 'price' => 240], ['p']);

        $this->assertSame(['t', 'b'], array_map(fn ($b) => $b['attrs']['uniqueId'], $out['innerBlocks']));
        $this->assertSame(['<article class="bl-box">', null, "\n", "\n", null, '</article>'], $out['innerContent']);
        $this->assertSame('<h3 class="bl-heading">Oak table</h3>', $out['innerBlocks'][0]['innerContent'][0]);
    }

    public function testAListItemWithANestedListKeepsItsChildren(): void
    {
        $nested = self::leaf('blicks/list', [], '<ul class="bl-list"></ul>', []);
        $item = [
            'blockName' => 'blicks/list-item',
            'attrs' => ['metadata' => ['bindings' => self::bind('content', 'name')]],
            'innerBlocks' => [$nested],
            'innerHTML' => '<li class="bl-list-item">Old</li>',
            'innerContent' => ['<li class="bl-list-item">Old', null, '</li>'],
        ];

        [$out] = self::apply([$item], ['name' => 'New']);

        $this->assertSame(['<li class="bl-list-item">New', null, '</li>'], $out['innerContent']);
    }

    public function testATemplateWithoutBindingsComesBackUnchanged(): void
    {
        $block = self::leaf('blicks/heading', ['uniqueId' => 'x'], '<h2 class="bl-heading">Same</h2>', []);
        $block['attrs'] = ['uniqueId' => 'x'];

        $this->assertSame([$block], self::apply([$block], ['title' => 'ignored']));
    }

    public function testMarkupFindsByClassAndCountsNestedTags(): void
    {
        $html = '<div class="a"><div class="b"><span class="label x">L</span></div><div>after</div></div>';

        $found = Markup::find($html, 'span.label');
        $this->assertSame('span', $found['tag']);
        $this->assertSame('<div class="a">NEW</div>', Markup::replaceInner($html, Markup::find($html, ':root'), 'NEW'));
        $this->assertNull(Markup::find($html, 'span.missing'));
    }

    public function testMarkupRefusesEventHandlerAttributes(): void
    {
        $html = '<a href="#">x</a>';

        $this->assertSame($html, Markup::setAttribute($html, Markup::find($html, 'a'), 'onclick', 'alert(1)'));
    }
}
