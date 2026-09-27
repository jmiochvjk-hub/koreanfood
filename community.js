(() => {
  "use strict";

  const CHANNEL_LABELS = { food: "美食", beauty: "美妆", life: "生活", fashion: "潮流" };
  const state = {
    view: "discover",
    filter: "all",
    posts: [],
    postsLoaded: false,
    postsLoading: false,
    postsLoadError: false,
    postPhotoUrls: [],
    linkMap: new Map(),
    linkSearchTimer: null,
    linkSearchRequest: 0,
    activePost: null,
  };

  const ui = {
    viewButtons: document.querySelectorAll("[data-app-view]"),
    viewPanels: document.querySelectorAll("[data-view-panel]"),
    headerSearch: document.querySelector(".global-search"),
    mobilePublishLabel: document.querySelector("#mobilePublishLabel"),
    communityFilters: document.querySelector("#communityFilters"),
    communityFeed: document.querySelector("#communityFeed"),
    communityEmpty: document.querySelector("#communityEmpty"),
    openPost: document.querySelector("#openPostComposerButton"),
    emptyPost: document.querySelector("#emptyPostButton"),
    postModal: document.querySelector("#postModal"),
    postBackdrop: document.querySelector("#postBackdrop"),
    closePost: document.querySelector("#closePostButton"),
    cancelPost: document.querySelector("#cancelPostButton"),
    postForm: document.querySelector("#postForm"),
    postChannel: document.querySelector("#postChannel"),
    postPhotos: document.querySelector("#postPhotos"),
    postPhotoPreview: document.querySelector("#postPhotoPreview"),
    postTitle: document.querySelector("#postTitle"),
    postBody: document.querySelector("#postBody"),
    postLink: document.querySelector("#postLinkInput"),
    postLinkSuggestions: document.querySelector("#postLinkSuggestions"),
    submitPost: document.querySelector("#submitPostButton"),
    postDetailModal: document.querySelector("#postDetailModal"),
    postDetailBackdrop: document.querySelector("#postDetailBackdrop"),
    closePostDetail: document.querySelector("#closePostDetailButton"),
    postDetailGallery: document.querySelector("#postDetailGallery"),
    postDetailMeta: document.querySelector("#postDetailMeta"),
    postDetailTitle: document.querySelector("#postDetailTitle"),
    postDetailBody: document.querySelector("#postDetailBody"),
    postDetailLinked: document.querySelector("#postDetailLinkedButton"),
    askForm: document.querySelector("#askForm"),
    askInput: document.querySelector("#askInput"),
    askSubmit: document.querySelector("#askSubmitButton"),
    askExamples: document.querySelector(".ask-examples"),
    askResult: document.querySelector("#askResult"),
    askAnswer: document.querySelector("#askAnswer"),
    askSources: document.querySelector("#askSourceList"),
    askAgain: document.querySelector("#askAgainButton"),
    skipLink: document.querySelector("#skipLink"),
    searchCommunity: document.querySelector("#siteSearchCommunity"),
    searchCommunityCount: document.querySelector("#siteSearchCommunityCount"),
    searchCommunityResults: document.querySelector("#siteSearchCommunityResults"),
  };

  ui.viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.appView, true)));
  ui.openPost.addEventListener("click", openPostComposer);
  ui.emptyPost.addEventListener("click", openPostComposer);
  ui.postBackdrop.addEventListener("click", closePostComposer);
  ui.closePost.addEventListener("click", closePostComposer);
  ui.cancelPost.addEventListener("click", closePostComposer);
  ui.postPhotos.addEventListener("change", previewPostPhotos);
  ui.postLink.addEventListener("input", () => {
    window.clearTimeout(state.linkSearchTimer);
    const query = ui.postLink.value.trim();
    if (!query) {
      refreshPostLinkSuggestions();
      return;
    }
    state.linkSearchTimer = window.setTimeout(() => searchPostLinkSuggestions(query), 220);
  });
  ui.postForm.addEventListener("submit", submitPost);
  ui.postDetailBackdrop.addEventListener("click", closePostDetail);
  ui.closePostDetail.addEventListener("click", closePostDetail);
  ui.communityFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-post-channel]");
    if (!button) return;
    state.filter = button.dataset.postChannel;
    ui.communityFilters.querySelectorAll("button").forEach((entry) => {
      const active = entry === button;
      entry.classList.toggle("is-active", active);
      entry.setAttribute("aria-pressed", String(active));
    });
    renderCommunityFeed();
  });
  ui.askForm.addEventListener("submit", askQuestion);
  ui.askExamples.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    ui.askInput.value = button.textContent.trim();
    ui.askForm.requestSubmit();
  });
  ui.askAgain.addEventListener("click", () => {
    ui.askResult.hidden = true;
    ui.askInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  elements.search.addEventListener("input", () => {
    const query = elements.search.value.trim();
    if (query && state.view !== "discover") setView("discover", true);
    renderSiteSearchPosts(query);
    if (query && !state.postsLoaded && !state.postsLoading) loadCommunityPosts();
  });
  window.addEventListener("popstate", syncViewFromLocation);
  window.addEventListener("hashchange", syncViewFromLocation);
  document.addEventListener("keydown", (event) => {
    const modal = !ui.postModal.hidden ? ui.postModal : (!ui.postDetailModal.hidden ? ui.postDetailModal : null);
    if (!modal) return;
    if (event.key === "Escape") {
      if (modal === ui.postModal) closePostComposer();
      else closePostDetail();
      return;
    }
    if (event.key === "Tab") trapModalFocus(event, modal);
  });

  function viewFromHash() {
    if (location.hash === "#community") return "community";
    if (location.hash === "#ask") return "ask";
    return "discover";
  }

  function syncViewFromLocation() {
    setView(viewFromHash(), false);
  }

  function setView(view, updateHistory) {
    const next = ["discover", "community", "ask"].includes(view) ? view : "discover";
    if (updateHistory) {
      const hash = next === "discover" ? "" : `#${next}`;
      history.pushState({ view: next }, "", `${location.pathname}${location.search}${hash}`);
    }
    state.view = next;
    window.BANFAN_ACTIVE_VIEW = next;
    let activePanel = null;
    ui.viewPanels.forEach((panel) => {
      const active = panel.dataset.viewPanel === next;
      panel.hidden = !active;
      if (active) activePanel = panel;
    });
    ui.viewButtons.forEach((button) => {
      const active = button.dataset.appView === next;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    ui.headerSearch.hidden = next !== "discover";
    if (ui.skipLink && activePanel) ui.skipLink.href = `#${activePanel.id}`;
    ui.mobilePublishLabel.textContent = next === "community" ? "发帖子" : "写评价";
    document.body.dataset.appView = next;
    if (next === "community") loadCommunityPosts();
    window.scrollTo({ top: 0, behavior: updateHistory ? "smooth" : "auto" });
    if (updateHistory && activePanel) activePanel.focus({ preventScroll: true });
  }

  function openPostComposer() {
    if (!requireUser()) return;
    refreshPostLinkSuggestions();
    activateModal(ui.postModal, ui.postTitle);
  }
  window.openCommunityComposer = openPostComposer;

  function closePostComposer() {
    deactivateModal(ui.postModal);
    clearPostPreview();
    ui.postForm.reset();
  }

  function previewPostPhotos() {
    clearPostPreview();
    const files = [...(ui.postPhotos.files || [])];
    if (!files.length) return;
    if (files.length > 9 || files.some((file) => !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024)) {
      ui.postPhotos.value = "";
      showToast(files.length > 9 ? "一次最多上传 9 张照片。" : "请选择图片文件，每张不超过 12MB。");
      return;
    }
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      state.postPhotoUrls.push(url);
      const image = document.createElement("img");
      image.src = url;
      image.alt = `待发布照片预览 ${index + 1}`;
      ui.postPhotoPreview.append(image);
    });
    ui.postPhotoPreview.hidden = false;
  }

  function clearPostPreview() {
    state.postPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    state.postPhotoUrls = [];
    ui.postPhotoPreview.replaceChildren();
    ui.postPhotoPreview.hidden = true;
  }

  function refreshPostLinkSuggestions() {
    state.linkMap.clear();
    ui.postLinkSuggestions.replaceChildren();
    allCatalogItems().forEach((item) => {
      const label = `${item.title} · ${CHANNEL_LABELS[item.channel] || "品目"}`;
      state.linkMap.set(label, item);
      const option = document.createElement("option");
      option.value = label;
      ui.postLinkSuggestions.append(option);
    });
  }

  async function searchPostLinkSuggestions(query) {
    if (typeof window.searchBanfanCatalog !== "function") return;
    const requestId = ++state.linkSearchRequest;
    try {
      const items = await window.searchBanfanCatalog(query, 60);
      if (requestId !== state.linkSearchRequest || ui.postLink.value.trim() !== query) return;
      state.linkMap.clear();
      ui.postLinkSuggestions.replaceChildren();
      items.forEach((item) => {
        const label = `${item.title} · ${CHANNEL_LABELS[item.channel] || "品目"} · ${item.brand || item.category || ""}`;
        state.linkMap.set(label, item);
        const option = document.createElement("option");
        option.value = label;
        ui.postLinkSuggestions.append(option);
      });
    } catch (error) {
      console.error("[community] linked item search failed", error);
    }
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!requireUser()) return;
    const files = [...(ui.postPhotos.files || [])];
    if (!files.length) {
      showToast("社区图文至少需要 1 张真实照片。");
      ui.postPhotos.focus();
      return;
    }
    if (files.length > 9 || files.some((file) => !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024)) {
      showToast("请选择 1–9 张图片，每张不超过 12MB。");
      return;
    }
    const config = window.SUPABASE_CONFIG || {};
    await refreshAuthSessionIfNeeded();
    const userId = authSession?.user?.id || parseJwt(authSession?.access_token || "").sub;
    if (!config.url || !userId || !authSession?.access_token) {
      showToast("登录状态已失效，请重新登录。");
      return;
    }
    const linked = state.linkMap.get(ui.postLink.value.trim());
    const linkFields = linked?.kind === "place" && linked.canonicalPlaceId
      ? { linked_place_id: linked.canonicalPlaceId }
      : linked?.kind === "product" ? { linked_item_id: linked.id } : {};
    ui.submitPost.disabled = true;
    ui.submitPost.textContent = "正在上传…";
    let postId = "";
    const uploadedPaths = [];
    try {
      const baseUrl = config.url.replace(/\/$/, "");
      const postResponse = await window.banfanFetch(`${baseUrl}/rest/v1/community_posts`, {
        method: "POST",
        headers: { ...supabaseHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          channel: ui.postChannel.value,
          title: ui.postTitle.value.trim(),
          body: ui.postBody.value.trim(),
          moderation_status: "pending",
          ...linkFields,
        }),
      }, 20_000);
      if (!postResponse.ok) throw new Error(await postResponse.text() || `HTTP ${postResponse.status}`);
      postId = (await postResponse.json())[0]?.id || "";
      if (!postId) throw new Error("POST_CREATE_FAILED");

      const photoRows = [];
      for (const [index, file] of files.entries()) {
        const blob = await createReviewUploadBlob(file);
        const storagePath = `${userId}/${postId}/${crypto.randomUUID()}.jpg`;
        const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
        const uploadResponse = await window.banfanFetch(`${baseUrl}/storage/v1/object/community-posts/${encodedPath}`, {
          method: "POST",
          headers: { ...supabaseHeaders(), "Content-Type": "image/jpeg", "x-upsert": "false" },
          body: blob,
        }, 60_000);
        if (!uploadResponse.ok) throw new Error(`PHOTO_UPLOAD_${uploadResponse.status}`);
        uploadedPaths.push(storagePath);
        photoRows.push({ post_id: postId, storage_path: storagePath, sort_order: index });
      }
      const photoResponse = await window.banfanFetch(`${baseUrl}/rest/v1/community_post_photos`, {
        method: "POST",
        headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(photoRows),
      }, 20_000);
      if (!photoResponse.ok) throw new Error(`PHOTO_RECORD_${photoResponse.status}`);

      ui.submitPost.textContent = "正在安全检查…";
      const moderation = await requestPostModeration(postId);
      if (moderation.status === "rejected") {
        postId = "";
        uploadedPaths.length = 0;
        throw new Error("CONTENT_REJECTED");
      }
      closePostComposer();
      await loadCommunityPosts(true);
      showToast("图文已通过自动检查并发布。");
    } catch (error) {
      if (error.message === "MODERATION_UNAVAILABLE") {
        closePostComposer();
        await loadCommunityPosts(true);
        showToast("图文已保存，自动检查繁忙；稍后会再次尝试。");
      } else {
        await discardPostDraft(postId, uploadedPaths);
        showToast(error.message === "CONTENT_REJECTED" ? "内容包含不适合公开的色情或暴力信息，请修改后重试。" : "发布失败，请检查照片和文字后重试。");
        console.warn("[community] post failed", error);
      }
    } finally {
      ui.submitPost.disabled = false;
      ui.submitPost.textContent = "发布图文";
    }
  }

  async function requestPostModeration(postId) {
    const config = window.SUPABASE_CONFIG || {};
    const response = await window.banfanFetch(`${config.url.replace(/\/$/, "")}/functions/v1/moderate-community-post`, {
      method: "POST",
      headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    }, 55_000);
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 503 ? "MODERATION_UNAVAILABLE" : (value.code || `HTTP_${response.status}`));
      throw error;
    }
    return value;
  }

  async function discardPostDraft(postId, storagePaths) {
    if (!postId || !authSession) return;
    const baseUrl = window.SUPABASE_CONFIG.url.replace(/\/$/, "");
    await Promise.allSettled(storagePaths.map((path) => {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      return fetch(`${baseUrl}/storage/v1/object/community-posts/${encodedPath}`, { method: "DELETE", headers: supabaseHeaders() });
    }));
    await fetch(`${baseUrl}/rest/v1/community_posts?id=eq.${encodeURIComponent(postId)}`, { method: "DELETE", headers: supabaseHeaders() }).catch(() => {});
  }

  async function loadCommunityPosts(force = false) {
    if (!force && state.postsLoaded) {
      renderCommunityFeed();
      renderSiteSearchPosts(elements.search.value.trim());
      return;
    }
    if (!force && state.postsLoading) return;
    state.postsLoading = true;
    state.postsLoadError = false;
    ui.communityFeed.setAttribute("aria-busy", "true");
    ui.communityFeed.innerHTML = '<div class="community-loading">正在整理大家的最新发现…</div>';
    renderSiteSearchPosts(elements.search.value.trim());
    const config = window.SUPABASE_CONFIG || {};
    try {
      const fields = "id,user_id,channel,title,body,linked_item_id,linked_place_id,moderation_status,created_at,cover_storage_path,photo_count,linked_title";
      const response = await window.banfanFetch(`${config.url.replace(/\/$/, "")}/rest/v1/community_post_cards?select=${fields}&order=created_at.desc&limit=48`, { headers: supabaseHeaders() }, 20_000);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const rows = await response.json();
      state.posts = await Promise.all(rows.map(async (post) => ({ ...post, coverUrl: await signedPostPhoto(post.cover_storage_path) })));
      state.postsLoaded = true;
      renderCommunityFeed();
      renderSiteSearchPosts(elements.search.value.trim());
      const ownPending = state.posts.filter((post) => post.moderation_status === "pending" && post.user_id === authSession?.user?.id);
      ownPending.forEach(async (post) => {
        try {
          const result = await requestPostModeration(post.id);
          if (["published", "rejected"].includes(result.status)) await loadCommunityPosts(true);
        } catch { /* Remains private and can retry on the next visit. */ }
      });
    } catch (error) {
      state.postsLoadError = true;
      const errorBox = document.createElement("div");
      errorBox.className = "community-loading";
      errorBox.textContent = "社区暂时没有连接上。";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重新加载";
      retry.addEventListener("click", () => loadCommunityPosts(true));
      errorBox.append(retry);
      ui.communityFeed.replaceChildren(errorBox);
      ui.communityEmpty.hidden = true;
      renderSiteSearchPosts(elements.search.value.trim());
      console.warn("[community] feed failed", error);
    } finally {
      state.postsLoading = false;
      ui.communityFeed.setAttribute("aria-busy", "false");
      renderSiteSearchPosts(elements.search.value.trim());
    }
  }

  function renderSiteSearchPosts(rawQuery) {
    const query = String(rawQuery || "").trim().toLowerCase();
    if (!ui.searchCommunity || !ui.searchCommunityResults) return;
    ui.searchCommunity.hidden = !query;
    if (!query) return;
    ui.searchCommunityResults.replaceChildren();
    if (state.postsLoading && !state.postsLoaded) {
      ui.searchCommunityCount.textContent = "搜索中";
      const loading = document.createElement("p");
      loading.className = "site-search-empty";
      loading.textContent = "正在搜索社区图文…";
      ui.searchCommunityResults.append(loading);
      return;
    }
    if (state.postsLoadError) {
      ui.searchCommunityCount.textContent = "暂时不可用";
      const error = document.createElement("p");
      error.className = "site-search-empty";
      error.textContent = "社区内容暂时无法连接；商品和地点搜索仍可使用。";
      ui.searchCommunityResults.append(error);
      return;
    }
    const posts = state.posts.filter((post) => [post.title, post.body, post.linked_title, CHANNEL_LABELS[post.channel]]
      .filter(Boolean).join(" ").toLowerCase().includes(query));
    ui.searchCommunityCount.textContent = `${posts.length} 篇`;
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "site-search-empty";
      empty.textContent = "社区暂时没有匹配的图文。";
      ui.searchCommunityResults.append(empty);
      return;
    }
    posts.slice(0, 6).forEach((post) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "site-search-post";
      if (post.coverUrl) {
        const image = document.createElement("img");
        image.src = post.coverUrl;
        image.alt = "";
        image.loading = "lazy";
        button.append(image);
      } else {
        const placeholder = document.createElement("span");
        placeholder.textContent = CHANNEL_LABELS[post.channel] || "分享";
        button.append(placeholder);
      }
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = post.title;
      const meta = document.createElement("small");
      meta.textContent = `${CHANNEL_LABELS[post.channel] || "发现"} · ${formatDate(post.created_at)}`;
      copy.append(title, meta);
      button.append(copy);
      button.addEventListener("click", async () => {
        setView("community", true);
        await openPostDetail(post);
      });
      ui.searchCommunityResults.append(button);
    });
  }
  window.syncBanfanSiteSearch = renderSiteSearchPosts;

  function renderCommunityFeed() {
    const posts = state.filter === "all" ? state.posts : state.posts.filter((post) => post.channel === state.filter);
    ui.communityFeed.replaceChildren();
    ui.communityEmpty.hidden = posts.length > 0;
    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "community-card";
      const button = document.createElement("button");
      button.className = "community-card-open";
      button.type = "button";
      button.setAttribute("aria-label", `查看帖子：${post.title}`);
      const media = document.createElement("span");
      media.className = "community-card-media";
      if (post.coverUrl) {
        const image = document.createElement("img");
        image.src = post.coverUrl;
        image.alt = `${post.title} 的照片`;
        image.loading = "lazy";
        image.decoding = "async";
        media.append(image);
      } else {
        const placeholder = document.createElement("span");
        placeholder.textContent = CHANNEL_LABELS[post.channel] || "分享";
        media.append(placeholder);
      }
      const copy = document.createElement("span");
      copy.className = "community-card-copy";
      const meta = document.createElement("span");
      meta.className = "community-card-meta";
      meta.textContent = `${CHANNEL_LABELS[post.channel] || "发现"} · ${formatDate(post.created_at)}${Number(post.photo_count) > 1 ? ` · ${post.photo_count} 张` : ""}`;
      const title = document.createElement("strong");
      title.textContent = post.title;
      const body = document.createElement("span");
      body.textContent = post.body;
      copy.append(meta, title, body);
      if (post.linked_title) {
        const linked = document.createElement("small");
        linked.textContent = `关联 · ${post.linked_title}`;
        copy.append(linked);
      }
      if (post.moderation_status === "pending") {
        const pending = document.createElement("small");
        pending.className = "community-pending";
        pending.textContent = "仅你可见 · 自动检查中";
        copy.append(pending);
      }
      button.append(media, copy);
      button.addEventListener("click", () => openPostDetail(post));
      card.append(button);
      ui.communityFeed.append(card);
    });
  }

  async function signedPostPhoto(storagePath) {
    if (!storagePath) return "";
    const config = window.SUPABASE_CONFIG || {};
    const encodedPath = String(storagePath).split("/").map(encodeURIComponent).join("/");
    const response = await window.banfanFetch(`${config.url.replace(/\/$/, "")}/storage/v1/object/sign/community-posts/${encodedPath}`, {
      method: "POST",
      headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    }, 15_000);
    if (!response.ok) return "";
    const value = await response.json();
    const path = value.signedURL || value.signedUrl || "";
    if (path.startsWith("http")) return path;
    return path.startsWith("/storage/v1") ? `${config.url}${path}` : `${config.url}/storage/v1${path}`;
  }

  async function openPostDetail(postOrId) {
    let post = typeof postOrId === "string" ? state.posts.find((entry) => entry.id === postOrId) : postOrId;
    if (!post) {
      await loadCommunityPosts(true);
      post = state.posts.find((entry) => entry.id === postOrId);
    }
    if (!post) {
      showToast("这篇帖子暂时无法打开。");
      return;
    }
    state.activePost = post;
    ui.postDetailMeta.textContent = `${CHANNEL_LABELS[post.channel] || "发现"} · ${formatDate(post.created_at)}`;
    ui.postDetailTitle.textContent = post.title;
    ui.postDetailBody.textContent = post.body;
    ui.postDetailGallery.innerHTML = '<span class="post-detail-loading">正在读取照片…</span>';
    const linkedItem = allCatalogItems().find((item) => item.id === post.linked_item_id || item.canonicalPlaceId === post.linked_place_id);
    ui.postDetailLinked.hidden = !linkedItem;
    ui.postDetailLinked.textContent = linkedItem ? `查看关联品目：${linkedItem.title} →` : "";
    ui.postDetailLinked.onclick = linkedItem ? () => { closePostDetail(); openDetailModal(linkedItem); } : null;
    activateModal(ui.postDetailModal, ui.closePostDetail);
    await loadPostPhotos(post.id);
  }

  async function loadPostPhotos(postId) {
    const config = window.SUPABASE_CONFIG || {};
    try {
      const response = await window.banfanFetch(`${config.url.replace(/\/$/, "")}/rest/v1/community_post_photos?select=storage_path,sort_order&post_id=eq.${encodeURIComponent(postId)}&order=sort_order.asc`, { headers: supabaseHeaders() }, 20_000);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const rows = await response.json();
      const urls = await Promise.all(rows.map((row) => signedPostPhoto(row.storage_path)));
      ui.postDetailGallery.replaceChildren();
      urls.filter(Boolean).forEach((url, index) => {
        const image = document.createElement("img");
        image.src = url;
        image.alt = `${state.activePost.title} 照片 ${index + 1}`;
        ui.postDetailGallery.append(image);
      });
    } catch {
      ui.postDetailGallery.innerHTML = '<span class="post-detail-loading">照片暂时无法加载。</span>';
    }
  }

  function closePostDetail() {
    deactivateModal(ui.postDetailModal);
    state.activePost = null;
  }

  async function askQuestion(event) {
    event.preventDefault();
    const question = ui.askInput.value.trim();
    if (question.length < 2) return;
    const config = window.SUPABASE_CONFIG || {};
    ui.askSubmit.disabled = true;
    ui.askSubmit.textContent = "正在站内查找…";
    ui.askResult.hidden = false;
    ui.askResult.setAttribute("aria-busy", "true");
    ui.askAnswer.textContent = "正在阅读站内商品、地点、评价和帖子…";
    ui.askSources.replaceChildren();
    try {
      const response = await window.banfanFetch(`${config.url.replace(/\/$/, "")}/functions/v1/ask-banfan`, {
        method: "POST",
        headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      }, 40_000);
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || "问一问暂时不可用。");
      ui.askAnswer.textContent = value.answer || "站内暂时没有足够内容回答这个问题。";
      renderAskSources(value.sources || []);
      ui.askResult.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      ui.askAnswer.textContent = error.message || "问一问暂时不可用，请稍后再试。";
    } finally {
      ui.askResult.setAttribute("aria-busy", "false");
      ui.askSubmit.disabled = false;
      ui.askSubmit.textContent = "在站内找答案";
    }
  }

  function renderAskSources(sources) {
    ui.askSources.replaceChildren();
    if (!sources.length) {
      const empty = document.createElement("p");
      empty.textContent = "这次没有找到足够的站内依据。";
      ui.askSources.append(empty);
      return;
    }
    sources.forEach((source, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ask-source";
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = source.title;
      const subtitle = document.createElement("small");
      subtitle.textContent = source.subtitle || (source.type === "post" ? "社区图文" : "站内品目");
      copy.append(title, subtitle);
      button.append(number);
      if (source.imageUrl) {
        const image = document.createElement("img");
        image.src = source.imageUrl;
        image.alt = "";
        image.loading = "lazy";
        button.append(image);
      }
      button.append(copy);
      button.addEventListener("click", () => openAskSource(source));
      ui.askSources.append(button);
    });
  }

  async function openAskSource(source) {
    if (source.type === "post") {
      setView("community", true);
      await openPostDetail(source.id);
      return;
    }
    const item = allCatalogItems().find((candidate) => candidate.id === source.id || candidate.canonicalPlaceId === source.id);
    if (item) {
      setView("discover", true);
      if (item.channel && item.channel !== currentChannel) switchChannel(item.channel);
      openDetailModal(item);
      return;
    }
    showToast("这个依据正在同步到详情页，请稍后再试。");
  }

  window.openCommunityPost = openPostDetail;
  setView(viewFromHash(), false);
})();
