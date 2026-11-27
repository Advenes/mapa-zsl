'use strict';

const getById = id => document.getElementById(id);
const svgNamespace = 'http://www.w3.org/2000/svg';
const graph = JSON.parse(getById('graph-data').textContent);
const {nodes, places} = graph;
const placesById = new Map(places.map(place => [place.id, place]));
const namedPlaces = places.filter(place => place.named);

// The graph is undirected. Stair and transfer weights are estimates.
const adjacency = new Map(Object.keys(nodes).map(id => [id, []]));
for (const edge of graph.edges) {
  adjacency.get(edge.a).push({to: edge.b, ...edge});
  adjacency.get(edge.b).push({to: edge.a, ...edge});
}

class MinHeap {
  constructor() {
    this.entries = [];
  }

  push(entry) {
    const entries = this.entries;
    let index = entries.length;
    entries.push(entry);

    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (entries[parent][0] <= entry[0]) break;
      entries[index] = entries[parent];
      index = parent;
    }
    entries[index] = entry;
  }

  pop() {
    const entries = this.entries;
    const first = entries[0];
    const last = entries.pop();
    if (entries.length === 0) return first;

    let index = 0;
    while (index * 2 + 1 < entries.length) {
      let child = index * 2 + 1;
      if (child + 1 < entries.length && entries[child + 1][0] < entries[child][0]) child++;
      if (entries[child][0] >= last[0]) break;
      entries[index] = entries[child];
      index = child;
    }
    entries[index] = last;
    return first;
  }

  get size() {
    return this.entries.length;
  }
}

function dijkstra(start, end, allowAssumed = false) {
  if (!adjacency.has(start) || !adjacency.has(end)) return null;

  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const queue = new MinHeap();
  queue.push([0, start]);

  while (queue.size) {
    const [distance, current] = queue.pop();
    if (distance !== distances.get(current)) continue;
    if (current === end) {
      const path = [end];
      const edges = [];
      let node = end;
      while (node !== start) {
        const {from, edge} = previous.get(node);
        edges.push(edge);
        path.push(from);
        node = from;
      }
      return {distance, path: path.reverse(), edges: edges.reverse()};
    }

    for (const edge of adjacency.get(current)) {
      if (!allowAssumed && edge.kind === 'assumed') continue;
      const nextDistance = distance + edge.weight;
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, {from: current, edge});
        queue.push([nextDistance, edge.to]);
      }
    }
  }
  return null;
}

let chosen = {start: null, end: null};
let selectedRoom = null;
let previewedRoom = null;
let lookupMode = false;
let manualRouteSetup = false;
let hasStartFromLink = false;
let selectedStair = null;
let legs = [];
let activeLeg = -1;

