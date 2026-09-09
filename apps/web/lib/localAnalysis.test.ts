import {afterEach,expect,it,vi} from 'vitest';
import {analyzeLocally} from './localAnalysis';

let worker: {onmessage: ((event: {data: unknown}) => void) | null; onerror:(() => void) | null; terminate:ReturnType<typeof vi.fn>; postMessage:ReturnType<typeof vi.fn>};
const context = {use_case:'meetings' as const,device_type:'unknown' as const,mode:'basic' as const};
function start(controller = new AbortController(), status = vi.fn()) {
  vi.stubGlobal('Worker',class {
    onmessage = null; onerror = null; terminate = vi.fn(); postMessage = vi.fn();
    constructor(){worker=this;}
  });
  return analyzeLocally(new Float32Array(160),16000,context,{format:'pcm'},false,controller.signal,status);
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('delivers results and terminates the worker',async()=>{
  const status=vi.fn();const promise=start(undefined,status);
  worker.onmessage!({data:{status:'Loading'}});expect(status).toHaveBeenCalledWith('Loading');
  worker.onmessage!({data:{result:{specialState:'NO_SPEECH'}}});
  expect(await promise).toEqual({specialState:'NO_SPEECH'});expect(worker.terminate).toHaveBeenCalledOnce();
});
it('cancels inference without leaving a live worker',async()=>{
  const controller=new AbortController();const promise=start(controller);controller.abort();
  await expect(promise).rejects.toMatchObject({name:'AbortError'});expect(worker.terminate).toHaveBeenCalledOnce();
});
it('reports worker failure and model failure',async()=>{
  let promise=start();worker.onerror!();await expect(promise).rejects.toThrow('unavailable');
  promise=start();worker.onmessage!({data:{error:'Missing model'}});await expect(promise).rejects.toThrow('Missing model');
});
it('bounds inference time',async()=>{
  vi.useFakeTimers();const promise=start();const assertion=expect(promise).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(60000);await assertion;expect(worker.terminate).toHaveBeenCalledOnce();
});
