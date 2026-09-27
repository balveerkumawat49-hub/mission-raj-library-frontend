"use strict";

/*
 * Mission Raj Library
 * Owner -> Fees & Payments
 *
 * Backend is the source of truth.
 * No fake/demo payments are generated.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";


const state = {
    payments: [],
    filteredPayments: [],
    students: [],
    selectedPayment: null
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

    if (Array.isArray(payload?.payments)) {
        return payload.payments;
    }

    if (Array.isArray(payload?.data?.payments)) {
        return payload.data.payments;
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


function getMonthStart() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-01`;
}


function getDateOnly(value) {

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


function formatDisplayDate(value) {

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
   CURRENCY
========================================================= */

function formatCurrency(value) {

    const amount =
        Number(value);

    if (
        !Number.isFinite(amount)
    ) {

        return "₹0";
    }

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }
    ).format(amount);
}


/* =========================================================
   NORMALIZE PAYMENT
========================================================= */

function normalizePayment(
    payment
) {

    const student =
        payment.student ||
        payment.learner ||
        payment.user ||
        {};


    const amount =
        Number(
            payment.amount ??
            payment.paidAmount ??
            payment.paymentAmount ??
            0
        );


    const studentName =
        student.name ||
        student.fullName ||
        payment.studentName ||
        payment.learnerName ||
        "Unknown Student";


    const studentId =
        student.studentId ||
        student.learnerId ||
        student.admissionId ||
        payment.studentId ||
        payment.learnerId ||
        "";


    const receipt =
        payment.receiptNumber ||
        payment.receiptNo ||
        payment.receiptId ||
        payment.invoiceNumber ||
        "—";


    const paymentDate =
        payment.paymentDate ||
        payment.paidAt ||
        payment.createdAt ||
        payment.date ||
        null;


    const mode =
        String(
            payment.paymentMode ||
            payment.mode ||
            payment.method ||
            "other"
        ).toLowerCase();


    const purpose =
        payment.purpose ||
        payment.paymentFor ||
        payment.description ||
        payment.feeType ||
        "Membership Fee";


    const status =
        normalizePaymentStatus(
            payment.status,
            payment,
            student
        );


    const pendingAmount =
        Number(
            payment.pendingAmount ??
            payment.remainingAmount ??
            0
        );


    return {

        raw: payment,

        id:
            payment._id ||
            payment.id ||
            "",

        studentName,

        studentId,

        mobile:
            student.mobile ||
            student.phone ||
            payment.mobile ||
            "",

        amount,

        receipt,

        paymentDate,

        mode,

        purpose,

        reference:
            payment.reference ||
            payment.transactionId ||
            payment.transactionReference ||
            payment.utr ||
            "",

        note:
            payment.note ||
            payment.notes ||
            "",

        status,

        pendingAmount
    };
}


function normalizePaymentStatus(
    status,
    payment,
    student
) {

    const value =
        String(
            status || ""
        ).toLowerCase();


    if (
        [
            "paid",
            "completed",
            "success",
            "successful"
        ].includes(value)
    ) {

        return "paid";
    }


    if (
        [
            "partial",
            "partially_paid",
            "partially-paid"
        ].includes(value)
    ) {

        return "partial";
    }


    if (
        [
            "pending",
            "due",
            "unpaid"
        ].includes(value)
    ) {

        return "pending";
    }


    const pending =
        Number(
            payment.pendingAmount ??
            payment.remainingAmount ??
            student.pendingFee ??
            student.pendingAmount ??
            0
        );


    if (pending > 0) {
        return "partial";
    }


    return "paid";
}


/* =========================================================
   NORMALIZE STUDENT
========================================================= */

function normalizeStudent(
    student
) {

    const id =
        student._id ||
        student.id ||
        "";


    const name =
        student.name ||
        student.fullName ||
        "Unknown Student";


    const studentId =
        student.studentId ||
        student.learnerId ||
        student.admissionId ||
        id;


    const totalFee =
        Number(
            student.totalFee ??
            student.feeAmount ??
            student.membershipFee ??
            0
        );

    const paidFee =
        Number(
            student.paidFee ??
            0
        );

    // Pending fee is derived from the authoritative learner ledger.
    // Do not trust optional/stale pending fields from API responses.
    const pending =
        Math.max(
            0,
            totalFee - paidFee
        );


    return {

        id,

        name,

        studentId,

        mobile:
            student.mobile ||
            student.phone ||
            "",

        pending,

        totalFee
    };
}


