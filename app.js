const FAVORITES_KEY = "banfan.catalog.favorites";
const REVIEWS_KEY = "banfan.catalog.reviews";
const AUTH_SESSION_KEY = "banfan.auth.session";
const SUPABASE_TABLE = "food_places";
const CATALOG_VIEW = "catalog_item_cards";
const PAGE_SIZE = 24;

const channelCatalog = {
  food: {
    eyebrow: "美食 · FOOD",
    title: "在韩国，今天吃什么",
    description: "先看已有品目，再决定吃什么、买什么、去哪里。",
    filters: ["全部", "韩餐", "烤肉", "街头小吃", "咖啡甜品", "海鲜"],
    glyph: "食",
  },
  beauty: {
    eyebrow: "美妆 · BEAUTY",
    title: "值得带走的韩国美妆",
    description: "按肤质、功效和预算浏览，不再面对一整面热销墙盲买。",
    filters: ["全部", "Olive Young", "护肤", "彩妆", "防晒", "发护"],
    glyph: "妆",
  },
  life: {
    eyebrow: "生活 · LIFE",
    title: "旅行和生活都用得上",
    description: "Daiso、便利店、家居与文具，旅行和长期生活都能查。",
    filters: ["全部", "Daiso", "便利店", "家居", "文具"],
    glyph: "物",
  },
  fashion: {
    eyebrow: "潮流 · FASHION",
    title: "从品牌开始认识韩国风格",
    description: "用风格、预算和使用场景筛选品牌与单品。",
    filters: ["全部", "韩国品牌", "基础款", "鞋包", "配饰"],
    glyph: "潮",
  },
};

const elements = {
  search: document.querySelector("#searchInput"),
  channelTriggers: document.querySelectorAll("button[data-channel]"),
  eyebrow: document.querySelector("#channelEyebrow"),
  title: document.querySelector("#channelTitle"),
  description: document.querySelector("#channelDescription"),
  syncStatus: document.querySelector("#syncStatus"),
  count: document.querySelector("#itemCount"),
  filters: document.querySelector("#filterChips"),
  toolbar: document.querySelector("#catalogToolbar"),
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
  loading: document.querySelector("#catalogLoading"),
  catalogSection: document.querySelector(".catalog-section"),
  grid: document.querySelector("#catalogGrid"),
  empty: document.querySelector("#catalogEmpty"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyDescription: document.querySelector("#emptyDescription"),
  emptyActions: document.querySelector("#emptyActions"),
  more: document.querySelector("#catalogMore"),
  loadMore: document.querySelector("#loadMoreButton"),
  template: document.querySelector("#catalogCardTemplate"),
  favorites: document.querySelector("#openFavoritesButton"),
  account: document.querySelector("#accountButton"),
  openReview: document.querySelector("#openReviewButton"),
  mobileReview: document.querySelector("#mobileReviewButton"),
  authModal: document.querySelector("#authModal"),
  authBackdrop: document.querySelector("#authBackdrop"),
  closeAuth: document.querySelector("#closeAuthButton"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  sendAuthLink: document.querySelector("#sendAuthLinkButton"),
  authSent: document.querySelector("#authSent"),
  authSentEmail: document.querySelector("#authSentEmail"),
  authOtpForm: document.querySelector("#authOtpForm"),
  authOtp: document.querySelector("#authOtp"),
  verifyAuthOtp: document.querySelector("#verifyAuthOtpButton"),
  resendAuthOtp: document.querySelector("#resendAuthOtpButton"),
  changeAuthEmail: document.querySelector("#changeAuthEmailButton"),
  authAccount: document.querySelector("#authAccount"),
  authAccountEmail: document.querySelector("#authAccountEmail"),
  signOut: document.querySelector("#signOutButton"),
  authStatus: document.querySelector("#authStatus"),
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
  submitReview: document.querySelector("#submitReviewButton"),
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
  heroSlots: document.querySelectorAll("[data-hero-slot]"),
};

let currentChannel = "food";
let authSession = loadAuthSession();
let pendingAuthEmail = "";
let authResendRemaining = 0;
let authResendTimer = null;
let authSending = false;
let activeFilter = "全部";
let searchActive = false;
let foodLoading = true;
let catalogLoading = true;
let cloudFoodItems = [];
let cloudCatalogItems = { beauty: [], life: [], fashion: [] };
let favoriteIds = loadSet(FAVORITES_KEY);
let localReviews = loadArray(REVIEWS_KEY);
let canonicalPlaceIds = new Map();
let cloudReviewCache = new Map();
let moderationRetryAt = new Map();
let favoritesOnly = false;
let toastTimer = null;
let photoObjectUrls = [];
let detailItem = null;
let lastFocusedElement = null;
let foodView = "list";
let map = null;
let mapProvider = null;
let mapSdk = null;
let kakaoSdk = null;
let mapProviderLoadPromise = null;
let mapOverlays = [];
let activeMapPopup = null;
let addingPlace = false;
let selectedCoordinates = null;
let draftOverlay = null;
let visibleLimit = PAGE_SIZE;

elements.channelTriggers.forEach((entry) => {
  entry.addEventListener("click", () => switchChannel(entry.dataset.channel));
});
elements.search.addEventListener("input", () => {
  const hasQuery = Boolean(elements.search.value.trim());
  if (hasQuery && foodView === "map") foodView = "list";
  resetAndRender();
  if (hasQuery && !searchActive) elements.catalogSection.scrollIntoView({ behavior: "smooth", block: "start" });
  searchActive = hasQuery;
});
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
  elements.favorites.textContent = favoritesOnly ? "仅看收藏" : "收藏";
  elements.favorites.setAttribute("aria-pressed", String(favoritesOnly));
  render();
  document.querySelector(".catalog-section").scrollIntoView({ behavior: "smooth" });
});
elements.account.addEventListener("click", openAuthModal);
elements.authBackdrop.addEventListener("click", closeAuthModal);
elements.closeAuth.addEventListener("click", closeAuthModal);
elements.authForm.addEventListener("submit", sendEmailOtp);
elements.authOtpForm.addEventListener("submit", verifyEmailOtp);
elements.resendAuthOtp.addEventListener("click", resendEmailOtp);
elements.changeAuthEmail.addEventListener("click", showAuthForm);
elements.authOtp.addEventListener("input", () => {
  elements.authOtp.value = elements.authOtp.value.replace(/\D/g, "").slice(0, 8);
  elements.authOtp.removeAttribute("aria-invalid");
  hideAuthStatus();
});
elements.signOut.addEventListener("click", signOut);
elements.openReview.addEventListener("click", () => openReviewModal());
elements.mobileReview.addEventListener("click", () => openReviewModal());
elements.closeReview.addEventListener("click", closeReviewModal);
elements.backdrop.addEventListener("click", closeReviewModal);
elements.closeDetail.addEventListener("click", closeDetailModal);
elements.detailBackdrop.addEventListener("click", closeDetailModal);
elements.detailFavorite.addEventListener("click", () => {
  if (!detailItem) return;
  toggleFavorite(detailItem);
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
  showToast("品目补充入口正在准备；商品仍由平台审核后统一入库。");
});
elements.form.addEventListener("submit", saveReview);
document.addEventListener("keydown", (event) => {
  const activeModal = !elements.authModal.hidden
    ? elements.authModal
    : (!elements.modal.hidden ? elements.modal : (!elements.detailModal.hidden ? elements.detailModal : null));
  if (!activeModal) return;
  if (event.key === "Escape") {
    if (activeModal === elements.authModal) closeAuthModal();
    else if (activeModal === elements.modal) closeReviewModal();
    else closeDetailModal();
    return;
  }
  if (event.key === "Tab") trapModalFocus(event, activeModal);
});

