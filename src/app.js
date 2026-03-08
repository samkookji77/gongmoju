const state = {
  currentMonth: new Date(),
  selectedDate: toDateKey(new Date()),
  market: "ALL",
  items: [],
  meta: {
    updatedAt: null,
    sourcePages: [],
  },
};

const els = {
  monthLabel: document.getElementById("monthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  selectedDateLabel: document.getElementById("selectedDateLabel"),
  eventList: document.getElementById("eventList"),
  stats: document.getElementById("stats"),
  updatedAtLabel: document.getElementById("updatedAtLabel"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  todayBtn: document.getElementById("todayBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  chips: document.querySelectorAll(".chip"),
  detailModal: document.getElementById("detailModal"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
};

init();

async function init() {
  try {
    const data = await loadIpoData();
    state.items = data.items ?? [];
    state.meta.updatedAt = data.updatedAt;
    state.meta.sourcePages = data.sourcePages ?? [];

    const today = new Date();
    state.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    state.selectedDate = pickInitialSelectedDate();
    if (state.selectedDate) {
      const s = parseDateKey(state.selectedDate);
      state.currentMonth = new Date(s.getFullYear(), s.getMonth(), 1);
    }
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    els.selectedDateLabel.textContent = "데이터 로딩 실패";
    els.eventList.innerHTML = `<li class="event-item">데이터를 불러오지 못했습니다. 서버를 다시 실행하고 새로고침해 주세요.</li>`;
  }
}

function bindEvents() {
  els.prevBtn.addEventListener("click", () => {
    state.currentMonth = new Date(
      state.currentMonth.getFullYear(),
      state.currentMonth.getMonth() - 1,
      1
    );
    render();
  });

  els.nextBtn.addEventListener("click", () => {
    state.currentMonth = new Date(
      state.currentMonth.getFullYear(),
      state.currentMonth.getMonth() + 1,
      1
    );
    render();
  });

  els.todayBtn.addEventListener("click", () => {
    const today = new Date();
    state.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    state.selectedDate = toDateKey(today);
    render();
  });

  els.refreshBtn.addEventListener("click", async () => {
    await refreshData();
  });

  els.chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.market = chip.dataset.market;
      els.chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      render();
    });
  });

  els.detailModal.addEventListener("click", (e) => {
    if (e.target === els.detailModal) closeModal();
  });
  els.modalCloseBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function render() {
  renderMonthLabel();
  renderCalendarGrid();
  renderSelectedDate();
  renderStats();
  renderUpdatedAt();
}

function renderMonthLabel() {
  const y = state.currentMonth.getFullYear();
  const m = state.currentMonth.getMonth() + 1;
  els.monthLabel.textContent = `${y}년 ${m}월`;
}

function renderCalendarGrid() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const d = prevLastDate - i;
    cells.push({ date: new Date(year, month - 1, d), otherMonth: true });
  }

  for (let d = 1; d <= lastDate; d += 1) {
    cells.push({ date: new Date(year, month, d), otherMonth: false });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d += 1) {
    cells.push({ date: new Date(year, month + 1, d), otherMonth: true });
  }

  els.calendarGrid.innerHTML = "";
  for (const cell of cells) {
    const key = toDateKey(cell.date);
    const isToday = key === toDateKey(new Date());
    const isSelected = key === state.selectedDate;
    const dayEvents = getDayEvents(key, state.market);
    const subCount = dayEvents.filter((e) => e.type === "subscription").length;
    const listCount = dayEvents.filter((e) => e.type === "listing").length;

    const el = document.createElement("div");
    el.className = `day-cell${cell.otherMonth ? " other-month" : ""}${isToday ? " today" : ""}${
      isSelected ? " selected" : ""
    }`;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.innerHTML = `
      <div class="day-number">${cell.date.getDate()}</div>
      ${
        dayEvents.length
          ? `<div class="event-counts">청 ${subCount} · 상 ${listCount}</div>`
          : `<div class="event-counts empty">일정 없음</div>`
      }
      <div class="dot-list">
        ${dayEvents
          .slice(0, 3)
          .map(
            (event) =>
              `<button type="button" class="dot ${event.item.market.toLowerCase()} ${
                event.type === "listing" ? "listing" : "subscription"
              }" data-open-id="${event.item.id}">
                <span class="event-tag">${eventTypeShort(event.type)}</span>${escapeHtml(event.item.company)}
              </button>`
          )
          .join("")}
        ${dayEvents.length > 3 ? `<span class="dot">+${dayEvents.length - 3}건</span>` : ""}
      </div>
    `;

    el.addEventListener("click", (evt) => {
      const target = evt.target;
      if (target instanceof HTMLElement) {
        const openBtn = target.closest("[data-open-id]");
        if (openBtn instanceof HTMLElement && openBtn.dataset.openId) {
          openItemModal(openBtn.dataset.openId);
          return;
        }
      }
      if (target instanceof HTMLElement && target.closest(".dot-list")) {
        return;
      }

      state.selectedDate = key;
      if (cell.otherMonth) {
        state.currentMonth = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1);
      }
      render();
    });

    el.addEventListener("keydown", (evt) => {
      if (evt.key !== "Enter" && evt.key !== " ") return;
      evt.preventDefault();
      state.selectedDate = key;
      if (cell.otherMonth) {
        state.currentMonth = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1);
      }
      render();
    });

    els.calendarGrid.appendChild(el);
  }
}

