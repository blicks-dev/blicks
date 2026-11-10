/**
 * The dialog mode's rail tabs: Content, Style, Triggers and Rules (the prototype's main frame).
 *
 * Content and Style write the root `blicks/dialog` block's attributes in the mounted tree, so they
 * are ordinary edits with Undo. Triggers and Rules are the saved dialog's own settings (post meta
 * and status): they are a draft kept beside the tree (`drafts.ts`) and written with it on Save.
 */
import { Button, CheckboxControl, SelectControl, TextControl, ToggleControl } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { dialogRef, studio, type PanelProps } from './host';
import { patchDraft, useDraft, type Draft } from './drafts';
import { places, type Frequency, type Rules, type Triggers, type Visitors } from './settings';
import { summary } from './summary';

type Attrs = Record< string, unknown >;

/** The root dialog and a setter for its attributes. */
function useDialog( blocks: PanelProps[ 'blocks' ] ): { clientId: string; attributes: Attrs; set: ( a: Attrs ) => void } | null {
	const root = blocks[ 0 ];
	const clientId = root && 'blicks/dialog' === root.name ? String( root.clientId ?? '' ) : '';
	const attributes: Attrs = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlockAttributes( clientId ) ?? {} : {} ), [ clientId ] );
	const { updateBlockAttributes } = useDispatch( 'core/block-editor' ) as { updateBlockAttributes: ( id: string, a: Attrs ) => void };

	return clientId ? { clientId, attributes, set: ( a ) => updateBlockAttributes( clientId, a ) } : null;
}

function Section( { title, children }: { title: string; children: React.ReactNode } ): JSX.Element {
	return (
		<section className="bl-ds-panel__sec">
			<h3>{ title }</h3>
			{ children }
		</section>
	);
}

const Note = ( { children }: { children: React.ReactNode } ): JSX.Element => <p className="bl-ds-panel__note">{ children }</p>;

function Seg< T extends string >( { label, value, options, onChange }: { label: string; value: T; options: [ T, string ][]; onChange: ( v: T ) => void } ): JSX.Element {
	return (
		<div className="bl-ds-seg" role="radiogroup" aria-label={ label }>
			{ options.map( ( [ v, text ] ) => (
				<button key={ v } type="button" role="radio" aria-checked={ v === value } className={ v === value ? 'is-on' : '' } onClick={ () => onChange( v ) }>
					{ text }
				</button>
			) ) }
		</div>
	);
}

function Num( { label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: ( n: number ) => void } ): JSX.Element {
	return (
		<div className="bl-ds-num">
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				type="number"
				label={ label }
				min={ min }
				max={ max }
				value={ String( value ) }
				onChange={ ( v: string ) => {
					const n = Number( v );
					if ( Number.isFinite( n ) ) onChange( Math.max( min, Math.min( max, Math.round( n ) ) ) );
				} }
			/>
			<span aria-hidden="true">{ unit }</span>
		</div>
	);
}

const Toggle = ( { label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: ( v: boolean ) => void } ): JSX.Element => (
	<ToggleControl __nextHasNoMarginBottom label={ label } help={ help } checked={ checked } onChange={ onChange } />
);

/* ------------------------------------------------------------------ Content */

