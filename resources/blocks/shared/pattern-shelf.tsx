/**
 * The Pattern Shelf: choose a design right where the block is, on the editor canvas.
 *
 * Shared, so any block that starts from a pattern can use it; the Loop is the first
 * (`resources/blocks/loop/card-shelf.tsx`). The shelf knows nothing about what a design is. The
 * block hands it each source's options, draws each option's preview itself (usually real blocks,
 * small, filled with its own content), and decides what picking one does.
 *
 * It renders as block content inside the canvas iframe, so its CSS ships in the block's `style`:
 * `@use '../shared/pattern-shelf'` from the block's style.scss, as with the placeholder.
 */
import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';

export interface ShelfOption {
	id: string;
	title: string;
	/** Which tab it is listed under. */
	source: string;
	/** The line under the name: its collection, "Saved pattern". */
	subtitle?: string;
	/** What it can be filtered by. The chips are every filter the open tab's options carry. */
	filters?: Array< { id: string; label: string; swatch?: [ string, string ] } >;
	tier?: 'free' | 'pro';
	locked?: boolean;
	lockedReason?: string;
}

export type ShelfState< T > = { options: T[]; error: string } | 'loading';

export interface ShelfSource {
	id: string;
	label: string;
	/** What the tab says when it has nothing. */
	empty: string;
}

export interface PatternShelfProps< T extends ShelfOption > {
	title: string;
	blurb: string;
	sources: ShelfSource[];
	/** A source's options, or 'loading'. Called for the open tab on every render. */
	shelf: ( source: string ) => ShelfState< T >;
	/** Draws one option's preview, about 336 × 300 px before it is scaled down. */
	preview: ( option: T ) => ReactNode;
	onPick: ( option: T ) => void;
	/** The design being previewed on the block, or null when the pointer and focus leave the shelf. */
	onHover?: ( option: T | null ) => void;
	/** Is this the design in use? Marked "In use". */
	isCurrent?: ( option: T ) => boolean;
	/** The design being fetched, shown with a spinner. */
	busy?: string | null;
	/** "wide": one scrolling row, for a block that has nothing yet. "grid": rows, for changing a design. */
	layout?: 'wide' | 'grid';
	/** A way out other than picking: "Start with a plain card", "Close". */
	action?: { label: string; onClick: () => void };
	hint?: string;
}