function renderSelectedDate() {
  const selected = parseDateKey(state.selectedDate);
  const dateTitle = `${selected.getFullYear()}년 ${selected.getMonth() + 1}월 ${selected.getDate()}일`;
  els.selectedDateLabel.textContent = `${dateTitle} 일정`;

  const events = getDayEvents(state.selectedDate, state.market);
  if (!events.length) {
    els.eventList.innerHTML = `<li class="event-item">해당 날짜의 청약/상장 일정이 없습니다.</li>`;
    return;
  }

  els.eventList.innerHTML = events
    .map(
      ({ item, type }) => `
      <li class="event-item">
        <strong>${escapeHtml(item.company)}</strong>
        <span class="pill ${item.market.toLowerCase()}">${item.market}</span>
        <span class="pill event-kind ${type === "listing" ? "list" : "sub"}">${eventTypeLabel(type)}</span>
        <div class="event-meta">청약: ${item.subscriptionStart} ~ ${item.subscriptionEnd}</div>
        <div class="event-meta">상장일: ${item.listingDate ?? "미정"}</div>
        <div class="event-meta">청약 가능 증권사: ${formatBrokers(item.brokers)}</div>
        <button type="button" class="ghost-btn open-detail-btn" data-open-id="${item.id}">
          종목 상세
        </button>
      </li>
    `
    )
    .join("");

  els.eventList.querySelectorAll("[data-open-id]").forEach((btn) => {
    btn.addEventListener("click", () => openItemModal(btn.dataset.openId));
  });
}

function renderStats() {
  const today = toDateKey(new Date());
  const next7 = addDays(today, 6);

  const filtered = filteredItems(state.market);
  const todayCount = filtered.filter((item) => isInRange(today, item.subscriptionStart, item.subscriptionEnd))
    .length;
  const upcoming = filtered.filter((item) => item.subscriptionStart >= today && item.subscriptionStart <= next7)
    .length;

  els.stats.innerHTML = `
    <article class="stat">
      <p class="k">전체 일정</p>
      <p class="v">${filtered.length}건</p>
    </article>
    <article class="stat">
      <p class="k">오늘 진행 중</p>
      <p class="v">${todayCount}건</p>
    </article>
    <article class="stat">
      <p class="k">7일 내 시작</p>
      <p class="v">${upcoming}건</p>
    </article>
  `;
}

function renderUpdatedAt() {
  if (!state.meta.updatedAt) {
    els.updatedAtLabel.textContent = "";
    return;
  }
  const d = new Date(state.meta.updatedAt);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
  els.updatedAtLabel.textContent = `데이터 갱신: ${local} (소스: 38 공모청약일정/신규상장)`;
}

