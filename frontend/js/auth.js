// Handles login form submission and token storage
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submit-btn");
  const errorEl = document.getElementById("error-msg");

  // Redirect if already logged in
  if (localStorage.getItem("archive_token")) {
    window.location.href = "/map.html";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Signing in…';

    try {
      const data = await login(emailInput.value.trim(), passwordInput.value);
      localStorage.setItem("archive_token", data.access_token);

      // Fetch user info and store role for UI gating
      const me = await getMe();
      localStorage.setItem("archive_user", JSON.stringify(me));

      window.location.href = "/map.html";
    } catch (err) {
      errorEl.textContent = err.message || "Login failed. Check your credentials.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
    }
  });
});