export function PatternShelf< T extends ShelfOption >( props: PatternShelfProps< T > ) {
	const { title, blurb, sources, shelf, preview, onPick, onHover, isCurrent, busy, layout = 'wide', action, hint } = props;
	const [ tab, setTab ] = useState( sources[ 0 ]?.id ?? '' );
	const [ group, setGroup ] = useState( 'all' );
	const [ query, setQuery ] = useState( '' );

	const state = shelf( tab );
	const all = state === 'loading' ? [] : state.options;
	// Only filters that narrow the list: a chip every option carries ("Free" on a free store) does nothing.
	const groups = [ ...new Map( all.flatMap( ( o ) => ( o.filters ?? [] ).map( ( f ) => [ f.id, f ] as const ) ) ).values() ]
		.filter( ( f ) => all.some( ( o ) => ! ( o.filters ?? [] ).some( ( g ) => g.id === f.id ) ) );
	const q = query.trim().toLowerCase();
	const shown = all.filter( ( o ) => ( group === 'all' || ( o.filters ?? [] ).some( ( f ) => f.id === group ) )
		&& ( ! q || `${ o.title } ${ o.subtitle ?? '' }`.toLowerCase().includes( q ) ) );
	const source = sources.find( ( s ) => s.id === tab );

	return (
		<div
			className={ `bl-shelf bl-shelf--${ layout }` }
			// Leaving the shelf puts the block's own design back.
			onPointerLeave={ () => onHover?.( null ) }
			onBlur={ ( e ) => {
				if ( ! e.currentTarget.contains( e.relatedTarget as Node | null ) ) onHover?.( null );
			} }
		>
			<div className="bl-shelf__head">
				<div className="bl-shelf__title">
					<b>{ title }</b>
					<span>{ blurb }</span>
				</div>
				<input
					className="bl-shelf__search"
					type="search"
					value={ query }
					placeholder={ __( 'Search designs', 'blicks' ) }
					aria-label={ __( 'Search designs', 'blicks' ) }
					onChange={ ( e ) => setQuery( e.currentTarget.value ) }
				/>
			</div>
			<div className="bl-shelf__bar">
				<div className="bl-shelf__tabs" role="tablist" aria-label={ __( 'Where designs come from', 'blicks' ) }>
					{ sources.map( ( s ) => (
						<button key={ s.id } type="button" role="tab" aria-selected={ tab === s.id } onClick={ () => { setTab( s.id ); setGroup( 'all' ); } }>
							{ s.label }
						</button>
					) ) }
				</div>
				{ groups.length > 0 && (
					<div className="bl-shelf__chips" role="group" aria-label={ __( 'Collections', 'blicks' ) }>
						<button type="button" aria-pressed={ group === 'all' } onClick={ () => setGroup( 'all' ) }>{ __( 'All', 'blicks' ) }</button>
						{ groups.map( ( g ) => (
							<button key={ g.id } type="button" aria-pressed={ group === g.id } onClick={ () => setGroup( g.id ) }>
								{ g.swatch && <i style={ { background: `linear-gradient(135deg, ${ g.swatch[ 0 ] } 50%, ${ g.swatch[ 1 ] } 50%)` } } /> }
								{ g.label }
							</button>
						) ) }
					</div>
				) }
			</div>
			{ state === 'loading' ? (
				<p className="bl-shelf__empty">{ __( 'Loading designs…', 'blicks' ) }</p>
			) : shown.length === 0 ? (
				<p className="bl-shelf__empty">{ q ? __( 'No design matches that search.', 'blicks' ) : state.error || source?.empty }</p>
			) : (
				<ul className="bl-shelf__list" aria-label={ title }>
					{ shown.map( ( option ) => {
						const inUse = isCurrent?.( option ) ?? false;
						return (
						<li key={ option.id }>
							<button
								type="button"
								className="bl-shelf__thumb"
								aria-current={ inUse ? 'true' : undefined }
								aria-disabled={ option.locked ? 'true' : undefined }
								aria-label={ sprintf( /* translators: 1: design name, 2: its collection or source */ __( '%1$s, %2$s', 'blicks' ), option.title, option.subtitle ?? '' ) }
								onClick={ () => ! option.locked && ! busy && onPick( option ) }
								onPointerEnter={ () => ! option.locked && onHover?.( option ) }
								onFocus={ () => ! option.locked && onHover?.( option ) }
							>
								<span className="bl-shelf__view" aria-hidden="true">
									<span className="bl-shelf__scale">{ preview( option ) }</span>
									{ inUse ? (
										<span className="bl-shelf__tag is-current">{ __( 'In use', 'blicks' ) }</span>
									) : option.tier ? (
										<span className={ `bl-shelf__tag is-${ option.tier }` }>{ option.tier === 'pro' ? __( 'Pro', 'blicks' ) : __( 'Free', 'blicks' ) }</span>
									) : null }
									{ option.locked && <span className="bl-shelf__veil">{ option.lockedReason || __( 'Not available here', 'blicks' ) }</span> }
									{ busy === option.id && <span className="bl-shelf__veil is-busy">{ __( 'Fetching…', 'blicks' ) }</span> }
								</span>
								<span className="bl-shelf__meta">
									<b>{ option.title }</b>
									<small>{ option.subtitle }</small>
								</span>
							</button>
						</li>
						);
					} ) }
				</ul>
			) }
			<div className="bl-shelf__foot">
				<span>{ hint }</span>
				{ action && <button type="button" className="bl-shelf__action" onClick={ action.onClick }>{ action.label }</button> }
			</div>
		</div>
	);
}
