/**
 * The design panel's controls, in the Blicks UI system: filled fields with their unit behind,
 * icon or text segments, a select, a colour field with the theme's palette, the box model, and the
 * settings edited as parts (shadow, transform, filter, outline, transition).
 *
 * Every control shows the value it will get: set here in the ink colour, otherwise the fallback
 * in grey as a placeholder or an unpressed-but-lit segment. None of them writes on its own; each
 * hands one value to `write`, which validates and saves it.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { resolveTokenValues, tokenOptions } from '@/controls/token-utils';
import { keysOf, tokensOf } from './all-settings-model';
import { COMPOSITES, CHANGES, parsePart, readTransition, splitUnit, writeTransition, type Info } from './design-model';

export { Sym } from './sym';
import { Sym } from './sym';

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** What a control receives for one setting: what it is here, and the one way to change it. */
export interface Ctl {
	id: string;
	info: Info;
	write: ( value: unknown ) => void;
	/** The engine refused the last value written here; the field shows it. */
	invalid?: boolean;
}

/* ------------------------------------------------------------------ names for stored values */

type Named = { label: string; css: string };

/** Theme tokens by every form a value can take: stored value, variable, bare slug. */
function useTokenNames( category: string | undefined ): Map< string, Named > {
	return useMemo( () => {
		const map = new Map< string, Named >();
		if ( ! category ) return map;
		const live = category === 'color' ? resolveTokenValues( 'color' as never ) : {};
		for ( const t of tokenOptions( category as never ) ) {
			const named = { label: t.label, css: live[ t.slug ] || t.css };
			for ( const k of [ t.value, t.css, t.slug ] ) map.set( k, named );
		}
		return map;
	}, [ category ] );
}

/** A value as words: a theme token by its name, a preset colour by its slug, else as written. */
export function useShow( id: string ): ( value: unknown ) => string {
	const names = useTokenNames( tokensOf( id ) );
	return ( value ) => {
		if ( value === undefined || value === null ) return '';
		const s = String( value );
		const named = names.get( s );
		if ( named ) return named.label;
		const preset = /^var\(--wp--preset--[\w-]+--([\w-]+)\)$/.exec( s );
		return preset ? `${ preset[ 1 ] } · ${ __( 'theme', 'blicks' ) }` : s;
	};
}

/** One value of a four-sided setting, for a control that edits it as one. */
export const firstOf = ( value: unknown ): unknown => ( value && typeof value === 'object' && ! Array.isArray( value ) ? Object.values( value as Record< string, unknown > )[ 0 ] : value );

/* ------------------------------------------------------------------ field */

/** A filled field: icon or letters in front, the unit behind. Commits on Enter or leaving it. */
export function Fld( { value, placeholder, unit, lead, label, invalid, wide, onCommit }: {
	value: string;
	placeholder?: string;
	unit?: string;
	lead?: ReactNode;
	label: string;
	invalid?: boolean;
	wide?: boolean;
	onCommit: ( text: string ) => void;
} ) {
	const [ draft, setDraft ] = useState< string | null >( null );
	const commit = () => {
		if ( draft !== null && draft !== value ) onCommit( draft );
		setDraft( null );
	};
	return (
		<label className={ `bui-fld${ invalid ? ' invalid' : '' }${ wide ? ' wide' : '' }` } title={ label }>
			{ lead && <span className="lead">{ lead }</span> }
			<input
				value={ draft ?? value }
				placeholder={ placeholder }
				aria-label={ label }
				aria-invalid={ invalid || undefined }
				spellCheck={ false }
				onChange={ ( e ) => setDraft( e.currentTarget.value ) }
				onBlur={ commit }
				onKeyDown={ ( e ) => {
					if ( e.key === 'Enter' ) e.currentTarget.blur();
					if ( e.key === 'Escape' && draft !== null ) {
						e.stopPropagation();
						setDraft( null );
					}
				} }
			/>
			{ unit && <span className="unit">{ unit }</span> }
		</label>
	);
}

