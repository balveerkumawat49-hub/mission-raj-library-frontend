"use strict";

/*
 * Mission Raj Library
 * Owner Seat Chart
 *
 * AUDIT FIX:
 * This page previously read/wrote seat and student data
 * directly to localStorage ("missionRajSeats",
 * "missionRajStudents" / "missionRajLearners"), while the
 * Seats page (seats.js) already used the real backend API.
 * That caused the Seat Chart to drift out of sync with the
 * Seats page.
 *
 * This page now uses the SAME canonical API contract as
 * seats.js:
 *
 *   GET   /api/seats
 *   GET   /api/learners
 *   GET   /api/auth/me
 *   POST  /api/seats
 *   PATCH /api/seats/:id
 *   POST  /api/seat-allocations
 *   POST  /api/seat-allocations/:seatId/release
 *
 * Backend is the source of truth.
 * No fake/demo seats or students are created here.
 *
 * Canonical seat statuses (must match seats.js):
 *   available, occupied, reserved, maintenance, blocked
 *
 * Field reconciliation with the Seats page data model:
 * - "Section" in this UI maps to the canonical `zone` field
 *   (seats.js itself already treats "section" as a legacy
 *   alias for zone).
 * - The Seats page only has one free-text `notes` field.
 *   This page still shows separate "Room" and
 *   "Maintenance / Block Reason" inputs for continuity, but
 *   both are combined into that single canonical `notes`
 *   string (see composeNotes / parseNotes below) so no data
 *   is lost and nothing new is invented on the backend side.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";

const state = {
    seats: [],
    students: [],
    selectedSeatId: null,
    editing: false,
    dragging: null,
    filters: {
        floor: "all",
        room: "all",
        status: "all"
    }
};


/* =========================================================
   DOM
========================================================= */

const $ = (id) => document.getElementById(id);

const seatCanvas = $("seatCanvas");
const emptyChart = $("emptyChart");

const detailsEmpty = $("detailsEmpty");
const detailsContent = $("detailsContent");

const seatModal = $("seatModal");
const seatForm = $("seatForm");

const allocationModal = $("allocationModal");
const allocationForm = $("allocationForm");


/* =========================================================
   AUTH
========================================================= */

function getAccessToken() {

    const keys = [
        "missionRajAccessToken",
        "missionRajToken",
        "accessToken",
        "access_token",
        "token"
    ];

    for (const key of keys) {

        const token =
            localStorage.getItem(key);

        if (token) {
            return token;
        }
    }

    return null;
}


function requireAuth() {

    if (!getAccessToken()) {

        window.location.href =
            "../index.html";

        return false;
    }

    return true;
}


function clearClientAuth() {

    [
        "missionRajAccessToken",
        "missionRajToken",
        "accessToken",
        "access_token",
        "token",
        "missionRajAuth"
    ].forEach(
        key =>
            localStorage.removeItem(key)
    );
}


/* =========================================================
   API
========================================================= */

