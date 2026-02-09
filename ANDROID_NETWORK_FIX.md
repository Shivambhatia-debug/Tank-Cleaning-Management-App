# Android par "Network Error" fix

Expo Go app **HTTP (non-HTTPS)** ko block karti hai. Isliye `http://192.168.1.17:8001` pe request fail ho jati hai.

## Solution: Development build chalao (Expo Go ki jagah)

1. **Android Studio / SDK** install karo (agar nahi hai).
2. **USB debugging** on karo phone me, phone ko PC se connect karo.
3. Terminal me:
   ```bash
   cd frontend
   npx expo run:android
   ```
   Ye command apna **APK build** karega jisme `usesCleartextTraffic: true` lagega — HTTP allow hoga.
4. Backend bhi chal raha ho dusri terminal me:
   ```bash
   cd backend_node
   node server.js
   ```
5. Same Wi-Fi: Phone aur PC dono 192.168.1.x par hon.

---

## Pehle verify karo: Backend reachable hai?

PC ke browser me open karo (backend run karte waqt):
- http://192.168.1.17:8001/api/health  

Agar `{"ok":true,"message":"Backend is running"}` dikhe to backend + firewall theek hai. Phir sirf Android ko dev build se chalao.

---

## Agar dev build nahi bana sakte (Android Studio nahi hai)

**Web par test karo:**  
Terminal: `npx expo start --web`  
Browser me: http://localhost:8081  
Web me HTTP block nahi hota, to backend localhost:8001 kaam karega.
