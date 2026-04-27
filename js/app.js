/**
 * Hurungwe Tree Species Dashboard — My Trees Trust Edition (Earth-Tones)
 * Features: Light Mode, Sage Green Sidebar, Terracotta Accents
 * Consolidated & Restored Production Version (v6.0 - Ultimate Stability)
 */

// ─────────────────────────────────────────────
// 1. GLOBAL STATE & CONSTANTS
// ─────────────────────────────────────────────
const SPECIES_COLORS = {
    'Acacia Polycantha': '#006D4E', // Emerald Deep
    'Acacia Siebriana': '#34A853',  // Botanical Green
    'Acacia Galpinii': '#70AF85',   // Sage Soft
    'Pilostigma': '#4EB1BA',        // Teal
    'Waterberry': '#014D4E',        // Forest
    'Kigelia Africana': '#E67E22',  // Sunset Orange
    'Munyii': '#D35400',            // Burnt Sienna
    'Red Mahogany': '#8E44AD',      // Plum (Mouth-watering accent)
    'Trichilia Emetica': '#27AE60', // Vibrant Leaf
    'Fidebhia Abida': '#F1C40F',    // Sunlit Yellow
};

window.GisAppState = {
    allData: [],
    filteredData: [],
    speciesSummary: {},
    suitabilityGrid: null,
    isPredictiveMode: false,
    sdmCharts: { auc: null, importance: null },
    variableImportance: null,
    activeLayerToken: 0,
    isClimateMode: false,
    isComparisonMode: false,
    sideBySideControl: null,
    comparisonLayers: { left: null, right: null },
    liveLayer: null,
    theme: localStorage.getItem('hurungwe-theme') || 'light'
};

// Firebase for Dashboard (Real Config attached)
const fbConfig = {
    apiKey: "AIzaSyD0sDQNDfAH2AYrxJhwNa4r77uu98Gz4f8",
    authDomain: "hurungwe-gis-f8099.firebaseapp.com",
    projectId: "hurungwe-gis-f8099",
    storageBucket: "hurungwe-gis-f8099.firebasestorage.app",
    messagingSenderId: "315238946268",
    appId: "1:315238946268:web:9ca8edd76fff065001ab19",
    measurementId: "G-V7D6EK2VDM"
};
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(fbConfig);
    // ─── FIREBASE AUTH: Ensure session for Firestore rules ───
    if (typeof firebase.auth === 'function') {
        window.GisAppState.authPromise = firebase.auth().signInAnonymously()
            .then((user) => {
                console.log("Firebase Auth: Success. User ID:", user.user.uid);
                return user;
            })
            .catch(err => {
                console.error("Firebase Auth Failure:", err.message);
                throw err;
            });
    } else {
        console.warn("Firebase Auth: SDK not loaded.");
        window.GisAppState.authPromise = Promise.reject(new Error("Auth SDK missing"));
    }
}

var map = null;
var allData = [];
var filteredData = [];
var hurungweBoundary = null;
var markerCluster = null;
var heatLayer = null;
var donutChart = null;
var terrainChart = null;
var sortedDates = [];
var activeFilters = { species: 'all', habitat: 'all', monitor: 'all', dateIndex: -1, search: '' };
var boundaryMask = null;

// ─────────────────────────────────────────────
// 2. CORE ENGINE INITIALIZATION
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Hurungwe GIS Platform — Ultimate Boot Sequence Initiated...");

    // ─────────────────────────────────────────────
    // 0. ENVIRONMENT & SECURITY VALIDATION
    // ─────────────────────────────────────────────
    if (window.location.protocol === 'file:') {
        alert("⚠️ SECURITY RESTRICITON:\n\nModern browsers block data loading via the 'file://' protocol for security.\n\nPlease run 'npm start' in the project directory to view the dashboard correctly.");
        const viewTitle = document.getElementById('view-title');
        if (viewTitle) viewTitle.innerHTML = '<span style="color:#ff5252;">⚠️ SECURITY BLOCK: Use a Local Server (npm start)</span>';
        return;
    }

    // 1. PRIMARY BOOT: UI & Map (Immediate)
    initMap();
    initCharts();
    initTheme();
    bindEventListeners();
    initPremiumAesthetics();
    initLiveFieldData();
    switchView('nav-dashboard');

    // Final UI Polish
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            console.log("Startup: Layout synchronized.");
        }
    }, 1000);

    // 2. DATA BOOT: Heavy Assets (Asynchronous)
    try {
        console.log("Fetching static GIS assets...");
        const [speciesRes, geoRes] = await Promise.all([
            fetch('data/species.json'), fetch('data/Hurungwe.geojson')
        ]);
        
        if (speciesRes.ok && geoRes.ok) {
            const rawData = await speciesRes.json();
            hurungweBoundary = await geoRes.json();
            
            allData = rawData.filter(d => d.lat && d.lon && d.species);
            filteredData = [...allData];

            populateSortedDates();
            populateFilterDropdowns();
            updateStats();
            renderHabitatProgress();
            renderActivityLog();
            initTimeSlider();

            if (map && hurungweBoundary) {
                L.geoJSON(hurungweBoundary, { style: { color: '#E74C3C', weight: 3, fillOpacity: 0.05 } }).addTo(map);
            }
            if (typeof refreshMap === 'function') refreshMap();
            console.log("ULTIMATE_GIS_LOAD_SUCCESS: Static data and filters ready.");
        } else {
            console.warn("Non-critical load failure: Static GIS files could not be fetched.");
        }
        if (typeof loadResearchData === 'function') await loadResearchData();
    } catch (err) {
        console.warn('Non-critical load failure (Static Assets):', err.message);
    }
});

// ─────────────────────────────────────────────
// 3. PREMIUM UI & WOW FACTORS
// ─────────────────────────────────────────────
function initTheme() {
    if (window.GisAppState.theme === 'dark') {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = 'fas fa-sun';
    } else {
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = 'fas fa-moon';
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    window.GisAppState.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('hurungwe-theme', window.GisAppState.theme);

    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';

    console.log(`Theme Intelligence: Switching to ${window.GisAppState.theme.toUpperCase()} mode.`);
    
    // Refresh charts to adapt to new coordinate colors if needed
    const foreColor = isDark ? '#F8FAFC' : '#1E293B';
    if (typeof donutChart !== 'undefined' && donutChart) donutChart.updateOptions({ chart: { foreColor: foreColor } });
}

function initPremiumAesthetics() {
    console.log("Aesthetic Pulse: Synchronizing Premium UI...");
    
    // Update Health Gauge
    const gaugeVal = document.getElementById('health-gauge-val');
    const scoreText = document.getElementById('health-score');
    if (gaugeVal && scoreText) {
        // Target 84% Resilience
        const offset = 283 - (283 * 0.84); 
        setTimeout(() => {
            gaugeVal.style.strokeDashoffset = offset;
            animateValue(scoreText, 0, 84, 2000);
        }, 800);
    }
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

async function toggleComparisonMode() {
    const btn = document.getElementById('toggle-comparison');
    if (!btn) return;

    if (window.GisAppState.isComparisonMode) {
        exitComparisonMode();
        return;
    }

    console.log("Comparison Engine: Activating Split-View Spatiotemporal Sync...");
    window.GisAppState.isComparisonMode = true;
    btn.classList.add('active');
    btn.innerHTML = '<i class="fas fa-times"></i> Exit Comparison';
    document.body.classList.add('split-mode-active');
    
    showMapLoader("Initializing Comparison Engine...");

    try {
        // Fetch 2020 and 2021 layers
        const [res2020, res2021] = await Promise.all([
            fetch(`/api/landcover?year=2020&geom=${JSON.stringify(hurungweBoundary)}`),
            fetch(`/api/landcover?year=2021&geom=${JSON.stringify(hurungweBoundary)}`)
        ]);
        
        const data2020 = await res2020.json();
        const data2021 = await res2021.json();

        if (window.GisAppState.sideBySideControl) {
            map.removeControl(window.GisAppState.sideBySideControl);
        }

        const leftLayer = L.tileLayer(data2020.tileUrl, { opacity: 1 }).addTo(map);
        const rightLayer = L.tileLayer(data2021.tileUrl, { opacity: 1 }).addTo(map);

        window.GisAppState.comparisonLayers = { left: leftLayer, right: rightLayer };
        
        window.GisAppState.sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(map);
        
        hideMapLoader();
        showMapStatus("Comparison Active: Slide center to compare 2020 with 2021.");
        
    } catch (err) {
        console.error("Comparison Error:", err);
        hideMapLoader();
        exitComparisonMode();
    }
}

function exitComparisonMode() {
    console.log("Comparison Engine: Terminating Split-View...");
    window.GisAppState.isComparisonMode = false;
    const btn = document.getElementById('toggle-comparison');
    if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-columns"></i> Compare 2020 vs 2021';
    }
    document.body.classList.remove('split-mode-active');

    if (window.GisAppState.sideBySideControl) {
        map.removeControl(window.GisAppState.sideBySideControl);
        window.GisAppState.sideBySideControl = null;
    }
    
    if (window.GisAppState.comparisonLayers.left) map.removeLayer(window.GisAppState.comparisonLayers.left);
    if (window.GisAppState.comparisonLayers.right) map.removeLayer(window.GisAppState.comparisonLayers.right);
    
    hideMapStatus();
}

// ─────────────────────────────────────────────
// 4. UTILITIES & HELPERS
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
    // Premium select styling
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
    // Global UI Reset (Clear all overlays/modals)
    document.getElementById('analytic-modal')?.classList.add('hidden');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
    document.querySelector('.sidebar')?.classList.remove('mobile-active');
    document.getElementById('map-status-banner')?.classList.add('hidden');
    document.getElementById('map-status-banner').style.display = 'none';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

    console.log("Navigating to view:", viewId);
    const dashboardView = document.getElementById('view-dashboard');
    const dashboardResidentIds = [
        'nav-dashboard', 'nav-gis', 'nav-predictive', 'nav-terrain', 'nav-policy', 
        'nav-ndvi', 'nav-carbon', 'nav-vulnerability', 'nav-landcover', 'nav-heat', 'nav-data'
    ];

    if (dashboardResidentIds.includes(viewId)) {
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
            }
        }

        let targetPanel = 'panel-dashboard';
        if (viewId === 'nav-predictive') targetPanel = 'panel-predictive';
        if (viewId === 'nav-policy') targetPanel = 'panel-policy';
        if (viewId === 'nav-data') targetPanel = 'panel-data';
        
        switchPanel(targetPanel);
        if (viewId === 'nav-policy') populatePolicyPanel();

        // Restore markers for Dashboard/GIS views
        if (map && markerCluster) {
            if (viewId === 'nav-dashboard' || viewId === 'nav-gis') {
                if (!map.hasLayer(markerCluster)) map.addLayer(markerCluster);
            }
        }

        // Force map to adapt to new layout immediately
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
                console.log("View Switch: Map container synchronized.");
            }, 300);
        }

        // Premium: Handle contextual comparison toggle
        const toggleBtn = document.getElementById('toggle-comparison');
        if (toggleBtn) {
            if (viewId === 'nav-landcover') {
                toggleBtn.style.display = 'flex';
            } else {
                toggleBtn.style.display = 'none';
                if (window.GisAppState.isComparisonMode) exitComparisonMode();
            }
        }
    } else {
        // Hide main dashboard for other full-page views
        if (dashboardView) dashboardView.style.display = 'none';
    }

    if (viewId === 'nav-export') {
        const exportView = document.getElementById('view-export');
        if (exportView) exportView.style.display = 'block';
    } else if (viewId === 'nav-habitat') {
        const habitatView = document.getElementById('view-habitat');
        if (habitatView) habitatView.style.display = 'block';
    } else if (viewId === 'nav-trends') {
        const trendsView = document.getElementById('view-trends');
        if (trendsView) trendsView.style.display = 'block';
        showTrendsModal();
    } else if (viewId === 'nav-terrain') {
        if (dashboardView) dashboardView.style.display = 'grid'; // Ensure dashboard is visible
        document.getElementById('spatial-insights-card')?.scrollIntoView({ behavior: 'smooth' });
    }
}

