"use strict";

/*
 * Mission Raj Library
 * Owner -> Attendance Management
 *
 * Backend is the source of truth.
 * No fake/demo attendance records are created.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";


const state = {
    records: [],
    filteredRecords: [],
    selectedRecord: null,
    checkoutRecord: null,
    students: []
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

    if (Array.isArray(payload?.attendance)) {
        return payload.attendance;
    }

    if (Array.isArray(payload?.data?.attendance)) {
        return payload.data.attendance;
    }

    if (Array.isArray(payload?.records)) {
        return payload.records;
    }

    return [];
}


/* =========================================================
   DATE
========================================================= */

function getLocalDateInputValue() {

    const now =
        new Date();


    const offset =
        now.getTimezoneOffset();


    const local =
        new Date(
            now.getTime() -
            offset * 60000
        );


    return local
        .toISOString()
        .slice(0, 10);
}


function formatDateForApi(
    date
) {

    return date ||
        getLocalDateInputValue();
}


function formatDisplayDate(
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

        return String(value);
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   NORMALIZE ATTENDANCE
========================================================= */

function normalizeAttendance(
    record
) {

    const student =
        record.student ||
        record.learner ||
        record.user ||
        {};


    const membership =
        record.membership ||
        student.membership ||
        {};


    const seat =
        record.seat ||
        record.currentSeat ||
        {};


    const checkIn =
        record.checkIn ||
        record.checkInTime ||
        record.inTime ||
        record.entryTime ||
        null;


    const checkOut =
        record.checkOut ||
        record.checkOutTime ||
        record.outTime ||
        record.exitTime ||
        null;


    let durationMinutes =
        Number(
            record.durationMinutes ??
            record.duration ??
            0
        );


    if (
        !durationMinutes &&
        checkIn &&
        checkOut
    ) {

        const start =
            new Date(checkIn)
                .getTime();


        const end =
            new Date(checkOut)
                .getTime();


        if (
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            end >= start
        ) {

            durationMinutes =
                Math.round(
                    (
                        end - start
                    ) / 60000
                );
        }
    }


    const studentName =
        student.name ||
        student.fullName ||
        record.studentName ||
        record.learnerName ||
        "Unknown Student";


    const studentId =
        student.studentId ||
        student.learnerId ||
        student.admissionId ||
        record.studentId ||
        record.learnerId ||
        "";


    const mobile =
        student.mobile ||
        student.phone ||
        record.mobile ||
        record.phone ||
        "";


    const seatNumber =
        seat.number ||
        seat.seatNumber ||
        record.seatNumber ||
        record.seatNo ||
        "—";


    const planName =
        membership.planName ||
        membership.name ||
        record.planName ||
        record.membershipName ||
        "—";


    const membershipEnd =
        membership.endDate ||
        membership.validUntil ||
        membership.expiryDate ||
        record.membershipEndDate ||
        record.membershipExpiry ||
        null;


    const membershipEndDate =
        membershipEnd
            ? new Date(membershipEnd)
            : null;

    if (membershipEndDate) {
        membershipEndDate.setHours(
            23,
            59,
            59,
            999
        );
    }

    const isExpired =
        membershipEndDate &&
        checkIn &&
        new Date(checkIn) >
        membershipEndDate;


    let status;

    if (checkOut) {
        status = "checked_out";
    } else if (checkIn) {
        status = "inside";
    } else {
        status = "unknown";
    }


    return {

        raw: record,

        id:
            record._id ||
            record.id ||
            "",

        date:
            record.date ||
            (
                checkIn
                    ? getDateOnly(checkIn)
                    : ""
            ),

        studentName,

        studentId,

        mobile,

        seatNumber,

        planName,

        membershipEnd,

        checkIn,

        checkOut,

        durationMinutes,

        status,

        isExpired:
            Boolean(isExpired)
    };
}


/* =========================================================
   LOAD ATTENDANCE
========================================================= */

async function loadAttendance() {

    showLoading();

    hideApiError();


    const selectedDate =
        $("attendanceDate").value;


    try {

        const query =
            new URLSearchParams();


        if (selectedDate) {

            query.set(
                "date",
                selectedDate
            );
        }


        /*
         * The endpoint accepts the selected
         * date when the backend supports it.
         */
        const path =
            `/api/attendance?${query.toString()}`;


        const payload =
            await apiRequest(
                path
            );


        state.records =
            unwrapList(payload)
                .map(
                    normalizeAttendance
                )
                .filter(
                    record =>
                        record.id
                );


        applyFilters();

        showTable();


    } catch (error) {

        console.error(
            "[Attendance]",
            error
        );


        showApiError(
            error.message ||
            "Unable to load attendance records."
        );
    }
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        $("attendanceSearch")
            .value
            .trim()
            .toLowerCase();


    const status =
        $("statusFilter")
            .value;


    const selectedDate =
        $("attendanceDate")
            .value;


    state.filteredRecords =
        state.records.filter(
            record => {

                const searchable =
                    [
                        record.studentName,
                        record.studentId,
                        record.mobile,
                        record.seatNumber,
                        record.planName
                    ]
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchable.includes(
                        search
                    );


                const matchesStatus =
                    status === "all" ||
                    record.status === status;


                /*
                 * Some backends return the date
                 * field while others return only
                 * check-in timestamps.
                 */
                const recordDate =
                    record.date ||
                    getDateOnly(
                        record.checkIn
                    );


                const matchesDate =
                    !selectedDate ||
                    recordDate ===
                        selectedDate;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesDate
                );
            }
        );


    renderStats();

    renderTable();
}


