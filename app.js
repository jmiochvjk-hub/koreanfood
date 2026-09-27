const FAVORITES_KEY = "banfan.catalog.favorites";
const REVIEWS_KEY = "banfan.catalog.reviews";
const SUPABASE_TABLE = "food_places";
const CATALOG_VIEW = "catalog_item_cards";
const PAGE_SIZE = 24;

const channelCatalog = {
  food: {
    eyebrow: "FOOD / 美食",
    title: "韩国美食品目",
    description: "先看已有品目，再决定吃什么、买什么、去哪里。",
    filters: ["全部", "韩餐", "烤肉", "街头小吃", "咖啡甜品", "海鲜"],
    glyph: "食",
  },
  beauty: {
    eyebrow: "BEAUTY / 美妆",
    title: "韩国美妆品目",
    description: "按肤质、功效和预算浏览，不再面对一整面热销墙盲买。",
    filters: ["全部", "Olive Young", "护肤", "彩妆", "防晒", "发护"],
    glyph: "妆",
  },
  life: {
    eyebrow: "LIFE / 生活",
    title: "韩国生活品目",
    description: "Daiso、便利店、家居与文具，旅行和长期生活都能查。",
    filters: ["全部", "Daiso", "便利店", "家居", "文具"],
    glyph: "物",
  },
  fashion: {
    eyebrow: "FASHION / 潮流",
    title: "韩国潮流品目",
    description: "用风格、预算和使用场景筛选品牌与单品。",
    filters: ["全部", "韩国品牌", "基础款", "鞋包", "配饰"],
    glyph: "潮",
  },
};

// 非美食频道先用“品目货架”建立结构，不伪造具体商品评分。
// 后续批量导入 catalog_items 后，用同一字段替换即可。
const catalogShelves = {
  beauty: [
    makeShelf("beauty-oy", "Olive Young 全品目", "Olive Young", "门店常见商品统一入库，按成分、功效和价格筛选。", "OY"),
    makeShelf("beauty-skin", "护肤品目库", "护肤", "洁面、化妆水、精华、面霜与面膜。", "肤"),
    makeShelf("beauty-makeup", "彩妆品目库", "彩妆", "底妆、眼妆、唇妆与工具。", "彩"),
    makeShelf("beauty-sun", "防晒品目库", "防晒", "记录防护力、肤感、搓泥与是否适合敏感肌。", "晒"),
    makeShelf("beauty-hair", "头皮与发护", "发护", "洗护、染烫修护与头皮护理。", "发"),
  ],
  life: [
    makeShelf("life-daiso", "Daiso 全品目", "Daiso", "价格、用途、耐用度与门店库存线索。", "D"),
    makeShelf("life-cvs", "便利店生活品目", "便利店", "旅行应急、日用品与季节限定。", "便"),
    makeShelf("life-home", "家居与收纳", "家居", "租房入住、清洁、收纳与长期补货。", "家"),
    makeShelf("life-stationery", "文具与手账", "文具", "纸张、笔类、贴纸与韩国限定。", "文"),
  ],
  fashion: [
    makeShelf("fashion-brand", "韩国品牌索引", "韩国品牌", "按风格、价位和线下门店浏览品牌。", "牌"),
    makeShelf("fashion-basic", "基础款品目", "基础款", "T恤、衬衫、针织与适合通勤的基础单品。", "基"),
    makeShelf("fashion-bag", "鞋包品目", "鞋包", "记录尺码、脚感、容量和真实使用体验。", "包"),
    makeShelf("fashion-accessory", "配饰品目", "配饰", "眼镜、帽子、首饰与季节单品。", "饰"),
  ],
};

function makeShelf(id, title, category, note, glyph) {
  return { id, title, category, note, glyph, rating: 0, reviewCount: 0, kind: "shelf" };
}

