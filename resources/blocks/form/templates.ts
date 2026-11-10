/**
 * The Form's five starting points. Each is ordinary blocks (Fields, a Button set to Send form,
 * a Heading or Text), so everything a template adds stays editable. The copy is the prototype's.
 *
 * A template is a plain spec (`[ name, attributes, inner ]`) so it can be tested without a block
 * registry; `templateBlocks()` turns one into blocks for the editor.
 */
import { __ } from '@wordpress/i18n';
import type { PlaceholderSkeleton } from '@/framework/define-block';
import { fieldSpec, specToBlock, type BlockSpec } from '@/blocks/field/create';

export type TemplateKey = 'contact' | 'newsletter' | 'newsletter-card' | 'callback' | 'blank';

export type { BlockSpec };

export interface FormTemplate {
	key: TemplateKey;
	name: string;
	/** What it holds, under its name in the picker. */
	hint: string;
	skeleton: PlaceholderSkeleton;
	/** The sent message it suggests, written only while the author has not set one. */
	sent?: { title: string; message: string };
	blocks: () => BlockSpec[];
}

/** A Field with its parts: label Text, Input, and help Text when it has some (field/create.ts). */
const field = fieldSpec;

/** The Button that sends the form. */
const submit = ( text: string, blicks?: Record< string, unknown > ): BlockSpec => [
	'blicks/button',
	{ text, action: 'submit', ...( blicks ? { blicks } : {} ) },
];

const email = ( width: string ): BlockSpec =>
	field( {
		type: 'email',
		label: __( 'Email', 'blicks' ),
		name: 'email',
		placeholder: 'name@example.com',
		width,
		required: true,
		errorMessage: __( 'Enter an email address like name@example.com.', 'blicks' ),
	} );

/**
 * A Send button beside a 2/3 field: two of the six columns, level with the input and as wide as
 * its cell; the whole row on phones.
 */
const INLINE_BUTTON = {
	'gridChild.columnSpan': { default: { base: '2', mobile: '6' } },
	'gridChild.alignSelf': { default: { base: 'end' } },
	'gridChild.justifySelf': { default: { base: 'stretch' } },
};

export const TEMPLATES: FormTemplate[] = [
	{
		key: 'contact',
		name: __( 'Contact', 'blicks' ),
		hint: __( 'Name, email, message, consent', 'blicks' ),
		skeleton: { rows: [ 'box', 'box', 'box', 'button' ] },
		blocks: () => [
			field( { type: 'text', label: __( 'Name', 'blicks' ), name: 'name', width: 'half', required: true, errorMessage: __( 'Enter your name.', 'blicks' ) } ),
			email( 'half' ),
			field( { type: 'tel', label: __( 'Phone', 'blicks' ), name: 'phone', width: 'half' } ),
			field( {
				type: 'select',
				label: __( 'Topic', 'blicks' ),
				name: 'topic',
				placeholder: __( 'Choose a topic', 'blicks' ),
				width: 'half',
				options: [ __( 'General question', 'blicks' ), __( 'Sales', 'blicks' ), __( 'Support', 'blicks' ) ],
			} ),
			field( { type: 'textarea', label: __( 'Message', 'blicks' ), name: 'message', width: 'full', required: true, errorMessage: __( 'Write a message.', 'blicks' ) } ),
			field( {
				type: 'consent',
				label: __( 'I agree that you store my details to answer this message.', 'blicks' ),
				name: 'consent',
				width: 'full',
				required: true,
				errorMessage: __( 'Tick this box to send the form.', 'blicks' ),
			} ),
			submit( __( 'Send message', 'blicks' ) ),
		],
	},
	{
		key: 'newsletter',
		name: __( 'Newsletter', 'blicks' ),
		hint: __( 'Email and a button in one row', 'blicks' ),
		skeleton: { rows: [ 'box', 'button', 'text-sm' ] },
		blocks: () => [
			email( 'two' ),
			submit( __( 'Subscribe', 'blicks' ), INLINE_BUTTON ),
			[ 'blicks/text', { content: __( 'We use your email for this newsletter only.', 'blicks' ) } ],
		],
	},
	{
		key: 'newsletter-card',
		name: __( 'Newsletter card', 'blicks' ),
		hint: __( 'Heading, text, email, consent', 'blicks' ),
		skeleton: { rows: [ 'title', 'text', 'box', 'button' ] },
		blocks: () => [
			[ 'blicks/heading', { level: 3, content: __( 'Get the monthly notes', 'blicks' ) } ],
			[ 'blicks/text', { content: __( 'One email a month about [your topic]. Unsubscribe from any of them.', 'blicks' ) } ],
			email( 'two' ),
			submit( __( 'Subscribe', 'blicks' ), INLINE_BUTTON ),
			field( {
				type: 'consent',
				label: __( 'Send me the newsletter. I can unsubscribe at any time.', 'blicks' ),
				name: 'consent',
				width: 'full',
				required: true,
				errorMessage: __( 'Tick this box to send the form.', 'blicks' ),
			} ),
		],
	},
	{
		key: 'callback',
		name: __( 'Call back', 'blicks' ),
		hint: __( 'Name, phone, best time', 'blicks' ),
		skeleton: { rows: [ 'box', 'box', 'buttons', 'button' ] },
		sent: { title: __( 'We will call you back', 'blicks' ), message: __( 'Expect a call in the time you picked.', 'blicks' ) },
		blocks: () => [
			field( { type: 'text', label: __( 'Name', 'blicks' ), name: 'name', width: 'half', required: true, errorMessage: __( 'Enter your name.', 'blicks' ) } ),
			field( { type: 'tel', label: __( 'Phone', 'blicks' ), name: 'phone', width: 'half', required: true, errorMessage: __( 'Enter a phone number.', 'blicks' ) } ),
			field( {
				type: 'choice',
				label: __( 'Best time to call', 'blicks' ),
				name: 'time',
				width: 'full',
				options: [ __( 'Morning', 'blicks' ), __( 'Afternoon', 'blicks' ), __( 'Evening', 'blicks' ) ],
			} ),
			submit( __( 'Call me back', 'blicks' ) ),
		],
	},
	{
		key: 'blank',
		name: __( 'Blank', 'blicks' ),
		hint: __( 'One Email field and a button', 'blicks' ),
		skeleton: { rows: [ 'box', 'button' ] },
		blocks: () => [ email( 'full' ), submit( __( 'Send', 'blicks' ) ) ],
	},
];

export function findTemplate( key: unknown ): FormTemplate | undefined {
	return TEMPLATES.find( ( t ) => t.key === key );
}

/** A template's name, '' for none or an unknown key. */
export const templateName = ( key: unknown ) => findTemplate( key )?.name ?? '';

/** Fresh blocks for a template, each with its own client id. */
export function templateBlocks( key: TemplateKey ): any[] {
	return ( findTemplate( key )?.blocks() ?? [] ).map( specToBlock );
}

/**
 * The form attributes a template sets: its key, and its sent message while the author has not
 * written one.
 */
export function templateAttributes( key: TemplateKey, after: Record< string, unknown > | undefined ): Record< string, unknown > {
	const sent = findTemplate( key )?.sent;
	const current = after ?? {};
	const untouched = ! current.title && ! current.message;
	return {
		template: key,
		...( sent && untouched ? { after: { ...current, title: sent.title, message: sent.message } } : {} ),
	};
}
