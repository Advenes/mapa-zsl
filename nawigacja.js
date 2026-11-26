

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
function choose(which,p){if(!p?.named)return;chosen[which]=p;$(which).value=label(p);if(which==='end')setDestinationPrompt(false);hide(which);if(chosen.start&&chosen.end)run();}
function hide(which){$(which+'-options').hidden=true;$(which).setAttribute('aria-expanded','false');$(which).removeAttribute('aria-activedescendant');}
for(const which of ['start','end']){const input=$(which),list=$(which+'-options');let items=[],index=-1;
function mark(){Array.from(list.children).forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-selected',String(i===index));});if(index>=0){input.setAttribute('aria-activedescendant',list.children[index].id);list.children[index].scrollIntoView({block:'nearest'});}}
function show(){items=search(input.value);index=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();items.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.id=which+'-option-'+i;b.dataset.placeId=p.id;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.textContent=label(p);const detail=document.createElement('small');const duplicate=P.some(x=>x.id!==p.id&&x.level===p.level&&label(x)===label(p));detail.textContent=G.levels[p.level]+(duplicate?' · '+p.id.split('-').slice(-2).join('-'):'');b.append(detail);b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>choose(which,p));list.append(b);});if(!items.length){const b=document.createElement('div');b.textContent='Brak pasujących pomieszczeń';b.style.padding='10px';list.append(b);}list.hidden=false;input.setAttribute('aria-expanded','true');}
input.addEventListener('input',()=>{chosen[which]=null;if(which==='end'&&input.value.trim())setDestinationPrompt(false);clearRoute();show();});input.addEventListener('focus',show);input.addEventListener('blur',()=>hide(which));input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)show();if(items.length){index=index<0?(e.key==='ArrowDown'?0:items.length-1):(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;mark();}}else if(e.key==='Enter'){e.preventDefault();if(!list.hidden&&index>=0){choose(which,items[index]);return;}const exact=exactMatches(input.value);if(exact.length===1){choose(which,exact[0]);return;}if(!list.hidden&&items.length===1){choose(which,items[0]);return;}if(chosen[which]){run();return;}show();error('Wybierz konkretne pomieszczenie z listy podpowiedzi.');}else if(e.key==='Escape')hide(which);});}
function resolve(which){if(chosen[which])return chosen[which];const exact=exactMatches($(which).value);if(exact.length===1){chosen[which]=exact[0];$(which).value=label(exact[0]);return exact[0];}return null;}
function switchLevel(level, index = legs[activeLeg]?.level === level ? activeLeg : legs.findIndex(leg => leg.level === level)) {
  if (selected && selected.dataset.level !== level) clearRoomSelection();
  if (selectedStair) clearStairSelection();
  activeLevel = level;
  activeLeg = index;
  document.querySelectorAll('[data-target]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.target === level)));
  document.querySelectorAll('[data-map]').forEach(map => map.hidden = map.dataset.map !== level);
  document.querySelectorAll('[data-route-leg]').forEach(layer => layer.toggleAttribute('hidden', Number(layer.dataset.routeLeg) !== index));
  showInstruction();
}
const roomPopup = $('room-popup');
const stairPopup = $('stair-popup');
let selectedStair = null;
const mapViewport = $('map-viewport');
const mapCard = roomPopup.parentElement;
const routeControls = $('route-controls');
const routeControlsToggle = $('route-controls-toggle');
const routePage = mapCard.closest('main');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setRouteControlsCollapsed(collapsed) {
  if (routeControls.classList.contains('is-collapsed') === collapsed) return;
  if (collapsed && routeControls.contains(document.activeElement)) {
    routeControlsToggle.focus({preventScroll: true});
  }
  routeControls.classList.toggle('is-animating', !reduceMotion.matches);
  routeControls.classList.toggle('is-collapsed', collapsed);
  routeControls.inert = collapsed;
  routeControlsToggle.setAttribute('aria-expanded', String(!collapsed));
  routeControlsToggle.setAttribute('aria-label', collapsed ? 'Rozwiń panel trasy' : 'Zwiń panel trasy');
}

function showRouteView(active) {
  routePage.classList.toggle('has-route', active);
  routeControlsToggle.hidden = !active;
  setRouteControlsCollapsed(active);
}

routeControlsToggle.addEventListener('click', () => {
  setRouteControlsCollapsed(!routeControls.inert);
});
routeControls.addEventListener('transitionend', event => {
  if (event.target === routeControls && event.propertyName === 'grid-template-rows') {
    routeControls.classList.remove('is-animating');
  }
});

function positionMapPopup(anchorElement, popup) {
  const room = anchorElement.getBoundingClientRect();
  const svg = anchorElement.ownerSVGElement.getBoundingClientRect();
  const leftEdge = Math.max(room.left, svg.left);
  const rightEdge = Math.min(room.right, svg.right);
  const topEdge = Math.max(room.top, svg.top);
  const bottomEdge = Math.min(room.bottom, svg.bottom);
  const offMap = leftEdge >= rightEdge || topEdge >= bottomEdge;
  popup.toggleAttribute('data-off-map', offMap);
  if (offMap) return;

  const map = mapCard.getBoundingClientRect();
  const mapLeft = map.left + mapCard.clientLeft;
  const mapTop = map.top + mapCard.clientTop;
  const {width, height} = popup.getBoundingClientRect();
  const margin = 8;
  const gap = 10;
  const anchor = (leftEdge + rightEdge) / 2 - mapLeft;
  const left = Math.max(margin, Math.min(anchor - width / 2, mapCard.clientWidth - width - margin));
  const above = topEdge - mapTop - height - gap;
  const below = bottomEdge - mapTop + gap;
  const placeBelow = above < margin && below + height <= mapCard.clientHeight - margin;
  const top = Math.max(margin, placeBelow ? below : above);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.setProperty('--room-pointer', `${Math.max(10, Math.min(anchor - left, width - 10))}px`);
  popup.toggleAttribute('data-below', placeBelow);
}

let popupFrame = 0;
function schedulePopupPosition() {
  if ((!selected && !selectedStair) || popupFrame) return;
  popupFrame = requestAnimationFrame(() => {
    popupFrame = 0;
    if (selected) positionMapPopup(selected, roomPopup);
    if (selectedStair) positionMapPopup(selectedStair, stairPopup);
  });
}

new ResizeObserver(schedulePopupPosition).observe(mapCard);
new MutationObserver(schedulePopupPosition).observe(mapViewport, {
  subtree: true, attributes: true, attributeFilter: ['viewBox'],
});

function clearRoomSelection() {
  selected.classList.remove('selected');
  selected.setAttribute('aria-expanded', 'false');
  selected = null;
  roomPopup.hidden = true;
}

function selectRoom(room, focusActions = false) {
  const place = byId.get(room.id);
  if (!place?.named) return;
  if (selectedStair) clearStairSelection();
  const alreadySelected = room === selected;
  if (selected) clearRoomSelection();
  if (alreadySelected) return;
  selected = room;
  room.classList.add('selected');
  room.setAttribute('aria-expanded', 'true');
  $('room-name').textContent = label(place);
  roomPopup.hidden = false;
  positionMapPopup(room, roomPopup);
  if (focusActions) $('use-start').focus({preventScroll: true});
}

for (const tab of document.querySelectorAll('[data-target]')) {
  tab.addEventListener('click', () => switchLevel(tab.dataset.target));
}
for (const room of document.querySelectorAll('path.room[role="button"]')) {
  room.setAttribute('aria-controls', roomPopup.id);
  room.setAttribute('aria-expanded', 'false');
  room.addEventListener('click', () => selectRoom(room));
  room.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectRoom(room, true);
    }
  });
}
document.addEventListener('click', event => {
  if (selected && !event.target.closest('#room-popup, .map-tools, path.room[role="button"]')) {
    clearRoomSelection();
  }
  if (selectedStair && !event.target.closest('#stair-popup, .map-tools, .stair-target')) {
    clearStairSelection();
  }
});
document.addEventListener('keydown', event => {
  const anchor = selected || selectedStair;
  if (event.key !== 'Escape' || !anchor) return;
  const popup = selected ? roomPopup : stairPopup;
  const focusWasInPopup = popup.contains(document.activeElement);
  if (selected) clearRoomSelection();
  else clearStairSelection();
  if (focusWasInPopup) anchor.focus({preventScroll: true});
});
$('use-start').onclick = () => { if (selected) choose('start', byId.get(selected.id)); };
$('use-end').onclick = () => { if (selected) choose('end', byId.get(selected.id)); };
function svgEl(tag,attrs){let el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;}
function planContents(svg) {
  return svg.querySelector('[data-plan-rotation]') || svg;
}

