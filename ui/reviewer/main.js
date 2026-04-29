// reviewer ui — map (MapLibre GL JS) + distribution charts (ApexCharts)

/* global maplibregl, ApexCharts */

const tileUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/tiles/{z}/{x}/{y}.pbf';
const sourceLayer = 'property_tile_info';
const metadataUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/tile_style_metadata.json';
const currentBinsUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/current_assessment_bins.json';
const taxYearBinsUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/tax_year_assessment_bins.json';

// 5-class sequential green palette (ColorBrewer)
const valueColors = ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c'];
// Diverging palette for change modes
const pctStops = [-0.5, -0.2, -0.05, 0.05, 0.2, 0.5];
const pctColors = ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'];

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatCurrency = (val) => {
  const num = Number(val);
  if (!val || isNaN(num)) return '—';
  return currencyFmt.format(num);
};

const fmtBp = (v) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
};

// Build MapLibre 'step' expression from field and breakpoints
const makeValueColorExpr = (field, breakpoints) => {
  const expr = ['step', ['coalesce', ['to-number', ['get', field], 0], 0], valueColors[0]];
  breakpoints.forEach((bp, i) => {
    expr.push(bp, valueColors[i + 1]);
  });
  return expr;
};

const makePctChangeColorExpr = () => [
  'case',
  [
    'all',
    ['>', ['coalesce', ['to-number', ['get', 'current_assessed_value'], 0], 0], 0],
    ['>', ['coalesce', ['to-number', ['get', 'tax_year_assessed_value'], 0], 0], 0],
  ],
  [
    'step',
    [
      '/',
      [
        '-',
        ['to-number', ['get', 'current_assessed_value']],
        ['to-number', ['get', 'tax_year_assessed_value']],
      ],
      ['to-number', ['get', 'tax_year_assessed_value']],
    ],
    pctColors[0],
    pctStops[1], pctColors[1],
    pctStops[2], pctColors[2],
    pctStops[3], pctColors[3],
    pctStops[4], pctColors[4],
    pctStops[5], pctColors[5],
  ],
  '#ccc',
];

const makeDollarChangeColorExpr = () => [
  'case',
  [
    'all',
    ['>', ['coalesce', ['to-number', ['get', 'current_assessed_value'], 0], 0], 0],
    ['>', ['coalesce', ['to-number', ['get', 'tax_year_assessed_value'], 0], 0], 0],
  ],
  [
    'step',
    ['-', ['to-number', ['get', 'current_assessed_value']], ['to-number', ['get', 'tax_year_assessed_value']]],
    '#d73027',
    -50000, '#fc8d59',
    -10000, '#fee08b',
    10000, '#d9ef8b',
    50000, '#91cf60',
    100000, '#1a9850',
  ],
  '#ccc',
];

// Update legend inside #legend-box (vertical: high value at top, low at bottom)
const updateLegend = (mode, metadata) => {
  const ramp = document.getElementById('legend-ramp');
  const labelsEl = document.getElementById('legend-labels');
  const note = document.getElementById('legend-note');

  if (mode === 'current-value' || mode === 'tax-year-value') {
    const field = mode === 'current-value' ? 'current_assessed_value' : 'tax_year_assessed_value';
    const bps = metadata?.layers?.[field]?.breakpoints ?? [];
    // Vertical: darkest (high) at top → lightest (low) at bottom
    ramp.style.background =
      `linear-gradient(to bottom, ${[...valueColors].reverse().join(', ')})`;
    const maxLabel = mode === 'current-value' ? '$1.5M+' : '$1M+';
    // Labels top-to-bottom: high → low
    const labels = [maxLabel, ...bps.map(fmtBp).reverse(), '$0'];
    labelsEl.innerHTML = labels.map((l) => `<span>${l}</span>`).join('');
    note.textContent = mode === 'current-value'
      ? 'ML predicted value'
      : 'Tax year assessed value';
  } else if (mode === 'percent-change') {
    // Vertical: positive (green) at top, negative (red) at bottom
    ramp.style.background =
      `linear-gradient(to bottom, ${[...pctColors].reverse().join(', ')})`;
    labelsEl.innerHTML =
      '<span>+50%+</span><span>+20%</span><span>+5%</span><span>-5%</span><span>-20%</span><span>-50%</span>';
    note.textContent = '% change (tax year → current)';
  } else {
    ramp.style.background =
      `linear-gradient(to bottom, ${[...pctColors].reverse().join(', ')})`;
    labelsEl.innerHTML =
      '<span>+$100k+</span><span>+$50k</span><span>+$10k</span><span>-$10k</span><span>-$50k</span><span>-$100k</span>';
    note.textContent = '$ change (tax year → current)';
  }
};

