import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { automatic, cleanRules, cleanTriggers, triggerDefaults } from './settings';

const cases = JSON.parse( readFileSync( resolve( __dirname, '../tests/settings-cases.json' ), 'utf8' ) ) as Record< 'triggers' | 'rules', { name: string; in: unknown; out: unknown }[] >;

describe( 'triggers, cleaned as src/Settings.php cleans them', () => {
	it.each( cases.triggers.map( ( c ) => [ c.name, c ] as const ) )( '%s', ( _name, c ) => {
		expect( cleanTriggers( c.in ) ).toEqual( c.out );
	} );
} );

describe( 'rules, cleaned as src/Settings.php cleans them', () => {
	it.each( cases.rules.map( ( c ) => [ c.name, c ] as const ) )( '%s', ( _name, c ) => {
		expect( cleanRules( c.in ) ).toEqual( c.out );
	} );
} );

describe( 'automatic', () => {
	it( 'is off until a trigger is switched on', () => {
		expect( automatic( triggerDefaults() ) ).toBe( false );
		expect( automatic( cleanTriggers( { exit: { on: true } } ) ) ).toBe( true );
	} );
} );
