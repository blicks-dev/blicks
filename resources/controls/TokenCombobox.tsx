import { useMemo } from '@wordpress/element';
import { Combobox } from '@/blocks/shared/combobox';
import { validateOrEmpty } from '@/controls/common';
import { tokenOptions } from '@/controls/token-utils';
import type { TokenCategory } from '@/framework/types';

interface Props {
	category: TokenCategory;
	value: string;
	placeholder?: string;
	/** Literal keyword/example values (e.g. `auto`, `0`) shown above the token slugs. */
	literals?: readonly string[];
	pattern: RegExp;
	onChange: ( value: string ) => void;
}

/**
 * Length/token field for the facet-rail inspector: a `<Combobox>` (free text + always-open
 * suggestion list) whose options already include the category's token slugs — no separate
 * token-library trigger needed, the dropdown IS the library.
 */
/**
 * Literal values first, then the category's token slugs — the option list a length field offers.
 * Exported because `ValueField` needs the same list without the `<Combobox>` wrapper around it.
 */
export function tokenComboboxOptions( category: TokenCategory, literals: readonly string[] = [] ) {
	const seen = new Set< string >();
	const opts: { value: string; label: string; hint?: string }[] = [];
	for ( const lit of literals ) {
		if ( seen.has( lit ) ) continue;
		seen.add( lit );
		opts.push( { value: lit, label: lit } );
	}
	for ( const opt of tokenOptions( category ) ) {
		if ( seen.has( opt.slug ) ) continue;
		seen.add( opt.slug );
		opts.push( { value: opt.slug, label: opt.label, hint: opt.css } );
	}
	return opts;
}

export function TokenCombobox( { category, value, placeholder, literals = [], pattern, onChange }: Props ) {
	const options = useMemo( () => tokenComboboxOptions( category, literals ), [ category, literals ] );

	return (
		<Combobox
			value={ value }
			options={ options }
			placeholder={ placeholder }
			onChange={ onChange }
			onCommit={ ( raw ) => onChange( validateOrEmpty( raw, pattern ) ) }
		/>
	);
}
