// widget main script — address lookup + assessment history chart and table

/* global ApexCharts */

// Our own Cloud Run Function backed by core.opa_properties + core.opa_assessments
const propertyLookupUrl =
  'https://us-east4-musa5090s26-team6.cloudfunctions.net/property-lookup';

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatCurrency = (val) => {
  const num = Number(val);
  if (!val || isNaN(num) || num === 0) return '—';
  return currencyFmt.format(num);
};

const CATEGORY_LABELS = {
  '1': 'Single Family',
  '2': 'Multi Family',
  '8': 'Residential Garage',
  '13': 'Vacant Land (Res.)',
  '14': 'Apartment 5+ Units',
};

let valuationChart = null;
let breakdownChart = null;

const setStatus = (msg, isError = false) => {
  const el = document.getElementById('lookup-status');
  el.textContent = msg;
  el.style.color = isError ? '#d73027' : '';
};

// ── Photon autocomplete ──────────────────────────────

const debounce = (fn, delay) => {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) };
};

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

    // Extract leading house number from what the user typed (e.g. "2201" from "2201 PARK TOWNE PL")
    // Used as fallback when Photon doesn't return a housenumber for a result
    const queryHouseNum = (/^\d+/.exec(query.trim()) || [])[0] || '';

    const seen = new Set();
    return data.features.map((f) => {
      const p = f.properties;
      const houseNum = p['housenumber'] || queryHouseNum;
      const streetName = p['street'] || p['name'] || '';

      const parts = [];
      if (houseNum) parts.push(houseNum);
      if (streetName) parts.push(streetName);
      if (p['city']) parts.push(p['city']);
      if (p['postcode']) parts.push(p['postcode']);

      const addressSearch = [
        houseNum,
        streetName.split(' ')[0],
      ].filter(Boolean).join(' ').toUpperCase();

      return { label: parts.join(', '), addressSearch };
    })
      .filter((s) => s.label && s.addressSearch)
      .filter((s) => {                          // deduplicate by addressSearch
        if (seen.has(s.addressSearch)) return false;
        seen.add(s.addressSearch);
        return true;
      });
  } catch {
    return [];
  }
};

// ── Our own pipeline API (core.opa_properties + core.opa_assessments) ────────

const findPropertyByAddress = async (searchStr) => {
  const url = new URL(propertyLookupUrl);
  url.searchParams.set('search', searchStr);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  // Returns array; pick the first match
  return data[0] || null;
};

const fetchPropertyAndAssessments = async (parcelNumber) => {
  const url = new URL(propertyLookupUrl);
  url.searchParams.set('parcel_number', parcelNumber);
  const res = await fetch(url.toString());
  if (res.status === 404) throw Object.assign(new Error('Not found'), { notFound: true });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json(); // { property, assessments }
};

const renderCharacteristics = (prop) => {
  const el = document.getElementById('property-chars');
  if (!el) return;

  const area = Number(prop['total_livable_area']) || 0;
  const value = Number(prop['market_value']) || 0;
  const perSqft = area > 0 ? Math.round(value / area) : null;
  const yearBuilt = prop['year_built'];
  const typeLabel = CATEGORY_LABELS[prop['category_code']] || `Category ${prop['category_code']}`;
  const beds = prop['number_of_bedrooms'];
  const baths = prop['number_of_bathrooms'] != null ? Number(prop['number_of_bathrooms']) : null;

  const items = [
    yearBuilt != null ? { value: yearBuilt, label: 'Year Built' } : null,
    area > 0 ? { value: `${Math.round(area).toLocaleString()} sq ft`, label: 'Living Area' } : null,
    { value: typeLabel, label: 'Property Type' },
    perSqft != null ? { value: `$${perSqft.toLocaleString()} / sq ft`, label: 'Value per sq ft' } : null,
    beds != null ? { value: beds, label: 'Bedrooms' } : null,
    baths != null ? { value: baths, label: 'Bathrooms' } : null,
  ].filter(Boolean);

  if (items.length === 0) { el.hidden = true; return }

  el.innerHTML = `
    <p class="chars-section-label">Property characteristics</p>
    <div class="chars-grid">
      ${items.map((item) => `
        <div class="char-item">
          <span class="char-item-value">${item.value}</span>
          <span class="char-item-label">${item.label}</span>
        </div>`).join('')}
    </div>`;
  el.removeAttribute('hidden');
};

