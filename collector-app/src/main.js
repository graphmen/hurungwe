import './style.css';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import localforage from 'localforage';

// Firebase — bundled via npm (no CDN, no network download on startup)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const firebaseConfig = {
    apiKey: "AIzaSyD0sDQNDfAH2AYrxJhwNa4r77uu98Gz4f8",
    authDomain: "hurungwe-gis-f8099.firebaseapp.com",
    projectId: "hurungwe-gis-f8099",
    storageBucket: "hurungwe-gis-f8099.firebasestorage.app",
    messagingSenderId: "315238946268",
    appId: "1:315238946268:web:9ca8edd76fff065001ab19",
    measurementId: "G-V7D6EK2VDM"
};

// Initialize Firebase synchronously — instant startup, no polling needed
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// App State
const state = {
    currentLat: null,
    currentLng: null,
    isOnline: true,
    currentUser: null
};

// Queue Setup
localforage.config({
    name: 'HurungweCollector',
    storeName: 'observations_queue'
});

// Initialize UI immediately — Firebase is ready at module load time
document.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    setupNavigation();
    setupThemeToggle();
    checkNetworkState();
    setupForm();
    updateQueueUI();
    updateSyncStatusUI(); // Initial check
    // Dismiss splash once DOM is ready (Firebase is already initialized)
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) { loader.style.opacity = '0'; loader.style.transition = 'opacity 0.3s'; setTimeout(() => loader.remove(), 320); }
    }, 300);
});

// Authentication Logic
function setupAuth() {
    const loginForm = document.getElementById('auth-form');
    const header = document.getElementById('main-header');
    const nav = document.getElementById('main-nav');
    const pageLogin = document.getElementById('page-login');
    const pageCollect = document.getElementById('page-collect');
    const pageSync = document.getElementById('page-sync');
    const errorMsg = document.getElementById('auth-error');
    const emailDisplay = document.getElementById('user-email-display');

    // Listen to Auth State
    let gpsStarted = false;
    auth.onAuthStateChanged(user => {
        // Always dismiss the loading splash
        const loader = document.getElementById('app-loader');
        if (loader) { loader.style.transition = 'opacity 0.4s'; loader.style.opacity = '0'; setTimeout(() => loader.remove(), 420); }

        if (user) {
            state.currentUser = user;
            emailDisplay.innerHTML = `<i class="fas fa-user-circle" style="margin-right: 4px;"></i> ${user.displayName || user.email}`;

            // Switch UI to logged-in state
            header.style.display = 'flex';
            nav.style.display = 'flex';
            pageLogin.classList.remove('active');
            
            // Route to home instead of collect
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const homePage = document.getElementById('page-home');
            if (homePage) homePage.classList.add('active');

            // Re-sync UI state for nav
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const navHome = document.querySelector('.nav-item[data-target="page-home"]');
            if (navHome) navHome.classList.add('active');

            // TRIGGER GPS – only once per session
            if (!gpsStarted) {
                gpsStarted = true;
                startGpsTracking();
            }

            // Background sync removed for battery preservation
        } else {
            state.currentUser = null;
            gpsStarted = false;

            // Switch UI to logged-out state
            header.style.display = 'none';
            nav.style.display = 'none';
            pageLogin.classList.add('active');
            pageCollect.classList.remove('active');
            pageSync.classList.remove('active');
        }
    });

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-login');
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Authenticating...';
        errorMsg.style.display = 'none';

        try {
            await auth.signInWithEmailAndPassword(email, password);
            loginForm.reset();
        } catch (error) {
            console.error("Login failed:", error);
            errorMsg.innerText = error.message;
            errorMsg.style.display = 'block';

            // Vibrate pattern for error (tactile feedback)
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Secure Login';
        }
    });

    // Handle Sign Up
    const bSignup = document.getElementById('btn-signup');
    bSignup.addEventListener('click', async () => {
        const nameGroup = document.getElementById('group-name');
        
        // Show Name field if it's hidden
        if (nameGroup.style.display === 'none') {
            nameGroup.style.display = 'block';
            document.getElementById('auth-name').required = true;
            bSignup.innerHTML = '<i class="fas fa-check"></i> Confirm Sign Up';
            bSignup.style.background = 'var(--premium-green)';
            bSignup.style.color = '#fff';
            return;
        }

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value;

        if (!email || !password || !name) {
            errorMsg.innerText = "Please fill in all fields (Name, Email, Password).";
            errorMsg.style.display = 'block';
            return;
        }

        bSignup.disabled = true;
        bSignup.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';
        errorMsg.style.display = 'none';

        try {
            const userCred = await auth.createUserWithEmailAndPassword(email, password);
            await userCred.user.updateProfile({ displayName: name });
            
            // Reload user to ensure profile state is updated globally
            await firebase.auth().currentUser.reload();
            
            loginForm.reset();
            alert("Account successfully created and logged in!");
        } catch (error) {
            console.error("Sign up failed:", error);
            errorMsg.innerText = error.message;
            errorMsg.style.display = 'block';
        } finally {
            bSignup.disabled = false;
            bSignup.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            nameGroup.style.display = 'none';
        }
    });

    // Handle Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm("Are you sure you want to log out? Offline data is retained safely.")) {
            await auth.signOut();
        }
    });
}

