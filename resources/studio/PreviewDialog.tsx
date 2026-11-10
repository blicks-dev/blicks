/**
 * A remote entry's design, running, before it is opened: the marketplace's live preview page in a
 * frame, beside what it is and the two ways to use it. Laid out as the marketplace's own preview —
 * the stage on the left, details on the right — so the item reads the same in both places.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { PatternEntry } from './library';

const MOTION: Record< string, string > = {
	static: __( 'Static', 'blicks' ),
	animated: __( 'Animated', 'blicks' ),
	interactive: __( 'Interactive', 'blicks' ),
};

const WIDTHS: Array< [ string, string, string ] > = [
	[ 'desktop', __( 'Desktop', 'blicks' ), '100%' ],
	[ 'tablet', __( 'Tablet', 'blicks' ), '768px' ],
	[ 'phone', __( 'Phone', 'blicks' ), '390px' ],
];

interface Props {
	entry: PatternEntry;
	onAdd: () => void;
	onOpen: () => void;
	onClose: () => void;
}

export function PreviewDialog( { entry, onAdd, onOpen, onClose }: Props ): JSX.Element {
	const ref = useRef< HTMLDialogElement >( null );
	const [ width, setWidth ] = useState( 'desktop' );
	const [ loaded, setLoaded ] = useState( false );

	useEffect( () => {
		const dialog = ref.current;
		if ( dialog && ! dialog.open ) dialog.showModal();
		return () => dialog?.close();
	}, [] );

	const slug = entry.id.replace( /^marketplace:/, '' );

	return (
		<dialog
			ref={ ref }
			className="bl-preview"
			aria-labelledby="blicks-preview-title"
			onCancel={ ( e ) => {
				e.preventDefault();
				onClose();
			} }
			onClick={ ( e ) => {
				// A click on the backdrop lands on the dialog itself.
				if ( e.target === ref.current ) onClose();
			} }
		>
			<div className="bl-preview__bar">
				<span className="bl-preview__path">{ [ entry.kind, slug ].filter( Boolean ).join( ' / ' ) }</span>
				<span className="bl-preview__widths" role="radiogroup" aria-label={ __( 'Preview width', 'blicks' ) }>
					{ WIDTHS.map( ( [ id, label ] ) => (
						<button key={ id } type="button" role="radio" aria-checked={ width === id } onClick={ () => setWidth( id ) }>
							{ label }
						</button>
					) ) }
				</span>
				{ entry.frame && (
					<a className="bl-preview__link" href={ entry.frame } target="_blank" rel="noreferrer">
						{ __( 'Open in a tab', 'blicks' ) }
					</a>
				) }
				<button type="button" className="bl-preview__close" aria-label={ __( 'Close preview', 'blicks' ) } onClick={ onClose }>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</div>
			<div className="bl-preview__body">
				<div className="bl-preview__stage">
					{ ! loaded && <span className="bl-preview__loading">{ __( 'Loading preview…', 'blicks' ) }</span> }
					{ entry.frame && (
						<iframe
							src={ entry.frame }
							title={ entry.title }
							style={ { width: WIDTHS.find( ( [ id ] ) => id === width )?.[ 2 ] } }
							sandbox="allow-scripts"
							onLoad={ () => setLoaded( true ) }
						/>
					) }
				</div>
				<div className="bl-preview__details">
					{ entry.kind && <span className="bl-preview__eyebrow">{ entry.kind }</span> }
					<h2 id="blicks-preview-title" className="bl-preview__title">{ entry.title }</h2>
					{ entry.excerpt && <p className="bl-preview__excerpt">{ entry.excerpt }</p> }
					<div className="bl-preview__tags">
						{ entry.motion && MOTION[ entry.motion ] && <span className="bl-preview__tag">{ MOTION[ entry.motion ] }</span> }
						<span className={ `bl-preview__tag${ 'pro' === entry.tier ? ' bl-preview__tag--pro' : '' }` }>
							{ 'pro' === entry.tier ? __( 'Pro', 'blicks' ) : __( 'Free', 'blicks' ) }
						</span>
					</div>
					<div className="bl-preview__acts">
						<button type="button" className="bl-preview__btn bl-preview__btn--primary" disabled={ !! entry.locked } onClick={ onAdd }>
							{ __( 'Add to page', 'blicks' ) }
						</button>
						<button type="button" className="bl-preview__btn" disabled={ !! entry.locked } onClick={ onOpen }>
							{ __( 'Open in Studio', 'blicks' ) }
						</button>
					</div>
					{ entry.locked && <p className="bl-preview__note">{ entry.lockedReason }</p> }
				</div>
			</div>
		</dialog>
	);
}
