import { useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useBlockEditContext } from '@wordpress/block-editor';
import { Chips, Field, Note, Row, Sec, SegText, SubView, type Option } from './kit';
import { addableOf, BREAKPOINTS, ELEMENT, entriesOf, keysOf, kindOf, labelOf, MOTION_IDS, PARTS, problemOf, propertyOf, sectionOf, setEntry, slotKey, textOf, valueOf, type Entry } from './all-settings-model';
import type { Tree } from './style-model';
import { rowLabelOf } from './design-model';
import { requestFocus } from './design-focus';
import { BP_NAME, PART_NAME, STATE_NAME, WHY } from './labels';
import { ChoiceEditor, ColourEditor, LengthEditor, MotionEditor, ShadowEditor, SidesEditor } from './ValueEditors';

const STATE_ORDER = Object.keys( STATE_NAME );
const SECTION_NAME: Record< string, string > = {
	layout: __( 'Layout', 'blicks' ),
	spacing: __( 'Space', 'blicks' ),
	position: __( 'Position', 'blicks' ),
	typography: __( 'Text', 'blicks' ),
	colors: __( 'Color', 'blicks' ),
	background: __( 'Background', 'blicks' ),
	borders: __( 'Border', 'blicks' ),
	columns: __( 'Columns', 'blicks' ),
	gridChild: __( 'In a grid', 'blicks' ),
	flexChild: __( 'In a row or column', 'blicks' ),
	effects: __( 'Effects', 'blicks' ),
	animation: __( 'Motion', 'blicks' ),
	decoration: __( 'Decoration', 'blicks' ),
};

const count = ( list: Entry[], match: ( e: Entry ) => boolean ) => list.filter( match ).length;
const named = ( label: string, n: number ) => ( n ? `${ label } ${ n }` : label );

interface Where {
	part: string;
	state: string;
	breakpoint: string;
}

/**
 * The entry row under the Style tab's sections: how many values the block stores, and how many of
 * them the quick choices above cannot show.
 */
export function AllSettingsSec( { tree, hidden, onOpen }: { tree: Tree; hidden: number; onOpen: () => void } ) {
	const total = entriesOf( tree ).length;
	return (
		<Sec title={ __( 'All settings', 'blicks' ) } icon="tune">
			<button type="button" className="deco-row" onClick={ onOpen }>
				<span className="deco-thumb empty" aria-hidden="true">≡</span>
				<span className="deco-txt">
					<b>{ sprintf( /* translators: %d: number of stored style values */ __( '%d values', 'blicks' ), total ) }</b>
					{ hidden > 0 && <small>{ sprintf( /* translators: %d: number of values */ __( '%d not shown above', 'blicks' ), hidden ) }</small> }
				</span>
				<span className="deco-chev" aria-hidden="true">›</span>
			</button>
		</Sec>
	);
}

/**
 * The post editor's door into the Studio: when a block holds values the quick choices cannot show,
 * one row says how many and opens the Studio on the first of them, with the design panel on it.
 * Drawn only when the Studio's entry has published `openBlock` (`window.blicks.studio`).
 */
export function EditInStudioSec( { hidden }: { hidden: Entry[] } ) {
	const { clientId } = useBlockEditContext();
	const open = ( window as unknown as { blicks?: { studio?: { openBlock?: ( id: string ) => string | null } } } ).blicks?.studio?.openBlock;
	if ( ! hidden.length || ! open ) return null;
	const first = hidden[ 0 ]!;
	const names = [ ...new Set( hidden.map( ( e ) => rowLabelOf( e.id ) ) ) ];
	return (
		<Sec title={ __( 'Custom', 'blicks' ) } icon="code">
			<button
				type="button"
				className="deco-row"
				onClick={ () => {
					const mounted = open( clientId );
					if ( mounted ) requestFocus( { clientId: mounted, id: first.id, part: first.part, state: first.state, breakpoint: first.breakpoint } );
				} }
			>
				<span className="deco-thumb empty" aria-hidden="true">≡</span>
				<span className="deco-txt">
					<b>{ sprintf( /* translators: %d: number of style values */ _n( '%d value the choices above can’t show', '%d values the choices above can’t show', hidden.length, 'blicks' ), hidden.length ) }</b>
					<small>{ names.slice( 0, 3 ).join( ', ' ) }{ names.length > 3 ? '…' : '' }</small>
				</span>
				<span className="deco-chev">{ __( 'Edit in Studio', 'blicks' ) } ›</span>
			</button>
		</Sec>
	);
}

/**
 * Every value the block stores, by part, state and screen. A value opens in its own editor; the
 * engine's validator decides what is saved, so nothing written here renders differently on the page.
 */