// Navigation Logic
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(page => {
                if (page.id === targetId) {
                    page.classList.add('active');
                } else {
                    page.classList.remove('active');
                }
            });
        });
    });

    // Home Landing Page Shortcuts
    const btnHomeCollect = document.getElementById('btn-home-collect');
    const btnHomeSync = document.getElementById('btn-home-sync');
    
    if (btnHomeCollect) {
        btnHomeCollect.addEventListener('click', () => {
            const navCollect = document.querySelector('.nav-item[data-target="page-collect"]');
            if (navCollect) navCollect.click();
        });
    }
    
    if (btnHomeSync) {
        btnHomeSync.addEventListener('click', () => {
            const navSync = document.querySelector('.nav-item[data-target="page-sync"]');
            if (navSync) navSync.click();
        });
    }
}

// Theme Logic
function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const isDark = localStorage.getItem('collector-theme') === 'dark';
    if (isDark) document.body.classList.add('dark-mode');

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('collector-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
}

// Network Logic
async function checkNetworkState() {
    const status = await Network.getStatus();
    state.isOnline = status.connected;
    updateNetworkUI();
    updateSyncStatusUI();

    Network.addListener('networkStatusChange', status => {
        state.isOnline = status.connected;
        updateNetworkUI();
        updateSyncStatusUI();
    });
}

function updateNetworkUI() {
    const badge = document.getElementById('sync-status-badge');
    if (state.isOnline) {
        badge.innerHTML = '<i class="fas fa-wifi"></i> Online';
        badge.style.background = 'rgba(82, 183, 136, 0.1)';
        badge.style.color = 'var(--premium-green)';
    } else {
        badge.innerHTML = '<i class="fas fa-wifi" style="opacity:0.5"></i> Offline';
        badge.style.background = 'rgba(239, 35, 60, 0.1)';
        badge.style.color = '#ef233c';
    }
}

// GPS Tracking — environment-aware (Native Capacitor vs Web Browser)
async function startGpsTracking() {
    const statusBadge = document.getElementById('gps-status-badge');
    const proContainer = document.getElementById('gps-pro-container');
    if (!statusBadge || !proContainer) return; // guard: elements may not be visible yet

    statusBadge.innerText = 'Locating...';

    function onPosition(lat, lng, accuracy) {
        state.currentLat = lat;
        state.currentLng = lng;
        document.getElementById('gps-lat').innerText = lat.toFixed(5);
        document.getElementById('gps-lng').innerText = lng.toFixed(5);
        document.getElementById('gps-acc').innerText = `\u00b1${Math.round(accuracy)}m`;
        statusBadge.innerText = 'LOCKED';
        statusBadge.style.background = 'rgba(82, 183, 136, 0.1)';
        statusBadge.style.color = 'var(--premium-green)';
        proContainer.classList.remove('pulse-waiting');
        proContainer.classList.add('pulse-locked');
    }

    function onError(msg) {
        console.error('GPS Error:', msg);
        statusBadge.innerText = 'ERROR';
        statusBadge.style.color = '#ef233c';
        statusBadge.style.background = 'rgba(239,35,60,0.1)';
    }

    // Detect if running inside a real native Capacitor app
    const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    if (isNative) {
        // NATIVE ANDROID — use Capacitor Geolocation plugin
        try {
            let perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
                perm = await Geolocation.requestPermissions();
            }
            if (perm.location !== 'granted') {
                onError('Permission denied');
                return;
            }
            Geolocation.watchPosition(
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
                (pos, err) => {
                    if (pos) onPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
                    else if (err) onError(err.message);
                }
            );
        } catch (e) {
            onError(e.message);
        }
    } else {
        // WEB BROWSER — use standard navigator.geolocation directly
        if (!navigator.geolocation) {
            onError('Geolocation not supported');
            return;
        }
        navigator.geolocation.watchPosition(
            (pos) => onPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
            (err) => onError(err.message),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }
}


// Form Submission & Sync
function setupForm() {
    document.getElementById('collector-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!state.currentLat || !state.currentLng) {
            alert("Waiting for GPS lock. Please stand outside.");
            return;
        }

        const data = {
            id: Date.now().toString(),
            species: document.getElementById('field-species').value,
            habitat: document.getElementById('field-habitat').value,
            landuse: document.getElementById('field-landuse').value,
            condition: document.getElementById('field-condition').value,
            recorder: state.currentUser ? (state.currentUser.displayName || state.currentUser.email) : 'Unknown Agent',
            lat: state.currentLat,
            lng: state.currentLng,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        // Save locally first
        await saveToQueue(data);

        // Reset Form
        e.target.reset();

        alert("Observation Saved!");

        // Auto-sync DISABLED - User must click 'Sync Now' in Sync Hub manually
    });

    document.getElementById('btn-force-sync').addEventListener('click', () => {
        if (!state.isOnline) {
            alert("Connection required: Please connect to WiFi or mobile data to upload your records.");
            return;
        }
        processQueue();
    });
}

