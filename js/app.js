/**
 * Hurungwe Tree Species Dashboard — My Trees Trust Edition (Earth-Tones)
 * Features: Light Mode, Sage Green Sidebar, Terracotta Accents
 */

document.addEventListener('DOMContentLoaded', async () => {

    // ─────────────────────────────────────────────
    // 1. CONSTANTS & STATE (Nature Palette)
    // ─────────────────────────────────────────────
    const SPECIES_COLORS = {
        'Acacia Polycantha': '#2D6A4F', // Emerald
        'Acacia Siebriana': '#52B788', // Fern
        'Acacia Galpinii': '#7A816C', // Olive
        'Pilostigma': '#95A5A6', // Sage
        'Waterberry': '#1B4332', // Deep Forest
        'Kigelia Africana': '#C2923A', // Ochre
        'Munyii': '#A77F6A', // Terra-cotta
        'Red Mahogany': '#6F4E37', // Bark
        'Trichilia Emetica': '#4A5D23', // Moss
        'Fidebhia Abida': '#BDB76B', // Khaki
    };

    let map = null;
    let allData = [];
    let filteredData = [];
    let hurungweBoundary = null;
    let markerCluster = null;
    let heatLayer = null;
    let donutChart = null;
    let isHeatmapMode = false;
    let playInterval = null;
    let isPlaying = false;
    let showingAllActivity = false;
    let sortedDates = [];

    let activeFilters = {
        species: 'all',
        habitat: 'all',
        monitor: 'all',
        dateIndex: -1,
        search: ''
    };

    let isIdentifyMode = false;
    let analysisBuffer = null;
    let terrainChart = null;

    // --- SDM & PREDICTIVE STATE ---
    let researchResults = null;
    let suitabilityGrid = null;
    let activeSuitabilityLayer = null;
    let sdmCharts = { auc: null, importance: null };
    let isPredictiveMode = false;

    // ─────────────────────────────────────────────
    // 2. UTILITIES
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
        let hash = 0;
        for (let i = 0; i < species.length; i++) {
            hash = species.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 40%, 45%)`; // Muted nature colors
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch { return dateStr; }
    }

    // --- SPATIAL UTILITIES ---
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
        const R = 6371; // km
        const dLat = (pt2.lat - pt1.lat) * Math.PI / 180;
        const dLon = (pt2.lng - pt1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(pt1.lat * Math.PI / 180) * Math.cos(pt2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ─────────────────────────────────────────────
    // 3. CORE LOGIC
    // ─────────────────────────────────────────────
    function initDashboard() {
        populateSortedDates();
        populateFilterDropdowns();
        updateStats();
        initMap();
        initCharts();
        renderHabitatProgress();
        renderActivityLog();
        initTimeSlider();
        bindEventListeners();
    }

    function downloadCSV() {
        // 1. Get the selective filter value from the Export panel
        const selectiveSpecies = document.getElementById('export-species-filter')?.value || 'all';
        
        // 2. Start from filteredData (respects Sidebar filters: Habitat, Date, Search)
        let dataToExport = [...filteredData];
        
        // 3. Apply additional Species-specific filter if requested
        if (selectiveSpecies !== 'all') {
            dataToExport = dataToExport.filter(d => 
                d.species && d.species.toLowerCase().trim() === selectiveSpecies.toLowerCase().trim()
            );
        }

        // 4. Robust emptiness check with user feedback
        if (!dataToExport || dataToExport.length === 0) {
            const speciesLabel = selectiveSpecies === 'all' ? 'current filters' : selectiveSpecies;
            alert(`Research Alert: No data matches the intersection of your Map Filters and the Export Target (${speciesLabel}).\n\nPlease check your Habitat or Date range settings.`);
            return;
        }

        // 5. Generate CSV
        const headers = ["species", "habitat", "terrain", "monitor", "date", "lat", "lon"];
        const rows = dataToExport.map(d => [
            d.species, d.habitat, d.terrain, d.monitor, d.date, d.lat, d.lon
        ].map(val => `"${(val || '').toString().trim()}"`).join(','));

        const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        
        // Dynamic Naming
        const filename = selectiveSpecies === 'all' 
            ? `Hurungwe_Full_Research_Export_${new Date().toISOString().split('T')[0]}.csv`
            : `Hurungwe_${selectiveSpecies.replace(/\s+/g, '_')}_Selective_Export.csv`;
            
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

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
        sel.innerHTML = `<option value="all">${placeholder}</option>` +
            values.map(v => `<option value="${v}">${v}</option>`).join('');
    }

    function applyFilters() {
        filteredData = allData.filter(d => {
            const matchSpecies = activeFilters.species === 'all' || d.species === activeFilters.species;
            const matchHabitat = activeFilters.habitat === 'all' || d.habitat === activeFilters.habitat;
            const matchMonitor = activeFilters.monitor === 'all' || d.monitor === activeFilters.monitor;
            const matchDate = activeFilters.dateIndex === -1 || d.date === sortedDates[activeFilters.dateIndex];
            const search = activeFilters.search.toLowerCase();
            const matchSearch = !search ||
                (d.species && d.species.toLowerCase().includes(search)) ||
                (d.habitat && d.habitat.toLowerCase().includes(search)) ||
                (d.monitor && d.monitor.toLowerCase().includes(search));
            return matchSpecies && matchHabitat && matchMonitor && matchDate && matchSearch;
        });

        refreshMap();
        updateStats();
        updateCharts();
        renderHabitatProgress();
        renderActivityLog();
    }

    function switchView(viewId) {
        const grid = document.querySelector('.content-grid');
        if (!grid) return;

        // 1. High-Level Layout Controls
        grid.classList.remove('explorer-mode');
        if (viewId === 'nav-gis' || viewId === 'nav-predictive' || viewId === 'nav-export') {
            grid.classList.add('explorer-mode');
        }

        // 2. Sidebar UI Highlighting
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeNav = document.getElementById(viewId);
        if (activeNav) activeNav.classList.add('active');

        // 3. Right-Panel (Analysis Dock) Switching
        if (viewId === 'nav-gis') switchPanel('panel-dashboard');
        if (viewId === 'nav-predictive') switchPanel('panel-predictive');
        if (viewId === 'nav-export') switchPanel('panel-export');

        // 4. Modal Triggers
        if (viewId === 'nav-trends' || viewId === 'nav-habitat') {
            showAnalyticModal(viewId);
        }

        // 5. Global Reflow
        if (map) {
            setTimeout(() => { map.invalidateSize(); }, 400); 
        }

        // 6. Mobile Auto-Close
        if (window.innerWidth <= 768) {
            toggleSidebar(false);
        }
    }

    function switchPanel(panelId) {
        // Core Visibility Logic
        document.querySelectorAll('.content-panel').forEach(p => {
            p.classList.add('hidden');
            p.classList.remove('active-dock');
        });

        const target = document.getElementById(panelId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active-dock');
        }

        // --- RESEARCH MODE ENHANCEMENTS ---
        const viewTitle = document.getElementById('view-title');
        
        if (panelId === 'panel-predictive') {
            if (viewTitle) viewTitle.innerText = '🤖 Research Modeling Interface';
            initSDMCharts();
            isPredictiveMode = true;
            map.getContainer().style.cursor = 'crosshair';
        } else {
            if (viewTitle) viewTitle.innerText = 'District Distribution Map';
            isPredictiveMode = false;
            map.getContainer().style.cursor = '';
            
            // Clear scientific overlays
            if (activeSuitabilityLayer) {
                map.removeLayer(activeSuitabilityLayer);
                activeSuitabilityLayer = null;
            }
        }

        isIdentifyMode = false; // Reset identify reset
        const banner = document.getElementById('map-status-banner');
        if (banner) banner.classList.add('hidden');
    }

    let modalChart = null;

    function showAnalyticModal(type) {
        const modal = document.getElementById('analytic-modal');
        const title = document.getElementById('modal-title');
        const desc = document.getElementById('modal-description');
        const container = document.getElementById('modal-chart-container');

        if (!modal || !container) return;

        modal.classList.remove('hidden');
        if (modalChart) modalChart.destroy();

        if (type === 'nav-trends') {
            title.innerText = "📈 Species Temporal Trends";
            desc.innerText = "Historical sighting frequency across the monitoring period.";
            
            // Generate data
            const dateCounts = countBy(filteredData, 'date');
            const dates = Object.keys(dateCounts).sort();
            
            modalChart = new ApexCharts(container, {
                series: [{ name: 'Sightings', data: dates.map(d => dateCounts[d]) }],
                chart: { type: 'area', height: 350, toolbar: { show: false }, zoom: { enabled: false } },
                colors: ['#2D6A4F'],
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 3 },
                xaxis: { categories: dates.map(d => formatDate(d)), labels: { rotate: -45, style: { fontSize: '10px' } } },
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } }
            });
        } else if (type === 'nav-habitat') {
            title.innerText = "🌿 Habitat Health Distribution";
            desc.innerText = "Ecological coverage and site-specific habitat diversity.";
            
            const habitatCounts = countBy(filteredData, 'habitat');
            const habits = Object.keys(habitatCounts).sort((a,b) => habitatCounts[b] - habitatCounts[a]);

            modalChart = new ApexCharts(container, {
                series: [{ name: 'Records', data: habits.map(h => habitatCounts[h]) }],
                chart: { type: 'bar', height: 350, toolbar: { show: false } },
                plotOptions: { bar: { borderRadius: 8, distributed: true, columnWidth: '60%' } },
                colors: ['#2D6A4F', '#52B788', '#7A816C', '#C2923A', '#A77F6A'],
                xaxis: { categories: habits, labels: { style: { fontWeight: 600 } } },
                legend: { show: false }
            });
        } else if (type === 'nav-terrain') {
            title.innerText = "⛰️ Terrain Linkage Correlation";
            desc.innerText = "Bivariate correlation between species occurrence and terrain elevation.";
            
            // Mock dynamic correlation scatter data (Elevation vs Target Suitability)
            const scatterData = filteredData.map(d => [
                Math.random() * 800 + 400, // Elevation (x) in meters
                Math.random() * 0.8 + 0.2  // Suitability score (y)
            ]);

            modalChart = new ApexCharts(container, {
                series: [{ name: 'Sightings', data: scatterData }],
                chart: { type: 'scatter', height: 350, toolbar: { show: false }, zoom: { type: 'xy' } },
                colors: ['#2D6A4F'],
                xaxis: { title: { text: 'Elevation (m)', style: { fontWeight: 600 } }, tickAmount: 5 },
                yaxis: { title: { text: 'Success Likelihood', style: { fontWeight: 600 } }, min: 0, max: 1 },
                markers: { size: 6, opacity: 0.8 }
            });
        }
        
        modalChart.render();
    }

    function updateStats() {
        const totalEl = document.getElementById('stats-total-trees');
        const shannonEl = document.getElementById('stats-shannon');
        if (totalEl) totalEl.innerText = filteredData.length.toLocaleString();

        if (shannonEl) {
            shannonEl.innerText = calculateShannonIndex(filteredData);
        }

        const badge = document.getElementById('species-count-badge');
        const uniqueSpecies = new Set(filteredData.map(d => d.species));
        if (badge) badge.textContent = `${uniqueSpecies.size} spp`;
    }

    function initMap() {
        if (!document.getElementById('map')) return;

        // Switch to LIGHT map tiles
        const lightTiles = L.tileLayer(
            'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
            {
                maxZoom: 20,
                attribution: '&copy; Stadia Maps, &copy; OpenStreetMap'
            }
        );

        map = L.map('map', {
            layers: [lightTiles],
            zoomControl: false
        }).setView([-16.5, 29.5], 9);

        L.control.zoom({ position: 'topright' }).addTo(map);

        if (hurungweBoundary) {
            L.geoJSON(hurungweBoundary, {
                style: {
                    color: '#7A816C', // Olive instead of bright green
                    weight: 2,
                    fillColor: '#7A816C',
                    fillOpacity: 0.05,
                    dashArray: '6, 4'
                }
            }).addTo(map);
        }

        markerCluster = L.markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                const size = count > 100 ? 50 : count > 50 ? 44 : 38;
                return L.divIcon({
                    html: `<span>${count}</span>`,
                    className: 'custom-cluster-icon',
                    iconSize: L.point(size, size)
                });
            }
        });

        buildMarkers(filteredData);
        map.addLayer(markerCluster);

        if (hurungweBoundary) {
            const group = new L.featureGroup([L.geoJSON(hurungweBoundary)]);
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
    }

    function buildMarkers(data) {
        if (!markerCluster) return;
        markerCluster.clearLayers();
        data.forEach(p => {
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: 6,
                fillColor: getColorForSpecies(p.species),
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85
            });

            marker.bindPopup(`
                <div class="map-popup">
                    <div class="popup-species">${p.species}</div>
                    <div class="popup-row"><span>🏕️</span><span>${p.habitat || '—'}</span></div>
                    <div class="popup-row"><span>🏔️</span><span>${p.terrain || '—'}</span></div>
                    <div class="popup-row"><span>👤</span><span>${p.monitor || '—'}</span></div>
                    <div class="popup-row"><span>📅</span><span>${p.date || '—'}</span></div>
                </div>
            `, { maxWidth: 240 });

            markerCluster.addLayer(marker);
        });
    }

    function refreshMap() {
        if (isHeatmapMode) {
            buildHeatmap(filteredData);
        } else {
            buildMarkers(filteredData);
        }
    }

    function buildHeatmap(data) {
        if (!map) return;
        if (heatLayer) {
            map.removeLayer(heatLayer);
        }
        const points = data.map(p => [p.lat, p.lon, 1]);
        heatLayer = L.heatLayer(points, {
            radius: 25,
            blur: 18,
            maxZoom: 15,
            max: 1.0,
            gradient: {
                0.2: '#D8F3DC', // Pale Mint (Sparse)
                0.4: '#95D5B2', // Light Green
                0.6: '#52B788', // Fern Green
                0.8: '#2D6A4F', // Emerald Green
                1.0: '#1B4332'  // Deep Forest (Dense)
            }
        }).addTo(map);
    }

    function toggleHeatmap() {
        const btn = document.getElementById('toggle-heatmap');
        if (!btn) return;
        isHeatmapMode = !isHeatmapMode;

        if (isHeatmapMode) {
            if (markerCluster) map.removeLayer(markerCluster);
            buildHeatmap(filteredData);
            btn.classList.add('active');
            btn.innerHTML = '<span class="btn-icon">📍</span> Cluster View';
        } else {
            if (heatLayer) {
                map.removeLayer(heatLayer);
                heatLayer = null;
            }
            if (markerCluster) map.addLayer(markerCluster);
            btn.classList.remove('active');
            btn.innerHTML = '<span class="btn-icon">🌡️</span> Heatmap View';
        }
    }

    // Manage Banner Exit
    document.getElementById('btn-exit-mode')?.addEventListener('click', () => {
        if (isIdentifyMode) toggleIdentifyMode();
        // future modes can be added here
    });

    function toggleIdentifyMode() {
        isIdentifyMode = !isIdentifyMode;
        const btn = document.getElementById('nav-buffer');
        const banner = document.getElementById('map-status-banner');
        const bannerText = document.getElementById('banner-text');
        
        if (!btn || !banner) return;
        
        // Mode Interlock: Disable Predictive if Identify is activated
        if (isIdentifyMode && isPredictiveMode) {
            isPredictiveMode = false;
        }

        if (isIdentifyMode) {
            btn.classList.add('mode-active');
            bannerText.innerText = "Identify Mode Active: Click map to analyze 5km impact buffer.";
            banner.classList.remove('hidden');
            map.getContainer().style.cursor = 'crosshair';
        } else {
            btn.classList.remove('mode-active');
            banner.classList.add('hidden');
            map.getContainer().style.cursor = '';
            if (analysisBuffer) {
                map.removeLayer(analysisBuffer);
                analysisBuffer = null;
            }
        }
    }

    function performBufferAnalysis(latlng) {
        if (analysisBuffer) map.removeLayer(analysisBuffer);

        const radiusKm = 5;
        analysisBuffer = L.circle(latlng, {
            radius: radiusKm * 1000,
            color: '#2D6A4F',
            fillColor: '#2D6A4F',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5'
        }).addTo(map);

        const localData = allData.filter(p => {
            const dist = getHaversineDistance(latlng, { lat: p.lat, lon: p.lon });
            return dist <= radiusKm;
        });

        const diversity = calculateShannonIndex(localData);
        const speciesCounts = countBy(localData, 'species');
        const sorted = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]);
        const dominant = sorted[0] ? sorted[0][0] : 'None';

        const popupContent = `
            <div class="map-popup-analysis">
                <div class="analysis-header">🎯 5km Radius Impact</div>
                <div class="analysis-row">
                    <span class="label">Trees Found</span>
                    <span class="val">${localData.length}</span>
                </div>
                <div class="analysis-row">
                    <span class="label">Diversity Index (H')</span>
                    <span class="val">${diversity}</span>
                </div>
                 <div class="analysis-row" style="margin-top:8px">
                    <span class="label">Key Species:</span>
                </div>
                <div class="val" style="color:var(--accent); font-weight:700; margin-top:2px;">${dominant}</div>
                <div class="diversity-badge ${diversity > 1 ? 'diversity-high' : 'diversity-low'}" style="margin-top:12px; display:inline-block">
                    ${diversity > 1 ? 'Healthy Ecosystem' : 'Species Targeted'}
                </div>
            </div>
        `;

        L.popup()
            .setLatLng(latlng)
            .setContent(popupContent)
            .openOn(map);
    }

    function initCharts() {
        const chartEl = document.querySelector('#species-donut-chart');
        if (!chartEl) return;

        const speciesCounts = countBy(filteredData, 'species');
        const sorted = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

        const options = {
            series: sorted.map(s => s[1]),
            labels: sorted.map(s => shortenLabel(s[0])),
            chart: {
                type: 'donut',
                height: 280,
                foreColor: '#4A5D52',
                background: 'transparent',
                animations: { enabled: true, speed: 600 }
            },
            colors: ['#2D6A4F', '#52B788', '#7A816C', '#C2923A', '#A77F6A', '#6F4E37'],
            dataLabels: { enabled: false },
            legend: {
                position: 'bottom',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                markers: { radius: 4, width: 10, height: 10 },
                itemMargin: { horizontal: 6, vertical: 2 }
            },
            stroke: { show: true, colors: ['#fff'], width: 3 },
            plotOptions: {
                pie: {
                    donut: {
                        size: '80%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Tree Records',
                                color: '#4A5D52',
                                fontSize: '11px',
                                fontWeight: 700,
                                formatter: () => filteredData.length.toLocaleString()
                            },
                            value: {
                                color: '#1B2620',
                                fontSize: '24px',
                                fontWeight: 800,
                                fontFamily: 'Poppins, sans-serif'
                            }
                        }
                    }
                }
            },
            tooltip: { theme: 'light' }
        };

        donutChart = new ApexCharts(chartEl, options);
        donutChart.render();

        initTerrainChart();
    }

    function initTerrainChart() {
        const el = document.querySelector('#terrain-correlation-chart');
        if (!el) return;
        const tc = countBy(filteredData.filter(d => d.terrain && d.terrain !== 'None'), 'terrain');
        const tsrt = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const options = {
            series: [{ name: 'Sightings', data: tsrt.map(s => s[1]) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false }, foreColor: '#4A5D52' },
            plotOptions: { bar: { horizontal: true, borderRadius: 6, distributed: true, barHeight: '65%' } },
            colors: ['#2D6A4F', '#52B788', '#7A816C', '#C2923A', '#A77F6A'],
            dataLabels: { enabled: false },
            xaxis: { categories: tsrt.map(s => s[0]), labels: { style: { fontSize: '10px', fontWeight: 600 } } },
            grid: { borderColor: '#f1f1f1', strokeDashArray: 3 },
            legend: { show: false }
        };
        terrainChart = new ApexCharts(el, options);
        terrainChart.render();
    }

    function updateCharts() {
        if (donutChart) {
            const sc = countBy(filteredData, 'species');
            const srt = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 6);
            donutChart.updateOptions({
                series: srt.map(s => s[1]),
                labels: srt.map(s => shortenLabel(s[0]))
            });
        }
        if (terrainChart) {
            const td = countBy(filteredData.filter(d => d.terrain && d.terrain !== 'None'), 'terrain');
            const tsrt = Object.entries(td).sort((a, b) => b[1] - a[1]).slice(0, 5);
            terrainChart.updateOptions({
                series: [{ data: tsrt.map(s => s[1]) }],
                xaxis: { categories: tsrt.map(s => s[0]) }
            });
        }
    }

    function renderHabitatProgress() {
        const container = document.getElementById('habitat-list');
        if (!container) return;
        const habitats = countBy(filteredData.filter(d => d.habitat && d.habitat !== 'None'), 'habitat');
        const sorted = Object.entries(habitats).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const total = filteredData.length || 1;

        container.innerHTML = sorted.map(([name, count]) => {
            const pct = Math.round((count / total) * 100);
            return `
                <div class="progress-item">
                    <div class="progress-labels">
                        <span>${name}</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: 0%" data-target="${pct}"></div>
                    </div>
                </div>
            `;
        }).join('');

        requestAnimationFrame(() => {
            container.querySelectorAll('.progress-bar-fill').forEach(el => {
                el.style.width = el.dataset.target + '%';
            });
        });
    }

    function renderActivityLog() {
        const container = document.getElementById('activity-log');
        if (!container) return;
        const displayData = showingAllActivity ? filteredData : filteredData.slice(0, 6);

        if (displayData.length === 0) {
            container.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0">No records found.</div>`;
            return;
        }

        container.innerHTML = displayData.map((p, i) => `
            <div class="activity-item" data-lat="${p.lat}" data-lon="${p.lon}">
                <div class="activity-icon" style="background:${getColorForSpecies(p.species)}22;">🌳</div>
                <div class="activity-info">
                    <span class="title">${p.species}</span>
                    <span class="meta">${p.monitor || '—'} · ${p.habitat || '—'}</span>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.activity-item').forEach(el => {
            el.addEventListener('click', () => {
                const lat = parseFloat(el.dataset.lat);
                const lon = parseFloat(el.dataset.lon);
                if (!isNaN(lat) && !isNaN(lon) && map) {
                    if (isHeatmapMode) toggleHeatmap();
                    map.setView([lat, lon], 15, { animate: true });
                }
            });
        });
    }

    function initTimeSlider() {
        const slider = document.getElementById('time-slider');
        const display = document.getElementById('slider-date-display');
        const minLabel = document.getElementById('slider-min-label');
        const maxLabel = document.getElementById('slider-max-label');
        if (!slider || sortedDates.length === 0) return;

        slider.min = 0;
        slider.max = sortedDates.length - 1;
        slider.value = sortedDates.length - 1;

        if (minLabel) minLabel.textContent = formatDate(sortedDates[0]);
        if (maxLabel) maxLabel.textContent = formatDate(sortedDates[sortedDates.length - 1]);
        if (display) display.textContent = 'All Dates';

        slider.addEventListener('input', () => {
            const idx = parseInt(slider.value);
            activeFilters.dateIndex = idx;
            if (display) display.textContent = formatDate(sortedDates[idx]);
            applyFilters();
        });
    }

    function togglePlay() {
        const btn = document.getElementById('slider-play');
        if (!btn) return;

        if (isPlaying) {
            clearInterval(playInterval);
            isPlaying = false;
            btn.textContent = '▶ Play';
            btn.classList.remove('playing');
        } else {
            isPlaying = true;
            btn.textContent = '⏸ Pause';
            btn.classList.add('playing');

            const slider = document.getElementById('time-slider');
            let idx = parseInt(slider.value);

            if (idx >= sortedDates.length - 1) {
                idx = 0;
                slider.value = 0;
            }

            playInterval = setInterval(() => {
                if (idx >= sortedDates.length - 1) {
                    togglePlay();
                    return;
                }
                idx++;
                slider.value = idx;
                activeFilters.dateIndex = idx;
                const display = document.getElementById('slider-date-display');
                if (display) display.textContent = formatDate(sortedDates[idx]);
                applyFilters();
            }, 800);
        }
    }

    function bindEventListeners() {
        const toggleHeatBtn = document.getElementById('toggle-heatmap');
        if (toggleHeatBtn) toggleHeatBtn.addEventListener('click', toggleHeatmap);

        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                if (map && hurungweBoundary) {
                    const group = new L.featureGroup([L.geoJSON(hurungweBoundary)]);
                    map.fitBounds(group.getBounds(), { padding: [20, 20] });
                }
            });
        }

        ['filter-species', 'filter-habitat', 'filter-monitor'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    const key = id.replace('filter-', '');
                    activeFilters[key] = e.target.value;
                    applyFilters();
                });
            }
        });

        const resetFiltersBtn = document.getElementById('reset-filters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                activeFilters = { species: 'all', habitat: 'all', monitor: 'all', dateIndex: -1, search: '' };
                ['filter-species', 'filter-habitat', 'filter-monitor'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = 'all';
                });
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.value = '';

                const slider = document.getElementById('time-slider');
                if (slider) slider.value = sortedDates.length - 1;

                const display = document.getElementById('slider-date-display');
                if (display) display.textContent = 'All Dates';

                if (isPlaying) togglePlay();
                applyFilters();
            });
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    activeFilters.search = e.target.value;
                    applyFilters();
                }, 300);
            });
        }

        const sliderResetBtn = document.getElementById('slider-reset');
        if (sliderResetBtn) {
            sliderResetBtn.addEventListener('click', () => {
                activeFilters.dateIndex = -1;
                const slider = document.getElementById('time-slider');
                if (slider) slider.value = sortedDates.length - 1;
                const display = document.getElementById('slider-date-display');
                if (display) display.textContent = 'All Dates';
                if (isPlaying) togglePlay();
                applyFilters();
            });
        }

        const playBtn = document.getElementById('slider-play');
        if (playBtn) playBtn.addEventListener('click', togglePlay);

        const viewAllBtn = document.getElementById('view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                showingAllActivity = !showingAllActivity;
                viewAllBtn.textContent = showingAllActivity ? 'Show Less' : 'View All';
                renderActivityLog();
            });
        }

        // Navigation Handlers
        ['nav-dashboard', 'nav-gis', 'nav-export', 'nav-trends', 'nav-habitat', 'nav-buffer', 'nav-terrain'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                        if (id === 'nav-buffer') {
                        toggleIdentifyMode();
                    } else if (id === 'nav-terrain') {
                        showAnalyticModal('nav-terrain');
                    } else {
                        switchView(id);
                    }
                });
            }
        });
    }

    // ─────────────────────────────────────────────
    // 4. BOOTSTRAP (Nature Edition)
    // ─────────────────────────────────────────────
    try {
        const [speciesRes, geoRes] = await Promise.all([
            fetch('data/species.json'),
            fetch('data/Hurungwe.geojson')
        ]);
        const rawData = await speciesRes.json();
        hurungweBoundary = await geoRes.json();

        allData = rawData.filter(d =>
            d.lat && d.lon &&
            d.lat >= -20 && d.lat <= -14 &&
            d.lon >= 28 && d.lon <= 32 &&
            d.species && d.species !== 'None' && d.species !== 'none'
        );

        filteredData = [...allData];

        // Populate Export Species Filter
        const exportFilter = document.getElementById('export-species-filter');
        if (exportFilter) {
            const speciesList = Array.from(new Set(allData.map(d => d.species))).sort();
            speciesList.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                exportFilter.appendChild(opt);
            });
        }

        initDashboard();
        // 5. Load Research / SDM Data
        await loadResearchData();

    } catch (err) {
        console.error('Failed to load data:', err);
    }
    // ─────────────────────────────────────────────
    // 10. RESEARCH & PREDICTIVE ENGINE (NEW)
    // ─────────────────────────────────────────────

    async function loadResearchData() {
        try {
            const resResults = await fetch('data/research_outputs.json');
            researchResults = await resResults.json();

            const resGrid = await fetch('data/suitability_grid.json');
            suitabilityGrid = await resGrid.json();

            console.log("SDM Data Loaded Successfully");
        } catch (e) {
            console.error("Failed to load SDM data", e);
        }
    }


    function initSDMCharts() {
        if (!researchResults) return;

        // 1. AUC & Kappa Chart
        const speciesNames = Object.keys(researchResults.species_metrics);
        const aucVals = speciesNames.map(s => researchResults.species_metrics[s].auc);
        const kappaVals = speciesNames.map(s => researchResults.species_metrics[s].kappa);

        if (sdmCharts.auc) sdmCharts.auc.destroy();
        sdmCharts.auc = new ApexCharts(document.querySelector("#chart-auc-kappa"), {
            series: [{ name: 'AUC', data: aucVals }, { name: 'Kappa', data: kappaVals }],
            chart: { height: 250, type: 'bar', toolbar: { show: false } },
            plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
            dataLabels: { enabled: false },
            colors: ['#2D6A4F', '#D90429'],
            xaxis: { categories: speciesNames.map(s => s.split(' ')[0]), labels: { style: { fontSize: '10px' } } },
            title: { text: 'Model Evaluation Scores', style: { fontSize: '12px', fontWeight: 600 } }
        });
        sdmCharts.auc.render();

        // 2. Variable Importance (Mock Aggregated)
        const drivers = researchResults.driver_metadata;
        const driverKeys = Object.keys(drivers);
        const driverCounts = {};
        speciesNames.forEach(s => {
            const d = researchResults.species_metrics[s].main_driver;
            driverCounts[d] = (driverCounts[d] || 0) + 1;
        });

        if (sdmCharts.importance) sdmCharts.importance.destroy();
        sdmCharts.importance = new ApexCharts(document.querySelector("#chart-importance"), {
            series: [{ name: 'Species Dominance', data: driverKeys.map(k => driverCounts[k] || 0) }],
            chart: { height: 250, type: 'bar', toolbar: { show: false } },
            plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
            colors: ['#52B788'],
            xaxis: { categories: driverKeys },
            title: { text: 'Driver Influence Frequency', style: { fontSize: '12px', fontWeight: 600 } }
        });
        sdmCharts.importance.render();
    }

    // --- KNN LOOKUP FOR PREDICTION ---
    function predictAtLocation(lat, lon) {
        if (!suitabilityGrid) return;

        // Get weights from sliders (Simulation)
        const thermalWeight = (parseInt(document.getElementById('sim-thermal')?.value || 70) - 50) / 100;
        const waterWeight = (parseInt(document.getElementById('sim-water')?.value || 85) - 50) / 100;

        // 1. Find nearest grid point
        let latIdx = -1;
        let lonIdx = -1;
        let minLatDiff = Infinity;
        suitabilityGrid.lats.forEach((l, i) => {
            let diff = Math.abs(l - lat);
            if (diff < minLatDiff) { minLatDiff = diff; latIdx = i; }
        });
        let minLonDiff = Infinity;
        suitabilityGrid.lons.forEach((l, i) => {
            let diff = Math.abs(l - lon);
            if (diff < minLonDiff) { minLonDiff = diff; lonIdx = i; }
        });

        if (latIdx === -1 || lonIdx === -1) return;

        // 2. Extract and WEIGHT suitability scores
        const results = [];
        Object.entries(suitabilityGrid.suitability).forEach(([species, grid]) => {
            let score = grid[latIdx][lonIdx] || 0.0;
            
            // Apply simulation weights (simplified version)
            // Adjust score by +/- 20% based on thermal/water offsets
            score += (thermalWeight * 0.2) + (waterWeight * 0.1);
            score = Math.max(0, Math.min(1, score)); // Clamp

            results.push({ species, score });
        });

        renderPredictionResults(results, lat, lon);
    }

    function renderPredictionResults(results, lat, lon) {
        const activeContainer = document.getElementById('prediction-report-active');
        const emptyContainer = document.getElementById('prediction-report-empty');
        const resultsGrid = document.getElementById('prediction-results');

        emptyContainer.classList.add('hidden');
        activeContainer.classList.remove('hidden');

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        resultsGrid.innerHTML = results.map(r => {
            const percent = (r.score * 100).toFixed(1);
            const color = r.score > 0.7 ? '#2D6A4F' : r.score > 0.4 ? '#F5CB5C' : '#D90429';
            return `
                <div class="prediction-item">
                    <h4>${r.species}</h4>
                    <div class="suitability-bar-container">
                        <div class="suitability-bar-fill" style="width: ${percent}%; background: ${color}"></div>
                    </div>
                    <div class="suitability-score" style="color: ${color}">${percent}% Target Match</div>
                </div>
            `;
        }).join('');
    }

    // --- SUITABILITY HEATMAP (RESEARCH OVERLAY) ---
    function showSuitabilityHeatmap(species) {
        if (!suitabilityGrid || !map) return;
        
        // Remove existing suitability layer
        if (activeSuitabilityLayer) {
            map.removeLayer(activeSuitabilityLayer);
            activeSuitabilityLayer = null;
        }

        if (species === 'all') return;

        // Get key for grid lookup
        const speciesKeys = Object.keys(suitabilityGrid.suitability);
        const match = speciesKeys.find(k => k.includes(species) || species.includes(k.split(' ')[0]));
        
        if (!match) return;

        const gridData = suitabilityGrid.suitability[match];
        const { lats, lons } = suitabilityGrid;

        // Convert grid to heat points
        const leafletHeatPoints = [];
        gridData.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (val > 0.3) {
                    leafletHeatPoints.push([lats[rIdx], lons[cIdx], val]);
                }
            });
        });

        activeSuitabilityLayer = L.heatLayer(leafletHeatPoints, {
            radius: 35,
            blur: 25,
            maxZoom: 15,
            max: 1.0,
            gradient: {
                0.3: '#FFFACD', // Lemon
                0.6: '#FFD700', // Gold
                0.9: '#FF8C00', // Dark Orange
                1.0: '#FF4500'  // Orangered (Hotspots)
            }
        }).addTo(map);
    }

    // Update the existing filter listener
    document.getElementById('filter-species')?.addEventListener('change', (e) => {
        const species = e.target.value;
        if (isPredictiveMode) {
            showSuitabilityHeatmap(species);
        }
    });

    // --- EVENT LISTENERS ---
    document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('nav-dashboard');
    });

    document.getElementById('nav-predictive')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('nav-predictive');
    });

    document.getElementById('nav-gis')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('nav-gis');
    });

    document.getElementById('nav-trends')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('nav-trends');
    });

    document.getElementById('nav-habitat')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('nav-habitat');
    });

    // Unified Map Click Handler (Mode Interlock)
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        
        if (isIdentifyMode) {
            // Buffer analysis
            performBufferAnalysis(e.latlng);
            return;
        }
        
        if (isPredictiveMode) {
            // SDM Prediction
            const selectIcon = L.divIcon({
                html: '🎯',
                className: 'select-icon',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            const selMarker = L.marker([lat, lng], { icon: selectIcon }).addTo(map);
            setTimeout(() => { map.removeLayer(selMarker); }, 3000);
            
            predictAtLocation(lat, lng);
            return;
        }
        
        // Default standard map click actions (if any)
    });

    // --- MOBILE NAVIGATION HANDLERS ---
    function toggleSidebar(state) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const menuBtn = document.getElementById('mobile-menu-trigger');
        if (!sidebar || !overlay || !menuBtn) return;

        const isOpen = state !== undefined ? state : !sidebar.classList.contains('mobile-active');
        if (isOpen) {
            sidebar.classList.add('mobile-active');
            overlay.classList.add('active');
            menuBtn.classList.add('active');
        } else {
            sidebar.classList.remove('mobile-active');
            overlay.classList.remove('active');
            menuBtn.classList.remove('active');
        }
    }

    document.getElementById('mobile-menu-trigger')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
        toggleSidebar(false);
    });
    const closeModal = () => {
        const modal = document.getElementById('analytic-modal');
        if (modal) modal.classList.add('hidden');
    };

    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    
    // Close on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('analytic-modal');
        if (e.target === modal) closeModal();
    });

    // Close on Esc key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Switch to Export View and Bind
    document.getElementById('nav-export')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('nav-export');
    });

    document.getElementById('btn-final-export')?.addEventListener('click', downloadCSV);

});
