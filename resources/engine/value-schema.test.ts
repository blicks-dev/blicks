import { describe, expect, it } from 'vitest';
import { buildElementStyle } from '@/framework/css/vars';
import { CONTROL_VALUES, RULES } from './schema.gen';
import { valueSchema } from './value-schema';

/** Every example a control's schema offers, built through the real engine, must produce CSS. */
const cases = RULES.flatMap( ( rule ) => {
	const schema = valueSchema( rule.attr ) as { examples?: unknown[]; enum?: string[] } | null;
	const examples = schema?.enum ? schema.enum.slice( 0, 2 ) : schema?.examples ?? [];
	return examples.map( ( example ) => [ rule.attr, example ] as const );
} );

describe( 'value schemas', () => {
	it( 'describe every control', () => {
		for ( const rule of RULES ) {
			expect( valueSchema( rule.attr ), rule.attr ).not.toBeNull();
			expect( CONTROL_VALUES[ rule.attr ].shape, rule.attr ).toBeTruthy();
		}
	} );

	it( 'give every control at least one example', () => {
		expect( RULES.filter( ( r ) => ! cases.some( ( [ id ] ) => id === r.attr ) ).map( ( r ) => r.attr ) ).toEqual( [] );
	} );

	it.each( cases )( '%s builds from %j', ( id, example ) => {
		// A part-only control renders on a pseudo-element; everything else on the block.
		const rule = RULES.find( ( r ) => r.attr === id )!;
		const slot = rule.partOnly ? 'before' : 'default';
		const out = buildElementStyle( { [ id ]: { [ slot ]: { base: example } } }, { uniqueId: 'abc123' } );
		const emitted = out.classes.length > 0 || Object.keys( out.vars ).length > 0 || ( out.scopedCss?.length ?? 0 ) > 0;
		expect( emitted ).toBe( true );
	} );
} );
