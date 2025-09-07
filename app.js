const $ = (sel) => document.querySelector(sel);
const tbody = $("#qa-table tbody");
let CURRENT = null; // { sample_id, image_relpath, image_web_url, qas: [...] }
let TOKEN = localStorage.getItem("token") || "";

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

function setAuthedUI(name) {
  if (TOKEN) {
    $("#login-form").classList.add("hidden");
    $("#whoami").classList.remove("hidden");
    $("#me-name").textContent = name || "";
    $("#btn-load").disabled = false;
  } else {
    $("#login-form").classList.remove("hidden");
    $("#whoami").classList.add("hidden");
    $("#btn-load").disabled = true;
  }
}

async function fetchMe() {
  if (!TOKEN) return setAuthedUI("");
  try {
    const url = new URL("/api/auth/me", window.BACKEND_BASE);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error("not authed");
    const me = await res.json();
    setAuthedUI(me.username);
  } catch {
    TOKEN = ""; localStorage.removeItem("token");
    setAuthedUI("");
  }
}

async function login(e) {
  e.preventDefault();
  const username = $("#username").value.trim();
  const password = $("#password").value;
  if (!username || !password) return;
  try {
    const url = new URL("/api/auth/login", window.BACKEND_BASE);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("login failed");
    const data = await res.json();
    TOKEN = data.access_token;
    localStorage.setItem("token", TOKEN);
    await fetchMe();
    toast("登录成功");
  } catch (err) {
    console.error(err); toast("登录失败");
  }
}

function logout() {
  TOKEN = ""; localStorage.removeItem("token");
  setAuthedUI(""); toast("已退出");
}

async function loadSample() {
  $("#btn-load").disabled = true;
  $("#btn-submit").disabled = true;
  tbody.innerHTML = "";
  try {
    const url = new URL("/api/sample", window.BACKEND_BASE);
    const res = await fetch(url, { method: "GET", headers: authHeaders() });
    if (!res.ok) throw new Error("request failed");
    const data = await res.json();
    CURRENT = data;

    $("#image-section").classList.remove("hidden");
    $("#qa-section").classList.remove("hidden");
    $("#img").src = new URL(data.image_web_url, window.BACKEND_BASE).toString();
    $("#sample-id").textContent = data.sample_id;
    $("#image-rel").textContent = data.image_relpath;

    data.qas.forEach((qa, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${qa.dimension || "—"}</td>
        <td>${qa.question}</td>
        <td>${qa.answer}</td>
        <td>
          <select class="score-select" data-qid="${qa.id}">
            <option value="">—</option>
            <option value="1">+1 好</option>
            <option value="0">0 一般</option>
            <option value="-1">-1 坏</option>
          </select>
        </td>
        <td><input type="text" placeholder="可选备注" data-cmt="${qa.id}" /></td>
      `;
      tbody.appendChild(tr);
    });

    $("#btn-submit").disabled = false;
  } catch (err) {
    console.error(err);
    toast("加载失败");
  } finally {
    $("#btn-load").disabled = false;
  }
}

async function submitRatings() {
  if (!CURRENT) return;
  const ratings = [];
  tbody.querySelectorAll(".score-select").forEach(sel => {
    const val = sel.value;
    if (val === "") return;
    const qid = sel.getAttribute("data-qid");
    const cmt = tbody.querySelector(`input[data-cmt="${qid}"]`).value;
    ratings.push({ id: qid, score: Number(val), comment: cmt || undefined });
  });
  if (!ratings.length) return toast("请至少为一个问题打分");
  $("#btn-submit").disabled = true;
  try {
    const url = new URL("/api/rating", window.BACKEND_BASE);
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sample_id: CURRENT.sample_id, ratings }),
    });
    if (!res.ok) throw new Error("rating failed");
    toast("评分已提交，感谢！");
  } catch (err) {
    console.error(err); toast("提交失败");
  } finally {
    $("#btn-submit").disabled = false;
  }
}

// wire up
$("#login-form").addEventListener("submit", login);
$("#btn-logout").addEventListener("click", logout);
$("#btn-load").addEventListener("click", loadSample);
$("#btn-submit").addEventListener("click", submitRatings);

// on load
fetchMe();
