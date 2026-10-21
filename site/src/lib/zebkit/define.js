/** Browser-only definitions. Apply the generated vocabulary before upgrade. */
export async function defineZebkit() {
	const [
		{ applyZebkitConfig },
		{ defineZbkButton },
		{ defineZbkToggle },
		{ defineZbkCodeBlock },
		{ defineZbkTabs },
		{ defineZbkDisclosure }
	] = await Promise.all([
		import('./zebkit.runtime.js'),
		import('zebkit/components/button'),
		import('zebkit/components/toggle'),
		import('zebkit/components/code-block'),
		import('zebkit/components/tabs'),
		import('zebkit/components/disclosure')
	]);

	applyZebkitConfig();
	defineZbkButton();
	defineZbkToggle();
	defineZbkTabs();
	defineZbkDisclosure();
	defineZbkCodeBlock();
}
