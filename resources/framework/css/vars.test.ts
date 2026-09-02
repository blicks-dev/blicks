import { describe, it, expect, afterEach } from 'vitest';
import { buildElementStyle, cssValueForCategory, registerCssValueBuilder, STYLE_MAP } from './vars';

describe( 'buildElementStyle', () => {
	it( 'returns nothing for an empty tree', () => {
		expect( buildElementStyle( undefined ) ).toEqual( { classes: [], vars: {} } );
		expect( buildElementStyle( {} ) ).toEqual( { classes: [], vars: {} } );
	} );

	it( 'emits the root consumer class + base vars for a default/base slot', () => {
		const { classes, vars } = buildElementStyle( {
			'spacing.padding': { default: { base: { top: '16', right: '24px', bottom: '16', left: '24px' } } },
		} );
		expect( classes ).toEqual( [ 'bl-pad' ] );
		// bare numbers gain px; explicit units pass through; matches .bl-pad{padding:var(--bl-pt)…}
		expect( vars ).toEqual( {
			'--bl-pt': '16px',
			'--bl-pr': '24px',
			'--bl-pb': '16px',
			'--bl-pl': '24px',
		} );
	} );

	it( 'adds a marker class + suffixed vars per state and breakpoint override', () => {
		const { classes, vars } = buildElementStyle( {
			'spacing.padding': {
				default: { base: { top: '10px' }, tablet: { top: '8px' } },
				hover: { base: { top: '20px' } },
			},
		} );
		// marker classes gate the runtime rules (.bl-pad--tab, .bl-pad--hov)
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-pad', 'bl-pad--tab', 'bl-pad--hov' ] ) );
		// blank sides → unitless 0 (slot is authoritative for all four sides → leak-safe)
		expect( vars[ '--bl-pt' ] ).toBe( '10px' );
		expect( vars[ '--bl-pr' ] ).toBe( '0' );
		expect( vars[ '--bl-pt-tab' ] ).toBe( '8px' );
		expect( vars[ '--bl-pt-hov' ] ).toBe( '20px' );
	} );

	it( 'emits an enum library class (bl-type--{role}) with no var', () => {
		const { classes, vars } = buildElementStyle( {
			'typography.role': { default: { base: 'lead' } },
		} );
		expect( classes ).toEqual( [ 'bl-type--lead' ] );
		expect( vars ).toEqual( {} );
	} );

	it( 'reads the enum value from the first set slot when default/base is empty', () => {
		const { classes } = buildElementStyle( {
			'typography.role': { default: { base: '' }, hover: { base: 'h1' } },
		} );
		expect( classes ).toEqual( [ 'bl-type--h1' ] );
	} );

	it( 'sanitises an enum slug and drops an empty one', () => {
		expect(
			buildElementStyle( { 'typography.role': { default: { base: 'h1; drop{}' } } } ).classes
		).toEqual( [ 'bl-type--h1drop' ] );
		expect(
			buildElementStyle( { 'typography.role': { default: { base: '' } } } ).classes
		).toEqual( [] );
	} );

	it( 'maps both spacing controls to their own class + var letter', () => {
		const { classes, vars } = buildElementStyle( {
			'spacing.padding': { default: { base: { top: '4px' } } },
			'spacing.margin': { default: { base: { top: '8px' } } },
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-pad', 'bl-mar' ] ) );
		expect( vars[ '--bl-pt' ] ).toBe( '4px' );
		expect( vars[ '--bl-mt' ] ).toBe( '8px' );
	} );

	it( 'ignores hover-tablet combos correctly (key order = state-bp)', () => {
		const { classes, vars } = buildElementStyle( {
			'spacing.margin': { hover: { tablet: { top: '2px', right: '2px', bottom: '2px', left: '2px' } } },
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-mar', 'bl-mar--hov-tab' ] ) );
		expect( vars[ '--bl-mt-hov-tab' ] ).toBe( '2px' );
	} );

	it( 'emits layout consumer class + var for a default/base slot', () => {
		const { classes, vars } = buildElementStyle( {
			'layout.display': { default: { base: 'flex' } },
			'layout.width': { default: { base: '100%' } },
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-d', 'bl-w' ] ) );
		expect( vars[ '--bl-d' ] ).toBe( 'flex' );
		expect( vars[ '--bl-w' ] ).toBe( '100%' );
	} );

	it( 'adds layout marker classes + suffixed vars per state/breakpoint', () => {
		const { classes, vars } = buildElementStyle( {
			'layout.display': {
				default: { base: 'flex', tablet: 'block' },
				hover: { base: 'grid' },
			},
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-d', 'bl-d--tab', 'bl-d--hov' ] ) );
		expect( vars[ '--bl-d' ] ).toBe( 'flex' );
		expect( vars[ '--bl-d-tab' ] ).toBe( 'block' );
		expect( vars[ '--bl-d-hov' ] ).toBe( 'grid' );
	} );

	it( 'skips empty layout values', () => {
		const { classes, vars } = buildElementStyle( {
			'layout.display': { default: { base: '' } },
			'layout.height': { default: { base: '50px' } },
		} );
		expect( classes ).toEqual( [ 'bl-h' ] );
		expect( vars[ '--bl-h' ] ).toBe( '50px' );
		expect( vars[ '--bl-d' ] ).toBeUndefined();
	} );

	it( 'resolves spacing and radius tokens to CSS variables', () => {
		const { classes, vars } = buildElementStyle( {
			'spacing.padding': { default: { base: { top: 'md' } } },
			'border.radius': { default: { base: { topLeft: 'lg', topRight: '4px' } } },
		} );
		expect( classes ).toEqual( [ 'bl-pad', 'bl-br' ] );
		expect( vars[ '--bl-pt' ] ).toBe( 'var(--blicks-spacing-md)' );
		expect( vars[ '--bl-brtl' ] ).toBe( 'var(--blicks-radius-lg)' );
		expect( vars[ '--bl-brtr' ] ).toBe( '4px' );
	} );

	it( 'resolves borders (width, style, color, radius)', () => {
		// style/color here are bare strings — the pre-per-side storage shape — so this doubles as the
		// back-compat guard: a string must spread to all four sides.
		const { classes, vars } = buildElementStyle( {
			'border.width': { default: { base: { top: '1', right: '2px', bottom: '0', left: '1em' } } },
			'border.style': { default: { base: 'dashed' } },
			'border.color': { default: { base: 'primary' } },
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-bw', 'bl-bs', 'bl-bc' ] ) );
		expect( vars ).toEqual( {
			'--bl-bwt': '1px',
			'--bl-bwr': '2px',
			'--bl-bwb': '0',
			'--bl-bwl': '1em',
			'--bl-bst': 'dashed',
			'--bl-bsr': 'dashed',
			'--bl-bsb': 'dashed',
			'--bl-bsl': 'dashed',
			'--bl-bct': 'var(--blicks-color-primary)',
			'--bl-bcr': 'var(--blicks-color-primary)',
			'--bl-bcb': 'var(--blicks-color-primary)',
			'--bl-bcl': 'var(--blicks-color-primary)',
		} );
	} );

	it( 'emits per-side border style/color, defaulting the sides left unset', () => {
		const { vars } = buildElementStyle( {
			'border.style': { default: { base: { top: 'solid', bottom: 'dashed' } } },
			'border.color': { default: { base: { top: 'primary', bottom: '#ccc' } } },
		} );
		expect( vars[ '--bl-bst' ] ).toBe( 'solid' );
		expect( vars[ '--bl-bsb' ] ).toBe( 'dashed' );
		// An unset side must NOT become `0` — that invalidates the whole border-style shorthand.
		expect( vars[ '--bl-bsr' ] ).toBe( 'none' );
		expect( vars[ '--bl-bsl' ] ).toBe( 'none' );
		expect( vars[ '--bl-bct' ] ).toBe( 'var(--blicks-color-primary)' );
		expect( vars[ '--bl-bcb' ] ).toBe( '#ccc' );
		expect( vars[ '--bl-bcr' ] ).toBe( 'currentcolor' );
	} );

	it( 'resolves border.width tokens against the dedicated borderWidth scale', () => {
		const { vars } = buildElementStyle( {
			'border.width': { default: { base: { top: 'hair', right: 'hair', bottom: 'hair', left: 'hair' } } },
		} );
		expect( vars[ '--bl-bwt' ] ).toBe( 'var(--blicks-borderWidth-hair)' );
	} );

	it( 'falls back to the legacy spacing scale for a pre-migration border.width slug', () => {
		// 'md' isn't a borderWidth slug — pre-migration saved content used the spacing scale, so
		// it must still resolve via the fallback category rather than pass through as a literal.
		const { vars } = buildElementStyle( {
			'border.width': { default: { base: { top: 'md', right: 'md', bottom: 'md', left: 'md' } } },
		} );
		expect( vars[ '--bl-bwt' ] ).toBe( 'var(--blicks-spacing-md)' );
	} );

	it( 'resolves position (type, inset, zIndex)', () => {
		const { classes, vars } = buildElementStyle( {
			'position.type': { default: { base: 'absolute' } },
			'position.inset': { default: { base: { top: '10px', right: 'auto', bottom: '2rem', left: '0' } } },
			'position.zIndex': { default: { base: '999' } },
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-pos', 'bl-inset', 'bl-zi' ] ) );
		expect( vars ).toEqual( {
			'--bl-pos': 'absolute',
			'--bl-pos-t': '10px',
			'--bl-pos-r': 'auto',
			'--bl-pos-b': '2rem',
			'--bl-pos-l': '0',
			'--bl-zi': '999',
		} );
	} );

	it( 'resolves a zIndex token slug to its alias var', () => {
		const { vars } = buildElementStyle( {
			'position.zIndex': { default: { base: 'sticky' } },
		} );
		expect( vars[ '--bl-zi' ] ).toBe( 'var(--blicks-zIndex-sticky)' );
	} );

	it( 'resolves background image settings from media objects', () => {
		const { classes, vars } = buildElementStyle( {
			'background.image': {
				default: { base: { id: 12, url: 'https://example.com/hero.jpg' } },
				hover: { tablet: { url: 'https://example.com/hero-tablet.jpg' } },
			},
			'background.size': { default: { base: 'cover' } },
			'background.position': { default: { base: 'center center' } },
			'background.repeat': { default: { base: 'no-repeat' } },
			'background.attachment': { default: { base: 'fixed' } },
		} );

		expect( new Set( classes ) ).toEqual(
			new Set( [
				'bl-bg-img',
				'bl-bg-img--hov-tab',
				'bl-bg-size',
				'bl-bg-pos',
				'bl-bg-repeat',
				'bl-bg-attach',
			] )
		);
		expect( vars ).toEqual( {
			'--bl-bg-img': 'url("https://example.com/hero.jpg")',
			'--bl-bg-img-hov-tab': 'url("https://example.com/hero-tablet.jpg")',
			'--bl-bg-size': 'cover',
			'--bl-bg-pos': 'center center',
			'--bl-bg-repeat': 'no-repeat',
			'--bl-bg-attach': 'fixed',
		} );
	} );

	it( 'resolves background gradient settings', () => {
		const { classes, vars } = buildElementStyle( {
			'background.gradient': {
				default: {
					base: {
						type: 'linear',
						angle: '135deg',
						stops: [
							{ color: '#6366f1', position: '10%' },
							{ color: '#22c55e', position: '45%' },
							{ color: '#ec4899', position: '90%' },
						],
					},
				},
				active: {
					mobile: {
						type: 'radial',
						from: '#111827',
						fromPos: '0%',
						to: '#f9fafb',
						toPos: '100%',
					},
				},
			},
		} );

		expect( new Set( classes ) ).toEqual(
			new Set( [ 'bl-bg-grad', 'bl-bg-grad--act-mob' ] )
		);
		expect( vars ).toEqual( {
			'--bl-bg-grad': 'linear-gradient(135deg, #6366f1 10%, #22c55e 45%, #ec4899 90%)',
			'--bl-bg-grad-act-mob': 'radial-gradient(circle, #111827 0%, #f9fafb 100%)',
		} );
	} );

	it( 'resolves a gradient token slug to its alias var', () => {
		const { vars } = buildElementStyle( {
			'background.gradient': { default: { base: 'brand' } },
		} );
		expect( vars[ '--bl-bg-grad' ] ).toBe( 'var(--blicks-gradient-brand)' );
	} );

	it( 'passes an unknown gradient string through unchanged', () => {
		const { vars } = buildElementStyle( {
			'background.gradient': { default: { base: 'not-a-real-slug' } },
		} );
		expect( vars[ '--bl-bg-grad' ] ).toBe( 'not-a-real-slug' );
	} );

	it( 'resolves a shadow-token slug for boxShadow; unknown slugs are dropped', () => {
		const { vars } = buildElementStyle( {
			'effects.boxShadow': { default: { base: 'md', tablet: 'bogus' } },
		} );
		expect( vars[ '--bl-bsh' ] ).toBe( 'var(--blicks-shadow-md)' );
		expect( vars[ '--bl-bsh-tab' ] ).toBe( '' );
	} );

	it( 'resolves transition/transform/filter token slugs to alias vars', () => {
		const { vars } = buildElementStyle( {
			'effects.transition': { default: { base: 'base' } },
			'effects.transform': { default: { base: 'lift' } },
			'effects.filter': { default: { base: 'blur' } },
		} );
		expect( vars[ '--bl-tr' ] ).toBe( 'var(--blicks-transition-base)' );
		expect( vars[ '--bl-tfm' ] ).toBe( 'var(--blicks-transform-lift)' );
		expect( vars[ '--bl-flt' ] ).toBe( 'var(--blicks-filter-blur)' );
	} );

	it( 'passes literal motion values through unchanged', () => {
		const { vars } = buildElementStyle( {
			'effects.transition': { default: { base: 'all 200ms ease' } },
		} );
		expect( vars[ '--bl-tr' ] ).toBe( 'all 200ms ease' );
	} );

	it( 'resolves an opacity token slug to its alias var', () => {
		const { vars } = buildElementStyle( {
			'effects.opacity': { default: { base: 'muted' } },
		} );
		expect( vars[ '--bl-op' ] ).toBe( 'var(--blicks-opacity-muted)' );
	} );

	it( 'passes a literal opacity ratio through unchanged', () => {
		const { vars } = buildElementStyle( {
			'effects.opacity': { default: { base: '0.5' } },
		} );
		expect( vars[ '--bl-op' ] ).toBe( '0.5' );
	} );

	it( 'emits grid child placement classes and vars', () => {
		const { classes, vars } = buildElementStyle( {
			'gridChild.columnSpan': { default: { base: '2', tablet: '1' } },
			'gridChild.rowSpan': { default: { base: '3' } },
			'gridChild.alignSelf': { default: { base: 'center' } },
			'gridChild.justifySelf': { default: { mobile: 'stretch' } },
			'gridChild.order': { default: { base: '-1' } },
		} );

		expect( new Set( classes ) ).toEqual(
			new Set( [ 'bl-gcs', 'bl-gcs--tab', 'bl-grs', 'bl-gas', 'bl-gjs--mob', 'bl-gjs', 'bl-go' ] )
		);
		expect( vars[ '--bl-gcs' ] ).toBe( '2' );
		expect( vars[ '--bl-gcs-tab' ] ).toBe( '1' );
		expect( vars[ '--bl-grs' ] ).toBe( '3' );
		expect( vars[ '--bl-gas' ] ).toBe( 'center' );
		expect( vars[ '--bl-gjs-mob' ] ).toBe( 'stretch' );
		expect( vars[ '--bl-go' ] ).toBe( '-1' );
	} );

	it( 'emits flex child classes and vars, resolving basis against the width scale', () => {
		const { classes, vars } = buildElementStyle( {
			'flexChild.grow': { default: { base: '1' } },
			'flexChild.shrink': { default: { base: '0' } },
			'flexChild.basis': { default: { base: 'prose' } },
			'flexChild.alignSelf': { default: { base: 'center' } },
			'flexChild.order': { default: { base: '-1' } },
		} );

		expect( new Set( classes ) ).toEqual(
			new Set( [ 'bl-fg', 'bl-fsk', 'bl-fb', 'bl-fas', 'bl-fco' ] )
		);
		expect( vars[ '--bl-fg' ] ).toBe( '1' );
		expect( vars[ '--bl-fsk' ] ).toBe( '0' );
		expect( vars[ '--bl-fb' ] ).toBe( 'var(--blicks-width-prose)' );
		expect( vars[ '--bl-fas' ] ).toBe( 'center' );
		expect( vars[ '--bl-fco' ] ).toBe( '-1' );
	} );

	it( 'still serialises composite boxShadow objects', () => {
		const { vars } = buildElementStyle( {
			'effects.boxShadow': {
				default: { base: { inset: false, x: '0px', y: '4px', blur: '8px', spread: '0px', color: 'rgba(0,0,0,0.2)' } },
			},
		} );
		expect( vars[ '--bl-bsh' ] ).toBe( '0px 4px 8px 0px rgba(0,0,0,0.2)' );
	} );

	it( 'allows a builder category to be registered with one function', () => {
		registerCssValueBuilder( 'echoTest', ( value ) => `echo(${ String( value ) })` );

		expect( cssValueForCategory( 'echoTest', 'ok' ) ).toBe( 'echo(ok)' );
	} );

	// Wave B parity fixtures — each new prop must emit the same string in PHP (ElementStyleTest).
	it( 'Wave B: emits container-type and container-name vars', () => {
		const { classes, vars } = buildElementStyle( {
			'layout.containerType': { default: { base: 'inline-size' } },
			'layout.containerName': { default: { base: 'card' } },
		} );
		expect( new Set( classes ) ).toEqual( new Set( [ 'bl-ct', 'bl-cn' ] ) );
		expect( vars[ '--bl-ct' ] ).toBe( 'inline-size' );
		expect( vars[ '--bl-cn' ] ).toBe( 'card' );
	} );

	it( 'Wave B: emits grid-template-areas and grid-auto-flow vars', () => {
		const { classes, vars } = buildElementStyle( {
			'layout.gridAreas':    { default: { base: '"h h" "n m"' } },
			'layout.gridAutoFlow': { default: { base: 'row dense' } },
		} );
		expect( classes ).toContain( 'bl-areas' );
		expect( classes ).toContain( 'bl-gaf' );
		expect( vars[ '--bl-areas' ] ).toBe( '"h h" "n m"' );
		expect( vars[ '--bl-gaf' ] ).toBe( 'row dense' );
	} );

	it( 'Wave B: emits scroll-snap-type and overflow-x/y vars', () => {
		const { vars } = buildElementStyle( {
			'layout.scrollSnapType': { default: { base: 'x mandatory' } },
			'layout.overflowX':      { default: { base: 'scroll' } },
			'layout.overflowY':      { default: { base: 'hidden' } },
		} );
		expect( vars[ '--bl-sst' ] ).toBe( 'x mandatory' );
		expect( vars[ '--bl-ovx' ] ).toBe( 'scroll' );
		expect( vars[ '--bl-ovy' ] ).toBe( 'hidden' );
	} );

	it( 'Wave B: emits aspect-ratio and object-fit vars', () => {
		const { vars } = buildElementStyle( {
			'layout.aspectRatio': { default: { base: '16/9' } },
			'layout.objectFit':   { default: { base: 'cover' } },
		} );
		expect( vars[ '--bl-ar' ] ).toBe( '16/9' );
		expect( vars[ '--bl-of' ] ).toBe( 'cover' );
	} );

	it( 'resolves an aspect-ratio token slug to its alias var', () => {
		const { vars } = buildElementStyle( {
			'layout.aspectRatio': { default: { base: 'square' } },
		} );
		expect( vars[ '--bl-ar' ] ).toBe( 'var(--blicks-aspect-square)' );
	} );

	it( 'resolves layout gap/width/height token slugs to alias vars', () => {
		const { vars } = buildElementStyle( {
			'layout.gapRow': { default: { base: 'md' } },
			'layout.width': { default: { base: 'prose' } },
			'layout.height': { default: { base: 'prose' } },
		} );
		expect( vars[ '--bl-gap-r' ] ).toBe( 'var(--blicks-spacing-md)' );
		expect( vars[ '--bl-w' ] ).toBe( 'var(--blicks-width-prose)' );
		expect( vars[ '--bl-h' ] ).toBe( 'var(--blicks-width-prose)' );
	} );

	it( 'Wave G: emits align-content and grid-auto-columns/rows vars', () => {
		const { vars } = buildElementStyle( {
			'layout.alignContent': { default: { base: 'space-between' } },
			'layout.gridAutoColumns': { default: { base: 'minmax(0, 1fr)' } },
			'layout.gridAutoRows': { default: { base: '1fr' } },
		} );
		expect( vars[ '--bl-ac' ] ).toBe( 'space-between' );
		expect( vars[ '--bl-gac' ] ).toBe( 'minmax(0, 1fr)' );
		expect( vars[ '--bl-gar' ] ).toBe( '1fr' );
	} );

	it( 'Wave G: resolves min/max width/height token slugs and passes literals through', () => {
		const { vars } = buildElementStyle( {
			'layout.minWidth': { default: { base: 'prose' } },
			'layout.maxWidth': { default: { base: '600px' } },
			'layout.minHeight': { default: { base: 'content' } },
			'layout.maxHeight': { default: { base: '80vh' } },
		} );
		expect( vars[ '--bl-miw' ] ).toBe( 'var(--blicks-width-prose)' );
		expect( vars[ '--bl-maw' ] ).toBe( '600px' );
		expect( vars[ '--bl-mih' ] ).toBe( 'var(--blicks-width-content)' );
		expect( vars[ '--bl-mah' ] ).toBe( '80vh' );
	} );

	it( 'Wave G: emits box-sizing, box-behavior, scroll-extras, and direction vars', () => {
		const { vars } = buildElementStyle( {
			'layout.boxSizing': { default: { base: 'border-box' } },
			'layout.visibility': { default: { base: 'hidden' } },
			'layout.float': { default: { base: 'left' } },
			'layout.clear': { default: { base: 'both' } },
			'layout.isolation': { default: { base: 'isolate' } },
			'layout.resize': { default: { base: 'both' } },
			'layout.scrollBehavior': { default: { base: 'smooth' } },
			'layout.overscrollBehavior': { default: { base: 'contain' } },
			'layout.scrollSnapStop': { default: { base: 'always' } },
			'layout.direction': { default: { base: 'rtl' } },
		} );
		expect( vars[ '--bl-bxz' ] ).toBe( 'border-box' );
		expect( vars[ '--bl-vis' ] ).toBe( 'hidden' );
		expect( vars[ '--bl-flt2' ] ).toBe( 'left' );
		expect( vars[ '--bl-clr' ] ).toBe( 'both' );
		expect( vars[ '--bl-iso' ] ).toBe( 'isolate' );
		expect( vars[ '--bl-rsz' ] ).toBe( 'both' );
		expect( vars[ '--bl-sb' ] ).toBe( 'smooth' );
		expect( vars[ '--bl-osb' ] ).toBe( 'contain' );
		expect( vars[ '--bl-sss' ] ).toBe( 'always' );
		expect( vars[ '--bl-dir' ] ).toBe( 'rtl' );
	} );

	it( 'Wave H: emits contain/content-visibility/contain-intrinsic-size vars', () => {
		const { vars } = buildElementStyle( {
			'layout.contain': { default: { base: 'layout' } },
			'layout.contentVisibility': { default: { base: 'auto' } },
			'layout.containIntrinsicSize': { default: { base: 'auto 300px' } },
		} );
		expect( vars[ '--bl-ctn' ] ).toBe( 'layout' );
		expect( vars[ '--bl-cv' ] ).toBe( 'auto' );
		expect( vars[ '--bl-cis' ] ).toBe( 'auto 300px' );
	} );

	it( 'Wave H: emits line-clamp var + class', () => {
		const { classes, vars } = buildElementStyle( {
			'layout.lineClamp': { default: { base: '3' } },
		} );
		expect( vars[ '--bl-lc' ] ).toBe( '3' );
		expect( classes ).toContain( 'bl-lc' );
	} );

	it( 'Wave B: emits columns section vars', () => {
		const { vars } = buildElementStyle( {
			'columns.columnCount': { default: { base: '3' } },
			'columns.columnWidth': { default: { base: '16rem' } },
			'columns.columnGap':   { default: { base: '24px' } },
		} );
		expect( vars[ '--bl-cc' ] ).toBe( '3' );
		expect( vars[ '--bl-cw' ] ).toBe( '16rem' );
		expect( vars[ '--bl-cgap' ] ).toBe( '24px' );
	} );

	it( 'resolves columnWidth/columnGap token slugs to alias vars', () => {
		const { vars } = buildElementStyle( {
			'columns.columnWidth': { default: { base: 'prose' } },
			'columns.columnGap': { default: { base: 'md' } },
		} );
		expect( vars[ '--bl-cw' ] ).toBe( 'var(--blicks-width-prose)' );
		expect( vars[ '--bl-cgap' ] ).toBe( 'var(--blicks-spacing-md)' );
	} );

	it( 'Wave B: columns.breakInside emits a scoped child selector rule', () => {
		const r = buildElementStyle(
			{ 'columns.breakInside': { default: { base: 'avoid' } } },
			{ uniqueId: 'col42' }
		);
		expect( r.classes ).toEqual( [] );
		expect( r.vars ).toEqual( {} );
		expect( r.scopedCss ).toEqual( [ '.bl-col42 > *{break-inside:avoid}' ] );
	} );

	it( 'Wave B: emits grid-area and scroll-snap-align for grid-child', () => {
		const { vars } = buildElementStyle( {
			'gridChild.gridArea':        { default: { base: 'header' } },
			'gridChild.scrollSnapAlign': { default: { base: 'center' } },
		} );
		expect( vars[ '--bl-ga' ] ).toBe( 'header' );
		expect( vars[ '--bl-ssa' ] ).toBe( 'center' );
	} );

	// Wave C parity fixtures — each new prop must emit the same string in PHP (ElementStyleTest).
	it( 'Wave C: gradient builder emits conic with from/at heads', () => {
		const { vars } = buildElementStyle( {
			'background.gradient': {
				default: {
					base: {
						type: 'conic',
						angle: '45deg',
						position: '30% 70%',
						stops: [
							{ color: '#f59e0b', position: '0%' },
							{ color: '#ef4444', position: '50%' },
							{ color: '#8b5cf6', position: '100%' },
						],
					},
				},
			},
		} );
		expect( vars[ '--bl-bg-grad' ] ).toBe( 'conic-gradient(from 45deg at 30% 70%, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)' );
	} );

	it( 'Wave C: gradient builder emits conic without position when unset', () => {
		const { vars } = buildElementStyle( {
			'background.gradient': {
				default: {
					base: {
						type: 'conic',
						angle: '0deg',
						stops: [
							{ color: '#000', position: '0%' },
							{ color: '#fff', position: '100%' },
						],
					},
				},
			},
		} );
		expect( vars[ '--bl-bg-grad' ] ).toBe( 'conic-gradient(from 0deg, #000 0%, #fff 100%)' );
	} );

	it( 'Wave C: radial gradient accepts shape + position', () => {
		const { vars } = buildElementStyle( {
			'background.gradient': {
				default: {
					base: {
						type: 'radial',
						shape: 'ellipse',
						position: 'top right',
						stops: [
							{ color: '#000', position: '0%' },
							{ color: '#fff', position: '100%' },
						],
					},
				},
			},
		} );
		expect( vars[ '--bl-bg-grad' ] ).toBe( 'radial-gradient(ellipse at top right, #000 0%, #fff 100%)' );
	} );

	it( 'Wave C: legacy radial gradient (no position) keeps circle-only head', () => {
		const { vars } = buildElementStyle( {
			'background.gradient': {
				default: {
					base: {
						type: 'radial',
						from: '#111827',
						to: '#f9fafb',
					},
				},
			},
		} );
		expect( vars[ '--bl-bg-grad' ] ).toBe( 'radial-gradient(circle, #111827 0%, #f9fafb 100%)' );
	} );

	it( 'Wave C: emits background-blend-mode and clipText vars/classes', () => {
		const { classes, vars } = buildElementStyle( {
			'background.blendMode': { default: { base: 'multiply' } },
			'colors.clipText':      { default: { base: 'on' } },
		} );
		expect( classes ).toContain( 'bl-bg-blend' );
		expect( classes ).toContain( 'bl-cliptext' );
		expect( vars[ '--bl-bg-blend' ] ).toBe( 'multiply' );
		expect( vars[ '--bl-cliptext' ] ).toBe( 'on' );
	} );

	it( 'Wave C: emits writing-mode and text-orientation vars', () => {
		const { classes, vars } = buildElementStyle( {
			'typography.writingMode':     { default: { base: 'vertical-rl' } },
			'typography.textOrientation': { default: { base: 'upright' } },
		} );
		expect( classes ).toContain( 'bl-wm' );
		expect( classes ).toContain( 'bl-to' );
		expect( vars[ '--bl-wm' ] ).toBe( 'vertical-rl' );
		expect( vars[ '--bl-to' ] ).toBe( 'upright' );
	} );

	it( 'resolves a lineHeight token slug to its alias var', () => {
		const { vars } = buildElementStyle( {
			'typography.lineHeight': { default: { base: 'tight' } },
		} );
		expect( vars[ '--bl-lh' ] ).toBe( 'var(--blicks-leading-tight)' );
	} );

	it( 'passes a literal lineHeight value through unchanged', () => {
		const { vars } = buildElementStyle( {
			'typography.lineHeight': { default: { base: '1.5' } },
		} );
		expect( vars[ '--bl-lh' ] ).toBe( '1.5' );
	} );

	// Wave D parity fixtures — each new prop must emit the same string in PHP (ElementStyleTest).
	it( 'Wave D: clipPath builder emits diagonal polygon for preset', () => {
		const { vars } = buildElementStyle( {
			'effects.clipPath': { default: { base: { shape: 'diagonal', amount: '40px' } } },
		} );
		expect( vars[ '--bl-clip' ] ).toBe( 'polygon(0 0, 100% 0, 100% calc(100% - 40px), 0 100%)' );
	} );

	it( 'Wave D: clipPath builder emits fold polygon (cut top-right corner)', () => {
		const { vars } = buildElementStyle( {
			'effects.clipPath': { default: { base: { shape: 'fold', amount: '40px' } } },
		} );
		expect( vars[ '--bl-clip' ] ).toBe( 'polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 0 100%)' );
	} );

	it( 'Wave D: clipPath builder emits circle/ellipse/inset variants', () => {
		const { vars: vc } = buildElementStyle( {
			'effects.clipPath': { default: { base: { shape: 'circle', amount: '50%' } } },
		} );
		expect( vc[ '--bl-clip' ] ).toBe( 'circle(50% at center)' );
		const { vars: vi } = buildElementStyle( {
			'effects.clipPath': { default: { base: { shape: 'inset', amount: '12px' } } },
		} );
		expect( vi[ '--bl-clip' ] ).toBe( 'inset(12px)' );
	} );

	it( 'Wave D: backdropFilter builder composes function calls in order', () => {
		const { vars } = buildElementStyle( {
			'effects.backdropFilter': {
				default: { base: { blur: '12px', brightness: '110%', saturate: '150%' } },
			},
		} );
		expect( vars[ '--bl-bdf' ] ).toBe( 'blur(12px) brightness(110%) saturate(150%)' );
	} );

	it( 'Wave D: mask builder emits edge-fade gradient', () => {
		const { vars } = buildElementStyle( {
			'effects.mask': { default: { base: { kind: 'edge-fade', side: 'right', size: '24%' } } },
		} );
		expect( vars[ '--bl-mask' ] ).toBe( 'linear-gradient(to left, transparent, black 24%)' );
	} );

	it( 'Wave D: mask builder emits both-side edge-fade gradient', () => {
		const { vars } = buildElementStyle( {
			'effects.mask': { default: { base: { kind: 'edge-fade-both', axis: 'x', size: '15%' } } },
		} );
		expect( vars[ '--bl-mask' ] ).toBe(
			'linear-gradient(to right, transparent, black 15%, black calc(100% - 15%), transparent)'
		);
	} );

	it( 'Wave D: structured transform composes translate3d + rotate + scale', () => {
		const { vars } = buildElementStyle( {
			'effects.transform': {
				default: {
					base: { translateX: '10px', translateY: '0', translateZ: '0', rotateX: '15deg', scale: '1.05' },
				},
			},
		} );
		expect( vars[ '--bl-tfm' ] ).toBe( 'translate3d(10px, 0, 0) rotateX(15deg) scale(1.05)' );
	} );

	it( 'Wave D: transform passes a literal string through unchanged', () => {
		const { vars } = buildElementStyle( {
			'effects.transform': { default: { base: 'rotate(2deg)' } },
		} );
		expect( vars[ '--bl-tfm' ] ).toBe( 'rotate(2deg)' );
	} );

	it( 'Wave E: emits animation preset + duration + easing vars', () => {
		const { classes, vars } = buildElementStyle( {
			'animation.name':     { default: { base: 'bl-spin' } },
			'animation.duration': { default: { base: '8s' } },
			'animation.easing':   { default: { base: 'linear' } },
			'animation.iteration':{ default: { base: 'infinite' } },
		} );
		expect( classes ).toContain( 'bl-anim-name' );
		expect( classes ).toContain( 'bl-anim-dur' );
		expect( classes ).toContain( 'bl-anim-ease' );
		expect( vars[ '--bl-anim-name' ] ).toBe( 'bl-spin' );
		expect( vars[ '--bl-anim-dur' ] ).toBe( '8s' );
		expect( vars[ '--bl-anim-ease' ] ).toBe( 'linear' );
		expect( vars[ '--bl-anim-iter' ] ).toBe( 'infinite' );
	} );

	it( 'Wave E: emits scroll-timeline + range vars', () => {
		const { classes, vars } = buildElementStyle( {
			'animation.timeline': { default: { base: 'scroll()' } },
			'animation.range':    { default: { base: 'entry 0% entry 60%' } },
		} );
		expect( classes ).toContain( 'bl-anim-tl' );
		expect( classes ).toContain( 'bl-anim-range' );
		expect( vars[ '--bl-anim-tl' ] ).toBe( 'scroll()' );
		expect( vars[ '--bl-anim-range' ] ).toBe( 'entry 0% entry 60%' );
	} );

	it( 'Wave E: emits @property-target vars for spin/fill', () => {
		const { vars } = buildElementStyle( {
			'animation.targetAngle': { default: { base: '360deg' } },
			'animation.target':      { default: { base: '0.75' } },
		} );
		expect( vars[ '--bl-ang' ] ).toBe( '360deg' );
		expect( vars[ '--bl-p-target' ] ).toBe( '0.75' );
	} );

	it( 'Wave F: decoration builder emits a scoped ::after body with multiple props', () => {
		const r = buildElementStyle(
			{
				'decoration.after': {
					default: {
						base: {
							content: '""',
							width: '40px',
							height: '40px',
							borderRadius: '50%',
							background: '#000',
							inset: { top: 'auto', right: '-12px', bottom: '-12px', left: 'auto' },
							blur: '12px',
						},
					},
				},
			},
			{ uniqueId: 'orb1' }
		);
		expect( r.scopedCss ).toEqual( [
			'.bl-orb1::after{content:"";position:absolute;background:#000;width:40px;height:40px;top:auto;right:-12px;bottom:-12px;left:auto;border-radius:50%;filter:blur(12px)}',
		] );
	} );

	it( 'decoration builder emits the extended box surface in contract order', () => {
		const r = buildElementStyle(
			{
				'decoration.after': {
					default: {
						base: {
							content: '""',
							boxShadow: '0 4px 6px #000',
							backdropFilter: 'blur(8px)',
							clipPath: 'circle(50%)',
							transition: 'all .3s',
							mask: 'linear-gradient(#000,transparent)',
							backgroundClip: 'text',
						},
					},
				},
			},
			{ uniqueId: 'x' }
		);
		expect( r.scopedCss ).toEqual( [
			'.bl-x::after{content:"";position:absolute;box-shadow:0 4px 6px #000;backdrop-filter:blur(8px);clip-path:circle(50%);transition:all .3s;-webkit-mask:linear-gradient(#000,transparent);mask:linear-gradient(#000,transparent);-webkit-background-clip:text;background-clip:text}',
		] );
	} );

	it( 'decoration content: a lone quote is escaped, not broken out', () => {
		const r = buildElementStyle(
			{ 'decoration.before': { default: { base: { content: '"' } } } },
			{ uniqueId: 'x' }
		);
		expect( r.scopedCss ).toEqual( [ '.bl-x::before{content:"\\"";position:absolute}' ] );
	} );

	it( 'decoration content: plain text is quoted; keywords/functions pass through', () => {
		const plain = buildElementStyle(
			{ 'decoration.after': { default: { base: { content: 'Get started' } } } },
			{ uniqueId: 'x' }
		);
		expect( plain.scopedCss ).toEqual( [ '.bl-x::after{content:"Get started";position:absolute}' ] );

		const fn = buildElementStyle(
			{ 'decoration.after': { default: { base: { content: 'counter(item)' } } } },
			{ uniqueId: 'x' }
		);
		expect( fn.scopedCss ).toEqual( [ '.bl-x::after{content:counter(item);position:absolute}' ] );
	} );

	it( 'Wave F: decoration with enabled=false emits nothing', () => {
		const r = buildElementStyle(
			{
				'decoration.before': { default: { base: { enabled: false } } },
			},
			{ uniqueId: 'orb1' }
		);
		expect( r.scopedCss ?? [] ).toEqual( [] );
	} );

	it( 'Wave F: emits counter-reset/counter-increment vars', () => {
		const { classes, vars } = buildElementStyle( {
			'decoration.counterReset':     { default: { base: 'item' } },
			'decoration.counterIncrement': { default: { base: 'item' } },
		} );
		expect( classes ).toContain( 'bl-cnt-r' );
		expect( classes ).toContain( 'bl-cnt-i' );
		expect( vars[ '--bl-cnt-r' ] ).toBe( 'item' );
		expect( vars[ '--bl-cnt-i' ] ).toBe( 'item' );
	} );

	it( 'Wave D: emits transform-origin, transform-style, perspective plain vars', () => {
		const { classes, vars } = buildElementStyle( {
			'effects.transformOrigin': { default: { base: 'top left' } },
			'effects.transformStyle':  { default: { base: 'preserve-3d' } },
			'effects.perspective':     { default: { base: '800px' } },
		} );
		expect( classes ).toContain( 'bl-tfo' );
		expect( classes ).toContain( 'bl-tfs' );
		expect( classes ).toContain( 'bl-psp' );
		expect( vars[ '--bl-tfo' ] ).toBe( 'top left' );
		expect( vars[ '--bl-tfs' ] ).toBe( 'preserve-3d' );
		expect( vars[ '--bl-psp' ] ).toBe( '800px' );
	} );
} );

// Scoped (tier-3 / WA) emit. These rules need a real selector or @property, which a class+inline
// var can't express, so they go through the scoped path. The PHP mirror (ElementStyleTest) asserts
// the SAME strings — this is the engine-parity guard.
describe( 'buildElementStyle — scoped emit', () => {
	afterEach( () => {
		// drop any probe rules pushed by a test
		while ( STYLE_MAP.length && ( STYLE_MAP[ STYLE_MAP.length - 1 ] as any ).__probe ) {
			STYLE_MAP.pop();
		}
	} );

	const pushProbe = ( rule: any ) => STYLE_MAP.push( { __probe: true, ...rule } as any );

	it( 'selectorSuffix emits a scoped per-instance rule, not classes/vars', () => {
		pushProbe( { attr: 'deco.after', cls: 'deco', kind: 'single', v: '--bl-deco', prop: 'content', selectorSuffix: '::after' } );
		const r = buildElementStyle(
			{ 'deco.after': { default: { base: '"New"' } } },
			{ uniqueId: 'card123' }
		);
		expect( r.classes ).toEqual( [] );
		expect( r.vars ).toEqual( {} );
		expect( r.scopedCss ).toEqual( [ '.bl-card123::after{content:"New"}' ] );
	} );

	it( 'atRule wraps the scoped rule in a container query', () => {
		pushProbe( { attr: 'cq.cols', cls: 'cq', kind: 'single', v: '--bl-cq', prop: 'grid-template-columns', atRule: { type: 'container', query: '(min-width:380px)' } } );
		const r = buildElementStyle(
			{ 'cq.cols': { default: { base: '2' } } },
			{ uniqueId: 'card123' }
		);
		expect( r.scopedCss ).toEqual( [ '@container (min-width:380px){.bl-card123{grid-template-columns:2}}' ] );
	} );

	it( 'registerProperty emits a dedupable @property block', () => {
		pushProbe( { attr: 'anim.angle', cls: 'ang', kind: 'single', v: '--bl-ang', prop: 'rotate', registerProperty: { syntax: '<angle>', initialValue: '0deg', inherits: false } } );
		const r = buildElementStyle(
			{ 'anim.angle': { default: { base: '90deg' } } },
			{ uniqueId: 'spin123' }
		);
		expect( r.scopedCss ).toContain( '@property --bl-ang{syntax:"<angle>";initial-value:0deg;inherits:false}' );
	} );

	it( 'keyframes emits an animation-name rule gated by reduced-motion', () => {
		pushProbe( { attr: 'anim.spin', cls: 'spin', kind: 'single', v: '--bl-spin', prop: 'animation-name', keyframes: 'bl-spin' } );
		const r = buildElementStyle(
			{ 'anim.spin': { default: { base: 'on' } } },
			{ uniqueId: 'spinner123' }
		);
		expect( r.scopedCss ).toEqual( [
			'@media (prefers-reduced-motion: no-preference){.bl-spinner123{animation-name:bl-spin}}',
		] );
	} );
} );
