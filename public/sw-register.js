// Externalized from app/layout.tsx so the page can ship a strict Content
// Security Policy without an inline-script exception for SW registration.
(function () {
  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (err) {
        console.log("ServiceWorker registration failed: ", err);
      });
    });
  }
})();
