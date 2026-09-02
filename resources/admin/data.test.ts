import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeActivity, normalizeAnimations, normalizeDiagnostics, normalizeDashboardSummary, countOverrides, timeAgo, parseRgb, compositeOver, contrastRatio, contrastGrade, splitTopLevel, parseClamp, topLevelTokens, parseShadow, formatShadow, parseGradient, formatGradient, isGradientPosition, isColorValue, parseTransition, formatTransition, describeTransform, parseRing, formatRing, describeRing, parseBorder, formatBorder, aspectRatioOf, countRecordChanges, countNestedChanges } from './data';
import type { ShadowParts, GradientParts, TransitionParts, RingParts, BorderParts } from './data';

describe( 'normalizeActivity', () => {
	it( 'keeps entries that carry a parseable timestamp', () => {
		const entries = normalizeActivity( [
			{ id: 'settings', label: 'Plugin settings saved', detail: 'Blicks → Settings', time: '2026-08-01T09:00:00+00:00' },
		] );

		expect( entries ).toEqual( [ {
			id: 'settings',
			label: 'Plugin settings saved',
			detail: 'Blicks → Settings',
			time: '2026-08-01T09:00:00+00:00',
		} ] );
	} );

	// The whole point of the feed is that every time on it was actually measured, so an
	// undated event is dropped rather than defaulted to "just now".
	it( 'drops entries with a missing or unparseable time', () => {
		expect( normalizeActivity( [
			{ id: 'a', label: 'No time', detail: '' },
			{ id: 'b', label: 'Bad time', detail: '', time: 'not-a-date' },
			{ id: 'c', label: 'Empty time', detail: '', time: '' },
		] ) ).toEqual( [] );
	} );

	it( 'ignores non-array and non-object payloads', () => {
		expect( normalizeActivity( undefined ) ).toEqual( [] );
		expect( normalizeActivity( 'nope' ) ).toEqual( [] );
		expect( normalizeActivity( [ null, 7 ] ) ).toEqual( [] );
	} );

	it( 'falls back to the timestamp as the key when no id is supplied', () => {
		const [ entry ] = normalizeActivity( [ { time: '2026-08-01T09:00:00Z' } ] );

		expect( entry.id ).toBe( '2026-08-01T09:00:00Z' );
		expect( entry.label ).toBe( '' );
	} );
} );

describe( 'normalizeDashboardSummary', () => {
	it( 'carries activity alongside the counts', () => {
		const summary = normalizeDashboardSummary( {
			blocks: { total: 27, interactive: 5 },
			activity: [ { id: 'settings', label: 'Plugin settings saved', detail: 'Blicks → Settings', time: '2026-08-01T08:00:00Z' } ],
		} );

		expect( summary.blocks ).toEqual( { total: 27, interactive: 5 } );
		expect( summary.activity ).toHaveLength( 1 );
	} );

	it( 'defaults activity to empty when the endpoint omits it', () => {
		expect( normalizeDashboardSummary( { blocks: { total: 1 } } ).activity ).toEqual( [] );
	} );

	it( 'carries the usage count that drives the setup checklist', () => {
		expect( normalizeDashboardSummary( { blocks: {}, usage: { posts: 4 } } ).usage ).toEqual( { posts: 4 } );
	} );

	// An older endpoint, or one that failed, must read as "no Blicks content yet" rather than
	// leaving the checklist step undefined — the step is ticked only by a number above zero.
	it( 'falls back to zero usage when the endpoint omits it', () => {
		expect( normalizeDashboardSummary( { blocks: { total: 1 } } ).usage ).toEqual( { posts: 0 } );
	} );
} );

describe( 'countOverrides', () => {
	const empty = { tokens: {}, breakpoints: {}, typeRoles: {} };

	it( 'is zero when nothing has been moved off the theme', () => {
		expect( countOverrides( empty ) ).toBe( 0 );
	} );

	it( 'counts token, type-role and breakpoint overrides together', () => {
		expect( countOverrides( {
			tokens: { color: { primary: '#f00', ring: '#00f' } },
			typeRoles: { h1: { fontSize: '3rem' } },
			breakpoints: { md: 900 },
		} ) ).toBe( 4 );
	} );

	// A category present but empty is what a cleared override group leaves behind; it is not
	// a change, and counting it would tick the checklist step for doing nothing.
	it( 'ignores empty categories', () => {
		expect( countOverrides( { ...empty, tokens: { color: {}, spacing: {} } } ) ).toBe( 0 );
	} );
} );

