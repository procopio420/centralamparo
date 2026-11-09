import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('relato privado, moderação, compromisso e persistência', async t => {
  const probe = createServer().listen(0,'127.0.0.1');
  await once(probe,'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = 'http://127.0.0.1:'+port;
  const directory = mkdtempSync(join(tmpdir(),'central-amparo-'));
  const key = 'test-key-that-is-not-a-production-secret';
  let child;
  let cookie;
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child,'exit');
      child.kill();
      await closed;
    }
  }
  t.after(async () => { await stop(); rmSync(directory,{recursive:true,force:true}); });
  async function start() {
    child = spawn(process.execPath,['server.js'],{
      env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:directory,PUBLIC_ORIGIN:origin,ADMIN_KEY:key},
      stdio:['ignore','ignore','inherit']
    });
    for (let attempt=0;attempt<50;attempt++) {
      try { if ((await fetch(origin+'/health')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve,25));
    }
    assert.fail('server did not start');
  }
  async function request(path,data,expected,options={}) {
    const headers = {};
    if (options.admin && cookie) headers.cookie = cookie;
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers.Origin = options.origin || origin;
    }
    const res = await fetch(origin+'/api/'+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data)});
    const payload = await res.json();
    assert.equal(res.status,expected,JSON.stringify(payload));
    if (path === 'admin/login' && res.ok) cookie = res.headers.get('set-cookie').split(';')[0];
    return payload;
  }
  await start();
  const page = await fetch(origin);
  assert.equal(page.status,200);
  assert.match(await page.text(),/A estrada precisa avançar/);
  assert.equal((await fetch(origin+'/auditoria/Dossie_RJ143.pdf')).status,200);
  const initial = await request('public',undefined,200);
  assert.equal(initial.points.length,0);
  assert.equal(initial.commitments[0].kind,'Reivindicação');
  const form = {segment:initial.segments[0],category:'Buraco',severity:'Alta',reference:'Referência privada',
    description:'<script>texto bruto</script>',name:'Nome privado',contact:'contato privado',consent:true};
  await request('report',form,403,{origin:'https://cross-origin.example'});
  await request('report',{...form,consent:false},400);
  const { protocol } = await request('report',form,201);
  assert.match(protocol,/^RJ143-[A-F0-9]{32}$/);
  assert.equal((await request('lookup',{protocol},200)).status,'Em revisão');
  assert.equal((await request('public',undefined,200)).points.length,0);
  await request('admin/data',undefined,401);
  await request('admin/login',{key},200);
  const admin = {admin:true};
  await request('admin/report',{protocol,status:'Encaminhado',note:'Teste'},400,admin);
  const moderation = {protocol,status:'Revisado',publish:true,title:'Buraco na pista',reference:'Referência pública',description:'Ponto revisado'};
  await request('admin/report',moderation,400,admin);
  await request('admin/report',{...moderation,checked:true},200,admin);
  const point = (await request('public',undefined,200)).points[0];
  assert.equal(point.title,moderation.title);
  assert.doesNotMatch(JSON.stringify(point),/privad|texto bruto|RJ143-/);
  assert.equal((await request('lookup',{protocol},200)).published,1);
  const commitment = {kind:'Compromisso documentado',status:'Compromisso assumido',title:'Compromisso de teste',
    description:'Registro de teste',origin:'Ata de teste',owner:'Órgão de teste',date:'2026-11-09',deadline:'2026-12-01'};
  await request('admin/commitment',commitment,400,admin);
  await request('admin/commitment',{...commitment,evidence:'https://example.org/ata'},200,admin);
  const current = await request('public',undefined,200);
  assert.equal(current.timeline[0].status,'Compromisso assumido');
  await request('admin/commitment',{id:current.commitments[0].id,archive:true},200,admin);
  await stop();
  await start();
  assert.equal((await request('public',undefined,200)).points.length,1);
  assert.equal((await request('public',undefined,200)).commitments.length,1);
  await request('lookup',{protocol,action:'remove'},200);
  const exported = await request('admin/export',undefined,200,admin);
  assert.equal(exported.history.at(-1).subject,protocol);
  assert.equal(JSON.parse(exported.history.at(-1).record).status,'Remoção solicitada');
  await request('admin/report',{protocol,remove:true},200,admin);
  await request('lookup',{protocol},404);
  assert.equal((await request('public',undefined,200)).points.length,0);
  for (let count=0;count<6;count++) await request('report',{...form,website:'spam'},400);
  await request('report',form,429);
});
