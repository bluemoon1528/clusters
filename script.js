// --- Firebase Firestore Real-Time Sync ---
let firebaseApp = null;
let firestore = null;
let auth = null;
let firestoreUnsubscribe = null;
let firestoreSyncEnabled = false;

function openFirebaseModal() {
    document.getElementById('firebaseModal').style.display = 'block';
    // Show config if present
    const fbConfig = localStorage.getItem('firebaseConfig');
    if (fbConfig) {
        try {
            const parsed = JSON.parse(fbConfig);
            document.getElementById('firebaseConfigInput').value = JSON.stringify(parsed, null, 2);
            document.getElementById('firebaseStatus').textContent = 'Firebase config loaded (not connected)';
        } catch (err) {
            document.getElementById('firebaseStatus').textContent = 'Invalid config in storage.';
        }
    } else {
        document.getElementById('firebaseConfigInput').value = '';
        document.getElementById('firebaseStatus').textContent = '';
    }
}

function closeFirebaseModal() {
    document.getElementById('firebaseModal').style.display = 'none';
}

function saveFirebaseConfigFromInput() {
    const raw = document.getElementById('firebaseConfigInput').value;
    if (!raw) return alert('Please paste your Firebase config JSON');
    try {
        const parsed = JSON.parse(raw);
        localStorage.setItem('firebaseConfig', JSON.stringify(parsed));
        document.getElementById('firebaseStatus').textContent = 'Firebase config saved. Click Enable Sync to connect.';
    } catch (err) {
        alert('Invalid JSON: ' + err.message);
    }
}

function initFirebaseIfConfigured() {
    if (firebaseApp || typeof firebase === 'undefined') return false;
    const cfgRaw = localStorage.getItem('firebaseConfig');
    let cfg;
    if (cfgRaw) {
        try {
            cfg = JSON.parse(cfgRaw);
        } catch (err) {
            console.error('Invalid Firebase config in localStorage', err);
            // Fallback to default if stored config is invalid
            cfg = {
              "apiKey": "AIzaSyBJ3j0XvrpzYco3S5GxkK4Bay_InBz6iGk",
              "authDomain": "cluster-50427.firebaseapp.com",
              "projectId": "cluster-50427",
              "storageBucket": "cluster-50427.firebasestorage.app",
              "messagingSenderId": "82598015398",
              "appId": "1:82598015398:web:538499cf491d4ab5445f67",
              "measurementId": "G-EPMFPJQNGZ"
            };
        }
    } else {
        // Use the provided config as default if nothing in localStorage
        cfg = {
          "apiKey": "AIzaSyBJ3j0XvrpzYco3S5GxkK4Bay_InBz6iGk",
          "authDomain": "cluster-50427.firebaseapp.com",
          "projectId": "cluster-50427",
          "storageBucket": "cluster-50427.firebasestorage.app",
          "messagingSenderId": "82598015398",
          "appId": "1:82598015398:web:538499cf491d4ab5445f67",
          "measurementId": "G-EPMFPJQNGZ"
        };
    }

    if (!cfg || !cfg.apiKey) return false; // Ensure a config object exists and has an API key

    try {
        firebaseApp = firebase.initializeApp(cfg);
        firestore = firebase.firestore(firebaseApp);
        auth = firebase.auth(firebaseApp);
        console.log("Firebase App initialized:", firebaseApp);
        console.log("Firestore initialized:", firestore);
        console.log("Firebase Auth initialized:", auth);
        return true;
    } catch (err) {
        console.error('Failed to initialize Firebase', err);
        return false;
    }
}

function enableFirestoreSync() {
    if (!firebaseApp || !firestore) return alert('Firebase not configured. Paste config in Firebase Settings.');
    if (firestoreSyncEnabled) return alert('Firestore sync already enabled.');
    firestoreUnsubscribe = firestore.collection('bookings').onSnapshot(snapshot => {
        const cloud = [];
        snapshot.forEach(doc => cloud.push(doc.data()));
        mergeBookingsFromCloud(cloud);
    }, err => {
        console.error('Firestore listener error', err);
    });
    firestoreSyncEnabled = true;
    document.getElementById('firebaseStatus').textContent = 'Firestore sync enabled';
    alert('Firestore sync enabled. Bookings will be merged from cloud in real-time.');
}

function disableFirestoreSync() {
    if (firestoreUnsubscribe) {
        try { firestoreUnsubscribe(); } catch (e) { console.warn(e); }
        firestoreUnsubscribe = null;
    }
    firestoreSyncEnabled = false;
    document.getElementById('firebaseStatus').textContent = 'Firestore sync disabled';
    alert('Firestore sync disabled.');
}

async function pushBookingsToFirestore() {
    if (!initFirebaseIfConfigured()) return alert('Firebase not configured.');
    if (!bookings || bookings.length === 0) return alert('No local bookings to push.');
    if (!confirm(`Push ${bookings.length} local bookings to Firestore? This will create/update documents by booking id.`)) return;
    console.log('Attempting to push local bookings to Firestore:', bookings);
    try {
        const batch = firestore.batch();
        bookings.forEach(b => {
            const ref = firestore.collection('bookings').doc(b.id);
            batch.set(ref, b);
        });
        await batch.commit();
        console.log('Successfully pushed local bookings to Firestore.');
        alert('Pushed local bookings to Firestore.');
    } catch (err) {
        console.error('Failed to push bookings', err);
        alert('Failed to push bookings. See console for details.');
    }
}

async function pullBookingsFromFirestore() {
    if (!initFirebaseIfConfigured()) return alert('Firebase not configured.');
    try {
        const snapshot = await firestore.collection('bookings').get();
        const cloud = [];
        snapshot.forEach(doc => cloud.push(doc.data()));
        mergeBookingsFromCloud(cloud, true);
        alert(`Pulled ${cloud.length} bookings from Firestore and merged locally.`);
    } catch (err) {
        console.error('Failed to pull bookings', err);
        alert('Failed to pull bookings. See console for details.');
    }
}

function updateTicketSalesDisplay() {
    let totalSold = 0;
    if (bookings && bookings.length > 0) {
        bookings.forEach(b => {
            totalSold += (b.tickets || 0);
        });
    }
    document.getElementById('totalTicketsSold').textContent = totalSold;
}

