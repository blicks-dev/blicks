/**
 * The Loop's Settings panel: Kind (card design) · Layout · Link, then Data · Items · Pages · Card
 * rules · When there are no items.
 *
 * Built from the inspector kit like every v2 panel. Which screen a column count is set for follows
 * the editor's own device preview (Desktop / Tablet / Mobile in the top bar), so there is one
 * screen switcher, not two.
 */
import { useEffect, useMemo, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock, getBlockType } from '@wordpress/blocks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { Field, Note, Row, Sec, SegText, Select, Steps, SubView, Switch, type Option } from '@/framework/inspector-v2/kit';
import { ACTIONS, OPS, hits, type Rule } from './data';
import { setPreview, setPreviewPage, usePreview, usePreviewPage, useLoopItems } from './use-items';
import { DEFAULT_PER_PAGE, paging, type Pagination } from './pager';
import { loopLayout } from './canvas';
import { CardSec } from './card-picker';
import { isSourceId, loopSource, loopSources } from '@/framework/loop-sources';

const SOURCES: Option[] = [ [ 'json', __( 'Pasted', 'blicks' ) ], [ 'endpoint', __( 'Feed', 'blicks' ) ], [ 'query', __( 'WordPress', 'blicks' ) ] ];
const LAYOUTS: Option[] = [ [ 'grid', __( 'Grid', 'blicks' ) ], [ 'bento', __( 'Bento', 'blicks' ) ], [ 'list', __( 'List', 'blicks' ) ] ];
const GAPS: Option[] = [ [ 'sm', __( 'Small', 'blicks' ) ], [ 'md', __( 'Medium', 'blicks' ) ], [ 'lg', __( 'Large', 'blicks' ) ] ];
const COLS: Option[] = [ [ '1', '1' ], [ '2', '2' ], [ '3', '3' ], [ '4', '4' ] ];
const ROWS: Option[] = [ [ '1', '1' ], [ '2', '2' ], [ '3', '3' ] ];
const ROW_HEIGHTS: Option[] = [ [ '140', __( 'Small', 'blicks' ) ], [ '180', __( 'Medium', 'blicks' ) ], [ '240', __( 'Large', 'blicks' ) ] ];
const UP_DOWN: Option[] = [ [ 'asc', __( 'Up', 'blicks' ) ], [ 'desc', __( 'Down', 'blicks' ) ] ];
const OP_NAMES: Record< string, string > = {
	is: __( 'is', 'blicks' ),
	not: __( 'is not', 'blicks' ),
	has: __( 'contains', 'blicks' ),
	gt: __( 'is more than', 'blicks' ),
	lt: __( 'is less than', 'blicks' ),
	set: __( 'has a value', 'blicks' ),
	empty: __( 'is empty', 'blicks' ),
};
const FIELD_OPS: Option[] = OPS.map( ( op ) => [ op, OP_NAMES[ op ] ] );
const POSITION_OPS: Option[] = [ [ 'is', __( 'is number', 'blicks' ) ], [ 'every', __( 'is every', 'blicks' ) ], [ 'first', __( 'is in the first', 'blicks' ) ] ];
const ORDER_BY: Option[] = [ [ 'date', __( 'Published', 'blicks' ) ], [ 'modified', __( 'Last updated', 'blicks' ) ], [ 'title', __( 'Title', 'blicks' ) ], [ 'menu_order', __( 'Page order', 'blicks' ) ], [ 'comment_count', __( 'Comments', 'blicks' ) ], [ 'rand', __( 'Random', 'blicks' ) ] ];
const STICKY: Option[] = [ [ 'include', __( 'First', 'blicks' ) ], [ 'ignore', __( 'In order', 'blicks' ) ], [ 'only', __( 'Only', 'blicks' ) ] ];
const ACTION_NAMES: Record< string, string > = { size: __( 'Tile size', 'blicks' ), card: __( 'Card style', 'blicks' ), hide: __( 'Hide', 'blicks' ), badge: __( 'Badge color', 'blicks' ), heading: __( 'Heading size', 'blicks' ) };
const VALUE_NAMES: Record< string, string > = {
	'1x1': '1 × 1', '2x1': __( '2 × 1 wide', 'blicks' ), '1x2': __( '1 × 2 tall', 'blicks' ), '2x2': '2 × 2', '3x2': '3 × 2', '4x1': __( 'Full row', 'blicks' ),
	highlight: __( 'Highlight', 'blicks' ), dark: __( 'Dark', 'blicks' ), muted: __( 'Faded', 'blicks' ),
	brand: __( 'Brand', 'blicks' ), success: __( 'Green', 'blicks' ), warn: __( 'Orange', 'blicks' ), danger: __( 'Red', 'blicks' ),
	lg: __( 'Large', 'blicks' ), xl: __( 'Extra large', 'blicks' ),
};
const PAGE_MODES: Option[] = [ [ 'none', __( 'Off', 'blicks' ) ], [ 'pages', __( 'Numbers', 'blicks' ) ], [ 'more', __( 'Load more', 'blicks' ) ] ];
const PAGE_SHOWS: Option[] = [ [ 'numbers', __( 'Numbers', 'blicks' ) ], [ 'count', __( 'Page x of y', 'blicks' ) ] ];
const PAGE_LOOKS: Option[] = [ [ 'pills', __( 'Pills', 'blicks' ) ], [ 'boxes', __( 'Boxes', 'blicks' ) ], [ 'text', __( 'Text', 'blicks' ) ] ];
/** The Button block's own names for these looks (button/controls.tsx). */
const PAGE_BUTTONS: Option[] = [ [ 'default', __( 'Main', 'blicks' ) ], [ 'outline', __( 'Outline', 'blicks' ) ], [ 'secondary', __( 'Soft', 'blicks' ) ], [ 'ghost', __( 'Subtle', 'blicks' ) ] ];
const PAGE_ALIGNS: Option[] = [ [ 'start', __( 'Start', 'blicks' ) ], [ 'center', __( 'Center', 'blicks' ) ], [ 'end', __( 'End', 'blicks' ) ], [ 'between', __( 'Spread', 'blicks' ) ] ];
const DEVICE_KEY: Record< string, 'desktop' | 'tablet' | 'phone' > = { Desktop: 'desktop', Tablet: 'tablet', Mobile: 'phone' };
const DEVICE_NAME = { desktop: __( 'desktop', 'blicks' ), tablet: __( 'tablet', 'blicks' ), phone: __( 'phone', 'blicks' ) };

