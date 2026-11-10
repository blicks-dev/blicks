import { Fragment, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { BUTTON_FOLLOWS, COLOR_FALLBACKS, FIXED_TOKENS, TYPE_ROLE_DEFAULTS, TYPE_ROLE_LABELS } from '../constants';
import { DESIGN_SECTION_EVENT, parseHash, setDesignSection, urlForView } from '../routing';
import {
	ADDABLE, designNav, isOwnToken, resolveSection, sectionDirty, slugify, tokenAbout, tokenKeys,
} from '../design-model';
import type { DesignChange, DesignSection } from '../design-model';
import {
	titleCase, isColorValue, validateTokenValue, validateTypeRoleValue, stripVars, wrapVars, colorToEdit,
	parseRgb, compositeOver, contrastRatio, parseShadow, formatShadow, parseGradient, formatGradient,
} from '../data';
import type { ShadowParts, GradientParts } from '../data';
import { useToast } from './Toast';
import { AnimationsView } from './AnimationsView';
import { SitePreview, siteVars } from './SitePreview';
import { languageVars } from '../language';
import type { useDesignSystem } from '../hooks/useDesignSystem';
import type { useAnimations } from '../hooks/useAnimations';
import type { AdminView, DesignKit, DesignTheme } from '../types';

type DesignSystemApi = ReturnType< typeof useDesignSystem >;
type AnimationsApi = ReturnType< typeof useAnimations >;

/* ── small pieces ────────────────────────────────────────────────────────── */

const UNDO = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8Z" /></svg>;
const CHEV = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg>;
const PLUS = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" /></svg>;
const CHECK = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg>;
const MORE = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>;
const PLAY = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z" /></svg>;

/** A length in px, for drawing. `var()`, `clamp()` and other expressions come back null. */
export function toPx( value: string ): number | null {
	const match = /^(-?[\d.]+)(rem|em|px)?$/.exec( stripVars( value ).trim() );
	if ( ! match ) return null;
	return parseFloat( match[ 1 ] ) * ( match[ 2 ] === 'rem' || match[ 2 ] === 'em' ? 16 : 1 );
}

/**
 * A color as the browser resolves it. Tokens are stored as hex, `var()` references or
 * `color-mix()`; only the browser knows what those become, so a hidden probe asks it.
 */
let probe: HTMLElement | null = null;
export function resolveColor( value: string ): ReturnType< typeof parseRgb > {
	if ( ! value.trim() ) return null;
	if ( ! probe ) {
		probe = document.createElement( 'span' );
		probe.setAttribute( 'aria-hidden', 'true' );
		probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
		( document.querySelector( '.blicks-admin' ) ?? document.body ).appendChild( probe );
	}
	probe.style.color = '';
	probe.style.color = value;
	if ( ! probe.style.color ) return null;
	return parseRgb( getComputedStyle( probe ).color );
}

const hexOf = ( value: string ): string => {
	const rgb = resolveColor( value );
	if ( ! rgb ) return '#000000';
	return '#' + [ rgb.r, rgb.g, rgb.b ].map( n => Math.round( n ).toString( 16 ).padStart( 2, '0' ) ).join( '' );
};

/** How readable text is on a surface, in words, with the WCAG ratio beside it. */
function Grade( { surface, text }: { surface: string; text: string } ): JSX.Element {
	const back = resolveColor( surface );
	const fore = resolveColor( text );
	if ( ! back || ! fore ) return <span className="grade mid">{ __( 'Can’t measure', 'blicks' ) }</span>;
	const ground = compositeOver( back, { r: 255, g: 255, b: 255, a: 1 } );
	const ratio = contrastRatio( compositeOver( fore, ground ), ground );
	const n = ratio.toFixed( 1 );
	if ( ratio >= 7 ) return <span className="grade ok" title={ __( 'Readable at any size (WCAG AAA)', 'blicks' ) }>{ CHECK } { sprintf( /* translators: %s: contrast ratio. */ __( '%s · Very clear', 'blicks' ), n ) }</span>;
	if ( ratio >= 4.5 ) return <span className="grade ok" title={ __( 'Readable as body text (WCAG AA)', 'blicks' ) }>{ CHECK } { sprintf( /* translators: %s: contrast ratio. */ __( '%s · Clear', 'blicks' ), n ) }</span>;
	if ( ratio >= 3 ) return <span className="grade mid" title={ __( 'Fine for large headings only (WCAG AA large)', 'blicks' ) }>{ sprintf( /* translators: %s: contrast ratio. */ __( '%s · Large text only', 'blicks' ), n ) }</span>;
	return <span className="grade bad" title={ __( 'Too faint to read reliably', 'blicks' ) }>{ sprintf( /* translators: %s: contrast ratio. */ __( '%s · Hard to read', 'blicks' ), n ) }</span>;
}

/** The CSS property each button token drives, for its specimen. */
const BUTTON_SPEC: Record< string, string > = {
	radius: 'borderRadius', height: 'minHeight', 'padding-x': 'paddingInline', 'padding-y': 'paddingBlock',
	'font-size': 'fontSize', 'font-weight': 'fontWeight', 'border-width': 'borderWidth',
};

/**
 * A text field that only hands valid values up, and reverts on blur when what is typed is not
 * one. The stored value may be a `var(--…)` reference; people edit the short form.
 */
function ValueField( {
	id,
	value,
	label,
	validate,
	onCommit,
	onRevert,
	toEdit = stripVars,
	fromEdit = wrapVars,
	disabled,
	unit,
	inputMode,
	placeholder,
}: {
	id?: string;
	value: string;
	label: string;
	validate: ( v: string ) => boolean;
	onCommit: ( v: string ) => void;
	onRevert: () => void;
	toEdit?: ( v: string ) => string;
	fromEdit?: ( v: string ) => string;
	disabled?: boolean;
	unit?: string;
	inputMode?: React.HTMLAttributes< HTMLInputElement >[ 'inputMode' ];
	placeholder?: string;
} ): JSX.Element {
	const [ local, setLocal ] = useState< string | null >( null );
	const shown = local ?? toEdit( value );
	const invalid = local !== null && local.trim() !== '' && ! validate( fromEdit( local.trim() ) );
	return (
		<label className={ `vfield${ invalid ? ' bad' : '' }` }>
			<input
				id={ id }
				value={ shown }
				disabled={ disabled }
				spellCheck={ false }
				inputMode={ inputMode }
				placeholder={ placeholder }
				aria-label={ label }
				aria-invalid={ invalid || undefined }
				className={ invalid ? 'is-invalid' : undefined }
				onFocus={ () => setLocal( toEdit( value ) ) }
				onChange={ event => {
					const next = event.currentTarget.value;
					setLocal( next );
					const stored = fromEdit( next.trim() );
					if ( next.trim() !== '' && validate( stored ) ) onCommit( stored );
				} }
				onBlur={ event => {
					const typed = event.currentTarget.value.trim();
					setLocal( null );
					if ( typed === '' ) onRevert();
					else if ( validate( fromEdit( typed ) ) ) onCommit( fromEdit( typed ) );
				} }
			/>
			{ unit && <span className="u">{ unit }</span> }
		</label>
	);
}

/* ── the view ───────────────────────────────────────────────────────────── */

/**
 * The Design System view: sections grouped by what a person is trying to do on the left, one
 * section open in the middle, and the person's own site on the right, painted from the values
 * being edited. Pointing at a token outlines everything in the preview that reads it.
 */
export function DesignSystemPanel( {
	ds,
	changes,
	animations,
	themeJsonSync,
	onViewChange,
}: {
	ds: DesignSystemApi;
	changes: DesignChange[];
	animations: AnimationsApi;
	themeJsonSync: boolean;
	onViewChange: ( view: AdminView ) => void;
} ): JSX.Element {
	const toast = useToast();
	const { snapshot, tokenDraft, typeRoleDraft, breakpointDraft, isSaving, themes } = ds;
	const nav = useMemo( designNav, [] );
	const sections = nav.flatMap( group => group.items );
	const about = useMemo( tokenAbout, [] );
	const [ section, setSection ] = useState( () => resolveSection( parseHash().section || 'color' ) );
	const [ query, setQuery ] = useState( '' );
	const [ openParts, setOpenParts ] = useState< string | null >( null );
	const [ openRole, setOpenRole ] = useState< string | null >( null );
	const [ highlight, setHighlight ] = useState< string | null >( null );
	// A design language being pointed at: the live site is drawn in it until the pointer leaves.
	const [ peek, setPeek ] = useState< string | null >( null );
	const peekTimer = useRef< number >( 0 );
	const letGoOfPeek = (): void => {
		window.clearTimeout( peekTimer.current );
		peekTimer.current = window.setTimeout( () => setPeek( null ), 180 );
	};
	useEffect( () => () => window.clearTimeout( peekTimer.current ), [] );
	const [ viewport, setViewport ] = useState( () => window.innerWidth );

	useEffect( () => {
		const onSection = ( event: Event ): void => {
			setSection( resolveSection( String( ( event as CustomEvent ).detail ?? '' ) ) );
			setQuery( '' );
		};
		const onHash = (): void => {
			const next = parseHash();
			if ( next.view === 'design' && next.section ) setSection( resolveSection( next.section ) );
		};
		const onResize = (): void => setViewport( window.innerWidth );
		window.addEventListener( DESIGN_SECTION_EVENT, onSection );
		window.addEventListener( 'hashchange', onHash );
		window.addEventListener( 'resize', onResize );
		return () => {
			window.removeEventListener( DESIGN_SECTION_EVENT, onSection );
			window.removeEventListener( 'hashchange', onHash );
			window.removeEventListener( 'resize', onResize );
		};
	}, [] );

	const go = ( id: string ): void => {
		setDesignSection( id );
		setQuery( '' );
		document.querySelector( '.blicks-admin .main' )?.scrollTo( { top: 0 } );
	};

	const base = snapshot.baseValues as Record< string, Record< string, string > >;
	const has = ( record: Record< string, unknown > | undefined, key: string ): boolean => !! record && Object.prototype.hasOwnProperty.call( record, key );
	const val = ( cat: string, slug: string ): string => {
		if ( has( tokenDraft[ cat ], slug ) ) return tokenDraft[ cat ][ slug ];
		return base[ cat ]?.[ slug ] ?? ( cat === 'color' ? COLOR_FALLBACKS[ slug ] ?? '' : '' );
	};
	const overridden = ( cat: string, slug: string ): boolean => has( tokenDraft[ cat ], slug );
	const unsaved = new Set( changes.map( change => change.key ) );
	const roleVal = ( role: string, prop: string ): string => {
		if ( has( typeRoleDraft[ role ], prop ) ) return typeRoleDraft[ role ][ prop ];
		return snapshot.typeRoles.base[ role ]?.[ prop ] ?? TYPE_ROLE_DEFAULTS[ role ]?.[ prop ] ?? '';
	};
	const keys = ( cat: string ): string[] => tokenKeys( snapshot, tokenDraft, cat );
	const count = ( item: DesignSection ): number => {
		if ( item.id === 'look' ) return snapshot.language.languages.length;
		if ( item.id === 'anim' ) return animations.library.length;
		if ( item.id === 'type' ) return snapshot.typeRoles.roles.length + keys( 'fontFamily' ).length;
		if ( item.id === 'bp' ) return snapshot.breakpoints.filter( bp => bp.max !== null ).length;
		return ( item.cats ?? [] ).reduce( ( n, cat ) => n + keys( cat ).length, 0 );
	};
	const activeTheme = themes.themes.find( theme => theme.id === themes.active );

	/* ── specimens: each token drawn the way it is used ─────────────────── */

	const specimen = ( cat: string, slug: string, v: string ): React.ReactNode => {
		switch ( cat ) {
			case 'color': return <span className="sw" style={ { background: v } } />;
			case 'spacing': return <span className="bar" style={ { width: Math.min( toPx( v ) ?? 0, 64 ) } } />;
			case 'content':
			case 'width': return <span className="bar" style={ { width: Math.round( Math.min( toPx( v ) ?? 0, 1600 ) / 1600 * 60 ) } } />;
			case 'radius': return <span className="rad" style={ { borderTopLeftRadius: v } } />;
			case 'shadow': return <span className="shd" style={ { boxShadow: v === 'none' ? 'inset 0 0 0 1px var(--hair)' : v } } />;
			case 'gradient': return <span className="grd" style={ { background: v } } />;
			case 'borderWidth': return <span className="bdr" style={ { border: `${ v } solid var(--ink-2)` } } />;
			case 'button': return <span className="btn-s" style={ { [ BUTTON_SPEC[ slug ] ?? 'borderRadius' ]: v || BUTTON_FOLLOWS[ slug ] } }>{ __( 'Buy', 'blicks' ) }</span>;
			case 'opacity': return <span className="op"><i style={ { opacity: v } } /></span>;
			case 'aspect': return <span className="asp" style={ { aspectRatio: v, width: /^\s*3\s*\/\s*4/.test( v ) ? 30 : 48 } } />;
			case 'leading': return <span className="lead-s" style={ { rowGap: Math.round( ( ( parseFloat( v ) || 1.5 ) - 1 ) * 14 ) + 2 } }><i /><i /><i style={ { width: '70%' } } /></span>;
			case 'transform':
			case 'filter':
				return <span className={ `fx fx-${ cat }` } style={ { '--fx': v } as React.CSSProperties } tabIndex={ 0 } aria-label={ sprintf( /* translators: %s: token name. */ __( 'Try %s', 'blicks' ), titleCase( slug ) ) }>{ __( 'Try', 'blicks' ) }</span>;
			case 'transition':
				return (
					<button
						type="button"
						className="track"
						aria-label={ sprintf( /* translators: %s: token name. */ __( 'Play %s', 'blicks' ), titleCase( slug ) ) }
						onClick={ event => {
							const track = event.currentTarget;
							track.classList.remove( 'go' );
							void track.offsetWidth;
							track.classList.add( 'go' );
							window.setTimeout( () => track.classList.remove( 'go' ), 1600 );
						} }
					>
						<i style={ { transition: v.replace( /^all\b/, 'left' ) } } />
					</button>
				);
			case 'zIndex': return <span className="zbadge">{ v }</span>;
			default: return null;
		}
	};

	/* ── one token: specimen, name, value; its parts open underneath ───── */

	const validator = ( cat: string ) => ( v: string ): boolean => ( cat === 'color' ? isColorValue( v ) : validateTokenValue( cat, v ) );

	const tokenRow = ( cat: string, slug: string ): JSX.Element => {
		const v = val( cat, slug );
		const id = `${ cat }.${ slug }`;
		const fixed = ( FIXED_TOKENS[ cat ] ?? [] ).includes( slug );
		const own = isOwnToken( snapshot, cat, slug );
		const more = ! fixed && ( cat === 'shadow' || cat === 'gradient' );
		const open = more && openParts === id;
		const name = titleCase( slug );
		return (
			<div className={ `tok${ fixed ? ' fixed' : '' }` } data-tok={ id } key={ id }>
				<div className={ `tok-row${ more ? ' has-more' : '' }` }>
					<div className="spec">
						{ cat === 'color' ? (
							<label className="sw" style={ { background: v } } title={ sprintf( /* translators: %s: token name. */ __( 'Pick %s', 'blicks' ), name ) }>
								<input type="color" value={ hexOf( v ) } disabled={ isSaving } aria-label={ sprintf( /* translators: %s: token name. */ __( 'Pick %s', 'blicks' ), name ) } onChange={ event => ds.updateTokenDraft( cat, slug, event.currentTarget.value ) } />
							</label>
						) : specimen( cat, slug, v ) }
					</div>
					<div className="tok-name">
						<b>
							{ name }
							{ own && <span className="src-own">{ __( 'new', 'blicks' ) }</span> }
							{ unsaved.has( `t:${ cat }:${ slug }` ) && <i className="chg" title={ __( 'Unsaved change', 'blicks' ) } /> }
						</b>
						<span>{ about[ id ] ?? ( own ? __( 'Your own token, saved with the rest', 'blicks' ) : '' ) }</span>
						<code>{ `--blicks-${ cat }-${ slug }` }</code>
					</div>
					<div className="tok-val">
						{ fixed ? (
							<span title={ __( 'Blocks ask for this one by name, so its value can’t change', 'blicks' ) }>{ sprintf( /* translators: %s: token value. */ __( '%s · fixed', 'blicks' ), stripVars( v ) ) }</span>
						) : (
							<ValueField
								id={ `f-${ cat }-${ slug }` }
								value={ v }
								label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), name ) }
								validate={ validator( cat ) }
								toEdit={ cat === 'color' ? colorToEdit : stripVars }
								disabled={ isSaving }
								placeholder={ cat === 'button' ? sprintf( /* translators: %s: the value a button uses when this is left empty. */ __( 'Follows %s', 'blicks' ), stripVars( BUTTON_FOLLOWS[ slug ] ?? '' ) ) : undefined }
								onCommit={ next => ds.updateTokenDraft( cat, slug, next ) }
								onRevert={ () => undefined }
							/>
						) }
					</div>
					{ more && (
						<button
							type="button"
							className="icon-btn sm more"
							aria-expanded={ open }
							aria-label={ sprintf( /* translators: %s: token name. */ __( 'Edit the parts of %s', 'blicks' ), name ) }
							title={ __( 'Edit the parts', 'blicks' ) }
							onClick={ () => setOpenParts( open ? null : id ) }
						>{ CHEV }</button>
					) }
					{ overridden( cat, slug ) && ! isSaving ? (
						<button
							type="button"
							className="icon-btn sm"
							title={ own ? __( 'Remove this new token', 'blicks' ) : __( 'Back to theme value', 'blicks' ) }
							aria-label={ sprintf( own ? /* translators: %s: token name. */ __( 'Remove %s', 'blicks' ) : /* translators: %s: token name. */ __( 'Reset %s to the theme value', 'blicks' ), name ) }
							onClick={ () => ds.resetTokenDraft( cat, slug ) }
						>{ UNDO }</button>
					) : <span aria-hidden="true" /> }
				</div>
				{ open && <div className="parts">{ cat === 'shadow' ? shadowParts( slug, v ) : gradientParts( slug, v ) }</div> }
			</div>
		);
	};

	const partField = ( id: string, label: string, value: string, onCommit: ( v: string ) => void, validate: ( v: string ) => boolean, cls = '' ): JSX.Element => (
		<div className={ `part ${ cls }` } key={ id }>
			<span id={ `${ id }-l` }>{ label }</span>
			<ValueField id={ id } value={ value } label={ label } validate={ validate } toEdit={ v => v } fromEdit={ v => v } disabled={ isSaving } onCommit={ onCommit } onRevert={ () => undefined } />
		</div>
	);

	const shadowParts = ( slug: string, v: string ): React.ReactNode => {
		const parts = parseShadow( stripVars( v ) );
		if ( ! parts ) return <p className="note">{ __( 'This shadow has more than one layer, so edit it as text above. Commas separate the layers.', 'blicks' ) }</p>;
		const commit = ( next: Partial< ShadowParts > ): void => ds.updateTokenDraft( 'shadow', slug, formatShadow( { ...parts, ...next } ) );
		const length = ( x: string ): boolean => x === '' || validateTokenValue( 'spacing', x );
		const p = `p-shadow-${ slug }`;
		return (
			<>
				{ partField( `${ p }-x`, __( 'Across', 'blicks' ), parts.x, x => commit( { x } ), length ) }
				{ partField( `${ p }-y`, __( 'Down', 'blicks' ), parts.y, y => commit( { y } ), length ) }
				{ partField( `${ p }-blur`, __( 'Blur', 'blicks' ), parts.blur, blur => commit( { blur } ), length ) }
				{ partField( `${ p }-spread`, __( 'Spread', 'blicks' ), parts.spread, spread => commit( { spread } ), length ) }
				{ partField( `${ p }-color`, __( 'Color', 'blicks' ), parts.color, color => commit( { color } ), c => c === '' || isColorValue( c ), 'wide' ) }
				<label className="chk">
					<input type="checkbox" checked={ parts.inset } disabled={ isSaving } onChange={ event => commit( { inset: event.currentTarget.checked } ) } />
					{ __( 'Inside the edge', 'blicks' ) }
				</label>
				<p className="note">{ __( 'A see-through color, like rgb(0 0 0 / 0.1), keeps a shadow soft on every background.', 'blicks' ) }</p>
			</>
		);
	};

	const gradientParts = ( slug: string, v: string ): React.ReactNode => {
		const parts = parseGradient( stripVars( v ) );
		if ( ! parts ) return <p className="note">{ __( 'This gradient is written in a form the parts editor can’t take apart. Edit it as text above.', 'blicks' ) }</p>;
		const commit = ( next: Partial< GradientParts > ): void => ds.updateTokenDraft( 'gradient', slug, formatGradient( { ...parts, ...next } ) );
		const setStop = ( index: number, key: 'color' | 'pos', value: string ): void =>
			commit( { stops: parts.stops.map( ( stop, i ) => ( i === index ? { ...stop, [ key ]: value } : stop ) ) } );
		const p = `p-gradient-${ slug }`;
		return (
			<>
				<div className="part">
					<span>{ __( 'Type', 'blicks' ) }</span>
					<span className="vfield">
						<select value={ parts.kind } disabled={ isSaving } aria-label={ __( 'Gradient type', 'blicks' ) } onChange={ event => commit( { kind: event.currentTarget.value as GradientParts[ 'kind' ], geometry: '' } ) }>
							<option value="linear">{ __( 'Straight', 'blicks' ) }</option>
							<option value="radial">{ __( 'Round', 'blicks' ) }</option>
							<option value="conic">{ __( 'Around a point', 'blicks' ) }</option>
						</select>
					</span>
				</div>
				{ partField( `${ p }-geom`, parts.kind === 'linear' ? __( 'Angle or direction', 'blicks' ) : __( 'Shape and position', 'blicks' ), parts.geometry, geometry => commit( { geometry } ), () => true, 'wide' ) }
				<span className="gbar" style={ { background: v } } aria-hidden="true" />
				<div className="stops" role="group" aria-label={ __( 'Color stops', 'blicks' ) }>
					{ parts.stops.map( ( stop, index ) => (
						<div className="stop" key={ index }>
							<label className="sw" style={ { background: stop.color } }>
								<input type="color" value={ hexOf( stop.color ) } disabled={ isSaving } aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Pick stop %d color', 'blicks' ), index + 1 ) } onChange={ event => setStop( index, 'color', event.currentTarget.value ) } />
							</label>
							<ValueField id={ `${ p }-s${ index }c` } value={ stop.color } label={ sprintf( /* translators: %d: stop number. */ __( 'Stop %d color', 'blicks' ), index + 1 ) } validate={ isColorValue } toEdit={ x => x } fromEdit={ x => x } disabled={ isSaving } onCommit={ c => setStop( index, 'color', c ) } onRevert={ () => undefined } />
							<ValueField id={ `${ p }-s${ index }p` } value={ stop.pos } label={ sprintf( /* translators: %d: stop number. */ __( 'Stop %d position', 'blicks' ), index + 1 ) } validate={ x => x === '' || /^-?[\d.]+(%|px|deg|turn)?$/.test( x ) } toEdit={ x => x } fromEdit={ x => x } disabled={ isSaving } onCommit={ pos => setStop( index, 'pos', pos ) } onRevert={ () => undefined } />
							<button type="button" className="icon-btn sm" disabled={ isSaving || parts.stops.length <= 2 } aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Remove stop %d', 'blicks' ), index + 1 ) } onClick={ () => commit( { stops: parts.stops.filter( ( _, i ) => i !== index ) } ) }>×</button>
						</div>
					) ) }
				</div>
				<div className="full">
					<button type="button" className="link-btn" disabled={ isSaving } onClick={ () => commit( { stops: [ ...parts.stops, { color: parts.stops[ parts.stops.length - 1 ].color, pos: '' } ] } ) }>
						{ __( 'Add a color stop', 'blicks' ) }
					</button>
				</div>
			</>
		);
	};

	const list = ( cat: string, slugs = keys( cat ), add = true ): JSX.Element => (
		<div className="list">
			{ slugs.map( slug => tokenRow( cat, slug ) ) }
			{ add && ADDABLE[ cat ] && <AddToken cat={ cat } taken={ keys( cat ) } disabled={ isSaving } onAdd={ ( slug, value ) => {
				ds.updateTokenDraft( cat, slug, value );
				toast( sprintf( /* translators: %s: token name. */ __( '%s added. Save to keep it.', 'blicks' ), titleCase( slug ) ) );
				window.setTimeout( () => document.getElementById( `f-${ cat }-${ slug }` )?.focus(), 0 );
			} } /> }
		</div>
	);

	const head = ( item: DesignSection, extra?: React.ReactNode ): JSX.Element => (
		<div className="head">
			<div><h1>{ item.label }</h1><p>{ item.desc }</p></div>
			{ extra }
		</div>
	);
	const sub = ( title: string, text = '' ): JSX.Element => <div className="sub"><h3>{ title }</h3>{ text && <p>{ text }</p> }</div>;

	/* ── sections ────────────────────────────────────────────────────────── */

	const colorView = ( item: DesignSection ): JSX.Element => {
		const pairs: Array< [ string, string, string ] > = [
			[ 'background', 'foreground', __( 'Page', 'blicks' ) ],
			[ 'primary', 'primary-foreground', __( 'Main button', 'blicks' ) ],
			[ 'secondary', 'secondary-foreground', __( 'Quiet button', 'blicks' ) ],
			[ 'accent', 'accent-foreground', __( 'Highlight', 'blicks' ) ],
			[ 'muted', 'muted-foreground', __( 'Subtle panel', 'blicks' ) ],
			[ 'card', 'card-foreground', __( 'Card', 'blicks' ) ],
			[ 'popover', 'popover-foreground', __( 'Menu', 'blicks' ) ],
		];
		const all = keys( 'color' );
		const shown = pairs.filter( ( [ a, b ] ) => all.includes( a ) && all.includes( b ) );
		const inPairs = new Set( shown.flat() );
		const crow = ( slug: string, label: string ): JSX.Element => {
			const v = val( 'color', slug );
			const name = titleCase( slug );
			return (
				<div className="crow" data-tok={ `color.${ slug }` } key={ slug }>
					<label className="sw" style={ { background: v } } title={ sprintf( /* translators: %s: color name. */ __( 'Pick %s', 'blicks' ), name ) }>
						<input type="color" value={ hexOf( v ) } disabled={ isSaving } aria-label={ sprintf( /* translators: %s: color name. */ __( 'Pick %s', 'blicks' ), name ) } onChange={ event => ds.updateTokenDraft( 'color', slug, event.currentTarget.value ) } />
					</label>
					<span className="k">{ label }{ unsaved.has( `t:color:${ slug }` ) && <i className="chg" title={ __( 'Unsaved change', 'blicks' ) } /> }</span>
					<ValueField id={ `f-color-${ slug }` } value={ v } label={ sprintf( /* translators: %s: color name. */ __( '%s value', 'blicks' ), name ) } validate={ isColorValue } toEdit={ colorToEdit } disabled={ isSaving } onCommit={ next => ds.updateTokenDraft( 'color', slug, next ) } onRevert={ () => undefined } />
					{ overridden( 'color', slug ) && ! isSaving ? (
						<button type="button" className="icon-btn sm" title={ __( 'Back to theme value', 'blicks' ) } aria-label={ sprintf( /* translators: %s: color name. */ __( 'Reset %s to the theme value', 'blicks' ), name ) } onClick={ () => ds.resetTokenDraft( 'color', slug ) }>{ UNDO }</button>
					) : <span aria-hidden="true" /> }
				</div>
			);
		};
		return (
			<>
				{ head( item ) }
				<ThemesView ds={ ds } head={ sub( __( 'Palettes', 'blicks' ), __( 'Using one repaints your brand colors. Your design language stays.', 'blicks' ) ) } colorChanges={ changes.filter( change => change.category === 'color' ).length } unsavedCount={ changes.length } />
				{ sub( __( 'Pairs', 'blicks' ), __( 'A surface and the text on it', 'blicks' ) ) }
				<div className="pairs">
					{ shown.map( ( [ surface, text, label ] ) => (
						<div className="pair" key={ surface }>
							<div className="pair-demo" style={ { background: val( 'color', surface ), color: val( 'color', text ) } } data-tok={ `color.${ surface }` }>
								<span className="tx"><b>{ label }</b>{ about[ `color.${ surface }` ] }<code>{ `--blicks-color-${ surface }` }</code></span>
								<span className="aa" aria-hidden="true">Aa</span>
							</div>
							<div className="pair-rows">
								<div className="pair-grade"><span>{ __( 'Readability', 'blicks' ) }</span><Grade surface={ val( 'color', surface ) } text={ val( 'color', text ) } /></div>
								{ crow( surface, __( 'Surface', 'blicks' ) ) }
								{ crow( text, __( 'Text', 'blicks' ) ) }
							</div>
						</div>
					) ) }
				</div>
				{ sub( __( 'On their own', 'blicks' ), __( 'Used on top of any surface', 'blicks' ) ) }
				{ list( 'color', all.filter( slug => ! inPairs.has( slug ) ) ) }
			</>
		);
	};

	const typeView = ( item: DesignSection ): JSX.Element => {
		const familyOptions: Array< { slug: string; name: string; library: boolean } > = [];
		const seen = new Set< string >();
		for ( const slug of keys( 'fontFamily' ) ) {
			if ( ! seen.has( slug ) ) { seen.add( slug ); familyOptions.push( { slug, name: titleCase( slug ), library: false } ); }
		}
		for ( const fam of snapshot.fontLibrary ) {
			if ( ! seen.has( fam.slug ) ) { seen.add( fam.slug ); familyOptions.push( { slug: fam.slug, name: fam.name, library: true } ); }
		}
		const familySlug = ( value: string ): string => /^var\(--wp--preset--font-family--([a-z0-9-]+)\)$/.exec( value )?.[ 1 ] ?? value;
		const cardNames: Record< string, string > = { sans: __( 'Main font', 'blicks' ), serif: __( 'Serif font', 'blicks' ), mono: __( 'Code font', 'blicks' ) };
		const library = snapshot.fontLibrary.filter( fam => ! keys( 'fontFamily' ).includes( fam.slug ) );

		return (
			<>
				{ head( item ) }
				{ sub( __( 'Fonts', 'blicks' ) ) }
				<div className="fam">
					{ keys( 'fontFamily' ).map( slug => {
						const v = val( 'fontFamily', slug );
						return (
							<div className="fam-card" data-tok={ `fontFamily.${ slug }` } key={ slug }>
								<span className="big" style={ { fontFamily: v } } aria-hidden="true">Ag</span>
								<span className="k">
									{ cardNames[ slug ] ?? titleCase( slug ) }
									{ unsaved.has( `t:fontFamily:${ slug }` ) && <i className="chg" title={ __( 'Unsaved change', 'blicks' ) } /> }
								</span>
								<div className="fam-f">
									<ValueField id={ `f-fontFamily-${ slug }` } value={ v } label={ sprintf( /* translators: %s: font role. */ __( '%s family', 'blicks' ), cardNames[ slug ] ?? titleCase( slug ) ) } validate={ validator( 'fontFamily' ) } disabled={ isSaving } onCommit={ next => ds.updateTokenDraft( 'fontFamily', slug, next ) } onRevert={ () => undefined } />
									{ overridden( 'fontFamily', slug ) && ! isSaving && <button type="button" className="icon-btn sm" title={ __( 'Back to theme value', 'blicks' ) } aria-label={ __( 'Reset to the theme value', 'blicks' ) } onClick={ () => ds.resetTokenDraft( 'fontFamily', slug ) }>{ UNDO }</button> }
								</div>
							</div>
						);
					} ) }
				</div>
				{ library.length > 0 && (
					<div className="libline">
						{ __( 'Also in your Font Library, to pick per text style:', 'blicks' ) }
						{ library.map( fam => <span key={ fam.slug }><i style={ { fontFamily: fam.fontFamily } } aria-hidden="true">Ag</i>{ fam.name }</span> ) }
					</div>
				) }
				{ sub( __( 'Text styles', 'blicks' ), __( 'Open one to change it', 'blicks' ) ) }
				<div className="list">
					{ snapshot.typeRoles.roles.map( role => {
						const label = TYPE_ROLE_LABELS[ role ] ?? titleCase( role );
						const open = openRole === role;
						const dirty = changes.some( change => change.kind === 'role' && change.slug === role );
						const style: React.CSSProperties = {
							fontSize: `min(40px, ${ roleVal( role, 'fontSize' ) || '16px' })`,
							fontWeight: roleVal( role, 'fontWeight' ) as React.CSSProperties[ 'fontWeight' ],
							lineHeight: roleVal( role, 'lineHeight' ),
							letterSpacing: roleVal( role, 'letterSpacing' ),
							textTransform: roleVal( role, 'textTransform' ) as React.CSSProperties[ 'textTransform' ],
							fontFamily: roleVal( role, 'fontFamily' ),
						};
						const field = ( prop: string, fieldLabel: string ): JSX.Element => (
							<label key={ prop }>
								{ fieldLabel }
								<ValueField
									id={ `f-role-${ role }-${ prop }` }
									value={ roleVal( role, prop ) }
									label={ `${ label } ${ fieldLabel.toLowerCase() }` }
									validate={ v => validateTypeRoleValue( prop, v ) }
									disabled={ isSaving }
									onCommit={ next => ds.updateTypeRoleDraft( role, prop, next ) }
									onRevert={ () => undefined }
								/>
							</label>
						);
						const family = familySlug( roleVal( role, 'fontFamily' ) );
						return (
							<div className={ `role${ open ? ' open' : '' }` } data-tok={ `type.${ role }` } key={ role }>
								<button type="button" className="role-row" aria-expanded={ open } aria-controls={ `role-${ role }` } onClick={ () => setOpenRole( open ? null : role ) }>
									<span className="k">{ label }{ dirty && <i className="chg" title={ __( 'Unsaved change', 'blicks' ) } /> }</span>
									<span className="spec-t" style={ style }>{ role === 'code' ? 'const chair = oak();' : role === 'mono' ? __( 'New this season', 'blicks' ) : __( 'Furniture made to outlast', 'blicks' ) }</span>
									<span className="m">{ [ stripVars( roleVal( role, 'fontSize' ) ), roleVal( role, 'fontWeight' ), stripVars( roleVal( role, 'lineHeight' ) ) ].filter( Boolean ).join( ' · ' ) }</span>
									<span className="chev">{ CHEV }</span>
								</button>
								{ open && (
									<div className="role-edit" id={ `role-${ role }` }>
										{ field( 'fontSize', __( 'Size', 'blicks' ) ) }
										{ field( 'fontWeight', __( 'Weight', 'blicks' ) ) }
										{ field( 'lineHeight', __( 'Line height', 'blicks' ) ) }
										{ field( 'letterSpacing', __( 'Letter spacing', 'blicks' ) ) }
										<label>
											{ __( 'Font', 'blicks' ) }
											<span className="vfield">
												<select value={ family } disabled={ isSaving } onChange={ event => ds.updateTypeRoleDraft( role, 'fontFamily', `var(--wp--preset--font-family--${ event.currentTarget.value })` ) }>
													<optgroup label={ __( 'Theme fonts', 'blicks' ) }>
														{ familyOptions.filter( o => ! o.library ).map( o => <option key={ o.slug } value={ o.slug }>{ o.name }</option> ) }
													</optgroup>
													{ familyOptions.some( o => o.library ) && (
														<optgroup label={ __( 'Font Library', 'blicks' ) }>
															{ familyOptions.filter( o => o.library ).map( o => <option key={ o.slug } value={ o.slug }>{ o.name }</option> ) }
														</optgroup>
													) }
													{ ! familyOptions.some( o => o.slug === family ) && <option value={ family }>{ family }</option> }
												</select>
											</span>
										</label>
										<label>
											{ __( 'Letters', 'blicks' ) }
											<span className="vfield">
												<select value={ roleVal( role, 'textTransform' ) || 'none' } disabled={ isSaving } onChange={ event => ds.updateTypeRoleDraft( role, 'textTransform', event.currentTarget.value ) }>
													<option value="none">{ __( 'As typed', 'blicks' ) }</option>
													<option value="uppercase">{ __( 'CAPITALS', 'blicks' ) }</option>
													<option value="lowercase">{ __( 'lowercase', 'blicks' ) }</option>
													<option value="capitalize">{ __( 'Title Case', 'blicks' ) }</option>
												</select>
											</span>
										</label>
										{ Object.keys( typeRoleDraft[ role ] ?? {} ).length > 0 && (
											<div className="full">
												<button type="button" className="link-btn" disabled={ isSaving } onClick={ () => ds.resetTypeRoleDraft( role ) }>
													{ sprintf( /* translators: %s: text style name. */ __( 'Reset %s to the theme', 'blicks' ), label ) }
												</button>
											</div>
										) }
									</div>
								) }
							</div>
						);
					} ) }
				</div>
			</>
		);
	};

	const bpView = ( item: DesignSection ): JSX.Element => {
		const editable = snapshot.breakpoints.filter( bp => bp.max !== null );
		const width = ( id: string ): number => breakpointDraft[ id ] ?? snapshot.breakpoints.find( bp => bp.id === id )?.max ?? 0;
		const tablet = width( 'tablet' ) || 782;
		const mobile = width( 'mobile' ) || 600;
		const max = 1600;
		const pct = ( x: number ): number => Math.max( 0, Math.min( 100, ( x / max ) * 100 ) );
		const now = viewport <= mobile ? 'm' : viewport <= tablet ? 't' : 'd';
		const band = ( from: number, to: number, name: string, range: string, on: boolean ): JSX.Element => (
			<div className={ `band${ on ? ' now' : '' }` } style={ { left: `${ pct( from ) }%`, width: `${ pct( to ) - pct( from ) }%` } }><b>{ name }</b>{ range }</div>
		);
		const names: Record< string, string > = { m: __( 'Phone', 'blicks' ), t: __( 'Tablet', 'blicks' ), d: __( 'Desktop', 'blicks' ) };
		return (
			<>
				{ head( item ) }
				<div className="ruler" aria-hidden="true">
					{ band( 0, mobile, names.m, sprintf( /* translators: %d: width in px. */ __( 'up to %dpx', 'blicks' ), mobile ), now === 'm' ) }
					{ band( mobile, tablet, names.t, `${ mobile + 1 }–${ tablet }px`, now === 't' ) }
					{ band( tablet, max, names.d, sprintf( /* translators: %d: width in px. */ __( '%dpx and up', 'blicks' ), tablet + 1 ), now === 'd' ) }
				</div>
				<p className="hint">
					{ sprintf( /* translators: 1: window width in px, 2: device name. */ __( 'This window is %1$dpx wide, so you’re on %2$s.', 'blicks' ), viewport, names[ now ] ) }
					{ mobile >= tablet && <span className="warn-t"> { __( 'Phone must be narrower than tablet.', 'blicks' ) }</span> }
				</p>
				<div className="list">
					{ editable.map( bp => (
						<div className="tok" data-tok={ `breakpoint.${ bp.id }` } key={ bp.id }>
							<div className="tok-row">
								<div className="spec"><span className="zbadge sm">{ width( bp.id ) }px</span></div>
								<div className="tok-name">
									<b>{ bp.label }{ unsaved.has( `b:${ bp.id }` ) && <i className="chg" title={ __( 'Unsaved change', 'blicks' ) } /> }</b>
									<span>{ bp.id === 'tablet' ? __( 'Tablet layout starts at or below this width', 'blicks' ) : __( 'Phone layout starts at or below this width', 'blicks' ) }</span>
								</div>
								<div className="tok-val">
									<ValueField
										id={ `f-bp-${ bp.id }` }
										value={ String( width( bp.id ) ) }
										label={ sprintf( /* translators: %s: breakpoint name. */ __( '%s width in pixels', 'blicks' ), bp.label ) }
										validate={ v => /^\d+$/.test( v ) && +v >= 320 && +v <= 2400 }
										toEdit={ v => v }
										fromEdit={ v => v }
										unit="px"
										inputMode="numeric"
										disabled={ isSaving }
										onCommit={ next => ds.updateBreakpointDraft( bp, next ) }
										onRevert={ () => undefined }
									/>
								</div>
								{ has( breakpointDraft, bp.id ) && ! isSaving ? (
									<button type="button" className="icon-btn sm" title={ __( 'Back to default', 'blicks' ) } aria-label={ sprintf( /* translators: %s: breakpoint name. */ __( 'Reset %s to the default', 'blicks' ), bp.label ) } onClick={ () => ds.resetBreakpointDraft( bp.id ) }>{ UNDO }</button>
								) : <span aria-hidden="true" /> }
							</div>
						</div>
					) ) }
				</div>
			</>
		);
	};

	const layersView = ( item: DesignSection ): JSX.Element => {
		const sorted = keys( 'zIndex' ).slice().sort( ( a, b ) => ( parseInt( val( 'zIndex', b ), 10 ) || 0 ) - ( parseInt( val( 'zIndex', a ), 10 ) || 0 ) );
		const seen = new Map< string, string >();
		let clash = '';
		for ( const slug of sorted ) {
			const v = val( 'zIndex', slug );
			if ( seen.has( v ) && ! clash ) clash = slug;
			seen.set( v, slug );
		}
		return (
			<>
				{ head( item ) }
				<p className="hint">
					{ __( 'Listed top to bottom, the way they stack.', 'blicks' ) }
					{ clash && <span className="warn-t"> { sprintf( /* translators: %s: layer name. */ __( '%s shares a number with another layer, so which one wins depends on page order.', 'blicks' ), titleCase( clash ) ) }</span> }
				</p>
				{ list( 'zIndex', sorted ) }
			</>
		);
	};

	const outView = ( item: DesignSection ): JSX.Element => {
		const tokenLines = changes.map( change => {
			if ( change.kind === 'role' ) return `/* ${ change.label } */ ${ change.prop }: ${ change.to };`;
			if ( change.kind === 'breakpoint' ) return `/* ${ change.label } */ ${ change.to }`;
			return `--blicks-${ change.category }-${ change.slug }: ${ change.to };`;
		} );
		const css = tokenLines.length ? tokenLines.map( lineText => `  ${ lineText }` ).join( '\n' ) : `  /* ${ __( 'Nothing waiting to be saved.', 'blicks' ) } */`;
		const readFrom = snapshot.source.themeJson ? __( 'Your theme’s theme.json', 'blicks' ) : __( 'Blicks defaults (your theme has no theme.json)', 'blicks' );
		return (
			<>
				{ head( item ) }
				<div className="flow">
					<div><span>{ __( 'Read from', 'blicks' ) }</span><b>{ readFrom }</b></div>
					<div><span>{ __( 'Changed in', 'blicks' ) }</span><b>{ sprintf( /* translators: %d: number of unsaved changes. */ __( 'Blicks · %d unsaved', 'blicks' ), changes.length ) }</b></div>
					<div><span>{ __( 'Saved to', 'blicks' ) }</span><b>{ activeTheme ? activeTheme.name : __( 'Your Blicks settings', 'blicks' ) }</b></div>
				</div>
				{ sub( __( 'Waiting to be saved', 'blicks' ) ) }
				<pre className="out" tabIndex={ 0 }>{ `:root {\n${ css }\n}` }</pre>
				<p className="out-note">
					{ themeJsonSync
						? __( 'Global Styles sync is on, so a save also writes these values into the Site Editor.', 'blicks' )
						: __( 'Global Styles sync is off. Turn it on in Settings to also write these values into the Site Editor.', 'blicks' ) }
					{ ' ' }
					<a href={ urlForView( 'settings' ) } onClick={ event => { event.preventDefault(); onViewChange( 'settings' ); } }>{ __( 'Open Settings', 'blicks' ) }</a>
				</p>
			</>
		);
	};

	const views: Record< string, ( item: DesignSection ) => JSX.Element > = {
		look: item => <LanguageView ds={ ds } head={ head( item ) } val={ val } roleVal={ roleVal } unsavedCount={ changes.length } />,
		color: colorView,
		type: typeView,
		space: item => <>{ head( item ) }{ list( 'spacing' ) }</>,
		size: item => <>{ head( item ) }{ sub( __( 'Page content', 'blicks' ), __( 'Where the theme’s content column stops', 'blicks' ) ) }{ list( 'content', keys( 'content' ), false ) }{ sub( __( 'Content widths', 'blicks' ) ) }{ list( 'width' ) }{ sub( __( 'Media shapes', 'blicks' ) ) }{ list( 'aspect' ) }</>,
		bp: bpView,
		radius: item => <>{ head( item ) }{ list( 'radius' ) }</>,
		shadow: item => <>{ head( item ) }{ list( 'shadow' ) }</>,
		border: item => <>{ head( item ) }{ list( 'borderWidth' ) }</>,
		gradient: item => <>{ head( item ) }{ list( 'gradient' ) }</>,
		button: item => <>{ head( item ) }{ list( 'button', keys( 'button' ), false ) }</>,
		motion: item => (
			<>
				{ head( item, <button type="button" className="pill sm" onClick={ () => document.querySelectorAll< HTMLButtonElement >( '.blicks-admin .track' ).forEach( track => track.click() ) }>{ PLAY } { __( 'Play all', 'blicks' ) }</button> ) }
				{ list( 'transition' ) }
			</>
		),
		effects: item => <>{ head( item ) }{ sub( __( 'Moves', 'blicks' ) ) }{ list( 'transform' ) }{ sub( __( 'Image treatments', 'blicks' ) ) }{ list( 'filter' ) }</>,
		anim: item => <AnimationsView animations={ animations } head={ ( extra?: React.ReactNode ) => head( item, extra ) } />,
		opacity: item => <>{ head( item ) }{ list( 'opacity' ) }</>,
		layers: layersView,
		leading: item => <>{ head( item ) }{ list( 'leading' ) }</>,
		out: outView,
	};

	/* ── search: every token whose name or purpose matches, editable in place ── */

	const searchView = (): JSX.Element => {
		const q = query.trim().toLowerCase();
		const groups = sections.filter( item => item.cats ).map( item => {
			const hits = ( item.cats ?? [] ).filter( cat => cat !== 'typeRoles' && cat !== 'breakpoints' ).flatMap( cat =>
				keys( cat )
					.filter( slug => `${ slug } ${ about[ `${ cat }.${ slug }` ] ?? '' } ${ item.label } ${ cat }`.toLowerCase().includes( q ) )
					.map( slug => tokenRow( cat, slug ) )
			);
			return { item, hits };
		} ).filter( group => group.hits.length > 0 );
		return (
			<>
				<div className="head">
					<div>
						<h1>{ sprintf( /* translators: %s: search words. */ __( 'Results for “%s”', 'blicks' ), query.trim() ) }</h1>
						<p>{ __( 'Edit right here, or open the section for context.', 'blicks' ) }</p>
					</div>
				</div>
				{ groups.length === 0 && <div className="empty" role="status">{ sprintf( /* translators: %s: search words. */ __( 'No token matches “%s”. Try what it’s for, like “button” or “card”.', 'blicks' ), query.trim() ) }</div> }
				{ groups.map( ( { item, hits } ) => (
					<Fragment key={ item.id }>
						<h2 className="res-h">{ item.label } <button type="button" className="link-btn" onClick={ () => go( item.id ) }>{ __( 'Open section', 'blicks' ) }</button></h2>
						<div className="list">{ hits }</div>
					</Fragment>
				) ) }
			</>
		);
	};

	const current = sections.find( item => item.id === section ) ?? sections[ 1 ];
	const searching = query.trim() !== '';
	const pointAt = ( target: EventTarget | null ): void => {
		const tok = ( target as HTMLElement | null )?.closest?.( '[data-tok]' ) as HTMLElement | null;
		setHighlight( tok?.dataset.tok ?? null );
		// Moving across the gaps between language cards keeps the last one shown, and leaving the
		// cards lets go after a beat, so sweeping over them is one smooth change, not a flicker.
		const el = target as HTMLElement | null;
		const card = el?.closest?.( '[data-language]' ) as HTMLElement | null;
		window.clearTimeout( peekTimer.current );
		if ( card ) {
			const id = card.dataset.language ?? null;
			setPeek( id && id !== snapshot.language.active ? id : null );
		} else if ( ! el?.closest?.( '.looks' ) ) {
			letGoOfPeek();
		}
	};
	const languageOf = ( id: string ) => snapshot.language.languages.find( language => language.id === id );
	const shown = languageOf( peek ?? snapshot.language.active );
	const look = shown ? languageVars( shown.sample, slug => val( 'color', slug ), !! peek ) : {};

	return (
		<div className="ds-body">
			<aside className="nav" aria-label={ __( 'Design system sections', 'blicks' ) }>
				<label className="search">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" /></svg>
					<input type="search" id="ds-find" value={ query } placeholder={ __( 'Find a token', 'blicks' ) } aria-label={ __( 'Find a token, like primary or radius', 'blicks' ) } autoComplete="off" onChange={ event => setQuery( event.currentTarget.value ) } />
				</label>
				<nav className="nav-list" aria-label={ __( 'Sections', 'blicks' ) }>
					{ nav.map( group => (
						<Fragment key={ group.group }>
							<h2>{ group.group }</h2>
							{ group.items.map( item => {
								const n = count( item );
								const dirty = sectionDirty( changes, item.cats );
								return (
									<a
										key={ item.id }
										className="nav-item"
										href={ urlForView( 'design', item.id ) }
										aria-current={ section === item.id && ! searching ? 'page' : undefined }
										onClick={ event => {
											if ( event.metaKey || event.ctrlKey || event.shiftKey ) return;
											event.preventDefault();
											go( item.id );
										} }
									>
										<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={ item.id === 'motion' ? 'none' : 'currentColor' } stroke={ item.id === 'motion' ? 'currentColor' : 'none' } strokeWidth="2"><path d={ item.icon } /></svg>
										<span>{ item.label }</span>
										{ dirty && <span className="dot" title={ __( 'Unsaved changes', 'blicks' ) } /> }
										{ n > 0 && <span className="n">{ n }</span> }
									</a>
								);
							} ) }
						</Fragment>
					) ) }
				</nav>
				<div className="nav-foot">
					<span>{ __( 'Reading from', 'blicks' ) }</span>
					<b>{ snapshot.source.themeJson ? __( 'theme.json + Blicks overrides', 'blicks' ) : __( 'Blicks defaults + overrides', 'blicks' ) }</b>
					<span>{ __( 'Design language:', 'blicks' ) } <b>{ snapshot.language.languages.find( language => language.id === snapshot.language.active )?.name ?? '' }</b></span>
					{ activeTheme && <span>{ __( 'Palette:', 'blicks' ) } <b>{ activeTheme.name }</b></span> }
				</div>
			</aside>

			<main
				className="main"
				onPointerOver={ event => pointAt( event.target ) }
				onPointerLeave={ () => { setHighlight( null ); letGoOfPeek(); } }
				onFocus={ event => pointAt( event.target ) }
			>
				<div className="main-in" aria-busy={ ds.apiStatus === 'loading' }>
					{ searching ? searchView() : views[ current.id ]( current ) }
				</div>
			</main>

			<SitePreview
				val={ val }
				roleVal={ roleVal }
				highlight={ highlight }
				look={ look }
				note={ peek && shown ? sprintf( /* translators: %s: design language name. */ __( 'Showing %s. Choose it to keep it.', 'blicks' ), shown.name ) : undefined }
			/>
		</div>
	);
}

