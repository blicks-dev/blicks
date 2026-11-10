/**
 * The library: the way in when nothing is mounted.
 *
 * The screen answers two questions at once, and the layout is which one it answers first.
 *
 * **Collection comes first**, above Kind, because it is the axis that stops a shelf being a pile.
 * A hero and an offer taken from the same set share a palette, a type scale and a radius, so two
 * patterns dropped on one page look like one page. The swatch rides everywhere a collection is
 * named — in the rail, on the strip, on every card — which is how two cards read as family before
 * either name is read.
 *
 * **Source stays, lower down**, because provenance is still the thing that decides whether editing
 * something is safe. It is no longer the first question, though. Nobody opens a library thinking
 * "show me the built-ins"; they think "show me something that looks like this".
 *
 * Every empty here says which empty it is. "No patterns yet" is a first run and gets the one
 * instruction that fixes it forever; "nothing matches" is a dead end of the author's own making and
 * gets the term back to edit; "no pricing in Funky" is a third thing again and gets the facets
 * back, because clearing a search box nobody typed in fixes nothing.
 *
 * Previews are drawn from each tree's own shape and painted in its collection's palette. Shape from
 * the tree, colour from the set: neither is a stored copy of the other, so nothing can go stale and
 * a card cannot look like it belongs to a set it is not in.
 *
 * **Portalled to the admin document, for the same reason `Studio` is.** This renders from a
 * `registerPlugin` root, and the editor keeps that plugin area inside a container it sets to
 * `display: none` — a surface rendered in place there has `position: fixed` and a z-index and is
 * still a 0×0 box nobody can see. Rendering in place cost this screen its entire first outing:
 * every element was in the DOM, correctly styled, inside a hidden ancestor.
 */

