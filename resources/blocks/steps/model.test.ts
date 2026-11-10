import { describe, expect, it } from 'vitest';
import '@/framework/icons/bootstrap';
import { stepClasses, stepState, stepsClasses, stepsVars } from './model';

describe( 'Steps', () => {
	it( 'is a joined row of numbered circles that ticks done steps, by default', () => {
		expect( stepsClasses( {} ) ).toEqual( [ 'bl-steps--across', 'bl-steps--numbers', 'bl-steps--join', 'bl-steps--tick' ] );
	} );

	it( 'reads the current step into done, current and upcoming', () => {
		expect( [ 0, 1, 2, 3 ].map( ( i ) => stepState( i, 3 ) ) ).toEqual( [ 'done', 'done', 'cur', 'next' ] );
		expect( stepState( 1, 0 ) ).toBe( '' );
	} );

	it( 'keeps labels to a timeline running down, and outlines to plain numbers', () => {
		expect( stepsClasses( { layout: 'across', labels: true } ) ).not.toContain( 'bl-steps--labels' );
		expect( stepsClasses( { layout: 'down', labels: true } ) ).toContain( 'bl-steps--labels' );
		expect( stepsClasses( { markerShape: 'plain', outline: true } ) ).toContain( 'bl-steps--outline' );
		expect( stepsClasses( { markerShape: 'circle', outline: true } ) ).not.toContain( 'bl-steps--outline' );
	} );

	it( 'names an icon marker by its icon, as the List does', () => {
		expect( stepsClasses( { marker: 'icons', icon: 'bolt' } ) ).toContain( 'bl-li-ic-zap' );
		expect( stepClasses( { state: 'cur', icon: 'flag' } ) ).toEqual( [ 'bl-step--cur', 'bl-li-ic-flag' ] );
	} );

	it( 'drops what it does not know and writes only changed properties', () => {
		expect( stepsClasses( { layout: 'diagonal', marker: 'stars', join: false, tickDone: false } ) ).toEqual( [ 'bl-steps--across', 'bl-steps--numbers' ] );
		expect( stepsVars( { markerSize: 100 } ) ).toEqual( {} );
		expect( stepsVars( { markerColour: 'primary', markerSize: 200, lineColour: 'border' } ) ).toEqual( { '--bl-st-mc': 'var(--blicks-color-primary)', '--bl-st-ms': '2', '--bl-st-line': 'var(--blicks-color-border)' } );
	} );
} );
