

'use strict';
const G=JSON.parse(document.getElementById('graph-data').textContent), N=G.nodes, P=G.places, byId=new Map(P.map(p=>[p.id,p])), $=id=>document.getElementById(id), ns='http://www.w3.org/2000/svg';
const namedPlaces = P.filter(place => place.named);
// Weighted undirected graph. All horizontal weights are geometric lengths; stair/transfer weights are explicit estimates.
const adj=new Map(Object.keys(N).map(id=>[id,[]]));
for(const e of G.edges){adj.get(e.a).push({to:e.b,...e});adj.get(e.b).push({to:e.a,...e});}
class MinHeap{constructor(){this.a=[]}push(v){let a=this.a,i=a.length;a.push(v);while(i){let p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}pop(){let a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=v[0])break;a[i]=a[j];i=j;}a[i]=v;}return r;}get size(){return this.a.length;}}
function dijkstra(start,end,allowAssumed=false){if(!adj.has(start)||!adj.has(end))return null;const dist=new Map([[start,0]]),prev=new Map(),queue=new MinHeap();queue.push([0,start]);while(queue.size){const [d,u]=queue.pop();if(d!==dist.get(u))continue;if(u===end){let path=[u],edges=[];while(path[0]!==start){const p=prev.get(path[0]);edges.unshift(p.edge);path.unshift(p.from);}return {distance:d,path,edges};}for(const e of adj.get(u)){if(!allowAssumed&&e.kind==='assumed')continue;const n=d+e.weight;if(n<(dist.get(e.to)??Infinity)){dist.set(e.to,n);prev.set(e.to,{from:u,edge:e});queue.push([n,e.to]);}}}return null;}
let chosen={start:byId.get(G.start),end:null},selected=null,result=null,legs=[],activeLevel='parter',activeLeg=-1;
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/\s+/g,' ').trim();
const numNorm=s=>norm(s).replace(/^0+(?=\d)/,'');
const label=p=>p.displayName||[p.number,p.name].filter(Boolean).join(' – ')||'Pomieszczenie bez opisu';
const numeric=s=>/^\d+[a-z]*$/.test(s);
function search(q){const v=norm(q), vn=numNorm(v);return namedPlaces.map(p=>{const n=norm(p.number),t=norm(p.name),l=norm(label(p)),id=norm(p.id);let rank=99;
if(!v){if(p.number||p.name)rank=0;}
else if(v===id)rank=0;
else if(n&&n===v)rank=0;
else if(t&&t===v||l===v&&(p.number||p.name))rank=1;
else if(n&&numeric(v)&&numNorm(n)===vn)rank=2;
else if(n&&n.startsWith(v))rank=3;
else if(t&&t.startsWith(v))rank=4;
else if(n&&numeric(v)&&numNorm(n).startsWith(vn))rank=5;
else if((p.number||p.name)&&[t,l,n].some(x=>x.includes(v)))rank=6;
else if(id.includes(v)&&v.includes('bez-numeru'))rank=7;
return {p,rank};}).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank||label(a.p).localeCompare(label(b.p),'pl',{numeric:true})||a.p.id.localeCompare(b.p.id,'pl',{numeric:true})).map(x=>x.p);}
function exactMatches(q){const v=norm(q);if(!v)return [];const place=byId.get(q.trim());if(place)return place.named?[place]:[];const exact=namedPlaces.filter(p=>(p.number&&norm(p.number)===v)||(p.name&&norm(p.name)===v)||norm(label(p))===v);if(exact.length)return exact;return numeric(v)?namedPlaces.filter(p=>p.number&&numNorm(p.number)===numNorm(v)):[];}
function choose(which,p){if(!p?.named)return;chosen[which]=p;$(which).value=label(p);hide(which);if(chosen.start&&chosen.end)run();}
function hide(which){$(which+'-options').hidden=true;$(which).setAttribute('aria-expanded','false');$(which).removeAttribute('aria-activedescendant');}
for(const which of ['start','end']){const input=$(which),list=$(which+'-options');let items=[],index=-1;
function mark(){Array.from(list.children).forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-selected',String(i===index));});if(index>=0){input.setAttribute('aria-activedescendant',list.children[index].id);list.children[index].scrollIntoView({block:'nearest'});}}
function show(){items=search(input.value);index=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();items.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.id=which+'-option-'+i;b.dataset.placeId=p.id;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.textContent=label(p);const detail=document.createElement('small');const duplicate=P.some(x=>x.id!==p.id&&x.level===p.level&&label(x)===label(p));detail.textContent=G.levels[p.level]+(duplicate?' · '+p.id.split('-').slice(-2).join('-'):'');b.append(detail);b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>choose(which,p));list.append(b);});if(!items.length){const b=document.createElement('div');b.textContent='Brak pasujących pomieszczeń';b.style.padding='10px';list.append(b);}list.hidden=false;input.setAttribute('aria-expanded','true');}
input.addEventListener('input',()=>{chosen[which]=null;clearRoute();show();});input.addEventListener('focus',show);input.addEventListener('blur',()=>hide(which));input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)show();if(items.length){index=index<0?(e.key==='ArrowDown'?0:items.length-1):(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;mark();}}else if(e.key==='Enter'){e.preventDefault();if(!list.hidden&&index>=0){choose(which,items[index]);return;}const exact=exactMatches(input.value);if(exact.length===1){choose(which,exact[0]);return;}if(!list.hidden&&items.length===1){choose(which,items[0]);return;}if(chosen[which]){run();return;}show();error('Wybierz konkretne pomieszczenie z listy podpowiedzi.');}else if(e.key==='Escape')hide(which);});}
function resolve(which){if(chosen[which])return chosen[which];const exact=exactMatches($(which).value);if(exact.length===1){chosen[which]=exact[0];$(which).value=label(exact[0]);return exact[0];}return null;}
function switchLevel(level, index = legs[activeLeg]?.level === level ? activeLeg : legs.findIndex(leg => leg.level === level)) {
  if (selected && selected.dataset.level !== level) clearRoomSelection();
  activeLevel = level;
  activeLeg = index;
  document.querySelectorAll('[data-target]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.target === level)));
  document.querySelectorAll('[data-map]').forEach(map => map.hidden = map.dataset.map !== level);
  document.querySelectorAll('#steps button').forEach((button, i) => button.classList.toggle('current', i === index));
  document.querySelectorAll('[data-route-leg]').forEach(layer => layer.toggleAttribute('hidden', Number(layer.dataset.routeLeg) !== index));
  updateStairPanel(level);
}
function clearRoomSelection() {
  selected.classList.remove('selected');
  selected = null;
  $('room-selection').hidden = true;
}
function selectRoom(room) {
  const place = byId.get(room.id);
  if (!place?.named) return;
  const alreadySelected = room === selected;
  if (selected) clearRoomSelection();
  if (alreadySelected) return;
  selected = room;
  room.classList.add('selected');
  $('name').textContent = label(place);
  $('use-start').disabled = $('use-end').disabled = false;
  $('room-selection').hidden = false;
}
for(const b of document.querySelectorAll('[data-target]'))b.addEventListener('click',()=>switchLevel(b.dataset.target));
for(const r of document.querySelectorAll('path.room[role="button"]')){r.addEventListener('click',()=>selectRoom(r));r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRoom(r);}});}
$('use-start').onclick=()=>{if(selected){choose('start',byId.get(selected.id));}};$('use-end').onclick=()=>{if(selected)choose('end',byId.get(selected.id));};
function svgEl(tag,attrs){let el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;}
function clearRoute(){result=null;legs=[];activeLeg=-1;document.querySelectorAll('.route-layer').forEach(e=>e.remove());document.querySelectorAll('.destination,.origin,.on-route').forEach(e=>e.classList.remove('destination','origin','on-route'));$('steps').replaceChildren();$('steps').hidden=true;$('status').textContent='';$('status').className='route-status';document.querySelectorAll('.stair-target.used').forEach(e=>e.classList.remove('used'));$('stair-panel').hidden=true;}
function error(msg){$('status').textContent=msg;$('status').className='route-status error';}
function marker(layer,n,kind,label){const c=svgEl('circle',{cx:n.x,cy:n.y,class:'route-marker marker-'+kind});layer.append(c);const text=svgEl('text',{x:n.x+10,y:n.y-9,class:'route-caption'});text.textContent=label;layer.append(text);}
function transitionName(edge) {
  if (edge.stairId) return edge.stairId+' – '+G.stairwells[edge.stairId].name.toLowerCase();
  if (edge.transferId) return edge.transferId+' – '+(edge.transferName || 'łącznik z pracowniami');
  return 'Przejście orientacyjne';
}
function direction(from,to){return G.floorOrder.indexOf(to)>G.floorOrder.indexOf(from)?'w górę':'w dół';}
function panelButton(text,level,primary=false,index){const b=document.createElement('button');b.type='button';b.textContent=text;if(primary)b.className='next';b.onclick=()=>switchLevel(level,index);return b;}
function showStairPanel(title, description, buttons) {
  const detail = $('stair-detail');
  const reset = $('reset');
  const heading = document.createElement('strong');
  heading.textContent = title;
  detail.replaceChildren(heading, document.createTextNode(description));
  detail.hidden = !title;
  reset.hidden = !result;
  $('stair-controls').replaceChildren(...buttons, reset);
  $('stair-panel').hidden = false;
}
function updateStairPanel(level) {
  if (!result) {
    $('stair-panel').hidden = true;
    return;
  }
  const i = activeLeg;
  if (i < 0) {
    showStairPanel('', '', []);
    return;
  }
  const l = legs[i];
  const title = 'Etap '+(i+1)+' z '+legs.length+' · '+G.levels[level];
  let parts = [];
  if (l.enter) parts.push((l.enter.edge.transferId ? 'Wejście z planu: ' : 'Wejście z poziomu: ')+G.levels[l.enter.from]+' ('+transitionName(l.enter.edge)+').');
  if (l.exit?.edge.kind === 'stairs') parts.push('Skorzystaj z klatki '+transitionName(l.exit.edge)+'; idź '+direction(level,l.exit.to)+' na '+G.levels[l.exit.to]+'.');
  else if (l.exit?.edge.transferId === 'D') parts.push('Przejdź przez drzwi D do planu: '+G.levels[l.exit.to]+'.');
  else if (l.exit?.edge.transferId === 'E') parts.push('Idź na zewnątrz do znacznika E i przejdź do planu: '+G.levels[l.exit.to]+'.');
  else if (l.exit?.edge.transferId) parts.push('Przejdź łącznikiem '+l.exit.edge.transferId+' do planu: '+G.levels[l.exit.to]+'.');
  else if (l.exit) parts.push('Przejście orientacyjne do: '+G.levels[l.exit.to]+'.');
  else parts.push('Podążaj do celu: '+label(chosen.end)+'.');
  if (l.enter&&l.exit&&l.enter.edge.stairId&&l.enter.edge.stairId===l.exit.edge.stairId&&l.ids.length===1) parts=['Pozostań na klatce '+transitionName(l.exit.edge)+' i kontynuuj '+direction(level,l.exit.to)+' na '+G.levels[l.exit.to]+'.'];
  const buttons = [];
  if (i > 0) buttons.push(panelButton('← '+G.levels[legs[i-1].level],legs[i-1].level,false,i-1));
  if (i < legs.length-1) buttons.push(panelButton('Dalej: '+G.levels[legs[i+1].level]+' →',legs[i+1].level,true,i+1));
  showStairPanel(title, parts.join(' '), buttons);
}
function stairClick(el) {
  const level = el.dataset.stairLevel;
  const sid = el.dataset.stair;
  const l = legs[activeLeg];
  if (l?.exit?.edge.stairId === sid) {
    switchLevel(l.exit.to, activeLeg+1);
    return;
  }
  const title = sid+' · '+G.stairwells[sid].name+' — '+G.levels[level];
  const i = G.floorOrder.indexOf(level);
  const buttons = [];
  for (const j of [i-1,i+1]) if (G.floorOrder[j]) buttons.push(panelButton((j<i?'↓ ':'↑ ')+G.levels[G.floorOrder[j]],G.floorOrder[j]));
  showStairPanel(title, 'Wybierz sąsiednią kondygnację. Wyznaczona trasa pozostaje bez zmian.', buttons);
}
for (const el of document.querySelectorAll('.stair-target')) {
  const activate = () => {
    const {transferId, transferLevel} = el.dataset;
    if (!transferLevel) {
      stairClick(el);
      return;
    }
    const leg = legs[activeLeg];
    if (leg?.exit?.edge.transferId === transferId) switchLevel(transferLevel, activeLeg+1);
    else if (leg?.enter?.edge.transferId === transferId) switchLevel(transferLevel, activeLeg-1);
    else switchLevel(transferLevel);
  };
  el.addEventListener('click', activate);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });
}
function transitionMarker(layer,n,sid){layer.append(svgEl('circle',{cx:n.x,cy:n.y,class:'route-stair-ring'}));const t=svgEl('text',{x:n.x,y:n.y+4,'text-anchor':'middle',class:'route-stair-text'});t.textContent=sid;layer.append(t);}
function draw(start,end){let leg={level:N[result.path[0]].level,ids:[result.path[0]],enter:null,exit:null,distance:0};for(let i=0;i<result.edges.length;i++){const a=N[result.path[i]],b=N[result.path[i+1]],e=result.edges[i];if(a.level!==b.level){leg.exit={node:a,edge:e,to:b.level};legs.push(leg);leg={level:b.level,ids:[result.path[i+1]],enter:{node:b,edge:e,from:a.level},exit:null,distance:0};}else{leg.ids.push(result.path[i+1]);leg.distance+=e.weight;}}legs.push(leg);
  for (const [index, l] of legs.entries()) {
    const map = document.querySelector('[data-map="'+l.level+'"] svg');
    const layer = svgEl('g', {class:'route-layer', 'aria-hidden':'true', 'data-route-leg':index});
    map.append(layer);
    if (l.ids.length > 1) {
      const points = l.ids.map(id => N[id].x+','+N[id].y).join(' ');
      layer.append(svgEl('polyline', {points, class:'route-halo'}));
      layer.append(svgEl('polyline', {points, class:'route-line'}));
    }
    for (let j = 0; j < l.ids.length-1; j++) {
      const a = l.ids[j], b = l.ids[j+1];
      const edge = result.edges.find(e => (e.a===a&&e.b===b)||(e.a===b&&e.b===a));
      if (edge?.kind === 'assumed') {
        const points = N[a].x+','+N[a].y+' '+N[b].x+','+N[b].y;
        layer.append(svgEl('polyline', {points, class:'route-line route-uncertain'}));
      }
    }
    const seen = new Set();
    for (const trans of [l.enter, l.exit]) {
      if (!trans) continue;
      const {stairId, transferId} = trans.edge;
      const transitionId = stairId || transferId;
      if (transitionId) {
        if (!seen.has(transitionId)) transitionMarker(layer, trans.node, transitionId);
        seen.add(transitionId);
        const target = stairId ? '[data-stair="'+stairId+'"]' : '[data-transfer-id="'+transferId+'"]';
        map.querySelector(target)?.classList.add('used');
      } else marker(layer, trans.node, 'uncertain', 'Przejście (orient.)');
    }
    document.querySelector('[data-target="'+l.level+'"]').classList.add('on-route');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.level = l.level;
    button.textContent = (index+1)+'. '+G.levels[l.level];
    const detail = document.createElement('small');
    detail.textContent = 'Dojście do celu';
    if (l.exit) {
      const {edge, to} = l.exit;
      const arrow = edge.stairId ? (direction(l.level, to) === 'w górę' ? ' ↑' : ' ↓') : '';
      detail.textContent = transitionName(edge)+arrow+' · '+G.levels[to];
    }
    button.append(detail);
    if (index === 0) marker(layer,N[start.node],'origin','START');
    if (index === legs.length-1) marker(layer,N[end.node],'destination','CEL');
    button.onclick = () => switchLevel(l.level,index);
    $('steps').append(button);
  }
document.getElementById(start.id)?.classList.add('origin');document.getElementById(end.id)?.classList.add('destination');$('steps').hidden=false;switchLevel(start.level,0);}
function summary() {
  $('status').textContent = label(chosen.start) + ' → ' + label(chosen.end);
}
function run(){clearRoute();let a=resolve('start'),b=resolve('end');if(!a||!b){error('Wybierz punkt startowy i salę z listy podpowiedzi.');return;}result=dijkstra(a.node,b.node,false);if(!result){error('Brak potwierdzonego połączenia na planie.');return;}draw(a,b);summary();}
$('find').onclick=run;$('reset').onclick=()=>{clearRoute();chosen={start:byId.get(G.start),end:null};$('start').value=label(chosen.start);$('end').value='';switchLevel('parter');$('find').focus();};switchLevel('parter');

// Public integration hook: compute routes using the same graph as the UI.
window.schoolNavigation={graph:G,dijkstra,search,exactMatches,route:(a,b,allow=false)=>dijkstra(byId.get(a)?.node,byId.get(b)?.node,false)||(allow?dijkstra(byId.get(a)?.node,byId.get(b)?.node,true):null)};

