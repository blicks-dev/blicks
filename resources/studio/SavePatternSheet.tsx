/**
 * Save as pattern — the middle door.
 *
 * A sheet over the canvas rather than a screen of its own, so the composition stays visible behind
 * it. The thing being named is the thing still on screen; taking it away to ask for a name is how
 * people end up naming the wrong composition.
 *
 * **It keeps you mounted.** Saving is not leaving. One session often yields several patterns — a
 * hero, then the same hero in a second colourway — and closing after each would make that three
 * sessions. Only Insert closes the Studio.
 *
 * Lives inside the Studio, unlike the Insert picker: this door touches no post and needs no outline
 * of one, so there is nothing here that the mount's own registry would answer wrongly.
 */

import { useEffect, useId, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { serialize } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';
import type { BlockNode } from './mount';
import { nameOf, usedBy } from './motion/keyframes';
import * as motion from './motion/session';
import {
	listCategories,
	messageFor,
	savePattern,
	type PatternCategory,
} from './patterns';
import { useSheet } from './use-sheet';

interface Props {
	blocks: BlockNode[];
	/** What the mount is called, offered as the starting name. */
	suggestion: string;
	onClose: () => void;
}

export function SavePatternSheet( { blocks, suggestion, onClose }: Props ): JSX.Element {
	const [ title, setTitle ] = useState( suggestion );
	const [ categories, setCategories ] = useState< PatternCategory[] >( [] );
	const [ categoryId, setCategoryId ] = useState< number | null >( null );
	const [ busy, setBusy ] = useState( false );
	const [ problem, setProblem ] = useState( '' );
	const [ saved, setSaved ] = useState( '' );
	const carried = usedBy( blocks, motion.known() );
	const { sheet, first, scrim } = useSheet< HTMLInputElement >( onClose );
	const id = useId();

	useEffect( () => {
		let live = true;

		// A site with no pattern categories is normal, not an error: the select simply offers the
		// one option, and saving uncategorised is a perfectly good outcome.
		void listCategories( apiFetch as never )
			.then( ( found ) => {
				if ( live ) {
					setCategories( found );
				}
			} )
			.catch( () => undefined );

		return () => {
			live = false;
		};
	}, [] );

	const save = async (): Promise< void > => {
		setBusy( true );
		setProblem( '' );
		setSaved( '' );

		try {
			// The site keeps what the pattern names, too: saving it here must not leave this site's
			// own copy pointing at drafts that vanish when the Studio closes.
			await motion.commit( apiFetch as never );

			const result = await savePattern(
				{ title, blocks, categoryId, keyframes: usedBy( blocks, motion.known() ) },
				apiFetch as never,
				serialize as never
			);

			setSaved(
				sprintf(
					/* translators: %s: the pattern's name. */
					__( 'Saved “%s” to this site.', 'blicks' ),
					result.title
				)
			);
		} catch ( failure ) {
			setProblem( messageFor( failure ) );
		} finally {
			setBusy( false );
		}
	};

	return (
		<div className="bl-studio-scrim" { ...scrim }>
			<div
				ref={ sheet }
				className="bl-studio-sheet"
				role="dialog"
				aria-modal="true"
				aria-labelledby={ id }
			>
				<div className="bl-studio-sheet__head">
					<span id={ id } className="bl-studio-sheet__title">
						{ __( 'Save as pattern', 'blicks' ) }
					</span>
				</div>

				<div className="bl-studio-sheet__fields">
					{ /*
					 * Abstract block geometry, not a screenshot. A pattern preview should show
					 * STRUCTURE, which is what you are choosing between on the shelf — and drawing
					 * it from the tree means there is no stored image to go stale the moment the
					 * pattern is edited.
					 */ }
					<div className="bl-studio-sheet__preview" aria-hidden="true">
						{ blocks.slice( 0, 3 ).map( ( block, index ) => (
							<span
								key={ block.clientId ?? index }
								className={
									index === 0
										? 'bl-studio-sheet__bar bl-studio-sheet__bar--lead'
										: 'bl-studio-sheet__bar'
								}
								style={ { width: `${ index === 0 ? 46 : 27 }%` } }
							/>
						) ) }
					</div>

					<label className="bl-studio-sheet__field">
						<span className="bl-studio-sheet__label">{ __( 'Name', 'blicks' ) }</span>
						<input
							ref={ first }
							type="text"
							value={ title }
							onChange={ ( event ) => setTitle( event.target.value ) }
							className="bl-studio-sheet__input"
						/>
					</label>

					<label className="bl-studio-sheet__field">
						<span className="bl-studio-sheet__label">{ __( 'Category', 'blicks' ) }</span>
						<select
							value={ categoryId ?? '' }
							onChange={ ( event ) =>
								setCategoryId( event.target.value ? Number( event.target.value ) : null )
							}
							className="bl-studio-sheet__input"
						>
							<option value="">{ __( 'Uncategorised', 'blicks' ) }</option>
							{ categories.map( ( category ) => (
								<option key={ category.id } value={ category.id }>
									{ category.name }
								</option>
							) ) }
						</select>
					</label>
				</div>

				{ carried.length > 0 && (
					<div className="bl-studio-sheet__carried">
						<span className="bl-studio-sheet__label">{ __( 'Animations carried inside the pattern', 'blicks' ) }</span>
						{ carried.map( ( record ) => (
							<span key={ record.slug } className="bl-studio-sheet__carry">
								<span className="bl-motion__pv" style={ { animation: `${ nameOf( record.slug ) } 1.6s ease-in-out infinite both` } } />
								<span>{ record.label }</span>
							</span>
						) ) }
					</div>
				) }

				<p className="bl-studio-sheet__warn">
					{ __(
						'Saved to this site as an unsynced pattern, so using it makes a copy. It appears here and in the editor’s own inserter.',
						'blicks'
					) }
				</p>

				{ '' !== problem && <p className="bl-studio-sheet__why" role="alert">{ problem }</p> }

				{ '' !== saved && <p className="bl-studio-sheet__ok" role="status">{ saved }</p> }

				<div className="bl-studio-sheet__actions">
					<button
						type="button"
						className="bl-studio__btn bl-studio__btn--filled"
						onClick={ save }
						disabled={ busy }
					>
						{ busy ? __( 'Saving…', 'blicks' ) : __( 'Save pattern', 'blicks' ) }
					</button>
					<button type="button" className="bl-studio__btn" onClick={ onClose }>
						{ '' !== saved ? __( 'Done', 'blicks' ) : __( 'Cancel', 'blicks' ) }
					</button>
					<span className="bl-studio-sheet__note">
						{ __( 'Stays mounted after saving', 'blicks' ) }
					</span>
				</div>
			</div>
		</div>
	);
}