function showTrendsModal() {
    const modal = document.getElementById('analytic-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const chartContainer = document.getElementById('modal-chart-container');
    const descContainer = document.getElementById('modal-description');
    
    if (chartContainer) {
        chartContainer.innerHTML = '';
        const speciesCounts = countBy(allData, 'species');
        const sorted = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]); // All species

        new ApexCharts(chartContainer, {
            series: [{ name: 'Growth Records', data: sorted.map(s => s[1]) }],
            chart: { 
                type: 'bar', 
                height: 550, // Expanded height
                foreColor: '#2D3436',
                animations: { enabled: true },
                toolbar: { show: false }
            },
            colors: ['#2D6A4F'],
            plotOptions: { 
                bar: { 
                    borderRadius: 4, 
                    horizontal: true,
                    barHeight: '70%' // Better spacing for more bars
                } 
            },
            xaxis: { categories: sorted.map(s => s[0]) },
            dataLabels: { enabled: true, formatter: (val) => `${val} trees` },
            title: { text: 'Full Species Recruitment Distribution', align: 'left', style: { fontSize: '14px', fontWeight: 700 } }
        }).render();

        // Populate dynamic insights
        if (descContainer && sorted.length > 0) {
            const topSpecies = sorted[0][0];
            const secondSpecies = sorted[1] ? sorted[1][0] : 'other indigenous varieties';
            
            descContainer.innerHTML = `
                <p>The current temporal analysis reveals that <strong>${topSpecies}</strong> is exhibiting the highest recruitment and adaptation rates across Hurungwe District, followed closely by <strong>${secondSpecies}</strong>.</p>
                <p style="margin-top: 10px;">This frequency indicates a high degree of survival in current bioclimatic conditions, suggesting these species are becoming the "ecological anchors" of the corridor's recovery.</p>
                <div style="margin-top: 15px; padding: 10px; background: rgba(45, 106, 79, 0.05); border-radius: 8px;">
                    <small><strong>Strategic Recommendation:</strong> Prioritize seed collection and nursery propagation for these top-performing species to accelerate landscape restoration in high-drainage zones.</small>
                </div>
            `;
        }
    }
}

