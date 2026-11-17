import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const temporary = mkdtempSync(join(tmpdir(), 'nkzw-typeahead-'));
try {
  execFileSync('vp', ['pm', 'pack', '--pack-destination', temporary], { stdio: 'pipe' });
  const archive = readdirSync(temporary).find((name) => name.endsWith('.tgz'));
  assert(archive, 'Packing should create an npm tarball.');
  const contents = execFileSync('tar', ['-tzf', join(temporary, archive)], { encoding: 'utf8' });
  for (const name of [
    'README.md',
    'LICENSE',
    'lib/index.mjs',
    'lib/index.d.mts',
    'lib/core.mjs',
    'lib/core.d.mts',
    'lib/style.css',
  ]) {
    assert(contents.includes(`package/${name}`), `Missing published file: ${name}`);
  }
  assert(!contents.includes('package/src/'), 'Source files should not be published.');
  assert(!contents.includes('package/example/'), 'The example app should not be published.');
  const packageRoot = join(temporary, 'node_modules/@nkzw/typeahead');
  mkdirSync(packageRoot, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    join(temporary, archive),
    '--strip-components=1',
    '-C',
    packageRoot,
  ]);
  mkdirSync(join(temporary, 'node_modules/@types'), { recursive: true });
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    symlinkSync(
      dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`))),
      join(temporary, 'node_modules', name),
    );
  }
  const client = readFileSync(join(packageRoot, 'lib/index.mjs'), 'utf8');
  assert.match(client, /^['"]use client['"]/);
  assert(!readFileSync(join(packageRoot, 'lib/core.mjs'), 'utf8').includes('use client'));
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    import Typeahead, { TypeaheadDataSource } from '@nkzw/typeahead';
    import { TypeaheadDataSourceEntry, parseSearchTokens } from '@nkzw/typeahead/core';
    const source = new TypeaheadDataSource();
    source.addEntries([new TypeaheadDataSourceEntry('Straße', '1', 1)]);
    assert.equal(source.getQueryResults('strasse')[0].data, 1);
    assert.deepEqual(parseSearchTokens('Café 東京'), ['cafe', '東京']);
    assert.match(renderToString(createElement(Typeahead, { dataSource: source, label: 'Search' })), /role="combobox"/);
  `,
    ],
    { cwd: temporary, stdio: 'pipe' },
  );
  writeFileSync(join(temporary, 'package.json'), '{"type":"module"}');
  writeFileSync(
    join(temporary, 'consumer.tsx'),
    `
    import Typeahead, { TypeaheadDataSource, TypeaheadDataSourceEntry, useTypeahead, type TypeaheadControls } from '@nkzw/typeahead';
    import { parseSearchTokens } from '@nkzw/typeahead/core';
    import { useRef } from 'react';
    const source = new TypeaheadDataSource<{ id: number }>();
    source.addEntries([new TypeaheadDataSourceEntry('Café', '1', { id: 1 })]);
    export function Consumer() {
      const controls = useRef<TypeaheadControls>(null);
      const input = useRef<HTMLInputElement>(null);
      const headless = useTypeahead({ dataSource: source });
      parseSearchTokens(headless.query);
      return <Typeahead controlsRef={controls} dataSource={source} inputRef={input} label="Search"
        onSelect={(entry) => String(entry.data.id)} renderInput={(props) => <input {...props} />}
        renderItem={(entry) => entry.data.id} />;
    }
  `,
  );
  writeFileSync(
    join(temporary, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        module: 'nodenext',
        noEmit: true,
        strict: true,
        target: 'es2022',
        types: ['react'],
      },
      include: ['consumer.tsx'],
    }),
  );
  execFileSync(
    process.execPath,
    [
      join(dirname(fileURLToPath(import.meta.resolve('typescript/package.json'))), 'bin/tsc'),
      '-p',
      join(temporary, 'tsconfig.json'),
    ],
    { stdio: 'pipe' },
  );
  process.stdout.write(
    'Packed package: exports, declarations, React peer, SSR, client boundary, core, CSS, and contents verified.\n',
  );
} finally {
  rmSync(temporary, { force: true, recursive: true });
}
