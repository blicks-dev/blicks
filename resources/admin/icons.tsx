import { __ } from '@wordpress/i18n';

export function icon( path: JSX.Element ): JSX.Element {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
			{ path }
		</svg>
	);
}

export function StackBMark( { className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' } ): JSX.Element {
	const fill = tone === 'dark' ? '#ffffff' : 'currentColor';
	const accent = tone === 'dark' ? '#b3d5ff' : '#002bff';

	return (
		<svg className={ className } viewBox="0 0 180 180" aria-hidden="true" focusable="false">
			<g fill={ fill }>
				<rect x="20" y="20" width="100" height="40" />
				<rect x="20" y="70" width="80" height="40" />
				<rect x="20" y="120" width="110" height="40" />
			</g>
			<rect x="135" y="120" width="20" height="40" fill={ accent } />
		</svg>
	);
}

export function BrandLogo( { compact = false, label = __( 'Plugin dashboard', 'blicks' ) }: { compact?: boolean; label?: string } ): JSX.Element {
	return (
		<span className={ `brand-logo${ compact ? ' brand-logo--mini' : '' }` }>
			<StackBMark className="brand-logo__mark" />
			{ ! compact && (
				<span className="brand-logo__copy">
					<span className="brand-logo__wordmark" aria-label="Blicks">blicks</span>
					<span className="brand-logo__label">{ label }</span>
				</span>
			) }
		</span>
	);
}