function mergeBookingsFromCloud(cloudBookings, overwrite = false) {
    console.time('mergeBookingsFromCloud');
    let added = 0, updated = 0;
    cloudBookings.forEach(cb => {
        const idx = bookings.findIndex(b => b.id === cb.id);
        if (idx === -1) {
            bookings.push(cb);
            added++;
        } else if (overwrite) {
            bookings[idx] = cb;
            updated++;
        }
    });
    if (added || updated) {
        console.time('mergeBookingsFromCloud_localStorageSetItem');
        localStorage.setItem('bookings', JSON.stringify(bookings));
        console.timeEnd('mergeBookingsFromCloud_localStorageSetItem');
        console.time('mergeBookingsFromCloud_loadBookingsTable');
        loadBookingsTable && loadBookingsTable();
        console.timeEnd('mergeBookingsFromCloud_loadBookingsTable');
        updateAdminStats && updateAdminStats();
    }
    updateTicketSalesDisplay(); // Update the ticket sales display
    console.timeEnd('mergeBookingsFromCloud');
}

// Add event listener for Firebase Settings button after DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    const openFirebaseBtn = document.getElementById('openFirebaseBtn');
    if (openFirebaseBtn) {
        openFirebaseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openFirebaseModal();
        });
    }
});
// Load movies from localStorage or use default
let movies = []; // Movies will now be synced from Firestore

// Save movies to localStorage - No longer needed, as movies will be synced with Firestore
// function saveMovies() {
//     localStorage.setItem('movies', JSON.stringify(movies));
//     // Update phone display if movies exist
//     if (movies.length > 0) {
//         updateTheatrePhone();
//     }
// }

// Storage for bookings
let bookings = JSON.parse(localStorage.getItem('bookings')) || [];
let currentBookingType = '';
let currentBooking = null;
// Currently logged-in admin (set after successful admin login)
let currentAdmin = null;
// Admin users stored in localStorage. Default admin kept for compatibility.
let adminUsers = []; // Will now be managed by Firebase Auth

// Default theatre QR and state
const DEFAULT_QR = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=GPay:6382881324';
let theatreQR = localStorage.getItem('theatreQR') || DEFAULT_QR;
let manageQRPending = null; // for admin file uploads before saving



// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.time('DOMContentLoaded_total');
    // Save movies if not in localStorage
    // The movies array will now be populated by Firestore listener
    
    console.time('DOMContentLoaded_setupEventListeners');
    setupEventListeners();
    console.timeEnd('DOMContentLoaded_setupEventListeners');
    
    // Attempt to initialize Firebase and set up real-time syncs if config exists
    console.time('DOMContentLoaded_firebaseInitAndSync');
    if (initFirebaseIfConfigured()) {
        enableFirestoreSync();
        // Set up real-time listener for movies collection
        if (firestore) {
            firestore.collection('movies').orderBy('name').onSnapshot(snapshot => {
                movies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('Movies updated from Firestore:', movies);
                loadMovies();
                loadAdminMovies();
                updateTheatrePhone();
            }, err => {
                console.error('Firestore movies listener error', err);
            });
        }
    }
    console.timeEnd('DOMContentLoaded_firebaseInitAndSync');
    
    // Poster preview on file input
    const posterFileInput = document.getElementById('addMoviePosterFile');
    if (posterFileInput) {
        posterFileInput.addEventListener('change', updatePosterPreview);
    }

    // Apply theatre QR to booking modal QR img
    const bookingQRImg = document.getElementById('bookingModalQRImg');
    if (bookingQRImg) bookingQRImg.src = theatreQR;

    // Manage QR file input (admin modal)
    const manageQRFile = document.getElementById('manageQRFile');
    if (manageQRFile) manageQRFile.addEventListener('change', handleManageQRFile);
    // Restore current admin session if present
    const storedAdmin = localStorage.getItem('currentAdmin');
    if (storedAdmin) {
        try {
            currentAdmin = JSON.parse(storedAdmin);
        } catch (err) {
            console.warn('Failed to parse stored currentAdmin', err);
            currentAdmin = null;
        }
    }
    // Ensure 'guhan' exists and is a super admin (safety in case localStorage was modified)
    try {
        // This section for default admin 'guhan' will be removed or changed as Firebase Auth is used
        // For now, it remains for legacy fallback, but won't create auth users automatically.
        const guhanUser = adminUsers.find(u => u.username === 'guhan');
        if (!guhanUser) {
            // adminUsers.unshift({ username: 'guhan', password: '143', isSuper: true });
            // saveAdminUsers(); // No longer needed for Firebase Auth
            console.log('Default admin setup (guhan) skipped for Firebase Auth.');
        } else if (!guhanUser.isSuper) {
            // guhanUser.isSuper = true;
            // saveAdminUsers(); // No longer needed for Firebase Auth
            console.log('Default admin (guhan) role update skipped for Firebase Auth.');
        }
    } catch (err) {
        console.warn('Error ensuring guhan super admin (legacy)', err);
    }
    // Render current admin display if already logged in
    renderCurrentAdmin();
    // Ensure Manage QR button visibility is correct on load
    updateManageQRButton();
    console.timeEnd('DOMContentLoaded_total');
});

// Load movies - now purely renders from the `movies` array populated by Firestore
function loadMovies() {
    const moviesGrid = document.getElementById('moviesGrid');
    moviesGrid.innerHTML = '';
    
    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.innerHTML = `
            <img src="${movie.poster}" alt="${movie.name}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.name}</h3>
                <p><i class="fas fa-calendar"></i> ${movie.date}</p>
                <p><i class="fas fa-clock"></i> ${movie.time}</p>
            </div>
        `;
        movieCard.addEventListener('click', () => selectMovie(movie));
        moviesGrid.appendChild(movieCard);
    });
}

// Select movie
function selectMovie(movie) {
    console.log('selectMovie called with movie:', movie);
    if (!movie || !movie.id) {
        console.error('Invalid movie object passed to selectMovie:', movie);
        alert('Could not select movie. Please try again.');
        return;
    }
    const movieSelect = document.getElementById('movieSelect');
    if (movieSelect) {
        movieSelect.value = movie.id;
        console.log('Set movieSelect value to:', movie.id);
    } else {
        console.error('movieSelect element not found.');
    }
    openBookingModal(currentBookingType || 'film-club');
}

