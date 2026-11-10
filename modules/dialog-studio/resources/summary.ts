/**
 * A saved dialog's triggers and rules in one sentence, for the Rules panel and the Dialogs list:
 * "By itself 5 s after a page loads, on every page, to logged-out visitors on every screen, once
 * per visit."
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import type { Rules, Triggers } from './settings';

export function triggerWords( t: Triggers ): string[] {
	const words: string[] = [];

	/* translators: %d: seconds */
	if ( t.load.on ) words.push( sprintf( _n( '%d s after a page loads', '%d s after a page loads', t.load.delay, 'blicks-pro' ), t.load.delay ) );
	/* translators: %d: percent of the page scrolled */
	if ( t.scroll.on ) words.push( sprintf( __( 'at %d%% scrolled', 'blicks-pro' ), t.scroll.percent ) );
	if ( t.exit.on ) words.push( __( 'when they are about to leave', 'blicks-pro' ) );
	/* translators: %d: seconds */
	if ( t.idle.on ) words.push( sprintf( __( 'after %d s with nothing done', 'blicks-pro' ), t.idle.seconds ) );

	return words;
}

export function summary( t: Triggers, r: Rules ): string {
	const words = triggerWords( t );
	const how = words.length > 0
		/* translators: %s: the automatic triggers, joined by ", or " */
		? sprintf( __( 'By itself %s', 'blicks-pro' ), words.join( __( ', or ', 'blicks-pro' ) ) )
		: __( 'Only when a Button or link opens it', 'blicks-pro' );

	if ( 0 === words.length ) {
		return `${ how }.`;
	}

	const where = 'all' === r.where ? __( 'on every page', 'blicks-pro' ) : 0 === r.include.length ? __( 'on no page yet', 'blicks-pro' ) : __( 'on the chosen pages', 'blicks-pro' );
	const except = r.exclude.length > 0 ? __( ' except some', 'blicks-pro' ) : '';
	const who = { all: __( 'to everyone', 'blicks-pro' ), out: __( 'to logged-out visitors', 'blicks-pro' ), in: __( 'to logged-in members', 'blicks-pro' ) }[ r.visitors ];
	const screens = ( [ 'desktop', 'tablet', 'phone' ] as const ).filter( ( s ) => r.screens[ s ] );
	const names = { desktop: __( 'desktops', 'blicks-pro' ), tablet: __( 'tablets', 'blicks-pro' ), phone: __( 'phones', 'blicks-pro' ) };
	const on = 3 === screens.length ? __( 'on every screen', 'blicks-pro' ) : 0 === screens.length ? __( 'on no screen', 'blicks-pro' ) : sprintf( /* translators: %s: screen kinds */ __( 'on %s', 'blicks-pro' ), screens.map( ( s ) => names[ s ] ).join( __( ' and ', 'blicks-pro' ) ) );
	const often = {
		view: __( 'on every page view', 'blicks-pro' ),
		session: __( 'once per visit', 'blicks-pro' ),
		/* translators: %d: days */
		days: sprintf( _n( 'at most once a day', 'at most once every %d days', r.days, 'blicks-pro' ), r.days ),
		once: __( 'once, ever', 'blicks-pro' ),
	}[ r.frequency ];
	const convert = r.stopAfterConvert ? __( ', never after they convert', 'blicks-pro' ) : '';
	/* translators: 1: first day, 2: last day */
	const when = r.schedule.on && ( r.schedule.from || r.schedule.to ) ? sprintf( __( ', from %1$s to %2$s', 'blicks-pro' ), r.schedule.from || '…', r.schedule.to || '…' ) : '';

	return `${ how }, ${ where }${ except }, ${ who } ${ on }, ${ often }${ convert }${ when }.`;
}