describe( 'normalizeDiagnostics', () => {
	it( 'recomputes the summary from the checks it actually kept', () => {
		const result = normalizeDiagnostics( {
			ranAt: '2026-08-01T10:00:00Z',
			checks: [
				{ id: 'php', label: 'PHP version', detail: 'Running 8.3', status: 'pass' },
				{ id: 'build-assets', label: 'Build assets', detail: 'Missing editor.js', status: 'fail' },
				{ id: 'theme-json', label: 'theme.json', detail: 'Classic theme', status: 'warn' },
			],
			summary: { pass: 99, warn: 99, fail: 99 },
		} );

		expect( result?.summary ).toEqual( { pass: 1, warn: 1, fail: 1 } );
		expect( result?.ranAt ).toBe( '2026-08-01T10:00:00Z' );
	} );

	it( 'treats an unknown status as a pass rather than inventing a failure', () => {
		const result = normalizeDiagnostics( { checks: [ { id: 'x', label: 'X', detail: '', status: 'weird' } ] } );

		expect( result?.checks[ 0 ].status ).toBe( 'pass' );
	} );

	it( 'returns null for a non-object payload', () => {
		expect( normalizeDiagnostics( null ) ).toBeNull();
		expect( normalizeDiagnostics( 'nope' ) ).toBeNull();
	} );
} );

describe( 'timeAgo', () => {
	afterEach( () => {
		vi.useRealTimers();
	} );

	const at = ( now: string ): void => {
		vi.useFakeTimers();
		vi.setSystemTime( new Date( now ) );
	};

	it( 'reports sub-minute gaps as "just now"', () => {
		at( '2026-08-01T10:00:30Z' );
		expect( timeAgo( '2026-08-01T10:00:00Z' ) ).toBe( 'just now' );
	} );

	it( 'picks the largest unit that fits, singular and plural', () => {
		at( '2026-08-01T10:00:00Z' );
		expect( timeAgo( '2026-08-01T09:59:00Z' ) ).toBe( '1 minute ago' );
		expect( timeAgo( '2026-08-01T09:45:00Z' ) ).toBe( '15 minutes ago' );
		expect( timeAgo( '2026-08-01T08:00:00Z' ) ).toBe( '2 hours ago' );
		expect( timeAgo( '2026-07-29T10:00:00Z' ) ).toBe( '3 days ago' );
		expect( timeAgo( '2026-06-01T10:00:00Z' ) ).toBe( '2 months ago' );
	} );

	it( 'returns an empty string for an unparseable timestamp', () => {
		expect( timeAgo( 'not-a-date' ) ).toBe( '' );
	} );
} );

describe( 'normalizeAnimations', () => {
	const step = { offset: 0, declarations: { opacity: '0' } };

	it( 'accepts both a bare array and the endpoint envelope', () => {
		const animation = { slug: 'drift', label: 'Drift', defaults: {}, steps: [ step ] };

		expect( normalizeAnimations( [ animation ] ) ).toHaveLength( 1 );
		expect( normalizeAnimations( { animations: [ animation ], css: '', prefix: 'bl-anim-' } ) ).toHaveLength( 1 );
	} );

	it( 'sorts steps by offset regardless of stored order', () => {
		const [ animation ] = normalizeAnimations( [ {
			slug: 'drift',
			steps: [
				{ offset: 100, declarations: { opacity: '1' } },
				{ offset: 0, declarations: { opacity: '0' } },
				{ offset: 50, declarations: { opacity: '.5' } },
			],
		} ] );

		expect( animation.steps.map( s => s.offset ) ).toEqual( [ 0, 50, 100 ] );
	} );

	it( 'falls back to the slug when no label is stored', () => {
		expect( normalizeAnimations( [ { slug: 'drift', steps: [ step ] } ] )[ 0 ].label ).toBe( 'drift' );
	} );

	// A definition with nothing renderable would show as an empty row that animates nothing.
	it( 'drops entries with no slug or no usable step', () => {
		expect( normalizeAnimations( [ { steps: [ step ] } ] ) ).toEqual( [] );
		expect( normalizeAnimations( [ { slug: 'drift', steps: [] } ] ) ).toEqual( [] );
		expect( normalizeAnimations( [ { slug: 'drift', steps: [ { offset: 0, declarations: {} } ] } ] ) ).toEqual( [] );
	} );

	it( 'drops steps whose offset is out of range or not a number', () => {
		const [ animation ] = normalizeAnimations( [ {
			slug: 'drift',
			steps: [ { offset: -1, declarations: { opacity: '0' } }, { offset: 140, declarations: { opacity: '9' } }, { offset: 50, declarations: { opacity: '.5' } } ],
		} ] );

		expect( animation.steps ).toHaveLength( 1 );
		expect( animation.steps[ 0 ].offset ).toBe( 50 );
	} );

	it( 'ignores non-array and malformed payloads', () => {
		expect( normalizeAnimations( undefined ) ).toEqual( [] );
		expect( normalizeAnimations( 'nope' ) ).toEqual( [] );
		expect( normalizeAnimations( [ null, 7 ] ) ).toEqual( [] );
	} );
} );