function drawPathNetwork(viewport) {
  const layers = new Map();
  for (const svg of viewport.querySelectorAll('svg[data-plan-level-svg]')) {
    const layer = svgEl('g', {class: 'graph-layer', 'aria-hidden': 'true'});
    const plan = planContents(svg);
    plan.insertBefore(layer, plan.querySelector('.stairway-layer, .passage-layer, .route-layer'));
    layers.set(svg.dataset.planLevelSvg, layer);
  }
  for (const edge of G.edges) {
    const a = N[edge.a], b = N[edge.b];
    if (a.level !== b.level) continue;
    layers.get(a.level).append(svgEl('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      class: edge.kind === 'assumed' ? 'uncertain' : '',
    }));
  }
}
const pathsButton = $('show-paths');
pathsButton.addEventListener('click', () => {
  const viewport = $('map-viewport');
  const showing = viewport.classList.toggle('show-path-network');
  if (showing && !viewport.querySelector('.graph-layer')) drawPathNetwork(viewport);
  pathsButton.setAttribute('aria-pressed', String(showing));
});
function clearRoute() {
  result = null;
  legs = [];
  activeLeg = -1;
  showInstruction();
  document.querySelectorAll('.route-layer').forEach(layer => layer.remove());
  document.querySelectorAll('.destination,.origin,.on-route').forEach(el => el.classList.remove('destination','origin','on-route'));
  document.querySelectorAll('.stair-target.used').forEach(el => el.classList.remove('used'));
  $('status').textContent = '';
  $('reset').hidden = true;
  showRouteView(false);
  if (selectedStair) clearStairSelection();
}
function error(msg) { $('status').textContent = msg; }
const instructionPanel = $('route-instruction');
const instructionNext = $('instruction-next');

