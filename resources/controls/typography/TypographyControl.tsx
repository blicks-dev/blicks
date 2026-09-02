import { useEffect, useMemo, useState } from '@wordpress/element';
import { Modal, Popover } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { FillControl } from '@/controls/fill/FillControl';
import { TEXT_FILL_SLOTS } from '@/controls/fill/types';
import {
	LENGTH_PATTERN,
	LENGTH_SUGGESTIONS,
	LINE_HEIGHT_PATTERN,
	LINE_HEIGHT_SUGGESTIONS,
	MoreSettings,
	NoMatches,
	ResetButton,
	announcePopoverOpen,
	makeMatcher,
	useCloseOnOtherPopover,
	useCloseOnOutsideClick,
	validateOrEmpty,
} from '@/controls/common';
import { IconValueField, IconField, type IconChoice } from '@/controls/IconValueField';
import { FieldGroup, LengthField, ValueField } from '@/controls/ValueField';
import { lengthOrTokenPattern, tokenOptions, tokenSuggestions } from '@/controls/token-utils';
import { FontsManager } from './FontsManager';
import { buildFluidClamp, parseFluidClamp, toRem } from './fluid';
import { getFontLibrary, onFontLibraryChange, refreshFontLibrary, type FontFamilyEntry } from './font-library';
import { TYPE_ROLE_GROUPS, TYPE_ROLE_LABELS, isTypeRole } from '@/design-system/type-roles';
import '../color/color.scss';
import './typography.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	/** Show the type-role ("Style") preset library — a book icon on its own row that opens a role
	 *  picker. Applies a theme type role's whole look via a `bl-type--{role}` class. */
	showTypeRole?: boolean;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

const WEIGHT_OPTIONS = [
	{ value: '100', label: __( 'Thin (100)', 'blicks' ) },
	{ value: '200', label: __( 'Extra light (200)', 'blicks' ) },
	{ value: '300', label: __( 'Light (300)', 'blicks' ) },
	{ value: '400', label: __( 'Regular (400)', 'blicks' ) },
	{ value: '500', label: __( 'Medium (500)', 'blicks' ) },
	{ value: '600', label: __( 'Semi bold (600)', 'blicks' ) },
	{ value: '700', label: __( 'Bold (700)', 'blicks' ) },
	{ value: '800', label: __( 'Extra bold (800)', 'blicks' ) },
	{ value: '900', label: __( 'Black (900)', 'blicks' ) },
];
const WEIGHT_PATTERN = /^(100|200|300|400|500|600|700|800|900|normal|bold|lighter|bolder)$/;

const FAMILY_TOKEN_LABELS: Record< string, string > = {
	sans: __( 'Sans Serif', 'blicks' ),
	serif: __( 'Serif', 'blicks' ),
	mono: __( 'Monospace', 'blicks' ),
};

const ORIGIN_LABELS: Record< string, string > = {
	blicks: __( 'Token', 'blicks' ),
	theme: __( 'Theme', 'blicks' ),
	user: __( 'Installed', 'blicks' ),
	system: __( 'System', 'blicks' ),
};

type FamilyOption = {
	label: string;
	/** Either a Blicks token slug, a literal CSS stack, or the `var(--wp--preset-…)` for a Font
	 *  Library family. There is no `custom` sentinel any more — the field takes free text, so a
	 *  hand-written stack is simply typed into it. */
	value: string;
	/** Where this entry came from — shown as the option's hint, since a flat combobox list has no
	 *  `<optgroup>` to say it in a heading. */
	origin: 'blicks' | 'theme' | 'user' | 'system';
};

const SYSTEM_FAMILIES: FamilyOption[] = [
	{ label: 'Arial',           value: 'Arial, sans-serif',                origin: 'system' },
	{ label: 'Georgia',         value: 'Georgia, serif',                   origin: 'system' },
	{ label: 'Helvetica',       value: 'Helvetica, Arial, sans-serif',     origin: 'system' },
	{ label: 'Times New Roman', value: '"Times New Roman", Times, serif',  origin: 'system' },
];

