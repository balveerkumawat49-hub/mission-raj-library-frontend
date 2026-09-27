(() => {
  "use strict";

  /*
   * Mission Raj Library
   * Authentication Adapter
   *
   * This file previously checked two hardcoded demo accounts entirely
   * client-side ("Development Authentication Layer"). It now calls the
   * real backend's POST /api/auth/login and POST /api/auth/logout.
   *
   * Everything else about this module is unchanged on purpose:
   * - Same public API on window.MissionRajAuth (login, logout, getSession,
   *   getToken, getRole, isAuthenticated, requireAuth), plus refresh,
   *   getAccessToken, handleUnauthorized, authFetch and getApiBase.
   * - Same localStorage keys, so every other page's getAccessToken()
   *   (which reads missionRajAccessToken / missionRajToken / accessToken)
   *   keeps working without any changes.
   * - login() is now async (it makes a network call) - the only other
   *   file affected by that is js/app.js, which now awaits it.
   */

  /*
   * API base URL. Configure it with window.MISSION_RAJ_API_BASE (set it in
   * a <script> before this file, or at any time before the first request).
   * It is resolved on every call instead of once at load, so the
   * configured value is always honoured. The local-dev address below is
   * only the fallback when nothing is configured.
   */
  const DEFAULT_API_BASE = "https://mission-raj-library-backend.onrender.com";

  function getApiBase() {
    return String(
      window.MISSION_RAJ_API_BASE ||
      DEFAULT_API_BASE
    ).replace(/\/+$/, "");
  }

  // Login page location, derived from where this script was loaded
  // (<app root>/js/auth.js -> <app root>/index.html).
  const SCRIPT_SRC =
    (document.currentScript &&
      document.currentScript.src) ||
    "";

  const AUTH_KEY = "missionRajAuth";
  const TOKEN_KEY = "missionRajAccessToken";
  const REFRESH_KEY = "missionRajRefreshToken";

  const nativeFetch = (
    window.fetch.__missionRajNative ||
    window.fetch
  ).bind(window);

  /*
   * Single place that writes tokens. Used by login and by refresh so the
   * session object and every compatibility key always stay in sync.
   */
  function storeTokens(accessToken, refreshToken) {
    localStorage.setItem(
      TOKEN_KEY,
      accessToken
    );

    /*
     * Compatibility with the existing project.
     * Existing pages currently look for several token names.
     */
    localStorage.setItem(
      "missionRajToken",
      accessToken
    );

    localStorage.setItem(
      "accessToken",
      accessToken
    );

    if (refreshToken) {
      localStorage.setItem(
        REFRESH_KEY,
        refreshToken
      );
    }

    try {
      const raw = localStorage.getItem(AUTH_KEY);

      if (raw) {
        const session = JSON.parse(raw);
        session.token = accessToken;

        localStorage.setItem(
          AUTH_KEY,
          JSON.stringify(session)
        );
      }
    } catch (_) {}
  }

  function clearSession() {
    [
      AUTH_KEY,
      TOKEN_KEY,
      REFRESH_KEY,
      "missionRajToken",
      "accessToken",
      "access_token",
      "token"
    ].forEach(key => {
      localStorage.removeItem(key);
    });
  }

  function saveSession(user, accessToken, refreshToken, rememberMe = false) {
    const session = {
      authenticated: true,
      role: user.role,
      name: user.name,
      loginId: user.loginId,
      token: accessToken,
      createdAt: Date.now(),
      rememberMe
    };

    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify(session)
    );

    storeTokens(
      accessToken,
      refreshToken
    );

    return session;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);

      if (!raw) {
        return null;
      }

      const session = JSON.parse(raw);

      if (
        !session ||
        session.authenticated !== true ||
        !session.role ||
        !session.token
      ) {
        return null;
      }

      return session;
    } catch (error) {
      console.error(
        "Mission Raj auth session error:",
        error
      );

      return null;
    }
  }

  function isAuthenticated() {
    return Boolean(getSession());
  }

  function getRole() {
    return getSession()?.role || null;
  }

  function getAccessToken() {
    return getSession()?.token || null;
  }

  // Kept for existing callers.
  function getToken() {
    return getAccessToken();
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY) || null;
  }

  async function login(
    loginId,
    password,
    role,
    rememberMe = false
  ) {
    const normalizedLoginId =
      String(loginId || "")
        .trim()
        .toLowerCase();

    if (
      role !== "owner" &&
      role !== "student"
    ) {
      return {
        success: false,
        message:
          "This portal is not available yet."
      };
    }

    let response;

    try {
      response = await fetch(
        `${getApiBase()}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            loginId: normalizedLoginId,
            password,
            role
          })
        }
      );
    } catch (error) {
      return {
        success: false,
        message:
          "Unable to reach the server. Please check your connection and try again."
      };
    }

    let payload = null;

    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (
      !response.ok ||
      !payload ||
      payload.success !== true
    ) {
      return {
        success: false,
        message:
          (payload && payload.message) ||
          "Invalid Login ID or password."
      };
    }

    const {
      accessToken,
      refreshToken,
      user,
      redirect
    } = payload.data;

    const session = saveSession(
      user,
      accessToken,
      refreshToken,
      rememberMe
    );

    return {
      success: true,
      session,
      redirect:
        redirect ||
        (user.role === "owner"
          ? "owner/owner-dashboard.html"
          : "student/dashboard.html")
    };
  }

  function getLoginUrl() {
    try {
      return new URL(
        "../index.html",
        SCRIPT_SRC
      ).href;
    } catch (_) {
      return "../index.html";
    }
  }

  function redirectToLogin() {
    const loginUrl = getLoginUrl();

    try {
      const here = new URL(window.location.href);
      const target = new URL(loginUrl);

      // Already on the login page - nothing to do.
      if (
        here.origin === target.origin &&
        here.pathname === target.pathname
      ) {
        return;
      }
    } catch (_) {}

    window.location.replace(loginUrl);
  }

  /*
   * logout: revoke the refresh token on the backend, clear the access
   * token, refresh token and session, then go to the login page.
   * The local session is cleared immediately and synchronously, so callers
   * that do not await this behave exactly as before. If the backend cannot
   * be reached the local logout still completes.
   */
  function logout(options) {
    const redirect =
      !options ||
      options.redirect !== false;

    const refreshToken = getRefreshToken();

    clearSession();

    let revoked = Promise.resolve();

    if (refreshToken) {
      revoked = nativeFetch(
        `${getApiBase()}/api/auth/logout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          keepalive: true
        }
      ).catch(() => {});
    }

    if (!redirect) {
      return revoked;
    }

    // Give the revocation request a moment to finish before leaving.
    return Promise.race([
      revoked,
      new Promise(resolve => window.setTimeout(resolve, 1500))
    ]).then(redirectToLogin);
  }

  /*
   * handleUnauthorized: the session cannot be recovered - end it and send
   * the user to the login page.
   */
  function handleUnauthorized() {
    return logout();
  }

  /*
   * refresh: POST /api/auth/refresh with the stored refresh token, store
   * the new accessToken + refreshToken pair. Concurrent callers share one
   * in-flight request (the backend rotates refresh tokens, so a second
   * simultaneous call would be rejected).
   *
   * Resolves to:
   *   "ok"          - new tokens stored
   *   "rejected"    - the refresh token is invalid/expired/missing
   *   "unavailable" - network/server problem; the session is left intact
   */
  let refreshInFlight = null;

  async function performRefresh() {
    const usedRefreshToken = getRefreshToken();

    if (!usedRefreshToken) {
      return "rejected";
    }

    let response;

    try {
      response = await nativeFetch(
        `${getApiBase()}/api/auth/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            refreshToken: usedRefreshToken
          })
        }
      );
    } catch (_) {
      return "unavailable";
    }

    let payload = null;

    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (
      response.ok &&
      payload &&
      payload.success === true &&
      payload.data &&
      payload.data.accessToken &&
      payload.data.refreshToken
    ) {
      storeTokens(
        payload.data.accessToken,
        payload.data.refreshToken
      );

      return "ok";
    }

    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      // Another tab may already have rotated the tokens: the stored
      // refresh token then differs from the one we just used.
      const current = getRefreshToken();

      if (
        current &&
        current !== usedRefreshToken &&
        getAccessToken()
      ) {
        return "ok";
      }

      return "rejected";
    }

    return "unavailable";
  }

  function refreshTokens() {
    if (!refreshInFlight) {
      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  async function refresh() {
    return (await refreshTokens()) === "ok";
  }

  /*
   * authFetch: fetch() for backend API calls with automatic recovery.
   *
   *   request -> 401 -> refresh -> retry the original request ONCE
   *
   * - a request is retried at most once, so there is no refresh loop
   * - refresh rejected, or the retry is still 401 -> handleUnauthorized()
   * - auth endpoints (login/refresh/logout) never trigger a refresh
   * - inject: true adds the Authorization header when the caller did not
   */
  async function authFetch(input, init, settings) {
    const inject = !settings || settings.inject !== false;

    let options = { ...(init || {}) };

    if (typeof Request !== "undefined" && input instanceof Request) {
      const source = input.clone();

      options = {
        method: source.method,
        headers: new Headers(source.headers),
        body:
          source.method === "GET" || source.method === "HEAD"
            ? undefined
            : await source.arrayBuffer(),
        credentials: source.credentials,
        mode: source.mode,
        ...options
      };

      input = source.url;
    }

    const send = (forceToken) => {
      const headers = new Headers(options.headers || {});
      const token = getAccessToken();

      if (token && (forceToken || (inject && !headers.has("Authorization")))) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return nativeFetch(input, { ...options, headers });
    };

    const response = await send(false);

    if (response.status !== 401) {
      return response;
    }

    let code = null;

    try {
      const body = await response.clone().json();
      code = body && body.error && body.error.code;
    } catch (_) {}

    // Deactivated account: refreshing cannot help.
    if (code === "ACCOUNT_INACTIVE") {
      handleUnauthorized();
      return response;
    }

    const outcome = await refreshTokens();

    if (outcome === "rejected") {
      handleUnauthorized();
      return response;
    }

    if (outcome === "unavailable") {
      return response;
    }

    // Retry the original request once with the new access token.
    const retried = await send(true);

    if (retried.status === 401) {
      handleUnauthorized();
    }

    return retried;
  }

  /*
   * Existing pages call fetch(API_BASE + ...) directly. Route those calls
   * (only requests to the backend API, excluding the login / refresh /
   * logout endpoints themselves) through authFetch so they get
   * 401 -> refresh -> retry-once without changing each API module.
   */
  function isProtectedApiRequest(input) {
    let url;

    try {
      url = new URL(
        typeof Request !== "undefined" && input instanceof Request
          ? input.url
          : String(input),
        window.location.href
      ).href;
    } catch (_) {
      return false;
    }

    if (!url.startsWith(`${getApiBase()}/api/`)) {
      return false;
    }

    return !/\/api\/auth\/(login|refresh|logout)(?:[/?#]|$)/.test(url);
  }

  if (!window.fetch.__missionRajAuth) {
    const interceptedFetch = function (input, init) {
      if (isProtectedApiRequest(input)) {
        return authFetch(input, init, { inject: false });
      }

      return nativeFetch(input, init);
    };

    interceptedFetch.__missionRajAuth = true;
    interceptedFetch.__missionRajNative = nativeFetch;
    window.fetch = interceptedFetch;
  }

  function requireAuth(options = {}) {
    const {
      role = null,
      redirect = "../index.html"
    } = options;

    const session = getSession();

    if (!session) {
      window.location.replace(redirect);
      return false;
    }

    if (
      role &&
      session.role !== role
    ) {
      if (session.role === "owner") {
        window.location.replace(
          "../owner/owner-dashboard.html"
        );
      } else if (
        session.role === "student"
      ) {
        window.location.replace(
          "../student/dashboard.html"
        );
      } else {
        logout();
        window.location.replace(
          "../index.html"
        );
      }

      return false;
    }

    return true;
  }

  window.MissionRajAuth = {
    login,
    logout,
    refresh,
    getSession,
    getAccessToken,
    getToken,
    getRole,
    isAuthenticated,
    requireAuth,
    handleUnauthorized,
    authFetch,
    getApiBase
  };
})();
