// Global State
let villages = [];
let roads = [];
let users = [];
let activeUser = null;
let activePath = null;
let selectedVillageId = null;
let selectedFilterType = "ALL";

// Base API URL (relative to root)
const API_BASE = '/api';

// Map Dimensions
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 800;

// Coordinate Scaling Helpers
function getMapCoords(xcoord, ycoord) {
    const x = 100 + (xcoord - 10) * 9.5; // Scale and shift to fit SVG viewport
    const y = 700 - (ycoord - 10) * 8.5; // Invert Y and scale
    return { x, y };
}

// Initializer
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    bindEvents();
});

// Fetch Initial Data & Build Map
async function initApp() {
    try {
        await fetchVillages();
        await fetchRoads();
        await fetchUsers();
        
        buildMap();
        populateVillageDropdowns();
        
    } catch (err) {
        showToast("Error initializing application: " + err.message, "error");
    }
}

// current found user in step2
let foundUser = null;
let loginOtp = null;
let adminRoleFilter = "ALL";
let selectedLoginRole = null; // chosen in step 0

// Event Bindings
function bindEvents() {
    // 1. Tab Navigation switching
    document.querySelectorAll(".nav-link").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            if (tabId === "admin") {
                switchTab("admin");
                refreshAdminPanel();
                return;
            }
            switchTab(tabId);
        });
    });

    // Setup language button toggle
    const btnLanguage = document.getElementById("btnLanguage");
    const languageDropdown = document.getElementById("languageDropdown");
    if (btnLanguage && languageDropdown) {
        btnLanguage.addEventListener("click", (e) => {
            e.stopPropagation();
            languageDropdown.classList.toggle("hidden");
        });
        document.addEventListener("click", (e) => {
            if (!btnLanguage.contains(e.target) && !languageDropdown.contains(e.target)) {
                languageDropdown.classList.add("hidden");
            }
        });
    }

    // 2. User search input
    const searchInput = document.getElementById("userSearchInput");
    const searchDropdown = document.getElementById("userSearchDropdown");

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            searchDropdown.classList.add("hidden");
            searchDropdown.innerHTML = "";
            return;
        }
        const matches = users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.phone.includes(query)
        );
        if (matches.length === 0) {
            searchDropdown.innerHTML = '<div class="search-item no-match">No users found</div>';
        } else {
            searchDropdown.innerHTML = matches.map(u =>
                `<div class="search-item" data-id="${u.id}">
                    <span class="si-name">${u.name}</span>
                    <span class="si-role badge ${u.role.toLowerCase()}">${u.role}</span>
                </div>`
            ).join("");
            searchDropdown.querySelectorAll(".search-item[data-id]").forEach(item => {
                item.addEventListener("click", () => {
                    const userId = item.getAttribute("data-id");
                    const user = users.find(u => String(u.id) === String(userId));
                    if (user) {
                        openRegisterModal();
                        selectedLoginRole = user.role;
                        goToLoginStep1();
                        document.getElementById("loginPhone").value = user.phone;
                        handlePhoneCheck();
                    }
                    searchInput.value = "";
                    searchDropdown.classList.add("hidden");
                });
            });
        }
        searchDropdown.classList.remove("hidden");
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#guestHeaderControls")) {
            searchDropdown.classList.add("hidden");
        }
    });

    // 3. Logout button
    document.getElementById("btnLogout").addEventListener("click", handleLogout);

    // 4. Quick login buttons (in rent/host prompts)
    document.addEventListener("click", (e) => {
        const quickBtn = e.target.closest(".quick-login-btn");
        if (quickBtn) {
            openRegisterModal();
        }
    });

    // 5. Login Modal open/close
    document.getElementById("btnOpenRegister").addEventListener("click", openRegisterModal);
    document.getElementById("btnCloseRegister").addEventListener("click", closeRegisterModal);

    // Step 0: Role tile clicks
    document.querySelectorAll(".role-tile").forEach(tile => {
        tile.addEventListener("click", () => {
            selectedLoginRole = tile.getAttribute("data-role");
            goToLoginStep1();
        });
    });

    // Step 0 back button from Step 1
    document.getElementById("btnBackStep0").addEventListener("click", goToLoginStep0);

    // Step 1: Check phone
    document.getElementById("btnCheckPhone").addEventListener("click", handlePhoneCheck);
    document.getElementById("loginPhone").addEventListener("keydown", (e) => {
        if (e.key === "Enter") handlePhoneCheck();
    });

    // Step 2a: Confirm login
    document.getElementById("btnConfirmLogin").addEventListener("click", () => {
        if (foundUser) {
            const otpInput = document.getElementById("loginOtpInput").value.trim();
            if (otpInput !== loginOtp) {
                showToast("Invalid login OTP", "warning");
                return;
            }
            loginAsUser(foundUser.id);
            closeRegisterModal();
        }
    });
    document.getElementById("loginOtpInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            document.getElementById("btnConfirmLogin").click();
        }
    });

    // Step 2a: Back to step 0
    document.getElementById("btnBackStep1").addEventListener("click", goToLoginStep0);

    // Step 2b: Back to step 0
    document.getElementById("btnBackStep1b").addEventListener("click", goToLoginStep0);

    // Step 2b: Role change → show/hide owner fields
    document.getElementById("regRole").addEventListener("change", (e) => {
        const ownerFields = document.getElementById("ownerFieldsGroup");
        ownerFields.classList.toggle("hidden", e.target.value !== "OWNER");
    });

    // 6. Registration Form submit
    document.getElementById("frmRegisterUser").addEventListener("submit", handleRegisterUser);

    // 7. Refresh lists
    document.getElementById("btnRefreshOwnerBookings").addEventListener("click", refreshOwnerBookings);
    document.getElementById("btnRefreshFarmerBookings").addEventListener("click", refreshFarmerBookings);

    // 8a. Farmer machinery filter chips
    document.querySelectorAll(".filter-chip[data-equipment-filter]").forEach(chip => {
        chip.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-chip[data-equipment-filter]").forEach(c => c.classList.remove("active"));
            e.target.classList.add("active");
            selectedFilterType = e.target.getAttribute("data-equipment-filter");
            refreshAvailableMachinery();
        });
    });

    // 8b. Admin role filter chips
    document.querySelectorAll(".filter-chip[data-role-filter]").forEach(chip => {
        chip.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-chip[data-role-filter]").forEach(c => c.classList.remove("active"));
            e.target.classList.add("active");
            adminRoleFilter = e.target.getAttribute("data-role-filter");
            renderAdminUsersTable();
        });
    });

    // 9. Add Equipment Form
    document.getElementById("frmAddEquipment").addEventListener("submit", handleAddEquipment);

    // 10. Booking modal controls
    document.getElementById("btnCloseBooking").addEventListener("click", () => {
        document.getElementById("bookingModal").classList.add("hidden");
    });
    document.getElementById("frmCreateBooking").addEventListener("submit", handleCreateBooking);
    document.getElementById("bkHours").addEventListener("input", updateBookingCostPreview);

    // 12. Pathfinder submit
    document.getElementById("btnFindPath").addEventListener("click", calculateDijkstraPath);

    // 13. Welcome panel shortcut buttons
    document.querySelectorAll(".btn-go-host").forEach(btn => {
        btn.addEventListener("click", () => switchTab("host"));
    });
    document.querySelectorAll(".btn-go-map").forEach(btn => {
        btn.addEventListener("click", () => switchTab("map"));
    });

    // 14. Admin: Refresh users & bookings
    document.getElementById("btnRefreshAdminUsers").addEventListener("click", refreshAdminPanel);
    document.getElementById("btnRefreshAdminBookings").addEventListener("click", refreshAdminBookings);

    // 15. Admin: live search filter
    document.getElementById("adminUserSearch").addEventListener("input", renderAdminUsersTable);

    // 16. Edit user modal
    document.getElementById("btnCloseEditUser").addEventListener("click", () => {
        document.getElementById("editUserModal").classList.add("hidden");
    });
    document.getElementById("frmEditUser").addEventListener("submit", handleEditUserSave);

    // 17. Interactive mousemove background effects
    const bgLayer = document.querySelector(".bg-interactive-layer");
    const glow = document.querySelector(".bg-interactive-glow");
    document.addEventListener("mousemove", (e) => {
        if (bgLayer) {
            const x = (window.innerWidth / 2 - e.clientX) / 60;
            const y = (window.innerHeight / 2 - e.clientY) / 60;
            bgLayer.style.transform = `translate(${x}px, ${y}px)`;
        }
        if (glow) {
            glow.style.left = `${e.clientX}px`;
            glow.style.top = `${e.clientY}px`;
        }
    });
}