async function apiRequest(
    path,
    options = {}
) {

    const token =
        getAccessToken();

    const headers = {
        "Accept": "application/json",
        ...(options.headers || {})
    };

    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_BASE}${path}`,
        {
            ...options,
            headers
        }
    );

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (response.status === 401) {

        clearClientAuth();

        window.location.href = "../index.html";

        throw new Error("Your session has expired.");
    }

    if (!response.ok) {

        const message =
            payload?.message ||
            payload?.error ||
            "Request failed.";

        throw new Error(message);
    }

    return payload;
}


function unwrapList(payload) {

    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.data?.items)) {
        return payload.data.items;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (Array.isArray(payload?.seats)) {
        return payload.seats;
    }

    if (Array.isArray(payload?.data?.seats)) {
        return payload.data.seats;
    }

    if (Array.isArray(payload?.students)) {
        return payload.students;
    }

    if (Array.isArray(payload?.data?.students)) {
        return payload.data.students;
    }

    if (Array.isArray(payload?.learners)) {
        return payload.learners;
    }

    if (Array.isArray(payload?.data?.learners)) {
        return payload.data.learners;
    }

    return [];
}


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getInitials(name) {
    const text = String(name || "").trim();

    if (!text) {
        return "—";
    }

    return text
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}


function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}


function formatDuration(startValue) {

    if (!startValue) {
        return "—";
    }

    const start = new Date(startValue);

    if (Number.isNaN(start.getTime())) {
        return "—";
    }

    const diff = Date.now() - start.getTime();

    if (diff < 0) {
        return "—";
    }

    const minutes = Math.floor(diff / 60000);

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    return `${hours}h ${remaining}m`;
}


function showToast(message, type = "") {

    const toast = $("toast");

    toast.textContent = message;
    toast.className = "toast show";

    if (type === "error") {
        toast.classList.add("error");
    }

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}


/* =========================================================
   NOTES <-> ROOM / BLOCK REASON RECONCILIATION
   -------------------------------------------------------
   The backend only stores one free-text `notes` field per
   seat (same as seats.js / seats.html). This page keeps
   separate "Room" and "Maintenance / Block Reason" inputs
   for continuity with the existing UI, so we fold both
   into a single readable string and parse them back out.
========================================================= */

function composeNotes(room, blockReason) {

    const segments = [];

    if (room) {
        segments.push(`Room: ${room}`);
    }

    if (blockReason) {
        segments.push(`Reason: ${blockReason}`);
    }

    return segments.join(" | ");
}


function parseNotes(notes, status) {

    const text = String(notes || "").trim();

    if (!text) {
        return { room: "", blockReason: "" };
    }

    const roomMatch =
        text.match(/Room:\s*([^|]*)/i);

    const reasonMatch =
        text.match(/Reason:\s*([^|]*)/i);

    if (roomMatch || reasonMatch) {

        return {
            room:
                roomMatch
                    ? roomMatch[1].trim()
                    : "",

            blockReason:
                reasonMatch
                    ? reasonMatch[1].trim()
                    : ""
        };
    }

    /*
     * Notes created elsewhere (e.g. from the Seats page,
     * which has no "Room:"/"Reason:" prefixes). Fall back
     * based on the seat's current status so nothing is lost.
     */
    if (status === "blocked" || status === "maintenance") {

        return { room: "", blockReason: text };
    }

    return { room: text, blockReason: "" };
}


/* =========================================================
   DATA NORMALIZATION
========================================================= */

function normalizeStudent(student) {

    if (!student || typeof student !== "object") {
        return null;
    }

    return {
        id:
            student._id ??
            student.id ??
            student.studentId ??
            student.learnerId ??
            "",

        studentId:
            student.studentId ??
            student.learnerId ??
            student.admissionId ??
            student.enrollmentId ??
            student.loginId ??
            "—",

        name:
            student.name ??
            student.fullName ??
            student.studentName ??
            student.learnerName ??
            "Unknown Student",

        mobile:
            student.mobile ??
            student.phone ??
            student.phoneNumber ??
            "",

        email:
            student.email ??
            "",

        membership:
            student.membership?.planName ??
            student.membership ??
            student.planName ??
            student.plan ??
            "",

        membershipStart:
            student.membership?.startDate ??
            student.membershipStart ??
            student.startDate ??
            student.validFrom ??
            "",

        membershipEnd:
            student.membership?.endDate ??
            student.membershipEnd ??
            student.endDate ??
            student.validUntil ??
            student.validityEnd ??
            "",

        status:
            String(
                student.status ||
                student.accountStatus ||
                "active"
            )
                .toLowerCase()
                .trim(),

        checkIn:
            student.checkIn ??
            student.checkInTime ??
            student.currentCheckIn ??
            student.attendance?.checkIn ??
            ""
    };
}


function normalizeSeat(seat) {

    if (!seat || typeof seat !== "object") {
        return null;
    }

    const allocation =
        seat.currentAllocation ||
        seat.allocation ||
        seat.activeAllocation ||
        {};

    const studentRaw =
        allocation.student ||
        seat.student ||
        seat.assignedStudent ||
        seat.learner ||
        seat.occupant ||
        seat.currentStudent ||
        null;

    let status =
        String(
            seat.status ||
            allocation.status ||
            ""
        )
            .toLowerCase()
            .trim();

    if (
        status === "assigned" ||
        status === "booked"
    ) {
        status = "occupied";
    }

    if (
        status === "disabled" ||
        status === "inactive"
    ) {
        status = "blocked";
    }

    if (!status) {

        status =
            studentRaw
                ? "occupied"
                : "available";
    }

    if (![
        "available",
        "occupied",
        "reserved",
        "maintenance",
        "blocked"
    ].includes(status)) {
        status = "available";
    }

    const notes =
        seat.notes ??
        seat.description ??
        "";

    const { room, blockReason } =
        parseNotes(notes, status);

    const position = seat.position || {};

    return {

        raw: seat,

        id:
            seat._id ??
            seat.id ??
            "",

        seatNumber:
            seat.seatNumber ??
            seat.number ??
            seat.name ??
            seat.code ??
            "Seat",

        name:
            seat.name ??
            seat.seatName ??
            seat.seatNumber ??
            seat.number ??
            "",

        floor:
            seat.floor ??
            seat.floorName ??
            "Floor 1",

        zone:
            seat.zone ??
            seat.section ??
            seat.sectionName ??
            seat.area ??
            "Main Hall",

        status,

        notes,

        room,

        blockReason,

        x:
            Number(
                seat.x ??
                position.x ??
                seat.column ??
                30
            ),

        y:
            Number(
                seat.y ??
                position.y ??
                seat.row ??
                30
            ),

        studentId:
            (studentRaw &&
                (studentRaw._id ??
                    studentRaw.id ??
                    studentRaw.studentId)) ??
            seat.studentId ??
            seat.learnerId ??
            seat.currentStudentId ??
            seat.currentLearnerId ??
            "",

        student:
            normalizeStudent(studentRaw),

        checkIn:
            allocation.checkIn ??
            seat.checkIn ??
            seat.checkInTime ??
            seat.currentCheckIn ??
            "",

        allocatedAt:
            allocation.allocatedAt ||
            allocation.startDate ||
            allocation.createdAt ||
            seat.allocatedAt ||
            null,

        updatedAt:
            seat.updatedAt ??
            ""
    };
}


/* =========================================================
   LOAD DATA (API)
========================================================= */

async function loadSeats() {

    try {

        const payload =
            await apiRequest(
                "/api/seats"
            );

        state.seats =
            unwrapList(payload)
                .map(normalizeSeat)
                .filter(Boolean);

        showChartError(null);

    } catch (error) {

        console.error(
            "[SeatChart] Load seats failed:",
            error
        );

        state.seats = [];

        showChartError(
            error.message ||
            "Unable to load seats."
        );
    }
}


async function loadStudents() {

    try {

        const payload =
            await apiRequest(
                "/api/learners"
            );

        state.students =
            unwrapList(payload)
                .map(normalizeStudent)
                .filter(Boolean);

    } catch (error) {

        /*
         * No fake students are created. Occupied seats
         * without a joined student record simply show
         * whatever the seat itself already carries.
         */
        console.warn(
            "[SeatChart] Students unavailable:",
            error.message
        );

        state.students = [];
    }
}


async function loadOwnerInfo() {

    try {

        const payload =
            await apiRequest(
                "/api/auth/me"
            );

        const user =
            payload?.data?.user ||
            payload?.user ||
            payload?.data ||
            payload;

        const name =
            user?.name ||
            user?.fullName ||
            user?.loginId ||
            "Owner";

        $("ownerName").textContent = name;

        $("ownerAvatar").textContent =
            getInitials(name);

    } catch (error) {

        console.warn(
            "[SeatChart] Owner info unavailable:",
            error.message
        );
    }
}


/* =========================================================
   OCCUPANT RESOLUTION
========================================================= */

function resolveOccupant(seat) {

    if (seat.student) {
        return seat.student;
    }

    if (!seat.studentId) {
        return null;
    }

    return (
        state.students.find(
            student =>
                String(student.id) === String(seat.studentId) ||
                String(student.studentId) === String(seat.studentId)
        ) || null
    );
}


/* =========================================================
   FILTERS
========================================================= */

function getFilteredSeats() {

    return state.seats.filter(seat => {

        const floorMatch =
            state.filters.floor === "all" ||
            String(seat.floor) === String(state.filters.floor);

        const roomMatch =
            state.filters.room === "all" ||
            String(seat.zone) === String(state.filters.room);

        const statusMatch =
            state.filters.status === "all" ||
            seat.status === state.filters.status;

        return floorMatch && roomMatch && statusMatch;
    });
}


function populateFilters() {

    const floorSelect = $("floorFilter");
    const roomSelect = $("roomFilter");

    const floors = [
        ...new Set(
            state.seats
                .map(seat => seat.floor)
                .filter(Boolean)
        )
    ];

    const zones = [
        ...new Set(
            state.seats
                .map(seat => seat.zone)
                .filter(Boolean)
        )
    ];

    floorSelect.innerHTML =
        `<option value="all">All Floors</option>` +
        floors
            .map(
                floor =>
                    `<option value="${escapeHtml(floor)}">${escapeHtml(floor)}</option>`
            )
            .join("");

    roomSelect.innerHTML =
        `<option value="all">All Sections</option>` +
        zones
            .map(
                zone =>
                    `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`
            )
            .join("");

    floorSelect.value = state.filters.floor;
    roomSelect.value = state.filters.room;
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    const total = state.seats.length;

    const available =
        state.seats.filter(
            seat => seat.status === "available"
        ).length;

    const occupied =
        state.seats.filter(
            seat => seat.status === "occupied"
        ).length;

    const reserved =
        state.seats.filter(
            seat => seat.status === "reserved"
        ).length;

    const maintenance =
        state.seats.filter(
            seat => seat.status === "maintenance"
        ).length;

    const blocked =
        state.seats.filter(
            seat => seat.status === "blocked"
        ).length;

    $("totalSeats").textContent = total;
    $("availableSeats").textContent = available;
    $("occupiedSeats").textContent = occupied;
    $("reservedSeats").textContent = reserved;
    $("maintenanceSeats").textContent = maintenance;
    $("blockedSeats").textContent = blocked;
}


/* =========================================================
   SEAT STATUS
========================================================= */

function statusLabel(status) {

    const labels = {
        available: "Available",
        occupied: "Occupied",
        reserved: "Reserved",
        maintenance: "Maintenance",
        blocked: "Blocked"
    };

    return labels[status] || "Available";
}


/* =========================================================
   RENDER CHART
========================================================= */

function renderChart() {

    const seats = getFilteredSeats();

    updateStats();

    populateFilters();

    const existingSeats =
        seatCanvas.querySelectorAll(".seat");

    existingSeats.forEach(element => {
        element.remove();
    });

    if (!seats.length) {
        emptyChart.classList.remove("hidden");
        return;
    }

    emptyChart.classList.add("hidden");

    seatCanvas.classList.toggle(
        "editing",
        state.editing
    );

    seats.forEach(seat => {

        const element =
            document.createElement("button");

        element.type = "button";

        const cssStatus =
            (seat.status === "maintenance")
                ? "blocked maintenance"
                : seat.status;

        element.className =
            `seat ${escapeHtml(cssStatus)}`;

        if (
            String(state.selectedSeatId) ===
            String(seat.id)
        ) {
            element.classList.add("selected");
        }

        element.style.left =
            `${Math.max(10, Number(seat.x) || 10)}px`;

        element.style.top =
            `${Math.max(10, Number(seat.y) || 10)}px`;


        const occupant =
            resolveOccupant(seat);

        let occupantText = "";

        if (
            seat.status === "occupied" &&
            occupant
        ) {
            occupantText =
                occupant.name || occupant.studentId || "";
        } else if (
            seat.status === "occupied" &&
            seat.studentId
        ) {
            occupantText =
                `Student ${seat.studentId}`;
        } else if (
            seat.status === "maintenance"
        ) {
            occupantText =
                "Maintenance";
        } else if (
            seat.status === "blocked"
        ) {
            occupantText =
                "Blocked";
        } else if (
            seat.status === "reserved"
        ) {
            occupantText =
                "Reserved";
        }


        element.innerHTML = `
            <span class="seat-number">
                ${escapeHtml(seat.seatNumber)}
            </span>

            <span class="seat-status">
                ${escapeHtml(statusLabel(seat.status))}
            </span>

            ${
                occupantText
                    ? `<span class="seat-occupant">
                        ${escapeHtml(occupantText)}
                       </span>`
                    : ""
            }

            <span class="seat-edit-handle">
                ↕
            </span>
        `;


        element.addEventListener(
            "click",
            event => {

                if (state.editing) {
                    event.preventDefault();
                    return;
                }

                selectSeat(seat.id);
            }
        );


        element.addEventListener(
            "pointerdown",
            event => {

                if (!state.editing) {
                    return;
                }

                startDragging(
                    event,
                    seat,
                    element
                );
            }
        );


        seatCanvas.appendChild(element);
    });


    updateChartTitle(seats);

    // Keep a large virtual room behind the seats so absolute-positioned
    // seats remain freely placeable without making the phone viewport huge.
    const maxX = seats.reduce(
        (max, item) => Math.max(max, Number(item.x) || 0),
        0
    );

    const maxY = seats.reduce(
        (max, item) => Math.max(max, Number(item.y) || 0),
        0
    );

    const roomWidth = Math.max(
        1100,
        maxX + 180
    );

    const roomHeight = Math.max(
        850,
        maxY + 150
    );

    seatCanvas.style.setProperty(
        "--seat-room-width",
        `${roomWidth}px`
    );

    seatCanvas.style.setProperty(
        "--seat-room-height",
        `${roomHeight}px`
    );
}


function showChartError(message) {

    const titleEl = $("emptyChartTitle");
    const messageEl = $("emptyChartMessage");

    if (!titleEl || !messageEl) {
        return;
    }

    if (message) {

        titleEl.textContent =
            "Unable to load seats";

        messageEl.textContent =
            message;

    } else {

        titleEl.textContent =
            "No seats found";

        messageEl.textContent =
            "Add seats from the Seats page to build your layout.";
    }
}


/* =========================================================
   CHART TITLE
========================================================= */

function updateChartTitle(seats) {

    if (!seats.length) {
        $("chartRoomTitle").textContent =
            "Library Seating Area";

        $("chartRoomSubtitle").textContent =
            "No seats available";

        return;
    }

    const zones = [
        ...new Set(
            seats
                .map(seat => seat.zone)
                .filter(Boolean)
        )
    ];

    if (zones.length === 1) {

        $("chartRoomTitle").textContent =
            zones[0];

    } else {

        $("chartRoomTitle").textContent =
            "Library Seating Area";
    }

    const floors = [
        ...new Set(
            seats
                .map(seat => seat.floor)
                .filter(Boolean)
        )
    ];

    $("chartRoomSubtitle").textContent =
        floors.length === 1
            ? floors[0]
            : `${seats.length} seats`;
}


/* =========================================================
   SELECT SEAT
========================================================= */

function selectSeat(seatId) {

    const seat =
        state.seats.find(
            item =>
                String(item.id) ===
                String(seatId)
        );

    if (!seat) {
        return;
    }

    state.selectedSeatId = seat.id;

    renderChart();
    renderDetails(seat);
}


/* =========================================================
   DETAILS
========================================================= */

function renderDetails(seat) {

    detailsEmpty.classList.add("hidden");
    detailsContent.classList.remove("hidden");

    $("detailSeatNumber").textContent =
        seat.seatNumber || "Seat";

    $("detailSeatName").textContent =
        seat.name || "—";

    $("detailRoom").textContent =
        seat.room || "—";

    $("detailFloor").textContent =
        seat.floor || "—";

    $("detailSection").textContent =
        seat.zone || "—";


    const statusElement =
        $("detailStatus");

    statusElement.textContent =
        statusLabel(seat.status);

    statusElement.className =
        `seat-status-large ${seat.status}`;


    const occupant =
        resolveOccupant(seat);


    /*
     * OCCUPIED
     */

    if (seat.status === "occupied") {

        $("occupantSection")
            .classList.remove("hidden");

        $("blockSection")
            .classList.add("hidden");

        $("occupantName").textContent =
            occupant?.name ||
            (seat.studentId
                ? `Student ${seat.studentId}`
                : "Occupant data unavailable");

        $("occupantStudentId").textContent =
            occupant?.studentId ||
            seat.studentId ||
            "—";

        $("occupantMobile").textContent =
            occupant?.mobile ||
            "—";

        $("occupantMembership").textContent =
            occupant?.membership ||
            "—";

        $("occupantValidity").textContent =
            formatValidity(
                occupant?.membershipStart,
                occupant?.membershipEnd
            );

        $("occupantCheckIn").textContent =
            formatDateTime(
                seat.checkIn ||
                occupant?.checkIn
            );

        $("occupantDuration").textContent =
            formatDuration(
                seat.checkIn ||
                occupant?.checkIn
            );

        $("occupantAvatar").textContent =
            getInitials(
                occupant?.name ||
                "Student"
            );

        $("assignSeatBtn")
            .classList.add("hidden");

        $("editSeatBtn")
            .classList.add("hidden");

        $("releaseSeatBtn")
            ?.classList.remove("hidden");

        return;
    }


    $("editSeatBtn")
        .classList.remove("hidden");

    $("releaseSeatBtn")
        ?.classList.add("hidden");


    /*
     * BLOCKED / MAINTENANCE
     */

    if (
        seat.status === "blocked" ||
        seat.status === "maintenance"
    ) {

        $("occupantSection")
            .classList.add("hidden");

        $("blockSection")
            .classList.remove("hidden");

        $("blockSection").querySelector("h3").textContent =
            seat.status === "maintenance"
                ? "Maintenance"
                : "Blocked";

        $("blockReason").textContent =
            seat.blockReason ||
            "No reason provided.";

        $("assignSeatBtn")
            .classList.add("hidden");

        return;
    }


    /*
     * AVAILABLE / RESERVED
     */

    $("occupantSection")
        .classList.add("hidden");

    $("blockSection")
        .classList.add("hidden");

    if (seat.status === "available") {

        $("assignSeatBtn")
            .classList.remove("hidden");

    } else {

        $("assignSeatBtn")
            .classList.add("hidden");
    }
}


function formatValidity(start, end) {

    if (!start && !end) {
        return "—";
    }

    if (start && end) {
        return `${formatDateTime(start)} → ${formatDateTime(end)}`;
    }

    return formatDateTime(
        end || start
    );
}


/* =========================================================
   EDIT MODE
========================================================= */

function setEditMode(enabled) {

    state.editing = enabled;

    $("editLayoutBtn").textContent =
        enabled
            ? "Done Editing"
            : "Edit Layout";

    $("editModeBadge").textContent =
        enabled
            ? "Edit Mode"
            : "View Mode";

    $("editModeBadge")
        .classList.toggle(
            "editing",
            enabled
        );

    renderChart();
}


/* =========================================================
   DRAG SEATS (position persisted via PATCH /api/seats/:id)
========================================================= */

function startDragging(event, seat, element) {

    if (!state.editing) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Prevent the browser from treating this gesture as page scrolling,
    // text selection, or a second pointer interaction.
    try {
        element.setPointerCapture(event.pointerId);
    } catch {
        // Pointer capture is not available in every embedded browser.
    }

    const startX = event.clientX;
    const startY = event.clientY;

    const originalX =
        Number(seat.x) || 10;

    const originalY =
        Number(seat.y) || 10;

    const pointerId =
        event.pointerId;

    state.dragging = {
        seat,
        element,
        pointerId,
        startX,
        startY,
        originalX,
        originalY
    };

    let moved = false;

    const moveHandler =
        moveEvent => {

            const drag =
                state.dragging;

            if (!drag) {
                return;
            }

            if (
                moveEvent.pointerId !==
                drag.pointerId
            ) {
                return;
            }

            moveEvent.preventDefault();
            moveEvent.stopPropagation();

            const deltaX =
                moveEvent.clientX -
                drag.startX;

            const deltaY =
                moveEvent.clientY -
                drag.startY;

            if (
                Math.abs(deltaX) > 2 ||
                Math.abs(deltaY) > 2
            ) {
                moved = true;
            }

            const newX =
                Math.max(
                    10,
                    drag.originalX + deltaX
                );

            const newY =
                Math.max(
                    10,
                    drag.originalY + deltaY
                );

            const maxX =
                Math.max(
                    10,
                    parseFloat(
                        getComputedStyle(seatCanvas)
                            .getPropertyValue("--seat-room-width")
                    ) - 100
                );

            const maxY =
                Math.max(
                    10,
                    parseFloat(
                        getComputedStyle(seatCanvas)
                            .getPropertyValue("--seat-room-height")
                    ) - 90
                );

            drag.seat.x =
                Math.min(newX, maxX);

            drag.seat.y =
                Math.min(newY, maxY);

            drag.element.style.left =
                `${drag.seat.x}px`;

            drag.element.style.top =
                `${drag.seat.y}px`;
        };

    const finishDrag =
        async () => {

            const drag =
                state.dragging;

            if (!drag) {
                return;
            }

            if (
                event.pointerId !==
                drag.pointerId
            ) {
                return;
            }

            state.dragging = null;

            element.removeEventListener(
                "pointermove",
                moveHandler
            );

            element.removeEventListener(
                "pointerup",
                finishDrag
            );

            element.removeEventListener(
                "pointercancel",
                cancelDrag
            );

            try {
                element.releasePointerCapture(
                    pointerId
                );
            } catch {
                // Ignore unsupported release.
            }

            if (!moved) {
                return;
            }

            try {

                await apiRequest(
                    `/api/seats/${encodeURIComponent(seat.id)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            x: seat.x,
                            y: seat.y
                        })
                    }
                );

                showToast(
                    "Seat position saved."
                );

            } catch (error) {

                console.error(
                    "[SeatChart] Position save failed:",
                    error
                );

                showToast(
                    error.message ||
                    "Unable to save seat position.",
                    "error"
                );

                // Reload the canonical saved position if the PATCH fails.
                await loadData();
            }
        };

    const cancelDrag =
        () => {

            if (!state.dragging) {
                return;
            }

            state.dragging = null;

            element.removeEventListener(
                "pointermove",
                moveHandler
            );

            element.removeEventListener(
                "pointerup",
                finishDrag
            );

            element.removeEventListener(
                "pointercancel",
                cancelDrag
            );

            try {
                element.releasePointerCapture(
                    pointerId
                );
            } catch {
                // Ignore unsupported release.
            }
        };

    // IMPORTANT:
    // Listeners belong to THIS seat element, not document.
    // Therefore another seat can never receive this drag gesture.
    element.addEventListener(
        "pointermove",
        moveHandler
    );

    element.addEventListener(
        "pointerup",
        finishDrag
    );

    element.addEventListener(
        "pointercancel",
        cancelDrag
    );
}


