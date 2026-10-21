# Đưa website lên Render Free

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/GiosANM/Web-b-n-h-ng)

Website này có sẵn frontend và backend. Render chạy cả hai bằng một dịch vụ Node.js, cho phép mở website qua địa chỉ HTTPS công khai mà không cần VS Code hoặc Codespaces.

## Triển khai từ GitHub

1. Nhấn **Deploy to Render** ở trên, hoặc mở [trang triển khai](https://render.com/deploy?repo=https://github.com/GiosANM/Web-b-n-h-ng).
2. Đăng nhập hoặc tạo tài khoản Render. Nếu được yêu cầu, kết nối GitHub và cho Render quyền đọc kho `GiosANM/Web-b-n-h-ng`.
3. Render đọc tệp `render.yaml`. Kiểm tra dịch vụ `gio-studio-demo` dùng gói **Free**, rồi xác nhận triển khai Blueprint.
4. Chờ bước kiểm tra và khởi động hoàn tất. Mở dịch vụ vừa tạo trong Render Dashboard, rồi nhấn địa chỉ **HTTPS có đuôi `.onrender.com` do Render cấp** để xem website.

Địa chỉ công khai chỉ được cấp sau khi Render tạo dịch vụ thành công. Liên kết Deploy to Render mở màn hình thiết lập, không phải địa chỉ website đã chạy.

## Cấu hình đã chuẩn bị

- Node.js **24.19.0**, hỗ trợ SQLite tích hợp.
- Trước khi chạy: `npm run check && npm test`.
- Khởi động: `npm start`.
- Render tự cấp biến `PORT`; ứng dụng lắng nghe cổng đó trên `0.0.0.0`.
- Kiểm tra sẵn sàng: `GET /api/health`.
- SQLite tại `/tmp/gio-studio/shop.sqlite`. Không cần API key, mật khẩu database, `npm install` hoặc dịch vụ database riêng.
- Frontend, ảnh và font chữ được phục vụ cùng backend; không cần cấu hình domain API hoặc CORS riêng.

Nếu không dùng Blueprint, có thể tạo **Web Service** từ cùng kho GitHub và nhập các lệnh/biến tương ứng trong `render.yaml`. Chọn **Node** và gói **Free**.

## Giới hạn của bản demo miễn phí

Render Free có thể ngủ khi không hoạt động; lần truy cập đầu sau đó có thể phải chờ khởi động. Ổ đĩa không bền vững: đơn hàng và thay đổi tồn kho có thể mất khi dịch vụ khởi động lại hoặc triển khai lại. Không cấu hình ổ đĩa trả phí trong Blueprint này.

Đây là cửa hàng thử nghiệm: chưa thu tiền, chưa giao hàng thực tế và chưa có quản trị. Nếu cần giữ đơn hàng lâu dài, cần chuyển sang cấu hình có lưu trữ bền vững trước khi nhận đơn thật.

## Kiểm tra sau triển khai

1. Mở website và xác nhận xuất hiện 12 sản phẩm mẫu.
2. Tìm “áo thun”, chọn màu/cỡ và thêm vào giỏ.
3. Dùng `CHAO10`, kiểm tra tổng tiền rồi đặt một đơn với thông tin mẫu.
4. Mở “Đơn hàng của tôi” trên cùng trình duyệt để xem lại biên nhận.
5. Mở đường dẫn `/api/health` trên chính domain Render, kết quả phải là `{"status":"ok"}`.

Nếu triển khai thất bại, kiểm tra **Logs** trong Render Dashboard. Không chia sẻ token hoặc mật khẩu trong chat.