/* =========================================================
   STATS
========================================================= */

function renderStats() {

    const records =
        state.filteredRecords;


    const checkIns =
        records.filter(
            record =>
                Boolean(
                    record.checkIn
                )
        ).length;


    const inside =
        records.filter(
            record =>
                record.status ===
                "inside"
        ).length;


    const checkOuts =
        records.filter(
            record =>
                Boolean(
                    record.checkOut
                )
        ).length;


    const completedDurations =
        records
            .map(
                record =>
                    Number(
                        record.durationMinutes
                    )
            )
            .filter(
                value =>
                    Number.isFinite(
                        value
                    ) &&
                    value > 0
            );


    let average = 0;

    if (
        completedDurations.length
    ) {

        average =
            Math.round(
                completedDurations.reduce(
                    (
                        total,
                        value
                    ) =>
                        total + value,
                    0
                ) /
                completedDurations.length
            );
    }


    setText(
        "todayCheckIns",
        checkIns
    );


    setText(
        "currentlyInside",
        inside
    );


    setText(
        "todayCheckOuts",
        checkOuts
    );


    setText(
        "averageDuration",
        average
            ? formatDurationMinutes(
                average
            )
            : "—"
    );
}


/* =========================================================
   TABLE
========================================================= */

function renderTable() {

    const body =
        $("attendanceTableBody");


    setText(
        "recordCount",
        `${state.filteredRecords.length} ${
            state.filteredRecords.length === 1
                ? "record"
                : "records"
        }`
    );


    setText(
        "selectedDateLabel",
        formatDisplayDate(
            $("attendanceDate").value
        )
    );


    if (
        !state.filteredRecords.length
    ) {

        body.innerHTML = "";

        $("tableWrapper")
            .style.display =
            "none";

        $("emptyState")
            .style.display =
            "block";

        return;
    }


    $("emptyState")
        .style.display =
        "none";


    $("tableWrapper")
        .style.display =
        "block";


    body.innerHTML =
        state.filteredRecords
            .map(
                record =>
                    renderRow(
                        record
                    )
            )
            .join("");
}


