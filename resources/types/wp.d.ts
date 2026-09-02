// Ambient shims for @wordpress packages that don't ship TypeScript types.
// Keeps the build/typecheck unblocked; these surfaces are loosely typed on purpose.
declare module '@wordpress/block-editor';
declare module '@wordpress/data';
declare module '@wordpress/api-fetch';
declare module '@wordpress/plugins';
declare module '@wordpress/editor';
declare module '@wordpress/format-library';
declare module '@wordpress/rich-text';

interface Window {
	blicksAdminSettings?: {
		buildBaseUrl?: string;
		blockBaseUrl?: string;
		cssVariables?: string;
	};
	blicksEditorSettings?: {
		helpBaseUrl?: string;
		fontLibrary?: unknown;
		colorPalette?: unknown;
		tokenCatalogue?: unknown;
	};
	blicks?: {
		fontLibrary?: Array< {
			slug: string;
			name: string;
			fontFamily: string;
			source: string;
		} >;
		icons?: {
			register: ( lib: {
				id: string;
				label: string;
				priority: number;
				icons: Record< string, {
					label: string;
					svg: string;
					category?: string;
					keywords?: string[];
				} >;
			} ) => void;
			registerAlias: ( alias: string, target: string ) => void;
			list: () => unknown[];
			search: ( query: string ) => unknown[];
		};
	};
}