function normalizeText(value) {
  return String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizeNumber = value => normalizeText(value).replace(/^0+(?=\d)/, '');
const isRoomNumber = value => /^\d+[a-z]*$/.test(value);
const placeLabel = place => place.displayName ||
  [place.number, place.name].filter(Boolean).join(' – ') || 'Pomieszczenie bez opisu';

// Rank exact IDs and numbers before names, prefixes, and partial matches.
function matchRank(place, query, queryNumber) {
  const number = normalizeText(place.number);
  const name = normalizeText(place.name);
  const display = normalizeText(placeLabel(place));
  const id = normalizeText(place.id);
  const hasLabel = Boolean(place.number || place.name);
  const compareNumber = number && isRoomNumber(query);

  if (!query) return hasLabel ? 0 : Infinity;
  if (query === id || (number && query === number)) return 0;
  if ((name && query === name) || (hasLabel && query === display)) return 1;
  if (compareNumber && normalizeNumber(number) === queryNumber) return 2;
  if (number && number.startsWith(query)) return 3;
  if (name && name.startsWith(query)) return 4;
  if (compareNumber && normalizeNumber(number).startsWith(queryNumber)) return 5;
  if (hasLabel && [name, display, number].some(value => value.includes(query))) return 6;
  if (query.includes('bez-numeru') && id.includes(query)) return 7;
  return Infinity;
}

function search(value) {
  const query = normalizeText(value);
  const queryNumber = normalizeNumber(query);
  const sortOptions = {numeric: true};
  return namedPlaces
    .map(place => ({place, rank: matchRank(place, query, queryNumber)}))
    .filter(({rank}) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank ||
      placeLabel(a.place).localeCompare(placeLabel(b.place), 'pl', sortOptions) ||
      a.place.id.localeCompare(b.place.id, 'pl', sortOptions))
    .map(({place}) => place);
}

function exactMatches(value) {
  const query = normalizeText(value);
  if (!query) return [];

  const place = placesById.get(value.trim());
  if (place) return place.named ? [place] : [];

  const exact = namedPlaces.filter(place =>
    (place.number && normalizeText(place.number) === query) ||
    (place.name && normalizeText(place.name) === query) ||
    normalizeText(placeLabel(place)) === query);
  if (exact.length || !isRoomNumber(query)) return exact;
  return namedPlaces.filter(place => place.number && normalizeNumber(place.number) === normalizeNumber(query));
}

function assignPlace(field, place) {
  chosen[field] = place;
  getById(field).value = placeLabel(place);
  if (field === 'end') setDestinationPrompt(false);
  hideOptions(field);
}

function choosePlace(field, place) {
  if (!place?.named) return;
  assignPlace(field, place);
  if (lookupMode && field === 'end') {
    previewPlace(place);
  } else if (chosen.start && chosen.end) {
    run();
  }
}

function hideOptions(field) {
  const input = getById(field);
  getById(field + '-options').hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

function setupPlaceSearch(field) {
  const input = getById(field);
  const list = getById(field + '-options');
  let matches = [];
  let activeIndex = -1;

  function highlightOption() {
    Array.from(list.children).forEach((option, index) => {
      const active = index === activeIndex;
      option.classList.toggle('active', active);
      option.setAttribute('aria-selected', String(active));
    });
    if (activeIndex < 0) return;
    const option = list.children[activeIndex];
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({block: 'nearest'});
  }

  function showOptions() {
    matches = search(input.value);
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren();

    matches.forEach((place, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = field + '-option-' + index;
      option.dataset.placeId = place.id;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = placeLabel(place);

      const detail = document.createElement('small');
      const duplicate = places.some(other => other.id !== place.id &&
        other.level === place.level && placeLabel(other) === placeLabel(place));
      detail.textContent = graph.levels[place.level] +
        (duplicate ? ' · ' + place.id.split('-').slice(-2).join('-') : '');
      option.append(detail);
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choosePlace(field, place));
      list.append(option);
    });
    if (!matches.length) {
      const message = document.createElement('div');
      message.textContent = 'Brak pasujących pomieszczeń';
      message.style.padding = '10px';
      list.append(message);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('input', () => {
    chosen[field] = null;
    if (field === 'end') {
      if (input.value.trim()) setDestinationPrompt(false);
      clearRoomPreview();
    }
    clearRoute();
    showOptions();
  });
  input.addEventListener('focus', showOptions);
  input.addEventListener('blur', () => hideOptions(field));
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideOptions(field);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) showOptions();
      if (matches.length) {
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        activeIndex = activeIndex < 0
          ? (offset === 1 ? 0 : matches.length - 1)
          : (activeIndex + offset + matches.length) % matches.length;
        highlightOption();
      }
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (!list.hidden && activeIndex >= 0) {
      choosePlace(field, matches[activeIndex]);
      return;
    }
    const exact = exactMatches(input.value);
    if (exact.length === 1) {
      choosePlace(field, exact[0]);
    } else if (!list.hidden && matches.length === 1) {
      choosePlace(field, matches[0]);
    } else if (chosen[field]) {
      run();
    } else {
      showOptions();
      showError('Wybierz konkretne pomieszczenie z listy podpowiedzi.');
    }
  });
}

function resolvePlace(field) {
  if (chosen[field]) return chosen[field];
  const input = getById(field);
  const exact = exactMatches(input.value);
  if (exact.length !== 1) return null;

  const [place] = exact;
  chosen[field] = place;
  input.value = placeLabel(place);
  return place;
}

setupPlaceSearch('start');
setupPlaceSearch('end');

