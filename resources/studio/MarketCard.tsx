/**
 * A marketplace entry on the shelf, as the marketplace shows it: the design running in a 640×400
 * frame scaled to the card, its name, one line on what it is, its tags — plus the two ways to use
 * it here. The name (and the card around it) opens the full preview.
 */
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { PatternEntry } from './library';

/** The frame's own size; the card scales it down to fit, as the marketplace's cards do. */
const FRAME_W = 640;
const FRAME_H = 400;

/** The marketplace's own motion glyphs. */
const MOTION: Record< string, [ string, JSX.Element ] > = {
	static: [ __( 'Static', 'blicks' ), <rect key="s" x="5" y="5" width="14" height="14" /> ],
	animated: [ __( 'Animated', 'blicks' ), <path key="a" d="M3 12c2.5-6 5.5-6 7.5 0s5 6 7.5 0 2 0 3 0" /> ],
	interactive: [ __( 'Interactive', 'blicks' ), <><path d="M5 4l13 6.5-5.5 1.6L10.8 18Z" /><path d="m13 12.5 5 5" /></> ],
};

function Glyph( { children }: { children: JSX.Element } ): JSX.Element {
	return (
		<svg className="bl-mcard__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" focusable="false">
			{ children }
		</svg>
	);
}

interface Props {
	entry: PatternEntry;
	opening: boolean;
	onPreview: () => void;
	onAdd: () => void;
	onOpen: () => void;
}

export function MarketCard( { entry, opening, onPreview, onAdd, onOpen }: Props ): JSX.Element {
	const preview = useRef< HTMLDivElement >( null );

	// Scale the 640×400 frame to the card's width.
	useEffect( () => {
		const el = preview.current;
		if ( ! el ) return;
		// Nothing inside the running preview takes focus or clicks; the card's own controls do.
		el.setAttribute( 'inert', '' );
		const fit = ( width: number ) => el.style.setProperty( '--bl-mcard-scale', String( width / FRAME_W ) );
		fit( el.clientWidth );
		if ( typeof ResizeObserver === 'undefined' ) return;
		const observer = new ResizeObserver( ( entries ) => fit( entries[ 0 ].contentRect.width ) );
		observer.observe( el );
		return () => observer.disconnect();
	}, [] );

	const motion = entry.motion ? MOTION[ entry.motion ] : undefined;

	return (
		<article className="bl-mcard">
			<div ref={ preview } className="bl-mcard__preview">
				{ entry.frame && (
					<iframe src={ entry.frame } title="" tabIndex={ -1 } aria-hidden="true" loading="lazy" sandbox="allow-scripts" width={ FRAME_W } height={ FRAME_H } />
				) }
				<span className="bl-mcard__zoom">
					<Glyph><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></Glyph>
					<span>{ __( 'Preview', 'blicks' ) }</span>
				</span>
				{ opening && <span className="bl-mcard__opening">{ __( 'Opening…', 'blicks' ) }</span> }
			</div>
			<div className="bl-mcard__body">
				<h3 className="bl-mcard__title">
					<button type="button" className="bl-mcard__open" aria-haspopup="dialog" onClick={ onPreview }>
						{ entry.title }
					</button>
				</h3>
				{ entry.excerpt && <p className="bl-mcard__desc">{ entry.excerpt }</p> }
				<div className="bl-mcard__tags">
					{ motion && (
						<span className="bl-mcard__tag">
							<Glyph>{ motion[ 1 ] }</Glyph>
							<span>{ motion[ 0 ] }</span>
						</span>
					) }
					<span className={ `bl-mcard__tag${ 'pro' === entry.tier ? ' bl-mcard__tag--pro' : '' }` }>
						{ 'pro' === entry.tier ? __( 'Pro', 'blicks' ) : __( 'Free', 'blicks' ) }
					</span>
				</div>
				<div className="bl-mcard__acts">
					<button type="button" className="bl-mcard__btn bl-mcard__btn--primary" disabled={ !! entry.locked } onClick={ onAdd }>
						{ __( 'Add', 'blicks' ) }
					</button>
					<button type="button" className="bl-mcard__btn" disabled={ !! entry.locked } onClick={ onOpen }>
						{ __( 'Open in Studio', 'blicks' ) }
					</button>
				</div>
				{ entry.locked && <p className="bl-mcard__note">{ entry.lockedReason }</p> }
			</div>
		</article>
	);
}