describe( 'parseRgb', () => {
	it( 'reads the forms a computed style hands back', () => {
		expect( parseRgb( 'rgb(255, 0, 0)' ) ).toEqual( { r: 255, g: 0, b: 0, a: 1 } );
		expect( parseRgb( 'rgba(0, 0, 0, 0.5)' ) ).toEqual( { r: 0, g: 0, b: 0, a: 0.5 } );
		expect( parseRgb( 'rgb(0 128 255 / 25%)' ) ).toEqual( { r: 0, g: 128, b: 255, a: 0.25 } );
		expect( parseRgb( 'color(srgb 0 0.5 1 / 0.5)' ) ).toEqual( { r: 0, g: 127.5, b: 255, a: 0.5 } );
		expect( parseRgb( 'transparent' ) ).toEqual( { r: 0, g: 0, b: 0, a: 0 } );
	} );

	it( 'returns null for anything it cannot read, rather than a wrong colour', () => {
		expect( parseRgb( 'oklch(0.7 0.1 250)' ) ).toBeNull();
		expect( parseRgb( '#ff0000' ) ).toBeNull();
		expect( parseRgb( 'rgb(1, 2)' ) ).toBeNull();
		expect( parseRgb( '' ) ).toBeNull();
	} );
} );

describe( 'contrastRatio', () => {
	// The two anchors of the scale: identical colours are 1:1, black on white is 21:1.
	it( 'spans 1 to 21', () => {
		const white = { r: 255, g: 255, b: 255, a: 1 };
		const black = { r: 0, g: 0, b: 0, a: 1 };
		expect( contrastRatio( white, white ) ).toBeCloseTo( 1, 5 );
		expect( contrastRatio( black, white ) ).toBeCloseTo( 21, 5 );
	} );

	it( 'is symmetric — order of the pair cannot change the verdict', () => {
		const fg = { r: 113, g: 113, b: 122, a: 1 };
		const bg = { r: 244, g: 244, b: 245, a: 1 };
		expect( contrastRatio( fg, bg ) ).toBeCloseTo( contrastRatio( bg, fg ), 10 );
	} );

	it( 'counts a translucent colour by what it composites to', () => {
		const bg = { r: 255, g: 255, b: 255, a: 1 };
		const halfBlack = compositeOver( { r: 0, g: 0, b: 0, a: 0.5 }, bg );

		expect( halfBlack ).toEqual( { r: 127.5, g: 127.5, b: 127.5, a: 1 } );
		// Composited it is mid-grey on white — nothing like the 21:1 the raw colour would score.
		expect( contrastRatio( halfBlack, bg ) ).toBeLessThan( 4.5 );
	} );
} );

describe( 'contrastGrade', () => {
	it( 'names the strongest level the ratio clears', () => {
		expect( contrastGrade( 21 ) ).toBe( 'AAA' );
		expect( contrastGrade( 7 ) ).toBe( 'AAA' );
		expect( contrastGrade( 4.5 ) ).toBe( 'AA' );
		expect( contrastGrade( 3 ) ).toBe( 'AA Large' );
		expect( contrastGrade( 2.99 ) ).toBe( 'Fail' );
		expect( contrastGrade( 1 ) ).toBe( 'Fail' );
	} );
} );

describe( 'splitTopLevel', () => {
	it( 'splits on commas that are not inside a nested function', () => {
		expect( splitTopLevel( '1rem, 2vw, 3rem' ) ).toEqual( [ '1rem', '2vw', '3rem' ] );
		expect( splitTopLevel( '30px, calc(1rem + 2vw), min(5vw, 40px)' ) )
			.toEqual( [ '30px', 'calc(1rem + 2vw)', 'min(5vw, 40px)' ] );
	} );

	it( 'refuses to guess at unbalanced parens', () => {
		expect( splitTopLevel( '30px, calc(1rem' ) ).toEqual( [ '30px, calc(1rem' ] );
	} );
} );

