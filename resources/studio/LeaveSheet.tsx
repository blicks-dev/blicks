/**
 * Leaving with work in it.
 *
 * **Nothing was written, so there is nothing to "save"** — and offering a Save button here would be
 * inventing a fourth door that does not exist. The sheet offers the three that do, plus the one
 * honest way out, and says plainly what discarding costs.
 *
 * It appears only when there is something to lose. A Studio opened and closed without an edit
 * should close, not negotiate: a confirmation people meet when they have changed nothing is a
 * confirmation they learn to dismiss without reading, which is how the one that mattered gets
 * dismissed too.
 *
 * Escape and a press on the scrim mean "keep working" (`use-sheet.ts`), never discard: the only way
 * to lose the work is the button that says so. Focus starts on "Keep working" for the same reason.
 */

import { useId } from '@wordpress/element';
import { __, sprintf, _n } from '@wordpress/i18n';
import { useSheet } from './use-sheet';

interface Props {
	/** What is mounted, for the sentence. Empty for a blank canvas. */
	label: string;
	/** How many steps of work would be lost. */
	steps: number;
	onInsert: () => void;
	/**
	 * The filled door, for a mode that saves somewhere other than the post (`StudioMode.persist`):
	 * its label ("Save header") replaces Insert. Since Studio API 3.
	 */
	door?: string;
	onSave: () => void;
	onCopy: () => void;
	onDiscard: () => void;
	onCancel: () => void;
}

export function LeaveSheet( {
	label,
	steps,
	onInsert,
	door,
	onSave,
	onCopy,
	onDiscard,
	onCancel,
}: Props ): JSX.Element {
	const { sheet, first, scrim } = useSheet< HTMLButtonElement >( onCancel );
	const id = useId();

	return (
		<div className="bl-studio-scrim" { ...scrim }>
			<div
				ref={ sheet }
				className="bl-studio-sheet bl-studio-sheet--narrow"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={ `${ id }-title` }
				aria-describedby={ `${ id }-lead` }
			>
				<span id={ `${ id }-title` } className="bl-studio-sheet__title">
					{ __( 'Leave the Studio', 'blicks' ) }
				</span>

				<p id={ `${ id }-lead` } className="bl-studio-sheet__lead">
					{ sprintf(
						/* translators: 1: how many edits. 2: what is mounted, or "this canvas". */
						_n(
							'%1$d edit to %2$s. Closing discards it — nothing has been written yet.',
							'%1$d edits to %2$s. Closing discards them — nothing has been written yet.',
							steps,
							'blicks'
						),
						steps,
						'' !== label ? label : __( 'this canvas', 'blicks' )
					) }
				</p>

				<div className="bl-studio-sheet__ways">
					<button type="button" className="bl-studio-sheet__way" onClick={ onInsert }>
						<span className="bl-studio-sheet__wayname">
							{ door ?? __( 'Insert into the post', 'blicks' ) }
						</span>
						<span className="bl-studio-sheet__waynote">
							{ door ? __( 'Writes it back to where it is kept.', 'blicks' ) : __( 'The only door that writes to the page.', 'blicks' ) }
						</span>
					</button>

					<button type="button" className="bl-studio-sheet__way" onClick={ onSave }>
						<span className="bl-studio-sheet__wayname">
							{ __( 'Save as a pattern', 'blicks' ) }
						</span>
						<span className="bl-studio-sheet__waynote">
							{ __( 'Keeps it on this site, and keeps you here.', 'blicks' ) }
						</span>
					</button>

					<button type="button" className="bl-studio-sheet__way" onClick={ onCopy }>
						<span className="bl-studio-sheet__wayname">
							{ __( 'Copy the JSON out', 'blicks' ) }
						</span>
						<span className="bl-studio-sheet__waynote">
							{ __( 'Onto the clipboard, changing nothing.', 'blicks' ) }
						</span>
					</button>
				</div>

				<div className="bl-studio-sheet__actions">
					<button ref={ first } type="button" className="bl-studio__btn" onClick={ onCancel }>
						{ __( 'Keep working', 'blicks' ) }
					</button>
					<button type="button" className="bl-studio-sheet__discard" onClick={ onDiscard }>
						{ __( 'Discard and close', 'blicks' ) }
					</button>
				</div>
			</div>
		</div>
	);
}
