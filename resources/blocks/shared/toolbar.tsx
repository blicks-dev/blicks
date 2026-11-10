/**
 * Block-toolbar building blocks. Each one is a thin view over a write the block's Settings tab
 * already makes: the toolbar picks the value, the block passes the same setter Settings uses.
 */
import { CheckboxControl, Dropdown, TextControl, ToolbarButton, ToolbarDropdownMenu } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { IconPicker } from '@/controls/IconPicker';
import { getIcon, resolveIconName } from '@/framework/icons';
import { renderIcon } from '@/framework/icons/render';
import { choiceControls, choiceLabel, type ChoiceOption } from './toolbar-model';

export { choiceControls, choiceLabel, newTabAttributes, type ChoiceOption } from './toolbar-model';

interface ChoiceProps {
	/** What the choice is, for screen readers and the tooltip ("Surface"). */
	label: string;
	value: unknown;
	options: readonly ChoiceOption[];
	onChange: ( value: string ) => void;
	icon?: any;
	/** Shown when the value is not one of the options (a custom value from Settings). */
	fallback?: string;
	disabled?: ( value: string ) => boolean;
	/** Show only the icon, not the current option's name (alignment, where the icon says it). */
	iconOnly?: boolean;
}

/** A dropdown of named options, showing the current one's name on the toolbar. */
export function ToolbarChoice( { label, value, options, onChange, icon, fallback, disabled, iconOnly }: ChoiceProps ) {
	return (
		<ToolbarDropdownMenu
			icon={ icon ?? null }
			text={ iconOnly ? undefined : choiceLabel( options, value, fallback ?? __( 'Custom', 'blicks' ) ) }
			label={ label }
			controls={ choiceControls( options, value, onChange, disabled ) }
		/>
	);
}

/**
 * A 24×24 outline glyph for a toolbar button. Fill and stroke sit on the path: the toolbar's button
 * styles fill the `<svg>` with `currentColor`, which a path would otherwise inherit.
 */
export function outlineGlyph( d: string ) {
	return (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
			<path d={ d } fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/** An inspector option's icon (a 24×24 SVG path) as a toolbar icon; dashicon names pass through. */
export function toolbarIcon( icon: unknown ): any {
	if ( typeof icon !== 'string' || ! /^M[\d.\s-]/.test( icon ) ) return icon;
	return outlineGlyph( icon );
}

/** One pressed-or-not button per option, for two to four choices that read best side by side. */
export function ToolbarSegments( { value, options, onChange }: { value: unknown; options: readonly ChoiceOption[]; onChange: ( value: string ) => void } ) {
	const current = String( value ?? '' );
	return (
		<>
			{ options.map( ( [ v, l, icon ]: readonly [ string, string, ...any[] ] ) => (
				<ToolbarButton key={ v } icon={ toolbarIcon( icon ) } label={ l } isPressed={ current === v } onClick={ () => current !== v && onChange( v ) }>
					{ icon ? undefined : l }
				</ToolbarButton>
			) ) }
		</>
	);
}

const linkGlyph = outlineGlyph( 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' );

interface LinkProps {
	url: string;
	newTab: boolean;
	onUrl: ( url: string ) => void;
	onNewTab: ( on: boolean ) => void;
	/** Clears the link. Left out, the field is simply emptied. */
	onUnlink?: () => void;
}

/** A link button that opens the address and "new tab" fields, as the Settings Link section has them. */
export function ToolbarLink( { url, newTab, onUrl, onNewTab, onUnlink }: LinkProps ) {
	return (
		<Dropdown
			popoverProps={ { placement: 'bottom-start' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<ToolbarButton icon={ linkGlyph } label={ url ? __( 'Edit link', 'blicks' ) : __( 'Link', 'blicks' ) } isPressed={ !! url } aria-expanded={ isOpen } onClick={ onToggle } />
			) }
			renderContent={ ( { onClose } ) => (
				<div className="bl-toolbar-pop" style={ { padding: 12, width: 280, display: 'grid', gap: 8 } }>
					<TextControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Link to', 'blicks' ) } type="url" value={ url } placeholder="https://" onChange={ ( v ) => onUrl( v ) } />
					<CheckboxControl __nextHasNoMarginBottom label={ __( 'Open in a new tab', 'blicks' ) } checked={ newTab } onChange={ onNewTab } />
					{ url && (
						<ToolbarButton
							variant="link"
							onClick={ () => {
								( onUnlink ?? ( () => onUrl( '' ) ) )();
								onClose();
							} }
						>
							{ __( 'Remove link', 'blicks' ) }
						</ToolbarButton>
					) }
				</div>
			) }
		/>
	);
}

/** The icon picker, opened from a toolbar button that shows the current icon. */
export function ToolbarIcon( { value, onChange, allowNone = false, label = __( 'Icon', 'blicks' ) }: { value: string; onChange: ( icon: string ) => void; allowNone?: boolean; label?: string } ) {
	const name = resolveIconName( value );
	const preview = name && getIcon( name ) ? renderIcon( name, { strokeWidth: 2 } ) : undefined;
	return (
		<IconPicker
			value={ value }
			allowNone={ allowNone }
			onChange={ onChange }
			trigger={ ( { ref, onClick, isOpen, label: current } ) => (
				<ToolbarButton ref={ ref } icon={ preview } label={ `${ label }: ${ current }` } aria-expanded={ isOpen } onClick={ onClick }>
					{ preview ? undefined : label }
				</ToolbarButton>
			) }
		/>
	);
}
