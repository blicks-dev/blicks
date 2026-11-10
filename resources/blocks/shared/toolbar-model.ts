/**
 * Pure helpers behind the block toolbars (`shared/toolbar.tsx`). A toolbar choice is the same
 * option list its Settings section shows, so the two can never offer different values.
 */

/** `[ value, label, ...anything ]` — the shape of the inspector's option lists. */
export type ChoiceOption = readonly [ string, string, ...unknown[] ];

export interface ChoiceControl {
	title: string;
	isActive: boolean;
	onClick: () => void;
}

/** The label the toolbar shows for `value`, else `fallback`. */
export function choiceLabel( options: readonly ChoiceOption[], value: unknown, fallback = '' ): string {
	return options.find( ( o ) => o[ 0 ] === String( value ?? '' ) )?.[ 1 ] ?? fallback;
}

/** One dropdown row per option; picking the current one again changes nothing. */
export function choiceControls(
	options: readonly ChoiceOption[],
	value: unknown,
	onChange: ( value: string ) => void,
	disabled: ( value: string ) => boolean = () => false
): ChoiceControl[] {
	const current = String( value ?? '' );
	return options
		.filter( ( o ) => ! disabled( o[ 0 ] ) )
		.map( ( [ v, title ] ) => ( {
			title,
			isActive: v === current,
			onClick: () => {
				if ( v !== current ) onChange( v );
			},
		} ) );
}

/** The link writes a block's Settings make for "Open in a new tab". */
export function newTabAttributes( on: boolean, rel = 'noreferrer noopener' ): { linkTarget: string; rel: string } {
	return { linkTarget: on ? '_blank' : '', rel: on ? rel : '' };
}
