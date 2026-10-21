import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/index.js";
const customer = {
  name: "Nguyễn An",
  phone: "0901234567",
  city: "Hà Nội",
  address: "123 Đường Mẫu, Phường Mẫu",
  note: "Đơn kiểm thử",
};
const item = {
  productId: "everyday-tee",
  color: "cream",
  size: "M",
  quantity: 2,
};
async function fixture(t, dbPath = ":memory:") {
  const app = createApp({ dbPath });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const close = async () => {
    await new Promise((resolve) => app.server.close(resolve));
    app.db.close();
  };
  t.after(close);
  const post = (route, body, key = randomUUID()) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(body),
    });
  return { ...app, base, post };
}
test("Catalog has 12 products, per-color/per-size stock and working local assets", async (t) => {
  const { base } = await fixture(t);
  assert.equal((await fetch(base + "/api/health")).status, 200);
  const catalog = await (await fetch(base + "/api/products")).json();
  assert.equal(catalog.products.length, 12);
  const p = catalog.products[0];
  assert.equal(p.variants.length, 12);
  assert.equal(p.variants[0].stock, 10);
  assert.equal((await fetch(base + "/api/products/" + p.id)).status, 200);
  assert.equal((await fetch(base + "/api/products/missing")).status, 404);
  for (const route of [
    "/",
    "/css/style.css",
    "/css/fonts.css",
    "/js/app.js",
    "/images/editorial.png",
    p.image,
    "/images/everyday-tee-black.svg",
  ])
    assert.equal((await fetch(base + route)).status, 200, route);
  const font = await fetch(
    base + "/fonts/be-vietnam-pro-vietnamese-400-normal.woff2",
  );
  assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.equal(
    Buffer.from(await font.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "wOF2",
  );
  for (const route of [
    "/data/shop.sqlite",
    "/server/index.js",
    "/.env",
    "/../server/index.js",
    "/images/../../server/index.js",
    "/package.json",
  ])
    assert.equal((await fetch(base + route)).status, 404, route);
});
test("Server calculates price, capped discount, shipping and rejects invalid baskets", async (t) => {
  const { post } = await fixture(t);
  const response = await post("/api/checkout/quote", {
    items: [{ ...item, price: 1 }],
    coupon: "chao10",
    total: 2,
  });
  assert.equal(response.status, 200);
  const q = await response.json();
  assert.deepEqual(
    [q.subtotal, q.discount, q.shipping, q.total],
    [498000, 49800, 30000, 478200],
  );
  const high = await (
    await post("/api/checkout/quote", {
      items: [{ ...item, quantity: 8 }],
      coupon: "CHAO10",
    })
  ).json();
  assert.equal(high.discount, 100000);
  assert.equal(high.shipping, 0);
  for (const items of [
    [],
    [{ ...item, quantity: 0 }],
    [{ ...item, quantity: 1.5 }],
    [{ ...item, quantity: 11 }],
    [{ ...item, color: "fake" }],
    [{ ...item, size: "XXL" }],
    [{ ...item, productId: "fake" }],
    [item, item],
  ])
    assert.equal((await post("/api/checkout/quote", { items })).status, 400);
  assert.equal(
    (await post("/api/checkout/quote", { items: [item], coupon: "INVALID" }))
      .status,
    400,
  );
});
test("Orders ignore forged prices, replay safely and require token for private receipts", async (t) => {
  const { base, post, db } = await fixture(t);
  const input = {
    customer,
    items: [{ ...item, price: 1 }],
    coupon: "CHAO10",
    paymentMethod: "COD",
    total: 2,
  };
  const key = randomUUID();
  const response = await post("/api/orders", input, key);
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.total, 478200);
  assert.ok(order.accessToken.length >= 64);
  const replay = await post("/api/orders", input, key);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).id, order.id);
  assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 1);
  assert.equal(
    db
      .prepare(
        "SELECT stock FROM variants WHERE product_id='everyday-tee' AND color='cream' AND size='M'",
      )
      .get().stock,
    8,
  );
  assert.equal(
    (
      await post(
        "/api/orders",
        { ...input, items: [{ ...item, quantity: 1 }] },
        key,
      )
    ).status,
    409,
  );
  assert.equal((await fetch(base + "/api/orders/" + order.id)).status, 404);
  assert.equal(
    (
      await fetch(base + "/api/orders/" + order.id, {
        headers: { Authorization: "Bearer wrong" },
      })
    ).status,
    404,
  );
  const receipt = await (
    await fetch(base + "/api/orders/" + order.id, {
      headers: { Authorization: "Bearer " + order.accessToken },
    })
  ).json();
  assert.equal(receipt.total, 478200);
  assert.equal(receipt.customer, undefined);
  assert.equal(receipt.accessToken, undefined);
  assert.equal(
    (await post("/api/orders", { ...input, customer: {} })).status,
    400,
  );
  assert.equal(
    (await post("/api/orders", { ...input, paymentMethod: "CARD" })).status,
    400,
  );
});
test("Variant stock cannot oversell and mixed-basket failure is atomic", async (t) => {
  const { post, db } = await fixture(t);
  const input = {
    customer,
    items: [{ ...item, quantity: 8 }],
    paymentMethod: "COD",
  };
  const responses = await Promise.all([
    post("/api/orders", input),
    post("/api/orders", input),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const stock = () =>
    db
      .prepare(
        "SELECT stock FROM variants WHERE product_id='everyday-tee' AND color='cream' AND size='M'",
      )
      .get().stock;
  assert.equal(stock(), 2);
  const failed = await post("/api/orders", {
    ...input,
    items: [
      { productId: "linen-shirt", color: "olive", size: "S", quantity: 1 },
      { ...item, quantity: 3 },
    ],
  });
  assert.equal(failed.status, 409);
  assert.equal(
    db
      .prepare(
        "SELECT stock FROM variants WHERE product_id='linen-shirt' AND color='olive' AND size='S'",
      )
      .get().stock,
    10,
  );
  assert.equal(
    (
      await post("/api/orders", {
        ...input,
        items: [{ ...item, color: "black", quantity: 8 }],
      })
    ).status,
    201,
  );
  assert.equal(stock(), 2);
});
test("Database restart retains orders, idempotency and stock without reseeding", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gio-clothes-"));
  const dbPath = path.join(dir, "shop.sqlite");
  let app;
  async function start() {
    app = createApp({ dbPath });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${app.server.address().port}`;
  }
  async function close() {
    await new Promise((r) => app.server.close(r));
    app.db.close();
  }
  const key = randomUUID(),
    input = { customer, items: [item], paymentMethod: "COD" };
  try {
    let base = await start();
    const send = () =>
      fetch(base + "/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(input),
      });
    const first = await (await send()).json();
    await close();
    base = await start();
    const replay = await send();
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).accessToken, first.accessToken);
    assert.equal(app.db.prepare("SELECT count(*) AS n FROM orders").get().n, 1);
    assert.equal(
      app.db
        .prepare(
          "SELECT stock FROM variants WHERE product_id='everyday-tee' AND color='cream' AND size='M'",
        )
        .get().stock,
      8,
    );
  } finally {
    if (app?.server.listening) await close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Malformed JSON, cross-site submissions and request bursts are rejected", async (t) => {
  const { base, post } = await fixture(t);
  assert.equal(
    (
      await fetch(base + "/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await fetch(base + "/api/checkout/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Sec-Fetch-Site": "cross-site",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  const responses = await Promise.all(
    Array.from({ length: 62 }, () =>
      post("/api/checkout/quote", { items: [item] }),
    ),
  );
  assert.ok(responses.some((r) => r.status === 429));
});
