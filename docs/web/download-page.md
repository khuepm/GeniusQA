# Download Page Documentation

## Overview

Trang Download được tạo để cung cấp cho người dùng thông tin và links download ứng dụng desktop GeniusQA cho Windows và macOS.

## Features

### 1. **Download Section trên Landing Page**
- Thêm section download ngay trên trang chủ
- Hiển thị 2 nút download lớn cho Windows và macOS
- Badge "Desktop Application" để phân biệt
- Links dẫn đến trang Download chuyên dụng

### 2. **Dedicated Download Page** (`/download`)
- Trang chuyên dụng với đầy đủ thông tin
- Layout responsive và modern
- Chi tiết về system requirements
- Quick start guide

### 3. **Platform Information**

#### Windows
- **Version**: 1.0.0
- **Size**: 95 MB
- **Requirements**:
  - Windows 10 or later (64-bit)
  - 4 GB RAM minimum
  - 500 MB available disk space
  - Internet connection for AI features

- **Features**:
  - Native Windows UI
  - System tray integration
  - Windows automation support
  - Auto-update functionality

#### macOS
- **Version**: 1.0.0
- **Size**: 110 MB
- **Requirements**:
  - macOS 11 (Big Sur) or later
  - 4 GB RAM minimum
  - 500 MB available disk space
  - Internet connection for AI features

- **Features**:
  - Native macOS UI
  - Menu bar integration
  - macOS automation support
  - Apple Silicon optimized

### 4. **Quick Start Guide**
4 bước đơn giản:
1. Download & Install
2. Sign In or Register
3. Start Recording
4. Run & Automate

### 5. **Security Information**
- Code Signed (digitally signed)
- No Malware (scanned by antivirus)
- Auto Updates

## Navigation

### Added Links
- Navigation bar: "Download" link
- Footer: "Download" link trong Product section
- Landing page: Download section với 2 buttons

## File Structure

```
packages/web/src/
├── pages/
│   ├── Download.tsx       # Trang download chuyên dụng
│   └── Landing.tsx        # Updated với download section
└── App.tsx                # Updated routing
```

## Routing

```typescript
<Route path="/download" element={<Download />} />
```

## Design Highlights

### Colors
- Windows card: Blue gradient (`from-blue-600 to-blue-700`)
- macOS card: Dark gradient (`from-slate-800 to-slate-900`)
- Icons: Platform-specific (Monitor for Windows, Apple for macOS)

### Components Used
- `lucide-react` icons: Download, Monitor, Apple, CheckCircle, Shield, etc.
- Tailwind CSS for styling
- React Router for navigation

## Future Enhancements

1. **Real Download Links**
   - Hiện tại đang dùng `#` placeholder
   - Cần update với actual download URLs khi có build

2. **Version Management**
   - Auto-detect latest version
   - Changelog integration

3. **Download Statistics**
   - Track download counts
   - Popular platform analytics

4. **Direct Download Buttons**
   - Auto-detect user OS
   - Suggest appropriate version

5. **Beta/Stable Channels**
   - Multiple release channels
   - Version selection

## Monorepo Commands

Sử dụng pnpm filter để build và chạy:

```bash
# Development
pnpm --filter @geniusqa/web dev

# Build
pnpm --filter @geniusqa/web build

# Preview
pnpm --filter @geniusqa/web preview

# Type check
pnpm --filter @geniusqa/web type-check

# Or from root:
pnpm dev
pnpm build
pnpm preview
```

## Testing Checklist

- [ ] Landing page loads with download section
- [ ] Download page accessible at `/download`
- [ ] Navigation links work correctly
- [ ] Responsive design on mobile
- [ ] Icons render properly
- [ ] Footer links work
- [ ] Back to home button works
- [ ] Download buttons styled correctly

## Notes

- Download URLs currently set to `#` - needs actual URLs when builds are ready
- Design follows landing page aesthetic (slate/blue color scheme)
- Fully responsive for mobile, tablet, desktop
- No authentication required to access download page