/* ── adding a token of your own ─────────────────────────────────────────── */

const PLACEHOLDERS: Record< string, string > = {
	color: '#0f766e', spacing: '1.25rem', radius: '0.375rem', shadow: '0 2px 6px rgb(0 0 0 / 0.1)', gradient: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
	transition: 'all 250ms ease', zIndex: '700', opacity: '0.8', borderWidth: '4px', width: '880px', leading: '1.45',
};

function AddToken( { cat, taken, disabled, onAdd }: { cat: string; taken: string[]; disabled: boolean; onAdd: ( slug: string, value: string ) => void } ): JSX.Element {
	const [ open, setOpen ] = useState( false );
	const [ name, setName ] = useState( '' );
	const [ value, setValue ] = useState( '' );
	const kind = ADDABLE[ cat ];
	const slug = slugify( name );
	const stored = wrapVars( value.trim() );
	let message: React.ReactNode;
	let ok = false;
	let bad = false;
	if ( ! slug ) {
		message = __( 'Give it a name. Blocks offer it by that name.', 'blicks' );
	} else if ( taken.includes( slug ) ) {
		bad = true;
		message = sprintf( /* translators: 1: kind of token, 2: token name. */ __( 'There’s already a %1$s token called “%2$s”.', 'blicks' ), kind, slug );
	} else if ( ! value.trim() ) {
		message = <>{ __( 'Becomes', 'blicks' ) } <code>{ `--blicks-${ cat }-${ slug }` }</code>. { __( 'Now give it a value.', 'blicks' ) }</>;
	} else if ( ! ( cat === 'color' ? isColorValue( stored ) : validateTokenValue( cat, stored ) ) ) {
		bad = true;
		message = __( 'Not a value browsers understand yet.', 'blicks' );
	} else {
		ok = true;
		message = <>{ __( 'Becomes', 'blicks' ) } <code>{ `--blicks-${ cat }-${ slug }` }</code>{ __( ', added as an unsaved change.', 'blicks' ) }</>;
	}

	const close = (): void => {
		setOpen( false );
		setName( '' );
		setValue( '' );
	};

	if ( ! open ) {
		return (
			<button type="button" className="addtok" disabled={ disabled } onClick={ () => setOpen( true ) } id={ `add-${ cat }` }>
				{ PLUS }
				{ sprintf( /* translators: %s: kind of token, e.g. "spacing". */ __( 'Add a %s token', 'blicks' ), kind ) }
			</button>
		);
	}

	return (
		<div
			className="addnew"
			onKeyDown={ event => {
				if ( event.key === 'Escape' ) {
					close();
					window.setTimeout( () => document.getElementById( `add-${ cat }` )?.focus(), 0 );
				}
				if ( event.key === 'Enter' && ok ) {
					onAdd( slug, stored );
					close();
				}
			} }
		>
			<label className="vfield">
				<input autoFocus value={ name } placeholder={ __( 'Name, like brand 2', 'blicks' ) } aria-label={ sprintf( /* translators: %s: kind of token. */ __( 'New %s token name', 'blicks' ), kind ) } autoComplete="off" spellCheck={ false } onChange={ event => setName( event.currentTarget.value ) } />
			</label>
			<label className="vfield">
				<input value={ value } placeholder={ PLACEHOLDERS[ cat ] } aria-label={ sprintf( /* translators: %s: kind of token. */ __( 'New %s token value', 'blicks' ), kind ) } autoComplete="off" spellCheck={ false } onChange={ event => setValue( event.currentTarget.value ) } />
			</label>
			<button type="button" className="pill sm" onClick={ close }>{ __( 'Cancel', 'blicks' ) }</button>
			<button type="button" className="pill pill--filled sm" disabled={ ! ok } onClick={ () => { onAdd( slug, stored ); close(); } }>{ __( 'Add', 'blicks' ) }</button>
			<p className={ `addmsg${ bad ? ' bad' : '' }` } role="status">{ message }</p>
		</div>
	);
}

