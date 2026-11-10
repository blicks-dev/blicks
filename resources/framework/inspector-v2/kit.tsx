/**
 * The v2 inspector's controls, drawn in Blicks UI. A tab is a few `Sec`tions in a fixed order; a
 * section folds, names what it holds and counts what is set; every setting in it is a `Row` — its
 * label, then its control.
 *
 *  - Sec          a titled, folding section; counts the Rows inside it
 *  - Row          a label and its control, with a note saying where a value comes from
 *  - Steps, SegText, SegIcons, SegSource, Chips
 *                 one choice of a few, drawn as the segmented track (Chips past five: a select)
 *  - Opts         options that need a picture (shadows, finishes, depths)
 *  - Swatches     colours from the theme, plus "more"
 *  - Switch, Field, Select, Exact, Slider, Note, Sub
 *  - SubView      a panel that replaces the section list, with a back arrow and a clear link
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Sym } from './sym';

/** A 24px stroke icon from one path, as the designs draw them. */
export function Icon( { d, size = 20 }: { d: string; size?: number } ) {
	return (
		<svg viewBox="0 0 24 24" width={ size } height={ size } fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d={ d } />
		</svg>
	);
}

export type Option< V extends string = string > = [ value: V, label: string, extra?: string ];

/** What a section knows of the rows inside it: which exist, and which hold a value. */
const SecRows = createContext< { report: ( id: symbol, set: boolean ) => void; drop: ( id: symbol ) => void } | null >( null );

/** Whether each section is folded, by scope and title, for the rest of the editing session. */
const folded = new Map< string, boolean >();

/** Where a section sits — the tab, or the sub-view by its title — so same-named groups fold apart. */
const FoldScope = createContext( '' );

export function Sec( { title, icon, value, custom, onCustomise, onFineTune, hidden, closed, children }: {
	title?: string;
	/** A Material Symbols name (symbols.gen.ts) drawn before the title. */
	icon?: string;
	/** What the section is set to, shown on the right of the title. */
	value?: string;
	/** True once the user has gone past the quick choices — the value then reads "Custom". */
	custom?: boolean;
	onCustomise?: () => void;
	/** Stored values this section's quick choices cannot show, and how to open them (Studio). */
	hidden?: { count: number; onOpen: () => void };
	/**
	 * The Studio's door into the design panel, opened on this section's own row. It takes the place
	 * of Customise there: the design panel is the Studio's sub-view for every setting.
	 */
	onFineTune?: () => void;
	/** Start folded, until the user opens it. */
	closed?: boolean;
	children: ReactNode;
} ) {
	const [ rows, setRows ] = useState< Map< symbol, boolean > >( () => new Map() );
	const report = useCallback( ( id: symbol, set: boolean ) => setRows( ( m ) => ( m.get( id ) === set ? m : new Map( m ).set( id, set ) ) ), [] );
	const drop = useCallback( ( id: symbol ) => setRows( ( m ) => {
		if ( ! m.has( id ) ) return m;
		const n = new Map( m );
		n.delete( id );
		return n;
	} ), [] );
	const ctx = useMemo( () => ( { report, drop } ), [ report, drop ] );
	const key = `${ useContext( FoldScope ) }/${ title ?? '' }`;
	const [ open, setOpen ] = useState( () => ( title ? ! ( folded.get( key ) ?? !! closed ) : true ) );
	const toggle = () => {
		setOpen( ! open );
		if ( title ) folded.set( key, open );
	};

	if ( ! title ) {
		return (
			<section className="sec bare">
				<div className="sec-b"><SecRows.Provider value={ ctx }>{ children }</SecRows.Provider></div>
			</section>
		);
	}

	const set = [ ...rows.values() ].filter( Boolean ).length;
	const quick = custom ? __( 'Custom', 'blicks' ) : ! hidden?.count ? value : '';
	const action = onFineTune
		? { label: custom ? __( 'Edit in Design', 'blicks' ) : __( 'Fine-tune', 'blicks' ), title: __( 'Open this in the Design tab', 'blicks' ), run: onFineTune }
		: onCustomise ? { label: custom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), title: undefined, run: onCustomise } : null;

	return (
		<section className={ `sec${ open ? '' : ' closed' }` }>
			<div className="sec-hd">
				<button type="button" className="sec-h" aria-expanded={ open } onClick={ toggle }>
					{ icon && <Sym name={ icon } /> }
					<span className="ttl">{ title }</span>
					<span className="meta">
						{ /* The quick value is wrong once hidden values override it. */ }
						{ quick && <span className={ `hval${ custom ? ' is-c' : '' }` }>{ quick }</span> }
						{ set > 0 && <span className="bui-badge" title={ __( 'Settings with a value', 'blicks' ) }>{ set }</span> }
						{ rows.size > 0 && <span className="tot" title={ __( 'Settings here', 'blicks' ) }>{ rows.size }</span> }
						<Sym name="expand_more" className="chev" />
					</span>
				</button>
				{ !! hidden?.count && (
					<button type="button" className="hid" title={ __( 'Values the choices below cannot show', 'blicks' ) } onClick={ hidden.onOpen }>
						{ sprintf( /* translators: %d: number of values */ __( '+%d more', 'blicks' ), hidden.count ) }
					</button>
				) }
				{ action && (
					<button type="button" className="cust" title={ action.title } onClick={ action.run }>
						{ action.label }
						<Icon d="M9 6l6 6-6 6" size={ 14 } />
					</button>
				) }
			</div>
			<div className="sec-b"><SecRows.Provider value={ ctx }>{ children }</SecRows.Provider></div>
		</section>
	);
}

