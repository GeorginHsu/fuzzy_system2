const $ = (sel) => document.querySelector(sel);
const tbody = $("#qa-table tbody");
let CURRENT = null;
let USERNAME = localStorage.getItem("username") || "";

// 如你用 config.json / config.js 异步设置 BACKEND_BASE，等待它就绪
async function waitForBackendBase(timeout = 10000) {
  const t0 = Date.now();
  while (!window.BACKEND_BASE) {
    await new Promise(r => setTimeout(r, 50));
    if (Date.now() - t0 > timeout) throw new Error("BACKEND_BASE not loaded");
  }
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function headers(json = false) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (USERNAME) h["X-Username"] = USERNAME; // 关键：把用户名传给后端
  return h;
}

async function ensureUsername() {
  if (USERNAME) return true;
  const name = window.prompt("请输入用户名：");
  if (!name) { toast("未设置用户名"); return false; }
  USERNAME = name.trim();
  if (!USERNAME) { toast("用户名不能为空"); return false; }
  localStorage.setItem("username", USERNAME);
  return true;
}

async function loadSample() {
  if (!await ensureUsername()) return;
  $("#btn-load").disabled = true;
  $("#btn-submit").disabled = true;
  tbody.innerHTML = "";
  try {
    await waitForBackendBase();
    const url = new URL("/api/sample", window.BACKEND_BASE);
    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) throw new Error(`request failed: ${res.status}`);
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
  } catch (e) {
    console.error(e);
    toast("加载失败");
  } finally {
    $("#btn-load").disabled = false;
  }
}

async function submitRatings() {
  if (!await ensureUsername()) return;
  if (!CURRENT) return toast("请先加载一组样本");
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
    await waitForBackendBase();
    const url = new URL("/api/rating", window.BACKEND_BASE);
    const res = await fetch(url, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ sample_id: CURRENT.sample_id, ratings }),
    });
    if (!res.ok) throw new Error(`rating failed: ${res.status}`);
    toast("评分已提交，感谢！");
  } catch (e) {
    console.error(e);
    toast("提交失败");
  } finally {
    $("#btn-submit").disabled = false;
  }
}

// 事件绑定
$("#btn-load").addEventListener("click", loadSample);
$("#btn-submit").addEventListener("click", submitRatings);
