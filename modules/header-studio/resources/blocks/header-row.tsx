import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/header-row/block.json';
import { kit, type Option, type PanelProps } from '../blicks';
import { OnPhonesSec, StyleDoor } from '../controls';
import { rowClasses } from '../model';
import type { Define } from './types';

type Preset = 'classic' | 'centred' | 'stacked' | 'custom';

const PRESET_OPTS: Option< Preset >[] = [
	[ 'classic', __( 'Classic', 'blicks-pro' ) ],
	[ 'centred', __( 'Centered', 'blicks-pro' ) ],
	[ 'stacked', __( 'Stacked', 'blicks-pro' ) ],
	[ 'custom', __( 'Custom', 'blicks-pro' ) ],
];

const PRESET_HELP: Record< Preset, string > = {
	classic: __( 'Logo, menu, then the actions on the right.', 'blicks-pro' ),
	centred: __( 'The middle area centered, the others either side.', 'blicks-pro' ),
	stacked: __( 'The areas one under another.', 'blicks-pro' ),
	custom: __( 'Laid out with the row’s own style settings.', 'blicks-pro' ),
};

function Settings( props: PanelProps ) {
	const { Sec, SegText, Note } = kit();
	const preset = ( PRESET_OPTS.some( ( [ v ] ) => v === props.attributes.preset ) ? props.attributes.preset : 'classic' ) as Preset;
	return (
		<>
			<Sec title={ __( 'Layout', 'blicks-pro' ) }>
				<SegText options={ PRESET_OPTS } value={ preset } onChange={ ( p ) => props.setAttributes( { preset: p } ) } />
				<Note>{ PRESET_HELP[ preset ] }</Note>
			</Sec>
			<OnPhonesSec { ...props } />
		</>
	);
}

/** One row of the header, always its three areas: start, centre and end. */
export const headerRow: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings, Style: StyleDoor, describe: () => __( 'Header row', 'blicks-pro' ) } ),
		innerBlocks: {
			allowedBlocks: [ 'blicks/header-area' ],
			templateLock: 'all',
			orientation: 'horizontal',
			renderAppender: false,
			template: [
				[ 'blicks/header-area', { slot: 'start' } ],
				[ 'blicks/header-area', { slot: 'centre' } ],
				[ 'blicks/header-area', { slot: 'end' } ],
			],
		},
		render( { attributes, blockProps, children }: any ) {
			return (
				<div { ...blockProps } className={ [ blockProps.className, ...rowClasses( attributes ) ].join( ' ' ) }>
					{ children }
				</div>
			);
		},
	} );