// Setup event listeners
function setupEventListeners() {
    // Admin link
    document.getElementById('adminLink').addEventListener('click', (e) => {
        e.preventDefault();
        openAdminLogin();
    });
    
    // Booking form
    document.getElementById('bookingForm').addEventListener('submit', handleBooking);
    
    // Admin login form
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    // Admin users form (add new admin)
    const adminUserForm = document.getElementById('adminUserForm');
    if (adminUserForm) {
        adminUserForm.addEventListener('submit', handleAddAdminUser);
    }
    
    // Calculate price on change
    document.getElementById('ticketCount').addEventListener('input', calculatePrice);
    document.getElementById('showType').addEventListener('change', calculatePrice);
    document.getElementById('movieSelect').addEventListener('change', updateDateTimeFromMovieSelection);
    
    // Update phone number
    updateTheatrePhone();
}

// Update theatre phone
function updateTheatrePhone() {
    const phoneElement = document.getElementById('theatrePhone');
    if (phoneElement) {
        // Ensure movies array has data before trying to access it
        phoneElement.textContent = movies.length > 0 ? movies[0].phone : '+91 6382881324';
    }
}

// Open booking modal
function openBookingModal(type) {
    console.log('openBookingModal called with type:', type);
    currentBookingType = type;
    const modal = document.getElementById('bookingModal');
    const showTypeInput = document.getElementById('showType');
    const movieSelect = document.getElementById('movieSelect');
    
    // Populate movie select
    movieSelect.innerHTML = '<option value="">Select a movie</option>';
    if (movies.length === 0) {
        console.warn('No movies available to populate movieSelect dropdown.');
        movieSelect.innerHTML += '<option value="" disabled>No movies available</option>';
    } else {
        movies.forEach(movie => {
            const option = document.createElement('option');
            option.value = movie.id;
            option.textContent = movie.name;
            movieSelect.appendChild(option);
        });
        console.log('movieSelect populated with movies:', movies.map(m => m.name));
    }
    
    // Set show type
    if (type === 'film-club') {
        showTypeInput.value = 'Film Club Show';
    } else {
        showTypeInput.value = 'Cluster Preview Movie';
    }
    
    modal.style.display = 'block';
    // Automatically set date and time if a movie is pre-selected
    updateDateTimeFromMovieSelection();
    calculatePrice();
}

// Close booking modal
function closeBookingModal() {
    document.getElementById('bookingModal').style.display = 'none';
    document.getElementById('bookingForm').reset();
}

// Update date and time in the booking modal based on selected movie
function updateDateTimeFromMovieSelection() {
    const movieSelect = document.getElementById('movieSelect');
    const showDateInput = document.getElementById('showDate');
    const showTimeInput = document.getElementById('showTime');
    
    const selectedMovieId = movieSelect.value;
    const selectedMovie = movies.find(m => m.id === selectedMovieId);

    if (selectedMovie) {
        showDateInput.value = selectedMovie.date;
        showTimeInput.value = selectedMovie.time;
    } else {
        showDateInput.value = '';
        showTimeInput.value = '';
    }
}

// Calculate price
function calculatePrice() {
    const showType = document.getElementById('showType').value;
    const ticketCount = parseInt(document.getElementById('ticketCount').value) || 0;
    
    let basePrice = 0;
    let gst = 0;
    let total = 0;
    
    if (showType === 'Film Club Show') {
        basePrice = 150 * ticketCount;
        total = basePrice;
        document.getElementById('gstRow').style.display = 'none';
    } else if (showType === 'Cluster Preview Movie') {
        basePrice = 4000;
        gst = basePrice * 0.18;
        total = basePrice + gst;
        document.getElementById('gstRow').style.display = 'flex';
    }
    
    document.getElementById('basePrice').textContent = `₹${basePrice.toLocaleString()}`;
    document.getElementById('gstAmount').textContent = `₹${gst.toLocaleString()}`;
    document.getElementById('totalPrice').textContent = `₹${total.toLocaleString()}`;
}

// Handle booking
async function handleBooking(e) {
    e.preventDefault();
    
    const movieId = document.getElementById('movieSelect').value; // Removed parseInt()
    const movie = movies.find(m => m.id === movieId);
    
    if (!movie) {
        alert('Please select a movie');
        return;
    }
    
    // Ensure we read the show type from the form into a local variable
    const showType = document.getElementById('showType').value;

    const booking = {
        id: generateTicketId(),
        movieId: movieId,
        movieName: movie.name,
        moviePoster: movie.poster,
        showType: showType,
        date: document.getElementById('showDate').value,
        time: document.getElementById('showTime').value,
        ticketCount: parseInt(document.getElementById('ticketCount').value),
        customerName: document.getElementById('customerName').value,
        customerPhone: document.getElementById('customerPhone').value,
        customerEmail: document.getElementById('customerEmail').value,
        basePrice: showType === 'Film Club Show' ? 150 * parseInt(document.getElementById('ticketCount').value) : 4000,
        gst: showType === 'Cluster Preview Movie' ? 4000 * 0.18 : 0,
        // Remove all commas when parsing total price
        total: parseFloat(document.getElementById('totalPrice').textContent.replace('₹', '').replace(/,/g, '')),
        bookingDate: new Date().toISOString()
    };
    
    bookings.push(booking);
    localStorage.setItem('bookings', JSON.stringify(bookings));
    
    // Attempt to save to Firestore immediately
    if (firebaseApp && firestore) {
        try {
            console.log('Attempting to save new booking to Firestore:', booking);
            await firestore.collection('bookings').doc(booking.id).set(booking);
            console.log('New booking successfully saved to Firestore.');
        } catch (error) {
            console.error('Error saving new booking to Firestore:', error);
            alert('Failed to save booking to cloud. Please check console for details and ensure Firestore rules allow writes.');
        }
    } else {
        console.warn('Firebase not configured, booking only saved locally.');
    }
    
    currentBooking = booking;
    closeBookingModal();
    showTicket(booking);
    updateAdminStats();
}