/* ── themes ─────────────────────────────────────────────────────────────── */

/**
 * The design language picker: each card is the same sample drawn in its language with the colors on
 * this page, and its name — the sample says the rest. Choosing one is saved at once; it changes no
 * saved value, so unsaved edits stay as they are.
 */
function LanguageView( { ds, head, val, roleVal, unsavedCount }: { ds: DesignSystemApi; head: JSX.Element; val: ( cat: string, slug: string ) => string; roleVal: ( role: string, prop: string ) => string; unsavedCount: number } ): JSX.Element {
	const toast = useToast();
	const { snapshot, isSaving } = ds;
	const { active, languages } = snapshot.language;
	const color = ( slug: string ): string => val( 'color', slug );

	const choose = async ( id: string, name: string ): Promise< void > => {
		const before = active;
		if ( await ds.chooseLanguage( id ) ) {
			toast( sprintf( /* translators: %s: design language name. */ __( '%s is your design language. Every page uses it now.', 'blicks' ), name ), () => void ds.chooseLanguage( before ) );
		}
	};

	return (
		<>
			{ head }
			<p className="lk-note">{ __( 'Point at a language to try it on the live site. Choosing one changes shared values only, so every page restyles at once and nothing is re-saved. A color or shape set by hand on a block stays as it was.', 'blicks' ) }</p>
			<div className="looks" role="radiogroup" aria-label={ __( 'Design language', 'blicks' ) }>
				{ languages.map( language => {
					const on = language.id === active;
					const vars = { ...siteVars( val, roleVal ), ...languageVars( language.sample, color, ! on ) };
					return (
						<button key={ language.id } type="button" className="look" role="radio" aria-checked={ on } data-language={ language.id } disabled={ isSaving && ! on } onClick={ () => ! on && void choose( language.id, language.name ) }>
							<span className="plate" aria-hidden="true">
								<span className="site lk-site" style={ vars as React.CSSProperties }>
									<span className="h">{ __( 'Made to outlast', 'blicks' ) }</span>
									<span className="lead">{ __( 'Solid oak, finished by hand.', 'blicks' ) }</span>
									<span className="btns"><span className="b p">{ __( 'Shop', 'blicks' ) }</span><span className="b s">{ __( 'Workshop', 'blicks' ) }</span></span>
									<span className="lk-stage"><span className="card"><span className="tag">{ __( 'In stock', 'blicks' ) }</span><span className="h4">{ __( 'Oak chair', 'blicks' ) }</span></span></span>
								</span>
							</span>
							<span className="lk-meta">
								<b title={ language.description }>{ language.name }{ on && <span className="on">{ CHECK }</span> }</b>
							</span>
						</button>
					);
				} ) }
			</div>
			<KitsView ds={ ds } unsavedCount={ unsavedCount } />
		</>
	);
}

