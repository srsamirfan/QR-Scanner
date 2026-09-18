(() => {
  "use strict";

  // ─── DOM refs ───────────────────────────────────────────────
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const statusBar = document.getElementById("camera-status");
  const statusText = document.getElementById("status-text");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const btnSwitch = document.getElementById("btn-switch");
  const btnTorch = document.getElementById("btn-torch");
  const resultCard = document.getElementById("result-card");
  const resultContent = document.getElementById("result-content");
  const btnCopy = document.getElementById("btn-copy");
  const btnOpen = document.getElementById("btn-open");
  const btnShare = document.getElementById("btn-share");
  const btnCloseResult = document.getElementById("btn-close-result");
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const btnBrowse = document.getElementById("btn-browse");
  const previewContainer = document.getElementById("preview-container");
  const previewImg = document.getElementById("preview-img");
  const uploadCanvas = document.getElementById("upload-canvas");
  const btnClearPreview = document.getElementById("btn-clear-preview");
  const historyList = document.getElementById("history-list");
  const btnClearHistory = document.getElementById("btn-clear-history");
  const toastEl = document.getElementById("toast");

  // ─── State ──────────────────────────────────────────────────
  let stream = null;
  let scanning = false;
  let animFrame = null;
  let facingMode = "environment";
  let torchOn = false;
  let lastResult = null;
  let history = loadHistory();

  // ─── Tabs ───────────────────────────────────────────────────
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");

      if (tab.dataset.tab !== "camera" && scanning) {
        stopCamera();
      }
    });
  });

  // ─── Camera ─────────────────────────────────────────────────
  btnStart.addEventListener("click", startCamera);
  btnStop.addEventListener("click", stopCamera);
  btnSwitch.addEventListener("click", switchCamera);
  btnTorch.addEventListener("click", toggleTorch);

  async function startCamera() {
    try {
      setStatus("Requesting camera…");
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();
      scanning = true;
      btnStart.disabled = true;
      btnStop.disabled = false;
      btnSwitch.disabled = false;
      checkTorchSupport();
      setStatus("Scanning…", "scanning");
      tick();
    } catch (err) {
      console.error(err);
      setStatus("Camera access denied or unavailable", "error");
      toast("Camera permission denied. Use Upload instead.");
    }
  }

  function stopCamera() {
    scanning = false;
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
    btnStart.disabled = false;
    btnStop.disabled = true;
    btnSwitch.disabled = true;
    btnTorch.disabled = true;
    torchOn = false;
    setStatus("Ready to scan");
  }

  async function switchCamera() {
    facingMode = facingMode === "environment" ? "user" : "environment";
    stopCamera();
    await startCamera();
  }

  function checkTorchSupport() {
    const track = stream?.getVideoTracks()[0];
    if (track && typeof track.getCapabilities === "function") {
      const caps = track.getCapabilities();
      btnTorch.disabled = !caps.torch;
    } else {
      btnTorch.disabled = true;
    }
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      btnTorch.style.color = torchOn ? "var(--primary)" : "";
    } catch (e) {
      toast("Flash not supported on this device");
      torchOn = false;
    }
  }

  function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code && code.data) {
        onScanSuccess(code.data);
        // brief pause so continuous stream doesn't spam
        scanning = false;
        setTimeout(() => {
          if (stream) {
            scanning = true;
            tick();
          }
        }, 1500);
        return;
      }
    }
    animFrame = requestAnimationFrame(tick);
  }

  // ─── Upload ─────────────────────────────────────────────────
  btnBrowse.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target === dropZone || e.target.closest(".upload-icon, .upload-title, .upload-hint")) {
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
    else toast("Please drop an image file");
  });

  btnClearPreview.addEventListener("click", () => {
    previewContainer.hidden = true;
    dropZone.hidden = false;
    previewImg.src = "";
    fileInput.value = "";
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        dropZone.hidden = true;
        previewContainer.hidden = false;
        previewImg.src = reader.result;

        // Decode
        const c = uploadCanvas;
        const cctx = c.getContext("2d", { willReadFrequently: true });
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        cctx.drawImage(img, 0, 0);
        const imageData = cctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code && code.data) {
          onScanSuccess(code.data);
        } else {
          toast("No QR code found in image");
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ─── Result handling ────────────────────────────────────────
  function onScanSuccess(data) {
    lastResult = data;
    resultContent.textContent = data;
    resultCard.hidden = false;

    // URL detection
    const isUrl = /^https?:\/\//i.test(data);
    btnOpen.hidden = !isUrl;
    if (isUrl) {
      btnOpen.onclick = () => window.open(data, "_blank", "noopener");
    }

    // Share API
    if (navigator.share) {
      btnShare.hidden = false;
      btnShare.onclick = () => {
        navigator.share({ text: data }).catch(() => {});
      };
    } else {
      btnShare.hidden = true;
    }

    addToHistory(data);
    toast("QR Code detected!");
    // Haptic if available
    if (navigator.vibrate) navigator.vibrate(80);
  }

  btnCloseResult.addEventListener("click", () => {
    resultCard.hidden = true;
  });

  btnCopy.addEventListener("click", async () => {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(lastResult);
      toast("Copied to clipboard");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = lastResult;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Copied to clipboard");
    }
  });

  // ─── History ────────────────────────────────────────────────
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem("qr-history") || "[]");
    } catch {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem("qr-history", JSON.stringify(history.slice(0, 50)));
  }

  function addToHistory(text) {
    const entry = { text, time: Date.now() };
    // avoid exact consecutive duplicates
    if (history[0] && history[0].text === text) return;
    history.unshift(entry);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No scans yet</p>
        </div>`;
      return;
    }
    historyList.innerHTML = history
      .map(
        (h) => `
      <div class="history-item" data-text="${escapeAttr(h.text)}">
        <div class="text">${escapeHtml(truncate(h.text, 80))}</div>
        <div class="meta">${formatTime(h.time)}</div>
      </div>`
      )
      .join("");

    historyList.querySelectorAll(".history-item").forEach((el) => {
      el.addEventListener("click", () => {
        onScanSuccess(el.dataset.text);
      });
    });
  }

  btnClearHistory.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
    toast("History cleared");
  });

  // ─── Helpers ────────────────────────────────────────────────
  function setStatus(text, type = "") {
    statusText.textContent = text;
    statusBar.className = "status-bar" + (type ? " " + type : "");
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Init
  renderHistory();

  // Cleanup on page hide
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && scanning) stopCamera();
  });
})();
