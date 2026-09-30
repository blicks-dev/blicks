import { __ } from '@wordpress/i18n';

/**
 * The shortcut reference.
 *
 * Every shortcut listed here already worked — nudge, duplicate, zoom, step-back Escape — and none
 * of them was written down anywhere. That is the gap this closes: the fast path existed only for
 * whoever had read the source.
 *
 * It is a dismissible PANEL, not a modal. A modal would darken and block the stage the shortcuts
 * are about, so an author could not try one while reading it. This sits in a corner, leaves the
 * composition live, and closes on Escape or a click outside.
 */

/** `⌘` reads as nonsense on Windows and Linux, where the same handlers fire on Ctrl. */
const META = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test( navigator.platform ?? '' )
	? '⌘'
	: 'Ctrl';

interface Group {
	title: string;
	rows: [ string[], string ][];
}

function groups(): Group[] {
	return [
		{
			title: __( 'Placing', 'blicks' ),
			rows: [
				[ [ '↑', '↓', '←', '→' ], __( 'Nudge by one design pixel', 'blicks' ) ],
				[ [ 'Shift', '↑↓←→' ], __( 'Nudge by ten', 'blicks' ) ],
				[ [ META, 'D' ], __( 'Duplicate in place', 'blicks' ) ],
				[ [ 'Delete' ], __( 'Remove what is selected', 'blicks' ) ],
			],
		},
		{
			title: __( 'Moving around', 'blicks' ),
			rows: [
				[ [ __( 'Scroll', 'blicks' ) ], __( 'Pan the canvas', 'blicks' ) ],
				[ [ 'Space', __( 'drag', 'blicks' ) ], __( 'Pan from anywhere, including over the stage', 'blicks' ) ],
				[ [ __( 'Middle-drag', 'blicks' ) ], __( 'Pan without the modifier', 'blicks' ) ],
				[ [ META, __( 'scroll', 'blicks' ) ], __( 'Zoom where the pointer is', 'blicks' ) ],
			],
		},
		{
			title: __( 'Looking', 'blicks' ),
			rows: [
				[ [ META, '+' ], __( 'Zoom in', 'blicks' ) ],
				[ [ META, '−' ], __( 'Zoom out', 'blicks' ) ],
				[ [ META, '0' ], __( 'Actual size', 'blicks' ) ],
				[ [ __( 'Click %', 'blicks' ) ], __( 'Fit the stage and centre it', 'blicks' ) ],
				[ [ META, '\\' ], __( 'Hide both panels, and bring them back', 'blicks' ) ],
			],
		},
		{
			title: __( 'Selecting', 'blicks' ),
			rows: [
				[ [ __( 'Click', 'blicks' ) ], __( 'Selects the box first, then what is inside it', 'blicks' ) ],
				[ [ __( 'Drag', 'blicks' ) ], __( 'Marquee-select across the stage', 'blicks' ) ],
				[ [ __( 'Double-click', 'blicks' ) ], __( 'Rename a layer', 'blicks' ) ],
			],
		},
		{
			title: __( 'Leaving', 'blicks' ),
			rows: [
				[ [ 'Esc' ], __( 'Stops the preview, then closes the editor', 'blicks' ) ],
				[ [ '?' ], __( 'This list', 'blicks' ) ],
			],
		},
	];
}

export function SceneShortcuts( { onClose }: { onClose: () => void } ) {
	return (
		<div
			className="bl-scene-shortcuts"
			role="dialog"
			aria-label={ __( 'Keyboard shortcuts', 'blicks' ) }
		>
			<div className="bl-scene-shortcuts__head">
				<span>{ __( 'Shortcuts', 'blicks' ) }</span>
				<button type="button" onClick={ onClose } aria-label={ __( 'Close', 'blicks' ) }>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
				</button>
			</div>

			<div className="bl-scene-shortcuts__body">
				{ groups().map( ( group ) => (
					<section key={ group.title }>
						<h3>{ group.title }</h3>
						<dl>
							{ group.rows.map( ( [ keys, label ] ) => (
								<div key={ label }>
									<dt>
										{ keys.map( ( key ) => (
											<kbd key={ key }>{ key }</kbd>
										) ) }
									</dt>
									<dd>{ label }</dd>
								</div>
							) ) }
						</dl>
					</section>
				) ) }
			</div>
		</div>
	);
}