// Floor controls and map popups.
function switchLevel(level, index = legs[activeLeg]?.level === level ? activeLeg : legs.findIndex(leg => leg.level === level)) {
  if (selectedRoom && selectedRoom.dataset.level !== level) clearRoomSelection();
  if (selectedStair) clearStairSelection();
  activeLeg = index;
  document.querySelectorAll('[data-target]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.target === level)));
  document.querySelectorAll('[data-map]').forEach(map => map.hidden = map.dataset.map !== level);
  document.querySelectorAll('[data-route-leg]').forEach(layer => layer.toggleAttribute('hidden', Number(layer.dataset.routeLeg) !== index));
  showInstruction();
}
const roomPopup = getById('room-popup');
const stairPopup = getById('stair-popup');
const mapViewport = getById('map-viewport');
const mapCard = roomPopup.parentElement;

function applyRoomLabelMode() {
  const showNames = window.mapConfig?.roomLabels === 'numbers-and-names';
  mapViewport.dataset.roomLabels = showNames ? 'numbers-and-names' : 'numbers';
  if (showNames) return;

  const visibleNames = new Set((window.mapConfig?.alwaysShowRoomNames ?? []).map(normalizeText));
  for (const label of mapViewport.querySelectorAll('.room-label')) {
    const nameLines = [...label.querySelectorAll('.label-name')];
    if (!nameLines.length) continue;
    const name = nameLines.map(line => line.textContent.trim()).join(' ').replace(/-\s+/g, '');
    if (visibleNames.has(normalizeText(name))) {
      label.setAttribute('data-show-room-name', '');
      continue;
    }

    // Keep the number block centered when the supporting text is hidden.
    const numbers = [...label.querySelectorAll('.label-number[y]')];
    if (!numbers.length) continue;
    const lines = [...label.querySelectorAll('tspan[y]')];
    const centerY = spans => (Number(spans[0].getAttribute('y')) + Number(spans.at(-1).getAttribute('y'))) / 2;
    const offset = centerY(lines) - centerY(numbers);
    for (const number of numbers) {
      number.setAttribute('y', Number(number.getAttribute('y')) + offset);
    }
  }

  // The room name is displayed by the click popup, not the native hover tooltip.
  for (const title of mapViewport.querySelectorAll('.room > title')) title.remove();
}

applyRoomLabelMode();
const routeControls = getById('route-controls');
const routeControlsToggle = getById('route-controls-toggle');
const routePage = mapCard.closest('main');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let routeControlsTransition = 0;

function setRouteControlsCollapsed(collapsed) {
  if (routeControls.classList.contains('is-collapsed') === collapsed) {
    updateSearchFields();
    return;
  }
  if (collapsed && routeControls.contains(document.activeElement)) {
    routeControlsToggle.focus({preventScroll: true});
  }
  const animate = !reduceMotion.matches;
  const transition = ++routeControlsTransition;
  routeControls.classList.toggle('is-animating', animate);
  routeControls.classList.toggle('is-collapsed', collapsed);
  routeControls.inert = collapsed;
  routeControlsToggle.setAttribute('aria-expanded', String(!collapsed));
  routeControlsToggle.setAttribute('aria-label', collapsed ? 'Rozwiń panel trasy' : 'Zwiń panel trasy');
  updateSearchFields();

  if (animate) {
    requestAnimationFrame(() => {
      const animations = routeControls.getAnimations()
        .filter(animation => animation.transitionProperty === 'grid-template-rows');
      Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        // A newer click may have reversed the transition.
        if (transition === routeControlsTransition) routeControls.classList.remove('is-animating');
      });
    });
  }
}

function showFocusedMap(active) {
  routePage.classList.toggle('is-map-focused', active);
  routeControlsToggle.hidden = !active;
  setRouteControlsCollapsed(active);
}

routeControlsToggle.addEventListener('click', () => {
  setRouteControlsCollapsed(!routeControls.inert);
});
function clearRoomPreview() {
  previewedRoom?.removeAttribute('data-room-preview');
  previewedRoom = null;
}

function previewPlace(place) {
  const room = getById(place.id);
  if (!room) return;
  clearRoomPreview();
  clearRoute();
  if (selectedRoom) clearRoomSelection();
  previewedRoom = room;
  room.setAttribute('data-room-preview', '');
  switchLevel(place.level);
  showFocusedMap(true);
}

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
  if ((!selectedRoom && !selectedStair) || popupFrame) return;
  popupFrame = requestAnimationFrame(() => {
    popupFrame = 0;
    if (selectedRoom) positionMapPopup(selectedRoom, roomPopup);
    if (selectedStair) positionMapPopup(selectedStair, stairPopup);
  });
}

new ResizeObserver(schedulePopupPosition).observe(mapCard);
new MutationObserver(schedulePopupPosition).observe(mapViewport, {
  subtree: true, attributes: true, attributeFilter: ['viewBox'],
});

function clearRoomSelection() {
  selectedRoom.classList.remove('selected');
  selectedRoom.setAttribute('aria-expanded', 'false');
  selectedRoom = null;
  roomPopup.hidden = true;
}

