import { useMemo, useState } from '@wordpress/element';
import { Modal, Button, TextareaControl } from '@wordpress/components';
import { BlockPreview } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';
import { registerPlugin } from '@wordpress/plugins';
import { PluginMoreMenuItem } from '@wordpress/editor';
import { __, sprintf } from '@wordpress/i18n';
import { htmlToBlockTree, type BlockDescriptor, type ImportReport } from './html-to-blocks';
import './import.scss';

const ICON = (
	<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt" strokeLinejoin="miter">
			<path d="M5 4h9l5 5v11H5z" />
			<path d="M9 13l3 3 3-3" stroke="#002bff" />
			<path d="M12 16v-6" stroke="#002bff" />
		</g>
	</svg>
);

/** Descriptor tree → real blocks (recovery-safe, via createBlock). */
function toBlock( d: BlockDescriptor ): any {
	return createBlock( d.name, d.attributes, ( d.innerBlocks || [] ).map( toBlock ) );
}

function Report( { report }: { report: ImportReport } ) {
	const total = report.controlled + report.custom;
	const coverage = total === 0 ? 100 : Math.round( ( report.controlled / total ) * 100 );
	return (
		<div className="bl-import__report">
			<div className="bl-import__stats">
				<span>{ sprintf( __( '%d blocks', 'blicks' ), report.nodes ) }</span>
				<span>{ sprintf( __( '%d%% CSS has controls', 'blicks' ), coverage ) }</span>
				<span>{ sprintf( __( '%d auto-applied', 'blicks' ), report.autoMapped ) }</span>
			</div>
			{ report.fallback.length > 0 && (
				<p className="bl-import__fallback">
					{ __( 'Kept as Custom CSS (no control or needs shaping):', 'blicks' ) }{ ' ' }
					<code>{ report.fallback.join( ', ' ) }</code>
				</p>
			) }
		</div>
	);
}

function ImportModal( { onClose }: { onClose: () => void } ) {
	const [ html, setHtml ] = useState( '' );
	const [ result, setResult ] = useState< { blocks: BlockDescriptor[]; report: ImportReport } | null >( null );
	const [ error, setError ] = useState( '' );
	const { insertBlocks } = useDispatch( 'core/block-editor' ) as any;

	const analyze = () => {
		setError( '' );
		try {
			setResult( htmlToBlockTree( html ) );
		} catch ( e: any ) {
			setResult( null );
			setError( String( e?.message || e ) );
		}
	};

	const previewBlocks = useMemo(
		() => ( result?.blocks?.length ? result.blocks.map( toBlock ) : [] ),
		[ result ]
	);

	const insert = () => {
		if ( result?.blocks?.length ) {
			insertBlocks( result.blocks.map( toBlock ) );
			onClose();
		}
	};

	return (
		<Modal title={ __( 'Import from HTML', 'blicks' ) } onRequestClose={ onClose } className="bl-import">
			<TextareaControl
				label={ __( 'Paste HTML (inline styles)', 'blicks' ) }
				help={ __( 'Maps elements to Blicks blocks; inline CSS becomes controls where possible, else scoped Custom CSS.', 'blicks' ) }
				value={ html }
				onChange={ setHtml }
				rows={ 8 }
				placeholder={ '<section style="display:flex; gap:1rem">…</section>' }
			/>
			<div className="bl-import__actions">
				<Button variant="secondary" onClick={ analyze } disabled={ ! html.trim() }>
					{ __( 'Analyze', 'blicks' ) }
				</Button>
				{ previewBlocks.length > 0 && (
					<Button variant="primary" onClick={ insert }>
						{ sprintf( __( 'Insert %d blocks', 'blicks' ), previewBlocks.length ) }
					</Button>
				) }
			</div>
			{ error && <p className="bl-import__error">{ error }</p> }
			{ result?.report && <Report report={ result.report } /> }
			{ previewBlocks.length > 0 && (
				<div className="bl-import__preview">
					<BlockPreview blocks={ previewBlocks } viewportWidth={ 1100 } />
				</div>
			) }
		</Modal>
	);
}

function BlicksImport() {
	const [ open, setOpen ] = useState( false );
	return (
		<>
			{ PluginMoreMenuItem && (
				<PluginMoreMenuItem icon={ ICON } onClick={ () => setOpen( true ) }>
					{ __( 'Import HTML', 'blicks' ) }
				</PluginMoreMenuItem>
			) }
			{ open && <ImportModal onClose={ () => setOpen( false ) } /> }
		</>
	);
}

if ( PluginMoreMenuItem ) {
	registerPlugin( 'blicks-import', { render: BlicksImport } );
}