export function AllSettings( { tree, setTree, onBack, controls, states, start }: {
	tree: Tree;
	setTree: ( t: Tree ) => void;
	onBack: () => void;
	controls?: readonly string[];
	states?: readonly string[];
	/** Open straight on this value, e.g. from a section's "+2 more". */
	start?: Entry | null;
} ) {
	const [ where, setWhere ] = useState< Where >( start ? { part: start.part, state: start.state, breakpoint: start.breakpoint } : { part: ELEMENT, state: 'default', breakpoint: 'base' } );
	const [ open, setOpen ] = useState< string | null >( start?.id ?? null );
	const [ adding, setAdding ] = useState( false );
	const [ moreStates, setMoreStates ] = useState( false );
	const all = entriesOf( tree );

	if ( open ) {
		return <OneValue id={ open } tree={ tree } setTree={ setTree } where={ where } setWhere={ setWhere } controls={ controls } onBack={ () => setOpen( null ) } />;
	}
	if ( adding ) {
		return (
			<AddSetting
				ids={ addableOf( controls, where.part ) }
				where={ where }
				onPick={ ( id ) => {
					setAdding( false );
					setOpen( id );
				} }
				onBack={ () => setAdding( false ) }
			/>
		);
	}

	const inPart = all.filter( ( e ) => e.part === where.part );
	const used = ( s: string ) => s === 'default' || s === where.state || inPart.some( ( e ) => e.state === s );
	const allowed = STATE_ORDER.filter( ( s ) => used( s ) || states?.includes( s ) );
	// States with values come first; the rest wait behind one chip, so the row stays short.
	const stateList = moreStates ? allowed : allowed.filter( used );
	const here = inPart.filter( ( e ) => e.state === where.state && e.breakpoint === where.breakpoint );
	const sections = here.reduce< Record< string, Entry[] > >( ( m, e ) => {
		( m[ sectionOf( e.id ) ] ??= [] ).push( e );
		return m;
	}, {} );
	const overridden = ( e: Entry ) => e.breakpoint === 'base' && all.some( ( o ) => o.id === e.id && o.part === e.part && o.state === e.state && o.breakpoint !== 'base' );

	return (
		<SubView title={ sprintf( /* translators: %d: number of stored style values */ __( 'All settings · %d', 'blicks' ), all.length ) } onBack={ onBack }>
			<Row label={ __( 'Part', 'blicks' ) } hint="::before / ::after">
				<SegText
					label={ __( 'Part', 'blicks' ) }
					options={ [ ELEMENT, ...PARTS ].map( ( p ) => [ p, named( PART_NAME[ p ], p === ELEMENT ? 0 : count( all, ( e ) => e.part === p ) ) ] as Option ) }
					value={ where.part }
					onChange={ ( part ) => setWhere( { ...where, part, state: 'default' } ) }
				/>
			</Row>
			<Row label={ __( 'State', 'blicks' ) } stack>
				<Chips
					label={ __( 'State', 'blicks' ) }
					options={ [
						...stateList.map( ( s ) => [ s, named( STATE_NAME[ s ], count( inPart, ( e ) => e.state === s ) ) ] as Option ),
						...( allowed.length > stateList.length ? [ [ '+', __( 'More states…', 'blicks' ) ] as Option ] : [] ),
					] }
					value={ where.state }
					onChange={ ( state ) => ( state === '+' ? setMoreStates( true ) : setWhere( { ...where, state } ) ) }
				/>
			</Row>
			<Row label={ __( 'Screen', 'blicks' ) }>
				<SegText label={ __( 'Screen', 'blicks' ) } options={ BREAKPOINTS.map( ( b ) => [ b, BP_NAME[ b ] ] as Option ) } value={ where.breakpoint } onChange={ ( breakpoint ) => setWhere( { ...where, breakpoint } ) } />
			</Row>
			{ ! here.length && <Note>{ where.breakpoint === 'base' ? __( 'Nothing set here.', 'blicks' ) : __( 'Nothing set here: this screen uses the desktop values.', 'blicks' ) }</Note> }
			{ Object.entries( sections ).map( ( [ section, list ] ) => (
				<Row key={ section } label={ SECTION_NAME[ section ] ?? section } stack set>
					<div className="alls-list">
						{ list.filter( ( e ) => ! MOTION_IDS.includes( e.id ) || e === list.find( ( m ) => MOTION_IDS.includes( m.id ) ) ).map( ( e ) => {
							// The animation settings read as one row, as they open as one editor.
							const motion = MOTION_IDS.includes( e.id );
							const shown = motion ? list.filter( ( m ) => MOTION_IDS.includes( m.id ) ).map( ( m ) => textOf( m.id, m.value ) ).join( ' · ' ) : textOf( e.id, e.value );
							return (
								<button key={ e.id } type="button" className="alls-row" onClick={ () => setOpen( e.id ) }>
									<span>{ motion ? __( 'Animation', 'blicks' ) : labelOf( e.id ) }</span>
									<code title={ shown }>{ shown }{ overridden( e ) ? ' ◧' : '' }</code>
								</button>
							);
						} ) }
					</div>
				</Row>
			) ) }
			<button type="button" className="deco-row add" onClick={ () => setAdding( true ) }>
				<span className="deco-thumb empty" aria-hidden="true">+</span>
				<span className="deco-txt"><b>{ __( 'Add a setting', 'blicks' ) }</b><small>{ __( 'Anything this block allows', 'blicks' ) }</small></span>
			</button>
			{ all.some( overridden ) && <Note>{ __( '◧ has its own value on a smaller screen.', 'blicks' ) }</Note> }
		</SubView>
	);
}