/* =========================================================
   LOAD PAYMENTS
========================================================= */

async function loadPayments() {

    showLoading();

    hideApiError();


    try {

        const payload =
            await apiRequest(
                "/api/payments"
            );


        state.payments =
            unwrapList(payload)
                .map(
                    normalizePayment
                )
                .filter(
                    payment =>
                        payment.id
                );


        applyFilters();

        showTable();


    } catch (error) {

        console.error(
            "[Payments]",
            error
        );


        showApiError(
            error.message ||
            "Unable to load payment records."
        );
    }
}


/* =========================================================
   LOAD STUDENTS
========================================================= */

async function loadStudents() {

    try {

        const payload =
            await apiRequest(
                "/api/learners"
            );


        state.students =
            unwrapList(payload)
                .map(
                    normalizeStudent
                )
                .filter(
                    student =>
                        student.id
                );


        populateStudentSelect();


    } catch (error) {

        console.error(
            "[Payments] Students:",
            error
        );


        /*
         * Payment page can still display
         * existing payment records even if
         * student loading fails.
         */
        showToast(
            "Unable to load students for new payment."
        );
    }
}


function populateStudentSelect() {

    const select =
        $("studentSelect");


    select.innerHTML =
        `
            <option value="">
                Select student
            </option>
        `;


    state.students
        .sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name
                )
        )
        .forEach(
            student => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    student.id;


                option.textContent =
                    `${student.name} — ${
                        student.studentId
                    }`;


                select.appendChild(
                    option
                );
            }
        );
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        $("paymentSearch")
            .value
            .trim()
            .toLowerCase();


    const status =
        $("paymentStatusFilter")
            .value;


    const mode =
        $("paymentModeFilter")
            .value;


    const date =
        $("paymentDateFilter")
            .value;


    state.filteredPayments =
        state.payments.filter(
            payment => {

                const searchable =
                    [
                        payment.studentName,
                        payment.studentId,
                        payment.receipt,
                        payment.reference,
                        payment.purpose
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
                    payment.status === status;


                const matchesMode =
                    mode === "all" ||
                    payment.mode === mode;


                const paymentDate =
                    getDateOnly(
                        payment.paymentDate
                    );


                const matchesDate =
                    !date ||
                    paymentDate === date;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMode &&
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

    const payments =
        state.payments;


    const today =
        getLocalDateInputValue();


    const currentMonth =
        today.slice(
            0,
            7
        );


    const todayPayments =
        payments.filter(
            payment =>
                getDateOnly(
                    payment.paymentDate
                ) === today
        );


    const monthPayments =
        payments.filter(
            payment =>
                getDateOnly(
                    payment.paymentDate
                ).slice(
                    0,
                    7
                ) === currentMonth
        );


    const todayTotal =
        todayPayments.reduce(
            (
                total,
                payment
            ) =>
                total +
                payment.amount,
            0
        );


    const monthTotal =
        monthPayments.reduce(
            (
                total,
                payment
            ) =>
                total +
                payment.amount,
            0
        );


    /*
     * Pending fees are primarily derived
     * from learner data, when available.
     */
    const pendingTotal =
        state.students.reduce(
            (
                total,
                student
            ) =>
                total +
                Math.max(
                    0,
                    student.pending
                ),
            0
        );


    setText(
        "todayCollection",
        formatCurrency(
            todayTotal
        )
    );


    setText(
        "monthCollection",
        formatCurrency(
            monthTotal
        )
    );


    setText(
        "totalPending",
        formatCurrency(
            pendingTotal
        )
    );


    setText(
        "paymentCount",
        payments.length
    );
}


/* =========================================================
   TABLE
========================================================= */

function renderTable() {

    const body =
        $("paymentsTableBody");


    setText(
        "recordCount",
        `${state.filteredPayments.length} ${
            state.filteredPayments.length === 1
                ? "record"
                : "records"
        }`
    );


    if (
        !state.filteredPayments.length
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
        state.filteredPayments
            .map(
                renderPaymentRow
            )
            .join("");
}


function renderPaymentRow(
    payment
) {

    const statusLabel =
        capitalize(
            payment.status
        );


    return `
        <tr>

            <td>

                <div class="student-cell">

                    <div class="student-avatar">
                        ${escapeHtml(
                            getInitials(
                                payment.studentName
                            )
                        )}
                    </div>

                    <div class="student-details">

                        <strong>
                            ${escapeHtml(
                                payment.studentName
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                payment.studentId ||
                                payment.mobile ||
                                "—"
                            )}
                        </span>

                    </div>

                </div>

            </td>


            <td>

                <span class="receipt-value">
                    ${escapeHtml(
                        payment.receipt
                    )}
                </span>

            </td>


            <td>

                <span class="amount-value">
                    ${formatCurrency(
                        payment.amount
                    )}
                </span>

            </td>


            <td>
                ${formatDisplayDate(
                    payment.paymentDate
                )}
            </td>


            <td>

                <span class="mode-value">
                    ${escapeHtml(
                        formatPaymentMode(
                            payment.mode
                        )
                    )}
                </span>

            </td>


            <td>
                ${escapeHtml(
                    payment.purpose
                )}
            </td>


            <td>

                <span
                    class="status-pill ${escapeHtml(
                        payment.status
                    )}"
                >
                    ${escapeHtml(
                        statusLabel
                    )}
                </span>

            </td>


            <td>

                <button
                    type="button"
                    class="action-btn"
                    data-action="details"
                    data-id="${escapeHtml(
                        payment.id
                    )}"
                >
                    View
                </button>

            </td>

        </tr>
    `;
}


/* =========================================================
   PAYMENT MODAL
========================================================= */

function openPaymentModal() {

    resetPaymentForm();

    openModal(
        "paymentModal"
    );
}


function resetPaymentForm() {

    $("paymentForm")
        .reset();


    $("paymentDate").value =
        getLocalDateInputValue();


    $("studentSummary")
        .classList.remove(
            "show"
        );


    setText(
        "summaryName",
        "—"
    );


    setText(
        "summaryId",
        "—"
    );


    setText(
        "summaryPending",
        "₹0"
    );


    setText(
        "summaryAvatar",
        "S"
    );
}


function handleStudentChange() {

    const studentId =
        $("studentSelect")
            .value;


    const student =
        state.students.find(
            item =>
                item.id === studentId
        );


    if (!student) {

        $("studentSummary")
            .classList.remove(
                "show"
            );

        return;
    }


    $("studentSummary")
        .classList.add(
            "show"
        );


    setText(
        "summaryName",
        student.name
    );


    setText(
        "summaryId",
        student.studentId
    );


    setText(
        "summaryPending",
        formatCurrency(
            student.pending
        )
    );


    setText(
        "summaryAvatar",
        getInitials(
            student.name
        )
    );


    /*
     * Never automatically fill a payment
     * amount from pending balance.
     * Owner explicitly enters the amount.
     */
}


/* =========================================================
   SAVE PAYMENT
========================================================= */

async function savePayment(
    event
) {

    event.preventDefault();


    const studentId =
        $("studentSelect")
            .value;


    const amount =
        Number(
            $("paymentAmount")
                .value
        );


    const mode =
        $("paymentMode")
            .value;


    const paymentDate =
        $("paymentDate")
            .value;


    if (!studentId) {

        showToast(
            "Please select a student."
        );

        return;
    }


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        showToast(
            "Enter a valid payment amount."
        );

        return;
    }


    if (!mode) {

        showToast(
            "Please select a payment mode."
        );

        return;
    }


    if (!paymentDate) {

        showToast(
            "Please select payment date."
        );

        return;
    }


    const button =
        $("savePaymentBtn");


    button.disabled = true;

    button.textContent =
        "Saving...";


    const body = {

        studentId,

        amount,

        paymentMode:
            mode,

        paymentDate,

        reference:
            $("paymentReference")
                .value
                .trim(),

        purpose:
            $("paymentPurpose")
                .value
                .trim(),

        note:
            $("paymentNote")
                .value
                .trim()
    };


    try {

        /*
         * Backend creates the actual
         * payment/receipt record.
         */
        await apiRequest(
            "/api/payments",
            {
                method: "POST",
                body:
                    JSON.stringify(
                        body
                    )
            }
        );


        closeModal(
            "paymentModal"
        );


        showToast(
            "Payment recorded successfully."
        );


        await Promise.all([
            loadPayments(),
            loadStudents()
        ]);


    } catch (error) {

        console.error(
            "[Payments] Save:",
            error
        );


        showToast(
            error.message ||
            "Unable to record payment."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Save Payment";
    }
}


/* =========================================================
   DETAIL MODAL
========================================================= */

function openPaymentDetails(
    payment
) {

    if (!payment) {
        return;
    }


    state.selectedPayment =
        payment;


    setText(
        "detailStudentName",
        payment.studentName
    );


    setText(
        "detailAmount",
        formatCurrency(
            payment.amount
        )
    );


    setText(
        "detailStatus",
        capitalize(
            payment.status
        )
    );


    setText(
        "detailReceipt",
        payment.receipt
    );


    setText(
        "detailDate",
        formatDisplayDate(
            payment.paymentDate
        )
    );


    setText(
        "detailMode",
        formatPaymentMode(
            payment.mode
        )
    );


    setText(
        "detailStudentId",
        payment.studentId
    );


    setText(
        "detailPurpose",
        payment.purpose
    );


    setText(
        "detailReference",
        payment.reference ||
        "—"
    );


    setText(
        "detailNote",
        payment.note ||
        "—"
    );


    openModal(
        "paymentDetailModal"
    );
}


/* =========================================================
   FILTER RESET
========================================================= */

function clearFilters() {

    $("paymentSearch")
        .value = "";


    $("paymentStatusFilter")
        .value = "all";


    $("paymentModeFilter")
        .value = "all";


    $("paymentDateFilter")
        .value = "";


    applyFilters();
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("paymentSearch")
        .addEventListener(
            "input",
            applyFilters
        );


    $("paymentStatusFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("paymentModeFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("paymentDateFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("clearFiltersBtn")
        .addEventListener(
            "click",
            clearFilters
        );


    $("retryBtn")
        .addEventListener(
            "click",
            async () => {

                await Promise.all([
                    loadPayments(),
                    loadStudents()
                ]);
            }
        );


    $("addPaymentBtn")
        .addEventListener(
            "click",
            openPaymentModal
        );


    $("closePaymentModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "paymentModal"
                )
        );


    $("cancelPaymentBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "paymentModal"
                )
        );


    $("paymentForm")
        .addEventListener(
            "submit",
            savePayment
        );


    $("studentSelect")
        .addEventListener(
            "change",
            handleStudentChange
        );


    $("paymentsTableBody")
        .addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-action]"
                    );


                if (!button) {
                    return;
                }


                const payment =
                    state.payments.find(
                        item =>
                            item.id ===
                            button.dataset.id
                    );


                if (payment) {

                    openPaymentDetails(
                        payment
                    );
                }
            }
        );


    $("closeDetailModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "paymentDetailModal"
                )
        );


    $("closeDetailBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "paymentDetailModal"
                )
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


