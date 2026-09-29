"use strict";

/*
 * Mission Raj Library
 * Owner -> Student Profile
 *
 * Backend is the source of truth.
 * No demo/fake student records.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";


const state = {
    studentId: null,
    student: null,
    payments: [],
    attendance: [],
    seatHistory: [],
    notifications: [],
    plans: []
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
   DATA HELPERS
========================================================= */

function unwrapObject(payload) {

    if (!payload) {
        return null;
    }

    if (payload.data?.student) {
        return payload.data.student;
    }

    if (payload.student) {
        return payload.student;
    }

    if (payload.data?.learner) {
        return payload.data.learner;
    }

    if (payload.learner) {
        return payload.learner;
    }

    if (payload.data) {
        return payload.data;
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

    if (Array.isArray(payload?.data?.payments)) {
        return payload.data.payments;
    }

    if (Array.isArray(payload?.data?.attendance)) {
        return payload.data.attendance;
    }

    if (Array.isArray(payload?.data?.records)) {
        return payload.data.records;
    }

    if (Array.isArray(payload?.data?.notifications)) {
        return payload.data.notifications;
    }

    if (Array.isArray(payload?.plans)) {
        return payload.plans;
    }

    if (Array.isArray(payload?.data?.plans)) {
        return payload.data.plans;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    return [];
}


/* =========================================================
   STUDENT NORMALIZATION
========================================================= */

function normalizeStudent(student) {

    const membership =
        student.membership ||
        student.currentMembership ||
        student.activeMembership ||
        {};


    const plan =
        membership.plan ||
        student.plan ||
        {};


    const seat =
        student.seat ||
        student.currentSeat ||
        student.assignedSeat ||
        {};


    const totalFee =
        Number(
            student.totalFee ??
            membership.totalFee ??
            student.fee?.total ??
            0
        );


    const paidFee =
        Number(
            student.paidFee ??
            membership.paidFee ??
            student.fee?.paid ??
            0
        );


    const pendingFee =
        Math.max(
            0,
            totalFee - paidFee
        );


    const endDate =
        membership.endDate ||
        membership.validUntil ||
        student.membershipEnd ||
        student.endDate ||
        "";


    return {

        raw: student,

        id:
            student._id ||
            student.id ||
            student.studentId ||
            "",

        studentId:
            student.studentId ||
            student.learnerId ||
            student.admissionId ||
            "—",

        name:
            student.name ||
            student.fullName ||
            `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
            "Unnamed Student",

        mobile:
            student.mobile ||
            student.phone ||
            student.phoneNumber ||
            "—",

        email:
            student.email ||
            "",

        address:
            student.address ||
            "",

        admissionDate:
            student.admissionDate ||
            student.joiningDate ||
            student.createdAt ||
            "",

        membershipName:
            plan.name ||
            membership.planName ||
            student.membershipName ||
            "No Plan",

        membershipStatus:
            normalizeStatus(
                membership.status ||
                student.membershipStatus ||
                calculateMembershipStatus(endDate)
            ),

        startDate:
            membership.startDate ||
            membership.validFrom ||
            student.membershipStart ||
            student.startDate ||
            "",

        endDate,

        seatName:
            seat.name ||
            seat.seatNumber ||
            seat.number ||
            student.seatNumber ||
            "Not Assigned",

        seatId:
            seat._id ||
            seat.id ||
            student.seatId ||
            "",

        totalFee,
        paidFee,
        pendingFee

    };
}


function normalizeStatus(value) {

    const status =
        String(value || "")
            .toLowerCase()
            .trim();


    if (
        status === "expired"
    ) {
        return "expired";
    }


    if (
        status === "pending"
    ) {
        return "pending";
    }


    if (
        status === "inactive"
    ) {
        return "inactive";
    }


    return "active";
}


function calculateMembershipStatus(
    endDate
) {

    if (!endDate) {
        return "pending";
    }


    const end =
        new Date(endDate);


    if (
        Number.isNaN(
            end.getTime()
        )
    ) {
        return "pending";
    }


    const today =
        new Date();


    today.setHours(
        0, 0, 0, 0
    );


    end.setHours(
        23, 59, 59, 999
    );


    return end >= today
        ? "active"
        : "expired";
}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    showLoading();


    try {

        /*
         * Primary learner endpoint.
         */
        const payload =
            await apiRequest(
                `/api/learners/${encodeURIComponent(
                    state.studentId
                )}`
            );


        state.student =
            normalizeStudent(
                unwrapObject(payload)
            );


        if (!state.student?.id) {

            throw new Error(
                "Invalid student record returned by the server."
            );
        }


        renderProfile();

        showProfile();


        /*
         * Related data is loaded independently.
         * A missing optional endpoint should not
         * destroy the main student profile.
         */
        await loadRelatedData();


    } catch (error) {

        console.error(
            "[Student Profile]",
            error
        );


        showError(
            error.message ||
            "Unable to load student profile."
        );
    }
}


/* =========================================================
   RELATED DATA
========================================================= */

async function loadRelatedData() {

    await Promise.allSettled([

        loadPayments(),

        loadAttendance(),

        loadSeatHistory(),

        loadNotifications(),

        loadPlans()

    ]);
}


/* =========================================================
   MEMBERSHIP PLANS (for renewal)
========================================================= */

async function loadPlans() {

    try {

        const payload =
            await apiRequest(
                "/api/plans"
            );

        state.plans =
            unwrapList(payload);

    } catch (error) {

        /*
         * No fake plans are created. The renewal modal
         * will simply show an empty plan list and a
         * clear error if this fails.
         */
        console.warn(
            "[StudentProfile] Plans unavailable:",
            error.message
        );

        state.plans = [];
    }
}


/* =========================================================
   PAYMENTS
========================================================= */

async function loadPayments() {

    try {

        const payload =
            await apiRequest(
                `/api/payments?studentId=${encodeURIComponent(
                    state.studentId
                )}`
            );


        state.payments =
            unwrapList(payload);


        renderPayments();


    } catch (error) {

        console.warn(
            "[Student Profile] Payments unavailable:",
            error.message
        );
    }
}


/* =========================================================
   ATTENDANCE
========================================================= */

async function loadAttendance() {

    try {

        const payload =
            await apiRequest(
                `/api/attendance?studentId=${encodeURIComponent(
                    state.studentId
                )}`
            );


        state.attendance =
            unwrapList(payload);


        renderAttendance();


    } catch (error) {

        console.warn(
            "[Student Profile] Attendance unavailable:",
            error.message
        );
    }
}


/* =========================================================
   SEAT HISTORY
========================================================= */

async function loadSeatHistory() {

    try {

        const payload =
            await apiRequest(
                `/api/seat-allocations?studentId=${encodeURIComponent(
                    state.studentId
                )}`
            );


        state.seatHistory =
            unwrapList(payload);


        renderSeatHistory();


    } catch (error) {

        console.warn(
            "[Student Profile] Seat history unavailable:",
            error.message
        );
    }
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function loadNotifications() {

    try {

        const payload =
            await apiRequest(
                `/api/notifications?studentId=${encodeURIComponent(
                    state.studentId
                )}`
            );


        state.notifications =
            unwrapList(payload);


        renderNotifications();


    } catch (error) {

        console.warn(
            "[Student Profile] Notifications unavailable:",
            error.message
        );
    }
}


/* =========================================================
   RENDER PROFILE
========================================================= */

function renderProfile() {

    const student =
        state.student;


    setText(
        "studentName",
        student.name
    );


    setText(
        "studentId",
        student.studentId
    );


    setText(
        "studentMobile",
        student.mobile
    );


    setText(
        "studentEmail",
        student.email || "No email"
    );


    setText(
        "studentAvatar",
        getInitials(student.name)
    );


    setText(
        "membershipName",
        student.membershipName
    );


    setText(
        "membershipValidity",
        formatValidity(
            student.startDate,
            student.endDate
        )
    );


    setText(
        "currentSeat",
        student.seatName
    );


    setText(
        "seatStatus",
        student.seatName === "Not Assigned"
            ? "No seat assigned"
            : "Currently assigned"
    );


    setText(
        "pendingFee",
        `₹${formatMoney(
            student.pendingFee
        )}`
    );


    setText(
        "feeStatus",
        student.pendingFee > 0
            ? "Payment pending"
            : "All fees paid"
    );


    setText(
        "admissionDate",
        formatDate(
            student.admissionDate
        )
    );


    /* Membership */

    setText(
        "detailPlan",
        student.membershipName
    );


    setText(
        "detailMembershipStatus",
        capitalize(
            student.membershipStatus
        )
    );


    setText(
        "detailStartDate",
        formatDate(
            student.startDate
        )
    );


    setText(
        "detailEndDate",
        formatDate(
            student.endDate
        )
    );


    /* Personal */

    setText(
        "personalName",
        student.name
    );


    setText(
        "personalMobile",
        student.mobile
    );


    setText(
        "personalEmail",
        student.email || "Not provided"
    );


    setText(
        "personalAdmissionDate",
        formatDate(
            student.admissionDate
        )
    );


    setText(
        "personalAddress",
        student.address || "Not provided"
    );


    /* Fees */

    setText(
        "totalFee",
        `₹${formatMoney(
            student.totalFee
        )}`
    );


    setText(
        "paidFee",
        `₹${formatMoney(
            student.paidFee
        )}`
    );


    setText(
        "pendingFeeDetail",
        `₹${formatMoney(
            student.pendingFee
        )}`
    );


    /* Seat */

    setText(
        "seatNumber",
        student.seatName
    );


    setText(
        "seatDescription",
        student.seatName === "Not Assigned"
            ? "No current seat allocation."
            : "Current student seat."
    );


    renderStatus(
        student.membershipStatus
    );
}


/* =========================================================
   STATUS
========================================================= */

function renderStatus(status) {

    const badge =
        $("studentStatus");


    badge.className =
        "status-badge";


    if (
        status === "expired"
    ) {

        badge.classList.add(
            "expired"
        );
    }


    if (
        status === "pending"
    ) {

        badge.classList.add(
            "pending"
        );
    }


    badge.textContent =
        capitalize(status);
}


/* =========================================================
   PAYMENTS UI
========================================================= */

function renderPayments() {

    const container =
        $("paymentHistory");


    if (!state.payments.length) {

        container.innerHTML = `
            <div class="empty-row">
                No payment records found.
            </div>
        `;

        return;
    }


    const records =
        state.payments
            .slice(0, 8);


    container.innerHTML =
        records.map(
            payment => {

                const amount =
                    Number(
                        payment.amount ??
                        payment.paidAmount ??
                        0
                    );


                const mode =
                    payment.paymentMode ||
                    payment.mode ||
                    "—";


                const date =
                    payment.paymentDate ||
                    payment.paidAt ||
                    payment.createdAt;


                return `
                    <div class="history-row">

                        <div class="history-main">

                            <strong>
                                ${escapeHtml(
                                    capitalize(mode)
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    formatDate(date)
                                )}
                            </span>

                        </div>

                        <div class="history-amount">
                            ₹${formatMoney(amount)}
                        </div>

                    </div>
                `;
            }
        ).join("");
}


/* =========================================================
   ATTENDANCE UI
========================================================= */

function renderAttendance() {

    const container =
        $("attendanceList");


    if (!state.attendance.length) {

        container.innerHTML = `
            <div class="empty-row">
                No attendance records found.
            </div>
        `;

        return;
    }


    const records =
        state.attendance
            .slice(0, 8);


    container.innerHTML =
        records.map(
            record => {

                const date =
                    record.date ||
                    record.checkIn ||
                    record.checkInAt ||
                    record.createdAt;


                const checkIn =
                    record.checkIn ||
                    record.checkInAt;


                const checkOut =
                    record.checkOut ||
                    record.checkOutAt;


                return `
                    <div class="history-row">

                        <div class="history-main">

                            <strong>
                                ${escapeHtml(
                                    formatDate(date)
                                )}
                            </strong>

                            <span>
                                In:
                                ${escapeHtml(
                                    formatTime(checkIn)
                                )}

                                &nbsp; • &nbsp;

                                Out:
                                ${escapeHtml(
                                    formatTime(checkOut)
                                )}
                            </span>

                        </div>

                        <div class="history-amount">
                            ${escapeHtml(
                                getDuration(record)
                            )}
                        </div>

                    </div>
                `;
            }
        ).join("");
}


/* =========================================================
   SEAT HISTORY
========================================================= */

function renderSeatHistory() {

    const container =
        $("seatHistory");


    if (!state.seatHistory.length) {

        container.innerHTML = `
            <div class="empty-row">
                No seat allocation history found.
            </div>
        `;

        return;
    }


    const records =
        state.seatHistory
            .slice(0, 6);


    container.innerHTML =
        records.map(
            record => {

                const seat =
                    record.seat?.name ||
                    record.seat?.seatNumber ||
                    record.seatNumber ||
                    record.seatName ||
                    "Seat";


                const start =
                    record.startDate ||
                    record.allocatedAt ||
                    record.createdAt;


                const end =
                    record.endDate ||
                    record.releasedAt;


                return `
                    <div class="history-row">

                        <div class="history-main">

                            <strong>
                                ${escapeHtml(seat)}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    formatDate(start)
                                )}

                                ${
                                    end
                                        ? ` → ${escapeHtml(
                                            formatDate(end)
                                        )}`
                                        : " → Current"
                                }
                            </span>

                        </div>

                    </div>
                `;
            }
        ).join("");
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function renderNotifications() {

    const container =
        $("notificationList");


    if (!state.notifications.length) {

        container.innerHTML = `
            <div class="empty-row">
                No student notifications found.
            </div>
        `;

        return;
    }


    const records =
        state.notifications
            .slice(0, 6);


    container.innerHTML =
        records.map(
            notification => {

                const title =
                    notification.title ||
                    notification.subject ||
                    "Notification";


                const message =
                    notification.message ||
                    notification.body ||
                    "";


                const date =
                    notification.createdAt ||
                    notification.date;


                return `
                    <div class="notification-row">

                        <div class="history-main">

                            <strong>
                                ${escapeHtml(title)}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    message
                                )}
                            </span>

                        </div>

                        <span class="history-main">
                            ${escapeHtml(
                                formatDate(date)
                            )}
                        </span>

                    </div>
                `;
            }
        ).join("");
}


/* =========================================================
   EDIT STUDENT
========================================================= */

function openEditModal() {

    if (!state.student) {
        return;
    }


    $("editName").value =
        state.student.name || "";


    $("editMobile").value =
        state.student.mobile === "—"
            ? ""
            : state.student.mobile;


    $("editEmail").value =
        state.student.email || "";


    $("editAddress").value =
        state.student.address || "";


    clearEditError();


    $("editModal")
        .classList.add("open");


    $("editModal")
        .setAttribute(
            "aria-hidden",
            "false"
        );
}


function closeEditModal() {

    $("editModal")
        .classList.remove("open");


    $("editModal")
        .setAttribute(
            "aria-hidden",
            "true"
        );
}


async function saveStudentChanges(
    event
) {

    event.preventDefault();

    clearEditError();


    const name =
        $("editName")
            .value
            .trim();


    const mobile =
        $("editMobile")
            .value
            .trim();


    const email =
        $("editEmail")
            .value
            .trim();


    const address =
        $("editAddress")
            .value
            .trim();


    if (!name) {

        showEditError(
            "Student name is required."
        );

        return;
    }


    if (!mobile) {

        showEditError(
            "Mobile number is required."
        );

        return;
    }


    const button =
        $("saveEditBtn");


    button.disabled = true;

    button.textContent =
        "Saving...";


    try {

        await apiRequest(
            `/api/learners/${encodeURIComponent(
                state.studentId
            )}`,
            {
                method: "PATCH",

                body: JSON.stringify({
                    name,
                    mobile,
                    email: email || undefined,
                    address: address || undefined
                })
            }
        );


        closeEditModal();

        showToast(
            "Student updated successfully."
        );


        await loadProfile();


    } catch (error) {

        console.error(
            "[Student Profile] Update failed:",
            error
        );


        showEditError(
            error.message ||
            "Unable to update student."
        );


    } finally {

        button.disabled = false;

        button.textContent =
            "Save Changes";
    }
}


/* =========================================================
   MEMBERSHIP RENEWAL
   (Owner Phase gap: there was no way anywhere in the app
   to renew a specific student's membership — the dashboard's
   "Renew membership" quick action only opened the Plans
   catalog page. This reuses the existing canonical
   endpoints rather than inventing a new one:
     PATCH /api/learners/:id  -> updates membership validity
     POST  /api/payments      -> records the renewal payment
                                  as its own ledger entry
========================================================= */

function populateRenewPlanSelect() {

    const select =
        $("renewPlan");

    if (!select) {
        return;
    }

    select.innerHTML =
        `<option value="">Select plan</option>` +
        state.plans
            .map(plan => {

                const id =
                    plan._id ||
                    plan.id ||
                    "";

                const name =
                    plan.name ||
                    plan.planName ||
                    plan.title ||
                    "Unnamed Plan";

                return `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`;
            })
            .join("");
}


function addDuration(
    dateValue,
    value,
    unit
) {

    const date =
        dateValue
            ? new Date(dateValue)
            : new Date();

    if (Number.isNaN(date.getTime())) {
        return new Date();
    }

    const amount =
        Number(value) || 0;

    const normalizedUnit =
        String(unit || "month")
            .toLowerCase();

    const result =
        new Date(date);

    if (normalizedUnit === "day") {

        result.setDate(
            result.getDate() + amount
        );

    } else if (normalizedUnit === "week") {

        result.setDate(
            result.getDate() + (amount * 7)
        );

    } else if (normalizedUnit === "year") {

        result.setFullYear(
            result.getFullYear() + amount
        );

    } else {

        result.setMonth(
            result.getMonth() + amount
        );
    }

    return result;
}


function toDateInputValue(date) {

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function updateRenewEndDateFromPlan() {

    const planId =
        $("renewPlan").value;

    const plan =
        state.plans.find(
            item =>
                (item._id || item.id) === planId
        );

    const startValue =
        $("renewStartDate").value;

    if (!plan || !startValue) {
        return;
    }

    const durationValue =
        Number(
            plan.durationValue ??
            plan.duration ??
            0
        );

    const durationUnit =
        plan.durationUnit ||
        plan.validityUnit ||
        "month";

    if (!durationValue) {
        return;
    }

    const newEnd =
        addDuration(
            startValue,
            durationValue,
            durationUnit
        );

    $("renewEndDate").value =
        toDateInputValue(newEnd);


    const price =
        Number(
            plan.price ??
            plan.amount ??
            plan.fee ??
            0
        );

    if (price) {
        $("renewAmount").value = price;
    }
}


function openRenewModal() {

    if (!state.student) {
        return;
    }

    clearRenewError();

    populateRenewPlanSelect();

    /*
     * Renewal start date: today, unless the current
     * membership is still active and hasn't ended yet —
     * in that case the renewal is suggested to start the
     * day after the current membership ends, so the
     * student doesn't lose paid-for days.
     */
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    let startDate = today;

    if (state.student.endDate) {

        const currentEnd =
            new Date(state.student.endDate);

        if (
            !Number.isNaN(currentEnd.getTime()) &&
            currentEnd >= today
        ) {

            startDate =
                new Date(currentEnd);

            startDate.setDate(
                startDate.getDate() + 1
            );
        }
    }

    $("renewStartDate").value =
        toDateInputValue(startDate);

    $("renewEndDate").value = "";

    $("renewAmount").value = "0";

    $("renewPaymentMode").value = "";

    const existingPlan =
        state.plans.find(
            plan =>
                (plan.name || plan.planName || plan.title) ===
                state.student.membershipName
        );

    $("renewPlan").value =
        existingPlan
            ? (existingPlan._id || existingPlan.id)
            : "";

    updateRenewEndDateFromPlan();

    $("renewModal")
        .classList.add("open");

    $("renewModal")
        .setAttribute(
            "aria-hidden",
            "false"
        );
}


function closeRenewModal() {

    $("renewModal")
        .classList.remove("open");

    $("renewModal")
        .setAttribute(
            "aria-hidden",
            "true"
        );
}


function showRenewError(message) {

    const el = $("renewFormError");

    if (!el) {
        return;
    }

    el.textContent = message;
    el.classList.add("show");
}


function clearRenewError() {

    const el = $("renewFormError");

    if (!el) {
        return;
    }

    el.textContent = "";
    el.classList.remove("show");
}


async function saveRenewal(event) {

    event.preventDefault();

    clearRenewError();

    if (!state.studentId) {
        return;
    }

    const planId =
        $("renewPlan").value;

    const startDate =
        $("renewStartDate").value;

    const endDate =
        $("renewEndDate").value;

    const amount =
        Number(
            $("renewAmount").value || 0
        );

    const paymentMode =
        $("renewPaymentMode").value;

    if (!planId) {
        return showRenewError(
            "Please select a membership plan."
        );
    }

    if (!startDate || !endDate) {
        return showRenewError(
            "Please choose both a start and end date."
        );
    }

    if (new Date(endDate) < new Date(startDate)) {
        return showRenewError(
            "End date cannot be before the start date."
        );
    }

    if (
        !Number.isFinite(amount) ||
        amount < 0
    ) {
        return showRenewError(
            "Enter a valid amount."
        );
    }

    if (amount > 0 && !paymentMode) {
        return showRenewError(
            "Please select a payment mode for the collected amount."
        );
    }

    const button =
        $("saveRenewBtn");

    button.disabled = true;

    button.textContent =
        "Renewing...";

    try {

        /*
         * Record the payment first, as its own ledger
         * transaction — it must never overwrite a prior
         * payment. If nothing is being collected right
         * now (amount is 0), this step is skipped and
         * only the membership validity is updated.
         */
        if (amount > 0) {

            await apiRequest(
                "/api/payments",
                {
                    method: "POST",
                    body: JSON.stringify({
                        studentId: state.studentId,
                        amount,
                        paymentMode,
                        paymentDate: startDate,
                        purpose: "Membership renewal"
                    })
                }
            );
        }

        await apiRequest(
            `/api/learners/${encodeURIComponent(
                state.studentId
            )}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    membershipPlanId: planId,
                    membershipStart: startDate,
                    membershipEnd: endDate
                })
            }
        );

        closeRenewModal();

        showToast(
            "Membership renewed successfully."
        );

        await loadProfile();

    } catch (error) {

        console.error(
            "[Student Profile] Renewal failed:",
            error
        );

        showRenewError(
            error.message ||
            "Unable to renew membership."
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Confirm Renewal";
    }
}