// Generate ticket ID
function generateTicketId() {
    return 'TKT' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Show ticket
function showTicket(booking) {
    const modal = document.getElementById('ticketModal');
    const ticketContent = document.getElementById('ticketContent');
    
    // Create image with proper attributes for printing
    const img = document.createElement('img');
    img.src = booking.moviePoster;
    img.alt = booking.movieName;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    img.crossOrigin = 'anonymous'; // Help with CORS if needed
    img.onerror = function() {
        this.src = 'https://via.placeholder.com/120x180?text=No+Image';
    };
    
    // Preload image to ensure it's ready for printing
    const posterContainer = document.getElementById('ticketPoster');
    posterContainer.innerHTML = '';
    posterContainer.appendChild(img);
    
    document.getElementById('ticketMovieName').textContent = booking.movieName;
    document.getElementById('ticketShowType').textContent = booking.showType;
    document.getElementById('ticketDate').textContent = booking.date;
    document.getElementById('ticketTime').textContent = booking.time;
    document.getElementById('ticketName').textContent = booking.customerName;
    document.getElementById('ticketPhone').textContent = booking.customerPhone;
    // Write ticket count into the display span (avoid clashing with input id)
    const ticketCountDisplay = document.getElementById('ticketCountDisplay');
    if (ticketCountDisplay) {
        ticketCountDisplay.textContent = booking.ticketCount;
    }
    document.getElementById('ticketAmount').textContent = `₹${booking.total.toLocaleString()}`;
    document.getElementById('ticketId').textContent = booking.id;
    // Show appropriate QR on the ticket: if booking has its own approved QR, use it; otherwise use theatreQR
    const ticketQR = document.getElementById('ticketQR');
    if (ticketQR) {
        const useQR = booking && booking.qr && booking.approved ? booking.qr : theatreQR;
        ticketQR.innerHTML = `<img src="${useQR}" alt="Payment QR" style="width:120px;height:120px;object-fit:contain;border:1px solid #ddd;padding:4px;">`;
    }
    
    modal.style.display = 'block';
    
    // Ensure image is loaded before allowing print
    if (!img.complete) {
        img.onload = function() {
            console.log('Ticket poster image loaded successfully');
        };
    }
}

// Close ticket modal
function closeTicketModal() {
    document.getElementById('ticketModal').style.display = 'none';
}

// Print ticket
function printTicket() {
    const ticketContent = document.getElementById('ticketContent');
    if (!ticketContent) {
        alert('Ticket not found');
        return;
    }
    
    // Find all images in the ticket
    const images = ticketContent.querySelectorAll('img');
    const imagePromises = [];
    
    // Wait for all images to load
    images.forEach(img => {
        if (!img.complete) {
            const promise = new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if image fails
                // Timeout after 3 seconds
                setTimeout(resolve, 3000);
            });
            imagePromises.push(promise);
        }
    });
    
    // Wait for images to load, then print
    if (imagePromises.length > 0) {
        const printButton = document.querySelector('.btn-print');
        const originalText = printButton.innerHTML;
        printButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Images...';
        printButton.disabled = true;
        
        Promise.all(imagePromises).then(() => {
            // Small delay to ensure images are rendered
            setTimeout(() => {
                window.print();
                printButton.innerHTML = originalText;
                printButton.disabled = false;
            }, 500);
        });
    } else {
        // Images already loaded, print immediately
        window.print();
    }
}

// Download ticket as JPG using html2canvas
function downloadTicketJPG() {
    const el = document.getElementById('ticketContent');
    if (!el) return alert('Ticket not available');

    if (typeof html2canvas === 'undefined') {
        alert('html2canvas is not loaded. Cannot export ticket as image.');
        return;
    }

    const downloadBtn = document.querySelector('.btn-download');
    const originalText = downloadBtn ? downloadBtn.innerHTML : null;
    if (downloadBtn) {
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
        downloadBtn.disabled = true;
    }

    // Use a higher scale for better quality
    html2canvas(el, { useCORS: true, scale: 2 }).then(canvas => {
        try {
            const dataURL = canvas.toDataURL('image/jpeg', 0.92);
            const a = document.createElement('a');
            // Use currentBooking.id if available, otherwise fallback to timestamp
            const idEl = document.getElementById('ticketId');
            const id = (currentBooking && currentBooking.id) || (idEl && idEl.textContent) || Date.now();
            a.href = dataURL;
            a.download = `ticket-${id}.jpg`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error('Failed to generate JPG:', err);
            alert('Failed to generate JPG. See console for details.');
        } finally {
            if (downloadBtn) {
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            }
        }
    }).catch(err => {
        console.error('html2canvas error:', err);
        alert('Failed to render ticket image. See console for details.');
        if (downloadBtn) {
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }
    });
}





// Scroll to shows
function scrollToShows() {
    document.getElementById('shows').scrollIntoView({ behavior: 'smooth' });
}

// Admin functions
function openAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'block';
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'none';
    document.getElementById('adminLoginForm').reset();
}

// Open Manage Payment QR modal (admin only)
function openManageQRModal() {
    console.log('openManageQRModal() currentAdmin=', currentAdmin, 'adminUsers=', adminUsers);
    // if currentAdmin is not set in-memory, attempt to restore from localStorage
    if (!currentAdmin) {
        try {
            const stored = localStorage.getItem('currentAdmin');
            if (stored) currentAdmin = JSON.parse(stored);
            console.log('Restored currentAdmin from storage:', currentAdmin);
        } catch (err) {
            console.warn('Failed to restore currentAdmin from storage', err);
        }
    }
    if (!currentAdmin || !currentAdmin.isSuper) {
        // show clearer inline message and log for diagnostics
        const errorEl = document.getElementById('manageQRError');
        if (errorEl) errorEl.textContent = 'Only super admin users can manage the payment QR. Please login as super admin.';
        alert('Only super admin users can manage the payment QR.');
        return;
    }
    const modal = document.getElementById('manageQRModal');
    if (!modal) return alert('Manage QR modal not found');
    // reset inputs
    const urlInput = document.getElementById('manageQRUrl');
    const preview = document.getElementById('manageQRPreview');
    const fileInput = document.getElementById('manageQRFile');
    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';
    manageQRPending = null;
    if (preview) preview.innerHTML = `<img src="${theatreQR}" alt="Current QR" style="width:140px;height:140px;object-fit:contain;border:1px solid #ddd;padding:4px;">`;
    // show the currently logged-in admin inside the modal
    const mcur = document.getElementById('manageQRCurrentAdmin');
    if (mcur) mcur.textContent = `Logged in as: ${currentAdmin.username}${currentAdmin.isSuper ? ' (Super Admin)' : ''}`;
    modal.style.display = 'block';
}

