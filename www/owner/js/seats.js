"use strict";

/*
 * Mission Raj Library
 * Owner -> Seat Management
 *
 * Backend is the source of truth.
 * No fake/demo seats are created.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";


const state = {
    seats: [],
    students: [],
    filteredSeats: [],
    editingSeatId: null,
    selectedSeat: null
};


/* =========================================================
   DOM
========================================================= */

const $ = id =>
    document.getElementById(id);


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

        headers["Content-Type"] =
            "application/json";
    }


    if (token) {

        headers["Authorization"] =
            `Bearer ${token}`;
    }


    const response =
        await fetch(
            `${API_BASE}${path}`,
            {
                ...options,
                headers
            }
        );


    let payload = null;

    try {

        payload =
            await response.json();

    } catch {

        payload = null;
    }


    if (response.status === 401) {

        clearClientAuth();

        window.location.href =
            "../index.html";

        throw new Error(
            "Your session has expired."
        );
    }


    if (!response.ok) {

        throw new Error(
            payload?.message ||
            payload?.error ||
            "Request failed."
        );
    }


    return payload;
}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

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

    return [];
}


/* =========================================================
   NORMALIZE SEAT
========================================================= */

function normalizeSeat(seat) {

    const allocation =
        seat.currentAllocation ||
        seat.allocation ||
        seat.activeAllocation ||
        {};


    const student =
        allocation.student ||
        seat.student ||
        seat.assignedStudent ||
        null;


    let status =
        String(
            seat.status ||
            allocation.status ||
            ""
        )
            .toLowerCase()
            .trim();


    if (!status) {

        status =
            student
                ? "occupied"
                : "available";
    }


    if (
        status === "assigned" ||
        status === "booked"
    ) {
        status = "occupied";
    }


    return {

        raw: seat,

        id:
            seat._id ||
            seat.id ||
            "",

        number:
            seat.seatNumber ||
            seat.number ||
            seat.name ||
            seat.code ||
            "Unnamed",

        floor:
            seat.floor ||
            seat.floorName ||
            "",

        zone:
            seat.zone ||
            seat.section ||
            seat.area ||
            "",

        status,

        notes:
            seat.notes ||
            seat.description ||
            "",

        student: student
            ? {
                id:
                    student._id ||
                    student.id ||
                    student.studentId ||
                    "",

                name:
                    student.name ||
                    student.fullName ||
                    `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
                    "Student",

                studentId:
                    student.studentId ||
                    student.learnerId ||
                    student.admissionId ||
                    ""
            }
            : null,

        allocatedAt:
            allocation.allocatedAt ||
            allocation.startDate ||
            allocation.createdAt ||
            seat.allocatedAt ||
            null
    };
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadSeats() {

    showLoading();

    hideApiError();


    try {

        const payload =
            await apiRequest(
                "/api/seats"
            );


        state.seats =
            unwrapList(payload)
                .map(normalizeSeat)
                .filter(
                    seat => seat.id
                );


        populateFloorFilter();

        applyFilters();

        showSeatSection();


    } catch (error) {

        console.error(
            "[Seats]",
            error
        );


        showApiError(
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
            unwrapList(payload);


        populateStudentSelect();


    } catch (error) {

        console.warn(
            "[Seats] Students unavailable:",
            error.message
        );
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


        setText(
            "ownerName",
            name
        );


        setText(
            "ownerAvatar",
            getInitials(name)
        );


    } catch (error) {

        console.warn(
            "[Seats] Owner info unavailable:",
            error.message
        );
    }
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        $("seatSearch")
            .value
            .trim()
            .toLowerCase();


    const status =
        $("statusFilter")
            .value;


    const floor =
        $("floorFilter")
            .value;


    state.filteredSeats =
        state.seats.filter(
            seat => {

                const searchable =
                    [
                        seat.number,
                        seat.floor,
                        seat.zone,
                        seat.student?.name,
                        seat.student?.studentId
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchable.includes(
                        search
                    );


                const matchesStatus =
                    status === "all" ||
                    seat.status === status;


                const matchesFloor =
                    floor === "all" ||
                    seat.floor === floor;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesFloor
                );
            }
        );


    renderStats();

    renderSeats();
}


function populateFloorFilter() {

    const select =
        $("floorFilter");


    const current =
        select.value;


    const floors =
        [
            ...new Set(
                state.seats
                    .map(
                        seat =>
                            seat.floor
                    )
                    .filter(Boolean)
            )
        ]
        .sort(
            (a, b) =>
                String(a)
                    .localeCompare(
                        String(b)
                    )
        );


    select.innerHTML = `
        <option value="all">
            All Floors
        </option>
    `;


    floors.forEach(
        floor => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                floor;

            option.textContent =
                floor;

            select.appendChild(
                option
            );
        }
    );


    if (
        floors.includes(current)
    ) {

        select.value =
            current;
    }
}


/* =========================================================
   STATS
========================================================= */

function renderStats() {

    const total =
        state.seats.length;


    const available =
        state.seats.filter(
            seat =>
                seat.status ===
                "available"
        ).length;


    const occupied =
        state.seats.filter(
            seat =>
                seat.status ===
                "occupied"
        ).length;


    const blocked =
        state.seats.filter(
            seat =>
                seat.status ===
                "blocked" ||
                seat.status ===
                "maintenance"
        ).length;


    setText(
        "totalSeats",
        total
    );


    setText(
        "availableSeats",
        available
    );


    setText(
        "occupiedSeats",
        occupied
    );


    setText(
        "blockedSeats",
        blocked
    );
}


/* =========================================================
   RENDER SEATS
========================================================= */

function renderSeats() {

    const grid =
        $("seatGrid");


    const empty =
        $("emptyState");


    setText(
        "seatResultCount",
        `${state.filteredSeats.length} ${
            state.filteredSeats.length === 1
                ? "seat"
                : "seats"
        }`
    );


    if (
        !state.filteredSeats.length
    ) {

        grid.innerHTML = "";

        empty.style.display =
            "block";

        return;
    }


    empty.style.display =
        "none";


    grid.innerHTML =
        state.filteredSeats
            .map(
                seat =>
                    renderSeatCard(
                        seat
                    )
            )
            .join("");
}


function renderSeatCard(seat) {

    const studentHtml =
        seat.student

            ? `
                <div class="seat-student">

                    <div class="student-mini-avatar">
                        ${escapeHtml(
                            getInitials(
                                seat.student.name
                            )
                        )}
                    </div>

                    <div class="seat-student-info">

                        <strong>
                            ${escapeHtml(
                                seat.student.name
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                seat.student.studentId ||
                                "Student"
                            )}
                        </span>

                    </div>

                </div>
            `

            : `
                <div class="seat-free">
                    No student allocated
                </div>
            `;


    const actions =
        getSeatActions(
            seat
        );


    return `
        <article
            class="seat-card ${escapeHtml(
                seat.status
            )}"
            data-seat-id="${escapeHtml(
                seat.id
            )}"
        >

            <div class="seat-card-header">

                <strong class="seat-number">
                    ${escapeHtml(
                        seat.number
                    )}
                </strong>

                <span class="seat-status ${escapeHtml(
                    seat.status
                )}">
                    ${escapeHtml(
                        formatStatus(
                            seat.status
                        )
                    )}
                </span>

            </div>


            <div class="seat-location">

                ${escapeHtml(
                    [
                        seat.floor,
                        seat.zone
                    ]
                        .filter(Boolean)
                        .join(" • ") ||
                    "Location not specified"
                )}

            </div>


            ${studentHtml}


            <div class="seat-actions">

                <button
                    type="button"
                    class="seat-action"
                    data-action="details"
                    data-id="${escapeHtml(
                        seat.id
                    )}"
                >
                    Details
                </button>

                ${actions}

            </div>

        </article>
    `;
}


function getSeatActions(seat) {

    if (
        seat.status ===
        "available"
    ) {

        return `
            <button
                type="button"
                class="seat-action primary"
                data-action="allocate"
                data-id="${escapeHtml(
                    seat.id
                )}"
            >
                Allocate
            </button>
        `;
    }


    if (
        seat.status ===
        "occupied"
    ) {

        return `
            <button
                type="button"
                class="seat-action danger"
                data-action="release"
                data-id="${escapeHtml(
                    seat.id
                )}"
            >
                Release
            </button>
        `;
    }


    return `
        <button
            type="button"
            class="seat-action primary"
            data-action="edit"
            data-id="${escapeHtml(
                seat.id
            )}"
        >
            Edit
        </button>
    `;
}


/* =========================================================
   SEAT FORM
========================================================= */

function openAddSeatModal() {

    state.editingSeatId =
        null;


    setText(
        "seatModalTitle",
        "Add Seat"
    );


    $("seatForm").reset();


    $("seatStatus").value =
        "available";


    clearSeatFormError();


    openModal(
        "seatModal"
    );
}


function openEditSeatModal(seat) {

    if (!seat) {
        return;
    }


    state.editingSeatId =
        seat.id;


    setText(
        "seatModalTitle",
        "Edit Seat"
    );


    $("seatNumber").value =
        seat.number || "";


    $("seatFloor").value =
        seat.floor || "";


    $("seatZone").value =
        seat.zone || "";


    $("seatStatus").value =
        isEditableStatus(
            seat.status
        )
            ? seat.status
            : "available";


    $("seatNotes").value =
        seat.notes || "";


    clearSeatFormError();


    openModal(
        "seatModal"
    );
}


async function saveSeat(event) {

    event.preventDefault();

    clearSeatFormError();


    const number =
        $("seatNumber")
            .value
            .trim();


    const floor =
        $("seatFloor")
            .value
            .trim();


    const zone =
        $("seatZone")
            .value
            .trim();


    const status =
        $("seatStatus")
            .value;


    const notes =
        $("seatNotes")
            .value
            .trim();


    if (!number) {

        showSeatFormError(
            "Seat number is required."
        );

        return;
    }


    const button =
        $("saveSeatBtn");


    button.disabled = true;

    button.textContent =
        "Saving...";


    try {

        const body = {
            seatNumber: number,
            floor,
            zone,
            status,
            notes
        };


        if (state.editingSeatId) {

            await apiRequest(
                `/api/seats/${encodeURIComponent(
                    state.editingSeatId
                )}`,
                {
                    method: "PATCH",
                    body:
                        JSON.stringify(body)
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
                    body:
                        JSON.stringify(body)
                }
            );


            showToast(
                "Seat created successfully."
            );
        }


        closeModal(
            "seatModal"
        );


        await loadSeats();


    } catch (error) {

        console.error(
            "[Seats] Save failed:",
            error
        );


        showSeatFormError(
            error.message ||
            "Unable to save seat."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Save Seat";
    }
}


/* =========================================================
   ALLOCATION
========================================================= */

function openAllocationModal(
    seat
) {

    if (!seat) {
        return;
    }


    state.selectedSeat =
        seat;


    setText(
        "allocationSeatName",
        seat.number
    );


    $("studentSelect").value =
        "";


    clearAllocationError();


    openModal(
        "allocationModal"
    );
}


async function allocateSeat(
    event
) {

    event.preventDefault();

    clearAllocationError();


    const studentId =
        $("studentSelect")
            .value;


    if (!studentId) {

        showAllocationError(
            "Please select a student."
        );

        return;
    }


    if (
        !state.selectedSeat
    ) {

        showAllocationError(
            "Seat selection is missing."
        );

        return;
    }


    const button =
        $("allocateBtn");


    button.disabled = true;

    button.textContent =
        "Allocating...";


    try {

        await apiRequest(
            "/api/seat-allocations",
            {
                method: "POST",

                body:
                    JSON.stringify({
                        seatId:
                            state.selectedSeat.id,

                        studentId
                    })
            }
        );


        closeModal(
            "allocationModal"
        );


        showToast(
            "Seat allocated successfully."
        );


        await loadSeats();


    } catch (error) {

        console.error(
            "[Seats] Allocation failed:",
            error
        );


        showAllocationError(
            error.message ||
            "Unable to allocate seat."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Allocate Seat";
    }
}


/* =========================================================
   RELEASE
========================================================= */

async function releaseSeat(
    seat
) {

    if (!seat) {
        return;
    }


    if (!seat.student?.id) {

        showToast(
            "This seat has no active student allocation."
        );

        return;
    }


    const confirmed =
        window.confirm(
            `Release seat ${seat.number} from ${seat.student.name}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `/api/seat-allocations/${encodeURIComponent(
                seat.id
            )}/release`,
            {
                method: "POST"
            }
        );


        showToast(
            "Seat released successfully."
        );


        await loadSeats();


    } catch (error) {

        console.error(
            "[Seats] Release failed:",
            error
        );


        showToast(
            error.message ||
            "Unable to release seat."
        );
    }
}


