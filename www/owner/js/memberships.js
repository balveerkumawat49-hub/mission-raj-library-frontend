"use strict";

/*
 * Mission Raj Library
 * Owner -> Membership Management
 *
 * Backend is the source of truth.
 * No fake/demo membership plans are created.
 */

const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";


const state = {
    plans: [],
    filteredPlans: [],
    benefits: [],
    editingPlanId: null,
    selectedPlan: null
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

    if (Array.isArray(payload?.plans)) {
        return payload.plans;
    }

    if (Array.isArray(payload?.data?.plans)) {
        return payload.data.plans;
    }

    return [];
}


/* =========================================================
   NORMALIZE PLAN
========================================================= */

function normalizePlan(plan) {

    const durationObject =
        plan.duration &&
        typeof plan.duration === "object"
            ? plan.duration
            : null;


    const durationValue =
        Number(
            plan.durationValue ??
            durationObject?.value ??
            plan.duration ??
            plan.validity ??
            0
        );


    const durationUnit =
        String(
            plan.durationUnit ??
            durationObject?.unit ??
            plan.validityUnit ??
            "month"
        )
            .toLowerCase()
            .trim();


    const rawBenefits =
        plan.benefits ||
        plan.features ||
        [];


    const benefits =
        Array.isArray(rawBenefits)
            ? rawBenefits
                .map(item => {

                    if (
                        typeof item ===
                        "string"
                    ) {
                        return item.trim();
                    }

                    return String(
                        item?.name ||
                        item?.title ||
                        item?.text ||
                        ""
                    ).trim();

                })
                .filter(Boolean)

            : [];


    return {

        raw: plan,

        id:
            plan._id ||
            plan.id ||
            "",

        name:
            plan.name ||
            plan.planName ||
            plan.title ||
            "Unnamed Plan",

        durationValue,

        durationUnit,

        price:
            Number(
                plan.price ??
                plan.amount ??
                plan.fee ??
                0
            ),

        status:
            normalizeStatus(
                plan.status ??
                (
                    plan.isActive === false
                        ? "inactive"
                        : "active"
                )
            ),

        description:
            plan.description ||
            plan.details ||
            "",

        benefits,

        memberCount:
            Number(
                plan.activeMembers ??
                plan.memberCount ??
                plan.studentsCount ??
                plan.enrolledCount ??
                0
            ),

        createdAt:
            plan.createdAt ||
            null
    };
}


/* =========================================================
   LOAD
========================================================= */

async function loadPlans() {

    showLoading();

    hideApiError();


    try {

        const payload =
            await apiRequest(
                "/api/plans"
            );


        state.plans =
            unwrapList(payload)
                .map(normalizePlan)
                .filter(
                    plan => plan.id
                );


        populateDurationFilter();

        applyFilters();

        showPlansSection();


    } catch (error) {

        console.error(
            "[Memberships]",
            error
        );


        showApiError(
            error.message ||
            "Unable to load membership plans."
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
            "[Memberships] Owner info unavailable:",
            error.message
        );
    }
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        $("planSearch")
            .value
            .trim()
            .toLowerCase();


    const status =
        $("statusFilter")
            .value;


    const duration =
        $("durationFilter")
            .value;


    state.filteredPlans =
        state.plans.filter(
            plan => {

                const searchable =
                    [
                        plan.name,
                        plan.description,
                        plan.durationValue,
                        plan.durationUnit,
                        ...plan.benefits
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
                    plan.status === status;


                const durationKey =
                    `${plan.durationValue}:${plan.durationUnit}`;


                const matchesDuration =
                    duration === "all" ||
                    durationKey === duration;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesDuration
                );
            }
        );


    renderStats();

    renderPlans();
}


