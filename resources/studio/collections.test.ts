import { describe, it, expect } from 'vitest';
import { BUILTIN_PATTERNS } from './builtins';
import {
	COLLECTIONS,
	allIndustries,
	collectionById,
	pad,
	paletteColours,
	round,
	swatchOf,
	values,
	type Collection,
} from './collections';
import { collectionsOf, kindsOf } from './library';
import type { BlockNode } from './mount';

/**
 * This file is the collection promise, as assertions.
 *
 * The library's whole claim is that two patterns taken from one set will look like one page. That
 * claim is only worth making if it cannot quietly stop being true — a hand-written twenty-first
 * built-in reaching for a colour that "looked right" is precisely how a set becomes a label. So
 * the rules are checked rather than documented: every colour a built-in writes comes from its own
 * collection's palette, every size from its own type scale, every corner from its own radius.
 */

/** Every value any control in a tree writes, flattened. */
function writtenValues( blocks: BlockNode[] ): unknown[] {
	const found: unknown[] = [];

	const walk = ( nodes: BlockNode[] ): void => {
		for ( const node of nodes ) {
			const tree = ( node.attributes as { blicks?: Record< string, unknown > } | undefined )
				?.blicks;

			for ( const byState of Object.values( tree ?? {} ) ) {
				for ( const byBreakpoint of Object.values(
					( byState ?? {} ) as Record< string, unknown >
				) ) {
					found.push( byBreakpoint );
				}
			}

			walk( node.innerBlocks ?? [] );
		}
	};

	walk( blocks );

	return found;
}

/** Every value a named control writes, flattened across a whole tree. */
function valuesOf( blocks: BlockNode[], controlId: string ): unknown[] {
	const found: unknown[] = [];

	const walk = ( nodes: BlockNode[] ): void => {
		for ( const node of nodes ) {
			const tree = (
				node.attributes as
					| { blicks?: Record< string, Record< string, Record< string, unknown > > > }
					| undefined
			 )?.blicks;
			const slot = tree?.[ controlId ];

			for ( const byState of Object.values( slot ?? {} ) ) {
				found.push( ...Object.values( byState ?? {} ) );
			}

			walk( node.innerBlocks ?? [] );
		}
	};

	walk( blocks );

	return found;
}

const patternsIn = ( collection: Collection ) =>
	BUILTIN_PATTERNS.filter( ( entry ) => entry.collection === collection.id );

describe( 'the shipped collections', () => {
	it( 'gives every set a unique id', () => {
		const ids = COLLECTIONS.map( ( c ) => c.id );

		expect( new Set( ids ).size ).toBe( ids.length );
	} );

	it( 'gives every set at least one industry', () => {
		for ( const collection of COLLECTIONS ) {
			expect( collection.industries.length, collection.name ).toBeGreaterThan( 0 );
		}
	} );

	/**
	 * The industry list the rail offers is derived from the table, so a set cannot arrive carrying
	 * an industry the filter does not show — the failure that would leave it unreachable by the one
	 * axis it was tagged for.
	 */
	it( 'offers every industry any set claims', () => {
		const offered = allIndustries();

		for ( const collection of COLLECTIONS ) {
			for ( const industry of collection.industries ) {
				expect( offered ).toContain( industry );
			}
		}
	} );

	it( 'shows three colours in the swatch, from its own palette', () => {
		for ( const collection of COLLECTIONS ) {
			expect( swatchOf( collection ) ).toHaveLength( 3 );

			for ( const hex of swatchOf( collection ) ) {
				expect( paletteColours( collection ) ).toContain( hex );
			}
		}
	} );

	it( 'finds a set by id and nothing by a name it does not know', () => {
		expect( collectionById( 'funky' )?.name ).toBe( 'Funky' );
		expect( collectionById( 'nope' ) ).toBeUndefined();
		expect( collectionById( undefined ) ).toBeUndefined();
	} );
} );