// Tab switcher controller
function switchTab(tabId) {
    // Update active nav-link
    document.querySelectorAll(".nav-link").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Update visible view
    document.querySelectorAll(".tab-view").forEach(view => {
        if (view.getAttribute("id") === `tab-${tabId}`) {
            view.classList.remove("hidden");
        } else {
            view.classList.add("hidden");
        }
    });

    // Trigger re-rendering of SVG map components if Map tab selected
    if (tabId === "map") {
        setTimeout(buildMap, 50);
    }
}

// Fetch APIs
async function fetchVillages() {
    const res = await fetch(`${API_BASE}/villages`);
    villages = await res.json();
}

async function fetchRoads() {
    const res = await fetch(`${API_BASE}/roads`);
    roads = await res.json();
}

async function fetchUsers() {
    const res = await fetch(`${API_BASE}/users`);
    users = await res.json();
    populateUserSelector();
}

function populateUserSelector() {
    // Keep internal users array up to date; search dropdown is live-filtered
}

function populateVillageDropdowns() {
    const regVillage = document.getElementById("regVillage");
    const pathStart = document.getElementById("pathStart");
    const pathEnd = document.getElementById("pathEnd");

    regVillage.innerHTML = '<option value="" disabled selected>Select home village...</option>';
    pathStart.innerHTML = '<option value="" disabled selected>Select start...</option>';
    pathEnd.innerHTML = '<option value="" disabled selected>Select destination...</option>';

    villages.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.name;

        regVillage.appendChild(opt.cloneNode(true));
        pathStart.appendChild(opt.cloneNode(true));
        pathEnd.appendChild(opt.cloneNode(true));
    });
}