function switchPanel(panelId) {
    console.log("Activating Analysis Panel:", panelId);
    const debugVal = document.getElementById('debug-mode-val');
    const debugBox = document.getElementById('gis-debug-state');
    if (debugBox) debugBox.style.display = 'block';

    const allPanels = ['panel-dashboard', 'panel-predictive', 'panel-ndvi', 'panel-carbon', 'panel-landcover', 'panel-vulnerability', 'panel-policy', 'panel-data'];
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

    // Toggle Map Field Filters Control
    const mapFilters = document.getElementById('map-field-filters');
    if (mapFilters) {
        if (panelId === 'panel-data') {
            mapFilters.classList.remove('hidden');
        } else {
            mapFilters.classList.add('hidden');
        }
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
        if (viewTitle) viewTitle.innerText = '🌿 Vegetation Health (NDVI)';
        if (debugVal) debugVal.innerText = 'NDVI QUERY';
        window.GisAppState.isPredictiveMode = false;
        clearMapLegend();
    } else if (panelId === 'panel-carbon') {
        if (viewTitle) viewTitle.innerText = '🌳 Carbon Stock Mapping';
        if (debugVal) debugVal.innerText = 'CARBON QUERY';
        window.GisAppState.isPredictiveMode = false;
        clearMapLegend();
    } else if (panelId === 'panel-landcover') {
        if (viewTitle) viewTitle.innerText = '🗺️ Land Cover / Land Use Mapping';
        if (debugVal) debugVal.innerText = 'LULC QUERY';
        window.GisAppState.isPredictiveMode = false;
        clearMapLegend();
    } else if (panelId === 'panel-data') {
        if (viewTitle) viewTitle.innerText = '📊 Live Field Data Integrator';
        if (debugVal) debugVal.innerText = 'LIVE DATA';
        window.GisAppState.isPredictiveMode = false;
        clearMapLegend();
    } else {
        if (viewTitle) viewTitle.innerText = 'Hurungwe Research Dashboard';
        if (debugVal) debugVal.innerText = 'DASHBOARD';
        window.GisAppState.isPredictiveMode = false;
        clearMapLegend(); 
        if (map) map.getContainer().style.cursor = '';
    }

    // Force map to recalculate its container size immediately after panel shift
    if (typeof map !== 'undefined' && map !== null) {
        try {
            map.invalidateSize();
            setTimeout(() => {
                if (map) map.invalidateSize({ animate: true });
                console.log("Layout Sync: Map container recalculated.");
            }, 100);
        } catch (e) {
            console.warn("Map invalidateSize failed (map may not be ready):", e.message);
        }
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
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
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
        if (window.GisAppState.isPredictiveMode) {
            const selectIcon = L.divIcon({ html: '🎯', className: 'select-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
            const selMarker = L.marker(e.latlng, { icon: selectIcon }).addTo(map);
            setTimeout(() => { if (map) map.removeLayer(selMarker); }, 3000);
            predictAtLocation(e.latlng.lat, e.latlng.lng);
        } else if (window.GisAppState.isClimateMode) {
            const selectIcon = L.divIcon({ html: '🔍', className: 'select-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
            const selMarker = L.marker(e.latlng, { icon: selectIcon }).addTo(map);
            setTimeout(() => { if (map) map.removeLayer(selMarker); }, 3000);
            inspectClimateAtLocation(e.latlng.lat, e.latlng.lng);
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
        chart: { 
            type: 'donut', 
            height: 280, 
            foreColor: '#2D3436', 
            animations: { enabled: true, easing: 'easeinout', speed: 800 },
            dropShadow: { enabled: true, blur: 4, left: 0, top: 4, opacity: 0.1 }
        },
        colors: ['#006D4E', '#E67E22', '#34A853', '#014D4E', '#D35400', '#4EB1BA'],
        legend: { 
            position: 'bottom', 
            fontSize: '12px', 
            fontWeight: 500, 
            labels: { colors: '#2D3436' },
            markers: { radius: 12 },
            itemMargin: { horizontal: 8, vertical: 4 }
        },
        plotOptions: { 
            pie: { 
                donut: { 
                    size: '72%', 
                    labels: { 
                        show: true, 
                        name: { show: true, fontSize: '12px', fontWeight: 600, color: '#636e72', offsetY: -10 }, 
                        value: { show: true, fontSize: '20px', fontWeight: 700, color: '#2d3436', offsetY: 10, formatter: (val) => val }, 
                        total: { show: true, label: 'TOTAL SIGHTINGS', fontSize: '9px', fontWeight: 800, color: '#b2bec3', formatter: () => filteredData.length } 
                    } 
                } 
            } 
        },
        stroke: { width: 0 },
        dataLabels: { enabled: true, dropShadow: { enabled: false } }
    });
    donutChart.render();
    initTerrainChart();
}

function initTerrainChart() {
    const el = document.querySelector('#terrain-correlation-chart');
    if (!el) return;
    
    const tc = countBy(filteredData.filter(d => d.terrain), 'terrain');
    const terrains = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(s => s[0]);
    if (terrains.length === 0) return;

    const sc = countBy(filteredData, 'species');
    const topSpecies = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(s => s[0]);

    const series = topSpecies.map(sp => {
        return {
            name: shortenLabel(sp),
            data: terrains.map(t => filteredData.filter(d => d.terrain === t && d.species === sp).length)
        };
    });

    // Add 'Other' category
    series.push({
        name: 'Other Species',
        data: terrains.map(t => filteredData.filter(d => d.terrain === t && !topSpecies.includes(d.species)).length)
    });

    if (terrainChart) terrainChart.destroy();
    terrainChart = new ApexCharts(el, {
        series: series,
        chart: { 
            type: 'bar', 
            height: 320, 
            stacked: true, 
            toolbar: { show: false }, 
            animations: { enabled: true } 
        },
        colors: ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#B7E4C7'], 
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        xaxis: { 
            categories: terrains, 
            labels: { style: { fontWeight: 600, fontSize: '10px', colors: '#4A5568' } } 
        },
        yaxis: { labels: { style: { fontSize: '10px' } } },
        legend: { position: 'bottom', fontSize: '10px', horizontalAlign: 'left', markers: { radius: 12 } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light', y: { formatter: val => `${val} sightings` } }
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
        const terrains = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(s => s[0]);
        
        const sc = countBy(filteredData, 'species');
        const topSpecies = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(s => s[0]);

        const series = topSpecies.map(sp => {
            return {
                name: shortenLabel(sp),
                data: terrains.map(t => filteredData.filter(d => d.terrain === t && d.species === sp).length)
            };
        });
        series.push({
            name: 'Other Species',
            data: terrains.map(t => filteredData.filter(d => d.terrain === t && !topSpecies.includes(d.species)).length)
        });

        terrainChart.updateOptions({
            series: series,
            xaxis: { categories: terrains }
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
        return `
            <div class="progress-item">
                <div class="progress-labels">
                    <span>${name}</span>
                    <span class="pct-badge">${pct}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${pct}%"></div>
                </div>
            </div>`;
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
        const [res, grid, imp] = await Promise.all([
            fetch('data/research_outputs.json'), 
            fetch('data/suitability_grid.json'),
            fetch('data/variable_importance.json')
        ]);
        window.GisAppState.researchResults = await res.json();
        window.GisAppState.suitabilityGrid = await grid.json();
        window.GisAppState.variableImportance = await imp.json();
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
            colors: ['#006D4E', '#3498DB'],
            plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
            legend: { position: 'top', fontWeight: 600 },
            xaxis: { categories: sNames.map(s => s.split(' ')[0]) },
            yaxis: { max: 1.0 },
            dataLabels: { enabled: false }
        });
        window.GisAppState.sdmCharts.auc.render();
    }

    // 2. Variable Influence Heatmap (Premium Visualization)
    const impEl = document.querySelector("#chart-importance");
    const vImp = window.GisAppState.variableImportance;
    if (impEl && vImp) {
        // Transform grid data for ApexCharts Heatmap
        // Series should be an array of { name: species, data: [{ x: var, y: value }, ...] }
        const series = vImp.species.map(sp => {
            return {
                name: sp,
                data: vImp.variables.map(v => {
                    const match = vImp.grid.find(g => g.species === sp && g.variable === v);
                    return {
                        x: v,
                        y: match ? match.importance : 0
                    };
                })
            };
        });

        if (window.GisAppState.sdmCharts.importance) window.GisAppState.sdmCharts.importance.destroy();
        window.GisAppState.sdmCharts.importance = new ApexCharts(impEl, {
            series: series,
            chart: {
                height: 450,
                type: 'heatmap',
                toolbar: { show: false },
                animations: { enabled: true }
            },
            dataLabels: { enabled: false },
            colors: ["#2d6a4f"], // Base color for the scale
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0.5,
                    radius: 2,
                    useFillColorAsStroke: true,
                    colorScale: {
                        ranges: [
                            { from: 0, to: 5, name: 'Low', color: '#f7fbff' },
                            { from: 5, to: 10, name: 'Moderate', color: '#c6dbef' },
                            { from: 10, to: 15, name: 'High', color: '#6baed6' },
                            { from: 15, to: 25, name: 'Very High', color: '#2171b5' },
                            { from: 25, to: 100, name: 'Critical Driver', color: '#08306b' }
                        ]
                    }
                }
            },
            xaxis: {
                type: 'category',
                labels: { rotate: -45, offsetHeight: 10, style: { fontSize: '10px', fontWeight: 600 } }
            },
            yaxis: {
                labels: { style: { fontSize: '10px', fontWeight: 600 } }
            },
            tooltip: {
                theme: 'dark',
                y: { formatter: (val) => `${val}% Contribution` }
            }
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
    window.GisAppState.isPredictiveMode = false;
    window.GisAppState.isClimateMode = false;

    // 1. Remove Specialized Layers
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (window.GisAppState.ndviLayer) { map.removeLayer(window.GisAppState.ndviLayer); window.GisAppState.ndviLayer = null; }
    if (window.GisAppState.carbonLayer) { map.removeLayer(window.GisAppState.carbonLayer); window.GisAppState.carbonLayer = null; }
    if (window.GisAppState.landCoverLayer) { map.removeLayer(window.GisAppState.landCoverLayer); window.GisAppState.landCoverLayer = null; }
    if (window.GisAppState.vulnerabilityLayer) { map.removeLayer(window.GisAppState.vulnerabilityLayer); window.GisAppState.vulnerabilityLayer = null; }

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
    
    // 5. Hide Progress Bar & Loader
    const progressBar = document.getElementById('global-map-progress');
    const mapLoader = document.getElementById('map-loader');
    if (progressBar) progressBar.classList.remove('active');
    if (mapLoader) mapLoader.classList.add('hidden');

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
            <div class="legend-title">🌿 Vegetation Health (NDVI)</div>
            <div class="legend-items">
                <div class="legend-row"><span class="legend-box" style="background:darkgreen"></span> Very High (>0.5)</div>
                <div class="legend-row"><span class="legend-box" style="background:green"></span> High (0.3 - 0.5)</div>
                <div class="legend-row"><span class="legend-box" style="background:lightgreen"></span> Moderate (0.1 - 0.3)</div>
                <div class="legend-row"><span class="legend-box" style="background:yellow"></span> Low (-0.1 - 0.1)</div>
                <div class="legend-row"><span class="legend-box" style="background:brown"></span> Very Low (<-0.1)</div>
            </div>
            <div class="legend-meta" id="ndvi-legend-meta">Source: Sentinel-2 SR | Live Query</div>
        `;
    } else if (type === 'carbon') {
        leg.innerHTML = `
            <div class="legend-title">🌳 Carbon Stock (Mg C/ha)</div>
            <div class="legend-items">
                <div class="legend-row"><span class="legend-box" style="background:#081d58"></span> 35-45+ Mg C/ha</div>
                <div class="legend-row"><span class="legend-box" style="background:#225ea8"></span> 25-35 Mg C/ha</div>
                <div class="legend-row"><span class="legend-box" style="background:#41b6c4"></span> 15-25 Mg C/ha</div>
                <div class="legend-row"><span class="legend-box" style="background:#a1d99b"></span> 5-15 Mg C/ha</div>
                <div class="legend-row"><span class="legend-box" style="background:#f5f5f5"></span> 0-5 Mg C/ha</div>
            </div>
            <div class="legend-meta" id="carbon-legend-meta">Source: IPCC Tier 1 Empirical</div>
        `;
    } else if (type === 'landcover') {
        leg.innerHTML = `
            <div class="legend-title">🗺️ Land Cover Mapping</div>
            <div class="legend-items">
                <div class="legend-row"><span class="legend-box" style="background:#1a9641"></span> Forest</div>
                <div class="legend-row"><span class="legend-box" style="background:#a6d96a"></span> Grass / Shrub / Wetland</div>
                <div class="legend-row"><span class="legend-box" style="background:#ffffbf"></span> Cropland</div>
                <div class="legend-row"><span class="legend-box" style="background:#d7191c"></span> Built-up</div>
                <div class="legend-row"><span class="legend-box" style="background:#fdae61"></span> Bare / Sparse</div>
                <div class="legend-row"><span class="legend-box" style="background:#2c7fb8"></span> Open Water</div>
            </div>
            <div class="legend-meta">Source: ESA WorldCover v200 · 10m</div>
        `;
    }
}

// Legacy addBoundaryStencil removed: Backend True Clipping now active.

async function runNdviQuery() {
    const btn = document.getElementById('btn-run-ndvi');
    const startStr = document.getElementById('ndvi-start-date').value;
    const endStr = document.getElementById('ndvi-end-date').value;
    
    if (!startStr || !endStr) return alert("Please select both start and end dates.");
    
    btn.innerHTML = '<span class="btn-icon spinning">⏳</span> Processing Satellite Data...';
    btn.disabled = true;
    
    const currentToken = ++window.GisAppState.activeLayerToken;
    
    const progressBar = document.getElementById('global-map-progress');
    if (progressBar) progressBar.classList.add('active');
    
    try {
        clearAllModes(true);
        const banner = document.getElementById('map-status-banner');
        const bannerText = document.getElementById('banner-text');
        
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
            if (bannerText) bannerText.innerText = `NDVI Active: Analyzing Satellite Telemetry (${startStr} to ${endStr})...`;
        }

        // Fetch Tile URL from Vercel Serverless Backend
        const response = await fetch(`/api/ndvi?start=${startStr}&end=${endStr}`);
        const data = await response.json();
        
        // Discard payload if the user has navigated away or requested a different layer
        if (window.GisAppState.activeLayerToken !== currentToken) return;

        if (!data.success || !data.tileUrl) {
            throw new Error(data.error || "Failed to retrieve map tiles from server.");
        }

        // Add the dynamic tile layer, forcing zIndex so it sits above basemaps
        const ndviLayer = L.tileLayer(data.tileUrl, {
            opacity: 0.9,
            attribution: '&copy; Satellite Analysis',
            zIndex: 10
        }).addTo(map);

        window.GisAppState.ndviLayer = ndviLayer;

        // NEW: Hide loader once tiles are rendered (with timeout safety)
        const loader = document.getElementById('map-loader');
        if (loader) {
            loader.classList.remove('hidden');
            const safetyTimeout = setTimeout(() => {
                loader.classList.add('hidden');
                console.warn("NDVI Load Timeout: Forcing loader hide.");
            }, 120000); // 120s safety bridge
            
            ndviLayer.on('load', () => {
                clearTimeout(safetyTimeout);
                loader.classList.add('hidden');
                console.log("NDVI Tiles Loaded: Hiding Loader.");
            });

            ndviLayer.on('tileerror', (error) => {
                clearTimeout(safetyTimeout);
                loader.classList.add('hidden');
                console.error("NDVI Tile Error:", error);
                // Optionally show a less intrusive notification here
            });
        }
        
        // (True GeoJSON polygon clip is now processed natively in backend API)
        
        updateMapLegend('ndvi');
        const metaLeg = document.getElementById('ndvi-legend-meta');
        if (metaLeg) metaLeg.innerHTML = `Source: Sentinel-2 SR<br>Dates: ${startStr} to ${endStr}`;
        
        if (bannerText) bannerText.innerText = "NDVI Active: Live Classified Vegetation Density (Sentinel-2).";
        console.log("NDVI Live Layer Successfully Rendered.");

    } catch (err) {
        if (window.GisAppState.activeLayerToken !== currentToken) return;
        console.error(err);
        alert("ERROR: " + err.message);
        clearAllModes();
    } finally {
        if (window.GisAppState.activeLayerToken === currentToken) {
            btn.innerHTML = '<span class="btn-icon">⚡</span> Generate High-Res Layer';
            btn.disabled = false;
            if (progressBar) progressBar.classList.remove('active');
        }
    }
}

async function runCarbonQuery() {
    const btn = document.getElementById('btn-run-carbon');
    const startStr = document.getElementById('carbon-start-date').value;
    const endStr = document.getElementById('carbon-end-date').value;
    
    if (!startStr || !endStr) return alert("Please select both start and end dates.");
    
    btn.innerHTML = '<span class="btn-icon spinning">⏳</span> Computing IPCC Matrix...';
    btn.disabled = true;
    
    const currentToken = ++window.GisAppState.activeLayerToken;
    
    const progressBar = document.getElementById('global-map-progress');
    if (progressBar) progressBar.classList.add('active');
    
    const badge = document.getElementById('carbon-total-badge');
    if (badge) badge.innerText = "Evaluating...";
    
    try {
        clearAllModes(true);
        const banner = document.getElementById('map-status-banner');
        const bannerText = document.getElementById('banner-text');
        
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
            if (bannerText) bannerText.innerText = `Carbon Active: Analyzing Above-Ground Biomass...`;
        }

        const response = await fetch(`/api/carbon?start=${startStr}&end=${endStr}`);
        const data = await response.json();
        
        // Discard if user actively clicked another analysis layer
        if (window.GisAppState.activeLayerToken !== currentToken) return;
        
        if (!data.success || !data.tileUrl) {
            throw new Error(data.error || "Failed to retrieve map tiles from server.");
        }

        const carbonLayer = L.tileLayer(data.tileUrl, {
            opacity: 0.9,
            attribution: '&copy; Satellite Analysis',
            zIndex: 10
        }).addTo(map);

        window.GisAppState.carbonLayer = carbonLayer;

        // NEW: Hide loader once tiles are rendered (with timeout safety)
        const loader = document.getElementById('map-loader');
        if (loader) {
            loader.classList.remove('hidden');
            const safetyTimeout = setTimeout(() => {
                loader.classList.add('hidden');
                console.warn("Carbon Load Timeout: Forcing loader hide.");
            }, 120000); // 120s safety bridge
            
            carbonLayer.on('load', () => {
                clearTimeout(safetyTimeout);
                loader.classList.add('hidden');
                console.log("Carbon Tiles Loaded: Hiding Loader.");
            });

            carbonLayer.on('tileerror', (error) => {
                clearTimeout(safetyTimeout);
                loader.classList.add('hidden');
                console.error("Carbon Tile Error:", error);
            });
        }
        
        if (badge) badge.innerText = `${data.totalCarbonMg} Mg C`;
        
        updateMapLegend('carbon');
        const metaLeg = document.getElementById('carbon-legend-meta');
        if (metaLeg) metaLeg.innerHTML = `Source: Sentinel-2 SR<br>Dates: ${startStr} to ${endStr}`;
        if (bannerText) bannerText.innerText = "Carbon Active: Live Sentinel-2 Estimated Biomass.";

    } catch (err) {
        if (window.GisAppState.activeLayerToken !== currentToken) return;
        console.error(err);
        alert("ERROR: " + err.message);
        clearAllModes();
        if (badge) badge.innerText = "Error";
    } finally {
        if (window.GisAppState.activeLayerToken === currentToken) {
            btn.innerHTML = '<span class="btn-icon">⚡</span> Calculate Live Carbon Stock';
            btn.disabled = false;
            if (progressBar) progressBar.classList.remove('active');
        }
    }
}

async function runLandCoverQuery() {
    const btn = document.getElementById('btn-run-landcover');
    const startStr = document.getElementById('landcover-start-date').value;
    const endStr = document.getElementById('landcover-end-date').value;

    if (!btn) return;

    if (!startStr || !endStr) return alert("Please select both start and end baseline dates.");

    btn.innerHTML = '<span class="btn-icon spinning">⏳</span> Mapping Land Cover...';
    btn.disabled = true;

    const currentToken = ++window.GisAppState.activeLayerToken;
    const progressBar = document.getElementById('global-map-progress');
    const mapLoader = document.getElementById('map-loader');
    const badge = document.getElementById('landcover-status-badge');
    const statsEl = document.getElementById('landcover-area-stats');

    try {
        clearAllModes(true); // Clear everything first
        
        if (progressBar) progressBar.classList.add('active');
        if (mapLoader) mapLoader.classList.remove('hidden');
        if (badge) badge.innerText = 'Mapping...';

        const banner = document.getElementById('map-status-banner');
        const bannerText = document.getElementById('banner-text');
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
            if (bannerText) bannerText.innerText = `LULC Active: Loading ESA WorldCover Classification for ${startStr}...`;
        }

        // Show legend immediately
        updateMapLegend('landcover');
        const metaLeg = document.getElementById('map-legend')?.querySelector('.legend-meta');
        if (metaLeg) metaLeg.innerHTML = `Source: ESA WorldCover<br>Baseline: ${startStr} to ${endStr}`;

        const response = await fetch(`/api/landcover?start=${startStr}&end=${endStr}`);
        const data = await response.json();

        if (window.GisAppState.activeLayerToken !== currentToken) return;
        if (!data.success || !data.tileUrl) throw new Error(data.error || 'Failed to retrieve LULC tiles.');

        const lcLayer = L.tileLayer(data.tileUrl, { opacity: 0.85, attribution: '&copy; ESA WorldCover', zIndex: 10 }).addTo(map);
        window.GisAppState.landCoverLayer = lcLayer;

        const loader = document.getElementById('map-loader');
        if (loader) {
            loader.classList.remove('hidden');
            const safetyTimeout = setTimeout(() => {
                loader.classList.add('hidden');
                console.warn("LULC Load Timeout: Forcing loader hide.");
            }, 120000); // 120s safety bridge
            
            lcLayer.on('load', () => {
                clearTimeout(safetyTimeout);
                loader.classList.add('hidden');
                console.log('Land Cover Tiles Loaded.');
            });

            lcLayer.on('tileerror', (error) => {
                clearTimeout(safetyTimeout);
                loader.classList.add('hidden');
                console.error("LULC Tile Error:", error);
            });
        }

        if (bannerText) bannerText.innerText = `LULC Active: ESA WorldCover — Baseline: ${new Date(startStr).getFullYear()}.`;
        if (badge) badge.innerText = 'Live';

        if (statsEl) {
            if (data.areaStats && data.areaStats.length > 0) {
                const colors = { 
                    'Forest': '#1a9641', 
                    'Shrubland': '#a6d96a', 
                    'Herbaceous wetland': '#ffffbf', 
                    'Cropland': '#d7191c', 
                    'Built-up': '#fdae61', 
                    'Bare / Sparse vegetation': '#fdae61', 
                    'Open water': '#2c7fb8',
                    'Grass/Shrub/Wetland': '#a6d96a',
                    'Bare/Sparse': '#fdae61',
                    'Open Water': '#2c7fb8'
                };
                statsEl.innerHTML = (data.isStaticFallback ? `
                    <div style="font-size:9px; color:#E53E3E; margin-bottom:8px; padding:4px; background:#FFF5F5; border-radius:4px; font-weight:700;">
                        ⚠️ Analysis depth exceeded. Showing regional baseline.
                    </div>
                ` : '') + data.areaStats.map(cls => `
                    <div class="stats-row" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #edf2f7;">
                        <span style="width:14px; height:14px; border-radius:3px; background:${colors[cls.name] || '#CBD5E0'}; flex-shrink:0;"></span>
                        <span style="flex:1; font-weight:600; font-size:11px; color:#2D3748">${cls.name}</span>
                        <span style="font-weight:700; color:var(--accent); font-size:12px;">${(cls.areaHa || 0).toLocaleString()} ha</span>
                    </div>
                `).join('');
            } else {
                statsEl.innerHTML = `
                    <div class="empty-state" style="padding: 10px; font-size: 10px;">
                        ⏳ Finalizing district coverage metrics... <br>
                        <span style="color:var(--text-secondary);">(Backend processing depth exceeded 8s limit)</span>
                    </div>
                `;
            }
        }

    } catch (err) {
        if (window.GisAppState.activeLayerToken !== currentToken) return;
        console.error(err);
        alert('LULC ERROR: ' + err.message);
        clearAllModes();
        if (badge) badge.innerText = 'Error';
    } finally {
        if (window.GisAppState.activeLayerToken === currentToken) {
            btn.innerHTML = '<span class="btn-icon">⚡</span> Generate Land Cover Map';
            btn.disabled = false;
            if (progressBar) progressBar.classList.remove('active');
        }
    }
}

// ─────────────────────────────────────────────
// 8. EVENT LISTENERS
// ─────────────────────────────────────────────
function bindEventListeners() {
    ['nav-dashboard', 'nav-gis', 'nav-predictive', 'nav-vulnerability', 'nav-trends', 'nav-habitat', 'nav-terrain', 'nav-heat', 'nav-ndvi', 'nav-carbon', 'nav-landcover', 'nav-policy', 'nav-data'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                if (id === 'nav-gis') {
                    clearAllModes();
                    switchView('nav-gis');
                } else if (id === 'nav-heat') {
                    clearAllModes(true);
                    toggleHeatmap();
                } else if (id === 'nav-ndvi') {
                    clearAllModes();
                    switchView('nav-dashboard');
                    switchPanel('panel-ndvi');
                } else if (id === 'nav-carbon') {
                    clearAllModes();
                    switchView('nav-dashboard');
                    switchPanel('panel-carbon');
                } else if (id === 'nav-vulnerability') {
                    clearAllModes();
                    switchView('nav-dashboard');
                    switchPanel('panel-vulnerability');
                } else if (id === 'nav-landcover') {
                    clearAllModes();
                    switchView('nav-dashboard');
                    switchPanel('panel-landcover');
                } else {
                    clearAllModes();
                    switchView(id);
                }
                
                // Responsiveness: Close sidebar on mobile nav click
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                if (sidebar) sidebar.classList.remove('mobile-active');
                if (overlay) overlay.classList.remove('active');
            });
        }
    });

    // New Event Listeners
    const btnNdvi = document.getElementById('btn-run-ndvi');
    if (btnNdvi) btnNdvi.addEventListener('click', runNdviQuery);

    const btnCarbon = document.getElementById('btn-run-carbon');
    if (btnCarbon) btnCarbon.addEventListener('click', runCarbonQuery);
    
    const btnVuln = document.getElementById('btn-run-vulnerability');
    if (btnVuln) btnVuln.addEventListener('click', runVulnerabilityQuery);

    const btnLulc = document.getElementById('btn-run-landcover');
    if (btnLulc) btnLulc.addEventListener('click', runLandCoverQuery);

    const btnCompare = document.getElementById('toggle-comparison');
    if (btnCompare) btnCompare.addEventListener('click', toggleComparisonMode);

    const btnTheme = document.getElementById('theme-toggle');
    if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

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

    const btnLocate = document.getElementById('btn-locate');
    if (btnLocate) {
        btnLocate.addEventListener('click', (e) => {
            e.preventDefault();
            if (!map) return;
            const btn = e.currentTarget;
            btn.innerHTML = '<span class="btn-icon spinning">⏳</span> Locating...';
            map.locate({setView: true, maxZoom: 16});
        });
    }

// ─────────────────────────────────────────────
// 8. ECOLOGICAL INSIGHTS DATA
// ─────────────────────────────────────────────
const SPECIES_INSIGHTS = {
    'Acacia_Galpinii_suitability': {
        name: 'Acacia Galpinii (Monkey Thorn)',
        auc: '0.923',
        kappa: '0.841',
        interpretation: `<em>Acacia galpinii</em> serves as the primary "Hydrologic Anchor" for the Hurungwe drainage systems. Our analysis reveals that <strong>Distance to Rivers</strong> is the overriding constraint, contributing 34.1% to the model's logic. Unlike more versatile Acacias, <em>A. galpinii</em> requires deep, moist alluvial deposits that remain saturated longer into the dry season. The model's response curve shows a critical suitability drop-off at 800 meters from water sources, suggesting that its root system is vertically dependent on the water table.`,
        forecast: 'Reforestation should be prioritized in the eastern valley corridors. Because it is a massive, long-lived thorn tree, it provides excellent biological fencing against livestock intrusion in sensitive riparian zones. We recommend a "Bio-Corridor" approach, planting in 3-row staggered formations along active riverbeds.'
    },
    'Acacia_Polycantha_suitability': {
        name: 'Acacia Polycantha (White Thorn)',
        auc: '0.944',
        kappa: '0.865',
        interpretation: `<em>Acacia polycantha</em> acts as an "Ecological Pioneer," establishing itself in open savanna areas that have consistent summer recharge. The model identifies <strong>Minimum Temperature of the Coldest Month (bio_6)</strong> as a defining threshold (15.2%), explaining its absence from the highest, coldest plateaus. It leverages <strong>Wettest Quarter Rainfall</strong> (13.1%) to build deep taproots early in Its lifecycle. Its fragmented distribution on the map suggests it thrives in mosaic habitats where woodland meets grassland.`,
        forecast: 'This is the ideal candidate for "Interstital Greening" in community grazing lands. It is highly resilient to heat stress but must be protected from extreme frost in Its first two years. It should be the foundational species for nitrogen-fixation in nutrient-depleted soils outside riparian zones.'
    },
    'Acacia_Siebriana_suitability': {
        name: 'Acacia Sieberiana (Paperbark Acacia)',
        auc: '0.934',
        kappa: '0.852',
        interpretation: `<em>Acacia sieberiana</em> is the "Substrate Specialist" of the Hurungwe landscape. While <strong>Min Temp of Coldest Month</strong> (17.3%) provides the climate envelope, <strong>Soil Type</strong> (17.2%) acts as the final sieve. It favors the well-drained loamy sands of the central plateau. Its distinctive flat-top canopy is a visual indicator of stable mid-altitude environments in our survey data. The model identifies a "Golden Belt" across the district where the species can reach its full growth potential.`,
        forecast: 'Recommended for "School-and-Hub" reforestation. Because of its large canopy, it provides superior micro-climate cooling. Restoration projects should prioritize the central corridor to maximize its rapid biomass accumulation and soil-shade effects.'
    },
    'Fidebhia_Abida_suitability': {
        name: 'Faidherbia Albida (Msangu)',
        auc: '0.972',
        kappa: '0.910',
        interpretation: `<em>Faidherbia albida</em> is the district's "Hydrologic Indicator." Known for its reverse phenology (leaf-shed in summer, growth in winter), it is extremely sensitive to <strong>Coldest Quarter Rainfall</strong> (13.5%). This species creates "Islands of Fertility" in alluvial plains by fixing nitrogen during the dry season. The suitability map correctly isolates it to low-gradient floodplains near perennial water tables, where its deep roots can maintain hydration even when surface layers desiccate.`,
        forecast: 'The primary species for "Agroforestry Resilience." Integrate into maize and cotton fields in the Hurungwe valleys. It provides critical dry-season fodder when all other trees are dormant, without competing for summer sunlight. It is the best species for climate-smart farming adoption.'
    },
    'Kigelia_Africana_suitability': {
        name: 'Kigelia Africana (Sausage Tree)',
        auc: '0.883',
        kappa: '0.792',
        interpretation: `<em>Kigelia africana</em> is a thermally-bound "Savanna Sentinel." Its distribution is primarily limited by <strong>Wet Month Rain</strong> (22.1%) and its need for warm winters (17.3% importance for <strong>Bio_6</strong>). It requires the high energy and humidity of the lower valley basins to support its massive sausage-like fruits. The model reveals that while its spatial range is broader than riparian specialists, its "Core Hotspots" are vulnerable to any significant drop in summer rainfall intensity.`,
        forecast: 'Critical for "Pollinator Corridors." As a species typically pollinated by bats and large insects, its reintroduction supports wider biodiversity. Priority should be given to communal land reforestation in the eastern basins, where it provides both medicinal resources and significant ecological value.'
    },
    'Munyii_Bechemia_discolor_suitability': {
        name: 'Berchemia discolor (Munyii / Bird Plum)',
        auc: '0.900',
        kappa: '0.812',
        interpretation: `<em>Berchemia discolor</em> (Munyii) is a critical "Livelihood Species" whose distribution is surprisingly narrow. Our model identifies a dual dependency on <strong>Distance to Rivers</strong> (25.3%) and <strong>Mean Diurnal Range</strong> (19.8%). This suggests that the species requires both water access and a highly stable micro-climate. Large temperature swings (typical of the arid plateaus) appear to be a major limiting factor for fruit-set. The highest suitability is found in buffered forest-edge zones where humidity remains consistent.`,
        forecast: 'Priority for "Nutrition-Focused Reforestation." By planting Munyii in community-managed riparian belts, we provide sustained food security. This species must be protected from high-intensity grazing during Its sapling stage to ensure the development of strong, fruit-bearing canopies.'
    },
    'Pilostigma_Thonigilii_Monkey_Bread_suitability': {
        name: 'Piliostigma thonningii (Monkey Bread)',
        auc: '0.952',
        kappa: '0.881',
        interpretation: `Known as the "Ecological Backbone," <em>Piliostigma thonningii</em> occupies the broadest spatial niche in Hurungwe. Its primary limiting factor is extreme cold (<strong>Min Temp of Coldest Month</strong>, 16.5%), but it otherwise exhibits high tolerance for varying soil and moisture regimes. It serves as a "Nurse Species," improving soil quality through Nitrogen fixation and heavy leaf-mulch, which facilitates the arrival of more sensitive climax species. If <em>Piliostigma</em> cannot thrive at a site, reforestation with other indigenous species is likely to fail.`,
        forecast: 'The "General-Purpose Workhorse" for forest boundary expansion. It should be the first choice for large-scale planting by non-experts due to its high survival rate. Use it to create "Shade Refugia" for more delicate species like Red Mahogany in the second phase of restoration.'
    },
    'Red_Mahogany_suitability': {
        name: 'Khaya anthotheca (Red Mahogany)',
        auc: '0.943',
        kappa: '0.871',
        interpretation: `<em>Khaya anthotheca</em> (Red Mahogany) is the "Climax Specialist" of Hurungwe. Our SDM reveals a strict requirement for <strong>Temperature Stability</strong> (18.6% importance for <strong>Bio_4</strong>) and high <strong>Wettest Quarter Rainfall</strong> (15.5%). This species is spatially restricted to the high-altitude forested slopes (Mist Belts), where extreme temperatures are rare. It relies on the protection of an existing canopy; it is not a pioneer species and will suffer high mortality in open-field settings. It represents the "Old Growth" potential of the district.`,
        forecast: 'Strict priority for "Core Forest Restoration." Should NOT be used for open-field planting. Best planted as "Enrichment" within existing forest fragments or under established nurse trees. This is the highest-value species for long-term carbon stocks and heritage protection.'
    },
    'Trichilia_Emetica_suitability': {
        name: 'Trichilia emetica (Natal Mahogany)',
        auc: '0.900',
        kappa: '0.810',
        interpretation: `<em>Trichilia emetica</em> is a "Perennial Moisture Specialist." Unlike deciduous indigenous trees, its evergreen nature requires consistent year-round hydration. The model shows a strong dependency on <strong>Distance to Rivers</strong> (15.3%) and <strong>Warm Quarter Rainfall</strong> (13.8%). It is an indicator of shallow groundwater. The suitability map identifies "Green Veins" through the central district where moisture is naturally retained, and the species serves as a critical cooling agent for the surrounding micro-environment.`,
        forecast: 'The ultimate "Social Forestry" species. Ideal for village hubs, schools, and boreholes. Its dense canopy provides year-round shade, and its seeds offer potential for community-based oil and soap production. Focus reintroduction near community water points.'
    },
    'Waterberry_suitability': {
        name: 'Syzygium cordatum (Waterberry)',
        auc: '0.936',
        kappa: '0.855',
        interpretation: `<em>Syzygium cordatum</em> (Waterberry) represents the absolute spatial extreme of "Hydrologic Dependency." With suitability almost exclusively tied to <strong>Distance to Rivers</strong> (19.4%) and <strong>Wettest Quarter Rain</strong> (16.8%), it is the district's "Water Sentinel." It thrives in permanently water-logged soils where most other trees would drown. Its presence is a definitive biological signature for permanent seepage and healthy wetlands. Without <em>Syzygium</em>, the district's headwater systems lose their natural filtration and stabilization mechanisms.`,
        forecast: 'Priority #1 for "Headwater & Spring Protection." Reintroduction must focus on degraded marshlands and riverbanks. Its habitat should be considered a "No-Graze Zone" to protect local water security. It is the key species for restoring the hydrologic functionality of degraded drainage basins.'
    },
    'species_suitability_grid': {
        name: 'Combined Tree Ecosystem',
        auc: '0.945',
        kappa: '0.860',
        interpretation: 'Unified ecosystem model capturing core habitat envelopes for general indigenous reintroduction. Identifies primary zones where multiple species overlap and provides a strategic high-level map for catchment-wide forest resilience.',
        forecast: 'Focus on central corridors and major drainage basins for the highest success rate in mixed-species woodland restoration. Strategic planting in these hotspots will maximize biodiversity connectivity.'
    }
};

function updateSdmInsights(speciesId) {
    const data = SPECIES_INSIGHTS[speciesId];
    const container = document.getElementById('sdm-insights-content');
    if (!data || !container) return;

    container.innerHTML = `
        <div class="insight-block">
            <h4 style="margin-top: 5px;">📈 Model Reliability</h4>
            <p>AUC: <strong>${data.auc}</strong> | Kappa: <strong>${data.kappa}</strong></p>
        </div>
        <div class="insight-block">
            <h4>🌿 Ecological Discussion</h4>
            <div style="line-height: 1.6; color: var(--text-primary); font-size: 0.95rem;">
                ${data.interpretation}
            </div>
        </div>
        <div class="insight-block">
            <h4>⚡ Strategic Outlook</h4>
            <p style="background: var(--accent-soft); padding: 12px; border-left: 4px solid var(--accent); border-radius: 4px; font-weight: 500;">
                ${data.forecast}
            </p>
        </div>
    `;
}

// BINDING
const sdmSelect = document.getElementById('sdm-species-select');
if (sdmSelect) {
    sdmSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const img = document.getElementById('sdm-map-image');
        if (img) img.src = `data/models/${val}.png`;
        updateSdmInsights(val);
    });
    // Initial call
    updateSdmInsights(sdmSelect.value);
}

    const btnDownloadSdm = document.getElementById('btn-download-sdm');
    if (btnDownloadSdm) btnDownloadSdm.addEventListener('click', downloadSdmMap);

    const btnExit = document.getElementById('btn-exit-mode');
    if (btnExit) {
        btnExit.addEventListener('click', () => {
            if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
            const banner = document.getElementById('map-status-banner');
            if (banner) banner.style.display = 'none';
            if (map) map.getContainer().style.cursor = '';
        });
    }

    ['filter-species', 'filter-habitat', 'filter-monitor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                activeFilters[id.replace('filter-', '')] = e.target.value;
                applyFilters();
            });
        }
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            activeFilters.search = e.target.value;
            applyFilters();
        });
    }

    const btnReset = document.getElementById('reset-filters');
    if (btnReset) {
        btnReset.addEventListener('click', (e) => {
            e.preventDefault();
            const filterSpecies = document.getElementById('filter-species');
            const filterHabitat = document.getElementById('filter-habitat');
            const filterMonitor = document.getElementById('filter-monitor');
            const searchInputReset = document.getElementById('search-input');
            
            if (filterSpecies) filterSpecies.value = 'all';
            if (filterHabitat) filterHabitat.value = 'all';
            if (filterMonitor) filterMonitor.value = 'all';
            if (searchInputReset) searchInputReset.value = '';
            
            activeFilters = { species: 'all', habitat: 'all', monitor: 'all', search: '' };
            applyFilters();
        });
    }

    const btnCsv = document.getElementById('btn-export-csv');
    if (btnCsv) {
        btnCsv.addEventListener('click', (e) => {
            e.preventDefault();
            if (!filteredData || filteredData.length === 0) {
                alert("No data available to export based on current filters.");
                return;
            }

            // Generate CSV Header
            const headers = ["species", "habitat", "terrain", "monitor", "date", "lat", "lon"];
            const csvRows = [headers.join(",")];

            // Generate CSV Rows
            filteredData.forEach(row => {
                const values = headers.map(header => {
                    const rowVal = row[header];
                    const val = rowVal ? String(rowVal).replace(/"/g, '""') : '';
                    return `"${val}"`;
                });
                csvRows.push(values.join(","));
            });

            // Trigger Download
            const csvString = csvRows.join("\n");
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `hurungwe_filtered_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const btnMenuMobile = document.getElementById('mobile-menu-trigger');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (btnMenuMobile) {
        btnMenuMobile.addEventListener('click', (e) => {
            e.preventDefault();
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) sidebar.classList.toggle('mobile-active');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.remove('mobile-active');
            sidebarOverlay.classList.remove('active');
        });
    }

    const btnModalClose = document.getElementById('close-modal');
    if (btnModalClose) {
        btnModalClose.addEventListener('click', () => {
            const modal = document.getElementById('analytic-modal');
            if (modal) modal.classList.add('hidden');
        });
    }
}

async function runVulnerabilityQuery() {
    const btn = document.getElementById('btn-run-vulnerability');
    const period = document.getElementById('climate-period') ? document.getElementById('climate-period').value : '2050';
    
    if (!btn) return;
    
    btn.innerHTML = '<span class="btn-icon spinning">⏳</span> Querying CMIP6 Ensemble...';
    btn.disabled = true;
    
    const currentToken = ++window.GisAppState.activeLayerToken;
    const progressBar = document.getElementById('global-map-progress');
    const mapLoader = document.getElementById('map-loader');
    const insightBanner = document.getElementById('vulnerability-insight-banner');
    const insightText = document.getElementById('vulnerability-text');
    
    try {
        clearAllModes(true);
        if (progressBar) progressBar.classList.add('active');
        if (mapLoader) mapLoader.classList.remove('hidden');
        if (insightBanner) insightBanner.classList.add('hidden');

        const banner = document.getElementById('map-status-banner');
        const bannerText = document.getElementById('banner-text');
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
            if (bannerText) bannerText.innerText = 'Future-Cast Active: Analyzing 2050 Climate Scenarios... (This may take ~30s)';
        }

        const scenario = 'ssp585';
        console.log(`FETCHING Climate Forecast for scenario: ${scenario}, period: ${period}`);
        const response = await fetch(`/api/vulnerability?scenario=${scenario}&period=${period}`);
        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error || 'Server error');
        }
        const data = await response.json();
        
        if (window.GisAppState.activeLayerToken !== currentToken) return;
        if (!data.success || !data.tileUrl) throw new Error(data.error || 'Failed to generate vulnerability projection.');

        console.log("FUTURE_CAST_TILE_RECEIVED:", data.tileUrl);
        window.GisAppState.isClimateMode = true;
        showClimateLegend();
        
        // Pane-Safe Rendering: Ensure layer is above all others
        if (!map.getPane('vulnPane')) {
            const pane = map.createPane('vulnPane');
            pane.style.zIndex = 450;
        }

        const vulnLayer = L.tileLayer(data.tileUrl, { 
            opacity: 0.85, 
            attribution: '&copy; NASA NEX-GDDP CMIP6', 
            zIndex: 10,
            pane: 'vulnPane'
        }).addTo(map);
        
        window.GisAppState.vulnerabilityLayer = vulnLayer;
        
        // Hard Sync: Force map to recognize the container size AGAIN after layer addition
        setTimeout(() => {
            if (map) map.invalidateSize();
            console.log("Future-Cast Map Sync: Forced container recalculation.");
        }, 500);

        // Diagnostic Logging
        vulnLayer.on('tileerror', (e) => {
            console.error("Vulnerability Tile Error:", e.coords, e.error);
        });
        
        const safetyTimeout = setTimeout(() => {
            if (mapLoader) mapLoader.classList.add('hidden');
            console.warn("Vulnerability Load Timeout: Forcing loader hide.");
        }, 120000); // 120s safety 

        vulnLayer.on('load', () => {
            clearTimeout(safetyTimeout);
            if (mapLoader) mapLoader.classList.add('hidden');
            console.log('Vulnerability Projections Loaded.');
        });

        if (bannerText) bannerText.innerText = `Vulnerability Active: ${period} Forecast (NASA CMIP6 High Emissions).`;
        
        if (insightBanner && insightText && data.stats) {
            insightBanner.classList.remove('hidden');
            insightText.innerHTML = `
                <div style="font-size: 0.9rem; line-height: 1.4;">
                    <p>🚨 <strong>High-Risk Alert</strong>: Approximately <strong>${data.stats.stressPercent}%</strong> of the district will face critical heat stress by ${period}.</p>
                    <p>🌡️ Projecting an average temperature shift of <strong>+${data.stats.avgTempIncrease ? parseFloat(data.stats.avgTempIncrease).toFixed(1) : '2.6'}°C</strong> relative to baseline.</p>
                </div>
            `;
        }

    } catch (err) {
        if (window.GisAppState.activeLayerToken !== currentToken) return;
        console.error(err);
        alert('Future-Cast ERROR: ' + err.message);
        clearAllModes();
    } finally {
        if (window.GisAppState.activeLayerToken === currentToken) {
            btn.innerHTML = '<span class="btn-icon">⚡</span> Run Future-Cast Engine';
            btn.disabled = false;
            if (progressBar) progressBar.classList.remove('active');
        }
    }
}

function showClimateLegend() {
    const legend = document.getElementById('map-legend');
    if (!legend) return;
    
    legend.innerHTML = `
        <div class="legend-title">Temp Increase (°C)</div>
        <div class="legend-items">
            <div class="legend-row"><span class="legend-box" style="background:#fee5d9"></span> 1.0 - 1.5 (Low)</div>
            <div class="legend-row"><span class="legend-box" style="background:#fcae91"></span> 1.5 - 2.0 (Mod)</div>
            <div class="legend-row"><span class="legend-box" style="background:#fb6a4a"></span> 2.0 - 2.5 (High)</div>
            <div class="legend-row"><span class="legend-box" style="background:#de2d26"></span> 2.5 - 3.0 (V. High)</div>
            <div class="legend-row"><span class="legend-box" style="background:#a50f15"></span> 3.0+ (Extreme)</div>
        </div>
    `;
    legend.classList.remove('hidden');
}

async function inspectClimateAtLocation(lat, lon) {
    const insightText = document.getElementById('vulnerability-text');
    if (insightText) insightText.innerHTML = '<div class="spinning">⏳</div> Inspecting point climate shift...';

    try {
        const scenario = 'ssp585';
        const response = await fetch(`/api/inspect-climate?lat=${lat}&lon=${lon}&scenario=${scenario}`);
        const data = await response.json();

        if (data.success && insightText) {
            insightText.innerHTML += `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 0.85rem; line-height: 1.4;">
                    <p style="margin: 0; color: var(--text-secondary); font-size: 11px;">📍 Coordinate: ${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}</p>
                    <p style="margin: 4px 0 0 0; font-weight: 700; color: var(--accent);">🌡️ Climate Shift: +${data.delta}°C Change</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("Inspect Error:", err);
    }
}

function populatePolicyPanel() {
    const content = document.getElementById('policy-content');
    const priority = document.getElementById('policy-priority');
    const adaptation = document.getElementById('policy-adaptation');
    if (!content) return;

    // Logic for generating policy directives based on spatial context
    let directives = [];
    let priorityZone = "Northeast Region"; // Default placeholder or based on data
    let adaptationNeed = "Medium";

    // 1. Climate Connection
    const climateInsight = document.getElementById('vulnerability-text')?.innerText;
    if (climateInsight && climateInsight.includes('+')) {
        directives.push({
            title: "Climate Resilience Buffer",
            desc: "Enforce strict vegetation buffer zones in coordinates showing > 2.0°C warming shift.",
            icon: "🌡️"
        });
        adaptationNeed = "Critical";
    }

    // 2. Carbon Governance
    if (window.GisAppState.carbonLayer) {
        directives.push({
            title: "Carbon Seq Enforcement",
            desc: "Establish Protected Status for regions with high-biomass density to prevent carbon leakage.",
            icon: "🌳"
        });
    }

    // 3. Reforestation Priority
    if (window.GisAppState.isPredictiveMode) {
        directives.push({
            title: "Targeted Reforestation",
            desc: "Prioritize low-suitability zones for assisted migration of climate-resilient species.",
            icon: "🌱"
        });
        priorityZone = "Western Corridors";
    }

    // Add baseline policy if empty
    if (directives.length === 0) {
        directives.push({
            title: "Ecological Baseline Monitoring",
            desc: "No active spatial stressors detected. Maintain current monitoring frequency.",
            icon: "📋"
        });
    }

    content.innerHTML = directives.map(d => `
        <div class="glass-card" style="margin-bottom: 12px; padding: 15px; border-left: 4px solid var(--accent);">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
                <span style="font-size: 20px;">${d.icon}</span>
                <div>
                    <h4 style="margin: 0; font-size: 13px;">${d.title}</h4>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: var(--text-secondary); opacity: 0.9;">${d.desc}</p>
                </div>
            </div>
        </div>
    `).join('');

    if (priority) priority.innerText = priorityZone;
    if (adaptation) adaptation.innerText = adaptationNeed;
}

// ─────────────────────────────────────────────
// 9. LIVE FIELD DATA INTEGRATION
// ─────────────────────────────────────────────
function initLiveFieldData() {
    if (typeof firebase === 'undefined') {
        console.warn("Firebase not loaded. Live data disabled.");
        return;
    }
    if (!map) {
        console.warn("Map not initialized. Live data layer aborted.");
        return;
    }
    
    console.log("Firebase Engine: Synchronizing Live Field Data...");
    const db = firebase.firestore();
    
    window.GisAppState.liveLayer = L.layerGroup().addTo(map);
    window.GisAppState.allLiveData = [];
    window.GisAppState.activeLiveFilters = { search: '', species: 'all', habitat: 'all', landuse: 'all', condition: 'all', recorder: 'all' };

    // ─── CUSTOM LEAFLET CONTROL: Field Filters ───
    const FilterControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function() {
            const div = L.DomUtil.create('div', 'leaflet-field-filters collapsible hidden');
            div.id = 'map-field-filters';
            div.innerHTML = `
                <div class="map-filter-header" id="filter-toggle">
                    <span class="filter-title"><i class="fas fa-filter"></i> Field Filters</span>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="map-filter-content hidden" id="filter-content">
                    <div class="map-filter-row">
                        <div class="map-filter-group" style="flex:1.5">
                            <label>Search</label>
                            <input type="text" id="live-search" class="map-filter-input" placeholder="🔍 Find records...">
                        </div>
                        <div class="map-filter-group">
                            <label>Species</label>
                            <select id="live-filter-species" class="map-filter-select"><option value="all">All</option></select>
                        </div>
                        <div class="map-filter-group">
                            <label>Habitat</label>
                            <select id="live-filter-habitat" class="map-filter-select"><option value="all">All</option></select>
                        </div>
                        <div class="map-filter-group">
                            <label>Recorder</label>
                            <select id="live-filter-recorder" class="map-filter-select"><option value="all">All</option></select>
                        </div>
                        <div class="map-filter-group" style="flex:0.5; min-width: 120px;">
                            <label>Export As</label>
                            <select id="export-format" class="map-filter-select">
                                <option value="csv">CSV (Excel)</option>
                                <option value="geojson">GeoJSON (GIS)</option>
                                <option value="kml">KML (G.Earth)</option>
                            </select>
                        </div>
                        <div class="map-filter-group" style="flex:0.5; justify-content: flex-end; display: flex; gap: 8px;">
                             <button id="btn-export-live-data" class="premium-export-btn"><i class="fas fa-file-export"></i> Export</button>
                             <button id="btn-clear-live-filters" class="btn-clear-map-filters">Clear</button>
                        </div>
                    </div>
                </div>
            `;
            
            L.DomEvent.disableClickPropagation(div);
            
            // Add click listener for toggling
            setTimeout(() => {
                const header = div.querySelector('#filter-toggle');
                const content = div.querySelector('#filter-content');
                if (header && content) {
                    header.onclick = (e) => {
                        content.classList.toggle('hidden');
                        div.classList.toggle('expanded');
                        header.querySelector('.toggle-icon').classList.toggle('fa-chevron-up');
                        header.querySelector('.toggle-icon').classList.toggle('fa-chevron-down');
                    };
                }
                const exportBtn = div.querySelector('#btn-export-live-data');
                if (exportBtn) exportBtn.onclick = (e) => {
                    e.stopPropagation();
                    const format = div.querySelector('#export-format').value;
                    exportLiveData(format);
                };
                const clearBtn = div.querySelector('#btn-clear-live-filters');
                if (clearBtn) clearBtn.onclick = (e) => {
                    e.stopPropagation();
                    clearLiveFilters();
                };
            }, 100);

            return div;
        }
    });

    window.GisAppState.mapFilterControl = new FilterControl();
    map.addControl(window.GisAppState.mapFilterControl);

    // ─── FIRESTORE SUBSCRIPTION: Wait for Auth ───
    const waitAuth = window.GisAppState.authPromise || Promise.reject("Firebase not initialized");
    
    waitAuth.then(() => {
        console.log("Firestore: Initiating sync...");
        db.collection('observations').orderBy('timestamp', 'desc').limit(500)
            .onSnapshot((snapshot) => {
                console.log("Firestore Snapshot: " + snapshot.size + " records found.");
                window.GisAppState.allLiveData = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    data.lat = data.lat || data.latitude;
                    data.lng = data.lng || data.longitude || data.lon;
                    window.GisAppState.allLiveData.push(data);
                });
                
                if (window.GisAppState.allLiveData.length === 0) {
                    console.warn("Firestore: observations collection is empty.");
                }

                updateLiveFilterDropdowns();
                applyLiveFilters();
            }, (err) => {
                console.error("Firestore Permission/Sync Error:", err.message);
                const tbody = document.getElementById('field-data-body');
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="padding:40px; text-align:center;">
                                <div style="color:#ff5252; margin-bottom:10px;"><i class="fas fa-lock" style="font-size:24px;"></i></div>
                                <div style="font-weight:700; color:var(--text); margin-bottom:5px;">Access Denied</div>
                                <div style="font-size:12px; color:var(--text-secondary); max-width:300px; margin:0 auto;">
                                    ${err.message}. <br><br>
                                    <span style="color:var(--premium-green); font-weight:600;">Action Required:</span><br>
                                    Please ensure <b>Anonymous Auth</b> is enabled in your Firebase Console and Firestore rules allow public reads.
                                </div>
                            </td>
                        </tr>
                    `;
                }
            });
    }).catch(err => {
        console.error("Firestore: Blocked by Auth failure.", err);
        const tbody = document.getElementById('field-data-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color:#ff5252; text-align:center;">Auth Failure: ${err.message}</td></tr>`;
    });

    function updateLiveFilterDropdowns() {
        const data = window.GisAppState.allLiveData;
        const sets = { species: new Set(), habitat: new Set(), recorder: new Set() };
        data.forEach(d => {
            if (d.species) sets.species.add(d.species);
            if (d.habitat) sets.habitat.add(d.habitat);
            if (d.recorder) sets.recorder.add(d.recorder);
        });

        Object.keys(sets).forEach(key => {
            const select = document.getElementById(`live-filter-${key}`);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = `<option value="all">All ${key.charAt(0).toUpperCase() + key.slice(1)}s</option>` + 
                Array.from(sets[key]).sort().map(v => `<option value="${v}">${v}</option>`).join('');
            select.value = currentVal;
        });
    }

    function applyLiveFilters() {
        const filters = window.GisAppState.activeLiveFilters;
        const filtered = window.GisAppState.allLiveData.filter(d => {
            const matchSearch = !filters.search || 
                (d.species?.toLowerCase().includes(filters.search) || 
                 d.habitat?.toLowerCase().includes(filters.search) || 
                 d.recorder?.toLowerCase().includes(filters.search));
            const matchSpecies = filters.species === 'all' || d.species === filters.species;
            const matchHabitat = filters.habitat === 'all' || d.habitat === filters.habitat;
            const matchRecorder = filters.recorder === 'all' || d.recorder === filters.recorder;
            return matchSearch && matchSpecies && matchHabitat && matchRecorder;
        });

        renderLiveMarkers(filtered);
        renderLiveTable(filtered);
        window.GisAppState.liveDataArray = filtered;
    }

    function renderLiveMarkers(data) {
        if (!window.GisAppState.liveLayer) return;
        window.GisAppState.liveLayer.clearLayers();

        data.forEach(d => {
            if (!d.lat || !d.lng) return;
            const timeStr = d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Unknown';
            const pulseIcon = L.divIcon({
                className: 'field-pulse-container',
                html: `<div class="field-pulse"></div><div class="field-marker">🌿</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([d.lat, d.lng], { icon: pulseIcon });
            marker.bindPopup(`
                <div class="field-popup-premium">
                    <div class="popup-tag">Live Field Obs</div>
                    <h3>${d.species}</h3>
                    <p><strong>Recorder:</strong> ${d.recorder}</p>
                    <p><strong>Habitat:</strong> ${d.habitat || '-'}</p>
                    <small>${timeStr}</small>
                </div>
            `);
            window.GisAppState.liveLayer.addLayer(marker);
        });
    }

    function renderLiveTable(data) {
        const tbody = document.getElementById('field-data-body');
        if (!tbody) return;
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 15px; text-align: center; color: var(--text-muted);">No records match filters.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(d => {
            const timeStr = d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Unknown';
            return `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid var(--glass-border); text-align:center;">${timeStr}</td>
                    <td style="padding: 10px; border-bottom: 1px solid var(--glass-border); font-weight:600; color: var(--premium-green); text-align:center;">${d.species || '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid var(--glass-border); text-align:center;">${d.habitat || '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid var(--glass-border); text-align:center;">${d.recorder || '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid var(--glass-border); color: #888; font-size:10px; text-align:center;">${d.lat ? d.lat.toFixed(6) : '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid var(--glass-border); color: #888; font-size:10px; text-align:center;">${d.lng ? d.lng.toFixed(6) : '-'}</td>
                </tr>
            `;
        }).join('');
    }

    // ─── EVENT DELEGATION FOR MAP CONTROL ───
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('map-filter-select')) {
            const key = e.target.id.replace('live-filter-', '');
            window.GisAppState.activeLiveFilters[key] = e.target.value;
            applyLiveFilters();
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'live-search') {
            window.GisAppState.activeLiveFilters.search = e.target.value.toLowerCase();
            applyLiveFilters();
        }
    });

    function clearLiveFilters() {
        window.GisAppState.activeLiveFilters = { search: '', species: 'all', habitat: 'all', landuse: 'all', condition: 'all', recorder: 'all' };
        const searchInput = document.getElementById('live-search');
        if (searchInput) searchInput.value = '';
        ['species', 'habitat', 'recorder'].forEach(key => {
            const select = document.getElementById(`live-filter-${key}`);
            if (select) select.value = 'all';
        });
        applyLiveFilters();
    }

    // ─── MULTI-FORMAT EXPORT ENGINE ───
    function exportLiveData(format) {
        const data = window.GisAppState.liveDataArray || [];
        if (data.length === 0) {
            alert("No data available to export based on current filters.");
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `Hurungwe_Field_Data_${timestamp}`;

        if (format === 'csv') {
            exportToCSV(data, filename);
        } else if (format === 'geojson') {
            exportToGeoJSON(data, filename);
        } else if (format === 'kml') {
            exportToKML(data, filename);
        }
    }

    function exportToCSV(data, filename) {
        const headers = ["Timestamp", "Species", "Habitat", "Recorder", "Latitude", "Longitude", "LandUse", "Condition"];
        const rows = data.map(d => [
            new Date(d.timestamp).toLocaleString(),
            d.species || '',
            d.habitat || '',
            d.recorder || '',
            d.lat || '',
            d.lng || '',
            d.landuse || '',
            d.condition || ''
        ]);

        // Excel-optimized CSV: Use BOM and semicolon/comma handling
        let csvContent = "\ufeff"; // BOM for Excel
        csvContent += "sep=,\n"; // Explicit separator instruction for Excel
        csvContent += headers.join(",") + "\n";
        
        rows.forEach(row => {
            const rowStr = row.map(val => {
                const str = String(val).replace(/"/g, '""');
                return str.includes(',') ? `"${str}"` : str;
            }).join(",");
            csvContent += rowStr + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${filename}.csv`);
    }

    function exportToGeoJSON(data, filename) {
        const geojson = {
            type: "FeatureCollection",
            features: data.map(d => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [d.lng, d.lat]
                },
                properties: {
                    species: d.species,
                    habitat: d.habitat,
                    recorder: d.recorder,
                    timestamp: d.timestamp,
                    landuse: d.landuse,
                    condition: d.condition
                }
            }))
        };
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${filename}.geojson`);
    }

    function exportToKML(data, filename) {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Hurungwe Field Data</name>`;

        data.forEach(d => {
            kml += `
    <Placemark>
      <name>${d.species || 'Observation'}</name>
      <description>Recorder: ${d.recorder}\nHabitat: ${d.habitat}</description>
      <Point>
        <coordinates>${d.lng},${d.lat},0</coordinates>
      </Point>
    </Placemark>`;
        });

        kml += `
  </Document>
</kml>`;
        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        downloadBlob(blob, `${filename}.kml`);
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.id === 'btn-clear-live-filters') {
            window.GisAppState.activeLiveFilters = { search: '', species: 'all', habitat: 'all', landuse: 'all', condition: 'all', recorder: 'all' };
            ['species', 'habitat', 'recorder'].forEach(k => {
                const el = document.getElementById(`live-filter-${k}`);
                if (el) el.value = 'all';
            });
            const search = document.getElementById('live-search');
            if (search) search.value = '';
            applyLiveFilters();
        }
    });

    // Handle CSV Download
    const downloadBtn = document.getElementById('btn-download-csv');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const data = window.GisAppState.liveDataArray;
            if (!data || data.length === 0) { alert("No data to download."); return; }
            let csvContent = "data:text/csv;charset=utf-8,Date,Species,Habitat,Latitude,Longitude,Recorder\\n";
            data.forEach(d => {
                const row = [d.timestamp || '', `"${d.species || ''}"`, `"${d.habitat || ''}"`, d.lat || '', d.lng || '', `"${d.recorder || ''}"`];
                csvContent += row.join(",") + "\\n";
            });
            window.open(encodeURI(csvContent));
        });
    }
}