function selectRoom(room, focusActions = false) {
  const place = placesById.get(room.id);
  if (!place?.named) return;
  if (selectedStair) clearStairSelection();
  const alreadySelected = room === selectedRoom;
  if (selectedRoom) clearRoomSelection();
  if (alreadySelected) return;
  selectedRoom = room;
  room.classList.add('selected');
  room.setAttribute('aria-expanded', 'true');
  getById('room-name').textContent = placeLabel(place);
  updateRoomActions();
  roomPopup.hidden = false;
  positionMapPopup(room, roomPopup);
  if (focusActions) {
    const action = getById(getById('use-start').hidden ? 'use-end' : 'use-start');
    action.focus({preventScroll: true});
  }
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
  if (selectedRoom && !event.target.closest('#room-popup, .map-tools, path.room[role="button"]')) {
    clearRoomSelection();
  }
  if (selectedStair && !event.target.closest('#stair-popup, .map-tools, .stair-target')) {
    clearStairSelection();
  }
});
document.addEventListener('keydown', event => {
  const anchor = selectedRoom || selectedStair;
  if (event.key !== 'Escape' || !anchor) return;
  const popup = selectedRoom ? roomPopup : stairPopup;
  const focusWasInPopup = popup.contains(document.activeElement);
  if (selectedRoom) clearRoomSelection();
  else clearStairSelection();
  if (focusWasInPopup) anchor.focus({preventScroll: true});
});
const roomActions = [
  {field: 'start', button: getById('use-start')},
  {field: 'end', button: getById('use-end')},
];

function updateRoomActions() {
  for (const {field, button} of roomActions) {
    button.toggleAttribute('data-field-filled', Boolean(getById(field).value.trim()));
  }
}

for (const {field, button} of roomActions) {
  button.addEventListener('click', () => {
    if (!selectedRoom) return;
    const place = placesById.get(selectedRoom.id);
    if (!place?.named) return;

    manualRouteSetup = true;
    assignPlace(field, place);
    clearRoomPreview();
    clearRoute({keepMapView: true});
  });
}
function createSvgElement(tag, attributes) {
  const element = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function planContents(svg) {
  return svg.querySelector('[data-plan-rotation]') || svg;
}

function drawPathNetwork(viewport) {
  const layers = new Map();
  for (const svg of viewport.querySelectorAll('svg[data-plan-level-svg]')) {
    const layer = createSvgElement('g', {class: 'graph-layer', 'aria-hidden': 'true'});
    const plan = planContents(svg);
    plan.insertBefore(layer, plan.querySelector('.stairway-layer, .passage-layer, .route-layer'));
    layers.set(svg.dataset.planLevelSvg, layer);
  }
  for (const edge of graph.edges) {
    const a = nodes[edge.a], b = nodes[edge.b];
    if (a.level !== b.level) continue;
    layers.get(a.level).append(createSvgElement('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      class: edge.kind === 'assumed' ? 'uncertain' : '',
    }));
  }
}
const pathsButton = getById('show-paths');
pathsButton.addEventListener('click', () => {
  const showing = mapViewport.classList.toggle('show-path-network');
  if (showing && !mapViewport.querySelector('.graph-layer')) drawPathNetwork(mapViewport);
  pathsButton.setAttribute('aria-pressed', String(showing));
});

// Route state and transfer instructions.
function clearRoute({keepMapView = false} = {}) {
  legs = [];
  activeLeg = -1;
  showInstruction();
  document.querySelectorAll('.route-layer').forEach(layer => layer.remove());
  document.querySelectorAll('.destination,.origin,.on-route').forEach(el => el.classList.remove('destination','origin','on-route'));
  document.querySelectorAll('.stair-target.used').forEach(el => el.classList.remove('used'));
  getById('status').textContent = '';
  getById('reset').hidden = true;
  if (!keepMapView && !previewedRoom) showFocusedMap(false);
  else updateSearchFields();
  if (selectedStair) clearStairSelection();
}
function showError(message) {
  getById('status').textContent = message;
}

const instructionPanel = getById('route-instruction');
const instructionNext = getById('instruction-next');

function showInstruction() {
  const leg = legs[activeLeg];
  instructionPanel.hidden = !leg?.exit;
  if (!leg?.exit) {
    getById('instruction-text').textContent = '';
    return;
  }
  getById('instruction-text').textContent = transitionInstruction(leg);
  instructionNext.setAttribute('aria-label', 'Przejdź do planu: ' + graph.levels[leg.exit.to]);
}

