(() => {
  const viewport = document.getElementById('map-viewport');
  const zoomOut = document.getElementById('map-zoom-out');
  const zoomIn = document.getElementById('map-zoom-in');
  const fit = document.getElementById('map-fit');
  const maxZoom = 6;
  const zoomStep = 1.3;
  const dragThreshold = 6;
  const center = {x: 0.5, y: 0.5};
  const pointers = new Map();
  let svg, originalViewBox, bounds, view;
  let dragging = false;
  let suppressClickUntil = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});

  function render() {
    const {x, y, width, height, zoom} = view;
    svg.setAttribute('viewBox', zoom === 1 ? originalViewBox : `${x} ${y} ${width} ${height}`);
    zoomOut.disabled = fit.disabled = zoom === 1;
    zoomIn.disabled = zoom === maxZoom;
    viewport.classList.toggle('is-zoomed', zoom > 1);
  }

  function fitMap() {
    view = {...bounds, zoom: 1};
    render();
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
    bounds = {x, y, width, height};
    fitMap();
  }

  // Convert screen points to fractions of the drawn SVG, excluding any letterboxing.
  function mapFraction(point) {
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / bounds.width, rect.height / bounds.height);
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    return {
      x: (point.x - rect.left - (rect.width - width) / 2) / width,
      y: (point.y - rect.top - (rect.height - height) / 2) / height,
    };
  }

  function moveView(factor, from, to = from) {
    const zoom = clamp(view.zoom * factor, 1, maxZoom);
    const width = bounds.width / zoom;
    const height = bounds.height / zoom;
    view = {
      x: clamp(view.x + from.x * view.width - to.x * width, bounds.x, bounds.x + bounds.width - width),
      y: clamp(view.y + from.y * view.height - to.y * height, bounds.y, bounds.y + bounds.height - height),
      width, height, zoom,
    };
    render();
  }

  zoomOut.addEventListener('click', () => moveView(1 / zoomStep, center));
  zoomIn.addEventListener('click', () => moveView(zoomStep, center));
  fit.addEventListener('click', fitMap);
  viewport.addEventListener('wheel', event => {
    if (!svg.contains(event.target)) return;
    if (view.zoom === 1 && event.deltaY > 0 && !event.ctrlKey) return;
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

  selectMap();
  new MutationObserver(selectMap).observe(viewport, {
    attributes: true, attributeFilter: ['hidden'], subtree: true,
  });
})();
