import { createHighlighter } from 'shiki';
import { snippets } from '$lib/data/snippets.js';

export const prerender = true;

/**
 * Highlight every snippet at build time. Shiki runs here and only here — the
 * client receives plain HTML with no highlighter in the bundle.
 */
export async function load() {
	const langs = [...new Set(Object.values(snippets).map((s) => s.lang))];
	const highlighter = await createHighlighter({
		themes: ['github-light', 'github-dark'],
		langs
	});

	/** @type {Record<string, { lang: string, label?: string, code: string, html: string }>} */
	const rendered = {};
	for (const [id, snippet] of Object.entries(snippets)) {
		rendered[id] = {
			...snippet,
			html: highlighter.codeToHtml(snippet.code, {
				lang: snippet.lang,
				themes: { light: 'github-light', dark: 'github-dark' },
				// Emit both themes as CSS variables; app.css picks one per theme.
				defaultColor: false
			})
		};
	}

	highlighter.dispose();

	return { snippets: rendered };
}