import { createPortal, useEffect, useMemo, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { parse } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';
import { BUILTIN_PATTERNS } from './builtins';
import { Glyph } from './Glyph';
import { swatchOf, type Collection } from './collections';
import {
	collectionFrom,
	collectionsOf,
	countsBySource,
	describe,
	emptyKindFor,
	filterLibrary,
	industriesOf,
	kindsOf,
	previewBars,
	shelve,
	NO_FILTER,
	type LibraryFilter,
	type PatternEntry,
	type SourceFilter,
	type SourceResult,
} from './library';
import { listCategories, loadSitePatterns, withKinds } from './patterns';
import { MountError, detach, mountJson, mountPattern, type BlockNode, type Mount } from './mount';
import { BlockPreview } from '@wordpress/block-editor';
import { newItems, patternSets, registeredPatterns, sources, type NewStart, type StudioNewItem } from './registry';
import { LANGUAGES, languageById, nameOf, scopeCss, setLens, setSite, useLanguages } from './languages';
import { PreviewDialog } from './PreviewDialog';
import { MarketCard } from './MarketCard';

/**
 * Every language's variables, each scoped to its own picker card.
 *
 * One stylesheet for the strip rather than an inline style per card: a language's CSS is a whole
 * `:root` block, and re-rooting it on the card is what lets the card be drawn by the same variables
 * Box and Button read — so the card is a sample of the language, not a picture of one.
 */
const LENS_CSS = LANGUAGES.map( ( l ) => scopeCss( l.css, `.bl-library__lens[data-lang="${ l.id }"]` ) ).join( '\n' );

/** A card and a button, drawn in one language over its backdrop. */
function LensSample(): JSX.Element {
	return (
		<span className="bl-library__lenspv" aria-hidden="true">
			<span className="bl-library__lenscard" />
			<span className="bl-library__lensbtn">Aa</span>
		</span>
	);
}

/**
 * A pattern drawn as itself, in the language being viewed.
 *
 * Built-ins carry tokens rather than colours, so the language's custom properties are all it takes
 * to redraw one: the same tree, another look. Rendered from a detached copy, so a preview never
 * shares client ids with what gets mounted.
 */
function PatternPreview( { blocks, css }: { blocks: BlockNode[]; css: string } ): JSX.Element {
	const copy = useMemo( () => detach( blocks ), [ blocks ] );
	return (
		<span className="bl-library__preview" aria-hidden="true">
			<BlockPreview
				blocks={ copy as never }
				viewportWidth={ 1200 }
				additionalStyles={ css ? [ { css } ] : [] }
			/>
		</span>
	);
}

interface Props {
	onMount: ( mount: Mount ) => void;
	/** Put a pattern straight into the post, without opening it in the Studio. */
	onAdd: ( mount: Mount ) => void;
	onBlank: () => void;
	/** Mount what is selected in the post, or `null` when nothing is. */
	onMountSelection: ( () => void ) | null;
	onClose: () => void;
}

/**
 * The source rows, each with the glyph the prototype gives it.
 *
 * Drawn here rather than borrowed from the block icon registry: these are SOURCES, not blocks, and
 * a row carrying a block's icon would suggest it is one. A bookmark for what you saved, a globe for
 * what is fetched, an arrow in for what was pasted — provenance at a glance.
 */
const SOURCES: { id: SourceFilter; label: string; path: string }[] = [
	{ id: 'all', label: __( 'All patterns', 'blicks' ), path: 'M4 6h16M4 12h16M4 18h16' },
	{ id: 'builtin', label: __( 'Built-in', 'blicks' ), path: 'M4 5h16v14H4z' },
	{ id: 'site', label: __( 'Saved here', 'blicks' ), path: 'M5 3h14v18l-7-5-7 5z' },
	{
		id: 'dev',
		label: __( 'Marketplace', 'blicks' ),
		path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18',
	},
	{
		id: 'imported',
		label: __( 'Imported', 'blicks' ),
		path: 'M12 3v12m0 0-4-4m4 4 4-4M4 19h16',
	},
];

/** The three dots that say which set something is in, before anyone reads a name. */
function Swatch( { collection, size }: { collection: Collection; size: number } ): JSX.Element {
	return (
		<span className="bl-library__swatch" aria-hidden="true">
			{ swatchOf( collection ).map( ( hex ) => (
				<span
					key={ hex }
					className="bl-library__dot"
					style={ { background: hex, width: size, height: size } }
				/>
			) ) }
		</span>
	);
}

export function LibraryScreen( { onMount, onAdd, onBlank, onMountSelection, onClose }: Props ): JSX.Element {
	const [ results, setResults ] = useState< SourceResult[] | null >( null );
	const [ filter, setFilter ] = useState< LibraryFilter >( NO_FILTER );
	const [ importing, setImporting ] = useState( false );
	const [ paste, setPaste ] = useState( '' );
	const [ problem, setProblem ] = useState( '' );
	/** The remote entry being fetched, so its card can say so. */
	const [ opening, setOpening ] = useState( '' );
	const [ newOpen, setNewOpen ] = useState( false );
	// The site's language, and the one the shelf is being viewed in. Shared with the canvas.
	const { site, lens } = useLanguages();
	const [ adopting, setAdopting ] = useState( false );
	const lensCss = languageById( lens )?.css ?? '';

	/** Make the language being viewed the site's. Every page changes, so it is asked for. */
	const adopt = (): void => {
		setAdopting( false );
		void ( apiFetch as unknown as ( o: object ) => Promise< unknown > )( {
			path: '/blicks/v1/design-system/language',
			method: 'POST',
			data: { id: lens },
		} )
			.then( () => setSite( lens ) )
			.catch( () =>
				setProblem( __( 'The site’s design language could not be changed. Nothing was saved.', 'blicks' ) )
			);
	};
	const [ picker, setPicker ] = useState< StudioNewItem | null >( null );
	// A remote entry's live preview, open over the shelf.
	const [ previewing, setPreviewing ] = useState< PatternEntry | null >( null );
	const extraNew = newItems.use();
	const sets = patternSets.use();

	/** A companion's "+ New" entry: straight in, or through its picker first. */
	const startNew = ( item: StudioNewItem ): void => {
		setNewOpen( false );
		if ( item.Picker ) {
			setPicker( item );
			return;
		}
		const start = item.start?.() ?? null;
		if ( start ) {
			onMount( mountPattern( start.blocks, start.label ) );
		}
	};
	const pickerDone = ( start: NewStart ): void => {
		setPicker( null );
		onMount( mountPattern( start.blocks, start.label ) );
	};

	useEffect( () => {
		let live = true;

		/*
		 * Each source resolves on its own. `allSettled` rather than `all` is the whole point: the
		 * fetched catalogue is the only one needing a network, and one refusal must not take the
		 * three local sources down with it.
		 */
		const remote = sources.list();

		void Promise.allSettled( [
			loadSitePatterns( apiFetch as never ),
			listCategories( apiFetch as never ),
		] ).then( ( settled ) => {
			if ( ! live ) {
				return;
			}

			const loaded =
				settled[ 0 ]!.status === 'fulfilled'
					? settled[ 0 ]!.value
					: { source: 'site' as const, entries: [], error: __( 'Could not be read.', 'blicks' ) };

			// The taxonomy is a separate call, and a separate failure. A site whose terms cannot be
			// read still gets its patterns, filed as uncategorised, rather than no patterns at all.
			const named =
				settled[ 1 ]!.status === 'fulfilled' ? withKinds( loaded, settled[ 1 ]!.value ) : loaded;

			/*
			 * Build each saved pattern's tree once, here.
			 *
			 * They arrive as serialized markup, which a card cannot draw and `describe` cannot
			 * count — so without this every "Saved here" card was a blank thumbnail over a blank
			 * meta line, which reads as the pattern being empty rather than as it being unparsed.
			 */
			const site = {
				...named,
				entries: named.entries.map( ( entry ) => {
					if ( entry.blocks || ! entry.content ) {
						return entry;
					}

					try {
						return { ...entry, blocks: parse( entry.content ) as BlockNode[] };
					} catch {
						// A pattern this site cannot rebuild still belongs on the shelf; it simply
						// has no preview until something tries to mount it and says why.
						return entry;
					}
				} ),
			};

			setResults( ( prev ) => [
				{ source: 'builtin', entries: BUILTIN_PATTERNS },
				site,
				// Filled below when the registered sources answer; the local shelves never wait, and
				// a remote answer that came first is kept rather than reset to "loading".
				prev?.find( ( r ) => r.source === 'dev' ) ?? { source: 'dev', entries: [], error: remote.length ? __( 'Loading the marketplace…', 'blicks' ) : __( 'Not connected yet.', 'blicks' ) },
				{ source: 'imported', entries: [] },
			] );
		} );

		/*
		 * Remote shelves, from `registerSource`. They share the Marketplace row, each settling on its
		 * own: one that fails names why, and the rest of the row still fills.
		 */
		if ( remote.length ) {
			void Promise.allSettled( remote.map( ( src ) => src.load() ) ).then( ( settled ) => {
				if ( ! live ) {
					return;
				}

				const loads = settled.map( ( r ) => ( r.status === 'fulfilled' ? r.value : { entries: [], error: __( 'Can’t reach the marketplace right now.', 'blicks' ) } ) );
				const entries = loads.flatMap( ( l ) => l.entries.map( ( e ) => ( { ...e, source: 'dev' as const } ) ) );
				const error = loads.map( ( l ) => l.error ).find( Boolean );
				const action = loads.map( ( l ) => l.action ).find( Boolean );
				const dev = { source: 'dev' as const, entries, ...( error ? { error } : {} ), ...( action ? { action } : {} ) };

				setResults( ( prev ) => ( prev ?? [] ).some( ( r ) => r.source === 'dev' )
					? ( prev ?? [] ).map( ( r ) => ( r.source === 'dev' ? dev : r ) )
					: [ ...( prev ?? [] ), dev ] );
			} );
		}

		return () => {
			live = false;
		};
	}, [] );

	// A companion's patterns shelve with the built-ins, and arrive whenever it registers them.
	const entries = useMemo(
		() =>
			results
				? shelve(
						results.map( ( r ) =>
							'builtin' === r.source ? { ...r, entries: [ ...r.entries, ...registeredPatterns( sets ) ] } : r
						)
				  )
				: [],
		[ results, sets ]
	);
	const counts = useMemo( () => countsBySource( entries ), [ entries ] );
	const collections = useMemo( () => collectionsOf( entries ), [ entries ] );
	const industries = useMemo( () => industriesOf( entries ), [ entries ] );

	/*
	 * Kind counts are scoped to the collection in view, and that is the point.
	 *
	 * "3 heroes" beside a Funky grid has to mean three heroes IN FUNKY. A global count next to a
	 * collection-scoped grid is a number that contradicts what is on screen, and the first time it
	 * does nobody trusts any other number in the rail.
	 */
	const inCollection = useMemo(
		() =>
			'' === filter.collection
				? entries
				: entries.filter( ( entry ) => entry.collection === filter.collection ),
		[ entries, filter.collection ]
	);
	const kinds = useMemo( () => kindsOf( inCollection ), [ inCollection ] );

	const shown = useMemo( () => filterLibrary( entries, filter ), [ entries, filter ] );
	const empty = emptyKindFor( shown, entries, filter );
	const sourceError = results?.find( ( r ) => r.source === filter.source )?.error ?? '';
	const sourceAction = results?.find( ( r ) => r.source === filter.source )?.action;
	const standing = collections.find( ( c ) => c.collection.id === filter.collection );

	const narrow = ( patch: Partial< LibraryFilter > ): void => setFilter( { ...filter, ...patch } );

	/** Leaving a collection also drops the kind, which was counted inside it. */
	const leaveCollection = (): void => narrow( { collection: '', kind: '' } );

	const mount = ( entry: PatternEntry, into: ( mount: Mount ) => void = onMount ): void => {
		// A remote entry holds no tree until asked for one; its source fetches it, and a refusal
		// (a licence, an outage) is said on the shelf exactly as a broken pattern is.
		if ( entry.open ) {
			setOpening( entry.id );
			void entry
				.open()
				.then( ( opened ) => into( mountPattern( opened.blocks, entry.title, opened.keyframes ) ) )
				.catch( ( failure: unknown ) =>
					setProblem(
						sprintf(
							/* translators: 1: the pattern's name. 2: the reason it failed. */
							__( '“%1$s” could not be opened: %2$s', 'blicks' ),
							entry.title,
							failure instanceof Error ? failure.message : String( failure )
						)
					)
				)
				.finally( () => setOpening( '' ) );
			return;
		}

		try {
			/*
			 * A built-in carries its tree as block JSON; a site pattern carries serialized markup,
			 * because that is how `wp_block` stores one. `parse` rebuilds the second against this
			 * site's registered blocks, which is also what makes an unknown block in a saved
			 * pattern come back as an invalid-content placeholder rather than vanishing.
			 */
			const blocks = entry.blocks ?? ( parse( entry.content ?? '' ) as BlockNode[] );

			if ( blocks.length === 0 ) {
				throw new MountError( __( 'There is nothing in that pattern.', 'blicks' ) );
			}

			into( mountPattern( blocks, entry.title, entry.keyframes ) );
		} catch ( failure ) {
			/*
			 * A pattern this site cannot rebuild. It stays on the shelf rather than mounting
			 * half-formed — and it says WHY. "Could not be rebuilt" names the symptom and hides
			 * the one fact that would let anyone act on it, which is the failure's own message.
			 */
			setProblem(
				sprintf(
					/* translators: 1: the pattern's name. 2: the reason it failed. */
					__( '“%1$s” could not be mounted: %2$s', 'blicks' ),
					entry.title,
					failure instanceof Error ? failure.message : String( failure )
				)
			);
		}
	};

	/**
	 * Mount every pattern in the set, in shelf order, as one page.
	 *
	 * This is the collection's whole promise made into a button. The patterns were built to sit
	 * together, so stacking them is not a convenience — it is the fastest demonstration that they
	 * do, and the result is a real starting page rather than a sampler.
	 */
	const mountSet = ( collection: Collection ): void => {
		const blocks = entries
			.filter( ( entry ) => entry.collection === collection.id )
			.flatMap( ( entry ) => entry.blocks ?? [] );

		if ( blocks.length === 0 ) {
			return;
		}

		onMount( mountPattern( blocks, collection.name ) );
	};

	const mountPaste = (): void => {
		setProblem( '' );

		try {
			onMount( mountJson( paste ) );
		} catch ( failure ) {
			setProblem( failure instanceof MountError ? failure.message : String( failure ) );
		}
	};

	return createPortal(
		<div
			className="bl-studio bl-studio--library"
			role="dialog"
			aria-label={ __( 'Blicks Studio', 'blicks' ) }
		>
			<div className="bl-library__top">
				<button
					type="button"
					className="bl-library__iconbtn"
					onClick={ onClose }
					aria-label={ __( 'Close the Studio', 'blicks' ) }
				>
					<Glyph path="M6 6l12 12M18 6L6 18" size={ 20 } />
				</button>
				<span className="bl-library__name">{ __( 'Studio', 'blicks' ) }</span>
				<span className="bl-library__divider" />
				<span className="bl-library__state">{ __( 'Nothing mounted', 'blicks' ) }</span>
				{ '' !== site && (
					<span className="bl-library__site">
						{ __( 'Site:', 'blicks' ) } <b>{ nameOf( site ) }</b>
					</span>
				) }

				<span className="bl-library__spacer" />

				{ /*
				 * Offered only when there is something to mount.
				 *
				 * A button that is always there and usually does nothing teaches people to stop
				 * trusting the row it sits in. Absent is the honest state when the post has no
				 * selection — and the block toolbar is the other, more obvious way in anyway.
				 */ }
				{ null !== onMountSelection && (
					<button type="button" className="bl-library__btn" onClick={ onMountSelection }>
						{ __( 'Mount selection', 'blicks' ) }
					</button>
				) }
				{ /*
				 * One button while the Section is the only thing to start. When a companion adds
				 * another kind it becomes "+ New", a menu that names what each one is for.
				 */ }
				{ 0 === extraNew.length ? (
					<button
						type="button"
						className="bl-library__btn bl-library__btn--filled"
						onClick={ onBlank }
					>
						<Glyph path="M12 5v14M5 12h14" size={ 18 } />
						{ __( 'Blank canvas', 'blicks' ) }
					</button>
				) : (
					<span className="bl-library__new">
						<button
							type="button"
							className="bl-library__btn bl-library__btn--filled"
							aria-haspopup="menu"
							aria-expanded={ newOpen }
							onClick={ () => setNewOpen( ( open ) => ! open ) }
						>
							<Glyph path="M12 5v14M5 12h14" size={ 18 } />
							{ __( 'New', 'blicks' ) }
						</button>
						{ newOpen && (
							<span className="bl-library__newmenu" role="menu">
								<button
									type="button"
									role="menuitem"
									onClick={ () => {
										setNewOpen( false );
										onBlank();
									} }
								>
									<span className="bl-library__newpic bl-library__newpic--section" aria-hidden="true">
										<i />
										<i />
										<i />
									</span>
									<span>
										<b>{ __( 'Section', 'blicks' ) }</b>
										<small>{ __( 'Stacks top to bottom and reflows on phones. For part of a page.', 'blicks' ) }</small>
									</span>
								</button>
								{ extraNew.map( ( item ) => (
									<button key={ item.id } type="button" role="menuitem" onClick={ () => startNew( item ) }>
										<span className="bl-library__newpic" aria-hidden="true">
											{ item.icon ? <Glyph path={ item.icon } size={ 22 } /> : <i /> }
										</span>
										<span>
											<b>{ item.label }</b>
											<small>{ item.description }</small>
										</span>
									</button>
								) ) }
							</span>
						) }
					</span>
				) }
			</div>

			<div className="bl-library__body">
				<aside className="bl-library__rail">
					{ collections.length > 0 && (
						<>
							<div className="bl-library__grouphead">
								<p className="bl-library__railtitle">{ __( 'Collection', 'blicks' ) }</p>
								{ '' !== filter.collection && (
									<button
										type="button"
										className="bl-library__textbtn"
										onClick={ leaveCollection }
									>
										{ __( 'Reset', 'blicks' ) }
									</button>
								) }
							</div>
							{ collections.map( ( { collection, count } ) => (
								<button
									key={ collection.id }
									type="button"
									className={
										collection.id === filter.collection
											? 'bl-library__row bl-library__row--on'
											: 'bl-library__row'
									}
									aria-pressed={ collection.id === filter.collection }
									onClick={ () =>
										narrow(
											collection.id === filter.collection
												? { collection: '', kind: '' }
												: { collection: collection.id, kind: '' }
										)
									}
								>
									<Swatch collection={ collection } size={ 10 } />
									<span className="bl-library__rowname">{ collection.name }</span>
									<span className="bl-library__count">{ count }</span>
								</button>
							) ) }
						</>
					) }

					{ kinds.length > 0 && (
						<>
							<p className="bl-library__railtitle">{ __( 'Kind', 'blicks' ) }</p>
							<div className="bl-library__chips">
								{ kinds.map( ( kind ) => (
									<button
										key={ kind.kind }
										type="button"
										className={
											kind.kind === filter.kind
												? 'bl-library__chip bl-library__chip--on'
												: 'bl-library__chip'
										}
										aria-pressed={ kind.kind === filter.kind }
										onClick={ () =>
											narrow( { kind: kind.kind === filter.kind ? '' : kind.kind } )
										}
									>
										{ kind.kind }
										<span className="bl-library__chipcount">{ kind.count }</span>
									</button>
								) ) }
							</div>
						</>
					) }

					{ industries.length > 0 && (
						<>
							<p className="bl-library__railtitle">{ __( 'Industry', 'blicks' ) }</p>
							<div className="bl-library__chips">
								{ industries.map( ( { industry } ) => (
									<button
										key={ industry }
										type="button"
										className={
											industry === filter.industry
												? 'bl-library__chip bl-library__chip--on'
												: 'bl-library__chip'
										}
										aria-pressed={ industry === filter.industry }
										onClick={ () =>
											narrow( { industry: industry === filter.industry ? '' : industry } )
										}
									>
										{ industry }
									</button>
								) ) }
							</div>
						</>
					) }

					<p className="bl-library__railtitle">{ __( 'Source', 'blicks' ) }</p>
					{ SOURCES.map( ( source ) => (
						<button
							key={ source.id }
							type="button"
							className={
								source.id === filter.source
									? 'bl-library__row bl-library__row--on'
									: 'bl-library__row'
							}
							aria-pressed={ source.id === filter.source }
							onClick={ () => narrow( { source: source.id } ) }
						>
							<span className="bl-library__rowicon">
								<Glyph path={ source.path } size={ 15 } />
							</span>
							<span className="bl-library__rowname">{ source.label }</span>
							<span className="bl-library__count">{ counts[ source.id ] }</span>
						</button>
					) ) }
				</aside>

				<main className="bl-library__main">
					{ LANGUAGES.length > 1 && (
						<>
							<style>{ LENS_CSS }</style>
							<div className="bl-library__lenses" role="group" aria-label={ __( 'View patterns in a design language', 'blicks' ) }>
								{ LANGUAGES.map( ( language ) => (
									<button
										key={ language.id }
										type="button"
										data-lang={ language.id }
										className={ language.id === lens ? 'bl-library__lens is-on' : 'bl-library__lens' }
										aria-pressed={ language.id === lens }
										onClick={ () => setLens( language.id ) }
									>
										<LensSample />
										<span className="bl-library__lensmeta">
											<span className="bl-library__lensname">{ language.name }</span>
											{ language.id === site && (
												<span className="bl-library__lenssite">{ __( 'Site', 'blicks' ) }</span>
											) }
										</span>
									</button>
								) ) }
							</div>
							{ '' !== ( languageById( lens )?.description ?? '' ) && (
								<p className="bl-library__lensdesc">
									<b>{ nameOf( lens ) }.</b> { languageById( lens )?.description }
								</p>
							) }
						</>
					) }
					{ lens !== site && (
						<div className="bl-library__notice" role="status">
							<span>
								{ sprintf(
									/* translators: 1: the language being viewed, 2: the site's own design language */
									__( 'Viewing in %1$s. Your site uses %2$s, so a pattern you add takes that look.', 'blicks' ),
									nameOf( lens ),
									nameOf( site )
								) }
							</span>
							<button type="button" className="bl-library__textbtn" onClick={ () => setLens( site ) }>
								{ /* translators: %s: the site's design language */ sprintf( __( 'Back to %s', 'blicks' ), nameOf( site ) ) }
							</button>
							{ adopting ? (
								<>
									<span>{ __( 'Every page changes. Switch?', 'blicks' ) }</span>
									<button type="button" className="bl-library__textbtn" onClick={ adopt }>
										{ /* translators: %s: a design language */ sprintf( __( 'Use %s', 'blicks' ), nameOf( lens ) ) }
									</button>
									<button type="button" className="bl-library__textbtn" onClick={ () => setAdopting( false ) }>
										{ __( 'Cancel', 'blicks' ) }
									</button>
								</>
							) : (
								<button type="button" className="bl-library__textbtn" onClick={ () => setAdopting( true ) }>
									{ /* translators: %s: a design language */ sprintf( __( 'Use %s on the site…', 'blicks' ), nameOf( lens ) ) }
								</button>
							) }
						</div>
					) }
					<div className="bl-library__bar">
						<label className="bl-library__field">
							<svg
								viewBox="0 0 24 24"
								width="20"
								height="20"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								className="bl-library__searchicon"
								aria-hidden="true"
							>
								<circle cx="11" cy="11" r="6" />
								<path d="M15.5 15.5 20 20" />
							</svg>
							<input
								type="search"
								value={ filter.query }
								placeholder={ __( 'Search patterns', 'blicks' ) }
								aria-label={ __( 'Search patterns', 'blicks' ) }
								onChange={ ( event ) => narrow( { query: event.target.value } ) }
								className="bl-library__searchinput"
							/>
						</label>

						<span className="bl-library__spacer" />

						<span className="bl-library__found">
							{ null === results
								? __( 'Loading…', 'blicks' )
								: sprintf(
									/* translators: %d: how many patterns are showing. */
									__( '%d patterns', 'blicks' ),
									shown.length
								) }
						</span>
						<button
							type="button"
							className="bl-library__btn"
							onClick={ () => setImporting( true ) }
						>
							{ __( 'Paste JSON', 'blicks' ) }
						</button>
					</div>

					{ collections.length > 0 && (
						<div className="bl-library__strip">
							{ collections.map( ( { collection, count } ) => (
								<button
									key={ collection.id }
									type="button"
									className={
										collection.id === filter.collection
											? 'bl-library__set bl-library__set--on'
											: 'bl-library__set'
									}
									aria-pressed={ collection.id === filter.collection }
									onClick={ () =>
										narrow(
											collection.id === filter.collection
												? { collection: '', kind: '' }
												: { collection: collection.id, kind: '' }
										)
									}
								>
									<Swatch collection={ collection } size={ 14 } />
									<span className="bl-library__setname">{ collection.name }</span>
									<span className="bl-library__setmeta">
										{ sprintf(
											/* translators: 1: how many patterns. 2: the industries it suits. */
											__( '%1$d · %2$s', 'blicks' ),
											count,
											collection.industries.join( ', ' )
										) }
									</span>
								</button>
							) ) }
						</div>
					) }

					{ /*
					 * The set you are standing in, painted in its own colours.
					 *
					 * It is the one place the collection speaks for itself rather than being a row
					 * in a list, and it earns that by carrying the only action a set has: mounting
					 * the whole thing as a page, which is the promise the collection makes.
					 */ }
					{ undefined !== standing && (
						<div
							className="bl-library__head"
							style={ {
								background: standing.collection.palette.ground,
								color: standing.collection.palette.ink,
							} }
						>
							<div className="bl-library__headtext">
								<div className="bl-library__headline">
									<h2 className="bl-library__headname">{ standing.collection.name }</h2>
									<span className="bl-library__pill">
										{ sprintf(
											/* translators: %d: how many patterns are in the set. */
											__( '%d patterns', 'blicks' ),
											standing.count
										) }
									</span>
								</div>
								<p className="bl-library__blurb">{ standing.collection.blurb }</p>
							</div>
							<button
								type="button"
								className="bl-library__setbtn"
								style={ {
									background: standing.collection.palette.accent,
									color: standing.collection.palette.accentInk,
								} }
								onClick={ () => mountSet( standing.collection ) }
							>
								{ __( 'Mount the whole set', 'blicks' ) }
							</button>
						</div>
					) }

					<div className="bl-library__grid">
						{ null === results &&
							[ 0, 1, 2, 3, 4, 5, 6, 7 ].map( ( bone ) => (
								<div key={ bone } className="bl-library__card bl-library__card--bone">
									<div className="bl-library__thumb" />
									<div className="bl-library__meta">
										<span className="bl-library__bonebar" />
									</div>
								</div>
							) ) }

						{ null !== results &&
							shown.map( ( entry ) => {
								const collection = collectionFrom( entry );

								// A marketplace entry is shown as the marketplace shows it: running, with its tags.
								if ( entry.frame ) {
									return (
										<MarketCard
											key={ entry.id }
											entry={ entry }
											opening={ opening === entry.id }
											onPreview={ () => setPreviewing( entry ) }
											onAdd={ () => mount( entry, onAdd ) }
											onOpen={ () => mount( entry ) }
										/>
									);
								}

								/*
								 * A card holds two actions, so it is not itself a button. They sit on
								 * the preview and show on hover or keyboard focus, so the shelf reads
								 * as pictures rather than forty pairs of buttons.
								 */
								return (
									<div key={ entry.id } className="bl-library__card">
										<span className="bl-library__acts">
											<button
												type="button"
												className="bl-library__act bl-library__act--add"
												disabled={ !! entry.locked }
												onClick={ () => mount( entry, onAdd ) }
											>
												{ __( 'Add', 'blicks' ) }
											</button>
											<button
												type="button"
												className="bl-library__act"
												disabled={ !! entry.locked }
												onClick={ () => mount( entry ) }
											>
												{ __( 'Open in Studio', 'blicks' ) }
											</button>
										</span>
										<span
											className="bl-library__thumb"
											style={
												collection
													? { background: collection.palette.ground }
													: undefined
											}
										>
											{ ! entry.blocks && entry.image && (
												<img className="bl-library__img" src={ entry.image } alt="" loading="lazy" />
											) }
											{ entry.tier === 'pro' && <span className="bl-library__tier">{ __( 'Pro', 'blicks' ) }</span> }
											{ opening === entry.id && <span className="bl-library__opening">{ __( 'Opening…', 'blicks' ) }</span> }
											{ entry.blocks && entry.blocks.length > 0 && LANGUAGES.length > 0 && (
												<PatternPreview blocks={ entry.blocks } css={ lensCss } />
											) }
											{ ( ! entry.blocks || 0 === LANGUAGES.length ) && ! entry.image && previewBars( entry.blocks ).map( ( bar, index ) => (
												<span
													key={ index }
													className={
														bar.lead
															? 'bl-library__bar2 bl-library__bar2--lead'
															: 'bl-library__bar2'
													}
													style={ {
														width: `${ bar.width }%`,
														height: `${ bar.height }%`,
														/*
														 * Painted from the set, not from a stored
														 * image. The lead bar takes the accent so
														 * each card has one focal point, exactly
														 * as the pattern it stands for does.
														 */
														background: collection
															? bar.lead
																? collection.palette.accent
																: collection.palette.raised
															: undefined,
														borderRadius: collection
															? collection.radius
															: undefined,
													} }
												/>
											) ) }
											{ entry.locked && (
												<span className="bl-library__locked">
													<svg
														viewBox="0 0 24 24"
														width="18"
														height="18"
														fill="none"
														stroke="currentColor"
														strokeWidth="1.7"
														aria-hidden="true"
													>
														<rect x="5" y="11" width="14" height="9" rx="2" />
														<path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
													</svg>
												</span>
											) }
										</span>
										<span className="bl-library__meta">
											<span className="bl-library__title">{ entry.title }</span>
											{ collection ? (
												<Swatch collection={ collection } size={ 7 } />
											) : (
												<span
													className={ `bl-library__badge bl-library__badge--${ entry.source }` }
												>
													{ SOURCES.find( ( s ) => s.id === entry.source )?.label }
												</span>
											) }
										</span>
										<span className="bl-library__shape">{ describe( entry.blocks ) }</span>
									</div>
								);
							} ) }
					</div>

					{ previewing && (
						<PreviewDialog
							entry={ previewing }
							onClose={ () => setPreviewing( null ) }
							onAdd={ () => {
								setPreviewing( null );
								mount( previewing, onAdd );
							} }
							onOpen={ () => {
								setPreviewing( null );
								mount( previewing );
							} }
						/>
					) }

					{ null !== results && 'none' !== empty && (
						<div className="bl-library__empty">
							{ 'first-run' === empty && (
								<>
									<p className="bl-library__emptyhead">
										{ __( 'No patterns yet', 'blicks' ) }
									</p>
									<p className="bl-library__emptybody">
										{ __(
											'Build something on a blank canvas and save it. Anything you save lands here, and only you can overwrite it.',
											'blicks'
										) }
									</p>
									<button
										type="button"
										className="bl-library__btn bl-library__btn--filled"
										onClick={ onBlank }
									>
										{ __( 'Start a blank canvas', 'blicks' ) }
									</button>
								</>
							) }

							{ 'no-results' === empty && (
								<>
									<p className="bl-library__emptyhead">
										{ sprintf(
											/* translators: %s: what was searched for. */
											__( 'Nothing matches “%s”', 'blicks' ),
											filter.query.trim()
										) }
									</p>
									<p className="bl-library__emptybody">
										{ __(
											'Searched names, kinds and collections across every source.',
											'blicks'
										) }
									</p>
									<button
										type="button"
										className="bl-library__btn"
										onClick={ () => narrow( { query: '' } ) }
									>
										{ __( 'Clear search', 'blicks' ) }
									</button>
								</>
							) }

							{ /*
							 * A combination nobody has a pattern for — "pricing, in Clinic". It is
							 * not a failure and not a dead search; the shelf simply does not go
							 * that narrow, and the fix is to widen one facet rather than to clear
							 * a search box nobody typed in.
							 */ }
							{ 'filtered-out' === empty && (
								<>
									<p className="bl-library__emptyhead">
										{ __( 'Nothing that narrow', 'blicks' ) }
									</p>
									<p className="bl-library__emptybody">
										{ __(
											'No pattern carries every one of those at once. Drop one and the shelf fills back up.',
											'blicks'
										) }
									</p>
									<button
										type="button"
										className="bl-library__btn"
										onClick={ () =>
											narrow( { collection: '', industry: '', kind: '' } )
										}
									>
										{ __( 'Clear the filters', 'blicks' ) }
									</button>
								</>
							) }

							{ 'source-empty' === empty && (
								<>
									<p className="bl-library__emptyhead">
										{ '' !== sourceError
											? sourceError
											: __( 'Nothing from this source yet', 'blicks' ) }
									</p>
									<p className="bl-library__emptybody">
										{ __(
											'The other sources are unaffected — this shelf is never blank because one of them did not answer.',
											'blicks'
										) }
									</p>
									{ sourceAction && (
										<a className="bl-library__btn" href={ sourceAction.href }>
											{ sourceAction.label }
										</a>
									) }
									<button
										type="button"
										className="bl-library__btn"
										onClick={ () => narrow( { source: 'all' } ) }
									>
										{ __( 'Show every source', 'blicks' ) }
									</button>
								</>
							) }
						</div>
					) }
				</main>
			</div>

			{ /*
			 * Import is a sheet rather than a third column.
			 *
			 * It is the other end of Copy JSON and people reach for it once, knowing exactly what
			 * they are doing. A permanent rail for it spent a fifth of the screen on the rarest
			 * action here, next to the shelf it has nothing to do with.
			 */ }
			{ importing && (
				<div className="bl-library__scrim" role="presentation" onClick={ () => setImporting( false ) }>
					<div
						className="bl-library__import"
						role="dialog"
						aria-label={ __( 'Mount block JSON', 'blicks' ) }
						onClick={ ( event ) => event.stopPropagation() }
					>
						<p className="bl-library__importhead">{ __( 'Paste block JSON', 'blicks' ) }</p>
						<p className="bl-library__importnote">
							{ __(
								'Copied from any Blicks site. It mounts straight into the Studio, and nothing is written to the page until you leave by Insert.',
								'blicks'
							) }
						</p>
						<textarea
							value={ paste }
							onChange={ ( event ) => setPaste( event.target.value ) }
							placeholder={ '{"name":"blicks/section", …' }
							aria-label={ __( 'Block JSON', 'blicks' ) }
							className="bl-library__paste"
						/>
						{ '' !== problem && <p className="bl-library__problem">{ problem }</p> }
						<div className="bl-library__importrow">
							<button
								type="button"
								className="bl-library__btn"
								onClick={ () => setImporting( false ) }
							>
								{ __( 'Cancel', 'blicks' ) }
							</button>
							<button
								type="button"
								className="bl-library__btn bl-library__btn--filled"
								onClick={ mountPaste }
								disabled={ '' === paste.trim() }
							>
								{ __( 'Mount JSON', 'blicks' ) }
							</button>
						</div>
					</div>
				</div>
			) }

			{ /*
			 * A pattern that would not mount. Shown outside the import sheet too, because the
			 * failure can come from a card nobody opened a sheet for.
			 */ }
			{ picker?.Picker && (
				<div className="bl-library__scrim" role="presentation" onClick={ () => setPicker( null ) }>
					<div
						className="bl-library__import"
						role="dialog"
						aria-label={ picker.label }
						onClick={ ( event ) => event.stopPropagation() }
					>
						<picker.Picker onStart={ pickerDone } onCancel={ () => setPicker( null ) } />
					</div>
				</div>
			) }

			{ ! importing && '' !== problem && (
				<p className="bl-library__problem bl-library__problem--loose" role="alert">
					{ problem }
				</p>
			) }
		</div>,
		document.body
	);
}