const elements = {
  search: document.querySelector("#searchInput"),
  channelTriggers: document.querySelectorAll("button[data-channel]"),
  eyebrow: document.querySelector("#channelEyebrow"),
  title: document.querySelector("#channelTitle"),
  description: document.querySelector("#channelDescription"),
  syncStatus: document.querySelector("#syncStatus"),
  count: document.querySelector("#itemCount"),
  filters: document.querySelector("#filterChips"),
  sort: document.querySelector("#sortSelect"),
  foodViewSwitch: document.querySelector("#foodViewSwitch"),
  foodMapPanel: document.querySelector("#foodMapPanel"),
  mapStatus: document.querySelector("#mapStatus"),
  startAddPlace: document.querySelector("#startAddPlaceButton"),
  addPlaceBar: document.querySelector("#addPlaceBar"),
  coordinateText: document.querySelector("#coordinateText"),
  placeName: document.querySelector("#placeNameInput"),
  placeCategory: document.querySelector("#placeCategoryInput"),
  placeNote: document.querySelector("#placeNoteInput"),
  savePlace: document.querySelector("#savePlaceButton"),
  cancelAddPlace: document.querySelector("#cancelAddPlaceButton"),
  grid: document.querySelector("#catalogGrid"),
  empty: document.querySelector("#catalogEmpty"),
  more: document.querySelector("#catalogMore"),
  loadMore: document.querySelector("#loadMoreButton"),
  template: document.querySelector("#catalogCardTemplate"),
  favorites: document.querySelector("#openFavoritesButton"),
  openReview: document.querySelector("#openReviewButton"),
  mobileReview: document.querySelector("#mobileReviewButton"),
  modal: document.querySelector("#reviewModal"),
  backdrop: document.querySelector("#modalBackdrop"),
  closeReview: document.querySelector("#closeReviewButton"),
  form: document.querySelector("#reviewForm"),
  itemInput: document.querySelector("#reviewItemInput"),
  suggestions: document.querySelector("#catalogSuggestions"),
  rating: document.querySelector("#reviewRating"),
  photo: document.querySelector("#reviewPhoto"),
  photoPreview: document.querySelector("#reviewPhotoPreview"),
  reviewText: document.querySelector("#reviewText"),
  missingItem: document.querySelector("#missingItemButton"),
  detailModal: document.querySelector("#detailModal"),
  detailBackdrop: document.querySelector("#detailBackdrop"),
  closeDetail: document.querySelector("#closeDetailButton"),
  detailImage: document.querySelector("#detailImage"),
  detailCategory: document.querySelector("#detailCategory"),
  detailTitle: document.querySelector("#detailTitle"),
  detailOriginal: document.querySelector("#detailOriginal"),
  detailNote: document.querySelector("#detailNote"),
  detailRating: document.querySelector("#detailRating"),
  detailReviewCount: document.querySelector("#detailReviewCount"),
  detailFavorite: document.querySelector("#detailFavoriteButton"),
  detailReview: document.querySelector("#detailReviewButton"),
  detailSource: document.querySelector("#detailSourceLink"),
  detailReviewSummary: document.querySelector("#detailReviewSummary"),
  detailReviewList: document.querySelector("#detailReviewList"),
  toast: document.querySelector("#toast"),
};

let currentChannel = "food";
let activeFilter = "全部";
let cloudFoodItems = [];
let cloudCatalogItems = { beauty: [], life: [], fashion: [] };
let favoriteIds = loadSet(FAVORITES_KEY);
let localReviews = loadArray(REVIEWS_KEY);
let favoritesOnly = false;
let selectedItemId = null;
let toastTimer = null;
let photoObjectUrls = [];
let detailItem = null;
let foodView = "list";
let map = null;
let kakaoSdk = null;
let mapLoadPromise = null;
let mapOverlays = [];
let activeMapPopup = null;
let addingPlace = false;
let selectedCoordinates = null;
let draftOverlay = null;
let visibleLimit = PAGE_SIZE;

