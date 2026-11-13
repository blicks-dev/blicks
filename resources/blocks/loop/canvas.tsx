/**
 * The Loop on the editor canvas: the same list the page renders, with the first item as the live,
 * editable card (the template) and the rest as read-only previews of the same blocks with their own
 * item's values written in.
 *
 * Previews use core's block preview hook, the one core's Post Template uses for every post but
 * the active one. It is experimental, so it is reached only through `usePreviewProps` below.
 */
import { useContext, useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { cloneBlock, getBlockType } from '@wordpress/blocks';
import { BlockControls, __experimentalUseBlockPreview as useBlockPreview } from '@wordpress/block-editor';
import { ToolbarButton } from '@wordpress/components';
import { effects, resolve, slotSpan, type Effects, type Item, type Rule } from './data';
import { ITEM_SOURCE, usePreview, usePreviewPage, useLoopItems } from './use-items';
import { LoopItemContext, useRecordParentItem } from './item-context';
import { PagerPreview } from './pager-preview';
import { LoopCardShelf, closeCardShelf, isStarterCard, openCardShelf, toBlocks, useShelfView } from './card-shelf';
import { matchFields } from './cards';

const GAP: Record< string, string > = { sm: 'var(--blicks-spacing-sm, 0.75rem)', md: 'var(--blicks-spacing-md, 1rem)', lg: 'var(--blicks-spacing-lg, 1.5rem)' };
const LAYOUTS = [ 'grid', 'bento', 'list' ];
/** Previews drawn; the page shows every item up to the Loop's limit. */
const PREVIEWS = 11;

/** Text into a RichText (HTML) attribute: `&`, `<` and `>` encoded so the value stays text. */
export const escapeHTML = ( s: string ): string => s.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );

const cols = ( v: unknown, d: number ) => ( Number( v ) >= 1 && Number( v ) <= 6 ? Number( v ) : d );

export function loopLayout( attributes: any ): string {
	return LAYOUTS.includes( attributes.layout ) ? attributes.layout : 'grid';
}

/** The wrapper's classes and custom properties, as LoopRenderer::wrapper() writes them. */
export function loopVars( attributes: any ): Record< string, string > {
	const c = attributes.columns ?? {};
	const vars: Record< string, string > = {
		'--bl-loop-cols-d': String( cols( c.desktop, 3 ) ),
		'--bl-loop-cols-t': String( cols( c.tablet, 2 ) ),
		'--bl-loop-cols-p': String( cols( c.phone, 1 ) ),
		'--bl-loop-gap': GAP[ attributes.gap ] ?? GAP.md,
	};
	if ( loopLayout( attributes ) === 'bento' ) {
		vars[ '--bl-loop-row' ] = `${ Math.min( 480, Math.max( 80, Number( attributes.bento?.rowHeight ) || 180 ) ) }px`;
	}
	return vars;
}

/** The item list element's attributes for one item's effects. */
export function itemProps( fx: Effects, layout: string ): { className: string; style?: Record< string, string > } {
	const classes = [ 'bl-loop__item' ];
	for ( const kind of [ 'card', 'badge', 'heading' ] as const ) {
		if ( fx[ kind ] ) classes.push( `is-${ kind }-${ fx[ kind ] }` );
	}
	const [ c, r ] = layout === 'list' ? [ 1, 1 ] : fx.span;
	return {
		className: classes.join( ' ' ),
		style: c === 1 && r === 1 ? undefined : { '--bl-loop-c': String( c ), '--bl-loop-r': String( r ) },
	};
}

/** What the rules and the bento pattern give the item at `index`. */
export function itemEffects( attributes: any, item: Item, index: number ): Effects {
	const layout = loopLayout( attributes );
	const bento = attributes.bento ?? {};
	const span = layout === 'bento' ? slotSpan( Array.isArray( bento.tiles ) ? bento.tiles : [], index, bento.repeat !== false ) : [ 1, 1 ] as [ number, number ];
	return effects( Array.isArray( attributes.rules ) ? ( attributes.rules as Rule[] ) : [], item, index + 1, span );
}

