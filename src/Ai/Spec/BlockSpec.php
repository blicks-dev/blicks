<?php
/**
 * A block tree in the shape a caller describes rather than the shape WordPress stores.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One block and its children, as data.
 *
 * This is deliberately not block markup. Something generating a layout should describe what it
 * wants — a stack, centred, holding a heading and two buttons — and have the plugin decide how
 * that is written down. Markup is a serialisation detail, and one that breaks a user's post when
 * it is a character wrong; the spec is the thing worth exchanging over an API.
 *
 * `blicks` is kept beside `attributes` rather than inside it even though WordPress stores it as
 * an attribute like any other. The style tree is the part a caller gets wrong, the part the
 * validator has real rules about, and the part worth seeing at a glance — burying it among
 * `tag`, `level` and `content` hides all three. {@see self::fromArray()} accepts it in either
 * position and normalises, so a caller that writes it the WordPress way is not punished for it.
 */
final class BlockSpec {

	/**
	 * @param string               $name        Fully qualified block name, e.g. `blicks/box`.
	 * @param array<string, mixed> $attributes  Semantic attributes, without `blicks`.
	 * @param array<string, mixed> $blicks      The style tree: control id → state → breakpoint.
	 * @param list<BlockSpec>      $innerBlocks Children, in order.
	 * @param string|null          $markup      A block this plugin does not own, as stored markup.
	 */
	public function __construct(
		public readonly string $name,
		public readonly array $attributes = [],
		public readonly array $blicks = [],
		public readonly array $innerBlocks = [],
		public readonly ?string $markup = null
	) {
	}

	/**
	 * Is this a block carried as stored markup rather than described?
	 *
	 * A page is usually a mix of Blicks and core blocks. Only Blicks blocks can be rebuilt from a
	 * spec, so every other block is read as its stored markup and written back verbatim — which is
	 * what lets an agent change one Blicks section of a page without dropping the paragraph above it.
	 */
	public function isOpaque(): bool {
		return null !== $this->markup;
	}

	/**
	 * Build a spec from a decoded JSON payload, accepting the shapes a caller is likely to send.
	 *
	 * Lenient about shape, silent about nothing: anything structurally impossible to represent
	 * becomes an empty default here, and {@see SpecValidator} is what reports it. Splitting it
	 * that way means a malformed payload produces a list of errors naming every problem, instead
	 * of a type error naming the first.
	 *
	 * @param array<string, mixed> $data
	 */
	public static function fromArray( array $data ): self {
		$attributes = is_array( $data['attributes'] ?? null ) ? $data['attributes'] : [];

		// `blicks` is accepted at the top level or among the attributes, and the top level wins
		// when a caller somehow sends both.
		$blicks = $data['blicks'] ?? ( $attributes['blicks'] ?? [] );
		unset( $attributes['blicks'] );

		$inner = [];
		foreach ( (array) ( $data['innerBlocks'] ?? [] ) as $child ) {
			if ( is_array( $child ) ) {
				$inner[] = self::fromArray( $child );
			}
		}

		return new self(
			(string) ( $data['name'] ?? '' ),
			$attributes,
			// Shadows written as CSS become the layers the editor saves — see ShadowText.
			is_array( $blicks ) ? ShadowText::normalize( $blicks ) : [],
			$inner,
			is_string( $data['markup'] ?? null ) ? $data['markup'] : null
		);
	}

	/**
	 * The spec as a plain array, in the same shape {@see self::fromArray()} accepts.
	 *
	 * Empty members are omitted rather than sent as empty arrays. A block with no styling and no
	 * children should read as `{"name":"blicks/heading"}`, not carry three empty containers — this
	 * is a format an LLM both reads and writes, and every token of structural noise is one it
	 * pays for and may imitate.
	 *
	 * @return array<string, mixed>
	 */
	public function toArray(): array {
		$out = [ 'name' => $this->name ];

		if ( null !== $this->markup ) {
			$out['markup'] = $this->markup;

			return $out;
		}

		if ( [] !== $this->attributes ) {
			$out['attributes'] = $this->attributes;
		}

		if ( [] !== $this->blicks ) {
			$out['blicks'] = $this->blicks;
		}

		if ( [] !== $this->innerBlocks ) {
			$out['innerBlocks'] = array_map(
				static fn ( self $child ): array => $child->toArray(),
				$this->innerBlocks
			);
		}

		return $out;
	}

	/**
	 * The attributes as WordPress stores them — `blicks` folded back in.
	 *
	 * @return array<string, mixed>
	 */
	public function wpAttributes(): array {
		$attributes = $this->attributes;

		if ( [] !== $this->blicks ) {
			$attributes['blicks'] = $this->blicks;
		}

		return $attributes;
	}

	/**
	 * This block and every descendant, depth first, parents before children.
	 *
	 * @return list<BlockSpec>
	 */
	public function walk(): array {
		if ( null !== $this->markup ) {
			return [ $this ];
		}

		$all = [ $this ];

		foreach ( $this->innerBlocks as $child ) {
			$all = array_merge( $all, $child->walk() );
		}

		return $all;
	}
}
