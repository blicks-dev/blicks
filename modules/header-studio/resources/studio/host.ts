/**
 * The parts of `window.blicks.studio` and `window.blicks.admin` this module uses, typed here.
 * Declared rather than imported: a module reaches the free plugin only at runtime (rule 3).
 */
import type { ComponentType } from '@wordpress/element';

export interface Block {
	name: string;
	clientId?: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: Block[];
}

export type Ref = Record< string, unknown >;

export interface PanelProps {
	blocks: Block[];
	selection: { clientId: string; name: string } | null;
	applyBurst: ( run: () => void ) => void;
	mode?: string;
	ref?: Ref | null;
}

export interface CanvasProps {
	width: 'desktop' | 'tablet' | 'phone';
	compact: boolean;
	focus: { clientId: string; label: string; exitLabel: string } | null;
}

export interface TreeNode {
	clientId: string;
	label: string;
	note?: string;
	children?: TreeNode[];
}

export interface Loaded {
	blocks: Block[];
	label?: string;
	note?: string;
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
		persist?: { label: string; load: ( ref: Ref ) => Promise< Loaded >; save: ( blocks: Block[], ref: Ref ) => Promise< unknown > };
		tree?: ( blocks: Block[] ) => TreeNode[];
		hidePanels?: string[];
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
	openRef: ( modeId: string, ref: Ref ) => Promise< boolean >;
	/** Opens a block of the editor in the Studio; the id it is mounted as there, or null. */
	openBlock?: ( clientId: string ) => string | null;
	entity: { load: ( ref: Ref ) => Promise< Loaded >; save: ( blocks: Block[], ref: Ref ) => Promise< unknown > };
}

export interface AdminHost {
	registerView: ( view: { id: string; render: ( props: { navigate: ( view: string ) => void } ) => JSX.Element } ) => boolean;
}

/** What the provider prints before this script (`Module::editorData()`). */
export interface EditorData {
	theme: string;
	canManage: boolean;
	siteEditor: string;
}

type Win = { blicks?: { studio?: StudioHost; admin?: AdminHost }; blicksHeaderStudio?: Partial< EditorData > };

const win = (): Win => ( 'undefined' === typeof window ? {} : ( window as unknown as Win ) );

export const studio = (): StudioHost | undefined => win().blicks?.studio;

export const admin = (): AdminHost | undefined => win().blicks?.admin;

export function editorData(): EditorData {
	const d = win().blicksHeaderStudio ?? {};
	return {
		theme: 'string' === typeof d.theme ? d.theme : '',
		canManage: true === d.canManage,
		siteEditor: 'string' === typeof d.siteEditor ? d.siteEditor : '/wp-admin/site-editor.php',
	};
}

export const MODE = 'header';

/** A header template part's ref: `{ kind: 'template-part', id: 'theme//slug' }`. */
export function partRef( id: string ): Ref {
	return { kind: 'template-part', id };
}

/** The template part id in a ref this mode opened, or ''. */
export function partId( ref: unknown ): string {
	const r = ( ref ?? {} ) as Ref;
	return 'template-part' === r.kind && 'string' === typeof r.id && /^[^/]+\/\/[a-z0-9_-]+$/i.test( r.id ) ? r.id : '';
}

/** The editor address that opens the Studio on a header: the Site Editor, with the ref in `blicks-studio`. */
export function editLink( id: string ): string {
	const ref = JSON.stringify( partRef( id ) );
	const base = editorData().siteEditor;
	const sep = base.includes( '?' ) ? '&' : '?';
	return `${ base }${ sep }p=${ encodeURIComponent( `/wp_template_part/${ id }` ) }&canvas=edit&blicks-studio=${ encodeURIComponent( `ref:${ MODE }:${ ref }` ) }`;
}
