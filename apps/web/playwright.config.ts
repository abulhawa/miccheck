import {defineConfig} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

// A generated synthetic voice, preceded by a calibration interval. Chromium's
// fake device means these tests never request a physical microphone.
const source=readFileSync(path.resolve('public/demo/speech.wav'));
let rate=0;let pcm:Buffer|undefined;
for(let offset=12;offset+8<=source.length;){
  const kind=source.toString('ascii',offset,offset+4);const size=source.readUInt32LE(offset+4);
  if(kind==='fmt '){
    if(source.readUInt16LE(offset+8)!==1 || source.readUInt16LE(offset+10)!==1 || source.readUInt16LE(offset+22)!==16) throw new Error('Expected mono PCM16 fixture');
    rate=source.readUInt32LE(offset+12);
  }
  if(kind==='data') pcm=source.subarray(offset+8,offset+8+size);
  offset+=8+size+(size%2);
}
if(!pcm||!rate) throw new Error('Invalid speech fixture');
const size=rate*8*2;const wave=Buffer.alloc(44+size);
wave.write('RIFF',0);wave.writeUInt32LE(36+size,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);
wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*2,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(size,40);
pcm.copy(wave,44+Math.floor(rate*2.4)*2,0,Math.min(pcm.length,size-Math.floor(rate*2.4)*2));
const fixture=path.resolve('.test-assets/microphone.wav');mkdirSync(path.dirname(fixture),{recursive:true});writeFileSync(fixture,wave);

export default defineConfig({
  testDir:'./e2e',fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:'http://127.0.0.1:3100',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${fixture}`]}},
  webServer:{command:'node ../../node_modules/next/dist/bin/next start --port 3100',url:'http://127.0.0.1:3100',reuseExistingServer:!process.env.CI,timeout:60000},
});