describe( 'parseClamp', () => {
	it( 'returns the bounds a fluid token moves between', () => {
		expect( parseClamp( 'clamp(70px, 10vw, 140px)' ) ).toEqual( { min: '70px', max: '140px' } );
		expect( parseClamp( 'CLAMP(1rem, calc(1rem + 2vw), 3rem)' ) ).toEqual( { min: '1rem', max: '3rem' } );
	} );

	it( 'returns null for a fixed value or a malformed clamp', () => {
		expect( parseClamp( '24px' ) ).toBeNull();
		expect( parseClamp( 'clamp(1rem, 3rem)' ) ).toBeNull();
		expect( parseClamp( 'min(5vw, 40px)' ) ).toBeNull();
	} );
} );

describe( 'topLevelTokens', () => {
	it( 'keeps a function call together', () => {
		expect( topLevelTokens( '0 1px 2px rgb(0 0 0 / 0.08)' ) ).toEqual( [ '0', '1px', '2px', 'rgb(0 0 0 / 0.08)' ] );
		expect( topLevelTokens( '  inset   0 2px   red ' ) ).toEqual( [ 'inset', '0', '2px', 'red' ] );
	} );
} );

describe( 'parseShadow', () => {
	it( 'takes a layer apart', () => {
		expect( parseShadow( '0 4px 8px rgb(0 0 0 / 0.1)' ) ).toEqual( {
			inset: false, x: '0', y: '4px', blur: '8px', spread: '', color: 'rgb(0 0 0 / 0.1)',
		} );
		expect( parseShadow( 'inset 0 1px 2px 1px #00000022' ) ).toEqual( {
			inset: true, x: '0', y: '1px', blur: '2px', spread: '1px', color: '#00000022',
		} );
		expect( parseShadow( '0 2px' ) ).toEqual( { inset: false, x: '0', y: '2px', blur: '', spread: '', color: '' } );
	} );

	// Anything it cannot rebuild faithfully is refused, so the row falls back to text
	// rather than silently rewriting the author's value.
	it( 'refuses what it cannot round-trip', () => {
		expect( parseShadow( '0 1px 2px red, 0 4px 8px blue' ) ).toBeNull();
		expect( parseShadow( 'none' ) ).toBeNull();
		expect( parseShadow( '' ) ).toBeNull();
		expect( parseShadow( '0 1px 2px red blue' ) ).toBeNull();
		expect( parseShadow( '0 1px 2px 3px 4px red' ) ).toBeNull();
	} );

	it( 'round-trips through formatShadow', () => {
		for ( const value of [ '0 4px 8px rgb(0 0 0 / 0.1)', 'inset 0 1px 2px 1px #0003', '0 2px' ] ) {
			expect( formatShadow( parseShadow( value ) as ShadowParts ) ).toBe( value );
		}
	} );
} );

describe( 'formatShadow', () => {
	it( 'fills the blur slot when a spread would otherwise take its place', () => {
		expect( formatShadow( { inset: false, x: '0', y: '2px', blur: '', spread: '4px', color: 'red' } ) )
			.toBe( '0 2px 0 4px red' );
	} );

	it( 'defaults empty offsets to 0 rather than emitting an invalid shadow', () => {
		expect( formatShadow( { inset: false, x: '', y: '', blur: '6px', spread: '', color: '' } ) ).toBe( '0 0 6px' );
	} );
} );

describe( 'isColorValue', () => {
	it( 'accepts the CSS named colours, which a gradient stop is very likely to use', () => {
		for ( const name of [ 'red', 'rebeccapurple', 'white', 'transparent' ] ) {
			expect( isColorValue( name ) ).toBe( true );
		}
	} );

	it( 'still refuses a word that is not a colour', () => {
		expect( isColorValue( 'zzz' ) ).toBe( false );
		expect( isColorValue( 'notacolor' ) ).toBe( false );
	} );
} );