elements.channelTriggers.forEach((entry) => {
  entry.addEventListener("click", () => switchChannel(entry.dataset.channel));
});
elements.search.addEventListener("input", () => resetAndRender());
elements.sort.addEventListener("change", () => resetAndRender());
elements.loadMore.addEventListener("click", () => {
  visibleLimit += PAGE_SIZE;
  render();
});
elements.foodViewSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) showFoodView(button.dataset.view);
});
elements.startAddPlace.addEventListener("click", startAddingPlace);
elements.cancelAddPlace.addEventListener("click", cancelAddingPlace);
elements.savePlace.addEventListener("click", saveNewPlace);
elements.filters.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-chip");
  if (!button) return;
  activeFilter = button.dataset.filter;
  favoritesOnly = false;
  visibleLimit = PAGE_SIZE;
  renderFilters();
  render();
});
elements.favorites.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  visibleLimit = PAGE_SIZE;
  elements.favorites.textContent = favoritesOnly ? "♥ 只看收藏" : "♡ 收藏";
  render();
  document.querySelector(".catalog-section").scrollIntoView({ behavior: "smooth" });
});
elements.openReview.addEventListener("click", () => openReviewModal());
elements.mobileReview.addEventListener("click", () => openReviewModal());
elements.closeReview.addEventListener("click", closeReviewModal);
elements.backdrop.addEventListener("click", closeReviewModal);
elements.closeDetail.addEventListener("click", closeDetailModal);
elements.detailBackdrop.addEventListener("click", closeDetailModal);
elements.detailFavorite.addEventListener("click", () => {
  if (!detailItem) return;
  toggleFavorite(detailItem.id);
  syncDetailFavorite();
});
elements.detailReview.addEventListener("click", () => {
  if (!detailItem) return;
  const item = detailItem;
  closeDetailModal();
  openReviewModal(item);
});
elements.photo.addEventListener("change", previewPhoto);
elements.missingItem.addEventListener("click", () => {
  showToast("缺少品目会进入平台审核队列，不会直接创建重复条目。");
});
elements.form.addEventListener("submit", saveReview);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!elements.modal.hidden) closeReviewModal();
  else if (!elements.detailModal.hidden) closeDetailModal();
});

async function init() {
  renderFilters();
  render();
  await Promise.all([loadFoodItems(), loadCatalogItems()]);
  render();
}

