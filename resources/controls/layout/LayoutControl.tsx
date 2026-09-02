import { getValue, setValue } from '@/framework/values';
import { FieldHead, LENGTH_PATTERN, LENGTH_SUGGESTIONS, MoreSettings, NoMatches, ValueDatalist, keywordPattern, makeMatcher, setOrClear } from '@/controls/common';
import { lengthOrTokenPattern, tokenOptions, tokenSuggestions } from '@/controls/token-utils';
import { IconField, IconValueField, type IconChoice } from '@/controls/IconValueField';
import { FieldGroup, LengthField, LengthFieldGroup, OptionField } from '@/controls/ValueField';
import { GRID_KEYWORDS, GridControl } from '@/controls/grid/GridControl';
import './layout.scss';

/**
 * Everything `display` can be set to from the dropdown. The three icons cover the modes worth a
 * one-click target; the rest live here, and the field still accepts anything typed (`table-row`,
 * `-webkit-box`, …) because `display` has far more values than are worth listing.
 */
const DISPLAY_OPTIONS = [
	'block',
	'flex',
	'grid',
	'inline',
	'inline-block',
	'inline-flex',
	'inline-grid',
	'flow-root',
	'contents',
	'none',
].map( ( value ) => ( { value, label: value } ) );

// `display` can be a bare mode (block/flex/grid) or its `inline-` variant. The icons set and read
// the *base* mode, so `inline-flex` still lights the Flex icon, and switching icons carries the
// `inline-` prefix across rather than silently dropping it. The variants themselves are picked
// from the field beside the icons.
const INLINE_VARIANT: Record< string, string > = { block: 'inline-block', flex: 'inline-flex', grid: 'inline-grid' };
const BASE_OF_INLINE: Record< string, string > = { 'inline-block': 'block', 'inline-flex': 'flex', 'inline-grid': 'grid' };
const baseMode = ( value: string ) => BASE_OF_INLINE[ value ] ?? value;

const displayChoice = ( value: string, title: string, icon: JSX.Element ): IconChoice => ( {
	value,
	title,
	icon,
	isActive: ( current ) => baseMode( current ) === value,
	resolve: ( current ) =>
		current in BASE_OF_INLINE && INLINE_VARIANT[ value ] ? INLINE_VARIANT[ value ] : value,
} );

const DISPLAY_CHOICES: IconChoice[] = [
	displayChoice(
		'flex',
		'Flex',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="5" width="4" height="14" rx="1" />
			<rect x="10" y="5" width="4" height="14" rx="1" />
			<rect x="16" y="5" width="4" height="14" rx="1" />
		</svg>
	),
	displayChoice(
		'grid',
		'Grid',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="4" width="7" height="7" rx="1" />
			<rect x="13" y="4" width="7" height="7" rx="1" />
			<rect x="4" y="13" width="7" height="7" rx="1" />
			<rect x="13" y="13" width="7" height="7" rx="1" />
		</svg>
	),
	displayChoice(
		'block',
		'Block',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="6" width="16" height="12" rx="1" />
		</svg>
	),
];

const choice = ( value: string, title: string, icon: JSX.Element ): IconChoice => ( { value, title, icon } );
const opts = ( values: string[] ) => values.map( ( value ) => ( { value, label: value } ) );

/**
 * Flex arrangement, all four on the same shape: the values that carry the layout get an icon, the
 * tail gets a dropdown row. Four icons is the ceiling — past that the targets are narrower than
 * they are tall and the row stops reading as a set of choices.
 */
const DIRECTION_CHOICES: IconChoice[] = [
	choice( 'row', 'Row',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="5" y1="12" x2="19" y2="12" /><polyline points="14 7 19 12 14 17" />
		</svg> ),
	choice( 'row-reverse', 'Row reverse',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="19" y1="12" x2="5" y2="12" /><polyline points="10 7 5 12 10 17" />
		</svg> ),
	choice( 'column', 'Column',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="12" y1="5" x2="12" y2="19" /><polyline points="7 14 12 19 17 14" />
		</svg> ),
	choice( 'column-reverse', 'Column reverse',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="12" y1="19" x2="12" y2="5" /><polyline points="7 10 12 5 17 10" />
		</svg> ),
];
const DIRECTION_OPTIONS = opts( [ 'row', 'row-reverse', 'column', 'column-reverse' ] );

const JUSTIFY_CHOICES: IconChoice[] = [
	choice( 'flex-start', 'Start',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="5" width="3" height="14" /><rect x="8" y="5" width="3" height="14" /><rect x="13" y="5" width="3" height="14" />
		</svg> ),
	choice( 'center', 'Center',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="7" y="5" width="3" height="14" /><rect x="11" y="5" width="3" height="14" /><rect x="15" y="5" width="3" height="14" />
		</svg> ),
	choice( 'flex-end', 'End',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="8" y="5" width="3" height="14" /><rect x="13" y="5" width="3" height="14" /><rect x="18" y="5" width="3" height="14" />
		</svg> ),
	choice( 'space-between', 'Space between',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="5" width="3" height="14" /><rect x="10.5" y="5" width="3" height="14" /><rect x="18" y="5" width="3" height="14" />
		</svg> ),
];
const JUSTIFY_OPTIONS = opts( [
	'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'start', 'end', 'normal', 'stretch',
] );