/* =========================================================
   DETAIL MODAL
========================================================= */

function openSeatDetails(
    seat
) {

    if (!seat) {
        return;
    }


    state.selectedSeat =
        seat;


    setText(
        "detailSeatTitle",
        `Seat ${seat.number}`
    );


    setText(
        "detailSeatStatus",
        formatStatus(
            seat.status
        )
    );


    setText(
        "detailSeatFloor",
        seat.floor || "Not specified"
    );


    setText(
        "detailSeatZone",
        seat.zone || "Not specified"
    );


    setText(
        "detailSeatStudent",
        seat.student?.name ||
        "No student"
    );


    setText(
        "detailSeatAllocated",
        formatDateTime(
            seat.allocatedAt
        )
    );


    const notes =
        $("detailSeatNotes");


    if (seat.notes) {

        notes.textContent =
            seat.notes;

        notes.classList.add(
            "show"
        );

    } else {

        notes.textContent = "";

        notes.classList.remove(
            "show"
        );
    }


    const action =
        $("detailActionBtn");


    if (
        seat.status ===
        "available"
    ) {

        action.textContent =
            "Allocate Seat";

        action.dataset.action =
            "allocate";

    } else if (
        seat.status ===
        "occupied"
    ) {

        action.textContent =
            "Release Seat";

        action.dataset.action =
            "release";

    } else {

        action.textContent =
            "Edit Seat";

        action.dataset.action =
            "edit";
    }


    openModal(
        "detailModal"
    );
}