export function ContentPanel( { blocks, selection }: PanelProps ): JSX.Element | null {
	const dialog = useDialog( blocks );

	if ( ! dialog ) return null;

	const { attributes: a, set, clientId } = dialog;
	const modal = false !== a.modal;
	const inside = selection && selection.clientId !== clientId;

	return (
		<div className="bl-ds-panel">
			<Section title={ __( 'Editing', 'blicks-pro' ) }>
				<Note>
					{ inside
						? __( 'The block selected has its own settings in the Selected tab, as in the post editor.', 'blicks-pro' )
						: __( 'A dialog holds ordinary Blicks blocks. Add them with the inserter; select one to change it.', 'blicks-pro' ) }
				</Note>
				<Button variant="secondary" onClick={ () => studio()?.focus( clientId, { label: String( a.title || __( 'Dialog', 'blicks-pro' ) ), exitLabel: __( 'The whole dialog', 'blicks-pro' ) } ) }>
					{ __( 'Edit the content', 'blicks-pro' ) }
				</Button>
			</Section>
			<Section title={ __( 'For everyone', 'blicks-pro' ) }>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Name for screen readers', 'blicks-pro' ) }
					help={ __( 'Left empty, the first heading names it.', 'blicks-pro' ) }
					value={ String( a.label ?? '' ) }
					onChange={ ( label: string ) => set( { label } ) }
				/>
				<Seg label={ __( 'Focus goes to', 'blicks-pro' ) } value={ 'close' === a.focus ? 'close' : '' } options={ [ [ '', __( 'First field', 'blicks-pro' ) ], [ 'close', __( 'Close button', 'blicks-pro' ) ] ] } onChange={ ( focus ) => set( { focus } ) } />
				<Note>{ __( 'On close, focus returns to whatever opened it.', 'blicks-pro' ) }</Note>
			</Section>
			<Section title={ __( 'Closing', 'blicks-pro' ) }>
				<Toggle label={ __( 'Close button', 'blicks-pro' ) } checked={ false !== a.closeButton } onChange={ ( closeButton ) => set( { closeButton } ) } />
				{ modal && <Toggle label={ __( 'Click outside closes it', 'blicks-pro' ) } checked={ false !== a.outsideCloses } onChange={ ( outsideCloses ) => set( { outsideCloses } ) } /> }
				<Note>{ __( 'Esc always closes a dialog. Any Button inside can be set to Close dialog.', 'blicks-pro' ) }</Note>
			</Section>
			<Section title={ __( 'Over the page', 'blicks-pro' ) }>
				<Toggle
					label={ __( 'Blocks the page', 'blicks-pro' ) }
					help={ modal ? __( 'The page behind is inert and does not scroll until it closes.', 'blicks-pro' ) : __( 'No backdrop; the page stays usable. For notices and corner offers.', 'blicks-pro' ) }
					checked={ modal }
					onChange={ ( on ) => set( { modal: on } ) }
				/>
			</Section>
		</div>
	);
}

/* ------------------------------------------------------------------ Style */

export function StylePanel( { blocks }: PanelProps ): JSX.Element | null {
	const dialog = useDialog( blocks );

	if ( ! dialog ) return null;

	const { attributes: a, set } = dialog;
	const kind = String( a.kind || 'modal' );
	const modal = false !== a.modal;

	return (
		<div className="bl-ds-panel">
			<Section title={ __( 'Kind', 'blicks-pro' ) }>
				<Seg
					label={ __( 'Kind', 'blicks-pro' ) }
					value={ kind }
					options={ [ [ 'modal', __( 'Modal', 'blicks-pro' ) ], [ 'drawer', __( 'Drawer', 'blicks-pro' ) ], [ 'sheet', __( 'Sheet', 'blicks-pro' ) ], [ 'full', __( 'Full screen', 'blicks-pro' ) ] ] }
					onChange={ ( v ) => set( { kind: v } ) }
				/>
				{ 'drawer' === kind && <Seg label={ __( 'Side', 'blicks-pro' ) } value={ String( a.side || 'end' ) } options={ [ [ 'start', __( 'Start', 'blicks-pro' ) ], [ 'end', __( 'End', 'blicks-pro' ) ] ] } onChange={ ( side ) => set( { side } ) } /> }
				{ 'modal' === kind && <Seg label={ __( 'Position', 'blicks-pro' ) } value={ String( a.place || 'center' ) } options={ [ [ 'center', __( 'Center', 'blicks-pro' ) ], [ 'top', __( 'Top', 'blicks-pro' ) ] ] } onChange={ ( place ) => set( { place } ) } /> }
			</Section>
			{ 'modal' === kind && (
				<Section title={ __( 'On phones', 'blicks-pro' ) }>
					<Seg label={ __( 'On phones', 'blicks-pro' ) } value={ String( a.phone || 'keep' ) } options={ [ [ 'keep', __( 'Card', 'blicks-pro' ) ], [ 'sheet', __( 'Sheet', 'blicks-pro' ) ], [ 'full', __( 'Full', 'blicks-pro' ) ] ] } onChange={ ( phone ) => set( { phone } ) } />
					<Note>{ __( 'Pick Phone above the canvas to see it. An automatic dialog is best a sheet on phones.', 'blicks-pro' ) }</Note>
				</Section>
			) }
			{ modal && (
				<Section title={ __( 'Backdrop', 'blicks-pro' ) }>
					<Seg label={ __( 'Shade', 'blicks-pro' ) } value={ String( a.backdrop || 'dark' ) } options={ [ [ 'dark', __( 'Dark', 'blicks-pro' ) ], [ 'light', __( 'Light', 'blicks-pro' ) ], [ 'none', __( 'None', 'blicks-pro' ) ] ] } onChange={ ( backdrop ) => set( { backdrop } ) } />
					<Toggle label={ __( 'Blur the page', 'blicks-pro' ) } checked={ !! a.blur } onChange={ ( blur ) => set( { blur } ) } />
				</Section>
			) }
			<Section title={ __( 'Enter and exit', 'blicks-pro' ) }>
				<Seg label={ __( 'Motion', 'blicks-pro' ) } value={ String( a.motion || 'rise' ) } options={ [ [ 'rise', __( 'Rise', 'blicks-pro' ) ], [ 'scale', __( 'Scale', 'blicks-pro' ) ], [ 'fade', __( 'Fade', 'blicks-pro' ) ], [ 'none', __( 'None', 'blicks-pro' ) ] ] } onChange={ ( motion ) => set( { motion } ) } />
				<Note>{ __( 'Drawers and sheets slide from their edge. Reduced motion turns all of it off.', 'blicks-pro' ) }</Note>
			</Section>
			<Section title={ __( 'Size and surface', 'blicks-pro' ) }>
				<Note>{ __( 'Width, padding, fill and corners are the usual style controls: leave the content, select the dialog, and use the Selected tab.', 'blicks-pro' ) }</Note>
			</Section>
		</div>
	);
}

