# Chạy trên trình duyệt, không cần tải mã về máy

1. Đăng nhập GitHub rồi mở [Gió Studio trong Codespaces](https://codespaces.new/GiosANM/Web-b-n-h-ng?ref=main).
2. Chọn **Create codespace** và chờ GitHub chuẩn bị môi trường Node.js 24.
3. Website tự khởi động. Nếu trình duyệt chưa tự mở trang, chọn tab **Ports**, tìm cổng **3000 — Gió Studio**, rồi nhấn **Open in Browser** (biểu tượng quả địa cầu).

Lần tạo đầu tiên tự chạy kiểm tra cú pháp và 6 kiểm thử backend. Khi mở lại Codespace, cửa hàng tự chạy lại; nếu máy chủ đã hoạt động thì không khởi động thêm bản thứ hai.

Codespaces là môi trường phát triển theo tài khoản GitHub. Cổng được giữ riêng tư theo mặc định; người mở website cần đăng nhập đúng tài khoản. Đây không phải dịch vụ hosting công khai hoạt động liên tục. GitHub áp dụng hạn mức và có thể tính phí Codespaces theo tài khoản; dừng Codespace khi không dùng.

Database được giữ trong `data/shop.sqlite` của Codespace. Dừng rồi mở lại Codespace giữ dữ liệu; xóa Codespace có thể làm mất dữ liệu này. Không dùng thông tin khách hàng thật để thử nghiệm. Nhật ký máy chủ: `data/codespaces-server.log`.

Nếu cần khởi động lại sau khi dừng máy chủ, chạy:

```sh
bash .devcontainer/start.sh
```

Không cần `npm install` hoặc cấu hình mật khẩu cơ sở dữ liệu. Khi thay đổi cấu hình dev container trong một Codespace đã tồn tại, dùng **Codespaces: Rebuild Container** trong Command Palette để áp dụng.
