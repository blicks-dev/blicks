import { __ } from '@wordpress/i18n';
import { ELEMENT_STATE_LABELS, STATE_LABELS } from '@/framework/states';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';

const DEVICE_ICONS: Record< string, JSX.Element > = {
	base: (
		<svg className="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="4" width="18" height="12" rx="2" />
			<path d="M8 20h8" />
			<path d="M12 16v4" />
		</svg>
	),
	tablet: (
		<svg className="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="6" y="3" width="12" height="18" rx="2" />
			<path d="M11 17h2" />
		</svg>
	),
	mobile: (
		<svg className="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="8" y="2.5" width="8" height="19" rx="2" />
			<path d="M11 18h2" />
		</svg>
	),
};

interface Props {
	states: string[];
	state: string;
	setState: ( s: string ) => void;
	breakpoint: string;
	setBreakpoint: ( id: string ) => void;
	/**
	 * The block's declared elements (`supports.blicks.elements`), as `{ id, label }`. Omitted or
	 * empty → no scope selector, and the bar looks exactly as it did before elements existed.
	 */
	scopes?: Array< { id: string; label: string } >;
	/** `''` = the block itself; otherwise the element id being styled. */
	scope?: string;
	setScope?: ( s: string ) => void;
}

/**
 * Compact scope + state + device (breakpoint) switcher above styling facets. State is a small
 * `<select>` — a dot beside it tints on non-default states so an active override is visible
 * without opening the menu. Device stays an always-visible icon trio. Compact form is
 * deliberate: the old two-segmented layout clipped the device trio at the narrow sidebar
 * width. Shared by the Decoration facet's scoped instance.
 *
 * Scope is the third axis, and reads like the other two: pick "Icon" and every facet below edits
 * the icon instead of the block. It only appears for blocks that declare elements.
 */
export function ContextBar( {
	states,
	state,
	setState,
	breakpoint,
	setBreakpoint,
	scopes = [],
	scope = '',
	setScope,
}: Props ) {
	const stateful = state !== 'default';
	// An element's states fire on the BLOCK, so they need labels that say so — see states.ts.
	const stateLabels = scope ? ELEMENT_STATE_LABELS : STATE_LABELS;

	return (
		<div className="ins-toolbar">
			{ scopes.length > 0 && setScope && (
				<div className={ `stsel ${ scope ? 'on' : '' }` }>
					<span className="stsel__dot" aria-hidden="true" />
					<select
						value={ scope }
						aria-label={ __( 'Editing element', 'blicks' ) }
						onChange={ ( e ) => setScope( e.target.value ) }
					>
						<option value="">{ __( 'Block', 'blicks' ) }</option>
						{ scopes.map( ( s ) => (
							<option key={ s.id } value={ s.id }>
								{ s.label }
							</option>
						) ) }
					</select>
				</div>
			) }

			{ states.length > 1 && (
				<div className={ `stsel ${ stateful ? 'on' : '' }` }>
					<span className="stsel__dot" aria-hidden="true" />
					<select
						value={ state }
						aria-label={ __( 'Editing state', 'blicks' ) }
						onChange={ ( e ) => setState( e.target.value ) }
					>
						{ states.map( ( s ) => (
							<option key={ s } value={ s }>
								{ stateLabels[ s ] ?? s }
							</option>
						) ) }
					</select>
				</div>
			) }

			<div className="dev" role="radiogroup" aria-label={ __( 'Breakpoint', 'blicks' ) }>
				{ DEFAULT_BREAKPOINTS.map( ( b ) => (
					<button
						key={ b.id }
						className={ breakpoint === b.id ? 'on' : '' }
						role="radio"
						aria-checked={ breakpoint === b.id }
						title={ b.label }
						aria-label={ b.label }
						onClick={ () => setBreakpoint( b.id ) }
					>
						{ DEVICE_ICONS[ b.id ] ?? b.label }
					</button>
				) ) }
			</div>
		</div>
	);
}
