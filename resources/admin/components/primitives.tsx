import { __, sprintf } from '@wordpress/i18n';
import { tokenVar, titleCase } from '../data';
import { COLOR_FALLBACKS, PALETTE_TOKENS } from '../constants';
import type { DesignSystemSnapshot } from '../types';

/**
 * What the site's tokens currently *are* — the palette and the type roles read straight off
 * the live snapshot. Presentational: it shows only real values and offers no controls.
 */
export function TokenPreview( { snapshot }: { snapshot: DesignSystemSnapshot } ): JSX.Element {
	const colors = snapshot.values.color ?? {};
	const roles = snapshot.typeRoles.values ?? {};
	const swatches = PALETTE_TOKENS
		.map( token => ( { token, value: colors[ token ] || COLOR_FALLBACKS[ token ] || '' } ) )
		.filter( entry => entry.value !== '' );

	const sample = ( role: string ): React.CSSProperties => {
		const values = roles[ role ] ?? {};
		return {
			fontSize: values.fontSize,
			fontWeight: values.fontWeight as React.CSSProperties[ 'fontWeight' ],
			lineHeight: values.lineHeight,
			letterSpacing: values.letterSpacing,
			fontFamily: values.fontFamily,
			textTransform: values.textTransform as React.CSSProperties[ 'textTransform' ],
		};
	};

	return (
		<div className="tok">
			<div className="c">
				<div className="eyebrow">{ __( 'Type roles', 'blicks' ) }</div>
				<div className="ts">
					<b style={ sample( 'h2' ) }>{ __( 'Heading 2', 'blicks' ) }</b>
					<p style={ sample( 'body' ) }>{ __( 'Body text renders at the size, weight, and leading your theme sets.', 'blicks' ) }</p>
					<div className="role" style={ sample( 'mono' ) }>{ __( 'Eyebrow / mono', 'blicks' ) }</div>
				</div>
			</div>
			<div className="c">
				<div className="eyebrow">{ __( 'Palette', 'blicks' ) }</div>
				<div className="sw">
					{ swatches.map( entry => (
						<span
							key={ entry.token }
							style={ { '--c': entry.value } as React.CSSProperties }
							title={ `${ tokenVar( 'color', entry.token ) }: ${ entry.value }` }
						>
							<span className="screen-reader-text">{ `${ titleCase( entry.token ) }: ${ entry.value }` }</span>
						</span>
					) ) }
				</div>
				<div className="cap">
					{ sprintf(
						/* translators: 1: swatches shown, 2: total color tokens. */
						__( '%1$d of %2$d colors · theme-native', 'blicks' ),
						swatches.length,
						snapshot.counts.colors
					) }
				</div>
			</div>
		</div>
	);
}

/** One row inside a `.setlist` settings panel: label + help on the left, one control right. */
export function SettingRow( {
	title,
	text,
	children,
}: {
	title: string;
	text: string;
	children: React.ReactNode;
} ): JSX.Element {
	return (
		<div className="srow">
			<div className="t"><b>{ title }</b><small>{ text }</small></div>
			<div className="ctl">{ children }</div>
		</div>
	);
}

export function Select( {
	value,
	options,
	label,
	disabled = false,
	onChange,
}: {
	value: string;
	options: Array< { value: string; label: string } >;
	label: string;
	disabled?: boolean;
	onChange: ( value: string ) => void;
} ): JSX.Element {
	return (
		<span className="sel">
			<select value={ value } disabled={ disabled } aria-label={ label } onChange={ event => onChange( event.currentTarget.value ) }>
				{ options.map( option => (
					<option key={ option.value } value={ option.value }>{ option.label }</option>
				) ) }
			</select>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
		</span>
	);
}

export function Toggle( {
	checked,
	label,
	disabled = false,
	onChange,
}: {
	checked: boolean;
	label: string;
	disabled?: boolean;
	onChange: ( checked: boolean ) => void;
} ): JSX.Element {
	return (
		<span className="tog-wrap">
			<button
				type="button"
				role="switch"
				aria-checked={ checked }
				aria-label={ label }
				className="tog"
				disabled={ disabled }
				onClick={ () => onChange( ! checked ) }
			>
				<i />
			</button>
			<span className="tog-state">{ checked ? __( 'On', 'blicks' ) : __( 'Off', 'blicks' ) }</span>
		</span>
	);
}
