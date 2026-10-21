import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { openDatabase, getProducts } from "./db.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const fail = (status, message) => Object.assign(new Error(message), { status });
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const equal = (a, b) => {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
async function readJson(req) {
  if (req.headers["sec-fetch-site"] === "cross-site")
    throw fail(403, "Yêu cầu không hợp lệ.");
  if (req.headers["content-type"]?.split(";")[0] !== "application/json")
    throw fail(415, "Vui lòng gửi dữ liệu JSON.");
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20000) throw fail(413, "Dữ liệu vượt giới hạn.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw fail(400, "Dữ liệu JSON không hợp lệ.");
  }
}
function quote(db, input) {
  if (
    !input ||
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 40
  )
    throw fail(400, "Giỏ hàng cần có từ 1 đến 40 mẫu sản phẩm.");
  const seen = new Set();
  const items = input.items.map((item) => {
    if (
      !item ||
      typeof item.productId !== "string" ||
      typeof item.color !== "string" ||
      typeof item.size !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    )
      throw fail(400, "Sản phẩm, màu, cỡ hoặc số lượng không hợp lệ.");
    const key = JSON.stringify([item.productId, item.color, item.size]);
    if (seen.has(key)) throw fail(400, "Giỏ hàng có mẫu sản phẩm trùng lặp.");
    seen.add(key);
    const row = db
      .prepare("SELECT data FROM products WHERE id=?")
      .get(item.productId);
    if (!row) throw fail(400, "Sản phẩm không tồn tại.");
    const p = JSON.parse(row.data);
    const variant = db
      .prepare(
        "SELECT stock FROM variants WHERE product_id=? AND color=? AND size=?",
      )
      .get(p.id, item.color, item.size);
    if (!variant) throw fail(400, `Màu hoặc cỡ của ${p.name} không tồn tại.`);
    if (variant.stock < item.quantity)
      throw fail(
        409,
        `${p.name}, cỡ ${item.size} chỉ còn ${variant.stock} sản phẩm.`,
      );
    return {
      productId: p.id,
      name: p.name,
      image: p.image,
      color: item.color,
      colorName: p.colors.find((c) => c.id === item.color).name,
      size: item.size,
      quantity: item.quantity,
      price: p.price,
    };
  });
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  if (input.coupon !== undefined && typeof input.coupon !== "string")
    throw fail(400, "Mã ưu đãi không hợp lệ.");
  const coupon = (input.coupon || "").trim().toUpperCase();
  if (coupon && coupon !== "CHAO10")
    throw fail(400, "Mã ưu đãi không tồn tại.");
  const discount = coupon ? Math.min(Math.round(subtotal * 0.1), 100000) : 0;
  const shipping = subtotal - discount >= 699000 ? 0 : 30000;
  return {
    items,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    coupon,
    currency: "VND",
  };
}
function customerInput(value) {
  const limits = {
    name: [2, 100],
    phone: [8, 20],
    address: [10, 500],
    city: [2, 100],
  };
  const result = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (
      typeof value?.[key] !== "string" ||
      value[key].trim().length < min ||
      value[key].length > max
    )
      throw fail(
        400,
        "Vui lòng kiểm tra họ tên, số điện thoại và địa chỉ nhận hàng.",
      );
    result[key] = value[key].trim();
  }
  if (
    !/^[+0-9 ()-]{8,20}$/.test(result.phone) ||
    result.phone.replace(/\D/g, "").length < 8
  )
    throw fail(400, "Số điện thoại không hợp lệ.");
  if (
    value.note !== undefined &&
    (typeof value.note !== "string" || value.note.length > 500)
  )
    throw fail(400, "Ghi chú tối đa 500 ký tự.");
  result.note = value.note?.trim() || "";
  return result;
}
export function createApp({
  dbPath = process.env.DB_PATH || path.join(root, "data/shop.sqlite"),
} = {}) {
  const db = openDatabase(dbPath);
  // Protect the order endpoints from bursts on one running instance. Production should also rate-limit at the reverse proxy.
  const requests = new Map();
  const maxClients = 10000;
  const limited = (req) => {
    const now = Date.now(),
      ip = req.socket.remoteAddress || "unknown";
    let bucket = requests.get(ip);
    if (!bucket || now - bucket.start > 60000) {
      if (requests.size >= maxClients) {
        for (const [key, b] of requests)
          if (now - b.start > 60000) requests.delete(key);
        if (requests.size >= maxClients)
          throw fail(429, "Vui lòng thử lại sau ít phút.");
      }
      bucket = { start: now, count: 0 };
      requests.set(ip, bucket);
    }
    if (++bucket.count > 60)
      throw fail(429, "Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.");
  };
  const receipt = (row) => ({
    id: row.id,
    items: JSON.parse(row.items),
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    total: row.total,
    coupon: row.coupon,
    status: row.status,
    createdAt: row.created_at,
    paymentMethod: "COD",
  });
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/health") {
        db.prepare("SELECT 1").get();
        return json(res, 200, { status: "ok" });
      }
      if (req.method === "GET" && url.pathname === "/api/products")
        return json(res, 200, {
          products: getProducts(db),
          shipping: { freeFrom: 699000, fee: 30000 },
        });
      if (req.method === "GET" && url.pathname.startsWith("/api/products/")) {
        const p = getProducts(db).find(
          (p) => p.id === url.pathname.slice("/api/products/".length),
        );
        if (!p) throw fail(404, "Không tìm thấy sản phẩm.");
        return json(res, 200, p);
      }
      if (req.method === "POST" && url.pathname === "/api/checkout/quote") {
        limited(req);
        return json(res, 200, quote(db, await readJson(req)));
      }
      if (req.method === "POST" && url.pathname === "/api/orders") {
        limited(req);
        const key = req.headers["idempotency-key"];
        if (typeof key !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
          throw fail(400, "Thiếu mã yêu cầu đặt hàng.");
        const input = await readJson(req);
        const customer = customerInput(input?.customer);
        if (input.paymentMethod !== "COD")
          throw fail(400, "Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).");
        const hash = createHash("sha256")
          .update(
            JSON.stringify({
              customer,
              items: input.items,
              coupon: input.coupon || "",
              paymentMethod: input.paymentMethod,
            }),
          )
          .digest("hex");
        db.exec("BEGIN IMMEDIATE");
        try {
          const prior = db
            .prepare("SELECT * FROM orders WHERE request_key=?")
            .get(key);
          if (prior) {
            if (prior.request_hash !== hash)
              throw fail(409, "Mã yêu cầu này đã được dùng cho đơn khác.");
            db.exec("COMMIT");
            return json(res, 200, {
              ...receipt(prior),
              accessToken: prior.access_token,
            });
          }
          const result = quote(db, input);
          const id = "GIO-" + randomBytes(6).toString("hex").toUpperCase(),
            accessToken = randomBytes(32).toString("hex"),
            createdAt = new Date().toISOString();
          for (const item of result.items)
            db.prepare(
              "UPDATE variants SET stock=stock-? WHERE product_id=? AND color=? AND size=?",
            ).run(item.quantity, item.productId, item.color, item.size);
          db.prepare(
            "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            id,
            key,
            hash,
            accessToken,
            JSON.stringify(customer),
            JSON.stringify(result.items),
            result.subtotal,
            result.discount,
            result.shipping,
            result.total,
            result.coupon,
            "pending",
            createdAt,
          );
          db.exec("COMMIT");
          return json(res, 201, {
            id,
            accessToken,
            ...result,
            status: "pending",
            createdAt,
            paymentMethod: "COD",
          });
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/orders/")) {
        limited(req);
        const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
        const row = db
          .prepare("SELECT * FROM orders WHERE id=?")
          .get(url.pathname.slice("/api/orders/".length));
        if (!row || !token || !equal(token, row.access_token))
          throw fail(404, "Không tìm thấy đơn hoặc mã truy cập không đúng.");
        return json(res, 200, receipt(row));
      }
      if (url.pathname.startsWith("/api/"))
        throw fail(404, "Không tìm thấy API.");
      if (req.method !== "GET" && req.method !== "HEAD")
        throw fail(405, "Phương thức không được hỗ trợ.");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        throw fail(400, "Đường dẫn không hợp lệ.");
      }
      const filename = path.resolve(
        publicDir,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (
        !filename.startsWith(publicDir + path.sep) ||
        pathname.split("/").some((part) => part.startsWith("."))
      )
        throw fail(404, "Không tìm thấy trang.");
      const extension = path.extname(filename);
      if (
        !Object.hasOwn(types, extension) ||
        !fs.existsSync(filename) ||
        !fs.statSync(filename).isFile()
      )
        throw fail(404, "Không tìm thấy trang.");
      if (!fs.realpathSync(filename).startsWith(publicDir + path.sep))
        throw fail(404, "Không tìm thấy trang.");
      res.writeHead(200, {
        "Content-Type": types[extension],
        "Cache-Control":
          extension === ".html" ? "no-cache" : "public, max-age=3600",
      });
      return res.end(
        req.method === "HEAD" ? undefined : fs.readFileSync(filename),
      );
    } catch (error) {
      if (!error.status) console.error("Request failed:", error.message);
      if (!res.headersSent)
        json(res, error.status || 500, {
          error: error.status
            ? error.message
            : "Máy chủ đang bận. Vui lòng thử lại.",
        });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, db };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { server, db } = createApp();
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? "Cổng đang được sử dụng. Dừng máy chủ cũ hoặc đổi PORT."
        : error.message,
    );
    db.close();
    process.exitCode = 1;
  });
  server.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "0.0.0.0",
    () =>
      console.log(
        `Gió Studio đang chạy — cổng ${server.address().port}. Mở http://localhost:${server.address().port}`,
      ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(() => {
        db.close();
        process.exit(0);
      }),
    );
}
