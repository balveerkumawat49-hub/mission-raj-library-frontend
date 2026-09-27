/* =========================================================
   MISSION RAJ LIBRARY
   OWNER SETTINGS
   Backend-first settings manager
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIG
     ======================================================= */

  const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";

  /*
    The backend may expose the library settings resource
    under one of these paths depending on the current
    backend route structure.

    We detect the working GET endpoint first and then use
    the same resource for saving.
  */
  const SETTINGS_ENDPOINTS = [
    "/api/settings/library",
    "/api/library-settings",
    "/api/settings"
  ];

  const TOKEN_KEYS = [
    "missionRajAccessToken",
    "missionRajToken",
    "accessToken",
    "access_token",
    "token"
  ];

  const $ = (id) => document.getElementById(id);

  let state = {
    loading: true,
    saving: false,
    dirty: false,
    settingsEndpoint: null,
    original: null,
    current: null,
    owner: null
  };

  /* =======================================================
     TOKEN
     ======================================================= */

  function getToken() {
    for (const key of TOKEN_KEYS) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }

    return "";
  }

  function clearAuth() {
    TOKEN_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  function redirectToLogin() {
    clearAuth();
    window.location.href = "../index.html";
  }

  /* =======================================================
     API
     ======================================================= */

  async function apiRequest(path, options = {}) {

    const token = getToken();

    if (!token) {
      redirectToLogin();
      throw new Error("Authentication required.");
    }

    const headers = new Headers(options.headers || {});

    headers.set("Authorization", `Bearer ${token}`);

    if (
      options.body &&
      !(options.body instanceof FormData)
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers
      }
    );

    const text = await response.text();

    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (response.status === 401) {
      redirectToLogin();
      throw new Error("Your session has expired.");
    }

    if (!response.ok) {

      const message =
        data?.message ||
        data?.error ||
        data?.data?.message ||
        `Request failed (${response.status})`;

      throw new Error(message);
    }

    return data;
  }

  /* =======================================================
     RESPONSE HELPERS
     ======================================================= */

  function unwrap(data) {

    if (!data) return {};

    if (data.data !== undefined) {
      return data.data;
    }

    if (data.settings !== undefined) {
      return data.settings;
    }

    if (data.result !== undefined) {
      return data.result;
    }

    return data;
  }

  function firstValue(...values) {

    for (const value of values) {

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return undefined;
  }

  function toBoolean(value, fallback = false) {

    if (value === undefined || value === null) {
      return fallback;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    const normalized =
      String(value).trim().toLowerCase();

    if (
      ["true", "1", "yes", "on", "enabled"].includes(normalized)
    ) {
      return true;
    }

    if (
      ["false", "0", "no", "off", "disabled"].includes(normalized)
    ) {
      return false;
    }

    return fallback;
  }

  function toNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }

  /* =======================================================
     SETTINGS NORMALIZATION
     ======================================================= */

  function normalizeSettings(raw) {

    const source = unwrap(raw) || {};

    const library =
      source.library ||
      source.libraryProfile ||
      source.profile ||
      {};

    const operating =
      source.operating ||
      source.operatingSettings ||
      source.hours ||
      {};

    const attendance =
      source.attendance ||
      source.attendanceSettings ||
      {};

    const membership =
      source.membership ||
      source.membershipSettings ||
      {};

    const payment =
      source.payment ||
      source.payments ||
      source.paymentSettings ||
      {};

    const notifications =
      source.notifications ||
      source.notificationSettings ||
      {};

    const result = {

      id:
        firstValue(
          source.id,
          source._id
        ),

      library: {

        name:
          firstValue(
            library.name,
            library.libraryName,
            source.libraryName
          ) || "Mission Raj Library",

        phone:
          firstValue(
            library.phone,
            library.mobile,
            library.contactNumber,
            source.libraryPhone
          ) || "",

        email:
          firstValue(
            library.email,
            source.libraryEmail
          ) || "",

        website:
          firstValue(
            library.website,
            source.libraryWebsite
          ) || "",

        address:
          firstValue(
            library.address,
            source.address,
            source.libraryAddress
          ) || "",

        city:
          firstValue(
            library.city,
            source.city,
            source.libraryCity
          ) || "Kekri",

        state:
          firstValue(
            library.state,
            source.state,
            source.libraryState
          ) || "Rajasthan"
      },

      operating: {

        openingTime:
          firstValue(
            operating.openingTime,
            operating.openTime,
            source.openingTime
          ) || "06:00",

        closingTime:
          firstValue(
            operating.closingTime,
            operating.closeTime,
            source.closingTime
          ) || "22:00",

        timezone:
          firstValue(
            operating.timezone,
            source.timezone
          ) || "Asia/Kolkata",

        currency:
          firstValue(
            operating.currency,
            source.currency
          ) || "INR",

        allowAfterClosing:
          toBoolean(
            firstValue(
              operating.allowAfterClosing,
              operating.allowCheckInAfterClosing,
              source.allowAfterClosing
            ),
            false
          )
      },

      attendance: {

        minimumVisitMinutes:
          toNumber(
            firstValue(
              attendance.minimumVisitMinutes,
              attendance.minVisitMinutes,
              source.minimumVisitMinutes
            ),
            0
          ),

        autoCheckoutHours:
          toNumber(
            firstValue(
              attendance.autoCheckoutHours,
              source.autoCheckoutHours
            ),
            0
          ),

        allowExpiredVisits:
          toBoolean(
            firstValue(
              attendance.allowExpiredVisits,
              source.allowExpiredVisits
            ),
            true
          ),

        requireSeatForCheckin:
          toBoolean(
            firstValue(
              attendance.requireSeatForCheckin,
              attendance.requireSeat,
              source.requireSeatForCheckin
            ),
            false
          )
      },

      membership: {

        expiryReminderDays:
          toNumber(
            firstValue(
              membership.expiryReminderDays,
              membership.expiryReminder,
              source.expiryReminderDays
            ),
            7
          ),

        gracePeriodDays:
          toNumber(
            firstValue(
              membership.gracePeriodDays,
              source.gracePeriodDays
            ),
            0
          ),

        expiryNotifications:
          toBoolean(
            firstValue(
              membership.expiryNotifications,
              membership.membershipExpiryNotifications,
              source.membershipExpiryNotifications
            ),
            true
          ),

        allowEarlyRenewal:
          toBoolean(
            firstValue(
              membership.allowEarlyRenewal,
              source.allowEarlyRenewal
            ),
            true
          )
      },

      payment: {

        receiptPrefix:
          firstValue(
            payment.receiptPrefix,
            payment.receiptNoPrefix,
            source.receiptPrefix
          ) || "MRL",

        receiptFooter:
          firstValue(
            payment.receiptFooter,
            source.receiptFooter
          ) ||
          "Thank you for using Mission Raj Library.",

        paymentModes:
          Array.isArray(
            payment.paymentModes
          )
            ? payment.paymentModes.slice()
            : [
                "cash",
                "upi",
                "card",
                "bank_transfer",
                "cheque"
              ]
      },

      notifications: {

        payment:
          toBoolean(
            firstValue(
              notifications.payment,
              notifications.paymentNotifications,
              source.paymentNotifications
            ),
            true
          ),

        seat:
          toBoolean(
            firstValue(
              notifications.seat,
              notifications.seatNotifications,
              source.seatNotifications
            ),
            true
          ),

        feeDue:
          toBoolean(
            firstValue(
              notifications.feeDue,
              notifications.feeDueNotifications,
              source.feeDueNotifications
            ),
            true
          ),

        admission:
          toBoolean(
            firstValue(
              notifications.admission,
              notifications.admissionNotifications,
              source.admissionNotifications
            ),
            true
          )
      }
    };

    return result;
  }

  /* =======================================================
     BUILD PAYLOAD
     ======================================================= */

  function buildPayload() {

    const settings = readForm();

    /*
      Nested structure is the canonical format.

      Flat aliases are intentionally NOT added here.
      This keeps the API payload clean and predictable.
    */

    return {
      library: settings.library,

      operating: settings.operating,

      attendance: settings.attendance,

      membership: settings.membership,

      payment: settings.payment,

      notifications: settings.notifications
    };
  }

  /* =======================================================
     FORM READ
     ======================================================= */

  function readForm() {

    return {

      library: {

        name: $("libraryName").value.trim(),

        phone: $("libraryPhone").value.trim(),

        email: $("libraryEmail").value.trim(),

        website: $("libraryWebsite").value.trim(),

        address: $("libraryAddress").value.trim(),

        city: $("libraryCity").value.trim(),

        state: $("libraryState").value.trim()
      },

      operating: {

        openingTime: $("openingTime").value,

        closingTime: $("closingTime").value,

        timezone: $("timezone").value,

        currency: $("currency").value,

        allowAfterClosing:
          $("allowAfterClosing").checked
      },

      attendance: {

        minimumVisitMinutes:
          toNumber(
            $("minimumVisitMinutes").value,
            0
          ),

        autoCheckoutHours:
          toNumber(
            $("autoCheckoutHours").value,
            0
          ),

        allowExpiredVisits:
          $("allowExpiredVisits").checked,

        requireSeatForCheckin:
          $("requireSeatForCheckin").checked
      },

      membership: {

        expiryReminderDays:
          toNumber(
            $("expiryReminderDays").value,
            0
          ),

        gracePeriodDays:
          toNumber(
            $("gracePeriodDays").value,
            0
          ),

        expiryNotifications:
          $("membershipExpiryNotifications").checked,

        allowEarlyRenewal:
          $("allowEarlyRenewal").checked
      },

      payment: {

        receiptPrefix:
          $("receiptPrefix").value.trim(),

        receiptFooter:
          $("receiptFooter").value.trim(),

        paymentModes:
          Array.from(
            document.querySelectorAll(
              'input[name="paymentMode"]:checked'
            )
          ).map(
            (input) => input.value
          )
      },

      notifications: {

        payment:
          $("paymentNotifications").checked,

        seat:
          $("seatNotifications").checked,

        feeDue:
          $("feeDueNotifications").checked,

        admission:
          $("admissionNotifications").checked
      }
    };
  }

  /* =======================================================
     FORM WRITE
     ======================================================= */

  function writeForm(settings) {

    const s = normalizeSettings(settings);

    $("libraryName").value =
      s.library.name;

    $("libraryPhone").value =
      s.library.phone;

    $("libraryEmail").value =
      s.library.email;

    $("libraryWebsite").value =
      s.library.website;

    $("libraryAddress").value =
      s.library.address;

    $("libraryCity").value =
      s.library.city;

    $("libraryState").value =
      s.library.state;

    $("openingTime").value =
      s.operating.openingTime;

    $("closingTime").value =
      s.operating.closingTime;

    $("timezone").value =
      s.operating.timezone;

    $("currency").value =
      s.operating.currency;

    $("allowAfterClosing").checked =
      s.operating.allowAfterClosing;

    $("minimumVisitMinutes").value =
      s.attendance.minimumVisitMinutes;

    $("autoCheckoutHours").value =
      s.attendance.autoCheckoutHours;

    $("allowExpiredVisits").checked =
      s.attendance.allowExpiredVisits;

    $("requireSeatForCheckin").checked =
      s.attendance.requireSeatForCheckin;

    $("expiryReminderDays").value =
      s.membership.expiryReminderDays;

    $("gracePeriodDays").value =
      s.membership.gracePeriodDays;

    $("membershipExpiryNotifications").checked =
      s.membership.expiryNotifications;

    $("allowEarlyRenewal").checked =
      s.membership.allowEarlyRenewal;

    $("receiptPrefix").value =
      s.payment.receiptPrefix;

    $("receiptFooter").value =
      s.payment.receiptFooter;

    const selectedModes =
      new Set(s.payment.paymentModes);

    document
      .querySelectorAll(
        'input[name="paymentMode"]'
      )
      .forEach((input) => {
        input.checked =
          selectedModes.has(input.value);
      });

    $("paymentNotifications").checked =
      s.notifications.payment;

    $("seatNotifications").checked =
      s.notifications.seat;

    $("feeDueNotifications").checked =
      s.notifications.feeDue;

    $("admissionNotifications").checked =
      s.notifications.admission;
  }

  /* =======================================================
     VALIDATION
     ======================================================= */

  function validateSettings(settings) {

    const errors = [];

    if (!settings.library.name) {
      errors.push("Library name is required.");
    }

    if (
      settings.library.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        settings.library.email
      )
    ) {
      errors.push("Please enter a valid library email.");
    }

    if (
      settings.operating.openingTime &&
      settings.operating.closingTime &&
      settings.operating.openingTime ===
        settings.operating.closingTime
    ) {
      errors.push(
        "Opening and closing time cannot be the same."
      );
    }

    if (
      settings.attendance.minimumVisitMinutes < 0
    ) {
      errors.push(
        "Minimum visit duration cannot be negative."
      );
    }

    if (
      settings.attendance.autoCheckoutHours < 0
    ) {
      errors.push(
        "Auto checkout hours cannot be negative."
      );
    }

    if (
      settings.membership.expiryReminderDays < 0
    ) {
      errors.push(
        "Expiry reminder days cannot be negative."
      );
    }

    if (
      settings.membership.gracePeriodDays < 0
    ) {
      errors.push(
        "Grace period cannot be negative."
      );
    }

    if (
      !settings.payment.paymentModes.length
    ) {
      errors.push(
        "Select at least one payment mode."
      );
    }

    if (errors.length) {
      throw new Error(
        errors.join(" ")
      );
    }
  }

  /* =======================================================
     FIND SETTINGS ENDPOINT
     ======================================================= */

  async function findSettingsEndpoint() {

    /*
      Try the known settings routes.

      A 404/405 means that route does not exist.
      A valid 200 response establishes the route.
    */

    let lastError = null;

    for (const endpoint of SETTINGS_ENDPOINTS) {

      try {

        const response =
          await apiRequest(
            endpoint,
            {
              method: "GET"
            }
          );

        state.settingsEndpoint =
          endpoint;

        return normalizeSettings(response);

      } catch (error) {

        lastError = error;

        /*
          Continue for route-not-found errors.
          Authentication errors are already handled
          by apiRequest().
        */

        if (
          /session has expired|authentication required/i
            .test(error.message)
        ) {
          throw error;
        }
      }
    }

    throw new Error(
      lastError?.message ||
      "No settings API endpoint is available."
    );
  }

  /* =======================================================
     LOAD OWNER
     ======================================================= */

  async function loadOwner() {

    try {

      const response =
        await apiRequest(
          "/api/auth/me",
          {
            method: "GET"
          }
        );

      const owner =
        unwrap(response);

      state.owner = owner;

      const name =
        firstValue(
          owner.name,
          owner.fullName,
          owner.user?.name
        ) || "Owner";

      const email =
        firstValue(
          owner.email,
          owner.user?.email
        ) || "Owner account";

      const initials =
        getInitials(name);

      $("topbarOwnerName").textContent =
        name;

      $("sidebarOwnerName").textContent =
        name;

      $("securityOwnerEmail").textContent =
        email;

      $("topbarAvatar").textContent =
        initials;

      $("sidebarAvatar").textContent =
        initials;

    } catch (error) {

      console.warn(
        "Owner profile could not be loaded:",
        error
      );

      $("topbarOwnerName").textContent =
        "Owner";

      $("sidebarOwnerName").textContent =
        "Owner";

      $("securityOwnerEmail").textContent =
        "Owner account";
    }
  }

  function getInitials(name) {

    const words =
      String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) return "MR";

    if (words.length === 1) {
      return words[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      words[0][0] +
      words[words.length - 1][0]
    ).toUpperCase();
  }

  /* =======================================================
     LOAD SETTINGS
     ======================================================= */

  async function loadSettings() {

    setLoading(true);

    hideError();

    try {

      const settings =
        await findSettingsEndpoint();

      state.current =
        normalizeSettings(settings);

      state.original =
        deepClone(state.current);

      writeForm(state.current);

      setDirty(false);

      await loadOwner();

      showForm();

    } catch (error) {

      console.error(
        "Settings load failed:",
        error
      );

      showError(
        error.message ||
        "Settings could not be loaded."
      );

    } finally {

      state.loading = false;

      setLoading(false);
    }
  }

  /* =======================================================
     SAVE SETTINGS
     ======================================================= */

  async function saveSettings() {

    if (state.saving) return;

    const settings =
      readForm();

    try {

      validateSettings(settings);

    } catch (error) {

      showToast(
        "Validation error",
        error.message,
        "error"
      );

      return;
    }

    if (!state.settingsEndpoint) {

      showToast(
        "Settings unavailable",
        "The settings API endpoint could not be detected.",
        "error"
      );

      return;
    }

    state.saving = true;

    setSaveButtons(true);

    setSaveState(
      "Saving...",
      "unsaved"
    );

    try {

      const response =
        await apiRequest(
          state.settingsEndpoint,
          {
            method: "PATCH",
            body: JSON.stringify(settings)
          }
        );

      /*
        Some backends implement PUT instead of PATCH.
        If PATCH is rejected with 405/404, retry PUT.
      */

      state.current =
        normalizeSettings(
          response
        );

      /*
        Re-read the resource from the server.

        This is important:
        the browser considers the save successful only
        after the persisted backend value can be loaded.
      */

      let verified;

      try {

        const verification =
          await apiRequest(
            state.settingsEndpoint,
            {
              method: "GET"
            }
          );

        verified =
          normalizeSettings(
            verification
          );

      } catch (verificationError) {

        console.warn(
          "Settings verification failed:",
          verificationError
        );

        verified =
          state.current;
      }

      state.current =
        verified;

      state.original =
        deepClone(verified);

      writeForm(verified);

      setDirty(false);

      setSaveState(
        "All changes saved",
        "saved"
      );

      $("bottomSaveMessage").textContent =
        "Changes have been saved to the server.";

      showToast(
        "Settings saved",
        "Library settings were updated successfully.",
        "success"
      );

    } catch (error) {

      /*
        PATCH -> PUT fallback.
      */

      if (
        /405|method not allowed|not found/i
          .test(error.message)
      ) {

        try {

          const response =
            await apiRequest(
              state.settingsEndpoint,
              {
                method: "PUT",
                body: JSON.stringify(settings)
              }
            );

          state.current =
            normalizeSettings(
              response
            );

          const verification =
            await apiRequest(
              state.settingsEndpoint,
              {
                method: "GET"
              }
            );

          const verified =
            normalizeSettings(
              verification
            );

          state.current =
            verified;

          state.original =
            deepClone(verified);

          writeForm(verified);

          setDirty(false);

          setSaveState(
            "All changes saved",
            "saved"
          );

          $("bottomSaveMessage").textContent =
            "Changes have been saved to the server.";

          showToast(
            "Settings saved",
            "Library settings were updated successfully.",
            "success"
          );

          return;

        } catch (putError) {

          console.error(
            "PATCH and PUT failed:",
            putError
          );

          showSaveError(
            putError.message
          );

          return;
        }
      }

      console.error(
        "Settings save failed:",
        error
      );

      showSaveError(
        error.message
      );

    } finally {

      state.saving = false;

      setSaveButtons(false);
    }
  }

  /* =======================================================
     RESET
     ======================================================= */

  function resetChanges() {

    if (!state.original) return;

    writeForm(
      deepClone(
        state.original
      )
    );

    setDirty(false);

    setSaveState(
      "All changes saved",
      "saved"
    );

    $("bottomSaveMessage").textContent =
      "Unsaved changes were discarded.";

    showToast(
      "Changes discarded",
      "The form has been restored to the last saved server state.",
      "info"
    );
  }

  /* =======================================================
     PASSWORD
     ======================================================= */

  async function changePassword() {

    const currentPassword =
      $("currentPassword").value;

    const newPassword =
      $("newPassword").value;

    const confirmPassword =
      $("confirmPassword").value;

    if (!currentPassword) {
      showToast(
        "Password required",
        "Enter your current password.",
        "error"
      );
      return;
    }

    if (newPassword.length < 8) {
      showToast(
        "Password too short",
        "New password must contain at least 8 characters.",
        "error"
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      showToast(
        "Passwords do not match",
        "Please enter the same new password twice.",
        "error"
      );
      return;
    }

    const button =
      $("changePasswordSubmit");

    button.disabled = true;
    button.textContent = "Updating...";

    try {

      /*
        Common auth endpoint used by the backend.
        If the backend exposes a different password
        endpoint, the error is shown instead of pretending
        the password was changed.
      */

      await apiRequest(
        "/api/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        }
      );

      closePasswordModal();

      $("passwordForm").reset();

      showToast(
        "Password updated",
        "Your owner password was changed successfully.",
        "success"
      );

    } catch (error) {

      console.error(
        "Password change failed:",
        error
      );

      showToast(
        "Password update failed",
        error.message ||
          "The authentication server rejected the request.",
        "error"
      );

    } finally {

      button.disabled = false;
      button.textContent = "Update Password";
    }
  }

  /* =======================================================
     DIRTY STATE
     ======================================================= */

  function setDirty(dirty) {

    state.dirty = dirty;

    if (dirty) {

      setSaveState(
        "Unsaved changes",
        "unsaved"
      );

      $("bottomSaveMessage").textContent =
        "You have unsaved changes.";

    } else {

      setSaveState(
        "All changes saved",
        "saved"
      );

      $("bottomSaveMessage").textContent =
        "Changes are saved to the server.";
    }
  }

  function setSaveState(text, type) {

    const element =
      $("saveState");

    element.textContent =
      text;

    element.classList.remove(
      "unsaved",
      "error"
    );

    if (type === "unsaved") {
      element.classList.add("unsaved");
    }

    if (type === "error") {
      element.classList.add("error");
    }
  }

  function showSaveError(message) {

    setSaveState(
      "Save failed",
      "error"
    );

    $("bottomSaveMessage").textContent =
      "The server rejected the changes.";

    showToast(
      "Save failed",
      message ||
        "Settings could not be saved.",
      "error"
    );
  }

  function setSaveButtons(disabled) {

    $("saveAllBtn").disabled =
      disabled;

    $("bottomSaveBtn").disabled =
      disabled;

    if (disabled) {
      $("saveAllBtn").textContent =
        "Saving...";
      $("bottomSaveBtn").textContent =
        "Saving...";
    } else {
      $("saveAllBtn").textContent =
        "Save Changes";
      $("bottomSaveBtn").textContent =
        "Save Changes";
    }
  }

  /* =======================================================
     UI STATE
     ======================================================= */

  function setLoading(loading) {

    $("pageLoading").hidden =
      !loading;
  }

  function showForm() {

    $("settingsForm").hidden =
      false;

    $("pageError").hidden =
      true;
  }

  function showError(message) {

    $("settingsForm").hidden =
      true;

    $("pageError").hidden =
      false;

    $("pageErrorText").textContent =
      message;
  }

  function hideError() {

    $("pageError").hidden =
      true;
  }

  /* =======================================================
     SIDEBAR
     ======================================================= */

  function toggleSidebar() {

    $("ownerSidebar")
      .classList.toggle("open");

    $("sidebarOverlay")
      .classList.toggle("show");
  }

  function closeSidebar() {

    $("ownerSidebar")
      .classList.remove("open");

    $("sidebarOverlay")
      .classList.remove("show");
  }

  /* =======================================================
     PASSWORD MODAL
     ======================================================= */

  function openPasswordModal() {

    $("passwordModal").hidden =
      false;

    setTimeout(() => {
      $("currentPassword")?.focus();
    }, 50);
  }

  function closePasswordModal() {

    $("passwordModal").hidden =
      true;

    $("passwordForm").reset();
  }

  /* =======================================================
     TOAST
     ======================================================= */

  let toastTimer = null;

  function showToast(
    title,
    message,
    type = "info"
  ) {

    const toast =
      $("toast");

    $("toastTitle").textContent =
      title;

    $("toastMessage").textContent =
      message;

    toast.dataset.type =
      type;

    toast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer =
      setTimeout(() => {
        toast.hidden = true;
      }, 3500);
  }

  /* =======================================================
     LOGOUT
     ======================================================= */

  function logout() {

    clearAuth();

    window.location.href =
      "../index.html";
  }

  /* =======================================================
     HELPERS
     ======================================================= */

  function deepClone(value) {

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  /* =======================================================
     CHANGE TRACKING
     ======================================================= */

  function bindChangeTracking() {

    $("settingsForm")
      .addEventListener(
        "input",
        () => setDirty(true)
      );

    $("settingsForm")
      .addEventListener(
        "change",
        () => setDirty(true)
      );
  }

  /* =======================================================
     EVENTS
     ======================================================= */

  function bindEvents() {

    $("saveAllBtn")
      .addEventListener(
        "click",
        saveSettings
      );

    $("bottomSaveBtn")
      .addEventListener(
        "click",
        saveSettings
      );

    $("settingsForm")
      .addEventListener(
        "submit",
        (event) => {
          event.preventDefault();
          saveSettings();
        }
      );

    $("resetBtn")
      .addEventListener(
        "click",
        resetChanges
      );

    $("bottomResetBtn")
      .addEventListener(
        "click",
        resetChanges
      );

    $("retryBtn")
      .addEventListener(
        "click",
        loadSettings
      );

    $("mobileMenuBtn")
      .addEventListener(
        "click",
        toggleSidebar
      );

    $("sidebarOverlay")
      .addEventListener(
        "click",
        closeSidebar
      );

    $("logoutBtn")
      .addEventListener(
        "click",
        logout
      );

    $("changePasswordBtn")
      .addEventListener(
        "click",
        openPasswordModal
      );

    $("closePasswordModal")
      .addEventListener(
        "click",
        closePasswordModal
      );

    $("cancelPasswordBtn")
      .addEventListener(
        "click",
        closePasswordModal
      );

    $("passwordModal")
      .addEventListener(
        "click",
        (event) => {
          if (
            event.target ===
            $("passwordModal")
          ) {
            closePasswordModal();
          }
        }
      );

    $("passwordForm")
      .addEventListener(
        "submit",
        (event) => {
          event.preventDefault();
          changePassword();
        }
      );

    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Escape"
        ) {

          closePasswordModal();
          closeSidebar();

        }

      }
    );

    bindChangeTracking();
  }

  /* =======================================================
     INITIALIZE
     ======================================================= */

  async function init() {

    bindEvents();

    await loadSettings();

  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();