// Update the admin header with current admin info (username/role)
function renderCurrentAdmin() {
    const el = document.getElementById('currentAdminDisplay');
    if (!el) return;
    if (currentAdmin) {
        el.textContent = `${currentAdmin.username}${currentAdmin.isSuper ? ' (Super Admin)' : ''}`;
        // if logged in, hide the force-login button
        const forceBtn = document.getElementById('forceLoginBtn');
        if (forceBtn) forceBtn.style.display = 'none';
    } else {
        el.textContent = '';
        // if not logged in, show the force-login button to help testing
        const forceBtn = document.getElementById('forceLoginBtn');
        if (forceBtn) forceBtn.style.display = 'inline-block';
    }
}

// Force login helper for testing — sets guhan as current admin and persists session
function forceLoginGuhan() {
    currentAdmin = { username: 'guhan', isSuper: true };
    try { localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin)); } catch (err) { console.warn('Failed to persist currentAdmin', err); }
    renderCurrentAdmin();
    updateManageQRButton();
    showAdminDashboard();
    console.log('Forced login as guhan (super admin) for testing');
}

// Show/hide Manage QR button based on currentAdmin role
function updateManageQRButton() {
    const btn = document.getElementById('manageQRBtn');
    if (!btn) return;
    if (currentAdmin && currentAdmin.isSuper) {
        btn.style.display = 'inline-block';
    } else {
        btn.style.display = 'none';
    }
}

function closeManageQRModal() {
    const modal = document.getElementById('manageQRModal');
    if (!modal) return;
    modal.style.display = 'none';
    manageQRPending = null;
    const preview = document.getElementById('manageQRPreview');
    if (preview) preview.innerHTML = '';
}

function handleManageQRFile(e) {
    const file = e.target.files && e.target.files[0];
    const preview = document.getElementById('manageQRPreview');
    const errorEl = document.getElementById('manageQRError');
    if (!file) {
        manageQRPending = null;
        if (preview) preview.innerHTML = '';
        if (errorEl) errorEl.textContent = '';
        return;
    }
    // Only accept JPG/JPEG images and check file size (200 KB max)
    const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name);
    const maxSize = 200 * 1024; // 200 KB
    if (!isJpg) {
        const msg = 'Only JPG/JPEG images are allowed. Please choose a .jpg or .jpeg file.';
        console.warn(msg, file.type, file.name);
        e.target.value = '';
        manageQRPending = null;
        if (preview) preview.innerHTML = '';
        if (errorEl) errorEl.textContent = msg;
        return;
    }
    if (file.size > maxSize) {
        const msg = `File is too large (${Math.round(file.size/1024)}KB). Max allowed size is ${Math.round(maxSize/1024)}KB.`;
        console.warn(msg);
        e.target.value = '';
        manageQRPending = null;
        if (preview) preview.innerHTML = '';
        if (errorEl) errorEl.textContent = msg;
        return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
        manageQRPending = evt.target.result; // data URL
        if (preview) preview.innerHTML = `<img src="${manageQRPending}" alt="QR Preview" style="width:140px;height:140px;object-fit:contain;border:1px solid #ddd;padding:4px;">`;
        if (errorEl) errorEl.textContent = '';
        console.log('Manage QR file loaded, size:', manageQRPending.length);
    };
    reader.readAsDataURL(file);
}

// Save theatre QR (from file upload or URL). Restricted to super admin in UI.
function saveTheatreQR() {
    console.log('saveTheatreQR() called. currentAdmin=', currentAdmin, 'manageQRPending=', !!manageQRPending);
    // Attempt to restore session from storage if currentAdmin is null
    if (!currentAdmin) {
        try {
            const stored = localStorage.getItem('currentAdmin');
            if (stored) {
                currentAdmin = JSON.parse(stored);
                console.log('Restored currentAdmin in saveTheatreQR:', currentAdmin);
            }
        } catch (err) {
            console.warn('Failed to restore currentAdmin in saveTheatreQR', err);
        }
    }
    const errorEl = document.getElementById('manageQRError');
    if (!currentAdmin || !currentAdmin.isSuper) {
        // If we don't have an in-memory session, allow a one-time password confirmation for super admin
        const guhan = adminUsers.find(u => u.username === 'guhan');
        if (guhan) {
            const pw = prompt('Enter super admin (guhan) password to confirm change:');
            if (pw === null) {
                if (errorEl) errorEl.textContent = 'Operation cancelled';
                alert('Operation cancelled');
                return;
            }
            if (pw === guhan.password) {
                // grant temporary session and persist it
                currentAdmin = { username: guhan.username, isSuper: true };
                try { localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin)); } catch (err) { console.warn('Failed to persist currentAdmin', err); }
                renderCurrentAdmin();
                updateManageQRButton();
                console.log('One-time super admin confirmation succeeded; proceeding with save.');
            } else {
                const msg = 'Incorrect super admin password. Only super admin users can change the payment QR.';
                if (errorEl) errorEl.textContent = msg;
                console.warn('saveTheatreQR blocked: incorrect super admin password');
                alert(msg);
                return;
            }
        } else {
            const msg = 'Only super admin users can change the payment QR.';
            if (errorEl) errorEl.textContent = msg;
            console.warn('saveTheatreQR blocked: not super admin', { currentAdmin, adminUsers });
            alert(msg);
            return;
        }
    }
    // Enforce manual JPG upload only
    if (!manageQRPending) {
        const msg = 'Please upload a JPG image for the payment QR before saving.';
        if (errorEl) errorEl.textContent = msg;
        alert(msg);
        console.warn('saveTheatreQR aborted: no manageQRPending');
        return;
    }
    const newQR = manageQRPending;
    theatreQR = newQR;
    localStorage.setItem('theatreQR', theatreQR);
    // Update booking modal QR image
    const bookingQRImg = document.getElementById('bookingModalQRImg');
    if (bookingQRImg) bookingQRImg.src = theatreQR;
    closeManageQRModal();
    alert('Theatre payment QR updated successfully.');
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminUsername').value; // Use email for Firebase Auth
    const password = document.getElementById('adminPassword').value;

    if (!auth) {
        alert('Firebase Auth not initialized. Please ensure Firebase config is saved and page reloaded.');
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('Firebase user logged in:', user);

        // Fetch admin roles from Firestore using UID
        const adminRoleDoc = await firestore.collection('admin-roles').doc(user.uid).get();
        let isAdmin = false;
        let isSuper = false;

        if (adminRoleDoc.exists) {
            const roleData = adminRoleDoc.data();
            isAdmin = true;
            isSuper = roleData.isSuper || false;
        } else {
            // If no role doc, default to not admin or super. For initial setup, we might auto-grant
            // For simplicity, let's assume a user must have an entry in 'admin-roles' to be considered admin
            alert('No admin role found for this user. Please ensure an admin role is set in Firestore.');
            await auth.signOut(); // Sign out user if no role found
            return;
        }

        currentAdmin = { uid: user.uid, email: user.email, isSuper: isSuper };
        localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
        
        closeAdminLogin();
        renderCurrentAdmin();
        updateManageQRButton();
        showAdminDashboard();
        alert(`Logged in as admin: ${user.email}${isSuper ? ' (Super Admin)' : ''}`);

    } catch (error) {
        console.error('Firebase Admin Login Error:', error);
        let errorMessage = 'Invalid username or password.';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with that email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email format.';
        }
        alert(errorMessage);
    }
}

