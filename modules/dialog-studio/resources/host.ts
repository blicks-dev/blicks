/**
 * The parts of `window.blicks` and of the page this module uses, typed here.
 *
 * Declared rather than imported: a module reaches the free plugin only through what it publishes at
 * runtime (modules/README.md, rule 3), so the shapes it relies on are written down where the
 * dependency is.
 */
import type { ComponentType } from '@wordpress/element';

export interface Block {
	name: string;
	clientId?: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: Block[];
}

/** A stored entity, as the Studio's entity route reads it. */
export interface DialogRef {
	kind: 'post';
	type: string;
	id: number;
}

export interface PanelProps {
	blocks: Block[];
	selection: { clientId: string; name: string } | null;
	applyBurst: ( run: () => void ) => void;
	mode?: string;
	ref?: Record< string, unknown > | null;
}

export interface CanvasProps {
	width: 'desktop' | 'tablet' | 'phone';
	compact: boolean;
	focus: { clientId: string; label: string; exitLabel: string } | null;
}

export interface StudioHost {
	version: number;
	registerMode: ( mode: {
		id: string;
		label: string;
		priority?: number;
		matches: ( blocks: Block[] ) => boolean;
		Canvas: ComponentType< CanvasProps >;
		widths?: boolean;
		persist?: {
			label: string;
			load: ( ref: Record< string, unknown > ) => Promise< { blocks: Block[]; label?: string; note?: string } >;
			save: ( blocks: Block[], ref: Record< string, unknown > ) => Promise< unknown >;
		};
		tree?: ( blocks: Block[] ) => { clientId: string; label: string; note?: string }[];
	} ) => boolean;
	registerPanel: ( panel: { id: string; label: string; modes?: string[]; render: ( props: PanelProps ) => JSX.Element | null } ) => boolean;
	registerNewItem: ( item: {
		id: string;
		label: string;
		description: string;
		icon?: string;
		Picker: ComponentType< { onStart: ( start: { blocks: Block[]; label: string } ) => void; onCancel: () => void } >;
	} ) => boolean;
	focus: ( clientId: string, options: { label: string; exitLabel?: string } ) => boolean;
	unfocus: () => void;
	openRef: ( modeId: string, ref: Record< string, unknown > ) => Promise< boolean >;
	entity: {
		load: ( ref: Record< string, unknown > ) => Promise< { blocks: Block[]; label?: string; note?: string } >;
		save: ( blocks: Block[], ref: Record< string, unknown > ) => Promise< unknown >;
	};
}

export interface AdminHost {
	registerView: ( view: { id: string; render: ( props: { navigate: ( view: string ) => void } ) => JSX.Element; icon?: unknown } ) => boolean;
}

/** A dialog a Button can open, as the free `blicks.dialog.targets` filter lists them. */
export interface DialogTarget {
	id: string;
	title: string;
	modal: boolean;
	source: string;
	post?: number;
	status?: string;
}

/** What the module's provider prints before this script (`Module::editorData()`). */
export interface EditorData {
	targets: DialogTarget[];
	canManage: boolean;
	restBase: string;
	postType: string;
}

type Win = { blicks?: { studio?: StudioHost; admin?: AdminHost }; blicksDialogStudio?: Partial< EditorData > };

const win = (): Win => ( 'undefined' === typeof window ? {} : ( window as unknown as Win ) );

export const studio = (): StudioHost | undefined => win().blicks?.studio;

export const admin = (): AdminHost | undefined => win().blicks?.admin;

export function editorData(): EditorData {
	const data = win().blicksDialogStudio ?? {};

	return {
		targets: Array.isArray( data.targets ) ? data.targets : [],
		canManage: true === data.canManage,
		restBase: 'string' === typeof data.restBase ? data.restBase : 'blicks-dialogs',
		postType: 'string' === typeof data.postType ? data.postType : 'blicks_dialog',
	};
}

export const POST_TYPE = 'blicks_dialog';

export const MODE = 'dialog';

/** A ref this module's mode opened, read back, or null. */
export function dialogRef( ref: unknown ): DialogRef | null {
	const r = ( ref ?? {} ) as Partial< DialogRef >;
	const id = Number( r.id );

	return 'post' === r.kind && POST_TYPE === r.type && Number.isInteger( id ) && id > 0 ? { kind: 'post', type: POST_TYPE, id } : null;
}
