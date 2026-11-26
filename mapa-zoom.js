(() => {
  const viewport = document.getElementById('map-viewport');
  const zoomOut = document.getElementById('map-zoom-out');
  const zoomIn = document.getElementById('map-zoom-in');
  const fit = document.getElementById('map-fit');
  const maxZoom = 6;
  const maxRouteZoom = 2.5;
  const zoomStep = 1.3;
  const dragThreshold = 6;
  const center = {x: 0.5, y: 0.5};
  const mobileLayout = matchMedia('(max-width: 650px)');
  const mapPage = viewport.closest('main');
  const pointers = new Map();
  let svg, originalViewBox, mapBounds, bounds, view;
  let routeLayer = null;
  let followRoute = false;
  let dragging = false;
  let suppressClickUntil = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});

  function renderRouteArrows() {
    const group = routeLayer?.querySelector('.route-arrows');
    if (!group) return;
    const line = routeLayer.querySelector('.route-line');
    const matrix = line.getScreenCTM();
    if (!matrix) return;
    // Place arrows by screen distance so zooming keeps their size and spacing readable.
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const scaleY = Math.hypot(matrix.c, matrix.d);
    if (!scaleX || !scaleY) return;
    const segments = [];
    let length = 0;
    for (let i = 1; i < line.points.numberOfItems; i++) {
      const start = line.points.getItem(i - 1);
      const end = line.points.getItem(i);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const size = Math.hypot(dx * scaleX, dy * scaleY);
      if (size === 0) continue;
      segments.push({start, dx, dy, size, offset: length});
      length += size;
    }

    const arrows = document.createDocumentFragment();
    const count = length < 48 ? 0 : Math.max(1, Math.floor(length / 170));
    let index = 0;
    for (let i = 1; i <= count; i++) {
      const offset = length * i / (count + 1);
      while (offset > segments[index].offset + segments[index].size) index++;
      const segment = segments[index];
      const fraction = (offset - segment.offset) / segment.size;
      const x = segment.start.x + segment.dx * fraction;
      const y = segment.start.y + segment.dy * fraction;
      const angle = Math.atan2(segment.dy * scaleY, segment.dx * scaleX) * 180 / Math.PI;
      const arrow = document.createElementNS(svg.namespaceURI, 'path');
      arrow.setAttribute('class', 'route-arrow');
      arrow.setAttribute('d', 'M-9,-9 L3,0 L-9,9 H-2 L11,0 L-2,-9 Z');
      arrow.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' +
        1 / scaleX + ' ' + 1 / scaleY + ') rotate(' + angle + ')');
      arrows.append(arrow);
    }
    group.replaceChildren(arrows);
  }

  function render() {
    const {x, y, width, height, zoom} = view;
    svg.setAttribute('viewBox', zoom === 1 && bounds === mapBounds ? originalViewBox : `${x} ${y} ${width} ${height}`);
    zoomOut.disabled = zoom <= 1;
    fit.disabled = zoom === 1 && !followRoute;
    zoomIn.disabled = zoom === maxZoom;
    viewport.classList.toggle('is-zoomed', zoom > 1);
    renderRouteArrows();
  }

  function fittedBounds() {
    const fillsViewport = mobileLayout.matches || mapPage.classList.contains('has-route');
    if (!fillsViewport || !viewport.clientWidth || !viewport.clientHeight) return mapBounds;
    const ratio = viewport.clientWidth / viewport.clientHeight;
    const width = Math.max(mapBounds.width, mapBounds.height * ratio);
    const height = width / ratio;
    return {
      x: mapBounds.x + (mapBounds.width - width) / 2,
      y: mapBounds.y + (mapBounds.height - height) / 2,
      width,
      height,
    };
  }

  function constrainOffset(offset, size, mapStart, mapSize) {
    if (size >= mapSize) return mapStart + (mapSize - size) / 2;
    return clamp(offset, mapStart, mapStart + mapSize - size);
  }

  function setView(zoom, x, y, limits = mapBounds) {
    const width = bounds.width / zoom;
    const height = bounds.height / zoom;
    view = {
      x: constrainOffset(x, width, limits.x, limits.width),
      y: constrainOffset(y, height, limits.y, limits.height),
      width,
      height,
      zoom,
    };
    render();
  }

  function fitMap() {
    bounds = fittedBounds();
    setView(1, bounds.x, bounds.y);
  }

  function routeBounds() {
    const box = routeLayer.getBBox();
    if (routeLayer.parentElement === svg) return box;

    const transform = svg.getScreenCTM().inverse().multiply(routeLayer.getScreenCTM());
    const points = [
      [box.x, box.y], [box.x + box.width, box.y],
      [box.x, box.y + box.height], [box.x + box.width, box.y + box.height],
    ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(transform));
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return {x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y};
  }

  function fitRoute() {
    const {x, y, width, height} = routeBounds();
    const screenWidth = viewport.clientWidth;
    const screenHeight = viewport.clientHeight;
    const margin = Math.min(32, screenWidth * 0.09, screenHeight * 0.09);
    const zoom = Math.min(maxRouteZoom,
      bounds.width * (1 - 2 * margin / screenWidth) / width,
      bounds.height * (1 - 2 * margin / screenHeight) / height);
    const viewWidth = bounds.width / zoom;
    const viewHeight = bounds.height / zoom;
    const marginX = margin * viewWidth / screenWidth;
    const marginY = margin * viewHeight / screenHeight;
    const left = Math.min(mapBounds.x, x - marginX);
    const top = Math.min(mapBounds.y, y - marginY);
    const right = Math.max(mapBounds.x + mapBounds.width, x + width + marginX);
    const bottom = Math.max(mapBounds.y + mapBounds.height, y + height + marginY);
    setView(zoom, x + (width - viewWidth) / 2, y + (height - viewHeight) / 2,
      {x: left, y: top, width: right - left, height: bottom - top});
  }

  function resizeMap() {
    if (!svg) return;
    const next = fittedBounds();
    if (next.width === bounds.width && next.height === bounds.height) {
      renderRouteArrows();
      return;
    }
    const {x, y, width, height, zoom} = view;
    bounds = next;
    if (followRoute) fitRoute();
    else setView(zoom, x + (width - bounds.width / zoom) / 2, y + (height - bounds.height / zoom) / 2);
  }

  function selectMap() {
    const next = viewport.querySelector('[data-map]:not([hidden]) svg');
    if (!next || next === svg) return;
    if (svg) svg.setAttribute('viewBox', originalViewBox);
    pointers.clear();
    dragging = false;
    viewport.classList.remove('is-dragging');
    svg = next;
    originalViewBox = svg.getAttribute('viewBox');
    const [x, y, width, height] = originalViewBox.split(/[\s,]+/).map(Number);
    mapBounds = {x, y, width, height};
    routeLayer = null;
    followRoute = false;
    fitMap();
  }

  function syncRouteView() {
    selectMap();
    const next = svg?.querySelector('.route-layer:not([hidden])') ?? null;
    if (next === routeLayer) return;
    routeLayer = next;
    followRoute = Boolean(next);
    bounds = fittedBounds();
    if (followRoute) fitRoute();
    else fitMap();
  }

  // Use the SVG transform so the pointer stays anchored with either aspect-ratio setting.
  function mapFraction(point) {
    const local = new DOMPoint(point.x, point.y).matrixTransform(svg.getScreenCTM().inverse());
    return {
      x: (local.x - view.x) / view.width,
      y: (local.y - view.y) / view.height,
    };
  }

  function moveView(factor, from, to = from) {
    followRoute = false;
    const zoom = clamp(view.zoom * factor, Math.min(1, view.zoom), maxZoom);
    const width = bounds.width / zoom;
    const height = bounds.height / zoom;
    setView(zoom, view.x + from.x * view.width - to.x * width, view.y + from.y * view.height - to.y * height);
  }

  zoomOut.addEventListener('click', () => moveView(1 / zoomStep, center));
  zoomIn.addEventListener('click', () => moveView(zoomStep, center));
  fit.addEventListener('click', () => {
    followRoute = false;
    fitMap();
  });
  viewport.addEventListener('wheel', event => {
    if (!svg.contains(event.target)) return;
    if (view.zoom <= 1 && event.deltaY > 0 && !event.ctrlKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    const anchor = mapFraction({x: event.clientX, y: event.clientY});
    moveView(Math.exp(-event.deltaY * unit * 0.0025), anchor);
  }, {passive: false});

  function startDragging() {
    dragging = true;
    viewport.classList.add('is-dragging');
    for (const id of pointers.keys()) svg.setPointerCapture(id);
  }

  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !svg.contains(event.target) || pointers.size === 2) return;
    if (pointers.size && (event.pointerType !== 'touch' || [...pointers.values()][0].type !== 'touch')) return;
    const point = {x: event.clientX, y: event.clientY};
    if (!pointers.size) suppressClickUntil = 0;
    pointers.set(event.pointerId, {point, start: point, type: event.pointerType});
    if (pointers.size === 2) startDragging();
  });

  window.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const previous = pointer.point;
    pointer.point = {x: event.clientX, y: event.clientY};
    if (pointers.size === 2) {
      const other = [...pointers.values()].find(value => value !== pointer).point;
      const previousDistance = distance(previous, other);
      const nextDistance = distance(pointer.point, other);
      if (!previousDistance || !nextDistance) return;
      const from = mapFraction(midpoint(previous, other));
      const to = mapFraction(midpoint(pointer.point, other));
      moveView(nextDistance / previousDistance, from, to);
      return;
    }
    if (!dragging) {
      if (distance(pointer.start, pointer.point) < dragThreshold) return;
      startDragging();
    }
    moveView(1, mapFraction(previous), mapFraction(pointer.point));
  });

  function endPointer(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (dragging) suppressClickUntil = performance.now() + 450;
    if (!pointers.size) {
      dragging = false;
      viewport.classList.remove('is-dragging');
    }
  }

  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('click', event => {
    if (event.detail === 0 || performance.now() > suppressClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  syncRouteView();
  new ResizeObserver(resizeMap).observe(viewport);
  new MutationObserver(resizeMap).observe(mapPage, {attributes: true, attributeFilter: ['class']});
  mobileLayout.addEventListener('change', resizeMap);
  new MutationObserver(syncRouteView).observe(viewport, {
    attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true,
  });
})();
