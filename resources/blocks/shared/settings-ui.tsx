import { Button, Popover } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { GENERATED_BLOCK_HELP } from './help.gen';

export interface Option {
	label: string;
	value: string;
	hint?: string;
}

export interface BlockHelp {
	description: string;
	controls: Record< string, string >;
	tips: string[];
}

const helpCache = new Map< string, BlockHelp | null >();
const helpRequests = new Map< string, Promise< BlockHelp | null > >();

function generatedHelp( blockName: string ): BlockHelp | null {
	return GENERATED_BLOCK_HELP[ blockName ] ?? null;
}

function localizedHelp( blockName: string, help: BlockHelp | null ): BlockHelp | null {
	const generated = generatedHelp( blockName );
	if ( ! help ) return generated;
	if ( ! generated ) return help;

	const controls = { ...help.controls };
	for ( const id of Object.keys( controls ) ) {
		controls[ id ] = generated.controls[ id ] ?? controls[ id ];
	}

	return {
		description: generated.description || help.description,
		controls,
		tips: help.tips.map( ( tip, index ) => generated.tips[ index ] ?? tip ),
	};
}

function helpUrl( blockName: string ): string {
	const base = window.blicksEditorSettings?.helpBaseUrl;
	return base ? `${ base.replace( /\/+$/, '' ) }/${ blockName }/help.json` : '';
}

function requestBlockHelp( blockName: string ): Promise< BlockHelp | null > {
	if ( helpCache.has( blockName ) ) {
		return Promise.resolve( helpCache.get( blockName ) ?? null );
	}

	const existing = helpRequests.get( blockName );
	if ( existing ) return existing;

	const url = helpUrl( blockName );
	if ( ! url ) {
		const help = generatedHelp( blockName );
		helpCache.set( blockName, help );
		return Promise.resolve( help );
	}

	const request = window.fetch( url, { credentials: 'same-origin' } )
		.then( ( response ) => response.ok ? response.json() : null )
		.then( ( data ) => {
			const help = localizedHelp( blockName, data && typeof data === 'object' ? data as BlockHelp : null );
			helpCache.set( blockName, help );
			return help;
		} )
		.catch( () => {
			const help = generatedHelp( blockName );
			helpCache.set( blockName, help );
			return help;
		} )
		.finally( () => {
			helpRequests.delete( blockName );
		} );

	helpRequests.set( blockName, request );
	return request;
}

export function useBlockHelp( blockName: string ): BlockHelp | null {
	const [ help, setHelp ] = useState< BlockHelp | null >( () => helpCache.get( blockName ) ?? null );

	useEffect( () => {
		let mounted = true;
		requestBlockHelp( blockName ).then( ( nextHelp ) => {
			if ( mounted ) setHelp( nextHelp );
		} );
		return () => {
			mounted = false;
		};
	}, [ blockName ] );

	return help;
}

function HelpIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<circle cx="12" cy="12" r="9" />
			<path d="M9.8 9.3a2.4 2.4 0 0 1 4.6 1c0 1.8-2.4 2-2.4 3.7" />
			<path d="M12 17h.01" />
		</svg>
	);
}

export function HelpTip( { text }: { text?: string } ) {
	const [ open, setOpen ] = useState( false );
	const wrapperRef = useRef< HTMLSpanElement | null >( null );

	useEffect( () => {
		if ( ! open ) return;
		const doc = wrapperRef.current?.ownerDocument ?? document;
		const ElementCtor = doc.defaultView?.Element ?? Element;

		function closeIfOutside( event: PointerEvent ) {
			const target = event.target;
			if ( ! ( target instanceof ElementCtor ) ) return;
			if ( wrapperRef.current?.contains( target ) ) return;
			if ( target.closest( '.bl-help-tip__popover' ) ) return;
			setOpen( false );
		}

		function closeOnEscape( event: KeyboardEvent ) {
			if ( event.key === 'Escape' ) setOpen( false );
		}

		doc.addEventListener( 'pointerdown', closeIfOutside, true );
		doc.addEventListener( 'keydown', closeOnEscape, true );
		return () => {
			doc.removeEventListener( 'pointerdown', closeIfOutside, true );
			doc.removeEventListener( 'keydown', closeOnEscape, true );
		};
	}, [ open ] );

	if ( ! text ) return null;

	return (
		<span ref={ wrapperRef } className="bl-help-tip">
			<Button
				className="bl-help-tip__button"
				label={ __( 'Show help', 'blicks' ) }
				icon={ <HelpIcon /> }
				size="small"
				onClick={ () => setOpen( ! open ) }
				aria-expanded={ open }
			/>
			{ open && (
				<Popover
					className="bl-help-tip__popover"
					placement="left-start"
					onClose={ () => setOpen( false ) }
					onFocusOutside={ () => setOpen( false ) }
					focusOnMount={ false }
				>
					<p>{ text }</p>
				</Popover>
			) }
		</span>
	);
}

export function SettingsCard( {
	title,
	help,
	children,
}: {
	title: string;
	help?: string;
	children: React.ReactNode;
} ) {
	return (
		<div className="bl-settings-card">
			<div className="bl-settings-card__title">
				<span>{ title }</span>
				<HelpTip text={ help } />
			</div>
			{ children }
		</div>
	);
}

export function OptionCards( {
	label,
	help,
	value,
	options,
	onChange,
	columns = 2,
}: {
	label: string;
	help?: string;
	value: string;
	options: Option[];
	onChange: ( value: string ) => void;
	columns?: 2 | 3;
} ) {
	return (
		<div className="bl-setting">
			<div className="bl-setting__label">
				<span>{ label }</span>
				<HelpTip text={ help } />
			</div>
			<div className={ `bl-option-cards bl-option-cards--${ columns }` }>
				{ options.map( ( option ) => (
					<button
						key={ option.value }
						type="button"
						className={ `bl-option-card ${ value === option.value ? 'is-active' : '' }` }
						onClick={ () => onChange( option.value ) }
					>
						<span className="bl-option-card__label">{ option.label }</span>
						{ option.hint && <span className="bl-option-card__hint">{ option.hint }</span> }
					</button>
				) ) }
			</div>
		</div>
	);
}

export function SegmentedSetting( {
	label,
	help,
	value,
	options,
	onChange,
}: {
	label: string;
	help?: string;
	value: string;
	options: Option[];
	onChange: ( value: string ) => void;
} ) {
	return (
		<div className="bl-setting">
			<div className="bl-setting__label">
				<span>{ label }</span>
				<HelpTip text={ help } />
			</div>
			<div className="bl-segmented-setting">
				{ options.map( ( option ) => (
					<button
						key={ option.value }
						type="button"
						className={ value === option.value ? 'is-active' : '' }
						onClick={ () => onChange( option.value ) }
					>
						{ option.label }
					</button>
				) ) }
			</div>
		</div>
	);
}

export function FieldRow( {
	label,
	help,
	children,
}: {
	label: string;
	help?: string;
	children: React.ReactNode;
} ) {
	return (
		<label className="bl-field-row">
			<span className="bl-field-row__label">
				<span>{ label }</span>
				<HelpTip text={ help } />
			</span>
			{ children }
		</label>
	);
}

export const HTML_LABEL = __( 'HTML', 'blicks' );