function supabaseHeaders() {
  const config = window.SUPABASE_CONFIG || {};
  return { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` };
}

async function loadFoodItems() {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes("YOUR_PROJECT_REF")) {
    elements.syncStatus.textContent = "品目库尚未连接";
    return;
  }

  elements.syncStatus.textContent = "正在读取云端品目...";
  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/${SUPABASE_TABLE}?select=*&order=created_at.desc`;
  try {
    const response = await fetch(endpoint, {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    cloudFoodItems = rows.map(mapFoodPlace);
    elements.syncStatus.textContent = "云端品目已连接";
    if (map) drawFoodMarkers();
  } catch (error) {
    elements.syncStatus.textContent = "云端暂时不可用";
    console.error("[catalog] load failed", error);
  }
}

async function loadCatalogItems() {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes("YOUR_PROJECT_REF")) return;

  const fields = [
    "id", "channel", "item_type", "name_zh", "name_ko", "name_en",
    "hero_image_url", "price_krw", "attributes", "brand_name_zh",
    "brand_name_ko", "category_name_zh", "rating_average", "review_count",
  ].join(",");
  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/${CATALOG_VIEW}?select=${fields}&channel=in.(beauty,life,fashion)&limit=1000`;

  try {
    const response = await fetch(endpoint, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    cloudCatalogItems = { beauty: [], life: [], fashion: [] };
    rows.map(mapCatalogItem).forEach((item) => {
      if (cloudCatalogItems[item.channel]) cloudCatalogItems[item.channel].push(item);
    });
    Object.values(cloudCatalogItems).forEach((items) => {
      items.sort((a, b) => a.featuredOrder - b.featuredOrder);
    });
    if (currentChannel !== "food") updateSyncStatus();
  } catch (error) {
    console.error("[catalog] product load failed", error);
    if (currentChannel !== "food") elements.syncStatus.textContent = "商品库暂时不可用";
  }
}

function mapCatalogItem(item) {
  const attributes = item.attributes && typeof item.attributes === "object" ? item.attributes : {};
  const brand = item.brand_name_zh || item.brand_name_ko || "品牌待补";
  const price = Number(item.price_krw || 0);
  const listOrder = { overall: 0, skincare: 1000, makeup: 2000 }[attributes.source_list] ?? 3000;
  return {
    id: String(item.id),
    channel: item.channel,
    title: item.name_zh || item.name_ko || item.name_en || "未命名商品",
    originalName: item.name_zh && item.name_ko ? item.name_ko : "",
    searchText: [item.name_zh, item.name_ko, item.name_en, item.brand_name_zh, item.brand_name_ko].filter(Boolean).join(" "),
    category: item.category_name_zh || "其他",
    note: `${brand}${price ? ` · ₩${price.toLocaleString("ko-KR")}` : ""}`,
    brand,
    price,
    glyph: brand.slice(0, 1),
    rating: Number(item.rating_average || 0),
    reviewCount: Math.max(0, Number(item.review_count || 0)),
    imageUrl: item.hero_image_url || "",
    sourceUrl: attributes.source_url || "",
    featuredOrder: listOrder + Number(attributes.source_rank || 999),
    kind: "product",
  };
}

function mapFoodPlace(place) {
  return {
    id: String(place.id),
    title: place.name || "未命名品目",
    category: place.category || "美食",
    note: place.note || place.dish || "等待第一条真实体验。",
    brand: place.category || "韩国美食",
    price: Number(place.price || 0),
    glyph: (place.category || "食").slice(0, 1),
    rating: Number(place.rating || 0),
    reviewCount: Math.max(0, Number(place.submission_count || 0)),
    imageUrl: place.image_url || "",
    lat: Number(place.lat),
    lng: Number(place.lng),
    kind: "place",
  };
}

function switchChannel(channel) {
  if (!channelCatalog[channel]) return;
  currentChannel = channel;
  activeFilter = "全部";
  visibleLimit = PAGE_SIZE;
  favoritesOnly = false;
  document.body.dataset.channel = channel;
  elements.search.value = "";
  elements.favorites.textContent = "♡ 收藏";
  elements.channelTriggers.forEach((entry) => {
    entry.classList.toggle("is-active", entry.dataset.channel === channel);
  });
  const config = channelCatalog[channel];
  elements.eyebrow.textContent = config.eyebrow;
  elements.title.textContent = config.title;
  elements.description.textContent = config.description;
  updateSyncStatus();
  elements.foodViewSwitch.hidden = channel !== "food";
  if (channel !== "food") {
    foodView = "list";
    elements.foodMapPanel.hidden = true;
  }
  renderFilters();
  render();
  document.querySelector(".catalog-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateSyncStatus() {
  if (currentChannel === "food") {
    elements.syncStatus.textContent = cloudFoodItems.length ? "云端地点已连接" : "正在读取地点...";
    return;
  }
  const count = cloudCatalogItems[currentChannel]?.length || 0;
  elements.syncStatus.textContent = count ? `云端商品库 · ${count} 件` : "该频道等待首批导入";
}

function renderFilters() {
  const filters = channelCatalog[currentChannel].filters;
  elements.filters.innerHTML = filters.map((filter) =>
    `<button type="button" class="filter-chip${filter === activeFilter ? " is-active" : ""}" data-filter="${escapeHtml(filter)}">${escapeHtml(filter)}</button>`
  ).join("");
}

function currentItems() {
  const imported = cloudCatalogItems[currentChannel] || [];
  const source = currentChannel === "food" ? cloudFoodItems : (imported.length ? imported : catalogShelves[currentChannel] || []);
  const query = elements.search.value.trim().toLowerCase();
  const reviewed = applyLocalReviewStats(source);
  let items = reviewed.filter((item) => {
    if (favoritesOnly && !favoriteIds.has(item.id)) return false;
    if (activeFilter !== "全部" && item.category !== activeFilter) return false;
    return [item.title, item.category, item.note, item.searchText || ""].join(" ").toLowerCase().includes(query);
  });
  const sort = elements.sort.value;
  if (sort === "rating") items.sort((a, b) => b.rating - a.rating);
  if (sort === "reviewed") items.sort((a, b) => b.reviewCount - a.reviewCount);
  return items;
}

function resetAndRender() {
  visibleLimit = PAGE_SIZE;
  render();
}

function applyLocalReviewStats(items) {
  return items.map((item) => {
    const reviews = localReviews.filter((review) => review.itemId === item.id);
    if (!reviews.length) return { ...item };
    const baseCount = Number(item.reviewCount || 0);
    const baseTotal = Number(item.rating || 0) * baseCount;
    const localTotal = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return {
      ...item,
      rating: (baseTotal + localTotal) / (baseCount + reviews.length),
      reviewCount: baseCount + reviews.length,
    };
  });
}

function render() {
  const items = currentItems();
  elements.count.textContent = items.length;
  elements.grid.innerHTML = "";
  elements.empty.hidden = items.length > 0;
  const visibleItems = items.slice(0, visibleLimit);

  visibleItems.forEach((item, index) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const visual = card.querySelector(".card-visual");
    const image = card.querySelector(".card-image");
    card.querySelector(".card-index").textContent = String(index + 1).padStart(2, "0");
    card.querySelector(".card-glyph").textContent = item.glyph || channelCatalog[currentChannel].glyph;
    if (item.imageUrl) {
      visual.classList.add("has-image");
      image.src = item.imageUrl;
      image.alt = `${item.title} 商品图`;
      image.hidden = false;
      image.addEventListener("error", () => {
        image.hidden = true;
        visual.classList.remove("has-image");
      }, { once: true });
    }
    card.dataset.kind = item.kind;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看 ${item.title} 详情`);
    card.querySelector(".card-category").textContent = item.category.toUpperCase();
    card.querySelector(".card-title").textContent = item.title;
    const originalName = card.querySelector(".card-original");
    if (item.originalName) {
      originalName.textContent = item.originalName;
      originalName.hidden = false;
    }
    card.querySelector(".card-note").textContent = item.note;
    card.querySelector(".card-rating").textContent = item.rating ? `★ ${item.rating.toFixed(1)}` : "等待首评";
    card.querySelector(".card-reviews").textContent = item.reviewCount ? `${item.reviewCount} 条体验` : "0 条体验";

    const favorite = card.querySelector(".card-favorite");
    favorite.dataset.active = String(favoriteIds.has(item.id));
    favorite.textContent = favoriteIds.has(item.id) ? "♥" : "♡";
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(item.id);
    });
    if (item.kind === "shelf") {
      card.addEventListener("click", () => showToast("这个货架已经开放；具体品目批量导入后会直接出现在这里。"));
    } else {
      card.addEventListener("click", () => openDetailModal(item));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetailModal(item);
        }
      });
    }
    elements.grid.append(card);
    if (index === 7 && currentChannel !== "food") elements.grid.append(createFeedAd());
  });
  const hasMore = currentChannel !== "food" && visibleItems.length < items.length;
  elements.more.hidden = !hasMore;
  elements.loadMore.textContent = hasMore ? `继续加载 · ${visibleItems.length} / ${items.length}` : "继续加载";
  refreshSuggestions();
  syncFoodViewVisibility();
}