/**
 * Build the family options for one render: Blicks token slugs → live Font Library entries
 * (theme.json + user-installed) → built-in system stacks. Library entries collide-resolve by slug;
 * a Font Library family that shares its slug with a Blicks token is folded in.
 */
function buildFamilyOptions( library: FontFamilyEntry[] ): FamilyOption[] {
	const blicksTokens: FamilyOption[] = tokenOptions( 'fontFamily' ).map( ( option ) => ( {
		label: FAMILY_TOKEN_LABELS[ option.slug ] ?? option.label,
		value: option.slug,
		origin: 'blicks' as const,
	} ) );
	const blicksSlugs = new Set( blicksTokens.map( ( option ) => option.value ) );

	const libraryOptions: FamilyOption[] = library
		.filter( ( entry ) => ! blicksSlugs.has( entry.slug ) )
		.map( ( entry ) => ( {
			label: entry.name,
			value: `var(--wp--preset--font-family--${ entry.slug })`,
			origin: entry.source === 'user' ? 'user' as const : 'theme' as const,
		} ) );

	return [ ...blicksTokens, ...libraryOptions, ...SYSTEM_FAMILIES ];
}

/** A text sample as the icon: `AA` says uppercase better than any drawing of it would. */
const glyph = ( text: string, style?: React.CSSProperties ) => (
	<span className="bl-typoglyph" style={ style } aria-hidden="true">{ text }</span>
);

// `normal` is NOT the initial value here — an unset field inherits, so overriding an inherited
// italic back to upright is a real choice and keeps its own icon. (Contrast Border's `none`,
// which an empty field already says.)
const STYLE_CHOICES: IconChoice[] = [
	{ value: 'normal', title: __( 'Upright', 'blicks' ), icon: glyph( 'N' ) },
	{ value: 'italic', title: __( 'Italic', 'blicks' ), icon: glyph( 'I', { fontStyle: 'italic' } ) },
];
const STYLE_OPTIONS = [ 'normal', 'italic', 'oblique' ].map( ( value ) => ( { value, label: value } ) );

// No `none` icon — an empty field already means "no transform", and three samples get a third of
// the row each instead of a quarter.
const TRANSFORM_CHOICES: IconChoice[] = [
	{ value: 'uppercase', title: __( 'Uppercase', 'blicks' ), icon: glyph( 'AA' ) },
	{ value: 'lowercase', title: __( 'Lowercase', 'blicks' ), icon: glyph( 'aa' ) },
	{ value: 'capitalize', title: __( 'Capitalize', 'blicks' ), icon: glyph( 'Aa' ) },
];
const TRANSFORM_OPTIONS = [ 'none', 'uppercase', 'lowercase', 'capitalize', 'full-width' ]
	.map( ( value ) => ( { value, label: value } ) );

const DECORATION_CHOICES: IconChoice[] = [
	{ value: 'underline', title: __( 'Underline', 'blicks' ), icon: glyph( 'U', { textDecoration: 'underline' } ) },
	{ value: 'line-through', title: __( 'Strikethrough', 'blicks' ), icon: glyph( 'S', { textDecoration: 'line-through' } ) },
	{ value: 'overline', title: __( 'Overline', 'blicks' ), icon: glyph( 'O', { textDecoration: 'overline' } ) },
];
const DECORATION_OPTIONS = [ 'none', 'underline', 'line-through', 'overline', 'underline dotted', 'underline wavy' ]
	.map( ( value ) => ( { value, label: value } ) );

const ALIGN_CHOICES: IconChoice[] = [
	{
		value: 'left',
		title: __( 'Left', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="17" y2="18" />
			</svg>
		),
	},
	{
		value: 'center',
		title: __( 'Center', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" />
			</svg>
		),
	},
	{
		value: 'right',
		title: __( 'Right', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="7" y1="18" x2="20" y2="18" />
			</svg>
		),
	},
	{
		value: 'justify',
		title: __( 'Justify', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
			</svg>
		),
	},
];
const ALIGN_OPTIONS = [ 'left', 'center', 'right', 'justify', 'start', 'end' ]
	.map( ( value ) => ( { value, label: value } ) );

