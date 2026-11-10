/**
 * Where a new animation starts. Each is an ordinary library record — the editor opens it like any
 * other — drawn from the motion the marketplace designs kept reaching for.
 *
 * Every one moves on ANY block: transform, opacity, filter and shadow only. A sweep across a
 * gradient fill (the marketplace's "shimmer") needs a background the block may not have, so it is
 * not offered as a starting point; it is still buildable in the editor on a block that has one.
 */
import { __ } from '@wordpress/i18n';
import type { Keyframes } from './keyframes';

export interface Starter {
	id: string;
	label: string;
	hint: string;
	keyframes: Omit< Keyframes, 'slug' >;
}

const step = ( offset: number, declarations: Record< string, string > ) => ( { offset, declarations } );
const pose = ( x: number, y: number, scale: number, turn: number ): string => `translate(${ x }px, ${ y }px) scale(${ scale }) rotate(${ turn }deg)`;

export function starters(): Starter[] {
	return [
		{
			id: 'blank',
			label: __( 'Blank', 'blicks' ),
			hint: __( 'Two keyframes, nothing moving yet', 'blicks' ),
			keyframes: { label: __( 'My animation', 'blicks' ), defaults: { duration: '1000ms', easing: 'ease-in-out', iteration: 'infinite' }, steps: [ step( 0, { opacity: '1' } ), step( 100, { opacity: '1' } ) ] },
		},
		{
			id: 'jelly',
			label: __( 'Jelly', 'blicks' ),
			hint: __( 'Squash and stretch, then settle', 'blicks' ),
			keyframes: {
				label: __( 'Jelly', 'blicks' ),
				defaults: { duration: '900ms', easing: 'ease-in-out', iteration: 'infinite' },
				steps: [ step( 0, { transform: 'scale(1, 1)' } ), step( 30, { transform: 'scale(1.18, 0.84)' } ), step( 45, { transform: 'scale(0.88, 1.12)' } ), step( 60, { transform: 'scale(1.06, 0.95)' } ), step( 75, { transform: 'scale(0.98, 1.02)' } ), step( 100, { transform: 'scale(1, 1)' } ) ],
			},
		},
		{
			id: 'ring',
			label: __( 'Pulse ring', 'blicks' ),
			hint: __( 'A ring grows out and fades', 'blicks' ),
			keyframes: {
				label: __( 'Pulse ring', 'blicks' ),
				defaults: { duration: '1400ms', easing: 'ease-out', iteration: 'infinite' },
				steps: [ step( 0, { 'box-shadow': '0 0 0 0 rgb(11 87 208 / 55%)' } ), step( 100, { 'box-shadow': '0 0 0 18px rgb(11 87 208 / 0%)' } ) ],
			},
		},
		{
			id: 'heartbeat',
			label: __( 'Heartbeat', 'blicks' ),
			hint: __( 'Two quick beats, then rest', 'blicks' ),
			keyframes: {
				label: __( 'Heartbeat', 'blicks' ),
				defaults: { duration: '1200ms', easing: 'ease-in-out', iteration: 'infinite' },
				steps: [ step( 0, { transform: pose( 0, 0, 1, 0 ) } ), step( 14, { transform: pose( 0, 0, 1.12, 0 ) } ), step( 28, { transform: pose( 0, 0, 1, 0 ) } ), step( 42, { transform: pose( 0, 0, 1.12, 0 ) } ), step( 70, { transform: pose( 0, 0, 1, 0 ) } ) ],
			},
		},
		{
			id: 'wobble',
			label: __( 'Wobble', 'blicks' ),
			hint: __( 'Tilts side to side', 'blicks' ),
			keyframes: {
				label: __( 'Wobble', 'blicks' ),
				defaults: { duration: '1000ms', easing: 'ease-in-out', iteration: 'infinite' },
				steps: [ step( 0, { transform: pose( 0, 0, 1, 0 ) } ), step( 25, { transform: pose( 0, 0, 1, -6 ) } ), step( 75, { transform: pose( 0, 0, 1, 6 ) } ), step( 100, { transform: pose( 0, 0, 1, 0 ) } ) ],
			},
		},
		{
			id: 'bob',
			label: __( 'Bob', 'blicks' ),
			hint: __( 'Drifts up and back down', 'blicks' ),
			keyframes: {
				label: __( 'Bob', 'blicks' ),
				defaults: { duration: '2400ms', easing: 'ease-in-out', iteration: 'infinite' },
				steps: [ step( 0, { transform: pose( 0, 0, 1, 0 ) } ), step( 50, { transform: pose( 0, -10, 1, 0 ) } ), step( 100, { transform: pose( 0, 0, 1, 0 ) } ) ],
			},
		},
		{
			id: 'flicker',
			label: __( 'Neon flicker', 'blicks' ),
			hint: __( 'Cuts out now and then', 'blicks' ),
			keyframes: {
				label: __( 'Neon flicker', 'blicks' ),
				defaults: { duration: '2400ms', easing: 'linear', iteration: 'infinite' },
				steps: [ step( 0, { opacity: '1' } ), step( 18, { opacity: '1' } ), step( 20, { opacity: '0.3' } ), step( 22, { opacity: '1' } ), step( 53, { opacity: '1' } ), step( 55, { opacity: '0.35' } ), step( 57, { opacity: '1' } ), step( 100, { opacity: '1' } ) ],
			},
		},
		{
			id: 'glitch',
			label: __( 'Glitch', 'blicks' ),
			hint: __( 'Jumps and skews in short steps', 'blicks' ),
			keyframes: {
				label: __( 'Glitch', 'blicks' ),
				defaults: { duration: '600ms', easing: 'steps(2)', iteration: 'infinite' },
				steps: [ step( 0, { transform: 'none' } ), step( 20, { transform: 'translate(-3px, 1px) skewX(-6deg)' } ), step( 40, { transform: 'translate(3px, -1px)' } ), step( 60, { transform: 'translate(-2px, 0) skewX(4deg)' } ), step( 80, { transform: 'translate(2px, 1px)' } ), step( 100, { transform: 'none' } ) ],
			},
		},
		{
			id: 'drift',
			label: __( 'Color drift', 'blicks' ),
			hint: __( 'Its colors turn slowly round the wheel', 'blicks' ),
			keyframes: {
				label: __( 'Color drift', 'blicks' ),
				defaults: { duration: '6000ms', easing: 'linear', iteration: 'infinite' },
				steps: [ step( 0, { filter: 'hue-rotate(0deg)' } ), step( 100, { filter: 'hue-rotate(360deg)' } ) ],
			},
		},
	];
}
