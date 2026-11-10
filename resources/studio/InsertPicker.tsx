/**
 * Where Insert lands, when the Studio cannot know.
 *
 * Shown against the post's own outline rather than three words of label, because the choice is
 * about a document the author has in their head and not in front of them — they have been inside a
 * full-screen Studio for ten minutes.
 *
 * The decision itself is in `insert.ts`. This renders it and takes the override. It brings its own
 * scrim: it is drawn by the launcher, over the Studio or over the library, and both ways in want
 * the same Escape and the same press-outside to mean Cancel.
 */

import { useId, useState } from '@wordpress/element';
import { useRegistry, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import type { BlockNode } from './mount';
import { requiredWrapper, type InsertDecision, type InsertTarget } from './insert';
import { useSheet } from './use-sheet';

interface Props {
	decision: InsertDecision;
	blocks: BlockNode[];
	onConfirm: ( target: InsertTarget, wrapper: string | null ) => void;
	onCancel: () => void;
}

interface Choice {
	key: string;
	target: InsertTarget;
	name: string;
	note: string;
}

export function InsertPicker( { decision, blocks, onConfirm, onCancel }: Props ): JSX.Element {
	/**
	 * Reactive where it must be, imperative where it may be.
	 *
	 * `getBlockOrder()` and `getSelectedBlockClientId()` return values the store keeps referentially
	 * stable, so `useSelect` can compare them and this re-renders exactly when the outline or the
	 * selection changes. Returning an object built here instead — or the store's selectors — would
	 * either never re-render or re-render on every tick; the first version did the former, and the
	 * cost of that mistake elsewhere in this feature was a decision made from stale state.
	 *
	 * Block titles are read through the registry rather than subscribed to. A title changes only
	 * when a block is replaced, which changes the order too, so the subscription above already
	 * covers it.
	 */
	const order: string[] = useSelect(
		( select: never ) =>
			(
				( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
					getBlockOrder: () => string[];
				}
			 ).getBlockOrder(),
		[]
	);

	const selected: string | null = useSelect(
		( select: never ) =>
			(
				( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
					getSelectedBlockClientId: () => string | null;
				}
			 ).getSelectedBlockClientId(),
		[]
	);

	const registry = useRegistry();

	const labelOf = ( id: string ): string => {
		const store = registry.select( 'core/block-editor' ) as unknown as {
			getBlockName: ( i: string ) => string | undefined;
		};
		const types = registry.select( 'core/blocks' ) as unknown as {
			getBlockType: ( n: string ) => { title?: string } | undefined;
		};
		const name = store.getBlockName( id ) ?? '';

		return types.getBlockType( name )?.title ?? name;
	};

	const choices: Choice[] = [];

	if ( selected ) {
		choices.push( {
			key: 'after',
			target: { kind: 'after', clientId: selected },
			name: __( 'After the selection', 'blicks' ),
			/* translators: %s: the selected block's name. */
			note: sprintf( __( 'Lands under %s.', 'blicks' ), labelOf( selected ) ),
		} );
	}

	choices.push( {
		key: 'end',
		target: { kind: 'end' },
		name: __( 'End of the post', 'blicks' ),
		note: __( 'After the last block.', 'blicks' ),
	} );

	if ( selected ) {
		choices.push( {
			key: 'replace',
			target: { kind: 'replace', clientId: selected },
			name: __( 'Replace the selection', 'blicks' ),
			/* translators: %s: the selected block's name. */
			note: sprintf( __( '%s and its children are removed.', 'blicks' ), labelOf( selected ) ),
		} );
	}

	const [ chosen, setChosen ] = useState< string >( () =>
		choices.some( ( c ) => c.target.kind === decision.target.kind ) ? decision.target.kind : 'end'
	);

	const wrapper = requiredWrapper( blocks );
	const { sheet, first, scrim } = useSheet< HTMLButtonElement >( onCancel );
	const id = useId();
	const target = choices.find( ( c ) => c.key === chosen )?.target ?? { kind: 'end' as const };

	return (
		<div className="bl-studio-scrim" { ...scrim }>
			<div ref={ sheet } className="bl-studio-sheet" role="dialog" aria-modal="true" aria-labelledby={ id }>
				<div className="bl-studio-sheet__head">
					<span id={ id } className="bl-studio-sheet__title">{ __( 'Insert into', 'blicks' ) }</span>
				</div>

				{ '' !== decision.reason && (
					<p className="bl-studio-sheet__why">{ decision.reason }</p>
				) }

				<div className="bl-studio-sheet__body">
					<ul className="bl-studio-sheet__outline">
						{ order.map( ( id ) => (
							<li
								key={ id }
								className={
									id === selected
										? 'bl-studio-sheet__row bl-studio-sheet__row--on'
										: 'bl-studio-sheet__row'
								}
							>
								{ labelOf( id ) }
							</li>
						) ) }
						{ order.length === 0 && (
							<li className="bl-studio-sheet__row">{ __( 'The post is empty.', 'blicks' ) }</li>
						) }
					</ul>

					<div className="bl-studio-sheet__choices">
						{ choices.map( ( choice ) => (
							<button
								key={ choice.key }
								type="button"
								aria-pressed={ choice.key === chosen }
								className={
									choice.key === chosen
										? 'bl-studio-sheet__choice bl-studio-sheet__choice--on'
										: 'bl-studio-sheet__choice'
								}
								onClick={ () => setChosen( choice.key ) }
							>
								<span className="bl-studio-sheet__choicename">{ choice.name }</span>
								<span className="bl-studio-sheet__choicenote">{ choice.note }</span>
							</button>
						) ) }

						{ /*
						 * A `parent`-restricted root cannot live at post root. Refusing would leave the
						 * author holding a composition with nowhere to put it; wrapping is what they
						 * would do by hand, so the button says so rather than doing it quietly.
						 */ }
						{ null !== wrapper && (
							<p className="bl-studio-sheet__warn">
								{ sprintf(
									/* translators: %s: the block type that will wrap the tree. */
									__( 'This needs a %s. Insert will wrap it in one.', 'blicks' ),
									wrapper.replace( /^blicks\//, '' )
								) }
							</p>
						) }

						<div className="bl-studio-sheet__actions">
							<button
								ref={ first }
								type="button"
								className="bl-studio__btn bl-studio__btn--filled"
								onClick={ () => onConfirm( target, wrapper ) }
							>
								{ __( 'Insert', 'blicks' ) }
							</button>
							<button type="button" className="bl-studio__btn" onClick={ onCancel }>
								{ __( 'Cancel', 'blicks' ) }
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