/* =========================================================
   OWNER
========================================================= */

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
            "[Student Profile] Owner info unavailable:",
            error.message
        );
    }
}


/* =========================================================
   UI STATE
========================================================= */

function showLoading() {

    $("pageLoading")
        .style.display = "flex";


    $("pageError")
        .style.display = "none";


    $("profileContent")
        .style.display = "none";
}


function showProfile() {

    $("pageLoading")
        .style.display = "none";


    $("pageError")
        .style.display = "none";


    $("profileContent")
        .style.display = "block";
}


function showError(message) {

    $("pageLoading")
        .style.display = "none";


    $("profileContent")
        .style.display = "none";


    $("pageError")
        .style.display = "flex";


    setText(
        "pageErrorMessage",
        message
    );
}


function showToast(message) {

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
   SIDEBAR
========================================================= */

function openSidebar() {

    $("sidebar")
        ?.classList.add("open");


    $("sidebarOverlay")
        ?.classList.add("show");
}


function closeSidebar() {

    $("sidebar")
        ?.classList.remove("open");


    $("sidebarOverlay")
        ?.classList.remove("show");
}


/* =========================================================
   AUTH / LOGOUT
========================================================= */

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


function logout() {

    clearClientAuth();

    window.location.href =
        "../index.html";
}


/* =========================================================
   HELPERS
========================================================= */

function setText(id, value) {

    const element =
        $(id);

    if (element) {
        element.textContent =
            value ?? "—";
    }
}


function getInitials(name) {

    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!words.length) {
        return "ST";
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


function capitalize(value) {

    if (!value) {
        return "";
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function formatMoney(value) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-IN"
    );
}


function formatDate(value) {

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


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function formatTime(value) {

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


    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function formatValidity(
    start,
    end
) {

    if (!start && !end) {
        return "Validity not set";
    }


    if (!end) {

        return `From ${formatDate(start)}`;
    }


    return `${formatDate(start)} – ${formatDate(end)}`;
}


function getDuration(record) {

    if (
        record.durationMinutes !== undefined
    ) {

        const minutes =
            Number(
                record.durationMinutes
            );


        if (
            Number.isFinite(minutes)
        ) {

            const hours =
                Math.floor(
                    minutes / 60
                );

            const mins =
                minutes % 60;


            return hours
                ? `${hours}h ${mins}m`
                : `${mins}m`;
        }
    }


    if (
        record.checkIn &&
        record.checkOut
    ) {

        const start =
            new Date(
                record.checkIn
            );

        const end =
            new Date(
                record.checkOut
            );


        if (
            !Number.isNaN(
                start.getTime()
            ) &&
            !Number.isNaN(
                end.getTime()
            )
        ) {

            const minutes =
                Math.max(
                    0,
                    Math.round(
                        (end - start) /
                        60000
                    )
                );


            const hours =
                Math.floor(
                    minutes / 60
                );

            const mins =
                minutes % 60;


            return hours
                ? `${hours}h ${mins}m`
                : `${mins}m`;
        }
    }


    return "—";
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


function showEditError(message) {

    const error =
        $("editFormError");


    error.textContent =
        message;


    error.classList.add(
        "show"
    );
}


function clearEditError() {

    const error =
        $("editFormError");


    error.textContent = "";

    error.classList.remove(
        "show"
    );
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("backBtn")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "students.html";
            }
        );


    $("editStudentBtn")
        ?.addEventListener(
            "click",
            openEditModal
        );


    $("closeEditModal")
        ?.addEventListener(
            "click",
            closeEditModal
        );


    $("cancelEditBtn")
        ?.addEventListener(
            "click",
            closeEditModal
        );


    $("editStudentForm")
        ?.addEventListener(
            "submit",
            saveStudentChanges
        );


    $("editModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("editModal")
                ) {
                    closeEditModal();
                }
            }
        );


    $("renewMembershipBtn")
        ?.addEventListener(
            "click",
            openRenewModal
        );


    $("closeRenewModal")
        ?.addEventListener(
            "click",
            closeRenewModal
        );


    $("cancelRenewBtn")
        ?.addEventListener(
            "click",
            closeRenewModal
        );


    $("renewForm")
        ?.addEventListener(
            "submit",
            saveRenewal
        );


    $("renewModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("renewModal")
                ) {
                    closeRenewModal();
                }
            }
        );


    $("renewPlan")
        ?.addEventListener(
            "change",
            updateRenewEndDateFromPlan
        );


    $("renewStartDate")
        ?.addEventListener(
            "change",
            updateRenewEndDateFromPlan
        );


    $("retryBtn")
        ?.addEventListener(
            "click",
            loadProfile
        );


    $("mobileMenuBtn")
        ?.addEventListener(
            "click",
            openSidebar
        );


    $("sidebarOverlay")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    $("notificationBtn")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "notifications.html";
            }
        );


    $("logoutBtn")
        ?.addEventListener(
            "click",
            logout
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeEditModal();
                closeSidebar();
            }
        }
    );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

    if (!requireAuth()) {
        return;
    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    state.studentId =
        params.get("id");


    if (!state.studentId) {

        showError(
            "Student ID is missing from the page URL."
        );

        return;
    }


    setupEvents();


    await Promise.all([
        loadOwnerInfo(),
        loadProfile()
    ]);
}


document.addEventListener(
    "DOMContentLoaded",
    init
);