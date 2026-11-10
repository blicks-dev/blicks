/**
 * What every header block's v2 panels share: On phones, and the Style tab's way into Header Studio.
 *
 * Drawn with the free plugin's v2 kit (`window.blicks.ui.v2`), read when a panel renders, so the
 * panels match the free blocks' and are styled by the same sheet.
 */
import { SelectControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { blicks, kit, type Option, type PanelProps } from './blicks';
import { LAST_ORDER, onPhones, type OnPhones } from './model';
import { MODE, partRef, studio } from './studio/host';

export const PHONE_OPTS: Option< OnPhones >[] = [
	[ 'show', __( 'Show', 'blicks-pro' ) ],
	[ 'last', __( 'Last', 'blicks-pro' ) ],
	[ 'hide', __( 'Hide', 'blicks-pro' ) ],
];

export const PHONE_HELP: Record< OnPhones, string > = {
	show: __( 'Shown on phones, where it is.', 'blicks-pro' ),
	last: __( 'Moved after its neighbors on phones, so they stay at the top.', 'blicks-pro' ),
	hide: __( 'Not shown on phones.', 'blicks-pro' ),
};

/**
 * On phones: Show, Last or Hide. Writes only what the free plugin already has: the block's mobile
 * visibility for Hide, and a mobile `flexChild.order` for Last.
 */
export function setOnPhones( attributes: Record< string, any >, setAttributes: PanelProps[ 'setAttributes' ], next: OnPhones ): void {
	const visibility = { ...( attributes.visibility ?? {} ) };
	if ( next === 'hide' ) visibility.mobile = true;
	else delete visibility.mobile;
	setAttributes( { visibility } );
	blicks()?.values.setValue( attributes, setAttributes, 'flexChild.order', 'default', 'mobile', next === 'last' ? LAST_ORDER : '' );
}

/** On phones, as a v2 section. */
export function OnPhonesSec( { attributes, setAttributes }: PanelProps ): JSX.Element {
	const { Sec, SegText, Note } = kit();
	const value = onPhones( attributes );
	return (
		<Sec title={ __( 'On phones', 'blicks-pro' ) } value={ PHONE_OPTS.find( ( [ v ] ) => v === value )?.[ 1 ] }>
			<SegText options={ PHONE_OPTS } value={ value } onChange={ ( next ) => setOnPhones( attributes, setAttributes, next ) } />
			<Note>{ PHONE_HELP[ value ] }</Note>
		</Sec>
	);
}

/** On phones, for the Studio's Item tab, which is drawn with WordPress's own controls. */
export function OnPhonesControl( { attributes, setAttributes }: PanelProps ): JSX.Element {
	const value = onPhones( attributes );
	return (
		<SelectControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ __( 'On phones', 'blicks-pro' ) }
			help={ PHONE_HELP[ value ] }
			value={ value }
			options={ PHONE_OPTS.map( ( [ v, label ] ) => ( { value: v, label } ) ) }
			onChange={ ( next: string ) => setOnPhones( attributes, setAttributes, next as OnPhones ) }
		/>
	);
}

/** The header template part being edited in the Site Editor, or ''. */
function useHeaderPart(): string {
	return useSelect( ( select: any ) => {
		const editor = select( 'core/editor' );
		if ( editor?.getCurrentPostType?.() !== 'wp_template_part' ) return '';
		const id = String( editor.getCurrentPostId?.() ?? '' );
		const record = select( 'core' ).getEntityRecord( 'postType', 'wp_template_part', id ) as { area?: string } | undefined;
		return 'header' === record?.area ? id : '';
	}, [] );
}

/**
 * The Style tab outside the Studio: a header is styled in Header Studio, whose design panel has every
 * style setting the engine has for the selected block, over the header drawn at each width. In the
 * Studio itself this tab is never shown; the design panel takes its place.
 */
export function StyleDoor( { clientId }: PanelProps ): JSX.Element {
	const { Sec, Note, Icon } = kit();
	const part = useHeaderPart();
	const host = studio();
	const open = part ? () => void host?.openRef( MODE, partRef( part ) ) : host?.openBlock && clientId ? () => void host.openBlock?.( clientId ) : null;
	return (
		<Sec title={ __( 'Style', 'blicks-pro' ) }>
			<Note>{ __( 'Colors, spacing, type and borders are set in Header Studio, over the header drawn on wide screens, tablets and phones.', 'blicks-pro' ) }</Note>
			{ open && (
				<button type="button" className="btn-add" onClick={ open }>
					<Icon d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" size={ 16 } />
					{ __( 'Style in Header Studio', 'blicks-pro' ) }
				</button>
			) }
		</Sec>
	);
}
