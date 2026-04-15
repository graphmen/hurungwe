/**
 * Hurungwe Tree Species Dashboard — My Trees Trust Edition (Earth-Tones)
 * Features: Light Mode, Sage Green Sidebar, Terracotta Accents
 * Consolidated & Restored Production Version (v6.0 - Ultimate Stability)
 */

// ─────────────────────────────────────────────
// 1. GLOBAL STATE & CONSTANTS
// ─────────────────────────────────────────────
const SPECIES_COLORS = {
    'Acacia Polycantha': '#2D6A4F', 'Acacia Siebriana': '#52B788', 'Acacia Galpinii': '#7A816C',
    'Pilostigma': '#95A5A6', 'Waterberry': '#1B4332', 'Kigelia Africana': '#C2923A',
    'Munyii': '#A77F6A', 'Red Mahogany': '#6F4E37', 'Trichilia Emetica': '#4A5D23',
    'Fidebhia Abida': '#BDB76B',
};

window.GisAppState = {
    isPredictiveMode: false,
    isIdentifyMode: false,
    activeSuitabilityLayer: null,
    researchResults: null,
    suitabilityGrid: null,
    sdmCharts: { auc: null, importance: null }
};

let map = null;
let allData = [];
let filteredData = [];
let hurungweBoundary = null;
let markerCluster = null;
let heatLayer = null;
let donutChart = null;
let terrainChart = null;
let sortedDates = [];
let activeFilters = { species: 'all', habitat: 'all', monitor: 'all', dateIndex: -1, search: '' };
let analysisBuffer = null;

// ─────────────────────────────────────────────
// 2. CORE ENGINE INITIALIZATION
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Hurungwe GIS Platform — Ultimate Boot Sequence Initiated...");
    
    try {
        const [speciesRes, geoRes] = await Promise.all([
            fetch('data/species.json'), fetch('data/Hurungwe.geojson')
        ]);
        const rawData = await speciesRes.json();
        hurungweBoundary = await geoRes.json();

        allData = rawData.filter(d => d.lat && d.lon && d.species);
        filteredData = [...allData];

        // Component Bootstrap
        populateSortedDates();
        populateFilterDropdowns();
        updateStats();
        initMap();
        initCharts();
        renderHabitatProgress();
        renderActivityLog();
        initTimeSlider();
        bindEventListeners();

        // Analytical Layer Bootstrap
        await loadResearchData();
        
        console.log("ULTIMATE_GIS_LOAD_SUCCESS: Platform 100% Operational.");
    } catch (err) {
        console.error('CRITICAL_BOOT_FAILURE:', err);
    }
});