interface Endpoint { id: string; name: string; cache: string }

/** Settings → Data sources, in a new tab so the post's unsaved changes stay put. */
const DATA_SOURCES_URL = 'admin.php?page=blicks-settings#settings/data-sources';

/**
 * The endpoints an author can pick, read again whenever the editor regains focus: the link below
 * opens Settings in another tab, and an endpoint added there should be in this list on return.
 */
function useEndpoints(): Endpoint[] | null {
	const [ list, setList ] = useState< Endpoint[] | null >( null );
	useEffect( () => {
		let live = true;
		const load = (): void => {
			( apiFetch( { path: '/blicks/v1/data-endpoints' } ) as Promise< { endpoints: Endpoint[] } > )
				.then( ( r ) => live && setList( r.endpoints ) )
				.catch( () => live && setList( ( was ) => was ?? [] ) );
		};
		load();
		window.addEventListener( 'focus', load );
		return () => {
			live = false;
			window.removeEventListener( 'focus', load );
		};
	}, [] );
	return list;
}

/** The parse error of pasted JSON, with its line and column, or "". */
export function jsonProblem( text: string ): string {
	if ( ! text.trim() ) return '';
	try {
		JSON.parse( text );
		return '';
	} catch ( e: any ) {
		const at = /position (\d+)/.exec( String( e?.message ) );
		if ( ! at ) return __( 'This is not valid JSON.', 'blicks' );
		const before = text.slice( 0, Number( at[ 1 ] ) );
		return sprintf(
			/* translators: 1: line number, 2: column number */
			__( 'Not valid JSON near line %1$d, column %2$d.', 'blicks' ),
			before.split( '\n' ).length,
			Number( at[ 1 ] ) - before.lastIndexOf( '\n' )
		);
	}
}

/** A term filter as the field shows it. The server takes one slug or a list (QuerySource::taxQuery). */
const slugs = ( value: unknown ): string => ( Array.isArray( value ) ? value : typeof value === 'string' ? [ value ] : [] ).join( ', ' );

