// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useAudioPlayback} from './useAudioPlayback';

it('preserves the audio source when callbacks change and uses the latest callback',async()=>{
  const audio = new EventTarget() as HTMLAudioElement;
  Object.assign(audio,{pause:vi.fn(),load:vi.fn(),currentTime:3,removeAttribute:vi.fn()});
  const construct=vi.fn(function(){return audio;});
  vi.stubGlobal('Audio',construct);
  vi.stubGlobal('requestAnimationFrame',vi.fn());
  vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  const blob=new Blob(['test']);
  const first=vi.fn(),second=vi.fn();
  function Harness({callback}:{callback:()=>void}){useAudioPlayback({audioBlob:blob,onPlaybackEnd:callback});return null;}
  const root=createRoot(document.createElement('div'));
  try {
    await act(async()=>root.render(<Harness callback={first}/>));
    await act(async()=>root.render(<Harness callback={second}/>));
    expect(construct).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe('blob:test');
    await act(async()=>audio.dispatchEvent(new Event('ended')));
    expect(first).not.toHaveBeenCalled();expect(second).toHaveBeenCalledTimes(1);
  } finally {await act(async()=>root.unmount());create.mockRestore();revoke.mockRestore();vi.unstubAllGlobals();}
});
