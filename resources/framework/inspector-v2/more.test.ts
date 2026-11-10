import { describe, expect, it } from 'vitest';
import { htmlAttr, withHtmlAttr, withoutStyles } from './More';

describe( 'Clear all styles', () => {
	it( 'clears the look and keeps what Settings and Motion wrote', () => {
		const v = ( base: unknown ) => ( { default: { base } } );
		const tree = {
			'colors.background': v( 'primary' ),
			'border.radius': v( { topLeft: 'lg' } ),
			'typography.fontSize': v( '20px' ),
			'meta.look': { fill: 'primary' },
			'layout.display': v( 'grid' ),
			'layout.gridColumns': v( '3' ),
			'position.type': v( 'sticky' ),
			'columns.columnCount': v( '2' ),
			'typography.role': v( 'lead' ),
			'typography.textAlign': v( 'center' ),
			'typography.textWrap': v( 'pretty' ),
			'typography.whiteSpace': v( 'normal' ),
			'animation.name': v( 'bl-rise' ),
		};
		expect( Object.keys( withoutStyles( tree ) ).sort() ).toEqual( [
			'animation.name', 'columns.columnCount', 'layout.display', 'layout.gridColumns', 'position.type',
			'typography.role', 'typography.textAlign', 'typography.textWrap', 'typography.whiteSpace',
		] );
	} );
} );

describe( 'Meaning and access on a list', () => {
	const attributes = { htmlAttributes: [ { name: 'data-x', value: '1' }, { name: 'role', value: 'list' } ] };

	it( 'sets one attribute and keeps the others', () => {
		const next = withHtmlAttr( attributes, 'aria-label', 'What’s included' );
		expect( next ).toEqual( [ ...attributes.htmlAttributes, { name: 'aria-label', value: 'What’s included' } ] );
		expect( htmlAttr( { htmlAttributes: next }, 'aria-label' ) ).toBe( 'What’s included' );
	} );

	it( 'removes an attribute set to nothing', () => {
		expect( withHtmlAttr( attributes, 'role', '' ) ).toEqual( [ { name: 'data-x', value: '1' } ] );
		expect( htmlAttr( {}, 'role' ) ).toBe( '' );
	} );
} );