/**
 * One setting: its label, then its control. `set` turns the label brand and counts the row in its
 * section's header; `note` says where a value comes from ("From Kind · Card"). A control too wide
 * to sit beside a 78px label — three or more words, a picture grid — takes `stack`.
 */
export function Row( { label, set, note, noteIcon, stack, hint, action, children }: {
	label: string;
	set?: boolean;
	note?: ReactNode;
	/** A Material Symbols name before the note: `north_west` set elsewhere, `info`, `warning`. */
	noteIcon?: string;
	stack?: boolean;
	/** The CSS a designer would recognise, as the label's tooltip. */
	hint?: string;
	/** A door into a fuller editor for this one setting ("Customise ›"), at the end of the note line. */
	action?: { label: string; run: () => void };
	children: ReactNode;
} ) {
	const sec = useContext( SecRows );
	const id = useMemo( () => Symbol( label ), [ label ] );
	useLayoutEffect( () => sec?.report( id, !! set ), [ sec, id, set ] );
	useLayoutEffect( () => () => sec?.drop( id ), [ sec, id ] );
	return (
		<div className={ `bui-row${ stack ? ' stack' : '' }${ set ? ' set' : '' }` }>
			<span className="lb" title={ hint }>{ label }</span>
			<div className="ctl">{ children }</div>
			{ ( note || action ) && (
				<div className="note">
					{ noteIcon && <Sym name={ noteIcon } className="sm" /> }
					<span className="nt">{ note }</span>
					{ action && (
						<button type="button" className="cust" onClick={ action.run }>
							{ action.label }
							<Icon d="M9 6l6 6-6 6" size={ 14 } />
						</button>
					) }
				</div>
			) }
		</div>
	);
}

/**
 * Whether a track's options need a second line: more than six glyphs, more than four words, or
 * names too long to share the 256px a stacked row has (about 30 characters in all).
 */
const wraps = ( options: Option[], icons?: boolean ) =>
	icons ? options.length > 6 : options.length > 4 || options.reduce( ( n, [ , l ] ) => n + l.length + 3, 0 ) > 34;

/** One choice of a few, as the segmented track. `icons` draws each option's path in place of its name. */
function Track< V extends string >( { options, value, onChange, icons, styles, label }: {
	options: Option< V >[];
	value: V | null;
	onChange: ( v: V ) => void;
	icons?: boolean;
	styles?: Partial< Record< V, React.CSSProperties > >;
	label?: string;
} ) {
	return (
		<div
			className={ `bui-seg full${ wraps( options, icons ) ? ' wrap' : '' }` }
			style={ { '--cols': options.length % 3 === 0 || options.length > 4 ? 3 : 2 } as React.CSSProperties }
			role="radiogroup"
			aria-label={ label }
		>
			{ options.map( ( [ v, l, d ] ) => (
				<button key={ v } type="button" role="radio" aria-checked={ value === v } title={ l } aria-label={ icons ? l : undefined } style={ styles?.[ v ] } onClick={ () => onChange( v ) }>
					{ /* Past three words there is no room for a glyph beside each one. */ }
					{ d && ( icons || options.length <= 3 ) && <Icon d={ d } size={ icons ? 18 : 16 } /> }
					{ ! icons && l }
				</button>
			) ) }
		</div>
	);
}

type TrackProps< V extends string > = { options: Option< V >[]; value: V | null; onChange: ( v: V ) => void; label?: string };

/** A few ordered sizes (None · Small · Medium · Large). */
export const Steps = < V extends string >( p: TrackProps< V > ) => <Track { ...p } />;

/** A few shapes, as icons: `extra` is the icon path. */
export const SegIcons = < V extends string >( p: TrackProps< V > ) => <Track { ...p } icons />;

/** A few named options; `extra` is an optional icon path drawn before the label. */
export const SegText = < V extends string >( p: TrackProps< V > & { styles?: Partial< Record< V, React.CSSProperties > > } ) => <Track { ...p } />;