/**
 * Writing mode drawn as the lines themselves, with the *first* line thickened to say where the
 * text starts. That is the whole difference between `vertical-rl` and `vertical-lr`, and it is a
 * difference no label of three squeezed words was ever going to carry.
 */
const WRITING_CHOICES: IconChoice[] = [
	{
		value: 'horizontal-tb',
		title: __( 'Horizontal', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
				<line x1="4" y1="7" x2="20" y2="7" strokeWidth="4" />
				<line x1="4" y1="12" x2="20" y2="12" strokeWidth="1.6" />
				<line x1="4" y1="17" x2="15" y2="17" strokeWidth="1.6" />
			</svg>
		),
	},
	{
		value: 'vertical-rl',
		title: __( 'Vertical, right to left', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
				<line x1="17" y1="4" x2="17" y2="20" strokeWidth="4" />
				<line x1="12" y1="4" x2="12" y2="20" strokeWidth="1.6" />
				<line x1="7" y1="4" x2="7" y2="15" strokeWidth="1.6" />
			</svg>
		),
	},
	{
		value: 'vertical-lr',
		title: __( 'Vertical, left to right', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
				<line x1="7" y1="4" x2="7" y2="20" strokeWidth="4" />
				<line x1="12" y1="4" x2="12" y2="20" strokeWidth="1.6" />
				<line x1="17" y1="4" x2="17" y2="15" strokeWidth="1.6" />
			</svg>
		),
	},
];

const ORIENTATION_OPTIONS = [ 'mixed', 'upright', 'sideways' ].map( ( value ) => ( { value, label: value } ) );

// Lengths plus fontSize-token slugs (`sm`, `2xl`, …) — resolved to `var(--blicks-fontSize-*)` by
// the style engine.
const FONT_SIZE_PATTERN = lengthOrTokenPattern( 'fontSize', LENGTH_PATTERN );
const FONT_SIZE_SUGGESTIONS = tokenSuggestions( 'fontSize', LENGTH_SUGGESTIONS );
// Line-heights plus leading-token slugs (`tight`, `snug`, …).
const LINE_HEIGHT_TOKEN_PATTERN = lengthOrTokenPattern( 'leading', LINE_HEIGHT_PATTERN );

const SPACING_LITERALS = [ '0', '0.01em', '0.05em', '0.1em', 'normal', '1px', '2px' ];
const TRACKING_PATTERN = /^(normal|0|-?\d+(\.\d+)?(px|em|rem|%))$/;

const LIB_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M2 6.5A2.5 2.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H4.5A2.5 2.5 0 0 1 2 15V6.5z" />
		<path d="M22 6.5A2.5 2.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5h6A2.5 2.5 0 0 0 22 15V6.5z" />
	</svg>
);

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree.
 */
const K = {
	role: [ 'type', 'role', 'preset', 'style', 'heading', 'body', 'caption', 'lead' ],
	family: [ 'font', 'family', 'typeface', 'serif', 'sans', 'mono', 'stack' ],
	size: [ 'font', 'size', 'fluid', 'clamp', 'responsive', 'scale', 'min', 'max' ],
	lineHeight: [ 'line', 'height', 'leading' ],
	weight: [ 'font', 'weight', 'bold', 'light', 'black', 'thin' ],
	style: [ 'font', 'style', 'italic', 'oblique', 'upright' ],
	align: [ 'text', 'align', 'alignment', 'left', 'centre', 'center', 'right', 'justify' ],
	letter: [ 'letter', 'spacing', 'tracking', 'kerning' ],
	word: [ 'word', 'spacing' ],
	transform: [ 'text', 'transform', 'uppercase', 'lowercase', 'capitalize', 'caps' ],
	decoration: [ 'text', 'decoration', 'underline', 'strike', 'line-through', 'overline' ],
	writing: [ 'writing', 'mode', 'vertical', 'horizontal', 'orientation', 'upright', 'sideways' ],
	color: [ 'text', 'colour', 'color', 'fill', 'gradient' ],
};

