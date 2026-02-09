# Deploy backend_node on Vercel

1. In Vercel project **Settings → General**, set **Root Directory** to `backend_node`.
2. Add **Environment Variables** in Vercel (required for 500 fix):
   - `MONGO_URI` – your MongoDB connection string (e.g. from MongoDB Atlas)
   - `JWT_SECRET` – secret for JWT (e.g. a long random string)
3. Redeploy. The app runs via `api/index.js` (rewrites to Express); Socket.io is not used on Vercel.
4. If you still see 500: check **Deployments → your deployment → Functions** and open the function logs to see the exact error (e.g. missing env, MongoDB connection).

**Note:** Uploaded files on Vercel are stored in `/tmp` and may not persist across invocations. For permanent storage, use S3/Vercel Blob later.

**App (EAS Build):** In Expo dashboard (or `eas secret`) set `EXPO_PUBLIC_BACKEND_URL` to your Vercel backend URL (e.g. `https://your-app.vercel.app`) so the built APK uses the deployed API.
