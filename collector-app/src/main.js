import './style.css';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import localforage from 'localforage';

// Firebase configuration (Placeholder from previous structure)
const firebaseConfig = {
    apiKey: "AIzaSyD0sDQNDfAH2AYrxJhwNa4r77uu98Gz4f8",
    authDomain: "hurungwe-gis-f8099.firebaseapp.com",
    projectId: "hurungwe-gis-f8099",
    storageBucket: "hurungwe-gis-f8099.firebasestorage.app",
    messagingSenderId: "315238946268",
    appId: "1:315238946268:web:9ca8edd76fff065001ab19",
    measurementId: "G-V7D6EK2VDM"
};
// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// App State
const state = {
    currentLat: null,
    currentLng: null,
    currentPhotoUrl: null,
    isOnline: true,
    currentUser: null
};

// Queue Setup
localforage.config({
    name: 'HurungweCollector',
    storeName: 'observations_queue'
});

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    setupAuth();
    setupNavigation();
    setupThemeToggle();
    await checkNetworkState();
    startGpsTracking();
    setupForm();
    setupCamera();
    updateQueueUI();
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
    auth.onAuthStateChanged(user => {
        if (user) {
            state.currentUser = user;
            emailDisplay.innerText = user.email;

            // Switch UI to logged-in state
            header.style.display = 'flex';
            nav.style.display = 'flex';
            pageLogin.classList.remove('active');
            pageCollect.classList.add('active'); // Default landing page
            pageSync.classList.remove('active');

            // Re-sync UI state for nav
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelector('.nav-item[data-target="page-collect"]').classList.add('active');

            if (state.isOnline) {
                processQueue();
            }
        } else {
            state.currentUser = null;

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
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        if (!email || !password) {
            errorMsg.innerText = "Please fill in an email and password to sign up.";
            errorMsg.style.display = 'block';
            return;
        }

        bSignup.disabled = true;
        bSignup.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';
        errorMsg.style.display = 'none';

        try {
            await auth.createUserWithEmailAndPassword(email, password);
            loginForm.reset();
            alert("Account successfully created and logged in!");
        } catch (error) {
            console.error("Sign up failed:", error);
            errorMsg.innerText = error.message;
            errorMsg.style.display = 'block';
        } finally {
            bSignup.disabled = false;
            bSignup.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
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

    Network.addListener('networkStatusChange', status => {
        state.isOnline = status.connected;
        updateNetworkUI();
        if (state.isOnline) {
            processQueue();
        }
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

// Native GPS
async function startGpsTracking() {
    try {
        const hasPermission = await Geolocation.checkPermissions();
        if (hasPermission.location !== 'granted') {
            await Geolocation.requestPermissions();
        }

        Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
            if (position) {
                state.currentLat = position.coords.latitude;
                state.currentLng = position.coords.longitude;
                document.getElementById('gps-coords').innerHTML = `
                    Lat: ${state.currentLat.toFixed(5)} <br>
                    Lng: ${state.currentLng.toFixed(5)} <br>
                    Acc: ±${Math.round(position.coords.accuracy)}m
                `;
                document.getElementById('gps-banner').style.background = 'rgba(82, 183, 136, 0.1)';
                document.getElementById('gps-banner').style.color = 'var(--premium-green)';
            }
        });
    } catch (e) {
        console.error("GPS Error:", e);
        document.getElementById('gps-coords').innerText = "GPS Access Denied";
    }
}

// Native Camera
function setupCamera() {
    const btnParam = document.getElementById('btn-camera');
    const preview = document.getElementById('photo-preview');

    btnParam.addEventListener('click', async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera
            });

            state.currentPhotoUrl = image.dataUrl;
            preview.src = image.dataUrl;
            preview.style.display = 'block';
            btnParam.innerHTML = '<i class="fas fa-check"></i> Photo Captured';
        } catch (e) {
            console.error("Camera error:", e);
        }
    });
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
            recorder: state.currentUser ? state.currentUser.email : 'Unknown Agent',
            lat: state.currentLat,
            lng: state.currentLng,
            photo: state.currentPhotoUrl, // Warning: Large data URL for MVP
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        // Save locally first
        await saveToQueue(data);

        // Reset Form
        e.target.reset();
        document.getElementById('photo-preview').style.display = 'none';
        document.getElementById('btn-camera').innerHTML = '<i class="fas fa-camera"></i> Take Photo';
        state.currentPhotoUrl = null;

        alert("Observation Saved!");

        // Try sync
        if (state.isOnline) {
            processQueue();
        }
    });

    document.getElementById('btn-force-sync').addEventListener('click', () => {
        if (!state.isOnline) {
            alert("You are currently offline. Please connect to a network.");
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
}

async function updateQueueUI() {
    let queue = (await localforage.getItem('queue')) || [];
    const list = document.getElementById('pending-list');
    document.getElementById('queue-count').innerText = queue.length;

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

async function processQueue() {
    if (!state.isOnline) return;

    let queue = (await localforage.getItem('queue')) || [];
    if (queue.length === 0) return;

    const btn = document.getElementById('btn-force-sync');
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Syncing...';
    btn.disabled = true;

    try {
        const batch = db.batch();
        const syncedIds = [];

        queue.forEach(record => {
            const docRef = db.collection('observations').doc(record.id);
            const { id, status, ...dbData } = record;
            batch.set(docRef, dbData);
            syncedIds.push(record.id);
        });

        await batch.commit();

        // Clear synced items
        queue = queue.filter(r => !syncedIds.includes(r.id));
        await localforage.setItem('queue', queue);
        updateQueueUI();
        alert(`Successfully synced ${syncedIds.length} records!`);

    } catch (e) {
        console.error("Sync failed:", e);
        alert("Sync failed. Are your Firebase credentials correct?");
    } finally {
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Now';
        btn.disabled = false;
    }
}