function openItemModal(itemId) {
  const item = state.items.find((v) => v.id === itemId);
  if (!item) return;

  els.modalTitle.textContent = item.company;
  els.modalBody.innerHTML = `
    <dl>
      <dt>시장</dt><dd>${item.market}</dd>
      <dt>청약일</dt><dd>${item.subscriptionStart} ~ ${item.subscriptionEnd}</dd>
      <dt>상장일</dt><dd>${item.listingDate ?? "미정"}</dd>
      <dt>청약 가능 증권사</dt><dd>${formatBrokers(item.brokers)}</dd>
      <dt>확정 공모가</dt><dd>${item.fixedOfferPrice ?? "미정"}</dd>
      <dt>희망 공모가</dt><dd>${item.desiredOfferPriceRange ?? "미정"}</dd>
      <dt>청약 경쟁률</dt><dd>${item.competitionRate ?? "미정"}</dd>
      <dt>종목 코드</dt><dd>${item.stockCode ?? "미정"}</dd>
      <dt>원문 상세</dt><dd><a href="${item.detailUrl}" target="_blank" rel="noopener noreferrer">38 상세 페이지 열기</a></dd>
    </dl>
  `;
  els.detailModal.classList.remove("hidden");
}

function closeModal() {
  els.detailModal.classList.add("hidden");
}

async function loadIpoData() {
  const res = await fetch("/api/events", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`JSON 로드 실패 (${res.status})`);
  }
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "이벤트 API 실패");
  }
  return json;
}

async function refreshData() {
  const original = els.refreshBtn.textContent;
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "갱신 중...";
  try {
    const res = await fetch("/api/refresh", { method: "POST" });
    let json = {};
    try {
      json = await res.json();
    } catch {
      throw new Error("갱신 API 응답 파싱 실패");
    }
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "갱신 실패 (server.py로 실행했는지 확인)");
    }
    const latest = await loadIpoData();
    state.items = latest.items;
    state.meta.updatedAt = latest.updatedAt;
    state.meta.sourcePages = latest.sourcePages ?? [];
    render();
  } catch (err) {
    alert(`데이터 갱신 실패: ${err.message}`);
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = original;
  }
}

function filteredItems(market) {
  if (market === "ALL") return state.items;
  return state.items.filter((item) => item.market === market);
}

function pickInitialSelectedDate() {
  const today = toDateKey(new Date());
  const dates = new Set();
  for (const item of state.items) {
    let d = item.subscriptionStart;
    while (d <= item.subscriptionEnd) {
      dates.add(d);
      d = addDays(d, 1);
    }
    if (item.listingDate) dates.add(item.listingDate);
  }
  const sorted = [...dates].sort();
  if (!sorted.length) return today;
  const upcoming = sorted.find((d) => d >= today);
  return upcoming || sorted[sorted.length - 1];
}

function getDayEvents(dateKey, market) {
  const items = filteredItems(market);
  const events = [];
  for (const item of items) {
    if (isInRange(dateKey, item.subscriptionStart, item.subscriptionEnd)) {
      events.push({ type: "subscription", item });
    }
    if (item.listingDate === dateKey) {
      events.push({ type: "listing", item });
    }
  }
  return events.sort((a, b) => {
    if (a.type !== b.type) return a.type === "subscription" ? -1 : 1;
    return a.item.company.localeCompare(b.item.company, "ko");
  });
}

function isInRange(target, start, end) {
  return target >= start && target <= end;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateKey, days) {
  const base = parseDateKey(dateKey);
  base.setDate(base.getDate() + days);
  return toDateKey(base);
}

function formatBrokers(brokers) {
  return brokers && brokers.length ? brokers.join(", ") : "미정";
}

function eventTypeShort(type) {
  return type === "listing" ? "상" : "청";
}

function eventTypeLabel(type) {
  return type === "listing" ? "상장 일정" : "청약 일정";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