// Queue Management
async function saveToQueue(record) {
    let queue = (await localforage.getItem('queue')) || [];
    queue.push(record);
    await localforage.setItem('queue', queue);
    updateQueueUI();
    updateSyncStatusUI();
}

async function updateQueueUI() {
    let queue = (await localforage.getItem('queue')) || [];
    const list = document.getElementById('pending-list');
    const badge = document.getElementById('queue-count');
    if (badge) badge.innerText = queue.length;
    updateSyncStatusUI();

    if (queue.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:20px;">No pending records. Completely synced!</div>';
        return;
    }

    list.innerHTML = queue.map(item => `
        <div style="background:#fff; border:1px solid var(--glass-border); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:600; font-size:14px; color:var(--text-primary);">${item.species}</div>
                <div style="font-size:11px; color:var(--text-muted);">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <i class="fas fa-cloud-upload-alt" style="color:#f6aa1c;"></i>
        </div>
    `).join('');
}



// Update the non-intrusive status bar
async function updateSyncStatusUI(statusOverride = null) {
    const bar = document.getElementById('sync-status-bar');
    const text = document.getElementById('sync-status-text');
    const homeStatus = document.getElementById('home-sync-status');
    if (!bar || !text) return;

    const queue = (await localforage.getItem('queue')) || [];
    const isOffline = !state.isOnline;
    const hasQueue = queue.length > 0;

    let statusHtml = '';
    let statusClass = '';
    let homeColor = 'var(--premium-green)';

    if (statusOverride) {
        statusHtml = statusOverride;
    } else if (isOffline) {
        statusClass = 'offline';
        statusHtml = `<i class="fas fa-wifi-slash"></i> Offline • ${queue.length} pending`;
        homeColor = '#ef233c';
    } else if (hasQueue) {
        statusClass = 'syncing';
        statusHtml = `<i class="fas fa-sync fa-spin"></i> ${queue.length} records waiting to sync`;
        homeColor = '#f6aa1c';
    } else {
        statusHtml = `<i class="fas fa-check-circle"></i> Cloud Sync: All data safe`;
        homeColor = 'var(--premium-green)';
    }

    bar.className = statusClass;
    text.innerHTML = statusHtml;

    if (homeStatus) {
        homeStatus.innerHTML = statusHtml;
        homeStatus.style.color = homeColor;
    }
}

async function processQueue(silent = false) {
    // Check network - strictly manual trigger now
    if (!state.isOnline) {
        updateSyncStatusUI();
        if (!silent) alert('Connection required: Please connect to WiFi or mobile data to upload your records.'); 
        return;
    }

    let queue = (await localforage.getItem('queue')) || [];
    if (queue.length === 0) {
        updateSyncStatusUI();
        if (!silent) alert('No pending records to sync.');
        return;
    }

    const btn = document.getElementById('btn-force-sync');
    if (btn) { btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Syncing...'; btn.disabled = true; }

    // Ensure Auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
        if (btn) { btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Now'; btn.disabled = false; }
        if (!silent) alert('Please log in to sync.');
        return;
    }

    const total = queue.length;
    let completedCount = 0;
    const syncedIds = [];
    const batch = db.batch(); // High-performance single database write

    // HIGH-OCTANE SYNC: Parallel Photos + Batched Firestore Docs
    // Process in parallel chunks of 5 to avoid overloading mobile network stack
    const chunkSize = 5;
    for (let i = 0; i < queue.length; i += chunkSize) {
        const chunk = queue.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (record) => {
            try {
                // eslint-disable-next-line no-unused-vars
                const { id, status, ...dbData } = record;

                // Add record to the Firestore Batch instead of direct write
                const docRef = db.collection('observations').doc(record.id);
                batch.set(docRef, dbData);
                
                syncedIds.push(record.id);
                completedCount++;
                
                const percent = Math.round((completedCount / total) * 100);
                updateSyncStatusUI(`<i class="fas fa-sync fa-spin"></i> Syncing: ${percent}% (${completedCount}/${total})...`);
            } catch (e) {
                console.error(`Record ${record.id} prepare failed:`, e.message);
            }
        }));
    }

    // FINAL BLAST: Commit all database records in ONE single request
    try {
        if (syncedIds.length > 0) {
            updateSyncStatusUI(`<i class="fas fa-database fa-spin"></i> Finalizing Database...`);
            await batch.commit();
            
            // Clean local storage
            const currentQueue = await localforage.getItem('queue');
            const remaining = currentQueue.filter(r => !syncedIds.includes(r.id));
            await localforage.setItem('queue', remaining);
            updateQueueUI();
        }
    } catch (finalErr) {
        console.error("Batch commit failed:", finalErr.message);
        if (!silent) alert("Database sync failed. Please try again.");
    }

    updateSyncStatusUI();
    if (btn) { btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Now'; btn.disabled = false; }

    if (!silent) {
        if (syncedIds.length === total && total > 0) alert(`🚀 SUCCESS! Synced all ${total} records in record time.`);
        else if (syncedIds.length > 0) alert(`⚠️ Partially synced ${syncedIds.length}/${total}.`);
        else alert('❌ Sync failed. Check internet connection.');
    }
}


