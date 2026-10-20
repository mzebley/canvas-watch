import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'mzebley/canvas-watch';
const packageName = '@mzebley/canvas-watch';
const directory = 'release-artifacts';
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const registries = { npm: 'https://registry.npmjs.org', github: 'https://npm.pkg.github.com' };

function run(command, args) {
	const result = spawnSync(command, args, { encoding: 'utf8' });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
	return result.stdout.trim();
}

export function releaseSource(event, eventName, ref, sha) {
	let version;
	if (eventName === 'workflow_dispatch') {
		assert.equal(ref, 'refs/heads/main', 'Manual releases must run on main');
		version = event.inputs?.release_version;
	} else {
		const pr = event.pull_request;
		assert.equal(eventName, 'pull_request');
		assert.equal(event.action, 'closed');
		assert.equal(pr?.merged, true, 'Only merged pull requests release');
		assert.equal(pr.base.ref, 'main');
		assert.equal(pr.base.repo.full_name, repository);
		assert.equal(pr.head.repo.full_name, repository, 'Forks cannot trigger publication');
		version = /^(?:codex\/release-|release\/v?|release-)(\d+\.\d+\.\d+)$/.exec(pr.head.ref)?.[1];
		sha = pr.merge_commit_sha;
	}
	assert.equal(typeof version, 'string', 'Release branch/input must contain an exact version');
	assert(stable.test(version), 'Only stable x.y.z releases are supported');
	assert(/^[a-f0-9]{40}$/.test(sha ?? ''), 'Missing immutable source commit');
	return { version, sha };
}

export function validateVersion(pkg, lock, changelog, version) {
	assert(stable.test(version));
	assert.equal(pkg.name, packageName);
	for (const actual of [pkg.version, lock.version, lock.packages?.['']?.version]) {
		assert.equal(actual, version, 'Package and lockfile versions must match the release');
	}
	assert(!pkg.publishConfig?.registry, 'Registry must be chosen by the publish job');
	const heading = `## [${version}] - `;
	assert(changelog.split('\n').some((line) => line.startsWith(heading) && /^\d{4}-\d{2}-\d{2}$/.test(line.slice(heading.length))), 'Missing dated changelog entry');
}