/* =========================================================
   DETAIL ACTION
========================================================= */

function handleDetailAction() {

    const action =
        $("detailActionBtn")
            .dataset.action;


    const seat =
        state.selectedSeat;


    if (!seat) {
        return;
    }


    closeModal(
        "detailModal"
    );


    if (
        action ===
        "allocate"
    ) {

        openAllocationModal(
            seat
        );

        return;
    }


    if (
        action ===
        "release"
    ) {

        releaseSeat(
            seat
        );

        return;
    }


    if (
        action ===
        "edit"
    ) {

        openEditSeatModal(
            seat
        );
    }
}


/* =========================================================
   STUDENTS
========================================================= */

function populateStudentSelect() {

    const select =
        $("studentSelect");


    select.innerHTML = `
        <option value="">
            Select student
        </option>
    `;


    const students =
        state.students
            .filter(
                student =>
                    normalizeStudentStatus(
                        student
                    ) !==
                    "inactive"
            )
            .sort(
                (a, b) =>
                    getStudentName(a)
                        .localeCompare(
                            getStudentName(b)
                        )
            );


    students.forEach(
        student => {

            const id =
                student._id ||
                student.id ||
                student.studentId ||
                "";


            if (!id) {
                return;
            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                id;


            option.textContent =
                `${getStudentName(student)}${
                    getStudentCode(student)
                        ? ` — ${getStudentCode(student)}`
                        : ""
                }`;


            select.appendChild(
                option
            );
        }
    );
}


function getStudentName(
    student
) {

    return (
        student.name ||
        student.fullName ||
        `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
        "Unnamed Student"
    );
}


function getStudentCode(
    student
) {

    return (
        student.studentId ||
        student.learnerId ||
        student.admissionId ||
        ""
    );
}


function normalizeStudentStatus(
    student
) {

    return String(
        student.status ||
        student.accountStatus ||
        "active"
    )
        .toLowerCase()
        .trim();
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("seatSearch")
        .addEventListener(
            "input",
            applyFilters
        );


    $("statusFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("floorFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("addSeatBtn")
        .addEventListener(
            "click",
            openAddSeatModal
        );


    $("seatForm")
        .addEventListener(
            "submit",
            saveSeat
        );


    $("allocationForm")
        .addEventListener(
            "submit",
            allocateSeat
        );


    $("closeSeatModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "seatModal"
                )
        );


    $("cancelSeatBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "seatModal"
                )
        );


    $("closeAllocationModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "allocationModal"
                )
        );


    $("cancelAllocationBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "allocationModal"
                )
        );


    $("closeDetailModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "detailModal"
                )
        );


    $("closeDetailBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "detailModal"
                )
        );


    $("detailActionBtn")
        .addEventListener(
            "click",
            handleDetailAction
        );


    $("retryBtn")
        .addEventListener(
            "click",
            loadSeats
        );


    $("mobileMenuBtn")
        .addEventListener(
            "click",
            openSidebar
        );


    $("sidebarOverlay")
        .addEventListener(
            "click",
            closeSidebar
        );


    $("notificationBtn")
        .addEventListener(
            "click",
            () => {
                window.location.href =
                    "notifications.html";
            }
        );


    $("logoutBtn")
        .addEventListener(
            "click",
            logout
        );


    /*
     * Event delegation for seat cards.
     */
    $("seatGrid")
        .addEventListener(
            "click",
            handleSeatGridClick
        );


    /*
     * Close modal by clicking backdrop.
     */
    document
        .querySelectorAll(
            ".modal-backdrop"
        )
        .forEach(
            backdrop => {

                backdrop.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target ===
                            backdrop
                        ) {

                            closeModal(
                                backdrop.id
                            );
                        }
                    }
                );
            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                document
                    .querySelectorAll(
                        ".modal-backdrop.open"
                    )
                    .forEach(
                        modal =>
                            closeModal(
                                modal.id
                            )
                    );

                closeSidebar();
            }
        }
    );
}


function handleSeatGridClick(
    event
) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {
        return;
    }


    const action =
        button.dataset.action;


    const id =
        button.dataset.id;


    const seat =
        state.seats.find(
            item =>
                item.id === id
        );


    if (!seat) {
        return;
    }


    if (
        action ===
        "details"
    ) {

        openSeatDetails(
            seat
        );

        return;
    }


    if (
        action ===
        "allocate"
    ) {

        openAllocationModal(
            seat
        );

        return;
    }


    if (
        action ===
        "release"
    ) {

        releaseSeat(
            seat
        );

        return;
    }


    if (
        action ===
        "edit"
    ) {

        openEditSeatModal(
            seat
        );
    }
}


/* =========================================================
   MODAL HELPERS
========================================================= */

function openModal(id) {

    const modal =
        $(id);


    modal.classList.add(
        "open"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function closeModal(id) {

    const modal =
        $(id);


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "open"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   UI STATE
========================================================= */

function showLoading() {

    $("loadingState")
        .style.display =
        "flex";


    $("seatSection")
        .style.display =
        "none";
}


function showSeatSection() {

    $("loadingState")
        .style.display =
        "none";


    $("seatSection")
        .style.display =
        "block";
}


function showApiError(
    message
) {

    $("loadingState")
        .style.display =
        "none";


    $("seatSection")
        .style.display =
        "none";


    $("apiError")
        .style.display =
        "flex";


    setText(
        "apiErrorMessage",
        message
    );
}


function hideApiError() {

    $("apiError")
        .style.display =
        "none";
}


/* =========================================================
   FORM ERRORS
========================================================= */

function showSeatFormError(
    message
) {

    const error =
        $("seatFormError");


    error.textContent =
        message;


    error.classList.add(
        "show"
    );
}


function clearSeatFormError() {

    const error =
        $("seatFormError");


    error.textContent = "";

    error.classList.remove(
        "show"
    );
}


function showAllocationError(
    message
) {

    const error =
        $("allocationError");


    error.textContent =
        message;


    error.classList.add(
        "show"
    );
}


function clearAllocationError() {

    const error =
        $("allocationError");


    error.textContent = "";

    error.classList.remove(
        "show"
    );
}


/* =========================================================
   SIDEBAR / LOGOUT
========================================================= */

function openSidebar() {

    $("sidebar")
        .classList.add(
            "open"
        );


    $("sidebarOverlay")
        .classList.add(
            "show"
        );
}


function closeSidebar() {

    $("sidebar")
        .classList.remove(
            "open"
        );


    $("sidebarOverlay")
        .classList.remove(
            "show"
        );
}


function logout() {

    clearClientAuth();

    window.location.href =
        "../index.html";
}


/* =========================================================
   HELPERS
========================================================= */

function isEditableStatus(
    status
) {

    return [
        "available",
        "maintenance",
        "blocked"
    ].includes(
        status
    );
}


function formatStatus(
    status
) {

    const labels = {
        available: "Available",
        occupied: "Occupied",
        reserved: "Reserved",
        maintenance: "Maintenance",
        blocked: "Blocked"
    };


    return (
        labels[status] ||
        capitalize(status)
    );
}


function capitalize(value) {

    if (!value) {
        return "";
    }


    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function getInitials(name) {

    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!words.length) {
        return "O";
    }


    if (words.length === 1) {

        return words[0]
            .substring(0, 2)
            .toUpperCase();
    }


    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


function setText(
    id,
    value
) {

    const element =
        $(id);


    if (element) {
        element.textContent =
            value ?? "—";
    }
}


function formatDateTime(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";
    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function showToast(
    message
) {

    const toast =
        $("toast");


    setText(
        "toastMessage",
        message
    );


    toast.classList.add(
        "show"
    );


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

    /*
     * Current project intentionally keeps
     * the existing authentication behaviour.
     * Navigation/auth cleanup will be done later.
     */
    if (!requireAuth()) {
        return;
    }


    setupEvents();


    await Promise.all([
        loadOwnerInfo(),
        loadStudents(),
        loadSeats()
    ]);
}


document.addEventListener(
    "DOMContentLoaded",
    init
);