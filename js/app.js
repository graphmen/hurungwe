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
    ndviLayer: null,
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
let boundaryMask = null;

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
    if (viewId === 'nav-dashboard' || viewId === 'nav-gis' || viewId === 'nav-predictive' || viewId === 'nav-terrain') {
        const dashboardView = document.getElementById('view-dashboard');
        const viewTitle = document.getElementById('view-title');
        const debugVal = document.getElementById('debug-mode-val');

        if (dashboardView) {
            dashboardView.style.display = 'grid';

            // Layout Differentiation logic
            if (viewId === 'nav-gis') {
                dashboardView.classList.add('explorer-mode');
                if (viewTitle) viewTitle.innerText = "Hurungwe GIS Explorer";
                if (debugVal) debugVal.innerText = 'GIS_EXPLORER';
            } else {
                dashboardView.classList.remove('explorer-mode');
                if (viewTitle) viewTitle.innerText = "Hurungwe Research Dashboard";
                if (debugVal) debugVal.innerText = 'DASHBOARD';
            }
        }

        switchPanel(viewId === 'nav-predictive' ? 'panel-predictive' : 'panel-dashboard');

        // Restore markers for Dashboard/GIS views
        if (map && markerCluster) {
            if (viewId === 'nav-dashboard' || viewId === 'nav-gis') {
                if (!map.hasLayer(markerCluster)) map.addLayer(markerCluster);
            }
        }

        if (map) setTimeout(() => map.invalidateSize(), 400);
    }

    if (viewId === 'nav-export') {
        const exportView = document.getElementById('view-export');
        if (exportView) exportView.style.display = 'block';
    } else if (viewId === 'nav-habitat') {
        const habitatView = document.getElementById('view-habitat');
        if (habitatView) habitatView.style.display = 'block';
    } else if (viewId === 'nav-trends') {
        showTrendsModal();
    } else if (viewId === 'nav-terrain') {
        document.getElementById('spatial-insights-card')?.scrollIntoView({ behavior: 'smooth' });
    }
}

function showTrendsModal() {
    const modal = document.getElementById('analytic-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const chartContainer = document.getElementById('modal-chart-container');
    if (chartContainer) {
        chartContainer.innerHTML = '';
        const speciesCounts = countBy(allData, 'species');
        const sorted = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        new ApexCharts(chartContainer, {
            series: [{ name: 'Records', data: sorted.map(s => s[1]) }],
            chart: { type: 'line', height: 350, foreColor: '#1A1A1A' },
            colors: ['#2D6A4F'],
            xaxis: { categories: sorted.map(s => s[0]) },
            stroke: { curve: 'smooth' },
            title: { text: 'Growth Records by Species', align: 'left' }
        }).render();
    }
}

function switchPanel(panelId) {
    console.log("Activating Analysis Panel:", panelId);
    const debugVal = document.getElementById('debug-mode-val');
    const debugBox = document.getElementById('gis-debug-state');
    if (debugBox) debugBox.style.display = 'block';

    const allPanels = ['panel-dashboard', 'panel-predictive', 'panel-ndvi', 'panel-export'];
    allPanels.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.add('hidden');
            el.classList.remove('active-dock'); // Ensure absolute removal
        }
    });

    const target = document.getElementById(panelId);
    if (target) {
        target.style.display = 'flex';
        target.classList.remove('hidden');
        target.classList.add('active-dock');
    }

    const viewTitle = document.getElementById('view-title');
    if (panelId === 'panel-predictive') {
        if (viewTitle) viewTitle.innerText = '🤖 Research Modeling Interface';
        if (debugVal) debugVal.innerText = 'PREDICTIVE';
        window.GisAppState.isPredictiveMode = true;
        window.GisAppState.isIdentifyMode = false;
        clearMapLegend(); 
        if (map) map.getContainer().style.cursor = 'crosshair';
        setTimeout(() => initSDMCharts(), 100);
    } else if (panelId === 'panel-ndvi') {
        if (viewTitle) viewTitle.innerText = '🌿 Normalized Difference Vegetation Index';
        if (debugVal) debugVal.innerText = 'NDVI QUERY';
        window.GisAppState.isPredictiveMode = false;
        window.GisAppState.isIdentifyMode = false;
        clearMapLegend();
    } else {
        if (viewTitle) viewTitle.innerText = 'Hurungwe Spatial Interface';
        if (debugVal) debugVal.innerText = 'DASHBOARD';
        window.GisAppState.isPredictiveMode = false;
        window.GisAppState.isIdentifyMode = false;
        clearMapLegend(); 
        if (map) map.getContainer().style.cursor = '';
    }
}

