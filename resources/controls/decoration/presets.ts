import { __ } from '@wordpress/i18n';

/**
 * Ready-made `::before` decorations — a visual starting point so authors don't build dots/rings/cards
 * from raw fields. Each value is a `DecoVal` (the shape `decorationBuilder` in css/vars.ts reads).
 * Applying one also sets the block to `position:relative` so absolutely-positioned marks anchor.
 */
export interface DecoPreset {
	id: string;
	label: string;
	value: Record< string, any >;
}

const PRIMARY = 'var(--blicks-color-primary, #002bff)';
const BORDER = 'var(--blicks-color-border, rgba(0,0,0,0.12))';

export const DECO_PRESETS: DecoPreset[] = [
	{
		id: 'dot',
		label: __( 'Dot', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', width: '8px', height: '8px', borderRadius: '999px', bgColor: PRIMARY, inset: '10px auto auto 10px', pointerEvents: 'none' },
	},
	{
		id: 'ring',
		label: __( 'Ring', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', width: '48px', height: '48px', borderRadius: '999px', border: `2px solid ${ PRIMARY }`, inset: '-14px -14px auto auto', opacity: '0.4', pointerEvents: 'none' },
	},
	{
		id: 'corner',
		label: __( 'Corner', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', width: '14px', height: '14px', boxShadow: `inset -2px 0 0 0 ${ PRIMARY }, inset 0 -2px 0 0 ${ PRIMARY }`, inset: 'auto 8px 8px auto', pointerEvents: 'none' },
	},
	{
		id: 'underline',
		label: __( 'Underline', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', width: '40px', height: '3px', bgColor: PRIMARY, inset: 'auto auto 0 0' },
	},
	{
		id: 'quote',
		label: __( 'Quote', 'blicks' ),
		value: { enabled: true, content: '“', position: 'absolute', fontSize: '3rem', lineHeight: '1', color: PRIMARY, opacity: '0.25', fontFamily: 'Georgia, "Times New Roman", serif', inset: '-10px auto auto -4px', pointerEvents: 'none' },
	},
	{
		id: 'glow',
		label: __( 'Glow', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', width: '120px', height: '120px', borderRadius: '999px', background: `radial-gradient(circle, ${ PRIMARY }, transparent 70%)`, blur: '14px', opacity: '0.45', zIndex: '-1', inset: '-24px auto auto -24px', pointerEvents: 'none' },
	},
	{
		id: 'card-stack',
		label: __( 'Card stack', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', inset: '10px -10px -10px 10px', border: `1px solid ${ BORDER }`, borderRadius: 'inherit', zIndex: '-1', pointerEvents: 'none' },
	},
	{
		id: 'swatch',
		label: __( 'Swatch', 'blicks' ),
		value: { enabled: true, content: '', position: 'absolute', width: '18px', height: '18px', borderRadius: '4px', bgColor: PRIMARY, inset: 'auto auto 10px 10px' },
	},
];
