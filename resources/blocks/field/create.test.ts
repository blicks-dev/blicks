// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '@/block-library';
import {
	INPUT_LOCK,
	createField,
	fieldChildSpecs,
	findRole,
	helpIndex,
	labelIndex,
	labelMove,
	plainText,
	roleOf,
	specToExample,
	fieldSpec,
} from './create';

const label = { name: 'blicks/text', attributes: { metadata: { blicksRole: 'label' } } };
const help = { name: 'blicks/text', attributes: { metadata: { blicksRole: 'help' } } };
const input = { name: 'blicks/input', attributes: {} };
const text = { name: 'blicks/text', attributes: {} };

describe( 'a new Field’s parts', () => {
	it( 'are a label Text, then the Input, then help when it has some', () => {
		expect( fieldChildSpecs( { type: 'email', label: 'Email', help: 'We reply in a day' } ) ).toEqual( [
			[ 'blicks/text', { content: 'Email', metadata: { name: 'Label', blicksRole: 'label' } } ],
			[ 'blicks/input', { lock: INPUT_LOCK } ],
			[ 'blicks/text', { content: 'We reply in a day', metadata: { name: 'Help', blicksRole: 'help' } } ],
		] );
		expect( fieldChildSpecs( { label: 'Name' } ).map( ( s ) => s[ 0 ] ) ).toEqual( [ 'blicks/text', 'blicks/input' ] );
	} );

	it( 'put the sentence after the box for consent, and are none for hidden', () => {
		expect( fieldChildSpecs( { type: 'consent', label: 'I agree' } ).map( ( s ) => roleOf( { name: s[ 0 ], attributes: s[ 1 ] } ) ) ).toEqual( [ 'input', 'label' ] );
		expect( fieldChildSpecs( { type: 'hidden', label: 'Source' } ) ).toEqual( [] );
	} );

	it( 'escape a label as rich text', () => {
		expect( fieldChildSpecs( { label: 'Fish & <chips>' } )[ 0 ][ 1 ].content ).toBe( 'Fish &amp; &lt;chips&gt;' );
	} );

	it( 'become blocks through createField, the Input locked against removal', () => {
		const block = createField( { type: 'text', label: 'Name', name: 'name' } );
		expect( block.name ).toBe( 'blicks/field' );
		expect( block.attributes ).toMatchObject( { type: 'text', label: 'Name', name: 'name' } );
		expect( block.innerBlocks.map( ( b: any ) => b.name ) ).toEqual( [ 'blicks/text', 'blicks/input' ] );
		expect( block.innerBlocks[ 0 ].attributes ).toMatchObject( { content: 'Name', metadata: { blicksRole: 'label' } } );
		expect( block.innerBlocks[ 1 ].attributes.lock ).toEqual( { remove: true } );
	} );

	it( 'make an inserter example', () => {
		expect( specToExample( fieldSpec( { label: 'Name' } ) ) ).toEqual( {
			name: 'blicks/field',
			attributes: { label: 'Name' },
			innerBlocks: [
				{ name: 'blicks/text', attributes: { content: 'Name', metadata: { name: 'Label', blicksRole: 'label' } } },
				{ name: 'blicks/input', attributes: { lock: INPUT_LOCK } },
			],
		} );
	} );
} );

describe( 'arranging a Field’s parts', () => {
	it( 'knows each part by its role', () => {
		expect( [ label, help, input, text, undefined ].map( roleOf ) ).toEqual( [ 'label', 'help', 'input', null, null ] );
		expect( findRole( [ text, help, input ], 'help' ) ).toBe( help );
	} );

	it( 'puts a new label before the Input, or after it for consent', () => {
		expect( labelIndex( 'text', [ text, input, help ] ) ).toBe( 1 );
		expect( labelIndex( 'consent', [ input, help ] ) ).toBe( 1 );
		expect( labelIndex( 'text', [] ) ).toBe( 0 );
	} );

	it( 'puts new help after the Input and a following label', () => {
		expect( helpIndex( [ label, input ] ) ).toBe( 2 );
		expect( helpIndex( [ input, label, text ] ) ).toBe( 2 );
		expect( helpIndex( [ text ] ) ).toBe( 1 );
	} );

	it( 'moves the label to its side when the type changes', () => {
		expect( labelMove( 'consent', [ label, input ] ) ).toBe( 1 );
		expect( labelMove( 'consent', [ input, label ] ) ).toBeNull();
		expect( labelMove( 'email', [ input, label, help ] ) ).toBe( 0 );
		expect( labelMove( 'email', [ label, input ] ) ).toBeNull();
		expect( labelMove( 'email', [ input ] ) ).toBeNull();
	} );

	it( 'reads a Text’s rich text as plain words', () => {
		expect( plainText( '<strong>Your</strong>&nbsp;name &amp; <em>email</em><br>please' ) ).toBe( 'Your name & email please' );
		expect( plainText( undefined ) ).toBe( '' );
	} );
} );