// ─────────────────────────────────────────────
// 5. SPATIAL & MAP LOGIC
// ─────────────────────────────────────────────
function initMap() {
    if (!document.getElementById('map')) return;
    
    // Define Basemaps
    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '&copy; CARTO' });
    const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '&copy; Google' });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });

    const baseMaps = {
        "Minimal Light": cartoLight,
        "Google Satellite Hybrid": googleHybrid,
        "OpenStreetMap": osm
    };
    
    // Initialize Map Options
    map = L.map('map', { 
        layers: [googleHybrid], // Default to Google Hybrid
        zoomControl: false 
    });
    
    // Add Built-in Controls
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map); // Added metric scale bar

    // Initial Zoom to Hurungwe Extent bounds
    const hurungweBounds = [[-17.43389, 28.82297], [-15.60714, 30.33481]];
    map.fitBounds(hurungweBounds);

    if (hurungweBoundary) {
        L.geoJSON(hurungweBoundary, { style: { color: '#E74C3C', weight: 3, fillOpacity: 0.05, dashArray: '' } }).addTo(map);
    }

    markerCluster = L.markerClusterGroup();
    buildMarkers(filteredData);
    map.addLayer(markerCluster);

    map.on('click', (e) => {
        if (window.GisAppState.isIdentifyMode) {
            performBufferAnalysis(e.latlng);
        }
        else if (window.GisAppState.isPredictiveMode) {
            const selectIcon = L.divIcon({ html: '🎯', className: 'select-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
            const selMarker = L.marker(e.latlng, { icon: selectIcon }).addTo(map);
            setTimeout(() => { if (map) map.removeLayer(selMarker); }, 3000);
            predictAtLocation(e.latlng.lat, e.latlng.lng);
        }
    });

    // Locating Events
    map.on('locationfound', (e) => {
        const radius = e.accuracy / 2;
        L.marker(e.latlng).addTo(map).bindPopup(`You are within ${radius} meters from this point`).openPopup();
        L.circle(e.latlng, radius).addTo(map);
        const btn = document.getElementById('btn-locate');
        if (btn) btn.innerHTML = '<span class="btn-icon">📍</span> Locate Me';
    });
    map.on('locationerror', (e) => {
        alert("GPS Error: " + e.message);
        const btn = document.getElementById('btn-locate');
        if (btn) btn.innerHTML = '<span class="btn-icon">📍</span> Locate Me';
    });

    // Wire up the Reset View Button
    document.getElementById('reset-view')?.addEventListener('click', (e) => {
        e.preventDefault();
        map.fitBounds(hurungweBounds);
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
    const srt = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(donutEl, {
        series: srt.map(s => s[1]),
        labels: srt.map(s => shortenLabel(s[0])),
        chart: { type: 'donut', height: 280, foreColor: '#2D3436' },
        colors: ['#2D6A4F', '#52B788', '#7A816C', '#C2923A', '#A77F6A', '#6F4E37'],
        plotOptions: { pie: { donut: { size: '75%', labels: { show: true, name: { color: '#2D3436' }, value: { color: '#2D3436' }, total: { show: true, label: 'Records', color: '#2D3436', formatter: () => filteredData.length } } } } }
    });
    donutChart.render();
    initTerrainChart();
}

function initTerrainChart() {
    const el = document.querySelector('#terrain-correlation-chart');
    if (!el) return;
    const tc = countBy(filteredData.filter(d => d.terrain), 'terrain');
    const tsrt = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5);
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
        const srt = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 6);
        donutChart.updateOptions({ series: srt.map(s => s[1]), labels: srt.map(s => shortenLabel(s[0])) });
    }

    if (terrainChart) {
        const tc = countBy(filteredData.filter(d => d.terrain), 'terrain');
        const tsrt = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5);
        terrainChart.updateOptions({
            series: [{ name: 'Sightings', data: tsrt.map(s => s[1]) }],
            xaxis: { categories: tsrt.map(s => s[0]) }
        });
    }
}