function showInstruction() {
  const leg = legs[activeLeg];
  instructionPanel.hidden = !leg?.exit;
  if (!leg?.exit) {
    $('instruction-text').textContent = '';
    return;
  }
  $('instruction-text').textContent = transitionInstruction(leg);
  instructionNext.setAttribute('aria-label', 'Przejdź do planu: ' + G.levels[leg.exit.to]);
}

instructionNext.onclick = () => {
  const exit = legs[activeLeg]?.exit;
  if (exit) switchLevel(exit.to, activeLeg + 1);
};

function transitionInstruction(leg) {
  const {edge, to} = leg.exit;
  const destination = G.levels[to];
  if (edge.stairId) {
    const goingUp = to === edge.upper;
    return (goingUp ? 'Wejdź' : 'Zejdź') + ' schodami na poziom „' + destination + '” (klatka ' + edge.stairId + ').';
  }
  if (edge.transferId === 'E') return 'Przejdź na zewnątrz do przejścia na poziom „' + destination + '”.';
  if (edge.transferId === 'D') return 'Przejdź przez drzwi do planu „' + destination + '”.';
  if (edge.transferId === 'P') return 'Przejdź łącznikiem do planu „' + destination + '”.';
  return 'Przejdź na poziom „' + destination + '”.';
}

