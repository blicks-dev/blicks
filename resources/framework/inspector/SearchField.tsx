import { __ } from '@wordpress/i18n';

interface Props {
	value: string;
	onChange: ( v: string ) => void;
}

/**
 * Property search above the facet rail. Phase 1 filters which **facets** the rail shows
 * (matched against each registry entry's `keywords`); per-section filtering inside a facet
 * body arrives with each body as it is rebuilt.
 */
export function SearchField( { value, onChange }: Props ) {
	return (
		<div className="ins-search">
			<svg className="ins-search__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
				<circle cx="10.5" cy="10.5" r="6.5" />
				<path d="m15.5 15.5 4.5 4.5" />
			</svg>
			<input
				type="search"
				className="ins-search__input"
				value={ value }
				placeholder={ __( 'Search properties', 'blicks' ) }
				aria-label={ __( 'Search properties', 'blicks' ) }
				onChange={ ( e ) => onChange( e.target.value ) }
			/>
			{ value && (
				<button
					type="button"
					className="ins-search__clear"
					title={ __( 'Clear search', 'blicks' ) }
					aria-label={ __( 'Clear search', 'blicks' ) }
					onClick={ () => onChange( '' ) }
				>
					×
				</button>
			) }
		</div>
	);
}
