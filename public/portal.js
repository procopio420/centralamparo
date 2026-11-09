export const select = selector => document.querySelector(selector);
export const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};
export async function api(path, data) {
  const response = await fetch('/api/'+path, data === undefined ? {} : {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}
export function values(form) {
  return {...Object.fromEntries(new FormData(form)),
    ...Object.fromEntries([...form.querySelectorAll('[type=checkbox]')].map(input => [input.name,input.checked]))};
}
export function options(element, items, placeholder) {
  element.replaceChildren();
  if (placeholder) element.append(new Option(placeholder,''));
  items.forEach(item => element.append(new Option(item,item)));
}
export function wire(form, callback) {
  form.addEventListener('submit',async event => {
    event.preventDefault();
    const button = event.submitter;
    const output = form.querySelector('output');
    if (button) button.disabled = true;
    output.textContent = 'Aguarde…';
    try { output.textContent = await callback(values(form),button); }
    catch (error) { output.textContent = error.message; }
    finally { if (button) button.disabled = false; }
  });
}
export function evidence(parent, url) {
  if (!url) return;
  const link = node('a','Ver fonte ou evidência');
  link.href = url;
  parent.append(link);
}
export const displayDate = value => value?.length > 4 ? value.slice(0,10).split('-').reverse().join('/') : value;
function card(title, tag, description) {
  const element = node('article');
  element.append(node('span',tag,'tag'),node('h3',title),node('p',description));
  return element;
}
async function portal() {
  const form = select('#report');
  const data = await api('public');
  const segments = select('#map-segment');
  const categories = select('#map-category');
  const severities = select('#map-severity');
  for (const [filter,key,items] of [[segments,'segment',data.segments],[categories,'category',data.categories],[severities,'severity',data.severities]]) {
    options(filter,items,'Todos');
    options(form.elements[key],items,'Selecione');
    filter.addEventListener('change',renderMap);
  }
  function renderMap() {
    const points = data.points.filter(point => (!segments.value || point.segment === segments.value) &&
      (!categories.value || point.category === categories.value) && (!severities.value || point.severity === severities.value));
    const container = select('#points');
    container.replaceChildren();
    if (!points.length) container.append(node('p','Nenhum ponto publicado para este filtro.'));
    for (const button of document.querySelectorAll('[data-route]')) {
      const index = Number(button.dataset.route);
      const count = data.points.filter(point => point.segment === data.segments[index]).length;
      button.textContent = 'Trecho '+(index === 0 ? 'A' : 'B')+' · '+count+(count === 1 ? ' ponto' : ' pontos');
    }
    points.forEach(point => {
      const element = card(point.title,point.category+' · '+point.severity,point.description);
      element.append(node('p',point.segment+' · '+point.reference),node('p',displayDate(point.date)+' · '+point.status+' · '+point.origin));
      evidence(element,point.evidence);
      container.append(element);
    });
    document.querySelectorAll('[data-route]').forEach(button => {
      button.setAttribute('aria-pressed',String(segments.value === data.segments[Number(button.dataset.route)]));
    });
  }
  document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click',() => {
    const segment = data.segments[Number(button.dataset.route)];
    segments.value = segments.value === segment ? '' : segment;
    renderMap();
  }));
  renderMap();
  for (const [selector,kind] of [['#requests','Reivindicação'],['#commitments','Compromisso documentado']]) {
    const list = data.commitments.filter(item => item.kind === kind);
    if (!list.length) select(selector).append(node('p','Nenhum registro publicado nesta categoria.'));
    list.forEach(item => {
      const element = card(item.title,item.status,item.description);
      element.append(node('p','Origem: '+item.origin+' · '+displayDate(item.date)));
      if (item.owner) element.append(node('p','Responsável: '+item.owner));
      if (item.deadline) element.append(node('p','Prazo informado: '+displayDate(item.deadline)));
      if (item.updated) element.append(node('p','Atualizado em '+displayDate(item.updated)));
      if (item.note) element.append(node('p',item.note));
      evidence(element,item.evidence);
      select(selector).append(element);
    });
  }
  data.timeline.forEach(event => {
    const row = node('li',displayDate(event.at)+' · '+event.title+' · '+event.status+' ');
    evidence(row,event.evidence);
    select('#timeline').append(row);
  });
  if (data.contact) select('#privacy-contact').textContent = 'Para correção ou remoção, envie seu protocolo para '+data.contact+'.';
  form.querySelector('button').disabled = false;
  wire(form,async payload => {
    const result = await api('report',payload);
    form.reset();
    return 'Protocolo '+result.protocol+' · '+result.status+'. Guarde este código. A equipe revisará o relato antes de qualquer encaminhamento.';
  });
}
if (select('#report')) {
  wire(select('#lookup'),async (payload,button) => {
    if (button.value === 'remove') {
      if (!confirm('Solicitar à moderação a remoção deste relato?')) return '';
      return (await api('lookup',{...payload,action:'remove'})).status+'.';
    }
    const result = await api('lookup',payload);
    return result.status+' · Recebido em '+displayDate(result.created)+(result.published?' · Ponto publicado.':'.');
  });
  portal().catch(() => {
    select('#report output').textContent = 'O serviço de relatos está temporariamente indisponível.';
    select('#points').textContent = 'Não foi possível carregar os pontos.';
  });
}
