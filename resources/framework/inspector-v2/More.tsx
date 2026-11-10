import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';
import { isAttrNameInvalid } from '@/framework/sanitize';
import { Field, Icon, Note, Sec, Row, Switch } from './kit';
import type { PanelProps } from './InspectorV2';

interface HtmlAttr {
	name: string;
	value: string;
}

/** ARIA fields are ordinary HTML attributes: they ride `htmlAttributes`, as in the rail inspector. */
const A11Y: Array< [ string, string, string ] > = [
	[ 'aria-label', __( 'Name', 'blicks' ), __( 'What a screen reader calls it', 'blicks' ) ],
	[ 'role', __( 'Role', 'blicks' ), 'region' ],
	[ 'tabindex', __( 'Tab order', 'blicks' ), '0' ],
];
const BP_ICONS: Record< string, string > = {
	base: 'M3 5h18v11H3zM8 20h8M12 16v4',
	tablet: 'M6 3h12v18H6zM11 18h2',
	mobile: 'M8 3h8v18H8zM11 18h2',
};

const attrsOf = ( attributes: any ): HtmlAttr[] => ( Array.isArray( attributes.htmlAttributes ) ? attributes.htmlAttributes : [] );
const hiddenOf = ( attributes: any ): string[] => Object.keys( attributes.visibility ?? {} ).filter( ( id ) => attributes.visibility[ id ] );

/**
 * The More tab, on every v2 block: which screens show it, what screen readers call it, and extra
 * HTML attributes. Not "Advanced" — WordPress already shows a panel by that name. It writes the
 * attributes the rail inspector's Advanced tab wrote (`visibility`, `htmlAttributes`), so blocks
 * keep them across the move.
 */
export function MorePanel( { attributes, setAttributes }: PanelProps ) {
	const visibility: Record< string, boolean > = attributes.visibility ?? {};
	const list = attrsOf( attributes );
	const named = ( name: string ) => htmlAttr( attributes, name );
	const setNamed = ( name: string, value: string ) => setAttributes( { htmlAttributes: withHtmlAttr( attributes, name, value ) } );
	const setShown = ( id: string, shown: boolean ) => {
		const next = { ...visibility };
		if ( shown ) delete next[ id ];
		else next[ id ] = true;
		setAttributes( { visibility: next } );
	};
	const setRow = ( i: number, patch: Partial< HtmlAttr > ) => setAttributes( { htmlAttributes: list.map( ( a, k ) => ( k === i ? { ...a, ...patch } : a ) ) } );
	const hidden = hiddenOf( attributes );

	return (
		<>
			<Sec title={ __( 'Show on', 'blicks' ) } icon="devices" value={ hidden.length ? '' : __( 'Every screen', 'blicks' ) }>
				<Row label={ __( 'Screens', 'blicks' ) } set={ hidden.length > 0 }>
				<div className="bui-seg full" role="group" aria-label={ __( 'Show on', 'blicks' ) }>
					{ DEFAULT_BREAKPOINTS.map( ( bp ) => (
						<button key={ bp.id } type="button" role="switch" aria-checked={ ! visibility[ bp.id ] } title={ bp.label } aria-label={ bp.label } onClick={ () => setShown( bp.id, !! visibility[ bp.id ] ) }>
							<Icon d={ BP_ICONS[ bp.id ] ?? BP_ICONS.base } />
						</button>
					) ) }
				</div>
				</Row>
				{ hidden.length > 0 && <Note>{ __( 'Hidden on the page at those sizes. In the editor it stays, faded.', 'blicks' ) }</Note> }
			</Sec>
			<Sec title={ __( 'Screen readers', 'blicks' ) } icon="accessibility_new">
				{ A11Y.map( ( [ attr, label, placeholder ] ) => (
					<Row key={ attr } label={ label } set={ !! named( attr ) }>
						<Field value={ named( attr ) } placeholder={ placeholder } label={ label } onChange={ ( v ) => setNamed( attr, v ) } />
					</Row>
				) ) }
				<Note>{ __( 'Only when the block needs a name or role its content does not give it.', 'blicks' ) }</Note>
			</Sec>
			<Sec title={ __( 'HTML attributes', 'blicks' ) } icon="code">
				{ list.map( ( a, i ) => A11Y.some( ( [ n ] ) => n === a.name ) || a.name === 'aria-hidden' ? null : (
					<div className="attr-row" key={ i }>
						<input className={ isAttrNameInvalid( a.name ) ? 'is-invalid' : '' } value={ a.name } placeholder="data-…" aria-label={ __( 'Attribute name', 'blicks' ) } aria-invalid={ isAttrNameInvalid( a.name ) } onChange={ ( e ) => setRow( i, { name: e.currentTarget.value } ) } />
						<input value={ a.value } placeholder={ __( 'value', 'blicks' ) } aria-label={ __( 'Attribute value', 'blicks' ) } onChange={ ( e ) => setRow( i, { value: e.currentTarget.value } ) } />
						<button type="button" className="attr-x" aria-label={ __( 'Remove attribute', 'blicks' ) } onClick={ () => setAttributes( { htmlAttributes: list.filter( ( _, k ) => k !== i ) } ) }>
							<Icon d="M6 6l12 12M18 6L6 18" size={ 16 } />
						</button>
					</div>
				) ) }
				<button type="button" className="btn-add" onClick={ () => setAttributes( { htmlAttributes: [ ...list, { name: '', value: '' } ] } ) }>
					<Icon d="M12 5v14M5 12h14" size={ 16 } />{ __( 'Add an attribute', 'blicks' ) }
				</button>
				{ list.some( ( a ) => isAttrNameInvalid( a.name ) ) && (
					<Note>{ __( 'Only data-*, aria-*, role, title, id, lang and dir work. Rows with other names are dropped.', 'blicks' ) }</Note>
				) }
			</Sec>
		</>
	);
}