function renderHabitatProgress() {
    const list = document.getElementById('habitat-list');
    if (!list) return;
    const hc = countBy(filteredData.filter(d => d.habitat), 'habitat');
    const sorted = Object.entries(hc).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = filteredData.length || 1;
    list.innerHTML = sorted.map(([name, count]) => {
        const pct = Math.round((count / total) * 100);
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
        const [res, grid] = await Promise.all([fetch('data/research_outputs.json'), fetch('data/suitability_grid.json')]);
        window.GisAppState.researchResults = await res.json();
        window.GisAppState.suitabilityGrid = await grid.json();
        console.log("SDM_RESEARCH_LOADED_SUCCESSFULLY");
    } catch (e) { console.error("SDM_DATA_LOAD_ERROR", e); }
}

function initSDMCharts() {
    const r = window.GisAppState.researchResults;
    if (!r) return;

    // 1. Reliability (AUC & Kappa)
    const aucEl = document.querySelector("#chart-auc-kappa");
    if (aucEl) {
        const sNames = Object.keys(r.species_metrics);
        const aVals = sNames.map(s => r.species_metrics[s].auc);
        const kVals = sNames.map(s => r.species_metrics[s].kappa);

        if (window.GisAppState.sdmCharts.auc) window.GisAppState.sdmCharts.auc.destroy();
        window.GisAppState.sdmCharts.auc = new ApexCharts(aucEl, {
            series: [
                { name: 'AUC (Reliability)', data: aVals },
                { name: 'Kappa (Agreement)', data: kVals }
            ],
            chart: { height: 220, type: 'bar', toolbar: { show: false }, foreColor: '#1A1A1A' },
            colors: ['#2D6A4F', '#3498DB'],
            plotOptions: { bar: { horizontal: false, columnWidth: '55%' } },
            legend: { position: 'top' },
            xaxis: { categories: sNames.map(s => s.split(' ')[0]) },
            yaxis: { max: 1.0 }
        });
        window.GisAppState.sdmCharts.auc.render();
    }

    // 2. Variable Influence (Influence Driver)
    const impEl = document.querySelector("#chart-importance");
    if (impEl) {
        // Aggregate driver frequency
        const driverCounts = {};
        Object.values(r.species_metrics).forEach(m => {
            driverCounts[m.main_driver] = (driverCounts[m.main_driver] || 0) + 1;
        });

        const dLabels = Object.keys(driverCounts).map(d => r.driver_metadata[d] || d);
        const dValues = Object.values(driverCounts);

        if (window.GisAppState.sdmCharts.importance) window.GisAppState.sdmCharts.importance.destroy();
        window.GisAppState.sdmCharts.importance = new ApexCharts(impEl, {
            series: [{ name: 'Impact Count', data: dValues }],
            chart: { height: 220, type: 'bar', toolbar: { show: false }, foreColor: '#1A1A1A' },
            colors: ['#F39C12'],
            plotOptions: { bar: { horizontal: true } },
            xaxis: { categories: dLabels.map(l => shortenLabel(l)) },
            title: { text: 'Driver Frequency across Species', style: { fontSize: '10px' } }
        });
        window.GisAppState.sdmCharts.importance.render();
    }
}

function predictAtLocation(lat, lon) {
    const g = window.GisAppState.suitabilityGrid;
    if (!g) return;
    let latIdx = g.lats.reduce((b, c, i) => Math.abs(c - lat) < Math.abs(g.lats[b] - lat) ? i : b, 0);
    let lonIdx = g.lons.reduce((b, c, i) => Math.abs(c - lon) < Math.abs(g.lons[b] - lon) ? i : b, 0);
    const res = Object.entries(g.suitability).map(([s, grid]) => ({ species: s, score: grid[latIdx][lonIdx] || 0 }));
    renderPredictionResults(res);
}

function renderPredictionResults(results) {
    const grid = document.getElementById('prediction-results');
    const active = document.getElementById('prediction-report-active');
    const empty = document.getElementById('prediction-report-empty');
    if (empty) empty.classList.add('hidden');
    if (active) active.classList.remove('hidden');

    results.sort((a, b) => b.score - a.score);
    if (grid) {
        grid.innerHTML = results.map(r => {
            let color = '#C0392B'; // Default Red
            if (r.score >= 0.75) color = '#2D6A4F'; // Deep Green
            else if (r.score >= 0.5) color = '#3498DB'; // Azure Blue
            else if (r.score >= 0.25) color = '#F39C12'; // Vibrant Orange

            const pct = (r.score * 100).toFixed(1);
            return `
                <div class="prediction-item">
                    <h4>${r.species}</h4>
                    <div class="suitability-bar-container">
                        <div class="suitability-bar-fill" style="width: ${pct}%; background: ${color}"></div>
                    </div>
                    <small style="color:${color}; font-weight:600;">${pct}% Match</small>
                </div>
            `;
        }).join('');
    }
}

function performBufferAnalysis(latlng) {
    if (analysisBuffer) map.removeLayer(analysisBuffer);
    analysisBuffer = L.circle(latlng, { radius: 5000, color: '#2D6A4F', fillOpacity: 0.1 }).addTo(map);

    const local = allData.filter(p => getHaversineDistance(latlng, { lat: p.lat, lon: p.lon }) <= 5);

    // NEW: Stand Isolation Index (Nearest Neighbor)
    let nnDist = "No siblings nearby";
    if (local.length > 1) {
        // Find the closest point that isn't the one identified (if we clicked on one)
        const distances = local.map(p => getHaversineDistance(latlng, { lat: p.lat, lon: p.lon })).filter(d => d > 0);
        if (distances.length > 0) {
            nnDist = Math.min(...distances).toFixed(2) + " km";
        }
    }

    const popupContent = `
        <div class="map-popup">
            <h4>Impact Zone Analysis</h4>
            <p><strong>Radius:</strong> 5km</p>
            <p><strong>Sighting Count:</strong> ${local.length}</p>
            <hr>
            <p><strong>Nearest Neighbor:</strong> ${nnDist}</p>
            <small style="color: var(--accent); font-weight:bold;">Stand Health: ${local.length > 10 ? 'High Density' : 'Opportunistic'}</small>
        </div>
    `;

    L.popup().setLatLng(latlng).setContent(popupContent).openOn(map);
}

function toggleIdentifyMode() {
    // Force clean slate before starting Identify tool
    clearAllModes(true);

    window.GisAppState.isIdentifyMode = true; // explicitly enable
    const banner = document.getElementById('map-status-banner');
    const bannerText = document.getElementById('banner-text');

    if (banner) {
        banner.style.display = 'flex';
        banner.classList.remove('hidden');
        if (bannerText) bannerText.innerText = "Research Mode: Click map to analyze stand density & 5km buffer.";
    }
    if (map) map.getContainer().style.cursor = 'crosshair';
}

function toggleHeatmap() {
    // If heatmap is already active, turn it off and return to clean state
    if (heatLayer) {
        clearAllModes(false);
        console.log("Heatmap Deactivated");
        return;
    }

    // Otherwise, wipe other tools (NDVI, Buffer) and start Heatmap
    clearAllModes(true);
    const banner = document.getElementById('map-status-banner');
    const bannerText = document.getElementById('banner-text');

    const points = filteredData.map(d => [d.lat, d.lon, 0.5]);
    heatLayer = L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 13, gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1: 'red' } }).addTo(map);

    if (banner) {
        banner.style.display = 'flex';
        banner.classList.remove('hidden');
        if (bannerText) bannerText.innerText = "Density Heatmap Active: Visualizing species concentration hotspots.";
    }
    console.log("Heatmap Activated");
}