// `start`/`end` rather than `flex-start`/`flex-end`: this is what the control has always written,
// and the two behave identically in flex. Both spellings stay in the dropdown so a value saved
// either way still matches an option.
const ALIGN_ITEMS_CHOICES: IconChoice[] = [
	choice( 'start', 'Start',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="3" width="14" height="3" /><rect x="5" y="8" width="14" height="3" />
		</svg> ),
	choice( 'center', 'Center',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="7" width="14" height="3" /><rect x="5" y="12" width="14" height="3" />
		</svg> ),
	choice( 'end', 'End',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="13" width="14" height="3" /><rect x="5" y="18" width="14" height="3" />
		</svg> ),
	choice( 'stretch', 'Stretch',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="4" width="6" height="16" /><rect x="13" y="4" width="6" height="16" />
		</svg> ),
];
const ALIGN_ITEMS_OPTIONS = opts( [
	'start', 'center', 'end', 'stretch', 'baseline', 'flex-start', 'flex-end', 'normal', 'self-start', 'self-end',
] );

const WRAP_CHOICES: IconChoice[] = [
	choice( 'nowrap', 'No wrap',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="2" y="9" width="5" height="6" /><rect x="9" y="9" width="5" height="6" /><rect x="16" y="9" width="5" height="6" />
		</svg> ),
	choice( 'wrap', 'Wrap',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="5" width="7" height="5" /><rect x="12" y="5" width="7" height="5" /><rect x="3" y="14" width="7" height="5" />
		</svg> ),
	choice( 'wrap-reverse', 'Wrap reverse',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="5" width="7" height="5" /><rect x="12" y="14" width="7" height="5" /><rect x="3" y="14" width="7" height="5" />
		</svg> ),
];
const WRAP_OPTIONS = opts( [ 'nowrap', 'wrap', 'wrap-reverse' ] );

const ALIGN_CONTENT_CHOICES: IconChoice[] = [
	choice( 'flex-start', 'Start',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="4" y="4" width="16" height="4" /><rect x="4" y="10" width="16" height="4" />
		</svg> ),
	choice( 'center', 'Center',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="4" y="6" width="16" height="4" /><rect x="4" y="14" width="16" height="4" />
		</svg> ),
	choice( 'flex-end', 'End',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="4" y="10" width="16" height="4" /><rect x="4" y="16" width="16" height="4" />
		</svg> ),
	choice( 'space-between', 'Space between',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="4" y="3" width="16" height="4" /><rect x="4" y="17" width="16" height="4" />
		</svg> ),
];
const ALIGN_CONTENT_OPTIONS = opts( [
	'normal', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch',
] );

/**
 * Overflow. `auto` used to be the literal word "auto" wedged into an icon button; it is a
 * scrollbar-when-needed, so it gets a scrollbar that is only half there.
 */
const OVERFLOW_CHOICES: IconChoice[] = [
	choice( 'visible', 'Visible',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
		</svg> ),
	choice( 'hidden', 'Hidden',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M17.9 17.9A10 10 0 0 1 12 20C7 20 2.7 16.9 1 12a18 18 0 0 1 5-5.9" />
			<line x1="2" y1="2" x2="22" y2="22" />
		</svg> ),
	choice( 'scroll', 'Scroll',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="4" width="16" height="16" rx="2" /><line x1="8" y1="20" x2="16" y2="20" />
		</svg> ),
	choice( 'auto', 'Auto',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="4" width="16" height="16" rx="2" />
			<line x1="8" y1="20" x2="12" y2="20" strokeDasharray="3 3" />
		</svg> ),
];
const OVERFLOW_OPTIONS = opts( [ 'visible', 'hidden', 'scroll', 'auto', 'clip' ] );

/* ---- closed value sets: icons only, no field ---- */

const SNAP_STOP_CHOICES: IconChoice[] = [
	choice( 'normal', 'Normal — scrolling may pass snap points',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="3" y1="12" x2="19" y2="12" /><polyline points="15 8 19 12 15 16" />
		</svg> ),
	choice( 'always', 'Always — stop at every snap point',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="3" y1="12" x2="14" y2="12" /><polyline points="10 8 14 12 10 16" />
			<line x1="19" y1="5" x2="19" y2="19" />
		</svg> ),
];

const SCROLL_BEHAVIOR_CHOICES: IconChoice[] = [
	choice( 'auto', 'Auto — jump',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="4" y1="12" x2="20" y2="12" /><polyline points="16 8 20 12 16 16" />
		</svg> ),
	choice( 'smooth', 'Smooth — animate',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<path d="M3 14c3-6 6 6 9 0s5-4 6-2" /><polyline points="15 8 19 11 16 14" />
		</svg> ),
];

const OVERSCROLL_CHOICES: IconChoice[] = [
	choice( 'auto', 'Auto — scroll chains to the page',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="4" y="4" width="16" height="12" rx="2" /><polyline points="9 20 12 23 15 20" />
		</svg> ),
	choice( 'contain', 'Contain — stop at this element',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="4" y="4" width="16" height="12" rx="2" /><line x1="7" y1="20" x2="17" y2="20" />
		</svg> ),
	choice( 'none', 'None — no chaining, no bounce',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="4" y="4" width="16" height="12" rx="2" /><line x1="4" y1="20" x2="20" y2="20" />
			<line x1="3" y1="3" x2="21" y2="21" />
		</svg> ),
];

const CONTAINER_TYPE_CHOICES: IconChoice[] = [
	choice( 'normal', 'Normal — not a query container',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="5" width="16" height="14" rx="2" />
		</svg> ),
	choice( 'inline-size', 'Inline size — queryable by width',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="4" y="5" width="16" height="14" rx="2" />
			<line x1="8" y1="12" x2="16" y2="12" /><polyline points="10 10 8 12 10 14" /><polyline points="14 10 16 12 14 14" />
		</svg> ),
	choice( 'size', 'Size — queryable both ways',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="4" y="5" width="16" height="14" rx="2" />
			<line x1="8" y1="12" x2="16" y2="12" /><line x1="12" y1="8" x2="12" y2="16" />
		</svg> ),
];