/* ------------------------------------------------------------------ the saved dialog's draft */

function useSavedDraft( entity: unknown ): { id: number; draft: Draft } | null {
	const r = dialogRef( entity );
	const draft = useDraft( r ? r.id : null );

	return r && draft ? { id: r.id, draft } : null;
}

const Unsaved = ( { draft }: { draft: Draft } ): JSX.Element | null =>
	draft.dirty ? <p className="bl-ds-panel__unsaved" role="status">{ __( 'Changed. Save dialog to keep it.', 'blicks-pro' ) }</p> : null;

const NotSaved = (): JSX.Element => (
	<div className="bl-ds-panel">
		<Note>{ __( 'Only a saved dialog has these. Open it from Blicks › Dialogs or start one from + New.', 'blicks-pro' ) }</Note>
	</div>
);

/* ------------------------------------------------------------------ Triggers */

interface Used {
	id: string;
	title: string;
	kind: string;
}

/** The posts with a Button or link that opens this dialog, from the Studio's entity route. */
function useOpeners( id: number ): Used[] | null {
	const [ used, setUsed ] = useState< Used[] | null >( null );

	useEffect( () => {
		let live = true;
		apiFetch( { path: `/blicks/v1/studio/entity?kind=post&type=blicks_dialog&id=${ id }` } )
			.then( ( record: any ) => live && setUsed( Array.isArray( record?.usedOn ) ? record.usedOn : [] ) )
			.catch( () => live && setUsed( [] ) );
		return () => {
			live = false;
		};
	}, [ id ] );

	return used;
}

export function TriggersPanel( { entity }: { entity: unknown } ): JSX.Element {
	const saved = useSavedDraft( entity );
	const openers = useOpeners( saved?.id ?? 0 );

	if ( ! saved ) return <NotSaved />;

	const { id, draft } = saved;
	const t = draft.triggers;
	const set = < K extends keyof Triggers >( key: K, patch: Partial< Triggers[ K ] > ): void => patchDraft( id, { triggers: { ...t, [ key ]: { ...t[ key ], ...patch } } } );

	return (
		<div className="bl-ds-panel">
			<Unsaved draft={ draft } />
			<Section title={ __( 'Opened by a click', 'blicks-pro' ) }>
				{ null === openers ? (
					<Note>{ __( 'Looking for Buttons and links…', 'blicks-pro' ) }</Note>
				) : 0 === openers.length ? (
					<Note>{ __( 'No published page opens it yet. Set a Button’s On click to Open dialog and pick it.', 'blicks-pro' ) }</Note>
				) : (
					<ul className="bl-ds-list">
						{ openers.map( ( o ) => (
							<li key={ o.id }>{ o.title }</li>
						) ) }
					</ul>
				) }
			</Section>
			<Section title={ __( 'Opens by itself', 'blicks-pro' ) }>
				<Toggle label={ __( 'Page load', 'blicks-pro' ) } checked={ t.load.on } onChange={ ( on ) => set( 'load', { on } ) } />
				{ t.load.on && <Num label={ __( 'After', 'blicks-pro' ) } unit="s" value={ t.load.delay } min={ 0 } max={ 600 } onChange={ ( delay ) => set( 'load', { delay } ) } /> }
				<Toggle label={ __( 'Scroll', 'blicks-pro' ) } checked={ t.scroll.on } onChange={ ( on ) => set( 'scroll', { on } ) } />
				{ t.scroll.on && <Num label={ __( 'At', 'blicks-pro' ) } unit="%" value={ t.scroll.percent } min={ 1 } max={ 100 } onChange={ ( percent ) => set( 'scroll', { percent } ) } /> }
				<Toggle label={ __( 'About to leave', 'blicks-pro' ) } help={ __( 'Desktop: the pointer heads for the tabs. Phones: a quick scroll back up.', 'blicks-pro' ) } checked={ t.exit.on } onChange={ ( on ) => set( 'exit', { on } ) } />
				<Toggle label={ __( 'No activity', 'blicks-pro' ) } checked={ t.idle.on } onChange={ ( on ) => set( 'idle', { on } ) } />
				{ t.idle.on && <Num label={ __( 'For', 'blicks-pro' ) } unit="s" value={ t.idle.seconds } min={ 5 } max={ 600 } onChange={ ( seconds ) => set( 'idle', { seconds } ) } /> }
				<Note>{ __( 'The first one that fires opens it, and only one dialog opens by itself per page view. Display rules decide whether it may.', 'blicks-pro' ) }</Note>
			</Section>
		</div>
	);
}