describe( 'the shipped patterns', () => {
	it( 'files every built-in under a set that exists', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			expect( collectionById( entry.collection ), entry.id ).toBeDefined();
		}
	} );

	it( 'gives every built-in a unique id', () => {
		const ids = BUILTIN_PATTERNS.map( ( e ) => e.id );

		expect( new Set( ids ).size ).toBe( ids.length );
	} );

	it( 'fills every set', () => {
		expect( collectionsOf( BUILTIN_PATTERNS ) ).toHaveLength( COLLECTIONS.length );
	} );

	/**
	 * A set missing a kind the others have reads as unfinished, and nobody would notice in a file
	 * of twenty hand-written entries until they went looking for a closing call that was not there.
	 */
	it( 'gives every set the same kinds', () => {
		const expected = kindsOf( patternsIn( COLLECTIONS[ 0 ]! ) ).map( ( k ) => k.kind ).sort();

		for ( const collection of COLLECTIONS ) {
			const kinds = kindsOf( patternsIn( collection ) ).map( ( k ) => k.kind ).sort();

			expect( kinds, collection.name ).toEqual( expected );
		}
	} );

	it( 'builds a real tree for every built-in', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			expect( entry.blocks?.length, entry.id ).toBeGreaterThan( 0 );
		}
	} );

	/**
	 * **The rule the whole library rests on.** A built-in may use its own collection's colours and
	 * no others. Break it and the set is a label: two patterns from one collection stop matching,
	 * which is the exact failure a collection exists to prevent.
	 */
	/*
	 * Colours are TOKENS, not the set's palette: the design language and the site's palette fill
	 * them in, which is what lets the library redraw one pattern in every language. A literal here
	 * would be a pattern that ignores the site it lands on.
	 */
	it( 'paints every pattern with colour tokens only', () => {
		const allowed = [ 'background', 'foreground', 'card', 'card-foreground', 'primary', 'primary-foreground' ];
		for ( const collection of COLLECTIONS ) {
			for ( const entry of patternsIn( collection ) ) {
				for ( const control of [ 'colors.background', 'colors.text' ] ) {
					for ( const value of valuesOf( entry.blocks ?? [], control ) ) {
						expect( allowed, `${ entry.id } ${ control }` ).toContain( value );
					}
				}
			}
		}
	} );

	/** Edges too: a literal edge colour would survive a language that recolours every other one. */
	it( 'draws every edge with a colour token', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			for ( const sides of valuesOf( entry.blocks ?? [], 'border.color' ) ) {
				for ( const value of Object.values( sides as Record< string, string > ) ) {
					expect( [ 'border', 'primary' ], entry.id ).toContain( value );
				}
			}
		}
	} );

	/**
	 * A panel is a Box card or panel, never a plain stack with a fill. The kind is what carries the
	 * language's surface — sheen, blur, frosted or pastel fill, recoloured edge — so a panel drawn
	 * any other way would show Glassmorphism's colours and none of its glass.
	 */
	it( 'draws every panel as a Box card or panel', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			const walk = ( nodes: BlockNode[], inSection: boolean ): void => {
				for ( const node of nodes ) {
					const fill = valuesOf( [ { ...node, innerBlocks: [] } ], 'colors.background' )[ 0 ];

					if ( inSection && fill !== undefined ) {
						expect( node.name, entry.id ).toBe( 'blicks/box' );
						expect( [ 'card', 'panel' ], entry.id ).toContain(
							( node.attributes as { kind?: string } ).kind
						);
					}

					walk( node.innerBlocks ?? [], true );
				}
			};

			walk( entry.blocks ?? [], false );
		}
	} );

	/**
	 * Every ground paints the `backdrop` token. It is the page's own colour unless the language
	 * needs something behind its surfaces, which is how glass gets a backdrop without a pattern
	 * knowing which language it is in.
	 */
	it( 'lays every ground over the backdrop token', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			const [ section ] = entry.blocks ?? [];

			expect( valuesOf( [ { ...section!, innerBlocks: [] } ], 'background.layers' ), entry.id ).toEqual( [
				[ { type: 'gradient', role: 'fill', value: 'backdrop' } ],
			] );
		}
	} );

	/** Same rule for type: a size that is not on the set's scale is a size nobody chose. */
	it( 'sets every size from its own set’s scale', () => {
		for ( const collection of COLLECTIONS ) {
			const allowed = [ collection.type.display, collection.type.heading, collection.type.body ];

			for ( const entry of patternsIn( collection ) ) {
				for ( const value of valuesOf( entry.blocks ?? [], 'typography.fontSize' ) ) {
					expect( allowed, entry.id ).toContain( value );
				}
			}
		}
	} );

	/** And for corners: radius tokens, so Neo-brutalism squares them and Clay rounds them. */
	it( 'rounds every corner with a radius token', () => {
		for ( const collection of COLLECTIONS ) {
			const allowed = [ round( 'lg' ), round( 'xl' ) ];

			for ( const entry of patternsIn( collection ) ) {
				for ( const value of valuesOf( entry.blocks ?? [], 'border.radius' ) ) {
					expect( allowed, entry.id ).toContainEqual( value );
				}
			}
		}
	} );

	/**
	 * One accent panel per pattern at most. A set with the accent on three things at once has no
	 * focal point, and the card miniature — which paints its lead bar in the accent — would be
	 * telling the truth about a composition that had stopped having one.
	 */
	it( 'keeps one focal point per pattern', () => {
		for ( const collection of COLLECTIONS ) {
			for ( const entry of patternsIn( collection ) ) {
				const onAccent = valuesOf( entry.blocks ?? [], 'colors.background' ).filter(
					( value ) => value === 'primary'
				);

				// The panel and the button inside it both carry the accent; more than that is a
				// composition with two focal points.
				expect( onAccent.length, entry.id ).toBeLessThanOrEqual( 2 );
			}
		}
	} );

	/**
	 * Collections are a look, not a responsive design. Everything writes to `default`/`base`, and a
	 * stray hover or tablet value would be a built-in quietly carrying behaviour nobody asked a
	 * pattern to have.
	 */
	it( 'writes only to the default state at the base breakpoint', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			const walk = ( nodes: BlockNode[] ): void => {
				for ( const node of nodes ) {
					const tree = (
						node.attributes as { blicks?: Record< string, unknown > } | undefined
					 )?.blicks;

					for ( const byState of Object.values( tree ?? {} ) as Record< string, unknown >[] ) {
						expect( Object.keys( byState ), entry.id ).toEqual( [ 'default' ] );
						expect(
							Object.keys( byState.default as Record< string, unknown > ),
							entry.id
						).toEqual( [ 'base' ] );
					}

					walk( node.innerBlocks ?? [] );
				}
			};

			walk( entry.blocks ?? [] );
		}
	} );

	it( 'writes something on every pattern', () => {
		for ( const entry of BUILTIN_PATTERNS ) {
			expect( writtenValues( entry.blocks ?? [] ).length, entry.id ).toBeGreaterThan( 0 );
		}
	} );

	/**
	 * Every block a built-in uses ships with the FREE plugin, so a built-in can never be the thing
	 * that needs a plugin the site does not have.
	 */
	it( 'uses only blocks the free plugin ships', () => {
		const free = new Set( [
			'blicks/section',
			'blicks/box',
			'blicks/heading',
			'blicks/text',
			'blicks/buttons',
			'blicks/button',
			'blicks/image',
			'blicks/icon',
		] );

		for ( const entry of BUILTIN_PATTERNS ) {
			const walk = ( nodes: BlockNode[] ): void => {
				for ( const node of nodes ) {
					expect( free, `${ entry.id } uses ${ node.name }` ).toContain( node.name );
					walk( node.innerBlocks ?? [] );
				}
			};

			walk( entry.blocks ?? [] );
		}
	} );
} );

describe( 'the value helpers', () => {
	it( 'nests a value where the engine reads it', () => {
		expect( values( { 'colors.text': '#fff' } ) ).toEqual( {
			'colors.text': { default: { base: '#fff' } },
		} );
	} );

	/** An unset value must not become an empty branch the engine then has to ignore. */
	it( 'drops a value that is not set', () => {
		expect( values( { 'colors.text': '', 'colors.background': undefined } ) ).toEqual( {} );
	} );

	it( 'spells sides and corners the way the engine reads them', () => {
		expect( pad( '8px' ) ).toEqual( { top: '8px', right: '8px', bottom: '8px', left: '8px' } );
		expect( round( '8px' ) ).toEqual( {
			topLeft: '8px',
			topRight: '8px',
			bottomRight: '8px',
			bottomLeft: '8px',
		} );
	} );
} );
