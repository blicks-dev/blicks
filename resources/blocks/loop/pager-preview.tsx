/**
 * A paged Loop's page links or Load more button on the editor canvas, drawn with the classes
 * src/Data/Pager.php writes, so the page's own styles show it as it will look.
 *
 * The page links step the page the editor previews (the cards above follow). Load more is shown
 * at rest: the preview holds at most a dozen cards, so loading more would show nothing new.
 */
import { __, sprintf } from '@wordpress/i18n';
import { paging, sequence, statusText } from './pager';
import { setPreviewPage } from './use-items';
import type { LoopItems } from './use-items';

const arrow = ( d: string ) => (
	<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={ d } /></svg>
);

export function PagerPreview( { attributes, data, clientId }: { attributes: any; data: LoopItems | null; clientId: string } ) {
	const settings = paging( attributes );
	if ( ! settings || ! data ) return null;
	const labels = settings.labels ?? {};
	const align = settings.align ?? 'center';

	if ( settings.mode === 'more' ) {
		const shown = Math.min( data.found, data.page * data.perPage );
		return (
			<div className={ `bl-loop__more is-align-${ align }` }>
				<p className="bl-loop__status">{ statusText( labels.status || __( 'Showing {shown} of {total}', 'blicks' ), shown, data.found ) }</p>
				{ data.page < data.pages && (
					<span className={ `bl-loop__load bl-button bl-button--${ settings.button ?? 'outline' } bl-button--default-size` } aria-disabled="true">
						<span className="bl-button__label">{ labels.more || __( 'Load more', 'blicks' ) }</span>
					</span>
				) }
			</div>
		);
	}

	if ( data.pages <= 1 ) return null;
	const page = Math.min( data.page, data.pages );
	const go = ( n: number ) => () => setPreviewPage( clientId, n );
	const step = ( which: 'prev' | 'next', label: string, target: number | null ) => {
		const inside = which === 'prev'
			? <>{ arrow( 'M10 3L5 8l5 5' ) }<span className="bl-loop__word">{ label }</span></>
			: <><span className="bl-loop__word">{ label }</span>{ arrow( 'M6 3l5 5-5 5' ) }</>;
		return target === null
			? <span className={ `bl-loop__page bl-loop__${ which } is-off` } aria-hidden="true">{ inside }</span>
			: <button type="button" className={ `bl-loop__page bl-loop__${ which }` } onClick={ go( target ) }>{ inside }</button>;
	};

	return (
		<nav className={ `bl-loop__pages is-${ settings.look ?? 'pills' } is-align-${ align }` } aria-label={ labels.nav || __( 'Pages', 'blicks' ) }>
			{ step( 'prev', labels.prev || __( 'Previous', 'blicks' ), page > 1 ? page - 1 : null ) }
			{ settings.show === 'count'
				? <span className="bl-loop__count">{ sprintf( /* translators: 1: the current page, 2: how many pages there are. */ __( 'Page %1$d of %2$d', 'blicks' ), page, data.pages ) }</span>
				: sequence( page, data.pages ).map( ( e ) => {
					const screens = e.narrow ? '' : ' is-wide';
					if ( e.n === null ) {
						return <span key={ `g${ e.after }` } className={ `bl-loop__gap${ screens }${ e.wide ? '' : ' is-narrow' }` } aria-hidden="true">…</span>;
					}
					const current = e.n === page;
					return (
						<button
							key={ e.n }
							type="button"
							className={ `bl-loop__page${ current ? ' is-current' : '' }${ screens }` }
							aria-current={ current ? 'page' : undefined }
							aria-label={ sprintf( /* translators: %d: a page number. */ __( 'Page %d', 'blicks' ), e.n ) }
							onClick={ go( e.n ) }
						>
							{ e.n }
						</button>
					);
				} ) }
			{ step( 'next', labels.next || __( 'Next', 'blicks' ), page < data.pages ? page + 1 : null ) }
		</nav>
	);
}
