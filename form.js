(() => {
  const btn    = document.getElementById("openForm");
  const status = document.getElementById("status");
  const debug  = document.getElementById("debug");
  const mapBox = document.getElementById("map");

  const BASE_URL = "https://forms.geo-verification.com";

  const polygonCoords = [
    [21.45338975, 39.85719504],
    [21.45335511, 39.85706157],
    [21.45327091, 39.85710649],
    [21.45329121, 39.85721942],
    [21.45338975, 39.85719504]
  ];

  function updateStatus(msg, type = "info") {
    status.textContent = msg;
    status.className = `status ${type}`;
    status.style.display = "block";
  }

  function showDebug(obj) {
    debug.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    debug.style.display = "block";
  }

  function renderMap(lat, lon) {
    const map = L.map("map").setView([lat, lon], 18);

    L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "🛰️ Google Satellite"
    }).addTo(map);

    L.marker([lat, lon]).addTo(map)
      .bindPopup("📍 موقعك الحالي")
      .openPopup();

    const polygon = L.polygon(polygonCoords, {
      color: "green",
      fillOpacity: 0.3
    }).addTo(map);

    polygon.bindPopup("✅ المنطقة المسموح بها");
  }

  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.classList.add("loading");
    btn.textContent = "جارٍ التحقق من الموقع...";

    status.style.display = "none";
    debug.style.display = "none";
    mapBox.innerHTML = ""; // إعادة تعيين الخريطة

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      updateStatus(`📍 موقعك الحالي: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, "info");
      renderMap(lat, lon);

      try {
        const res = await fetch(`${BASE_URL}/api/get-form-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon }),
          cache: "no-store"
        });

        const contentType = res.headers.get("Content-Type") || "";
        if (!contentType.includes("application/json")) {
          const rawText = await res.text();
          throw new Error(`🧨 الرد ليس JSON. المحتوى:\n${rawText.substring(0, 120)}...`);
        }

        const result = await res.json();
        showDebug(result);

        if (!res.ok || !result.success || !result.token) {
          throw new Error(result.reason || "تم رفض التحقق أو لا يوجد توكن");
        }

        updateStatus("✅ تم التحقق، جاري فتح النموذج المحمي...", "success");

        const popup = window.open(`${BASE_URL}/embed-form?token=${encodeURIComponent(result.token)}`, "_blank", "width=900,height=700");

        const closeCheck = setInterval(() => {
          if (popup?.closed) {
            clearInterval(closeCheck);
            window.location.href = "./thank-you.html";
          }
        }, 1000);

      } catch (err) {
        updateStatus(`⚠️ فشل التحقق أو الاتصال.`, "warning");
        showDebug(err.message);
        console.warn("⛔️ خطأ:", err);
      } finally {
        btn.disabled = false;
        btn.classList.remove("loading");
        btn.textContent = "فتح النموذج الآن";
      }

    }, err => {
      let msg = "❌ تعذر تحديد الموقع.";
      if (err.code === err.PERMISSION_DENIED) msg = "🚫 رفضت إذن تحديد الموقع.";
      else if (err.code === err.POSITION_UNAVAILABLE) msg = "⚠️ تعذر الحصول على موقعك.";
      else if (err.code === err.TIMEOUT) msg = "⏱️ انتهى الوقت بدون استجابة.";

      updateStatus(msg, "error");
      showDebug(err.message || err);
      btn.disabled = false;
      btn.classList.remove("loading");
      btn.textContent = "فتح النموذج الآن";
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
})();
