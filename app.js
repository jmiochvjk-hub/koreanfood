const STORAGE_KEY = "korean-food-map.places";
const SUPABASE_TABLE = "food_places";
const SEOUL = [37.5665, 126.978];

const categoryColors = {
  韩餐: "#2f8756",
  烤肉: "#d94b3d",
  街头小吃: "#b07619",
  咖啡甜品: "#7a5a3a",
  海鲜: "#167a7f",
  酒馆: "#6d5bd0",
};

const samplePlaces = [
  {
    id: "sample-1",
    name: "明洞饺子",
    category: "韩餐",
    dish: "刀切面、饺子",
    rating: 4.6,
    price: 12000,
    note: "适合第一次来首尔时快速补一顿热乎的。",
    lat: 37.5626,
    lng: 126.985,
  },
  {
    id: "sample-2",
    name: "广藏市场绿豆煎饼",
    category: "街头小吃",
    dish: "绿豆煎饼、紫菜包饭",
    rating: 4.4,
    price: 9000,
    note: "人多但翻台快，适合边逛边吃。",
    lat: 37.5701,
    lng: 126.9997,
  },
  {
    id: "sample-3",
    name: "弘大烤肉收藏点",
    category: "烤肉",
    dish: "五花肉、冷面",
    rating: 4.7,
    price: 28000,
    note: "晚上氛围好，建议提前排队。",
    lat: 37.5563,
    lng: 126.9236,
  },
  {
    id: "sample-4",
    name: "釜山札嘎其海鲜",
    category: "海鲜",
    dish: "生鱼片、辣鱼汤",
    rating: 4.5,
    price: 35000,
    note: "适合加入釜山行程，价格先问清楚。",
    lat: 35.0969,
    lng: 129.0305,
  },
];

let places = [];
let selectedLatLng = null;
let draftMarker = null;
let db = null;
let isCloudMode = false;
const markers = new Map();

const map = L.map("map", {
  zoomControl: false,
}).setView(SEOUL, 12);

L.control.zoom({ position: "bottomleft" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const elements = {
  form: document.querySelector("#placeForm"),
  name: document.querySelector("#nameInput"),
  category: document.querySelector("#categoryInput"),
  dish: document.querySelector("#dishInput"),
  rating: document.querySelector("#ratingInput"),
  price: document.querySelector("#priceInput"),
  note: document.querySelector("#noteInput"),
  coordinateText: document.querySelector("#coordinateText"),
  list: document.querySelector("#placeList"),
  count: document.querySelector("#placeCount"),
  syncStatus: document.querySelector("#syncStatus"),
  template: document.querySelector("#placeTemplate"),
  search: document.querySelector("#searchInput"),
  filter: document.querySelector("#categoryFilter"),
  locate: document.querySelector("#locateButton"),
  seoul: document.querySelector("#seoulButton"),
  reset: document.querySelector("#resetButton"),
  clearDraft: document.querySelector("#clearDraftButton"),
};

map.on("click", (event) => {
  setDraftLocation(event.latlng);
  elements.name.focus();
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedLatLng) {
    elements.coordinateText.textContent = "请先点击地图选择位置";
    map.getContainer().focus();
    return;
  }

  const place = {
    id: crypto.randomUUID(),
    name: elements.name.value.trim(),
    category: elements.category.value,
    dish: elements.dish.value.trim(),
    rating: Number(elements.rating.value || 0),
    price: Number(elements.price.value || 0),
    note: elements.note.value.trim(),
    lat: Number(selectedLatLng.lat.toFixed(6)),
    lng: Number(selectedLatLng.lng.toFixed(6)),
  };

  await addPlace(place);
});

elements.search.addEventListener("input", render);
elements.filter.addEventListener("change", render);
elements.clearDraft.addEventListener("click", clearDraftLocation);

elements.seoul.addEventListener("click", () => {
  map.setView(SEOUL, 12);
});

elements.locate.addEventListener("click", () => {
  if (!navigator.geolocation) {
    elements.coordinateText.textContent = "当前浏览器不支持定位";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latlng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      map.setView(latlng, 14);
      setDraftLocation(latlng);
    },
    () => {
      elements.coordinateText.textContent = "无法获取定位，可直接点击地图添加";
    },
    { enableHighAccuracy: true, timeout: 8000 },
  );
});

