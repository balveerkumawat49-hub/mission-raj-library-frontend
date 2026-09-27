"use strict";

/*
 * =========================================================
 * MISSION RAJ LIBRARY
 * OWNER NOTIFICATION CENTER
 * =========================================================
 *
 * This file handles:
 *
 * 1. Owner authentication
 * 2. Sidebar navigation
 * 3. Mobile sidebar
 * 4. Sidebar overlay
 * 5. Active navigation state
 * 6. Logout
 * 7. Notification center
 * 8. Notification API
 * 9. Create notification
 * 10. Sent notifications
 * 11. Notification details
 * 12. Read / unread
 * 13. Filters
 * 14. Pagination
 * 15. Automation rules
 *
 * IMPORTANT:
 * No demo business data is created here.
 * No notification is stored in localStorage.
 *
 * =========================================================
 */

(() => {

  "use strict";


  /* =======================================================
     CONFIG
  ======================================================= */

  const API_BASE =
    window.MISSION_RAJ_API_BASE || "https://mission-raj-library-backend.onrender.com";


  /* =======================================================
     STATE
  ======================================================= */

  const state = {

    notifications: [],

    sent: [],

    filtered: [],

    selected: new Set(),

    activeNotification: null,

    inboxFilter: "all",

    typeFilter: "all",

    priorityFilter: "all",

    search: "",

    sentSearch: "",

    sentType: "all",

    page: 1,

    pageSize: 10,

    loading: false,

    error: null

  };


  /* =======================================================
     DOM HELPERS
  ======================================================= */

  const $ = selector =>
    document.querySelector(selector);


  const $$ = selector =>
    Array.from(
      document.querySelectorAll(selector)
    );


  function byId(id) {

    return document.getElementById(id);

  }


  function setText(
    selector,
    value
  ) {

    const element =
      $(selector);

    if (!element) {
      return;
    }

    element.textContent =
      value === null ||
      value === undefined ||
      value === ""
        ? "—"
        : String(value);

  }


  /* =======================================================
     HTML SAFETY
  ======================================================= */

  function escapeHTML(value) {

    return String(
      value ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  /* =======================================================
     AUTH
  ======================================================= */

  function getToken() {

    if (
      window.MissionRajAuth &&
      typeof MissionRajAuth.getToken ===
        "function"
    ) {

      return MissionRajAuth.getToken();

    }


    const tokenKeys = [

      "missionRajAccessToken",

      "missionRajToken",

      "accessToken",

      "access_token",

      "token"

    ];


    for (
      const key of tokenKeys
    ) {

      const token =
        localStorage.getItem(
          key
        );

      if (token) {
        return token;
      }

    }


    return null;

  }


  function requireOwnerAuth() {

    if (
      window.MissionRajAuth &&
      typeof MissionRajAuth.requireAuth ===
        "function"
    ) {

      MissionRajAuth.requireAuth({

        role: "owner",

        redirect: "../index.html"

      });

    }

  }


  /* =======================================================
     API
  ======================================================= */

  async function apiRequest(
    endpoint,
    options = {}
  ) {

    if (!API_BASE) {

      throw new Error(
        "Backend API is not configured."
      );

    }


    const headers = {

      "Content-Type":
        "application/json",

      ...(options.headers || {})

    };


    const token =
      getToken();


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


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      handleAuthFailure();

      throw new Error(
        "Authentication required."
      );

    }


    let data = null;


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    if (
      contentType.includes(
        "application/json"
      )
    ) {

      try {

        data =
          await response.json();

      } catch {

        data = null;

      }

    } else {

      try {

        data =
          await response.text();

      } catch {

        data = null;

      }

    }


    if (!response.ok) {

      let message =
        `Request failed (${response.status})`;


      if (
        data &&
        typeof data === "object"
      ) {

        message =
          data.message ||
          data.error ||
          message;

      } else if (
        typeof data === "string" &&
        data.trim()
      ) {

        message =
          data;

      }


      throw new Error(
        message
      );

    }


    return data;

  }


  function handleAuthFailure() {

    if (
      window.MissionRajAuth &&
      typeof MissionRajAuth.logout ===
        "function"
    ) {

      MissionRajAuth.logout();

    }


    window.location.href =
      "../index.html";

  }


  /* =======================================================
     SIDEBAR
  ======================================================= */

  function initSidebar() {

    const sidebar =
      byId("sidebar");

    const mobileMenu =
      byId("mobileMenu");


    if (!sidebar) {

      console.error(
        "Mission Raj: #sidebar not found."
      );

      return;

    }


    /*
     * The original dashboard CSS expects
     * #sidebarOverlay.
     *
     * Notifications HTML did not contain it.
     *
     * Therefore we create it safely here.
     */

    let overlay =
      byId("sidebarOverlay");


    if (!overlay) {

      overlay =
        document.createElement(
          "div"
        );

      overlay.id =
        "sidebarOverlay";

      overlay.className =
        "sidebar-overlay";

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );


      document.body.appendChild(
        overlay
      );

    }


    /* ---------------------------------------------
       OPEN
    --------------------------------------------- */

    function openSidebar() {

      sidebar.classList.add(
        "open"
      );

      overlay.classList.add(
        "active"
      );

      overlay.setAttribute(
        "aria-hidden",
        "false"
      );


      document.body.style.overflow =
        "hidden";


      if (mobileMenu) {

        mobileMenu.setAttribute(
          "aria-expanded",
          "true"
        );

      }

    }


    /* ---------------------------------------------
       CLOSE
    --------------------------------------------- */

    function closeSidebar() {

      sidebar.classList.remove(
        "open"
      );

      overlay.classList.remove(
        "active"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );


      document.body.style.overflow =
        "";


      if (mobileMenu) {

        mobileMenu.setAttribute(
          "aria-expanded",
          "false"
        );

      }

    }


    /* ---------------------------------------------
       TOGGLE
    --------------------------------------------- */

    function toggleSidebar() {

      if (
        sidebar.classList.contains(
          "open"
        )
      ) {

        closeSidebar();

      } else {

        openSidebar();

      }

    }


    /* ---------------------------------------------
       HAMBURGER
    --------------------------------------------- */

    mobileMenu?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        event.stopPropagation();

        toggleSidebar();

      }
    );


    /* ---------------------------------------------
       OVERLAY
    --------------------------------------------- */

    overlay.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          overlay
        ) {

          closeSidebar();

        }

      }
    );


    /* ---------------------------------------------
       ESCAPE
    --------------------------------------------- */

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          closeSidebar();

          closeAllModals();

        }

      }
    );


    /* ---------------------------------------------
       NAVIGATION
    --------------------------------------------- */

    initNavigation(
      closeSidebar
    );


    /* ---------------------------------------------
       WINDOW RESIZE
    --------------------------------------------- */

    window.addEventListener(
      "resize",
      () => {

        if (
          window.innerWidth >
          820
        ) {

          closeSidebar();

        }

      }
    );


    /*
     * Prevent the sidebar from staying
     * open when browser restores page.
     */

    closeSidebar();

  }


  /* =======================================================
     NAVIGATION
  ======================================================= */

  function initNavigation(
    closeSidebar
  ) {

    const navItems =
      $$(".nav-item");


    const currentFile =
      getCurrentPage();


    navItems.forEach(
      item => {

        const page =
          item.dataset.page;


        /*
         * Reports doesn't exist yet.
         * Prevent broken "#".
         */

        if (
          page ===
          "reports"
        ) {

          item.addEventListener(
            "click",
            event => {

              event.preventDefault();

              closeSidebar();

              showToast(
                "Reports module is not available yet."
              );

            }
          );

          return;

        }


        /*
         * Correct active item
         */

        if (
          page &&
          page ===
          currentFile
        ) {

          item.classList.add(
            "active"
          );

        }


        /*
         * Normal navigation
         *
         * We DO NOT manually redirect here.
         *
         * The browser handles the <a href>.
         *
         * This avoids broken relative URLs.
         */

        item.addEventListener(
          "click",
          () => {

            closeSidebar();

          }
        );

      }
    );

  }


  /* =======================================================
     CURRENT PAGE
  ======================================================= */

  function getCurrentPage() {

    const path =
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();


    const map = {

      "owner-dashboard.html":
        "dashboard",

      "students.html":
        "students",

      "seats.html":
        "seats",

      "memberships.html":
        "memberships",

      "attendance.html":
        "attendance",

      "payments.html":
        "payments",

      "notifications.html":
        "notifications",

      "settings.html":
        "settings"

    };


    return (
      map[path] ||
      ""
    );

  }


  /* =======================================================
     LOGOUT
  ======================================================= */

  function initLogout() {

    const logoutBtn =
      byId("logoutBtn");


    logoutBtn?.addEventListener(
      "click",
      async event => {

        event.preventDefault();


        logoutBtn.disabled =
          true;


        logoutBtn.setAttribute(
          "aria-busy",
          "true"
        );


        try {

          if (
            window.MissionRajAuth &&
            typeof MissionRajAuth.logout ===
              "function"
          ) {

            await Promise.resolve(
              MissionRajAuth.logout()
            );

          }

        } catch (error) {

          console.error(
            "Logout error:",
            error
          );

        } finally {

          /*
           * Always leave the protected
           * owner area after logout.
           */

          window.location.replace(
            "../index.html"
          );

        }

      }
    );

  }


  /* =======================================================
     NOTIFICATION BUTTON
  ======================================================= */

  function initNotificationButton() {

    const button =
      byId(
        "notificationBtn"
      );


    if (!button) {
      return;
    }


    button.addEventListener(
      "click",
      () => {

        window.location.href =
          "notifications.html";

      }
    );

  }


  /* =======================================================
     LOAD INBOX
  ======================================================= */

  async function loadNotifications() {

    state.loading =
      true;

    state.error =
      null;


    try {

      if (!API_BASE) {

        throw new Error(
          "Notification API is not configured yet."
        );

      }


      const response =
        await apiRequest(
          "/api/notifications"
        );


      state.notifications =
        normalizeNotificationResponse(
          response
        );


    } catch (error) {

      console.error(
        "Load notifications:",
        error
      );


      state.notifications =
        [];


      state.error =
        error.message ||
        "Unable to load notifications.";

    } finally {

      state.loading =
        false;

    }

  }


  /* =======================================================
     LOAD SENT
  ======================================================= */

  async function loadSentNotifications() {

    try {

      if (!API_BASE) {

        state.sent =
          [];

        return;

      }


      const response =
        await apiRequest(
          "/api/notifications/sent"
        );


      state.sent =
        normalizeSentResponse(
          response
        );


    } catch (error) {

      console.error(
        "Load sent notifications:",
        error
      );


      state.sent =
        [];

    }

  }


  /* =======================================================
     NORMALIZE API
  ======================================================= */

  function normalizeNotificationResponse(
    response
  ) {

    if (
      Array.isArray(
        response
      )
    ) {

      return response;

    }


    if (
      response &&
      Array.isArray(
        response.notifications
      )
    ) {

      return response.notifications;

    }


    if (
      response?.data &&
      Array.isArray(
        response.data
      )
    ) {

      return response.data;

    }


    if (
      response?.data &&
      Array.isArray(
        response.data.notifications
      )
    ) {

      return response.data.notifications;

    }


    return [];

  }


  function normalizeSentResponse(
    response
  ) {

    if (
      Array.isArray(
        response
      )
    ) {

      return response;

    }


    if (
      response &&
      Array.isArray(
        response.sent
      )
    ) {

      return response.sent;

    }


    if (
      response &&
      Array.isArray(
        response.notifications
      )
    ) {

      return response.notifications;

    }


    if (
      response?.data &&
      Array.isArray(
        response.data
      )
    ) {

      return response.data;

    }


    return [];

  }


  /* =======================================================
     RENDER EVERYTHING
  ======================================================= */

  function renderAll() {

    renderStats();

    renderInbox();

    renderSent();

    updateNotificationBadge();

  }


  /* =======================================================
     STATS
  ======================================================= */

  function renderStats() {

    const total =
      state.notifications.length;


    const unread =
      state.notifications.filter(
        item =>
          !Boolean(
            item.read ??
            item.isRead
          )
      ).length;


    const important =
      state.notifications.filter(
        item => {

          const priority =
            item.priority ||
            "normal";

          return (
            priority ===
              "high" ||
            priority ===
              "urgent"
          );

        }
      ).length;


    const today =
      new Date()
        .toDateString();


    const sentToday =
      state.sent.filter(
        item => {

          const date =
            item.sentAt ||
            item.sent_at ||
            item.createdAt ||
            item.created_at;


          if (!date) {
            return false;
          }


          const parsed =
            new Date(date);


          if (
            Number.isNaN(
              parsed.getTime()
            )
          ) {

            return false;

          }


          return (
            parsed.toDateString() ===
            today
          );

        }
      ).length;


    setText(
      "#totalCount",
      total
    );

    setText(
      "#unreadCount",
      unread
    );

    setText(
      "#importantCount",
      important
    );

    setText(
      "#sentTodayCount",
      sentToday
    );

  }


  /* =======================================================
     BADGE
  ======================================================= */

  function updateNotificationBadge() {

    const badge =
      byId(
        "notificationBadge"
      );


    if (!badge) {
      return;
    }


    const unread =
      state.notifications.filter(
        item =>
          !Boolean(
            item.read ??
            item.isRead
          )
      ).length;


    if (unread <= 0) {

      badge.textContent =
        "0";

      badge.style.display =
        "none";

      return;

    }


    badge.textContent =
      unread > 99
        ? "99+"
        : String(unread);


    badge.style.display =
      "inline-flex";

  }


  /* =======================================================
     INBOX RENDER
  ======================================================= */

  function renderInbox() {

    const container =
      byId(
        "notificationList"
      );


    if (!container) {
      return;
    }


    let items =
      [...state.notifications];


    /*
     * Read / unread
     */

    if (
      state.inboxFilter ===
      "unread"
    ) {

      items =
        items.filter(
          item =>
            !Boolean(
              item.read ??
              item.isRead
            )
        );

    }


    /*
     * Important
     */

    if (
      state.inboxFilter ===
      "important"
    ) {

      items =
        items.filter(
          item => {

            const priority =
              item.priority ||
              "normal";

            return (
              priority ===
                "high" ||
              priority ===
                "urgent"
            );

          }
        );

    }


    /*
     * Type
     */

    if (
      state.typeFilter !==
      "all"
    ) {

      items =
        items.filter(
          item =>
            String(
              item.type ||
              "general"
            ).toLowerCase() ===
            state.typeFilter
        );

    }


    /*
     * Priority
     */

    if (
      state.priorityFilter !==
      "all"
    ) {

      items =
        items.filter(
          item =>
            String(
              item.priority ||
              "normal"
            ).toLowerCase() ===
            state.priorityFilter
        );

    }


    /*
     * Search
     */

    if (
      state.search
    ) {

      items =
        items.filter(
          item => {

            const searchable = [

              item.title,

              item.message,

              item.type,

              item.priority,

              item.source,

              item.reference

            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


            return searchable.includes(
              state.search
            );

          }
        );

    }


    state.filtered =
      items;


    /*
     * Error state
     */

    if (
      state.error &&
      !items.length
    ) {

      renderState(
        container,
        "error",
        "Notifications unavailable",
        state.error
      );


      byId(
        "pagination"
      ).innerHTML =
        "";


      updateBulkUI();

      return;

    }


    /*
     * Empty
     */

    if (!items.length) {

      renderState(
        container,
        "empty",
        "No notifications",
        "There are no notifications available."
      );


      byId(
        "pagination"
      ).innerHTML =
        "";


      updateBulkUI();

      return;

    }


    /*
     * Pagination
     */

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          items.length /
          state.pageSize
        )
      );


    if (
      state.page >
      totalPages
    ) {

      state.page =
        totalPages;

    }


    const start =
      (
        state.page -
        1
      ) *
      state.pageSize;


    const pageItems =
      items.slice(
        start,
        start +
          state.pageSize
      );


    container.innerHTML =
      pageItems
        .map(
          buildNotificationHTML
        )
        .join("");


    bindNotificationActions();

    renderPagination(
      totalPages
    );

    updateBulkUI();

  }


  /* =======================================================
     NOTIFICATION HTML
  ======================================================= */

  function buildNotificationHTML(
    item
  ) {

    const id =
      String(
        item._id ??
        item.id ??
        item.notificationId ??
        ""
      );


    const read =
      Boolean(
        item.read ??
        item.isRead
      );


    const type =
      item.type ||
      "general";


    const priority =
      item.priority ||
      "normal";


    const title =
      item.title ||
      "Untitled notification";


    const message =
      item.message ||
      "";


    const createdAt =
      item.createdAt ||
      item.created_at ||
      item.sentAt ||
      item.sent_at;


    return `

      <article
        class="notification-row ${
          read
            ? ""
            : "unread"
        }"
        data-id="${escapeHTML(id)}"
      >

        <input
          class="notification-select"
          type="checkbox"
          data-select-id="${escapeHTML(id)}"
          ${
            state.selected.has(id)
              ? "checked"
              : ""
          }
        >

        <div class="notification-icon">
          ${getTypeIcon(type)}
        </div>


        <div class="notification-row-content">

          <h3>
            ${escapeHTML(title)}
          </h3>

          <p>
            ${escapeHTML(message)}
          </p>


          <div class="notification-meta">

            <span class="type-badge">
              ${escapeHTML(
                capitalize(type)
              )}
            </span>


            <span
              class="
                priority-badge
                priority-${escapeHTML(
                  priority
                )}
              "
            >
              ${escapeHTML(
                capitalize(
                  priority
                )
              )}
            </span>


            <span class="notification-meta-text">
              ${escapeHTML(
                formatDate(
                  createdAt
                )
              )}
            </span>

          </div>

        </div>


        <div class="notification-actions">

          <button
            type="button"
            class="small-icon-btn"
            title="View notification"
            data-view-id="${escapeHTML(id)}"
          >
            ↗
          </button>


          ${
            !read
              ? `
                <button
                  type="button"
                  class="small-icon-btn"
                  title="Mark as read"
                  data-read-id="${escapeHTML(id)}"
                >
                  ✓
                </button>
              `
              : ""
          }

        </div>

      </article>

    `;

  }


  /* =======================================================
     FORMAT DATE
  ======================================================= */

  function formatDate(
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


  /* =======================================================
     CAPITALIZE
  ======================================================= */

  function capitalize(
    value
  ) {

    if (!value) {
      return "";
    }


    const text =
      String(value);


    return (
      text.charAt(0)
        .toUpperCase() +
      text.slice(1)
    );

  }


  /* =======================================================
     ICON
  ======================================================= */

  function getTypeIcon(
    type
  ) {

    const icons = {

      general: "○",

      notice: "!",

      student: "◉",

      fee: "₹",

      attendance: "✓",

      seat: "▦",

      system: "⚙"

    };


    return (
      icons[type] ||
      "○"
    );

  }


  /* =======================================================
     NOTIFICATION ACTIONS
  ======================================================= */

  function bindNotificationActions() {

    $$(
      "[data-select-id]"
    ).forEach(
      checkbox => {

        checkbox.addEventListener(
          "change",
          () => {

            const id =
              checkbox.dataset.selectId;


            if (
              checkbox.checked
            ) {

              state.selected.add(
                id
              );

            } else {

              state.selected.delete(
                id
              );

            }


            updateBulkUI();

          }
        );

      }
    );


    $$(
      "[data-view-id]"
    ).forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openNotificationDetail(
              button.dataset.viewId
            );

          }
        );

      }
    );


    $$(
      "[data-read-id]"
    ).forEach(
      button => {

        button.addEventListener(
          "click",
          async () => {

            await markAsRead(
              button.dataset.readId
            );

          }
        );

      }
    );

  }


  /* =======================================================
     MARK READ
  ======================================================= */

  async function markAsRead(
    id
  ) {

    try {

      await apiRequest(
        `/api/notifications/${encodeURIComponent(
          id
        )}/read`,
        {
          method: "PATCH"
        }
      );


      state.selected.delete(
        String(id)
      );


      await loadNotifications();

      renderAll();


    } catch (error) {

      showToast(
        error.message ||
        "Unable to mark notification as read."
      );

    }

  }


  /* =======================================================
     SELECT ALL
  ======================================================= */

  function initSelectAll() {

    byId(
      "selectAll"
    )?.addEventListener(
      "change",
      event => {

        const checked =
          event.target.checked;


        const start =
          (
            state.page -
            1
          ) *
          state.pageSize;


        const pageItems =
          state.filtered.slice(
            start,
            start +
              state.pageSize
          );


        pageItems.forEach(
          item => {

            const id =
              String(
                item._id ??
                item.id ??
                item.notificationId ??
                ""
              );


            if (!id) {
              return;
            }


            if (checked) {

              state.selected.add(
                id
              );

            } else {

              state.selected.delete(
                id
              );

            }

          }
        );


        renderInbox();

      }
    );


    byId(
      "markSelectedBtn"
    )?.addEventListener(
      "click",
      markSelectedAsRead
    );

  }


  /* =======================================================
     MARK SELECTED
  ======================================================= */

  async function markSelectedAsRead() {

    const ids =
      [...state.selected];


    if (!ids.length) {

      showToast(
        "Select at least one notification."
      );

      return;

    }


    try {

      await Promise.all(
        ids.map(
          id =>
            apiRequest(
              `/api/notifications/${encodeURIComponent(
                id
              )}/read`,
              {
                method: "PATCH"
              }
            )
        )
      );


      state.selected.clear();


      await loadNotifications();

      renderAll();


      showToast(
        "Notifications marked as read."
      );


    } catch (error) {

      showToast(
        error.message ||
        "Unable to update notifications."
      );

    }

  }


  /* =======================================================
     BULK UI
  ======================================================= */

  function updateBulkUI() {

    const wrapper =
      byId(
        "bulkActions"
      );


    if (!wrapper) {
      return;
    }


    if (
      state.selected.size >
      0
    ) {

      wrapper.classList.remove(
        "hidden"
      );

    } else {

      wrapper.classList.add(
        "hidden"
      );

    }


    setText(
      "#selectedCount",
      `${state.selected.size} selected`
    );


    const selectAll =
      byId(
        "selectAll"
      );


    if (!selectAll) {
      return;
    }


    const pageItems =
      state.filtered.slice(
        (
          state.page -
          1
        ) *
          state.pageSize,
        (
          state.page
        ) *
          state.pageSize
      );


    const selectableIds =
      pageItems
        .map(
          item =>
            String(
              item._id ??
              item.id ??
              item.notificationId ??
              ""
            )
        )
        .filter(Boolean);


    selectAll.checked =
      selectableIds.length > 0 &&
      selectableIds.every(
        id =>
          state.selected.has(id)
      );

  }


  /* =======================================================
     PAGINATION
  ======================================================= */

  function renderPagination(
    totalPages
  ) {

    const container =
      byId(
        "pagination"
      );


    if (!container) {
      return;
    }


    if (
      totalPages <= 1
    ) {

      container.innerHTML =
        "";

      return;

    }


    let html = "";


    /*
     * Previous
     */

    html += `

      <button
        type="button"
        class="pagination-button"
        data-page="${
          Math.max(
            1,
            state.page - 1
          )
        }"
        ${
          state.page === 1
            ? "disabled"
            : ""
        }
      >
        ‹
      </button>

    `;


    /*
     * Pages
     */

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {

      html += `

        <button
          type="button"
          class="
            pagination-button
            ${
              page === state.page
                ? "active"
                : ""
            }
          "
          data-page="${page}"
        >
          ${page}
        </button>

      `;

    }


    /*
     * Next
     */

    html += `

      <button
        type="button"
        class="pagination-button"
        data-page="${
          Math.min(
            totalPages,
            state.page + 1
          )
        }"
        ${
          state.page === totalPages
            ? "disabled"
            : ""
        }
      >
        ›
      </button>

    `;


    container.innerHTML =
      html;


    $$(".pagination-button")
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const page =
                Number(
                  button.dataset.page
                );


              if (
                !Number.isFinite(
                  page
                )
              ) {
                return;
              }


              state.page =
                page;


              renderInbox();

            }
          );

        }
      );

  }


  /* =======================================================
     STATE
  ======================================================= */

  function renderState(
    container,
    type,
    title,
    message
  ) {

    container.innerHTML = `

      <div
        class="
          notification-state
          ${
            type === "error"
              ? "error"
              : ""
          }
        "
      >

        <div class="notification-state-inner">

          <div class="notification-state-icon">
            ${
              type === "error"
                ? "!"
                : "○"
            }
          </div>


          <h3>
            ${escapeHTML(title)}
          </h3>


          <p>
            ${escapeHTML(message)}
          </p>


          ${
            type === "error"
              ? `
                <button
                  type="button"
                  class="secondary-btn"
                  id="retryNotificationsBtn"
                  style="margin-top:15px"
                >
                  Try Again
                </button>
              `
              : ""
          }

        </div>

      </div>

    `;


    byId(
      "retryNotificationsBtn"
    )?.addEventListener(
      "click",
      refreshNotifications
    );

  }


  /* =======================================================
     SENT
  ======================================================= */

  function renderSent() {

    const tbody =
      byId(
        "sentTableBody"
      );


    if (!tbody) {
      return;
    }


    let items =
      [...state.sent];


    if (
      state.sentType !==
      "all"
    ) {

      items =
        items.filter(
          item =>
            String(
              item.type ||
              "general"
            ).toLowerCase() ===
            state.sentType
        );

    }


    if (
      state.sentSearch
    ) {

      items =
        items.filter(
          item => {

            const searchable = [

              item.title,

              item.message,

              item.type,

              item.priority,

              item.status

            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


            return searchable.includes(
              state.sentSearch
            );

          }
        );

    }


    if (!items.length) {

      tbody.innerHTML = `

        <tr>

          <td
            colspan="6"
            style="
              text-align:center;
              padding:45px 20px;
              color:#6b7280;
            "
          >
            No sent notifications found.
          </td>

        </tr>

      `;

      return;

    }


    tbody.innerHTML =
      items
        .map(
          item => {

            const priority =
              item.priority ||
              "normal";


            return `

              <tr>

                <td>

                  <div class="notification-table-title">

                    ${escapeHTML(
                      item.title ||
                      "Untitled notification"
                    )}

                  </div>


                  <div class="notification-table-message">

                    ${escapeHTML(
                      item.message ||
                      ""
                    )}

                  </div>

                </td>


                <td>
                  ${
                    item.recipientCount ??
                    item.recipient_count ??
                    "—"
                  }
                </td>


                <td>
                  ${escapeHTML(
                    capitalize(
                      item.type ||
                      "general"
                    )
                  )}
                </td>


                <td>

                  <span
                    class="
                      priority-badge
                      priority-${escapeHTML(
                        priority
                      )}
                    "
                  >

                    ${escapeHTML(
                      capitalize(
                        priority
                      )
                    )}

                  </span>

                </td>


                <td>

                  ${escapeHTML(
                    formatDate(
                      item.sentAt ||
                      item.sent_at ||
                      item.createdAt ||
                      item.created_at
                    )
                  )}

                </td>


                <td>

                  <span class="delivery-status">

                    ${escapeHTML(
                      item.status ||
                      "Sent"
                    )}

                  </span>

                </td>

              </tr>

            `;

          }
        )
        .join("");

  }



  /* =======================================================
     NOTIFICATION TABS
  ======================================================= */

  function initNotificationTabs() {

    $$(
      ".notification-tab"
    ).forEach(
      tab => {

        tab.addEventListener(
          "click",
          () => {

            const view =
              tab.dataset.view;

            $$(".notification-tab")
              .forEach(
                item => {
                  item.classList.toggle(
                    "active",
                    item === tab
                  );
                }
              );

            $$(".notification-view")
              .forEach(
                section => {

                  section.classList.toggle(
                    "active",
                    section.id ===
                      `${view}View`
                  );

                }
              );

          }
        );

      }
    );

  }


  /* =======================================================
     CREATE MODAL
  ======================================================= */

  function initCreateNotification() {

    const openButton =
      byId(
        "openCreateBtn"
      );


    openButton?.addEventListener(
      "click",
      openCreateModal
    );


    byId(
      "notificationForm"
    )?.addEventListener(
      "submit",
      createNotification
    );


    byId(
      "recipientType"
    )?.addEventListener(
      "change",
      handleRecipientType
    );


    byId(
      "deliveryMode"
    )?.addEventListener(
      "change",
      handleDeliveryMode
    );


    byId(
      "notificationTitle"
    )?.addEventListener(
      "input",
      updatePreview
    );


    byId(
      "notificationMessage"
    )?.addEventListener(
      "input",
      updatePreview
    );


    byId(
      "notificationPriority"
    )?.addEventListener(
      "change",
      updatePreview
    );

  }


  async function openCreateModal() {

    const form =
      byId(
        "notificationForm"
      );


    form?.reset();


    byId(
      "studentField"
    )?.classList.add(
      "hidden"
    );


    byId(
      "groupField"
    )?.classList.add(
      "hidden"
    );


    byId(
      "scheduleField"
    )?.classList.add(
      "hidden"
    );


    updatePreview();


    openModal(
      "createModal"
    );


    await loadStudents();

  }


  /* =======================================================
     LOAD STUDENTS
  ======================================================= */

  async function loadStudents() {

    const select =
      byId(
        "studentSelect"
      );


    if (!select) {
      return;
    }


    if (!API_BASE) {

      select.innerHTML = `

        <option value="">
          Student API is not configured
        </option>

      `;

      return;

    }


    select.innerHTML = `

      <option value="">
        Loading students...
      </option>

    `;


    try {

      const response =
        await apiRequest(
          "/api/learners"
        );


      const students =
        normalizeStudents(
          response
        );


      if (!students.length) {

        select.innerHTML = `

          <option value="">
            No students found
          </option>

        `;

        return;

      }


      select.innerHTML = `

        <option value="">
          Select student
        </option>

      `;


      students.forEach(
        student => {

          const option =
            document.createElement(
              "option"
            );


          option.value =
            student.id ??
            student.studentId ??
            student.student_id;


          option.textContent =
            buildStudentLabel(
              student
            );


          select.appendChild(
            option
          );

        }
      );


    } catch (error) {

      console.error(
        "Students:",
        error
      );


      select.innerHTML = `

        <option value="">
          Unable to load students
        </option>

      `;

      showToast(
        error.message ||
        "Unable to load students."
      );

    }

  }


  function normalizeStudents(
    response
  ) {

    if (
      Array.isArray(
        response
      )
    ) {

      return response;

    }


    if (
      response &&
      Array.isArray(
        response.students
      )
    ) {

      return response.students;

    }


    if (
      response?.data &&
      Array.isArray(
        response.data
      )
    ) {

      return response.data;

    }


    if (
      response?.data &&
      Array.isArray(
        response.data.students
      )
    ) {

      return response.data.students;

    }


    return [];

  }


  function buildStudentLabel(
    student
  ) {

    const name =
      student.name ||
      student.fullName ||
      student.full_name ||
      "Unnamed Student";


    const id =
      student.studentId ||
      student.student_id ||
      student.id ||
      "";


    return id
      ? `${name} — ${id}`
      : name;

  }


  /* =======================================================
     RECIPIENT
  ======================================================= */

  function handleRecipientType(
    event
  ) {

    const value =
      event.target.value;


    const studentField =
      byId(
        "studentField"
      );


    const groupField =
      byId(
        "groupField"
      );


    const showStudent =
      value === "student" ||
      value === "multiple";


    const showGroup =
      value === "group";


    studentField?.classList.toggle(
      "hidden",
      !showStudent
    );


    groupField?.classList.toggle(
      "hidden",
      !showGroup
    );


    const studentSelect =
      byId("studentSelect");

    if (studentSelect) {
      studentSelect.multiple =
        value === "multiple";
      studentSelect.size =
        value === "multiple"
          ? 6
          : 1;
    }

    if (showStudent) {
      loadStudents();
    }

  }


  /* =======================================================
     DELIVERY
  ======================================================= */

  function handleDeliveryMode(
    event
  ) {

    const scheduleField =
      byId(
        "scheduleField"
      );


    scheduleField?.classList.toggle(
      "hidden",
      event.target.value !==
        "scheduled"
    );

  }


  /* =======================================================
     PREVIEW
  ======================================================= */

  function updatePreview() {

    const title =
      byId(
        "notificationTitle"
      )?.value
        ?.trim();


    const message =
      byId(
        "notificationMessage"
      )?.value
        ?.trim();


    setText(
      "#previewTitle",
      title ||
        "Notification title"
    );


    setText(
      "#previewMessage",
      message ||
        "Notification message"
    );


    setText(
      "#messageCount",
      `${
        byId(
          "notificationMessage"
        )?.value.length ||
        0
      } / 2000`
    );

  }


  /* =======================================================
     CREATE NOTIFICATION
  ======================================================= */

  async function createNotification(
    event
  ) {

    event.preventDefault();


    if (!API_BASE) {

      showToast(
        "Backend API is not connected yet."
      );

      return;

    }


    const recipientType =
      byId(
        "recipientType"
      ).value;


    const title =
      byId(
        "notificationTitle"
      ).value.trim();


    const message =
      byId(
        "notificationMessage"
      ).value.trim();


    if (
      !title ||
      !message
    ) {

      showToast(
        "Title and message are required."
      );

      return;

    }


    const recipientIds =
      getRecipientIds(
        recipientType
      );


    if (
      (
        recipientType ===
          "student" ||
        recipientType ===
          "multiple"
      ) &&
      !recipientIds.length
    ) {

      showToast(
        recipientType === "multiple"
          ? "Please select at least one student."
          : "Please select a student."
      );

      return;

    }


    const payload = {

      recipientType:
        recipientType ===
        "multiple"
          ? "student"
          : recipientType,

      recipientIds,

      group:
        recipientType ===
        "group"
          ? (
              byId(
                "groupSelect"
              )?.value ||
              null
            )
          : null,

      type:
        byId(
          "notificationType"
        ).value,

      priority:
        byId(
          "notificationPriority"
        ).value,

      title,

      message,

      deliveryMode:
        byId(
          "deliveryMode"
        ).value,

      scheduledAt:
        byId(
          "deliveryMode"
        ).value ===
        "scheduled"
          ? (
              byId(
                "scheduledAt"
              )?.value ||
              null
            )
          : null

    };


    const button =
      byId(
        "sendNotificationBtn"
      );


    if (button) {

      button.disabled =
        true;

      button.textContent =
        "Sending...";

    }


    try {

      await apiRequest(
        "/api/notifications",
        {
          method: "POST",
          body:
            JSON.stringify(
              payload
            )
        }
      );


      closeModal(
        "createModal"
      );


      await Promise.all([
        loadNotifications(),
        loadSentNotifications()
      ]);


      renderAll();


      showToast(
        payload.deliveryMode ===
          "scheduled"
          ? "Notification scheduled successfully."
          : "Notification sent successfully."
      );


    } catch (error) {

      console.error(
        "Create notification:",
        error
      );


      showToast(
        error.message ||
        "Unable to create notification."
      );


    } finally {

      if (button) {

        button.disabled =
          false;

        button.textContent =
          "Send Notification";

      }

    }

  }


  function getRecipientIds(
    recipientType
  ) {

    if (
      recipientType ===
      "student"
    ) {

      const id =
        byId(
          "studentSelect"
        )?.value;


      return id
        ? [id]
        : [];

    }


    if (
      recipientType ===
      "multiple"
    ) {

      const select =
        byId(
          "studentSelect"
        );

      if (!select) {
        return [];
      }

      return Array.from(
        select.selectedOptions || []
      )
        .map(
          option => option.value
        )
        .filter(Boolean);

    }


    return [];

  }


  /* =======================================================
     DETAIL
  ======================================================= */

  function openNotificationDetail(
    id
  ) {

    const item =
      state.notifications.find(
        notification =>
          String(
            notification._id ??
            notification.id ??
            notification.notificationId
          ) ===
          String(id)
      );


    if (!item) {
      return;
    }


    state.activeNotification =
      item;


    setText(
      "#detailTitle",
      item.title ||
        "Notification"
    );


    setText(
      "#detailMessage",
      item.message ||
        ""
    );


    setText(
      "#detailType",
      capitalize(
        item.type ||
        "general"
      )
    );


    setText(
      "#detailPriority",
      capitalize(
        item.priority ||
        "normal"
      )
    );


    setText(
      "#detailDate",
      formatDate(
        item.createdAt ||
        item.created_at ||
        item.sentAt ||
        item.sent_at
      )
    );


    setText(
      "#detailSource",
      item.source ||
        "—"
    );


    setText(
      "#detailReference",
      item.reference ||
        "—"
    );


    const readButton =
      byId(
        "detailReadBtn"
      );


    const isRead =
      Boolean(
        item.read ??
        item.isRead
      );


    if (readButton) {

      readButton.style.display =
        isRead
          ? "none"
          : "";


      readButton.onclick =
        async () => {

          await markAsRead(
            item.id ??
            item._id ??
            item.id ??
            item.notificationId
          );


          closeModal(
            "detailModal"
          );

        };

    }


    openModal(
      "detailModal"
    );

  }


  /* =======================================================
     MODALS
  ======================================================= */

  function openModal(
    id
  ) {

    const modal =
      byId(id);


    if (!modal) {
      return;
    }


    modal.classList.remove(
      "hidden"
    );


    document.body.style.overflow =
      "hidden";

  }


  function closeModal(
    id
  ) {

    const modal =
      byId(id);


    if (!modal) {
      return;
    }


    modal.classList.add(
      "hidden"
    );


    const openModal =
      document.querySelector(
        ".modal-overlay:not(.hidden)"
      );


    if (!openModal) {

      /*
       * Only restore scrolling if
       * no modal is open.
       */

      document.body.style.overflow =
        "";

    }

  }


  function closeAllModals() {

    $$(".modal-overlay")
      .forEach(
        modal => {

          modal.classList.add(
            "hidden"
          );

        }
      );


    document.body.style.overflow =
      "";

  }


  function initModalCloseButtons() {

    $$("[data-close]")
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              closeModal(
                button.dataset.close
              );

            }
          );

        }
      );


    $$(".modal-overlay")
      .forEach(
        overlay => {

          overlay.addEventListener(
            "click",
            event => {

              if (
                event.target ===
                overlay
              ) {

                closeModal(
                  overlay.id
                );

              }

            }
          );

        }
      );

  }


  /* =======================================================
     FILTERS
  ======================================================= */

  function initFilters() {

    $$(".notification-filter-tabs button")
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              $$(".notification-filter-tabs button")
                .forEach(
                  item =>
                    item.classList.remove(
                      "active"
                    )
                );


              button.classList.add(
                "active"
              );


              state.inboxFilter =
                button.dataset.filter ||
                "all";


              state.page =
                1;


              renderInbox();

            }
          );

        }
      );


    byId(
      "searchInput"
    )?.addEventListener(
      "input",
      event => {

        state.search =
          event.target.value
            .trim()
            .toLowerCase();


        state.page =
          1;


        renderInbox();

      }
    );


    byId(
      "typeFilter"
    )?.addEventListener(
      "change",
      event => {

        state.typeFilter =
          event.target.value;


        state.page =
          1;


        renderInbox();

      }
    );


    byId(
      "priorityFilter"
    )?.addEventListener(
      "change",
      event => {

        state.priorityFilter =
          event.target.value;


        state.page =
          1;


        renderInbox();

      }
    );


    byId(
      "sentSearchInput"
    )?.addEventListener(
      "input",
      event => {

        state.sentSearch =
          event.target.value
            .trim()
            .toLowerCase();


        renderSent();

      }
    );


    byId(
      "sentTypeFilter"
    )?.addEventListener(
      "change",
      event => {

        state.sentType =
          event.target.value;


        renderSent();

      }
    );

  }


  /* =======================================================
     REFRESH
  ======================================================= */

  function initRefresh() {

    byId(
      "refreshBtn"
    )?.addEventListener(
      "click",
      refreshNotifications
    );

  }


  async function refreshNotifications() {

    const button =
      byId(
        "refreshBtn"
      );


    if (button) {

      button.disabled =
        true;

      button.setAttribute(
        "aria-busy",
        "true"
      );

    }


    try {

      await Promise.all([
        loadNotifications(),
        loadSentNotifications()
      ]);


      renderAll();


    } finally {

      if (button) {

        button.disabled =
          false;

        button.removeAttribute(
          "aria-busy"
        );

      }

    }

  }


  /* =======================================================
     AUTOMATION
  ======================================================= */

  function initAutomation() {

    $$("[data-rule]")
      .forEach(
        input => {

          input.addEventListener(
            "change",
            () => {

              updateAutomationRule(
                input.dataset.rule,
                input.checked
              );

            }
          );

        }
      );

  }


  async function loadAutomationRules() {

    try {

      const response =
        await apiRequest(
          "/api/notification-rules"
        );

      let rules = [];

      if (Array.isArray(response)) {
        rules = response;
      } else if (
        Array.isArray(response?.data)
      ) {
        rules = response.data;
      } else if (
        Array.isArray(
          response?.data?.rules
        )
      ) {
        rules = response.data.rules;
      }

      const byEvent =
        new Map(
          rules.map(rule => [
            String(rule.event),
            Boolean(rule.active)
          ])
        );

      $$("[data-rule]").forEach(
        input => {
          const event =
            input.dataset.rule;

          input.checked =
            byEvent.has(event)
              ? byEvent.get(event)
              : false;
        }
      );

    } catch (error) {

      console.error(
        "Automation rules:",
        error
      );

      // Safe default: OFF when backend state
      // cannot be loaded.
      $$("[data-rule]").forEach(
        input => {
          input.checked = false;
        }
      );
    }
  }


  async function updateAutomationRule(
    eventName,
    enabled
  ) {

    if (!API_BASE) {

      showToast(
        "Backend API is not connected yet."
      );

      return;

    }


    try {

      await apiRequest(
        `/api/notification-rules/${encodeURIComponent(
          eventName
        )}`,
        {
          method: "PATCH",
          body:
            JSON.stringify({
              enabled
            })
        }
      );


      showToast(
        `${eventName} ${
          enabled
            ? "enabled"
            : "disabled"
        }.`
      );


    } catch (error) {

      showToast(
        error.message ||
        "Unable to update automation rule."
      );

    }

  }


  /* =======================================================
     TOAST
  ======================================================= */

  function showToast(
    message
  ) {

    const container =
      byId(
        "toastContainer"
      );


    if (!container) {
      return;
    }


    const toast =
      document.createElement(
        "div"
      );


    toast.className =
      "toast";


    toast.textContent =
      String(message);


    container.appendChild(
      toast
    );


    window.setTimeout(
      () => {

        toast.remove();

      },
      3500
    );

  }


  /* =======================================================
     INITIALIZATION
  ======================================================= */

  async function init() {

    /*
     * Authentication first.
     */

    requireOwnerAuth();


    /*
     * Sidebar must initialize
     * before anything else.
     */

    initSidebar();

    initLogout();

    initNotificationButton();

    initFilters();

    initNotificationTabs();

    initSelectAll();

    initCreateNotification();

    initModalCloseButtons();

    initRefresh();

    initAutomation();

    await loadAutomationRules();


    /*
     * Initial UI
     */

    renderLoading();


    /*
     * Load real API data.
     */

    await Promise.all([
      loadNotifications(),
      loadSentNotifications()
    ]);


    renderAll();

  }


  /* =======================================================
     LOADING UI
  ======================================================= */

  function renderLoading() {

    const container =
      byId(
        "notificationList"
      );


    if (!container) {
      return;
    }


    container.innerHTML = `

      <div class="notification-state">

        <div class="notification-state-inner">

          <div class="notification-state-icon">
            ...
          </div>

          <h3>
            Loading notifications
          </h3>

          <p>
            Please wait while the notification center loads.
          </p>

        </div>

      </div>

    `;

  }


  /* =======================================================
     DOM READY
  ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }


})();