# Gió Studio — Cửa hàng thời trang

Trang bán quần áo tiếng Việt với giao diện responsive, phông chữ tiếng Việt lưu tại dự án, backend Node.js và SQLite. Không cần cài thư viện hoặc dịch vụ cơ sở dữ liệu riêng. Yêu cầu **Node.js 24 trở lên**.

## Chạy trên Windows / VS Code

1. Clone kho này bằng **Git: Clone** trong VS Code hoặc tải **Code → Download ZIP** và giải nén.
2. Chọn **File → Open Folder**, mở thư mục có `package.json`.
3. Chọn **Terminal → New Terminal**, chạy:

```sh
npm start
```

4. Khi thấy thông báo máy chủ đã chạy, mở **http://localhost:3000**. Giữ terminal mở.
5. Dừng bằng **Ctrl+C**. Lần sau chỉ cần mở lại thư mục và chạy `npm start`.

**Mở nhanh:** nhấn **F5** trong VS Code để chạy/debug theo cấu hình có sẵn, hoặc nháy đúp `start.bat` trên Windows. Chỉ dùng một cách chạy tại một thời điểm để tránh chiếm cổng.

Không cần `npm install`. `npm run dev` tự khởi động lại backend khi sửa mã; thay đổi giao diện cần tải lại trình duyệt. Có thể dùng **Terminal → Run Task → Gió: Chạy cửa hàng**. Không dùng Live Server hay mở trực tiếp `public/index.html`, vì những cách đó không chạy API.

GitHub Repositories/github.dev chỉ sửa mã trực tuyến. Nếu không clone về máy, dùng GitHub Codespaces, chạy `npm start` rồi mở cổng 3000 từ tab Ports. Codespaces có hạn mức và có thể phát sinh phí.

## Chức năng

- Trang chủ với bộ sưu tập, câu chuyện thương hiệu, chính sách, FAQ.
- 12 sản phẩm mẫu: áo thun, sơ mi, áo khoác, polo, quần, váy, túi và mũ.
- Danh mục nữ, nam, unisex, phụ kiện; lọc loại, giá, cỡ; tìm kiếm có hoặc không dấu; sắp xếp giá/mới.
- Chi tiết sản phẩm với ảnh minh họa đổi theo màu, chọn cỡ, số lượng, chất liệu, chăm sóc và bảng cỡ tham khảo.
- Mục yêu thích và giỏ hàng lưu trong localStorage.
- Mã `CHAO10`: giảm 10%, tối đa 100.000đ mỗi đơn, chưa giới hạn theo người dùng.
- Phí giao hàng 30.000đ; miễn phí từ 699.000đ **sau giảm giá**.
- Backend kiểm tra giỏ, tự tính giá/ưu đãi/phí, kiểm tra và trừ tồn kho theo màu/cỡ trong một giao dịch.
- Đặt hàng COD, xác nhận mã đơn, xem lại tối đa 20 đơn gần nhất trên cùng trình duyệt với mã truy cập riêng.
- Gửi lại cùng yêu cầu không tạo trùng đơn; giới hạn cơ bản số yêu cầu tới API đặt hàng.

## Cấu trúc

```text
public/
  index.html          # Trang cửa hàng, biểu mẫu, các hộp thoại
  css/                # Giao diện responsive và khai báo font
  js/app.js           # Tương tác và gọi API
  images/             # Ảnh bộ sưu tập và minh họa các màu sản phẩm
  fonts/              # Be Vietnam Pro và giấy phép SIL OFL
server/
  index.js            # HTTP server, API và tính đơn hàng
  db.js               # SQLite, schema và khởi tạo dữ liệu
  catalog.js          # Dữ liệu sản phẩm mẫu
scripts/
  generate-products.js # Tạo lại minh họa SVG từ catalog
test/api.test.js     # Kiểm thử backend, database tạm
.vscode/              # F5 và tác vụ chạy trong VS Code
start.bat             # Mở nhanh trên Windows
```

Ảnh bộ sưu tập là ảnh được tạo bằng AI cho dự án; minh họa sản phẩm SVG được tạo trong dự án. Đây không phải ảnh chụp hàng hóa thật. Font Be Vietnam Pro 5.2.8 theo SIL Open Font License; xem `public/fonts/LICENSE.txt`. Không cần truy cập Google Fonts hay dịch vụ ảnh ngoài khi chạy.

## Dữ liệu và cấu hình

SQLite tự tạo tại `data/shop.sqlite`, được Git bỏ qua. Tồn kho ban đầu là 10 chiếc **cho từng tổ hợp màu/cỡ**. Khởi động lại không nạp lại tồn kho và không xóa đơn. Seed chỉ thêm bản ghi còn thiếu; sửa `server/catalog.js` không ghi đè sản phẩm đã có trong database. Không xóa `data/` khi cần giữ đơn.