// User Simulation Login logic
async function loginAsUser(userId) {
    try {
        const res = await fetch(`${API_BASE}/users/${userId}`);
        if (!res.ok) throw new Error("Failed to fetch user profiles");
        
        activeUser = await res.json();
        updateUserLoginState();
        
        showToast(`Logged in as ${activeUser.name}`, "success");
        
        // Highlight active user village on route map
        if (activeUser.currentVillage) {
            selectMapNodeByName(activeUser.currentVillage.name);
        }
        
        // Auto-navigate and refresh tabs based on role
        if (activeUser.role === "FARMER") {
            refreshAvailableMachinery();
            refreshFarmerBookings();
            switchTab("rent");
        } else if (activeUser.role === "OWNER") {
            refreshOwnerBookings();
            refreshOwnerFleet();
            switchTab("host");
        } else if (activeUser.role === "ADMIN") {
            refreshAdminPanel();
            switchTab("admin");
        }
        
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function autoLoginByPhone(phone) {
    try {
        const res = await fetch(`${API_BASE}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone })
        });
        
        if (res.ok) {
            const user = await res.json();
            loginAsUser(user.id);
            closeRegisterModal();
        } else {
            showToast("User not found. Opening registration form...", "warning");
            openRegisterModal();
            document.getElementById("regPhone").value = phone;
        }
    } catch (err) {
        showToast("Login error: " + err.message, "error");
    }
}

function handleLogout() {
    activeUser = null;
    updateUserLoginState();
    showToast("Logged out successfully", "info");
    switchTab("home");
}

function updateUserLoginState() {
    const userWidget = document.getElementById("activeUserHeaderWidget");
    const guestControls = document.getElementById("guestHeaderControls");
    const nameEl = document.getElementById("headerUserName");
    const roleEl = document.getElementById("headerUserRole");
    const welcomePanel = document.getElementById("loggedInWelcomePanel");
    const loggedOutPanel = document.getElementById("loggedOutWelcomePanel");
    const adminNavLink = document.querySelector(".nav-link-admin");

    const ownerPrompt = document.getElementById("ownerLoginPrompt");
    const ownerDb = document.getElementById("ownerDashboard");
    const farmerPrompt = document.getElementById("farmerLoginPrompt");
    const farmerDb = document.getElementById("farmerDashboard");
    const farmerDetailsStrip = document.getElementById("farmerDetailsStrip");
    const adminPrompt = document.getElementById("adminLoginPrompt");
    const adminDashboard = document.getElementById("adminDashboard");

    if (activeUser) {
        // Logged In
        userWidget.classList.remove("hidden");
        guestControls.classList.add("hidden");
        document.getElementById("btnOpenRegister").classList.add("hidden");
        document.getElementById("btnLogout").classList.remove("hidden");
        nameEl.textContent = activeUser.name;
        roleEl.textContent = activeUser.role;
        roleEl.className = `badge ${activeUser.role.toLowerCase()}`;
        
        if (loggedOutPanel) loggedOutPanel.classList.add("hidden");
        
        if (welcomePanel) {
            if (activeUser.role === "ADMIN") {
                welcomePanel.classList.add("hidden");
            } else {
                welcomePanel.classList.remove("hidden");
                const welcomeTitle = welcomePanel.querySelector("h2");
                if (welcomeTitle) {
                    welcomeTitle.innerHTML = `Welcome back, <span class="highlight-text" style="color: var(--primary-light); font-weight: 800;">${activeUser.name}</span>!`;
                }
            }
        }

        if (activeUser.role === "FARMER") {
            if (farmerPrompt) farmerPrompt.classList.add("hidden");
            if (farmerDb) farmerDb.classList.remove("hidden");
            if (farmerDetailsStrip) {
                const villageName = activeUser.currentVillage ? activeUser.currentVillage.name : "No village";
                farmerDetailsStrip.classList.remove("hidden");
                farmerDetailsStrip.innerHTML = `
                    <span><i class="fa-solid fa-user"></i> ${activeUser.name}</span>
                    <span><i class="fa-solid fa-phone"></i> ${activeUser.phone}</span>
                    <span><i class="fa-solid fa-location-dot"></i> ${villageName}</span>
                `;
            }
            ownerPrompt.classList.remove("hidden");
            ownerDb.classList.add("hidden");
            if (adminNavLink) adminNavLink.classList.add("hidden");
            if (adminPrompt) adminPrompt.classList.remove("hidden");
            if (adminDashboard) adminDashboard.classList.add("hidden");
        } else if (activeUser.role === "OWNER") {
            if (farmerPrompt) farmerPrompt.classList.remove("hidden");
            if (farmerDb) farmerDb.classList.add("hidden");
            if (farmerDetailsStrip) farmerDetailsStrip.classList.add("hidden");
            ownerPrompt.classList.add("hidden");
            ownerDb.classList.remove("hidden");
            if (adminNavLink) adminNavLink.classList.add("hidden");
            if (adminPrompt) adminPrompt.classList.remove("hidden");
            if (adminDashboard) adminDashboard.classList.add("hidden");
        } else if (activeUser.role === "ADMIN") {
            if (farmerPrompt) farmerPrompt.classList.remove("hidden");
            if (farmerDb) farmerDb.classList.add("hidden");
            if (farmerDetailsStrip) farmerDetailsStrip.classList.add("hidden");
            ownerPrompt.classList.remove("hidden");
            ownerDb.classList.add("hidden");
            if (adminNavLink) adminNavLink.classList.remove("hidden");
            if (adminPrompt) adminPrompt.classList.add("hidden");
            if (adminDashboard) adminDashboard.classList.remove("hidden");
        }
    } else {
        // Logged Out
        userWidget.classList.add("hidden");
        guestControls.classList.remove("hidden");
        document.getElementById("btnOpenRegister").classList.remove("hidden");
        document.getElementById("btnLogout").classList.add("hidden");
        const si = document.getElementById("userSearchInput");
        if (si) { si.value = ""; }
        const sd = document.getElementById("userSearchDropdown");
        if (sd) { sd.classList.add("hidden"); }
        
        if (loggedOutPanel) loggedOutPanel.classList.remove("hidden");
        if (welcomePanel) welcomePanel.classList.add("hidden");
        if (adminNavLink) adminNavLink.classList.add("hidden");

        if (farmerPrompt) farmerPrompt.classList.remove("hidden");
        if (farmerDb) farmerDb.classList.add("hidden");
        if (farmerDetailsStrip) farmerDetailsStrip.classList.add("hidden");
        ownerPrompt.classList.remove("hidden");
        ownerDb.classList.add("hidden");
        if (adminPrompt) adminPrompt.classList.remove("hidden");
        if (adminDashboard) adminDashboard.classList.add("hidden");

        // Clear highlight
        document.querySelectorAll(".map-node-group").forEach(n => n.classList.remove("active"));
    }
}

function openRegisterModal() {
    document.getElementById("registerModal").classList.remove("hidden");
    goToLoginStep0();
}

function closeRegisterModal() {
    document.getElementById("registerModal").classList.add("hidden");
    goToLoginStep0();
    foundUser = null;
    loginOtp = null;
    selectedLoginRole = null;
}

function goToLoginStep0() {
    document.getElementById("loginStep0").classList.remove("hidden");
    document.getElementById("loginStep1").classList.add("hidden");
    document.getElementById("loginStep2Found").classList.add("hidden");
    document.getElementById("loginStep2Register").classList.add("hidden");
    document.getElementById("loginPhone").value = "";
    document.getElementById("loginOtpInput").value = "";
    document.getElementById("loginOtpPreview").textContent = "0000";
    loginOtp = null;
    document.getElementById("frmRegisterUser").reset();
    document.getElementById("ownerFieldsGroup").classList.add("hidden");
    // Reset tile highlights
    document.querySelectorAll(".role-tile").forEach(t => t.classList.remove("selected"));
}

function goToLoginStep1() {
    // Highlight selected tile
    document.querySelectorAll(".role-tile").forEach(t => t.classList.remove("selected"));
    const selectedTile = document.querySelector(`.role-tile[data-role="${selectedLoginRole}"]`);
    if (selectedTile) selectedTile.classList.add("selected");

    // Update step 1 header
    const roleLabels = { FARMER: { label: 'Farmer', icon: 'fa-seedling', cls: 'farmer' }, OWNER: { label: 'Machinery Owner', icon: 'fa-tractor', cls: 'owner' }, ADMIN: { label: 'Admin', icon: 'fa-shield-halved', cls: 'admin' } };
    const r = roleLabels[selectedLoginRole] || { label: selectedLoginRole, icon: 'fa-user', cls: '' };
    document.getElementById("step1RoleHeader").innerHTML = `<span class="role-pill ${r.cls}"><i class="fa-solid ${r.icon}"></i> ${r.label}</span>`;

    document.getElementById("loginStep0").classList.add("hidden");
    document.getElementById("loginStep1").classList.remove("hidden");
    document.getElementById("loginStep2Found").classList.add("hidden");
    document.getElementById("loginStep2Register").classList.add("hidden");
    document.getElementById("loginPhone").value = "";
    document.getElementById("loginPhone").focus();
}

async function handlePhoneCheck() {
    const phone = document.getElementById("loginPhone").value.trim();
    if (!phone || phone.length !== 10) {
        showToast("Enter a valid 10-digit phone number", "warning");
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone })
        });
        if (res.ok) {
            // User found → show step 2a
            foundUser = await res.json();
            document.getElementById("loginStep1").classList.add("hidden");
            document.getElementById("loginStep2Register").classList.add("hidden");
            document.getElementById("loginStep2Found").classList.remove("hidden");

            document.getElementById("foundUserName").textContent = foundUser.name;
            const village = foundUser.currentVillage ? foundUser.currentVillage.name : 'No village';
            document.getElementById("foundUserMeta").textContent = `${foundUser.role} • ${village}`;
            document.getElementById("foundUserShortName").textContent = foundUser.name.split(' ')[0];
            const roleBadge = document.getElementById("foundUserRoleBadge");
            roleBadge.textContent = foundUser.role;
            roleBadge.className = `badge ${foundUser.role.toLowerCase()}`;

            loginOtp = generateLoginOtp();
            document.getElementById("loginOtpInput").value = "";
            document.getElementById("loginOtpPreview").textContent = loginOtp;
            showToast(`Login OTP: ${loginOtp}`, "info");

            // Set avatar icon based on role
            const avatar = document.getElementById("foundUserAvatar");
            const icons = { FARMER: 'fa-seedling', OWNER: 'fa-tractor', ADMIN: 'fa-shield-halved' };
            avatar.innerHTML = `<i class="fa-solid ${icons[foundUser.role] || 'fa-user'}"></i>`;
            document.getElementById("loginOtpInput").focus();
        } else {
            // Not found → show step 2b registration
            document.getElementById("loginStep1").classList.add("hidden");
            document.getElementById("loginStep2Found").classList.add("hidden");
            document.getElementById("loginStep2Register").classList.remove("hidden");
            document.getElementById("regPhone").value = phone;
            // Pre-select the role chosen at step 0
            if (selectedLoginRole) {
                document.getElementById("regRole").value = selectedLoginRole;
                document.getElementById("ownerFieldsGroup").classList.toggle("hidden", selectedLoginRole !== "OWNER");
            }
            showToast("No account found — please register", "info");
        }
    } catch (err) {
        showToast("Error checking phone: " + err.message, "error");
    }
}

function generateLoginOtp() {
    return String(Math.floor(1000 + Math.random() * 9000));
}

async function autoLoginByPhone(phone) {
    openRegisterModal();
    document.getElementById("loginPhone").value = phone;
    await handlePhoneCheck();
}

async function handleRegisterUser(e) {
    e.preventDefault();
    const name = document.getElementById("regName").value;
    const phone = document.getElementById("regPhone").value;
    const role = document.getElementById("regRole").value;
    const villageId = document.getElementById("regVillage").value;
    const aadhaar = document.getElementById("regAadhaar").value;
    const drivingLicense = document.getElementById("regDL").value;

    const payload = {
        name, phone, role,
        currentVillageId: parseInt(villageId),
        aadhaar: (role === "OWNER" || role === "ADMIN") ? aadhaar : null,
        drivingLicense: (role === "OWNER" || role === "ADMIN") ? drivingLicense : null
    };

    try {
        const res = await fetch(`${API_BASE}/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to register user");
        }

        const newUser = await res.json();
        showToast("Registration successful!", "success");
        closeRegisterModal();

        await fetchUsers();
        loginAsUser(newUser.id);
        foundUser = null;

    } catch (err) {
        showToast(err.message, "error");
    }
}

// Map Rendering logic (SVG-based)
function buildMap() {
    const roadsGroup = document.getElementById("mapRoadsGroup");
    const nodesGroup = document.getElementById("mapNodesGroup");
    
    if (!roadsGroup || !nodesGroup) return;

    roadsGroup.innerHTML = "";
    nodesGroup.innerHTML = "";
    
    // 1. Draw Roads (Lines)
    roads.forEach(road => {
        const uNode = villages.find(v => v.name.toLowerCase() === road.u.toLowerCase());
        const vNode = villages.find(v => v.name.toLowerCase() === road.v.toLowerCase());
        
        if (uNode && vNode) {
            const uCoords = getMapCoords(uNode.xcoord, uNode.ycoord);
            const vCoords = getMapCoords(vNode.xcoord, vNode.ycoord);
            
            // Road Line
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "map-road-line");
            line.setAttribute("x1", uCoords.x);
            line.setAttribute("y1", uCoords.y);
            line.setAttribute("x2", vCoords.x);
            line.setAttribute("y2", vCoords.y);
            line.setAttribute("id", `road-${uNode.name}-${vNode.name}`);
            roadsGroup.appendChild(line);
            
            // Distance Label
            const midX = (uCoords.x + vCoords.x) / 2;
            const midY = (uCoords.y + vCoords.y) / 2;
            
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("class", "map-road-label-bg");
            rect.setAttribute("x", midX - 22);
            rect.setAttribute("y", midY - 11);
            rect.setAttribute("width", 44);
            rect.setAttribute("height", 22);
            roadsGroup.appendChild(rect);
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("class", "map-road-label-text");
            text.setAttribute("x", midX);
            text.setAttribute("y", midY);
            text.textContent = `${road.distance} km`;
            roadsGroup.appendChild(text);
        }
    });
    
    // 2. Draw Villages (Nodes)
    villages.forEach(v => {
        const coords = getMapCoords(v.xcoord, v.ycoord);
        
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("class", "map-node-group");
        group.setAttribute("id", `node-${v.name}`);
        group.addEventListener("click", () => handleNodeClick(v));
        
        // Glow Circle
        const glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        glowCircle.setAttribute("class", "map-node-glow");
        glowCircle.setAttribute("cx", coords.x);
        glowCircle.setAttribute("cy", coords.y);
        glowCircle.setAttribute("r", 35);
        group.appendChild(glowCircle);
        
        // Inner Circle
        const coreCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        coreCircle.setAttribute("class", "map-node-circle");
        coreCircle.setAttribute("cx", coords.x);
        coreCircle.setAttribute("cy", coords.y);
        coreCircle.setAttribute("r", 15);
        group.appendChild(coreCircle);
        
        // Node Text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "map-node-text");
        text.setAttribute("x", coords.x);
        text.setAttribute("y", coords.y - 25);
        text.textContent = v.name;
        group.appendChild(text);

        // Machinery Badge circles
        const badge = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        badge.setAttribute("class", "map-node-badge hidden");
        badge.setAttribute("cx", coords.x + 15);
        badge.setAttribute("cy", coords.y - 15);
        badge.setAttribute("r", 9);
        badge.setAttribute("id", `badge-circle-${v.id}`);
        group.appendChild(badge);

        const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        badgeText.setAttribute("class", "map-node-badge-text hidden");
        badgeText.setAttribute("x", coords.x + 15);
        badgeText.setAttribute("y", coords.y - 15);
        badgeText.setAttribute("id", `badge-text-${v.id}`);
        group.appendChild(badgeText);
        
        nodesGroup.appendChild(group);
    });

    updateMapBadges();
}

async function updateMapBadges() {
    try {
        const res = await fetch(`${API_BASE}/equipment`);
        if (!res.ok) return;
        const equipment = await res.json();

        villages.forEach(v => {
            const availableCount = equipment.filter(eq => 
                eq.currentVillage && 
                eq.currentVillage.id === v.id && 
                eq.status === "AVAILABLE"
            ).length;

            const badgeCircle = document.getElementById(`badge-circle-${v.id}`);
            const badgeText = document.getElementById(`badge-text-${v.id}`);

            if (badgeCircle && badgeText) {
                if (availableCount > 0) {
                    badgeCircle.classList.remove("hidden");
                    badgeText.classList.remove("hidden");
                    badgeText.textContent = availableCount;
                } else {
                    badgeCircle.classList.add("hidden");
                    badgeText.classList.add("hidden");
                }
            }
        });
    } catch (err) {
        console.error("Error updating map badges: ", err);
    }
}

// Click village node logic
function handleNodeClick(village) {
    selectedVillageId = village.id;
    
    // Highlight node on map
    document.querySelectorAll(".map-node-group").forEach(n => n.classList.remove("active"));
    const selectedGroup = document.getElementById(`node-${village.name}`);
    if (selectedGroup) {
        selectedGroup.classList.add("active");
    }

    const pathStart = document.getElementById("pathStart");
    const pathEnd = document.getElementById("pathEnd");

    if (!pathStart.value) {
        pathStart.value = village.id;
    } else if (!pathEnd.value && pathStart.value != village.id) {
        pathEnd.value = village.id;
    } else {
        pathStart.value = village.id;
        pathEnd.value = "";
    }

    if (activeUser && activeUser.role === "FARMER") {
        refreshAvailableMachinery();
    }
    
    if (activeUser && activeUser.role === "OWNER" && activeUser.currentVillage && activeUser.currentVillage.id !== village.id) {
        promptMoveOwnerLocation(village);
    }
}

async function promptMoveOwnerLocation(village) {
    if (confirm(`Do you want to drive your fleet/machinery to ${village.name}?`)) {
        try {
            const res = await fetch(`${API_BASE}/users/${activeUser.id}/location`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ villageId: village.id })
            });

            if (res.ok) {
                activeUser = await res.json();
                refreshOwnerFleet();
                buildMap();
                showToast(`Moved location to ${village.name}`, "success");
            }
        } catch (err) {
            showToast("Failed to move location: " + err.message, "error");
        }
    }
}