elements.reset.addEventListener("click", async () => {
  setBusy(true);

  try {
    if (isCloudMode) {
      await db.deleteAllPlaces();
      places = normalizePlaces(await db.insertPlaces(samplePlaces));
    } else {
      places = [...samplePlaces];
      saveLocalPlaces();
    }

    render();
    setStatus(isCloudMode ? "云端已恢复示例" : "本地已恢复示例", isCloudMode ? "cloud" : "local");
  } catch (error) {
    setStatus(`恢复失败：${error.message}`, isCloudMode ? "cloud" : "local");
  } finally {
    setBusy(false);
  }
});

async function init() {
  setupSupabase();
  places = await loadPlaces();
  render();
}

function setupSupabase() {
  const config = window.SUPABASE_CONFIG || {};
  const hasConfig = config.url && config.anonKey && !config.url.includes("YOUR_PROJECT_REF");

  if (!hasConfig) {
    isCloudMode = false;
    setStatus("本地模式：填写 Supabase 配置后可多人同步", "local");
    return;
  }

  db = createSupabaseRestClient(config.url, config.anonKey);
  isCloudMode = true;
  setStatus("云端同步已连接", "cloud");
}

async function loadPlaces() {
  if (isCloudMode) {
    try {
      const data = await db.selectPlaces();
      setStatus("云端同步已连接", "cloud");
      return normalizePlaces(data);
    } catch (error) {
      isCloudMode = false;
      setStatus(`云端连接失败，已切到本地：${error.message}`, "local");
    }
  }

  return loadLocalPlaces();
}

function loadLocalPlaces() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [...samplePlaces];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [...samplePlaces];
  } catch {
    return [...samplePlaces];
  }
}

function saveLocalPlaces() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

async function addPlace(place) {
  setBusy(true);

  try {
    if (isCloudMode) {
      const data = await db.insertPlaces(place);
      places = [normalizePlace(data[0]), ...places];
    } else {
      places = [place, ...places];
      saveLocalPlaces();
    }

    elements.form.reset();
    elements.rating.value = "4.5";
    clearDraftLocation();
    render();
    focusPlace(place.id);
    setStatus(isCloudMode ? "已保存到云端" : "已保存到本地", isCloudMode ? "cloud" : "local");
  } catch (error) {
    setStatus(`添加失败：${error.message}`, isCloudMode ? "cloud" : "local");
  } finally {
    setBusy(false);
  }
}

async function deletePlace(id) {
  setBusy(true);

  try {
    if (isCloudMode) {
      await db.deletePlace(id);
    }

    const marker = markers.get(id);
    if (marker) {
      marker.remove();
      markers.delete(id);
    }

    places = places.filter((place) => place.id !== id);
    if (!isCloudMode) saveLocalPlaces();
    render();
    setStatus(isCloudMode ? "已从云端删除" : "已从本地删除", isCloudMode ? "cloud" : "local");
  } catch (error) {
    setStatus(`删除失败：${error.message}`, isCloudMode ? "cloud" : "local");
  } finally {
    setBusy(false);
  }
}