export function integrity(bytes) {
	return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

function metadata() {
	return {
		pkg: JSON.parse(readFileSync('package.json', 'utf8')),
		lock: JSON.parse(readFileSync('package-lock.json', 'utf8')),
		changelog: readFileSync('CHANGELOG.md', 'utf8'),
	};
}

function inspectArtifact() {
	const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
	assert.equal(manifest.name, packageName);
	assert(stable.test(manifest.version));
	assert.equal(manifest.filename, `mzebley-canvas-watch-${manifest.version}.tgz`);
	assert.equal(manifest.sha, run('git', ['rev-parse', 'HEAD']), 'Artifact belongs to a different commit');
	assert.equal(integrity(readFileSync(`${directory}/${manifest.filename}`)), manifest.integrity, 'Artifact integrity mismatch');
	return manifest;
}

export function parseRegistryIntegrity(output) {
	const parsed = JSON.parse(output);
	const value = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
	assert.equal(typeof value, 'string', 'Registry omitted a single integrity value');
	return value;
}

function registryIntegrity(manifest, registry) {
	const result = spawnSync('npm', ['view', `${manifest.name}@${manifest.version}`, 'dist.integrity', '--json', `--registry=${registry}`, `--@mzebley:registry=${registry}`], { encoding: 'utf8' });
	if (result.error) throw result.error;
	if (result.status === 0) {
		return parseRegistryIntegrity(result.stdout);
	}
	if (/\bE404\b/.test(result.stderr)) return null;
	throw new Error(`Registry lookup failed: ${result.stderr}`);
}

export async function main(command, target) {
	if (command === 'validate') {
		const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
		assert.equal(process.env.GITHUB_REPOSITORY, repository);
		const source = releaseSource(event, process.env.GITHUB_EVENT_NAME, process.env.GITHUB_REF, process.env.GITHUB_SHA);
		assert.equal(run('git', ['rev-parse', 'HEAD']), source.sha);
		const { pkg, lock, changelog } = metadata();
		validateVersion(pkg, lock, changelog, source.version);
		if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${source.version}\nsha=${source.sha}\n`);
		console.log(`Validated ${pkg.name}@${source.version} at ${source.sha}`);
		return;
	}
	if (command === 'pack') {
		const { pkg, lock, changelog } = metadata();
		validateVersion(pkg, lock, changelog, pkg.version);
		mkdirSync(directory, { recursive: true });
		const output = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory]);
		// Some npm versions include prepare output before their JSON result.
		const [report] = JSON.parse(output.slice(output.lastIndexOf('\n[') + 1));
		assert.equal(report.name, packageName);
		assert.equal(report.version, pkg.version);
		const files = report.files.map(({ path }) => path);
		for (const required of ['package.json', 'README.md', 'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/svelte/index.js', 'dist/svelte/index.cjs', 'dist/svelte/index.d.ts']) assert(files.includes(required), `Missing ${required}`);
		assert(files.every((path) => ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE'].includes(path) || /^dist\/[\w./-]+\.(?:js|cjs|ts|cts|map)$/.test(path)), 'Unexpected package files');
		assert(!files.some((path) => path.includes('angular')), 'Removed Angular files leaked into package');
		assert.equal(report.bundled.length, 0);
		const manifest = { name: pkg.name, version: pkg.version, sha: run('git', ['rev-parse', 'HEAD']), filename: report.filename, integrity: integrity(readFileSync(`${directory}/${report.filename}`)) };
		assert.equal(manifest.integrity, report.integrity);
		writeFileSync(`${directory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
		writeFileSync(`${directory}/pack.json`, `${JSON.stringify(report, null, 2)}\n`);
		const entry = changelog.slice(changelog.indexOf(`## [${pkg.version}] - `)).split('\n## ')[0];
		writeFileSync(`${directory}/notes.md`, `${entry.trim()}\n`);
		console.log(JSON.stringify(manifest));
		return;
	}
	const manifest = inspectArtifact();
	if (command === 'publish') {
		const registry = registries[target];
		assert(registry, 'Choose npm or github');
		const existing = registryIntegrity(manifest, registry);
		if (existing !== null) {
			assert.equal(existing, manifest.integrity, 'Published version has different contents; refusing replacement');
			console.log(`${manifest.name}@${manifest.version} already matches ${registry}`);
			return;
		}
		run('npm', ['publish', `./${directory}/${manifest.filename}`, '--ignore-scripts', `--registry=${registry}`, `--@mzebley:registry=${registry}`, '--access=public', '--tag=latest', ...(target === 'npm' ? ['--provenance'] : [])]);
		for (let attempt = 0; attempt < 6; attempt++) {
			const published = registryIntegrity(manifest, registry);
			if (published !== null) {
				assert.equal(published, manifest.integrity, 'Published artifact differs from inspected artifact');
				console.log(`Verified ${manifest.name}@${manifest.version} at ${registry}`);
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
		throw new Error('Published version is not yet visible; rerun to verify before finalizing');
	}
	assert.equal(command, 'finalize', 'Usage: release.mjs validate|pack|publish npm|publish github|finalize');
	const tag = `v${manifest.version}`;
	const existing = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]);
	if (existing) {
		run('git', ['fetch', '--no-tags', 'origin', `refs/tags/${tag}:refs/tags/${tag}`]);
		assert.equal(run('git', ['rev-list', '-n', '1', tag]), manifest.sha, 'Existing tag points to another commit');
	} else {
		run('git', ['tag', '-a', tag, manifest.sha, '-m', `Release ${tag}`]);
		run('git', ['push', 'origin', `refs/tags/${tag}`]);
	}
	const release = spawnSync('gh', ['release', 'view', tag, '--repo', repository], { encoding: 'utf8' });
	const assets = [`${directory}/${manifest.filename}`, `${directory}/manifest.json`, `${directory}/pack.json`];
	if (release.status === 0) run('gh', ['release', 'upload', tag, '--repo', repository, ...assets, '--clobber']);
	else run('gh', ['release', 'create', tag, '--repo', repository, '--verify-tag', '--title', tag, '--notes-file', `${directory}/notes.md`, ...assets]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main(process.argv[2], process.argv[3]);
}