function DataSec( { attributes, setAttributes, clientId }: PanelProps ) {
	const { data, error, loading, refresh } = useLoopItems( attributes );
	const endpoints = useEndpoints();
	const [ draft, setDraft ] = useState< string >( attributes.data ?? '' );
	const problem = jsonProblem( draft );
	const source = attributes.source ?? 'json';
	const query = attributes.query ?? {};
	const setQuery = ( patch: Record< string, unknown > ) => setAttributes( { query: { ...query, ...patch } } );
	const canManage = useSelect( ( select: any ) => !! select( 'core' ).canUser?.( 'update', { kind: 'root', name: 'site' } ), [] );
	const fields: Option[] = ( data?.fields ?? [] ).map( ( f ) => [ f.key, f.key ] );
	const filter = attributes.filter ?? {};
	const registered = loopSource( source );
	const missing = ! registered && isSourceId( source );
	const sourceNote = registered
		? registered.note
		: missing
			? sprintf( /* translators: %s: a data source's id, e.g. "acme/trips" */ __( 'This Loop reads from %s, which a plugin adds. That plugin is not active, so the Loop shows nothing.', 'blicks' ), source )
			: {
				json: undefined,
				endpoint: __( 'The server fetches the feed and keeps the answer, so visitors never wait on the API.', 'blicks' ),
				query: __( 'Only published posts show, and only what visitors may see.', 'blicks' ),
			}[ source as 'json' | 'endpoint' | 'query' ];
	// Other plugins' sources after the built-ins; a missing one stays listed so the value still shows.
	const sourceOptions: Option[] = [
		...SOURCES,
		...loopSources().map( ( s ): Option => [ s.id, s.label ] ),
		...( missing ? [ [ source, source ] as Option ] : [] ),
	];
	const Settings = registered?.Settings;

	useEffect( () => setDraft( attributes.data ?? '' ), [ clientId ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Sec title={ __( 'Data', 'blicks' ) } icon="database" value={ data ? sprintf( /* translators: %d: items */ _n( '%d item', '%d items', data.total, 'blicks' ), data.total ) : '' }>
			<Row label={ __( 'Comes from', 'blicks' ) } stack set={ source !== 'json' } hint={ __( 'JSON · an endpoint · a WordPress query', 'blicks' ) } note={ sourceNote } noteIcon="info">
				<SegText label={ __( 'Where the items come from', 'blicks' ) } options={ sourceOptions } value={ source } onChange={ ( v ) => setAttributes( loopSource( v ) ? { source: v, sourceArgs: {} } : { source: v } ) } />
			</Row>

			{ Settings && (
				<Settings
					args={ ( attributes.sourceArgs ?? {} ) as Record< string, unknown > }
					setArgs={ ( sourceArgs ) => setAttributes( { sourceArgs } ) }
					attributes={ attributes }
				/>
			) }

			{ source === 'json' && (
				<Row label={ __( 'Pasted data', 'blicks' ) } stack hint="JSON" set={ !! attributes.data } note={ problem || __( 'Up to 256 KB. Values are shown as text, never as markup.', 'blicks' ) } noteIcon={ problem ? 'warning' : 'code' }>
					<div className="loop-json">
						<textarea
							className={ problem ? 'is-invalid' : '' }
							value={ draft }
							spellCheck={ false }
							rows={ 10 }
							aria-label={ __( 'Pasted data (JSON)', 'blicks' ) }
							placeholder='[ { "title": "…" } ]'
							onChange={ ( e ) => {
								const next = e.currentTarget.value;
								setDraft( next );
								// Only valid JSON (or nothing) is saved, so a half-typed edit never empties the Loop.
								if ( ! jsonProblem( next ) ) setAttributes( { data: next } );
							} }
						/>
					</div>
				</Row>
			) }

			{ source === 'endpoint' && (
				<>
					{ endpoints === null ? <Note>{ __( 'Loading feeds…', 'blicks' ) }</Note> : endpoints.length ? (
						<Row label={ __( 'Feed', 'blicks' ) } stack hint={ __( 'endpoint', 'blicks' ) } set={ !! attributes.endpoint }>
							<Select
								label={ __( 'Feed', 'blicks' ) }
								value={ attributes.endpoint ?? '' }
								options={ [ [ '', __( 'Choose a feed', 'blicks' ) ], ...endpoints.map( ( e ): Option => [ e.id, e.name ] ) ] }
								onChange={ ( endpoint ) => setAttributes( { endpoint } ) }
							/>
						</Row>
					) : (
						<Note>
							{ canManage ? (
								<>
									{ __( 'No feeds yet.', 'blicks' ) }{ ' ' }
									<a href={ DATA_SOURCES_URL } target="_blank" rel="noreferrer">{ __( 'Add one in Settings → Data sources', 'blicks' ) }</a>
								</>
							) : __( 'No feeds yet. Ask an administrator to add one in Blicks → Settings → Data sources.', 'blicks' ) }
						</Note>
					) }
					{ attributes.endpoint && (
						<button type="button" className="link-btn mt" onClick={ refresh } disabled={ loading }>
							{ loading ? __( 'Fetching…', 'blicks' ) : __( 'Refresh now', 'blicks' ) }
						</button>
					) }
					{ data?.endpoint?.fetchedAt ? <Note>{ sprintf( /* translators: %s: a time */ __( 'Fetched %s.', 'blicks' ), new Date( data.endpoint.fetchedAt * 1000 ).toLocaleTimeString() ) }</Note> : null }
				</>
			) }

			{ source === 'query' && (
				<>
					<Switch label={ __( 'Use the page’s own query', 'blicks' ) } hint={ __( 'For archive and search templates', 'blicks' ) } checked={ !! query.inherit } onChange={ ( inherit ) => setAttributes( { query: inherit ? { ...query, inherit: true } : { ...query, inherit: false } } ) } />
					{ ! query.inherit && (
						<>
							<Row label={ __( 'Kind of content', 'blicks' ) } hint={ __( 'post type', 'blicks' ) } set={ ( query.postType ?? 'post' ) !== 'post' }>
								<Field label={ __( 'Kind of content (post type)', 'blicks' ) } value={ query.postType ?? 'post' } placeholder="post" onChange={ ( postType ) => setQuery( { postType } ) } />
							</Row>
							<Row label={ __( 'Categories', 'blicks' ) } hint={ __( 'category slugs, separated by commas', 'blicks' ) } set={ !! slugs( query.taxonomy?.category ) }>
								<Field label={ __( 'Categories (slugs)', 'blicks' ) } value={ slugs( query.taxonomy?.category ) } placeholder={ __( 'Any category', 'blicks' ) } onChange={ ( v ) => setQuery( { taxonomy: { ...( query.taxonomy ?? {} ), category: v.split( ',' ).map( ( s ) => s.trim() ).filter( Boolean ) } } ) } />
							</Row>
							<Row label={ __( 'Tags', 'blicks' ) } hint={ __( 'tag slugs, separated by commas', 'blicks' ) } set={ !! slugs( query.taxonomy?.post_tag ) }>
								<Field label={ __( 'Tags (slugs)', 'blicks' ) } value={ slugs( query.taxonomy?.post_tag ) } placeholder={ __( 'Any tag', 'blicks' ) } onChange={ ( v ) => setQuery( { taxonomy: { ...( query.taxonomy ?? {} ), post_tag: v.split( ',' ).map( ( s ) => s.trim() ).filter( Boolean ) } } ) } />
							</Row>
							<Switch label={ __( 'Leave out the current page', 'blicks' ) } checked={ !! query.excludeCurrent } onChange={ ( excludeCurrent ) => setQuery( { excludeCurrent } ) } />
						</>
					) }
				</>
			) }

			{ source !== 'query' && data && data.lists.length > 1 && (
				<Row label={ __( 'List to loop over', 'blicks' ) } stack hint={ __( 'path in the JSON', 'blicks' ) } set={ !! attributes.path }>
					<Select
						label={ __( 'List to loop over', 'blicks' ) }
						value={ data.path }
						options={ data.lists.map( ( l ): Option => [ l.path, `${ l.path || __( '(the whole JSON)', 'blicks' ) } · ${ sprintf( /* translators: %d: items */ _n( '%d item', '%d items', l.count, 'blicks' ), l.count ) }` ] ) }
						onChange={ ( path ) => setAttributes( { path } ) }
					/>
				</Row>
			) }

			{ registered?.rules !== false && ! missing && (
			<>
			<Row label={ __( 'Only show', 'blicks' ) } stack set={ !! filter.field } note={ filter.field && data ? sprintf( /* translators: 1: matching, 2: total */ __( '%1$d of %2$d items match.', 'blicks' ), data.matched, data.total ) : undefined } noteIcon="info">
				<div className="row2">
					<Select label={ __( 'Only show', 'blicks' ) } value={ filter.field ?? '' } options={ [ [ '', __( 'Every item', 'blicks' ) ], ...fields ] } onChange={ ( field ) => setAttributes( { filter: field ? { field, op: filter.op ?? 'is', value: filter.value ?? '' } : undefined } ) } />
					{ filter.field && <Select label={ __( 'Comparison', 'blicks' ) } value={ filter.op ?? 'is' } options={ FIELD_OPS } onChange={ ( op ) => setAttributes( { filter: { ...filter, op } } ) } /> }
				</div>
			</Row>
			{ filter.field && ! [ 'set', 'empty' ].includes( filter.op ) && (
				<Row label={ __( 'Value', 'blicks' ) } set={ !! filter.value }>
					<Field label={ __( 'Value', 'blicks' ) } value={ String( filter.value ?? '' ) } placeholder={ __( 'Value', 'blicks' ) } onChange={ ( value ) => setAttributes( { filter: { ...filter, value } } ) } />
				</Row>
			) }
			</>
			) }

			{ error && <Note>{ error }</Note> }

			{ data && data.fields.length > 0 && (
				<ul className="loop-fields mt" aria-label={ __( 'Fields each item has', 'blicks' ) }>
					{ data.fields.map( ( f ) => (
						<li key={ f.key }><code>{ f.key }</code><small>{ f.type }</small></li>
					) ) }
				</ul>
			) }
		</Sec>
	);
}

function ItemsSec( { attributes, setAttributes, clientId }: PanelProps ) {
	const { data } = useLoopItems( attributes, usePreviewPage( clientId ) );
	const paged = !! paging( attributes );
	const count = data?.items.length ?? 0;
	const index = usePreview( clientId, count );
	const fields: Option[] = ( data?.fields ?? [] ).map( ( f ) => [ f.key, f.key ] );
	const sort = attributes.sort ?? {};
	const query = attributes.query ?? {};
	const setQuery = ( patch: Record< string, unknown > ) => setAttributes( { query: { ...query, ...patch } } );
	const ownQuery = attributes.source === 'query' && ! query.inherit;

	return (
		<Sec title={ __( 'Items', 'blicks' ) } icon="checklist" value={ data ? ( paged ? sprintf( /* translators: %d: items on each page */ __( '%d per page', 'blicks' ), data.perPage ) : sprintf( /* translators: 1: shown, 2: total */ __( '%1$d of %2$d', 'blicks' ), count, data.total ) ) : '' }>
			{ count > 0 && (
				<Row label={ __( 'Preview', 'blicks' ) }>
					<div className="loop-step">
						<button type="button" className="icon-btn sm" aria-label={ __( 'Previous item', 'blicks' ) } disabled={ index <= 0 } onClick={ () => setPreview( clientId!, index - 1 ) }>‹</button>
						<span>{ sprintf( /* translators: 1: item, 2: items */ __( 'Previewing item %1$d of %2$d', 'blicks' ), index + 1, count ) }</span>
						<button type="button" className="icon-btn sm" aria-label={ __( 'Next item', 'blicks' ) } disabled={ index >= count - 1 } onClick={ () => setPreview( clientId!, index + 1 ) }>›</button>
					</div>
				</Row>
			) }
			{ ! paged && (
				<Row label={ __( 'How many', 'blicks' ) } set={ ( attributes.limit ?? 6 ) !== 6 } note={ __( '0 shows every item, up to 50.', 'blicks' ) } noteIcon="info">
					<Field type="number" label={ __( 'How many to show', 'blicks' ) } value={ String( attributes.limit ?? 6 ) } onChange={ ( v ) => setAttributes( { limit: Math.max( 0, Math.min( 50, parseInt( v, 10 ) || 0 ) ) } ) } />
				</Row>
			) }
			<Row label={ __( 'Skip the first', 'blicks' ) } set={ !! attributes.offset } note={ paged ? __( 'Items per page are set under Pages. Skipping counts from the start of page 1.', 'blicks' ) : undefined } noteIcon="info">
				<Field type="number" label={ __( 'Skip the first', 'blicks' ) } value={ String( attributes.offset ?? 0 ) } onChange={ ( v ) => setAttributes( { offset: Math.max( 0, parseInt( v, 10 ) || 0 ) } ) } />
			</Row>

			{ ownQuery && (
				<Row label={ __( 'Order by', 'blicks' ) } stack set={ ( query.orderBy ?? 'date' ) !== 'date' || query.order === 'asc' }>
					<div className="row2">
						<Select label={ __( 'Order by', 'blicks' ) } value={ query.orderBy ?? 'date' } options={ ORDER_BY } onChange={ ( orderBy ) => setQuery( { orderBy } ) } />
						{ query.orderBy !== 'rand' && <SegText label={ __( 'Direction', 'blicks' ) } options={ UP_DOWN } value={ query.order === 'asc' ? 'asc' : 'desc' } onChange={ ( order ) => setQuery( { order } ) } /> }
					</div>
				</Row>
			) }
			{ ownQuery && ( query.postType ?? 'post' ) === 'post' && (
				<Row label={ __( 'Sticky posts', 'blicks' ) } set={ ( query.sticky ?? 'include' ) !== 'include' } stack>
					<SegText label={ __( 'Sticky posts', 'blicks' ) } options={ STICKY } value={ query.sticky ?? 'include' } onChange={ ( sticky ) => setQuery( { sticky } ) } />
				</Row>
			) }

			{ attributes.source !== 'query' && ! loopSource( attributes.source )?.ordersItself && ! ( isSourceId( attributes.source ) && ! loopSource( attributes.source ) ) && (
				<Row label={ __( 'Order by', 'blicks' ) } stack set={ !! sort.field }>
					<div className="row2">
						<Select label={ __( 'Order by', 'blicks' ) } value={ sort.field ?? '' } options={ [ [ '', __( 'As the data lists them', 'blicks' ) ], ...fields ] } onChange={ ( field ) => setAttributes( { sort: field ? { field, dir: sort.dir ?? 'asc' } : undefined } ) } />
						{ sort.field && <SegText label={ __( 'Direction', 'blicks' ) } options={ UP_DOWN } value={ sort.dir === 'desc' ? 'desc' : 'asc' } onChange={ ( dir ) => setAttributes( { sort: { ...sort, dir } } ) } /> }
					</div>
				</Row>
			) }
		</Sec>
	);
}

/**
 * Pages: split the items into page links or a Load more button (src/Data/Pager.php). Items per
 * page is the Loop's limit; a Loop on the page's own query takes the archive's instead.
 */
function PagesSec( { attributes, setAttributes, clientId, onWords }: PanelProps & { onWords: () => void } ) {
	const settings = paging( attributes );
	const pagination: Pagination = attributes.pagination ?? {};
	const { data } = useLoopItems( attributes, usePreviewPage( clientId ) );
	const inherit = attributes.source === 'query' && !! attributes.query?.inherit;
	const labels = pagination.labels ?? {};
	const restart = () => clientId && setPreviewPage( clientId, 1 );
	const set = ( patch: Partial< Pagination > ) => setAttributes( { pagination: { ...pagination, ...patch } } );
	const wordsSet = Object.keys( labels ).length > 0;
	const words = settings?.mode === 'pages'
		? `${ labels.prev || __( 'Previous', 'blicks' ) } · ${ labels.next || __( 'Next', 'blicks' ) }`
		: labels.more || __( 'Load more', 'blicks' );

	return (
		<Sec
			title={ __( 'Pages', 'blicks' ) }
			icon="last_page"
			value={ settings ? sprintf( /* translators: 1: Numbers or Load more, 2: how many pages */ __( '%1$s · %2$s', 'blicks' ), PAGE_MODES.find( ( m ) => m[ 0 ] === settings.mode )?.[ 1 ] ?? '', sprintf( /* translators: %d: pages */ _n( '%d page', '%d pages', data?.pages ?? 1, 'blicks' ), data?.pages ?? 1 ) ) : __( 'Off', 'blicks' ) }
		>
			<Row
				label={ __( 'Pages', 'blicks' ) }
				stack
				set={ !! settings }
				noteIcon="info"
				note={ ! settings
					? __( 'Off: the Loop shows its first items, up to 50. Numbers or Load more show every item, a page at a time.', 'blicks' )
					: inherit
						? ( data ? sprintf( /* translators: %d: posts per page */ __( 'Pages follow the archive: %d per page, from Settings → Reading, at its own /page/2/ addresses.', 'blicks' ), data.perPage ) : __( 'Pages follow the archive: its posts per page, at its own /page/2/ addresses.', 'blicks' ) )
						: undefined }
			>
				<SegText
					label={ __( 'Pages', 'blicks' ) }
					options={ PAGE_MODES }
					value={ settings?.mode ?? 'none' }
					onChange={ ( mode ) => {
						restart();
						setAttributes( { pagination: mode === 'none' ? undefined : { ...pagination, mode: mode as Pagination[ 'mode' ] } } );
					} }
				/>
			</Row>

			{ settings && (
				<>
					{ ! inherit && (
						<Row
							label={ __( 'Per page', 'blicks' ) }
							set={ attributes.limit > 0 && attributes.limit !== DEFAULT_PER_PAGE }
							noteIcon="info"
							note={ data ? sprintf( /* translators: 1: pages, 2: items */ __( '%1$d pages of %2$d items. Each page has its own address, so it can be shared and Back works.', 'blicks' ), data.pages, data.found ) : __( 'Each page has its own address, so it can be shared and Back works.', 'blicks' ) }
						>
							<Field
								type="number"
								label={ __( 'Per page', 'blicks' ) }
								value={ String( attributes.limit > 0 ? Math.min( 50, attributes.limit ) : DEFAULT_PER_PAGE ) }
								onChange={ ( v ) => {
									restart();
									setAttributes( { limit: Math.max( 1, Math.min( 50, parseInt( v, 10 ) || 1 ) ) } );
								} }
							/>
						</Row>
					) }

					{ settings.mode === 'pages' && (
						<>
							<Row label={ __( 'Show', 'blicks' ) } set={ ( pagination.show ?? 'numbers' ) !== 'numbers' }>
								<SegText label={ __( 'Show', 'blicks' ) } options={ PAGE_SHOWS } value={ pagination.show ?? 'numbers' } onChange={ ( show ) => set( { show: show as Pagination[ 'show' ] } ) } />
							</Row>
							<Row label={ __( 'Look', 'blicks' ) } set={ ( pagination.look ?? 'pills' ) !== 'pills' }>
								<SegText label={ __( 'Look', 'blicks' ) } options={ PAGE_LOOKS } value={ pagination.look ?? 'pills' } onChange={ ( look ) => set( { look: look as Pagination[ 'look' ] } ) } />
							</Row>
						</>
					) }

					{ settings.mode === 'more' && (
						<>
							<Row label={ __( 'Button', 'blicks' ) } set={ ( pagination.button ?? 'outline' ) !== 'outline' } note={ __( 'The looks of the Button block, from your design system.', 'blicks' ) } noteIcon="north_west">
								<Select label={ __( 'Button', 'blicks' ) } value={ pagination.button ?? 'outline' } options={ PAGE_BUTTONS } onChange={ ( button ) => set( { button: button as Pagination[ 'button' ] } ) } />
							</Row>
							<Switch
								label={ __( 'Load as the visitor scrolls', 'blicks' ) }
								hint={ __( 'After 3 loads the button comes back, so the footer stays reachable.', 'blicks' ) }
								checked={ !! pagination.infinite }
								onChange={ ( infinite ) => set( { infinite } ) }
							/>
						</>
					) }

					<Row label={ __( 'Line up', 'blicks' ) } stack set={ ( pagination.align ?? 'center' ) !== 'center' }>
						<SegText label={ __( 'Line up', 'blicks' ) } options={ PAGE_ALIGNS } value={ pagination.align ?? 'center' } onChange={ ( align ) => set( { align: align as Pagination[ 'align' ] } ) } />
					</Row>

					<Row label={ __( 'Words', 'blicks' ) } set={ wordsSet } action={ { label: wordsSet ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: onWords } }>
						<span>{ words }</span>
					</Row>
				</>
			) }
		</Sec>
	);
}

/** The Pages section's words, in a SubView: the link and button text, and the name read out. */
function PageWords( { attributes, setAttributes }: PanelProps ) {
	const settings = paging( attributes );
	const pagination: Pagination = attributes.pagination ?? {};
	const labels = pagination.labels ?? {};
	const setLabel = ( key: keyof NonNullable< Pagination[ 'labels' ] > ) => ( value: string ) => {
		const next = { ...labels, [ key ]: value };
		if ( ! value ) delete next[ key ];
		setAttributes( { pagination: { ...pagination, labels: next } } );
	};
	const label = ( key: keyof NonNullable< Pagination[ 'labels' ] >, name: string, placeholder: string, note?: string ) => (
		<Row label={ name } stack set={ !! labels[ key ] } note={ note } noteIcon="info">
			<Field label={ name } value={ labels[ key ] ?? '' } placeholder={ placeholder } onChange={ setLabel( key ) } />
		</Row>
	);

	return settings?.mode === 'more' ? (
		<>
			{ label( 'more', __( 'Button text', 'blicks' ), __( 'Load more', 'blicks' ) ) }
			{ label( 'status', __( 'Count', 'blicks' ), __( 'Showing {shown} of {total}', 'blicks' ), __( '{shown} and {total} are filled in. The count is read aloud after each load.', 'blicks' ) ) }
		</>
	) : (
		<>
			{ label( 'prev', __( 'Previous', 'blicks' ), __( 'Previous', 'blicks' ) ) }
			{ label( 'next', __( 'Next', 'blicks' ), __( 'Next', 'blicks' ) ) }
			{ label( 'nav', __( 'Name for screen readers', 'blicks' ), __( 'Pages', 'blicks' ) ) }
		</>
	);
}

/** The bento pattern, in a SubView opened from Layout: the tiles in order, and the selected one's size. */
function BentoEditor( { attributes, setAttributes }: PanelProps ) {
	const bento = attributes.bento ?? {};
	const tiles: string[] = Array.isArray( bento.tiles ) && bento.tiles.length ? bento.tiles : [ '1x1' ];
	const [ sel, setSel ] = useState( 0 );
	const at = Math.min( sel, tiles.length - 1 );
	const [ w, h ] = tiles[ at ].split( 'x' );
	const setTiles = ( next: string[] ) => setAttributes( { bento: { ...bento, tiles: next } } );
	const setTile = ( cw: string, rh: string ) => setTiles( tiles.map( ( t, i ) => ( i === at ? `${ cw }x${ rh }` : t ) ) );

	return (
		<>
			<Row label={ __( 'Tiles', 'blicks' ) } stack set={ tiles.length > 1 || tiles[ 0 ] !== '1x1' } note={ __( 'Tiles in order. Choose one to size it.', 'blicks' ) } noteIcon="info">
				<div className="loop-pat" role="group" aria-label={ __( 'Bento pattern', 'blicks' ) }>
					{ tiles.map( ( t, i ) => {
						const [ c, r ] = t.split( 'x' );
						return (
							<button key={ i } type="button" aria-pressed={ i === at } style={ { gridColumn: `span ${ c }`, gridRow: `span ${ r }` } } onClick={ () => setSel( i ) }
								aria-label={ sprintf( /* translators: 1: tile, 2: width, 3: height */ __( 'Tile %1$d, %2$s by %3$s', 'blicks' ), i + 1, c, r ) }>
								{ i + 1 }
							</button>
						);
					} ) }
					<button type="button" className="add" aria-label={ __( 'Add a tile', 'blicks' ) } onClick={ () => {
						setTiles( [ ...tiles, '1x1' ] );
						setSel( tiles.length );
					} }>+</button>
				</div>
				{ tiles.length > 1 && (
					<button type="button" className="link-btn mt" onClick={ () => {
						setTiles( tiles.filter( ( _, i ) => i !== at ) );
						setSel( Math.max( 0, at - 1 ) );
					} }>{ sprintf( /* translators: %d: tile */ __( 'Remove tile %d', 'blicks' ), at + 1 ) }</button>
				) }
			</Row>
			<Row label={ sprintf( /* translators: %d: tile */ __( 'Tile %d wide', 'blicks' ), at + 1 ) } set={ w !== '1' }>
				<SegText label={ __( 'Columns the tile spans', 'blicks' ) } options={ COLS } value={ w } onChange={ ( v ) => setTile( v, h ) } />
			</Row>
			<Row label={ sprintf( /* translators: %d: tile */ __( 'Tile %d tall', 'blicks' ), at + 1 ) } set={ h !== '1' }>
				<SegText label={ __( 'Rows the tile spans', 'blicks' ) } options={ ROWS } value={ h } onChange={ ( v ) => setTile( w, v ) } />
			</Row>
			<Row label={ __( 'Row height', 'blicks' ) } stack set={ ( bento.rowHeight ?? 180 ) !== 180 }>
				<SegText label={ __( 'Row height', 'blicks' ) } options={ ROW_HEIGHTS } value={ String( bento.rowHeight ?? 180 ) } onChange={ ( v ) => setAttributes( { bento: { ...bento, tiles, rowHeight: Number( v ) } } ) } />
			</Row>
			<Switch label={ __( 'Repeat the pattern', 'blicks' ) } hint={ sprintf( /* translators: %d: tiles */ __( 'Off: items after tile %d are 1 × 1', 'blicks' ), tiles.length ) } checked={ bento.repeat !== false } onChange={ ( repeat ) => setAttributes( { bento: { ...bento, tiles, repeat } } ) } />
		</>
	);
}

/** The editor's preview device, which Columns is set for. */
function usePreviewDevice(): 'desktop' | 'tablet' | 'phone' {
	return useSelect( ( select: any ) => DEVICE_KEY[ select( 'core/editor' )?.getDeviceType?.() ?? 'Desktop' ] ?? 'desktop', [] );
}

const loopColumns = ( attributes: any ) => ( { desktop: 3, tablet: 2, phone: 1, ...( attributes.columns ?? {} ) } );

function LayoutSec( { attributes, setAttributes, onBento }: PanelProps & { onBento: () => void } ) {
	const layout = loopLayout( attributes );
	const device = usePreviewDevice();
	const columns = loopColumns( attributes );
	const tiles: number = Array.isArray( attributes.bento?.tiles ) && attributes.bento.tiles.length ? attributes.bento.tiles.length : 1;

	return (
		<Sec title={ __( 'Layout', 'blicks' ) } icon="dashboard" value={ LAYOUTS.find( ( l ) => l[ 0 ] === layout )?.[ 1 ] }>
			<Row
				label={ __( 'Arrange', 'blicks' ) }
				stack
				set={ layout !== 'grid' }
				note={ layout === 'bento' ? sprintf( /* translators: %d: tiles */ _n( '%d tile in the pattern', '%d tiles in the pattern', tiles, 'blicks' ), tiles ) : undefined }
				action={ layout === 'bento' ? { label: __( 'Customize', 'blicks' ), run: onBento } : undefined }
			>
				<SegText label={ __( 'Arrange', 'blicks' ) } options={ LAYOUTS } value={ layout } onChange={ ( v ) => setAttributes( { layout: v } ) } />
			</Row>
			{ layout !== 'list' && (
				<Row
					label={ sprintf( /* translators: %s: desktop, tablet or phone */ __( 'Columns on %s', 'blicks' ), DEVICE_NAME[ device ] ) }
					stack
					set={ attributes.columns?.[ device ] !== undefined }
					noteIcon="smartphone"
					note={ sprintf( /* translators: 1: desktop, 2: tablet, 3: phone columns */ __( '%1$d on desktop, %2$d on tablet, %3$d on phone. Switch the preview device to set each.', 'blicks' ), columns.desktop, columns.tablet, columns.phone ) }
				>
					<Steps label={ __( 'Columns', 'blicks' ) } options={ COLS } value={ String( columns[ device ] ) } onChange={ ( v ) => setAttributes( { columns: { ...columns, [ device ]: Number( v ) } } ) } />
				</Row>
			) }
			<Row label={ __( 'Space between', 'blicks' ) } stack hint="gap" set={ ( attributes.gap ?? 'md' ) !== 'md' }>
				<Steps label={ __( 'Space between', 'blicks' ) } options={ GAPS } value={ attributes.gap ?? 'md' } onChange={ ( gap ) => setAttributes( { gap } ) } />
			</Row>
			{ layout !== 'bento' && <Switch label={ __( 'Same height in a row', 'blicks' ) } checked={ attributes.equalHeights !== false } onChange={ ( equalHeights ) => setAttributes( { equalHeights } ) } /> }
		</Sec>
	);
}

/** The card's blocks, and the item dialog's, for "Hide" in a rule: every block with a uniqueId, named by its type. */
function useCardBlocks( clientId: string | undefined ): Option[] {
	const blocks = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlocks( clientId ) : [] ), [ clientId ] );
	return useMemo( () => {
		const out: Option[] = [];
		const walk = ( list: any[], depth: number, prefix: string ) => {
			for ( const b of list ) {
				if ( b.attributes?.uniqueId && depth > 0 ) {
					const title = ( getBlockType( b.name ) as any )?.title ?? b.name;
					const label = b.attributes.metadata?.name || title;
					out.push( [ b.attributes.uniqueId, `${ prefix }${ '· '.repeat( depth - 1 ) }${ label }` ] );
				}
				/* translators: prefix for a block in a Loop's item dialog, in the Hide list of a card rule */
				walk( b.innerBlocks ?? [], depth + 1, depth === 0 && b.name === 'blicks/dialog' ? __( 'Dialog › ', 'blicks' ) : prefix );
			}
		};
		walk( blocks, 0, '' );
		return out;
	}, [ blocks ] );
}