/** A typed number gets the unit the field shows; anything else is written as typed. */
export const withUnit = ( text: string, unit: string, fallback: ( t: string ) => string | undefined ): string | undefined => {
	const s = text.trim();
	if ( ! s ) return undefined;
	return NUMBER.test( s ) && unit && Number( s ) !== 0 ? s + unit : fallback( s );
};

/**
 * A length or number setting as one field: the number set here, else the fallback as placeholder,
 * and the unit of whichever it shows (or the unit a bare number means for this setting).
 */
export function LengthField( { ctl, lead, label, side, defaultUnit, parse, show, wide }: {
	ctl: Ctl;
	lead?: ReactNode;
	label: string;
	side?: string;
	defaultUnit: string;
	parse: ( text: string ) => string | undefined;
	show: ( v: unknown ) => string;
	wide?: boolean;
} ) {
	const pick = ( v: unknown ) => ( side ? ( v && typeof v === 'object' ? ( v as Record< string, unknown > )[ side ] : v ) : v );
	const here = ctl.info.set ? pick( ctl.info.value ) : undefined;
	const fall = pick( ctl.info.value );
	const [ n, u ] = splitUnit( typeof here === 'object' ? '' : show( here ) );
	const [ pn, pu ] = splitUnit( typeof fall === 'object' ? '' : show( fall ) );
	const unit = u || pu || ( n === '' && pn === '' ? defaultUnit : '' );
	return (
		<Fld
			value={ n }
			placeholder={ pn || '—' }
			unit={ unit }
			lead={ lead }
			label={ label }
			wide={ wide }
			invalid={ ctl.invalid }
			onCommit={ ( text ) => {
				const v = withUnit( text, unit, parse );
				if ( side ) {
					const keys = keysOf( ctl.id ) ?? [];
					const base: Record< string, unknown > = ctl.info.value && typeof ctl.info.value === 'object' ? { ...( ctl.info.value as Record< string, unknown > ) } : Object.fromEntries( keys.map( ( k ) => [ k, ctl.info.value ?? '0' ] ) );
					if ( v === undefined && ! ctl.info.set ) return;
					base[ side ] = v ?? '0';
					ctl.write( base );
					return;
				}
				if ( v === undefined && ! ctl.info.set ) return;
				ctl.write( v );
			} }
		/>
	);
}

/* ------------------------------------------------------------------ segments and select */

export type Choice = [ value: string, face: string, label: string ];

/** Pick one: a filled track, the chosen option raised. The fallback option is lit, not pressed. */
export function Seg( { ctl, options, text, full }: { ctl: Ctl; options: Choice[]; text?: boolean; full?: boolean } ) {
	const cur = String( firstOf( ctl.info.value ) ?? '' );
	return (
		<div className={ `bui-seg${ full ? ' full' : '' }${ options.length > 4 ? ' wrap' : '' }` } role="group">
			{ options.map( ( [ value, face, label ] ) => {
				const on = cur === value;
				return (
					<button key={ value } type="button" title={ label } aria-label={ label } aria-pressed={ on && ctl.info.set } className={ on && ! ctl.info.set ? 'fallback' : undefined } onClick={ () => ctl.write( value === '' ? undefined : value ) }>
						{ text ? <span className="tx">{ face }</span> : <Sym name={ face } /> }
					</button>
				);
			} ) }
		</div>
	);
}

/** A list of names: the fallback shows as the unset option; a value not in the list stays, as Custom. */
export function Sel( { ctl, options, label, show }: { ctl: Ctl; options: Array< [ string, string ] >; label: string; show: ( v: unknown ) => string } ) {
	const cur = firstOf( ctl.info.value );
	const curText = cur === undefined || cur === null ? '' : String( cur );
	const known = options.some( ( [ v ] ) => v === curText );
	const fallLabel = curText === '' ? __( 'Not set', 'blicks' ) : options.find( ( [ v ] ) => v === curText )?.[ 1 ] ?? show( cur );
	return (
		<span className="bui-select">
			<select className={ ctl.info.set ? undefined : 'unset' } value={ ctl.info.set ? curText : '' } aria-label={ label } onChange={ ( e ) => ctl.write( e.currentTarget.value === '' ? undefined : e.currentTarget.value ) }>
				{ ! ctl.info.set && <option value="">{ fallLabel }</option> }
				{ options.map( ( [ v, l ] ) => <option key={ v } value={ v }>{ l }</option> ) }
				{ ctl.info.set && ! known && <option value={ curText }>{ `${ __( 'Custom', 'blicks' ) } · ${ show( cur ) }` }</option> }
			</select>
			<Sym name="expand_more" className="sm" />
		</span>
	);
}