const CONTENT_VIS_CHOICES: IconChoice[] = [
	choice( 'visible', 'Visible — always rendered',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
		</svg> ),
	choice( 'auto', 'Auto — skip rendering when off-screen',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeDasharray="4 3" /><circle cx="12" cy="12" r="3" />
		</svg> ),
	choice( 'hidden', 'Hidden — never rendered',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M17.9 17.9A10 10 0 0 1 12 20C7 20 2.7 16.9 1 12a18 18 0 0 1 5-5.9" />
			<line x1="2" y1="2" x2="22" y2="22" />
		</svg> ),
];

const VISIBILITY_CHOICES: IconChoice[] = [
	choice( 'visible', 'Visible',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
		</svg> ),
	choice( 'hidden', 'Hidden — invisible, still takes space',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M17.9 17.9A10 10 0 0 1 12 20C7 20 2.7 16.9 1 12a18 18 0 0 1 5-5.9" />
			<line x1="2" y1="2" x2="22" y2="22" />
		</svg> ),
	choice( 'collapse', 'Collapse — removes the row or column',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" />
			<polyline points="9 10 12 12 15 10" /><polyline points="9 14 12 12 15 14" />
		</svg> ),
];

const ISOLATION_CHOICES: IconChoice[] = [
	choice( 'auto', 'Auto',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="4" width="16" height="16" rx="2" />
		</svg> ),
	choice( 'isolate', 'Isolate — new stacking context',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="8" width="13" height="13" rx="2" /><path d="M8 8V5a2 2 0 0 1 2-2h11v11a2 2 0 0 1-2 2h-3" />
		</svg> ),
];

const DIRECTION_TEXT_CHOICES: IconChoice[] = [
	choice( 'ltr', 'Left to right',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="15" y2="12" />
			<line x1="4" y1="17" x2="13" y2="17" /><polyline points="17 14 20 17 17 20" />
		</svg> ),
	choice( 'rtl', 'Right to left',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="4" y1="7" x2="20" y2="7" /><line x1="9" y1="12" x2="20" y2="12" />
			<line x1="11" y1="17" x2="20" y2="17" /><polyline points="7 14 4 17 7 20" />
		</svg> ),
];

/* ---- common values as icons, rarer ones in the dropdown ---- */

const SNAP_TYPE_CHOICES: IconChoice[] = [
	choice( 'none', 'No snapping',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="4" y1="12" x2="20" y2="12" strokeDasharray="3 3" />
		</svg> ),
	choice( 'x mandatory', 'Snap horizontally',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="4" y1="12" x2="20" y2="12" /><line x1="9" y1="7" x2="9" y2="17" /><line x1="15" y1="7" x2="15" y2="17" />
		</svg> ),
	choice( 'y mandatory', 'Snap vertically',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="12" y1="4" x2="12" y2="20" /><line x1="7" y1="9" x2="17" y2="9" /><line x1="7" y1="15" x2="17" y2="15" />
		</svg> ),
];
const SNAP_TYPE_OPTIONS = opts( [ 'none', 'x mandatory', 'y mandatory', 'both mandatory', 'x proximity', 'y proximity' ] );

/* `none` gets no icon: an empty field already means none, and at this width the icon it would
   cost is width the current value needs to stay legible. Same for `clear`. */
const FLOAT_CHOICES: IconChoice[] = [
	choice( 'left', 'Float left',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="3" y="5" width="8" height="8" fill="currentColor" stroke="none" />
			<line x1="13" y1="7" x2="21" y2="7" /><line x1="13" y1="11" x2="21" y2="11" /><line x1="3" y1="17" x2="21" y2="17" />
		</svg> ),
	choice( 'right', 'Float right',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect x="13" y="5" width="8" height="8" fill="currentColor" stroke="none" />
			<line x1="3" y1="7" x2="11" y2="7" /><line x1="3" y1="11" x2="11" y2="11" /><line x1="3" y1="17" x2="21" y2="17" />
		</svg> ),
];
const FLOAT_OPTIONS = opts( [ 'left', 'right', 'inline-start', 'inline-end', 'none' ] );

const CLEAR_CHOICES: IconChoice[] = [
	choice( 'left', 'Clear left',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="3" y1="6" x2="10" y2="6" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" />
		</svg> ),
	choice( 'right', 'Clear right',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="14" y1="6" x2="21" y2="6" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" />
		</svg> ),
	choice( 'both', 'Clear both',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<line x1="3" y1="6" x2="8" y2="6" /><line x1="16" y1="6" x2="21" y2="6" />
			<line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" />
		</svg> ),
];
const CLEAR_OPTIONS = opts( [ 'left', 'right', 'both', 'inline-start', 'inline-end', 'none' ] );

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	/** Per-control manifest check from the Inspector. Absent → everything renders (back-compat). */
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

// Gaps resolve token slugs against the spacing scale, width/height against the dedicated width
// scale (see `valOrToken`/`cssValueForCategory` in the style engine).
// Value spaces that are not a plain keyword list, so `OptionField` cannot infer them from its own
// options: a ratio (`16/9`, `1.618`), a line count, and `contain`'s space-separated combinations.
const RATIO_PATTERN = lengthOrTokenPattern( 'aspect', /^(auto|\d+(\.\d+)?( ?\/ ?\d+(\.\d+)?)?)$/ );
const LINE_COUNT_PATTERN = /^(none|[1-9]\d*)$/;
const CONTAIN_PATTERN = keywordPattern(
	[ 'layout', 'paint', 'size', 'inline-size', 'style', 'content', 'strict', 'none' ],
	{ multi: true }
);

