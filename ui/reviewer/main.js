// reviewer ui — map (MapLibre GL JS) + distribution charts (ApexCharts)

/* global maplibregl, ApexCharts */

const tileUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/tiles/{z}/{x}/{y}.pbf';
const sourceLayer = 'property_tile_info';
const metadataUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/tile_style_metadata.json';
const currentBinsUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/current_assessment_bins.json';
const taxYearBinsUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/tax_year_assessment_bins.json';

// 5-class sequential green palette (ColorBrewer YlGn → Greens)
const valueColors = ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c'];
// Diverging palette for change modes (ColorBrewer RdYlGn)
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

// Build MapLibre 'step' expression from field and breakpoints array
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

// Update legend UI for given mode using live metadata breakpoints
const updateLegend = (mode, metadata) => {
  const ramp = document.getElementById('legend-ramp');
  const labelsEl = document.getElementById('legend-labels');
  const note = document.getElementById('legend-note');

  if (mode === 'current-value' || mode === 'tax-year-value') {
    const field = mode === 'current-value' ? 'current_assessed_value' : 'tax_year_assessed_value';
    const bps = metadata?.layers?.[field]?.breakpoints ?? [];
    ramp.style.background = `linear-gradient(to right, ${valueColors.join(', ')})`;
    const maxLabel = mode === 'current-value' ? '$1.5M+' : '$1M+';
    const labels = ['$0', ...bps.map(fmtBp), maxLabel];
    labelsEl.innerHTML = labels.map((l) => `<span>${l}</span>`).join('');
    note.textContent = mode === 'current-value'
      ? 'ML-predicted current assessed value'
      : 'Tax year official assessed value';
  } else if (mode === 'percent-change') {
    ramp.style.background = `linear-gradient(to right, ${pctColors.join(', ')})`;
    labelsEl.innerHTML = '<span>-50%</span><span>-20%</span><span>-5%</span><span>+5%</span><span>+20%</span><span>+50%+</span>';
    note.textContent = 'Percent change from tax year to current prediction';
  } else {
    ramp.style.background = `linear-gradient(to right, ${pctColors.join(', ')})`;
    labelsEl.innerHTML = '<span>-$100k</span><span>-$50k</span><span>-$10k</span><span>+$10k</span><span>+$50k</span><span>+$100k+</span>';
    note.textContent = 'Dollar change from tax year to current prediction';
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

// Render a bar chart of property counts by value bin for the most recent year
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

  const chart = new ApexCharts(container, {
    chart: {
      type: 'bar',
      height: 180,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    series: [{ name: 'Properties', data: counts }],
    xaxis: {
      categories,
      labels: { rotate: -45, style: { fontSize: '10px', colors: '#6d6d6d' } },
      tickAmount: 10,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '11px' },
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
    states: {
      hover: { filter: { type: 'darken', value: 0.8 } },
    },
  });

  chart.render();
  return { yearData, latestYear };
};

// Render a year-over-year median value trend line chart
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
      height: 180,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    series: [{ name: 'Median predicted value', data: yearPoints.map((d) => d.median) }],
    xaxis: {
      categories: yearPoints.map((d) => d.year),
      labels: { style: { fontSize: '10px', colors: '#6d6d6d' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '11px' },
        formatter: (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`,
      },
    },
    dataLabels: { enabled: false },
    colors: ['#0f4d90'],
    fill: {
      type: 'gradient',
      gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.35, opacityTo: 0.02 },
    },
    stroke: { curve: 'smooth', width: 2.5 },
    markers: { size: 4, colors: ['#0f4d90'], strokeColors: '#fff', strokeWidth: 2 },
    tooltip: {
      y: { formatter: (v) => currencyFmt.format(v) },
      theme: 'light',
    },
    grid: { borderColor: '#f0ede5', strokeDashArray: 4 },
  }).render();
};

// Update summary stats in the info panel
const updateSummary = (metadata, binsResult) => {
  const tyCount = metadata?.layers?.tax_year_assessed_value?.count;
  const curCount = metadata?.layers?.current_assessed_value?.count;

  const lines = [];
  if (tyCount) lines.push(`${tyCount.toLocaleString()} properties with official tax year values.`);
  if (curCount) lines.push(`${curCount.toLocaleString()} with ML-predicted current values.`);

  if (binsResult) {
    const { yearData, latestYear } = binsResult;
    const median = medianFromBins(yearData);
    lines.push(`Median predicted value (${latestYear}): ${currencyFmt.format(Math.round(median))}.`);
  }

  document.getElementById('summary-text').innerHTML =
    lines.length > 0 ? lines.join('<br>') : 'Loading assessment data…';
};

const loadCharts = async (metadata) => {
  const taxYearEl = document.getElementById('current-value-chart');
  const predictedEl = document.getElementById('percent-change-chart');

  let currentBinsData = null;
  try {
    const res = await fetch(currentBinsUrl);
    if (res.ok) currentBinsData = await res.json();
  } catch { /* noop */ }

  // Chart 1: try official tax year bins; fall back to year-over-year trend
  let chart1Loaded = false;
  try {
    const res = await fetch(taxYearBinsUrl);
    if (res.ok) {
      const data = await res.json();
      renderBinsChart(taxYearEl, data);
      chart1Loaded = true;
    }
  } catch { /* noop */ }

  if (!chart1Loaded) {
    const hasTaxYear = currentBinsData?.length > 0 && 'tax_year' in currentBinsData[0];
    if (currentBinsData && hasTaxYear) {
      renderYearTrendChart(taxYearEl, currentBinsData);
      document.getElementById('chart1-title').textContent = 'Predicted value trend';
      document.getElementById('chart1-subtitle').textContent =
        'Median ML-predicted assessed value by year';
    }
  }

  // Chart 2: distribution histogram for the most recent year in current bins
  if (currentBinsData) {
    const result = renderBinsChart(predictedEl, currentBinsData);
    updateSummary(metadata, result);
  } else {
    updateSummary(metadata, null);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load tile style metadata for data-driven breakpoints
  let metadata = null;
  try {
    const res = await fetch(metadataUrl);
    if (res.ok) metadata = await res.json();
  } catch { /* fall back to hardcoded defaults below */ }

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

  // Set initial legend from metadata
  updateLegend('tax-year-value', metadata);

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
        'fill-color': makeValueColorExpr('tax_year_assessed_value', taxYearBreakpoints),
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
  });

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
  });

  map.on('mouseenter', 'properties-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'properties-fill', () => {
    map.getCanvas().style.cursor = '';
  });

  map.on('click', 'properties-fill', (e) => {
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

    // Update floating popup
    const popup = document.getElementById('property-popup');
    popup.removeAttribute('hidden');
    popup.querySelector('.popup-address').textContent = address || 'Unknown address';
    const popupDds = popup.querySelectorAll('dd');
    popupDds[0].textContent = formatCurrency(curVal);
    popupDds[1].textContent = formatCurrency(taxVal);
    popupDds[2].textContent = changeText;

    // Update info panel
    document.getElementById('no-selection-hint').hidden = true;
    document.getElementById('property-detail-list').removeAttribute('hidden');
    document.getElementById('info-address').textContent = address || '—';
    document.getElementById('info-property-id').textContent = propertyId || '—';
    document.getElementById('info-current-value').textContent = formatCurrency(curVal);
    document.getElementById('info-tax-year-value').textContent = formatCurrency(taxVal);
    document.getElementById('info-change').textContent = changeText;

    // Highlight selected parcel
    const idFilter = ['==', ['get', 'property_id'], propertyId ?? ''];
    map.setFilter('properties-selected', idFilter);
    map.setFilter('properties-selected-outline', idFilter);
  });

  loadCharts(metadata);
});
