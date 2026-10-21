const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const money = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
const genders = {
  women: "THỜI TRANG NỮ",
  men: "THỜI TRANG NAM",
  unisex: "UNISEX",
  accessories: "PHỤ KIỆN",
};
const state = {
  products: [],
  cart: [],
  favorites: [],
  gender: "all",
  category: "all",
  price: "all",
  size: "",
  onlyFavorites: false,
  coupon: "",
  detail: null,
  quote: null,
  submitting: false,
};
let toastTimer, loadController;
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3300);
}
async function api(path, options = {}) {
  const response = await fetch(path, options);
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      "Không đọc được dữ liệu cửa hàng. Hãy chạy npm start và mở đúng cổng máy chủ.",
    );
  }
  if (!response.ok)
    throw Error(result.error || "Chưa thể kết nối. Vui lòng thử lại.");
  return result;
}
function post(path, data, headers = {}) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
}
function show(id) {
  const d = $("#" + id);
  if (!d.open) d.showModal();
}
function close(id) {
  if (state.submitting && id === "checkout-dialog") return;
  $("#" + id).close();
}
function product(id) {
  return state.products.find((p) => p.id === id);
}
function keyOf(item) {
  return [item.productId, item.color, item.size].join("|");
}
function variant(p, color, size) {
  return p?.variants.find((v) => v.color === color && v.size === size);
}
function variantImage(p, color) {
  return `/images/${p.id}-${color}.svg`;
}
function cartItems() {
  return state.cart.map((item) => {
    const p = product(item.productId);
    return {
      ...item,
      p,
      key: keyOf(item),
      colorName: p.colors.find((c) => c.id === item.color).name,
      image: variantImage(p, item.color),
      price: p.price,
      name: p.name,
    };
  });
}
function totals() {
  const subtotal = cartItems().reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    ),
    discount =
      state.coupon === "CHAO10"
        ? Math.min(Math.round(subtotal * 0.1), 100000)
        : 0,
    shipping = subtotal ? (subtotal - discount >= 699000 ? 0 : 30000) : 0;
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
  };
}
function summaryHtml(t) {
  return `<div class="money-summary"><div><span>Tạm tính</span><span>${money(t.subtotal)}</span></div>${t.discount ? `<div class="discount"><span>Ưu đãi CHAO10</span><span>−${money(t.discount)}</span></div>` : ""}<div><span>Phí giao hàng</span><span>${t.shipping ? money(t.shipping) : "Miễn phí"}</span></div><div class="grand-total"><span>Tổng cộng</span><span>${money(t.total)}</span></div></div>`;
}
function saveCart() {
  write("gio-studio-cart", state.cart);
  state.quote = null;
  renderCartCount();
}
function renderCartCount() {
  $("#cart-count").textContent = state.cart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
}
function updateFavoriteCount() {
  const count = state.favorites.length;
  $("#favorite-count").textContent = count;
  $("#favorite-count").hidden = !count;
  $("#favorites-button").setAttribute(
    "aria-pressed",
    String(state.onlyFavorites),
  );
  $("#exit-favorites").hidden = !state.onlyFavorites;
}
function filterProducts() {
  let list = state.products.filter(
    (p) =>
      (state.gender === "all" || p.gender === state.gender) &&
      (state.category === "all" || p.category === state.category) &&
      (state.price === "all" ||
        (state.price === "under300"
          ? p.price < 300000
          : state.price === "300to500"
            ? p.price >= 300000 && p.price <= 500000
            : p.price > 500000)) &&
      (!state.size ||
        p.variants.some((v) => v.size === state.size && v.stock > 0)) &&
      (!state.onlyFavorites || state.favorites.includes(p.id)) &&
      normalize(p.name + " " + p.material).includes(
        normalize($("#search").value.trim()),
      ),
  );
  const sort = $("#sort").value;
  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
  if (sort === "new")
    list.sort((a, b) => Number(b.badge === "MỚI") - Number(a.badge === "MỚI"));
  return list;
}
function normalize(value) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
function renderProducts() {
  const list = filterProducts();
  $("#result-count").textContent =
    `${list.length} sản phẩm${state.onlyFavorites ? " yêu thích" : ""}`;
  $("#empty-state").hidden = list.length > 0;
  $("#product-grid").innerHTML = list
    .map(
      (p) =>
        `<article class="product-card"><div class="product-art"><button class="product-image-button" data-product="${esc(p.id)}" aria-label="Xem ${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)} — ảnh minh họa" loading="lazy" width="480" height="600"></button>${p.badge ? `<span class="product-badge">${esc(p.badge)}</span>` : ""}<button class="heart-button" data-favorite="${esc(p.id)}" aria-label="${state.favorites.includes(p.id) ? "Bỏ yêu thích" : "Yêu thích"} ${esc(p.name)}" aria-pressed="${state.favorites.includes(p.id)}">${icon("heart")}</button><button class="quick-view" data-product="${esc(p.id)}">Chọn màu & kích cỡ ↗</button></div><div class="product-meta"><span class="product-gender">${genders[p.gender]}</span><div class="swatches" aria-label="${p.colors.length} màu">${p.colors.map((c) => `<span class="color-dot" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`).join("")}</div></div><h3><button data-product="${esc(p.id)}">${esc(p.name)}</button></h3><div class="product-price"><span>${money(p.price)}</span>${p.oldPrice ? `<del>${money(p.oldPrice)}</del><span class="sale-percent">−${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ""}</div></article>`,
    )
    .join("");
  updateFavoriteCount();
}
function resetFilters() {
  state.gender = "all";
  state.category = "all";
  state.price = "all";
  state.size = "";
  state.onlyFavorites = false;
  $("#search").value = "";
  $("#sort").value = "featured";
  $("input[name=category][value=all]").checked = true;
  $("input[name=price][value=all]").checked = true;
  syncFilters();
  renderProducts();
}
function syncFilters() {
  $$("[data-gender]").forEach((b) => {
    const active = b.dataset.gender === state.gender;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $$("[data-filter-size]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.filterSize === state.size)),
  );
  $$("#navigation [data-nav]").forEach((b) =>
    b.classList.toggle("nav-active", b.dataset.nav === state.gender),
  );
}
function shop(gender = "all") {
  resetFilters();
  state.gender = gender;
  syncFilters();
  renderProducts();
  $("#navigation").classList.remove("open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  $("#shop").scrollIntoView();
}
function showFavorites() {
  resetFilters();
  state.onlyFavorites = true;
  renderProducts();
  $("#shop").scrollIntoView();
}
function openProduct(id) {
  const p = product(id);
  if (!p) return;
  state.detail = {
    id,
    color: p.colors[0].id,
    size: p.sizes.length === 1 ? p.sizes[0] : "",
    quantity: 1,
  };
  renderDetail();
  show("product-dialog");
}
function renderDetail() {
  const d = state.detail,
    p = product(d.id),
    color = p.colors.find((c) => c.id === d.color),
    v = variant(p, d.color, d.size);
  const qtyInCart =
    state.cart.find((item) => keyOf(item) === keyOf({ productId: p.id, ...d }))
      ?.quantity || 0;
  const available = v ? Math.max(0, v.stock - qtyInCart) : 10;
  d.quantity = Math.max(1, Math.min(d.quantity, available || 1));
  $("#product-detail").innerHTML =
    `<div class="product-detail-grid"><div class="detail-art"><img src="${esc(variantImage(p, d.color))}" alt="${esc(p.name + " — " + color.name)}" width="480" height="600"><span>Ảnh minh họa thiết kế · Màu ${esc(color.name)}</span></div><div class="detail-copy"><p class="eyebrow">${genders[p.gender]} · GIÓ ESSENTIALS</p><h2 id="product-title">${esc(p.name)}</h2><div class="product-price"><span>${money(p.price)}</span>${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><p class="detail-description">${esc(p.description)}</p><p class="option-label">Màu sắc: <strong>${esc(color.name)}</strong></p><div class="color-options" role="group" aria-label="Chọn màu">${p.colors.map((c) => `<button class="color-option" data-detail-color="${esc(c.id)}" aria-label="${esc(c.name)}" aria-pressed="${c.id === d.color}"><span style="background:${esc(c.hex)}"></span></button>`).join("")}</div><div class="size-row-title"><p class="option-label">Kích cỡ${d.size ? ": " + esc(d.size) : ""}</p><button class="link-button" data-info="sizes">Bảng cỡ ↗</button></div><div class="size-options" role="group" aria-label="Chọn kích cỡ">${p.sizes.map((size) => `<button data-detail-size="${esc(size)}" aria-pressed="${size === d.size}" ${variant(p, d.color, size)?.stock === 0 ? "disabled" : ""}>${esc(size)}</button>`).join("")}</div><p class="availability" role="status">${d.size ? (v?.stock ? `Còn ${v.stock} sản phẩm trong mẫu này${qtyInCart ? " · " + qtyInCart + " trong giỏ" : ""}` : "Mẫu này tạm hết hàng.") : "Chọn kích cỡ để xem tồn kho."}</p><div class="buy-row"><div class="quantity"><button data-detail-qty="-1" aria-label="Giảm số lượng" ${d.quantity === 1 ? "disabled" : ""}>−</button><output aria-label="Số lượng">${d.quantity}</output><button data-detail-qty="1" aria-label="Tăng số lượng" ${d.quantity >= available ? "disabled" : ""}>+</button></div><button class="button" id="add-to-cart" ${d.size && !available ? "disabled" : ""}>Thêm vào giỏ ${icon("bag")}</button></div><div class="detail-accordions"><details open><summary>Chất liệu & phom dáng</summary><p>${esc(p.material)}.<br>${esc(p.fit)}</p></details><details><summary>Hướng dẫn chăm sóc</summary><p>${esc(p.care)}</p></details><details><summary>Giao hàng & đổi sản phẩm</summary><p>Phí 30.000đ, miễn phí từ 699.000đ sau ưu đãi. Tham khảo chính sách đổi sản phẩm trong 7 ngày ở chân trang. Đây là chính sách mẫu của cửa hàng thử nghiệm.</p></details></div></div></div>`;
}
function detailFocus(attribute, value) {
  const b = $$(`[${attribute}]`).find(
    (b) => b.getAttribute(attribute) === value,
  );
  b?.focus();
}
function addDetail() {
  const d = state.detail,
    p = product(d.id);
  if (!d.size) return notify("Bạn chọn kích cỡ trước nhé.");
  const item = {
      productId: p.id,
      color: d.color,
      size: d.size,
      quantity: d.quantity,
    },
    key = keyOf(item),
    existing = state.cart.find((i) => keyOf(i) === key),
    stock = variant(p, d.color, d.size)?.stock || 0;
  if ((existing?.quantity || 0) + item.quantity > Math.min(stock, 10))
    return notify("Số lượng vượt tồn kho hoặc giới hạn 10 sản phẩm mỗi mẫu.");
  if (!existing && state.cart.length >= 40)
    return notify("Giỏ hàng tối đa 40 mẫu.");
  if (existing) existing.quantity += item.quantity;
  else state.cart.push(item);
  saveCart();
  close("product-dialog");
  notify(`Đã thêm ${p.name} · ${d.size} vào giỏ`);
}
function renderCart() {
  const items = cartItems(),
    t = totals();
  if (!items.length) {
    $("#cart-content").innerHTML =
      `<div class="empty-cart">${icon("bag")}<h3>Giỏ hàng đang chờ bạn</h3><p>Một món đồ phù hợp có thể làm ngày mới khác đi.</p><button class="button" data-continue>Khám phá bộ sưu tập ${icon("arrow")}</button></div>`;
    return;
  }
  const remaining = Math.max(0, 699000 - t.subtotal + t.discount);
  $("#cart-content").innerHTML =
    `<div class="shipping-progress"><p>${remaining ? `Thêm <strong>${money(remaining)}</strong> để được miễn phí giao hàng.` : "Đơn hàng của bạn được miễn phí giao hàng."}</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, (t.subtotal - t.discount) / 6990)}%"></div></div></div>${items.map((item) => `<div class="cart-item"><img src="${esc(item.image)}" alt="${esc(item.name)}" width="76" height="98"><div><h3>${esc(item.name)}</h3><p>${esc(item.colorName)} / ${esc(item.size)}</p><span class="product-price">${money(item.price)}</span></div><div class="cart-item-end"><div class="quantity"><button data-cart-key="${esc(item.key)}" data-delta="-1" aria-label="Giảm ${esc(item.name)}">−</button><output>${item.quantity}</output><button data-cart-key="${esc(item.key)}" data-delta="1" aria-label="Tăng ${esc(item.name)}" ${item.quantity >= Math.min(10, variant(item.p, item.color, item.size).stock) ? "disabled" : ""}>+</button></div><button class="remove-item" data-remove="${esc(item.key)}" aria-label="Xóa ${esc(item.name)} khỏi giỏ">Xóa</button></div></div>`).join("")}<form class="coupon-form" id="coupon-form"><input id="coupon-code" placeholder="Nhập mã ưu đãi" maxlength="30" aria-label="Mã ưu đãi" value="${esc(state.coupon)}"><button type="submit">Áp dụng</button></form><p class="coupon-message" id="coupon-message" role="status">${state.coupon ? "Đã áp dụng CHAO10 · Giảm 10%, tối đa 100.000đ." : "Gợi ý nhỏ: CHAO10 giảm 10%, tối đa 100.000đ."}</p>${summaryHtml(t)}<div class="cart-actions"><button class="button full" id="start-checkout">Tiến hành đặt hàng ${icon("arrow")}</button><p class="note">Thanh toán COD · Giá đã gồm phí vận chuyển hiển thị ở trên</p><button class="link-button" data-continue>Tiếp tục chọn đồ</button></div>`;
}
function changeCart(key, delta) {
  const item = state.cart.find((i) => keyOf(i) === key);
  if (!item) return;
  const stock =
    variant(product(item.productId), item.color, item.size)?.stock || 0;
  if (delta > 0 && item.quantity >= Math.min(10, stock))
    return notify("Đã đạt số lượng tối đa của mẫu này.");
  item.quantity += delta;
  if (item.quantity <= 0)
    state.cart = state.cart.filter((i) => keyOf(i) !== key);
  saveCart();
  renderCart();
  const next = $$("[data-cart-key]").find((b) => b.dataset.cartKey === key);
  (next || $('[data-close="cart-dialog"]')).focus();
}
async function startCheckout() {
  const b = $("#start-checkout");
  b.disabled = true;
  b.textContent = "Đang kiểm tra tồn kho…";
  try {
    state.quote = await post("/api/checkout/quote", {
      items: state.cart,
      coupon: state.coupon,
    });
    renderCheckout();
    close("cart-dialog");
    $("#checkout-error").textContent = "";
    show("checkout-dialog");
  } catch (e) {
    notify(e.message);
  } finally {
    if (b.isConnected) {
      b.disabled = false;
      b.innerHTML = "Tiến hành đặt hàng " + icon("arrow");
    }
  }
}
function renderCheckout() {
  const q = state.quote;
  $("#checkout-summary").innerHTML =
    `<h3>Đơn hàng của bạn · ${q.items.reduce((s, i) => s + i.quantity, 0)} món</h3>${q.items.map((item) => `<div class="summary-item"><img src="${esc(variantImage(product(item.productId), item.color))}" alt="" width="45" height="57"><div><p>${esc(item.name)}</p><small>${esc(item.colorName)} / ${esc(item.size)} · ×${item.quantity}</small></div><span>${money(item.price * item.quantity)}</span></div>`).join("")}${summaryHtml(q)}`;
}
async function submitOrder(event) {
  event.preventDefault();
  if (state.submitting) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const customer = Object.fromEntries(new FormData(form));
  delete customer.consent;
  const input = {
      customer,
      items: state.cart,
      coupon: state.coupon,
      paymentMethod: "COD",
    },
    signature = JSON.stringify(input);
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem("gio-pending-order"));
  } catch {}
  if (pending?.signature !== signature)
    pending = { signature, key: crypto.randomUUID() };
  try {
    sessionStorage.setItem("gio-pending-order", JSON.stringify(pending));
  } catch {}
  state.submitting = true;
  $("#place-order").disabled = true;
  $("#place-order").textContent = "Đang lưu đơn hàng…";
  $("#checkout-error").textContent = "";
  try {
    const result = await post("/api/orders", input, {
      "Idempotency-Key": pending.key,
    });
    const history = read("gio-studio-orders", []);
    const orders = Array.isArray(history)
      ? history.filter((o) => o.id !== result.id)
      : [];
    orders.unshift({
      id: result.id,
      accessToken: result.accessToken,
      total: result.total,
      createdAt: result.createdAt,
    });
    const retained = write("gio-studio-orders", orders.slice(0, 20));
    state.cart = [];
    state.coupon = "";
    saveCart();
    try {
      sessionStorage.removeItem("gio-pending-order");
    } catch {}
    form.reset();
    state.submitting = false;
    close("checkout-dialog");
    $("#info-content").innerHTML =
      `<div class="success-mark">${icon("check")}</div><p class="eyebrow">CẢM ƠN BẠN ĐÃ CHỌN GIÓ</p><h2 id="info-title">Đã nhận đơn hàng của bạn.</h2><p class="order-id">${esc(result.id)}</p><p>Trạng thái: <strong>Chờ xác nhận</strong>. Đây là đơn hàng thử nghiệm, chưa phát sinh thanh toán hoặc giao hàng thực tế.</p>${summaryHtml(result)}<p>${retained ? "Bạn có thể xem lại đơn trong “Đơn hàng của tôi” trên trình duyệt này." : "Trình duyệt không lưu được lịch sử. Hãy ghi lại mã đơn và lưu mã truy cập bên dưới."}</p>${!retained ? `<p>Mã truy cập: <code class="token-code">${esc(result.accessToken)}</code></p>` : ""}<button class="button full" data-close="info-dialog">Tiếp tục khám phá ${icon("arrow")}</button>`;
    show("info-dialog");
    await loadProducts(false);
  } catch (e) {
    $("#checkout-error").textContent = e.message;
  } finally {
    state.submitting = false;
    $("#place-order").disabled = false;
    $("#place-order").innerHTML = "Xác nhận đặt hàng " + icon("arrow");
  }
}
const info = {
  sizes: `<p class="eyebrow">CHỌN CỠ CÙNG GIÓ</p><h2 id="info-title">Vừa vặn theo cách của bạn.</h2><p>Bảng tham khảo chung cho quần áo mẫu, đơn vị cm. Đo vòng ngực, eo và hông ở điểm lớn nhất, giữ thước vừa chạm cơ thể. Phom thực tế tùy thiết kế; phụ kiện dùng ONE SIZE.</p><table class="size-table"><thead><tr><th>Cỡ</th><th>Ngực</th><th>Eo</th><th>Hông</th></tr></thead><tbody><tr><td>S</td><td>82–88</td><td>64–70</td><td>88–94</td></tr><tr><td>M</td><td>88–94</td><td>70–76</td><td>94–100</td></tr><tr><td>L</td><td>94–100</td><td>76–82</td><td>100–106</td></tr><tr><td>XL</td><td>100–106</td><td>82–88</td><td>106–112</td></tr></tbody></table><h3>Một vài gợi ý nhỏ</h3><p>Nếu số đo nằm giữa hai cỡ hoặc thích mặc rộng, hãy chọn cỡ lớn hơn. Bảng cỡ này minh họa chức năng; cần thay bằng số đo thực tế của từng sản phẩm trước khi mở bán.</p>`,
  shipping: `<p class="eyebrow">GÓI GHÉM MỘT CHÚT NIỀM VUI</p><h2 id="info-title">Giao hàng & thanh toán.</h2><h3>Phí giao hàng</h3><p>Phí cố định 30.000đ. Miễn phí khi giá trị sản phẩm sau giảm giá từ 699.000đ. Số tiền cuối cùng được máy chủ tính và hiển thị trước khi đặt hàng.</p><h3>Thanh toán COD</h3><p>Hiện chỉ hỗ trợ lựa chọn thanh toán khi nhận hàng. Trang không yêu cầu số thẻ, mật khẩu ngân hàng hoặc thu tiền trực tuyến.</p><h3>Cửa hàng thử nghiệm</h3><p>Chưa kết nối đơn vị vận chuyển và chưa giao hàng thực tế. Đơn được lưu với trạng thái chờ xác nhận để kiểm thử. Thời gian giao hàng sẽ được công bố khi cửa hàng mở bán.</p>`,
  returns: `<p class="eyebrow">CHỌN ĐIỀU PHÙ HỢP</p><h2 id="info-title">Đổi sản phẩm trong 7 ngày.</h2><p>Đây là chính sách minh họa cho bản thử nghiệm, cần được cửa hàng xác nhận trước khi mở bán.</p><ul><li>Dự kiến hỗ trợ đổi cỡ hoặc đổi màu trong 7 ngày kể từ khi nhận hàng.</li><li>Sản phẩm phải chưa sử dụng, chưa giặt, còn tem và bao bì đi kèm.</li><li>Khả năng đổi phụ thuộc tồn kho thực tế. Phụ kiện và hàng ưu đãi có thể có điều kiện riêng.</li><li>Phí gửi đổi và quy trình liên hệ sẽ được cập nhật khi mở bán.</li></ul><p>Bản hiện tại chưa có chức năng hủy đơn, hoàn tiền hoặc tạo yêu cầu đổi hàng trực tuyến.</p>`,
  privacy: `<p class="eyebrow">DỮ LIỆU CỦA BẠN</p><h2 id="info-title">Quyền riêng tư.</h2><p>Khi đặt đơn, cửa hàng lưu họ tên, số điện thoại, địa chỉ, thành phố, ghi chú và các sản phẩm bạn chọn vào SQLite trên máy chủ. Dữ liệu được dùng để lưu và xử lý đơn; bản thử nghiệm chưa chia sẻ với đơn vị vận chuyển.</p><p>Giỏ hàng, sản phẩm yêu thích và mã truy cập đơn hàng được lưu trong trình duyệt này. Không đặt đơn bằng thông tin nhạy cảm trên máy dùng chung. Không chia sẻ mã truy cập đơn cho người khác.</p><p>“Đơn hàng của tôi” chỉ hiện lịch sử trên thiết bị đã đặt hàng. Xóa lịch sử trên thiết bị không xóa đơn trong cơ sở dữ liệu máy chủ. Bản này chưa có tài khoản, đồng bộ đa thiết bị hoặc chức năng yêu cầu xóa dữ liệu trực tuyến.</p><p>Đây là thông tin cho bản thử nghiệm; cần bổ sung thông tin pháp nhân, liên hệ bảo vệ dữ liệu và quy trình xử lý yêu cầu trước khi mở bán.</p>`,
  faq: `<p class="eyebrow">GIÓ Ở ĐÂY ĐỂ GIÚP</p><h2 id="info-title">Một vài câu hỏi thường gặp.</h2><h3>Tôi mua hàng như thế nào?</h3><p>Chọn sản phẩm → màu và cỡ → thêm vào giỏ → nhập thông tin nhận hàng → xác nhận COD. Đơn thử nghiệm được lưu trên máy chủ.</p><h3>Mã CHAO10 áp dụng thế nào?</h3><p>Giảm 10% tiền sản phẩm, tối đa 100.000đ mỗi đơn. Bản mẫu chưa giới hạn theo khách hàng và không tính ưu đãi lên phí giao hàng.</p><h3>Tôi xem lại đơn ở đâu?</h3><p>Chọn “Đơn hàng của tôi”. Lịch sử được lưu trên trình duyệt đã đặt, tối đa 20 đơn gần nhất.</p><h3>Vì sao không thấy sản phẩm?</h3><p>Chạy npm start trong thư mục dự án và mở đúng địa chỉ mà terminal hiển thị. Mở index.html trực tiếp hoặc dùng Live Server sẽ không có API.</p><button class="button secondary" data-orders>Xem đơn hàng của tôi ${icon("arrow")}</button>`,
};
function showInfo(name) {
  $("#info-content").innerHTML = info[name] || info.faq;
  show("info-dialog");
}
function orderHistory() {
  const entries = read("gio-studio-orders", []);
  return Array.isArray(entries)
    ? entries
        .filter(
          (o) =>
            typeof o.id === "string" &&
            typeof o.accessToken === "string" &&
            Number.isFinite(o.total),
        )
        .slice(0, 20)
    : [];
}
function showOrders() {
  const entries = orderHistory();
  $("#orders-content").innerHTML = entries.length
    ? `<p class="detail-description">Đơn gần nhất trên trình duyệt này. Chọn một đơn để kiểm tra trạng thái từ máy chủ.</p>${entries.map((o) => `<article class="order-card"><div class="order-card-head"><h3>${esc(o.id)}</h3><span class="order-status">Đã lưu trên thiết bị</span></div><p>${esc(new Date(o.createdAt).toLocaleString("vi-VN"))}</p><p>Tổng tiền: <strong>${money(o.total)}</strong></p><button class="button secondary" data-view-order="${esc(o.id)}">Xem chi tiết ${icon("arrow")}</button></article>`).join("")}<p class="note">Lịch sử chỉ có trên thiết bị này; không chia sẻ máy cho người khác khi còn lưu mã truy cập.</p><button class="link-button" id="clear-history">Xóa lịch sử trên thiết bị</button>`
    : `<div class="empty-cart">${icon("box")}<h3>Chưa có đơn hàng nào</h3><p>Đơn bạn đặt trên trình duyệt này sẽ xuất hiện ở đây.</p><button class="button" data-continue>Khám phá bộ sưu tập ${icon("arrow")}</button></div>`;
  show("orders-dialog");
}
async function viewOrder(id, button) {
  const record = orderHistory().find((o) => o.id === id);
  if (!record) return;
  button.disabled = true;
  try {
    const order = await api("/api/orders/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + record.accessToken },
    });
    $("#info-content").innerHTML =
      `<p class="eyebrow">ĐƠN HÀNG CỦA BẠN</p><h2 id="info-title">${esc(order.id)}</h2><p><span class="order-status">${order.status === "pending" ? "Chờ xác nhận" : esc(order.status)}</span></p><p>${esc(new Date(order.createdAt).toLocaleString("vi-VN"))} · Thanh toán COD</p>${order.items.map((item) => `<div class="summary-item"><img src="${esc(item.image)}" alt="" width="45" height="57"><div><p>${esc(item.name)}</p><small>${esc(item.colorName)} / ${esc(item.size)} · ×${item.quantity}</small></div><span>${money(item.price * item.quantity)}</span></div>`).join("")}${summaryHtml(order)}<p>Đơn thử nghiệm đã được lưu, chưa phát sinh giao hàng thực tế.</p>`;
    show("info-dialog");
  } catch (e) {
    notify(e.message);
  } finally {
    button.disabled = false;
  }
}
async function loadProducts(restore = true) {
  if (loadController) loadController.abort();
  loadController = new AbortController();
  $("#load-error").hidden = true;
  $("#product-grid").setAttribute("aria-busy", "true");
  try {
    const result = await api("/api/products", {
      signal: loadController.signal,
    });
    if (!Array.isArray(result.products)) throw Error();
    state.products = result.products;
    if (restore) {
      const saved = read("gio-studio-cart", []);
      state.cart = Array.isArray(saved)
        ? saved
            .filter(
              (item) =>
                item &&
                typeof item.productId === "string" &&
                typeof item.color === "string" &&
                typeof item.size === "string" &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0 &&
                item.quantity <= 10 &&
                variant(product(item.productId), item.color, item.size),
            )
            .slice(0, 40)
        : [];
      const seen = new Set();
      state.cart = state.cart.filter((item) => {
        const key = keyOf(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const favorites = read("gio-studio-favorites", []);
      state.favorites = Array.isArray(favorites)
        ? [...new Set(favorites)].filter((id) => product(id))
        : [];
    }
    renderProducts();
    renderCartCount();
    $("#product-grid").setAttribute("aria-busy", "false");
  } catch (error) {
    if (error.name === "AbortError") return;
    $("#product-grid").setAttribute("aria-busy", "false");
    $("#load-error").hidden = false;
    $("#empty-state").hidden = true;
    $("#result-count").textContent = "Chưa tải được sản phẩm";
  }
}
// All dynamic controls use delegated events; product and customer text is escaped before rendering.
document.addEventListener("click", async (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.close) {
    close(b.dataset.close);
    return;
  }
  if (b.dataset.info) {
    showInfo(b.dataset.info);
    return;
  }
  if (b.hasAttribute("data-orders")) {
    if ($("#info-dialog").open) close("info-dialog");
    showOrders();
    return;
  }
  if (b.hasAttribute("data-nav")) {
    shop(b.dataset.nav);
    return;
  }
  if (b.hasAttribute("data-gender")) {
    state.gender = b.dataset.gender;
    state.onlyFavorites = false;
    syncFilters();
    renderProducts();
    return;
  }
  if (b.dataset.product) {
    openProduct(b.dataset.product);
    return;
  }
  if (b.dataset.favorite) {
    const id = b.dataset.favorite;
    state.favorites = state.favorites.includes(id)
      ? state.favorites.filter((v) => v !== id)
      : [...state.favorites, id];
    write("gio-studio-favorites", state.favorites);
    renderProducts();
    $$("[data-favorite]")
      .find((el) => el.dataset.favorite === id)
      ?.focus();
    return;
  }
  if (b.dataset.detailColor) {
    state.detail.color = b.dataset.detailColor;
    state.detail.quantity = 1;
    renderDetail();
    detailFocus("data-detail-color", b.dataset.detailColor);
    return;
  }
  if (b.dataset.detailSize) {
    state.detail.size = b.dataset.detailSize;
    state.detail.quantity = 1;
    renderDetail();
    detailFocus("data-detail-size", b.dataset.detailSize);
    return;
  }
  if (b.dataset.detailQty) {
    state.detail.quantity += Number(b.dataset.detailQty);
    renderDetail();
    detailFocus("data-detail-qty", b.dataset.detailQty);
    return;
  }
  if (b.id === "add-to-cart") {
    addDetail();
    return;
  }
  if (b.dataset.cartKey) {
    changeCart(b.dataset.cartKey, Number(b.dataset.delta));
    return;
  }
  if (b.dataset.remove) {
    state.cart = state.cart.filter((item) => keyOf(item) !== b.dataset.remove);
    saveCart();
    renderCart();
    return;
  }
  if (b.hasAttribute("data-continue")) {
    $$("dialog[open]").forEach((d) => close(d.id));
    $("#shop").scrollIntoView();
    return;
  }
  if (b.dataset.filterSize) {
    state.size =
      state.size === b.dataset.filterSize ? "" : b.dataset.filterSize;
    syncFilters();
    renderProducts();
    return;
  }
  if (b.id === "start-checkout") {
    await startCheckout();
    return;
  }
  if (b.dataset.viewOrder) {
    await viewOrder(b.dataset.viewOrder, b);
    return;
  }
  if (b.id === "clear-history") {
    write("gio-studio-orders", []);
    showOrders();
    return;
  }
});
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "coupon-form") return;
  event.preventDefault();
  const input = $("#coupon-code"),
    b = event.target.querySelector("button");
  b.disabled = true;
  try {
    const result = await post("/api/checkout/quote", {
      items: state.cart,
      coupon: input.value.trim(),
    });
    state.coupon = result.coupon;
    renderCart();
    notify(result.coupon ? "Đã áp dụng mã CHAO10." : "Đã bỏ mã ưu đãi.");
  } catch (e) {
    $("#coupon-message").textContent = e.message;
    b.disabled = false;
  }
});
$("#checkout-form").addEventListener("submit", submitOrder);
$("#checkout-dialog").addEventListener("cancel", (event) => {
  if (state.submitting) event.preventDefault();
});
$("#cart-open").addEventListener("click", () => {
  renderCart();
  show("cart-dialog");
});
$("#orders-button").addEventListener("click", showOrders);
$("#favorites-button").addEventListener("click", () =>
  state.onlyFavorites ? shop() : showFavorites(),
);
$("#footer-favorites").addEventListener("click", showFavorites);
$("#exit-favorites").addEventListener("click", () => shop());
$("#clear-filters").addEventListener("click", resetFilters);
$("#empty-reset").addEventListener("click", resetFilters);
$("#search").addEventListener("input", renderProducts);
$("#sort").addEventListener("change", renderProducts);
$$("input[name=category]").forEach((input) =>
  input.addEventListener("change", () => {
    state.category = input.value;
    renderProducts();
  }),
);
$$("input[name=price]").forEach((input) =>
  input.addEventListener("change", () => {
    state.price = input.value;
    renderProducts();
  }),
);
$("#menu-toggle").addEventListener("click", () => {
  const open = $("#navigation").classList.toggle("open");
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
});
$("#navigation a").addEventListener("click", () => {
  $("#navigation").classList.remove("open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
});
$("#focus-search").addEventListener("click", () => {
  $("#shop").scrollIntoView();
  $("#search").focus({ preventScroll: true });
});
$("#filter-toggle").addEventListener("click", () => {
  const open = $(".filters").classList.toggle("open");
  $("#filter-toggle").setAttribute("aria-expanded", String(open));
  $("#filter-toggle").textContent = open ? "Ẩn bộ lọc" : "Hiện bộ lọc";
  if (open) $(".filters").scrollIntoView({ block: "center" });
});
$("#linen-collection").addEventListener("click", () => {
  resetFilters();
  $("#search").value = "linen";
  renderProducts();
  $("#shop").scrollIntoView();
});
$("#welcome-coupon").addEventListener("click", () => {
  state.coupon = "CHAO10";
  notify("Đã lưu CHAO10 — mã sẽ được áp dụng cho giỏ hàng.");
});
$("#retry-products").addEventListener("click", () => loadProducts());
$("#back-to-top").addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" }),
);
window.addEventListener(
  "scroll",
  () => {
    $("#back-to-top").hidden = window.scrollY < 700;
  },
  { passive: true },
);
loadProducts();