/** Where a value comes from (Typed · From data). */
export const SegSource = < V extends string >( p: TrackProps< V > & { value: V } ) => <Track { ...p } />;

/** An open set of named options: the track up to five, a select past that. */
export function Chips< V extends string >( { options, value, onChange, label }: TrackProps< V > ) {
	if ( options.length <= 5 ) return <Track options={ options } value={ value } onChange={ onChange } label={ label } />;
	return <Select value={ value ?? '' } options={ value === null ? [ [ '', __( 'Choose…', 'blicks' ) ], ...options ] : options } label={ label ?? '' } onChange={ ( v ) => v && onChange( v as V ) } />;
}

/** Pictured options in a grid of `columns`. */
export function Opts< V extends string >( { columns = 4, options, value, onChange, showLabels = true }: {
	columns?: number;
	options: Array< [ V, string, ReactNode ] >;
	value: V | null;
	onChange: ( v: V ) => void;
	showLabels?: boolean;
} ) {
	return (
		<div className="opts" style={ { '--n': columns } as React.CSSProperties }>
			{ options.map( ( [ v, l, picture ] ) => (
				<button key={ v } type="button" className="opt" aria-pressed={ value === v } title={ l } aria-label={ l } onClick={ () => onChange( v ) }>
					{ picture }
					{ showLabels && <span>{ l }</span> }
				</button>
			) ) }
		</div>
	);
}

/** One colour choice: a theme slug (shown with its live CSS), or `''` for "none"/"automatic". */
export interface Swatch {
	value: string;
	label: string;
	/** Any CSS colour/background for the dot. Omit for the empty choice. */
	css?: string;
}

export function Swatches( { swatches, value, onChange, empty = 'nochange', onMore, moreLabel, small, custom }: {
	swatches: Swatch[];
	value: string | null;
	onChange: ( v: string ) => void;
	/** How the empty choice is drawn: a struck dot, or "Aa" for automatic. */
	empty?: 'nochange' | 'auto';
	onMore?: () => void;
	moreLabel?: string;
	small?: boolean;
	/** A value outside the list, drawn as a selected dot that opens the editor. */
	custom?: { css: string; label: string; onEdit: () => void };
} ) {
	return (
		<div className={ `swatches${ small ? ' sm' : '' }` }>
			{ swatches.map( ( s ) =>
				s.css ? (
					<button key={ s.value } type="button" className="swc" style={ { background: s.css } } aria-pressed={ value === s.value } title={ s.label } aria-label={ s.label } onClick={ () => onChange( s.value ) } />
				) : (
					<button key="none" type="button" className={ `swc ${ empty }` } aria-pressed={ ! value } title={ s.label } aria-label={ s.label } onClick={ () => onChange( '' ) }>
						{ empty === 'auto' ? 'Aa' : null }
					</button>
				)
			) }
			{ custom && <button type="button" className="swc" style={ { background: custom.css } } aria-pressed="true" title={ custom.label } aria-label={ custom.label } onClick={ custom.onEdit } /> }
			{ onMore && (
				<button type="button" className="swc more" title={ moreLabel } aria-label={ moreLabel } onClick={ onMore }>
					<Icon d="M12 7v10M7 12h10" size={ 16 } />
				</button>
			) }
		</div>
	);
}

/**
 * An on/off setting. It sits bare in its section, but counts as one of its rows like any `Row`, and
 * its name turns brand while it is on, so a section's count says the same as the rows under it.
 */
export function Switch( { label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: ( v: boolean ) => void; disabled?: boolean } ) {
	const sec = useContext( SecRows );
	const id = useMemo( () => Symbol( label ), [ label ] );
	useLayoutEffect( () => sec?.report( id, checked ), [ sec, id, checked ] );
	useLayoutEffect( () => () => sec?.drop( id ), [ sec, id ] );
	return (
		<label className={ `sw-row${ checked ? ' set' : '' }` }>
			<span>
				{ label }
				{ hint && <small>{ hint }</small> }
			</span>
			<input type="checkbox" role="switch" checked={ checked } disabled={ disabled } onChange={ ( e ) => onChange( e.currentTarget.checked ) } />
			<span className="sw" aria-hidden="true" />
		</label>
	);
}

export function Field( { icon, value, placeholder, label, onChange, type = 'text' }: { icon?: string; value: string; placeholder?: string; label: string; onChange: ( v: string ) => void; type?: string } ) {
	return (
		<label className="bui-fld">
			{ icon && <span className="lead"><Icon d={ icon } size={ 16 } /></span> }
			<input type={ type } value={ value } placeholder={ placeholder } aria-label={ label } onChange={ ( e ) => onChange( e.currentTarget.value ) } />
		</label>
	);
}

