import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { Field, Opts, Row, Sec } from '@/framework/inspector-v2/kit';
import { IconPicker } from '@/controls/IconPicker';
import { getIcon } from '@/framework/icons';
import { renderIcon } from '@/framework/icons/render';
import { cleanLayout, cleanMarker, cleanStepState } from '@/blocks/steps/model';
import { useStepPlace } from './place';

/** Icons a step most often takes: who, where, what, done. */
const OWN_ICONS = [ 'user', 'mail', 'globe', 'flag', 'rocket' ];

export function StepSettings( { attributes, setAttributes, clientId }: PanelProps ) {
	const { parent, index, makeCurrent } = useStepPlace( clientId );
	const steps = useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		return parent ? { ...store.getBlockAttributes( parent ), count: store.getBlockCount( parent ) } : {};
	}, [ parent ] ) as any;
	const state = cleanStepState( attributes.state );
	const where = {
		'': __( 'The steps have no current step.', 'blicks' ),
		done: __( 'Done — before the current step.', 'blicks' ),
		cur: __( 'The current step.', 'blicks' ),
		next: __( 'Upcoming — after the current step.', 'blicks' ),
	}[ state ];
	const own = String( attributes.icon || '' );

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note" value={ sprintf( /* translators: 1: step, 2: steps */ __( 'Step %1$d of %2$d', 'blicks' ), index + 1, steps.count ?? 0 ) }>
				<Row
					label={ __( 'This step', 'blicks' ) }
					stack
					set={ state === 'cur' }
					noteIcon="info"
					note={ ( state !== 'cur' ? __( 'Steps before it read as done, after it as upcoming.', 'blicks' ) + ' ' : '' ) + __( 'It holds a Heading and Text to start. Add anything else under them — Buttons, an Image, a List.', 'blicks' ) }
					action={ state !== 'cur' ? { label: __( 'Make it current', 'blicks' ), run: makeCurrent } : undefined }
				>
					<span>{ where }</span>
				</Row>
				{ cleanLayout( steps.layout ) === 'down' && steps.labels && (
					<Row label={ __( 'Label', 'blicks' ) } set={ !! attributes.label }>
						<Field label={ __( 'Label', 'blicks' ) } placeholder="Oct 28, 2026" value={ String( attributes.label ?? '' ) } onChange={ ( label ) => setAttributes( { label } ) } />
					</Row>
				) }
			</Sec>
			{ cleanMarker( steps.marker ) === 'icons' && (
				<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ own ? getIcon( own )?.label ?? own : __( 'Same as the steps', 'blicks' ) }>
					<Row label={ __( 'Icon', 'blicks' ) } stack set={ !! own }>
						<Opts columns={ 6 } showLabels={ false } value={ OWN_ICONS.includes( own ) || ! own ? own : null } onChange={ ( icon ) => setAttributes( { icon } ) } options={ [
							[ '', __( 'Same as the steps', 'blicks' ), <span key="same" className="tl">{ __( 'Steps', 'blicks' ) }</span> ],
							...OWN_ICONS.map( ( n ): [ string, string, JSX.Element ] => [ n, getIcon( n )?.label ?? n, <span key={ n }>{ renderIcon( n, { width: 18, height: 18, strokeWidth: 2 } ) }</span> ] ),
						] } />
					</Row>
					<Row label={ __( 'Any icon', 'blicks' ) } stack>
						<IconPicker value={ own || 'check' } allowNone onChange={ ( icon ) => setAttributes( { icon } ) } />
					</Row>
				</Sec>
			) }
		</>
	);
}
