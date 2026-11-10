/**
 * What this module uses of the free plugin, read off `window.blicks` at runtime: the module never
 * imports Blicks code (modules/README.md, rule 3). Typed here, narrowly, for what it calls.
 */

import type { ComponentType } from '@wordpress/element';

type ReactNode = React.ReactNode;
type CSSProperties = React.CSSProperties;

/** `[ value, label, extra? ]`; `extra` is an icon path where the control draws one. */
export type Option< V extends string = string > = [ V, string, string? ];

type Choice< V extends string > = { options: Option< V >[]; value: V | null; onChange: ( v: V ) => void };

/** The v2 inspector kit (`window.blicks.ui.v2`), as far as this module uses it. */
export interface Kit {
	Sec: ComponentType< { title?: string; value?: string; children?: ReactNode } >;
	Steps: < V extends string >( p: Choice< V > ) => JSX.Element;
	SegIcons: < V extends string >( p: Choice< V > ) => JSX.Element;
	SegText: < V extends string >( p: Choice< V > & { styles?: Partial< Record< V, CSSProperties > > } ) => JSX.Element;
	Chips: < V extends string >( p: Choice< V > ) => JSX.Element;
	Switch: ComponentType< { label: string; hint?: string; checked: boolean; onChange: ( v: boolean ) => void; disabled?: boolean } >;
	Field: ComponentType< { icon?: string; value: string; placeholder?: string; label: string; onChange: ( v: string ) => void; type?: string } >;
	Select: ComponentType< { value: string; options: Option[]; label: string; onChange: ( v: string ) => void } >;
	Slider: ComponentType< { label: string; icon?: string; min: number; max: number; step?: number; value: number; unit?: string; display?: string; onChange: ( v: number ) => void } >;
	Note: ComponentType< { children?: ReactNode } >;
	Sub: ComponentType< { children?: ReactNode } >;
	Icon: ComponentType< { d: string; size?: number } >;
}

/** What a v2 panel receives. */
export interface PanelProps {
	attributes: Record< string, any >;
	setAttributes: ( a: Record< string, unknown > ) => void;
	clientId?: string;
}

/** `defineBlock`'s `panels`: the block's own Settings and Style tabs, and what it is called. */
export interface Panels {
	Settings?: ComponentType< PanelProps >;
	Style?: ComponentType< PanelProps >;
	describe?: ( attributes: Record< string, any > ) => string;
}

export interface BlicksApi {
	version: number;
	blocks: { defineBlock: ( metadata: unknown, config: Record< string, unknown > ) => void };
	ui?: { v2?: Kit };
	values: {
		getValue: ( attributes: unknown, controlId: string, state: string, breakpoint: string ) => unknown;
		setValue: ( attributes: unknown, setAttributes: ( a: Record< string, unknown > ) => void, controlId: string, state: string, breakpoint: string, value: unknown ) => void;
	};
}

/** The free plugin's public API, or null when it is missing or too old for this module. */
export function blicks(): BlicksApi | null {
	const api = ( window as unknown as { blicks?: BlicksApi } ).blicks;
	return api && api.version >= 1 && typeof ( api.blocks as unknown as { defineBlock?: unknown } | undefined )?.defineBlock === 'function' ? api : null;
}

/** The v2 inspector kit. Read when a panel renders, so it is the one the free plugin published. */
export function kit(): Kit {
	return blicks()!.ui!.v2!;
}

/** Whether the free plugin is new enough to draw this module's v2 panels. */
export const hasKit = (): boolean => !! blicks()?.ui?.v2;
