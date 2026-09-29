(() => {
  "use strict";

  const API_BASE =
    window.MISSION_RAJ_API_BASE ||
    "https://mission-raj-library-backend.onrender.com";

  function getToken() {
    const keys = [
      "missionRajAccessToken",
      "missionRajToken",
      "accessToken",
      "access_token",
      "token"
    ];

    for (const key of keys) {
      const value =
        localStorage.getItem(key);

      if (value) {
        return value;
      }
    }

    return "";
  }

  function setBadge(count) {
    const badge =
      document.getElementById(
        "notificationBadge"
      );

    if (!badge) {
      return;
    }

    const value =
      Number(count) || 0;

    badge.textContent =
      value > 99
        ? "99+"
        : String(value);

    badge.style.display =
      value > 0
        ? "inline-flex"
        : "none";
  }

  async function loadBadge() {
    const token =
      getToken();

    if (!token) {
      setBadge(0);
      return;
    }

    try {
      const response =
        await fetch(
          `${API_BASE}/api/notifications`,
          {
            headers: {
              Accept:
                "application/json",
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      if (!response.ok) {
        return;
      }

      const payload =
        await response.json();

      const items =
        Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(
              payload?.data?.notifications
            )
            ? payload.data.notifications
            : [];

      const unread =
        items.filter(
          item =>
            !(
              item.isRead === true ||
              item.read === true
            )
        ).length;

      setBadge(unread);

    } catch (error) {
      console.debug(
        "Notification badge:",
        error
      );
    }
  }

  loadBadge();

  window.setInterval(
    loadBadge,
    30000
  );
})();