/**
 * Values the Settings and Motion tabs keep in the style tree: how a block is arranged and sized,
 * where it sticks, its columns, its type role and line-up, and its entrance. They share the tree
 * with the look, but they are not the look, so "Clear all styles" leaves them.
 */
const KEPT = /^(layout|position|columns|animation)\.|^typography\.(role|textAlign|textWrap|whiteSpace)$/;

/** The style tree with the look cleared and the Settings and Motion values kept. */
export function withoutStyles( tree: Record< string, unknown > ): Record< string, unknown > {
	return Object.fromEntries( Object.entries( tree ?? {} ).filter( ( [ id ] ) => KEPT.test( id ) ) );
}

/** The end of the Style tab: clear every style on the block, after one confirm in place. */
export function ClearStyles( { attributes, setAttributes }: PanelProps ) {
	const [ confirming, setConfirming ] = useState( false );
	const tree = attributes.blicks ?? {};
	const kept = withoutStyles( tree );
	if ( Object.keys( kept ).length === Object.keys( tree ).length ) return null;
	return (
		<section className="sec adv-clear">
			{ confirming ? (
				<div className="adv-confirm">
					<span>{ __( 'Clear every style on this block?', 'blicks' ) }</span>
					<button type="button" className="link-x" onClick={ () => { setAttributes( { blicks: kept } ); setConfirming( false ); } }>{ __( 'Clear', 'blicks' ) }</button>
					<button type="button" className="link-x muted" onClick={ () => setConfirming( false ) }>{ __( 'Keep', 'blicks' ) }</button>
				</div>
			) : (
				<button type="button" className="link-x" onClick={ () => setConfirming( true ) }>{ __( 'Clear all styles', 'blicks' ) }</button>
			) }
		</section>
	);
}

/**
 * "Hide from screen readers", for a block's Meaning and access section: `aria-hidden` on the block,
 * kept in `htmlAttributes` like every other ARIA value. For decoration only — a hidden block that
 * holds a link or a button would still take keyboard focus.
 */
export function HideFromReaders( { attributes, setAttributes }: PanelProps ) {
	const list = attrsOf( attributes );
	const hidden = list.some( ( a ) => a.name === 'aria-hidden' && a.value === 'true' );
	const set = ( on: boolean ) => {
		const rest = list.filter( ( a ) => a.name !== 'aria-hidden' );
		setAttributes( { htmlAttributes: on ? [ ...rest, { name: 'aria-hidden', value: 'true' } ] : rest } );
	};
	return <Switch label={ __( 'Hide from screen readers', 'blicks' ) } hint={ __( 'Only for decoration: nothing in it can be clicked', 'blicks' ) } checked={ hidden } onChange={ set } />;
}

/** `htmlAttributes` with one attribute set, or removed when `value` is empty. */
export function withHtmlAttr( attributes: any, name: string, value: string ): HtmlAttr[] {
	const rest = attrsOf( attributes ).filter( ( a ) => a.name !== name );
	return value ? [ ...rest, { name, value } ] : rest;
}

/** One attribute's value from `htmlAttributes`, or `''`. */
export const htmlAttr = ( attributes: any, name: string ): string => attrsOf( attributes ).find( ( a ) => a.name === name )?.value ?? '';

/**
 * Meaning and access for a block saved as a list (List, Steps): the name a screen reader says
 * before the items, and the list role. Its markers are drawn, not the browser's, so the list has
 * `list-style: none` — and Safari then stops announcing it as a list. Both ride `htmlAttributes`,
 * the same values More's Screen readers fields edit, so the saved markup does not change.
 */
export function ListMeaning( { attributes, setAttributes, tag, note, placeholder }: PanelProps & { tag: 'ul' | 'ol'; note: string; placeholder: string } ) {
	const name = htmlAttr( attributes, 'aria-label' );
	const role = htmlAttr( attributes, 'role' );
	const set = ( attr: string, value: string ) => setAttributes( { htmlAttributes: withHtmlAttr( attributes, attr, value ) } );
	return (
		<Sec title={ __( 'Meaning and access', 'blicks' ) } icon="accessibility_new" value={ name ? __( 'Named', 'blicks' ) : `<${ tag }>` }>
			<Row label={ __( 'Name', 'blicks' ) } stack set={ !! name } hint="aria-label" note={ note } noteIcon="code">
				<Field value={ name } placeholder={ placeholder } label={ __( 'What a screen reader calls it', 'blicks' ) } onChange={ ( v ) => set( 'aria-label', v.trim() ? v : '' ) } />
			</Row>
			<Switch
				label={ __( 'Always read as a list', 'blicks' ) }
				hint={ __( 'Safari stops calling it a list when the browser’s own markers are off, as they are here', 'blicks' ) }
				checked={ role === 'list' }
				onChange={ ( on ) => set( 'role', on ? 'list' : '' ) }
			/>
		</Sec>
	);
}
