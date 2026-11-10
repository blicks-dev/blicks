import { describe, expect, it } from 'vitest';
import { includesControl } from '@/framework/inspector/control-allow';
import baseline from './baseline-controls.json';

const blocks = import.meta.glob< { name: string; supports: { blicks?: { controls?: string[] } } } >( './*/block.json', { eager: true, import: 'default' } );

const exceptions: Record< string, string[] > = baseline.except;

describe( 'every visible block allows the baseline controls', () => {
	const visible = Object.values( blocks ).filter( ( b ) => ! ( baseline.exempt as string[] ).includes( b.name ) );

	it( 'finds the blocks', () => {
		expect( visible.length ).toBeGreaterThan( 8 );
	} );

	it.each( visible.map( ( b ) => [ b.name, b.supports.blicks?.controls ?? [] ] as const ) )( '%s', ( name, controls ) => {
		// A glob covers its ids (`layout.*` covers `layout.maxWidth`), as on the server.
		const missing = baseline.controls
			.filter( ( id ) => ! ( exceptions[ name ] ?? [] ).includes( id ) )
			.filter( ( id ) => ! ( id.endsWith( '.*' ) ? controls.includes( id ) : includesControl( controls, id ) ) );
		expect( missing ).toEqual( [] );
	} );

	// An exception is a value the block already sets through its own setting; allowing it too
	// would give one value two sources.
	it.each( Object.entries( exceptions ) )( '%s leaves out what its own settings cover', ( name, ids ) => {
		const controls = Object.values( blocks ).find( ( b ) => b.name === name )?.supports.blicks?.controls ?? [];
		expect( ids.filter( ( id ) => includesControl( controls, id ) ) ).toEqual( [] );
	} );
} );
