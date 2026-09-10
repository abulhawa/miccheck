import {test,expect} from '@playwright/test';

test('demo runs real models with matching playable examples and no external model requests',async({page})=>{
  const errors:string[]=[];const externalModels:string[]=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('request',(request)=>{if(/onnx|\.wasm|shard.*\.bin/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:3100/'))externalModels.push(request.url());});
  await page.goto('/results');
  for(const [name,grade] of [['Clean speech','A'],['Background noise','F'],['Too much gain','F']] as const){
    await page.getByRole('button',{name:new RegExp('^'+name)}).click();
    const result=page.getByRole('region',{name:'Demo result'});
    await expect(result.getByRole('heading',{name:name+' · synthetic example'})).toBeVisible({timeout:30000});
    await expect(result).toContainText('('+grade+')');
    await result.getByRole('button',{name:'Play recording',exact:true}).click();
    await expect(result.getByRole('button',{name:'Pause playback',exact:true})).toBeVisible();
    await result.getByRole('button',{name:'Stop playback',exact:true}).click();
  }
  expect(errors).toEqual([]);expect(externalModels).toEqual([]);
});

test('records PCM, restores a paired result, compares takes, and releases tracks',async({page,context})=>{
  await context.grantPermissions(['microphone']);
  await page.addInitScript(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const tracks:MediaStreamTrack[]=[];
    Object.assign(window,{__testTracks:tracks});
    navigator.mediaDevices.getUserMedia=async(constraints)=>{const stream=await original(constraints);tracks.push(...stream.getTracks());return stream;};
  });
  await page.goto('/test');
  await page.getByRole('button',{name:'Start recording',exact:true}).click();
  await expect(page.getByRole('heading',{name:'What this result is based on'})).toBeVisible({timeout:30000});
  await expect(page.getByText('Raw PCM capture',{exact:false})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>((window as unknown as {__testTracks:MediaStreamTrack[]}).__testTracks).every((track)=>track.readyState==='ended'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('miccheck.session.v2.latest'))).not.toBeNull();
  const id=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('miccheck.session.v2.latest')!).id);
  await page.reload();
  await expect(page.getByRole('heading',{name:'What this result is based on'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('miccheck.session.v2.latest')!).id)).toBe(id);
  await page.getByRole('button',{name:'Run Another Test',exact:true}).click();
  await page.getByRole('button',{name:'Start recording',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Before and after'})).toBeVisible({timeout:30000});
  const players = page.getByRole('button',{name:'Play recording',exact:true});
  await expect(players).toHaveCount(2);
  await players.first().click();
  await expect(page.getByRole('button',{name:'Pause playback',exact:true})).toHaveCount(1);
  await players.click();
  await expect(page.getByRole('button',{name:'Pause playback',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Clear comparison'}).click();
  await expect(page.getByRole('heading',{name:'Before and after'})).toHaveCount(0);
});

test('mobile demo fits the viewport and keyboard focus is visible',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/results');
  await page.getByRole('button',{name:/^Clean speech/}).click();
  await expect(page.getByRole('region',{name:'Demo result'})).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:/^Clean speech/}).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:/^Background noise/})).toBeFocused();
});
