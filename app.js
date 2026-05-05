const API_ROOT = "/api";
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

const state = {
  activeTab: "all",
  editingId: null,
  items: [],
  requestId: 0,
  selectedPhotoData: "",
  selectedPhotoLabel: "Item photo",
  selectedType: "lost",
  toastShownForServerError: false
};

let renderTimer = null;

function apiRequest(path, options = {}) {
  const config = {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.headers || {})
    }
  };

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
    config.headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_ROOT}${path}`, config).then(async (response) => {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload.message || "Request failed.");
      error.payload = payload;
      error.status = response.status;
      throw error;
    }

    return payload;
  });
}

function escHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createFallbackPhoto(label) {
  const safeLabel = escapeSvgText(label || "Item");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="placeholder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1f2937" />
          <stop offset="100%" stop-color="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#placeholder)" />
      <rect x="110" y="120" width="980" height="560" rx="40" fill="rgba(10,10,15,0.18)" stroke="rgba(255,255,255,0.16)" />
      <text x="120" y="370" fill="white" font-size="72" font-family="Arial, sans-serif" font-weight="700">${safeLabel}</text>
      <text x="120" y="445" fill="rgba(255,255,255,0.88)" font-size="34" font-family="Arial, sans-serif">Photo unavailable</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function photoSource(item) {
  return item.photoData || createFallbackPhoto(item.name || "Item");
}

function formatDate(value, options) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-IN", options);
}

function formatInputDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function cardTone(item) {
  return item.status === "resolved" ? "resolved" : item.type;
}

function badgeLabel(item) {
  if (item.status === "resolved") {
    return "Resolved";
  }

  return item.type === "lost" ? "Lost" : "Found";
}

function reportLabel(item) {
  return item.type === "lost" ? "Lost report" : "Found report";
}

function statusLabel(item) {
  return item.status === "resolved" ? "Resolved" : "Open";
}

function currentQueryString() {
  const params = new URLSearchParams();
  const search = document.getElementById("searchInput").value.trim();
  const category = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortFilter").value;

  if (state.activeTab === "lost" || state.activeTab === "found") {
    params.set("type", state.activeTab);
    params.set("status", "open");
  } else if (state.activeTab === "resolved") {
    params.set("status", "resolved");
  }

  if (category !== "all") {
    params.set("category", category);
  }

  if (search) {
    params.set("search", search);
  }

  params.set("sort", sort);

  const query = params.toString();
  return query ? `?${query}` : "";
}

function updateStats(stats) {
  const safeStats = {
    lost: stats?.lost || 0,
    found: stats?.found || 0,
    resolved: stats?.resolved || 0,
    total: stats?.total || 0
  };

  ["stat-lost", "nav-lost"].forEach((id) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = safeStats.lost;
    }
  });

  ["stat-found", "nav-found"].forEach((id) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = safeStats.found;
    }
  });

  const resolvedElement = document.getElementById("stat-resolved");

  if (resolvedElement) {
    resolvedElement.textContent = safeStats.resolved;
  }

  ["stat-total", "nav-total"].forEach((id) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = safeStats.total;
    }
  });
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderCards();
  }, 180);
}

function setLoadingState() {
  const grid = document.getElementById("cardsGrid");
  document.getElementById("itemCount").textContent = "Loading...";
  grid.innerHTML = `
    <div class="empty-state">
      <span class="icon">&#9203;</span>
      <h3>Loading board</h3>
      <p>Fetching items from the MongoDB API...</p>
    </div>
  `;
}

function setServerRequiredState() {
  const grid = document.getElementById("cardsGrid");
  document.getElementById("itemCount").textContent = "Server required";
  updateStats({ lost: 0, found: 0, resolved: 0, total: 0 });
  grid.innerHTML = `
    <div class="empty-state">
      <span class="icon">&#128736;&#65039;</span>
      <h3>Run the backend first</h3>
      <p>This version uses Express and MongoDB. Start the Node server, then open <strong>http://localhost:5000</strong>.</p>
    </div>
  `;
}

function setApiErrorState(message) {
  const grid = document.getElementById("cardsGrid");
  document.getElementById("itemCount").textContent = "0 items";
  grid.innerHTML = `
    <div class="empty-state">
      <span class="icon">&#9888;&#65039;</span>
      <h3>Could not load items</h3>
      <p>${escHtml(message)}</p>
      <button class="btn btn-primary" onclick="renderCards()">Retry</button>
    </div>
  `;
}

function updateReportTypeDisplay(message) {
  const badge = document.getElementById("reportTypeBadge");
  const helpText = document.getElementById("typeHelpText");
  const reportName = state.selectedType === "lost" ? "Lost Report" : "Found Report";

  badge.textContent = reportName;
  badge.className = `report-type-pill ${state.selectedType}`;
  helpText.textContent = message || `This form will create a ${state.selectedType} item report.`;
}

function renderPhotoPreview() {
  const preview = document.getElementById("photoPreview");

  if (!state.selectedPhotoData) {
    preview.classList.add("empty");
    preview.innerHTML = `
      <span class="photo-placeholder-title">Photo required</span>
      <span class="photo-placeholder-text">Add a clear image of the item before posting it to the board.</span>
    `;
    return;
  }

  preview.classList.remove("empty");
  preview.innerHTML = `<img src="${escHtml(state.selectedPhotoData)}" alt="${escHtml(state.selectedPhotoLabel || "Item photo")}">`;
}

function handlePhotoChange(event) {
  const file = event.target.files?.[0];

  if (!file) {
    if (!state.selectedPhotoData) {
      renderPhotoPreview();
    }
    return;
  }

  if (!file.type.startsWith("image/")) {
    event.target.value = "";
    showToast("Please choose an image file.", "error");
    return;
  }

  if (file.size > MAX_PHOTO_SIZE) {
    event.target.value = "";
    showToast("Please choose an image smaller than 2 MB.", "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    state.selectedPhotoData = reader.result;
    state.selectedPhotoLabel = file.name || "Uploaded photo";
    renderPhotoPreview();
  };

  reader.onerror = () => {
    event.target.value = "";
    showToast("Could not read that photo. Please try another file.", "error");
  };

  reader.readAsDataURL(file);
}

function clearForm() {
  [
    "fName",
    "fDesc",
    "fLocation",
    "fContactName",
    "fPhone",
    "fEmail",
    "fReward"
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });

  document.getElementById("fCategory").value = "other";
  document.getElementById("fDate").value = "";
  document.getElementById("fPhoto").value = "";
  state.selectedPhotoData = "";
  state.selectedPhotoLabel = "Item photo";

  renderPhotoPreview();
}

function paintCards(items) {
  const grid = document.getElementById("cardsGrid");
  document.getElementById("itemCount").textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="icon">&#128269;</span>
        <h3>No items found</h3>
        <p>Try changing your search or filters, or be the first to post.</p>
        <button class="btn btn-primary" onclick="openPostModal('lost')">+ Post an Item</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = items
    .map((item, index) => {
      const tone = cardTone(item);
      const eventDate = formatDate(item.date, {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      const postedDate = formatDate(item.createdAt, {
        day: "numeric",
        month: "short"
      });
      const photo = escHtml(photoSource(item));

      return `
        <article class="item-card ${tone}" style="animation-delay:${index * 0.05}s">
          <div class="card-media">
            <img class="card-photo" src="${photo}" alt="${escHtml(`Photo of ${item.name}`)}">
            <span class="card-category">${escHtml(item.category || "other")}</span>
          </div>
          <div class="card-header">
            <span class="badge ${tone}">${escHtml(badgeLabel(item))}</span>
          </div>
          <div class="card-title">${escHtml(item.name)}</div>
          <div class="card-desc">${escHtml(item.description || "")}</div>
          <div class="card-meta">
            ${
              item.location
                ? `<div class="card-meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escHtml(item.location)}</div>`
                : ""
            }
            ${
              eventDate
                ? `<div class="card-meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${eventDate}</div>`
                : ""
            }
            <div class="card-meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Posted ${postedDate || "today"}</div>
            ${
              item.reward
                ? `<div class="card-meta-row reward-meta">Reward: ${escHtml(item.reward)}</div>`
                : ""
            }
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="openDetail('${item._id}')">View Details</button>
            ${
              item.isOwner
                ? `
                  <button class="btn btn-secondary btn-sm" onclick="openEditModal('${item._id}')">Edit</button>
                  ${
                    item.status !== "resolved"
                      ? `<button class="btn btn-found btn-sm" onclick="markResolved('${item._id}')">Mark Resolved</button>`
                      : ""
                  }
                  <button class="btn btn-danger btn-sm" onclick="deleteItem('${item._id}')">Delete</button>
                `
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

async function renderCards() {
  if (window.location.protocol === "file:") {
    setServerRequiredState();
    return;
  }

  const requestId = ++state.requestId;
  setLoadingState();

  try {
    const query = currentQueryString();
    const [itemsPayload, statsPayload] = await Promise.all([
      apiRequest(`/items${query}`),
      apiRequest("/items/stats")
    ]);

    if (requestId !== state.requestId) {
      return;
    }

    state.items = itemsPayload.items || [];
    paintCards(state.items);
    updateStats(statsPayload.stats);
    state.toastShownForServerError = false;
  } catch (error) {
    if (requestId !== state.requestId) {
      return;
    }

    setApiErrorState(error.message || "The server may be offline.");

    if (!state.toastShownForServerError) {
      showToast(error.message || "Could not reach the server.", "error");
      state.toastShownForServerError = true;
    }
  }
}

function setTab(button, filter) {
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  button.classList.add("active");
  state.activeTab = filter;
  renderCards();
}

function openPostModal(type = "lost") {
  state.editingId = null;
  state.selectedType = type === "found" ? "found" : "lost";

  document.getElementById("modalTitle").textContent = "Post an Item";
  document.getElementById("submitBtn").textContent = "Post Item";
  clearForm();
  updateReportTypeDisplay(`This form will create a ${state.selectedType} item report.`);
  document.getElementById("fDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("postOverlay").classList.add("active");
}

function closePostModal(event) {
  if (event && event.target !== document.getElementById("postOverlay")) {
    return;
  }

  document.getElementById("postOverlay").classList.remove("active");
  state.editingId = null;
}

function findCachedItem(id) {
  return state.items.find((item) => item._id === id) || null;
}

async function getItem(id) {
  const cachedItem = findCachedItem(id);

  if (cachedItem) {
    return cachedItem;
  }

  const payload = await apiRequest(`/items/${id}`);
  return payload.item;
}

async function openEditModal(id) {
  try {
    const item = await getItem(id);

    if (!item.isOwner) {
      showToast("Only the person who posted this item can edit it from their original browser.", "error");
      return;
    }

    state.editingId = id;
    state.selectedType = item.type || "lost";
    state.selectedPhotoData = item.photoData || "";
    state.selectedPhotoLabel = item.name || "Current photo";

    document.getElementById("modalTitle").textContent = "Edit Item";
    document.getElementById("submitBtn").textContent = "Save Changes";
    document.getElementById("fName").value = item.name || "";
    document.getElementById("fCategory").value = item.category || "other";
    document.getElementById("fDesc").value = item.description || "";
    document.getElementById("fLocation").value = item.location || "";
    document.getElementById("fDate").value = formatInputDate(item.date);
    document.getElementById("fContactName").value = item.contactName || "";
    document.getElementById("fPhone").value = item.phone || "";
    document.getElementById("fEmail").value = item.email || "";
    document.getElementById("fReward").value = item.reward || "";
    document.getElementById("fPhoto").value = "";

    updateReportTypeDisplay(`This ${state.selectedType} report type stays fixed for this item.`);
    renderPhotoPreview();
    document.getElementById("postOverlay").classList.add("active");
  } catch (error) {
    showToast(error.message || "Could not load the item.", "error");
  }
}

function buildFormPayload() {
  return {
    type: state.selectedType,
    photoData: state.selectedPhotoData,
    name: document.getElementById("fName").value.trim(),
    category: document.getElementById("fCategory").value,
    description: document.getElementById("fDesc").value.trim(),
    location: document.getElementById("fLocation").value.trim(),
    date: document.getElementById("fDate").value,
    contactName: document.getElementById("fContactName").value.trim(),
    phone: document.getElementById("fPhone").value.trim(),
    email: document.getElementById("fEmail").value.trim(),
    reward: document.getElementById("fReward").value.trim()
  };
}

async function submitPost() {
  const submitButton = document.getElementById("submitBtn");
  const payload = buildFormPayload();

  if (!payload.name || !payload.description) {
    showToast("Please fill in Item Name and Description.", "error");
    return;
  }

  if (!payload.photoData) {
    showToast("Please upload at least one photo before posting.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = state.editingId ? "Saving..." : "Posting...";

  try {
    if (state.editingId) {
      await apiRequest(`/items/${state.editingId}`, {
        method: "PUT",
        body: payload
      });
      showToast("Item updated successfully.", "success");
    } else {
      await apiRequest("/items", {
        method: "POST",
        body: payload
      });
      showToast("Item posted to the board.", "success");
    }

    closePostModal();
    await renderCards();
  } catch (error) {
    showToast(error.message || "Could not save the item.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = state.editingId ? "Save Changes" : "Post Item";
  }
}

async function openDetail(id) {
  try {
    const item = await getItem(id);
    const tone = cardTone(item);
    const eventDate = formatDate(item.date, {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const postedDate = formatDate(item.createdAt, {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const emailHref = item.email ? `mailto:${encodeURIComponent(item.email)}` : "";
    const photo = escHtml(photoSource(item));

    document.getElementById("detailModalTitle").textContent = "Item Details";
    document.getElementById("detailContent").innerHTML = `
      <div class="detail-photo-shell">
        <img class="detail-photo" src="${photo}" alt="${escHtml(`Photo of ${item.name}`)}">
      </div>
      <div class="detail-type"><span class="badge ${tone}">${escHtml(badgeLabel(item))}</span></div>
      <div class="detail-title">${escHtml(item.name)}</div>
      <div class="detail-desc">${escHtml(item.description || "No description provided.")}</div>
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-val">${escHtml(statusLabel(item))}</div></div>
        <div class="detail-field"><div class="detail-field-label">Report Type</div><div class="detail-field-val">${escHtml(reportLabel(item))}</div></div>
        <div class="detail-field"><div class="detail-field-label">Location</div><div class="detail-field-val">${escHtml(item.location || "-")}</div></div>
        <div class="detail-field"><div class="detail-field-label">Date</div><div class="detail-field-val">${escHtml(eventDate || "Unknown")}</div></div>
        <div class="detail-field"><div class="detail-field-label">Category</div><div class="detail-field-val">${escHtml(item.category || "other")}</div></div>
        <div class="detail-field"><div class="detail-field-label">Posted</div><div class="detail-field-val">${escHtml(postedDate || "Unknown")}</div></div>
        ${
          item.reward
            ? `<div class="detail-field" style="grid-column:1/-1"><div class="detail-field-label">Reward / Note</div><div class="detail-field-val accent">${escHtml(item.reward)}</div></div>`
            : ""
        }
      </div>
      ${
        item.contactName || item.phone || item.email
          ? `
            <div class="contact-box">
              <h4>Contact Information</h4>
              ${
                item.contactName
                  ? `<div class="contact-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${escHtml(item.contactName)}</div>`
                  : ""
              }
              ${
                item.phone
                  ? `<div class="contact-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.09 6.09l1.86-1.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${escHtml(item.phone)}</div>`
                  : ""
              }
              ${
                item.email
                  ? `<div class="contact-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg><a href="${emailHref}">${escHtml(item.email)}</a></div>`
                  : ""
              }
            </div>
          `
          : ""
      }
      ${
        item.isOwner
          ? `
            <div class="detail-actions">
              <button class="btn btn-secondary" onclick="closeDetailModal(); openEditModal('${item._id}')">Edit Item</button>
              ${
                item.status !== "resolved"
                  ? `<button class="btn btn-found" onclick="closeDetailModal(); markResolved('${item._id}')">Mark Resolved</button>`
                  : ""
              }
              <button class="btn btn-danger" onclick="closeDetailModal(); deleteItem('${item._id}')">Delete</button>
            </div>
          `
          : `<p class="detail-owner-note">Only the original poster can edit or resolve this item.</p>`
      }
    `;

    document.getElementById("detailOverlay").classList.add("active");
  } catch (error) {
    showToast(error.message || "Could not load the item.", "error");
  }
}

function closeDetailModal(event) {
  if (event && event.target !== document.getElementById("detailOverlay")) {
    return;
  }

  document.getElementById("detailOverlay").classList.remove("active");
}

async function deleteItem(id) {
  if (!window.confirm("Are you sure you want to delete this item?")) {
    return;
  }

  try {
    await apiRequest(`/items/${id}`, {
      method: "DELETE"
    });
    showToast("Item deleted.", "info");
    await renderCards();
  } catch (error) {
    showToast(error.message || "Could not delete the item.", "error");
  }
}

async function markResolved(id) {
  try {
    await apiRequest(`/items/${id}/resolve`, {
      method: "PATCH"
    });
    showToast("Item marked as resolved.", "success");
    await renderCards();
  } catch (error) {
    showToast(error.message || "Could not update the item.", "error");
  }
}

function showToast(message, type = "info") {
  const icons = {
    success: "&#9989;",
    error: "&#10060;",
    info: "&#8505;&#65039;"
  };
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");

  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s";

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function showHowItWorks() {
  const steps = [
    "Post a lost or found item with a clear photo and details.",
    "The college community searches and filters the board to match reports quickly.",
    "People connect using the contact details on the listing.",
    "Only the original browser that posted an item can edit, resolve, or delete that item."
  ];

  document.getElementById("detailModalTitle").textContent = "How FindIt Works";
  document.getElementById("detailContent").innerHTML = `
    <p class="detail-desc">FindIt is a community-powered lost and found platform for your campus. Here is the full flow:</p>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${steps
        .map((step, index) => {
          return `
            <div style="display:flex;gap:12px;align-items:flex-start;background:var(--bg-input);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border);">
              <span style="background:var(--accent-dim);color:var(--accent-light);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;">${index + 1}</span>
              <span style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;">${escHtml(step)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
    <div style="margin-top:20px;padding:14px;background:var(--accent-dim-soft);border:1px solid var(--border-accent);border-radius:var(--radius-sm);">
      <p style="font-size:0.82rem;color:var(--accent-light);font-weight:600;margin-bottom:6px;">COMMUNITY FLOW</p>
      <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;">This board runs on Express + MongoDB, and ownership protection prevents one user from deleting or editing another user&apos;s post.</p>
    </div>
    <button class="btn btn-primary" style="margin-top:20px;width:100%;" onclick="closeDetailModal()">Got It</button>
  `;
  document.getElementById("detailOverlay").classList.add("active");
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.getElementById("postOverlay").classList.remove("active");
    document.getElementById("detailOverlay").classList.remove("active");
  }
});

async function initApp() {
  updateReportTypeDisplay();
  renderPhotoPreview();

  if (window.location.protocol === "file:") {
    setServerRequiredState();
    return;
  }

  try {
    await renderCards();
  } catch (error) {
    setApiErrorState(error.message || "Could not connect to the server.");
  }
}

initApp();