function showFoodView(view) {
  if (currentChannel !== "food") return;
  foodView = view === "map" ? "map" : "list";
  elements.foodViewSwitch.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === foodView);
  });
  syncFoodViewVisibility();
  if (foodView === "map") {
    loadFoodMap();
    elements.foodMapPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function syncFoodViewVisibility() {
  const showMap = currentChannel === "food" && foodView === "map";
  elements.foodMapPanel.hidden = !showMap;
  elements.grid.hidden = showMap;
  if (showMap) elements.more.hidden = true;
  if (showMap) elements.empty.hidden = true;
}

async function loadFoodMap() {
  if (map) {
    setTimeout(() => map.relayout(), 0);
    drawFoodMarkers();
    return;
  }
  elements.mapStatus.textContent = "正在加载韩国地图...";
  try {
    kakaoSdk = await ensureKakaoSdk();
    if (!kakaoSdk) throw new Error("Kakao Maps 未加载");
    map = new kakaoSdk.maps.Map(document.querySelector("#map"), {
      center: new kakaoSdk.maps.LatLng(37.5665, 126.978),
      level: 8,
    });
    const zoomControl = new kakaoSdk.maps.ZoomControl();
    map.addControl(zoomControl, kakaoSdk.maps.ControlPosition.RIGHT);
    kakaoSdk.maps.event.addListener(map, "click", (event) => {
      if (!addingPlace) return;
      selectPlaceCoordinates(event.latLng.getLat(), event.latLng.getLng());
    });
    elements.mapStatus.textContent = "当前使用韩国地图 · 国内网络失败时仍可使用榜单";
    drawFoodMarkers();
  } catch (error) {
    elements.mapStatus.textContent = "当前网络无法加载地图，请先使用榜单";
    document.querySelector("#map").innerHTML = '<div class="catalog-empty"><strong>地图暂时不可用</strong><span>地点数据没有丢失。中国网页与小程序版将接入独立地图服务。</span></div>';
    console.error("[map] load failed", error);
  }
}

function ensureKakaoSdk() {
  if (mapLoadPromise) return mapLoadPromise;
  if (!window.KAKAO_JS_KEY) return Promise.resolve(null);
  mapLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(window.KAKAO_JS_KEY)}&libraries=services&autoload=false`;
    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) return resolve(null);
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  return mapLoadPromise;
}

function drawFoodMarkers() {
  if (!map || !kakaoSdk) return;
  mapOverlays.forEach((overlay) => overlay.setMap(null));
  mapOverlays = [];
  cloudFoodItems.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)).forEach((item) => {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "banfan-pin";
    pin.innerHTML = `<span>${escapeHtml(item.category.slice(0, 1))}</span>`;
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      openMapPopup(item);
    });
    const overlay = new kakaoSdk.maps.CustomOverlay({
      position: new kakaoSdk.maps.LatLng(item.lat, item.lng),
      content: pin,
      xAnchor: .5,
      yAnchor: 1,
      clickable: true,
    });
    overlay.setMap(map);
    mapOverlays.push(overlay);
  });
}

function openMapPopup(item) {
  if (!map || !kakaoSdk) return;
  if (activeMapPopup) activeMapPopup.setMap(null);
  const popup = document.createElement("div");
  popup.className = "map-popup";
  popup.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${item.rating ? `★ ${item.rating.toFixed(1)}` : "等待首评"}</span>`;
  activeMapPopup = new kakaoSdk.maps.CustomOverlay({
    position: new kakaoSdk.maps.LatLng(item.lat, item.lng),
    content: popup,
    xAnchor: .5,
    yAnchor: 1.35,
    clickable: true,
    zIndex: 900,
  });
  activeMapPopup.setMap(map);
}