instructionNext.onclick = () => {
  const exit = legs[activeLeg]?.exit;
  if (exit) switchLevel(exit.to, activeLeg + 1);
};

function transitionInstruction(leg) {
  const {edge, to} = leg.exit;
  const destination = graph.levels[to];
  if (edge.stairId) {
    const goingUp = to === edge.upper;
    return (goingUp ? 'Wejdź' : 'Zejdź') + ' schodami na poziom „' + destination + '” (klatka ' + edge.stairId + ').';
  }
  if (edge.transferId === 'E') return 'Przejdź na zewnątrz do przejścia na poziom „' + destination + '”.';
  if (edge.transferId === 'D') return 'Przejdź przez drzwi do planu „' + destination + '”.';
  if (edge.transferId === 'places') return 'Przejdź łącznikiem do planu „' + destination + '”.';
  return 'Przejdź na poziom „' + destination + '”.';
}

function marker(layer, node, kind, caption) {
  layer.append(createSvgElement('circle', {cx: node.x, cy: node.y, class: 'route-marker marker-' + kind}));
  const x = node.x + 10, y = node.y - 9;
  const text = createSvgElement('text', {x, y, class: 'route-caption'});
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

  if (selectedRoom) clearRoomSelection();
  const alreadySelected = target === selectedStair;
  if (selectedStair) clearStairSelection();
  if (alreadySelected) return;
  const index = graph.floorOrder.indexOf(stairLevel);
  const options = getById('stair-options');
  options.replaceChildren();
  for (const offset of [-1, 1]) {
    const level = graph.floorOrder[index + offset];
    if (!level) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = (offset < 0 ? '↓ ' : '↑ ') + graph.levels[level];
    button.onclick = () => switchLevel(level);
    options.append(button);
  }
  selectedStair = target;
  target.setAttribute('aria-expanded', 'true');
  getById('stair-name').textContent = graph.stairwells[stairId].name;
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
// Route drawing.
function transitionMarker(layer, node, target) {
  const center = target?.querySelector('circle');
  const cx = center?.getAttribute('cx') ?? node.x;
  const cy = center?.getAttribute('cy') ?? node.y;
  layer.append(createSvgElement('circle', {cx, cy, class:'route-stair-ring'}));
  const icon = target?.querySelector('.transition-icon')?.cloneNode(true);
  if (icon) layer.append(icon);
}
function buildRouteLegs(route) {
  const first = route.path[0];
  const routeLegs = [];
  let leg = {level: nodes[first].level, nodeIds: [first], edges: []};

  for (const [index, edge] of route.edges.entries()) {
    const from = nodes[route.path[index]];
    const nextId = route.path[index + 1];
    const to = nodes[nextId];
    if (from.level === to.level) {
      leg.nodeIds.push(nextId);
      leg.edges.push(edge);
      continue;
    }

    leg.exit = {node: from, edge, to: to.level};
    routeLegs.push(leg);
    leg = {
      level: to.level,
      nodeIds: [nextId],
      edges: [],
      enter: {node: to, edge, from: from.level},
    };
  }
  routeLegs.push(leg);
  return routeLegs;
}

function routePoints(nodeIds) {
  return nodeIds.map(id => {
    const {x, y} = nodes[id];
    return x + ',' + y;
  }).join(' ');
}

function drawRoute(route, start, end) {
  legs = buildRouteLegs(route);
  for (const [index, leg] of legs.entries()) {
    const map = document.querySelector('[data-map="' + leg.level + '"] svg');
    const layer = createSvgElement('g', {
      class: 'route-layer',
      'aria-hidden': 'true',
      'data-route-leg': index,
    });
    planContents(map).append(layer);

    if (leg.nodeIds.length > 1) {
      const points = routePoints(leg.nodeIds);
      layer.append(createSvgElement('polyline', {points, class: 'route-halo'}));
      layer.append(createSvgElement('polyline', {points, class: 'route-line'}));
      for (const [index, edge] of leg.edges.entries()) {
        if (edge.kind !== 'assumed') continue;
        const points = routePoints(leg.nodeIds.slice(index, index + 2));
        layer.append(createSvgElement('polyline', {points, class: 'route-line route-uncertain'}));
      }
      layer.append(createSvgElement('g', {class: 'route-arrows'}));
    }

    const markedTransitions = new Set();
    for (const transition of [leg.enter, leg.exit]) {
      if (!transition) continue;
      const {stairId, transferId} = transition.edge;
      const transitionId = stairId || transferId;
      if (!transitionId) {
        marker(layer, transition.node, 'uncertain', 'Przejście (orient.)');
        continue;
      }

      const selector = stairId ? '[data-stair="' + stairId + '"]' : '[data-transfer-id="' + transferId + '"]';
      const target = map.querySelector(selector);
      if (!markedTransitions.has(transitionId)) transitionMarker(layer, transition.node, target);
      markedTransitions.add(transitionId);
      target?.classList.add('used');
    }

    document.querySelector('[data-target="' + leg.level + '"]').classList.add('on-route');
    if (index === 0) marker(layer, nodes[start.node], 'origin', 'START');
    if (index === legs.length - 1) marker(layer, nodes[end.node], 'destination', 'CEL');
  }

  getById(start.id)?.classList.add('origin');
  getById(end.id)?.classList.add('destination');
  getById('reset').hidden = false;
  switchLevel(start.level, 0);
  showFocusedMap(true);
}

function run() {
  clearRoute();
  const start = resolvePlace('start');
  const end = resolvePlace('end');
  if (!start || !end) {
    showError('Wybierz punkt startowy i salę z listy podpowiedzi.');
    return;
  }

  const route = dijkstra(start.node, end.node);
  if (!route) {
    showError('Brak potwierdzonego połączenia na planie.');
    return;
  }
  clearRoomPreview();
  drawRoute(route, start, end);
}

// Initialise the navigation from a link or the default entrance.
let guideDestinationFromLink = false;

function updateSearchFields() {
  const canSetRoute = manualRouteSetup || previewedRoom || legs.length;
  const lookupOnly = lookupMode && !canSetRoute;
  const startField = getById('start-field');
  startField.hidden = hasStartFromLink || lookupOnly;
  startField.parentElement.classList.toggle('lookup-only', lookupOnly);
  getById('find').hidden = lookupOnly;
  const awaitingDestination = getById('end').classList.contains('awaiting-destination');
  const routeLabel = awaitingDestination ? 'Dokąd? Wpisz numer lub nazwę' : 'Dokąd? Numer lub nazwa';
  getById('end-label').textContent = lookupOnly ? 'Wyszukaj' : routeLabel;
  updateRoomActions();
}

function setDestinationPrompt(show) {
  getById('end').classList.toggle('awaiting-destination', show);
  updateSearchFields();
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
    getById(field).value = place ? placeLabel(place) : value;
    if (!place) {
      const point = field === 'start' ? 'Start' : 'Cel';
      issues.push(matches.length
        ? point + ' z linku („' + value + '”) pasuje do kilku miejsc. Wybierz jedno z podpowiedzi.'
        : point + ' z linku („' + value + '”) nie został znaleziony. Wybierz miejsce z podpowiedzi.');
    }
  }

  switchLevel(chosen.start?.level ?? placesById.get(graph.start).level);
  lookupMode = !start && !end;
  hasStartFromLink = Boolean(start && chosen.start);
  guideDestinationFromLink = hasStartFromLink && !end;
  getById('use-start').hidden = hasStartFromLink;
  setDestinationPrompt(guideDestinationFromLink);
  if (issues.length) showError(issues.join(' '));
  else if (chosen.start && chosen.end) run();
  return chosen.start;
}

getById('find').onclick = run;
const startFromLink = applyRouteLink();
getById('reset').onclick = () => {
  manualRouteSetup = false;
  clearRoomPreview();
  clearRoute();
  chosen = {start: startFromLink, end: null};
  getById('start').value = startFromLink ? placeLabel(startFromLink) : '';
  getById('end').value = '';
  setDestinationPrompt(guideDestinationFromLink);
  switchLevel(startFromLink?.level ?? placesById.get(graph.start).level);
  getById(lookupMode ? 'end' : 'find').focus();
};

// Public integration hook: compute routes using the same graph as the UI.
window.schoolNavigation = {
  graph,
  dijkstra,
  search,
  exactMatches,
  route(startId, endId, allowAssumed = false) {
    const start = placesById.get(startId)?.node;
    const end = placesById.get(endId)?.node;
    const confirmedRoute = dijkstra(start, end);
    return confirmedRoute || (allowAssumed ? dijkstra(start, end, true) : null);
  },
};
