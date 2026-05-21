const STORAGE_KEY = "korean-food-map.places";
const SUPABASE_TABLE = "food_places";
const STORAGE_BUCKET = "food-photos";
const SEOUL = [37.5665, 126.978];
const MERGE_RADIUS_METERS = 200;
const PHOTO_MAX_DIM = 1600;
const PHOTO_QUALITY = 0.85;
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

const categoryColors = {
  韩餐: "#2f8756",
  烤肉: "#d94b3d",
  街头小吃: "#b07619",
  咖啡甜品: "#7a5a3a",
  海鲜: "#167a7f",
  酒馆: "#6d5bd0",
  日料: "#e36b66",
  中餐: "#c98e1c",
  西餐: "#3a6ea5",
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
  idol: document.querySelector("#idolInput"),
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
  addressSearch: document.querySelector("#addressSearchInput"),
  addressSearchButton: document.querySelector("#addressSearchButton"),
  addressResults: document.querySelector("#addressSearchResults"),
  photo: document.querySelector("#photoInput"),
  photoPreview: document.querySelector("#photoPreview"),
};

let pendingPhotoBlob = null;
let pendingPhotoObjectUrl = null;
let kakaoReadyPromise = null;

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

  const reason = elements.note.value.trim();
  if (!reason) {
    elements.note.focus();
    setStatus("请填写推荐理由", isCloudMode ? "cloud" : "local");
    return;
  }

  setBusy(true);
  let imageUrl = "";
  try {
    if (pendingPhotoBlob) {
      if (!isCloudMode) {
        setStatus("本地模式下暂不支持图片，已忽略图片继续保存", "local");
      } else {
        setStatus("正在上传图片…", "cloud");
        imageUrl = await uploadFoodPhoto(pendingPhotoBlob);
      }
    }
  } catch (error) {
    setStatus(`图片上传失败：${error.message}`, "cloud");
    setBusy(false);
    return;
  }

  const place = {
    id: crypto.randomUUID(),
    name: elements.name.value.trim(),
    category: elements.category.value,
    dish: elements.dish.value.trim(),
    rating: Number(elements.rating.value || 0),
    price: Number(elements.price.value || 0),
    note: reason,
    lat: Number(selectedLatLng.lat.toFixed(6)),
    lng: Number(selectedLatLng.lng.toFixed(6)),
    image_url: imageUrl,
    idol_name: elements.idol.value.trim(),
  };

  await addPlace(place);
});

elements.search.addEventListener("input", render);
elements.filter.addEventListener("change", render);
elements.clearDraft.addEventListener("click", clearDraftLocation);

elements.addressSearchButton.addEventListener("click", () => runAddressSearch());
elements.addressSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runAddressSearch();
  }
});

elements.photo.addEventListener("change", () => {
  const file = elements.photo.files && elements.photo.files[0];
  setPendingPhoto(file || null);
});

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
    const existing = findSamePlace(place);
    let resultId;
    let merged = false;

    if (existing) {
      const updated = mergeFields(existing, place);
      if (isCloudMode) {
        const data = await db.updatePlace(existing.id, updated);
        replaceInPlaces(normalizePlace(data[0]));
      } else {
        replaceInPlaces({ ...existing, ...updated });
        saveLocalPlaces();
      }
      resultId = existing.id;
      merged = true;
    } else {
      if (isCloudMode) {
        const data = await db.insertPlaces({ ...place, submission_count: 1 });
        places = [normalizePlace(data[0]), ...places];
      } else {
        places = [{ ...place, submission_count: 1 }, ...places];
        saveLocalPlaces();
      }
      resultId = place.id;
    }

    elements.form.reset();
    elements.rating.value = "4.5";
    setPendingPhoto(null);
    clearDraftLocation();
    showAddressResults(null);
    render();
    focusPlace(resultId);

    const where = isCloudMode ? "云端" : "本地";
    const verb = merged ? "已合并评分到现有点" : "已保存";
    setStatus(`${verb}（${where}）`, isCloudMode ? "cloud" : "local");
  } catch (error) {
    setStatus(`添加失败：${error.message}`, isCloudMode ? "cloud" : "local");
  } finally {
    setBusy(false);
  }
}

function findSamePlace(candidate) {
  const target = (candidate.name || "").trim().toLowerCase();
  if (!target) return null;
  return places.find((place) => {
    if ((place.name || "").trim().toLowerCase() !== target) return false;
    return haversineMeters(place.lat, place.lng, candidate.lat, candidate.lng) <= MERGE_RADIUS_METERS;
  });
}