function RulesSec( { attributes, setAttributes, clientId }: PanelProps ) {
	const { data } = useLoopItems( attributes );
	const rules: Rule[] = Array.isArray( attributes.rules ) ? attributes.rules : [];
	const fields: Option[] = ( data?.fields ?? [] ).map( ( f ) => [ f.key, f.key ] );
	const cardBlocks = useCardBlocks( clientId );
	const setRules = ( next: Rule[] ) => setAttributes( { rules: next } );
	const setRule = ( i: number, rule: Rule ) => setRules( rules.map( ( r, k ) => ( k === i ? rule : r ) ) );
	const valuesFor = ( type: string ): Option[] => ( type === 'hide' ? cardBlocks : ( ACTIONS as any )[ type ].map( ( v: string ): Option => [ v, VALUE_NAMES[ v ] ?? v ] ) );

	return (
		<Sec title={ __( 'Card rules', 'blicks' ) } icon="rule" value={ rules.length ? sprintf( /* translators: %d: rules */ _n( '%d rule', '%d rules', rules.length, 'blicks' ), rules.length ) : '' }>
			{ rules.map( ( rule, i ) => {
				const when = rule.when ?? {};
				const byPosition = when.position !== undefined;
				const subject = byPosition ? '__position' : when.field ?? '';
				const op = byPosition ? when.position : when.op ?? 'is';
				const matching = data ? data.items.filter( ( item, k ) => hits( rule, item, k + 1 ) ).length : 0;
				return (
					<div className="loop-rule" key={ i }>
						<div className="loop-rule__h">
							<b>{ sprintf( /* translators: %d: rule */ __( 'Rule %d', 'blicks' ), i + 1 ) }</b>
							{ data && <small>{ sprintf( /* translators: 1: matching, 2: items */ __( '%1$d of %2$d items', 'blicks' ), matching, data.items.length ) }</small> }
							<button type="button" className="link-btn" onClick={ () => setRules( rules.filter( ( _, k ) => k !== i ) ) }>{ __( 'Remove', 'blicks' ) }</button>
						</div>
						<Row label={ __( 'When', 'blicks' ) } stack set={ !! subject }>
							<Select label={ __( 'When', 'blicks' ) } value={ subject } options={ [ [ '', __( 'Choose what to check', 'blicks' ) ], [ '__position', __( 'Position', 'blicks' ) ], ...fields ] }
								onChange={ ( v ) => setRule( i, { ...rule, when: v === '__position' ? { position: 'is', value: 1 } : v ? { field: v, op: 'is', value: '' } : {} } ) } />
							{ subject && (
								<div className="row2 mt">
									<Select label={ __( 'Comparison', 'blicks' ) } value={ String( op ) } options={ byPosition ? POSITION_OPS : FIELD_OPS }
										onChange={ ( v ) => setRule( i, { ...rule, when: byPosition ? { ...when, position: v } : { ...when, op: v } } ) } />
									{ ( byPosition || ! [ 'set', 'empty' ].includes( String( op ) ) ) && (
										<Field label={ __( 'Value', 'blicks' ) } value={ String( when.value ?? '' ) } placeholder={ byPosition ? '1' : __( 'Value', 'blicks' ) }
											onChange={ ( value ) => setRule( i, { ...rule, when: { ...when, value: byPosition ? Math.max( 1, parseInt( value, 10 ) || 1 ) : value } } ) } />
									) }
								</div>
							) }
						</Row>
						{ ( rule.then ?? [] ).map( ( action, j ) => {
							const [ type, value ] = Object.entries( action )[ 0 ] ?? [ 'card', 'highlight' ];
							return (
								<Row key={ j } label={ j ? __( 'And', 'blicks' ) : __( 'Then', 'blicks' ) } stack set>
									<div className="row2">
										<Select label={ j ? __( 'And', 'blicks' ) : __( 'Then', 'blicks' ) } value={ type } options={ Object.keys( ACTION_NAMES ).map( ( k ): Option => [ k, ACTION_NAMES[ k ] ] ) }
											onChange={ ( t ) => setRule( i, { ...rule, then: ( rule.then ?? [] ).map( ( a, k ) => ( k === j ? { [ t ]: valuesFor( t )[ 0 ]?.[ 0 ] ?? '' } : a ) ) } ) } />
										<Select label={ __( 'Change to', 'blicks' ) } value={ value } options={ valuesFor( type ) }
											onChange={ ( v ) => setRule( i, { ...rule, then: ( rule.then ?? [] ).map( ( a, k ) => ( k === j ? { [ type ]: v } : a ) ) } ) } />
										<button type="button" className="icon-btn sm" aria-label={ __( 'Remove this change', 'blicks' ) } onClick={ () => setRule( i, { ...rule, then: ( rule.then ?? [] ).filter( ( _, k ) => k !== j ) } ) }>×</button>
									</div>
								</Row>
							);
						} ) }
						<button type="button" className="link-btn mt" onClick={ () => setRule( i, { ...rule, then: [ ...( rule.then ?? [] ), { card: 'highlight' } ] } ) }>{ __( 'Add a change', 'blicks' ) }</button>
					</div>
				);
			} ) }
			<button type="button" className="link-btn mt" disabled={ rules.length >= 12 } onClick={ () => setRules( [ ...rules, { when: {}, then: [ { card: 'highlight' } ] } ] ) }>{ __( 'Add a rule', 'blicks' ) }</button>
			<Note>{ __( 'Rules run top to bottom; the lower one wins when two change the same thing. Position counts from 1 after sorting and filtering.', 'blicks' ) }</Note>
		</Sec>
	);
}

