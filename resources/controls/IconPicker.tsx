import { Popover } from '@wordpress/components';
import { useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	getIcon,
	getIconName,
	listCategories,
	listIcons,
	resolveIconName,
	searchIcons,
	type IconSearchResult,
} from '@/framework/icons';
import { renderIcon } from '@/framework/icons/render';
import { announcePopoverOpen, useCloseOnOtherPopover, useCloseOnOutsideClick } from '@/controls/common';

interface IconPickerProps {
	value: string;
	onChange: ( name: string ) => void;
	/** When true, allow clearing the icon (renders a "None" tile + a clear button on the trigger). */
	allowNone?: boolean;
	/** Optional id for popover-close coordination. */
	id?: string;
}

export function IconPicker( { value, onChange, allowNone = false, id }: IconPickerProps ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const anchorRef = useRef< HTMLButtonElement | null >( null );
	const popoverId = useMemo( () => id ?? `bl-icon-picker-${ Math.random().toString( 36 ).slice( 2, 8 ) }`, [ id ] );

	useCloseOnOtherPopover( popoverId, () => setIsOpen( false ) );
	useCloseOnOutsideClick( isOpen, () => setIsOpen( false ), anchorRef.current );

	const resolved = resolveIconName( value );
	const hasSelection = !! resolved && !! getIcon( resolved );
	const displayLabel = hasSelection
		? ( getIcon( resolved )?.label ?? getIconName( resolved ) )
		: __( 'None', 'blicks' );

	const results = useMemo( () => ( query ? searchIcons( query ) : listIcons() ), [ query ] );

	// Group hits by category, preserve listCategories() order for stable rendering.
	const grouped = useMemo( () => {
		const buckets = new Map< string, IconSearchResult[] >();
		for ( const hit of results ) {
			const cat = hit.def.category ?? 'other';
			if ( ! buckets.has( cat ) ) buckets.set( cat, [] );
			buckets.get( cat )!.push( hit );
		}
		const orderedCats = [ ...listCategories(), 'other' ].filter( ( c, i, arr ) => arr.indexOf( c ) === i );
		return orderedCats
			.map( ( cat ) => [ cat, buckets.get( cat ) ?? [] ] as const )
			.filter( ( [ , items ] ) => items.length > 0 );
	}, [ results ] );

	const toggle = () => {
		setIsOpen( ( next ) => {
			const open = ! next;
			if ( open ) {
				announcePopoverOpen( popoverId );
				setQuery( '' );
			}
			return open;
		} );
	};

	const pick = ( next: string ) => {
		onChange( next );
		setIsOpen( false );
	};

	return (
		<div className="bl-icon-picker-control">
			<button
				type="button"
				ref={ anchorRef }
				className={ `bl-icon-picker-control__trigger${ hasSelection ? ' has-icon' : '' }` }
				onClick={ toggle }
				aria-haspopup="dialog"
				aria-expanded={ isOpen }
			>
				<span className="bl-icon-picker-control__preview">
					{ hasSelection ? renderIcon( resolved, { strokeWidth: 2 } ) : <span aria-hidden="true">∅</span> }
				</span>
				<span className="bl-icon-picker-control__label">{ displayLabel }</span>
			</button>

			{ allowNone && hasSelection && (
				<button
					type="button"
					className="bl-icon-picker-control__clear"
					onClick={ () => onChange( '' ) }
					aria-label={ __( 'Clear icon', 'blicks' ) }
					title={ __( 'Clear icon', 'blicks' ) }
				>
					×
				</button>
			) }

			{ isOpen && (
				<Popover
					anchor={ anchorRef.current }
					placement="left-start"
					offset={ 12 }
					flip
					resize
					noArrow
					focusOnMount={ false }
					onClose={ () => setIsOpen( false ) }
					className="bl-floating-popover"
					variant="unstyled"
				>
					<div className="bl-icon-picker-popover">
						<input
							type="search"
							className="bl-icon-picker-popover__search"
							autoFocus
							placeholder={ __( 'Search icons…', 'blicks' ) }
							value={ query }
							onChange={ ( e ) => setQuery( e.target.value ) }
						/>
						<div className="bl-icon-picker-popover__body">
							{ allowNone && ! query && (
								<section className="bl-icon-picker-popover__section">
									<div className="bl-icon-picker-popover__grid">
										<button
											type="button"
											className={ `bl-icon-picker-popover__tile is-none${ ! hasSelection ? ' is-active' : '' }` }
											title={ __( 'None', 'blicks' ) }
											onClick={ () => pick( '' ) }
										>
											∅
										</button>
									</div>
								</section>
							) }
							{ grouped.length === 0 && (
								<div className="bl-icon-picker-popover__empty">
									{ __( 'No icons match', 'blicks' ) }
								</div>
							) }
							{ grouped.map( ( [ category, items ] ) => (
								<section key={ category } className="bl-icon-picker-popover__section">
									<h4 className="bl-icon-picker-popover__heading">{ category }</h4>
									<div className="bl-icon-picker-popover__grid">
										{ items.map( ( hit ) => (
											<button
												type="button"
												key={ hit.name }
												className={ `bl-icon-picker-popover__tile${ resolved === hit.name ? ' is-active' : '' }` }
												title={ hit.def.label }
												onClick={ () => pick( hit.name ) }
											>
												{ renderIcon( hit.name, { strokeWidth: 2 } ) }
											</button>
										) ) }
									</div>
								</section>
							) ) }
						</div>
					</div>
				</Popover>
			) }
		</div>
	);
}