function renderRow(
    record
) {

    const statusClass =
        record.status ===
        "inside"
            ? "inside"
            : "checked-out";


    const statusText =
        record.status ===
        "inside"
            ? "Inside"
            : "Checked Out";


    const expiryHtml =
        record.isExpired
            ? `
                <span class="expiry-mini">
                    Post-expiry visit
                </span>
            `
            : "";


    const checkoutButton =
        record.status ===
        "inside"
            ? `
                <button
                    type="button"
                    class="action-btn checkout"
                    data-action="checkout"
                    data-id="${escapeHtml(
                        record.id
                    )}"
                >
                    Check Out
                </button>
            `
            : `
                <button
                    type="button"
                    class="action-btn"
                    data-action="details"
                    data-id="${escapeHtml(
                        record.id
                    )}"
                >
                    View
                </button>
            `;


    return `
        <tr>

            <td>

                <div class="student-cell">

                    <div class="student-avatar">
                        ${escapeHtml(
                            getInitials(
                                record.studentName
                            )
                        )}
                    </div>

                    <div class="student-details">

                        <strong>
                            ${escapeHtml(
                                record.studentName
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                record.studentId ||
                                record.mobile ||
                                "—"
                            )}
                        </span>

                    </div>

                </div>

            </td>


            <td>

                <span class="seat-value">
                    ${escapeHtml(
                        record.seatNumber
                    )}
                </span>

            </td>


            <td>

                <span class="time-value">
                    ${formatTime(
                        record.checkIn
                    )}
                </span>

            </td>


            <td>

                <span class="time-value">
                    ${formatTime(
                        record.checkOut
                    )}
                </span>

            </td>


            <td>

                <span class="duration-value">
                    ${formatDurationMinutes(
                        record.durationMinutes
                    )}
                </span>

            </td>


            <td>

                <div class="membership-value">

                    <strong>
                        ${escapeHtml(
                            record.planName
                        )}
                    </strong>

                    ${expiryHtml}

                </div>

            </td>


            <td>

                <span class="status-pill ${statusClass}">
                    ${statusText}
                </span>

            </td>


            <td>
                ${checkoutButton}
            </td>

        </tr>
    `;
}


/* =========================================================
   DETAIL MODAL
========================================================= */

function openDetail(
    record
) {

    if (!record) {
        return;
    }


    state.selectedRecord =
        record;


    setText(
        "detailStudentName",
        record.studentName
    );


    setText(
        "detailAvatar",
        getInitials(
            record.studentName
        )
    );


    setText(
        "detailStudentId",
        record.studentId ||
        "Student ID unavailable"
    );


    setText(
        "detailStudentMobile",
        record.mobile ||
        "Mobile unavailable"
    );


    setText(
        "detailDate",
        formatDisplayDate(
            record.date ||
            getDateOnly(
                record.checkIn
            )
        )
    );


    setText(
        "detailSeat",
        record.seatNumber
    );


    setText(
        "detailCheckIn",
        formatTime(
            record.checkIn
        )
    );


    setText(
        "detailCheckOut",
        formatTime(
            record.checkOut
        )
    );


    setText(
        "detailDuration",
        formatDurationMinutes(
            record.durationMinutes
        )
    );


    setText(
        "detailMembership",
        record.planName
    );


    const warning =
        $("expiryWarning");


    warning.style.display =
        record.isExpired
            ? "block"
            : "none";


    const checkoutButton =
        $("modalCheckoutBtn");


    if (
        record.status ===
        "inside"
    ) {

        checkoutButton.style.display =
            "inline-flex";

    } else {

        checkoutButton.style.display =
            "none";
    }


    openModal(
        "attendanceDetailModal"
    );
}


/* =========================================================
   CHECKOUT
========================================================= */

function openCheckout(
    record
) {

    if (!record) {
        return;
    }


    state.checkoutRecord =
        record;


    setText(
        "checkoutMessage",
        `Confirm manual check-out for ${record.studentName}.`
    );


    setText(
        "checkoutCurrentTime",
        new Date().toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        )
    );


    openModal(
        "checkoutModal"
    );
}