const updatePropertyInfo = (prop, assessData) => {
  document.getElementById('property-empty').hidden = true;
  document.getElementById('property-loaded').removeAttribute('hidden');
  document.getElementById('property-address').textContent = prop['location'] || '—';
  document.getElementById('property-city-zip').textContent = 'Philadelphia, PA';
  document.getElementById('meta-opa-id').textContent = prop['property_id'] || prop['parcel_number'] || '—';
  document.getElementById('meta-owner').textContent = prop['owner_1'] || '—';
  document.getElementById('meta-market-value').textContent = formatCurrency(prop['market_value']);
  document.getElementById('meta-record-count').textContent =
    `${assessData.length} year${assessData.length !== 1 ? 's' : ''}`;
  renderCharacteristics(prop);
};

const showPropertyError = (msg) => {
  document.getElementById('property-empty').hidden = true;
  document.getElementById('property-loaded').removeAttribute('hidden');
  document.getElementById('property-address').textContent = msg;
  document.getElementById('property-city-zip').textContent = '';
  document.getElementById('meta-opa-id').textContent = '—';
  document.getElementById('meta-owner').textContent = '—';
  document.getElementById('meta-market-value').textContent = '—';
  document.getElementById('meta-record-count').textContent = '—';
  document.getElementById('property-chars').hidden = true;
};

const renderBreakdownChart = (assessData) => {
  const el = document.getElementById('breakdown-chart');
  if (!el || assessData.length === 0) return;

  const years = assessData.map((d) => d['year']);
  const taxLand = assessData.map((d) => Number(d['taxable_land']) || 0);
  const taxBuilding = assessData.map((d) => Number(d['taxable_building']) || 0);
  const exempt = assessData.map(
    (d) => (Number(d['exempt_land']) || 0) + (Number(d['exempt_building']) || 0),
  );
  const hasExempt = exempt.some((v) => v > 0);

  const series = [
    { name: 'Taxable Land', data: taxLand },
    { name: 'Taxable Building', data: taxBuilding },
    ...(hasExempt ? [{ name: 'Exempt', data: exempt }] : []),
  ];

  el.classList.add('chart-loaded');

  if (breakdownChart) {
    breakdownChart.updateSeries(series);
    breakdownChart.updateOptions({ xaxis: { categories: years } });
    return;
  }

  breakdownChart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      stacked: true,
      height: 200,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    series,
    xaxis: {
      categories: years,
      labels: { style: { fontSize: '10px', colors: '#6d6d6d' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '10px' },
        formatter: (v) => {
          if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
          if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
          return `$${v}`;
        },
      },
    },
    colors: ['#0f4d90', '#2176d2', '#d4d1c8'],
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v) => currencyFmt.format(v) }, theme: 'light' },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      fontFamily: '"Open Sans", system-ui, sans-serif',
      markers: { width: 10, height: 10, radius: 2 },
      itemMargin: { horizontal: 8 },
    },
    grid: { borderColor: '#f0ede5', strokeDashArray: 4 },
    plotOptions: { bar: { columnWidth: '80%' } },
  });
  breakdownChart.render();
};

const renderValuationChart = (assessData) => {
  const el = document.getElementById('valuation-chart');
  el.classList.add('chart-loaded');

  const years = assessData.map((d) => d['year']);
  const values = assessData.map((d) => Number(d['market_value']) || 0);

  // Annotate years where value changed >10% from previous year
  const changeAnnotations = years.map((year, i) => {
    if (i === 0) return null;
    const prev = values[i - 1];
    const curr = values[i];
    if (!prev || !curr) return null;
    const pct = (curr - prev) / prev * 100;
    if (Math.abs(pct) < 10) return null;
    return {
      x: year,
      y: curr,
      marker: { size: 0 },
      label: {
        borderColor: 'transparent',
        offsetY: -10,
        text: `${pct > 0 ? '+' : ''}${Math.round(pct)}%`,
        style: {
          background: 'transparent',
          color: pct > 0 ? '#31a354' : '#d73027',
          fontSize: '9px',
          fontWeight: '700',
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
        },
      },
    };
  }).filter(Boolean);

  const options = {
    chart: {
      type: 'area',
      height: 260,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
    annotations: { points: changeAnnotations },
    series: [{ name: 'Market value', data: values }],
    xaxis: {
      categories: years,
      labels: { style: { fontSize: '11px', colors: '#6d6d6d' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6d6d6d', fontSize: '11px' },
        formatter: (v) => {
          if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
          if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
          return `$${v}`;
        },
      },
    },
    dataLabels: { enabled: false },
    colors: ['#0f4d90'],
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        opacityFrom: 0.4,
        opacityTo: 0.02,
      },
    },
    stroke: { curve: 'smooth', width: 2.5 },
    markers: {
      size: 5,
      colors: ['#0f4d90'],
      strokeColors: '#fff',
      strokeWidth: 2,
    },
    tooltip: {
      y: { formatter: (v) => currencyFmt.format(v) },
      theme: 'light',
    },
    grid: { borderColor: '#f0ede5', strokeDashArray: 4 },
  };

  if (valuationChart) {
    valuationChart.updateSeries([{ name: 'Market value', data: values }]);
    valuationChart.updateOptions({
      xaxis: { categories: years },
      annotations: { points: changeAnnotations },
    });
  } else {
    valuationChart = new ApexCharts(el, options);
    valuationChart.render();
  }
};