describe( 'parseGradient', () => {
	it( 'reads kind, geometry and stops', () => {
		expect( parseGradient( 'linear-gradient(135deg, #002bff, #5b7bff)' ) ).toEqual( {
			kind: 'linear', repeating: false, geometry: '135deg',
			stops: [ { color: '#002bff', pos: '', pos2: '' }, { color: '#5b7bff', pos: '', pos2: '' } ],
		} );
		expect( parseGradient( 'radial-gradient(circle at 50% 50%, red 0%, blue 100%)' ) ).toEqual( {
			kind: 'radial', repeating: false, geometry: 'circle at 50% 50%',
			stops: [ { color: 'red', pos: '0%', pos2: '' }, { color: 'blue', pos: '100%', pos2: '' } ],
		} );
		expect( parseGradient( 'repeating-conic-gradient(from 0deg at 50% 50%, #000 0deg, #fff 30deg)' ) ).toEqual( {
			kind: 'conic', repeating: true, geometry: 'from 0deg at 50% 50%',
			stops: [ { color: '#000', pos: '0deg', pos2: '' }, { color: '#fff', pos: '30deg', pos2: '' } ],
		} );
	} );

	it( 'handles a gradient with no geometry at all', () => {
		expect( parseGradient( 'linear-gradient(red, blue)' ) ).toEqual( {
			kind: 'linear', repeating: false, geometry: '',
			stops: [ { color: 'red', pos: '', pos2: '' }, { color: 'blue', pos: '', pos2: '' } ],
		} );
	} );

	it( 'keeps a function-valued colour in one piece', () => {
		expect( parseGradient( 'linear-gradient(90deg, rgb(0 0 0 / 0.5) 10%, var(--x))' )?.stops ).toEqual( [
			{ color: 'rgb(0 0 0 / 0.5)', pos: '10%', pos2: '' },
			{ color: 'var(--x)', pos: '', pos2: '' },
		] );
	} );

	// `orange 10% 30%` paints a hard band between the two positions.
	it( 'reads double-position stops', () => {
		expect( parseGradient( 'linear-gradient(red 0%, orange 10% 30%, yellow 50% 70%, green 90% 100%)' )?.stops ).toEqual( [
			{ color: 'red', pos: '0%', pos2: '' },
			{ color: 'orange', pos: '10%', pos2: '30%' },
			{ color: 'yellow', pos: '50%', pos2: '70%' },
			{ color: 'green', pos: '90%', pos2: '100%' },
		] );
	} );

	// A lone position between two colours is a hint: it moves the midpoint of the blend.
	it( 'reads a colour hint as a stop with no colour', () => {
		expect( parseGradient( 'linear-gradient(red, 20%, blue)' )?.stops ).toEqual( [
			{ color: 'red', pos: '', pos2: '' },
			{ color: '', pos: '20%' },
			{ color: 'blue', pos: '', pos2: '' },
		] );
	} );

	it( 'treats a unitless number as a colour, not a position — except zero', () => {
		expect( isGradientPosition( '30' ) ).toBe( false );
		expect( isGradientPosition( '0' ) ).toBe( true );
		expect( isGradientPosition( '30%' ) ).toBe( true );
		expect( isGradientPosition( '45deg' ) ).toBe( true );
		expect( isGradientPosition( 'abc' ) ).toBe( false );
	} );

	it( 'refuses what it cannot round-trip', () => {
		expect( parseGradient( '#ff0000' ) ).toBeNull();
		expect( parseGradient( 'linear-gradient(90deg, red)' ) ).toBeNull();
		expect( parseGradient( 'url(bg.png)' ) ).toBeNull();
		// A hint is not a colour, so this is still a one-colour gradient.
		expect( parseGradient( 'linear-gradient(red, 20%)' ) ).toBeNull();
		expect( parseGradient( 'linear-gradient(red 0% 10% 20%, blue)' ) ).toBeNull();
	} );

	it( 'round-trips through formatGradient', () => {
		for ( const value of [
			'linear-gradient(135deg, #002bff, #5b7bff)',
			'radial-gradient(circle at 50% 50%, red 0%, blue 100%)',
			'repeating-conic-gradient(from 0deg at 50% 50%, #000 0deg, #fff 30deg)',
			'linear-gradient(red, blue)',
			'linear-gradient(red 0%, orange 10% 30%, yellow 50% 70%, green 90% 100%)',
			'linear-gradient(red, 20%, blue)',
		] ) {
			expect( formatGradient( parseGradient( value ) as GradientParts ) ).toBe( value );
		}
	} );
} );

