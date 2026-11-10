import { CONTROL_VALUES, VALUE_SHAPES, VALUE_TREE } from './schema.gen';

/**
 * The JSON Schema for one value of a control: its shape (object keys, accepted forms, examples), the
 * token scale its slugs come from (`x-tokens`), and for an enum the names it takes. Values are stored
 * per state and breakpoint around it — see `VALUE_TREE`. Null for an unknown control.
 *
 * Mirror of ElementStyle::valueSchema(); both read the shapes generated from schema.json.
 */
export function valueSchema( id: string ): Record< string, unknown > | null {
	const c = CONTROL_VALUES[ id ];
	if ( ! c ) return null;
	return {
		title: id,
		...VALUE_SHAPES[ c.shape ],
		...( c.tokens ? { 'x-tokens': c.tokens } : {} ),
		...( c.values ? { enum: c.values } : {} ),
	};
}

export { VALUE_TREE };
