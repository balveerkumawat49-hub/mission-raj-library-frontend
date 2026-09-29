(() => {
  "use strict";

  /*
   * Mission Raj Library
   * Login Controller
   *
   * NOTE:
   * Authentication is handled by MissionRajAuth (js/auth.js),
   * which uses the real backend authentication service.
   */

  if (!window.MissionRajAuth) {
    console.error(
      "MissionRajAuth is not loaded."
    );
    return;
  }

  const state = {
    role: "owner",
    rememberMe: false
  };

  const roleNames = {
    owner: "Admin / Owner",
    staff: "Staff",
    student: "Learner",
    teacher: "Teacher"
  };

  /* -------------------------------------------------------
     ELEMENTS
  ------------------------------------------------------- */

  const portalCards =
    document.querySelectorAll(
      ".portal-card"
    );

  const form =
    document.getElementById(
      "loginForm"
    );

  const loginId =
    document.getElementById(
      "loginId"
    );

  const password =
    document.getElementById(
      "password"
    );

  const rememberMe =
    document.getElementById(
      "rememberMe"
    );

  const togglePassword =
    document.getElementById(
      "togglePassword"
    );

  const forgotPassword =
    document.getElementById(
      "forgotPassword"
    );

  const loginBtn =
    document.getElementById(
      "loginBtn"
    );

  const message =
    document.getElementById(
      "formMessage"
    );

  /* -------------------------------------------------------
     MESSAGE
  ------------------------------------------------------- */

  function clearMessage() {
    message.textContent = "";
    message.className = "form-message";
  }

  function showMessage(
    text,
    type = "error"
  ) {
    message.textContent = text;

    message.className =
      `form-message ${type}`;
  }

  /* -------------------------------------------------------
     PORTAL
  ------------------------------------------------------- */

  function selectPortal(role) {
    state.role = role;

    portalCards.forEach(card => {
      card.classList.toggle(
        "active",
        card.dataset.role === role
      );
    });

    clearMessage();
  }

  portalCards.forEach(card => {
    card.addEventListener(
      "click",
      () => {
        selectPortal(
          card.dataset.role
        );

        try {
          localStorage.setItem(
            "missionRajLibrarySelectedPortal",
            card.dataset.role
          );
        } catch (_) {}
      }
    );
  });

  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */

  function validate() {
    let valid = true;

    loginId.classList.remove(
      "invalid"
    );

    password.classList.remove(
      "invalid"
    );

    if (!loginId.value.trim()) {
      loginId.classList.add(
        "invalid"
      );

      valid = false;
    }

    if (!password.value) {
      password.classList.add(
        "invalid"
      );

      valid = false;
    }

    if (!valid) {
      showMessage(
        "Please enter your Login ID and password."
      );
    }

    return valid;
  }

  /* -------------------------------------------------------
     PASSWORD
  ------------------------------------------------------- */

  togglePassword?.addEventListener(
    "click",
    () => {
      const showing =
        password.type === "text";

      password.type =
        showing
          ? "password"
          : "text";

      togglePassword.textContent =
        showing
          ? "Show"
          : "Hide";
    }
  );

  /* -------------------------------------------------------
     REMEMBER ME
  ------------------------------------------------------- */

  rememberMe?.addEventListener(
    "change",
    () => {
      state.rememberMe =
        rememberMe.checked;
    }
  );

  /* -------------------------------------------------------
     FORGOT PASSWORD
  ------------------------------------------------------- */

  forgotPassword?.addEventListener(
    "click",
    () => {
      showMessage(
        `Password recovery for ${roleNames[state.role]} will be connected to the secure backend.`,
        "success"
      );
    }
  );

  /* -------------------------------------------------------
     INPUT
  ------------------------------------------------------- */

  [loginId, password].forEach(input => {
    input?.addEventListener(
      "input",
      () => {
        input.classList.remove(
          "invalid"
        );

        clearMessage();
      }
    );
  });

  /* -------------------------------------------------------
     LOGIN
  ------------------------------------------------------- */

  form?.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      if (!validate()) {
        return;
      }

      /*
       * Staff and Teacher are not implemented
       * in the current frontend.
       */

      if (
        state.role !== "owner" &&
        state.role !== "student"
      ) {
        showMessage(
          `${roleNames[state.role]} portal is not available yet.`,
          "error"
        );

        return;
      }

      loginBtn.disabled = true;

      const buttonText =
        loginBtn.querySelector(
          "span:first-child"
        );

      if (buttonText) {
        buttonText.textContent =
          "Signing in...";
      }

      /*
       * Real backend authentication.
       * See js/auth.js -> login(), which calls
       * POST /api/auth/login.
       */

      window.setTimeout(async () => {

        const result =
          await window.MissionRajAuth.login(
            loginId.value,
            password.value,
            state.role,
            state.rememberMe
          );

        if (!result.success) {

          showMessage(
            result.message,
            "error"
          );

          loginBtn.disabled = false;

          if (buttonText) {
            buttonText.textContent =
              "Continue to Portal";
          }

          return;
        }

        showMessage(
          "Login successful. Opening portal...",
          "success"
        );

        /*
         * replace() prevents returning to the
         * login page with browser back navigation.
         */

        window.setTimeout(() => {
          window.location.replace(
            result.redirect
          );
        }, 250);

      }, 350);
    }
  );

  /* -------------------------------------------------------
     RESTORE SELECTED PORTAL
  ------------------------------------------------------- */

  try {
    const savedRole =
      localStorage.getItem(
        "missionRajLibrarySelectedPortal"
      );

    if (
      savedRole &&
      roleNames[savedRole]
    ) {
      selectPortal(savedRole);
    }
  } catch (_) {}

})();