function EmptySec( { attributes, setAttributes }: PanelProps ) {
	return (
		<Sec title={ __( 'When there are no items', 'blicks' ) } icon="inbox" value={ attributes.emptyText ? __( 'Message', 'blicks' ) : __( 'Nothing', 'blicks' ) }>
			<Row label={ __( 'Message', 'blicks' ) } stack set={ !! attributes.emptyText } note={ __( 'Left blank, the Loop shows nothing when no items match.', 'blicks' ) } noteIcon="info">
				<Field label={ __( 'Message', 'blicks' ) } value={ attributes.emptyText ?? '' } placeholder={ __( 'Nothing to show yet.', 'blicks' ) } onChange={ ( emptyText ) => setAttributes( { emptyText } ) } />
			</Row>
		</Sec>
	);
}

/**
 * Cards open a dialog: a Dialog among the Loop's children is what a card's link opens, filled with
 * that card's item (LoopRenderer renders it per item; the dialog behaviour copies it in). Its
 * blocks bind to item fields like the card's do. A click action, so it lives in Link.
 */
function DialogSec( { attributes, setAttributes, clientId }: PanelProps ) {
	const dialog = useSelect(
		( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlocks( clientId ) : [] ).find( ( b: any ) => b.name === 'blicks/dialog' ) ?? null,
		[ clientId ]
	);
	const { insertBlock, removeBlock, selectBlock } = useDispatch( 'core/block-editor' ) as any;
	const bound = ( key: string ) => ( { bindings: { content: { source: 'blicks/item', args: { key } } } } );

	const set = ( on: boolean ) => {
		if ( ! clientId ) return;
		if ( ! on ) {
			if ( dialog ) removeBlock( dialog.clientId, false );
			return;
		}
		if ( dialog ) return;
		insertBlock(
			createBlock( 'blicks/dialog', { title: __( 'Item preview', 'blicks' ), anchor: 'item-preview' }, [
				createBlock( 'blicks/heading', { level: 2, content: __( 'Item title', 'blicks' ), metadata: bound( 'title' ) } ),
			] ),
			undefined,
			clientId,
			false
		);
	};

	return (
		<Sec title={ __( 'Link', 'blicks' ) } icon="link" value={ dialog ? __( 'A dialog', 'blicks' ) : __( 'Their link', 'blicks' ) }>
			<Switch
				label={ __( 'Cards open a dialog', 'blicks' ) }
				hint={ __( 'A card’s link opens a dialog with that item’s fields. Without JavaScript, or with Ctrl or Cmd held, it still goes to the item.', 'blicks' ) }
				checked={ !! dialog }
				onChange={ set }
			/>
			{ dialog && (
				<Switch
					label={ __( 'Put the item in the address', 'blicks' ) }
					hint={ __( 'Adds ?item= to the address while the dialog is open, so it can be shared, and Back closes it.', 'blicks' ) }
					checked={ !! attributes.itemInUrl }
					onChange={ ( itemInUrl: boolean ) => setAttributes( { itemInUrl } ) }
				/>
			) }
			{ dialog && (
				<button type="button" className="link-btn mt" onClick={ () => selectBlock( dialog.clientId ) }>
					{ __( 'Edit the dialog', 'blicks' ) }
				</button>
			) }
		</Sec>
	);
}