// Estimate median from binned count data
const medianFromBins = (bins) => {
  const total = bins.reduce((s, d) => s + d['property_count'], 0);
  let cumulative = 0;
  const half = total / 2;

  for (const bin of bins) {
    cumulative += bin['property_count'];
    if (cumulative >= half) {
      const frac = (cumulative - half) / bin['property_count'];
      return bin['lower_bound'] + (bin['upper_bound'] - bin['lower_bound']) * (1 - frac);
    }
  }
  return bins[bins.length - 1]['lower_bound'];
};

// Render bar chart of property counts by value bin (most recent year)
const renderBinsChart = (container, data) => {
  const hasTaxYear = data.length > 0 && 'tax_year' in data[0];
  let yearData, latestYear;

  if (hasTaxYear) {
    const years = [...new Set(data.map((d) => d['tax_year']))].sort();
    latestYear = years.at(-1);
    yearData = data
      .filter((d) => d['tax_year'] === latestYear && d['lower_bound'] < 2000000)
      .sort((a, b) => a['lower_bound'] - b['lower_bound']);
  } else {
    latestYear = null;
    yearData = data
      .filter((d) => d['lower_bound'] < 2000000)
      .sort((a, b) => a['lower_bound'] - b['lower_bound']);
  }

  if (yearData.length === 0) return null;

  const categories = yearData.map((d) => {
    const lb = d['lower_bound'];
    return lb >= 1000 ? `$${(lb / 1000).toFixed(0)}k` : `$${lb}`;
  });
  const counts = yearData.map((d) => d['property_count']);

  container.classList.add('chart-loaded');

  new ApexCharts(container, {
    chart: {
      type: 'bar',
      height: 150,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    series: [{ name: 'Properties', data: counts }],
    xaxis: {
      categories,
      labels: { rotate: -45, style: { fontSize: '9px', colors: '#6d6d6d' } },
      tickAmount: 8,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '10px' },
        formatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    dataLabels: { enabled: false },
    colors: ['#0f4d90'],
    tooltip: {
      y: { formatter: (v) => `${v.toLocaleString()} properties` },
      theme: 'light',
    },
    grid: { borderColor: '#f0ede5', strokeDashArray: 4 },
    plotOptions: { bar: { columnWidth: '85%', borderRadius: 2 } },
    states: { hover: { filter: { type: 'darken', value: 0.8 } } },
  }).render();

  return { yearData, latestYear };
};

// Render year-over-year median trend line chart
const renderYearTrendChart = (container, data) => {
  const years = [...new Set(data.map((d) => d['tax_year']))].sort();

  const yearPoints = years.map((year) => {
    const yearBins = data.filter((d) => d['tax_year'] === year && d['property_count'] > 0);
    const total = yearBins.reduce((s, d) => s + d['property_count'], 0);
    if (total < 100) return null;
    return { year, median: Math.round(medianFromBins(yearBins)), total };
  }).filter(Boolean);

  if (yearPoints.length === 0) return;

  container.classList.add('chart-loaded');

  new ApexCharts(container, {
    chart: {
      type: 'area',
      height: 150,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    series: [{ name: 'Median predicted value', data: yearPoints.map((d) => d.median) }],
    xaxis: {
      categories: yearPoints.map((d) => d.year),
      labels: { style: { fontSize: '9px', colors: '#6d6d6d' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '10px' },
        formatter: (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`,
      },
    },
    dataLabels: { enabled: false },
    colors: ['#0f4d90'],
    fill: {
      type: 'gradient',
      gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.35, opacityTo: 0.02 },
    },
    stroke: { curve: 'smooth', width: 2 },
    markers: { size: 3, colors: ['#0f4d90'], strokeColors: '#fff', strokeWidth: 2 },
    tooltip: { y: { formatter: (v) => currencyFmt.format(v) }, theme: 'light' },
    grid: { borderColor: '#f0ede5', strokeDashArray: 4 },
  }).render();
};

// Compute median + total for a given tax year from bins data
const computeStatsForYear = (data, year) => {
  const yearBins = data
    .filter((d) => d['tax_year'] === year && d['property_count'] > 0)
    .sort((a, b) => a['lower_bound'] - b['lower_bound']);
  if (yearBins.length === 0) return null;
  const total = yearBins.reduce((s, d) => s + d['property_count'], 0);
  const median = medianFromBins(yearBins);
  return { total, median };
};

// Update OPA-focused overview
// official median from tax year bins; ML median estimated from tile metadata breakpoints
const updateSummaryForYear = (bins, year, metadata) => {
  const stats = computeStatsForYear(bins, year);
  if (!stats) return;

  const fmtCount = (n) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

  document.getElementById('stat-selected-year').textContent = year;
  document.getElementById('stat-coverage').textContent = fmtCount(stats.total);
  document.getElementById('stat-official-median').textContent = fmtBp(Math.round(stats.median));

  const mlLayer = metadata?.layers?.current_assessed_value;
  const mlBp = mlLayer?.breakpoints;
  if (mlBp?.length >= 3) {
    // Breakpoints divide ~418k properties into 5 roughly equal buckets.
    // Median (50th pct) ≈ midpoint of the 3rd bucket (40–60th pct range).
    const mlMedianEst = Math.round((mlBp[1] + mlBp[2]) / 2);
    document.getElementById('stat-predicted-median').textContent = `~${fmtBp(mlMedianEst)}`;

    const shift = (mlMedianEst - stats.median) / stats.median * 100;
    const sign = shift >= 0 ? '+' : '';
    const shiftEl = document.getElementById('stat-ratio');
    shiftEl.textContent = `${sign}${shift.toFixed(1)}%`;
    // Negative shift = market below official → possible over-assessment
    shiftEl.style.color = shift > 5 ? '#31a354' : shift < -5 ? '#d73027' : '#6d6d6d';
  }
};

// Render year selector pill buttons
const renderYearSelector = (container, years, defaultYear, onSelect) => {
  years.forEach((year) => {
    const btn = document.createElement('button');
    btn.className = `year-btn${year === defaultYear ? ' active' : ''}`;
    btn.textContent = year;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.year-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(year);
    });
    container.appendChild(btn);
  });
};

// Persistent chart instance for tax year distribution (updates on year change)
let taxYearChartInstance = null;

const renderTaxYearChart = (container, data, year) => {
  const yearData = data
    .filter((d) => d['tax_year'] === year && d['lower_bound'] < 2000000)
    .sort((a, b) => a['lower_bound'] - b['lower_bound']);

  if (yearData.length === 0) return;

  const categories = yearData.map((d) => {
    const lb = d['lower_bound'];
    return lb >= 1000 ? `$${(lb / 1000).toFixed(0)}k` : `$${lb}`;
  });
  const counts = yearData.map((d) => d['property_count']);

  if (taxYearChartInstance) {
    taxYearChartInstance.updateOptions({ xaxis: { categories } }, false, false);
    taxYearChartInstance.updateSeries([{ name: 'Properties', data: counts }]);
    return;
  }

  container.classList.add('chart-loaded');
  taxYearChartInstance = new ApexCharts(container, {
    chart: {
      type: 'bar',
      height: 150,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    series: [{ name: 'Properties', data: counts }],
    xaxis: {
      categories,
      labels: { rotate: -45, style: { fontSize: '9px', colors: '#6d6d6d' } },
      tickAmount: 8,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '10px' },
        formatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    dataLabels: { enabled: false },
    colors: ['#0f4d90'],
    tooltip: { y: { formatter: (v) => `${v.toLocaleString()} properties` }, theme: 'light' },
    grid: { borderColor: '#f0ede5', strokeDashArray: 4 },
    plotOptions: { bar: { columnWidth: '85%', borderRadius: 2 } },
    states: { hover: { filter: { type: 'darken', value: 0.8 } } },
  });
  taxYearChartInstance.render();
};

const loadCharts = async (metadata) => {
  const taxYearEl = document.getElementById('current-value-chart');
  const predictedEl = document.getElementById('percent-change-chart');

  // Load both bin datasets in parallel
  let taxYearBinsData = null;
  let currentBinsData = null;
  try {
    const [taxRes, curRes] = await Promise.all([fetch(taxYearBinsUrl), fetch(currentBinsUrl)]);
    if (taxRes.ok) taxYearBinsData = await taxRes.json();
    if (curRes.ok) currentBinsData = await curRes.json();
  } catch { /* noop */ }

  // Chart 1: tax year distribution with year selector
  if (taxYearBinsData) {
    // All years with substantial data (for YoY lookup even outside selector)
    const allYears = [...new Set(taxYearBinsData.map((d) => d['tax_year']))]
      .sort()
      .filter((y) =>
        taxYearBinsData
          .filter((d) => d['tax_year'] === y)
          .reduce((s, d) => s + d['property_count'], 0) > 10000,
      );

    // Selector shows the most recent 4 years with >100k properties
    const significantYears = allYears
      .filter((y) =>
        taxYearBinsData
          .filter((d) => d['tax_year'] === y)
          .reduce((s, d) => s + d['property_count'], 0) > 100000,
      )
      .slice(-4);

    if (significantYears.length > 0) {
      const defaultYear = significantYears.at(-1);
      const selectorEl = document.getElementById('year-selector');

      renderYearSelector(selectorEl, significantYears, defaultYear, (year) => {
        renderTaxYearChart(taxYearEl, taxYearBinsData, year);
        updateSummaryForYear(taxYearBinsData, year, metadata);
      });

      renderTaxYearChart(taxYearEl, taxYearBinsData, defaultYear);
      updateSummaryForYear(taxYearBinsData, defaultYear, metadata);
    }
  }

  // Chart 2: ML prediction distribution
  if (currentBinsData) renderBinsChart(predictedEl, currentBinsData);
};

// Debounce utility
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Fetch address suggestions from Photon (OSM-based, Philadelphia bounded)
const fetchSuggestions = async (query) => {
  if (query.length < 3) return [];
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', `${query} Philadelphia`);
    url.searchParams.set('limit', '6');
    url.searchParams.set('bbox', '-75.2803,39.8676,-74.9558,40.1379');
    url.searchParams.set('lang', 'en');
    const res = await fetch(url.toString());
    const data = await res.json();
    return data.features.map((f) => {
      const p = f.properties;
      const parts = [];
      if (p['housenumber']) parts.push(p['housenumber']);
      if (p['street']) parts.push(p['street']);
      else if (p['name']) parts.push(p['name']);
      if (p['city']) parts.push(p['city']);
      if (p['postcode']) parts.push(p['postcode']);
      return {
        label: parts.join(', '),
        lngLat: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
      };
    }).filter((s) => s.label.length > 0);
  } catch {
    return [];
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load tile style metadata for data-driven breakpoints
  let metadata = null;
  try {
    const res = await fetch(metadataUrl);
    if (res.ok) metadata = await res.json();
  } catch { /* fall back to defaults */ }

  const currentBreakpoints = metadata?.layers?.current_assessed_value?.breakpoints
    ?? [50000, 100000, 200000, 500000];
  const taxYearBreakpoints = metadata?.layers?.tax_year_assessed_value?.breakpoints
    ?? [136200, 191000, 254200, 335200];

  const map = new maplibregl.Map({
    container: 'property-map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [-75.1652, 39.9526],
    zoom: 12,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');

  // Set initial legend (default mode: percent-change)
  updateLegend('percent-change', metadata);

  // Zoom hint
  const zoomHint = document.getElementById('zoom-hint');
  const updateZoomHint = () => {
    zoomHint.style.display = map.getZoom() < 12 ? 'block' : 'none';
  };
  map.on('zoom', updateZoomHint);

  map.on('load', () => {
    updateZoomHint();

    map.addSource('properties', {
      type: 'vector',
      tiles: [tileUrl],
      minzoom: 12,
      maxzoom: 18,
    });

    map.addLayer({
      id: 'properties-fill',
      type: 'fill',
      source: 'properties',
      'source-layer': sourceLayer,
      paint: {
        'fill-color': makePctChangeColorExpr(),
        'fill-opacity': 0.78,
      },
    });

    map.addLayer({
      id: 'properties-outline',
      type: 'line',
      source: 'properties',
      'source-layer': sourceLayer,
      minzoom: 14,
      paint: {
        'line-color': '#888',
        'line-width': 0.5,
        'line-opacity': 0.4,
      },
    });

    map.addLayer({
      id: 'properties-selected',
      type: 'fill',
      source: 'properties',
      'source-layer': sourceLayer,
      filter: ['==', ['get', 'property_id'], ''],
      paint: {
        'fill-color': '#f3c613',
        'fill-opacity': 1,
      },
    });

    map.addLayer({
      id: 'properties-selected-outline',
      type: 'line',
      source: 'properties',
      'source-layer': sourceLayer,
      filter: ['==', ['get', 'property_id'], ''],
      paint: {
        'line-color': '#0f4d90',
        'line-width': 2,
      },
    });

    // Load all Philadelphia ZCTA boundaries for the zip selector
    loadAllZipBoundaries();
  });

  let activeMode = 'percent-change';

  // Layer control
  const layerControl = document.getElementById('map-layer-control');
  layerControl.addEventListener('change', (e) => {
    if (!map.isStyleLoaded()) return;

    const mode = e.target.value;

    let colorExpr;
    if (mode === 'current-value') {
      colorExpr = makeValueColorExpr('current_assessed_value', currentBreakpoints);
    } else if (mode === 'tax-year-value') {
      colorExpr = makeValueColorExpr('tax_year_assessed_value', taxYearBreakpoints);
    } else if (mode === 'percent-change') {
      colorExpr = makePctChangeColorExpr();
    } else {
      colorExpr = makeDollarChangeColorExpr();
    }

    map.setPaintProperty('properties-fill', 'fill-color', colorExpr);
    updateLegend(mode, metadata);
    activeMode = mode;
  });

  // Hover tooltip (lightweight, follows cursor)
  const hoverTooltip = document.getElementById('hover-tooltip');
  const mapEl = document.getElementById('property-map');
  const tooltipValueLabel = document.getElementById('tooltip-value-label');
  const tooltipChangeLabel = document.getElementById('tooltip-change-label');
  const tooltipChangeVal = document.getElementById('tooltip-change');

  map.on('mousemove', 'properties-fill', (e) => {
    if (!e.features || e.features.length === 0) return;

    const featureProps = e.features[0].properties;
    const rect = mapEl.getBoundingClientRect();
    const x = e.originalEvent.clientX - rect.left;
    const y = e.originalEvent.clientY - rect.top;

    // Flip tooltip to left side if near right edge
    const ttWidth = 210;
    const leftPos = x + ttWidth + 20 > rect.width ? x - ttWidth - 8 : x + 14;
    hoverTooltip.style.left = `${leftPos}px`;
    hoverTooltip.style.top = `${Math.max(0, y - 20)}px`;

    hoverTooltip.querySelector('.tooltip-address').textContent =
      featureProps['address'] || 'Unknown address';
    document.getElementById('tooltip-id').textContent =
      featureProps['property_id'] || '—';

    const curNum = Number(featureProps['current_assessed_value']) || 0;
    const taxNum = Number(featureProps['tax_year_assessed_value']) || 0;

    if (activeMode === 'tax-year-value') {
      tooltipValueLabel.textContent = 'Tax year';
      document.getElementById('tooltip-value').textContent = formatCurrency(taxNum);
      tooltipChangeLabel.hidden = true;
      tooltipChangeVal.hidden = true;
    } else {
      tooltipValueLabel.textContent = 'ML predicted';
      document.getElementById('tooltip-value').textContent = formatCurrency(curNum);
      if (curNum > 0 && taxNum > 0 && (activeMode === 'percent-change' || activeMode === 'dollar-change')) {
        const diff = curNum - taxNum;
        const sign = diff >= 0 ? '+' : '';
        tooltipChangeLabel.textContent = 'vs. tax year';
        tooltipChangeVal.textContent = activeMode === 'percent-change'
          ? `${sign}${((diff / taxNum) * 100).toFixed(1)}%`
          : diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff);
        tooltipChangeLabel.removeAttribute('hidden');
        tooltipChangeVal.removeAttribute('hidden');
      } else {
        tooltipChangeLabel.hidden = true;
        tooltipChangeVal.hidden = true;
      }
    }

    hoverTooltip.removeAttribute('hidden');
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'properties-fill', () => {
    hoverTooltip.setAttribute('hidden', '');
    map.getCanvas().style.cursor = '';
  });

  // MapLibre native popup — anchors to geo coordinate, stays with property on pan
  const mapPopup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: false,
    anchor: 'top',
    offset: [0, 6],
    className: 'map-popup',
  });

  mapPopup.on('close', () => {
    const emptyFilter = ['==', ['get', 'property_id'], ''];
    if (map.getLayer('properties-selected')) {
      map.setFilter('properties-selected', emptyFilter);
      map.setFilter('properties-selected-outline', emptyFilter);
    }
  });

  // Click popup (detailed, appears below clicked point)
  map.on('click', 'properties-fill', (e) => {
    if (!e.features || e.features.length === 0) return;
    if (zipSelectorEl && !zipSelectorEl.hidden) return; // zip selector intercepts clicks

    const featureProps = e.features[0].properties;
    const address = featureProps['address'];
    const propertyId = featureProps['property_id'];
    const curVal = featureProps['current_assessed_value'];
    const taxVal = featureProps['tax_year_assessed_value'];

    let changeText = '—';
    if (curVal && taxVal && Number(taxVal) > 0) {
      const change = Number(curVal) - Number(taxVal);
      const pct = ((change / Number(taxVal)) * 100).toFixed(1);
      changeText = `${formatCurrency(change)} (${Number(pct) > 0 ? '+' : ''}${pct}%)`;
    }

    const changeNum = (curVal && taxVal && Number(taxVal) > 0)
      ? Number(curVal) - Number(taxVal) : null;
    const changeClass = changeNum === null ? '' : changeNum >= 0 ? 'change-pos' : 'change-neg';

    const widgetLink = propertyId
      ? `<a href="../widget/?parcel_number=${encodeURIComponent(propertyId)}" class="popup-link">View full history →</a>`
      : '';

    mapPopup
      .setLngLat(e.lngLat)
      .setHTML(`
        <p class="popup-address">${address || 'Unknown address'}</p>
        <dl class="popup-details">
          <dt>Property ID</dt><dd>${propertyId || '—'}</dd>
          <dt>ML predicted</dt><dd>${formatCurrency(curVal)}</dd>
          <dt>Tax year value</dt><dd>${formatCurrency(taxVal)}</dd>
          <dt>Change</dt><dd class="${changeClass}">${changeText}</dd>
        </dl>
        ${widgetLink}
      `)
      .addTo(map);

    hoverTooltip.setAttribute('hidden', '');

    const idFilter = ['==', ['get', 'property_id'], propertyId ?? ''];
    map.setFilter('properties-selected', idFilter);
    map.setFilter('properties-selected-outline', idFilter);
  });

  // Shared reference needed by both popup and zip selector
  const zipSelectorEl = document.getElementById('zip-selector');

  // Address autocomplete (Photon OSM, Philadelphia bounded)
  const addressInput = document.getElementById('address-input');
  const addressBtn = document.getElementById('address-search-btn');
  const addressClearBtn = document.getElementById('address-clear');
  const suggestionsEl = document.getElementById('address-suggestions');

  let activeSuggestions = [];
  let activeIndex = -1;

  const renderSuggestions = (suggestions) => {
    activeSuggestions = suggestions;
    activeIndex = -1;
    suggestionsEl.innerHTML = '';

    if (suggestions.length === 0) {
      suggestionsEl.hidden = true;
      addressInput.setAttribute('aria-expanded', 'false');
      return;
    }

    suggestions.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.setAttribute('role', 'option');
      item.textContent = s.label;
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        addressInput.value = s.label;
        suggestionsEl.hidden = true;
        addressInput.setAttribute('aria-expanded', 'false');
        map.flyTo({ center: s.lngLat, zoom: 17 });
      });
      suggestionsEl.appendChild(item);
      void i;
    });

    suggestionsEl.hidden = false;
    addressInput.setAttribute('aria-expanded', 'true');
  };

  const debouncedFetch = debounce(async (query) => {
    const results = await fetchSuggestions(query);
    renderSuggestions(results);
  }, 280);

  addressInput.addEventListener('input', () => {
    const q = addressInput.value.trim();
    addressClearBtn.hidden = q.length === 0;
    if (q.length >= 3) {
      debouncedFetch(q);
    } else {
      suggestionsEl.hidden = true;
    }
  });

  addressClearBtn.addEventListener('click', () => {
    addressInput.value = '';
    addressClearBtn.hidden = true;
    suggestionsEl.hidden = true;
    addressInput.setAttribute('aria-expanded', 'false');
    activeSuggestions = [];
    const emptyFilter = ['==', ['get', 'property_id'], ''];
    if (map.getLayer('properties-selected')) {
      map.setFilter('properties-selected', emptyFilter);
      map.setFilter('properties-selected-outline', emptyFilter);
    }
    mapPopup.remove();
    addressInput.focus();
  });

  addressInput.addEventListener('keydown', (e) => {
    const items = suggestionsEl.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeSuggestions[activeIndex]) {
        const s = activeSuggestions[activeIndex];
        addressInput.value = s.label;
        suggestionsEl.hidden = true;
        map.flyTo({ center: s.lngLat, zoom: 17 });
      } else if (activeSuggestions.length > 0) {
        const s = activeSuggestions[0];
        addressInput.value = s.label;
        suggestionsEl.hidden = true;
        map.flyTo({ center: s.lngLat, zoom: 17 });
      }
    } else if (e.key === 'Escape') {
      suggestionsEl.hidden = true;
      addressInput.setAttribute('aria-expanded', 'false');
    }
  });

  addressInput.addEventListener('blur', () => {
    setTimeout(() => {
      suggestionsEl.hidden = true;
      addressInput.setAttribute('aria-expanded', 'false');
    }, 150);
  });

  addressBtn.addEventListener('click', async () => {
    const q = addressInput.value.trim();
    if (!q) return;
    if (activeSuggestions.length > 0) {
      const s = activeSuggestions[0];
      map.flyTo({ center: s.lngLat, zoom: 17 });
      suggestionsEl.hidden = true;
    } else {
      const results = await fetchSuggestions(q);
      if (results.length > 0) {
        map.flyTo({ center: results[0].lngLat, zoom: 17 });
      } else {
        addressInput.style.outline = '2px solid #d73027';
        setTimeout(() => { addressInput.style.outline = ''; }, 2000);
      }
    }
  });

  // Zip code filter
  const zipInput = document.getElementById('zip-input');
  const zipClear = document.getElementById('zip-clear');
  let activeZip = null;

  const clearZipBoundary = () => {
    if (map.getSource('zip-boundary')) {
      map.getSource('zip-boundary').setData({ type: 'FeatureCollection', features: [] });
    }
  };

  const applyZip = (zip) => {
    activeZip = zip || null;
    zipClear.hidden = !activeZip;
    if (!activeZip) {
      clearZipBoundary();
      // Restore property layers to full visibility
      map.setFilter('properties-fill', null);
      map.setFilter('properties-outline', null);
    }
    if (activeZip && filterToggle.checked) {
      filterToggle.checked = false;
      filterControls.hidden = true;
    }
  };

  const showZipBoundary = async (zip) => {
    try {
      // Census TIGER ZCTA boundaries (single call for polygon + bounding box)
      const res = await fetch(
        `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query?where=ZCTA5%3D'${encodeURIComponent(zip)}'&outFields=ZCTA5&outSR=4326&f=geojson`,
      );
      const geojson = await res.json();
      const feature = geojson.features?.[0];
      if (!feature) return;

      // Compute bounding box from polygon coordinates
      const allCoords = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates.flatMap((poly) => poly[0]);
      const lons = allCoords.map((p) => p[0]);
      const lats = allCoords.map((p) => p[1]);
      const west = Math.min(...lons);
      const east = Math.max(...lons);
      const south = Math.min(...lats);
      const north = Math.max(...lats);

      // Fly to zip area, minZoom 12 ensures property tiles load
      map.fitBounds([[west, south], [east, north]], { padding: 60, maxZoom: 14, minZoom: 12 });

      // Draw boundary
      const fc = { type: 'FeatureCollection', features: [feature] };
      if (map.getSource('zip-boundary')) {
        map.getSource('zip-boundary').setData(fc);
      } else {
        map.addSource('zip-boundary', { type: 'geojson', data: fc });
        // Subtle yellow fill sits beneath the property tile layer
        map.addLayer({
          id: 'zip-boundary-fill',
          type: 'fill',
          source: 'zip-boundary',
          paint: { 'fill-color': '#f3c613', 'fill-opacity': 0.10 },
        }, 'properties-fill');
        // Dashed blue border on top of everything
        map.addLayer({
          id: 'zip-boundary-line',
          type: 'line',
          source: 'zip-boundary',
          paint: {
            'line-color': '#0f4d90',
            'line-width': 2.5,
            'line-dasharray': [5, 3],
          },
        });
      }
    } catch { /* ignore */ }
  };

  zipInput.addEventListener('input', () => {
    const val = zipInput.value.trim();
    if (val.length === 5 && /^\d{5}$/.test(val)) {
      applyZip(val);
      showZipBoundary(val);
    } else if (val.length === 0) {
      applyZip(null);
    }
  });

  zipClear.addEventListener('click', () => {
    zipInput.value = '';
    applyZip(null);
  });

  // ── Zip selector (browse all Philadelphia zip codes) ──────────────────

  const zipListEl = document.getElementById('zip-list');
  const zipBrowseBtn = document.getElementById('zip-browse-btn');
  const zipSelectorClose = document.getElementById('zip-selector-close');

  const setHoveredZip = (zip) => {
    if (map.getLayer('zip-hover-fill')) {
      const f = zip ? ['==', ['get', 'ZCTA5'], zip] : ['==', ['get', 'ZCTA5'], ''];
      map.setFilter('zip-hover-fill', f);
      map.setFilter('zip-hover-line', f);
    }
    zipListEl.querySelectorAll('.zip-item').forEach((el) => {
      const isMatch = el.dataset.zip === zip;
      el.classList.toggle('hovered', isMatch);
      if (isMatch) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const clearHoveredZip = () => setHoveredZip(null);

  const selectZip = (zip) => {
    closeZipSelector();
    zipInput.value = zip;
    applyZip(zip);
    showZipBoundary(zip);
  };

  const openZipSelector = () => {
    zipSelectorEl.removeAttribute('hidden');
    ['zip-all-line', 'zip-hover-fill', 'zip-hover-line', 'zip-all-hit'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
    });
  };

  const closeZipSelector = () => {
    zipSelectorEl.hidden = true;
    ['zip-all-line', 'zip-hover-fill', 'zip-hover-line', 'zip-all-hit'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    });
    clearHoveredZip();
  };

  zipBrowseBtn.addEventListener('click', () => {
    zipSelectorEl.hidden ? openZipSelector() : closeZipSelector();
  });

  zipSelectorClose.addEventListener('click', closeZipSelector);

  zipListEl.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.zip-item');
    if (item) setHoveredZip(item.dataset.zip);
  });

  zipListEl.addEventListener('mouseleave', clearHoveredZip);

  zipListEl.addEventListener('click', (e) => {
    const item = e.target.closest('.zip-item');
    if (item) selectZip(item.dataset.zip);
  });

  // Load all Philadelphia ZCTA boundaries (called from map.on('load'))
  const loadAllZipBoundaries = async () => {
    try {
      const res = await fetch(
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query?where=ZCTA5+LIKE+'191%25'&outFields=ZCTA5&outSR=4326&f=geojson",
      );
      const data = await res.json();
      if (!data.features?.length) return;

      map.addSource('zip-all', { type: 'geojson', data });

      // Thin gray lines for all zip areas
      map.addLayer({
        id: 'zip-all-line',
        type: 'line',
        source: 'zip-all',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#0f4d90', 'line-width': 1, 'line-opacity': 0.25 },
      });

      // Invisible fill for hover hit-testing
      map.addLayer({
        id: 'zip-all-hit',
        type: 'fill',
        source: 'zip-all',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#000', 'fill-opacity': 0 },
      });

      // Yellow highlight fill for hovered zip
      map.addLayer({
        id: 'zip-hover-fill',
        type: 'fill',
        source: 'zip-all',
        layout: { visibility: 'none' },
        filter: ['==', ['get', 'ZCTA5'], ''],
        paint: { 'fill-color': '#f3c613', 'fill-opacity': 0.18 },
      });

      // Bold border for hovered zip
      map.addLayer({
        id: 'zip-hover-line',
        type: 'line',
        source: 'zip-all',
        layout: { visibility: 'none' },
        filter: ['==', ['get', 'ZCTA5'], ''],
        paint: { 'line-color': '#0f4d90', 'line-width': 2.5 },
      });

      // Map interactions (only active when selector is open)
      map.on('mousemove', 'zip-all-hit', (e) => {
        if (zipSelectorEl.hidden) return;
        map.getCanvas().style.cursor = 'pointer';
        const zip = e.features?.[0]?.properties?.ZCTA5;
        if (zip) setHoveredZip(zip);
      });

      map.on('mouseleave', 'zip-all-hit', () => {
        if (!zipSelectorEl.hidden) {
          map.getCanvas().style.cursor = '';
          clearHoveredZip();
        }
      });

      map.on('click', 'zip-all-hit', (e) => {
        if (zipSelectorEl.hidden) return;
        const zip = e.features?.[0]?.properties?.ZCTA5;
        if (zip) selectZip(zip);
      });

      // Populate list
      const zips = data.features.map((f) => f.properties.ZCTA5).sort();
      zipListEl.innerHTML = zips
        .map((z) => `<div class="zip-item" data-zip="${z}">${z}</div>`)
        .join('');
    } catch { /* ignore */ }
  };

  // Discrepancy filter — dims properties below threshold, highlights those above
  const filterToggle = document.getElementById('filter-toggle');
  const filterControls = document.getElementById('filter-controls');
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdValue = document.getElementById('threshold-value');

  // Build MapLibre filter expression: keep only properties where |change%| >= threshold
  const buildDiscrepancyFilter = (threshold) => [
    'all',
    ['>', ['coalesce', ['to-number', ['get', 'current_assessed_value'], 0], 0], 0],
    ['>', ['coalesce', ['to-number', ['get', 'tax_year_assessed_value'], 0], 0], 0],
    [
      '>=',
      [
        'abs',
        [
          '/',
          ['-', ['to-number', ['get', 'current_assessed_value']], ['to-number', ['get', 'tax_year_assessed_value']]],
          ['to-number', ['get', 'tax_year_assessed_value']],
        ],
      ],
      threshold / 100,
    ],
  ];

  const applyDiscrepancyFilter = (threshold) => {
    map.setFilter('properties-fill', buildDiscrepancyFilter(threshold));
    map.setFilter('properties-outline', buildDiscrepancyFilter(threshold));
  };

  const resetFilter = () => {
    map.setFilter('properties-fill', null);
    map.setFilter('properties-outline', null);
  };

  filterToggle.addEventListener('change', () => {
    if (filterToggle.checked) {
      filterControls.hidden = false;
      if (activeZip) {
        zipInput.value = '';
        activeZip = null;
        zipClear.hidden = true;
        clearZipBoundary();
      }
      applyDiscrepancyFilter(Number(thresholdSlider.value));
    } else {
      filterControls.hidden = true;
      resetFilter();
    }
  });

  thresholdSlider.addEventListener('input', () => {
    const val = Number(thresholdSlider.value);
    thresholdValue.textContent = `${val}%`;
    if (filterToggle.checked) applyDiscrepancyFilter(val);
  });

  loadCharts(metadata);
});
