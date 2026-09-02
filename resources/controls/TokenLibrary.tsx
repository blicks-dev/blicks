import { useMemo, useState } from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { TokenCategory } from '@/framework/types';
import { announcePopoverOpen, useCloseOnOtherPopover, useCloseOnOutsideClick } from '@/controls/common';
import { resolveTokenValues, tokenOptions } from '@/controls/token-utils';
import './token-library.scss';

/**
 * The token-library glyph: a layers stack — the same metaphor design tools use for variables/
 * tokens. Exported so the controls that hand-roll their own library trigger (Color, Border colour)
 * draw exactly the same button as `<TokenLibrary>` itself.
 */
export const TOKEN_LIBRARY_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
		<path d="M12 2 3 7l9 5 9-5-9-5z" />
		<path d="M3 12l9 5 9-5" />
		<path d="M3 17l9 5 9-5" />
	</svg>
);

/**
 * Reusable token-library trigger: a swatch-grid button that opens a portal popover of
 * the category's tokens (slug + live-resolved value). Selecting a token calls
 * `onSelect( slug )` — the style engine resolves the slug to its alias var. Used
 * by length-style controls (Spacing, Border width/radius, Typography size) whose
 * inputs already accept slugs but had no visible picker. Color/font-family/shadow
 * keep their own bespoke pickers.
 */
export function TokenLibrary( {
	category,
	value,
	onSelect,
	title,
}: {
	category: TokenCategory;
	value?: string;
	onSelect: ( slug: string ) => void;
	title?: string;
} ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const [ anchor, setAnchor ] = useState< Element | null >( null );
	const [ popoverId ] = useState(
		() => `bl-token-lib-${ Math.random().toString( 36 ).slice( 2 ) }`
	);
	useCloseOnOtherPopover( popoverId, () => setIsOpen( false ) );
	useCloseOnOutsideClick( isOpen, () => setIsOpen( false ), anchor );

	const options = useMemo( () => tokenOptions( category ), [ category ] );
	const resolved = useMemo< Record< string, string > >(
		() => ( isOpen ? resolveTokenValues( category ) : {} ),
		[ isOpen, category ]
	);

	const toggle = () => {
		setIsOpen( ( current ) => {
			const next = ! current;
			if ( next ) announcePopoverOpen( popoverId );
			return next;
		} );
	};

	return (
		<>
			<button
				type="button"
				className={ `lib-btn ${ isOpen ? 'is-open' : '' }` }
				title={ title ?? __( 'Token library', 'blicks' ) }
				ref={ ( node ) => setAnchor( node ) }
				onClick={ toggle }
			>
				{ TOKEN_LIBRARY_ICON }
			</button>
			{ isOpen && (
				<Popover
					anchor={ anchor }
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
					<div className="bl-token-library">
						{ options.map( ( option ) => (
							<button
								type="button"
								key={ option.slug }
								className={ `bl-token-library__item${ value === option.slug ? ' is-selected' : '' }` }
								onClick={ () => {
									onSelect( option.slug );
									setIsOpen( false );
								} }
							>
								<span className="bl-token-library__slug">{ option.slug }</span>
								<span className="bl-token-library__value">{ resolved[ option.slug ] || option.css }</span>
							</button>
						) ) }
					</div>
				</Popover>
			) }
		</>
	);
}