export const TYPOGRAPHY_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * The fluid range, nested under the Size field it authors.
 *
 * Fluid type is not a second property — it is the same `font-size` expressed as a `clamp()`. So it
 * is not a mode switch beside the field any more: it is min and max *under* Size, the way min and
 * max width sit under Width in Layout. Opening the group is what makes the size fluid; typing a
 * plain value back into Size is what makes it fixed again.
 */
function FluidRange( { value, onChange }: { value: string; onChange: ( next: string ) => void } ) {
	const parsed = parseFluidClamp( value );
	// Seed from whatever Size already held: an existing clamp fills both, a plain size becomes the
	// min and leaves the author to name a max.
	const [ min, setMin ] = useState( parsed?.min ?? ( toRem( value ) !== null ? value : '' ) );
	const [ max, setMax ] = useState( parsed?.max ?? '' );

	// Re-sync when Size changes from outside these two fields (block switch, undo, a preset).
	useEffect( () => {
		const next = parseFluidClamp( value );
		if ( next ) {
			setMin( next.min );
			setMax( next.max );
		}
	}, [ value ] );

	// Write only once both ends parse into a real range — half-typed input leaves the stored value
	// alone rather than flickering the canvas through nonsense sizes.
	const push = ( nextMin: string, nextMax: string ) => {
		const clamped = buildFluidClamp( nextMin, nextMax );
		if ( clamped ) onChange( clamped );
	};

	const options = FONT_SIZE_SUGGESTIONS.map( ( v ) => ( { value: v, label: v } ) );

	return (
		<div className="bl-fields bl-fields--2">
			<ValueField
				affix={ <span className="bl-valuefield__cap" title={ __( 'Smallest size', 'blicks' ) }>MIN</span> }
				value={ min }
				options={ options }
				placeholder="16px"
				listLabel="SIZE LIBRARY"
				modified={ Boolean( min ) }
				onChange={ ( next ) => { setMin( next ); push( next, max ); } }
			/>
			<ValueField
				affix={ <span className="bl-valuefield__cap" title={ __( 'Largest size', 'blicks' ) }>MAX</span> }
				value={ max }
				options={ options }
				placeholder="28px"
				listLabel="SIZE LIBRARY"
				modified={ Boolean( max ) }
				onChange={ ( next ) => { setMax( next ); push( min, next ); } }
			/>
		</div>
	);
}

/**
 * Typography — inline.
 *
 * Every setting used to live behind a composite trigger that opened a 288px popover: one click to
 * see what the block's type even was, and nothing visible on the facet until you took it. The
 * properties are now a flat stack of the shared fields, in the order you actually reach for them —
 * family, size, line height and weight, then style and alignment — with the rarer half (spacing,
 * transform, decoration, writing mode) behind a counted disclosure.
 *
 * The two things that are genuinely pickers rather than fields keep their popovers: the type-role
 * preset (a set of looks, sampled in its own type) and the colour field at the foot.
 */
