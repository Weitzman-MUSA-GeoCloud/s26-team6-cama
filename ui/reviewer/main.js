// reviewer ui — map (MapLibre GL JS) + distribution charts (ApexCharts)

/* global maplibregl, ApexCharts */

const tileUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/tiles/properties/{z}/{x}/{y}.pbf';
const sourceLayer = 'properties';
const currentBinsUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/current_assessment_bins.json';
const taxYearBinsUrl = 'https://storage.googleapis.com/musa5090s26-team6-public/configs/tax_year_assessment_bins.json';

// Dollar-value color ramp breakpoints
const valueStops = [0, 50000, 100000, 200000, 500000, 1000000];
const valueColors = ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c', '#00441b'];

// Diverging color ramp for percent / dollar change
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

const makeValueColorExpr = (field) => [
  'step',
  ['coalesce', ['to-number', ['get', field], 0], 0],
  valueColors[0],
  valueStops[1], valueColors[1],
  valueStops[2], valueColors[2],
  valueStops[3], valueColors[3],
  valueStops[4], valueColors[4],
  valueStops[5], valueColors[5],
];

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

// Estimate median from binned data
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

const renderBinsChart = (container, data) => {
  const years = [...new Set(data.map((d) => d['tax_year']))].sort();
  const latestYear = years.at(-1);

  const yearData = data
    .filter((d) => d['tax_year'] === latestYear && d['lower_bound'] < 2000000)
    .sort((a, b) => a['lower_bound'] - b['lower_bound']);

  if (yearData.length === 0) return;

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

const updateSummary = (yearData, latestYear) => {
  const total = yearData.reduce((s, d) => s + d['property_count'], 0);
  const median = medianFromBins(yearData);
  const medianStr = median >= 1000
    ? `$${(median / 1000).toFixed(0)}k`
    : currencyFmt.format(median);

  document.getElementById('summary-text').textContent =
    `${total.toLocaleString()} residential properties assessed in tax year ${latestYear}. ` +
    `Median assessed value is approximately ${medianStr}.`;
};

const loadCharts = async () => {
  const taxYearEl = document.getElementById('current-value-chart');
  const predictedEl = document.getElementById('percent-change-chart');

  try {
    const res = await fetch(taxYearBinsUrl);
    if (res.ok) {
      const data = await res.json();
      renderBinsChart(taxYearEl, data);
    }
  } catch (_e) {
    taxYearEl.querySelector
      ? (taxYearEl.style.setProperty('--placeholder', '"Data not yet available"')) : null;
  }

  try {
    const res = await fetch(currentBinsUrl);
    if (res.ok) {
      const data = await res.json();
      const result = renderBinsChart(predictedEl, data);
      if (result) updateSummary(result.yearData, result.latestYear);
    }
  } catch (_e) {
    // chart stays as placeholder
  }
};

const legendNotes = {
  'current-value': 'Current (ML-predicted) assessed value',
  'tax-year-value': 'Tax year 2023 assessed value',
  'percent-change': 'Percent change since tax year 2023',
  'dollar-change': 'Dollar change since tax year 2023',
};

const changeLegendRamp = (mode) => {
  const ramp = document.getElementById('legend-ramp');
  const note = document.getElementById('legend-note');

  if (mode === 'percent-change' || mode === 'dollar-change') {
    ramp.style.background = 'linear-gradient(to right, #d73027, #fc8d59, #fee08b, #d9ef8b, #91cf60, #1a9850)';
  } else {
    ramp.style.background = 'linear-gradient(to right, #f7fcf5, #c7e9c0, #74c476, #31a354, #006d2c, #00441b)';
  }

  note.textContent = legendNotes[mode] || '';
};

document.addEventListener('DOMContentLoaded', () => {
  const map = new maplibregl.Map({
    container: 'property-map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [-75.1652, 39.9526],
    zoom: 12,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');

  // Show zoom hint when tiles are not visible (below zoom 12)
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
        'fill-color': makeValueColorExpr('tax_year_assessed_value'),
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
      colorExpr = makeValueColorExpr('current_assessed_value');
    } else if (mode === 'tax-year-value') {
      colorExpr = makeValueColorExpr('tax_year_assessed_value');
    } else if (mode === 'percent-change') {
      colorExpr = makePctChangeColorExpr();
    } else {
      colorExpr = makeDollarChangeColorExpr();
    }

    map.setPaintProperty('properties-fill', 'fill-color', colorExpr);
    changeLegendRamp(mode);
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
      changeText = `${formatCurrency(change)} (${pct > 0 ? '+' : ''}${pct}%)`;
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

  loadCharts();
});
