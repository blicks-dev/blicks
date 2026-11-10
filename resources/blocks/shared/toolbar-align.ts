import { __ } from '@wordpress/i18n';

/** Text alignment for the toolbar: value, name, dashicon. Left is stored as no value. */
export const TEXT_ALIGNS = [
	[ 'left', __( 'Align left', 'blicks' ), 'editor-alignleft' ],
	[ 'center', __( 'Align center', 'blicks' ), 'editor-aligncenter' ],
	[ 'right', __( 'Align right', 'blicks' ), 'editor-alignright' ],
	[ 'justify', __( 'Justify', 'blicks' ), 'editor-justify' ],
] as const;

export const alignIcon = ( value: string ) => ( TEXT_ALIGNS.find( ( a ) => a[ 0 ] === value ) ?? TEXT_ALIGNS[ 0 ] )[ 2 ];