// ─────────────────────────────────────────────
// 3. UTILITIES & HELPERS
// ─────────────────────────────────────────────
function countBy(data, key) {
    return data.reduce((acc, d) => {
        const val = d[key];
        if (val) acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
}

function shortenLabel(label) {
    if (!label) return '—';
    if (label.includes('/')) return label.split('/').pop().trim();
    const words = label.split(' ');
    if (words.length > 2) return words.slice(0, 2).join(' ') + '…';
    return label;
}

function getColorForSpecies(species) {
    if (!species) return '#666666';
    for (const [key, color] of Object.entries(SPECIES_COLORS)) {
        if (species.includes(key)) return color;
    }
    return '#4A5D23';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calculateShannonIndex(data) {
    if (!data || data.length === 0) return 0;
    const counts = countBy(data, 'species');
    const total = data.length;
    let h = 0;
    Object.values(counts).forEach(count => {
        const p = count / total;
        if (p > 0) h -= p * Math.log(p);
    });
    return h.toFixed(2);
}

function getHaversineDistance(pt1, pt2) {
    const R = 6371;
    const dLat = (pt2.lat - pt1.lat) * Math.PI / 180;
    const dLon = (pt2.lng - pt1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(pt1.lat * Math.PI / 180) * Math.cos(pt2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ─────────────────────────────────────────────
// 4. UI & VIEW MANAGEMENT
// ─────────────────────────────────────────────
function populateSortedDates() {
    const dateSet = new Set(allData.map(d => d.date).filter(Boolean));
    sortedDates = Array.from(dateSet).sort();
}

function populateFilterDropdowns() {
    const speciesSet = new Set(allData.map(d => d.species));
    const habitatSet = new Set(allData.map(d => d.habitat).filter(h => h && h !== 'None'));
    const monitorSet = new Set(allData.map(d => d.monitor).filter(m => m && m !== 'None'));

    fillSelect('filter-species', Array.from(speciesSet).sort(), 'All Species');
    fillSelect('filter-habitat', Array.from(habitatSet).sort(), 'All Habitats');
    fillSelect('filter-monitor', Array.from(monitorSet).sort(), 'All Recorders');
}

function fillSelect(id, values, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="all">${placeholder}</option>` + values.map(v => `<option value="${v}">${v}</option>`).join('');
}

function applyFilters() {
    filteredData = allData.filter(d => {
        const matchSpecies = activeFilters.species === 'all' || d.species === activeFilters.species;
        const matchHabitat = activeFilters.habitat === 'all' || d.habitat === activeFilters.habitat;
        const matchMonitor = activeFilters.monitor === 'all' || d.monitor === activeFilters.monitor;
        const matchDate = activeFilters.dateIndex === -1 || d.date === sortedDates[activeFilters.dateIndex];
        const search = activeFilters.search.toLowerCase();
        const matchSearch = !search || (d.species?.toLowerCase().includes(search) || d.habitat?.toLowerCase().includes(search) || d.monitor?.toLowerCase().includes(search));
        return matchSpecies && matchHabitat && matchMonitor && matchDate && matchSearch;
    });

    refreshMap();
    updateStats();
    updateCharts();
    renderHabitatProgress();
    renderActivityLog();
}

function updateStats() {
    const totalEl = document.getElementById('stats-total-trees');
    const shannonEl = document.getElementById('stats-shannon');
    if (totalEl) totalEl.innerText = filteredData.length.toLocaleString();
    if (shannonEl) shannonEl.innerText = calculateShannonIndex(filteredData);
}

function switchView(viewId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

    console.log("Navigating to view:", viewId);
    if (viewId === 'nav-dashboard' || viewId === 'nav-gis' || viewId === 'nav-predictive') {
        const dashboardView = document.getElementById('view-dashboard');
        if (dashboardView) dashboardView.style.display = 'grid';
        switchPanel(viewId === 'nav-predictive' ? 'panel-predictive' : 'panel-dashboard');
        if (map) setTimeout(() => map.invalidateSize(), 400); 
    } else if (viewId === 'nav-export') {
        const exportView = document.getElementById('view-export');
        if (exportView) exportView.style.display = 'block';
    }
}

function switchPanel(panelId) {
    console.log("Activating Analysis Panel:", panelId);
    const debugVal = document.getElementById('debug-mode-val');
    const debugBox = document.getElementById('gis-debug-state');
    if (debugBox) debugBox.style.display = 'block';

    const allPanels = ['panel-dashboard', 'panel-predictive', 'panel-export'];
    allPanels.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
    });

    const target = document.getElementById(panelId);
    if (target) { target.style.display = 'flex'; target.classList.remove('hidden'); }

    const viewTitle = document.getElementById('view-title');
    if (panelId === 'panel-predictive') {
        if (viewTitle) viewTitle.innerText = '🤖 Research Modeling Interface';
        if (debugVal) debugVal.innerText = 'PREDICTIVE';
        window.GisAppState.isPredictiveMode = true;
        window.GisAppState.isIdentifyMode = false;
        if (map) map.getContainer().style.cursor = 'crosshair';
        setTimeout(() => initSDMCharts(), 100);
    } else {
        if (viewTitle) viewTitle.innerText = 'District Distribution Map';
        if (debugVal) debugVal.innerText = 'DASHBOARD';
        window.GisAppState.isPredictiveMode = false;
        if (map) map.getContainer().style.cursor = '';
    }
}

// ─────────────────────────────────────────────
// 5. SPATIAL & MAP LOGIC
// ─────────────────────────────────────────────
function initMap() {
    if (!document.getElementById('map')) return;
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '&copy; CARTO' });
    map = L.map('map', { layers: [tiles], zoomControl: false }).setView([-16.5, 29.5], 9);
    L.control.zoom({ position: 'topright' }).addTo(map);

    if (hurungweBoundary) {
        L.geoJSON(hurungweBoundary, { style: { color: '#7A816C', weight: 2, fillOpacity: 0.05, dashArray: '6, 4' } }).addTo(map);
    }

    markerCluster = L.markerClusterGroup();
    buildMarkers(filteredData);
    map.addLayer(markerCluster);

    map.on('click', (e) => {
        if (window.GisAppState.isIdentifyMode) performBufferAnalysis(e.latlng);
        else if (window.GisAppState.isPredictiveMode) {
            const selectIcon = L.divIcon({ html: '🎯', className: 'select-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
            const selMarker = L.marker(e.latlng, { icon: selectIcon }).addTo(map);
            setTimeout(() => { if (map) map.removeLayer(selMarker); }, 3000);
            predictAtLocation(e.latlng.lat, e.latlng.lng);
        }
    });
}

function buildMarkers(data) {
    if (!markerCluster) return;
    markerCluster.clearLayers();
    data.forEach(p => {
        const m = L.circleMarker([p.lat, p.lon], { radius: 6, fillColor: getColorForSpecies(p.species), color: '#fff', weight: 2, fillOpacity: 0.85 });
        m.bindPopup(`<div class="map-popup"><h4>${p.species}</h4><p>${p.habitat}</p></div>`);
        markerCluster.addLayer(m);
    });
}

function refreshMap() { buildMarkers(filteredData); }

// ─────────────────────────────────────────────
// 6. CHARTS & INSIGHTS
// ─────────────────────────────────────────────
function initCharts() {
    const donutEl = document.querySelector('#species-donut-chart');
    if (!donutEl) return;
    const sc = countBy(filteredData, 'species');
    const srt = Object.entries(sc).sort((a,b) => b[1]-a[1]).slice(0, 6);
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(donutEl, {
        series: srt.map(s => s[1]),
        labels: srt.map(s => shortenLabel(s[0])),
        chart: { type: 'donut', height: 280 },
        colors: ['#2D6A4F', '#52B788', '#7A816C', '#C2923A', '#A77F6A', '#6F4E37'],
        plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'Records', formatter: () => filteredData.length } } } } }
    });
    donutChart.render();
    initTerrainChart();
}

function initTerrainChart() {
    const el = document.querySelector('#terrain-correlation-chart');
    if (!el) return;
    const tc = countBy(filteredData.filter(d => d.terrain), 'terrain');
    const tsrt = Object.entries(tc).sort((a,b) => b[1]-a[1]).slice(0, 5);
    if (terrainChart) terrainChart.destroy();
    terrainChart = new ApexCharts(el, {
        series: [{ name: 'Sightings', data: tsrt.map(s => s[1]) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#2D6A4F'],
        xaxis: { categories: tsrt.map(s => s[0]) }
    });
    terrainChart.render();
}

function updateCharts() {
    if (donutChart) {
        const sc = countBy(filteredData, 'species');
        const srt = Object.entries(sc).sort((a,b) => b[1]-a[1]).slice(0, 6);
        donutChart.updateOptions({ series: srt.map(s => s[1]), labels: srt.map(s => shortenLabel(s[0])) });
    }
}

function renderHabitatProgress() {
    const list = document.getElementById('habitat-list');
    if (!list) return;
    const hc = countBy(filteredData.filter(d => d.habitat), 'habitat');
    const sorted = Object.entries(hc).sort((a,b) => b[1]-a[1]).slice(0, 4);
    const total = filteredData.length || 1;
    list.innerHTML = sorted.map(([name, count]) => {
        const pct = Math.round((count/total)*100);
        return `<div class="progress-item"><div class="progress-labels"><span>${name}</span><span>${pct}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%"></div></div></div>`;
    }).join('');
}

function renderActivityLog() {
    const log = document.getElementById('activity-log');
    if (log) {
        const slice = filteredData.slice(0, 6);
        log.innerHTML = slice.map(p => `<div class="activity-item">🌳 <strong>${p.species}</strong><br><small>${p.habitat} · ${p.date}</small></div>`).join('');
    }
}

function initTimeSlider() {
    const slider = document.getElementById('time-slider');
    if (!slider || sortedDates.length === 0) return;
    slider.min = 0; slider.max = sortedDates.length - 1; slider.value = sortedDates.length - 1;
    slider.addEventListener('input', () => { activeFilters.dateIndex = parseInt(slider.value); applyFilters(); });
}

// ─────────────────────────────────────────────
// 7. RESEARCH & PREDICTIVE LOGIC
// ─────────────────────────────────────────────
async function loadResearchData() {
    try {
        const [res, grid] = await Promise.all([ fetch('data/research_outputs.json'), fetch('data/suitability_grid.json') ]);
        window.GisAppState.researchResults = await res.json();
        window.GisAppState.suitabilityGrid = await grid.json();
        console.log("SDM_RESEARCH_LOADED_SUCCESSFULLY");
    } catch(e) { console.error("SDM_DATA_LOAD_ERROR", e); }
}

function initSDMCharts() {
    const r = window.GisAppState.researchResults;
    if (!r) return;
    const aucEl = document.querySelector("#chart-auc-kappa");
    if (aucEl) {
        const sNames = Object.keys(r.species_metrics);
        const aVals = sNames.map(s => r.species_metrics[s].auc);
        if (window.GisAppState.sdmCharts.auc) window.GisAppState.sdmCharts.auc.destroy();
        window.GisAppState.sdmCharts.auc = new ApexCharts(aucEl, { series: [{ name: 'AUC', data: aVals }], chart: { height: 180, type: 'bar' }, colors: ['#2D6A4F'], xaxis: { categories: sNames.map(s => s.split(' ')[0]) } });
        window.GisAppState.sdmCharts.auc.render();
    }
}

function predictAtLocation(lat, lon) {
    const g = window.GisAppState.suitabilityGrid;
    if (!g) return;
    let latIdx = g.lats.reduce((b,c,i) => Math.abs(c-lat) < Math.abs(g.lats[b]-lat) ? i : b, 0);
    let lonIdx = g.lons.reduce((b,c,i) => Math.abs(c-lon) < Math.abs(g.lons[b]-lon) ? i : b, 0);
    const res = Object.entries(g.suitability).map(([s, grid]) => ({ species: s, score: grid[latIdx][lonIdx] || 0 }));
    renderPredictionResults(res);
}

function renderPredictionResults(results) {
    const grid = document.getElementById('prediction-results');
    const active = document.getElementById('prediction-report-active');
    const empty = document.getElementById('prediction-report-empty');
    if (empty) empty.classList.add('hidden');
    if (active) active.classList.remove('hidden');
    results.sort((a,b) => b.score - a.score);
    if (grid) {
        grid.innerHTML = results.map(r => `<div class="prediction-item"><h4>${r.species}</h4><div class="suitability-bar-container"><div class="suitability-bar-fill" style="width: ${r.score*100}%"></div></div><small>${(r.score*100).toFixed(1)}% Match</small></div>`).join('');
    }
}

function performBufferAnalysis(latlng) {
    if (analysisBuffer) map.removeLayer(analysisBuffer);
    analysisBuffer = L.circle(latlng, { radius: 5000, color: '#2D6A4F' }).addTo(map);
    const local = allData.filter(p => getHaversineDistance(latlng, { lat: p.lat, lon: p.lon }) <= 5);
    L.popup().setLatLng(latlng).setContent(`<h4>Impact Zone</h4><p>Found ${local.length} records in 5km.</p>`).openOn(map);
}

// ─────────────────────────────────────────────
// 8. EVENT LISTENERS
// ─────────────────────────────────────────────
function bindEventListeners() {
    ['nav-dashboard', 'nav-gis', 'nav-predictive', 'nav-export', 'nav-buffer'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            e.preventDefault();
            if (id === 'nav-buffer') { window.GisAppState.isIdentifyMode = true; map.getContainer().style.cursor = 'crosshair'; }
            else switchView(id);
        });
    });

    ['filter-species', 'filter-habitat', 'filter-monitor'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            activeFilters[id.replace('filter-', '')] = e.target.value;
            applyFilters();
        });
    });

    document.getElementById('search-input')?.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        applyFilters();
    });

    document.getElementById('mobile-menu-trigger')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.sidebar')?.classList.toggle('mobile-active');
    });
}