function startAddingPlace() {
  addingPlace = true;
  selectedCoordinates = null;
  elements.addPlaceBar.hidden = false;
  elements.mapStatus.hidden = true;
  elements.coordinateText.textContent = "尚未选择坐标";
  showToast("请在地图上点一下新地点的位置。");
}

function cancelAddingPlace() {
  addingPlace = false;
  selectedCoordinates = null;
  elements.addPlaceBar.hidden = true;
  elements.mapStatus.hidden = false;
  elements.placeName.value = "";
  elements.placeNote.value = "";
  if (draftOverlay) draftOverlay.setMap(null);
  draftOverlay = null;
}

function selectPlaceCoordinates(lat, lng) {
  selectedCoordinates = { lat, lng };
  elements.coordinateText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (draftOverlay) draftOverlay.setMap(null);
  const pin = document.createElement("div");
  pin.className = "banfan-pin";
  pin.innerHTML = "<span>＋</span>";
  draftOverlay = new kakaoSdk.maps.CustomOverlay({
    position: new kakaoSdk.maps.LatLng(lat, lng),
    content: pin,
    xAnchor: .5,
    yAnchor: 1,
  });
  draftOverlay.setMap(map);
  elements.placeName.focus();
}

async function saveNewPlace() {
  const name = elements.placeName.value.trim();
  const note = elements.placeNote.value.trim();
  if (!selectedCoordinates) return showToast("请先在地图上选择位置。");
  if (!name || !note) return showToast("请填写地点名称和一句真实推荐理由。");
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey) return showToast("云端尚未连接，暂时不能保存地点。");

  elements.savePlace.disabled = true;
  const payload = {
    id: crypto.randomUUID(),
    name,
    category: elements.placeCategory.value,
    dish: "",
    rating: 0,
    price: 0,
    note,
    lat: Number(selectedCoordinates.lat.toFixed(6)),
    lng: Number(selectedCoordinates.lng.toFixed(6)),
    image_url: "",
    idol_name: "",
    contributors: [getDeviceId()],
    submission_count: 0,
  };
  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${SUPABASE_TABLE}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    cloudFoodItems.unshift(mapFoodPlace(rows[0] || payload));
    cancelAddingPlace();
    drawFoodMarkers();
    render();
    showToast("新地点已加入美食地图。");
  } catch (error) {
    showToast("地点保存失败，请稍后再试。");
    console.error("[map] insert failed", error);
  } finally {
    elements.savePlace.disabled = false;
  }
}

