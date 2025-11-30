# Firebase Email/Password Authentication Setup

## Vấn đề
Không thể đăng ký bằng email/password trong desktop app.

## Nguyên nhân có thể
1. Firebase chưa bật Email/Password authentication
2. Firebase config không đúng
3. Lỗi network hoặc CORS

## Giải pháp

### 1. Bật Email/Password Authentication trong Firebase Console

1. Truy cập [Firebase Console](https://console.firebase.google.com)
2. Chọn project của bạn
3. Vào **Authentication** (menu bên trái)
4. Click tab **Sign-in method**
5. Tìm **Email/Password** trong danh sách providers
6. Click vào **Email/Password**
7. Bật toggle **Enable**
8. (Optional) Bật **Email link (passwordless sign-in)** nếu cần
9. Click **Save**

### 2. Kiểm tra Firebase Configuration

Đảm bảo file `.env` có đầy đủ thông tin:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Kiểm tra Authorized Domains

1. Trong Firebase Console, vào **Authentication** > **Settings** tab
2. Scroll xuống **Authorized domains**
3. Đảm bảo có các domains sau:
   - `localhost`
   - `127.0.0.1`
   - Domain của bạn (nếu có)

### 4. Testing

1. Mở Developer Console trong app (F12 hoặc Cmd+Option+I)
2. Thử đăng ký với email và password
3. Xem console logs để biết lỗi cụ thể:
   ```
   Attempting to register with email: test@example.com
   Registration failed: [error message]
   ```

### 5. Common Errors

#### "auth/operation-not-allowed"
- **Nguyên nhân**: Email/Password authentication chưa được bật
- **Giải pháp**: Làm theo bước 1 ở trên

#### "auth/invalid-email"
- **Nguyên nhân**: Email không đúng format
- **Giải pháp**: Kiểm tra lại email

#### "auth/weak-password"
- **Nguyên nhân**: Password quá yếu (< 6 ký tự)
- **Giải pháp**: Dùng password ít nhất 6 ký tự

#### "auth/email-already-in-use"
- **Nguyên nhân**: Email đã được đăng ký
- **Giải pháp**: Dùng email khác hoặc đăng nhập

#### "auth/network-request-failed"
- **Nguyên nhân**: Không có kết nối internet hoặc Firebase bị chặn
- **Giải pháp**: Kiểm tra internet và firewall

### 6. Debug Steps

1. **Kiểm tra Firebase initialized:**
   ```javascript
   console.log('Firebase app:', app);
   console.log('Firebase auth:', getAuth(app));
   ```

2. **Kiểm tra environment variables:**
   ```javascript
   console.log('Firebase config:', {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
   });
   ```

3. **Test trực tiếp Firebase:**
   ```javascript
   import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
   
   const auth = getAuth();
   createUserWithEmailAndPassword(auth, 'test@example.com', 'password123')
     .then((userCredential) => {
       console.log('Success:', userCredential.user);
     })
     .catch((error) => {
       console.error('Error:', error.code, error.message);
     });
   ```

## Restart App

Sau khi thay đổi config hoặc bật authentication, restart app:

```bash
cd packages/desktop
pnpm tauri dev
```

## Verify Setup

Sau khi setup xong, thử:
1. Đăng ký với email mới
2. Kiểm tra Firebase Console > Authentication > Users để xem user mới
3. Đăng xuất và đăng nhập lại với cùng email/password