/**
 * Kits: a design language, a palette and your own values, saved together. Using one replaces all
 * three; unsaved edits are asked about first, since they would go too.
 */
function KitsView( { ds, unsavedCount }: { ds: DesignSystemApi; unsavedCount: number } ): JSX.Element {
	const toast = useToast();
	const { kits, themes, snapshot, isSaving } = ds;
	const [ naming, setNaming ] = useState( false );
	const [ name, setName ] = useState( '' );
	const [ renaming, setRenaming ] = useState< string | null >( null );
	const [ confirm, setConfirm ] = useState< { act: 'use' | 'delete'; id: string } | null >( null );
	const target = confirm ? kits.find( kit => kit.id === confirm.id ) : undefined;
	const paletteOf = ( id: string ): DesignTheme | undefined => themes.themes.find( theme => theme.id === id );
	const languageName = ( id: string ): string => snapshot.language.languages.find( language => language.id === id )?.name ?? id;

	const use = async ( kit: DesignKit ): Promise< void > => {
		setConfirm( null );
		if ( await ds.useKit( kit.id ) ) {
			toast( sprintf( /* translators: %s: kit name. */ __( '%s in use.', 'blicks' ), kit.name ) );
		}
	};

	return (
		<>
			<div className="sub"><h3>{ __( 'Kits', 'blicks' ) }</h3><p>{ __( 'A design language, a palette and your own values, saved together', 'blicks' ) }</p></div>
			<div className="list kits">
				{ kits.length === 0 && ! naming && <p className="kits-empty">{ __( 'No kits yet. Save what you have now to come back to it in one click.', 'blicks' ) }</p> }
				{ kits.map( kit => {
					const palette = paletteOf( kit.palette );
					return (
						<div className="kit" key={ kit.id }>
							<span className="dots" aria-hidden="true">
								<i style={ { background: palette?.tokens.tokens.color?.primary ?? 'var(--ink-3)' } } />
								<i style={ { background: palette?.tokens.tokens.color?.accent ?? 'var(--hair)' } } />
							</span>
							{ renaming === kit.id ? (
								<form className="kit-rename" onSubmit={ async event => {
									event.preventDefault();
									const next = String( new FormData( event.currentTarget ).get( 'name' ) ?? '' ).trim();
									if ( next && await ds.renameKit( kit.id, next ) ) setRenaming( null );
								} }>
									<label className="vfield"><input name="name" autoFocus defaultValue={ kit.name } aria-label={ __( 'Kit name', 'blicks' ) } autoComplete="off" /></label>
									<button type="button" className="pill sm" onClick={ () => setRenaming( null ) }>{ __( 'Cancel', 'blicks' ) }</button>
									<button type="submit" className="pill pill--filled sm">{ __( 'Save name', 'blicks' ) }</button>
								</form>
							) : (
								<span className="kit-name">
									<b>{ kit.name }</b>
									<span>
										{ [
											languageName( kit.language ),
											palette?.name ?? __( 'Palette in use', 'blicks' ),
											kit.count > 0 ? sprintf( /* translators: %d: number of values. */ _n( '%d value of your own', '%d values of your own', kit.count, 'blicks' ), kit.count ) : '',
										].filter( Boolean ).join( ' · ' ) }
									</span>
								</span>
							) }
							{ renaming !== kit.id && (
								<span className="kit-acts">
									<button type="button" className="pill sm" disabled={ isSaving } onClick={ () => ( unsavedCount > 0 ? setConfirm( { act: 'use', id: kit.id } ) : void use( kit ) ) }>{ __( 'Use kit', 'blicks' ) }</button>
									<button type="button" className="link-btn" onClick={ () => setRenaming( kit.id ) }>{ __( 'Rename', 'blicks' ) }</button>
									<button type="button" className="link-btn danger" onClick={ () => setConfirm( { act: 'delete', id: kit.id } ) }>{ __( 'Delete', 'blicks' ) }</button>
								</span>
							) }
						</div>
					);
				} ) }
				{ naming ? (
					<form className="kit-new" onSubmit={ async event => {
						event.preventDefault();
						if ( name.trim() && await ds.saveKit( name.trim() ) ) {
							toast( sprintf( /* translators: %s: kit name. */ __( '“%s” saved as a kit.', 'blicks' ), name.trim() ) );
							setNaming( false );
							setName( '' );
						}
					} }>
						<label className="vfield"><input autoFocus value={ name } placeholder={ __( 'Kit name, like Shop', 'blicks' ) } aria-label={ __( 'Kit name', 'blicks' ) } autoComplete="off" onChange={ event => setName( event.currentTarget.value ) } /></label>
						<button type="button" className="pill sm" onClick={ () => setNaming( false ) }>{ __( 'Cancel', 'blicks' ) }</button>
						<button type="submit" className="pill pill--filled sm" disabled={ ! name.trim() }>{ __( 'Save kit', 'blicks' ) }</button>
						<p className="hint-s">{ unsavedCount > 0 ? sprintf( /* translators: %d: number of unsaved changes. */ _n( 'A kit keeps saved values. Save your %d change first to include it.', 'A kit keeps saved values. Save your %d changes first to include them.', unsavedCount, 'blicks' ), unsavedCount ) : __( 'Keeps your design language, palette and every value you’ve saved.', 'blicks' ) }</p>
					</form>
				) : (
					<button type="button" className="addtok" onClick={ () => setNaming( true ) }>{ PLUS }{ __( 'Save what you have now as a kit', 'blicks' ) }</button>
				) }
			</div>
			{ confirm && target && confirm.act === 'use' && (
				<div className="confirm" role="alert">
					<p>{ sprintf( /* translators: 1: kit name, 2: number of unsaved changes. */ _n( 'Use %1$s? Your %2$d unsaved change will be replaced.', 'Use %1$s? Your %2$d unsaved changes will be replaced.', unsavedCount, 'blicks' ), target.name, unsavedCount ) }</p>
					<button type="button" className="pill" onClick={ () => setConfirm( null ) }>{ __( 'Keep editing', 'blicks' ) }</button>
					<button type="button" className="pill pill--filled" autoFocus onClick={ () => void use( target ) }>{ __( 'Use kit', 'blicks' ) }</button>
				</div>
			) }
			{ confirm && target && confirm.act === 'delete' && (
				<div className="confirm warn" role="alert">
					<p>{ sprintf( /* translators: %s: kit name. */ __( 'Delete %s? What your site looks like now stays as it is.', 'blicks' ), target.name ) }</p>
					<button type="button" className="pill" onClick={ () => setConfirm( null ) }>{ __( 'Keep it', 'blicks' ) }</button>
					<button type="button" className="pill pill--danger" autoFocus onClick={ async () => {
						const kit = target;
						setConfirm( null );
						if ( await ds.deleteKit( kit.id ) ) toast( sprintf( /* translators: %s: kit name. */ __( '%s deleted', 'blicks' ), kit.name ) );
					} }>{ __( 'Delete kit', 'blicks' ) }</button>
				</div>
			) }
		</>
	);
}

