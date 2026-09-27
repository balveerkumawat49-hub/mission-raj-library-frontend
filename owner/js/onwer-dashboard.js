(() => {
  "use strict";

  /*
   * Mission Raj Library
   * Owner Dashboard
   *
   * Existing project structure is preserved.
   *
   * Backend:
   * GET /api/dashboard/owner
   *
   * The dashboard renders database/API data.
   * It does NOT create fake LocalStorage records.
   */


  /* =========================================================
     CONFIG
  ========================================================= */

  const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";


  /*
   * AUDIT LOG
   *
   * There is no separate audit/activity endpoint in this
   * project yet. The only activity data available comes
   * from GET /api/dashboard/owner ("recentActivity" /
   * "activity"). Rather than inventing a new endpoint or a
   * separate Reports-style page, "View history" simply
   * shows the fuller list already present in that same
   * response (it was previously being cut to 8 items).
   * No fake/local data is created here.
   */
  let activityItems = [];
  let activityExpanded = false;


  /* =========================================================
     ELEMENTS
  ========================================================= */

  const sidebar =
    document.getElementById("sidebar");

  const mobileMenu =
    document.getElementById("mobileMenu");

  const overlay =
    document.getElementById("sidebarOverlay");

  const logoutBtn =
    document.getElementById("logoutBtn");

  const currentDate =
    document.getElementById("currentDate");

  const navItems =
    document.querySelectorAll(".nav-item");

  const notificationBtn =
    document.getElementById("notificationBtn");


  /* =========================================================
     HELPERS
  ========================================================= */

  function byId(id) {
    return document.getElementById(id);
  }


  function setText(id, value) {

    const element = byId(id);

    if (!element) {
      return;
    }

    element.textContent =
      value === null ||
      value === undefined ||
      value === ""
        ? "0"
        : String(value);
  }


  function numberValue(value) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }


  function formatCurrency(value) {

    const amount =
      numberValue(value);

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
      }
    ).format(amount);
  }


  function formatNumber(value) {

    return new Intl.NumberFormat(
      "en-IN"
    ).format(
      numberValue(value)
    );
  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* =========================================================
     DATE / GREETING
  ========================================================= */

  function updateDate() {

    const now =
      new Date();

    const formatted =
      now.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "long",
          year: "numeric"
        }
      );

    setText(
      "currentDate",
      formatted
    );


    const hour =
      now.getHours();

    let greeting =
      "Good evening";

    if (hour < 12) {
      greeting = "Good morning";
    } else if (hour < 17) {
      greeting = "Good afternoon";
    }

    setText(
      "welcomeMessage",
      greeting
    );
  }


  /* =========================================================
     MOBILE SIDEBAR
  ========================================================= */

  function openSidebar() {

    sidebar?.classList.add("open");

    overlay?.classList.add("active");
  }


  function closeSidebar() {

    sidebar?.classList.remove("open");

    overlay?.classList.remove("active");
  }


  mobileMenu?.addEventListener(
    "click",
    openSidebar
  );


  overlay?.addEventListener(
    "click",
    closeSidebar
  );


  /* =========================================================
     ROUTING
  ========================================================= */

  const routes = {
    dashboard:
      "owner-dashboard.html",

    students:
      "students.html",

    seats:
      "seats.html",

    memberships:
      "memberships.html",

    attendance:
      "attendance.html",

    payments:
      "payments.html",

    notifications:
      "notifications.html",

    settings:
      "settings.html"
  };


  function navigate(page) {

    if (!page) {
      return;
    }

    if (page === "reports") {

      /*
       * Reports page does not currently exist
       * in the supplied project structure.
       *
       * Do not redirect to a non-existent file.
       */

      return;
    }

    const target =
      routes[page];

    if (target) {
      window.location.href =
        target;
    }
  }


  navItems.forEach(item => {

    item.addEventListener(
      "click",
      event => {

        const page =
          item.dataset.page;

        if (!page) {
          return;
        }

        if (page === "reports") {
          event.preventDefault();
          return;
        }

        closeSidebar();
      }
    );

  });


  document
    .querySelectorAll("[data-route]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const target =
            button.dataset.route;

          if (target) {
            window.location.href =
              target;
          }

        }
      );

    });


  notificationBtn?.addEventListener(
    "click",
    () => {
      navigate("notifications");
    }
  );


  document
    .getElementById("activityHistoryBtn")
    ?.addEventListener(
      "click",
      () => {

        activityExpanded =
          !activityExpanded;

        renderActivity(
          activityItems
        );
      }
    );


  /* =========================================================
     AUTH
  ========================================================= */

  function getAccessToken() {

    const possibleKeys = [
      "accessToken",
      "missionRajAccessToken",
      "missionRajToken",
      "token"
    ];

    for (const key of possibleKeys) {

      const value =
        localStorage.getItem(key);

      if (value) {
        return value;
      }
    }

    return null;
  }


  async function apiRequest(
    endpoint,
    options = {}
  ) {

    const token =
      getAccessToken();

    const headers = {
      "Content-Type":
        "application/json",
      ...(options.headers || {})
    };


    if (token) {

      headers.Authorization =
        `Bearer ${token}`;
    }


    const response =
      await fetch(
        `${API_BASE}${endpoint}`,
        {
          ...options,
          headers
        }
      );


    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      /*
       * Do not silently show fake dashboard data.
       * Authentication must be fixed instead.
       */

      throw new Error(
        "AUTH_REQUIRED"
      );
    }


    if (!response.ok) {

      throw new Error(
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`
      );
    }


    return data;
  }


  /* =========================================================
     DASHBOARD DATA
  ========================================================= */

  function normalizeDashboardResponse(response) {

    /*
     * Supports both:
     *
     * {
     *   data: {...}
     * }
     *
     * and:
     *
     * {...}
     */

    return response?.data ||
      response ||
      {};
  }


  function renderDashboard(raw) {

    const data =
      normalizeDashboardResponse(raw);


    const totalMembers =
      numberValue(
        data.totalMembers ??
        data.totalLearners ??
        data.members?.total
      );


    const activeMembers =
      numberValue(
        data.activeMembers ??
        data.activeLearners ??
        data.members?.active
      );


    const newMembers =
      numberValue(
        data.newMembers ??
        data.newAdmissions ??
        data.members?.newThisMonth
      );


    const expiredMembers =
      numberValue(
        data.expiredMembers ??
        data.expiredLearners ??
        data.members?.expired
      );


    const totalSeats =
      numberValue(
        data.totalSeats ??
        data.seats?.total
      );


    const occupiedSeats =
      numberValue(
        data.occupiedSeats ??
        data.seats?.occupied
      );


    const availableSeats =
      numberValue(
        data.availableSeats ??
        data.seats?.available
      );


    const reservedSeats =
      numberValue(
        data.reservedSeats ??
        data.seats?.reserved
      );


    const maintenanceSeats =
      numberValue(
        data.maintenanceSeats ??
        data.seats?.maintenance
      );

    const blockedSeats =
      numberValue(
        data.blockedSeats ??
        data.seats?.blocked
      );


    const todayCollection =
      numberValue(
        data.todayCollection ??
        data.today?.collection ??
        data.finance?.todayCollection
      );


    const monthCollection =
      numberValue(
        data.monthCollection ??
        data.monthlyCollection ??
        data.finance?.monthCollection
      );


    const pendingFees =
      numberValue(
        data.pendingFees ??
        data.totalPendingFees ??
        data.finance?.pendingFees
      );


    const renewalCollection =
      numberValue(
        data.renewalCollection ??
        data.renewals?.collection ??
        data.finance?.renewalCollection
      );


    const paymentCount =
      numberValue(
        data.paymentCount ??
        data.totalPayments ??
        data.finance?.paymentCount
      );


    const todayCheckins =
      numberValue(
        data.todayCheckins ??
        data.checkinsToday ??
        data.attendance?.todayCheckins
      );


    const currentlyInside =
      numberValue(
        data.currentlyInside ??
        data.insideNow ??
        data.attendance?.currentlyInside
      );


    const postExpiryVisits =
      numberValue(
        data.postExpiryVisits ??
        data.postExpiryVisitsToday ??
        data.attendance?.postExpiryVisits ??
        data.attendance?.postExpiryVisitsToday
      );


    const occupancy =
      totalSeats > 0
        ? Math.round(
            (occupiedSeats / totalSeats) * 100
          )
        : 0;


    const activePercentage =
      totalMembers > 0
        ? Math.round(
            (activeMembers / totalMembers) * 1000
          ) / 10
        : 0;


    setText(
      "totalMembers",
      formatNumber(totalMembers)
    );

    setText(
      "newMembers",
      `+${formatNumber(newMembers)}`
    );

    setText(
      "expiredMembers",
      formatNumber(expiredMembers)
    );

    setText(
      "activeMembers",
      formatNumber(activeMembers)
    );

    setText(
      "activePercentage",
      `${activePercentage}%`
    );

    setText(
      "seatSummary",
      `${formatNumber(occupiedSeats)} / ${formatNumber(totalSeats)}`
    );

    setText(
      "seatPercentage",
      `${occupancy}%`
    );

    setText(
      "todayCollection",
      formatCurrency(todayCollection)
    );

    setText(
      "occupancyPercentage",
      `${occupancy}%`
    );

    setText(
      "occupiedSeats",
      formatNumber(occupiedSeats)
    );

    setText(
      "availableSeats",
      formatNumber(availableSeats)
    );

    setText(
      "reservedSeats",
      formatNumber(reservedSeats)
    );

    setText(
      "maintenanceSeats",
      formatNumber(maintenanceSeats)
    );

    setText(
      "blockedSeats",
      formatNumber(blockedSeats)
    );

    setText(
      "todayCheckins",
      formatNumber(todayCheckins)
    );

    setText(
      "currentlyInside",
      formatNumber(currentlyInside)
    );

    setText(
      "postExpiryVisits",
      formatNumber(postExpiryVisits)
    );

    setText(
      "monthCollection",
      formatCurrency(monthCollection)
    );

    setText(
      "pendingFees",
      formatCurrency(pendingFees)
    );

    setText(
      "renewalCollection",
      formatCurrency(renewalCollection)
    );

    setText(
      "paymentCount",
      formatNumber(paymentCount)
    );


    const circle =
      document.querySelector(
        ".occupancy-circle"
      );

    if (circle) {

      circle.style.setProperty(
        "--occupancy",
        `${occupancy}%`
      );
    }


    const attendanceProgress =
      byId("attendanceProgress");

    if (attendanceProgress) {

      const attendanceTarget =
        numberValue(
          data.attendanceTarget ??
          data.attendance?.target ??
          0
        );

      let progress = 0;

      if (attendanceTarget > 0) {

        progress =
          Math.min(
            100,
            Math.round(
              (todayCheckins / attendanceTarget) * 100
            )
          );

      } else {

        /*
         * No invented attendance target.
         * Keep progress visually neutral.
         */

        progress = 0;
      }

      attendanceProgress.style.width =
        `${progress}%`;
    }


    setText(
      "peakHours",
      data.peakHours ??
      data.attendance?.peakHours ??
      "—"
    );


    setText(
      "collectionChange",
      data.collectionChange !== undefined
        ? `${numberValue(data.collectionChange) >= 0 ? "+" : ""}${numberValue(data.collectionChange)}%`
        : "—"
    );


    renderOwner(
      data.owner
    );

    renderExpiryList(
      data.expiringMemberships ??
      data.expiringSoon ??
      data.memberships?.expiringSoon ??
      []
    );

    renderActivity(
      data.recentActivity ??
      data.activity ??
      []
    );

    const unreadNotifications =
      data.unreadNotifications ??
      data.notifications?.unread;

    if (
      unreadNotifications !==
      undefined &&
      unreadNotifications !== null
    ) {
      updateNotificationBadge(
        unreadNotifications
      );
    }
  }


  /* =========================================================
     OWNER
  ========================================================= */

  function renderOwner(owner) {

    if (!owner) {
      return;
    }

    const name =
      owner.name ||
      owner.fullName ||
      owner.username;

    const role =
      owner.role ||
      owner.designation ||
      "Owner";


    if (name) {

      setText(
        "ownerName",
        name
      );


      const initials =
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map(
            part =>
              part.charAt(0).toUpperCase()
          )
          .join("");


      setText(
        "ownerAvatar",
        initials || "MR"
      );
    }


    setText(
      "ownerRole",
      role
    );
  }


  /* =========================================================
     EXPIRING MEMBERSHIPS
  ========================================================= */

  function renderExpiryList(items) {

    const container =
      byId("expiryList");

    if (!container) {
      return;
    }


    if (!Array.isArray(items) ||
        items.length === 0) {

      container.innerHTML =
        `<div class="empty-state">
          No memberships expiring in the next 7 days.
        </div>`;

      return;
    }


    container.innerHTML =
      items
        .slice(0, 6)
        .map(item => {

          const name =
            item.studentName ||
            item.name ||
            item.student?.name ||
            "Student";


          const seat =
            item.seatNumber ||
            item.seat?.number ||
            "No seat";


          const days =
            item.daysRemaining !== undefined
              ? `${item.daysRemaining} days`
              : "Expiring soon";


          const date =
            item.expiryDate ||
            item.endDate ||
            item.membershipEndDate;


          let formattedDate =
            "—";


          if (date) {

            const parsed =
              new Date(date);

            if (!Number.isNaN(parsed.getTime())) {

              formattedDate =
                parsed.toLocaleDateString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short"
                  }
                );
            }
          }


          const initials =
            name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map(
                part =>
                  part.charAt(0).toUpperCase()
              )
              .join("");


          return `
            <div class="expiry-item">

              <div class="student-avatar">
                ${escapeHTML(initials || "ST")}
              </div>

              <div class="student-details">
                <strong>
                  ${escapeHTML(name)}
                </strong>

                <span>
                  Seat ${escapeHTML(seat)}
                </span>
              </div>

              <div class="expiry-date">
                <strong>
                  ${escapeHTML(days)}
                </strong>

                <span>
                  ${escapeHTML(formattedDate)}
                </span>
              </div>

            </div>
          `;

        })
        .join("");
  }


  /* =========================================================
     RECENT ACTIVITY
  ========================================================= */

  function renderActivity(items) {

    const container =
      byId("activityList");

    if (!container) {
      return;
    }


    activityItems =
      Array.isArray(items)
        ? items
        : [];


    if (activityItems.length === 0) {

      container.innerHTML =
        `<div class="empty-state">
          No recent activity available.
        </div>`;

      updateActivityToggleLabel();

      return;
    }


    const visibleItems =
      activityExpanded
        ? activityItems
        : activityItems.slice(0, 8);


    container.innerHTML =
      visibleItems
        .map(item => {

          const title =
            item.title ||
            item.action ||
            item.type ||
            "Activity";


          const description =
            item.description ||
            item.message ||
            item.details ||
            "";


          const time =
            item.time ||
            item.createdAt ||
            "";


          let displayTime =
            time;


          if (
            time &&
            !Number.isNaN(
              new Date(time).getTime()
            )
          ) {

            displayTime =
              new Date(time)
                .toLocaleString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  }
                );
          }


          return `
            <div class="activity-item">

              <span class="activity-icon blue">
                •
              </span>

              <div>
                <strong>
                  ${escapeHTML(title)}
                </strong>

                <p>
                  ${escapeHTML(description)}
                </p>
              </div>

              <time>
                ${escapeHTML(displayTime)}
              </time>

            </div>
          `;

        })
        .join("");


    updateActivityToggleLabel();
  }


  function updateActivityToggleLabel() {

    const button =
      byId("activityHistoryBtn");

    if (!button) {
      return;
    }

    const hasMore =
      activityItems.length > 8;

    button.style.display =
      hasMore ? "" : "none";

    button.textContent =
      activityExpanded
        ? "Show recent →"
        : "View history →";
  }


  /* =========================================================
     NOTIFICATIONS
  ========================================================= */

  function updateNotificationBadge(value) {

    const badge =
      byId("notificationBadge");

    if (!badge) {
      return;
    }


    const count =
      numberValue(value);


    badge.textContent =
      count > 99
        ? "99+"
        : String(count);


    badge.style.display =
      count > 0
        ? "inline-flex"
        : "none";
  }


  /* =========================================================
     LOADING STATE
  ========================================================= */

  function showLoadingState() {

    setText(
      "totalMembers",
      "—"
    );

    setText(
      "activeMembers",
      "—"
    );

    setText(
      "seatSummary",
      "—"
    );

    setText(
      "todayCollection",
      "—"
    );

    setText(
      "occupancyPercentage",
      "—"
    );

    setText(
      "todayCheckins",
      "—"
    );

    setText(
      "currentlyInside",
      "—"
    );

    setText(
      "monthCollection",
      "—"
    );

    setText(
      "pendingFees",
      "—"
    );

    setText(
      "renewalCollection",
      "—"
    );

    setText(
      "paymentCount",
      "—"
    );
  }


  /* =========================================================
     ERROR STATE
  ========================================================= */

  function showDashboardError(error) {

    console.error(
      "Mission Raj dashboard error:",
      error
    );


    const expiry =
      byId("expiryList");

    if (expiry) {

      expiry.innerHTML =
        `<div class="empty-state">
          Dashboard data could not be loaded.
          Please check the backend connection.
        </div>`;
    }


    const activity =
      byId("activityList");

    if (activity) {

      activity.innerHTML =
        `<div class="empty-state">
          Unable to load recent activity.
        </div>`;
    }


    if (
      error?.message ===
      "AUTH_REQUIRED"
    ) {

      /*
       * Do not redirect blindly.
       * Existing login/session implementation
       * remains the source of authentication.
       */

      console.warn(
        "Owner authentication is required."
      );
    }
  }


  /* =========================================================
     LOAD DASHBOARD
  ========================================================= */

  async function loadDashboard() {

    showLoadingState();

    try {

      const response =
        await apiRequest(
          "/api/dashboard/owner",
          {
            method: "GET"
          }
        );


      renderDashboard(
        response
      );

    } catch (error) {

      showDashboardError(
        error
      );
    }
  }


  /* =========================================================
     LOGOUT
  ========================================================= */

  logoutBtn?.addEventListener(
    "click",
    async () => {

      const confirmed =
        window.confirm(
          "Are you sure you want to logout?"
        );


      if (!confirmed) {
        return;
      }


      try {

        /*
         * Backend logout endpoint may be
         * added to the existing auth module.
         *
         * Do not invent a backend endpoint
         * here.
         */

      } catch (error) {

        console.error(
          "Logout error:",
          error
        );
      }


      /*
       * Clear only known client-side token keys.
       * Existing backend session remains the
       * source of truth.
       */

      [
        "accessToken",
        "missionRajAccessToken",
        "missionRajToken",
        "token"
      ].forEach(key => {

        localStorage.removeItem(
          key
        );

      });


      window.location.href =
        "../index.html";
    }
  );


  /* =========================================================
     START
  ========================================================= */

  updateDate();

  loadDashboard();

})();