function mergeFields(existing, incoming) {
  const prevCount = Math.max(1, Number(existing.submission_count || 1));
  const newCount = prevCount + 1;

  const rating = roundTo(((existing.rating || 0) * prevCount + (incoming.rating || 0)) / newCount, 2);

  let price = existing.price || 0;
  if (incoming.price > 0) {
    price = existing.price > 0
      ? Math.round(((existing.price * prevCount) + incoming.price) / newCount)
      : incoming.price;
  }

  const image_url = existing.image_url && existing.image_url.length
    ? existing.image_url
    : (incoming.image_url || "");

  const idol_name = existing.idol_name && existing.idol_name.length
    ? existing.idol_name
    : (incoming.idol_name || "");

  return {
    rating,
    price,
    note: appendReason(existing.note, incoming.note),
    image_url,
    idol_name,
    submission_count: newCount,
  };
}

function appendReason(existing, incoming) {
  const next = (incoming || "").trim();
  const prev = (existing || "").trim();
  if (!next) return prev;
  const haystack = prev.toLowerCase();
  if (haystack.includes(next.toLowerCase())) return prev;
  const bullet = `• ${next}`;
  return prev ? `${prev}\n${bullet}` : bullet;
}

function replaceInPlaces(updated) {
  const idx = places.findIndex((place) => place.id === updated.id);
  if (idx === -1) {
    places = [updated, ...places];
    return;
  }
  const next = [...places];
  next[idx] = { ...next[idx], ...updated };
  places = next;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
    updatePlace(id, patch) {
      return request(`?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
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
    image_url: place.image_url || "",
    idol_name: place.idol_name || "",
    submission_count: Math.max(1, Number(place.submission_count || 1)),
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

async function runAddressSearch() {
  const query = elements.addressSearch.value.trim();
  if (!query) {
    showAddressResults(null);
    return;
  }

  elements.addressSearchButton.disabled = true;
  elements.addressSearchButton.textContent = "搜索中";

  try {
    const kakao = await ensureKakaoSdk();
    const results = kakao
      ? await kakaoKeywordSearch(kakao, query)
      : await nominatimSearch(query);
    showAddressResults(results);
  } catch (error) {
    showAddressResults(null, `搜索失败：${error.message}`);
  } finally {
    elements.addressSearchButton.disabled = false;
    elements.addressSearchButton.textContent = "搜索";
  }
}

function ensureKakaoSdk() {
  if (kakaoReadyPromise) return kakaoReadyPromise;
  const key = window.KAKAO_JS_KEY;
  if (!key) {
    kakaoReadyPromise = Promise.resolve(null);
    return kakaoReadyPromise;
  }

  kakaoReadyPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) {
        resolve(null);
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => resolve(null);
    document.head.append(script);
  });

  return kakaoReadyPromise;
}

function kakaoKeywordSearch(kakao, query) {
  return new Promise((resolve, reject) => {
    const places = new kakao.maps.services.Places();
    places.keywordSearch(query, (data, status) => {
      if (status === kakao.maps.services.Status.OK) {
        const adapted = data.slice(0, 8).map((item) => ({
          lat: Number(item.y),
          lon: Number(item.x),
          name: item.place_name,
          display_name: item.road_address_name || item.address_name,
          extra: item.category_name,
        }));
        resolve(adapted);
        return;
      }
      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
        return;
      }
      reject(new Error(`Kakao 错误：${status}`));
    });
  });
}

async function nominatimSearch(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "6",
    addressdetails: "1",
    namedetails: "1",
    "accept-language": "ko,zh-CN,en",
    countrycodes: "kr",
  });
  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function showAddressResults(results, errorMessage) {
  elements.addressResults.innerHTML = "";

  if (errorMessage) {
    const empty = document.createElement("div");
    empty.className = "address-results-empty";
    empty.textContent = errorMessage;
    elements.addressResults.append(empty);
    elements.addressResults.hidden = false;
    return;
  }

  if (!results || !results.length) {
    elements.addressResults.hidden = true;
    return;
  }

  results.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "address-result";

    const title = document.createElement("span");
    title.className = "address-result-title";
    title.textContent = pickResultName(item);

    const meta = document.createElement("span");
    meta.className = "address-result-meta";
    const metaParts = [item.extra, item.display_name].filter(Boolean);
    meta.textContent = metaParts.join(" · ");

    button.append(title, meta);
    button.addEventListener("click", () => pickAddressResult(item));
    elements.addressResults.append(button);
  });

  elements.addressResults.hidden = false;
}

function pickResultName(item) {
  const named = item.namedetails && (item.namedetails.name || item.namedetails["name:ko"]);
  if (named) return named;
  if (item.name) return item.name;
  if (item.display_name) return item.display_name.split(",")[0].trim();
  return "未命名地点";
}

function pickAddressResult(item) {
  const latlng = { lat: Number(item.lat), lng: Number(item.lon) };
  setDraftLocation(latlng);
  map.setView(latlng, Math.max(map.getZoom(), 16));

  if (!elements.name.value.trim()) {
    elements.name.value = pickResultName(item);
  }

  elements.addressResults.hidden = true;
  elements.name.focus();
}

function setPendingPhoto(file) {
  if (pendingPhotoObjectUrl) {
    URL.revokeObjectURL(pendingPhotoObjectUrl);
    pendingPhotoObjectUrl = null;
  }

  if (!file) {
    pendingPhotoBlob = null;
    elements.photoPreview.innerHTML = "";
    elements.photoPreview.hidden = true;
    return;
  }

  pendingPhotoBlob = file;
  pendingPhotoObjectUrl = URL.createObjectURL(file);
  elements.photoPreview.innerHTML = "";
  const img = document.createElement("img");
  img.src = pendingPhotoObjectUrl;
  img.alt = "待上传图片预览";
  elements.photoPreview.append(img);
  elements.photoPreview.hidden = false;
}

async function uploadFoodPhoto(file) {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey) {
    throw new Error("缺少 Supabase 配置");
  }

  const blob = await resizeImageToBlob(file, PHOTO_MAX_DIM, PHOTO_QUALITY);
  const path = `${crypto.randomUUID()}.jpg`;
  const endpoint = `${config.url.replace(/\/$/, "")}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": blob.type || "image/jpeg",
      "x-upsert": "false",
    },
    body: blob,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  return `${config.url.replace(/\/$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

function resizeImageToBlob(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            blob ? resolve(blob) : reject(new Error("无法生成图片数据"));
          },
          "image/jpeg",
          quality,
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取图片"));
    };
    img.src = objectUrl;
  });
}

function render() {
  renderMarkers();
  renderList();
  elements.count.textContent = places.length;
}

function getFilteredPlaces() {
  const query = elements.search.value.trim().toLowerCase();
  const filter = elements.filter.value;

  return places.filter((place) => {
    let matchesFilter;
    if (filter === "all") {
      matchesFilter = true;
    } else if (filter === "__idol__") {
      matchesFilter = Boolean(place.idol_name && place.idol_name.length);
    } else {
      matchesFilter = place.category === filter;
    }
    const searchable = [place.name, place.category, place.dish, place.note, place.idol_name]
      .join(" ")
      .toLowerCase();
    return matchesFilter && searchable.includes(query);
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
        ${place.image_url ? `<img class="map-popup-image" src="${escapeHtml(place.image_url)}" alt="${escapeHtml(place.name)}" loading="lazy" />` : ""}
        ${place.idol_name ? `<span class="map-popup-idol">★ ${escapeHtml(place.idol_name)} 同款</span>` : ""}
        <strong>${escapeHtml(place.name)}</strong>
        <span>${escapeHtml(place.category)} · ${formatRating(place.rating)}${formatCount(place.submission_count)} · ${formatPrice(place.price)}</span>
        <span class="map-popup-reason">${escapeHtml(place.note || "暂无推荐理由")}</span>
        ${place.dish ? `<span class="map-popup-dish">推荐菜：${escapeHtml(place.dish)}</span>` : ""}
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
    const thumb = card.querySelector(".place-thumb");
    if (place.image_url) {
      thumb.style.backgroundImage = `url(${JSON.stringify(place.image_url)})`;
      thumb.dataset.empty = "false";
    } else {
      thumb.style.backgroundImage = "";
      thumb.dataset.empty = "true";
    }
    const idolEl = card.querySelector(".place-idol");
    if (place.idol_name) {
      idolEl.textContent = `★ ${place.idol_name} 同款`;
      idolEl.hidden = false;
    } else {
      idolEl.hidden = true;
    }
    card.querySelector(".place-title").textContent = place.name;
    card.querySelector(".place-meta").textContent =
      `${place.category} · ${formatRating(place.rating)}${formatCount(place.submission_count)} · ${formatPrice(place.price)}`;
    card.querySelector(".place-note").textContent = place.note || "暂无推荐理由";

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
  return rating ? `${rating.toFixed(2)}分` : "未评分";
}

function formatCount(count) {
  const n = Number(count || 1);
  return n > 1 ? `（${n}人）` : "";
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
