"use strict";

/*
 * Mission Raj Library
 * Owner -> Students
 *
 * Backend is the source of truth.
 * No demo students.
 * No fake LocalStorage student records.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";

const state = {
    students: [],
    filteredStudents: [],
    plans: [],
    seats: [],
    editingStudentId: null,
    loading: false
};


/* =========================================================
   DOM
========================================================= */

const $ = (id) => document.getElementById(id);

function getStudentCredentialStore() {
    try {
        return JSON.parse(
            sessionStorage.getItem("libraryStudentCredentials") || "{}"
        );
    } catch {
        return {};
    }
}

function saveStudentCredentials(studentId, credentials) {
    if (!studentId || !credentials) return;

    const store = getStudentCredentialStore();

    store[String(studentId)] = {
        loginId: credentials.loginId || "",
        temporaryPassword: credentials.temporaryPassword || ""
    };

    sessionStorage.setItem(
        "libraryStudentCredentials",
        JSON.stringify(store)
    );
}

function getStudentCredentials(studentId) {
    const store = getStudentCredentialStore();
    return store[String(studentId)] || {};
}


/* =========================================================
   AUTH
========================================================= */

function getAccessToken() {

    const possibleKeys = [
        "missionRajAccessToken",
        "missionRajToken",
        "accessToken",
        "access_token",
        "token"
    ];

    for (const key of possibleKeys) {

        const value = localStorage.getItem(key);

        if (value) {
            return value;
        }
    }

    return null;
}


