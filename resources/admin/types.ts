import { TOKENS } from './constants';

export type Tokens = Record< keyof typeof TOKENS, readonly string[] >;
export type TokenValues = Record< keyof typeof TOKENS, Record< string, string > >;
export type FontFamily = { slug: string; name: string; fontFamily: string; source: string };
export type TypeRoleValues = Record< string, Record< string, string > >;
export type TypeRoleSlot = { kind: 'native' | 'custom'; stylesPath?: string[]; settingsGroup?: string[] };
export type TypeRoleSnapshot = {
	roles: string[];
	props: string[];
	slots: Record< string, TypeRoleSlot >;
	base: TypeRoleValues;
	values: TypeRoleValues;
};
export type DesignOverrides = {
	tokens: Partial< Record< keyof typeof TOKENS, Record< string, string > > >;
	breakpoints: Record< string, number >;
	typeRoles: TypeRoleValues;
};
export type Breakpoint = { id: string; label: string; max: number | null };
export type DesignThemeTokens = {
	tokens: Record< string, Record< string, string > >;
	breakpoints: Record< string, number >;
	typeRoles: Record< string, Record< string, string > >;
};
export type DesignTheme = { id: string; name: string; builtin: boolean; edited: boolean; tokens: DesignThemeTokens };
export type ThemesState = { active: string; themes: DesignTheme[] };
export type AdminView = 'overview' | 'design' | 'settings';
export type TokenSourceTone = 'theme' | 'sync' | 'override' | 'draft' | 'fallback';

export type EditorStyle = {
	css: string;
	__unstableType?: string;
};

export type DesignSystemSnapshot = {
	mode: 'readOnly';
	source: {
		theme: string;
		themeJson: boolean;
		globalStyles: boolean;
	};
	tokens: Tokens;
	baseValues: TokenValues;
	values: TokenValues;
	typeRoles: TypeRoleSnapshot;
	fontLibrary: FontFamily[];
	overrides: DesignOverrides;
	breakpoints: Breakpoint[];
	counts: {
		colors: number;
		typography: number;
		spacing: number;
		radius: number;
		shadow: number;
		breakpoints: number;
		typeRoles: number;
	};
};

export type AdminSettingsSnapshot = {
	defaultInspectorPanel: 'settings' | 'styles' | 'advanced';
	helpVisibility: 'show' | 'hide';
	deleteDataOnUninstall: boolean;
	designSystem: {
		themeJsonSync: boolean;
		themeJsonSupported: boolean;
	};
};

// One recorded event, straight from a stored timestamp. The REST layer omits any event it
// cannot date, so `time` is always a real ISO-8601 string.
export type ActivityEntry = {
	id: string;
	label: string;
	detail: string;
	time: string;
};

export type DashboardSummary = {
	blocks: {
		total: number;
		interactive: number;
	};
	// How much content actually uses Blicks. The one setup step the plugin cannot complete
	// on the user's behalf, so it is measured server-side rather than assumed.
	usage: {
		posts: number;
	};
	activity: ActivityEntry[];
};

// One user-defined keyframe animation. Steps are structured (offset + declarations) rather than
// raw CSS — the `@keyframes` block is generated server-side. See docs/plans/custom-animations.md.
export type AnimationStep = {
	offset: number;
	declarations: Record< string, string >;
};

export type CustomAnimation = {
	slug: string;
	label: string;
	defaults: {
		duration?: string;
		easing?: string;
		iteration?: string;
		direction?: string;
		fillMode?: string;
	};
	steps: AnimationStep[];
};

// One row of the full library the block Motion control offers: a predefined animation (declared
// in runtime.scss, not editable) or one of the user's own.
export type LibraryAnimation = {
	slug: string;
	name: string;
	label: string;
	description: string;
	builtin: boolean;
	defaults: CustomAnimation[ 'defaults' ];
	steps: AnimationStep[];
};

export type DiagnosticsStatus = 'pass' | 'warn' | 'fail';

export type DiagnosticsCheck = {
	id: string;
	label: string;
	detail: string;
	status: DiagnosticsStatus;
};

export type DiagnosticsResult = {
	ranAt: string;
	checks: DiagnosticsCheck[];
	summary: Record< DiagnosticsStatus, number >;
};

// Injected by AssetServiceProvider as `window.blicksAdminSettings`.
export type AdminBootstrap = {
	version: string;
	view: AdminView;
	pageSlugs: Partial< Record< AdminView, string > >;
	adminUrl: string;
	docsUrl: string;
	editorUrl: string;
};