/**
 * The Loop's Settings panel, in the inspector's fixed order: Data (in the Content slot) · Kind (the
 * card design) · Layout · Link (cards open a dialog), then the Loop's own sections — Items · Pages ·
 * Card rules · When there are no items. The bento pattern and the page words open as SubViews.
 */
export function LoopSettings( props: PanelProps ) {
	const [ sub, setSub ] = useState< null | 'bento' | 'words' >( null );
	const back = () => setSub( null );

	if ( sub === 'bento' ) {
		return <SubView title={ __( 'Bento tiles', 'blicks' ) } onBack={ back }><BentoEditor { ...props } /></SubView>;
	}
	if ( sub === 'words' ) {
		return <SubView title={ __( 'Page words', 'blicks' ) } onBack={ back }><PageWords { ...props } /></SubView>;
	}

	return (
		<>
			{ /* Data is the Loop's content, so it takes the Content slot at the top of the fixed order. */ }
			<DataSec { ...props } />
			<CardSec { ...props } />
			<LayoutSec { ...props } onBento={ () => setSub( 'bento' ) } />
			<DialogSec { ...props } />
			{ /* The Loop's own sections, after the fixed ones. */ }
			<ItemsSec { ...props } />
			<PagesSec { ...props } onWords={ () => setSub( 'words' ) } />
			<RulesSec { ...props } />
			<EmptySec { ...props } />
		</>
	);
}

/**
 * The Loop's toolbar: Layout and, for a grid or bento, Columns on the preview device — the writes
 * its Settings Layout section makes. Card design stays on the canvas toolbar (canvas.tsx).
 */
export function LoopToolbar( { attributes, setAttributes }: PanelProps ) {
	const layout = loopLayout( attributes );
	const device = usePreviewDevice();
	const columns = loopColumns( attributes );
	return (
		<ToolbarGroup>
			<ToolbarChoice label={ __( 'Layout', 'blicks' ) } value={ layout } options={ LAYOUTS } onChange={ ( v ) => setAttributes( { layout: v } ) } />
			{ layout !== 'list' && (
				<ToolbarChoice
					label={ sprintf( /* translators: %s: desktop, tablet or phone */ __( 'Columns on %s', 'blicks' ), DEVICE_NAME[ device ] ) }
					value={ String( columns[ device ] ) }
					options={ COLS.map( ( [ v ] ) => [ v, sprintf( /* translators: %s: number of columns */ _n( '%s column', '%s columns', Number( v ), 'blicks' ), v ) ] as const ) }
					onChange={ ( v ) => setAttributes( { columns: { ...columns, [ device ]: Number( v ) } } ) }
				/>
			) }
		</ToolbarGroup>
	);
}
