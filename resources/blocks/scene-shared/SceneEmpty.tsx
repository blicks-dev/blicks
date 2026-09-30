import { __ } from '@wordpress/i18n';

interface Props {
	onAddBox: () => void;
}

/**
 * What a brand-new Scene says for itself.
 *
 * An empty stage is the one screen where the author has no idea what the thing in front of them
 * wants. The grid alone does not explain that items cannot be dropped straight onto it — that a
 * BOX claims a region first, and text and images live inside that box. Authors hit exactly this:
 * they open the editor, reach for Text, and get nothing.
 *
 * So this states the model in one sentence, shows it, and offers the only move that makes sense
 * next.
 *
 * It is painted as CHROME — the surface's own dark panel — rather than as text on the stage. The
 * stage carries the author's background, which is white by default and can be set to anything, so
 * copy drawn straight onto it has no reliable contrast: the first cut used the dark surface's ink
 * and the headline was invisible on a new Scene. The grid solves this with paired hairlines; text
 * cannot. A panel is the honest answer, and it is what this is — the editor explaining an empty
 * canvas, not content sitting on one.
 */
export function SceneEmpty( { onAddBox }: Props ) {
	return (
		<div className="bl-scene-empty">
			<div className="bl-scene-empty__panel">
				{ /* The model, drawn. Two cells of a grid, one of them claimed — which is the whole
				     idea an author is missing at this point. Deliberately not an icon above a
				     heading: it carries the explanation rather than decorating it. */ }
				<svg
					className="bl-scene-empty__figure"
					viewBox="0 0 96 64"
					width="96"
					height="64"
					aria-hidden="true"
				>
					<g fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35">
						{ [ 16, 32, 48, 64, 80 ].map( ( x ) => (
							<path key={ `v${ x }` } d={ `M${ x } 0v64` } />
						) ) }
						{ [ 16, 32, 48 ].map( ( y ) => (
							<path key={ `h${ y }` } d={ `M0 ${ y }h96` } />
						) ) }
					</g>
					<rect
						x="16.5"
						y="16.5"
						width="47"
						height="31"
						fill="currentColor"
						fillOpacity="0.12"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path d="M24 28h32M24 36h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
				</svg>

				<p className="bl-scene-empty__lead">
					{ __( 'A Scene is built from boxes.', 'blicks' ) }
				</p>
				<p className="bl-scene-empty__note">
					{ __(
						'A box claims a region of the grid. Text and images are placed inside it, and each one can be moved and animated on its own.',
						'blicks'
					) }
				</p>

				<button type="button" className="bl-scene-empty__action" onClick={ onAddBox }>
					{ __( 'Add the first box', 'blicks' ) }
				</button>

				<p className="bl-scene-empty__hint">
					{ __( 'Press ? at any time for the shortcuts.', 'blicks' ) }
				</p>
			</div>
		</div>
	);
}
