import { select,node,api,wire,options,displayDate } from './portal.js';

function input(form,name,label,value='',settings={}) {
  const wrapper = node('label',label);
  const element = node(settings.items?'select':settings.multiline?'textarea':'input');
  element.name = name;
  if (settings.type) element.type = settings.type;
  if (settings.items) options(element,settings.items);
  if (settings.max) element.maxLength = settings.max;
  if (settings.required) element.required = true;
  if (settings.type === 'checkbox') {
    wrapper.className = 'check';
    element.checked = value;
    wrapper.prepend(element);
  } else {
    element.value = value;
    wrapper.append(element);
  }
  form.append(wrapper);
}
function buttons(form,extra) {
  const save = node('button','Salvar','button');
  form.append(save);
  if (extra) {
    const button = node('button',extra,'button secondary');
    button.type = 'button';
    form.append(' ',button);
  }
  const output = node('output');
  output.setAttribute('aria-live','polite');
  form.append(output);
  return form.querySelector('button[type=button]');
}
function reportForm(report,states) {
  const details = node('details');
  details.append(node('summary',report.segment+' · '+report.category+' · '+report.status+' · '+displayDate(report.created)));
  const form = node('form');
  const published = report.public_record ? JSON.parse(report.public_record) : {};
  form.append(node('p',report.protocol),node('p',report.reference+' · '+report.severity+'\n'+report.description),
    node('p','Nome: '+(report.name || '—')+'\nContato: '+(report.contact || '—')+
    '\nCompartilhamento: '+(report.share?'Autorizado':'Sem autorização')+' · Atualizações: '+(report.updates?'Autorizadas':'Sem autorização')+
    '\nAviso aceito: '+report.privacy_version));
  input(form,'status','Status',report.status,{items:states});
  input(form,'note','Nota privada de revisão ou encaminhamento',report.note || '',{max:600,multiline:true});
  input(form,'publish','Publicar ponto no mapa',!!report.public_record,{type:'checkbox'});
  input(form,'title','Título público',published.title,{max:100});
  input(form,'reference','Referência pública',published.reference,{max:180});
  input(form,'description','Descrição pública',published.description,{max:1000,multiline:true});
  input(form,'evidence','Link público de evidência (HTTPS)',published.evidence,{max:600,type:'url'});
  input(form,'checked','Revisei os campos públicos e removi dados pessoais',false,{type:'checkbox'});
  const remove = buttons(form,'Excluir relato e dados');
  wire(form,async data => {
    await api('admin/report',{...data,protocol:report.protocol});
    await load();
    select('#admin-error').textContent = 'Relato atualizado.';
    return 'Salvo.';
  });
  remove.addEventListener('click',async () => {
    if (!confirm('Excluir permanentemente o relato, seu protocolo e o ponto publicado?')) return;
    try {
      await api('admin/report',{protocol:report.protocol,remove:true});
      await load();
      select('#admin-error').textContent = 'Relato excluído.';
    } catch (error) { form.querySelector('output').textContent = error.message; }
  });
  details.append(form);
  return details;
}
function commitmentForm(item,states) {
  const form = node('form');
  input(form,'kind','Tipo',item.kind || 'Reivindicação',{items:['Reivindicação','Compromisso documentado']});
  input(form,'status','Status',item.status || states[0],{items:states});
  for (const [name,label,max,required] of [['title','Título',120,true],['description','Descrição',1200,true],['origin','Origem',180,true],['owner','Responsável',180,false],['note','Observação pública',600,false]]) {
    input(form,name,label,item[name],{max,required,multiline:name==='description'||name==='note'});
  }
  input(form,'date','Data do registro',item.date,{type:'date',required:true});
  input(form,'deadline','Prazo prometido (somente compromisso)',item.deadline,{type:'date'});
  input(form,'evidence','Fonte pública (HTTPS)',item.evidence,{type:'url',max:600});
  const archive = buttons(form,item.id?'Arquivar':null);
  wire(form,async data => {
    await api('admin/commitment',{...data,id:item.id});
    await load();
    select('#admin-error').textContent = 'Registro atualizado.';
    return 'Salvo.';
  });
  archive?.addEventListener('click',async () => {
    if (!confirm('Arquivar este registro e retirá-lo do painel público?')) return;
    try {
      await api('admin/commitment',{id:item.id,archive:true});
      await load();
      select('#admin-error').textContent = 'Registro arquivado.';
    } catch (error) { form.querySelector('output').textContent = error.message; }
  });
  const details = node('details');
  details.append(node('summary',item.title || 'Cadastrar novo registro'),form);
  return details;
}
async function load() {
  const data = await api('admin/data');
  select('#login').hidden = true;
  select('#admin').hidden = false;
  select('#reports').replaceChildren(...data.reports.map(report => reportForm(report,data.reportStates)));
  if (!data.reports.length) select('#reports').append(node('p','Nenhum relato recebido.'));
  select('#entries').replaceChildren(commitmentForm({},data.commitmentStates),...data.commitments.map(item => commitmentForm(item,data.commitmentStates)));
  select('#history').replaceChildren(...data.history.map(event => {
    const record = JSON.parse(event.record);
    return node('p',displayDate(event.at)+' · '+(record.title || event.subject)+' · '+record.status+(record.note?' · '+record.note:''));
  }));
}
wire(select('#login'),async data => {
  await api('admin/login',data);
  select('#login').reset();
  await load();
  return '';
});
select('#logout').addEventListener('click',async () => {
  try {
    await api('admin/logout',{});
    for (const selector of ['#reports','#entries','#history']) select(selector).replaceChildren();
    select('#admin').hidden = true;
    select('#login').hidden = false;
  } catch (error) { select('#admin-error').textContent = error.message; }
});
load().catch(error => {
  if (error.status !== 401) select('#login output').textContent = error.message;
});