function marker(layer, node, kind, caption) {
  layer.append(svgEl('circle', {cx: node.x, cy: node.y, class: 'route-marker marker-' + kind}));
  const x = node.x + 10, y = node.y - 9;
  const text = svgEl('text', {x, y, class: 'route-caption'});
  const rotation = Number(layer.parentElement.dataset.planRotation || 0);
  if (rotation) text.setAttribute('transform', 'rotate(' + -rotation + ' ' + x + ' ' + y + ')');
  text.textContent = caption;
  layer.append(text);
}
function clearStairSelection() {
  selectedStair.setAttribute('aria-expanded', 'false');
  selectedStair = null;
  stairPopup.hidden = true;
}

function stairClick(target, focusOptions) {
  const {stairLevel, stair: stairId} = target.dataset;
  const leg = legs[activeLeg];
  if (leg?.exit?.edge.stairId === stairId) {
    switchLevel(leg.exit.to, activeLeg + 1);
    return;
  }
  if (leg?.enter?.edge.stairId === stairId) {
    switchLevel(leg.enter.from, activeLeg - 1);
    return;
  }

  if (selected) clearRoomSelection();
  const alreadySelected = target === selectedStair;
  if (selectedStair) clearStairSelection();
  if (alreadySelected) return;
  const index = G.floorOrder.indexOf(stairLevel);
  const options = $('stair-options');
  options.replaceChildren();
  for (const offset of [-1, 1]) {
    const level = G.floorOrder[index + offset];
    if (!level) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = (offset < 0 ? '↓ ' : '↑ ') + G.levels[level];
    button.onclick = () => switchLevel(level);
    options.append(button);
  }
  selectedStair = target;
  target.setAttribute('aria-expanded', 'true');
  $('stair-name').textContent = G.stairwells[stairId].name;
  stairPopup.hidden = false;
  positionMapPopup(target, stairPopup);
  if (focusOptions) options.firstElementChild?.focus({preventScroll: true});
}
for (const el of document.querySelectorAll('.stair-target')) {
  if (el.dataset.stair) {
    el.setAttribute('aria-controls', stairPopup.id);
    el.setAttribute('aria-expanded', 'false');
  }
  const activate = (focusOptions = false) => {
    const {transferId, transferLevel} = el.dataset;
    if (!transferLevel) {
      stairClick(el, focusOptions);
      return;
    }
    const leg = legs[activeLeg];
    if (leg?.exit?.edge.transferId === transferId) switchLevel(transferLevel, activeLeg+1);
    else if (leg?.enter?.edge.transferId === transferId) switchLevel(transferLevel, activeLeg-1);
    else switchLevel(transferLevel);
  };
  el.addEventListener('click', () => activate());
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(true);
    }
  });
}
function transitionMarker(layer, node, target) {
  const center = target?.querySelector('circle');
  const cx = center?.getAttribute('cx') ?? node.x;
  const cy = center?.getAttribute('cy') ?? node.y;
  layer.append(svgEl('circle', {cx, cy, class:'route-stair-ring'}));
  const icon = target?.querySelector('.transition-icon')?.cloneNode(true);
  if (icon) layer.append(icon);
}
function draw(start,end){let leg={level:N[result.path[0]].level,ids:[result.path[0]],enter:null,exit:null,distance:0};for(let i=0;i<result.edges.length;i++){const a=N[result.path[i]],b=N[result.path[i+1]],e=result.edges[i];if(a.level!==b.level){leg.exit={node:a,edge:e,to:b.level};legs.push(leg);leg={level:b.level,ids:[result.path[i+1]],enter:{node:b,edge:e,from:a.level},exit:null,distance:0};}else{leg.ids.push(result.path[i+1]);leg.distance+=e.weight;}}legs.push(leg);
  for (const [index, l] of legs.entries()) {
    const map = document.querySelector('[data-map="'+l.level+'"] svg');
    const layer = svgEl('g', {class:'route-layer', 'aria-hidden':'true', 'data-route-leg':index});
    planContents(map).append(layer);
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
    if (l.ids.length > 1) layer.append(svgEl('g', {class: 'route-arrows'}));
    const seen = new Set();
    for (const trans of [l.enter, l.exit]) {
      if (!trans) continue;
      const {stairId, transferId} = trans.edge;
      const transitionId = stairId || transferId;
      if (transitionId) {
        const selector = stairId ? '[data-stair="'+stairId+'"]' : '[data-transfer-id="'+transferId+'"]';
        const target = map.querySelector(selector);
        if (!seen.has(transitionId)) transitionMarker(layer, trans.node, target);
        seen.add(transitionId);
        target?.classList.add('used');
      } else marker(layer, trans.node, 'uncertain', 'Przejście (orient.)');
    }
    document.querySelector('[data-target="'+l.level+'"]').classList.add('on-route');
    if (index === 0) marker(layer,N[start.node],'origin','START');
    if (index === legs.length-1) marker(layer,N[end.node],'destination','CEL');
  }
document.getElementById(start.id)?.classList.add('origin');document.getElementById(end.id)?.classList.add('destination');$('reset').hidden=false;switchLevel(start.level,0);showRouteView(true);}
function run(){clearRoute();let a=resolve('start'),b=resolve('end');if(!a||!b){error('Wybierz punkt startowy i salę z listy podpowiedzi.');return;}result=dijkstra(a.node,b.node,false);if(!result){error('Brak potwierdzonego połączenia na planie.');return;}draw(a,b);}
let guideDestinationFromLink = false;

