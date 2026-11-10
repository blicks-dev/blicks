/**
 * What the keyboard does here.
 *
 * Grouped by where a key applies rather than by what it does, because the question people arrive
 * with is "what can I do on this canvas", not "where is undo". A flat alphabetical list answers the
 * second question and neither of the useful ones.
 *
 * Only keys the Studio actually claims. A reference that lists shortcuts the surface does not
 * handle is worse than none: it is a promise, and the first one that does nothing is the reason
 * nobody opens it again.
 */

import { useId } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useSheet } from './use-sheet';

interface Group {
	title: string;
	keys: { combo: string; does: string }[];
}

/**
 * Written with the Mac glyphs, which is what the development and design of this surface assumed.
 * Both modifiers are accepted at the keyboard — see `keys.ts` — so a Control user's presses work;
 * what they do not get yet is a label that matches their keyboard. Worth fixing when the first
 * person on Windows uses it, and not worth guessing at before.
 */
const GROUPS: Group[] = [
	{
		title: __( 'Anywhere', 'blicks' ),
		keys: [
			{ combo: '⌘Z', does: __( 'Undo', 'blicks' ) },
			{ combo: '⇧⌘Z', does: __( 'Redo', 'blicks' ) },
			{ combo: '⌘↵', does: __( 'Insert into the post', 'blicks' ) },
			{ combo: 'esc', does: __( 'Up a level, then leave', 'blicks' ) },
			{ combo: '⌥⌘,', does: __( 'Cycle the width', 'blicks' ) },
			{ combo: '⌥⌘[', does: __( 'Show or hide Mounted', 'blicks' ) },
			{ combo: '⌥⌘]', does: __( 'Show or hide the inspector', 'blicks' ) },
		],
	},
	{
		title: __( 'On a stage', 'blicks' ),
		keys: [
			{ combo: '↑ ↓ ← →', does: __( 'Nudge one design pixel', 'blicks' ) },
			{ combo: '⇧ + arrows', does: __( 'Nudge ten', 'blicks' ) },
			{ combo: '↵', does: __( 'Drill into the selection', 'blicks' ) },
			{ combo: __( 'drag the stage', 'blicks' ), does: __( 'Sweep a new box', 'blicks' ) },
		],
	},
	{
		title: __( 'The canvas', 'blicks' ),
		keys: [
			{ combo: __( 'drag', 'blicks' ), does: __( 'Move the world', 'blicks' ) },
			{ combo: __( 'wheel', 'blicks' ), does: __( 'Pan', 'blicks' ) },
			{ combo: __( '⌘ + wheel', 'blicks' ), does: __( 'Zoom about the pointer', 'blicks' ) },
		],
	},
];

export function KeysSheet( { onClose }: { onClose: () => void } ): JSX.Element {
	const { sheet, first, scrim } = useSheet< HTMLButtonElement >( onClose );
	const id = useId();

	return (
		<div className="bl-studio-scrim" { ...scrim }>
			<div
				ref={ sheet }
				className="bl-studio-sheet"
				role="dialog"
				aria-modal="true"
				aria-labelledby={ id }
			>
				<span id={ id } className="bl-studio-sheet__title">
					{ __( 'Keyboard shortcuts', 'blicks' ) }
				</span>

				<div className="bl-keys">
					{ GROUPS.map( ( group ) => (
						<div key={ group.title } className="bl-keys__group">
							<p className="bl-keys__title">{ group.title }</p>
							{ group.keys.map( ( key ) => (
								<p key={ key.combo } className="bl-keys__row">
									<span className="bl-keys__combo">{ key.combo }</span>
									<span className="bl-keys__does">{ key.does }</span>
								</p>
							) ) }
						</div>
					) ) }
				</div>

				<div className="bl-studio-sheet__actions">
					<button ref={ first } type="button" className="bl-studio__btn" onClick={ onClose }>
						{ __( 'Close', 'blicks' ) }
					</button>
				</div>
			</div>
		</div>
	);
}
