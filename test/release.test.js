import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrity, parseRegistryIntegrity, releaseSource, validateVersion } from '../scripts/release.mjs';

test('registry integrity accepts npm scalar and singleton array output only', () => {
	const hash = integrity(Buffer.from('release artifact'));
	assert.equal(parseRegistryIntegrity(JSON.stringify(hash)), hash);
	assert.equal(parseRegistryIntegrity(JSON.stringify([hash])), hash);
	for (const value of [null, {}, [], [hash, hash]]) {
		assert.throws(() => parseRegistryIntegrity(JSON.stringify(value)));
	}
});

const sha = 'a'.repeat(40);
const repo = { full_name: 'mzebley/canvas-watch' };
const event = (branch = 'codex/release-1.1.0') => ({ action: 'closed', pull_request: {
	merged: true, head: { ref: branch, repo }, base: { ref: 'main', repo }, merge_commit_sha: sha,
} });

test('release source accepts exact version branches and immutable merge commits', () => {
	for (const branch of ['codex/release-1.1.0', 'release/1.1.0', 'release/v1.1.0', 'release-1.1.0']) {
		assert.deepEqual(releaseSource(event(branch), 'pull_request'), { version: '1.1.0', sha });
	}
	assert.deepEqual(releaseSource({ inputs: { release_version: '1.1.0' } }, 'workflow_dispatch', 'refs/heads/main', sha), { version: '1.1.0', sha });
});

test('release source rejects forks, unmerged PRs, other bases, and ambiguous versions', () => {
	for (const change of [
		(e) => { e.pull_request.merged = false; },
		(e) => { e.pull_request.head.repo = { full_name: 'fork/canvas-watch' }; },
		(e) => { e.pull_request.base.ref = 'dev'; },
		(e) => { e.pull_request.merge_commit_sha = null; },
		(e) => { e.action = 'opened'; },
	]) {
		const input = event(); change(input);
		assert.throws(() => releaseSource(input, 'pull_request'));
	}
	for (const branch of ['codex/release-automation', 'codex/release-1.1.0-rc.1', 'release/01.1.0', 'feature/1.1.0']) {
		assert.throws(() => releaseSource(event(branch), 'pull_request'));
	}
	assert.throws(() => releaseSource({ inputs: { release_version: '1.1.0' } }, 'workflow_dispatch', 'refs/heads/dev', sha));
});

test('release metadata must match package, lockfile, and dated changelog', () => {
	const pkg = { name: '@mzebley/canvas-watch', version: '1.1.0', publishConfig: { access: 'public' } };
	const lock = { version: '1.1.0', packages: { '': { version: '1.1.0' } } };
	const log = '## [1.1.0] - 2026-09-04\n';
	validateVersion(pkg, lock, log, '1.1.0');
	assert.throws(() => validateVersion(pkg, { ...lock, version: '1.0.0' }, log, '1.1.0'));
	assert.throws(() => validateVersion(pkg, lock, '## [Unreleased]', '1.1.0'));
	assert.throws(() => validateVersion({ ...pkg, publishConfig: { registry: 'https://registry.npmjs.org' } }, lock, log, '1.1.0'));
	assert.notEqual(integrity(Buffer.from('original tarball')), integrity(Buffer.from('modified tarball')));
});
