(function () {
  const catalog = window.APP_CATALOG?.products ?? [];
  const meta = window.APP_CATALOG?.meta ?? {};

  const storageKeys = {
    cart: "toymakers-cart",
    user: "toymakers-user",
    orders: "toymakers-orders",
  };

  const state = {
    catalog,
    activeFilter: "Все",
    search: "",
    cart: loadJson(storageKeys.cart, {}),
    user: loadJson(storageKeys.user, null),
    orders: loadJson(storageKeys.orders, []),
    activeProductId: catalog[0]?.id ?? null,
    activeGalleryIndex: 0,
    pendingCheckout: false,
    filterOptions: buildFilterOptions(catalog),
  };

  const refs = {
    heroStats: document.getElementById("heroStats"),
    heroProductCard: document.getElementById("heroProductCard"),
    searchInput: document.getElementById("searchInput"),
    filterRow: document.getElementById("filterRow"),
    catalogMeta: document.getElementById("catalogMeta"),
    productGrid: document.getElementById("productGrid"),
    overlay: document.getElementById("overlay"),
    cartDrawer: document.getElementById("cartDrawer"),
    cartItems: document.getElementById("cartItems"),
    cartTotal: document.getElementById("cartTotal"),
    cartCount: document.getElementById("cartCount"),
    authButtonText: document.getElementById("authButtonText"),
    authModal: document.getElementById("authModal"),
    authForm: document.getElementById("authForm"),
    productModal: document.getElementById("productModal"),
    productModalContent: document.getElementById("productModalContent"),
    checkoutModal: document.getElementById("checkoutModal"),
    checkoutForm: document.getElementById("checkoutForm"),
    checkoutItems: document.getElementById("checkoutItems"),
    checkoutTotal: document.getElementById("checkoutTotal"),
    toastStack: document.getElementById("toastStack"),
    authOpenButton: document.getElementById("authOpenButton"),
    cartToggleButton: document.getElementById("cartToggleButton"),
    cartCloseButton: document.getElementById("cartCloseButton"),
    cartCheckoutButton: document.getElementById("cartCheckoutButton"),
    heroCheckoutButton: document.getElementById("heroCheckoutButton"),
  };

  init();

  function init() {
    bindEvents();
    renderAll();
    setupRevealAnimations();
  }

  function bindEvents() {
    refs.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      renderCatalog();
    });

    refs.filterRow.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.activeFilter = button.dataset.filter;
      renderCatalog();
    });

    refs.productGrid.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add-to-cart]");
      const detailsButton = event.target.closest("[data-open-product]");

      if (addButton) {
        addToCart(Number(addButton.dataset.addToCart), 1);
      }

      if (detailsButton) {
        openProductModal(Number(detailsButton.dataset.openProduct));
      }
    });

    refs.heroProductCard.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-hero-open]");
      const addButton = event.target.closest("[data-hero-add]");
      if (openButton) {
        openProductModal(Number(openButton.dataset.heroOpen));
      }
      if (addButton) {
        addToCart(Number(addButton.dataset.heroAdd), 1);
      }
    });

    refs.cartToggleButton.addEventListener("click", () => openCart());
    refs.cartCloseButton.addEventListener("click", closeAllPanels);
    refs.overlay.addEventListener("click", closeAllPanels);
    refs.authOpenButton.addEventListener("click", () => openAuthModal());
    refs.heroCheckoutButton.addEventListener("click", beginCheckout);
    refs.cartCheckoutButton.addEventListener("click", beginCheckout);
    refs.productModalContent.addEventListener("click", handleProductModalDelegatedClick);

    document.addEventListener("click", (event) => {
      const closeButton = event.target.closest("[data-close-modal]");
      if (closeButton) {
        closeAllPanels();
      }
    });

    refs.cartItems.addEventListener("click", (event) => {
      const control = event.target.closest("[data-cart-action]");
      if (!control) return;

      const id = Number(control.dataset.id);
      const action = control.dataset.cartAction;
      const currentQty = state.cart[id] ?? 0;

      if (action === "increase") {
        addToCart(id, 1);
      }

      if (action === "decrease") {
        setCartQty(id, currentQty - 1);
      }

      if (action === "remove") {
        setCartQty(id, 0);
      }
    });

    refs.authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(refs.authForm);
      state.user = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
      };
      persistState(storageKeys.user, state.user);
      refs.checkoutForm.elements.customerName.value = state.user.name || "";
      refs.checkoutForm.elements.customerEmail.value = state.user.email || "";
      refs.checkoutForm.elements.customerPhone.value = state.user.phone || "";
      renderAccount();
      showToast("Профиль сохранён", "Теперь можно быстро оформить заказ.");

      if (state.pendingCheckout) {
        state.pendingCheckout = false;
        openCheckoutModal();
      } else {
        closeAllPanels();
      }
    });

    refs.checkoutForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!getCartItems().length) {
        showToast("Корзина пуста", "Добавьте товары, чтобы оформить заказ.");
        closeAllPanels();
        return;
      }

      const formData = new FormData(refs.checkoutForm);
      const order = {
        id: `TM-${String(Date.now()).slice(-6)}`,
        createdAt: new Date().toISOString(),
        customer: {
          name: String(formData.get("customerName") || "").trim(),
          email: String(formData.get("customerEmail") || "").trim(),
          phone: String(formData.get("customerPhone") || "").trim(),
        },
        deliveryMethod: String(formData.get("deliveryMethod") || "delivery"),
        address: String(formData.get("address") || "").trim(),
        comment: String(formData.get("comment") || "").trim(),
        items: getCartItems().map((item) => ({
          id: item.product.id,
          name: item.product.name,
          qty: item.qty,
          price: item.product.price,
        })),
        total: getCartTotal(),
      };

      state.orders.unshift(order);
      persistState(storageKeys.orders, state.orders);
      state.cart = {};
      persistState(storageKeys.cart, state.cart);
      refs.checkoutForm.reset();
      closeAllPanels();
      renderCart();
      showToast(
        `Заказ ${order.id} создан`,
        `Сумма заказа: ${formatPrice(order.total)}. Данные сохранены в браузере.`,
      );
    });
  }

  function renderAll() {
    renderAccount();
    renderHero();
    renderFilters();
    renderCatalog();
    renderCart();
    hydrateCheckoutForm();
  }

  function renderAccount() {
    refs.authButtonText.textContent = state.user?.name ? state.user.name : "Войти";
  }

  function renderHero() {
    const topProduct =
      [...state.catalog].sort((left, right) => {
        if (right.reviews !== left.reviews) return right.reviews - left.reviews;
        return left.price - right.price;
      })[0] ?? state.catalog[0];

    refs.heroStats.innerHTML = [
      {
        value: meta.productCount || state.catalog.length,
        label: "товара уже на витрине",
      },
      {
        value: formatPrice(
          Math.min(...state.catalog.map((product) => product.price || Number.MAX_SAFE_INTEGER)),
        ),
        label: "стартовая цена",
      },
      {
        value: "PLA",
        label: "безопасный материал",
      },
    ]
      .map(
        (item) => `
          <article class="stat-card">
            <strong>${escapeHtml(String(item.value))}</strong>
            <span>${escapeHtml(item.label)}</span>
          </article>
        `,
      )
      .join("");

    if (!topProduct) {
      refs.heroProductCard.innerHTML = "";
      return;
    }

    refs.heroProductCard.innerHTML = `
      <article class="hero-product__card">
        <div class="hero-product__image-wrap">
          <img src="${escapeHtml(topProduct.primaryImage)}" alt="${escapeHtml(topProduct.name)}" />
        </div>
        <div class="hero-product__badge-row">
          ${topProduct.tags
            .slice(0, 3)
            .map((tag) => `<span class="badge badge--accent">${escapeHtml(tag)}</span>`)
            .join("")}
        </div>
        <div class="hero-product__title">
          <div>
            <p class="eyebrow">${escapeHtml(topProduct.category)}</p>
            <h2>${escapeHtml(topProduct.name)}</h2>
          </div>
          <div class="hero-product__price">
            <span class="price-main">${formatPrice(topProduct.price)}</span>
            <span class="price-old">${formatPrice(topProduct.oldPrice)}</span>
          </div>
        </div>
        <p class="hero__lead">${escapeHtml(topProduct.excerpt)}</p>
        <div class="hero__actions">
          <button class="primary-button" data-hero-add="${topProduct.id}" type="button">
            В корзину
          </button>
          <button class="secondary-button" data-hero-open="${topProduct.id}" type="button">
            Открыть карточку
          </button>
        </div>
      </article>
    `;
  }

  function renderFilters() {
    refs.filterRow.innerHTML = state.filterOptions
      .map((filter) => {
        const activeClass = filter === state.activeFilter ? " is-active" : "";
        return `
          <button class="chip${activeClass}" type="button" data-filter="${escapeHtml(filter)}">
            ${escapeHtml(filter)}
          </button>
        `;
      })
      .join("");
  }

  function renderCatalog() {
    renderFilters();
    const items = getFilteredProducts();

    refs.catalogMeta.innerHTML = [
      `${items.length} товаров найдено`,
      state.activeFilter === "Все" ? "Все категории" : state.activeFilter,
      state.search ? `Поиск: ${state.search}` : "Каталог синхронизирован с WB",
    ]
      .filter(Boolean)
      .map((text) => `<span class="catalog-meta__item">${escapeHtml(text)}</span>`)
      .join("");

    if (!items.length) {
      refs.productGrid.innerHTML = `
        <article class="about-card empty-state">
          <h3>Ничего не найдено</h3>
          <p>Попробуйте другой запрос или сбросьте фильтр, чтобы увидеть весь каталог ToyMakers.</p>
        </article>
      `;
      return;
    }

    refs.productGrid.innerHTML = items
      .map(
        (product) => `
          <article class="product-card">
            <div class="product-card__image-wrap">
              <img src="${escapeHtml(product.primaryImage)}" alt="${escapeHtml(product.name)}" loading="lazy" />
              <div class="product-card__badge-row">
                ${renderBadges(product)}
              </div>
            </div>
            <div class="product-card__body">
              <div class="product-card__topline">
                <div>
                  <p class="eyebrow">${escapeHtml(product.category)}</p>
                  <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
                </div>
                <div class="product-card__price">
                  <span class="price-main">${formatPrice(product.price)}</span>
                  <span class="price-old">${formatPrice(product.oldPrice)}</span>
                </div>
              </div>
              <div class="product-card__rating">★ ${escapeHtml(String(product.rating))} · ${escapeHtml(
                pluralizeReviews(product.reviews),
              )}</div>
              <p class="product-card__excerpt">${escapeHtml(product.excerpt)}</p>
              <div class="product-card__chips">
                ${product.tags
                  .slice(0, 3)
                  .map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`)
                  .join("")}
              </div>
              <div class="product-card__actions">
                <button class="secondary-button" data-open-product="${product.id}" type="button">
                  Подробнее
                </button>
                <button class="primary-button" data-add-to-cart="${product.id}" type="button">
                  В корзину
                </button>
              </div>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function renderCart() {
    const items = getCartItems();
    refs.cartCount.textContent = String(items.reduce((sum, item) => sum + item.qty, 0));
    refs.cartTotal.textContent = formatPrice(getCartTotal());

    if (!items.length) {
      refs.cartItems.innerHTML = `
        <div class="empty-cart">
          <h4>Пока пусто</h4>
          <p>Добавьте несколько 3D-товаров из каталога, и они сразу появятся здесь.</p>
        </div>
      `;
      renderCheckoutSummary();
      return;
    }

    refs.cartItems.innerHTML = items
      .map(
        ({ product, qty }) => `
          <article class="cart-item">
            <div class="cart-item__image">
              <img src="${escapeHtml(product.primaryImage)}" alt="${escapeHtml(product.name)}" />
            </div>
            <div class="cart-item__meta">
              <div>
                <h4>${escapeHtml(product.name)}</h4>
                <div class="product-card__rating">${formatPrice(product.price)} · ${escapeHtml(
                  product.category,
                )}</div>
              </div>
              <div class="cart-item__controls">
                <div class="stepper">
                  <button type="button" data-cart-action="decrease" data-id="${product.id}">−</button>
                  <output>${qty}</output>
                  <button type="button" data-cart-action="increase" data-id="${product.id}">+</button>
                </div>
                <button type="button" data-cart-action="remove" data-id="${product.id}">
                  Удалить
                </button>
              </div>
            </div>
          </article>
        `,
      )
      .join("");

    renderCheckoutSummary();
  }

  function renderCheckoutSummary() {
    const items = getCartItems();
    refs.checkoutItems.innerHTML = items.length
      ? items
          .map(
            ({ product, qty }) => `
              <div class="checkout-item">
                <span>${escapeHtml(product.name)} × ${qty}</span>
                <strong>${formatPrice(product.price * qty)}</strong>
              </div>
            `,
          )
          .join("")
      : `<p class="empty-cart">Корзина пока пуста.</p>`;
    refs.checkoutTotal.textContent = formatPrice(getCartTotal());
  }

  function renderBadges(product) {
    const badges = [];
    if (product.isNew) badges.push("Новинка");
    if (product.reviews >= 50) badges.push("Бестселлер");
    badges.push(product.section);

    return badges
      .slice(0, 2)
      .map((badge) => `<span class="badge badge--ghost">${escapeHtml(badge)}</span>`)
      .join("");
  }

  function openCart() {
    refs.cartDrawer.classList.add("is-open");
    refs.cartDrawer.setAttribute("aria-hidden", "false");
    syncOverlay();
  }

  function openAuthModal() {
    refs.authModal.classList.add("is-open");
    refs.authModal.setAttribute("aria-hidden", "false");
    syncOverlay();
  }

  function openCheckoutModal() {
    hydrateCheckoutForm();
    refs.checkoutModal.classList.add("is-open");
    refs.checkoutModal.setAttribute("aria-hidden", "false");
    syncOverlay();
  }

  function beginCheckout() {
    if (!getCartItems().length) {
      showToast("Корзина пуста", "Сначала добавьте товары из каталога.");
      return;
    }

    if (!state.user) {
      state.pendingCheckout = true;
      openAuthModal();
      showToast("Нужен профиль", "Сначала сохраните имя и e-mail, чтобы оформить заказ.");
      return;
    }

    openCheckoutModal();
  }

  function openProductModal(productId) {
    state.activeProductId = productId;
    state.activeGalleryIndex = 0;
    const product = findProduct(productId);
    if (!product) return;

    refs.productModalContent.innerHTML = buildProductModal(product);
    refs.productModal.classList.add("is-open");
    refs.productModal.setAttribute("aria-hidden", "false");
    syncOverlay();
  }

  function handleProductModalDelegatedClick(event) {
    const thumb = event.target.closest("[data-gallery-index]");
    const addButton = event.target.closest("[data-modal-add]");

    if (thumb) {
      const index = Number(thumb.dataset.galleryIndex);
      state.activeGalleryIndex = index;
      const product = findProduct(state.activeProductId);
      if (product) {
        refs.productModalContent.innerHTML = buildProductModal(product);
      }
      return;
    }

    if (addButton) {
      addToCart(Number(addButton.dataset.modalAdd), 1);
    }
  }

  function buildProductModal(product) {
    const activeImage = product.images[state.activeGalleryIndex] || product.primaryImage;
    return `
      <div>
        <div class="product-modal__gallery-main">
          <img src="${escapeHtml(activeImage)}" alt="${escapeHtml(product.name)}" />
        </div>
        <div class="product-modal__thumbs">
          ${product.images
            .map(
              (image, index) => `
                <button
                  class="${index === state.activeGalleryIndex ? "is-active" : ""}"
                  type="button"
                  data-gallery-index="${index}"
                  aria-label="Показать изображение ${index + 1}"
                >
                  <img src="${escapeHtml(image)}" alt="" />
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="product-modal__details">
        <p class="eyebrow">${escapeHtml(product.section)} · ${escapeHtml(product.category)}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <div class="hero-product__price">
          <span class="price-main">${formatPrice(product.price)}</span>
          <span class="price-old">${formatPrice(product.oldPrice)}</span>
        </div>
        <div class="product-card__rating">★ ${escapeHtml(String(product.rating))} · ${escapeHtml(
          pluralizeReviews(product.reviews),
        )}</div>
        <div class="product-card__chips">
          ${product.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <p>${escapeHtml(product.description)}</p>
        <div class="info-grid">
          <div class="info-card">
            <span>Материал</span>
            <strong>${escapeHtml(product.material)}</strong>
          </div>
          <div class="info-card">
            <span>Наличие</span>
            <strong>${escapeHtml(`${product.stock} шт.`)}</strong>
          </div>
          <div class="info-card">
            <span>Артикул</span>
            <strong>${escapeHtml(product.vendorCode || String(product.id))}</strong>
          </div>
          <div class="info-card">
            <span>Источник карточки</span>
            <strong>Wildberries / ToyMakers</strong>
          </div>
        </div>
        <div class="hero__actions">
          <button class="primary-button" data-modal-add="${product.id}" type="button">В корзину</button>
          <a class="secondary-button" href="${escapeHtml(product.url)}" target="_blank" rel="noreferrer">
            Открыть на WB
          </a>
        </div>
      </div>
    `;
  }

  function closeAllPanels() {
    refs.cartDrawer.classList.remove("is-open");
    refs.cartDrawer.setAttribute("aria-hidden", "true");
    refs.productModal.classList.remove("is-open");
    refs.productModal.setAttribute("aria-hidden", "true");
    refs.authModal.classList.remove("is-open");
    refs.authModal.setAttribute("aria-hidden", "true");
    refs.checkoutModal.classList.remove("is-open");
    refs.checkoutModal.setAttribute("aria-hidden", "true");
    refs.overlay.hidden = true;
    state.pendingCheckout = false;
    document.body.classList.remove("is-locked");
  }

  function syncOverlay() {
    const shouldShow =
      refs.cartDrawer.classList.contains("is-open") ||
      refs.productModal.classList.contains("is-open") ||
      refs.authModal.classList.contains("is-open") ||
      refs.checkoutModal.classList.contains("is-open");

    refs.overlay.hidden = !shouldShow;
    document.body.classList.toggle("is-locked", shouldShow);
  }

  function addToCart(productId, delta) {
    const nextQty = (state.cart[productId] ?? 0) + delta;
    setCartQty(productId, nextQty);
    const product = findProduct(productId);
    if (product) {
      showToast("Товар добавлен", `${product.name} теперь в корзине.`);
    }
  }

  function setCartQty(productId, qty) {
    if (qty <= 0) {
      delete state.cart[productId];
    } else {
      state.cart[productId] = qty;
    }
    persistState(storageKeys.cart, state.cart);
    renderCart();
  }

  function getFilteredProducts() {
    return state.catalog.filter((product) => {
      const inFilter =
        state.activeFilter === "Все" ||
        product.category === state.activeFilter ||
        product.section === state.activeFilter;

      const haystack = [
        product.name,
        product.category,
        product.section,
        product.excerpt,
        product.description,
        ...(product.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      const inSearch = !state.search || haystack.includes(state.search);
      return inFilter && inSearch;
    });
  }

  function getCartItems() {
    return Object.entries(state.cart)
      .map(([id, qty]) => ({
        product: findProduct(Number(id)),
        qty,
      }))
      .filter((item) => item.product);
  }

  function getCartTotal() {
    return getCartItems().reduce((sum, item) => sum + item.product.price * item.qty, 0);
  }

  function findProduct(productId) {
    return state.catalog.find((item) => item.id === productId) ?? null;
  }

  function hydrateCheckoutForm() {
    if (!state.user) return;
    refs.checkoutForm.elements.customerName.value = state.user.name || "";
    refs.checkoutForm.elements.customerEmail.value = state.user.email || "";
    refs.checkoutForm.elements.customerPhone.value = state.user.phone || "";
  }

  function buildFilterOptions(products) {
    const categories = products
      .map((product) => product.category)
      .filter(Boolean)
      .reduce((accumulator, category) => {
        accumulator[category] = (accumulator[category] || 0) + 1;
        return accumulator;
      }, {});

    return ["Все", ...Object.entries(categories)
      .sort((left, right) => right[1] - left[1])
      .map(([category]) => category)];
  }

  function showToast(title, text) {
    const toast = document.createElement("article");
    toast.className = "toast";
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
    refs.toastStack.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 3800);
  }

  function setupRevealAnimations() {
    const sections = document.querySelectorAll(".reveal-section");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.18 },
    );

    sections.forEach((section) => observer.observe(section));
  }

  function loadJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function persistState(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function formatPrice(value) {
    return new Intl.NumberFormat("ru-RU").format(value || 0) + " ₽";
  }

  function pluralizeReviews(count) {
    const value = count || 0;
    const mod10 = value % 10;
    const mod100 = value % 100;
    let word = "отзывов";

    if (mod10 === 1 && mod100 !== 11) word = "отзыв";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "отзыва";

    return `${value} ${word}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
