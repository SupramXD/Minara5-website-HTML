// Studio Extrait - Admin Shared Utilities Module

(function() {
  window.compressImage = function(file, maxWidth = 1200, quality = 0.80) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/webp', quality);
          resolve(dataUrl);
        };
        img.onerror = function(err) { reject(err); };
        img.src = event.target.result;
      };
      reader.onerror = function(err) { reject(err); };
      reader.readAsDataURL(file);
    });
  };

  window.sanitizeImageUrl = function(url) {
    if (!url || typeof url !== 'string') return "";
    const trimmed = url.trim();
    if (trimmed.startsWith("file:") || trimmed.includes(":\\") || trimmed.includes("antigravity-ide")) {
      const idx = trimmed.indexOf("images/");
      if (idx !== -1) {
        return trimmed.substring(idx);
      }
      return "";
    }
    return trimmed;
  };

  window.logAdminSave = function(msg, isError = false) {
    console.log("[AdminSaveLog]", msg);
    const box = document.getElementById("adminSaveLogBox");
    if (box) {
      box.style.display = "block";
      const timestamp = new Date().toLocaleTimeString();
      const color = isError ? "#ff4444" : "#00ff66";
      box.innerHTML += `<div style="color: ${color}; margin-bottom: 3px;">[${timestamp}] ${msg}</div>`;
      box.scrollTop = box.scrollHeight;
    }
  };

  window.compressUrlOrPath = function(urlOrPath, maxWidth = 1200, quality = 0.80) {
    return new Promise((resolve) => {
      if (!urlOrPath) {
        resolve("");
        return;
      }
      const cleaned = window.sanitizeImageUrl(urlOrPath);
      if (!cleaned || cleaned.startsWith('file:') || cleaned.includes(':\\') || cleaned.includes('antigravity-ide')) {
        console.warn("Security bypass: Ignoring local file path in compressUrlOrPath:", urlOrPath);
        resolve("");
        return;
      }
      if (cleaned.startsWith('data:')) {
        resolve(cleaned);
        return;
      }
      
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/webp', quality);
            resolve(dataUrl);
          } catch (canvasErr) {
            console.warn("Canvas conversion failed, resolving original:", canvasErr);
            resolve(cleaned);
          }
        };
        img.onerror = function(err) {
          console.warn("Image load failed in compressUrlOrPath, resolving original:", cleaned);
          resolve(cleaned);
        };
        img.src = cleaned;
      } catch (e) {
        console.warn("Image setup exception in compressUrlOrPath:", e);
        resolve(cleaned);
      }
    });
  };

  window.readFileAsDataURL = function(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = function(event) {
        resolve(event.target.result);
      };
      reader.onerror = function(err) {
        reject(err);
      };
      reader.readAsDataURL(file);
    });
  };

  window.getFileExtension = function(filename, defaultExt = "webp") {
    if (!filename) return defaultExt;
    const match = filename.match(/\.([a-zA-Z0-9]+)$/);
    if (!match) return defaultExt;
    let ext = match[1].toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    return ext;
  };

  window.predictPath = function(file, inputVal, defaultPath) {
    if (file) {
      const ext = window.getFileExtension(file.name);
      const folder = defaultPath.includes("second-hero") ? "images/second-hero" : "images/hero";
      const name = defaultPath.includes("left") ? "left" : (defaultPath.includes("right") ? "right" : "mobile");
      return `${folder}/${name}.${ext}`;
    }
    if (inputVal && inputVal.trim() !== "") {
      return inputVal.trim();
    }
    return defaultPath;
  };

  window.formatPrice = window.formatPrice || function(value) {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return Math.round(Number(value)).toString();
  };

  window.formatRetailPrice = window.formatRetailPrice || function(value) {
    if (value === undefined || value === null || isNaN(value)) return "0";
    const cleanVal = Math.round(Number(value)).toString();
    return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  window.formatSessionDateTime = window.formatSessionDateTime || function(isoStr) {
    if (!isoStr) return "N/A";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "N/A";
    const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${datePart} • ${timePart}`;
  };

  window.formatRelativeTime = window.formatRelativeTime || function(isoStr) {
    if (!isoStr) return "";
    const diffSec = Math.round((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diffSec < 45) return "Online Now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };
})();
