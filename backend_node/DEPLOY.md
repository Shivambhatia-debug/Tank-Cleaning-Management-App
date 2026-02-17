# Deploy backend_node on Vercel

1. In Vercel project **Settings → General**, set **Root Directory** to `backend_node`.
2. Add **Environment Variables** in Vercel (required for 500 fix):
   - `MONGO_URI` – your MongoDB connection string (e.g. from MongoDB Atlas)
   - `JWT_SECRET` – secret for JWT (e.g. a long random string)
3. **Job photos on admin (required for before/after photos to show):**
   - In Vercel dashboard: **Storage** → create a **Blob** store (or use existing).
   - In project **Settings → Environment Variables**, add:
     - `BLOB_READ_WRITE_TOKEN` – copy from the Blob store’s “Token” (starts with `vercel_blob_rw_...`).
   - Redeploy. Without this, photos are stored in `/tmp` and **do not persist**, so admin will see blank photo areas.
4. Redeploy. The app runs via `api/index.js` (rewrites to Express); Socket.io is not used on Vercel.
5. If you still see 500: check **Deployments → your deployment → Functions** and open the function logs to see the exact error (e.g. missing env, MongoDB connection).

**App (EAS Build):** In Expo dashboard (or `eas secret`) set `EXPO_PUBLIC_BACKEND_URL` to your Vercel backend URL (e.g. `https://your-app.vercel.app`) so the built APK uses the deployed API.