async function init() {
  consumeAuthRedirect();
  await refreshAuthSessionIfNeeded();
  updateAccountUI();
  renderFilters();
  render();
  await Promise.all([loadFoodItems(), loadCatalogItems()]);
  if (authSession) await loadCloudFavorites();
  hydrateHeroShowcase();
  render();
}

function supabaseHeaders() {
  const config = window.SUPABASE_CONFIG || {};
  const bearer = authSession?.access_token || config.anonKey;
  return { apikey: config.anonKey, Authorization: `Bearer ${bearer}` };
}

function loadAuthSession() {
  try {
    const value = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
    return value && value.access_token && value.refresh_token ? value : null;
  } catch {
    return null;
  }
}

function consumeAuthRedirect() {
  if (!window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const authError = params.get("error_description");
  if (authError) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    showToast("登录链接无效或已过期，请重新发送。 ");
    return;
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return;
  const expiresIn = Number(params.get("expires_in") || 3600);
  const payload = parseJwt(accessToken);
  authSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: { id: payload.sub || "", email: payload.email || "" },
  };
  persistAuthSession();
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  showToast("登录成功，可以发布真实体验了。");
}

function parseJwt(token) {
  try {
    const raw = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const base64 = raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), "=");
    return JSON.parse(decodeURIComponent(atob(base64).split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
  } catch {
    return {};
  }
}

function persistAuthSession() {
  if (authSession) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));
  else localStorage.removeItem(AUTH_SESSION_KEY);
}

async function refreshAuthSessionIfNeeded() {
  if (!authSession) return;
  const expiresAt = Number(authSession.expires_at || 0);
  if (expiresAt > Math.floor(Date.now() / 1000) + 90) return;
  const config = window.SUPABASE_CONFIG || {};
  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: authSession.refresh_token }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json();
    authSession = {
      access_token: value.access_token,
      refresh_token: value.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600),
      user: value.user || authSession.user,
    };
    persistAuthSession();
  } catch (error) {
    console.warn("[auth] session refresh failed", error);
    authSession = null;
    persistAuthSession();
  }
}

function updateAccountUI() {
  const email = authSession?.user?.email || parseJwt(authSession?.access_token || "").email || "";
  elements.account.textContent = email ? email.split("@")[0].slice(0, 10) : "登录";
  elements.account.setAttribute("aria-label", email ? `当前账号 ${email}` : "登录或注册");
}

function openAuthModal() {
  hideAuthStatus();
  if (authSession) showAuthAccount();
  else if (pendingAuthEmail) showAuthOtp();
  else showAuthForm();
  const focusTarget = authSession ? elements.signOut : pendingAuthEmail ? elements.authOtp : elements.authEmail;
  activateModal(elements.authModal, focusTarget);
}

function closeAuthModal() {
  deactivateModal(elements.authModal);
  hideAuthStatus();
}

function showAuthForm() {
  stopAuthResendTimer(true);
  pendingAuthEmail = "";
  elements.authForm.hidden = false;
  elements.authSent.hidden = true;
  elements.authAccount.hidden = true;
  elements.authEmail.disabled = false;
  elements.sendAuthLink.disabled = false;
  elements.sendAuthLink.textContent = "获取验证码";
  hideAuthStatus();
  if (!elements.authModal.hidden) elements.authEmail.focus();
}

function showAuthOtp() {
  elements.authForm.hidden = true;
  elements.authSent.hidden = false;
  elements.authAccount.hidden = true;
  elements.authSentEmail.textContent = maskEmail(pendingAuthEmail);
  elements.authOtp.disabled = false;
  elements.verifyAuthOtp.disabled = false;
  elements.verifyAuthOtp.textContent = "验证并登录";
  if (!elements.authModal.hidden) elements.authOtp.focus();
}

function showAuthAccount() {
  stopAuthResendTimer(true);
  pendingAuthEmail = "";
  const email = authSession?.user?.email || parseJwt(authSession?.access_token || "").email || "已登录用户";
  elements.authForm.hidden = true;
  elements.authSent.hidden = true;
  elements.authAccount.hidden = false;
  elements.authAccountEmail.textContent = email;
}

async function sendEmailOtp(event) {
  event.preventDefault();
  const email = elements.authEmail.value.trim().toLowerCase();
  await requestEmailOtp(email, false);
}

async function requestEmailOtp(email, isResend) {
  const config = window.SUPABASE_CONFIG || {};
  if (!email || authSending) return;
  if (!config.url || !config.anonKey) return showAuthStatus("登录服务尚未连接，请稍后再试。");
  authSending = true;
  if (isResend) {
    elements.resendAuthOtp.disabled = true;
    elements.resendAuthOtp.textContent = "正在重新发送…";
  } else {
    elements.authEmail.disabled = true;
    elements.sendAuthLink.disabled = true;
    elements.sendAuthLink.textContent = "正在发送…";
  }
  hideAuthStatus();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, create_user: true }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.msg || error.message || `HTTP ${response.status}`);
    }
    pendingAuthEmail = email;
    elements.authOtp.value = "";
    elements.authOtp.removeAttribute("aria-invalid");
    showAuthOtp();
    startAuthResendTimer();
    hideAuthStatus();
    elements.authOtp.focus();
    if (isResend) showToast("新的验证码已发送，请查看邮箱。");
  } catch (error) {
    const message = String(error.message || "").toLowerCase();
    if (isResend) stopAuthResendTimer(true);
    else {
      elements.authEmail.disabled = false;
      elements.sendAuthLink.disabled = false;
      elements.sendAuthLink.textContent = "重新获取验证码";
    }
    showAuthStatus(message.includes("rate") ? "发送太频繁，请一分钟后再试。" : "验证码发送失败，请检查邮箱地址或稍后重试。");
    console.error("[auth] email OTP request failed", error);
  } finally {
    authSending = false;
  }
}