/**
 * The card's blocks for one item: bound values written into their attributes, hidden blocks
 * removed — the editor's version of src/Data/Bindings.php, on block attributes instead of markup.
 */
export function bindBlocks( blocks: any[], item: Item, hide: string[] ): any[] {
	const out: any[] = [];
	for ( const block of blocks ) {
		const attrs = block.attributes ?? {};
		if ( attrs.uniqueId && hide.includes( attrs.uniqueId ) ) continue;
		// A Loop inside the card binds to its own items: copied as it is, as the page leaves it
		// (Bindings.php). It reads this item from the card it sits in (item-context.tsx).
		if ( block.name === 'blicks/loop' ) {
			out.push( cloneBlock( block ) );
			continue;
		}
		const bindings = attrs.metadata?.bindings ?? {};
		const next: Record< string, unknown > = {};
		let drop = false;
		const specs = ( getBlockType( block.name ) as any )?.attributes ?? {};
		for ( const [ attr, binding ] of Object.entries< any >( bindings ) ) {
			const spec = specs[ attr ]?.bindable;
			if ( ! spec || binding?.source !== 'blicks/item' ) continue;
			if ( spec.onlyIf && Object.entries( spec.onlyIf ).some( ( [ k, v ] ) => attrs[ k ] !== v ) ) continue;
			const { text } = resolve( item, binding.args ?? {}, spec.kind ?? 'text' );
			if ( spec.kind === 'image' && ! text ) drop = true;
			// Text attributes hold HTML (RichText), so a value is encoded to stay text — as the page
			// does when Bindings.php writes it into the saved markup.
			next[ attr ] = ( spec.kind ?? 'text' ) === 'text' ? escapeHTML( text ) : text;
		}
		if ( drop ) continue;
		out.push( cloneBlock( block, next, bindBlocks( block.innerBlocks ?? [], item, hide ) ) );
	}
	return out;
}

export function Preview( { blocks }: { blocks: any[] } ) {
	const props = usePreviewProps( blocks );
	return <div { ...props } />;
}

function usePreviewProps( blocks: any[] ): Record< string, unknown > {
	return useBlockPreview( { blocks, props: { className: 'bl-loop__preview' } } );
}