/* =========================================================
   EDIT SEAT MODAL
========================================================= */

function openEditModal(seat) {

    if (!seat) {
        return;
    }

    $("modalTitle").textContent =
        "Edit Seat";

    $("seatId").value =
        seat.id;

    $("seatNumber").value =
        seat.seatNumber || "";

    $("seatName").value =
        seat.name || "";

    $("seatFloor").value =
        seat.floor || "";

    $("seatRoom").value =
        seat.room || "";

    $("seatSection").value =
        seat.zone || "";

    $("seatStatus").value =
        ["available", "maintenance", "blocked"].includes(seat.status)
            ? seat.status
            : "available";

    $("seatBlockReason").value =
        seat.blockReason || "";

    seatModal.classList.remove(
        "hidden"
    );
}


function closeEditModal() {

    seatModal.classList.add(
        "hidden"
    );
}


/* =========================================================
   SAVE SEAT (POST create / PATCH edit)
========================================================= */

async function saveSeatFromForm(event) {

    event.preventDefault();

    const id =
        $("seatId").value;

    const seatNumber =
        $("seatNumber").value.trim();

    if (!seatNumber) {
        showToast(
            "Seat number is required.",
            "error"
        );
        return;
    }

    const duplicate =
        state.seats.some(
            item =>
                String(item.id) !== String(id) &&
                String(item.seatNumber)
                    .toLowerCase() ===
                seatNumber.toLowerCase()
        );

    if (duplicate) {

        showToast(
            "This seat number already exists.",
            "error"
        );

        return;
    }

    const room =
        $("seatRoom").value.trim();

    const zone =
        $("seatSection").value.trim() ||
        "Main Hall";

    const status =
        $("seatStatus").value;

    const blockReason =
        (status === "blocked" || status === "maintenance")
            ? $("seatBlockReason").value.trim()
            : "";

    const body = {
        seatNumber,
        name: $("seatName").value.trim(),
        floor: $("seatFloor").value.trim() || "Floor 1",
        zone,
        status,
        notes: composeNotes(room, blockReason)
    };

    const submitBtn =
        seatForm.querySelector('button[type="submit"]');

    if (submitBtn) {
        submitBtn.disabled = true;
    }

    try {

        if (id) {

            await apiRequest(
                `/api/seats/${encodeURIComponent(id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify(body)
                }
            );

            showToast(
                "Seat updated successfully."
            );

        } else {

            await apiRequest(
                "/api/seats",
                {
                    method: "POST",
                    body: JSON.stringify(body)
                }
            );

            showToast(
                "Seat created successfully."
            );
        }

        closeEditModal();

        await loadSeats();

        populateFilters();

        renderChart();

        if (state.selectedSeatId) {

            const refreshed =
                state.seats.find(
                    item =>
                        String(item.id) ===
                        String(state.selectedSeatId)
                );

            if (refreshed) {
                renderDetails(refreshed);
            }
        }

    } catch (error) {

        console.error(
            "[SeatChart] Save seat failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to save seat.",
            "error"
        );

    } finally {

        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}


/* =========================================================
   ALLOCATION (Assign / Release)
========================================================= */

function populateAllocationStudentSelect() {

    const select =
        $("allocationStudentSelect");

    if (!select) {
        return;
    }

    select.innerHTML =
        `<option value="">Select student</option>`;

    const available =
        state.students
            .filter(
                student =>
                    student.status !== "inactive"
            )
            .sort(
                (a, b) =>
                    (a.name || "").localeCompare(b.name || "")
            );

    available.forEach(student => {

        if (!student.id) {
            return;
        }

        const option =
            document.createElement("option");

        option.value = student.id;

        option.textContent =
            `${student.name}${
                student.studentId && student.studentId !== "—"
                    ? ` — ${student.studentId}`
                    : ""
            }`;

        select.appendChild(option);
    });
}


function openAllocationModal(seat) {

    if (!seat || !allocationModal) {
        return;
    }

    state.selectedSeatId = seat.id;

    $("allocationSeatName").textContent =
        seat.seatNumber;

    populateAllocationStudentSelect();

    $("allocationStudentSelect").value = "";

    clearAllocationError();

    allocationModal.classList.remove("hidden");
}


function closeAllocationModal() {

    allocationModal?.classList.add("hidden");
}


function showAllocationError(message) {

    const el = $("allocationError");

    if (!el) {
        return;
    }

    el.textContent = message;
    el.classList.remove("hidden");
}


function clearAllocationError() {

    const el = $("allocationError");

    if (!el) {
        return;
    }

    el.textContent = "";
    el.classList.add("hidden");
}


async function confirmAllocation(event) {

    event.preventDefault();

    clearAllocationError();

    const seatId =
        state.selectedSeatId;

    const studentId =
        $("allocationStudentSelect").value;

    if (!seatId) {

        showAllocationError(
            "Seat selection is missing."
        );

        return;
    }

    if (!studentId) {

        showAllocationError(
            "Please select a student."
        );

        return;
    }

    const button =
        $("confirmAllocationBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Allocating...";
    }

    try {

        await apiRequest(
            "/api/seat-allocations",
            {
                method: "POST",
                body: JSON.stringify({
                    seatId,
                    studentId
                })
            }
        );

        showToast(
            "Seat allocated successfully."
        );

        closeAllocationModal();

        await Promise.all([
            loadSeats(),
            loadStudents()
        ]);

        renderChart();

        const seat =
            state.seats.find(
                item =>
                    String(item.id) === String(seatId)
            );

        if (seat) {
            renderDetails(seat);
        }

    } catch (error) {

        console.error(
            "[SeatChart] Allocation failed:",
            error
        );

        showAllocationError(
            error.message ||
            "Unable to allocate seat."
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "Allocate Seat";
        }
    }
}


async function releaseSelectedSeat() {

    const seat =
        state.seats.find(
            item =>
                String(item.id) ===
                String(state.selectedSeatId)
        );

    if (!seat) {
        return;
    }

    const occupant =
        resolveOccupant(seat);

    const confirmed =
        window.confirm(
            `Release seat ${seat.seatNumber}${
                occupant?.name ? ` from ${occupant.name}` : ""
            }?`
        );

    if (!confirmed) {
        return;
    }

    try {

        await apiRequest(
            `/api/seat-allocations/${encodeURIComponent(seat.id)}/release`,
            {
                method: "POST"
            }
        );

        showToast(
            "Seat released successfully."
        );

        await Promise.all([
            loadSeats(),
            loadStudents()
        ]);

        renderChart();

        const refreshed =
            state.seats.find(
                item =>
                    String(item.id) === String(seat.id)
            );

        if (refreshed) {
            renderDetails(refreshed);
        }

    } catch (error) {

        console.error(
            "[SeatChart] Release failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to release seat.",
            "error"
        );
    }
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("backToSeatsBtn")
        .addEventListener(
            "click",
            () => {
                window.location.href =
                    "seats.html";
            }
        );


    $("editLayoutBtn")
        .addEventListener(
            "click",
            () => {
                setEditMode(
                    !state.editing
                );
            }
        );


    $("closeDetailsBtn")
        .addEventListener(
            "click",
            () => {

                state.selectedSeatId = null;

                detailsContent
                    .classList.add("hidden");

                detailsEmpty
                    .classList.remove("hidden");

                renderChart();
            }
        );


    $("editSeatBtn")
        .addEventListener(
            "click",
            () => {

                const seat =
                    state.seats.find(
                        item =>
                            String(item.id) ===
                            String(state.selectedSeatId)
                    );

                if (seat) {
                    openEditModal(seat);
                }
            }
        );


    $("assignSeatBtn")
        .addEventListener(
            "click",
            () => {

                const seat =
                    state.seats.find(
                        item =>
                            String(item.id) ===
                            String(state.selectedSeatId)
                    );

                if (!seat) {
                    return;
                }

                openAllocationModal(seat);
            }
        );


    $("releaseSeatBtn")
        ?.addEventListener(
            "click",
            releaseSelectedSeat
        );


    $("cancelModalBtn")
        .addEventListener(
            "click",
            closeEditModal
        );


    $("modalCloseBtn")
        .addEventListener(
            "click",
            closeEditModal
        );


    seatForm
        .addEventListener(
            "submit",
            saveSeatFromForm
        );


    seatModal
        .addEventListener(
            "click",
            event => {

                if (
                    event.target === seatModal
                ) {
                    closeEditModal();
                }
            }
        );


    allocationForm
        ?.addEventListener(
            "submit",
            confirmAllocation
        );


    $("cancelAllocationBtn")
        ?.addEventListener(
            "click",
            closeAllocationModal
        );


    $("closeAllocationModal")
        ?.addEventListener(
            "click",
            closeAllocationModal
        );


    allocationModal
        ?.addEventListener(
            "click",
            event => {

                if (event.target === allocationModal) {
                    closeAllocationModal();
                }
            }
        );


    $("floorFilter")
        .addEventListener(
            "change",
            event => {

                state.filters.floor =
                    event.target.value;

                renderChart();
            }
        );


    $("roomFilter")
        .addEventListener(
            "change",
            event => {

                state.filters.room =
                    event.target.value;

                renderChart();
            }
        );


    $("statusFilter")
        .addEventListener(
            "change",
            event => {

                state.filters.status =
                    event.target.value;

                renderChart();
            }
        );


    $("mobileMenuBtn")
        .addEventListener(
            "click",
            () => {

                $("ownerSidebar")
                    .classList.toggle("open");
            }
        );


    $("logoutBtn")
        .addEventListener(
            "click",
            () => {

                clearClientAuth();

                window.location.href =
                    "../index.html";
            }
        );


    document
        .querySelectorAll(".sidebar-nav a")
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {
                    $("ownerSidebar")
                        .classList.remove("open");
                }
            );
        });
}


/* =========================================================
   LIVE DURATION UPDATE
========================================================= */

function refreshSelectedDuration() {

    if (!state.selectedSeatId) {
        return;
    }

    const seat =
        state.seats.find(
            item =>
                String(item.id) ===
                String(state.selectedSeatId)
        );

    if (!seat || seat.status !== "occupied") {
        return;
    }

    const occupant =
        resolveOccupant(seat);

    $("occupantDuration").textContent =
        formatDuration(
            seat.checkIn ||
            occupant?.checkIn
        );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

    if (!requireAuth()) {
        return;
    }

    setupEvents();

    loadOwnerInfo();

    await Promise.all([
        loadSeats(),
        loadStudents()
    ]);

    updateStats();

    populateFilters();

    renderChart();
}


init();


setInterval(
    refreshSelectedDuration,
    60000
);