function getDeviceId() {
  const key = "banfan.device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function toggleFavorite(id) {
  if (favoriteIds.has(id)) favoriteIds.delete(id);
  else favoriteIds.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]));
  render();
}

function createFeedAd() {
  const ad = document.createElement("aside");
  ad.className = "catalog-ad ad-slot";
  ad.dataset.adPlacement = `${currentChannel}-feed`;
  ad.innerHTML = `
    <span class="ad-label">SPONSORED · 品牌合作</span>
    <div><strong>新品和品牌故事</strong><p>以后每 8–12 件商品最多出现一个，并始终明确标注。</p></div>
    <small>合作位暂未开放</small>`;
  return ad;
}

function openDetailModal(item) {
  detailItem = item;
  elements.detailCategory.textContent = `${channelCatalog[item.channel || currentChannel]?.eyebrow || "BANFAN"} · ${item.category}`;
  elements.detailTitle.textContent = item.title;
  elements.detailOriginal.textContent = item.originalName || "";
  elements.detailOriginal.hidden = !item.originalName;
  elements.detailNote.textContent = item.note;
  elements.detailRating.textContent = item.rating ? `★ ${item.rating.toFixed(1)}` : "等待首评";
  elements.detailReviewCount.textContent = item.reviewCount ? `${item.reviewCount} 条体验` : "还没有评价";
  elements.detailImage.src = item.imageUrl || "";
  elements.detailImage.alt = item.imageUrl ? `${item.title} 官方商品图` : "";
  elements.detailImage.parentElement.classList.toggle("has-image", Boolean(item.imageUrl));
  elements.detailImage.hidden = !item.imageUrl;
  elements.detailSource.href = item.sourceUrl || "#";
  elements.detailSource.hidden = !item.sourceUrl;
  syncDetailFavorite();
  renderDetailReviews(item);
  elements.detailModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDetailModal() {
  elements.detailModal.hidden = true;
  document.body.classList.remove("modal-open");
  detailItem = null;
}

function syncDetailFavorite() {
  if (!detailItem) return;
  const active = favoriteIds.has(detailItem.id);
  elements.detailFavorite.textContent = active ? "♥ 已收藏" : "♡ 收藏";
  elements.detailFavorite.dataset.active = String(active);
}

function renderDetailReviews(item) {
  const reviews = localReviews.filter((review) => review.itemId === item.id);
  elements.detailReviewSummary.textContent = reviews.length ? `${reviews.length} 条当前设备评价` : "等待第一条真实体验";
  if (!reviews.length) {
    elements.detailReviewList.innerHTML = '<div class="review-empty"><strong>还没有带图评价</strong><p>用过或吃过之后，上传实拍并留下第一条真实体验。</p></div>';
    return;
  }
  elements.detailReviewList.innerHTML = reviews.map((review) => `
    <article class="detail-review-card">
      <div><strong>★ ${Number(review.rating).toFixed(1)}</strong><span>${formatDate(review.createdAt)}</span></div>
      <p>${escapeHtml(review.text)}</p>
      <small>${review.hasPhoto ? "已提交实拍照片 · 云端上传接入后显示" : "无照片"}</small>
    </article>`).join("");
}

function formatDate(value) {
  try { return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value)); }
  catch { return "刚刚"; }
}