const populateValuationTable = (assessData) => {
  const tbody = document.getElementById('valuation-table-body');

  if (assessData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No assessment records found.</td></tr>';
    return;
  }

  tbody.innerHTML = assessData.map((d) => [
    '<tr>',
    `<td>${d['year'] || '—'}</td>`,
    `<td>${formatCurrency(d['market_value'])}</td>`,
    `<td>${formatCurrency(d['taxable_land'])}</td>`,
    `<td>${formatCurrency(d['taxable_building'])}</td>`,
    `<td>${formatCurrency(d['exempt_land'])}</td>`,
    `<td>${formatCurrency(d['exempt_building'])}</td>`,
    '</tr>',
  ].join('')).join('');
};

const loadProperty = async (searchStr) => {
  setStatus('Searching…');
  try {
    // Step 1: find property by address → get property_id
    const match = await findPropertyByAddress(searchStr);
    if (!match) {
      setStatus('No property found. Try a more specific address.', true);
      return;
    }

    // Step 2: fetch full property info + assessment history
    const { property, assessments } = await fetchPropertyAndAssessments(match['property_id']);

    setStatus('');
    updatePropertyInfo(property, assessments);
    renderValuationChart(assessments);
    renderBreakdownChart(assessments);
    populateValuationTable(assessments);
  } catch (err) {
    console.error('Property lookup failed:', err);
    setStatus('Failed to load property data. Please try again.', true);
  }
};

// Load directly by parcel number (used when linked from reviewer map)
const loadPropertyById = async (parcelNumber) => {
  setStatus('Loading…');
  try {
    const { property, assessments } = await fetchPropertyAndAssessments(String(parcelNumber));
    setStatus('');
    updatePropertyInfo(property, assessments);
    renderValuationChart(assessments);
    renderBreakdownChart(assessments);
    populateValuationTable(assessments);
  } catch (err) {
    console.error('Property lookup failed:', err);
    if (err.notFound) {
      showPropertyError('Property not found in database.');
      setStatus('');
    } else {
      setStatus('Failed to load property data. Please try again.', true);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const lookupForm = document.getElementById('lookup-form');
  const addressInput = document.getElementById('address-input');
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
    suggestions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.setAttribute('role', 'option');
      item.textContent = s.label;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addressInput.value = s.label;
        suggestionsEl.hidden = true;
        addressInput.setAttribute('aria-expanded', 'false');
        loadProperty(s.addressSearch);
      });
      suggestionsEl.appendChild(item);
    });
    suggestionsEl.hidden = false;
    addressInput.setAttribute('aria-expanded', 'true');
  };

  const debouncedFetch = debounce(async (query) => {
    renderSuggestions(await fetchSuggestions(query));
  }, 280);

  addressInput.addEventListener('input', () => {
    const q = addressInput.value.trim();
    if (q.length >= 3) debouncedFetch(q);
    else suggestionsEl.hidden = true;
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

  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    suggestionsEl.hidden = true;
    let search;
    if (activeIndex >= 0 && activeSuggestions[activeIndex]) {
      search = activeSuggestions[activeIndex].addressSearch;
    } else if (activeSuggestions.length > 0) {
      search = activeSuggestions[0].addressSearch;
    } else {
      search = addressInput.value.trim().split(' ').slice(0, 2).join(' ').toUpperCase();
    }
    if (search) loadProperty(search);
  });

  // Auto-load from URL param when linked from reviewer map popup
  const params = new URLSearchParams(window.location.search);
  const parcelParam = params.get('parcel_number');
  if (parcelParam) loadPropertyById(parcelParam);
});