function requireAuth() {

    const token = getAccessToken();

    if (!token) {

        window.location.href = "../index.html";

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

    const token = getAccessToken();

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


/* =========================================================
   NORMALIZATION
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

    if (Array.isArray(payload?.data?.learners)) {
        return payload.data.learners;
    }

    if (Array.isArray(payload?.learners)) {
        return payload.learners;
    }

    if (Array.isArray(payload?.students)) {
        return payload.students;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    return [];
}


function unwrapObject(payload) {

    if (!payload) {
        return null;
    }

    if (payload.data?.learner) {
        return payload.data.learner;
    }

    if (payload.learner) {
        return payload.learner;
    }

    if (payload.data?.student) {
        return payload.data.student;
    }

    if (payload.student) {
        return payload.student;
    }

    if (payload.data) {
        return payload.data;
    }

    return payload;
}


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

    const totalFee = Number(
        student.totalFee ??
        membership.totalFee ??
        student.fee?.total ??
        0
    );

    const paidFee = Number(
        student.paidFee ??
        membership.paidFee ??
        student.fee?.paid ??
        0
    );

    const pendingFee = Math.max(
        0,
        totalFee - paidFee
    );

    const credentialKey =
        student._id ||
        student.id ||
        student.studentId ||
        "";

    const savedCredentials =
        getStudentCredentials(credentialKey);

    const portalCredentials =
        student.portalCredentials ||
        savedCredentials ||
        {};

    const startDate =
        membership.startDate ||
        membership.validFrom ||
        student.membershipStart ||
        student.startDate ||
        "";

    const endDate =
        membership.endDate ||
        membership.validUntil ||
        student.membershipEnd ||
        student.endDate ||
        "";

    const status =
        normalizeStatus(
            student.status ||
            membership.status ||
            calculateMembershipStatus(endDate)
        );

    const identityId =
        student._id ||
        student.id ||
        student.studentId ||
        "";




    return {
        raw: student,

        id:
            identityId,

        studentId:
            student.studentId ||
            student.learnerId ||
            student.admissionId ||
            student.registrationId ||
            "—",

        loginId:
            portalCredentials.loginId ||
            student.loginId ||
            "—",

        temporaryPassword:
            portalCredentials.temporaryPassword ||
            student.temporaryPassword ||
            "",

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

        planId:
            plan._id ||
            plan.id ||
            membership.planId ||
            "",

        seatName:
            seat.name ||
            seat.seatNumber ||
            seat.number ||
            student.seatNumber ||
            "Not Assigned",

        seatId:
            seat._id ||
            seat.id ||
            membership.seatId ||
            student.seatId ||
            "",

        startDate,
        endDate,

        totalFee,
        paidFee,
        pendingFee,

        paymentMode:
            student.paymentMode ||
            membership.paymentMode ||
            "",

        status
    };
}


function normalizeStatus(value) {

    const status = String(value || "")
        .trim()
        .toLowerCase();

    if (
        status === "active" ||
        status === "current"
    ) {
        return "active";
    }

    if (
        status === "expired" ||
        status === "inactive"
    ) {
        return status;
    }

    if (
        status === "pending"
    ) {
        return "pending";
    }

    return "active";
}


function calculateMembershipStatus(endDate) {

    if (!endDate) {
        return "pending";
    }

    const end = new Date(endDate);

    if (Number.isNaN(end.getTime())) {
        return "pending";
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return end >= today
        ? "active"
        : "expired";
}


/* =========================================================
   LOAD STUDENTS
========================================================= */

async function loadStudents() {

    state.loading = true;

    renderLoadingState();

    try {

        /*
         * Backend learner module.
         *
         * If the backend route is /api/students in your
         * implementation, change only this endpoint.
         */
        const payload = await apiRequest(
            "/api/learners"
        );

        state.students = unwrapList(payload)
            .map(normalizeStudent);

        populateMembershipFilter();

        applyFilters();

        updateStats();

    } catch (error) {

        console.error(
            "[Students] Load failed:",
            error
        );

        state.students = [];
        state.filteredStudents = [];

        renderErrorState(
            error.message ||
            "Unable to load students."
        );

        updateStats();

    } finally {

        state.loading = false;
    }
}


/* =========================================================
   LOAD PLANS
========================================================= */

async function loadPlans() {

    try {

        const payload = await apiRequest(
            "/api/plans"
        );

        state.plans = unwrapList(payload);

        renderPlanOptions();

    } catch (error) {

        /*
         * Plan endpoint may be implemented when
         * Membership module is connected.
         *
         * We don't create fake plans.
         */
        console.warn(
            "[Students] Plans unavailable:",
            error.message
        );
    }
}


/* =========================================================
   LOAD SEATS
========================================================= */

async function loadSeats() {

    try {

        const payload = await apiRequest(
            "/api/seats"
        );

        state.seats = unwrapList(payload);

        renderSeatOptions();

    } catch (error) {

        /*
         * No fake seats are created.
         */
        console.warn(
            "[Students] Seats unavailable:",
            error.message
        );
    }
}


/* =========================================================
   FILTER
========================================================= */

function applyFilters() {

    const search =
        ($("studentSearch")?.value || "")
            .trim()
            .toLowerCase();

    const status =
        $("statusFilter")?.value || "all";

    const membership =
        $("membershipFilter")?.value || "all";


    state.filteredStudents =
        state.students.filter(student => {

            const matchesSearch =
                !search ||
                student.name.toLowerCase().includes(search) ||
                student.mobile.toLowerCase().includes(search) ||
                student.studentId.toLowerCase().includes(search);


            const matchesStatus =
                status === "all" ||
                (status === "pending"
                    ? Number(student.pendingFee || 0) > 0
                    : student.status === status);


            const matchesMembership =
                membership === "all" ||
                student.planId === membership ||
                student.membershipName === membership;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesMembership
            );
        });


    renderStudents();
}


/* =========================================================
   RENDER STUDENTS
========================================================= */

function renderStudents() {

    const body = $("studentsTableBody");

    if (!body) {
        return;
    }

    const students =
        state.filteredStudents;


    if (!students.length) {

        body.innerHTML = `
            <tr>
                <td colspan="9" class="table-state">
                    <span>No students found.</span>
                </td>
            </tr>
        `;

        updateResultCount(0);

        return;
    }


    body.innerHTML =
        students
            .map(studentRow)
            .join("");


    updateResultCount(
        students.length
    );
}


function studentRow(student) {

    const initials =
        getInitials(student.name);

    const statusClass =
        `status-${escapeHtml(student.status)}`;

    const statusText =
        capitalize(student.status);

    const feeClass =
        student.pendingFee > 0
            ? "fee-pending"
            : "fee-paid";

    const feeText =
        student.pendingFee > 0
            ? `₹${formatMoney(student.pendingFee)} due`
            : "Paid";


    return `
        <tr>

            <td>
                <div class="student-cell">

                    <div class="student-avatar">
                        ${escapeHtml(initials)}
                    </div>

                    <div>
                        <div class="student-name">
                            ${escapeHtml(student.name)}
                        </div>

                        ${
                            student.email
                                ? `
                                    <div class="student-email">
                                        ${escapeHtml(student.email)}
                                    </div>
                                  `
                                : ""
                        }

                    </div>

                </div>
            </td>


            <td>
                <strong>
                    ${escapeHtml(student.studentId)}
                </strong>
            </td>


            <td>
                ${escapeHtml(student.mobile)}
            </td>

            <td>
                <strong>${escapeHtml(student.loginId || "—")}</strong>
            </td>

            <td>
                ${
                    student.temporaryPassword
                        ? `
                            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
                                <span
                                    data-password-value="${escapeHtml(student.temporaryPassword)}"
                                    data-password-visible="false"
                                    style="font-family:monospace;"
                                >••••••••</span>
                                <button
                                    type="button"
                                    class="table-action"
                                    data-action="toggle-password"
                                    data-id="${escapeHtml(student.id)}"
                                    title="Show / Hide password"
                                    style="padding:4px 8px;"
                                >👁</button>
                            </div>
                          `
                        : `<span class="muted">—</span>`
                }
            </td>

            <td>
                ${escapeHtml(student.membershipName)}
            </td>


            <td>
                ${escapeHtml(student.seatName)}
            </td>


            <td>
                ${
                    student.endDate
                        ? `
                            <div>
                                ${formatDate(student.endDate)}
                            </div>

                            ${
                                student.startDate
                                    ? `
                                        <div class="student-email">
                                            ${formatDate(student.startDate)}
                                        </div>
                                      `
                                    : ""
                            }
                          `
                        : `<span class="muted">Not set</span>`
                }
            </td>


            <td>
                <span class="fee-badge ${feeClass}">
                    ${feeText}
                </span>
            </td>


            <td>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </td>


            <td>

                <div class="action-group">

                    <button
                        type="button"
                        class="table-action primary"
                        data-action="view"
                        data-id="${escapeHtml(student.id)}"
                    >
                        View
                    </button>

                    <button
                        type="button"
                        class="table-action"
                        data-action="edit"
                        data-id="${escapeHtml(student.id)}"
                    >
                        Edit
                    </button>

                </div>

            </td>

        </tr>
    `;
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    const students =
        state.students;


    const total =
        students.length;

    const active =
        students.filter(
            s => s.status === "active"
        ).length;

    const expired =
        students.filter(
            s => s.status === "expired"
        ).length;

    const pending =
        students.reduce(
            (sum, student) =>
                sum + Number(student.pendingFee || 0),
            0
        );


    setText(
        "totalStudents",
        total
    );

    setText(
        "activeStudents",
        active
    );

    setText(
        "expiredStudents",
        expired
    );

    setText(
        "pendingFees",
        `₹${formatMoney(pending)}`
    );
}


function updateResultCount(count) {

    const element =
        $("resultCount");

    if (!element) {
        return;
    }

    element.textContent =
        `${count} student${count === 1 ? "" : "s"}`;
}


/* =========================================================
   PLAN / SEAT OPTIONS
========================================================= */

function renderPlanOptions() {

    const select =
        $("membershipPlan");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">Select plan</option>
        ${
            state.plans
                .map(plan => {

                    const id =
                        plan._id ||
                        plan.id ||
                        "";

                    const name =
                        plan.name ||
                        plan.title ||
                        "Unnamed Plan";

                    return `
                        <option value="${escapeHtml(id)}">
                            ${escapeHtml(name)}
                        </option>
                    `;
                })
                .join("")
        }
    `;
}


function renderSeatOptions() {

    const select =
        $("seatId");

    if (!select) {
        return;
    }

    const currentSeatId =
        state.editingStudentId
            ? (
                state.students.find(
                    student =>
                        student.id === state.editingStudentId
                )?.seatId || ""
            )
            : "";

    const availableSeats =
        state.seats.filter(seat => {

            const id =
                seat._id ||
                seat.id ||
                "";

            const status =
                String(
                    seat.status || ""
                ).toLowerCase();

            /*
             * Include the seat currently assigned to the
             * student being edited even though it isn't
             * "available" — otherwise it silently
             * disappears from the dropdown while editing.
             */
            return (
                !status ||
                status === "available" ||
                (
                    currentSeatId &&
                    id === currentSeatId
                )
            );
        });


    select.innerHTML = `
        <option value="">
            No seat assigned
        </option>

        ${
            availableSeats
                .map(seat => {

                    const id =
                        seat._id ||
                        seat.id ||
                        "";

                    const name =
                        seat.name ||
                        seat.seatNumber ||
                        seat.number ||
                        "Unnamed Seat";

                    return `
                        <option value="${escapeHtml(id)}">
                            ${escapeHtml(name)}
                        </option>
                    `;
                })
                .join("")
        }
    `;
}


function populateMembershipFilter() {

    const select =
        $("membershipFilter");

    if (!select) {
        return;
    }

    const memberships =
        new Map();

    state.students.forEach(student => {

        if (
            student.membershipName &&
            student.membershipName !== "No Plan"
        ) {
            memberships.set(
                student.planId ||
                student.membershipName,
                student.membershipName
            );
        }
    });


    select.innerHTML = `
        <option value="all">
            All Memberships
        </option>

        ${
            [...memberships.entries()]
                .map(
                    ([id, name]) => `
                        <option value="${escapeHtml(id)}">
                            ${escapeHtml(name)}
                        </option>
                    `
                )
                .join("")
        }
    `;
}


/* =========================================================
   ADD STUDENT
========================================================= */

function openAddStudentModal() {

    state.editingStudentId = null;

    renderSeatOptions();

    $("studentModalTitle").textContent =
        "Add Student";

    $("saveStudentBtn").textContent =
        "Save Student";

    resetStudentForm();

    $("studentModal")
        .classList.add("open");

    $("studentModal")
        .setAttribute("aria-hidden", "false");

    $("studentName")?.focus();
}


function resetStudentForm() {

    $("studentForm")?.reset();

    $("studentRecordId").value = "";

    $("admissionDate").value =
        getTodayDate();

    $("formError").classList.remove("show");

    $("formError").textContent = "";
}


/* =========================================================
   EDIT STUDENT
========================================================= */

function openEditStudent(studentId) {

    const student =
        state.students.find(
            item => item.id === studentId
        );

    if (!student) {

        showToast(
            "Student record was not found."
        );

        return;
    }


    state.editingStudentId =
        student.id;


    $("studentModalTitle").textContent =
        "Edit Student";

    $("saveStudentBtn").textContent =
        "Update Student";


    $("studentRecordId").value =
        student.id;

    $("studentName").value =
        student.name === "Unnamed Student"
            ? ""
            : student.name;

    $("studentMobile").value =
        student.mobile === "—"
            ? ""
            : student.mobile;

    $("studentEmail").value =
        student.email;

    $("studentAddress").value =
        student.address;

    $("admissionDate").value =
        toInputDate(student.admissionDate);

    $("membershipPlan").value =
        student.planId;

    $("membershipStart").value =
        toInputDate(student.startDate);

    $("membershipEnd").value =
        toInputDate(student.endDate);

    renderSeatOptions();

    $("seatId").value =
        student.seatId;

    $("totalFee").value =
        student.totalFee || "";

    $("paidFee").value =
        student.paidFee || "";

    $("paymentMode").value =
        student.paymentMode || "";


    $("formError").classList.remove("show");

    $("studentModal")
        .classList.add("open");

    $("studentModal")
        .setAttribute("aria-hidden", "false");
}


/* =========================================================
   SAVE STUDENT
========================================================= */

async function handleStudentSubmit(event) {

    event.preventDefault();

    clearFormError();


    const name =
        $("studentName").value.trim();

    const mobile =
        $("studentMobile").value.trim();

    const email =
        $("studentEmail").value.trim();

    const address =
        $("studentAddress").value.trim();

    const admissionDate =
        $("admissionDate").value;

    const planId =
        $("membershipPlan").value;

    const startDate =
        $("membershipStart").value;

    const endDate =
        $("membershipEnd").value;

    const seatId =
        $("seatId").value;

    const totalFee =
        Number($("totalFee").value || 0);

    const paidFee =
        Number($("paidFee").value || 0);

    const paymentMode =
        $("paymentMode").value;


    if (!name) {
        return showFormError(
            "Student name is required."
        );
    }

    if (!mobile) {
        return showFormError(
            "Mobile number is required."
        );
    }

    if (!admissionDate) {
        return showFormError(
            "Admission date is required."
        );
    }

    if (
        !Number.isFinite(totalFee) ||
        totalFee < 0
    ) {
        return showFormError(
            "Enter a valid total fee."
        );
    }

    if (
        !Number.isFinite(paidFee) ||
        paidFee < 0
    ) {
        return showFormError(
            "Enter a valid paid amount."
        );
    }

    if (paidFee > totalFee) {
        return showFormError(
            "Paid amount cannot be greater than total fee."
        );
    }


    const payload = {
        name,
        mobile,
        email: email || undefined,
        address: address || undefined,

        admissionDate,

        membershipPlanId:
            planId || undefined,

        membershipStart:
            startDate || undefined,

        membershipEnd:
            endDate || undefined,

        totalFee,

        paidFee,

        paymentMode:
            paymentMode || undefined
    };


    /*
     * AUDIT FIX: seatId is intentionally NOT part of the
     * /api/learners payload above. "/api/seat-allocations"
     * is the single authoritative seat-assignment mechanism
     * (also used by Seats and Seat Chart) — sending seatId
     * directly on the learner record would create a second,
     * competing way to assign a seat. The selected seat is
     * applied separately below, after the learner is saved,
     * through that same allocation API.
     */
    const previousSeatId =
        state.editingStudentId
            ? (
                state.students.find(
                    student =>
                        student.id === state.editingStudentId
                )?.seatId || ""
            )
            : "";


    const button =
        $("saveStudentBtn");

    button.disabled = true;

    button.textContent =
        state.editingStudentId
            ? "Updating..."
            : "Saving...";


    try {

        let endpoint;
        let method;


        if (state.editingStudentId) {

            endpoint =
                `/api/learners/${encodeURIComponent(
                    state.editingStudentId
                )}`;

            method = "PATCH";

        } else {

            endpoint =
                "/api/learners";

            method = "POST";
        }


        const savedPayload =
            await apiRequest(
                endpoint,
                {
                    method,
                    body: JSON.stringify(payload)
                }
            );

        // Save one-time portal credentials returned by the backend.
        // Backend returns them inside data.portalCredentials.
        if (!state.editingStudentId) {
            const rawPayload = savedPayload || {};
            const responseData =
                rawPayload?.data ||
                rawPayload?.student ||
                rawPayload?.learner ||
                unwrapObject(rawPayload) ||
                {};

            const credentials =
                responseData?.portalCredentials ||
                rawPayload?.portalCredentials ||
                responseData?.data?.portalCredentials ||
                {};

            const savedStudentKey =
                responseData?._id ||
                responseData?.id ||
                responseData?.studentId ||
                rawPayload?._id ||
                rawPayload?.id ||
                "";

            if (
                savedStudentKey &&
                credentials.loginId &&
                credentials.temporaryPassword
            ) {
                saveStudentCredentials(
                    savedStudentKey,
                    {
                        loginId: credentials.loginId,
                        temporaryPassword: credentials.temporaryPassword
                    }
                );
            }
        }

        const studentIdForSeat =
            state.editingStudentId ||
            unwrapObject(savedPayload)?._id ||
            unwrapObject(savedPayload)?.id ||
            savedPayload?.data?._id ||
            savedPayload?.data?.id ||
            "";

        if (!state.editingStudentId && studentIdForSeat) {
            const rawPayload = savedPayload || {};
            const responseData =
                rawPayload?.data ||
                rawPayload?.student ||
                rawPayload?.learner ||
                {};

            const credentials =
                responseData?.portalCredentials ||
                rawPayload?.portalCredentials ||
                responseData?.data?.portalCredentials ||
                {};

            if (credentials.loginId || credentials.temporaryPassword) {
                saveStudentCredentials(studentIdForSeat, {
                    loginId: credentials.loginId || "",
                    temporaryPassword: credentials.temporaryPassword || ""
                });
            }
        }


        let seatWarning = "";

        if (
            studentIdForSeat &&
            seatId !== previousSeatId
        ) {

            try {

                if (previousSeatId) {

                    await apiRequest(
                        `/api/seat-allocations/${encodeURIComponent(
                            previousSeatId
                        )}/release`,
                        {
                            method: "POST"
                        }
                    );
                }

                if (seatId) {

                    await apiRequest(
                        "/api/seat-allocations",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                seatId,
                                studentId: studentIdForSeat
                            })
                        }
                    );
                }

            } catch (seatError) {

                console.error(
                    "[Students] Seat allocation update failed:",
                    seatError
                );

                seatWarning =
                    " Student saved, but the seat change failed: " +
                    (
                        seatError.message ||
                        "please update the seat from the Seats page."
                    );
            }
        }


        closeStudentModal();

        showToast(
            (
                state.editingStudentId
                    ? "Student updated successfully."
                    : "Student added successfully."
            ) + seatWarning
        );


        await Promise.all([
            loadStudents(),
            loadSeats()
        ]);


    } catch (error) {

        console.error(
            "[Students] Save failed:",
            error
        );

        showFormError(
            error.message ||
            "Unable to save student."
        );

    } finally {

        button.disabled = false;

        button.textContent =
            state.editingStudentId
                ? "Update Student"
                : "Save Student";
    }
}


/* =========================================================
   VIEW STUDENT
========================================================= */

function viewStudent(studentId) {

    const student =
        state.students.find(
            item => item.id === studentId
        );

    if (!student) {
        return;
    }


    /*
     * Student profile page already exists
     * in the project structure.
     */
    const url =
        `student-profile.html?id=${encodeURIComponent(
            student.id
        )}`;

    window.location.href = url;
}


/* =========================================================
   MODAL
========================================================= */

function closeStudentModal() {

    $("studentModal")
        .classList.remove("open");

    $("studentModal")
        .setAttribute("aria-hidden", "true");

    state.editingStudentId = null;
}


function clearFormError() {

    $("formError")
        .classList.remove("show");

    $("formError")
        .textContent = "";
}


function showFormError(message) {

    const error =
        $("formError");

    error.textContent =
        message;

    error.classList.add("show");
}


/* =========================================================
   UI STATES
========================================================= */

function renderLoadingState() {

    const body =
        $("studentsTableBody");

    if (!body) {
        return;
    }

    body.innerHTML = `
        <tr>
            <td colspan="9" class="table-state">
                <div class="loading-spinner"></div>
                <span>Loading students...</span>
            </td>
        </tr>
    `;

    updateResultCount(0);
}


function renderErrorState(message) {

    const body =
        $("studentsTableBody");

    if (!body) {
        return;
    }

    body.innerHTML = `
        <tr>
            <td colspan="9" class="table-state">

                <span>
                    ${escapeHtml(message)}
                </span>

                <button
                    type="button"
                    class="refresh-btn"
                    style="margin-top:12px;"
                    id="tableRetryBtn"
                >
                    Try Again
                </button>

            </td>
        </tr>
    `;

    $("tableRetryBtn")
        ?.addEventListener(
            "click",
            loadStudents
        );

    updateResultCount(0);
}


/* =========================================================
   EVENT HANDLERS
========================================================= */

function setupEvents() {

    $("addStudentBtn")
        ?.addEventListener(
            "click",
            openAddStudentModal
        );


    $("closeStudentModal")
        ?.addEventListener(
            "click",
            closeStudentModal
        );


    $("cancelStudentBtn")
        ?.addEventListener(
            "click",
            closeStudentModal
        );


    $("studentModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("studentModal")
                ) {
                    closeStudentModal();
                }
            }
        );


    $("studentForm")
        ?.addEventListener(
            "submit",
            handleStudentSubmit
        );


    $("refreshBtn")
        ?.addEventListener(
            "click",
            loadStudents
        );


    $("studentSearch")
        ?.addEventListener(
            "input",
            applyFilters
        );


    $("statusFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("membershipFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("studentsTableBody")
        ?.addEventListener(
            "click",
            event => {

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


                if (action === "view") {
                    viewStudent(id);
                }

                if (action === "edit") {
                    openEditStudent(id);
                }

                if (action === "toggle-password") {
                    const value =
                        button
                            .closest("td")
                            ?.querySelector("[data-password-value]");

                    if (!value) return;

                    const visible =
                        value.dataset.passwordVisible === "true";

                    if (visible) {
                        value.textContent = "••••••••";
                        value.dataset.passwordVisible = "false";
                    } else {
                        value.textContent =
                            value.dataset.passwordValue || "—";
                        value.dataset.passwordVisible = "true";
                    }
                }
            }
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
                closeStudentModal();
                closeSidebar();
            }
        }
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
   OWNER INFO
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
            "[Students] Owner info unavailable:",
            error.message
        );
    }
}


/* =========================================================
   LOGOUT
========================================================= */

function clearClientAuth() {

    const keys = [
        "missionRajAccessToken",
        "missionRajToken",
        "accessToken",
        "access_token",
        "token",
        "missionRajAuth"
    ];

    keys.forEach(
        key => localStorage.removeItem(key)
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
            value;
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


function toInputDate(value) {

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
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getTodayDate() {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   INITIALIZE
========================================================= */

async function init() {

    if (!requireAuth()) {
        return;
    }

    setupEvents();

    await Promise.all([
        loadOwnerInfo(),
        loadStudents(),
        loadPlans(),
        loadSeats()
    ]);
}


document.addEventListener(
    "DOMContentLoaded",
    init
);