async function confirmCheckout() {

    const record =
        state.checkoutRecord;


    if (!record) {
        return;
    }


    const button =
        $("confirmCheckoutBtn");


    button.disabled = true;

    button.textContent =
        "Checking out...";


    try {

        /*
         * Preferred endpoint:
         * POST /api/attendance/:id/checkout
         *
         * The backend remains the source
         * of the actual checkout timestamp.
         */
        await apiRequest(
            `/api/attendance/${encodeURIComponent(
                record.id
            )}/checkout`,
            {
                method: "POST"
            }
        );


        closeModal(
            "checkoutModal"
        );


        closeModal(
            "attendanceDetailModal"
        );


        showToast(
            `${record.studentName} checked out successfully.`
        );


        await loadAttendance();


    } catch (error) {

        console.error(
            "[Attendance] Checkout failed:",
            error
        );


        showToast(
            error.message ||
            "Unable to check out student."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Confirm Check-out";
    }
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("attendanceSearch")
        .addEventListener(
            "input",
            applyFilters
        );


    $("attendanceDate")
        .addEventListener(
            "change",
            loadAttendance
        );


    $("statusFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("refreshBtn")
        .addEventListener(
            "click",
            loadAttendance
        );


    $("retryBtn")
        .addEventListener(
            "click",
            loadAttendance
        );


    $("attendanceTableBody")
        .addEventListener(
            "click",
            handleTableAction
        );


    $("closeDetailModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "attendanceDetailModal"
                )
        );


    $("closeDetailBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "attendanceDetailModal"
                )
        );


    $("modalCheckoutBtn")
        .addEventListener(
            "click",
            () => {

                const record =
                    state.selectedRecord;


                if (!record) {
                    return;
                }


                closeModal(
                    "attendanceDetailModal"
                );


                openCheckout(
                    record
                );
            }
        );


    $("closeCheckoutModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "checkoutModal"
                )
        );


    $("cancelCheckoutBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "checkoutModal"
                )
        );


    $("confirmCheckoutBtn")
        .addEventListener(
            "click",
            confirmCheckout
        );


    $("checkInBtn")
        ?.addEventListener(
            "click",
            openCheckIn
        );


    $("closeCheckInModal")
        ?.addEventListener(
            "click",
            () =>
                closeModal(
                    "checkInModal"
                )
        );


    $("cancelCheckInBtn")
        ?.addEventListener(
            "click",
            () =>
                closeModal(
                    "checkInModal"
                )
        );


    $("confirmCheckInBtn")
        ?.addEventListener(
            "click",
            confirmCheckIn
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


function handleTableAction(
    event
) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {
        return;
    }


    const id =
        button.dataset.id;


    const record =
        state.records.find(
            item =>
                item.id === id
        );


    if (!record) {
        return;
    }


    if (
        button.dataset.action ===
        "details"
    ) {

        openDetail(
            record
        );

        return;
    }


    if (
        button.dataset.action ===
        "checkout"
    ) {

        openCheckout(
            record
        );
    }
}


/* =========================================================
   CHECK-IN
   (Owner Phase gap: this page previously had no way to
   check a student in at all — only checkout existed.)
========================================================= */

async function loadStudents() {

    try {

        const payload =
            await apiRequest(
                "/api/learners"
            );

        state.students =
            unwrapList(payload)
                .map(item => ({
                    id:
                        item._id ||
                        item.id ||
                        "",

                    studentId:
                        item.studentId ||
                        item.learnerId ||
                        item.admissionId ||
                        "—",

                    name:
                        item.name ||
                        item.fullName ||
                        "Unknown Student",

                    status:
                        String(
                            item.status ||
                            item.accountStatus ||
                            "active"
                        ).toLowerCase()
                }))
                .filter(item => item.id);

    } catch (error) {

        /*
         * No fake students are created if this fails.
         * The Check-in modal will simply show an empty
         * list and a clear error.
         */
        console.warn(
            "[Attendance] Students unavailable:",
            error.message
        );

        state.students = [];
    }
}