Các biến môi trường tùy chọn (tham khảo `.env.example`):

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3000` | Cổng máy chủ |
| `HOST` | `0.0.0.0` | Địa chỉ bind |
| `DB_PATH` | `data/shop.sqlite` | Đường dẫn SQLite; nên đặt trên ổ bền vững |

Không tự đọc `.env`. Khai báo biến trong terminal hoặc nền tảng hosting. Ví dụ PowerShell khi cổng 3000 đang bận:

```powershell
$env:PORT=3001
npm start
```

Thông tin nhận hàng được lưu trong database, không xuất ra API công khai. Mã truy cập đơn được giữ trong database và localStorage của người mua; không chia sẻ mã hoặc dùng trình duyệt công cộng để đặt đơn. Lịch sử trên trình duyệt không đồng bộ thiết bị; xóa lịch sử trình duyệt không xóa đơn ở máy chủ.

## API

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `/api/health` | Kiểm tra máy chủ/SQLite |
| GET | `/api/products` | Sản phẩm, các mẫu tồn kho và quy tắc giao hàng |
| GET | `/api/products/:id` | Chi tiết một sản phẩm |
| POST | `/api/checkout/quote` | Kiểm tra tồn kho, giá và tổng tiền; không trừ kho |
| POST | `/api/orders` | Lưu đơn COD và trừ kho; yêu cầu `Idempotency-Key` |
| GET | `/api/orders/:id` | Biên nhận; yêu cầu `Authorization: Bearer <accessToken>` |

Ví dụ dữ liệu gửi `POST /api/orders` (`Content-Type: application/json`):

```json
{
  "customer": {
    "name": "Nguyễn An",
    "phone": "0901234567",
    "city": "Hà Nội",
    "address": "123 Đường Mẫu, Phường Mẫu",
    "note": "Đơn kiểm thử"
  },
  "items": [{"productId": "everyday-tee", "color": "cream", "size": "M", "quantity": 2}],
  "coupon": "CHAO10",
  "paymentMethod": "COD"
}
```

Dùng UUID mới trong header `Idempotency-Key` cho mỗi đơn. Gửi lại cùng key/dữ liệu nhận cùng đơn và mã truy cập, không trừ kho thêm. Key cũ với dữ liệu khác trả `409`. Tạo đơn thành công trả `201` với `id`, `accessToken`, chi tiết sản phẩm, tổng tiền và `status: pending`. Mã truy cập được gửi trong header khi xem biên nhận, không đặt trong URL. API biên nhận không trả địa chỉ, số điện thoại, hoặc token.

Giới hạn 40 mẫu trong giỏ, 1–10 sản phẩm mỗi mẫu. Biến thể trùng hoặc không tồn tại trả `400`; thiếu kho trả `409`; sai JSON trả `400`; quá dung lượng trả `413`; quá tần suất trả `429`. Máy chủ bỏ qua giá do trình duyệt gửi, không tin dữ liệu localStorage.

## Kiểm tra

```sh
npm run check
npm test
```

Kiểm thử API dùng database tạm, không thay đổi dữ liệu cửa hàng: phục vụ ảnh/font, kiểm tra giá và mã ưu đãi, kiểm tra biến thể, chống đơn trùng, quyền xem biên nhận, không bán vượt tồn kho, rollback khi giỏ có mẫu hết hàng, giữ dữ liệu sau khởi động lại, và chặn burst/cross-site.

## Trước khi mở bán

Đây là **bản phát triển có dữ liệu mẫu**. Đơn được lưu để kiểm thử; chưa thu tiền hoặc kết nối vận chuyển, chưa có trang quản trị, tài khoản, cập nhật trạng thái, hủy/hoàn đơn hoặc quản lý hàng hóa qua giao diện. Giá, bảng cỡ, nội dung và chính sách cần thay bằng thông tin cửa hàng thật.

Để triển khai cần Node.js 24+, HTTPS, ổ đĩa bền vững cho SQLite, sao lưu và quyền truy cập máy chủ phù hợp. Không thể chỉ bật GitHub Pages vì backend cần tiến trình Node.js. Giới hạn tần suất trong tiến trình chỉ là cơ bản; nên thêm giới hạn/chống spam ở reverse proxy, cấu hình IP tin cậy, quản trị có xác thực, quy trình xử lý/xóa dữ liệu khách hàng và tích hợp vận chuyển/thanh toán trước khi nhận đơn thật.