async function verifyEmailOtp(event) {
  event.preventDefault();
  const token = elements.authOtp.value.replace(/\D/g, "");
  const config = window.SUPABASE_CONFIG || {};
  if (!pendingAuthEmail) return showAuthStatus("请先填写邮箱并获取验证码。");
  if (token.length < 6 || token.length > 8) return showAuthStatus("请输入邮件中的 6–8 位数字验证码。");

  elements.authOtp.value = token;
  elements.authOtp.disabled = true;
  elements.verifyAuthOtp.disabled = true;
  elements.verifyAuthOtp.textContent = "正在验证…";
  hideAuthStatus();

  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingAuthEmail, token, type: "email" }),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok || !value.access_token || !value.refresh_token) {
      throw new Error(value.msg || value.message || `HTTP ${response.status}`);
    }
    authSession = {
      access_token: value.access_token,
      refresh_token: value.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600),
      user: value.user || { email: pendingAuthEmail },
    };
    persistAuthSession();
    stopAuthResendTimer(true);
    pendingAuthEmail = "";
    await loadCloudFavorites();
    render();
    updateAccountUI();
    closeAuthModal();
    showToast("登录成功，可以发布真实体验了。");
  } catch (error) {
    elements.authOtp.disabled = false;
    elements.verifyAuthOtp.disabled = false;
    elements.verifyAuthOtp.textContent = "重新验证";
    elements.authOtp.setAttribute("aria-invalid", "true");
    const message = String(error.message || "").toLowerCase();
    if (message.includes("expired")) showAuthStatus("验证码已过期，请重新发送。");
    else if (message.includes("invalid") || message.includes("token")) showAuthStatus("验证码不正确，请检查后重试。");
    else if (message.includes("rate")) showAuthStatus("尝试次数过多，请稍后再试。");
    else showAuthStatus("暂时无法验证，请稍后重试。");
    elements.authOtp.select();
    console.error("[auth] OTP verification failed", error);
  }
}

async function resendEmailOtp() {
  if (!pendingAuthEmail || authResendRemaining > 0) return;
  await requestEmailOtp(pendingAuthEmail, true);
}

function startAuthResendTimer() {
  stopAuthResendTimer();
  authResendRemaining = 60;
  updateAuthResendButton();
  authResendTimer = window.setInterval(() => {
    authResendRemaining -= 1;
    updateAuthResendButton();
    if (authResendRemaining <= 0) stopAuthResendTimer();
  }, 1000);
}

function stopAuthResendTimer(reset = false) {
  if (authResendTimer) window.clearInterval(authResendTimer);
  authResendTimer = null;
  if (reset || authResendRemaining <= 0) {
    authResendRemaining = 0;
    updateAuthResendButton();
  }
}

function updateAuthResendButton() {
  const waiting = authResendRemaining > 0;
  elements.resendAuthOtp.disabled = waiting;
  elements.resendAuthOtp.textContent = waiting ? `${authResendRemaining} 秒后重新发送` : "重新发送验证码";
}