/** One setting at one part, state and screen; the same setting elsewhere is one click away. */
function OneValue( { id, tree, setTree, where, setWhere, controls, onBack }: {
	id: string;
	tree: Tree;
	setTree: ( t: Tree ) => void;
	where: Where;
	setWhere: ( w: Where ) => void;
	controls?: readonly string[];
	onBack: () => void;
} ) {
	const stored = tree?.[ id ]?.[ slotKey( where.part, where.state ) ]?.[ where.breakpoint ];
	const key = `${ where.part }|${ where.state }|${ where.breakpoint }`;
	const [ draft, setDraft ] = useState< { key: string; text: string } | null >( null );
	const text = draft?.key === key ? draft.text : textOf( id, stored );
	const parsed = valueOf( id, text );
	const problem = text.trim() === '' ? null : parsed === null ? __( 'Cannot read this.', 'blicks' ) : ( () => {
		const reason = problemOf( id, where.part, where.state, where.breakpoint, parsed, controls );
		return reason ? WHY[ reason ] : null;
	} )();
	const elsewhere = entriesOf( { [ id ]: tree?.[ id ] ?? {} } ).filter( ( e ) => e.part === where.part && `${ e.part }|${ e.state }|${ e.breakpoint }` !== key );
	const swatch = /^(colors\.|border\.color|background\.gradient)/.test( id ) && typeof parsed === 'string' && ! problem ? { background: parsed } : undefined;

	const kind = kindOf( id );
	const [ asCss, setAsCss ] = useState( kind === 'css' );
	const [ refused, setRefused ] = useState< string | null >( null );
	const at = ( cid: string ) => tree?.[ cid ]?.[ slotKey( where.part, where.state ) ]?.[ where.breakpoint ];
	// A typed editor's value goes through the same validator as the text: refused, it is not saved.
	const commit = ( cid: string, value: unknown ) => {
		const reason = value === undefined ? null : problemOf( cid, where.part, where.state, where.breakpoint, value, controls );
		setRefused( reason ? WHY[ reason ] : null );
		if ( reason ) return;
		setDraft( null );
		setTree( setEntry( tree, cid, where.part, where.state, where.breakpoint, value ) );
	};
	const typed = ! asCss && kind !== 'css';
	const editor = ( () => {
		const props = { id, value: stored, onChange: ( v: unknown ) => commit( id, v ) };
		if ( kind === 'colour' ) return <ColourEditor { ...props } />;
		if ( kind === 'length' ) return <LengthEditor { ...props } />;
		if ( kind === 'sides' ) return <SidesEditor { ...props } keys={ keysOf( id ) ?? [] } />;
		if ( kind === 'choice' ) return <ChoiceEditor { ...props } onOther={ () => setAsCss( true ) } />;
		if ( kind === 'shadow' ) return <ShadowEditor { ...props } />;
		if ( kind === 'motion' ) return <MotionEditor get={ at } set={ commit } onOther={ () => setAsCss( true ) } />;
		return null;
	} )();

	const edit = ( next: string ) => {
		setDraft( { key, text: next } );
		const value = valueOf( id, next );
		if ( next.trim() === '' || value === null || value === undefined ) return;
		if ( ! problemOf( id, where.part, where.state, where.breakpoint, value, controls ) ) setTree( setEntry( tree, id, where.part, where.state, where.breakpoint, value ) );
	};
	const label = [ where.part === ELEMENT ? '' : PART_NAME[ where.part ], STATE_NAME[ where.state ], BP_NAME[ where.breakpoint ] ].filter( Boolean ).join( ' · ' );

	return (
		<SubView title={ kind === 'motion' ? __( 'Animation', 'blicks' ) : labelOf( id ) } onBack={ onBack } preview={ swatch }>
			<Row label={ label } stack set={ stored !== undefined } note={ <code>{ kind === 'motion' ? 'animation' : propertyOf( id ) }</code> } noteIcon="code">
				{ typed ? (
					<>
						{ editor }
						{ refused && <p className="note alls-bad" role="alert">{ refused }</p> }
					</>
				) : (
					<>
						<label className="inp alls-code">
							<textarea value={ text } rows={ Math.min( 6, Math.max( 2, Math.ceil( text.length / 30 ) ) ) } aria-label={ labelOf( id ) } spellCheck={ false } onChange={ ( e ) => edit( e.currentTarget.value ) } />
						</label>
						{ problem ? <p className="note alls-bad" role="alert">{ problem }</p> : text.trim() && <p className="note alls-ok">{ stored === undefined ? __( 'Valid. Type to add it.', 'blicks' ) : __( 'Valid', 'blicks' ) }</p> }
					</>
				) }
			</Row>
			{ kind !== 'css' && ( kind !== 'motion' || asCss ) && (
				<button type="button" className="alls-mode" onClick={ () => {
					setAsCss( ! asCss );
					setRefused( null );
				} }>
					{ asCss ? __( 'Use the editor', 'blicks' ) : __( 'Edit as CSS', 'blicks' ) }
				</button>
			) }
			{ !! elsewhere.length && (
				<Row label={ __( 'Elsewhere', 'blicks' ) } stack>
					<div className="alls-list">
						{ elsewhere.map( ( e ) => (
							<button key={ `${ e.state }|${ e.breakpoint }` } type="button" className="alls-row" onClick={ () => setWhere( { part: e.part, state: e.state, breakpoint: e.breakpoint } ) }>
								<span>{ [ STATE_NAME[ e.state ], BP_NAME[ e.breakpoint ] ].join( ' · ' ) }</span>
								<code>{ textOf( id, e.value ) }</code>
							</button>
						) ) }
					</div>
				</Row>
			) }
			{ where.breakpoint === 'base' && (
				<Row label={ __( 'Smaller screens', 'blicks' ) } stack>
					<SegText label={ __( 'Smaller screens', 'blicks' ) } options={ [ [ 'tablet', __( 'Set for tablet', 'blicks' ) ], [ 'mobile', __( 'Set for phone', 'blicks' ) ] ] as Option[] } value={ null } onChange={ ( breakpoint ) => setWhere( { ...where, breakpoint } ) } />
				</Row>
			) }
			{ stored !== undefined && (
				<button type="button" className="link-x" onClick={ () => {
					setTree( setEntry( tree, id, where.part, where.state, where.breakpoint, undefined ) );
					onBack();
				} }>
					{ sprintf( /* translators: %s: where the value applies, e.g. "Hover · Desktop" */ __( 'Remove (%s)', 'blicks' ), label ) }
				</button>
			) }
		</SubView>
	);
}

