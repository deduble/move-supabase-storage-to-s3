# Supabase ↔ R2 Storage Migrator

Fast, non-destructive copy between Supabase Storage and Cloudflare R2.

## 🚀 Live Demo

**[Try it now on GitHub Pages](https://deduble.github.io/move-supabase-storage-to-s3/)**

## Features

- ✅ **DB-first listing** with Storage API fallback for fast scanning
- ✅ **Enhanced UI/UX** with clear progress indicators and error handling
- ✅ **Retry mechanisms** with exponential backoff for reliability
- ✅ **Input validation** and comprehensive error recovery
- ✅ **Production-ready** with React Error Boundaries
- ✅ **CORS guidance** for R2 configuration
- ✅ **Dry run mode** for safe testing
- ✅ **Real-time progress** tracking and activity logs

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 GitHub Pages Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions.

### Automatic Deployment
- Push to `main` branch triggers automatic build and deployment
- GitHub Actions handles the entire process
- Site is available at: https://deduble.github.io/move-supabase-storage-to-s3/

### Manual Deployment
```bash
# Build and deploy manually (requires gh-pages package)
npm run deploy
```

### GitHub Pages Setup
1. Go to repository Settings → Pages
2. Set Source to "Deploy from a branch"
3. Select branch: `gh-pages`
4. Select folder: `/ (root)`
5. GitHub Actions will handle the rest automatically

## 🔧 Configuration

### For Development
- Development server runs on `http://localhost:5173`
- Supports hot module replacement
- TypeScript compilation with strict mode

### For Production
- Optimized bundle with code splitting
- Separate chunks for AWS SDK, Supabase, and React
- GitHub Pages compatible asset paths

## 🌐 CORS Configuration for R2

If you want R2 connection testing to work in browsers, add this CORS policy to your R2 bucket:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://deduble.github.io"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "DELETE", "OPTIONS"],
    "AllowedHeaders": [
      "Authorization", "Content-Type", "Content-Length", "Content-MD5",
      "x-amz-content-sha256", "x-amz-date", "x-amz-security-token",
      "x-amz-user-agent", "x-amz-acl", "x-amz-request-id",
      "x-amz-version-id", "x-id", "range", "if-match", "if-none-match",
      "if-modified-since", "if-unmodified-since", "cache-control",
      "expires", "x-amz-server-side-encryption", "x-amz-storage-class"
    ],
    "ExposeHeaders": [
      "ETag", "x-amz-request-id", "x-amz-version-id",
      "Content-Length", "Date", "Last-Modified", "x-amz-delete-marker"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Note:** File transfers work even without CORS configuration due to AWS SDK optimizations.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ☕ Support

If you find this tool useful, consider [buying me a coffee](https://buymeacoffee.com/deduble)!

## 📄 License

MIT License - feel free to use and modify.