function downloadSdmMap() {
    const img = document.getElementById('sdm-map-image');
    if (!img) return;
    const link = document.createElement('a');
    link.href = img.src;
    const species = document.getElementById('sdm-species-select')?.value || 'habit_map';
    link.download = `${species}_research_capture.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearAllModes(leaveBanner = false) {
    console.log("Global Mode Reset Initiated...");
    window.GisAppState.isIdentifyMode = false;
    window.GisAppState.isPredictiveMode = false;

    // 1. Remove Specialized Layers
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (window.GisAppState.ndviLayer) { map.removeLayer(window.GisAppState.ndviLayer); window.GisAppState.ndviLayer = null; }
    if (analysisBuffer) { map.removeLayer(analysisBuffer); analysisBuffer = null; }
    if (boundaryMask) { map.removeLayer(boundaryMask); boundaryMask = null; }

    // 2. Clear Active Popups & Legend
    if (map) map.closePopup();
    clearMapLegend();

    // 3. Reset UI Elements
    if (!leaveBanner) {
        const banner = document.getElementById('map-status-banner');
        if (banner) {
            banner.style.display = 'none';
            banner.classList.add('hidden');
        }
    }

    // 4. Force Marker Cleanup in Analytical Modes
    if (map && markerCluster) map.removeLayer(markerCluster);

    // Reset visual cursor
    if (map) map.getContainer().style.cursor = '';
}

function clearMapLegend() {
    const leg = document.getElementById('map-legend');
    if (leg) {
        leg.innerHTML = '';
        leg.classList.add('hidden');
    }
}

function updateMapLegend(type) {
    const leg = document.getElementById('map-legend');
    if (!leg) return;
    leg.classList.remove('hidden');

    if (type === 'ndvi') {
        leg.innerHTML = `
            <div class="legend-card">
                <div class="legend-title">🌿 Vegetation Health (NDVI)</div>
                <div class="legend-items">
                    <div class="legend-item"><span class="swatch" style="background:darkgreen"></span> Very High (>0.5)</div>
                    <div class="legend-item"><span class="swatch" style="background:green"></span> High (0.3 - 0.5)</div>
                    <div class="legend-item"><span class="swatch" style="background:lightgreen"></span> Moderate (0.1 - 0.3)</div>
                    <div class="legend-item"><span class="swatch" style="background:yellow"></span> Low (-0.1 - 0.1)</div>
                    <div class="legend-item"><span class="swatch" style="background:brown"></span> Very Low (<-0.1)</div>
                </div>
                <div class="legend-meta" id="ndvi-legend-meta">Source: Sentinel-2 SR | Live Query</div>
            </div>
        `;
    }
}

function addBoundaryStencil() {
    if (!hurungweBoundary || !map) return;

    // 1. World-wide mask
    const worldCoords = [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]];

    // 2. District Hole
    const feature = hurungweBoundary.features[0];
    const districtCoords = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates
        : feature.geometry.coordinates[0];

    const leafletDistrict = districtCoords.map(ring => ring.map(c => [c[1], c[0]]));
    const combined = [worldCoords].concat(leafletDistrict);

    boundaryMask = L.polygon(combined, {
        fillColor: '#FDFDFD', // Match dashboard bg
        fillOpacity: 1,
        color: '#7A816C',
        weight: 1,
        dashArray: '5, 5',
        pointerEvents: 'none'
    }).addTo(map);
}

async function runNdviQuery() {
    const btn = document.getElementById('btn-run-ndvi');
    const startStr = document.getElementById('ndvi-start-date').value;
    const endStr = document.getElementById('ndvi-end-date').value;
    
    if (!startStr || !endStr) return alert("Please select both start and end dates.");
    
    btn.innerHTML = '<span class="btn-icon">⏳</span> Querying Google Servers...';
    btn.disabled = true;
    
    try {
        clearAllModes(true);
        const banner = document.getElementById('map-status-banner');
        const bannerText = document.getElementById('banner-text');
        
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
            if (bannerText) bannerText.innerText = `NDVI Active: Fetching Live Sentinel-2 Data (${startStr} to ${endStr})...`;
        }

        // Fetch Tile URL from Vercel Serverless Backend
        const response = await fetch(`/api/ndvi?start=${startStr}&end=${endStr}`);
        const data = await response.json();
        
        if (!data.success || !data.tileUrl) {
            throw new Error(data.error || "Failed to retrieve map tiles from Earth Engine.");
        }

        // Add the dynamic Google tile layer
        window.GisAppState.ndviLayer = L.tileLayer(data.tileUrl, {
            opacity: 0.9,
            attribution: '&copy; Google Earth Engine'
        }).addTo(map);
        
        // Add the Clipping Stencil
        addBoundaryStencil();
        
        updateMapLegend('ndvi');
        const metaLeg = document.getElementById('ndvi-legend-meta');
        if (metaLeg) metaLeg.innerText = `Source: Sentinel-2 SR | Dates: ${startStr} to ${endStr}`;
        
        if (bannerText) bannerText.innerText = "NDVI Active: Live Classified Vegetation Density (Sentinel-2).";
        console.log("NDVI Live Layer Successfully Rendered.");

    } catch (err) {
        console.error(err);
        alert("ERROR: " + err.message);
        clearAllModes();
    } finally {
        btn.innerHTML = '<span class="btn-icon">⚡</span> Generate High-Res Layer';
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────
// 8. EVENT LISTENERS
// ─────────────────────────────────────────────
function bindEventListeners() {
    ['nav-dashboard', 'nav-gis', 'nav-predictive', 'nav-export', 'nav-buffer', 'nav-trends', 'nav-habitat', 'nav-terrain', 'nav-heat', 'nav-stand', 'nav-ndvi'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            e.preventDefault();
            if (id === 'nav-gis') {
                clearAllModes();
                switchView('nav-gis');
            } else if (id === 'nav-buffer' || id === 'nav-stand') {
                clearAllModes(true);
                toggleIdentifyMode();
            } else if (id === 'nav-heat') {
                clearAllModes(true);
                toggleHeatmap();
            } else if (id === 'nav-ndvi') {
                clearAllModes();
                switchPanel('panel-ndvi');
            } else {
                clearAllModes();
                switchView(id);
            }
        });
    });

    // New Event Listener for the NDVI Form Submission
    document.getElementById('btn-run-ndvi')?.addEventListener('click', runNdviQuery);

    // Geographic Utilities
    document.getElementById('btn-fullscreen')?.addEventListener('click', (e) => {
        e.preventDefault();
        const mapContainer = document.querySelector('.map-panel');
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().catch(err => {
                alert(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (map) setTimeout(() => map.invalidateSize(), 200);
    });

    document.getElementById('btn-locate')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!map) return;
        const btn = e.currentTarget;
        btn.innerHTML = '<span class="btn-icon">⏳</span> Locating...';
        map.locate({setView: true, maxZoom: 16});
    });

    document.getElementById('sdm-species-select')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const img = document.getElementById('sdm-map-image');
        if (img) img.src = `data/models/${val}.png`;
        console.log("SDM Map Updated:", val);
    });

    document.getElementById('btn-download-sdm')?.addEventListener('click', downloadSdmMap);

    document.getElementById('btn-exit-mode')?.addEventListener('click', () => {
        window.GisAppState.isIdentifyMode = false;
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        document.getElementById('map-status-banner').style.display = 'none';
        if (map) map.getContainer().style.cursor = '';
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

    document.getElementById('close-modal')?.addEventListener('click', () => {
        document.getElementById('analytic-modal')?.classList.add('hidden');
    });
}