function showAdminDashboard() {
    document.getElementById('adminDashboard').style.display = 'block';
    loadBookingsTable();
    updateAdminStats();
    // Ensure admin users list is rendered
    renderAdminUsers();
}

function logoutAdmin() {
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLoginForm').reset();
    currentAdmin = null;
    // remove persisted session
    try {
        localStorage.removeItem('currentAdmin');
        if (auth) {
            auth.signOut();
            console.log('Firebase user signed out.');
        }
    } catch (err) {
        console.warn('Failed to remove currentAdmin from storage or sign out Firebase', err);
    }
    renderCurrentAdmin();
    updateManageQRButton();
}

function updateAdminStats() {
    const totalBookings = bookings.length;
    const filmClubBookings = bookings.filter(b => b.showType === 'Film Club Show').length;
    const clusterBookings = bookings.filter(b => b.showType === 'Cluster Preview Movie').length;
    const totalRevenue = bookings.reduce((sum, b) => sum + b.total, 0);
    
    document.getElementById('totalBookings').textContent = totalBookings;
    document.getElementById('filmClubBookings').textContent = filmClubBookings;
    document.getElementById('clusterBookings').textContent = clusterBookings;
    document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toLocaleString()}`;
}

function loadBookingsTable() {
    console.time('loadBookingsTable');
    const tbody = document.getElementById('bookingsTableBody');
    tbody.innerHTML = '';
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        // Build base columns
        row.innerHTML = `
            <td>${booking.id}</td>
            <td>${booking.movieName}</td>
            <td>${booking.showType}</td>
            <td>${booking.date}</td>
            <td>${booking.time}</td>
            <td>${booking.customerName}</td>
            <td>${booking.customerPhone}</td>
            <td>${booking.ticketCount}</td>
            <td>₹${booking.total.toLocaleString()}</td>
        `;

        // If current admin is super, add an actions cell with a delete button
        if (currentAdmin && currentAdmin.isSuper) {
            const actionsCell = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete';
            delBtn.textContent = 'Delete';
            delBtn.style.padding = '6px 10px';
            delBtn.onclick = function() { deleteBooking(booking.id); };
            actionsCell.appendChild(delBtn);
            row.appendChild(actionsCell);
        }

        tbody.appendChild(row);
    });
    console.timeEnd('loadBookingsTable');
}

// Delete a single booking (super admin only)
function deleteBooking(bookingId) {
    if (!currentAdmin || !currentAdmin.isSuper) {
        alert('Only super admin users can delete bookings.');
        return;
    }

    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) {
        alert('Booking not found');
        return;
    }

    if (!confirm(`Delete booking ${bookingId}? This cannot be undone.`)) return;

    bookings.splice(idx, 1);
    localStorage.setItem('bookings', JSON.stringify(bookings));
    loadBookingsTable();
    updateAdminStats();
    alert(`Booking ${bookingId} deleted.`);
}

function generateStatement() {
    const statement = {
        generatedDate: new Date().toISOString(),
        totalBookings: bookings.length,
        filmClubBookings: bookings.filter(b => b.showType === 'Film Club Show').length,
        clusterBookings: bookings.filter(b => b.showType === 'Cluster Preview Movie').length,
        totalRevenue: bookings.reduce((sum, b) => sum + b.total, 0),
        bookings: bookings
    };
    
    return statement;
}

function downloadStatement() {
    const statement = generateStatement();
    const dataStr = JSON.stringify(statement, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theatre-statement-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function printStatement() {
    const statement = generateStatement();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Theatre Statement</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #e50914; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #e50914; color: white; }
                </style>
            </head>
            <body>
                <h1>Clusters Theatre - Booking Statement</h1>
                <p><strong>Generated:</strong> ${new Date(statement.generatedDate).toLocaleString()}</p>
                <p><strong>Total Bookings:</strong> ${statement.totalBookings}</p>
                <p><strong>Film Club Shows:</strong> ${statement.filmClubBookings}</p>
                <p><strong>Cluster Preview:</strong> ${statement.clusterBookings}</p>
                <p><strong>Total Revenue:</strong> ₹${statement.totalRevenue.toLocaleString()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Ticket ID</th>
                            <th>Movie</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Tickets</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statement.bookings.map(b => `
                            <tr>
                                <td>${b.id}</td>
                                <td>${b.movieName}</td>
                                <td>${b.showType}</td>
                                <td>${b.date}</td>
                                <td>${b.time}</td>
                                <td>${b.customerName}</td>
                                <td>${b.customerPhone}</td>
                                <td>${b.ticketCount}</td>
                                <td>₹${b.total.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Clear all bookings
function clearAllBookings() {
    // Only allow super admin to clear all bookings
    if (!currentAdmin || !currentAdmin.isSuper) {
        alert('Only super admin users can clear all bookings.');
        return;
    }

    const totalBookings = bookings.length;
    
    if (totalBookings === 0) {
        alert('No bookings to clear.');
        return;
    }
    
    // Double confirmation for safety
    const confirmMessage = `⚠️ WARNING: This will delete ALL ${totalBookings} booking(s)!\n\nThis action cannot be undone.\n\nAre you sure you want to continue?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Second confirmation
    const secondConfirm = confirm(`Final confirmation: Delete all ${totalBookings} booking(s)?\n\nType "YES" in the next prompt to confirm.`);
    
    if (!secondConfirm) {
        return;
    }
    
    // Third confirmation with text input
    const userInput = prompt(`Type "DELETE ALL" (in uppercase) to confirm deletion of all ${totalBookings} booking(s):`);
    
    if (userInput !== 'DELETE ALL') {
        alert('Clear operation cancelled. Bookings are safe.');
        return;
    }
    
    // Clear all bookings
    bookings = [];
    localStorage.setItem('bookings', JSON.stringify(bookings));
    
    // Update UI
    loadBookingsTable();
    updateAdminStats();
    
    alert(`✅ Successfully cleared all ${totalBookings} booking(s).`);
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const toggleBtn = document.querySelector('.mobile-menu-toggle i');
    
    navMenu.classList.toggle('active');
    
    if (navMenu.classList.contains('active')) {
        toggleBtn.classList.remove('fa-bars');
        toggleBtn.classList.add('fa-times');
    } else {
        toggleBtn.classList.remove('fa-times');
        toggleBtn.classList.add('fa-bars');
    }
}

function closeMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const toggleBtn = document.querySelector('.mobile-menu-toggle i');
    
    navMenu.classList.remove('active');
    toggleBtn.classList.remove('fa-times');
    toggleBtn.classList.add('fa-bars');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const navMenu = document.getElementById('navMenu');
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    
    if (navMenu && toggleBtn && !navMenu.contains(event.target) && !toggleBtn.contains(event.target)) {
        if (navMenu.classList.contains('active')) {
            closeMobileMenu();
        }
    }
});

// Close modals when clicking outside
window.onclick = function(event) {
    const bookingModal = document.getElementById('bookingModal');
    const ticketModal = document.getElementById('ticketModal');
    const adminLoginModal = document.getElementById('adminLoginModal');
    
    if (event.target === bookingModal) {
        closeBookingModal();
    }
    if (event.target === ticketModal) {
        closeTicketModal();
    }
    if (event.target === adminLoginModal) {
        closeAdminLogin();
    }
}

// Admin Tab Switching
function switchAdminTab(tab) {
    const bookingsTab = document.getElementById('bookingsTab');
    const moviesTab = document.getElementById('moviesTab');
    const adminsTab = document.getElementById('adminsTab');
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'bookings') {
        bookingsTab.style.display = 'block';
        moviesTab.style.display = 'none';
        if (adminsTab) adminsTab.style.display = 'none';
        tabButtons[0].classList.add('active');
    } else if (tab === 'movies') {
        bookingsTab.style.display = 'none';
        moviesTab.style.display = 'block';
        if (adminsTab) adminsTab.style.display = 'none';
        tabButtons[1].classList.add('active');
        loadAdminMovies();
    } else if (tab === 'admins') {
        bookingsTab.style.display = 'none';
        moviesTab.style.display = 'none';
        if (adminsTab) adminsTab.style.display = 'block';
        tabButtons[2].classList.add('active');
        renderAdminUsers();
    }
}

// Admin users management
function saveAdminUsers() {
    localStorage.setItem('adminUsers', JSON.stringify(adminUsers));
}

function renderAdminUsers() {
    const container = document.getElementById('adminUsersList');
    if (!container) return;
    container.innerHTML = '';
    adminUsers.forEach(u => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px';
        row.style.border = '1px solid rgba(0,0,0,0.08)';
        row.style.borderRadius = '6px';
        row.innerHTML = `
            <div style="font-weight:600;">${u.username}</div>
            <div style="display:flex; gap:8px;">
                ${ (currentAdmin && currentAdmin.isSuper) ? `<button class="btn-action" onclick="promptChangePassword('${u.username}')">Change PW</button>` : '' }
                ${ (currentAdmin && currentAdmin.isSuper) ? `<button class="btn-delete" onclick="deleteAdminUser('${u.username}')">Delete</button>` : '' }
            </div>
        `;
        container.appendChild(row);
    });
}

async function handleAddAdminUser(e) {
    e.preventDefault();
    const email = document.getElementById('newAdminUsername').value.trim(); // Use email
    const password = document.getElementById('newAdminPassword').value;

    if (!email || !password) {
        alert('Please provide email and password.');
        return;
    }

    if (!auth || !firestore) {
        alert('Firebase Auth or Firestore not initialized.');
        return;
    }

    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('Firebase user created:', user);

        // 2. Store user role in Firestore (default to not super admin)
        await firestore.collection('admin-roles').doc(user.uid).set({
            email: user.email,
            isSuper: false // New admins are not super by default
        });
        console.log('Admin role saved to Firestore for UID:', user.uid);

        renderAdminUsers(); // Re-render the list of admins (will fetch from Firestore)
        document.getElementById('adminUserForm').reset();
        alert(`Admin user ${email} added successfully! (Default role: not Super Admin)`);

    } catch (error) {
        console.error('Error adding admin user:', error);
        let errorMessage = 'Failed to add admin user.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'The email address is already in use by another account.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'The email address is not valid.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'The password is too weak. Please use at least 6 characters.';
        }
        alert(errorMessage);
    }
}

function deleteAdminUser(username) {
    // Only allow super admin to delete admin users
    if (!currentAdmin || !currentAdmin.isSuper) {
        alert('Only super admin users can delete admin accounts.');
        return;
    }
    if (!confirm(`Delete admin '${username}'? This cannot be undone.`)) return;
    // Prevent deleting last admin
    if (adminUsers.length === 1) {
        alert('Cannot delete the last remaining admin account. Add another admin first.');
        return;
    }
    // Prevent deleting another super-admin (unless it's the same as currentAdmin)
    const target = adminUsers.find(u => u.username === username);
    if (target && target.isSuper && target.username !== currentAdmin.username) {
        alert('You cannot delete another super admin account.');
        return;
    }
    adminUsers = adminUsers.filter(u => u.username !== username);
    saveAdminUsers();
    renderAdminUsers();
}

function promptChangePassword(username) {
    // Only allow super admin to change admin passwords
    if (!currentAdmin || !currentAdmin.isSuper) {
        alert('Only super admin users can change admin passwords.');
        return;
    }
    const newPw = prompt(`Enter new password for ${username}:`);
    if (newPw === null) return; // cancelled
    if (newPw.trim() === '') {
        alert('Password cannot be empty');
        return;
    }
    const idx = adminUsers.findIndex(u => u.username === username);
    if (idx === -1) return;
    adminUsers[idx].password = newPw;
    saveAdminUsers();
    renderAdminUsers();
    alert('Password updated');
}

// Load admin movies grid
function loadAdminMovies() {
    const adminMoviesGrid = document.getElementById('adminMoviesGrid');
    if (!adminMoviesGrid) return;
    
    adminMoviesGrid.innerHTML = '';
    
    if (movies.length === 0) {
        adminMoviesGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">No movies added yet. Add your first movie above!</p>';
        return;
    }
    
    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'admin-movie-card';
        movieCard.innerHTML = `
            <div class="admin-movie-poster">
                <img src="${movie.poster}" alt="${movie.name}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            </div>
            <div class="admin-movie-info">
                <h4>${movie.name}</h4>
                <p><i class="fas fa-calendar"></i> ${movie.date}</p>
                <p><i class="fas fa-clock"></i> ${movie.time}</p>
                <p><i class="fas fa-phone"></i> ${movie.phone}</p>
            </div>
            <div class="admin-movie-actions">
                <button onclick="editMovie(${movie.id})" class="btn-edit"><i class="fas fa-edit"></i> Edit</button>
                <button onclick="deleteMovie(${movie.id})" class="btn-delete"><i class="fas fa-trash"></i> Delete</button>
            </div>
        `;
        adminMoviesGrid.appendChild(movieCard);
    });
}

// Update poster preview
function updatePosterPreview() {
    const fileInput = document.getElementById('addMoviePosterFile');
    const hiddenPoster = document.getElementById('addMoviePoster');
    const preview = document.getElementById('posterPreview');

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name);
        if (!isJpg) {
            preview.innerHTML = '<p style="color:red;">Only JPG/JPEG images are allowed</p>';
            hiddenPoster.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            const dataUrl = evt.target.result;
            hiddenPoster.value = dataUrl;
            preview.innerHTML = `<img src="${dataUrl}" alt="Poster Preview" style="max-width:200px;max-height:300px;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
        return;
    }

    // If no new file selected, use hiddenPoster value (may be existing data URL)
    const posterVal = hiddenPoster ? hiddenPoster.value : '';
    if (posterVal) {
        preview.innerHTML = `<img src="${posterVal}" alt="Poster Preview" style="max-width:200px;max-height:300px;object-fit:cover;">`;
    } else {
        preview.innerHTML = '<p>Poster preview will appear here</p>';
    }
}