function AddSetting( { ids, where, onPick, onBack }: { ids: string[]; where: Where; onPick: ( id: string ) => void; onBack: () => void } ) {
	const [ query, setQuery ] = useState( '' );
	const q = query.trim().toLowerCase();
	const list = useMemo( () => ids.filter( ( id ) => ! q || labelOf( id ).toLowerCase().includes( q ) || propertyOf( id ).includes( q ) || id.toLowerCase().includes( q ) ), [ ids, q ] );
	return (
		<SubView title={ __( 'Add a setting', 'blicks' ) } onBack={ onBack }>
			<Row label={ __( 'Search', 'blicks' ) } note={ [ where.part === ELEMENT ? '' : PART_NAME[ where.part ], STATE_NAME[ where.state ], BP_NAME[ where.breakpoint ] ].filter( Boolean ).join( ' · ' ) } noteIcon="info">
				<Field label={ __( 'Search settings', 'blicks' ) } placeholder={ __( 'Shadow, gap, clip-path…', 'blicks' ) } value={ query } onChange={ setQuery } />
			</Row>
			<div className="alls-list">
				{ list.slice( 0, 40 ).map( ( id ) => (
					<button key={ id } type="button" className="alls-row" onClick={ () => onPick( id ) }>
						<span>{ labelOf( id ) }</span>
						<code>{ propertyOf( id ) }</code>
					</button>
				) ) }
			</div>
			{ list.length > 40 && <Note>{ __( 'Type to narrow the list.', 'blicks' ) }</Note> }
		</SubView>
	);
}
