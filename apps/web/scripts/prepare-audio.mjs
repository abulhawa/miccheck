import {build} from 'esbuild';
import {readFile, mkdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const models = path.join(root,'public/models');
const manifest = JSON.parse(await readFile(path.join(models,'manifest.json'),'utf8'));
for(const file of manifest.files) {
  const bytes = await readFile(path.join(models,file.path));
  if(createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Model checksum mismatch: ${file.path}`);
}
await mkdir(path.join(models,'runtime'),{recursive:true});
const ortDist = path.dirname(require.resolve('onnxruntime-web/wasm'));
for(const name of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs']) await copyFile(path.join(ortDist,name),path.join(models,'runtime',name));
await build({
  entryPoints:[path.join(root,'lib/ai/audioAnalysis.worker.ts')],
  outfile:path.join(root,'public/audio-analysis.worker.js'),
  bundle:true, format:'esm', platform:'browser', target:'es2022', minify:true,
  alias:{'@miccheck/audio-core':path.join(root,'../../packages/audio-core/src/index.ts'),'@miccheck/audio-metrics':path.join(root,'../../packages/audio-metrics/src/index.ts')},
});
