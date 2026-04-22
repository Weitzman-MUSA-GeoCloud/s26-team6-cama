// widget main script — OPA ID lookup + assessment history chart and table

/* global ApexCharts */

// Philadelphia Open Data (Socrata) endpoints
const opaPropertiesUrl = 'https://data.phila.gov/resource/qqem-6pc7.json';
const opaAssessmentsUrl = 'https://data.phila.gov/resource/w7rb-qrpr.json';

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

let valuationChart = null;

const setStatus = (msg) => {
  document.getElementById('lookup-status').textContent = msg;
};

const updatePropertyInfo = (prop, opaId, assessData) => {
  document.getElementById('property-empty').hidden = true;
  document.getElementById('property-loaded').removeAttribute('hidden');
  document.getElementById('property-address').textContent =
    prop['location'] || prop['street_address'] || '—';
  document.getElementById('property-city-zip').textContent = 'Philadelphia, PA';
  document.getElementById('meta-opa-id').textContent = opaId;
  document.getElementById('meta-tax-balance').textContent = '—';
  document.getElementById('meta-record-count').textContent =
    `${assessData.length} year${assessData.length !== 1 ? 's' : ''}`;
};

const renderValuationChart = (assessData) => {
  const el = document.getElementById('valuation-chart');
  el.classList.add('chart-loaded');

  const years = assessData.map((d) => d['tax_year'] || d['year']);
  const values = assessData.map((d) => Number(d['market_value']) || 0);

  const options = {
    chart: {
      type: 'area',
      height: 280,
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: '"Open Sans", system-ui, sans-serif',
    },
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
    valuationChart.updateOptions({ xaxis: { categories: years } });
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
    `<td>${d['tax_year'] || d['year'] || '—'}</td>`,
    `<td>${formatCurrency(d['market_value'])}</td>`,
    `<td>${formatCurrency(d['taxable_land'])}</td>`,
    `<td>${formatCurrency(d['taxable_improvement'])}</td>`,
    `<td>${formatCurrency(d['exempt_land'])}</td>`,
    `<td>${formatCurrency(d['exempt_building'])}</td>`,
    '</tr>',
  ].join('')).join('');
};

const loadProperty = async (opaId) => {
  setStatus('Loading…');

  try {
    const [propRes, assessRes] = await Promise.all([
      fetch(`${opaPropertiesUrl}?parcel_number=${encodeURIComponent(opaId)}&$limit=1`),
      fetch(`${opaAssessmentsUrl}?parcel_number=${encodeURIComponent(opaId)}&$order=tax_year%20ASC&$limit=50`),
    ]);

    if (!propRes.ok || !assessRes.ok) {
      throw new Error(`API error: ${propRes.status} / ${assessRes.status}`);
    }

    const [propData, assessData] = await Promise.all([propRes.json(), assessRes.json()]);

    if (propData.length === 0) {
      setStatus('No property found for that OPA ID. Please check the number and try again.');
      return;
    }

    setStatus('');
    updatePropertyInfo(propData[0], opaId, assessData);
    renderValuationChart(assessData);
    populateValuationTable(assessData);
  } catch (err) {
    console.error('Property lookup failed:', err);
    setStatus('Failed to load property data. Please try again.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const lookupForm = document.getElementById('lookup-form');
  const opaIdInput = document.getElementById('opa-id-input');

  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const opaId = opaIdInput.value.trim();

    if (!/^\d{9,10}$/.test(opaId)) {
      setStatus('Please enter a valid OPA ID (9 or 10 digits, numbers only).');
      return;
    }

    loadProperty(opaId);
  });
});
