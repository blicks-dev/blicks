<?php
/**
 * Raised when a spec names a block this side cannot write.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A block the serializer will not guess at.
 *
 * Deliberately an exception rather than a skipped block or a best-effort element. Dropping the
 * block silently loses the author's content; approximating it corrupts the post. Stopping is the
 * only outcome that leaves the page exactly as it was, and a caller can turn this into a message
 * naming the block, which is something a model can act on.
 */
final class UnsupportedBlock extends \RuntimeException {

	public function __construct( public readonly string $blockName ) {
		// The message is escaped here, at the point it is built, rather than at each `throw`.
		// It can reach a client, and escaping it once where it is composed means no call site has
		// to remember to. `$blockName` itself stays raw: it is compared against block names in
		// code, and an escaped identifier would quietly stop matching.
		parent::__construct(
			sprintf(
				'%s cannot be written from a spec yet — it embeds generated markup (icon paths or an SVG filter) that only the editor can produce. Build the layout without it, or apply this change in the editor.',
				esc_html( $blockName )
			)
		);
	}
}