function maskEmail(email) {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(2, Math.min(5, name.length - visible.length)))}@${domain}`;
}

async function signOut() {
  const config = window.SUPABASE_CONFIG || {};
  const token = authSession?.access_token;
  elements.signOut.disabled = true;
  try {
    if (token) {
      await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
      });
    }
  } catch (error) {
    console.warn("[auth] remote sign-out failed", error);
  } finally {
    authSession = null;
    persistAuthSession();
    favoriteIds = loadSet(FAVORITES_KEY);
    cloudReviewCache.clear();
    elements.signOut.disabled = false;
    updateAccountUI();
    closeAuthModal();
    showToast("已退出登录，仍可继续浏览和使用本地收藏。");
  }
}

function showAuthStatus(message) {
  elements.authStatus.textContent = message;
  elements.authStatus.hidden = false;
}

function hideAuthStatus() {
  elements.authStatus.hidden = true;
  elements.authStatus.textContent = "";
}

function requireUser() {
  if (authSession) return true;
  openAuthModal();
  showAuthStatus("发布内容前请先登录；浏览和收藏不受影响。");
  return false;
}

async function loadFoodItems() {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes("YOUR_PROJECT_REF")) {
    elements.syncStatus.textContent = "品目库尚未连接";
    foodLoading = false;
    return;
  }

  elements.syncStatus.textContent = "正在读取云端品目...";
  const baseUrl = config.url.replace(/\/$/, "");
  const endpoint = `${baseUrl}/rest/v1/${SUPABASE_TABLE}?select=*&order=created_at.desc`;
  const canonicalEndpoint = `${baseUrl}/rest/v1/places?select=id,legacy_food_place_id&legacy_food_place_id=not.is.null`;
  try {
    const [response, canonicalResponse] = await Promise.all([
      fetch(endpoint, { headers: supabaseHeaders() }),
      fetch(canonicalEndpoint, { headers: supabaseHeaders() }),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (canonicalResponse.ok) {
      const canonicalRows = await canonicalResponse.json();
      canonicalPlaceIds = new Map(canonicalRows.map((row) => [String(row.legacy_food_place_id), String(row.id)]));
    }
    cloudFoodItems = rows.map(mapFoodPlace);
    elements.syncStatus.textContent = "云端品目已连接";
    if (map) drawFoodMarkers();
  } catch (error) {
    elements.syncStatus.textContent = "云端暂时不可用";
    console.error("[catalog] load failed", error);
  } finally {
    foodLoading = false;
  }
}

async function loadCatalogItems() {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes("YOUR_PROJECT_REF")) {
    catalogLoading = false;
    return;
  }

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
  } finally {
    catalogLoading = false;
  }
}

function hydrateHeroShowcase() {
  const featured = [...(cloudCatalogItems.beauty || [])]
    .filter((item) => item.imageUrl)
    .sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating || a.featuredOrder - b.featuredOrder)
    .slice(0, elements.heroSlots.length);
  elements.heroSlots.forEach((slot, index) => {
    const item = featured[index];
    if (!item) return;
    const image = slot.querySelector(".hero-product-image");
    const placeholder = slot.querySelector(".lookbook-placeholder");
    const title = slot.querySelector(".hero-product-title");
    const meta = slot.querySelector(".hero-product-meta");
    image.src = item.imageUrl;
    image.alt = `${item.title} 官方商品图`;
    image.hidden = false;
    placeholder.hidden = true;
    title.textContent = item.title;
    meta.textContent = `${item.brand}${item.price ? ` · ₩${item.price.toLocaleString("ko-KR")}` : ""}`;
    image.addEventListener("error", () => {
      image.hidden = true;
      placeholder.hidden = false;
    }, { once: true });
  });
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
  const rawPrice = Number(place.price || 0);
  return {
    id: String(place.id),
    channel: "food",
    canonicalPlaceId: canonicalPlaceIds.get(String(place.id)) || "",
    title: place.name || "未命名品目",
    category: place.category || "美食",
    note: place.note || place.dish || "等待第一条真实体验。",
    brand: place.category || "韩国美食",
    price: rawPrice > 0 && rawPrice < 1000 ? rawPrice * 1000 : rawPrice,
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
  searchActive = false;
  elements.favorites.textContent = "收藏";
  elements.favorites.setAttribute("aria-pressed", "false");
  elements.channelTriggers.forEach((entry) => {
    const active = entry.dataset.channel === channel;
    entry.classList.toggle("is-active", active);
    if (entry.classList.contains("category-entry")) {
      if (active) entry.setAttribute("aria-current", "page");
      else entry.removeAttribute("aria-current");
    }
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
  elements.foodViewSwitch.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === foodView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderFilters();
  render();
  document.querySelector(".catalog-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateSyncStatus() {
  if (currentChannel === "food") {
    elements.syncStatus.textContent = foodLoading ? "正在读取地点..." : cloudFoodItems.length ? "按评价数排序 · 云端地点" : "地点库暂时不可用";
    return;
  }
  const count = cloudCatalogItems[currentChannel]?.length || 0;
  elements.syncStatus.textContent = catalogLoading ? "正在读取商品..." : count ? `按评价数排序 · ${count} 件` : "该频道等待首批导入";
}

function renderFilters() {
  const filters = channelCatalog[currentChannel].filters;
  elements.filters.innerHTML = filters.map((filter) =>
    `<button type="button" class="filter-chip${filter === activeFilter ? " is-active" : ""}" data-filter="${escapeHtml(filter)}" aria-pressed="${filter === activeFilter}">${escapeHtml(filter)}</button>`
  ).join("");
}

function currentItems() {
  const query = elements.search.value.trim().toLowerCase();
  const searchingAll = Boolean(query);
  const imported = cloudCatalogItems[currentChannel] || [];
  const source = searchingAll ? allCatalogItems() : currentChannel === "food" ? cloudFoodItems : imported;
  const reviewed = applyLocalReviewStats(source);
  let items = reviewed.filter((item) => {
    if (favoritesOnly && !favoriteIds.has(item.id)) return false;
    if (!searchingAll && activeFilter !== "全部" && item.category !== activeFilter) return false;
    return [item.title, item.category, item.note, item.searchText || ""].join(" ").toLowerCase().includes(query);
  });
  items.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating || (a.featuredOrder || 0) - (b.featuredOrder || 0));
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
  const query = elements.search.value.trim();
  const searchingAll = Boolean(query);
  const loading = searchingAll ? foodLoading || catalogLoading : currentChannel === "food" ? foodLoading : catalogLoading;
  if (searchingAll) {
    elements.eyebrow.textContent = "全站搜索 · SEARCH";
    elements.title.textContent = `“${query}”`;
    elements.description.textContent = "同时搜索美食、美妆、生活与潮流的全部品目。";
    elements.syncStatus.textContent = "四个频道 · 按评价数排序";
  } else {
    const config = channelCatalog[currentChannel];
    elements.eyebrow.textContent = config.eyebrow;
    elements.title.textContent = config.title;
    elements.description.textContent = config.description;
    updateSyncStatus();
  }
  elements.toolbar.hidden = searchingAll;
  elements.foodViewSwitch.hidden = searchingAll || currentChannel !== "food";
  elements.catalogSection.setAttribute("aria-busy", String(loading));
  elements.loading.hidden = !loading;
  if (loading) {
    elements.count.textContent = "—";
    elements.grid.innerHTML = "";
    elements.grid.hidden = true;
    elements.empty.hidden = true;
    elements.more.hidden = true;
    return;
  }

  const items = currentItems();
  elements.count.textContent = items.length;
  elements.grid.innerHTML = "";
  elements.grid.hidden = false;
  elements.empty.hidden = items.length > 0;
  if (!items.length) {
    const hasQuery = searchingAll || activeFilter !== "全部" || favoritesOnly;
    elements.emptyActions.hidden = hasQuery || currentChannel === "food" || currentChannel === "beauty";
    if (favoritesOnly) {
      elements.emptyTitle.textContent = "还没有收藏";
      elements.emptyDescription.textContent = "在品目卡片上点收藏，之后可以从这里快速找回。";
    } else if (hasQuery) {
      elements.emptyTitle.textContent = searchingAll ? `没有找到“${query}”` : "没有符合条件的品目";
      elements.emptyDescription.textContent = searchingAll ? "试试商品中文名、韩文名、品牌或餐厅名称。" : "换个筛选条件再试一次。";
    } else {
      elements.emptyTitle.textContent = currentChannel === "life" ? "生活品目正在整理" : currentChannel === "fashion" ? "潮流品目正在整理" : "这个频道暂时没有品目";
      elements.emptyDescription.textContent = currentChannel === "life"
        ? "Daiso、便利店、家居和文具会由平台统一导入，避免用户重复创建同一件商品。"
        : currentChannel === "fashion"
          ? "韩国品牌、鞋包和配饰会由平台统一导入；开放后可直接收藏并发布带图评价。"
          : "稍后再来看看，或先浏览已经开放的频道。";
    }
  }
  const visibleItems = items.slice(0, visibleLimit);

  visibleItems.forEach((item, index) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const visual = card.querySelector(".card-visual");
    const image = card.querySelector(".card-image");
    card.querySelector(".card-index").textContent = String(index + 1).padStart(2, "0");
    card.querySelector(".card-glyph").textContent = item.glyph || channelCatalog[item.channel || currentChannel].glyph;
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
    const openButton = card.querySelector(".card-open");
    openButton.setAttribute("aria-label", `查看 ${item.title} 详情`);
    const itemLabel = item.kind === "product" ? item.brand : item.category;
    const channelLabel = channelCatalog[item.channel || currentChannel].eyebrow.split(" · ")[0];
    card.querySelector(".card-category").textContent = searchingAll ? `${channelLabel} · ${itemLabel}` : itemLabel;
    card.querySelector(".card-title").textContent = item.title;
    card.querySelector(".card-note").textContent = item.price ? `₩${item.price.toLocaleString("ko-KR")}` : item.note;
    card.querySelector(".card-rating").textContent = item.rating ? `${item.rating.toFixed(1)} 分` : "等待首评";
    const reviewCount = card.querySelector(".card-reviews");
    reviewCount.textContent = item.reviewCount ? `${item.reviewCount} 条体验` : "";
    reviewCount.hidden = !item.reviewCount;

    const favorite = card.querySelector(".card-favorite");
    const favoriteActive = favoriteIds.has(item.id);
    favorite.dataset.active = String(favoriteActive);
    favorite.setAttribute("aria-pressed", String(favoriteActive));
    favorite.setAttribute("aria-label", favoriteActive ? `取消收藏 ${item.title}` : `收藏 ${item.title}`);
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(item);
    });
    openButton.addEventListener("click", () => openDetailModal(item));
    elements.grid.append(card);
  });
  const hasMore = (searchingAll || currentChannel !== "food") && visibleItems.length < items.length;
  elements.more.hidden = !hasMore;
  elements.loadMore.textContent = hasMore ? `继续加载 · ${visibleItems.length} / ${items.length}` : "继续加载";
  refreshSuggestions();
  syncFoodViewVisibility();
}

function showFoodView(view) {
  if (currentChannel !== "food") return;
  foodView = view === "map" ? "map" : "list";
  elements.foodViewSwitch.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === foodView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
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
    setTimeout(() => {
      if (mapProvider === "kakao") map.relayout();
      else if (typeof map.resize === "function") map.resize();
    }, 0);
    drawFoodMarkers();
    return;
  }
  elements.mapStatus.textContent = "正在加载韩国地图...";
  elements.startAddPlace.disabled = true;
  try {
    const provider = await ensureMapProvider();
    if (!provider) throw new Error("地图服务未加载");
    mapProvider = provider.name;
    mapSdk = provider.sdk;
    document.querySelector("#map").replaceChildren();
    if (mapProvider === "tencent") initializeTencentMap();
    else initializeKakaoMap();
    elements.startAddPlace.disabled = false;
    elements.startAddPlace.textContent = "添加新地点";
    elements.mapStatus.textContent = mapProvider === "tencent"
      ? "腾讯地图 · 面向中国访问"
      : "韩国地图临时后备 · 腾讯地图配置中";
    drawFoodMarkers();
  } catch (error) {
    mapProviderLoadPromise = null;
    elements.startAddPlace.disabled = true;
    elements.startAddPlace.textContent = "底图恢复后可添加";
    elements.mapStatus.textContent = "底图暂时不可用 · 地点列表仍可浏览";
    renderMapFallback();
    console.warn("[map] provider unavailable", error);
  }
}

function renderMapFallback() {
  const root = document.querySelector("#map");
  const fallback = document.createElement("div");
  fallback.className = "map-fallback";

  const copy = document.createElement("div");
  copy.className = "map-fallback-copy";
  const title = document.createElement("strong");
  title.textContent = "地图底图暂时没有加载出来";
  const description = document.createElement("p");
  description.textContent = "地点数据仍然完整。先从下面打开餐厅详情；底图恢复后会自动重新提供定位与新增地点。";
  copy.append(title, description);

  const list = document.createElement("div");
  list.className = "map-fallback-list";
  list.setAttribute("aria-label", "可浏览的美食地点");
  [...cloudFoodItems]
    .sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating)
    .slice(0, 12)
    .forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-fallback-place";
      const name = document.createElement("strong");
      name.textContent = item.title;
      const meta = document.createElement("span");
      meta.textContent = `${item.category} · ${item.rating ? `${item.rating.toFixed(1)} 分` : "等待首评"}`;
      button.append(name, meta);
      button.addEventListener("click", () => openDetailModal(item));
      list.append(button);
    });

  fallback.append(copy, list);
  root.replaceChildren(fallback);
}

async function ensureMapProvider() {
  if (mapProviderLoadPromise) return mapProviderLoadPromise;
  mapProviderLoadPromise = (async () => {
    const tencent = await ensureTencentSdk();
    if (tencent) return { name: "tencent", sdk: tencent };
    const kakao = await ensureKakaoSdk();
    if (kakao) return { name: "kakao", sdk: kakao };
    return null;
  })();
  return mapProviderLoadPromise;
}

function ensureTencentSdk() {
  if (!window.TENCENT_MAP_KEY) return Promise.resolve(null);
  if (window.TMap) return Promise.resolve(window.TMap);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(window.TENCENT_MAP_KEY)}`;
    script.onload = () => resolve(window.TMap || null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

function ensureKakaoSdk() {
  if (!window.KAKAO_JS_KEY) return Promise.resolve(null);
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao.maps.load(() => resolve(window.kakao)));
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(window.KAKAO_JS_KEY)}&libraries=services&autoload=false`;
    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) return resolve(null);
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

function initializeTencentMap() {
  map = new mapSdk.Map(document.querySelector("#map"), {
    center: new mapSdk.LatLng(37.5665, 126.978),
    zoom: 11,
  });
  map.on("click", (event) => {
    if (!addingPlace || !event.latLng) return;
    selectPlaceCoordinates(event.latLng.getLat(), event.latLng.getLng());
  });
}

function initializeKakaoMap() {
  kakaoSdk = mapSdk;
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
}

function drawFoodMarkers() {
  if (!map || !mapSdk) return;
  mapOverlays.forEach((overlay) => overlay.setMap(null));
  mapOverlays = [];
  if (activeMapPopup) activeMapPopup.setMap(null);
  activeMapPopup = null;
  const items = cloudFoodItems.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  if (mapProvider === "tencent") {
    drawTencentMarkers(items);
    return;
  }
  items.forEach((item) => {
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

function drawTencentMarkers(items) {
  if (!items.length) return;
  const marker = new mapSdk.MultiMarker({
    id: "banfan-food-places",
    map,
    styles: {
      banfan: new mapSdk.MarkerStyle({
        width: 34,
        height: 42,
        anchor: { x: 17, y: 42 },
        src: createTencentPinImage(),
        color: "#ffffff",
        size: 13,
        direction: "center",
      }),
    },
    geometries: items.map((item) => ({
      id: String(item.id),
      styleId: "banfan",
      position: new mapSdk.LatLng(item.lat, item.lng),
      content: item.category.slice(0, 1),
    })),
  });
  marker.setStopPropagation(true);
  marker.on("click", (event) => {
    const item = items.find((candidate) => String(candidate.id) === String(event.geometry?.id));
    if (item) openMapPopup(item);
  });
  mapOverlays.push(marker);
}

function createTencentPinImage() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path fill="#171717" d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 25 17 25s17-12.25 17-25C34 7.61 26.39 0 17 0Z"/><circle cx="17" cy="17" r="11" fill="#171717" stroke="#fff" stroke-width="1.5"/></svg>';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function openMapPopup(item) {
  if (!map || !mapSdk) return;
  if (activeMapPopup) activeMapPopup.setMap(null);
  if (mapProvider === "tencent") {
    activeMapPopup = new mapSdk.InfoWindow({
      map,
      position: new mapSdk.LatLng(item.lat, item.lng),
      content: `<div class="map-popup"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${item.rating ? `${item.rating.toFixed(1)} 分` : "等待首评"}</span></div>`,
      enableCustom: true,
      offset: { x: 0, y: -48 },
      zIndex: 900,
    });
    return;
  }
  const popup = document.createElement("div");
  popup.className = "map-popup";
  popup.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${item.rating ? `${item.rating.toFixed(1)} 分` : "等待首评"}</span>`;
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
  if (!map) return showToast("地图底图恢复后才能选择新地点坐标。");
  if (!requireUser()) return;
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
  if (mapProvider === "tencent") {
    draftOverlay = new mapSdk.MultiMarker({
      id: "banfan-draft-place",
      map,
      styles: {
        draft: new mapSdk.MarkerStyle({
          width: 34,
          height: 42,
          anchor: { x: 17, y: 42 },
          src: createTencentPinImage(),
          color: "#ffffff",
          size: 17,
          direction: "center",
        }),
      },
      geometries: [{
        id: "draft",
        styleId: "draft",
        position: new mapSdk.LatLng(lat, lng),
        content: "+",
      }],
    });
  } else {
    const pin = document.createElement("div");
    pin.className = "banfan-pin";
    pin.innerHTML = "<span>＋</span>";
    draftOverlay = new kakaoSdk.maps.CustomOverlay({
      position: new kakaoSdk.maps.LatLng(lat, lng),
      content: pin,
      xAnchor: .5,
      yAnchor: 1,
    });
  }
  draftOverlay.setMap(map);
  elements.placeName.focus();
}