const GAP_SUGGESTIONS = tokenSuggestions( 'spacing', LENGTH_SUGGESTIONS );
const GAP_PATTERN = lengthOrTokenPattern( 'spacing', LENGTH_PATTERN );
const WIDTH_PATTERN = lengthOrTokenPattern( 'width', LENGTH_PATTERN );

/**
 * Per-section search keywords. Exported as a flat union (`LAYOUT_KEYWORDS`) for the Inspector's
 * rail filter, so the facet can never appear in the rail while its body renders nothing — or
 * vice versa. Each facet body owns its own keywords for the same reason.
 */
const K = {
	display: [ 'display', 'block', 'flex', 'stack', 'grid', 'inline', 'contents', 'hidden', 'none', 'hide', 'flow-root' ],
	flex: [ 'flex', 'stack', 'direction', 'row', 'column', 'reverse', 'wrap', 'nowrap', 'justify', 'align', 'items', 'content', 'between', 'around', 'evenly', 'baseline', 'stretch', 'center', 'start', 'end' ],
	// Gap belongs to whichever mode is chosen, so it is searched with the modes rather than with
	// margin and padding.
	gap: [ 'gap', 'gutter', 'space', 'between', 'children', 'row', 'column' ],
	// The Grid facet's own keywords, folded in now that grid tracks are nested under Display.
	grid: GRID_KEYWORDS,
	size: [ 'size', 'width', 'height', 'min', 'max', 'aspect', 'ratio', 'object', 'fit', 'box', 'sizing', 'resize', 'truncate', 'lines', 'clamp' ],
	overflow: [ 'overflow', 'scroll', 'clip', 'visible', 'hidden', 'auto' ],
	snap: [ 'scroll', 'snap', 'axis', 'behavior', 'behaviour', 'overscroll', 'stop', 'smooth' ],
	more: [ 'more', 'container', 'query', 'contain', 'containment', 'content', 'visibility', 'intrinsic', 'float', 'clear', 'isolation', 'direction', 'ltr', 'rtl' ],
};

export const LAYOUT_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