describe( 'parseTransition', () => {
	it( 'reads property, duration, timing and delay in any order', () => {
		expect( parseTransition( 'all 150ms ease' ) ).toEqual( { property: 'all', duration: '150ms', timing: 'ease', delay: '' } );
		expect( parseTransition( 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 50ms' ) ).toEqual( {
			property: 'opacity', duration: '0.2s', timing: 'cubic-bezier(0.4, 0, 0.2, 1)', delay: '50ms',
		} );
		expect( parseTransition( '200ms' ) ).toEqual( { property: '', duration: '200ms', timing: '', delay: '' } );
		expect( parseTransition( '--card-x 1s steps(4, end)' ) ).toEqual( {
			property: '--card-x', duration: '1s', timing: 'steps(4, end)', delay: '',
		} );
	} );

	it( 'refuses what the four fields cannot rebuild', () => {
		expect( parseTransition( 'opacity 150ms ease, transform 300ms ease' ) ).toBeNull();
		expect( parseTransition( 'all 1s 2s 3s' ) ).toBeNull();
		expect( parseTransition( 'opacity transform 1s' ) ).toBeNull();
		expect( parseTransition( 'none' ) ).toBeNull();
		expect( parseTransition( '' ) ).toBeNull();
	} );

	it( 'round-trips through formatTransition', () => {
		for ( const value of [ 'all 150ms ease', 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 50ms', '200ms', 'transform 1s linear' ] ) {
			expect( formatTransition( parseTransition( value ) as TransitionParts ) ).toBe( value );
		}
	} );

	it( 'writes an explicit zero duration when only a delay is set', () => {
		expect( formatTransition( { property: 'all', duration: '', timing: 'ease', delay: '100ms' } ) ).toBe( 'all 0s ease 100ms' );
	} );
} );

describe( 'describeTransform', () => {
	it( 'says what a computed matrix does', () => {
		expect( describeTransform( 'matrix(1, 0, 0, 1, 0, -2)' ) ).toBe( 'up 2px' );
		expect( describeTransform( 'matrix(1.05, 0, 0, 1.05, 0, 0)' ) ).toBe( 'scale 1.05' );
		expect( describeTransform( 'matrix(2, 0, 0, 1, 8, 0)' ) ).toBe( 'right 8px \u00b7 scale 2\u00d71' );
		expect( describeTransform( 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 6, 0, 1)' ) ).toBe( 'down 6px' );
		expect( describeTransform( 'none' ) ).toBe( '' );
	} );

	it( 'hands back anything it cannot read, rather than inventing a reading', () => {
		expect( describeTransform( 'perspective(400px)' ) ).toBe( 'perspective(400px)' );
	} );
} );

describe( 'parseRing', () => {
	it( 'reads a plain ring as thickness and colour', () => {
		expect( parseRing( '0 0 0 3px rgba(0, 43, 255, 0.35)' ) ).toEqual( {
			thickness: '3px', offset: '0', offsetColor: '', blur: '', color: 'rgba(0, 43, 255, 0.35)',
		} );
	} );

	it( 'reads the offset pair as a gap, and the ring as the difference of the two spreads', () => {
		expect( parseRing( '0 0 0 2px #ffffff, 0 0 0 5px #002bff' ) ).toEqual( {
			thickness: '3px', offset: '2px', offsetColor: '#ffffff', blur: '', color: '#002bff',
		} );
	} );

	it( 'keeps a glow\u2019s blur', () => {
		expect( parseRing( '0 0 6px 2px #002bff' ) ).toMatchObject( { thickness: '2px', blur: '6px' } );
	} );

	it( 'refuses anything that is not a ring', () => {
		expect( parseRing( 'inset 0 0 0 3px red' ) ).toBeNull();
		expect( parseRing( '0 2px 0 3px red' ) ).toBeNull();          // shifted: a shadow, not a ring
		expect( parseRing( '0 0 0 5px red, 0 0 0 2px blue' ) ).toBeNull(); // outer thinner than inner
		expect( parseRing( '0 0 0 1px a, 0 0 0 2px b, 0 0 0 3px c' ) ).toBeNull();
		expect( parseRing( 'none' ) ).toBeNull();
	} );

	it( 'round-trips through formatRing', () => {
		for ( const value of [
			'0 0 0 3px rgba(0, 43, 255, 0.35)',
			'0 0 0 2px #ffffff, 0 0 0 5px #002bff',
			'0 0 6px 2px #002bff',
		] ) {
			expect( formatRing( parseRing( value ) as RingParts ) ).toBe( value );
		}
	} );

	it( 'adds the offset back into the outer spread when writing a gap', () => {
		expect( formatRing( { thickness: '3px', offset: '2px', offsetColor: '#fff', blur: '', color: 'red' } ) )
			.toBe( '0 0 0 2px #fff, 0 0 0 5px red' );
	} );
} );

describe( 'describeRing', () => {
	it( 'says what the browser rendered', () => {
		expect( describeRing( 'rgba(0, 43, 255, 0.35) 0px 0px 0px 3px' ) ).toBe( '3px' );
		expect( describeRing( 'rgb(255, 255, 255) 0px 0px 0px 2px, rgb(0, 43, 255) 0px 0px 0px 5px' ) ).toBe( '2px gap \u00b7 3px' );
		expect( describeRing( 'none' ) ).toBe( '' );
	} );
} );

describe( 'parseBorder', () => {
	it( 'reads width, style and colour in any order', () => {
		expect( parseBorder( '1px solid #111827' ) ).toEqual( { width: '1px', style: 'solid', color: '#111827' } );
		expect( parseBorder( 'dashed 2px rgb(0 43 255 / 0.4)' ) ).toEqual( { width: '2px', style: 'dashed', color: 'rgb(0 43 255 / 0.4)' } );
		expect( parseBorder( 'dotted' ) ).toEqual( { width: '', style: 'dotted', color: '' } );
		// A `var()` is sorted by what our own tokens are called, since it could be either.
		expect( parseBorder( 'var(--blicks-border-width-hair) solid currentColor' ) )
			.toEqual( { width: 'var(--blicks-border-width-hair)', style: 'solid', color: 'currentColor' } );
		expect( parseBorder( 'var(--gap) solid red' ) ).toBeNull();
	} );

	it( 'refuses a shorthand with a token to spare', () => {
		expect( parseBorder( '1px solid red blue' ) ).toBeNull();
		expect( parseBorder( '1px 2px solid' ) ).toBeNull();
		expect( parseBorder( '' ) ).toBeNull();
	} );

	it( 'round-trips through formatBorder', () => {
		for ( const value of [ '1px solid #111827', '2px dashed #002bff', 'dotted' ] ) {
			expect( formatBorder( parseBorder( value ) as BorderParts ) ).toBe( value );
		}
	} );
} );

describe( 'aspectRatioOf', () => {
	it( 'reads every way a ratio is written', () => {
		expect( aspectRatioOf( '16 / 9' ) ).toBeCloseTo( 1.778, 3 );
		expect( aspectRatioOf( '16/9' ) ).toBeCloseTo( 1.778, 3 );
		expect( aspectRatioOf( '1 / 1' ) ).toBe( 1 );
		expect( aspectRatioOf( '1.5' ) ).toBe( 1.5 );
		expect( aspectRatioOf( '3 / 4' ) ).toBe( 0.75 );
	} );

	it( 'has no reading for a value with no single ratio', () => {
		expect( aspectRatioOf( 'var(--x)' ) ).toBeNull();
		expect( aspectRatioOf( 'auto' ) ).toBeNull();
		expect( aspectRatioOf( '16 / 0' ) ).toBeNull();
		expect( aspectRatioOf( '' ) ).toBeNull();
	} );
} );

describe( 'countRecordChanges', () => {
	it( 'counts only what differs from what is saved', () => {
		expect( countRecordChanges( { a: '1', b: '2' }, { a: '1', b: '2' } ) ).toBe( 0 );
		expect( countRecordChanges( { a: '9', b: '2' }, { a: '1', b: '2' } ) ).toBe( 1 );
		expect( countRecordChanges( { a: '1' }, { a: '1', b: '2' } ) ).toBe( 1 );   // cleared
		expect( countRecordChanges( { a: '1', c: '3' }, { a: '1' } ) ).toBe( 1 );   // added
	} );

	it( 'counts nested categories the same way', () => {
		const saved = { color: { primary: '#000' }, spacing: { md: '1rem' } };
		expect( countNestedChanges( saved, saved ) ).toBe( 0 );
		expect( countNestedChanges( { ...saved, spacing: { md: '2rem' } }, saved ) ).toBe( 1 );
		expect( countNestedChanges( { ...saved, radius: { sm: '2px' } }, saved ) ).toBe( 1 );
	} );
} );
