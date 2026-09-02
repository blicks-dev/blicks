import { describe, expect, it } from 'vitest';
import './bootstrap';
import {
	getAllAcceptedNames,
	getIcon,
	getIconName,
	getIconNames,
	listCategories,
	listIcons,
	registerIconAlias,
	registerIconLibrary,
	resolveIconName,
	searchIcons,
} from './index';

describe( 'icon registry', () => {
	it( 'ships the curated Lucide library with hundreds of icons', () => {
		const names = getIconNames();
		expect( names.length ).toBeGreaterThan( 100 );
		expect( names ).toContain( 'star' );
		expect( names ).toContain( 'arrow-right' );
		expect( names ).toContain( 'check' );
	} );

	it( 'returns IconDef for known names and null for unknown ones', () => {
		const star = getIcon( 'star' );
		expect( star ).not.toBeNull();
		expect( star?.label ).toMatch( /star/i );
		expect( star?.svg ).toMatch( /<path|<polygon|<circle/ );

		expect( getIcon( 'definitely-not-real' ) ).toBeNull();
		expect( getIcon( '' ) ).toBeNull();
		expect( getIcon( undefined ) ).toBeNull();
	} );

	it( 'falls back to "star" via getIconName when the name is unknown', () => {
		expect( getIconName( 'definitely-not-real' ) ).toBe( 'star' );
		expect( getIconName( '' ) ).toBe( 'star' );
	} );

	it( 'honours legacy back-compat aliases', () => {
		expect( resolveIconName( 'arrowRight' ) ).toBe( 'arrow-right' );
		expect( resolveIconName( 'bolt' ) ).toBe( 'zap' );
		expect( getIcon( 'arrowRight' ) ).not.toBeNull();
		expect( getIcon( 'bolt' ) ).not.toBeNull();
		expect( getAllAcceptedNames() ).toContain( 'arrowRight' );
	} );

	it( 'tokenises searchIcons across name + label + keywords', () => {
		const hits = searchIcons( 'arrow right' );
		expect( hits.length ).toBeGreaterThan( 0 );
		expect( hits.some( ( h ) => h.name === 'arrow-right' ) ).toBe( true );

		const star = searchIcons( 'star' );
		expect( star.some( ( h ) => h.name === 'star' ) ).toBe( true );

		expect( searchIcons( 'zzz-no-match-zzz' ) ).toEqual( [] );
	} );

	it( 'exposes category list and groups icons sensibly', () => {
		const cats = listCategories();
		expect( cats ).toContain( 'arrows' );
		expect( cats ).toContain( 'status' );

		const all = listIcons();
		const star = all.find( ( h ) => h.name === 'star' );
		expect( star?.def.category ).toBeTruthy();
	} );

	it( 'lets a higher-priority library override a name', () => {
		registerIconLibrary( {
			id: 'test-pack',
			label: 'Test pack',
			priority: 100,
			icons: { star: { label: 'Overridden star', svg: '<circle cx="12" cy="12" r="3"/>' } },
		} );
		expect( getIcon( 'star' )?.label ).toBe( 'Overridden star' );
	} );

	it( 'lets external code register additional aliases', () => {
		registerIconAlias( 'sparkle', 'sparkles' );
		expect( resolveIconName( 'sparkle' ) ).toBe( 'sparkles' );
		expect( getIcon( 'sparkle' )?.label ).toMatch( /sparkles/i );
	} );
} );
