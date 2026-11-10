/**
 * The Input's inspector: its icon (Settings › Content) and the shared Style panel. What it asks
 * for is the Field's, so Settings has only what is drawn inside the control.
 */
import { useSelect } from '@wordpress/data';
import { ToolbarGroup } from '@wordpress/components';
import { ToolbarIcon } from '@/blocks/shared/toolbar';
import { __ } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { Note, Row, Sec } from '@/framework/inspector-v2/kit';
import { IconPicker } from '@/controls/IconPicker';
import { cleanAppearance, cleanType, type FieldType } from '@/blocks/field/model';

/** The types an icon is drawn in: the one-line boxes and the dropdown. FieldRenderer::ICON_TYPES. */
export const ICON_TYPES: readonly FieldType[] = [ 'text', 'email', 'tel', 'number', 'date', 'time', 'select' ];

/** True when this Input draws its icon: a type that takes one, and not a number drawn as a stepper. */
export function takesIcon( type: FieldType, appearance: string ): boolean {
	return ICON_TYPES.includes( type ) && ! ( type === 'number' && cleanAppearance( type, appearance ) === 'stepper' );
}

/** The type and look of the Field this Input is in. */
function useFieldOf( clientId: string | undefined ): { type: FieldType; appearance: string } {
	const key = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const parent = clientId ? store.getBlockRootClientId( clientId ) : null;
			const attrs = parent ? store.getBlockAttributes( parent ) ?? {} : {};
			return `${ attrs.type ?? '' }|${ attrs.appearance ?? '' }`;
		},
		[ clientId ]
	);
	const [ type, appearance ] = key.split( '|' );
	return { type: cleanType( type ), appearance };
}

export function InputSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const { type, appearance } = useFieldOf( clientId );
	const icon = String( attributes.icon || '' );

	return (
		<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
			{ takesIcon( type, appearance ) ? (
				<Row label={ __( 'Icon', 'blicks' ) } stack set={ !! icon } note={ __( 'Drawn inside the box, at its start. Screen readers skip it.', 'blicks' ) } noteIcon="info">
					<IconPicker value={ icon } allowNone onChange={ ( next ) => setAttributes( { icon: next } ) } />
				</Row>
			) : (
				<Row
					label={ __( 'Icon', 'blicks' ) }
					set={ !! icon }
					note={ icon
						? __( 'This field’s type draws no icon. It comes back if the Field becomes a one-line box or a dropdown.', 'blicks' )
						: __( 'Icons are drawn in one-line boxes and dropdowns.', 'blicks' ) }
					noteIcon="info"
				>
					{ null }
				</Row>
			) }
			<Note>{ __( 'What it asks for is set on its Field. Its Style tab styles the control itself.', 'blicks' ) }</Note>
		</Sec>
	);
}

/** The Input's Style tab: the shared Style panel, on the control itself. */
export function InputStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked={ false } />;
}

/** The Input's toolbar: its icon, only where the Field's type draws one — as Settings writes it. */
export function InputToolbar( { attributes, setAttributes, clientId }: PanelProps ) {
	const { type, appearance } = useFieldOf( clientId );
	if ( ! takesIcon( type, appearance ) ) return null;
	return (
		<ToolbarGroup>
			<ToolbarIcon value={ String( attributes.icon || '' ) } allowNone onChange={ ( icon ) => setAttributes( { icon } ) } />
		</ToolbarGroup>
	);
}