/* =========================================================
   PAYMENT PAGE REFRESH
========================================================= */

let refreshInProgress = false;

async function refreshPaymentPage() {

    if (refreshInProgress) {
        return;
    }

    refreshInProgress = true;

    try {
        await Promise.all([
            loadPayments(),
            loadStudents()
        ]);
    } catch (error) {
        console.warn(
            "[Payments] Refresh:",
            error.message
        );
    } finally {
        refreshInProgress = false;
    }
}

window.addEventListener(
    "focus",
    refreshPaymentPage
);

document.addEventListener(
    "visibilitychange",
    () => {
        if (!document.hidden) {
            refreshPaymentPage();
        }
    }
);


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
            getInitials(
                name
            )
        );


    } catch (error) {

        console.warn(
            "[Payments] Owner info unavailable:",
            error.message
        );
    }
}


/* =========================================================
   HELPERS
========================================================= */

function formatPaymentMode(
    mode
) {

    const values = {

        cash: "Cash",

        upi: "UPI",

        card: "Card",

        bank: "Bank Transfer",

        other: "Other"
    };


    return values[
        String(mode || "")
            .toLowerCase()
    ] || "Other";
}


function capitalize(
    value
) {

    const text =
        String(value || "");


    return text
        .charAt(0)
        .toUpperCase() +
        text.slice(1);
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
     * Existing login/navigation redirect
     * behaviour intentionally remains unchanged.
     */

    if (!requireAuth()) {
        return;
    }


    setupEvents();


    await Promise.all([
        loadOwnerInfo(),
        loadPayments(),
        loadStudents()
    ]);
}


document.addEventListener(
    "DOMContentLoaded",
    init
);