function populateDurationFilter() {

    const select =
        $("durationFilter");


    const current =
        select.value;


    const durations =
        [
            ...new Set(
                state.plans.map(
                    plan =>
                        `${plan.durationValue}:${plan.durationUnit}`
                )
            )
        ]
        .sort(
            (a, b) => {

                const [
                    av,
                    au
                ] = a.split(":");

                const [
                    bv,
                    bu
                ] = b.split(":");


                return (
                    Number(av) -
                    Number(bv)
                ) || au.localeCompare(bu);
            }
        );


    select.innerHTML = `
        <option value="all">
            All Durations
        </option>
    `;


    durations.forEach(
        value => {

            const [
                amount,
                unit
            ] =
                value.split(":");


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                value;


            option.textContent =
                formatDuration(
                    Number(amount),
                    unit
                );


            select.appendChild(
                option
            );
        }
    );


    if (
        durations.includes(current)
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
        state.plans.length;


    const active =
        state.plans.filter(
            plan =>
                plan.status ===
                "active"
        ).length;


    const inactive =
        state.plans.filter(
            plan =>
                plan.status !==
                "active"
        ).length;


    const activeMembers =
        state.plans.reduce(
            (
                total,
                plan
            ) =>
                total +
                (
                    Number.isFinite(
                        plan.memberCount
                    )
                        ? plan.memberCount
                        : 0
                ),
            0
        );


    setText(
        "totalPlans",
        total
    );


    setText(
        "activePlans",
        active
    );


    setText(
        "inactivePlans",
        inactive
    );


    setText(
        "activeMembers",
        activeMembers
    );
}


/* =========================================================
   RENDER
========================================================= */

function renderPlans() {

    const grid =
        $("plansGrid");


    const empty =
        $("emptyState");


    setText(
        "planResultCount",
        `${state.filteredPlans.length} ${
            state.filteredPlans.length === 1
                ? "plan"
                : "plans"
        }`
    );


    if (
        !state.filteredPlans.length
    ) {

        grid.innerHTML = "";

        empty.style.display =
            "block";

        return;
    }


    empty.style.display =
        "none";


    grid.innerHTML =
        state.filteredPlans
            .map(
                plan =>
                    renderPlanCard(
                        plan
                    )
            )
            .join("");
}


function renderPlanCard(plan) {

    const benefits =
        plan.benefits.length
            ? plan.benefits
                .slice(0, 4)
                .map(
                    benefit =>
                        `<li>${escapeHtml(
                            benefit
                        )}</li>`
                )
                .join("")

            : `
                <li>
                    No benefits specified
                </li>
            `;


    const extraBenefits =
        plan.benefits.length > 4
            ? `
                <li>
                    +${plan.benefits.length - 4}
                    more
                </li>
            `
            : "";


    const toggleText =
        plan.status === "active"
            ? "Deactivate"
            : "Activate";


    return `
        <article
            class="plan-card"
            data-plan-id="${escapeHtml(
                plan.id
            )}"
        >

            <div class="plan-card-top">

                <div>

                    <div class="plan-name">
                        ${escapeHtml(
                            plan.name
                        )}
                    </div>

                    <div class="plan-duration">
                        ${escapeHtml(
                            formatDuration(
                                plan.durationValue,
                                plan.durationUnit
                            )
                        )}
                    </div>

                </div>

                <span class="plan-status ${escapeHtml(
                    plan.status
                )}">
                    ${escapeHtml(
                        capitalize(
                            plan.status
                        )
                    )}
                </span>

            </div>


            <div class="plan-price">

                <strong>
                    ₹${formatMoney(
                        plan.price
                    )}
                </strong>

                <span>
                    / ${escapeHtml(
                        durationShort(
                            plan.durationValue,
                            plan.durationUnit
                        )
                    )}
                </span>

            </div>


            <div class="plan-description">
                ${escapeHtml(
                    plan.description ||
                    "No description provided."
                )}
            </div>


            <div class="plan-meta">

                <div class="plan-meta-item">

                    <span>
                        Active Members
                    </span>

                    <strong>
                        ${formatNumber(
                            plan.memberCount
                        )}
                    </strong>

                </div>

                <div class="plan-meta-item">

                    <span>
                        Plan ID
                    </span>

                    <strong>
                        ${escapeHtml(
                            shortId(
                                plan.id
                            )
                        )}
                    </strong>

                </div>

            </div>


            <div class="plan-benefits">

                <div class="plan-benefits-title">
                    Benefits
                </div>

                <ul>
                    ${benefits}
                    ${extraBenefits}
                </ul>

            </div>


            <div class="plan-card-actions">

                <button
                    type="button"
                    class="plan-action"
                    data-action="details"
                    data-id="${escapeHtml(
                        plan.id
                    )}"
                >
                    Details
                </button>

                <button
                    type="button"
                    class="plan-action primary"
                    data-action="edit"
                    data-id="${escapeHtml(
                        plan.id
                    )}"
                >
                    Edit
                </button>

                <button
                    type="button"
                    class="plan-action warning"
                    data-action="toggle"
                    data-id="${escapeHtml(
                        plan.id
                    )}"
                >
                    ${toggleText}
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   PLAN FORM
========================================================= */

function openCreatePlanModal() {

    state.editingPlanId =
        null;


    setText(
        "planModalTitle",
        "Create Plan"
    );


    $("planForm").reset();


    $("durationUnit").value =
        "month";


    $("planStatus").value =
        "active";


    state.benefits = [];

    renderBenefits();


    clearPlanFormError();


    openModal(
        "planModal"
    );
}


function openEditPlanModal(
    plan
) {

    if (!plan) {
        return;
    }


    state.editingPlanId =
        plan.id;


    setText(
        "planModalTitle",
        "Edit Plan"
    );


    $("planName").value =
        plan.name || "";


    $("durationValue").value =
        plan.durationValue || "";


    $("durationUnit").value =
        plan.durationUnit || "month";


    $("planPrice").value =
        Number.isFinite(
            plan.price
        )
            ? plan.price
            : "";


    $("planStatus").value =
        plan.status === "inactive"
            ? "inactive"
            : "active";


    $("planDescription").value =
        plan.description || "";


    state.benefits =
        [...plan.benefits];


    renderBenefits();


    clearPlanFormError();


    openModal(
        "planModal"
    );
}


async function savePlan(
    event
) {

    event.preventDefault();

    clearPlanFormError();


    const name =
        $("planName")
            .value
            .trim();


    const durationValue =
        Number(
            $("durationValue")
                .value
        );


    const durationUnit =
        $("durationUnit")
            .value;


    const price =
        Number(
            $("planPrice")
                .value
        );


    const status =
        $("planStatus")
            .value;


    const description =
        $("planDescription")
            .value
            .trim();


    if (!name) {

        showPlanFormError(
            "Plan name is required."
        );

        return;
    }


    if (
        !Number.isFinite(
            durationValue
        ) ||
        durationValue <= 0
    ) {

        showPlanFormError(
            "Enter a valid duration."
        );

        return;
    }


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        showPlanFormError(
            "Enter a valid plan price."
        );

        return;
    }


    const button =
        $("savePlanBtn");


    button.disabled = true;

    button.textContent =
        "Saving...";


    try {

        const body = {

            name,

            durationValue,

            durationUnit,

            price,

            status,

            description,

            benefits:
                [...state.benefits]
        };


        if (
            state.editingPlanId
        ) {

            await apiRequest(
                `/api/plans/${encodeURIComponent(
                    state.editingPlanId
                )}`,
                {
                    method: "PATCH",
                    body:
                        JSON.stringify(
                            body
                        )
                }
            );


            showToast(
                "Membership plan updated successfully."
            );

        } else {

            await apiRequest(
                "/api/plans",
                {
                    method: "POST",
                    body:
                        JSON.stringify(
                            body
                        )
                }
            );


            showToast(
                "Membership plan created successfully."
            );
        }


        closeModal(
            "planModal"
        );


        await loadPlans();


    } catch (error) {

        console.error(
            "[Memberships] Save failed:",
            error
        );


        showPlanFormError(
            error.message ||
            "Unable to save membership plan."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Save Plan";
    }
}


/* =========================================================
   BENEFITS
========================================================= */

function addBenefit() {

    const input =
        $("benefitInput");


    const value =
        input.value.trim();


    if (!value) {
        return;
    }


    if (
        state.benefits.includes(
            value
        )
    ) {

        input.value = "";

        return;
    }


    state.benefits.push(
        value
    );


    input.value = "";

    renderBenefits();

    input.focus();
}


function removeBenefit(
    index
) {

    state.benefits.splice(
        index,
        1
    );


    renderBenefits();
}


function renderBenefits() {

    const container =
        $("benefitsList");


    if (!state.benefits.length) {

        container.innerHTML = "";

        return;
    }


    container.innerHTML =
        state.benefits
            .map(
                (
                    benefit,
                    index
                ) => `
                    <span class="benefit-tag">

                        ${escapeHtml(
                            benefit
                        )}

                        <button
                            type="button"
                            class="benefit-remove"
                            data-benefit-index="${index}"
                            aria-label="Remove benefit"
                        >
                            ×
                        </button>

                    </span>
                `
            )
            .join("");
}


/* =========================================================
   DETAIL
========================================================= */

function openPlanDetails(
    plan
) {

    if (!plan) {
        return;
    }


    state.selectedPlan =
        plan;


    setText(
        "detailPlanName",
        plan.name
    );


    setText(
        "detailPlanPrice",
        `₹${formatMoney(
            plan.price
        )}`
    );


    setText(
        "detailPlanStatus",
        capitalize(
            plan.status
        )
    );


    setText(
        "detailPlanDuration",
        formatDuration(
            plan.durationValue,
            plan.durationUnit
        )
    );


    setText(
        "detailPlanMembers",
        formatNumber(
            plan.memberCount
        )
    );


    const description =
        $("detailPlanDescription");


    if (plan.description) {

        description.textContent =
            plan.description;

        description.classList.add(
            "show"
        );

    } else {

        description.textContent = "";

        description.classList.remove(
            "show"
        );
    }


    const benefits =
        $("detailBenefitsList");


    if (!plan.benefits.length) {

        benefits.innerHTML =
            "<li>No benefits specified.</li>";

    } else {

        benefits.innerHTML =
            plan.benefits
                .map(
                    benefit =>
                        `<li>${escapeHtml(
                            benefit
                        )}</li>`
                )
                .join("");
    }


    openModal(
        "detailModal"
    );
}


/* =========================================================
   TOGGLE STATUS
========================================================= */

async function togglePlan(
    plan
) {

    if (!plan) {
        return;
    }


    const activating =
        plan.status !== "active";


    const actionText =
        activating
            ? "activate"
            : "deactivate";


    const confirmed =
        window.confirm(
            `Are you sure you want to ${actionText} "${plan.name}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `/api/plans/${encodeURIComponent(
                plan.id
            )}`,
            {
                method: "PATCH",

                body:
                    JSON.stringify({
                        status:
                            activating
                                ? "active"
                                : "inactive"
                    })
            }
        );


        showToast(
            activating
                ? "Membership plan activated."
                : "Membership plan deactivated."
        );


        await loadPlans();


    } catch (error) {

        console.error(
            "[Memberships] Status update failed:",
            error
        );


        showToast(
            error.message ||
            "Unable to update plan status."
        );
    }
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("planSearch")
        .addEventListener(
            "input",
            applyFilters
        );


    $("statusFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("durationFilter")
        .addEventListener(
            "change",
            applyFilters
        );


    $("addPlanBtn")
        .addEventListener(
            "click",
            openCreatePlanModal
        );


    $("planForm")
        .addEventListener(
            "submit",
            savePlan
        );


    $("addBenefitBtn")
        .addEventListener(
            "click",
            addBenefit
        );


    $("benefitInput")
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    addBenefit();
                }
            }
        );


    $("benefitsList")
        .addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-benefit-index]"
                    );


                if (!button) {
                    return;
                }


                removeBenefit(
                    Number(
                        button.dataset
                            .benefitIndex
                    )
                );
            }
        );


    $("plansGrid")
        .addEventListener(
            "click",
            handlePlanAction
        );


    $("closePlanModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "planModal"
                )
        );


    $("cancelPlanBtn")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "planModal"
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


    $("editDetailBtn")
        .addEventListener(
            "click",
            () => {

                if (
                    state.selectedPlan
                ) {

                    closeModal(
                        "detailModal"
                    );

                    openEditPlanModal(
                        state.selectedPlan
                    );
                }
            }
        );


    $("retryBtn")
        .addEventListener(
            "click",
            loadPlans
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


function handlePlanAction(
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


    const plan =
        state.plans.find(
            item =>
                item.id === id
        );


    if (!plan) {
        return;
    }


    if (
        action ===
        "details"
    ) {

        openPlanDetails(
            plan
        );

        return;
    }


    if (
        action ===
        "edit"
    ) {

        openEditPlanModal(
            plan
        );

        return;
    }


    if (
        action ===
        "toggle"
    ) {

        togglePlan(
            plan
        );
    }
}


/* =========================================================
   MODALS
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
   UI
========================================================= */

function showLoading() {

    $("loadingState")
        .style.display =
        "flex";


    $("plansSection")
        .style.display =
        "none";
}


function showPlansSection() {

    $("loadingState")
        .style.display =
        "none";


    $("plansSection")
        .style.display =
        "block";
}


function showApiError(
    message
) {

    $("loadingState")
        .style.display =
        "none";


    $("plansSection")
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


function showPlanFormError(
    message
) {

    const element =
        $("planFormError");


    element.textContent =
        message;


    element.classList.add(
        "show"
    );
}


function clearPlanFormError() {

    const element =
        $("planFormError");


    element.textContent = "";

    element.classList.remove(
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

function normalizeStatus(
    status
) {

    const value =
        String(
            status || "active"
        )
            .toLowerCase()
            .trim();


    if (
        value === "inactive" ||
        value === "disabled" ||
        value === "deactivated"
    ) {

        return "inactive";
    }


    return "active";
}


function formatDuration(
    value,
    unit
) {

    const amount =
        Number(value) || 0;


    const normalized =
        String(
            unit || "month"
        ).toLowerCase();


    const labels = {
        day: amount === 1
            ? "Day"
            : "Days",

        week: amount === 1
            ? "Week"
            : "Weeks",

        month: amount === 1
            ? "Month"
            : "Months",

        year: amount === 1
            ? "Year"
            : "Years"
    };


    return `${amount} ${
        labels[normalized] ||
        capitalize(normalized)
    }`;
}


function durationShort(
    value,
    unit
) {

    const amount =
        Number(value) || 0;


    const normalized =
        String(
            unit || "month"
        ).toLowerCase();


    const labels = {
        day: amount === 1
            ? "day"
            : "days",

        week: amount === 1
            ? "week"
            : "weeks",

        month: amount === 1
            ? "month"
            : "months",

        year: amount === 1
            ? "year"
            : "years"
    };


    return `${amount} ${
        labels[normalized] ||
        normalized
    }`;
}


function formatMoney(
    value
) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );
}


function formatNumber(
    value
) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-IN"
    );
}


function shortId(
    value
) {

    const text =
        String(value || "");


    if (
        text.length <= 10
    ) {
        return text;
    }


    return `${text.slice(0, 6)}…${text.slice(-3)}`;
}


function capitalize(
    value
) {

    if (!value) {
        return "";
    }


    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
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
        return "O";
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
     * Existing authentication/navigation behaviour
     * is intentionally left unchanged.
     */
    if (!requireAuth()) {
        return;
    }


    setupEvents();


    await Promise.all([
        loadOwnerInfo(),
        loadPlans()
    ]);
}


document.addEventListener(
    "DOMContentLoaded",
    init
);