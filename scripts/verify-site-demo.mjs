import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const buildDirectory = new URL('../site/build/', import.meta.url).pathname;
const contentTypes = {
	'.css': 'text/css',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
		const relative = normalize(pathname).replace(/^\/+/, '');
		let file = join(buildDirectory, relative || 'index.html');
		if (!(await stat(file)).isFile()) file = join(file, 'index.html');
		response.setHeader('content-type', contentTypes[extname(file)] ?? 'application/octet-stream');
		response.end(await readFile(file));
	} catch {
		response.statusCode = 404;
		response.end('Not found');
	}
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert(address && typeof address === 'object');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const waitForState = (state) =>
	page.waitForFunction(
		(expected) => document.querySelector('.cw-viewport-demo')?.getAttribute('data-state') === expected,
		state,
	);

try {
	await page.goto(`http://127.0.0.1:${address.port}/`);
	await waitForState('below');

	await page.locator('#viewport-beacon').evaluate((element) =>
		element.scrollIntoView({ block: 'center' }),
	);
	await waitForState('within');

	await page.locator('#viewport-beacon').evaluate((element) => {
		const documentTop = element.getBoundingClientRect().top + window.scrollY;
		window.scrollTo(0, documentTop + element.getBoundingClientRect().height + 20);
	});
	await waitForState('above');

	await page.locator('.cw-viewport-demo__toggle').evaluate((button) => button.click());
	await waitForState('missing');
	assert.equal(await page.locator('#viewport-beacon').count(), 0);

	await page.locator('.cw-viewport-demo__toggle').evaluate((button) => button.click());
	await waitForState('above');
	assert.equal(await page.locator('#viewport-beacon').count(), 1);
	assert.deepEqual(pageErrors, []);
	console.log('Viewport demo verification passed: below, within, above, missing, restored.');
} finally {
	await page.close();
	await browser.close();
	await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
