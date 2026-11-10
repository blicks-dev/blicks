/**
 * "+ New › Dialog": the dialogs a person starts from. Each is ordinary Blicks blocks in one
 * `blicks/dialog`, plus the triggers and rules that suit it. Automatic ones start switched off
 * (a draft), so nothing pops up on the site until someone says so.
 */
import { __ } from '@wordpress/i18n';
import { cleanRules, cleanTriggers, type Rules, type Triggers } from './settings';
import type { DialogTarget } from './host';

/** `[ name, attributes, inner ]`, as `createBlocksFromInnerBlocksTemplate` takes it. */
export type Template = [ string, Record< string, unknown >, Template[]? ];

export interface Starter {
	id: string;
	label: string;
	description: string;
	/** An SVG path on a 24×24 grid. */
	icon: string;
	title: string;
	dialog: Record< string, unknown >;
	inner: Template[];
	triggers: Triggers;
	rules: Rules;
}

const heading = ( content: string ): Template => [ 'blicks/heading', { level: 2, content } ];
const text = ( content: string ): Template => [ 'blicks/text', { content } ];
const link = ( label: string, variant = 'default' ): Template => [ 'blicks/button', { text: label, url: '', variant } ];
const close = ( label: string ): Template => [ 'blicks/button', { text: label, action: 'close', variant: 'link' } ];
const base = ( value: string ) => ( { default: { base: value } } );
/** A Box laid out across, centred, as Blicks' Arrange ▸ Side by side writes it. A module never imports Blicks code. */
const row = ( ...inner: Template[] ): Template => [
	'blicks/box',
	{
		blicks: {
			'layout.display': base( 'flex' ),
			'layout.flexDirection': base( 'row' ),
			'layout.alignItems': base( 'center' ),
			'layout.justifyContent': base( 'flex-start' ),
			'layout.flexWrap': base( 'nowrap' ),
			'layout.gapRow': base( 'sm' ),
			'layout.gapColumn': base( 'sm' ),
		},
	},
	inner,
];

export function starters(): Starter[] {
	return [
		{
			id: 'newsletter',
			label: __( 'Newsletter signup', 'blicks-pro' ),
			description: __( 'Asks visitors to subscribe. Opens after a few seconds, or when they are about to leave.', 'blicks-pro' ),
			icon: 'M4 6h16v12H4zM4 7l8 6 8-6',
			title: __( 'Newsletter popup', 'blicks-pro' ),
			dialog: { kind: 'modal', phone: 'sheet', motion: 'rise' },
			inner: [
				heading( __( 'Get new posts first', 'blicks-pro' ) ),
				text( __( 'One email a month with what is new. Unsubscribe in one click.', 'blicks-pro' ) ),
				row( link( __( 'Subscribe', 'blicks-pro' ) ), close( __( 'No thanks', 'blicks-pro' ) ) ),
			],
			triggers: cleanTriggers( { load: { on: true, delay: 5 }, exit: { on: true } } ),
			rules: cleanRules( { frequency: 'days', days: 7, visitors: 'out' } ),
		},
		{
			id: 'offer',
			label: __( 'Offer with a code', 'blicks-pro' ),
			description: __( 'A discount code, shown once a visitor has read half the page.', 'blicks-pro' ),
			icon: 'M3 12l9-9h7v7l-9 9zM15.5 8.5h.01',
			title: __( 'Offer', 'blicks-pro' ),
			dialog: { kind: 'modal', phone: 'sheet', motion: 'scale' },
			inner: [
				heading( __( '10% off your first order', 'blicks-pro' ) ),
				text( __( 'Use the code WELCOME10 at checkout.', 'blicks-pro' ) ),
				row( link( __( 'Shop now', 'blicks-pro' ) ), close( __( 'Maybe later', 'blicks-pro' ) ) ),
			],
			triggers: cleanTriggers( { scroll: { on: true, percent: 50 } } ),
			rules: cleanRules( { frequency: 'session' } ),
		},
		{
			id: 'confirm',
			label: __( 'Confirm an action', 'blicks-pro' ),
			description: __( 'Asks before something that cannot be undone. Opened by a Button.', 'blicks-pro' ),
			icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 8v5M12 16h.01',
			title: __( 'Confirm', 'blicks-pro' ),
			dialog: { kind: 'modal', outsideCloses: false, motion: 'scale' },
			inner: [
				heading( __( 'Are you sure?', 'blicks-pro' ) ),
				text( __( 'Say what will happen, and whether it can be undone.', 'blicks-pro' ) ),
				row( link( __( 'Yes, continue', 'blicks-pro' ), 'destructive' ), close( __( 'Cancel', 'blicks-pro' ) ) ),
			],
			triggers: cleanTriggers( {} ),
			rules: cleanRules( {} ),
		},
		{
			id: 'cookies',
			label: __( 'Cookie notice', 'blicks-pro' ),
			description: __( 'A sheet along the bottom that leaves the page usable. Shown once.', 'blicks-pro' ),
			icon: 'M12 3a9 9 0 1 0 9 9a4 4 0 0 1-5-5a4 4 0 0 1-4-4zM8.5 12h.01M12 16h.01M15 13h.01',
			title: __( 'Cookie notice', 'blicks-pro' ),
			dialog: { kind: 'sheet', modal: false, backdrop: 'none', motion: 'none' },
			inner: [
				text( __( 'This site uses cookies to remember your choices. Read our privacy policy to learn more.', 'blicks-pro' ) ),
				row( close( __( 'OK', 'blicks-pro' ) ) ),
			],
			triggers: cleanTriggers( { load: { on: true, delay: 1 } } ),
			rules: cleanRules( { frequency: 'once', stopAfterConvert: false } ),
		},
		{
			id: 'lightbox',
			label: __( 'Image lightbox', 'blicks-pro' ),
			description: __( 'One image, full screen. Opened by a Button or a link.', 'blicks-pro' ),
			icon: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4',
			title: __( 'Lightbox', 'blicks-pro' ),
			dialog: { kind: 'full', backdrop: 'dark', motion: 'fade', label: __( 'Image', 'blicks-pro' ) },
			inner: [ [ 'blicks/image', {} ], text( __( 'A caption for the image.', 'blicks-pro' ) ) ],
			triggers: cleanTriggers( {} ),
			rules: cleanRules( {} ),
		},
	];
}

/** `newsletter`, or `newsletter-2` when a saved dialog already has that address. */
export function freeAnchor( base: string, targets: DialogTarget[] ): string {
	const taken = new Set( targets.map( ( t ) => t.id.replace( /^dialog-/, '' ) ) );
	let anchor = base || 'dialog';

	for ( let n = 2; taken.has( anchor ); n++ ) {
		anchor = `${ base }-${ n }`;
	}

	return anchor;
}

/** The dialog block's own attributes for a starter: its title and a free address. */
export function dialogAttributes( starter: Starter, anchor: string ): Record< string, unknown > {
	return { ...starter.dialog, title: starter.title, anchor };
}
