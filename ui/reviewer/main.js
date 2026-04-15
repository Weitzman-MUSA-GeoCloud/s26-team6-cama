// reviewer ui map setup
// initializes a leaflet map centered on philly with a carto positron basemap
// nothing fancy. data layers come in a later issue

/* global L */

// wait for the dom to be ready before grabbing the map container
document.addEventListener('DOMContentLoaded', () => {

  // center on city hall, zoom 12 shows the whole city
  const philly = [39.9526, -75.1652];
  const initialZoom = 12;

  // init the map on the property-map div
  // eslint-disable-next-line no-unused-vars
  const map = L.map('property-map').setView(philly, initialZoom);

  // carto positron tiles. free, no api key, light gray so data pops on top
  // attribution is required by the carto terms of service, dont remove it
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // need to talk to group to confirm
  // the four radio buttons live in the top right corner of the map container
  // leaflet puts its own zoom control in the top left by default so no overlap yet
  // but if we add more leaflet controls later we may need to move things around
});
