// contraption-lab/js/auth-ui.js
import { cloud, user, signup, login, logout } from "./cloud.js";

export function setIndicator() {
  const dot = document.getElementById("netDot");
  const u = user();
  if (u) { dot.textContent = "●"; dot.className = "netdot online"; dot.title = "synced as " + (u.name || u.email); }
  else if (cloud.available) { dot.textContent = "○"; dot.className = "netdot"; dot.title = "online — not signed in"; }
  else { dot.textContent = "○"; dot.className = "netdot"; dot.title = "local only"; }
}

export function mountAccountUI({ onAuthChange }) {
  const dlg = document.getElementById("accountDlg");
  const btn = document.getElementById("accountBtn");
  const email = document.getElementById("acEmail");
  const pass = document.getElementById("acPass");
  const name = document.getElementById("acName");
  const err = document.getElementById("acError");
  const loginBtn = document.getElementById("acLogin");
  const signupBtn = document.getElementById("acSignup");
  const logoutBtn = document.getElementById("acLogout");

  function refresh() {
    const u = user();
    btn.textContent = u ? (u.name || u.email) : "Sign in";
    logoutBtn.hidden = !u;
    name.hidden = !!u; email.hidden = !!u; pass.hidden = !!u;
    loginBtn.hidden = !!u; signupBtn.hidden = !!u;
    document.getElementById("accountTitle").textContent = u ? ("Signed in as " + (u.name || u.email)) : "Account";
    setIndicator();
  }
  function showErr(m){ err.textContent = m; err.hidden = !m; }

  btn.onclick = () => { showErr(""); refresh(); dlg.showModal(); };
  loginBtn.onclick = async () => {
    showErr(""); const r = await login(email.value.trim(), pass.value);
    if (r.ok) { refresh(); dlg.close(); onAuthChange && onAuthChange(); } else showErr(r.error);
  };
  signupBtn.onclick = async () => {
    showErr(""); const r = await signup(email.value.trim(), pass.value, name.value.trim());
    if (r.ok) { refresh(); dlg.close(); onAuthChange && onAuthChange(); } else showErr(r.error);
  };
  logoutBtn.onclick = () => { logout(); refresh(); dlg.close(); onAuthChange && onAuthChange(); };

  refresh();
}