async function saveNewPlace() {
  if (!requireUser()) return;
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
    const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/${SUPABASE_TABLE}`;
    const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub || "";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...supabaseHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ ...payload, created_by: userId }),
    });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    cloudFoodItems.unshift(mapFoodPlace(rows[0] || payload));
    cancelAddingPlace();
    drawFoodMarkers();
    render();
    showToast("新地点已提交到美食地图。 ");
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

function toggleFavorite(item) {
  const id = item.id;
  const active = !favoriteIds.has(id);
  if (active) favoriteIds.add(id);
  else favoriteIds.delete(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]));
  render();
  if (authSession) syncFavoriteToCloud(item, active);
}

function favoriteTarget(item) {
  if (item.kind === "place") {
    const placeId = item.canonicalPlaceId || canonicalPlaceIds.get(String(item.id));
    return placeId ? { place_id: placeId } : null;
  }
  return { item_id: item.id };
}

async function loadCloudFavorites() {
  const config = window.SUPABASE_CONFIG || {};
  const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub;
  if (!config.url || !userId) return;
  try {
    const baseUrl = config.url.replace(/\/$/, "");
    const endpoint = `${baseUrl}/rest/v1/favorites?select=item_id,place_id&user_id=eq.${encodeURIComponent(userId)}`;
    const response = await fetch(endpoint, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    const canonicalToLegacy = new Map([...canonicalPlaceIds].map(([legacyId, placeId]) => [placeId, legacyId]));
    const remoteIds = new Set();
    rows.forEach((row) => {
      if (row.item_id) remoteIds.add(String(row.item_id));
      if (row.place_id && canonicalToLegacy.has(String(row.place_id))) remoteIds.add(canonicalToLegacy.get(String(row.place_id)));
    });
    remoteIds.forEach((id) => favoriteIds.add(id));

    const localIds = loadSet(FAVORITES_KEY);
    const missingRows = allCatalogItems()
      .filter((item) => localIds.has(item.id) && !remoteIds.has(item.id))
      .map((item) => favoriteTarget(item))
      .filter(Boolean)
      .map((target) => ({ user_id: userId, item_id: target.item_id || null, place_id: target.place_id || null }));
    if (missingRows.length) {
      const migrateResponse = await fetch(`${baseUrl}/rest/v1/favorites`, {
        method: "POST",
        headers: { ...supabaseHeaders(), "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify(missingRows),
      });
      if (!migrateResponse.ok) throw new Error(`HTTP ${migrateResponse.status}`);
    }
  } catch (error) {
    console.warn("[favorites] cloud load failed", error);
  }
}

async function syncFavoriteToCloud(item, active) {
  const config = window.SUPABASE_CONFIG || {};
  const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub;
  const target = favoriteTarget(item);
  if (!config.url || !userId || !target) return;
  const baseUrl = config.url.replace(/\/$/, "");
  try {
    if (active) {
      const response = await fetch(`${baseUrl}/rest/v1/favorites`, {
        method: "POST",
        headers: { ...supabaseHeaders(), "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ user_id: userId, ...target }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } else {
      const field = target.item_id ? "item_id" : "place_id";
      const response = await fetch(`${baseUrl}/rest/v1/favorites?user_id=eq.${encodeURIComponent(userId)}&${field}=eq.${encodeURIComponent(target[field])}`, {
        method: "DELETE",
        headers: supabaseHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    if (active) favoriteIds.delete(item.id);
    else favoriteIds.add(item.id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]));
    render();
    if (detailItem?.id === item.id) syncDetailFavorite();
    showToast("收藏同步失败，已恢复原状态。 ");
    console.warn("[favorites] cloud sync failed", error);
  }
}

function openDetailModal(item) {
  detailItem = item;
  elements.detailCategory.textContent = `${item.brand || item.category} · ${item.category}`;
  elements.detailTitle.textContent = item.title;
  elements.detailOriginal.textContent = item.originalName || "";
  elements.detailOriginal.hidden = !item.originalName;
  elements.detailNote.textContent = item.note;
  elements.detailRating.textContent = item.rating ? `${item.rating.toFixed(1)} 分` : "等待首评";
  elements.detailReviewCount.textContent = item.reviewCount ? `${item.reviewCount} 条体验` : "还没有评价";
  elements.detailImage.src = item.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  elements.detailImage.alt = item.imageUrl ? `${item.title} 官方商品图` : "";
  elements.detailImage.parentElement.classList.toggle("has-image", Boolean(item.imageUrl));
  elements.detailImage.hidden = !item.imageUrl;
  const sourceUrl = safeHttpUrl(item.sourceUrl);
  elements.detailSource.href = sourceUrl || "#";
  elements.detailSource.hidden = !sourceUrl;
  syncDetailFavorite();
  renderDetailReviews(item);
  activateModal(elements.detailModal, elements.closeDetail);
  loadCloudReviews(item);
}

function closeDetailModal() {
  deactivateModal(elements.detailModal);
  detailItem = null;
}

function syncDetailFavorite() {
  if (!detailItem) return;
  const active = favoriteIds.has(detailItem.id);
  elements.detailFavorite.textContent = active ? "已收藏" : "加入收藏";
  elements.detailFavorite.dataset.active = String(active);
  elements.detailFavorite.setAttribute("aria-pressed", String(active));
}

function renderDetailReviews(item) {
  const cache = cloudReviewCache.get(reviewCacheKey(item));
  const local = localReviews.filter((review) => review.itemId === item.id).map((review) => ({ ...review, source: "local" }));
  const cloud = cache?.reviews || [];
  const reviews = [...cloud, ...local];
  const pendingCount = cloud.filter((review) => review.moderationStatus === "pending").length;
  elements.detailReviewSummary.textContent = cache?.status === "loading"
    ? "正在读取评价…"
    : reviews.length
      ? `${reviews.length} 条体验${pendingCount ? ` · ${pendingCount} 条安全检查中` : ""}`
      : "等待第一条真实体验";
  elements.detailReviewList.replaceChildren();
  if (!reviews.length) {
    const empty = document.createElement("div");
    empty.className = "review-empty";
    const title = document.createElement("strong");
    title.textContent = cache?.status === "loading" ? "正在读取带图评价" : "还没有带图评价";
    const description = document.createElement("p");
    description.textContent = cache?.status === "loading" ? "请稍候。" : "用过或吃过之后，上传实拍并留下第一条真实体验。";
    empty.append(title, description);
    elements.detailReviewList.append(empty);
    return;
  }
  reviews.forEach((review) => elements.detailReviewList.append(createReviewCard(review)));
}

function createReviewCard(review) {
  const card = document.createElement("article");
  card.className = "detail-review-card";
  const head = document.createElement("div");
  const rating = document.createElement("strong");
  rating.textContent = `${Number(review.rating).toFixed(1)} 分`;
  const date = document.createElement("span");
  date.textContent = formatDate(review.createdAt);
  head.append(rating, date);
  const body = document.createElement("p");
  body.textContent = review.text;
  card.append(head, body);
  if (review.photos?.length) {
    const photos = document.createElement("div");
    photos.className = "review-photo-grid";
    review.photos.forEach((photo, index) => {
      const image = document.createElement("img");
      image.src = photo;
      image.alt = `评价实拍 ${index + 1}`;
      image.loading = "lazy";
      photos.append(image);
    });
    card.append(photos);
  }
  const meta = document.createElement("small");
  meta.textContent = review.moderationStatus === "pending"
    ? "仅你可见 · 正在自动安全检查"
    : review.source === "local"
      ? `${review.photoCount || review.photos?.length || 0} 张实拍 · 当前设备旧评价`
      : `${review.photos?.length || 0} 张实拍`;
  card.append(meta);
  return card;
}

function reviewCacheKey(item) {
  return item.kind === "place" ? `place:${item.canonicalPlaceId || item.id}` : `item:${item.id}`;
}

function reviewTarget(item) {
  if (item.kind === "place") {
    const placeId = item.canonicalPlaceId || canonicalPlaceIds.get(String(item.id));
    return placeId ? { field: "place_id", id: placeId } : null;
  }
  return { field: "item_id", id: item.id };
}

async function loadCloudReviews(item, force = false) {
  const target = reviewTarget(item);
  const config = window.SUPABASE_CONFIG || {};
  if (!target || !config.url || !config.anonKey) return;
  const key = reviewCacheKey(item);
  const existing = cloudReviewCache.get(key);
  if (!force && existing?.status === "loading") return;
  if (!force && existing?.status === "ready") {
    const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub;
    const pendingReview = existing.reviews.find((review) => review.userId === userId && review.moderationStatus === "pending");
    if (pendingReview) retryPendingModeration(item, pendingReview.id);
    return;
  }
  cloudReviewCache.set(key, { status: "loading", reviews: existing?.reviews || [] });
  if (detailItem?.id === item.id) renderDetailReviews(item);
  const baseUrl = config.url.replace(/\/$/, "");
  try {
    const endpoint = `${baseUrl}/rest/v1/reviews?select=id,user_id,rating,body,moderation_status,created_at&${target.field}=eq.${encodeURIComponent(target.id)}&order=created_at.desc`;
    const response = await fetch(endpoint, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    const reviewIds = rows.map((row) => row.id);
    let photosByReview = new Map();
    if (reviewIds.length) {
      const photoEndpoint = `${baseUrl}/rest/v1/review_photos?select=review_id,storage_path,sort_order&review_id=in.(${reviewIds.join(",")})&order=sort_order.asc`;
      const photoResponse = await fetch(photoEndpoint, { headers: supabaseHeaders() });
      if (!photoResponse.ok) throw new Error(`HTTP ${photoResponse.status}`);
      const photoRows = await photoResponse.json();
      const signed = await Promise.all(photoRows.map(async (photo) => ({ ...photo, url: await createSignedReviewPhotoUrl(photo.storage_path) })));
      photosByReview = signed.reduce((mapByReview, photo) => {
        if (!mapByReview.has(photo.review_id)) mapByReview.set(photo.review_id, []);
        if (photo.url) mapByReview.get(photo.review_id).push(photo.url);
        return mapByReview;
      }, new Map());
    }
    const reviews = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      rating: Number(row.rating),
      text: row.body,
      moderationStatus: row.moderation_status,
      createdAt: row.created_at,
      photos: photosByReview.get(row.id) || [],
      source: "cloud",
    }));
    cloudReviewCache.set(key, { status: "ready", reviews });
    const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub;
    const pendingReview = rows.find((row) => row.user_id === userId && row.moderation_status === "pending");
    if (pendingReview) retryPendingModeration(item, pendingReview.id);
  } catch (error) {
    cloudReviewCache.set(key, { status: "error", reviews: existing?.reviews || [] });
    console.warn("[reviews] cloud load failed", error);
  }
  if (detailItem?.id === item.id) renderDetailReviews(item);
}

async function requestReviewModeration(reviewId) {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || !authSession?.access_token) throw new Error("AUTH_REQUIRED");
  await refreshAuthSessionIfNeeded();
  if (!authSession?.access_token) throw new Error("AUTH_REQUIRED");
  const response = await fetch(`${config.url.replace(/\/$/, "")}/functions/v1/moderate-review`, {
    method: "POST",
    headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.code || `MODERATION_HTTP_${response.status}`);
  return value;
}

async function retryPendingModeration(item, reviewId) {
  const lastAttempt = moderationRetryAt.get(reviewId) || 0;
  if (Date.now() - lastAttempt < 5 * 60 * 1000) return;
  moderationRetryAt.set(reviewId, Date.now());
  try {
    const result = await requestReviewModeration(reviewId);
    if (result.status !== "published" && result.status !== "rejected") return;
    cloudReviewCache.delete(reviewCacheKey(item));
    await loadCloudReviews(item, true);
    showToast(result.status === "published" ? "你的评价已通过自动检查并发布。" : "评价包含不适合公开的色情或暴力内容，未发布。");
  } catch (error) {
    console.warn("[review] automatic moderation retry failed", error);
  }
}

async function createSignedReviewPhotoUrl(storagePath) {
  const config = window.SUPABASE_CONFIG || {};
  const baseUrl = config.url.replace(/\/$/, "");
  const encodedPath = String(storagePath).split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${baseUrl}/storage/v1/object/sign/review-photos/${encodedPath}`, {
    method: "POST",
    headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!response.ok) return "";
  const value = await response.json();
  const signedPath = value.signedURL || value.signedUrl || "";
  if (!signedPath) return "";
  if (signedPath.startsWith("http")) return signedPath;
  if (signedPath.startsWith("/storage/v1")) return `${baseUrl}${signedPath}`;
  return `${baseUrl}/storage/v1${signedPath}`;
}

