import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { tokenVar, titleCase } from '../data';
import { DESIGN_SECTIONS, TOKEN_CATEGORY_KEYS } from '../constants';
import type { AdminView, DesignSystemSnapshot } from '../types';

type Command = {
	id: string;
	title: string;
	hint: string;
	group: string;
	run: () => void;
};

/**
 * ⌘K / Ctrl-K jump-to. The index is built from what the admin already knows — the three views,
 * the design system's sections, and every token slug in the live snapshot. All of it is already
 * in memory, so the palette needs no fetch of its own.
 */
export function CommandPalette( {
	open,
	snapshot,
	onClose,
	onNavigate,
	onOpenDesignSection,
}: {
	open: boolean;
	snapshot: DesignSystemSnapshot;
	onClose: () => void;
	onNavigate: ( view: AdminView ) => void;
	onOpenDesignSection: ( section: string ) => void;
} ): JSX.Element | null {
	const [ query, setQuery ] = useState( '' );
	const [ cursor, setCursor ] = useState( 0 );
	const inputRef = useRef< HTMLInputElement >( null );
	const listRef = useRef< HTMLDivElement >( null );

	useEffect( () => {
		if ( ! open ) return;
		setQuery( '' );
		setCursor( 0 );
		inputRef.current?.focus();
	}, [ open ] );

	const commands = useMemo< Command[] >( () => {
		const views: Array< { id: AdminView; label: string } > = [
			{ id: 'overview', label: __( 'Overview', 'blicks' ) },
			{ id: 'design', label: __( 'Design System', 'blicks' ) },
			{ id: 'settings', label: __( 'Settings', 'blicks' ) },
		];

		const viewCommands: Command[] = views.map( view => ( {
			id: `view:${ view.id }`,
			title: view.label,
			hint: __( 'Go to view', 'blicks' ),
			group: __( 'Views', 'blicks' ),
			run: () => onNavigate( view.id ),
		} ) );

		const sectionCommands: Command[] = DESIGN_SECTIONS.map( section => ( {
			id: `section:${ section.id }`,
			title: section.label,
			hint: __( 'Design system section', 'blicks' ),
			group: __( 'Design system', 'blicks' ),
			run: () => onOpenDesignSection( section.id ),
		} ) );

		const tokenCommands: Command[] = TOKEN_CATEGORY_KEYS.flatMap( category => {
			const slugs = snapshot.tokens[ category ] ?? [];
			return slugs.map( slug => ( {
				id: `token:${ category }:${ slug }`,
				title: tokenVar( category, slug ),
				hint: sprintf(
					/* translators: %s: token category, e.g. "Font size". */
					__( '%s token', 'blicks' ),
					titleCase( category )
				),
				group: __( 'Tokens', 'blicks' ),
				run: () => onOpenDesignSection( designSectionForCategory( category ) ),
			} ) );
		} );

		return [ ...viewCommands, ...sectionCommands, ...tokenCommands ];
	}, [ snapshot.tokens, onNavigate, onOpenDesignSection ] );

	const matches = useMemo( () => {
		const needle = query.trim().toLowerCase();
		const pool = needle
			? commands.filter( command =>
				command.title.toLowerCase().includes( needle ) || command.group.toLowerCase().includes( needle ) )
			: commands;

		return pool.slice( 0, 40 );
	}, [ commands, query ] );

	useEffect( () => {
		setCursor( current => Math.min( current, Math.max( 0, matches.length - 1 ) ) );
	}, [ matches.length ] );

	useEffect( () => {
		if ( ! open ) return;
		listRef.current
			?.querySelector< HTMLElement >( '.cmdk__item.is-active' )
			?.scrollIntoView( { block: 'nearest' } );
	}, [ cursor, open ] );

	if ( ! open ) return null;

	const choose = ( command: Command | undefined ): void => {
		if ( ! command ) return;
		command.run();
		onClose();
	};

	const onKeyDown = ( event: React.KeyboardEvent ): void => {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			onClose();
		} else if ( event.key === 'ArrowDown' ) {
			event.preventDefault();
			setCursor( current => ( matches.length === 0 ? 0 : ( current + 1 ) % matches.length ) );
		} else if ( event.key === 'ArrowUp' ) {
			event.preventDefault();
			setCursor( current => ( matches.length === 0 ? 0 : ( current - 1 + matches.length ) % matches.length ) );
		} else if ( event.key === 'Enter' ) {
			event.preventDefault();
			choose( matches[ cursor ] );
		}
	};

	let lastGroup = '';

	return (
		<div className="cmdk" role="presentation" onMouseDown={ event => { if ( event.target === event.currentTarget ) onClose(); } }>
			<div className="cmdk__panel" role="dialog" aria-modal="true" aria-label={ __( 'Search Blicks', 'blicks' ) } onKeyDown={ onKeyDown }>
				<input
					ref={ inputRef }
					className="cmdk__input"
					type="text"
					value={ query }
					spellCheck={ false }
					placeholder={ __( 'Search views and tokens…', 'blicks' ) }
					aria-label={ __( 'Search views and tokens', 'blicks' ) }
					aria-controls="blicks-cmdk-list"
					onChange={ event => { setQuery( event.currentTarget.value ); setCursor( 0 ); } }
				/>
				<div className="cmdk__list" id="blicks-cmdk-list" role="listbox" ref={ listRef }>
					{ matches.length === 0 && (
						<p className="cmdk__empty">{ __( 'No matches.', 'blicks' ) }</p>
					) }
					{ matches.map( ( command, index ) => {
						const heading = command.group !== lastGroup ? command.group : '';
						lastGroup = command.group;

						return (
							<div key={ command.id }>
								{ heading && <div className="cmdk__group">{ heading }</div> }
								<button
									type="button"
									role="option"
									aria-selected={ index === cursor }
									className={ `cmdk__item${ index === cursor ? ' is-active' : '' }` }
									onMouseEnter={ () => setCursor( index ) }
									onClick={ () => choose( command ) }
								>
									<span className="cmdk__title">{ command.title }</span>
									<span className="cmdk__hint">{ command.hint }</span>
								</button>
							</div>
						);
					} ) }
				</div>
				<div className="cmdk__foot">
					<span><b>↑↓</b> { __( 'navigate', 'blicks' ) }</span>
					<span><b>↵</b> { __( 'open', 'blicks' ) }</span>
					<span><b>esc</b> { __( 'close', 'blicks' ) }</span>
				</div>
			</div>
		</div>
	);
}

// Token categories map onto the design view's section anchors.
function designSectionForCategory( category: string ): string {
	switch ( category ) {
		case 'color': return 'color';
		case 'spacing': return 'space';
		case 'fontSize':
		case 'fontFamily':
		case 'leading': return 'type';
		case 'radius': return 'radius';
		case 'shadow': return 'shadow';
		case 'gradient': return 'gradient';
		case 'transition':
		case 'transform':
		case 'filter': return 'motion';
		case 'zIndex': return 'z';
		case 'opacity': return 'opacity';
		case 'borderWidth':
		case 'borderStyle': return 'border';
		case 'ring': return 'ring';
		case 'width':
		case 'aspect': return 'sizing';
		default: return 'themes';
	}
}
