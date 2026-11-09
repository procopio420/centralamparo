import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const production = process.env.NODE_ENV === 'production';
const secret = process.env.ADMIN_KEY || '';
const origin = process.env.PUBLIC_ORIGIN || 'http://localhost:3000';
if (production && (secret.length < 32 || !origin.startsWith('https://') || !process.env.DATA_DIR)) {
  throw new Error('Configure ADMIN_KEY, PUBLIC_ORIGIN HTTPS, DATA_DIR persistente.');
}
process.umask(0o077);
const directory = process.env.DATA_DIR || 'data';
if (production && process.env.RAILWAY_ENVIRONMENT_ID && process.env.RAILWAY_VOLUME_MOUNT_PATH !== directory) {
  throw new Error('Anexe um volume persistente no caminho configurado em DATA_DIR.');
}
mkdirSync(directory, { recursive: true });
const db = new DatabaseSync(join(directory, 'portal.sqlite'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS reports (
 protocol TEXT PRIMARY KEY, created TEXT NOT NULL, segment TEXT NOT NULL,
 category TEXT NOT NULL, severity TEXT NOT NULL, reference TEXT NOT NULL, description TEXT NOT NULL,
 name TEXT NOT NULL, contact TEXT NOT NULL, privacy_version TEXT NOT NULL,
 share INTEGER NOT NULL, updates INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Em revisão',
 public_record TEXT
);
CREATE TABLE IF NOT EXISTS commitments (id TEXT PRIMARY KEY, record TEXT NOT NULL, updated TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, subject TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rates (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
`);
const seed = JSON.parse(readFileSync(new URL('public/seed.json',import.meta.url),'utf8'));
db.prepare('INSERT OR IGNORE INTO commitments(id,record,updated) VALUES (?,?,?)')
  .run('pauta-central-amparo',JSON.stringify(seed.request),'2026-11-09');
const segments = ['Quatis → Nossa Senhora do Amparo', 'Nossa Senhora do Amparo → São José do Turvo'];
const categories = ['Buraco','Lama / atoleiro','Erosão','Drenagem ruim','Falta de material','Desnível perigoso','Ponto crítico após chuva','Ponte / bueiro / manilha','Outro'];
const severities = ['Baixa','Moderada','Alta','Crítica'];
const commitmentStates = ['Reivindicação registrada','Aguardando retorno','Compromisso assumido','Em andamento','Prazo vencido','Respondido','Concluído','Não cumprido'];
const reportStates = ['Em revisão','Revisado','Encaminhado','Arquivado'];
const files = new Map([
  ['/', ['public/index.html','text/html']],
  ['/admin', ['public/admin.html','text/html']],
  ['/style.css', ['public/style.css','text/css']],
  ['/portal.js', ['public/portal.js','text/javascript']],
  ['/admin.js', ['public/admin.js','text/javascript']],
  ...['Dossie_RJ143.pdf','financeiro.csv','resumo.csv','responsabilidades.csv','segmentos_lineares.csv'].map(file =>
    ['/auditoria/'+file, ['docs/auditoria-rj143/'+file, file.endsWith('.pdf') ? 'application/pdf' : 'text/csv']])
]);
const hash = value => createHash('sha256').update(value).digest();
const sign = value => createHmac('sha256', secret).update(value).digest('hex');
const equal = (a, b) => timingSafeEqual(hash(a), hash(b));
const now = () => new Date().toISOString();
const id = () => randomBytes(16).toString('hex');
const decode = rows => rows.map(row => ({ id:row.id, ...JSON.parse(row.record), updated:row.updated }));
const json = (res, data, status = 200) => {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(data));
};
function error(status, message) {
  throw Object.assign(new Error(message), { status });
}
function field(value, max, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) error(400, 'Revise os campos obrigatórios e seus limites.');
  return value.trim();
}
function choice(value, values) {
  if (!values.includes(value)) error(400, 'Selecione uma opção válida.');
  return value;
}
function date(value, required = true) {
  const result = field(value, 10, required);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) ||
      new Date(result).toISOString().slice(0,10) !== result)) error(400, 'Informe uma data válida.');
  return result;
}
function source(value, required = true) {
  const result = field(value, 600, required);
  if (result && !/^https:\/\/[^\s]+$/i.test(result)) error(400, 'Use um link HTTPS como fonte.');
  try { if (result && (new URL(result).username || new URL(result).password)) error(400, 'Link inválido.'); }
  catch { error(400, 'Link inválido.'); }
  return result;
}
async function body(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') error(415, 'Formato inválido.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12000) error(413, 'Conteúdo muito grande.');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch { error(400, 'Conteúdo inválido.'); }
}
function limit(req, scope, maximum, seconds) {
  const stamp = Date.now();
  const ip = process.env.TRUST_PROXY === '1'
    ? (req.headers['x-forwarded-for'] || '').split(',').at(-1).trim() || req.socket.remoteAddress
    : req.socket.remoteAddress;
  const key = scope + ':' + sign(ip || 'unknown');
  db.prepare('DELETE FROM rates WHERE expires <= ?').run(stamp);
  const row = db.prepare(`INSERT INTO rates VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).get(key, stamp + seconds * 1000);
  if (row.count > maximum) error(429, 'Limite de tentativas. Aguarde e tente novamente.');
}
function authenticated(req) {
  const session = req.headers.cookie?.match(/(?:^|; )ca_session=([^;]+)/)?.[1] || '';
  const [expiry, nonce, signature] = session.split('.');
  return secret.length >= 32 && Number(expiry) > Date.now() && !!nonce && !!signature && equal(signature, sign(expiry+'.'+nonce));
}
function audit(subject, kind, record) {
  db.prepare('INSERT INTO history(subject,kind,at,record) VALUES (?,?,?,?)').run(subject,kind,now(),JSON.stringify(record));
}
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { fn(); db.exec('COMMIT'); }
  catch (err) { db.exec('ROLLBACK'); throw err; }
}
function publicData() {
  return {
    segments, categories, severities, contact:process.env.PRIVACY_CONTACT || '',
    points:db.prepare('SELECT public_record FROM reports WHERE public_record IS NOT NULL ORDER BY created DESC').all().map(row => JSON.parse(row.public_record)),
    commitments:decode(db.prepare('SELECT * FROM commitments WHERE archived=0 ORDER BY updated DESC').all()),
    timeline:[...db.prepare(`SELECT h.at,h.record FROM history h JOIN commitments c ON c.id=h.subject
       WHERE h.kind='commitment' AND c.archived=0 ORDER BY h.id DESC LIMIT 50`).all().map(row => ({at:row.at,...JSON.parse(row.record)})), ...seed.timeline]
  };
}

const pathForRobots = req => req.url.startsWith('/admin') || req.url.startsWith('/api/');

const server = createServer(async (req,res) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cache-Control','no-store');
  if (pathForRobots(req)) res.setHeader('X-Robots-Tag','noindex');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if (production) res.setHeader('Strict-Transport-Security','max-age=31536000');
  const path = req.url.split('?')[0];
  const post = req.method === 'POST';
  try {
    if (post && req.headers.origin !== origin) error(403, 'Origem inválida.');
    if (req.method === 'GET' && files.has(path)) {
      const [file,type] = files.get(path);
      res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});
      return res.end(readFileSync(new URL(file,import.meta.url)));
    }
    if (req.method === 'GET' && path === '/health') {
      db.prepare('SELECT 1 FROM reports LIMIT 1').get();
      return json(res,{ok:true});
    }
    if (req.method === 'GET' && path === '/api/public') return json(res,publicData());
    if (post && path === '/api/report') {
      limit(req,'report',8,3600);
      const data = await body(req);
      if (data.website || data.consent !== true) error(400,'Confirme o aviso de privacidade.');
      const protocol = 'RJ143-'+id().toUpperCase();
      db.prepare(`INSERT INTO reports(protocol,created,segment,category,severity,reference,description,name,contact,privacy_version,share,updates)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(protocol,now(),choice(data.segment,segments),choice(data.category,categories),
         choice(data.severity,severities),field(data.reference,180),field(data.description,2000),
         field(data.name,100,false),field(data.contact,160,false),'2026-11-09-v1',Number(data.share === true),Number(data.updates === true));
      return json(res,{protocol,status:'Em revisão'},201);
    }
    if (post && path === '/api/lookup') {
      limit(req,'lookup',30,600);
      const data = await body(req);
      const protocol = field(data.protocol,48).toUpperCase();
      if (data.action === 'remove') {
        const row = db.prepare('SELECT protocol FROM reports WHERE protocol=?').get(protocol);
        if (!row) error(404,'Protocolo não encontrado.');
        const previous = db.prepare("SELECT 1 FROM history WHERE subject=? AND kind='report' AND record=?")
          .get(protocol,JSON.stringify({status:'Remoção solicitada'}));
        if (!previous) audit(protocol,'report',{status:'Remoção solicitada'});
        return json(res,{status:'Pedido de remoção registrado para revisão'});
      }
      const row = db.prepare('SELECT status,created,public_record IS NOT NULL AS published FROM reports WHERE protocol=?').get(protocol);
      if (!row) error(404,'Protocolo não encontrado.');
      return json(res,row);
    }
    if (post && path === '/api/admin/login') {
      limit(req,'login',10,900);
      const data = await body(req);
      if (secret.length < 32 || !equal(field(data.key,256),secret)) error(401,'Credencial inválida.');
      const token = (Date.now()+1800000)+'.'+id();
      res.setHeader('Set-Cookie','ca_session='+token+'.'+sign(token)+'; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=1800'+(production?'; Secure':''));
      return json(res,{ok:true});
    }
    if (path.startsWith('/api/admin/')) {
      if (!authenticated(req)) error(401,'Entre na área de moderação.');
      if (post && path === '/api/admin/logout') {
        res.setHeader('Set-Cookie','ca_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0'+(production?'; Secure':''));
        return json(res,{ok:true});
      }
      if (req.method === 'GET' && path === '/api/admin/data') return json(res,{
        reports:db.prepare('SELECT * FROM reports ORDER BY created DESC').all(),
        commitments:decode(db.prepare('SELECT * FROM commitments WHERE archived=0 ORDER BY updated DESC').all()),
        history:db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 100').all(),
        commitmentStates,reportStates
      });
      if (req.method === 'GET' && path === '/api/admin/export') {
        res.setHeader('Content-Disposition','attachment; filename="central-amparo-dados-privados.json"');
        return json(res,{
          reports:db.prepare('SELECT * FROM reports').all(),
          commitments:db.prepare('SELECT * FROM commitments').all(),
          history:db.prepare('SELECT * FROM history').all()
        });
      }
      if (post && path === '/api/admin/report') {
        const data = await body(req);
        const protocol = field(data.protocol,48);
        const report = db.prepare('SELECT * FROM reports WHERE protocol=?').get(protocol);
        if (!report) error(404,'Relato não encontrado.');
        if (data.remove === true) {
          transaction(() => {
            db.prepare('DELETE FROM history WHERE subject=? AND kind=?').run(protocol,'report');
            db.prepare('DELETE FROM reports WHERE protocol=?').run(protocol);
          });
          return json(res,{ok:true});
        }
        const status = choice(data.status,reportStates);
        if (status === 'Encaminhado' && !report.share) error(400,'O relato não tem consentimento para compartilhamento.');
        const note = field(data.note,600,status === 'Encaminhado');
        let record = null;
        if (data.publish === true) {
          if (!['Revisado','Encaminhado'].includes(status) || data.checked !== true) error(400,'Confirme a revisão de dados pessoais antes de publicar.');
          record = {
            id:report.public_record ? JSON.parse(report.public_record).id : id(),
            segment:report.segment, category:report.category, severity:report.severity,
            title:field(data.title,100),reference:field(data.reference,180),description:field(data.description,1000),
            date:report.created.slice(0,10),status,origin:'Relato de morador revisado',
            evidence:source(data.evidence,false)
          };
        }
        transaction(() => {
          db.prepare('UPDATE reports SET status=?,public_record=? WHERE protocol=?').run(status,record?JSON.stringify(record):null,protocol);
          audit(protocol,'report',{status,published:!!record,note});
        });
        return json(res,{ok:true});
      }
      if (post && path === '/api/admin/commitment') {
        const data = await body(req);
        const key = data.id ? field(data.id,32) : id();
        if (data.id && !db.prepare('SELECT 1 FROM commitments WHERE id=? AND archived=0').get(key)) error(404,'Registro não encontrado.');
        if (data.archive === true && data.id) {
          transaction(() => {
            db.prepare('UPDATE commitments SET archived=1,updated=? WHERE id=?').run(now(),key);
            audit(key,'archive',{status:'Arquivado'});
          });
          return json(res,{ok:true});
        }
        const kind = choice(data.kind,['Reivindicação','Compromisso documentado']);
        const status = choice(data.status,commitmentStates);
        const official = kind === 'Compromisso documentado';
        if (!official && !['Reivindicação registrada','Aguardando retorno','Respondido'].includes(status)) error(400,'Esse status exige compromisso documentado.');
        if (official && commitmentStates.slice(0,2).includes(status)) error(400,'Use um status de compromisso.');
        const record = {
          kind,status,title:field(data.title,120),description:field(data.description,1200),
          origin:field(data.origin,180),owner:field(data.owner,180,official),
          date:date(data.date),deadline:official?date(data.deadline,false):'',
          evidence:source(data.evidence,official || status === 'Respondido'),note:field(data.note,600,false)
        };
        transaction(() => {
          db.prepare(`INSERT INTO commitments(id,record,updated) VALUES (?,?,?)
             ON CONFLICT(id) DO UPDATE SET record=excluded.record,updated=excluded.updated`).run(key,JSON.stringify(record),now());
          audit(key,'commitment',record);
        });
        return json(res,{ok:true});
      }
    }
    error(404,'Página não encontrada.');
  } catch (err) {
    if (!err.status) console.error(now(),req.method,'internal_error',err.code || err.name);
    if (!res.headersSent && !res.destroyed) json(res,{error:err.status?err.message:'Erro interno. Tente novamente.'},err.status || 500);
  }
});
server.requestTimeout = 15000;
server.listen(Number(process.env.PORT || 3000),process.env.HOST || '0.0.0.0');