// Handle movie form submit
async function handleMovieSubmit(e) {
    e.preventDefault();
    
    const movieId = document.getElementById('addMovieId').value; // This will be UID for Firestore
    const movieData = {
        name: document.getElementById('addMovieName').value,
        poster: document.getElementById('addMoviePoster').value,
        date: document.getElementById('addMovieDate').value,
        time: document.getElementById('addMovieTime').value,
        phone: document.getElementById('addMoviePhone').value
    };

    if (!firestore) {
        alert('Firestore not initialized. Cannot save movie.');
        return;
    }

    // For new movies, ensure a poster has been uploaded (hidden field populated)
    if (!movieId && !movieData.poster) {
        alert('Please upload a JPG poster image for the movie.');
        return;
    }

    try {
        if (movieId) {
            // Edit existing movie in Firestore
            await firestore.collection('movies').doc(movieId).update(movieData);
            console.log('Movie updated in Firestore:', movieId, movieData);
            alert('Movie updated successfully!');
        } else {
            // Add new movie to Firestore
            const docRef = await firestore.collection('movies').add(movieData);
            console.log('New movie added to Firestore with ID:', docRef.id, movieData);
            alert('Movie added successfully!');
        }
    } catch (error) {
        console.error('Error saving movie to Firestore:', error);
        alert('Failed to save movie. See console for details and ensure Firestore rules allow writes.');
    }
    
    resetMovieForm();
}