function formatDate(value) {
  try { return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value)); }
  catch { return "刚刚"; }
}

function openReviewModal(item = null) {
  if (!requireUser()) return;
  const available = allCatalogItems();
  if (!available.length) {
    showToast("品目正在导入，完成后才能绑定评价。");
    return;
  }
  elements.itemInput.value = item ? item.title : "";
  activateModal(elements.modal, elements.itemInput);
}

function closeReviewModal() {
  deactivateModal(elements.modal);
  clearPhotoPreview();
  elements.form.reset();
  elements.rating.value = "5";
}

async function saveReview(event) {
  event.preventDefault();
  if (!requireUser()) return;
  const title = elements.itemInput.value.trim();
  const item = allCatalogItems().find((candidate) => candidate.title.toLowerCase() === title.toLowerCase());
  if (!item) {
    showToast("请从已有品目中选择；缺少的商品需由平台审核后入库。");
    elements.itemInput.focus();
    return;
  }
  if (!elements.photo.files || !elements.photo.files.length) {
    showToast("带图评价至少需要 1 张实拍照片。 ");
    elements.photo.focus();
    return;
  }
  const files = [...elements.photo.files];
  const invalidFile = files.find((file) => !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024);
  if (invalidFile) {
    showToast("请选择图片文件，每张不超过 12MB。 ");
    elements.photo.focus();
    return;
  }
  const target = reviewTarget(item);
  if (!target) {
    showToast("这个地点仍在迁移，暂时无法绑定评价。 ");
    return;
  }
  const config = window.SUPABASE_CONFIG || {};
  const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub;
  if (!config.url || !userId) {
    showToast("登录状态已失效，请重新登录。 ");
    return;
  }
  elements.submitReview.disabled = true;
  elements.submitReview.textContent = "正在提交…";
  let reviewId = "";
  const uploadedPaths = [];
  try {
    await refreshAuthSessionIfNeeded();
    const baseUrl = config.url.replace(/\/$/, "");
    const reviewResponse = await fetch(`${baseUrl}/rest/v1/reviews`, {
      method: "POST",
      headers: { ...supabaseHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        [target.field]: target.id,
        rating: Number(elements.rating.value),
        body: elements.reviewText.value.trim(),
        moderation_status: "pending",
      }),
    });
    if (!reviewResponse.ok) {
      const errorText = await reviewResponse.text();
      if (reviewResponse.status === 409) throw new Error("DUPLICATE_REVIEW");
      throw new Error(errorText || `HTTP ${reviewResponse.status}`);
    }
    const reviewRows = await reviewResponse.json();
    reviewId = reviewRows[0]?.id || "";
    if (!reviewId) throw new Error("评价记录创建失败");

    const photoRows = [];
    for (const [index, file] of files.slice(0, 6).entries()) {
      const blob = await createReviewUploadBlob(file);
      const storagePath = `${userId}/${reviewId}/${crypto.randomUUID()}.jpg`;
      const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
      const uploadResponse = await fetch(`${baseUrl}/storage/v1/object/review-photos/${encodedPath}`, {
        method: "POST",
        headers: { ...supabaseHeaders(), "Content-Type": "image/jpeg", "x-upsert": "false" },
        body: blob,
      });
      if (!uploadResponse.ok) throw new Error(`照片上传失败 HTTP ${uploadResponse.status}`);
      uploadedPaths.push(storagePath);
      photoRows.push({ review_id: reviewId, storage_path: storagePath, sort_order: index });
    }
    const photoRecordResponse = await fetch(`${baseUrl}/rest/v1/review_photos`, {
      method: "POST",
      headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(photoRows),
    });
    if (!photoRecordResponse.ok) throw new Error(`照片记录保存失败 HTTP ${photoRecordResponse.status}`);

    elements.submitReview.textContent = "正在安全检查…";
    let moderationResult;
    try {
      moderationResult = await requestReviewModeration(reviewId);
    } catch (moderationError) {
      cloudReviewCache.delete(reviewCacheKey(item));
      closeReviewModal();
      showToast("评价已保存，自动检查暂时繁忙；再次打开该品目时会自动重试。");
      console.warn("[review] automatic moderation unavailable", moderationError);
      return;
    }

    cloudReviewCache.delete(reviewCacheKey(item));
    if (moderationResult.status === "rejected") {
      reviewId = "";
      uploadedPaths.length = 0;
      throw new Error("CONTENT_REJECTED");
    }
    closeReviewModal();
    showToast("评价已通过自动检查并发布。 ");
  } catch (error) {
    await discardReviewDraft(reviewId, uploadedPaths);
    const message = error.message === "DUPLICATE_REVIEW"
      ? "每个品目目前限写一条评价；编辑功能即将开放。"
      : error.message === "CONTENT_REJECTED"
        ? "评价包含不适合公开的色情或暴力内容，请修改后重试。"
        : "评价提交失败，请检查照片后重试。 ";
    showToast(message);
    console.warn("[review] submit failed", error);
  } finally {
    elements.submitReview.disabled = false;
    elements.submitReview.textContent = "提交评价";
  }
}

function createReviewUploadBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("照片解析失败"));
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("照片压缩失败")), "image/jpeg", 0.82);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function discardReviewDraft(reviewId, storagePaths) {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !authSession) return;
  const baseUrl = config.url.replace(/\/$/, "");
  await Promise.allSettled(storagePaths.map((storagePath) => {
    const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
    return fetch(`${baseUrl}/storage/v1/object/review-photos/${encodedPath}`, { method: "DELETE", headers: supabaseHeaders() });
  }));
  if (reviewId) {
    await fetch(`${baseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(reviewId)}`, { method: "DELETE", headers: supabaseHeaders() }).catch(() => {});
  }
}

function activateModal(modal, focusTarget) {
  lastFocusedElement = document.activeElement;
  [...document.body.children].forEach((child) => {
    if (child !== modal) child.setAttribute("inert", "");
    else child.removeAttribute("inert");
  });
  modal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => focusTarget.focus(), 0);
}

function deactivateModal(modal) {
  modal.hidden = true;
  [...document.body.children].forEach((child) => child.removeAttribute("inert"));
  document.body.classList.remove("modal-open");
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  lastFocusedElement = null;
}

function trapModalFocus(event, modal) {
  const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')]
    .filter((element) => !element.hidden && element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
  if (files.some((file) => !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024)) {
    elements.photo.value = "";
    showToast("请选择图片文件，每张不超过 12MB。 ");
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

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

init();