function selectMapNodeByName(name) {
    document.querySelectorAll(".map-node-group").forEach(n => n.classList.remove("active"));
    const group = document.getElementById(`node-${name}`);
    if (group) group.classList.add("active");
}

// Farmer Portal Machinery list
async function refreshAvailableMachinery() {
    const listElement = document.getElementById("machineryList");
    if (!listElement) return;

    listElement.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading machinery list...</div>';

    try {
        const res = await fetch(`${API_BASE}/equipment`);
        if (!res.ok) throw new Error("Could not load fleet");
        
        let allEquipment = await res.json();
        
        if (selectedFilterType !== "ALL") {
            allEquipment = allEquipment.filter(eq => eq.type === selectedFilterType);
        }

        listElement.innerHTML = "";
        
        if (allEquipment.length === 0) {
            listElement.innerHTML = '<div class="empty-state">No machinery matching this category is available right now.</div>';
            return;
        }

        allEquipment.forEach(eq => {
            const item = document.createElement("div");
            item.className = "machinery-item";
            
            let statusMarkup = "";
            let actionMarkup = "";

            if (eq.status === "AVAILABLE") {
                statusMarkup = `<span class="machinery-meta"><i class="fa-solid fa-circle-check"></i> Available at ${eq.currentVillage ? eq.currentVillage.name : 'Unknown'}</span>`;
                
                if (activeUser && eq.owner.id !== activeUser.id) {
                    actionMarkup = `<button class="btn btn-sm btn-accent" onclick="openBookingModal(${JSON.stringify(eq).replace(/"/g, '&quot;')})"><i class="fa-solid fa-calendar-plus"></i> Book</button>`;
                } else {
                    actionMarkup = `<span class="badge" style="background: rgba(255,255,255,0.05); color:var(--text-muted);">My Machine</span>`;
                }
            } else {
                statusMarkup = `<span class="machinery-meta" style="color: var(--warning);"><i class="fa-solid fa-clock"></i> Busy / Offline</span>`;
                actionMarkup = `<button class="btn btn-sm btn-outline" disabled>Busy</button>`;
            }

            const imageSrc = eq.type === "TRACTOR" ? "images/tractor.png" : (eq.type === "HARVESTER" ? "images/harvester.png" : "images/rotavator.png");

            item.innerHTML = `
                <div class="machinery-main">
                    <div class="machinery-avatar" style="overflow: hidden; display: flex; align-items: center; justify-content: center;">
                        <img src="${imageSrc}" alt="${eq.type}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                    </div>
                    <div class="machinery-info">
                        <span class="machinery-title">${eq.brandModel}</span>
                        <span class="machinery-subtitle">Owner: ${eq.owner.name} (${eq.regNumber})</span>
                        ${statusMarkup}
                        <span class="machinery-subtitle" style="font-size:0.75rem; color:var(--text-muted);">Cap: ${eq.acresPerHour} acres/hr | ${eq.description || 'No description'}</span>
                    </div>
                </div>
                <div class="machinery-actions">
                    <span class="machinery-price">₹${eq.costPerHour}/hr</span>
                    ${actionMarkup}
                </div>
            `;
            listElement.appendChild(item);
        });

    } catch (err) {
        listElement.innerHTML = `<div class="empty-state" style="color: var(--error);">Error: ${err.message}</div>`;
    }
}

