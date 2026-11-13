/* ============================================================
   GCE store cart — front-end only.
   Cart lives in localStorage so it survives page changes.
   Products are data-driven: any product page can join the cart
   by adding a [data-product-section] block with an Add to Cart
   button (see store/last-7-t-shirt.html for the pattern).
   ------------------------------------------------------------
   CHECKOUT_WEBHOOK_URL — the Make webhook that creates one
   Stripe Checkout Session for the whole cart. Set this to the
   real webhook URL when it exists. While it is empty, the
   Checkout button shows a "coming right up" message and the
   cart keeps working — nothing breaks.
   ============================================================ */
var CHECKOUT_WEBHOOK_URL = "";

(function () {
  "use strict";

  var CART_KEY = "gce-cart-v1";

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- cart state ---------- */

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
  }
  function cartCount(items) {
    return items.reduce(function (n, i) { return n + i.quantity; }, 0);
  }
  function cartSubtotalCents(items) {
    return items.reduce(function (n, i) { return n + i.priceCents * i.quantity; }, 0);
  }
  function money(cents) {
    return "$" + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
  }
  function itemKey(it) { return it.product + "|" + it.size; }

  /* ---------- styles (injected so no page CSS needs editing) ---------- */

  var CSS = [
    /* keep the header layout as it is: links hug the right on desktop, */
    /* hamburger + cart hug the right on phones */
    ".nav-in .links{margin-left:auto}",
    "@media(max-width:760px){.nav-in .menu-btn{margin-left:auto}}",
    ".gce-cart-btn{position:relative;flex:none;background:transparent;border:1px solid var(--line,#e5e5e5);color:var(--text,#111);font-size:19px;line-height:1;padding:8px 12px;border-radius:10px;cursor:pointer;font-family:inherit}",
    ".gce-cart-count{position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--gold,#c9a227);color:#111;font-size:12px;font-weight:800;display:grid;place-items:center;line-height:1}",
    ".gce-cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:998}",
    ".gce-cart-drawer{position:fixed;top:0;right:0;height:100%;width:min(420px,94vw);background:#fff;color:#111;z-index:999;display:flex;flex-direction:column;box-shadow:-8px 0 32px rgba(0,0,0,.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
    ".gce-cart-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #eee}",
    ".gce-cart-head h2{margin:0;font-size:20px;letter-spacing:.02em}",
    ".gce-cart-close{background:transparent;border:0;font-size:28px;line-height:1;cursor:pointer;color:#111;padding:0 4px}",
    ".gce-cart-items{flex:1;overflow-y:auto;padding:8px 20px}",
    ".gce-cart-empty{color:#666;text-align:center;padding:48px 12px;line-height:1.6}",
    ".gce-cart-empty a{color:#111;font-weight:700}",
    ".gce-cart-item{display:flex;gap:12px;padding:16px 0;border-bottom:1px solid #eee;align-items:flex-start}",
    ".gce-cart-item img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #eee;flex:none}",
    ".gce-cart-item-info{flex:1;min-width:0}",
    ".gce-cart-item-name{font-weight:800;font-size:15px;line-height:1.3}",
    ".gce-cart-item-size,.gce-cart-item-price{color:#666;font-size:13px;margin-top:3px}",
    ".gce-cart-qty{display:flex;align-items:center;gap:0;border:1px solid #ddd;border-radius:8px;overflow:hidden;margin-top:8px;width:max-content}",
    ".gce-cart-qty button{background:#f4f4f4;border:0;width:30px;height:28px;font-size:16px;cursor:pointer;color:#111}",
    ".gce-cart-qty span{min-width:30px;text-align:center;font-weight:700;font-size:14px}",
    ".gce-cart-line{font-weight:800;font-size:15px;white-space:nowrap}",
    ".gce-cart-remove{background:transparent;border:0;color:#999;font-size:20px;line-height:1;cursor:pointer;padding:0 2px}",
    ".gce-cart-foot{border-top:1px solid #eee;padding:18px 20px 22px}",
    ".gce-cart-subtotal{display:flex;justify-content:space-between;font-weight:800;font-size:17px;margin-bottom:12px}",
    ".gce-cart-note{color:#666;font-size:14px;line-height:1.5;min-height:21px;margin:0 0 10px}",
    ".gce-cart-checkout{display:block;width:100%;background:#c9a227;color:#111;font-weight:800;font-size:16px;border:0;border-radius:8px;padding:13px 16px;cursor:pointer}",
    ".gce-cart-checkout:disabled{opacity:.6;cursor:default}",
    ".gce-cart-continue{display:block;width:100%;background:transparent;border:0;color:#666;font-size:14px;margin-top:10px;cursor:pointer;text-decoration:underline}",
    /* size picker + Add to Cart (product pages) */
    ".gce-buy-row{margin-top:18px}",
    ".gce-size-label{font-weight:800;font-size:14px;margin:0 0 8px}",
    ".gce-size-picker{display:flex;flex-wrap:wrap;gap:8px}",
    ".gce-size-picker button{background:transparent;border:1px solid var(--line,#ddd);color:var(--text,#111);border-radius:8px;padding:8px 12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;min-width:46px}",
    ".gce-size-picker button.selected{background:#111;color:#fff;border-color:#111}",
    ".gce-size-hint{color:#b3261e;font-size:14px;font-weight:700;margin:8px 0 0}",
    ".gce-add-to-cart{display:inline-flex;align-items:center;gap:8px;padding:14px 22px;border-radius:999px;font-weight:800;text-decoration:none;cursor:pointer;font-size:15px;font-family:inherit;background:var(--text,#111);color:var(--bg,#fff);border:1px solid var(--text,#111);margin-top:14px}"
  ].join("\n");

  function injectCSS() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ---------- drawer DOM ---------- */

  var overlay, drawer, itemsEl, subtotalEl, noteEl, checkoutBtn, countBadge;

  function buildDrawer() {
    overlay = document.createElement("div");
    overlay.className = "gce-cart-overlay";
    overlay.id = "gceCartOverlay";
    overlay.hidden = true;
    drawer = document.createElement("aside");
    drawer.className = "gce-cart-drawer";
    drawer.id = "gceCartDrawer";
    drawer.setAttribute("aria-label", "Shopping cart");
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="gce-cart-head"><h2>Your Cart</h2>' +
      '<button class="gce-cart-close" id="gceCartClose" type="button" aria-label="Close cart">&times;</button></div>' +
      '<div class="gce-cart-items" id="gceCartItems"></div>' +
      '<div class="gce-cart-foot">' +
      '<div class="gce-cart-subtotal"><span>Subtotal</span><span id="gceCartSubtotal">$0</span></div>' +
      '<p class="gce-cart-note" id="gceCartNote"></p>' +
      '<button class="gce-cart-checkout" id="gceCartCheckout" type="button">Checkout &rarr;</button>' +
      '<button class="gce-cart-continue" id="gceCartContinue" type="button">Continue shopping</button>' +
      "</div>";
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    itemsEl = $("#gceCartItems");
    subtotalEl = $("#gceCartSubtotal");
    noteEl = $("#gceCartNote");
    checkoutBtn = $("#gceCartCheckout");
    $("#gceCartClose").addEventListener("click", closeDrawer);
    $("#gceCartContinue").addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);
    checkoutBtn.addEventListener("click", doCheckout);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  function openDrawer() {
    renderCart();
    overlay.hidden = false;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    if (!drawer) return;
    overlay.hidden = true;
    drawer.hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- rendering ---------- */

  function updateBadge() {
    countBadge = countBadge || $("#gceCartCount");
    if (!countBadge) return;
    var n = cartCount(loadCart());
    countBadge.textContent = String(n);
    countBadge.hidden = n === 0;
  }

  function renderCart() {
    var items = loadCart();
    updateBadge();
    subtotalEl.textContent = money(cartSubtotalCents(items));
    if (items.length === 0) {
      itemsEl.innerHTML = '<p class="gce-cart-empty">Your cart is empty.<br><a href="/store">Browse the store &rarr;</a></p>';
      checkoutBtn.disabled = true;
      return;
    }
    checkoutBtn.disabled = false;
    itemsEl.innerHTML = "";
    items.forEach(function (it) {
      var row = document.createElement("div");
      row.className = "gce-cart-item";
      row.innerHTML =
        '<img src="' + it.image + '" alt="">' +
        '<div class="gce-cart-item-info">' +
        '<div class="gce-cart-item-name"></div>' +
        '<div class="gce-cart-item-size">Size ' + it.size + '</div>' +
        '<div class="gce-cart-item-price">' + money(it.priceCents) + ' each</div>' +
        '<div class="gce-cart-qty">' +
        '<button type="button" data-dec aria-label="Decrease quantity">&minus;</button>' +
        '<span>' + it.quantity + '</span>' +
        '<button type="button" data-inc aria-label="Increase quantity">+</button>' +
        "</div></div>" +
        '<div class="gce-cart-line">' + money(it.priceCents * it.quantity) + "</div>" +
        '<button type="button" class="gce-cart-remove" aria-label="Remove item">&times;</button>';
      row.querySelector(".gce-cart-item-name").textContent = it.name;
      row.querySelector("[data-dec]").addEventListener("click", function () { changeQty(it, -1); });
      row.querySelector("[data-inc]").addEventListener("click", function () { changeQty(it, 1); });
      row.querySelector(".gce-cart-remove").addEventListener("click", function () { removeItem(it); });
      itemsEl.appendChild(row);
    });
  }

  function changeQty(it, delta) {
    var items = loadCart();
    var found = null;
    items.forEach(function (x) { if (itemKey(x) === itemKey(it)) found = x; });
    if (!found) return;
    found.quantity += delta;
    if (found.quantity <= 0) items = items.filter(function (x) { return itemKey(x) !== itemKey(it); });
    saveCart(items);
    renderCart();
  }
  function removeItem(it) {
    saveCart(loadCart().filter(function (x) { return itemKey(x) !== itemKey(it); }));
    renderCart();
  }

  /* ---------- add to cart (data-driven) ---------- */

  function bindAddToCart() {
    $$(".gce-add-to-cart").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var section = btn.closest("[data-product-section]") || document;
        var picker = section.querySelector(".gce-size-picker");
        var selected = picker ? picker.querySelector("button.selected") : null;
        var hint = section.querySelector(".gce-size-hint");
        if (picker && !selected) {
          if (hint) hint.hidden = false;
          return;
        }
        if (hint) hint.hidden = true;
        var product = section.dataset.product;
        var name = section.dataset.name;
        var priceCents = parseInt(section.dataset.priceCents, 10);
        var priceId = section.dataset.priceId;
        var image = section.dataset.image;
        if (!product || !name || !priceCents || !priceId) return;
        var size = selected ? selected.dataset.size : "";
        var items = loadCart();
        var found = null;
        items.forEach(function (x) { if (x.product === product && x.size === size) found = x; });
        if (found) { found.quantity += 1; }
        else {
          items.push({ product: product, name: name, size: size, quantity: 1,
                       priceCents: priceCents, priceId: priceId, image: image });
        }
        saveCart(items);
        updateBadge();
        var original = btn.textContent;
        btn.textContent = "Added \u2713";
        setTimeout(function () { btn.textContent = original; }, 1200);
        openDrawer();
      });
    });
    $$(".gce-size-picker").forEach(function (picker) {
      picker.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-size]");
        if (!b) return;
        $$("button[data-size]", picker).forEach(function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
        var hint = picker.parentElement.querySelector(".gce-size-hint");
        if (hint) hint.hidden = true;
      });
    });
  }

  /* ---------- checkout ---------- */

  function doCheckout() {
    var items = loadCart();
    if (items.length === 0) return;
    if (!CHECKOUT_WEBHOOK_URL) {
      noteEl.textContent = "Checkout coming right up \u2014 try again in a moment";
      return;
    }
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Processing\u2026";
    noteEl.textContent = "Redirecting to secure checkout\u2026";
    var payload = {
      items: items.map(function (it) {
        return { product: it.product, price_id: it.priceId, name: it.name,
                 size: it.size, quantity: it.quantity };
      })
    };
    fetch(CHECKOUT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.checkout_url) { window.location.href = data.checkout_url; return; }
        throw new Error("no checkout_url");
      })
      .catch(function () {
        noteEl.textContent = "Something went wrong \u2014 your cart is saved, please try again.";
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Checkout \u2192";
      });
  }

  /* ---------- init ---------- */

  function init() {
    // Thank-you page clears the cart after a completed order.
    if (document.body && document.body.dataset.clearCart !== undefined) {
      try { localStorage.removeItem(CART_KEY); } catch (e) {}
    }
    injectCSS();
    buildDrawer();
    var cartBtn = $("#gceCartBtn");
    if (cartBtn) cartBtn.addEventListener("click", openDrawer);
    bindAddToCart();
    renderCart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
