# Google OAuth Setup cho Desktop App

## Vấn đề
Desktop app (Tauri) không thể sử dụng popup cho Google OAuth vì popup bị chặn bởi trình duyệt hệ thống.

## Giải pháp
Đã chuyển từ `signInWithPopup` sang `signInWithRedirect` để mở Google OAuth trong trình duyệt hệ thống.

## Cách hoạt động

1. **Khi user click "Đăng nhập với Google":**
   - App gọi `signInWithRedirect()`
   - Firebase mở trình duyệt hệ thống với trang đăng nhập Google
   - User đăng nhập và cho phép quyền truy cập

2. **Sau khi OAuth thành công:**
   - Trình duyệt redirect về app với token
   - App tự động khởi động lại
   - `getRedirectResult()` được gọi trong `initialize()` để lấy thông tin user
   - User được đăng nhập tự động

## Cấu hình Firebase Console

Để OAuth redirect hoạt động, cần thêm authorized redirect URIs trong Firebase Console:

1. Truy cập [Firebase Console](https://console.firebase.google.com)
2. Chọn project của bạn
3. Vào **Authentication** > **Sign-in method**
4. Click vào **Google** provider
5. Thêm các URIs sau vào **Authorized redirect URIs**:
   ```
   http://localhost
   http://localhost:8081
   tauri://localhost
   ```

## Cấu hình Google Cloud Console

Nếu bạn đang sử dụng custom OAuth client:

1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Chọn project của bạn
3. Vào **APIs & Services** > **Credentials**
4. Click vào OAuth 2.0 Client ID của bạn
5. Thêm các URIs sau vào **Authorized redirect URIs**:
   ```
   http://localhost
   http://localhost:8081
   tauri://localhost
   ```

## Testing

1. Build và chạy app:
   ```bash
   cd packages/desktop
   pnpm tauri dev
   ```

2. Click "Đăng nhập với Google"
3. Trình duyệt sẽ mở trang đăng nhập Google
4. Đăng nhập và cho phép quyền
5. App sẽ tự động đăng nhập sau khi redirect

## Lưu ý

- Redirect flow sẽ làm app khởi động lại, đây là hành vi bình thường
- Loading state sẽ được giữ trong quá trình redirect
- Nếu user hủy đăng nhập, app sẽ không hiển thị lỗi
- Auth state được persist trong localStorage nên user không cần đăng nhập lại

## Troubleshooting

### Lỗi "redirect_uri_mismatch"
- Kiểm tra lại authorized redirect URIs trong Firebase/Google Console
- Đảm bảo đã thêm đúng URIs như hướng dẫn ở trên

### App không tự động đăng nhập sau redirect
- Kiểm tra console logs để xem có lỗi gì không
- Đảm bảo `getRedirectResult()` được gọi trong `initialize()`
- Xóa localStorage và thử lại

### Popup vẫn bị chặn
- Đảm bảo đang chạy trong Tauri environment (không phải web browser)
- Kiểm tra `'__TAURI__' in window` trả về `true`
