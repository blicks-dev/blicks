import { __ } from '@wordpress/i18n';

/**
 * Ready-made `::before` marks — a starting point so authors don't build dots and rings from
 * nothing. Each preset is plain control values for the `before` part, written through the same
 * slots the facets edit, so everything a preset sets can then be adjusted, reset or varied by
 * state and breakpoint like any other value. Applying one also makes the block `position:relative`
 * so the absolutely-positioned mark anchors to it.
 */
export interface DecoPreset {
	id: string;
	label: string;
	/** Control id → value for the part's base slot. */
	values: Record< string, unknown >;
}

const corners = ( v: string ) => ( { topLeft: v, topRight: v, bottomRight: v, bottomLeft: v } );
const sides = ( v: string ) => ( { top: v, right: v, bottom: v, left: v } );
const box = ( width: string, height: string ) => ( { 'layout.width': width, 'layout.height': height } );
const at = ( inset: Record< string, string > ) => ( { 'position.type': 'absolute', 'position.inset': inset } );

export const DECO_PRESETS: DecoPreset[] = [
	{
		id: 'dot',
		label: __( 'Dot', 'blicks' ),
		values: { ...at( { top: '10px', left: '10px' } ), ...box( '8px', '8px' ), 'border.radius': corners( '999px' ), 'colors.background': 'primary' },
	},
	{
		id: 'ring',
		label: __( 'Ring', 'blicks' ),
		values: {
			...at( { top: '-14px', right: '-14px' } ),
			...box( '48px', '48px' ),
			'border.radius': corners( '999px' ),
			'border.width': sides( '2px' ),
			'border.style': sides( 'solid' ),
			'border.color': sides( 'primary' ),
			'effects.opacity': '0.4',
		},
	},
	{
		id: 'corner',
		label: __( 'Corner', 'blicks' ),
		values: {
			...at( { right: '8px', bottom: '8px' } ),
			...box( '14px', '14px' ),
			'border.width': { top: '0', right: '2px', bottom: '2px', left: '0' },
			'border.style': sides( 'solid' ),
			'border.color': sides( 'primary' ),
		},
	},
	{
		id: 'underline',
		label: __( 'Underline', 'blicks' ),
		values: { ...at( { bottom: '0', left: '0' } ), ...box( '40px', '3px' ), 'colors.background': 'primary' },
	},
	{
		id: 'quote',
		label: __( 'Quote', 'blicks' ),
		values: {
			'decoration.content': '“',
			...at( { top: '-10px', left: '-4px' } ),
			'typography.fontFamily': 'Georgia, "Times New Roman", serif',
			'typography.fontSize': '3rem',
			'typography.lineHeight': '1',
			'colors.text': 'primary',
			'effects.opacity': '0.25',
		},
	},
	{
		id: 'glow',
		label: __( 'Glow', 'blicks' ),
		values: {
			...at( { top: '-24px', left: '-24px' } ),
			...box( '120px', '120px' ),
			'border.radius': corners( '999px' ),
			'colors.background': 'primary',
			'effects.filter': 'blur(24px)',
			'effects.opacity': '0.45',
			'position.zIndex': '-1',
		},
	},
	{
		id: 'card-stack',
		label: __( 'Card stack', 'blicks' ),
		values: {
			...at( { top: '10px', right: '-10px', bottom: '-10px', left: '10px' } ),
			'border.width': sides( '1px' ),
			'border.style': sides( 'solid' ),
			'border.color': sides( 'border' ),
			'border.radius': corners( 'inherit' ),
			'position.zIndex': '-1',
		},
	},
	{
		id: 'swatch',
		label: __( 'Swatch', 'blicks' ),
		values: { ...at( { bottom: '10px', left: '10px' } ), ...box( '18px', '18px' ), 'border.radius': corners( '4px' ), 'colors.background': 'primary' },
	},
];
