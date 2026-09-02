import { __ } from '@wordpress/i18n';
import { OptionCards, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';
import { TypographyControl } from '@/controls/typography/TypographyControl';
import { setValue } from '@/framework/values';

const LEVELS = [ 1, 2, 3, 4, 5, 6 ];
const ALIGNMENTS = [ 'left', 'center', 'right' ] as const;

export function cleanHeadingLevel( level: unknown ): number {
	const value = Number( level );
	if ( Number.isNaN( value ) ) return 2;
	return Math.min( 6, Math.max( 1, Math.round( value ) ) );
}

export function setHeadingAlignment(
	attributes: any,
	setAttributes: ( a: any ) => void,
	alignment: string
) {
	const next = ALIGNMENTS.includes( alignment as any ) ? alignment : 'left';
	setValue( attributes, setAttributes, 'typography.textAlign', 'default', 'base', next );
}

export function HeadingControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const level = cleanHeadingLevel( attributes.level );
	const help = useBlockHelp( 'heading' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Heading', 'blicks' ) } help={ help?.description }>
				<OptionCards
					label={ __( 'Semantic level', 'blicks' ) }
					help={ controlHelp.level }
					value={ `h${ level }` }
					columns={ 3 }
					options={ LEVELS.map( ( option ) => ( {
						label: `H${ option }`,
						value: `h${ option }`,
						hint: option === 1 ? __( 'Page title', 'blicks' ) : option === 2 ? __( 'Section', 'blicks' ) : __( 'Subhead', 'blicks' ),
					} ) ) }
					onChange={ ( value ) => setAttributes( { level: Number( value.replace( 'h', '' ) ) } ) }
				/>
			</SettingsCard>
			{ /*
			  * The type role only — every other typography field belongs to the Style tab's Type
			  * facet, which edits the state + device the author has selected. This card is pinned
			  * to `default`/`base` because a role is a base-only enum (see the `enum` rule in the
			  * style engine): a role written into a hover or mobile slot would never be emitted.
			  */ }
			<SettingsCard title={ __( 'Typography', 'blicks' ) }>
				<TypographyControl
					attributes={ attributes }
					setAttributes={ setAttributes }
					state="default"
					breakpoint="base"
					isAllowed={ ( controlId ) => controlId === 'typography.role' }
					showTypeRole
				/>
			</SettingsCard>
		</>
	);
}
