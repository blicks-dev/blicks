/**
 * Flow: the mounted tree in document order, at a chosen width.
 *
 * Everything that makes block editing feel like block editing — typing, arrow keys crossing block
 * boundaries, `RichText`, the insertion point, multi-select — lives in `WritingFlow`,
 * `ObserveTyping` and `BlockTools`. Hand-rolling flow editing means reimplementing all of it badly,
 * so this is a thin frame around core's own components, mounted inside the Studio's provider so
 * they operate on the detached tree.
 *
 * **Width is not zoom, and the difference is the point.** Width changes what the tree is laid out
 * at, so the composition really reflows — that is how you check a design at phone width while
 * building it. Zoom belongs to the world this is drawn in and scales what is already laid out.
 * Conflating them gives a preview that lies.
 *
 * A mode draws a sheet and nothing else. The world around it — pan, zoom, fit — is the shell's, so
 * the two modes cannot disagree about where the origin is, and Stage can arrive without the canvas
 * being rebuilt around it.
 */

import { BlockList, BlockTools, ObserveTyping, WritingFlow } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

export type WidthId = 'desktop' | 'tablet' | 'phone';

/** The widths worth checking, in the order a person moves through them. */
export const WIDTHS: { id: WidthId; label: string; px: number }[] = [
	{ id: 'desktop', label: __( 'Desktop', 'blicks' ), px: 1200 },
	{ id: 'tablet', label: __( 'Tablet', 'blicks' ), px: 782 },
	{ id: 'phone', label: __( 'Phone', 'blicks' ), px: 390 },
];

export function FlowMode( { width }: { width: WidthId } ): JSX.Element {
	const px = WIDTHS.find( ( w ) => w.id === width )?.px ?? 1200;

	return (
		<div className="bl-studio__sheet" style={ { width: `${ px }px` } }>
			<BlockTools>
				<WritingFlow>
					<ObserveTyping>
						<BlockList />
					</ObserveTyping>
				</WritingFlow>
			</BlockTools>
		</div>
	);
}