export function LoopCanvas( { attributes, blockProps, innerBlocksProps, clientId }: { attributes: any; blockProps: any; innerBlocksProps: any; clientId: string } ) {
	// The card this Loop sits in, if any: a Loop over a list of that card's item reads it.
	const parent = useContext( LoopItemContext );
	useRecordParentItem( clientId, parent );
	const nested = attributes.source === ITEM_SOURCE;
	const { data, error, loading } = useLoopItems( attributes, usePreviewPage( clientId ), parent );
	const items = data?.items ?? [];
	const index = usePreview( clientId, items.length );
	const template = useSelect( ( select: any ) => select( 'core/block-editor' ).getBlocks( clientId ), [ clientId ] );
	// The item dialog is a child too, but not part of the card: previews leave it out.
	const card = useMemo( () => template.filter( ( b: any ) => b.name !== 'blicks/dialog' ), [ template ] );
	const { selectBlock } = useDispatch( 'core/block-editor' ) as any;
	const layout = loopLayout( attributes );
	const view = useShelfView( clientId );
	const selected = useSelect( ( select: any ) => {
		const editor = select( 'core/block-editor' );
		return editor.isBlockSelected( clientId ) || editor.hasSelectedInnerBlock( clientId, true );
	}, [ clientId ] );
	// A new Loop offers its designs under the starter card; later the toolbar or sidebar opens them.
	const shelf = view.open ? 'grid' : selected && ! view.dismissed && isStarterCard( template ) ? 'wide' : null;
	// Bound here, with the fields as they are now: they may arrive after the pointer does.
	const fieldKeys = useMemo( () => ( data?.fields ?? [] ).map( ( f ) => f.key ), [ data ] );
	const ghost = useMemo( () => {
		const block = shelf && view.hover ? toBlocks( matchFields( view.hover, fieldKeys ) ) : null;
		return block ? [ block ] : null;
	}, [ shelf, view.hover, fieldKeys ] );
	const cardName: string | undefined = template[ 0 ]?.attributes?.metadata?.name;

	const className = [ blockProps.className, `bl-loop--${ layout }`, layout !== 'bento' && attributes.equalHeights === false ? 'bl-loop--top' : '' ].filter( Boolean ).join( ' ' );
	const style = { ...( blockProps.style ?? {} ), ...loopVars( attributes ) };

	let state: string | null = null;
	if ( nested && ! parent ) state = __( 'This Loop repeats over a list of the item above. Put it inside another Loop’s card.', 'blicks' );
	else if ( loading && ! data ) state = __( 'Loading the items…', 'blicks' );
	else if ( error ) state = error;
	else if ( ! items.length ) state = attributes.emptyText || __( 'No items to show. Check the Loop’s Data and Items settings.', 'blicks' );

	const current = items[ index ] ?? {};
	const templateFx = itemEffects( attributes, current, index );
	const previews = items.slice( 1, 1 + PREVIEWS );

	return (
		<div { ...blockProps } className={ className } style={ style }>
			{ data?.endpoint?.stale && (
				<p className="bl-loop__note">
					{ data.endpoint.error
						? sprintf( /* translators: %s: why the refresh failed. */ __( 'Showing the last good answer. The latest refresh failed: %s', 'blicks' ), data.endpoint.error )
						: __( 'Showing the last good answer while a fresh one is fetched.', 'blicks' ) }
				</p>
			) }
			<BlockControls group="other">
				<ToolbarButton isPressed={ view.open } onClick={ () => ( view.open ? closeCardShelf( clientId ) : openCardShelf( clientId ) ) }>
					{ cardName ? sprintf( /* translators: %s: card design name, e.g. "Feature card · Funky" */ __( 'Card: %s', 'blicks' ), cardName ) : __( 'Card design', 'blicks' ) }
				</ToolbarButton>
			</BlockControls>
			{ shelf === 'grid' && <LoopCardShelf clientId={ clientId } attributes={ attributes } layout="grid" /> }
			{ ghost && ! state && (
				// The design being pointed at, on every item, while the real card waits underneath.
				<ul className="bl-loop__items is-ghost" role="list" aria-hidden="true">
					{ items.slice( 0, 1 + PREVIEWS ).map( ( item, i ) => {
						const fx = itemEffects( attributes, item, i );
						const props = itemProps( fx, layout );
						return (
							<LoopItemContext.Provider key={ i } value={ item }>
								<li { ...props } className={ `${ props.className } is-preview` }>
									<Preview blocks={ bindBlocks( ghost, item, [] ) } />
								</li>
							</LoopItemContext.Provider>
						);
					} ) }
				</ul>
			) }
			<ul className="bl-loop__items" role="list" hidden={ !! ghost && ! state }>
				{ /* Each card hands its item to a Loop inside it: the live card the item it shows. */ }
				<LoopItemContext.Provider value={ items.length ? current : undefined }>
					<li { ...innerBlocksProps } { ...itemProps( templateFx, layout ) } className={ `${ itemProps( templateFx, layout ).className } ${ innerBlocksProps?.className ?? '' } is-template` } />
				</LoopItemContext.Provider>
				{ ! state && previews.map( ( item, i ) => {
					const fx = itemEffects( attributes, item, i + 1 );
					const props = itemProps( fx, layout );
					return (
						// A preview stands for the Loop: clicking it selects the Loop, not a block inside.
						<LoopItemContext.Provider key={ i } value={ item }>
						<li
							{ ...props }
							className={ `${ props.className } is-preview` }
							onClickCapture={ ( e ) => {
								e.preventDefault();
								e.stopPropagation();
								selectBlock( clientId );
							} }
						>
							<Preview blocks={ bindBlocks( card, item, fx.hide ) } />
						</li>
						</LoopItemContext.Provider>
					);
				} ) }
			</ul>
			{ state && <p className="bl-loop__state">{ state }</p> }
			<PagerPreview attributes={ attributes } data={ data } clientId={ clientId } />
			{ shelf === 'wide' && <LoopCardShelf clientId={ clientId } attributes={ attributes } layout="wide" /> }
		</div>
	);
}