function openReviewModal(item = null) {
  const available = allCatalogItems();
  if (!available.length) {
    showToast("品目正在导入，完成后才能绑定评价。");
    return;
  }
  selectedItemId = item ? item.id : null;
  elements.itemInput.value = item ? item.title : "";
  elements.modal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => elements.itemInput.focus(), 0);
}

function closeReviewModal() {
  elements.modal.hidden = true;
  document.body.classList.remove("modal-open");
  selectedItemId = null;
  clearPhotoPreview();
  elements.form.reset();
  elements.rating.value = "5";
}

function saveReview(event) {
  event.preventDefault();
  const title = elements.itemInput.value.trim();
  const item = allCatalogItems().find((candidate) => candidate.title.toLowerCase() === title.toLowerCase());
  if (!item) {
    showToast("请从已有品目中选择；搜不到时提交“缺少品目”。");
    elements.itemInput.focus();
    return;
  }
  if (!elements.photo.files || !elements.photo.files.length) {
    showToast("带图评价至少需要 1 张实拍照片。 ");
    elements.photo.focus();
    return;
  }
  localReviews.unshift({
    id: crypto.randomUUID(),
    itemId: item.id,
    rating: Number(elements.rating.value),
    text: elements.reviewText.value.trim(),
    hasPhoto: true,
    photoCount: Math.min(elements.photo.files.length, 6),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(localReviews));
  closeReviewModal();
  render();
  showToast("评价已保存到当前设备；账号和云端同步将在后端改造后接入。");
}

function previewPhoto() {
  clearPhotoPreview();
  const files = [...(elements.photo.files || [])];
  if (!files.length) return;
  if (files.length > 6) {
    elements.photo.value = "";
    showToast("一次最多上传 6 张照片。 ");
    return;
  }
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    photoObjectUrls.push(url);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `待发布照片预览 ${index + 1}`;
    elements.photoPreview.append(image);
  });
  elements.photoPreview.hidden = false;
}

function clearPhotoPreview() {
  photoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  photoObjectUrls = [];
  elements.photoPreview.innerHTML = "";
  elements.photoPreview.hidden = true;
}

function refreshSuggestions() {
  elements.suggestions.innerHTML = allCatalogItems()
    .map((item) => `<option value="${escapeHtml(item.title)}"></option>`)
    .join("");
}

function allCatalogItems() {
  return [...cloudFoodItems, ...Object.values(cloudCatalogItems).flat()];
}

function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
}

function loadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3200);
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
