/**
 * Browser-only zebkit registration.
 *
 * Zebkit components are Lit custom elements, so they can only be defined where
 * `customElements` exists — the site is prerendered, so this must be imported
 * dynamically from `onMount`, never at module scope.
 *
 * `applyZebkitConfig()` carries this project's component options and variant
 * vocabulary into the browser and must run *before* any element upgrades.
 */
export async function defineZebkit() {
	const [{ applyZebkitConfig }, components] = await Promise.all([
		import('./zebkit.runtime.js'),
		import('zebkit/components')
	]);

	applyZebkitConfig();

	components.defineZbkButton();
	components.defineZbkHeading();
	components.defineZbkLink();
	components.defineZbkPanel();
	components.defineZbkRadio();
	components.defineZbkToggle();
}