function ThemesView( { ds, head, colorChanges, unsavedCount }: { ds: DesignSystemApi; head: JSX.Element; colorChanges: number; unsavedCount: number } ): JSX.Element {
	const toast = useToast();
	const { themes, isSaving } = ds;
	const [ menu, setMenu ] = useState< string | null >( null );
	const [ confirm, setConfirm ] = useState< { act: 'apply' | 'delete' | 'reset'; id: string } | null >( null );
	const [ naming, setNaming ] = useState( false );
	const [ name, setName ] = useState( '' );

	useEffect( () => {
		if ( ! menu ) return;
		const close = ( event: MouseEvent | KeyboardEvent ): void => {
			if ( event instanceof KeyboardEvent ) {
				if ( event.key !== 'Escape' ) return;
				document.querySelector< HTMLElement >( `[data-tmenu="${ menu }"]` )?.focus();
			} else if ( ( event.target as HTMLElement ).closest( '.theme-c .menu-pop, [data-tmenu]' ) ) {
				return;
			}
			setMenu( null );
		};
		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', close );
		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', close );
		};
	}, [ menu ] );

	const swatch = ( theme: DesignTheme, slug: string ): string => theme.tokens.tokens.color?.[ slug ] ?? COLOR_FALLBACKS[ slug ] ?? '';
	const target = confirm ? themes.themes.find( theme => theme.id === confirm.id ) : undefined;

	const apply = ( theme: DesignTheme ): void => {
		if ( theme.id === themes.active || isSaving ) return;
		if ( colorChanges > 0 ) setConfirm( { act: 'apply', id: theme.id } );
		else void ds.applyTheme( theme.id );
	};

	return (
		<>
			{ head }
			<div className="themes" role="radiogroup" aria-label={ __( 'Palettes', 'blicks' ) }>
				{ themes.themes.map( theme => {
					const on = theme.id === themes.active;
					const hasMenu = ! theme.builtin || ( theme.builtin && theme.edited );
					return (
						<div className="theme-c" key={ theme.id }>
							<button type="button" className="theme" role="radio" aria-checked={ on } disabled={ isSaving && ! on } onClick={ () => apply( theme ) }>
								<span className="mini" aria-hidden="true">
									<b>{ __( 'Made to outlast the trend', 'blicks' ) }</b>
									<span className="row">
										<span className="b1" style={ { background: swatch( theme, 'primary' ), color: swatch( theme, 'primary-foreground' ) } }>{ __( 'Shop', 'blicks' ) }</span>
										<span className="b2" style={ { background: swatch( theme, 'accent' ) } } />
										<span className="b2" style={ { background: swatch( theme, 'secondary' ) } } />
									</span>
								</span>
								<span className="meta">
									<span>
										<b>{ theme.name }</b>
										<span>{ theme.builtin ? __( 'Built in', 'blicks' ) : __( 'Yours', 'blicks' ) }{ theme.builtin && theme.edited && <span className="etag">{ __( 'edited', 'blicks' ) }</span> }</span>
									</span>
									{ on && <span className="on">{ CHECK }</span> }
								</span>
							</button>
							{ hasMenu && (
								<button
									type="button"
									className="icon-btn sm tmenu-btn"
									data-tmenu={ theme.id }
									aria-haspopup="menu"
									aria-expanded={ menu === theme.id }
									aria-label={ sprintf( /* translators: %s: palette name. */ __( 'More for %s', 'blicks' ), theme.name ) }
									onClick={ () => setMenu( menu === theme.id ? null : theme.id ) }
								>{ MORE }</button>
							) }
							{ menu === theme.id && (
								<div className="menu-pop" role="menu">
									{ theme.builtin ? (
										<button type="button" role="menuitem" autoFocus onClick={ () => { setMenu( null ); setConfirm( { act: 'reset', id: theme.id } ); } }>{ __( 'Reset to how Blicks ships it…', 'blicks' ) }</button>
									) : (
										<button type="button" role="menuitem" className="danger" autoFocus onClick={ () => { setMenu( null ); setConfirm( { act: 'delete', id: theme.id } ); } }>{ __( 'Delete…', 'blicks' ) }</button>
									) }
								</div>
							) }
						</div>
					);
				} ) }
				{ naming ? (
					<div className="theme new-form">
						<b id="new-theme-h">{ __( 'Save these colors as a palette', 'blicks' ) }</b>
						<label className="vfield">
							<input autoFocus value={ name } placeholder={ __( 'Palette name', 'blicks' ) } aria-labelledby="new-theme-h" autoComplete="off" onChange={ event => setName( event.currentTarget.value ) } />
						</label>
						<span className="hint-s">
							{ unsavedCount > 0
								? sprintf( /* translators: %d: number of unsaved changes. */ _n( 'A palette keeps saved colors. Save your %d change first to include it.', 'A palette keeps saved colors. Save your %d changes first to include them.', unsavedCount, 'blicks' ), unsavedCount )
								: __( 'Keeps every color you’ve saved.', 'blicks' ) }
						</span>
						<span className="row">
							<button type="button" className="pill sm" onClick={ () => setNaming( false ) }>{ __( 'Cancel', 'blicks' ) }</button>
							<button
								type="button"
								className="pill pill--filled sm"
								disabled={ ! name.trim() || isSaving }
								onClick={ async () => {
									if ( await ds.createThemeFromCurrent( name.trim() ) ) {
										toast( sprintf( /* translators: %s: palette name. */ __( '“%s” saved. Find it with your palettes.', 'blicks' ), name.trim() ) );
										setNaming( false );
										setName( '' );
									}
								} }
							>{ __( 'Save palette', 'blicks' ) }</button>
						</span>
					</div>
				) : (
					<button type="button" className="theme new" disabled={ isSaving } onClick={ () => setNaming( true ) }>
						{ PLUS }
						{ __( 'Save these colors as a palette', 'blicks' ) }
						<span>{ __( 'Keeps every color you’ve saved', 'blicks' ) }</span>
					</button>
				) }
			</div>

			{ confirm && target && confirm.act === 'apply' && (
				<div className="confirm" role="alert">
					<p>{ sprintf( /* translators: 1: palette name, 2: number of unsaved color changes. */ _n( 'Use %1$s? Your %2$d unsaved change to colors will be replaced.', 'Use %1$s? Your %2$d unsaved changes to colors will be replaced.', colorChanges, 'blicks' ), target.name, colorChanges ) }</p>
					<button type="button" className="pill" onClick={ () => setConfirm( null ) }>{ __( 'Keep editing', 'blicks' ) }</button>
					<button type="button" className="pill pill--filled" autoFocus onClick={ () => { setConfirm( null ); void ds.applyTheme( target.id ); } }>{ __( 'Use palette', 'blicks' ) }</button>
				</div>
			) }
			{ confirm && target && confirm.act === 'delete' && (
				<div className="confirm warn" role="alert">
					<p>{ sprintf( /* translators: %s: palette name. */ __( 'Delete %s?', 'blicks' ), target.name ) }{ target.id === themes.active && ` ${ __( 'It’s the palette in use; your current values stay as they are.', 'blicks' ) }` }</p>
					<button type="button" className="pill" onClick={ () => setConfirm( null ) }>{ __( 'Keep it', 'blicks' ) }</button>
					<button type="button" className="pill pill--danger" autoFocus onClick={ async () => {
						const theme = target;
						setConfirm( null );
						if ( await ds.deleteTheme( theme.id ) ) {
							toast( sprintf( /* translators: %s: palette name. */ __( '%s deleted', 'blicks' ), theme.name ), () => void ds.restoreTheme( theme ) );
						}
					} }>{ __( 'Delete palette', 'blicks' ) }</button>
				</div>
			) }
			{ confirm && target && confirm.act === 'reset' && (
				<div className="confirm" role="alert">
					<p>{ sprintf( /* translators: %s: palette name. */ __( 'Reset %s to how Blicks ships it? The values you saved into it are removed.', 'blicks' ), target.name ) }</p>
					<button type="button" className="pill" onClick={ () => setConfirm( null ) }>{ __( 'Keep my changes', 'blicks' ) }</button>
					<button type="button" className="pill pill--filled" autoFocus onClick={ () => { setConfirm( null ); void ds.resetTheme( target.id ); } }>{ __( 'Reset palette', 'blicks' ) }</button>
				</div>
			) }
		</>
	);
}