function createSupabaseRestClient(url, anonKey) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${SUPABASE_TABLE}`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };

  async function request(path = "", options = {}) {
    const response = await fetch(`${endpoint}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Supabase request failed: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return {
    selectPlaces() {
      return request("?select=*&order=created_at.desc");
    },
    insertPlaces(payload) {
      return request("", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
    },
    deletePlace(id) {
      return request(`?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    deleteAllPlaces() {
      return request("?id=not.is.null", {
        method: "DELETE",
      });
    },
  };
}

function normalizePlaces(data) {
  return (data || []).map(normalizePlace);
}

function normalizePlace(place) {
  return {
    id: place.id,
    name: place.name,
    category: place.category || "韩餐",
    dish: place.dish || "",
    rating: Number(place.rating || 0),
    price: Number(place.price || 0),
    note: place.note || "",
    lat: Number(place.lat),
    lng: Number(place.lng),
  };
}

function setDraftLocation(latlng) {
  selectedLatLng = latlng;
  elements.coordinateText.textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;

  if (draftMarker) {
    draftMarker.setLatLng(latlng);
    return;
  }

  draftMarker = L.marker(latlng, {
    icon: createPinIcon("#1d252c", "+"),
    opacity: 0.85,
  }).addTo(map);
}

function clearDraftLocation() {
  selectedLatLng = null;
  elements.coordinateText.textContent = "点击地图选择位置";

  if (draftMarker) {
    draftMarker.remove();
    draftMarker = null;
  }
}

function render() {
  renderMarkers();
  renderList();
  elements.count.textContent = places.length;
}

function getFilteredPlaces() {
  const query = elements.search.value.trim().toLowerCase();
  const category = elements.filter.value;

  return places.filter((place) => {
    const matchesCategory = category === "all" || place.category === category;
    const searchable = [place.name, place.category, place.dish, place.note].join(" ").toLowerCase();
    return matchesCategory && searchable.includes(query);
  });
}

function renderMarkers() {
  const filteredPlaces = getFilteredPlaces();
  const visibleIds = new Set(filteredPlaces.map((place) => place.id));

  markers.forEach((marker, id) => {
    if (!visibleIds.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  });

  filteredPlaces.forEach((place) => {
    const popupHtml = `
      <div class="map-popup">
        <strong>${escapeHtml(place.name)}</strong>
        <span>${escapeHtml(place.category)} · ${formatRating(place.rating)} · ${formatPrice(place.price)}</span>
        <span>${escapeHtml(place.dish || place.note || "暂无备注")}</span>
      </div>
    `;

    if (markers.has(place.id)) {
      markers.get(place.id).setPopupContent(popupHtml);
      return;
    }

    const marker = L.marker([place.lat, place.lng], {
      icon: createPinIcon(categoryColors[place.category] || "#167a7f", place.category.slice(0, 1)),
    })
      .addTo(map)
      .bindPopup(popupHtml);

    markers.set(place.id, marker);
  });
}

function renderList() {
  const filteredPlaces = getFilteredPlaces();
  elements.list.innerHTML = "";

  if (!filteredPlaces.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "没有匹配的美食点。点击地图添加一个新的吧。";
    elements.list.append(empty);
    return;
  }

  filteredPlaces.forEach((place) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.querySelector(".place-title").textContent = place.name;
    card.querySelector(".place-meta").textContent =
      `${place.category} · ${formatRating(place.rating)} · ${formatPrice(place.price)}`;
    card.querySelector(".place-note").textContent = place.dish || place.note || "暂无推荐菜";

    card.querySelector(".place-main").addEventListener("click", () => focusPlace(place.id));
    card.querySelector(".delete-button").addEventListener("click", () => deletePlace(place.id));

    elements.list.append(card);
  });
}

function focusPlace(id) {
  const place = places.find((item) => item.id === id);
  const marker = markers.get(id);
  if (!place || !marker) return;

  map.setView([place.lat, place.lng], Math.max(map.getZoom(), 14));
  marker.openPopup();
}

function createPinIcon(color, label) {
  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
    html: `<div class="pin-icon" style="background:${color}"><span>${escapeHtml(label)}</span></div>`,
  });
}

function setBusy(isBusy) {
  elements.form.querySelector("button[type='submit']").disabled = isBusy;
  elements.reset.disabled = isBusy;
}

function setStatus(message, mode) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.mode = mode;
}

function formatRating(rating) {
  return rating ? `${rating.toFixed(1)}分` : "未评分";
}

function formatPrice(price) {
  return price ? `₩${price.toLocaleString("ko-KR")}` : "价格未知";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