// Booking Modal Preview & submit
let currentSelectedEquipment = null;
async function openBookingModal(equipment) {
    currentSelectedEquipment = equipment;
    document.getElementById("bookingModal").classList.remove("hidden");
    document.getElementById("bookingEquipmentId").value = equipment.id;
    
    const preview = document.getElementById("bookingMachineDetails");
    const imageSrc = equipment.type === "TRACTOR" ? "images/tractor.png" : (equipment.type === "HARVESTER" ? "images/harvester.png" : "images/rotavator.png");
    preview.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <img src="${imageSrc}" alt="${equipment.type}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">
            <div>
                <div style="font-weight: 700; font-size: 1.05rem; color: var(--accent-light); margin-bottom: 2px;">
                    ${equipment.brandModel}
                </div>
                <span class="badge ${equipment.type.toLowerCase()}" style="font-size: 0.65rem; padding: 2px 6px;">${equipment.type}</span>
            </div>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
            Owner: ${equipment.owner.name} | Rate: ₹${equipment.costPerHour}/hr
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
            Location: <strong>${equipment.currentVillage ? equipment.currentVillage.name : 'Unknown'}</strong>
        </div>
    `;

    document.getElementById("estRate").textContent = `₹${equipment.costPerHour}/hr`;
    document.getElementById("bkAddress").value = `Field near ${activeUser.currentVillage ? activeUser.currentVillage.name : 'village'}`;
    
    updateBookingCostPreview();
}

async function updateBookingCostPreview() {
    if (!currentSelectedEquipment || !activeUser) return;
    
    const hours = parseInt(document.getElementById("bkHours").value) || 0;
    const rentalCost = hours * currentSelectedEquipment.costPerHour;
    
    const startName = currentSelectedEquipment.currentVillage ? currentSelectedEquipment.currentVillage.name : "";
    const endName = activeUser.currentVillage ? activeUser.currentVillage.name : "";

    let travelCost = 0;
    let distance = 0;
    
    if (startName && endName && startName !== endName) {
        try {
            const res = await fetch(`${API_BASE}/path?start=${encodeURIComponent(startName)}&end=${encodeURIComponent(endName)}`);
            if (res.ok) {
                const pathRes = await res.json();
                distance = pathRes.distance;
                travelCost = Math.round(distance * 25);
            }
        } catch (e) {
            console.error("Dijkstra calculator failed", e);
        }
    }

    document.getElementById("estTravelCost").textContent = distance > 0 ? `₹${travelCost} (${distance.toFixed(1)} km)` : "₹0 (Same village)";
    document.getElementById("estTotal").textContent = `₹${rentalCost + travelCost}`;
}

async function handleCreateBooking(e) {
    e.preventDefault();
    if (!activeUser || !currentSelectedEquipment) return;

    const hours = parseInt(document.getElementById("bkHours").value);
    const cropType = document.getElementById("bkCrop").value;
    const fieldAddress = document.getElementById("bkAddress").value;

    const payload = {
        farmerId: activeUser.id,
        equipmentId: currentSelectedEquipment.id,
        hours, cropType, fieldAddress
    };

    try {
        const res = await fetch(`${API_BASE}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to submit booking");
        }

        const savedBooking = await res.json();
        showToast(`Booking submitted. OTP: ${savedBooking.otpCode}`, "success");
        document.getElementById("bookingModal").classList.add("hidden");
        
        refreshFarmerBookings();
        refreshAvailableMachinery();
        updateMapBadges();
        
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Farmer Bookings list loader
async function refreshFarmerBookings() {
    if (!activeUser || activeUser.role !== "FARMER") return;
    
    const container = document.getElementById("farmerBookingsList");
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading bookings...</div>';

    try {
        const res = await fetch(`${API_BASE}/bookings?farmerId=${activeUser.id}`);
        if (!res.ok) throw new Error("Failed to load bookings");
        
        const list = await res.json();
        container.innerHTML = "";
        
        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state">No bookings found. Request some machinery to start.</div>';
            return;
        }

        list.reverse().forEach(bk => {
            const card = document.createElement("div");
            card.className = "booking-item";
            
            let ratingSectionHtml = "";
            if (bk.status === "COMPLETED") {
                if (bk.rating && bk.rating > 0) {
                    ratingSectionHtml = `
                        <div class="rating-display">
                            Rated: ${"★".repeat(bk.rating)}${"☆".repeat(5 - bk.rating)}
                        </div>
                    `;
                } else {
                    ratingSectionHtml = `
                        <div class="rating-stars" data-booking-id="${bk.id}">
                            <span style="font-size:0.75rem; color:var(--text-muted); margin-right:3px;">Rate:</span>
                            <i class="fa-solid fa-star star-btn" data-value="1"></i>
                            <i class="fa-solid fa-star star-btn" data-value="2"></i>
                            <i class="fa-solid fa-star star-btn" data-value="3"></i>
                            <i class="fa-solid fa-star star-btn" data-value="4"></i>
                            <i class="fa-solid fa-star star-btn" data-value="5"></i>
                        </div>
                    `;
                }
            }

            const farmerVillageName = activeUser.currentVillage ? activeUser.currentVillage.name : "No village";
            const otpMarkup = bk.otpCode
                ? `<div class="otp-box"><i class="fa-solid fa-key"></i> OTP: ${bk.otpCode}</div>`
                : `<span class="booking-body-item"><i class="fa-solid fa-key"></i> OTP pending</span>`;

            let actionHtml = "";
            if (bk.status === "PENDING") {
                actionHtml = `
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                        <span style="font-size:0.7rem; color:var(--text-muted);">OTP for operator:</span>
                        ${otpMarkup}
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="updateBookingState(${bk.id}, 'CANCELLED')"><i class="fa-solid fa-times"></i> Cancel</button>
                `;
            } else if (bk.status === "CONFIRMED") {
                actionHtml = `
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                        <span style="font-size:0.7rem; color:var(--text-muted);">Share OTP on arrival:</span>
                        ${otpMarkup}
                    </div>
                `;
            } else if (bk.status === "IN_PROGRESS") {
                actionHtml = `<span style="font-size:0.8rem; color:var(--purple); font-weight:700;"><i class="fa-solid fa-spinner fa-spin"></i> Working...</span>`;
            } else if (bk.status === "CANCELLED") {
                actionHtml = `<span style="font-size:0.8rem; color:var(--error); font-weight:700;">Cancelled</span>`;
            }

            const reqDateFormatted = new Date(bk.requestDate).toLocaleDateString() + " " + new Date(bk.requestDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            card.innerHTML = `
                <div class="booking-summary">
                    <div style="display:flex; flex-direction:column;">
                        <span class="booking-title">${bk.equipment.brandModel}</span>
                        <span style="font-size:0.7rem; color:var(--text-muted);">Req #${bk.id} | ${reqDateFormatted}</span>
                    </div>
                    <span class="status-badge ${bk.status.toLowerCase()}">${bk.status}</span>
                </div>
                <div class="booking-body">
                    <div class="booking-body-item"><i class="fa-solid fa-user"></i> Name: ${activeUser.name}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-phone"></i> Phone: ${activeUser.phone}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-location-dot"></i> Village: ${farmerVillageName}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-key"></i> OTP: ${bk.otpCode || 'Pending'}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-clock"></i> ${bk.hours} hours</div>
                    <div class="booking-body-item"><i class="fa-solid fa-wallet"></i> Rent: ₹${bk.totalCost}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-wheat-awn"></i> Crop: ${bk.cropType}</div>
                    <div class="booking-body-item col-span-2" style="grid-column: span 2;"><i class="fa-solid fa-location-dot"></i> Delivery: ${bk.fieldAddress}</div>
                </div>
                <div class="booking-actions">
                    ${ratingSectionHtml}
                    ${actionHtml}
                </div>
            `;
            container.appendChild(card);
        });

        // Stars handler
        document.querySelectorAll(".rating-stars").forEach(starContainer => {
            const stars = starContainer.querySelectorAll(".star-btn");
            const bkId = starContainer.getAttribute("data-booking-id");
            
            stars.forEach(star => {
                star.addEventListener("mouseenter", () => {
                    const val = parseInt(star.getAttribute("data-value"));
                    stars.forEach((s, idx) => {
                        if (idx < val) s.classList.add("active");
                        else s.classList.remove("active");
                    });
                });
                star.addEventListener("mouseleave", () => {
                    stars.forEach(s => s.classList.remove("active"));
                });
                star.addEventListener("click", () => {
                    const rating = parseInt(star.getAttribute("data-value"));
                    rateBookingService(bkId, rating);
                });
            });
        });

    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:var(--error);">Failed to load bookings: ${err.message}</div>`;
    }
}

