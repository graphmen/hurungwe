/**
 * Hurungwe Field Collector — Offline-First Logic
 * Powered by Firebase Firestore + IndexedDB Persistence
 */

// 1. FIREBASE CONFIGURATION (Placeholder - User should replace with their actual keys)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "hurungwe-species.firebaseapp.com",
    projectId: "hurungwe-species",
    storageBucket: "hurungwe-species.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef12345"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 2. OFFLINE PERSISTENCE ACTIVATION
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn("Offline persistence failed (Multiple tabs open).");
        } else if (err.code == 'unimplemented') {
            console.warn("Offline persistence not supported by this browser.");
        }
    });

// 3. GLOBAL STATE
let currentCoords = null;
let pendingCount = 0;

// 4. GEOLOCATION ENGINE
function initGeolocation() {
    const banner = document.getElementById('gps-banner');
    const coordEl = document.getElementById('gps-coords');

    if (!navigator.geolocation) {
        coordEl.innerText = "GPS Not Supported";
        return;
    }

    navigator.geolocation.watchPosition(
        (pos) => {
            currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            banner.classList.remove('waiting');
            banner.classList.add('locked');
            coordEl.innerText = `GPS Locked: ${currentCoords.lat.toFixed(5)}, ${currentCoords.lon.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`;
        },
        (err) => {
            console.error("GPS Error:", err);
            banner.classList.add('waiting');
            coordEl.innerText = "GPS Error: Please enable location.";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// 5. CONNECTIVITY MONITOR
function initConnectivityMonitor() {
    const badge = document.getElementById('sync-status');
    const text = document.getElementById('status-text');

    const updateStatus = () => {
        if (navigator.onLine) {
            badge.className = 'sync-badge online';
            text.innerText = 'ONLINE';
        } else {
            badge.className = 'sync-badge offline';
            text.innerText = 'OFFLINE';
        }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// 6. FORM HANDLER
async function initForm() {
    const form = document.getElementById('collector-form');
    const btn = document.getElementById('btn-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentCoords) {
            alert("No GPS Lock! Please wait for coordinates before saving.");
            return;
        }

        const species = document.getElementById('field-species').value;
        const habitat = document.getElementById('field-habitat').value;
        const recorder = document.getElementById('field-recorder').value;
        const condition = document.querySelector('input[name="condition"]:checked').value;

        const observation = {
            species,
            habitat,
            recorder,
            condition,
            lat: currentCoords.lat,
            lon: currentCoords.lon,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            syncStatus: 'pending' // Firestore handles this internally, but we use this for local UI
        };

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';

        try {
            // Save to Firestore (Works even offline!)
            await db.collection('observations').add(observation);
            
            // UI Feedback
            confirmSave();
            form.reset();
            
        } catch (err) {
            console.error("Save Error:", err);
            alert("Critical Failure: Could not save to local storage.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> SAVE OBSERVATION';
        }
    });
}

function confirmSave() {
    const btn = document.getElementById('btn-submit');
    const originalContent = btn.innerHTML;
    
    btn.classList.add('success');
    btn.innerHTML = '<i class="fas fa-check-circle"></i> SAVED LOCALLY';
    
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.classList.remove('success');
    }, 2000);
    
    updateQueueUI();
}

// 7. QUEUE UI MONITOR
async function updateQueueUI() {
    const list = document.getElementById('pending-list');
    if (!list) return;

    // Listen to firestore metadata changes to see if items are local or synced
    db.collection('observations').orderBy('timestamp', 'desc').limit(5)
        .onSnapshot((snapshot) => {
            list.innerHTML = '';
            snapshot.forEach((doc) => {
                const data = doc.data();
                const isLocal = doc.metadata.hasPendingWrites;
                
                const item = document.createElement('div');
                item.className = 'queue-item';
                if (!isLocal) item.style.borderLeftColor = 'var(--field-accent)';
                
                item.innerHTML = `
                    <div class="queue-info">
                        <h4>${data.species}</h4>
                        <p>${data.recorder} • ${isLocal ? 'Waiting for Network' : 'Synced to Dashboard'}</p>
                    </div>
                    <div class="sync-icon">
                        ${isLocal ? '<i class="fas fa-clock" style="color:#F6AD55"></i>' : '<i class="fas fa-check-circle" style="color:var(--field-accent)"></i>'}
                    </div>
                `;
                list.appendChild(item);
            });
        });
}

// INITIALIZE
document.addEventListener('DOMContentLoaded', () => {
    initGeolocation();
    initConnectivityMonitor();
    initForm();
    updateQueueUI();
});