function setDestinationPrompt(show) {
  $('end').classList.toggle('awaiting-destination', show);
  $('end-label').textContent = show ? 'Dokąd? Wpisz numer lub nazwę' : 'Dokąd? Numer lub nazwa';
}

function applyRouteLink() {
  const params = new URLSearchParams(location.search);
  const start = params.get('start')?.trim();
  const end = (params.get('cel') ?? params.get('end'))?.trim();
  const issues = [];
  for (const [field, value] of [['start', start], ['end', end]]) {
    if (!value) continue;

    const matches = exactMatches(value);
    const place = matches.length === 1 ? matches[0] : null;
    chosen[field] = place;
    $(field).value = place ? label(place) : value;
    if (!place) {
      const point = field === 'start' ? 'Start' : 'Cel';
      issues.push(matches.length
        ? point + ' z linku („' + value + '”) pasuje do kilku miejsc. Wybierz jedno z podpowiedzi.'
        : point + ' z linku („' + value + '”) nie został znaleziony. Wybierz miejsce z podpowiedzi.');
    }
  }

  switchLevel(chosen.start?.level ?? byId.get(G.start).level);
  guideDestinationFromLink = Boolean(start && chosen.start && !end);
  setDestinationPrompt(guideDestinationFromLink);
  if (issues.length) error(issues.join(' '));
  else if (chosen.start && chosen.end) run();
  return chosen.start ?? byId.get(G.start);
}

$('find').onclick = run;
const defaultStart = applyRouteLink();
$('reset').onclick = () => {
  clearRoute();
  chosen = {start: defaultStart, end: null};
  $('start').value = label(defaultStart);
  $('end').value = '';
  setDestinationPrompt(guideDestinationFromLink);
  switchLevel(defaultStart.level);
  $('find').focus();
};

// Public integration hook: compute routes using the same graph as the UI.
window.schoolNavigation={graph:G,dijkstra,search,exactMatches,route:(a,b,allow=false)=>dijkstra(byId.get(a)?.node,byId.get(b)?.node,false)||(allow?dijkstra(byId.get(a)?.node,byId.get(b)?.node,true):null)};