/* ------------------------------------------------------------------ Rules */

/** The post types a rule can name, from core-data. */
function usePostTypes(): { slug: string; name: string }[] {
	return useSelect( ( select: any ) => {
		const types = ( select( 'core' ).getPostTypes( { per_page: -1 } ) ?? [] ) as { slug: string; name: string; viewable?: boolean }[];
		return types.filter( ( t ) => t.viewable && 'attachment' !== t.slug );
	}, [] );
}

function Places( { label, value, onChange }: { label: string; value: string[]; onChange: ( v: string[] ) => void } ): JSX.Element {
	const types = usePostTypes();
	const [ page, setPage ] = useState( '' );
	const has = ( p: string ): boolean => value.includes( p );
	const toggle = ( p: string, on: boolean ): void => onChange( on ? places( [ ...value, p ] ) : value.filter( ( v ) => v !== p ) );
	const ids = value.filter( ( v ) => v.startsWith( 'post:' ) );

	return (
		<fieldset className="bl-ds-places">
			<legend>{ label }</legend>
			<CheckboxControl __nextHasNoMarginBottom label={ __( 'The front page', 'blicks-pro' ) } checked={ has( 'front' ) } onChange={ ( on: boolean ) => toggle( 'front', on ) } />
			{ types.map( ( t ) => (
				<CheckboxControl
					key={ t.slug }
					__nextHasNoMarginBottom
					/* translators: %s: a post type's name, e.g. Posts */
					label={ sprintf( __( 'All %s', 'blicks-pro' ), t.name ) }
					checked={ has( `type:${ t.slug }` ) }
					onChange={ ( on: boolean ) => toggle( `type:${ t.slug }`, on ) }
				/>
			) ) }
			<div className="bl-ds-chips">
				{ ids.map( ( p ) => (
					<button key={ p } type="button" className="bl-ds-chip" onClick={ () => toggle( p, false ) } aria-label={ sprintf( /* translators: %s: a post id */ __( 'Remove page %s', 'blicks-pro' ), p.slice( 5 ) ) }>
						{ sprintf( /* translators: %s: a post id */ __( 'Page #%s', 'blicks-pro' ), p.slice( 5 ) ) } ×
					</button>
				) ) }
			</div>
			<div className="bl-ds-add">
				<TextControl __nextHasNoMarginBottom __next40pxDefaultSize type="number" min={ 1 } label={ __( 'A page or post, by its ID', 'blicks-pro' ) } value={ page } onChange={ setPage } />
				<Button
					variant="secondary"
					disabled={ ! /^[1-9][0-9]*$/.test( page ) }
					onClick={ () => {
						toggle( `post:${ page }`, true );
						setPage( '' );
					} }
				>
					{ __( 'Add', 'blicks-pro' ) }
				</Button>
			</div>
		</fieldset>
	);
}