function populateCheckInSelect() {

    const select =
        $("checkInStudentSelect");

    if (!select) {
        return;
    }

    const currentlyInsideIds =
        new Set(
            state.records
                .filter(
                    record =>
                        record.status === "inside"
                )
                .map(
                    record =>
                        String(
                            record.raw?.student?._id ||
                            record.raw?.student?.id ||
                            record.raw?.studentId ||
                            ""
                        )
                )
        );

    const eligible =
        state.students
            .filter(
                student =>
                    student.status !== "inactive" &&
                    !currentlyInsideIds.has(String(student.id))
            )
            .sort(
                (a, b) =>
                    a.name.localeCompare(b.name)
            );

    select.innerHTML =
        `<option value="">Select student</option>` +
        eligible
            .map(
                student =>
                    `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}${
                        student.studentId && student.studentId !== "—"
                            ? ` — ${escapeHtml(student.studentId)}`
                            : ""
                    }</option>`
            )
            .join("");
}


function showCheckInError(message) {

    const el = $("checkInError");

    if (!el) {
        return;
    }

    el.textContent = message;
    el.classList.remove("hidden");
}


function clearCheckInError() {

    const el = $("checkInError");

    if (!el) {
        return;
    }

    el.textContent = "";
    el.classList.add("hidden");
}


function openCheckIn() {

    clearCheckInError();

    populateCheckInSelect();

    const select =
        $("checkInStudentSelect");

    if (select) {
        select.value = "";
    }

    openModal(
        "checkInModal"
    );
}


async function confirmCheckIn() {

    clearCheckInError();

    const studentId =
        $("checkInStudentSelect")
            .value;

    if (!studentId) {

        showCheckInError(
            "Please select a student."
        );

        return;
    }

    const button =
        $("confirmCheckInBtn");

    button.disabled = true;

    button.textContent =
        "Checking in...";

    try {

        /*
         * POST /api/attendance
         *
         * The backend remains the source of the actual
         * check-in timestamp, exactly like checkout above.
         * Membership validity is never changed here — an
         * expired student can still be checked in, and the
         * visit is simply flagged as post-expiry once the
         * record is loaded back (see normalizeAttendance's
         * isExpired calculation).
         */
        await apiRequest(
            "/api/attendance",
            {
                method: "POST",
                body: JSON.stringify({
                    studentId
                })
            }
        );

        closeModal(
            "checkInModal"
        );

        showToast(
            "Student checked in successfully."
        );

        await loadAttendance();

    } catch (error) {

        console.error(
            "[Attendance] Check-in failed:",
            error
        );

        showCheckInError(
            error.message ||
            "Unable to check in student."
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Confirm Check-in";
    }
}




/* =========================================================
   MODAL
========================================================= */

function openModal(id) {

    const modal =
        $(id);


    if (!modal) {
        return;
    }


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
   UI STATES
========================================================= */

function showLoading() {

    $("loadingState")
        .style.display =
        "flex";


    $("tableWrapper")
        .style.display =
        "none";


    $("emptyState")
        .style.display =
        "none";
}


function showTable() {

    $("loadingState")
        .style.display =
        "none";

    renderTable();
}


function showApiError(
    message
) {

    $("loadingState")
        .style.display =
        "none";


    $("tableWrapper")
        .style.display =
        "none";


    $("emptyState")
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

function getDateOnly(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value)
            .slice(0, 10);
    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;
}


function formatTime(
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

        return String(value);
    }


    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function formatDurationMinutes(
    minutes
) {

    const value =
        Number(minutes);


    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {

        return "—";
    }


    const hours =
        Math.floor(
            value / 60
        );


    const mins =
        value % 60;


    if (!hours) {

        return `${mins}m`;
    }


    if (!mins) {

        return `${hours}h`;
    }


    return `${hours}h ${mins}m`;
}


function getInitials(
    name
) {

    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!words.length) {
        return "S";
    }


    if (
        words.length === 1
    ) {

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


function escapeHtml(
    value
) {

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
     * Existing authentication/navigation
     * behaviour is intentionally unchanged.
     */

    if (!requireAuth()) {
        return;
    }


    $("attendanceDate").value =
        getLocalDateInputValue();


    setupEvents();


    await Promise.all([
        loadOwnerInfo(),
        loadAttendance(),
        loadStudents()
    ]);
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
            "[Attendance] Owner info unavailable:",
            error.message
        );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    init
);