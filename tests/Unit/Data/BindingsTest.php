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

        // Core's tag processor leaves the space the attribute stood after; it is render-time only.
        $this->assertSame('<a class="bl-button" ><span class="bl-button__label">View</span></a>', $out['innerContent'][0]);
    }

    public function testWritesAnImagesAddressAndAltAndDropsTheTemplatesSources(): void
    {
        $html = '<figure class="bl-image"><img src="https://site.test/a.jpg" srcset="https://site.test/a-300.jpg 300w" sizes="100vw" alt="Template" style="aspect-ratio:4 / 3"/></figure>';
        $block = self::leaf('blicks/image', [], $html, self::bind('url', 'image') + self::bind('alt', 'title'));

        [$out] = self::apply([$block], ['image' => 'https://cdn.example/p/lamp.jpg', 'title' => 'Arc "floor" lamp']);

        $this->assertSame('<figure class="bl-image"><img src="https://cdn.example/p/lamp.jpg"   alt="Arc &quot;floor&quot; lamp" style="aspect-ratio:4 / 3"/></figure>', $out['innerContent'][0]);
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

    /**
     * Every attribute name in the markup, tag by tag, as a browser's tokenizer would read them.
     *
     * @return list<string>
     */
    private static function attributeNames(string $html): array
    {
        $names = [];
        $tags = new \WP_HTML_Tag_Processor($html);

        while ($tags->next_tag()) {
            $names[] = '<' . strtolower((string) $tags->get_tag());
            foreach ($tags->get_attribute_names_with_prefix('') ?? [] as $name) {
                $names[] = $name;
            }
        }

        return $names;
    }

    /** One attribute of the first tag matching a selector, decoded; null when it is absent. */
    private static function attribute(string $html, string $tag, string $name): ?string
    {
        $tags = new \WP_HTML_Tag_Processor($html);
        if (!$tags->next_tag($tag)) {
            return null;
        }
        $value = $tags->get_attribute($name);

        return is_string($value) ? $value : (true === $value ? '' : null);
    }

    /**
     * Templates in which the bound attribute's name is also a word inside an earlier attribute's
     * value: [block, template, bound attr, item key, target tag, target attribute, decoy attribute, decoy value].
     */
    public static function boundaryTemplates(): array
    {
        $label = '<span class="bl-button__label">Go</span>';

        return [
            'class names href' => ['blicks/button', '<a class="x href y" href="https://ok.example/">' . $label . '</a>', 'url', 'a', 'a', 'href', 'class', 'x href y'],
            'title names href' => ['blicks/button', '<a title="go href now" class="bl-button" href="https://ok.example/">' . $label . '</a>', 'url', 'a', 'a', 'href', 'title', 'go href now'],
            'class names alt' => ['blicks/image', '<figure class="bl-image"><img class="pic alt z" src="https://ok.example/a.png" alt=""/></figure>', 'alt', 'img', 'img', 'alt', 'class', 'pic alt z'],
            'data names src' => ['blicks/image', '<figure class="bl-image"><img data-x="src" src="https://ok.example/a.png" alt=""/></figure>', 'url', 'img', 'img', 'src', 'data-x', 'src'],
        ];
    }

    public static function boundaryPayloads(): array
    {
        return [
            'slashes split a url' => ['https://x/onmouseover=alert(1)//'],
            'spaces split a value' => ['x onerror=alert(1) y'],
            'quote and close the tag' => ['"><svg onload=alert(1)>'],
        ];
    }

    public static function boundaryCases(): iterable
    {
        foreach (self::boundaryTemplates() as $t => $template) {
            foreach (self::boundaryPayloads() as $p => $payload) {
                yield "$t, $p" => [...$template, $payload[0]];
            }
        }
    }

    /**
     * Finding #1 of the 2026-11-11 Loop audit: a bound value written into the attribute whose
     * name appeared inside `class` closed that value early and became an event handler.
     *
     * @dataProvider boundaryCases
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('boundaryCases')]
    public function testABoundValueStaysInsideItsOwnAttribute(string $name, string $html, string $attr, string $key, string $tag, string $target, string $decoy, string $decoyValue, string $payload): void
    {
        $block = self::leaf($name, [], $html, self::bind($attr, $key));
        $out = self::apply([$block], [$key => $payload]);
        $kind = self::specs($name)[$attr]['kind'] ?? 'text';
        $expected = 'text' === $kind ? $payload : \Blicks\Data\Formatter::safeUrl($payload);

        if ([] === $out) {
            $this->assertSame('image', $kind, 'only an image with no picture is dropped');
            $this->assertSame('', $expected);
            return;
        }

        $written = $out[0]['innerContent'][0];
        $names = self::attributeNames($written);

        foreach ($names as $found) {
            $this->assertStringStartsNotWith('on', $found, "event handler in: $written");
        }
        $this->assertNotContains('<svg', $names, "new element in: $written");
        $this->assertSame($decoyValue, self::attribute($written, $tag, $decoy), "decoy attribute changed in: $written");
        $this->assertSame('' === $expected ? null : $expected, self::attribute($written, $tag, $target));
    }

    public static function quotingVariants(): array
    {
        $label = '<span class="bl-button__label">Go</span>';

        return [
            'single-quoted' => ['blicks/button', "<a class=\"bl-button\" href='https://old.example/'>$label</a>", 'url', 'a', 'href'],
            'unquoted' => ['blicks/button', "<a class=\"bl-button\" href=https://old.example/>$label</a>", 'url', 'a', 'href'],
            'valueless' => ['blicks/image', '<figure class="bl-image"><img alt src="https://ok.example/a.png"/></figure>', 'alt', 'img', 'alt'],
            'upper-case name' => ['blicks/image', '<figure class="bl-image"><img ALT="old" src="https://ok.example/a.png"/></figure>', 'alt', 'img', 'alt'],
        ];
    }

    /**
     * However the template wrote the attribute, the bound value replaces it; a second copy would
     * be ignored by the browser, which keeps the first.
     *
     * @dataProvider quotingVariants
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('quotingVariants')]
    public function testReplacesAnAttributeHoweverItIsQuoted(string $name, string $html, string $attr, string $tag, string $target): void
    {
        // Neither value contains the attribute's name, so a raw count below is exact.
        $value = 'href' === $target ? 'https://new.example/p' : 'Fresh text';

        [$out] = self::apply([self::leaf($name, [], $html, self::bind($attr, 'v'))], ['v' => $value]);
        $written = $out['innerContent'][0];

        $this->assertSame($value, self::attribute($written, $tag, $target));
        $this->assertSame(1, preg_match_all('/\s' . $target . '(?=[\s=\/>])/i', $written), "duplicated in: $written");
    }

    /** A `>` inside a quoted value does not end the tag for the writer either. */
    public function testAQuotedGreaterThanDoesNotEndTheTag(): void
    {
        $html = '<a title="a > b" class="bl-button" href="https://ok.example/"><span class="bl-button__label">Go</span></a>';

        [$out] = self::apply([self::leaf('blicks/button', [], $html, self::bind('url', 'u'))], ['u' => 'https://x/onmouseover=alert(1)//']);
        $written = $out['innerContent'][0];

        $this->assertSame('a > b', self::attribute($written, 'a', 'title'));
        $this->assertSame('https://x/onmouseover=alert(1)//', self::attribute($written, 'a', 'href'));
        $this->assertSame(['<a', 'title', 'class', 'href', '<span', 'class'], self::attributeNames($written));
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