export function TypographyControl( { attributes, setAttributes, state, breakpoint, showTypeRole, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const m = makeMatcher( query );
	const searching = Boolean( query && query.trim() );

	const val = ( controlId: string ) => String( getValue( attributes, controlId, state, breakpoint ) || '' );
	const set = ( controlId: string ) => ( next: string ) =>
		setValue( attributes, setAttributes, controlId, state, breakpoint, next );

	const fontFamily = val( 'typography.fontFamily' );
	const fontSize = val( 'typography.fontSize' );
	const lineHeight = val( 'typography.lineHeight' );
	const fontWeight = val( 'typography.fontWeight' );
	const fontStyle = val( 'typography.fontStyle' );
	const letterSpacing = val( 'typography.letterSpacing' );
	const wordSpacing = val( 'typography.wordSpacing' );
	const textTransform = val( 'typography.textTransform' );
	const textDecoration = val( 'typography.textDecoration' );
	const textAlign = val( 'typography.textAlign' );
	const writingMode = val( 'typography.writingMode' );
	const textOrientation = val( 'typography.textOrientation' );

	// Type-role ("Style") preset picker — a set of complete looks, so it stays a sampled picker
	// rather than becoming a dropdown of names that all render in the sidebar's own font.
	const [ roleOpen, setRoleOpen ] = useState( false );
	const [ roleAnchor, setRoleAnchor ] = useState< Element | null >( null );
	const [ rolePopoverId ] = useState(
		() => `bl-typerole-popover-${ Math.random().toString( 36 ).slice( 2 ) }`
	);
	const rawRole = getValue( attributes, 'typography.role', state, breakpoint );
	const role = isTypeRole( rawRole ) ? rawRole : '';
	const setRole = set( 'typography.role' );
	useCloseOnOtherPopover( rolePopoverId, () => setRoleOpen( false ) );
	useCloseOnOutsideClick( roleOpen, () => setRoleOpen( false ), roleAnchor );
	const toggleRolePopover = () => {
		setRoleOpen( ( current ) => {
			const next = ! current;
			if ( next ) announcePopoverOpen( rolePopoverId );
			return next;
		} );
	};

	const [ fontsManagerOpen, setFontsManagerOpen ] = useState( false );
	const [ libraryVersion, setLibraryVersion ] = useState( 0 );
	useEffect( () => onFontLibraryChange( () => {
		refreshFontLibrary();
		setLibraryVersion( ( current ) => current + 1 );
	} ), [] );
	const fontLibrary = useMemo( () => getFontLibrary(), [ libraryVersion ] );
	const familyOptions = useMemo(
		() => buildFamilyOptions( fontLibrary ).map( ( option ) => ( {
			value: option.value,
			label: option.label,
			hint: ORIGIN_LABELS[ option.origin ],
		} ) ),
		[ fontLibrary ]
	);

	const storedFluid = parseFluidClamp( fontSize );

	const showRole = Boolean( showTypeRole ) && m( K.role );
	const showFamily = can( 'typography.fontFamily' ) && m( K.family );
	const showSize = can( 'typography.fontSize' ) && m( K.size );
	const showLine = can( 'typography.lineHeight' ) && m( K.lineHeight );
	const showWeight = can( 'typography.fontWeight' ) && m( K.weight );
	const showStyle = can( 'typography.fontStyle' ) && m( K.style );
	const showAlign = can( 'typography.textAlign' ) && m( K.align );
	const showLetter = can( 'typography.letterSpacing' ) && m( K.letter );
	const showWord = can( 'typography.wordSpacing' ) && m( K.word );
	const showTransform = can( 'typography.textTransform' ) && m( K.transform );
	const showDecoration = can( 'typography.textDecoration' ) && m( K.decoration );
	const showWriting = can( 'typography.writingMode' ) && m( K.writing );
	const showColor = can( 'colors.text' ) && m( K.color );

	const showFont = showRole || showFamily || showSize || showLine || showWeight || showStyle || showAlign;
	const showDetail = showLetter || showWord || showTransform || showDecoration || showWriting;
	const anyShown = showFont || showDetail || showColor;

	const detailCount = [ letterSpacing, wordSpacing, textTransform, textDecoration, writingMode, textOrientation ]
		.filter( Boolean ).length;

	// The group's dot and its Reset cover only the fields this instance actually renders. A
	// caller can mount the control with a narrowed `isAllowed` (the Heading block mounts it for
	// the type role alone), and a Reset that cleared hidden fields would wipe values the author
	// set in a different panel.
	const fontFields: Array< [ string, string, boolean ] > = [
		[ 'typography.role', role, showRole ],
		[ 'typography.fontFamily', fontFamily, showFamily ],
		[ 'typography.fontSize', fontSize, showSize ],
		[ 'typography.lineHeight', lineHeight, showLine ],
		[ 'typography.fontWeight', fontWeight, showWeight ],
		[ 'typography.fontStyle', fontStyle, showStyle ],
		[ 'typography.textAlign', textAlign, showAlign ],
	];
	const hasFontValue = fontFields.some( ( [ , value, shown ] ) => shown && Boolean( value ) );

	const resetFont = () => {
		for ( const [ controlId, , shown ] of fontFields ) {
			if ( shown ) setValue( attributes, setAttributes, controlId, state, breakpoint, '' );
		}
	};

	return (
		<div className="bl-typography-control">
			{ ! anyShown && <NoMatches query={ query ?? '' } /> }

			{ showFont && (
			<div className="bl-typo-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Font', 'blicks' ) }</span>
					{ hasFontValue && <span className="bl-mod-dot" aria-hidden="true" /> }
					<div className="bl-spacing-actions">
						<ResetButton idle={ ! hasFontValue } onClick={ resetFont } />
					</div>
				</div>

				<div className="bl-fields">
					{ showRole && (
					// A preset is not a value you type, so this row is a trigger rather than a field:
					// swatch-of-type on the left, the role's name in the middle — the same shape
					// `ColorRow` uses, for the same reason.
					<div
						className={ `bl-valuefield bl-valuefield--picker ${ role ? 'is-set' : '' }` }
						ref={ ( node ) => setRoleAnchor( node ) }
					>
						<span className="bl-valuefield__cap" title={ __( 'Type role preset', 'blicks' ) }>PRESET</span>
						<button type="button" className="bl-valuefield__pick" onClick={ toggleRolePopover }>
							{ role ? TYPE_ROLE_LABELS[ role ] : __( 'From level', 'blicks' ) }
						</button>
						<button
							type="button"
							className={ `lib-btn ${ roleOpen ? 'is-open' : '' }` }
							title={ role ? sprintf( __( 'Style: %s', 'blicks' ), TYPE_ROLE_LABELS[ role ] ) : __( 'Typography presets', 'blicks' ) }
							aria-label={ __( 'Typography presets', 'blicks' ) }
							onClick={ toggleRolePopover }
						>
							{ LIB_ICON }
						</button>
						<ResetButton idle={ ! role } onClick={ () => setRole( '' ) } />
					</div>
					) }

					{ showFamily && (
					<ValueField
						className="bl-valuefield--family"
						affix={ <span className="bl-valuefield__cap" title={ __( 'Font family', 'blicks' ) }>FONT</span> }
						value={ fontFamily }
						options={ familyOptions }
						placeholder={ __( 'Inherited', 'blicks' ) }
						listLabel="FONT LIBRARY"
						modified={ Boolean( fontFamily ) }
						actions={
							<button
								type="button"
								className="lib-btn"
								title={ __( 'Manage fonts', 'blicks' ) }
								aria-label={ __( 'Manage fonts', 'blicks' ) }
								onMouseDown={ ( event ) => event.preventDefault() }
								onClick={ () => setFontsManagerOpen( true ) }
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
									<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
								</svg>
							</button>
						}
						onChange={ set( 'typography.fontFamily' ) }
						onCommit={ ( raw ) => set( 'typography.fontFamily' )( raw.trim() ) }
						onReset={ () => set( 'typography.fontFamily' )( '' ) }
					/>
					) }

					{ showSize && (
					<FieldGroup
						title={ __( 'Fluid range', 'blicks' ) }
						constrained={ Boolean( storedFluid ) }
						defaultOpen={ Boolean( storedFluid ) }
						forceOpen={ searching }
						field={ ( toggle ) => (
							<LengthField
								before={ toggle }
								label="SIZE"
								hint={ __( 'Font size', 'blicks' ) }
								category="fontSize"
								literals={ LENGTH_SUGGESTIONS }
								pattern={ FONT_SIZE_PATTERN }
								listLabel="SIZE LIBRARY"
								value={ fontSize }
								placeholder="16px"
								onChange={ set( 'typography.fontSize' ) }
								onReset={ () => set( 'typography.fontSize' )( '' ) }
							/>
						) }
					>
						<FluidRange value={ fontSize } onChange={ set( 'typography.fontSize' ) } />
					</FieldGroup>
					) }

					{ ( showLine || showWeight ) && (
					<div className="bl-fields bl-fields--2">
						{ showLine && (
						<LengthField
							label="LINE"
							hint={ __( 'Line height', 'blicks' ) }
							category="leading"
							literals={ LINE_HEIGHT_SUGGESTIONS }
							pattern={ LINE_HEIGHT_TOKEN_PATTERN }
							listLabel="LEADING"
							value={ lineHeight }
							placeholder="1.5"
							onChange={ set( 'typography.lineHeight' ) }
						/>
						) }
						{ showWeight && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Font weight', 'blicks' ) }>WGHT</span> }
							value={ fontWeight }
							options={ WEIGHT_OPTIONS }
							placeholder="400"
							listLabel="WEIGHTS"
							modified={ Boolean( fontWeight ) }
							onChange={ set( 'typography.fontWeight' ) }
							onCommit={ ( raw ) => set( 'typography.fontWeight' )( validateOrEmpty( raw, WEIGHT_PATTERN ) ) }
						/>
						) }
					</div>
					) }

					{ showStyle && (
					<IconValueField
						label="STYLE"
						hint={ __( 'Font style', 'blicks' ) }
						value={ fontStyle }
						choices={ STYLE_CHOICES }
						options={ STYLE_OPTIONS }
						listLabel="STYLES"
						onChange={ set( 'typography.fontStyle' ) }
					/>
					) }

					{ showAlign && (
					<IconValueField
						label="ALIGN"
						hint={ __( 'Text alignment', 'blicks' ) }
						value={ textAlign }
						choices={ ALIGN_CHOICES }
						options={ ALIGN_OPTIONS }
						listLabel="ALIGNMENTS"
						onChange={ set( 'typography.textAlign' ) }
					/>
					) }
				</div>
			</div>
			) }

			{ showDetail && (
			<div className="bl-typo-group">
				<MoreSettings
					label={ __( 'Detail', 'blicks' ) }
					badge={ detailCount }
					defaultOpen={ detailCount > 0 }
					forceOpen={ searching }
				>
					<div className="bl-fields">
						{ /* One per row, not two-up: a tracking value is `0.05em` — six characters — and a
						     half-width cell leaves 27px of input to hold them. */ }
						{ showLetter && (
							<ValueField
								affix={ <span className="bl-valuefield__cap" title={ __( 'Letter spacing', 'blicks' ) }>TRACK</span> }
								value={ letterSpacing }
								options={ SPACING_LITERALS.map( ( v ) => ( { value: v, label: v } ) ) }
								placeholder="0"
								listLabel="TRACKING"
								modified={ Boolean( letterSpacing ) }
								onChange={ set( 'typography.letterSpacing' ) }
								onCommit={ ( raw ) => set( 'typography.letterSpacing' )( validateOrEmpty( raw, TRACKING_PATTERN ) ) }
							/>
						) }
						{ showWord && (
							<ValueField
								affix={ <span className="bl-valuefield__cap" title={ __( 'Word spacing', 'blicks' ) }>WORD</span> }
								value={ wordSpacing }
								options={ SPACING_LITERALS.map( ( v ) => ( { value: v, label: v } ) ) }
								placeholder="0"
								listLabel="WORD SPACING"
								modified={ Boolean( wordSpacing ) }
								onChange={ set( 'typography.wordSpacing' ) }
								onCommit={ ( raw ) => set( 'typography.wordSpacing' )( validateOrEmpty( raw, LENGTH_PATTERN ) ) }
							/>
						) }

						{ showTransform && (
						<IconValueField
							label="CASE"
							hint={ __( 'Text transform', 'blicks' ) }
							value={ textTransform }
							choices={ TRANSFORM_CHOICES }
							options={ TRANSFORM_OPTIONS }
							placeholder="none"
							listLabel="TRANSFORMS"
							onChange={ set( 'typography.textTransform' ) }
						/>
						) }

						{ showDecoration && (
						<IconValueField
							label="DECO"
							hint={ __( 'Text decoration', 'blicks' ) }
							value={ textDecoration }
							choices={ DECORATION_CHOICES }
							options={ DECORATION_OPTIONS }
							placeholder="none"
							listLabel="DECORATIONS"
							onChange={ set( 'typography.textDecoration' ) }
						/>
						) }

						{ showWriting && (
						<>
						<IconField
							label="FLOW"
							hint={ __( 'Writing mode', 'blicks' ) }
							value={ writingMode }
							choices={ WRITING_CHOICES }
							onChange={ set( 'typography.writingMode' ) }
							onReset={ () => set( 'typography.writingMode' )( '' ) }
						/>
						{ /* Orientation only does anything in a vertical flow, so it appears with one —
						     offering it beside a horizontal mode is offering a setting the browser will
						     ignore. */ }
						{ writingMode.startsWith( 'vertical' ) && can( 'typography.textOrientation' ) && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Text orientation', 'blicks' ) }>CHARS</span> }
							value={ textOrientation }
							options={ ORIENTATION_OPTIONS }
							placeholder="mixed"
							listLabel="ORIENTATIONS"
							modified={ Boolean( textOrientation ) }
							onChange={ set( 'typography.textOrientation' ) }
							onReset={ () => set( 'typography.textOrientation' )( '' ) }
						/>
						) }
						</>
						) }
					</div>
				</MoreSettings>
			</div>
			) }

			{ roleOpen && (
				<Popover
					anchor={ roleAnchor }
					placement="left-start"
					offset={ 12 }
					flip
					resize
					noArrow
					focusOnMount="firstElement"
					onClose={ () => setRoleOpen( false ) }
					className="bl-floating-popover bl-ins"
					variant="unstyled"
				>
					<div className="typo-role-popup">
						<div className="typo-role-head">
							<span className="typo-role-title">{ __( 'Typography preset', 'blicks' ) }</span>
							{ role && (
								<button type="button" className="reset-btn" onClick={ () => { setRole( '' ); } }>
									{ __( 'Reset', 'blicks' ) }
								</button>
							) }
						</div>
						<button
							type="button"
							className={ `typo-role-opt ${ ! role ? 'is-active' : '' }` }
							onClick={ () => { setRole( '' ); setRoleOpen( false ); } }
						>
							<span className="typo-role-name">{ __( 'Default (from level)', 'blicks' ) }</span>
						</button>
						{ TYPE_ROLE_GROUPS.map( ( group ) => (
							<div className="typo-role-group" key={ group.label }>
								<span className="typo-role-grouplabel">{ group.label }</span>
								{ group.roles.map( ( slug ) => (
									<button
										type="button"
										key={ slug }
										className={ `typo-role-opt ${ role === slug ? 'is-active' : '' }` }
										onClick={ () => { setRole( slug ); setRoleOpen( false ); } }
									>
										<span className={ `typo-role-name bl-type--${ slug }` }>{ TYPE_ROLE_LABELS[ slug ] }</span>
										{ role === slug && (
											<svg className="typo-role-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
												<path d="M20 6L9 17l-5-5" />
											</svg>
										) }
									</button>
								) ) }
							</div>
						) ) }
					</div>
				</Popover>
			) }

			{ fontsManagerOpen && (
				<Modal
					title={ __( 'Manage fonts', 'blicks' ) }
					className="bl-fonts-manager-modal"
					onRequestClose={ () => setFontsManagerOpen( false ) }
					shouldCloseOnClickOutside
				>
					<FontsManager
						variant="modal"
						onSelectFamily={ ( value ) => {
							set( 'typography.fontFamily' )( value );
							setFontsManagerOpen( false );
						} }
					/>
				</Modal>
			) }

			{ /* The one font-colour field: solid / gradient / image, in the popover layout — the fill
			     is one setting among a dozen here, and inlining its editor would bury the rest of the
			     facet. `TEXT_FILL_SLOTS` keeps a plain colour on `colors.text` (a bare `color:`, no
			     clip); only a gradient or image becomes a clipped background, and `clipToText` throws
			     that switch for the author. */ }
			{ showColor && (
			<div className="bl-typo-group">
				<div className="bl-fields">
					<FillControl
						attributes={ attributes }
						setAttributes={ setAttributes }
						state={ state }
						breakpoint={ breakpoint }
						slots={ TEXT_FILL_SLOTS }
						layout="popover"
						label={ __( 'Font colour', 'blicks' ) }
						cap="COLOR"
						clipToText
						query={ query }
					/>
				</div>
			</div>
			) }
		</div>
	);
}