async function rateBookingService(bookingId, rating) {
    try {
        const res = await fetch(`${API_BASE}/bookings/${bookingId}/rate`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating })
        });
        if (res.ok) {
            showToast("Rating submitted!", "success");
            refreshFarmerBookings();
        }
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Owner Portal Actions
async function handleAddEquipment(e) {
    e.preventDefault();
    if (!activeUser || activeUser.role !== "OWNER") return;

    const type = document.getElementById("eqType").value;
    const brandModel = document.getElementById("eqBrandModel").value;
    const regNumber = document.getElementById("eqRegNum").value;
    const costPerHour = parseFloat(document.getElementById("eqCost").value);
    const acresPerHour = parseFloat(document.getElementById("eqAcres").value);
    const description = document.getElementById("eqDesc").value;

    const payload = {
        ownerId: activeUser.id,
        type, brandModel, regNumber, costPerHour, acresPerHour, description,
        currentVillageId: activeUser.currentVillage ? activeUser.currentVillage.id : null
    };

    try {
        const res = await fetch(`${API_BASE}/equipment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to add machinery");
        }

        showToast("Equipment registered in fleet!", "success");
        document.getElementById("frmAddEquipment").reset();
        
        refreshOwnerFleet();
        buildMap();
        
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function refreshOwnerFleet() {
    if (!activeUser || activeUser.role !== "OWNER") return;
    
    const container = document.getElementById("ownerFleetList");
    if (!container) return;

    container.innerHTML = "";
    
    try {
        const res = await fetch(`${API_BASE}/equipment`);
        if (!res.ok) return;
        const all = await res.json();
        
        const myFleet = all.filter(eq => eq.owner.id === activeUser.id);
        
        if (myFleet.length === 0) {
            container.innerHTML = '<div class="empty-state">No machinery registered in your fleet. Add one above.</div>';
            return;
        }

        myFleet.forEach(eq => {
            const div = document.createElement("div");
            div.className = "machinery-item";
            
            const imageSrc = eq.type === "TRACTOR" ? "images/tractor.png" : (eq.type === "HARVESTER" ? "images/harvester.png" : "images/rotavator.png");
            
            let statusBadge = "";
            if (eq.status === "AVAILABLE") {
                statusBadge = `<span class="status-badge completed">Available</span>`;
            } else if (eq.status === "BUSY") {
                statusBadge = `<span class="status-badge in_progress">Busy</span>`;
            } else {
                statusBadge = `<span class="status-badge pending">Offline</span>`;
            }

            div.innerHTML = `
                <div class="machinery-main">
                    <div class="machinery-avatar" style="overflow: hidden; display: flex; align-items: center; justify-content: center;">
                        <img src="${imageSrc}" alt="${eq.type}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                    </div>
                    <div class="machinery-info">
                        <span class="machinery-title">${eq.brandModel}</span>
                        <span class="machinery-subtitle">${eq.regNumber} | Located in ${eq.currentVillage ? eq.currentVillage.name : 'Unknown'}</span>
                    </div>
                </div>
                <div class="machinery-actions" style="gap:5px;">
                    <span class="machinery-price">₹${eq.costPerHour}/hr</span>
                    ${statusBadge}
                </div>
            `;
            container.appendChild(div);
        });

    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:var(--error);">Failed to load fleet: ${err.message}</div>`;
    }
}

async function refreshOwnerBookings() {
    if (!activeUser || activeUser.role !== "OWNER") return;

    const container = document.getElementById("ownerBookingsList");
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading requests...</div>';

    try {
        const res = await fetch(`${API_BASE}/bookings?ownerId=${activeUser.id}`);
        if (!res.ok) throw new Error("Failed to load requests");
        
        const list = await res.json();
        container.innerHTML = "";
        
        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state">No booking requests found.</div>';
            return;
        }

        list.reverse().forEach(bk => {
            const card = document.createElement("div");
            card.className = "booking-item";
            
            let actionHtml = "";
            if (bk.status === "PENDING") {
                actionHtml = `
                    <button class="btn btn-sm btn-primary" onclick="updateBookingState(${bk.id}, 'CONFIRMED')"><i class="fa-solid fa-check"></i> Accept</button>
                    <button class="btn btn-sm btn-outline" onclick="updateBookingState(${bk.id}, 'CANCELLED')"><i class="fa-solid fa-times"></i> Decline</button>
                `;
            } else if (bk.status === "CONFIRMED") {
                actionHtml = `
                    <button class="btn btn-sm btn-accent" onclick="startBookingWorkPrompt(${bk.id})"><i class="fa-solid fa-play"></i> Start Work (Enter OTP)</button>
                    <button class="btn btn-sm btn-outline" onclick="updateBookingState(${bk.id}, 'CANCELLED')"><i class="fa-solid fa-times"></i> Cancel</button>
                `;
            } else if (bk.status === "IN_PROGRESS") {
                actionHtml = `
                    <button class="btn btn-sm btn-primary" onclick="updateBookingState(${bk.id}, 'COMPLETED')"><i class="fa-solid fa-flag-checkered"></i> Complete Work</button>
                `;
            } else if (bk.status === "COMPLETED") {
                let rText = bk.rating ? `Rated: ${bk.rating}/5` : "Not Rated";
                actionHtml = `<span style="font-size:0.8rem; color:var(--success); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Job Done (${rText})</span>`;
            } else if (bk.status === "CANCELLED") {
                actionHtml = `<span style="font-size:0.8rem; color:var(--error); font-weight:700;">Declined / Cancelled</span>`;
            }

            const reqDateFormatted = new Date(bk.requestDate).toLocaleDateString() + " " + new Date(bk.requestDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            card.innerHTML = `
                <div class="booking-summary">
                    <div style="display:flex; flex-direction:column;">
                        <span class="booking-title">${bk.equipment.brandModel}</span>
                        <span style="font-size:0.7rem; color:var(--text-muted);">Request #${bk.id} | ${reqDateFormatted}</span>
                    </div>
                    <span class="status-badge ${bk.status.toLowerCase()}">${bk.status}</span>
                </div>
                <div class="booking-body">
                    <div class="booking-body-item"><i class="fa-solid fa-user"></i> Farmer: ${bk.farmer.name}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-wallet"></i> Total Rent: ₹${bk.totalCost}</div>
                    <div class="booking-body-item"><i class="fa-solid fa-clock"></i> Duration: ${bk.hours} hours</div>
                    <div class="booking-body-item"><i class="fa-solid fa-wheat-awn"></i> Crop: ${bk.cropType}</div>
                    <div class="booking-body-item col-span-2" style="grid-column: span 2;"><i class="fa-solid fa-location-dot"></i> Delivery Address: ${bk.fieldAddress}</div>
                </div>
                <div class="booking-actions">
                    ${actionHtml}
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:var(--error);">Failed to load requests: ${err.message}</div>`;
    }
}

function startBookingWorkPrompt(bookingId) {
    const otp = prompt("Please enter the 4-digit OTP code provided by the Farmer:");
    if (otp === null) return;
    
    if (otp.trim() === "" || otp.length !== 4 || isNaN(otp)) {
        showToast("Please enter a valid 4-digit numeric OTP code", "warning");
        return;
    }
    
    updateBookingState(bookingId, "IN_PROGRESS", otp);
}

async function updateBookingState(bookingId, newStatus, otp = null) {
    try {
        const payload = { status: newStatus };
        if (otp) payload.otp = otp;

        const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to update booking status");
        }

        showToast(`Booking updated to ${newStatus}`, "success");
        
        if (activeUser.role === "FARMER") {
            refreshFarmerBookings();
        } else if (activeUser.role === "OWNER") {
            refreshOwnerBookings();
            refreshOwnerFleet();
        }
        
        updateMapBadges();
        
        if (newStatus === "COMPLETED") {
            await initApp();
            if (activeUser) {
                const userRes = await fetch(`${API_BASE}/users/${activeUser.id}`);
                activeUser = await userRes.json();
                updateUserLoginState();
            }
        }
        
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Dijkstra Pathfinder
async function calculateDijkstraPath() {
    const startSelect = document.getElementById("pathStart");
    const endSelect = document.getElementById("pathEnd");
    
    const startId = startSelect.value;
    const endId = endSelect.value;

    if (!startId || !endId) {
        showToast("Select both start and destination villages", "warning");
        return;
    }

    const startVillage = villages.find(v => v.id == startId);
    const endVillage = villages.find(v => v.id == endId);

    if (startVillage.id === endVillage.id) {
        showToast("Start and destination must be different", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/path?start=${encodeURIComponent(startVillage.name)}&end=${encodeURIComponent(endVillage.name)}`);
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Path calculation error");
        }

        const pathData = await res.json();
        activePath = pathData.path;
        
        document.getElementById("pathResults").classList.remove("hidden");
        document.getElementById("routeDistance").textContent = `${pathData.distance.toFixed(1)} km`;
        
        const seqContainer = document.getElementById("routeSequence");
        seqContainer.innerHTML = "";
        
        activePath.forEach((nodeName, idx) => {
            const pill = document.createElement("span");
            pill.className = "route-node-pill";
            pill.textContent = nodeName;
            seqContainer.appendChild(pill);
            
            if (idx < activePath.length - 1) {
                const arrow = document.createElement("i");
                arrow.className = "fa-solid fa-chevron-right route-arrow";
                seqContainer.appendChild(arrow);
            }
        });

        highlightSvgPath();
        showToast(`Route calculated: ${pathData.distance.toFixed(1)} km`, "info");

    } catch (err) {
        showToast(err.message, "error");
    }
}

function highlightSvgPath() {
    document.querySelectorAll(".map-road-line").forEach(line => line.classList.remove("highlight"));
    document.querySelectorAll(".map-node-group").forEach(node => node.classList.remove("highlight"));
    
    if (!activePath || activePath.length === 0) return;

    activePath.forEach(nodeName => {
        const group = document.getElementById(`node-${nodeName}`);
        if (group) group.classList.add("highlight");
    });

    for (let i = 0; i < activePath.length - 1; i++) {
        const u = activePath[i];
        const v = activePath[i + 1];

        let roadLine = document.getElementById(`road-${u}-${v}`);
        if (!roadLine) {
            roadLine = document.getElementById(`road-${v}-${u}`);
        }

        if (roadLine) {
            roadLine.classList.add("highlight");
        }
    }
}

// Custom Toast Alerts
function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-exclamation";
    if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="toast-message">${message}</div>
        <i class="fa-solid fa-xmark toast-close"></i>
    `;
    
    toast.querySelector(".toast-close").onclick = () => {
        toast.remove();
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = "slideInRight 0.25s reverse forwards";
            setTimeout(() => {
                toast.remove();
            }, 250);
        }
    }, 4000);
}

// =====================================================================
// ADMIN PANEL FUNCTIONS
// =====================================================================

let adminAllUsers = [];

async function refreshAdminPanel() {
    if (!activeUser || activeUser.role !== "ADMIN") return;
    await refreshAdminUsers();
    await refreshAdminBookings();
    renderAdminStats();
}

async function refreshAdminUsers() {
    try {
        const res = await fetch(`${API_BASE}/users`);
        if (!res.ok) throw new Error("Failed to load users");
        adminAllUsers = await res.json();
        renderAdminUsersTable();
    } catch (err) {
        showToast("Error loading users: " + err.message, "error");
    }
}

function renderAdminStats() {
    const statsRow = document.getElementById("adminStatsRow");
    if (!statsRow) return;
    const farmers = adminAllUsers.filter(u => u.role === "FARMER").length;
    const owners = adminAllUsers.filter(u => u.role === "OWNER").length;
    const admins = adminAllUsers.filter(u => u.role === "ADMIN").length;
    statsRow.innerHTML = `
        <div class="glass-card stat-card">
            <span class="stat-number">${adminAllUsers.length}</span>
            <span class="stat-label">Total Users</span>
        </div>
        <div class="glass-card stat-card">
            <span class="stat-number" style="color:var(--primary-light);">${farmers}</span>
            <span class="stat-label">Farmers</span>
        </div>
        <div class="glass-card stat-card">
            <span class="stat-number" style="color:var(--accent-light);">${owners}</span>
            <span class="stat-label">Equipment Owners</span>
        </div>
        <div class="glass-card stat-card">
            <span class="stat-number" style="color:var(--purple);">${admins}</span>
            <span class="stat-label">Admins</span>
        </div>
    `;
}

function renderAdminUsersTable() {
    const tableEl = document.getElementById("adminUsersTable");
    if (!tableEl) return;

    const searchQuery = (document.getElementById("adminUserSearch")?.value || "").toLowerCase();
    let filtered = adminAllUsers.filter(u => {
        const matchRole = adminRoleFilter === "ALL" || u.role === adminRoleFilter;
        const matchSearch = !searchQuery ||
            u.name.toLowerCase().includes(searchQuery) ||
            u.phone.includes(searchQuery) ||
            u.role.toLowerCase().includes(searchQuery);
        return matchRole && matchSearch;
    });

    if (filtered.length === 0) {
        tableEl.innerHTML = '<div class="empty-state">No users found.</div>';
        return;
    }

    tableEl.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Village</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(u => `
                    <tr>
                        <td>${u.id}</td>
                        <td><strong>${u.name}</strong></td>
                        <td><code>${u.phone}</code></td>
                        <td><span class="badge ${u.role.toLowerCase()}">${u.role}</span></td>
                        <td>${u.currentVillage ? u.currentVillage.name : '—'}</td>
                        <td>${u.role === 'OWNER' ? (u.isAvailable ? '<span style="color:var(--success);font-size:0.8rem;">● Available</span>' : '<span style="color:var(--error);font-size:0.8rem;">● Busy</span>') : '—'}</td>
                        <td class="admin-actions-cell">
                            <button class="btn btn-sm btn-secondary" onclick="openEditUserModal(${u.id})">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>
                            ${u.role !== 'ADMIN' ? `
                            <button class="btn btn-sm" style="background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.3);color:#ef4444;" onclick="handleDeleteUser(${u.id}, '${u.name}')">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    renderAdminStats();
}

async function refreshAdminBookings() {
    const container = document.getElementById("adminBookingsList");
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading bookings...</div>';

    try {
        const res = await fetch(`${API_BASE}/bookings`);
        if (!res.ok) throw new Error("Failed to load bookings");
        const list = await res.json();

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state">No bookings yet.</div>';
            return;
        }

        container.innerHTML = "";
        list.reverse().forEach(bk => {
            const card = document.createElement("div");
            card.className = "booking-item";
            const reqDate = new Date(bk.requestDate).toLocaleDateString() + " " + new Date(bk.requestDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            card.innerHTML = `
                <div class="booking-summary">
                    <div class="booking-info">
                        <span class="booking-title">#${bk.id} – ${bk.equipment?.brandModel || 'N/A'}</span>
                        <span class="booking-meta"><i class="fa-solid fa-user"></i> Farmer: ${bk.farmer?.name || '—'} | Owner: ${bk.equipment?.owner?.name || '—'}</span>
                        <span class="booking-meta"><i class="fa-solid fa-clock"></i> ${bk.hours}h | Crop: ${bk.cropType} | ₹${bk.totalCost}</span>
                        <span class="booking-meta"><i class="fa-solid fa-calendar"></i> ${reqDate}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                        <span class="badge booking-status-badge ${bk.status.toLowerCase()}">${bk.status}</span>
                        ${bk.rating ? `<span style="color:var(--accent-light);font-size:0.8rem;">${'★'.repeat(bk.rating)}${'☆'.repeat(5-bk.rating)}</span>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:var(--error);">Error: ${err.message}</div>`;
    }
}

function openEditUserModal(userId) {
    const user = adminAllUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById("editUserId").value = user.id;
    document.getElementById("editUserName").value = user.name;
    document.getElementById("editUserPhone").value = user.phone;
    document.getElementById("editUserRole").value = user.role;
    document.getElementById("editUserAadhaar").value = user.aadhaar || "";
    document.getElementById("editUserDL").value = user.drivingLicense || "";

    // Populate village dropdown
    const villageSelect = document.getElementById("editUserVillage");
    villageSelect.innerHTML = '<option value="">— No village —</option>';
    villages.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.name;
        if (user.currentVillage && user.currentVillage.id === v.id) opt.selected = true;
        villageSelect.appendChild(opt);
    });

    document.getElementById("editUserModal").classList.remove("hidden");
}

async function handleEditUserSave(e) {
    e.preventDefault();
    const id = document.getElementById("editUserId").value;
    const payload = {
        name: document.getElementById("editUserName").value,
        phone: document.getElementById("editUserPhone").value,
        role: document.getElementById("editUserRole").value,
        aadhaar: document.getElementById("editUserAadhaar").value || null,
        drivingLicense: document.getElementById("editUserDL").value || null,
        currentVillageId: parseInt(document.getElementById("editUserVillage").value) || null
    };

    try {
        const res = await fetch(`${API_BASE}/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to update user");
        }
        showToast("User updated successfully", "success");
        document.getElementById("editUserModal").classList.add("hidden");
        await refreshAdminUsers();
        await fetchUsers(); // refresh header search list
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleDeleteUser(userId, userName) {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${API_BASE}/users/${userId}`, { method: "DELETE" });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to delete user");
        }
        showToast(`User "${userName}" deleted`, "success");
        await refreshAdminUsers();
        await fetchUsers();
} catch (err) {
        showToast(err.message, "error");
    }
}

// Global function to handle language change via custom dropdown
window.changeLanguage = function(langCode) {
    if (langCode === 'en') {
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${window.location.hostname}; path=/;`;
    } else {
        document.cookie = `googtrans=/en/${langCode}; path=/`;
        document.cookie = `googtrans=/en/${langCode}; domain=${window.location.hostname}; path=/`;
    }
    window.location.reload();
};
