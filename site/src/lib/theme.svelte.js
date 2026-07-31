const STORAGE_KEY = 'canvas-watch-theme';

/**
 * Reactive mirror of `<html data-zbk-theme>`. The initial value is resolved by
 * the inline script in `app.html` before first paint; this just tracks it.
 */
export const theme = $state({ mode: /** @type {'light' | 'dark'} */ ('light') });

/** Read the theme the pre-paint script already decided on. */
export function syncThemeFromDocument() {
	theme.mode = document.documentElement.dataset.zbkTheme === 'dark' ? 'dark' : 'light';
}

/** @param {'light' | 'dark'} next */
export function setTheme(next) {
	theme.mode = next;
	const root = document.documentElement;
	root.dataset.zbkTheme = next;
	root.dataset.themeSource = 'manual';
	try {
		window.localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Private mode or blocked storage: the theme still applies for this visit.
	}
}

export function toggleTheme() {
	setTheme(theme.mode === 'dark' ? 'light' : 'dark');
}