export function Select( { value, options, label, onChange }: { value: string; options: Option[]; label: string; onChange: ( v: string ) => void } ) {
	return (
		<span className="bui-select">
			<select value={ value } aria-label={ label } onChange={ ( e ) => onChange( e.currentTarget.value ) }>
				{ options.map( ( [ v, l ] ) => <option key={ v } value={ v }>{ l }</option> ) }
			</select>
			<Sym name="expand_more" />
		</span>
	);
}

export const Sub = ( { children }: { children: ReactNode } ) => <p className="sub">{ children }</p>;
export const Note = ( { children }: { children: ReactNode } ) => <p className="note">{ children }</p>;

/**
 * A slider row: its label (or a glyph and the label as its tooltip), then the range and the live
 * value. It is a Row, so it lines up with every other setting and counts in its section.
 */
export function Slider( { label, icon, min, max, step = 1, value, unit = 'px', display, onChange }: {
	label: string;
	icon?: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	unit?: string;
	/** Text for the readout when it is not simply `${value}${unit}`. */
	display?: string;
	onChange: ( v: number ) => void;
} ) {
	return (
		<div className="bui-row sl-row">
			<span className="lb" title={ label }>
				{ icon && <span className="sl-ic" aria-hidden="true"><Icon d={ icon } size={ 16 } /></span> }
				<span className="nm">{ label }</span>
			</span>
			<div className="ctl bui-slider">
				<input type="range" min={ min } max={ max } step={ step } value={ value } aria-label={ label } onChange={ ( e ) => onChange( Number( e.currentTarget.value ) ) } />
				<output>{ display ?? `${ value }${ unit }` }</output>
			</div>
		</div>
	);
}

/**
 * A panel that replaces the section list until its back arrow is pressed: a header naming what is
 * being edited (with a live preview chip), then Rows — or titled `Sec`s when it holds more than one
 * group — and the way back to the quick choice at the end.
 */
export function SubView( { title, onBack, preview, clearLabel, onClear, children }: {
	title: string;
	onBack: () => void;
	/** Inline style for the small preview chip in the header. */
	preview?: React.CSSProperties;
	clearLabel?: string;
	onClear?: () => void;
	children: ReactNode;
} ) {
	return (
		<section className="sec ce">
			<div className="ce-h">
				<button type="button" className="back" aria-label={ __( 'Back', 'blicks' ) } title={ __( 'Back', 'blicks' ) } onClick={ onBack }>
					<Sym name="west" />
				</button>
				<b>{ title }</b>
				{ preview && <span className="ce-prev" style={ preview } /> }
			</div>
			<div className="sv-b"><FoldScope.Provider value={ title }>{ children }</FoldScope.Provider></div>
			{ onClear && clearLabel && (
				<div className="sv-f">
					<button type="button" className="link-x muted" onClick={ () => { onClear(); onBack(); } }>{ clearLabel }</button>
				</div>
			) }
		</section>
	);
}

/** One non-negative CSS length from what was typed — a bare number is px — or null. */
export function cleanLength( input: string ): string | null {
	const s = input.trim();
	if ( s === '0' ) return '0';
	if ( /^\d*\.?\d+$/.test( s ) ) return `${ s }px`;
	return /^\d*\.?\d+(px|rem|em|%|vw|vh|ch)$/.test( s ) ? s : null;
}

/**
 * "Exact": a typed value under a set of steps, for when none of them is right. Shows the value only
 * when it is not one of the steps; commits on Enter or on leaving the field.
 */
export function Exact( { value, isStep, label, placeholder = '24px', onChange }: {
	value: string;
	/** True when `value` is one of the steps above — the field then stays empty. */
	isStep: boolean;
	label: string;
	placeholder?: string;
	onChange: ( v: string ) => void;
} ) {
	const shown = isStep ? '' : value;
	const [ draft, setDraft ] = useState( shown );
	const [ invalid, setInvalid ] = useState( false );
	useEffect( () => setDraft( shown ), [ shown ] );
	const commit = () => {
		if ( draft.trim() === '' || draft === shown ) return setInvalid( false );
		const clean = cleanLength( draft );
		setInvalid( ! clean );
		if ( clean ) onChange( clean );
	};
	return (
		<Row label={ __( 'Exact', 'blicks' ) } set={ ! isStep && !! value } note={ invalid ? __( 'Use a size like 24px or 1.5rem', 'blicks' ) : undefined } noteIcon={ invalid ? 'warning' : undefined }>
			<label className={ `bui-fld${ invalid ? ' invalid' : '' }` }>
				<input
					value={ draft }
					placeholder={ placeholder }
					aria-label={ label }
					aria-invalid={ invalid }
					spellCheck={ false }
					onChange={ ( e ) => setDraft( e.currentTarget.value ) }
					onBlur={ commit }
					onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) { e.preventDefault(); commit(); } } }
				/>
			</label>
		</Row>
	);
}