export function RulesPanel( { entity }: { entity: unknown } ): JSX.Element {
	const saved = useSavedDraft( entity );

	if ( ! saved ) return <NotSaved />;

	const { id, draft } = saved;
	const r = draft.rules;
	const set = ( patch: Partial< Rules > ): void => patchDraft( id, { rules: { ...r, ...patch } } );

	return (
		<div className="bl-ds-panel">
			<Unsaved draft={ draft } />
			<Section title={ __( 'On the site', 'blicks-pro' ) }>
				<Toggle
					label={ __( 'Switched on', 'blicks-pro' ) }
					help={ draft.on ? __( 'Buttons open it, and its triggers run where the rules allow.', 'blicks-pro' ) : __( 'Off: nothing opens it on the site.', 'blicks-pro' ) }
					checked={ draft.on }
					onChange={ ( on ) => patchDraft( id, { on } ) }
				/>
				<p className="bl-ds-sum">{ summary( draft.triggers, r ) }</p>
			</Section>
			<Section title={ __( 'Where', 'blicks-pro' ) }>
				<Seg label={ __( 'Where', 'blicks-pro' ) } value={ r.where } options={ [ [ 'all', __( 'Every page', 'blicks-pro' ) ], [ 'some', __( 'Chosen pages', 'blicks-pro' ) ] ] } onChange={ ( where ) => set( { where } ) } />
				{ 'some' === r.where && <Places label={ __( 'Only on', 'blicks-pro' ) } value={ r.include } onChange={ ( include ) => set( { include } ) } /> }
				<Places label={ __( 'Never on', 'blicks-pro' ) } value={ r.exclude } onChange={ ( exclude ) => set( { exclude } ) } />
				<Note>{ __( 'Pages and post types are checked on the server: where it cannot show, it is not printed.', 'blicks-pro' ) }</Note>
			</Section>
			<Section title={ __( 'Who', 'blicks-pro' ) }>
				<div className="bl-ds-checks">
					{ ( [ [ 'desktop', __( 'Desktop', 'blicks-pro' ) ], [ 'tablet', __( 'Tablet', 'blicks-pro' ) ], [ 'phone', __( 'Phone', 'blicks-pro' ) ] ] as const ).map( ( [ k, label ] ) => (
						<CheckboxControl key={ k } __nextHasNoMarginBottom label={ label } checked={ r.screens[ k ] } onChange={ ( on: boolean ) => set( { screens: { ...r.screens, [ k ]: on } } ) } />
					) ) }
				</div>
				<Seg< Visitors > label={ __( 'Visitors', 'blicks-pro' ) } value={ r.visitors } options={ [ [ 'all', __( 'All', 'blicks-pro' ) ], [ 'out', __( 'Logged out', 'blicks-pro' ) ], [ 'in', __( 'Logged in', 'blicks-pro' ) ] ] } onChange={ ( visitors ) => set( { visitors } ) } />
				<Note>{ __( 'Checked in the visitor’s browser, so a cached page serves everyone the same HTML.', 'blicks-pro' ) }</Note>
			</Section>
			<Section title={ __( 'How often', 'blicks-pro' ) }>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'At most', 'blicks-pro' ) }
					value={ r.frequency }
					options={ [
						{ value: 'view', label: __( 'Every page view', 'blicks-pro' ) },
						{ value: 'session', label: __( 'Once per visit', 'blicks-pro' ) },
						{ value: 'days', label: __( 'Once every few days', 'blicks-pro' ) },
						{ value: 'once', label: __( 'Once, ever', 'blicks-pro' ) },
					] }
					onChange={ ( frequency: string ) => set( { frequency: frequency as Frequency } ) }
				/>
				{ 'days' === r.frequency && <Num label={ __( 'Every', 'blicks-pro' ) } unit={ _n( 'day', 'days', r.days, 'blicks-pro' ) } value={ r.days } min={ 1 } max={ 365 } onChange={ ( days ) => set( { days } ) } /> }
				<Toggle label={ __( 'Not after they convert', 'blicks-pro' ) } checked={ r.stopAfterConvert } onChange={ ( stopAfterConvert ) => set( { stopAfterConvert } ) } />
				<Note>{ __( 'Kept in the visitor’s browser (localStorage), not on the server. A conversion is a form sent from the dialog or a link in it followed.', 'blicks-pro' ) }</Note>
			</Section>
			<Section title={ __( 'When', 'blicks-pro' ) }>
				<Toggle label={ __( 'Only between dates', 'blicks-pro' ) } checked={ r.schedule.on } onChange={ ( on ) => set( { schedule: { ...r.schedule, on } } ) } />
				{ r.schedule.on && (
					<div className="bl-ds-dates">
						<TextControl __nextHasNoMarginBottom __next40pxDefaultSize type="date" label={ __( 'From', 'blicks-pro' ) } value={ r.schedule.from } onChange={ ( from: string ) => set( { schedule: { ...r.schedule, from } } ) } />
						<TextControl __nextHasNoMarginBottom __next40pxDefaultSize type="date" label={ __( 'To', 'blicks-pro' ) } value={ r.schedule.to } onChange={ ( to: string ) => set( { schedule: { ...r.schedule, to } } ) } />
					</div>
				) }
				<Note>{ __( 'Checked on the server with pages and post types, and again in the browser for a page cached before the window closed.', 'blicks-pro' ) }</Note>
			</Section>
		</div>
	);
}