export function LayoutControl( { attributes, setAttributes, state, breakpoint, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const display = getValue( attributes, 'layout.display', state, breakpoint ) || '';
	const flexDirection = getValue( attributes, 'layout.flexDirection', state, breakpoint ) || '';
	const justifyContent = getValue( attributes, 'layout.justifyContent', state, breakpoint ) || '';
	const alignItems = getValue( attributes, 'layout.alignItems', state, breakpoint ) || '';
	const flexWrap = getValue( attributes, 'layout.flexWrap', state, breakpoint ) || '';
	const width = getValue( attributes, 'layout.width', state, breakpoint ) || '';
	const height = getValue( attributes, 'layout.height', state, breakpoint ) || '';
	const overflow = getValue( attributes, 'layout.overflow', state, breakpoint ) || '';
	const overflowX = getValue( attributes, 'layout.overflowX', state, breakpoint ) || '';
	const overflowY = getValue( attributes, 'layout.overflowY', state, breakpoint ) || '';
	const scrollSnapType = getValue( attributes, 'layout.scrollSnapType', state, breakpoint ) || '';
	const containerType = getValue( attributes, 'layout.containerType', state, breakpoint ) || '';
	const containerName = getValue( attributes, 'layout.containerName', state, breakpoint ) || '';
	const aspectRatio = getValue( attributes, 'layout.aspectRatio', state, breakpoint ) || '';
	const objectFit = getValue( attributes, 'layout.objectFit', state, breakpoint ) || '';
	const alignContent = getValue( attributes, 'layout.alignContent', state, breakpoint ) || '';
	const gapRow = getValue( attributes, 'layout.gapRow', state, breakpoint ) || '';
	const gapColumn = getValue( attributes, 'layout.gapColumn', state, breakpoint ) || '';
	const minWidth = getValue( attributes, 'layout.minWidth', state, breakpoint ) || '';
	const maxWidth = getValue( attributes, 'layout.maxWidth', state, breakpoint ) || '';
	const minHeight = getValue( attributes, 'layout.minHeight', state, breakpoint ) || '';
	const maxHeight = getValue( attributes, 'layout.maxHeight', state, breakpoint ) || '';
	const boxSizing = getValue( attributes, 'layout.boxSizing', state, breakpoint ) || '';
	const visibility = getValue( attributes, 'layout.visibility', state, breakpoint ) || '';
	const float = getValue( attributes, 'layout.float', state, breakpoint ) || '';
	const clear = getValue( attributes, 'layout.clear', state, breakpoint ) || '';
	const isolation = getValue( attributes, 'layout.isolation', state, breakpoint ) || '';
	const resize = getValue( attributes, 'layout.resize', state, breakpoint ) || '';
	const scrollBehavior = getValue( attributes, 'layout.scrollBehavior', state, breakpoint ) || '';
	const overscrollBehavior = getValue( attributes, 'layout.overscrollBehavior', state, breakpoint ) || '';
	const scrollSnapStop = getValue( attributes, 'layout.scrollSnapStop', state, breakpoint ) || '';
	const direction = getValue( attributes, 'layout.direction', state, breakpoint ) || '';
	const contain = getValue( attributes, 'layout.contain', state, breakpoint ) || '';
	const contentVisibility = getValue( attributes, 'layout.contentVisibility', state, breakpoint ) || '';
	const containIntrinsicSize = getValue( attributes, 'layout.containIntrinsicSize', state, breakpoint ) || '';
	const lineClamp = getValue( attributes, 'layout.lineClamp', state, breakpoint ) || '';

	const setVal = ( controlId: string ) => ( value: string ) =>
		setOrClear( attributes, setAttributes, controlId, state, breakpoint, value );


	const isFlex = display === 'flex' || display === 'inline-flex';
	const isGrid = display === 'grid' || display === 'inline-grid';

	// Blocks whose manifest excludes `layout.display` ARE their display mode (Stack = flex,
	// Grid = grid), so their group shows unconditionally instead of behind the display reveal.
	const hasDisplay = can( 'layout.display' );

	// In-facet property search. The shell's registry keywords only decide which *facet* opens;
	// these decide which sections inside it render. Each gate below is the existing manifest
	// condition with a keyword test folded in, so the JSX structure is untouched.
	const m = makeMatcher( query );
	const searching = Boolean( ( query ?? '' ).trim() );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );
	const showFlexGroup = can( 'layout.flexDirection' ) && ( hasDisplay ? isFlex : ! isGrid );
	const showGridGroup =
		( can( 'layout.gridColumns' ) || can( 'layout.gridRows' ) ) && ( hasDisplay ? isGrid : ! isFlex );
	// Gap only means anything on a flex or grid container. Grid brings its own gap section, so this
	// one belongs to the flex branch.
	const showGap = showFlexGroup && ( can( 'layout.gapRow' ) || can( 'layout.gapColumn' ) ) && m( K.gap );
	const sizingCount = [ aspectRatio, objectFit, boxSizing, resize, lineClamp ].filter( Boolean ).length;
	const hasFlexValue = Boolean( flexDirection || justifyContent || alignItems || flexWrap || alignContent );

	return (
		<div className="bl-layout">
			<ValueDatalist id="bl-length-values" values={ LENGTH_SUGGESTIONS } />
			<ValueDatalist id="bl-gap-values" values={ GAP_SUGGESTIONS } />

			{ ! anyMatch && <NoMatches query={ query ?? '' } /> }
			{ hasDisplay && m( K.display ) && (
			<div className="field">
				<FieldHead
					label="Display"
					modified={ Boolean( display ) }
					showReset={ Boolean( display ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.display', state, breakpoint, '' ) }
				/>
				<IconValueField
					value={ display }
					choices={ DISPLAY_CHOICES }
					options={ DISPLAY_OPTIONS }
					placeholder="block"
					onChange={ ( next ) =>
						setValue( attributes, setAttributes, 'layout.display', state, breakpoint, next )
					}
				/>
			</div>
			) }

			{ /* Everything that exists *because of* the chosen display mode hangs off the Display
			     field rather than sitting beside it: flex arrangement and gap under Flex, the whole
			     track model under Grid. Scattering them across the facet — and across a Grid facet of
			     its own — meant reading three places to learn what one dropdown had decided. */ }
			{ ( showFlexGroup || showGridGroup ) && (
			<div className="bl-display-nest">

			{ showFlexGroup && m( K.flex ) && (
				<MoreSettings
					label="Flex"
					// Open when the block already arranges itself, so nobody loses sight of a value
					// they set; collapsed on a fresh flex container, where five untouched fields are
					// just noise above Size and Overflow.
					defaultOpen={ hasFlexValue }
					forceOpen={ searching }
				>
					<div className="field">
						<FieldHead
							label="Direction"
							modified={ Boolean( flexDirection ) }
							showReset={ Boolean( flexDirection ) }
							onReset={ () => setValue( attributes, setAttributes, 'layout.flexDirection', state, breakpoint, '' ) }
						/>
						<IconValueField
							value={ flexDirection }
							choices={ DIRECTION_CHOICES }
							options={ DIRECTION_OPTIONS }
							placeholder="row"
							onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.flexDirection', state, breakpoint, next ) }
						/>
					</div>
					{ can( 'layout.justifyContent' ) && (
					<div className="field">
						<FieldHead
							label="Justify content"
							modified={ Boolean( justifyContent ) }
							showReset={ Boolean( justifyContent ) }
							onReset={ () => setValue( attributes, setAttributes, 'layout.justifyContent', state, breakpoint, '' ) }
						/>
						<IconValueField
							value={ justifyContent }
							choices={ JUSTIFY_CHOICES }
							options={ JUSTIFY_OPTIONS }
							placeholder="flex-start"
							onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.justifyContent', state, breakpoint, next ) }
						/>
					</div>
					) }
					{ can( 'layout.alignItems' ) && (
					<div className="field">
						<FieldHead
							label="Align items"
							modified={ Boolean( alignItems ) }
							showReset={ Boolean( alignItems ) }
							onReset={ () => setValue( attributes, setAttributes, 'layout.alignItems', state, breakpoint, '' ) }
						/>
						<IconValueField
							value={ alignItems }
							choices={ ALIGN_ITEMS_CHOICES }
							options={ ALIGN_ITEMS_OPTIONS }
							placeholder="stretch"
							onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.alignItems', state, breakpoint, next ) }
						/>
					</div>
					) }
					{ can( 'layout.flexWrap' ) && (
					<div className="field">
						<FieldHead
							label="Wrap"
							modified={ Boolean( flexWrap ) }
							showReset={ Boolean( flexWrap ) }
							onReset={ () => setValue( attributes, setAttributes, 'layout.flexWrap', state, breakpoint, '' ) }
						/>
						<IconValueField
							value={ flexWrap }
							choices={ WRAP_CHOICES }
							options={ WRAP_OPTIONS }
							placeholder="nowrap"
							onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.flexWrap', state, breakpoint, next ) }
						/>
					</div>
					) }
					{ can( 'layout.alignContent' ) && (
					<div className="field">
						<FieldHead
							label="Align content"
							modified={ Boolean( alignContent ) }
							showReset={ Boolean( alignContent ) }
							onReset={ () => setValue( attributes, setAttributes, 'layout.alignContent', state, breakpoint, '' ) }
						/>
						<IconValueField
							value={ alignContent }
							choices={ ALIGN_CONTENT_CHOICES }
							options={ ALIGN_CONTENT_OPTIONS }
							placeholder="normal"
							onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.alignContent', state, breakpoint, next ) }
						/>
					</div>
					) }
				</MoreSettings>
			) }

			{ showGap && (
				<MoreSettings label="Gap" defaultOpen forceOpen={ searching }>
					<div className="bl-fields bl-fields--2">
						<LengthField
							label="ROW"
							hint="Row gap — space between rows"
							category="spacing"
							literals={ LENGTH_SUGGESTIONS }
							pattern={ GAP_PATTERN }
							listLabel="SPACING LIBRARY"
							value={ gapRow }
							placeholder="0"
							onChange={ setVal( 'layout.gapRow' ) }
						/>
						<LengthField
							label="COL"
							hint="Column gap — space between columns"
							category="spacing"
							literals={ LENGTH_SUGGESTIONS }
							pattern={ GAP_PATTERN }
							listLabel="SPACING LIBRARY"
							value={ gapColumn }
							placeholder="0"
							onChange={ setVal( 'layout.gapColumn' ) }
						/>
					</div>
				</MoreSettings>
			) }

			{ /* The Grid facet's body, rendered in place. The parent gate is the same condition its
			     own empty state used to check, so that state can no longer be reached from here. */ }
			{ showGridGroup && (
				<GridControl
					nested
					attributes={ attributes }
					setAttributes={ setAttributes }
					state={ state }
					breakpoint={ breakpoint }
					isAllowed={ isAllowed }
					query={ query }
				/>
			) }

			</div>
			) }

			{ ( can( 'layout.width' ) || can( 'layout.height' ) || can( 'layout.minWidth' ) || can( 'layout.minHeight' ) || can( 'layout.maxWidth' ) || can( 'layout.maxHeight' ) || can( 'layout.aspectRatio' ) || can( 'layout.objectFit' ) || can( 'layout.boxSizing' ) || can( 'layout.resize' ) || can( 'layout.lineClamp' ) ) && m( K.size ) && (
			<MoreSettings forceOpen={ searching } label="Size" defaultOpen>

			{ /* Each axis owns its own bounds: min and max sit under the length they constrain, not in
			     a separate bucket that made you read two sections to learn one thing. */ }
			{ ( can( 'layout.width' ) || can( 'layout.height' ) ) && (
			<div className="bl-fields">
				{ can( 'layout.width' ) && (
				<LengthFieldGroup
					label="W"
					hint="Width"
					category="width"
					literals={ LENGTH_SUGGESTIONS }
					pattern={ WIDTH_PATTERN }
					value={ width }
					placeholder="auto"
					onChange={ setVal( 'layout.width' ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.width', state, breakpoint, '' ) }
					constrained={ Boolean( minWidth || maxWidth ) }
					defaultOpen={ Boolean( minWidth || maxWidth ) }
					forceOpen={ searching }
				>
					<LengthField
						label="MIN W"
						hint="Minimum width"
						category="width"
						literals={ LENGTH_SUGGESTIONS }
						pattern={ WIDTH_PATTERN }
						value={ minWidth }
						placeholder="auto"
						onChange={ setVal( 'layout.minWidth' ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.minWidth', state, breakpoint, '' ) }
					/>
					<LengthField
						label="MAX W"
						hint="Maximum width"
						category="width"
						literals={ LENGTH_SUGGESTIONS }
						pattern={ WIDTH_PATTERN }
						value={ maxWidth }
						placeholder="none"
						onChange={ setVal( 'layout.maxWidth' ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.maxWidth', state, breakpoint, '' ) }
					/>
				</LengthFieldGroup>
				) }
				{ can( 'layout.height' ) && (
				<LengthFieldGroup
					label="H"
					hint="Height"
					category="width"
					literals={ LENGTH_SUGGESTIONS }
					pattern={ WIDTH_PATTERN }
					value={ height }
					placeholder="auto"
					onChange={ setVal( 'layout.height' ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.height', state, breakpoint, '' ) }
					constrained={ Boolean( minHeight || maxHeight ) }
					defaultOpen={ Boolean( minHeight || maxHeight ) }
					forceOpen={ searching }
				>
					<LengthField
						label="MIN H"
						hint="Minimum height"
						category="width"
						literals={ LENGTH_SUGGESTIONS }
						pattern={ WIDTH_PATTERN }
						value={ minHeight }
						placeholder="auto"
						onChange={ setVal( 'layout.minHeight' ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.minHeight', state, breakpoint, '' ) }
					/>
					<LengthField
						label="MAX H"
						hint="Maximum height"
						category="width"
						literals={ LENGTH_SUGGESTIONS }
						pattern={ WIDTH_PATTERN }
						value={ maxHeight }
						placeholder="none"
						onChange={ setVal( 'layout.maxHeight' ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.maxHeight', state, breakpoint, '' ) }
					/>
				</LengthFieldGroup>
				) }
			</div>
			) }

			{ /* Ratio, fit, box-sizing, resize and clamp are the rare half of Size — real settings,
			     but not ones most blocks touch, so they sit behind a disclosure with a count rather than
			     padding out the section every time someone sets a width. */ }
			{ ( can( 'layout.aspectRatio' ) || can( 'layout.objectFit' ) || can( 'layout.boxSizing' ) || can( 'layout.resize' ) || can( 'layout.lineClamp' ) ) && (
			<MoreSettings
				label="Fit & sizing"
				badge={ sizingCount }
				defaultOpen={ sizingCount > 0 }
				forceOpen={ searching }
			>
				{ ( can( 'layout.aspectRatio' ) || can( 'layout.objectFit' ) ) && (
				<div className="bl-fields">
					{ can( 'layout.aspectRatio' ) && (
					<OptionField
						label="RATIO"
						hint="Aspect ratio"
						values={ [ 'auto', '1/1', '4/3', '3/2', '16/9', '21/9', '9/16' ] }
						extra={ tokenOptions( 'aspect' ).map( ( opt ) => ( { value: opt.slug, label: opt.label, hint: opt.css } ) ) }
						pattern={ RATIO_PATTERN }
						value={ aspectRatio }
						placeholder="auto"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.aspectRatio', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.aspectRatio', state, breakpoint, '' ) }
					/>
					) }
					{ can( 'layout.objectFit' ) && (
					<OptionField
						label="FIT"
						hint="Object fit"
						values={ [ 'cover', 'contain', 'fill', 'none', 'scale-down' ] }
						value={ objectFit }
						placeholder="fill"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.objectFit', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.objectFit', state, breakpoint, '' ) }
					/>
					) }
				</div>
				) }

				{ ( can( 'layout.boxSizing' ) || can( 'layout.resize' ) ) && (
				<div className="bl-fields">
					{ can( 'layout.boxSizing' ) && (
					<OptionField
						label="BOX"
						hint="Box sizing"
						values={ [ 'content-box', 'border-box' ] }
						value={ boxSizing }
						placeholder="content-box"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.boxSizing', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.boxSizing', state, breakpoint, '' ) }
					/>
					) }
					{ can( 'layout.resize' ) && (
					<OptionField
						label="RESIZE"
						hint="Resize handle"
						values={ [ 'none', 'both', 'horizontal', 'vertical' ] }
						value={ resize }
						placeholder="none"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.resize', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.resize', state, breakpoint, '' ) }
					/>
					) }
				</div>
				) }

				{ can( 'layout.lineClamp' ) && (
				<div className="bl-fields">
					<OptionField
						label="LINES"
						hint="Truncate after this many lines"
						values={ [ '1', '2', '3', '4', '5', '6' ] }
						pattern={ LINE_COUNT_PATTERN }
						value={ lineClamp }
						placeholder="off"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.lineClamp', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.lineClamp', state, breakpoint, '' ) }
					/>
				</div>
				) }
			</MoreSettings>
			) }

			</MoreSettings>
			) }

			{ ( can( 'layout.overflow' ) || can( 'layout.overflowX' ) || can( 'layout.overflowY' ) ) && m( K.overflow ) && (
			<MoreSettings forceOpen={ searching } label="Overflow" defaultOpen={ Boolean( overflow || overflowX || overflowY ) }>
			{ /* No field label: the disclosure above already says "Overflow", and repeating it inside
			     read as two settings rather than one. The per-axis overrides nest under the shorthand
			     they override — setting one axis is a deliberate act, not the usual way in. */ }
			<div className="bl-fields">
				<FieldGroup
					title="Per axis"
					constrained={ Boolean( overflowX || overflowY ) }
					defaultOpen={ Boolean( overflowX || overflowY ) }
					forceOpen={ searching }
					field={ ( toggle ) => (
						<IconValueField
							before={ toggle }
							value={ overflow }
							choices={ OVERFLOW_CHOICES }
							options={ OVERFLOW_OPTIONS }
							placeholder="visible"
							onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.overflow', state, breakpoint, next ) }
						/>
					) }
				>
					{ can( 'layout.overflowX' ) && (
					<OptionField
						label="X"
						hint="Overflow X"
						values={ [ 'visible', 'hidden', 'scroll', 'auto', 'clip' ] }
						value={ overflowX }
						placeholder="visible"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.overflowX', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.overflowX', state, breakpoint, '' ) }
					/>
					) }
					{ can( 'layout.overflowY' ) && (
					<OptionField
						label="Y"
						hint="Overflow Y"
						values={ [ 'visible', 'hidden', 'scroll', 'auto', 'clip' ] }
						value={ overflowY }
						placeholder="visible"
						onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.overflowY', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'layout.overflowY', state, breakpoint, '' ) }
					/>
					) }
				</FieldGroup>
			</div>
			</MoreSettings>
			) }

			{ ( can( 'layout.scrollSnapType' ) || can( 'layout.scrollBehavior' ) || can( 'layout.overscrollBehavior' ) || can( 'layout.scrollSnapStop' ) ) && m( K.snap ) && (
			<MoreSettings forceOpen={ searching } label="Scroll snap" defaultOpen={ Boolean( scrollSnapType || scrollBehavior || overscrollBehavior || scrollSnapStop ) }>
			{ /* Snap axis keeps a field: `proximity` and `both` are real values with no honest glyph.
			     The other three are closed sets, so they are icons and nothing else — a text box beside
			     `ltr`/`rtl` can only ever hold what the icons already say. */ }
			<div className="bl-fields">
				{ can( 'layout.scrollSnapType' ) && (
				<IconValueField
					before={ <span className="bl-valuefield__cap" title="Scroll snap type">SNAP</span> }
					value={ scrollSnapType }
					choices={ SNAP_TYPE_CHOICES }
					options={ SNAP_TYPE_OPTIONS }
					placeholder="none"
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.scrollSnapType', state, breakpoint, next ) }
				/>
				) }
				{ can( 'layout.scrollSnapStop' ) && (
				<IconField
					label="STOP"
					hint="Scroll snap stop"
					value={ scrollSnapStop }
					choices={ SNAP_STOP_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.scrollSnapStop', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.scrollSnapStop', state, breakpoint, '' ) }
				/>
				) }
				{ can( 'layout.scrollBehavior' ) && (
				<IconField
					label="SCROLL"
					hint="Scroll behavior"
					value={ scrollBehavior }
					choices={ SCROLL_BEHAVIOR_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.scrollBehavior', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.scrollBehavior', state, breakpoint, '' ) }
				/>
				) }
				{ can( 'layout.overscrollBehavior' ) && (
				<IconField
					label="BOUNCE"
					hint="Overscroll behavior"
					value={ overscrollBehavior }
					choices={ OVERSCROLL_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.overscrollBehavior', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.overscrollBehavior', state, breakpoint, '' ) }
				/>
				) }
			</div>
			</MoreSettings>
			) }

			{ ( can( 'layout.containerType' ) || can( 'layout.containerName' ) || can( 'layout.contain' ) || can( 'layout.contentVisibility' ) || can( 'layout.containIntrinsicSize' ) || can( 'layout.visibility' ) || can( 'layout.float' ) || can( 'layout.clear' ) || can( 'layout.isolation' ) || can( 'layout.direction' ) ) && m( K.more ) && (
			<MoreSettings forceOpen={ searching } label="More" defaultOpen={ Boolean( containerType || containerName || contain || contentVisibility || containIntrinsicSize || visibility || float || clear || isolation || direction ) }>
			<div className="bl-fields">
				{ can( 'layout.containerType' ) && (
				<IconField
					label="CONTAINER"
					hint="Container type"
					value={ containerType }
					choices={ CONTAINER_TYPE_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.containerType', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.containerType', state, breakpoint, '' ) }
				/>
				) }
				{ /* Only nameable once it IS a container — an unnamed `normal` element has nothing to
				     name, and the field would write CSS that does nothing. */ }
				{ can( 'layout.containerName' ) && containerType && containerType !== 'normal' && (
				<OptionField
					label="NAME"
					hint="Container name"
					values={ [] }
					value={ containerName }
					placeholder="e.g. card"
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.containerName', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.containerName', state, breakpoint, '' ) }
				/>
				) }
				{ /* `contain` takes combinations (`layout paint`), so it stays a field — icons would
				     promise a single choice the property does not make. */ }
				{ can( 'layout.contain' ) && (
				<OptionField
					label="CONTAIN"
					hint="Contain"
					values={ [ 'layout', 'paint', 'size', 'style', 'content', 'strict', 'none' ] }
					pattern={ CONTAIN_PATTERN }
					value={ contain }
					placeholder="none"
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.contain', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.contain', state, breakpoint, '' ) }
				/>
				) }
				{ can( 'layout.contentVisibility' ) && (
				<IconField
					label="CONTENT"
					hint="Content visibility"
					value={ contentVisibility }
					choices={ CONTENT_VIS_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.contentVisibility', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.contentVisibility', state, breakpoint, '' ) }
				/>
				) }
				{ /* `contain-intrinsic-size` only means anything while content-visibility is skipping
				     work, so it appears with the mode that uses it. */ }
				{ can( 'layout.containIntrinsicSize' ) && contentVisibility === 'auto' && (
				<OptionField
					label="INTRINSIC"
					hint="Intrinsic size"
					values={ [] }
					value={ containIntrinsicSize }
					placeholder="auto 300px"
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.containIntrinsicSize', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.containIntrinsicSize', state, breakpoint, '' ) }
				/>
				) }
				{ can( 'layout.visibility' ) && (
				<IconField
					label="SHOW"
					hint="Visibility"
					value={ visibility }
					choices={ VISIBILITY_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.visibility', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.visibility', state, breakpoint, '' ) }
				/>
				) }
				{ can( 'layout.float' ) && (
				<IconValueField
					before={ <span className="bl-valuefield__cap" title="Float">FLOAT</span> }
					value={ float }
					choices={ FLOAT_CHOICES }
					options={ FLOAT_OPTIONS }
					placeholder="none"
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.float', state, breakpoint, next ) }
				/>
				) }
				{ can( 'layout.clear' ) && (
				<IconValueField
					before={ <span className="bl-valuefield__cap" title="Clear">CLEAR</span> }
					value={ clear }
					choices={ CLEAR_CHOICES }
					options={ CLEAR_OPTIONS }
					placeholder="none"
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.clear', state, breakpoint, next ) }
				/>
				) }
				{ can( 'layout.isolation' ) && (
				<IconField
					label="ISOLATE"
					hint="Isolation"
					value={ isolation }
					choices={ ISOLATION_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.isolation', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.isolation', state, breakpoint, '' ) }
				/>
				) }
				{ can( 'layout.direction' ) && (
				<IconField
					label="DIR"
					hint="Text direction"
					value={ direction }
					choices={ DIRECTION_TEXT_CHOICES }
					onChange={ ( next ) => setOrClear( attributes, setAttributes, 'layout.direction', state, breakpoint, next ) }
					onReset={ () => setValue( attributes, setAttributes, 'layout.direction', state, breakpoint, '' ) }
				/>
				) }
			</div>
			</MoreSettings>
			) }
		</div>
	);
}