// Edit movie
function editMovie(id) {
    const movie = movies.find(m => m.id === id);
    if (!movie) return;
    
    document.getElementById('addMovieId').value = movie.id;
    document.getElementById('addMovieName').value = movie.name;
    document.getElementById('addMoviePoster').value = movie.poster;
    // clear file input so user may re-upload if desired
    const fileInput = document.getElementById('addMoviePosterFile');
    if (fileInput) fileInput.value = '';
    document.getElementById('addMovieDate').value = movie.date;
    document.getElementById('addMovieTime').value = movie.time;
    document.getElementById('addMoviePhone').value = movie.phone;
    
    updatePosterPreview();
    
    // Scroll to form
    document.getElementById('movieForm').scrollIntoView({ behavior: 'smooth' });
}

// Delete movie
async function deleteMovie(id) {
    if (!confirm('Are you sure you want to delete this movie? This action cannot be undone and will delete it from Firestore.')) {
        return;
    }

    if (!firestore) {
        alert('Firestore not initialized. Cannot delete movie.');
        return;
    }

    try {
        await firestore.collection('movies').doc(id).delete();
        console.log('Movie deleted from Firestore with ID:', id);
        alert('Movie deleted successfully!');
    } catch (error) {
        console.error('Error deleting movie from Firestore:', error);
        alert('Failed to delete movie. See console for details and ensure Firestore rules allow deletes.');
    }
}

// Reset movie form
function resetMovieForm() {
    document.getElementById('movieForm').reset();
    document.getElementById('movieId').value = '';
    document.getElementById('posterPreview').innerHTML = '<p>Poster preview will appear here</p>';
    const hiddenPoster = document.getElementById('moviePoster');
    if (hiddenPoster) hiddenPoster.value = '';
    const fileInput = document.getElementById('moviePosterFile');
    if (fileInput) fileInput.value = '';
}