/* ------------------------------------------------------------------ colour */

/**
 * A colour field. Open, it shows the theme's colours and a field for any colour; a theme colour is
 * stored as its variable, so it follows the theme.
 */
export function Colour( { value, set, open, onToggle, onPick, label, invalid }: {
	value: unknown;
	set: boolean;
	open: boolean;
	onToggle: () => void;
	onPick: ( v: string | undefined ) => void;
	label: string;
	invalid?: boolean;
} ) {
	const names = useTokenNames( 'color' );
	const palette = useMemo( () => tokenOptions( 'color' as never ), [] );
	const live = useMemo( () => resolveTokenValues( 'color' as never ), [] );
	const cur = value === undefined || value === null ? '' : String( firstOf( value ) );
	const named = names.get( cur );
	const fill = named?.css ?? ( cur || 'transparent' );
	const button = (
		<button type="button" className={ `bui-colour${ set ? '' : ' unset' }${ invalid ? ' invalid' : '' }` } aria-expanded={ open } aria-label={ label } onClick={ onToggle }>
			<span className="sw" style={ { background: fill } } />
			<span className="nm">{ named?.label ?? ( cur || __( 'None', 'blicks' ) ) }</span>
			{ named && <code>{ live[ palette.find( ( p ) => p.value === cur || p.css === cur || p.slug === cur )?.slug ?? '' ] ?? '' }</code> }
		</button>
	);
	const pop = open ? (
		<div className="bui-pop">
			<span className="h">{ __( 'Theme colors', 'blicks' ) }</span>
			<div className="dots">
				{ palette.map( ( p ) => (
					<button key={ p.slug } type="button" title={ p.label } aria-label={ p.label } aria-pressed={ cur === p.value || cur === p.css || cur === p.slug } style={ { background: live[ p.slug ] || p.css } } onClick={ () => onPick( p.value ) } />
				) ) }
			</div>
			<span className="h">{ __( 'Any color', 'blicks' ) }</span>
			<div className="bui-pair">
				<input type="color" className="bui-picker" aria-label={ __( 'Pick any color', 'blicks' ) } value={ /^#[0-9a-f]{6}$/i.test( cur ) ? cur : '#000000' } onChange={ ( e ) => onPick( e.currentTarget.value ) } />
				<Fld value={ set ? cur : '' } placeholder={ cur || '#000000' } label={ __( 'Color code', 'blicks' ) } lead={ <Sym name="format_color_fill" className="sm" /> } invalid={ invalid } onCommit={ ( t ) => onPick( t.trim() || undefined ) } />
			</div>
		</div>
	) : null;
	return (
		<>
			{ button }
			{ pop }
		</>
	);
}

/* ------------------------------------------------------------------ box model */

const SIDES = [ 'top', 'right', 'bottom', 'left' ] as const;

/** Margin around padding, each side typed in place. A side not set shows its fallback in grey. */
export function BoxModel( { margin, padding, kind, show, parse }: { margin?: Ctl; padding?: Ctl; kind: string; show: ( v: unknown ) => string; parse: ( id: string, t: string ) => string | undefined } ) {
	const side = ( ctl: Ctl, s: ( typeof SIDES )[ number ] ) => {
		const pick = ( v: unknown ) => ( v && typeof v === 'object' ? ( v as Record< string, unknown > )[ s ] : v );
		const here = ctl.info.set ? pick( ctl.info.value ) : undefined;
		const fall = pick( ctl.info.value );
		const [ n, u ] = splitUnit( show( here ) );
		const [ pn ] = splitUnit( show( fall ) );
		const name = `${ ctl.id === 'spacing.margin' ? __( 'Margin', 'blicks' ) : __( 'Padding', 'blicks' ) } ${ s }`;
		return (
			<BoxInput
				key={ s }
				className={ `${ s[ 0 ] }${ here !== undefined ? ' set' : '' }` }
				value={ n }
				placeholder={ pn || '0' }
				label={ name }
				title={ fall !== undefined ? `${ name } · ${ show( fall ) }` : name }
				onCommit={ ( text ) => {
					const v = withUnit( text, u || 'px', ( t ) => parse( ctl.id, t ) );
					if ( v === undefined && ! ctl.info.set ) return;
					const base: Record< string, unknown > = ctl.info.value && typeof ctl.info.value === 'object' ? { ...( ctl.info.value as Record< string, unknown > ) } : Object.fromEntries( SIDES.map( ( k ) => [ k, ctl.info.value ?? '0' ] ) );
					base[ s ] = v ?? '0';
					ctl.write( base );
				} }
			/>
		);
	};
	return (
		<div className="bui-box">
			<span className="cap">{ __( 'Margin', 'blicks' ) }</span>
			{ margin && SIDES.map( ( s ) => side( margin, s ) ) }
			<div className="bui-box inner">
				<span className="cap">{ __( 'Padding', 'blicks' ) }</span>
				{ padding && SIDES.map( ( s ) => side( padding, s ) ) }
				<div className="core">{ kind }</div>
			</div>
		</div>
	);
}

function BoxInput( { className, value, placeholder, label, title, onCommit }: { className: string; value: string; placeholder: string; label: string; title: string; onCommit: ( t: string ) => void } ) {
	const [ draft, setDraft ] = useState< string | null >( null );
	return (
		<input
			className={ className }
			value={ draft ?? value }
			placeholder={ placeholder }
			aria-label={ label }
			title={ title }
			spellCheck={ false }
			onChange={ ( e ) => setDraft( e.currentTarget.value ) }
			onBlur={ () => {
				if ( draft !== null && draft !== value ) onCommit( draft );
				setDraft( null );
			} }
			onKeyDown={ ( e ) => e.key === 'Enter' && e.currentTarget.blur() }
		/>
	);
}

/* ------------------------------------------------------------------ settings edited as parts */

/** One part of a composite value: changing it writes the whole value with only that part changed. */
export function PartField( { ctl, part, lead, label }: { ctl: Ctl; part: string; lead: ReactNode; label: string } ) {
	const comp = COMPOSITES[ ctl.id ]!;
	const unitFor = comp.parts.find( ( [ k ] ) => k === part )?.[ 1 ] ?? '';
	const parts = comp.read( ctl.info.value );
	const [ n, u ] = splitUnit( parts[ part ] );
	return (
		<Fld
			value={ ctl.info.set ? n : '' }
			placeholder={ n || '0' }
			unit={ u || unitFor }
			lead={ lead }
			label={ label }
			invalid={ ctl.invalid }
			onCommit={ ( text ) => ctl.write( comp.write( ctl.info.value, part, parsePart( text, u || unitFor ) ) ) }
		/>
	);
}

/** Shadow: the theme's shadows, a preview, then the first layer's offsets, blur and size. */
export function Shadow( { ctl, colour }: { ctl: Ctl; colour: ReactNode } ) {
	const box = ctl.id === 'effects.boxShadow';
	const category = tokensOf( ctl.id );
	const themed = useMemo( () => ( category ? tokenOptions( category as never ).slice( 0, 4 ) : [] ), [ category ] );
	const css = shadowCss( ctl.info.value );
	return (
		<div className="bui-stack">
			{ themed.length > 0 && <Seg ctl={ ctl } text full options={ themed.map( ( t ) => [ t.value, t.label, t.label ] as Choice ) } /> }
			<div className="bui-fx">
				<span className={ box ? 'bui-prev' : 'bui-prev tx' } style={ box ? { boxShadow: css } : { textShadow: css } } aria-hidden="true">{ box ? '' : 'Aa' }</span>
				<div className="bui-grid2">
					<PartField ctl={ ctl } part="x" lead="X" label={ __( 'Across', 'blicks' ) } />
					<PartField ctl={ ctl } part="y" lead="Y" label={ __( 'Down', 'blicks' ) } />
					<PartField ctl={ ctl } part="blur" lead={ <Sym name="blur_on" className="sm" /> } label={ __( 'Blur', 'blicks' ) } />
					{ box && <PartField ctl={ ctl } part="spread" lead={ <Sym name="open_with" className="sm" /> } label={ __( 'Size', 'blicks' ) } /> }
				</div>
			</div>
			{ colour }
		</div>
	);
}

/** A stored shadow as CSS for the preview swatch. */
function shadowCss( value: unknown ): string {
	const layers = Array.isArray( value ) ? value : value && typeof value === 'object' ? [ value ] : [];
	const out = layers.map( ( l: Record< string, unknown > ) => [ l.inset ? 'inset' : '', l.x ?? 0, l.y ?? 0, l.blur ?? 0, l.spread ?? '', l.color ?? 'rgb(0 0 0 / 20%)' ].filter( ( v ) => v !== '' ).join( ' ' ) );
	return out.join( ', ' ) || 'none';
}

const EASES: Choice[] = [
	[ 'linear', __( 'Linear', 'blicks' ), __( 'Linear', 'blicks' ) ],
	[ 'ease', __( 'Ease', 'blicks' ), __( 'Ease', 'blicks' ) ],
	[ 'ease-out', __( 'Ease out', 'blicks' ), __( 'Ease out', 'blicks' ) ],
	[ 'cubic-bezier(0.34, 1.56, 0.64, 1)', __( 'Spring', 'blicks' ), __( 'Spring', 'blicks' ) ],
];

const CHANGE_LABEL: Record< string, string > = { colours: __( 'Colors', 'blicks' ), movement: __( 'Movement', 'blicks' ), shadow: __( 'Shadow', 'blicks' ) };

/** Transition: what changes smoothly, how long, and how it eases — one stored value. */
export function Transition( { ctl }: { ctl: Ctl } ) {
	const parts = readTransition( ctl.info.value );
	const set = ctl.info.set;
	const write = ( next: Partial< typeof parts > ) => {
		const merged = { ...parts, ...next };
		if ( ! merged.changes.length && next.changes === undefined ) merged.changes = [ 'colours', 'movement' ];
		ctl.write( writeTransition( merged ) );
	};
	const [ n, u ] = splitUnit( parts.duration );
	return (
		<div className="bui-stack">
			<span className="bui-mini">{ __( 'What changes smoothly', 'blicks' ) }</span>
			<div className="bui-seg full" role="group" aria-label={ __( 'What changes smoothly', 'blicks' ) }>
				{ CHANGES.map( ( [ k ] ) => {
					const on = parts.changes.includes( k );
					return (
						<button key={ k } type="button" aria-pressed={ on && set } className={ on && ! set ? 'fallback' : undefined } onClick={ () => write( { changes: on ? parts.changes.filter( ( c ) => c !== k ) : [ ...parts.changes, k ] } ) }>
							{ CHANGE_LABEL[ k ] }
						</button>
					);
				} ) }
			</div>
			<span className="bui-mini">{ __( 'How long', 'blicks' ) }</span>
			<Fld value={ set ? n : '' } placeholder={ n || '200' } unit={ u || 'ms' } lead={ <Sym name="timer" className="sm" /> } label={ __( 'Duration', 'blicks' ) } invalid={ ctl.invalid } onCommit={ ( t ) => write( { duration: parsePart( t, u || 'ms' ) ?? '' } ) } />
			<span className="bui-mini">{ __( 'Easing', 'blicks' ) }</span>
			<div className="bui-seg full" role="group" aria-label={ __( 'Easing', 'blicks' ) }>
				{ EASES.map( ( [ v, face ] ) => (
					<button key={ v } type="button" aria-pressed={ parts.ease === v && set } className={ parts.ease === v && ! set ? 'fallback' : undefined } onClick={ () => write( { ease: v } ) }>
						{ face }
					</button>
				) ) }
			</div>
		</div>
	);
}
