// Studio Extrait - Admin Hero & Settings Management Module

(function() {
  // ==========================================
  // HELPER UTILITIES
  // ==========================================
  const readFileAsDataURL = function(file) {
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

  const getFileExtension = function(filename, defaultExt = "webp") {
    if (!filename) return defaultExt;
    const match = filename.match(/\.([a-zA-Z0-9]+)$/);
    if (!match) return defaultExt;
    let ext = match[1].toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    return ext;
  };

  const predictPath = function(file, inputVal, defaultPath) {
    if (file) {
      const ext = getFileExtension(file.name);
      const folder = defaultPath.includes("second-hero") ? "images/second-hero" : "images/hero";
      const name = defaultPath.includes("left") ? "left" : (defaultPath.includes("right") ? "right" : "mobile");
      return `${folder}/${name}.${ext}`;
    }
    if (inputVal && inputVal.trim() !== "") {
      return inputVal.trim();
    }
    return defaultPath;
  };

  // ==========================================
  // HERO PREVIEWS & SLIDERS
  // ==========================================
  window.updateLogoSliders = function() {
    const dSpawnEl = document.getElementById("logoDesktopSpawn");
    const dStickEl = document.getElementById("logoDesktopStick");
    const dXEl = document.getElementById("logoDesktopX");
    const mSpawnEl = document.getElementById("logoMobileSpawn");
    const mStickEl = document.getElementById("logoMobileStick");
    const mXEl = document.getElementById("logoMobileX");

    const headerDHeightEl = document.getElementById("logoHeaderDesktopHeight");
    const headerMHeightEl = document.getElementById("logoHeaderMobileHeight");
    const homeDWidthEl = document.getElementById("logoHomeDesktopWidth");
    const homeMWidthEl = document.getElementById("logoHomeMobileWidth");

    if (!dSpawnEl || !dStickEl || !dXEl || !mSpawnEl || !mStickEl || !mXEl) return;

    const dSpawn = dSpawnEl.value;
    const dStick = dStickEl.value;
    const dX = dXEl.value;
    const mSpawn = mSpawnEl.value;
    const mStick = mStickEl.value;
    const mX = mXEl.value;

    const headerDHeight = headerDHeightEl ? headerDHeightEl.value : "50";
    const headerMHeight = headerMHeightEl ? headerMHeightEl.value : "36";
    const homeDWidth = homeDWidthEl ? homeDWidthEl.value : "1200";
    const homeMWidth = homeMWidthEl ? homeMWidthEl.value : "88";

    if (document.getElementById("logoDesktopSpawnVal")) document.getElementById("logoDesktopSpawnVal").value = dSpawn;
    if (document.getElementById("logoDesktopStickVal")) document.getElementById("logoDesktopStickVal").value = dStick;
    if (document.getElementById("logoDesktopXVal")) document.getElementById("logoDesktopXVal").value = dX;
    if (document.getElementById("logoMobileSpawnVal")) document.getElementById("logoMobileSpawnVal").value = mSpawn;
    if (document.getElementById("logoMobileStickVal")) document.getElementById("logoMobileStickVal").value = mStick;
    if (document.getElementById("logoMobileXVal")) document.getElementById("logoMobileXVal").value = mX;

    if (document.getElementById("logoHeaderDesktopHeightVal")) document.getElementById("logoHeaderDesktopHeightVal").value = headerDHeight;
    if (document.getElementById("logoHeaderMobileHeightVal")) document.getElementById("logoHeaderMobileHeightVal").value = headerMHeight;
    if (document.getElementById("logoHomeDesktopWidthVal")) document.getElementById("logoHomeDesktopWidthVal").value = homeDWidth;
    if (document.getElementById("logoHomeMobileWidthVal")) document.getElementById("logoHomeMobileWidthVal").value = homeMWidth;

    if (document.getElementById("logoDesktopSpawn2") && document.getElementById("logoDesktopSpawn2Val")) {
      document.getElementById("logoDesktopSpawn2Val").value = document.getElementById("logoDesktopSpawn2").value;
    }
    if (document.getElementById("logoMobileSpawn2") && document.getElementById("logoMobileSpawn2Val")) {
      document.getElementById("logoMobileSpawn2Val").value = document.getElementById("logoMobileSpawn2").value;
    }

    // Real-time Visual Previews for Logos
    const previewDesktopContainer = document.getElementById("previewDesktopContainer");
    const previewLogoDesktop = document.getElementById("previewLogoDesktop");
    if (previewDesktopContainer && previewLogoDesktop) {
      const scaleX = previewDesktopContainer.offsetWidth / 1200;
      previewLogoDesktop.style.top = dSpawn + "%";
      previewLogoDesktop.style.transform = `translate(calc(-50% + ${dX * scaleX}px), -50%)`;
      previewLogoDesktop.style.width = (homeDWidth * scaleX) + "px";
    }

    const previewMobileContainer = document.getElementById("previewMobileContainer");
    const previewLogoMobile = document.getElementById("previewLogoMobile");
    if (previewMobileContainer && previewLogoMobile) {
      const scaleMobile = previewMobileContainer.offsetWidth / 375;
      const headerHeight = 15; // Represents 45px at mobile preview scale
      const mobileTop = headerHeight + (mSpawn * scaleMobile);
      previewLogoMobile.style.top = mobileTop + "px";
      previewLogoMobile.style.transform = `translateX(calc(-50% + ${mX * scaleMobile}px))`;
      previewLogoMobile.style.width = homeMWidth + "%";
    }
  };

  window.updateHeroPreview = function() {
    const hideRight = document.getElementById("heroHideRightImageDesktop") ? document.getElementById("heroHideRightImageDesktop").checked : false;
    const leftFlexEl = document.getElementById("heroLeftFlex");
    const leftFlexValEl = document.getElementById("heroLeftFlexVal");
    if (leftFlexEl) leftFlexEl.disabled = false;
    if (leftFlexValEl) leftFlexValEl.disabled = false;

    const leftFlex = leftFlexEl ? (parseFloat(leftFlexEl.value) || 1.3) : 1.3;
    const rightFlex = Math.max(0.1, 2.0 - leftFlex);
    if (leftFlexValEl && document.activeElement !== leftFlexValEl) {
      leftFlexValEl.value = leftFlex.toFixed(2);
    }

    const leftScale = document.getElementById("heroLeftScale") ? document.getElementById("heroLeftScale").value : "1.0";
    const leftX = document.getElementById("heroLeftX") ? document.getElementById("heroLeftX").value : "50";
    const leftY = document.getElementById("heroLeftY") ? document.getElementById("heroLeftY").value : "50";
    
    const rightScale = document.getElementById("heroRightScale") ? document.getElementById("heroRightScale").value : "1.0";
    const rightX = document.getElementById("heroRightX") ? document.getElementById("heroRightX").value : "80";
    const rightY = document.getElementById("heroRightY") ? document.getElementById("heroRightY").value : "50";

    const desktopHeight = document.getElementById("heroDesktopHeight") ? document.getElementById("heroDesktopHeight").value : "calc(115vh - 45px)";
    const mobileHeight = document.getElementById("heroMobileHeight") ? document.getElementById("heroMobileHeight").value : "auto";
    const mobileScale = document.getElementById("heroMobileScale") ? document.getElementById("heroMobileScale").value : "1.0";
    const mobileX = document.getElementById("heroMobileX") ? document.getElementById("heroMobileX").value : "50";
    const mobileY = document.getElementById("heroMobileY") ? document.getElementById("heroMobileY").value : "50";

    // Sync range values with exact number inputs
    if (document.getElementById("heroLeftScaleNum")) document.getElementById("heroLeftScaleNum").value = leftScale;
    if (document.getElementById("heroLeftXNum")) document.getElementById("heroLeftXNum").value = leftX;
    if (document.getElementById("heroLeftYNum")) document.getElementById("heroLeftYNum").value = leftY;
    if (document.getElementById("heroRightScaleNum")) document.getElementById("heroRightScaleNum").value = rightScale;
    if (document.getElementById("heroRightXNum")) document.getElementById("heroRightXNum").value = rightX;
    if (document.getElementById("heroRightYNum")) document.getElementById("heroRightYNum").value = rightY;
    if (document.getElementById("heroMobileScaleNum")) document.getElementById("heroMobileScaleNum").value = mobileScale;
    if (document.getElementById("heroMobileXNum")) document.getElementById("heroMobileXNum").value = mobileX;
    if (document.getElementById("heroMobileYNum")) document.getElementById("heroMobileYNum").value = mobileY;

    const previewDesktopContainer = document.getElementById("previewDesktopContainer");
    if (previewDesktopContainer) {
      if (desktopHeight.includes("vh") && desktopHeight.includes("calc")) {
        previewDesktopContainer.style.height = "220px";
      } else if (desktopHeight.endsWith("vh")) {
        const vhVal = parseInt(desktopHeight);
        previewDesktopContainer.style.height = (vhVal * 2) + "px";
      } else if (desktopHeight.endsWith("px")) {
        const pxVal = parseInt(desktopHeight);
        previewDesktopContainer.style.height = Math.round(pxVal * 0.2) + "px";
      }
    }

    const previewImgL = document.getElementById("previewImgL");
    const previewImgRParent = document.getElementById("previewImgRParent");
    if (previewImgRParent) {
      if (hideRight) {
        previewImgRParent.style.display = "none";
      } else {
        previewImgRParent.style.display = "block";
        previewImgRParent.style.flex = rightFlex;
      }
    }

    if (previewImgL) {
      previewImgL.style.display = "block";
      previewImgL.style.flex = hideRight ? "1" : leftFlex;
      previewImgL.style.transform = `scale(${leftScale})`;
      previewImgL.style.objectPosition = `${leftX}% ${leftY}%`;
      previewImgL.style.transformOrigin = `${leftX}% ${leftY}%`;
    }
    const previewImgR = document.getElementById("previewImgR");
    if (previewImgR) {
      previewImgR.style.transform = `scale(${rightScale})`;
      previewImgR.style.objectPosition = `${rightX}% ${rightY}%`;
      previewImgR.style.transformOrigin = `${rightX}% ${rightY}%`;
    }

    const previewImgMobile = document.getElementById("previewImgMobile");
    const previewMobileContainer = document.getElementById("previewMobileContainer");
    if (previewImgMobile && previewMobileContainer) {
      previewImgMobile.style.transform = `scale(${mobileScale})`;
      previewImgMobile.style.objectPosition = `${mobileX}% ${mobileY}%`;
      previewImgMobile.style.transformOrigin = `${mobileX}% ${mobileY}%`;
      
      if (mobileHeight === "auto") {
        previewMobileContainer.style.height = "auto";
        previewImgMobile.style.height = "auto";
        previewImgMobile.style.objectFit = "fill";
      } else {
        const pixelVal = parseInt(mobileHeight);
        const previewHeight = Math.round(pixelVal * 0.46) + "px";
        previewMobileContainer.style.height = previewHeight;
        previewImgMobile.style.height = "100%";
        previewImgMobile.style.objectFit = "cover";
      }
    }
  };

  window.updateSecondHeroPreview = function() {
    const leftFlexEl = document.getElementById("secHeroLeftFlex");
    const leftFlexValEl = document.getElementById("secHeroLeftFlexVal");
    const leftFlex = leftFlexEl ? (parseFloat(leftFlexEl.value) || 1.3) : 1.3;
    const rightFlex = Math.max(0.1, 2.0 - leftFlex);
    if (leftFlexValEl && document.activeElement !== leftFlexValEl) {
      leftFlexValEl.value = leftFlex.toFixed(2);
    }

    const leftScale = document.getElementById("secHeroLeftScale") ? document.getElementById("secHeroLeftScale").value : "1.0";
    const leftX = document.getElementById("secHeroLeftX") ? document.getElementById("secHeroLeftX").value : "50";
    const leftY = document.getElementById("secHeroLeftY") ? document.getElementById("secHeroLeftY").value : "50";
    
    const rightScale = document.getElementById("secHeroRightScale") ? document.getElementById("secHeroRightScale").value : "1.0";
    const rightX = document.getElementById("secHeroRightX") ? document.getElementById("secHeroRightX").value : "50";
    const rightY = document.getElementById("secHeroRightY") ? document.getElementById("secHeroRightY").value : "50";

    const desktopHeight = document.getElementById("secHeroDesktopHeight") ? document.getElementById("secHeroDesktopHeight").value : "80vh";
    const mobileHeight = document.getElementById("secHeroMobileHeight") ? document.getElementById("secHeroMobileHeight").value : "auto";
    const mobileScale = document.getElementById("secHeroMobileScale") ? document.getElementById("secHeroMobileScale").value : "1.0";
    const mobileX = document.getElementById("secHeroMobileX") ? document.getElementById("secHeroMobileX").value : "50";
    const mobileY = document.getElementById("secHeroMobileY") ? document.getElementById("secHeroMobileY").value : "50";

    // Sync range values with exact number inputs
    if (document.getElementById("secHeroLeftScaleNum")) document.getElementById("secHeroLeftScaleNum").value = leftScale;
    if (document.getElementById("secHeroLeftXNum")) document.getElementById("secHeroLeftXNum").value = leftX;
    if (document.getElementById("secHeroLeftYNum")) document.getElementById("secHeroLeftYNum").value = leftY;
    if (document.getElementById("secHeroRightScaleNum")) document.getElementById("secHeroRightScaleNum").value = rightScale;
    if (document.getElementById("secHeroRightXNum")) document.getElementById("secHeroRightXNum").value = rightX;
    if (document.getElementById("secHeroRightYNum")) document.getElementById("secHeroRightYNum").value = rightY;
    if (document.getElementById("secHeroMobileScaleNum")) document.getElementById("secHeroMobileScaleNum").value = mobileScale;
    if (document.getElementById("secHeroMobileXNum")) document.getElementById("secHeroMobileXNum").value = mobileX;
    if (document.getElementById("secHeroMobileYNum")) document.getElementById("secHeroMobileYNum").value = mobileY;

    const previewSecDesktopContainer = document.getElementById("previewSecDesktopContainer");
    if (previewSecDesktopContainer) {
      if (desktopHeight.endsWith("vh")) {
        const vhVal = parseInt(desktopHeight);
        previewSecDesktopContainer.style.height = (vhVal * 2) + "px";
      } else if (desktopHeight.endsWith("px")) {
        const pxVal = parseInt(desktopHeight);
        previewSecDesktopContainer.style.height = Math.round(pxVal * 0.2) + "px";
      }
    }

    const previewSecImgL = document.getElementById("previewSecImgL");
    if (previewSecImgL) {
      previewSecImgL.style.flex = leftFlex;
      previewSecImgL.style.transform = `scale(${leftScale})`;
      previewSecImgL.style.objectPosition = `${leftX}% ${leftY}%`;
      previewSecImgL.style.transformOrigin = `${leftX}% ${leftY}%`;
    }

    const previewSecImgRParent = document.getElementById("previewSecImgRParent");
    if (previewSecImgRParent) {
      previewSecImgRParent.style.flex = rightFlex;
    }
    const previewSecImgR = document.getElementById("previewSecImgR");
    if (previewSecImgR) {
      previewSecImgR.style.transform = `scale(${rightScale})`;
      previewSecImgR.style.objectPosition = `${rightX}% ${rightY}%`;
      previewSecImgR.style.transformOrigin = `${rightX}% ${rightY}%`;
    }

    const previewSecImgMobile = document.getElementById("previewSecImgMobile");
    const previewSecMobileContainer = document.getElementById("previewSecMobileContainer");
    
    const leftImageSrc = document.getElementById("secHeroLeftImage") ? document.getElementById("secHeroLeftImage").value.trim() : "";
    const rightImageSrc = document.getElementById("secHeroRightImage") ? document.getElementById("secHeroRightImage").value.trim() : "";
    const mobileImageSrc = document.getElementById("secHeroMobileImage") ? document.getElementById("secHeroMobileImage").value.trim() : "";
    
    const secFileL = document.getElementById("secHeroLeftFile");
    const secFileR = document.getElementById("secHeroRightFile");
    const secFileM = document.getElementById("secHeroMobileFile");

    const hasLeft = leftImageSrc !== "" || (secFileL && secFileL.files && secFileL.files.length > 0);
    const hasRight = rightImageSrc !== "" || (secFileR && secFileR.files && secFileR.files.length > 0);
    const hasMobile = mobileImageSrc !== "" || (secFileM && secFileM.files && secFileM.files.length > 0);

    const secDesktopEmpty = document.getElementById("previewSecEmptyIndicator");
    if (secDesktopEmpty) {
      secDesktopEmpty.style.display = (hasLeft || hasRight) ? "none" : "flex";
    }
    
    if (previewSecImgL) {
      previewSecImgL.style.display = hasLeft ? "block" : "none";
    }
    if (previewSecImgRParent) {
      previewSecImgRParent.style.display = hasRight ? "block" : "none";
    }

    if (previewSecImgMobile && previewSecMobileContainer) {
      previewSecImgMobile.style.transform = `scale(${mobileScale})`;
      previewSecImgMobile.style.objectPosition = `${mobileX}% ${mobileY}%`;
      previewSecImgMobile.style.transformOrigin = `${mobileX}% ${mobileY}%`;
      previewSecImgMobile.style.display = hasMobile ? "block" : "none";
      
      if (mobileHeight === "auto") {
        previewSecMobileContainer.style.height = hasMobile ? "auto" : "70px";
        previewSecImgMobile.style.height = "auto";
        previewSecImgMobile.style.objectFit = "fill";
      } else {
        const pixelVal = parseInt(mobileHeight);
        const previewHeight = Math.round(pixelVal * 0.46) + "px";
        previewSecMobileContainer.style.height = previewHeight;
        previewSecImgMobile.style.height = "100%";
        previewSecImgMobile.style.objectFit = "cover";
      }
    }
    const emptySecMobileIndicator = document.getElementById("previewSecEmptyMobileIndicator");
    if (emptySecMobileIndicator) {
      emptySecMobileIndicator.style.display = hasMobile ? "none" : "flex";
    }
  };

  // ==========================================
  // DROP ZONES INITIALIZER
  // ==========================================
  window.setupDropZones = function() {
    document.querySelectorAll(".drop-zone").forEach(dropZone => {
      if (dropZone.dataset.dropInit === "true") return;
      dropZone.dataset.dropInit = "true";
      const input = dropZone.querySelector("input[type='file']");
      if (!input) return;

      // Click to browse
      dropZone.addEventListener("click", (e) => {
        if (e.target !== input) {
          input.click();
        }
      });

      // Drag over
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("drag-over");
      });

      ["dragleave", "dragend"].forEach(type => {
        dropZone.addEventListener(type, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("drag-over");
        });
      });

      // Drop file
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("drag-over");

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          try {
            input.files = e.dataTransfer.files;
          } catch (err) {
            try {
              const dt = new DataTransfer();
              for (let i = 0; i < e.dataTransfer.files.length; i++) {
                dt.items.add(e.dataTransfer.files[i]);
              }
              input.files = dt.files;
            } catch (dtErr) {}
          }
          
          // Trigger change event
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      // Update label/prompt on file change
      input.addEventListener("change", () => {
        let filenameSpan = dropZone.querySelector(".drop-zone__filename");
        if (!filenameSpan) {
          filenameSpan = document.createElement("span");
          filenameSpan.className = "drop-zone__filename";
          dropZone.appendChild(filenameSpan);
        }

        if (input.files && input.files.length) {
          const file = input.files[0];
          filenameSpan.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          const prompt = dropZone.querySelector(".drop-zone__prompt");
          if (prompt) prompt.style.display = "none";
        } else {
          filenameSpan.remove();
          const prompt = dropZone.querySelector(".drop-zone__prompt");
          if (prompt) prompt.style.display = "block";
        }
      });

      // Handle form reset
      const form = dropZone.closest("form");
      if (form) {
        form.addEventListener("reset", () => {
          setTimeout(() => {
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }, 0);
        });
      }
    });
  };

  // ==========================================
  // HERO & SECOND HERO SETTINGS LOADER
  // ==========================================
  window.loadHeroSettings = async function() {
    let settings = {
      leftImage: "images/hero/studio-extrait-clone-fragrances.avif",
      rightImage: "images/hero/right.png",
      mobileImage: "images/hero/studio-extrait-clone-fragrances-2.avif",
      hideRightImageDesktop: false,
      leftFlex: 1.3,
      leftScale: 1.0,
      leftX: 50,
      leftY: 50,
      rightScale: 1.0,
      rightX: 80,
      rightY: 50,
      desktopHeight: "calc(115vh - 45px)",
      mobileHeight: "auto",
      mobileScale: 1.0,
      mobileX: 50,
      mobileY: 50,
      logoDesktopSpawn: 50,
      logoDesktopSpawn2: 65,
      logoDesktopStick: 0,
      logoDesktopX: 0,
      logoMobileSpawn: -50,
      logoMobileSpawn2: 50,
      logoMobileStick: 0,
      logoMobileX: 0,
      showGiftsButton: true
    };

    let secondHeroSettings = {
      leftImage: "",
      rightImage: "",
      mobileImage: "",
      leftFlex: 1.3,
      leftScale: 1.0,
      leftX: 50,
      leftY: 50,
      rightScale: 1.0,
      rightX: 50,
      rightY: 50,
      desktopHeight: "80vh",
      mobileHeight: "auto",
      mobileScale: 1.0,
      mobileX: 50,
      mobileY: 50
    };

    try {
      const cached = localStorage.getItem("minara_hero_settings");
      if (cached) {
        settings = { ...settings, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.error("Failed to load local hero cache:", e);
    }

    try {
      const cachedSec = localStorage.getItem("minara_second_hero_settings");
      if (cachedSec) {
        secondHeroSettings = { ...secondHeroSettings, ...JSON.parse(cachedSec) };
      }
    } catch (e) {
      console.error("Failed to load local second hero cache:", e);
    }

    const populateFields = (s) => {
      if (!document.getElementById("heroLeftImage")) return;
      document.getElementById("heroLeftImage").value = s.leftImage || "";
      document.getElementById("heroRightImage").value = s.rightImage || "";
      document.getElementById("heroMobileImage").value = s.mobileImage || "";
      
      const initLeftFlex = s.leftFlex !== undefined ? s.leftFlex : 1.3;
      document.getElementById("heroLeftFlex").value = initLeftFlex;
      if (document.getElementById("heroLeftFlexVal")) {
        document.getElementById("heroLeftFlexVal").value = Number(initLeftFlex).toFixed(2);
      }
      document.getElementById("heroLeftScale").value = s.leftScale !== undefined ? s.leftScale : 1.0;
      document.getElementById("heroLeftX").value = s.leftX !== undefined ? s.leftX : 50;
      document.getElementById("heroLeftY").value = s.leftY !== undefined ? s.leftY : 50;
      
      document.getElementById("heroRightScale").value = s.rightScale !== undefined ? s.rightScale : 1.0;
      document.getElementById("heroRightX").value = s.rightX !== undefined ? s.rightX : 80;
      document.getElementById("heroRightY").value = s.rightY !== undefined ? s.rightY : 50;
      
      if (document.getElementById("heroDesktopHeight")) {
        document.getElementById("heroDesktopHeight").value = s.desktopHeight || "calc(115vh - 45px)";
      }
      document.getElementById("heroMobileHeight").value = s.mobileHeight || "auto";
      document.getElementById("heroMobileScale").value = s.mobileScale !== undefined ? s.mobileScale : 1.0;
      document.getElementById("heroMobileX").value = s.mobileX !== undefined ? s.mobileX : 50;
      document.getElementById("heroMobileY").value = s.mobileY !== undefined ? s.mobileY : 50;

      document.getElementById("logoDesktopSpawn").value = s.logoDesktopSpawn !== undefined ? s.logoDesktopSpawn : 50;
      document.getElementById("logoDesktopSpawn2").value = s.logoDesktopSpawn2 !== undefined ? s.logoDesktopSpawn2 : 65;
      document.getElementById("logoDesktopStick").value = s.logoDesktopStick !== undefined ? s.logoDesktopStick : 0;
      document.getElementById("logoDesktopX").value = s.logoDesktopX !== undefined ? s.logoDesktopX : 0;
      document.getElementById("logoMobileSpawn").value = s.logoMobileSpawn !== undefined ? s.logoMobileSpawn : -50;
      document.getElementById("logoMobileSpawn2").value = s.logoMobileSpawn2 !== undefined ? s.logoMobileSpawn2 : 50;
      document.getElementById("logoMobileStick").value = s.logoMobileStick !== undefined ? s.logoMobileStick : 0;
      document.getElementById("logoMobileX").value = s.logoMobileX !== undefined ? s.logoMobileX : -50;
      document.getElementById("logoHeaderDesktopHeight").value = s.logoHeaderDesktopHeight !== undefined ? s.logoHeaderDesktopHeight : 50;
      document.getElementById("logoHeaderMobileHeight").value = s.logoHeaderMobileHeight !== undefined ? s.logoHeaderMobileHeight : 36;
      document.getElementById("logoHomeDesktopWidth").value = s.logoHomeDesktopWidth !== undefined ? s.logoHomeDesktopWidth : 1200;
      document.getElementById("logoHomeMobileWidth").value = s.logoHomeMobileWidth !== undefined ? s.logoHomeMobileWidth : 88;
      
      document.getElementById("heroShowGiftsButton").checked = s.showGiftsButton !== false;
      document.getElementById("heroHideRightImageDesktop").checked = !!s.hideRightImageDesktop;
      
      if (window.updateLogoSliders) {
        window.updateLogoSliders();
      }

      const previewL = document.getElementById("previewImgL");
      if (previewL) {
        const lSrc = s.leftImage || "images/hero/studio-extrait-clone-fragrances.avif";
        previewL.src = lSrc + (lSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
        previewL.onerror = () => { previewL.src = "images/hero/studio-extrait-clone-fragrances.avif"; };
      }
      const previewR = document.getElementById("previewImgR");
      if (previewR) {
        const rSrc = s.rightImage || "images/hero/right.png";
        previewR.src = rSrc + (rSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
        previewR.onerror = () => { previewR.src = "images/hero/right.png"; };
      }
      const previewM = document.getElementById("previewImgMobile");
      if (previewM) {
        const mSrc = s.mobileImage || "images/hero/studio-extrait-clone-fragrances-2.avif";
        previewM.src = mSrc + (mSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
        previewM.onerror = () => { previewM.src = "images/hero/studio-extrait-clone-fragrances-2.avif"; };
      }

      window.updateHeroPreview();
    };

    const populateSecondFields = (s) => {
      if (!document.getElementById("secHeroLeftImage")) return;
      document.getElementById("secHeroLeftImage").value = s.leftImage || "";
      document.getElementById("secHeroRightImage").value = s.rightImage || "";
      document.getElementById("secHeroMobileImage").value = s.mobileImage || "";
      
      const leftFlex = s.leftFlex !== undefined ? s.leftFlex : 1.3;
      const leftScale = s.leftScale !== undefined ? s.leftScale : 1.0;
      const leftX = s.leftX !== undefined ? s.leftX : 50;
      const leftY = s.leftY !== undefined ? s.leftY : 50;
      
      const rightScale = s.rightScale !== undefined ? s.rightScale : 1.0;
      const rightX = s.rightX !== undefined ? s.rightX : 50;
      const rightY = s.rightY !== undefined ? s.rightY : 50;
      
      const desktopHeight = s.desktopHeight || "80vh";
      const mobileHeight = s.mobileHeight || "auto";
      const mobileScale = s.mobileScale !== undefined ? s.mobileScale : 1.0;
      const mobileX = s.mobileX !== undefined ? s.mobileX : 50;
      const mobileY = s.mobileY !== undefined ? s.mobileY : 50;

      document.getElementById("secHeroLeftFlex").value = leftFlex;
      document.getElementById("secHeroLeftFlexVal").value = Number(leftFlex).toFixed(2);

      document.getElementById("secHeroLeftScale").value = leftScale;
      if (document.getElementById("secHeroLeftScaleNum")) document.getElementById("secHeroLeftScaleNum").value = Number(leftScale).toFixed(2);

      document.getElementById("secHeroLeftX").value = leftX;
      if (document.getElementById("secHeroLeftXNum")) document.getElementById("secHeroLeftXNum").value = leftX;

      document.getElementById("secHeroLeftY").value = leftY;
      if (document.getElementById("secHeroLeftYNum")) document.getElementById("secHeroLeftYNum").value = leftY;

      document.getElementById("secHeroRightScale").value = rightScale;
      if (document.getElementById("secHeroRightScaleNum")) document.getElementById("secHeroRightScaleNum").value = Number(rightScale).toFixed(2);

      document.getElementById("secHeroRightX").value = rightX;
      if (document.getElementById("secHeroRightXNum")) document.getElementById("secHeroRightXNum").value = rightX;

      document.getElementById("secHeroRightY").value = rightY;
      if (document.getElementById("secHeroRightYNum")) document.getElementById("secHeroRightYNum").value = rightY;

      document.getElementById("secHeroDesktopHeight").value = desktopHeight;
      document.getElementById("secHeroMobileHeight").value = mobileHeight;

      document.getElementById("secHeroMobileScale").value = mobileScale;
      if (document.getElementById("secHeroMobileScaleNum")) document.getElementById("secHeroMobileScaleNum").value = Number(mobileScale).toFixed(2);

      document.getElementById("secHeroMobileX").value = mobileX;
      if (document.getElementById("secHeroMobileXNum")) document.getElementById("secHeroMobileXNum").value = mobileX;

      document.getElementById("secHeroMobileY").value = mobileY;
      if (document.getElementById("secHeroMobileYNum")) document.getElementById("secHeroMobileYNum").value = mobileY;

      const previewSecL = document.getElementById("previewSecImgL");
      if (previewSecL) previewSecL.src = s.leftImage || "";
      const previewSecR = document.getElementById("previewSecImgR");
      if (previewSecR) previewSecR.src = s.rightImage || "";
      const previewSecM = document.getElementById("previewSecImgMobile");
      if (previewSecM) previewSecM.src = s.mobileImage || "";

      window.updateSecondHeroPreview();
    };

    populateFields(settings);
    populateSecondFields(secondHeroSettings);

    // Listeners for second hero file changes
    const secFileL = document.getElementById("secHeroLeftFile");
    if (secFileL && !secFileL.dataset.listenerInit) {
      secFileL.dataset.listenerInit = "true";
      secFileL.addEventListener("change", function(ev) {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const previewL = document.getElementById("previewSecImgL");
            if (previewL) previewL.src = e.target.result;
            window.updateSecondHeroPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const secFileR = document.getElementById("secHeroRightFile");
    if (secFileR && !secFileR.dataset.listenerInit) {
      secFileR.dataset.listenerInit = "true";
      secFileR.addEventListener("change", function(ev) {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const previewR = document.getElementById("previewSecImgR");
            if (previewR) previewR.src = e.target.result;
            window.updateSecondHeroPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const secFileM = document.getElementById("secHeroMobileFile");
    if (secFileM && !secFileM.dataset.listenerInit) {
      secFileM.dataset.listenerInit = "true";
      secFileM.addEventListener("change", function(ev) {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const previewM = document.getElementById("previewSecImgMobile");
            if (previewM) previewM.src = e.target.result;
            window.updateSecondHeroPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Listeners for first hero file changes
    const fileL = document.getElementById("heroLeftFile");
    if (fileL && !fileL.dataset.listenerInit) {
      fileL.dataset.listenerInit = "true";
      fileL.addEventListener("change", function(ev) {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const previewL = document.getElementById("previewImgL");
            if (previewL) previewL.src = e.target.result;
            window.updateHeroPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const fileR = document.getElementById("heroRightFile");
    if (fileR && !fileR.dataset.listenerInit) {
      fileR.dataset.listenerInit = "true";
      fileR.addEventListener("change", function(ev) {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const previewR = document.getElementById("previewImgR");
            if (previewR) previewR.src = e.target.result;
            window.updateHeroPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const fileM = document.getElementById("heroMobileFile");
    if (fileM && !fileM.dataset.listenerInit) {
      fileM.dataset.listenerInit = "true";
      fileM.addEventListener("change", function(ev) {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const previewM = document.getElementById("previewImgMobile");
            if (previewM) previewM.src = e.target.result;
            window.updateHeroPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    window.setupDropZones();

    setTimeout(async () => {
      if (window.dbPromise) {
        await window.dbPromise;
      }
      if (window.db && window.dbDoc && window.dbGetDoc) {
        try {
          const docSnap = await window.dbGetDoc(window.dbDoc(window.db, "settings", "hero"));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const liveSettings = {
              leftImage: data.leftImage || "images/hero/studio-extrait-clone-fragrances.avif",
              rightImage: data.rightImage || "images/hero/right.png",
              mobileImage: data.mobileImage || "images/hero/studio-extrait-clone-fragrances-2.avif",
              leftFlex: data.leftFlex !== undefined ? Number(data.leftFlex) : 1.3,
              leftScale: data.leftScale !== undefined ? Number(data.leftScale) : 1.0,
              leftX: data.leftX !== undefined ? Number(data.leftX) : 50,
              leftY: data.leftY !== undefined ? Number(data.leftY) : 50,
              rightScale: data.rightScale !== undefined ? Number(data.rightScale) : 1.0,
              rightX: data.rightX !== undefined ? Number(data.rightX) : 80,
              rightY: data.rightY !== undefined ? Number(data.rightY) : 50,
              desktopHeight: data.desktopHeight || "calc(115vh - 45px)",
              mobileHeight: data.mobileHeight || "auto",
              mobileScale: data.mobileScale !== undefined ? Number(data.mobileScale) : 1.0,
              mobileX: data.mobileX !== undefined ? Number(data.mobileX) : 50,
              mobileY: data.mobileY !== undefined ? Number(data.mobileY) : 50,
              logoDesktopSpawn: data.logoDesktopSpawn !== undefined ? Number(data.logoDesktopSpawn) : 50,
              logoDesktopSpawn2: data.logoDesktopSpawn2 !== undefined ? Number(data.logoDesktopSpawn2) : 65,
              logoDesktopStick: data.logoDesktopStick !== undefined ? Number(data.logoDesktopStick) : 0,
              logoDesktopX: data.logoDesktopX !== undefined ? Number(data.logoDesktopX) : 0,
              logoMobileSpawn: data.logoMobileSpawn !== undefined ? Number(data.logoMobileSpawn) : -50,
              logoMobileSpawn2: data.logoMobileSpawn2 !== undefined ? Number(data.logoMobileSpawn2) : 50,
              logoMobileStick: data.logoMobileStick !== undefined ? Number(data.logoMobileStick) : 0,
              logoMobileX: data.logoMobileX !== undefined ? Number(data.logoMobileX) : -50,
              logoHeaderDesktopHeight: data.logoHeaderDesktopHeight !== undefined ? Number(data.logoHeaderDesktopHeight) : 50,
              logoHeaderMobileHeight: data.logoHeaderMobileHeight !== undefined ? Number(data.logoHeaderMobileHeight) : 36,
              logoHomeDesktopWidth: data.logoHomeDesktopWidth !== undefined ? Number(data.logoHomeDesktopWidth) : 1200,
              logoHomeMobileWidth: data.logoHomeMobileWidth !== undefined ? Number(data.logoHomeMobileWidth) : 88,
              showGiftsButton: data.showGiftsButton !== false,
              hideRightImageDesktop: !!data.hideRightImageDesktop
            };
            localStorage.setItem("minara_hero_settings", JSON.stringify(liveSettings));
            populateFields(liveSettings);
          }
        } catch (err) {
          console.warn("Failed to fetch live hero settings:", err);
        }

        try {
          const docSnap = await window.dbGetDoc(window.dbDoc(window.db, "settings", "second_hero"));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const liveSettings = {
              leftImage: data.leftImage || "",
              rightImage: data.rightImage || "",
              mobileImage: data.mobileImage || "",
              leftFlex: data.leftFlex !== undefined ? Number(data.leftFlex) : 1.3,
              leftScale: data.leftScale !== undefined ? Number(data.leftScale) : 1.0,
              leftX: data.leftX !== undefined ? Number(data.leftX) : 50,
              leftY: data.leftY !== undefined ? Number(data.leftY) : 50,
              rightScale: data.rightScale !== undefined ? Number(data.rightScale) : 1.0,
              rightX: data.rightX !== undefined ? Number(data.rightX) : 50,
              rightY: data.rightY !== undefined ? Number(data.rightY) : 50,
              desktopHeight: data.desktopHeight || "80vh",
              mobileHeight: data.mobileHeight || "auto",
              mobileScale: data.mobileScale !== undefined ? Number(data.mobileScale) : 1.0,
              mobileX: data.mobileX !== undefined ? Number(data.mobileX) : 50,
              mobileY: data.mobileY !== undefined ? Number(data.mobileY) : 50
            };
            localStorage.setItem("minara_second_hero_settings", JSON.stringify(liveSettings));
            populateSecondFields(liveSettings);
          }
        } catch (err) {
          console.warn("Failed to fetch live second hero settings:", err);
        }
      }
    }, 0);
  };

  // ==========================================
  // SAVE HERO #1 SETTINGS
  // ==========================================
  window.handleSaveHeroSettings = async function(e) {
    if (e) e.preventDefault();
    
    const submitBtn = e && e.target ? e.target.querySelector('button[type="submit"]') : document.querySelector('#heroForm button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "PUBLISHING HERO...";
    }

    const leftImageText = document.getElementById("heroLeftImage") ? document.getElementById("heroLeftImage").value.trim() : "";
    const rightImageText = document.getElementById("heroRightImage") ? document.getElementById("heroRightImage").value.trim() : "";
    const mobileImageText = document.getElementById("heroMobileImage") ? document.getElementById("heroMobileImage").value.trim() : "";

    const leftFileEl = document.getElementById("heroLeftFile");
    const rightFileEl = document.getElementById("heroRightFile");
    const mobileFileEl = document.getElementById("heroMobileFile");

    const leftFile = leftFileEl && leftFileEl.files ? leftFileEl.files[0] : null;
    const rightFile = rightFileEl && rightFileEl.files ? rightFileEl.files[0] : null;
    const mobileFile = mobileFileEl && mobileFileEl.files ? mobileFileEl.files[0] : null;

    // Predict target paths for Firestore and local settings reference
    const predictedLeft = predictPath(leftFile, leftImageText, "images/hero/studio-extrait-clone-fragrances.avif");
    const predictedRight = predictPath(rightFile, rightImageText, "images/hero/right.png");
    const predictedMobile = predictPath(mobileFile, mobileImageText, "images/hero/studio-extrait-clone-fragrances-2.avif");

    let leftBase64 = null;
    let rightBase64 = null;
    let mobileBase64 = null;

    try {
      if (leftFile) leftBase64 = await readFileAsDataURL(leftFile);
      if (rightFile) rightBase64 = await readFileAsDataURL(rightFile);
      if (mobileFile) mobileBase64 = await readFileAsDataURL(mobileFile);
    } catch (err) {
      console.error("Error reading hero image file:", err);
    }

    const firestoreData = {
      leftImage: predictedLeft,
      rightImage: predictedRight,
      mobileImage: predictedMobile,
      leftFlex: parseFloat(document.getElementById("heroLeftFlex").value) || 1.3,
      leftScale: parseFloat(document.getElementById("heroLeftScale").value) || 1.0,
      leftX: parseInt(document.getElementById("heroLeftX").value) || 50,
      leftY: parseInt(document.getElementById("heroLeftY").value) || 50,
      rightScale: parseFloat(document.getElementById("heroRightScale").value) || 1.0,
      rightX: parseInt(document.getElementById("heroRightX").value) || 80,
      rightY: parseInt(document.getElementById("heroRightY").value) || 50,
      desktopHeight: document.getElementById("heroDesktopHeight") ? document.getElementById("heroDesktopHeight").value : "calc(115vh - 45px)",
      mobileHeight: document.getElementById("heroMobileHeight") ? document.getElementById("heroMobileHeight").value : "auto",
      mobileScale: parseFloat(document.getElementById("heroMobileScale").value) || 1.0,
      mobileX: parseInt(document.getElementById("heroMobileX").value) || 50,
      mobileY: parseInt(document.getElementById("heroMobileY").value) || 50,
      logoDesktopSpawn: parseInt(document.getElementById("logoDesktopSpawn").value) || 50,
      logoDesktopSpawn2: parseInt(document.getElementById("logoDesktopSpawn2").value) || 65,
      logoDesktopStick: parseInt(document.getElementById("logoDesktopStick").value) || 0,
      logoDesktopX: parseInt(document.getElementById("logoDesktopX").value) || 0,
      logoMobileSpawn: parseInt(document.getElementById("logoMobileSpawn").value) || -50,
      logoMobileSpawn2: parseInt(document.getElementById("logoMobileSpawn2").value) || 50,
      logoMobileStick: parseInt(document.getElementById("logoMobileStick").value) || 0,
      logoMobileX: parseInt(document.getElementById("logoMobileX").value) || 0,
      logoHeaderDesktopHeight: parseInt(document.getElementById("logoHeaderDesktopHeight").value) || 50,
      logoHeaderMobileHeight: parseInt(document.getElementById("logoHeaderMobileHeight").value) || 36,
      logoHomeDesktopWidth: parseInt(document.getElementById("logoHomeDesktopWidth").value) || 1200,
      logoHomeMobileWidth: parseInt(document.getElementById("logoHomeMobileWidth").value) || 88,
      showGiftsButton: document.getElementById("heroShowGiftsButton") ? document.getElementById("heroShowGiftsButton").checked : true,
      hideRightImageDesktop: document.getElementById("heroHideRightImageDesktop") ? document.getElementById("heroHideRightImageDesktop").checked : false,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem("minara_hero_settings", JSON.stringify(firestoreData));

    let firestoreSuccess = false;
    let errorMsg = "";

    if (window.db && window.dbDoc && window.dbSetDoc) {
      try {
        await window.dbSetDoc(window.dbDoc(window.db, "settings", "hero"), firestoreData);
        firestoreSuccess = true;
      } catch (dbErr) {
        errorMsg = dbErr.message || dbErr;
        console.error("Firestore hero settings save failed:", dbErr);
      }
    }

    // Sync hero settings to GitHub static repo
    if (firestoreSuccess && window.syncToGithubCallable) {
      const payloadData = Object.assign({}, firestoreData, {
        leftImage: leftBase64 || predictedLeft,
        rightImage: rightBase64 || predictedRight,
        mobileImage: mobileBase64 || predictedMobile,
        leftImageName: leftFile ? leftFile.name : undefined,
        rightImageName: rightFile ? rightFile.name : undefined,
        mobileImageName: mobileFile ? mobileFile.name : undefined
      });

      try {
        await window.syncToGithubCallable({
          action: "saveHero",
          payload: payloadData
        });
        console.log("GitHub hero settings sync successful.");
      } catch (gitHubErr) {
        console.error("Failed to sync hero settings to GitHub:", gitHubErr);
        alert("Warning: Hero settings saved to database, but GitHub sync failed: " + (gitHubErr.message || gitHubErr));
      }
    }

    const hLeft = document.getElementById("heroLeftFile");
    const hRight = document.getElementById("heroRightFile");
    const hMobile = document.getElementById("heroMobileFile");
    if (hLeft) { hLeft.value = ""; hLeft.dispatchEvent(new Event("change", { bubbles: true })); }
    if (hRight) { hRight.value = ""; hRight.dispatchEvent(new Event("change", { bubbles: true })); }
    if (hMobile) { hMobile.value = ""; hMobile.dispatchEvent(new Event("change", { bubbles: true })); }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }

    if (firestoreSuccess) {
      alert("Success! Hero section settings published and synchronized.");
    } else {
      alert("Warning: Hero settings saved locally, but failed to sync online.\nError: " + errorMsg);
    }

    // Update text fields and previews with the predicted paths
    if (document.getElementById("heroLeftImage")) document.getElementById("heroLeftImage").value = predictedLeft;
    if (document.getElementById("heroRightImage")) document.getElementById("heroRightImage").value = predictedRight;
    if (document.getElementById("heroMobileImage")) document.getElementById("heroMobileImage").value = predictedMobile;

    const previewL = document.getElementById("previewImgL");
    if (previewL) previewL.src = leftBase64 || predictedLeft;
    const previewR = document.getElementById("previewImgR");
    if (previewR) previewR.src = rightBase64 || predictedRight;
    const previewM = document.getElementById("previewImgMobile");
    if (previewM) previewM.src = mobileBase64 || predictedMobile;

    window.updateHeroPreview();
  };

  // ==========================================
  // SAVE SECOND HERO SETTINGS
  // ==========================================
  window.handleSaveSecondHeroSettings = async function(e) {
    if (e) e.preventDefault();
    
    const submitBtn = e && e.target ? e.target.querySelector('button[type="submit"]') : document.querySelector('#secondHeroForm button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "PUBLISHING SECOND HERO...";
    }

    const leftImageText = document.getElementById("secHeroLeftImage") ? document.getElementById("secHeroLeftImage").value.trim() : "";
    const rightImageText = document.getElementById("secHeroRightImage") ? document.getElementById("secHeroRightImage").value.trim() : "";
    const mobileImageText = document.getElementById("secHeroMobileImage") ? document.getElementById("secHeroMobileImage").value.trim() : "";

    const leftFileEl = document.getElementById("secHeroLeftFile");
    const rightFileEl = document.getElementById("secHeroRightFile");
    const mobileFileEl = document.getElementById("secHeroMobileFile");

    const leftFile = leftFileEl && leftFileEl.files ? leftFileEl.files[0] : null;
    const rightFile = rightFileEl && rightFileEl.files ? rightFileEl.files[0] : null;
    const mobileFile = mobileFileEl && mobileFileEl.files ? mobileFileEl.files[0] : null;

    // Predict target paths for Firestore and local settings reference
    const predictedLeft = predictPath(leftFile, leftImageText, "images/second-hero/left.webp");
    const predictedRight = predictPath(rightFile, rightImageText, "images/second-hero/right.webp");
    const predictedMobile = predictPath(mobileFile, mobileImageText, "images/second-hero/mobile.webp");

    let leftBase64 = null;
    let rightBase64 = null;
    let mobileBase64 = null;

    try {
      if (leftFile) leftBase64 = await readFileAsDataURL(leftFile);
      if (rightFile) rightBase64 = await readFileAsDataURL(rightFile);
      if (mobileFile) mobileBase64 = await readFileAsDataURL(mobileFile);
    } catch (err) {
      console.error("Error reading second hero image file:", err);
    }

    const firestoreData = {
      leftImage: predictedLeft,
      rightImage: predictedRight,
      mobileImage: predictedMobile,
      leftFlex: parseFloat(document.getElementById("secHeroLeftFlex").value) || 1.3,
      leftScale: parseFloat(document.getElementById("secHeroLeftScale").value) || 1.0,
      leftX: parseInt(document.getElementById("secHeroLeftX").value) || 50,
      leftY: parseInt(document.getElementById("secHeroLeftY").value) || 50,
      rightScale: parseFloat(document.getElementById("secHeroRightScale").value) || 1.0,
      rightX: parseInt(document.getElementById("secHeroRightX").value) || 50,
      rightY: parseInt(document.getElementById("secHeroRightY").value) || 50,
      desktopHeight: document.getElementById("secHeroDesktopHeight") ? document.getElementById("secHeroDesktopHeight").value : "80vh",
      mobileHeight: document.getElementById("secHeroMobileHeight") ? document.getElementById("secHeroMobileHeight").value : "auto",
      mobileScale: parseFloat(document.getElementById("secHeroMobileScale").value) || 1.0,
      mobileX: parseInt(document.getElementById("secHeroMobileX").value) || 50,
      mobileY: parseInt(document.getElementById("secHeroMobileY").value) || 50,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem("minara_second_hero_settings", JSON.stringify(firestoreData));

    let firestoreSuccess = false;
    let errorMsg = "";

    if (window.db && window.dbDoc && window.dbSetDoc) {
      try {
        await window.dbSetDoc(window.dbDoc(window.db, "settings", "second_hero"), firestoreData);
        firestoreSuccess = true;
      } catch (dbErr) {
        errorMsg = dbErr.message || dbErr;
        console.error("Firestore second hero settings save failed:", dbErr);
      }
    }

    // Sync second hero settings to GitHub static repo
    if (firestoreSuccess && window.syncToGithubCallable) {
      const payloadData = Object.assign({}, firestoreData, {
        leftImage: leftBase64 || predictedLeft,
        rightImage: rightBase64 || predictedRight,
        mobileImage: mobileBase64 || predictedMobile,
        leftImageName: leftFile ? leftFile.name : undefined,
        rightImageName: rightFile ? rightFile.name : undefined,
        mobileImageName: mobileFile ? mobileFile.name : undefined
      });

      try {
        await window.syncToGithubCallable({
          action: "saveSecondHero",
          payload: payloadData
        });
        console.log("GitHub second hero settings sync successful.");
      } catch (gitHubErr) {
        console.error("Failed to sync second hero settings to GitHub:", gitHubErr);
        alert("Warning: Second hero settings saved to database, but GitHub sync failed: " + (gitHubErr.message || gitHubErr));
      }
    }

    const sLeft = document.getElementById("secHeroLeftFile");
    const sRight = document.getElementById("secHeroRightFile");
    const sMobile = document.getElementById("secHeroMobileFile");
    if (sLeft) { sLeft.value = ""; sLeft.dispatchEvent(new Event("change", { bubbles: true })); }
    if (sRight) { sRight.value = ""; sRight.dispatchEvent(new Event("change", { bubbles: true })); }
    if (sMobile) { sMobile.value = ""; sMobile.dispatchEvent(new Event("change", { bubbles: true })); }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }

    if (firestoreSuccess) {
      alert("Success! Second Hero section settings published and synchronized.");
    } else {
      alert("Warning: Second Hero settings saved locally, but failed to sync online.\nError: " + errorMsg);
    }

    // Update text fields and previews with the predicted paths
    if (document.getElementById("secHeroLeftImage")) document.getElementById("secHeroLeftImage").value = predictedLeft;
    if (document.getElementById("secHeroRightImage")) document.getElementById("secHeroRightImage").value = predictedRight;
    if (document.getElementById("secHeroMobileImage")) document.getElementById("secHeroMobileImage").value = predictedMobile;

    const previewSecL = document.getElementById("previewSecImgL");
    if (previewSecL) previewSecL.src = leftBase64 || predictedLeft;
    const previewSecR = document.getElementById("previewSecImgR");
    if (previewSecR) previewSecR.src = rightBase64 || predictedRight;
    const previewSecM = document.getElementById("previewSecImgMobile");
    if (previewSecM) previewSecM.src = mobileBase64 || predictedMobile;

    window.updateSecondHeroPreview();
  };

  // ==========================================
  // CUSTOM TEXT & ACCORDION SETTINGS
  // ==========================================
  window.loadCustomTextSettings = async function() {
    const defaultFeatures = [
      {
        title: "EXTRAIT DE PARFUM CONCENTRATION",
        description: "Most designer originals dilute to a standard 15% Eau de Parfum. We formulate at a dense 20%+ Extrait concentration, anchoring the scent to your skin for powerful projection and longevity that outlasts the original."
      },
      {
        title: "OLFACTORY ACCURACY",
        description: "We go beyond 'inspired' scents by reverse-engineering the exact molecular blueprints of exclusive designer fragrances. Experience a high-fidelity, indistinguishable profile without the premium markup."
      },
      {
        title: "FREE DELIVERY OVER R650",
        description: "Enjoy free delivery on all orders over R650 nationwide (flat R85 fee applies to smaller orders). Delivered, in 2-3 days, straight to your doorstep."
      },
      {
        title: "SIDE EFFECT:COMPLIMENTS",
        description: "Fair warning: our dense formulations leave a powerful, undeniable scent trail. We take absolutely no responsibility for the sheer volume of compliments, double-takes, and 'what are you wearing?' questions you are about to receive."
      },
      {
        title: "IMPORTED FRENCH OILS",
        description: "Proudly blended in South Africa using premium, meticulously sourced French oils. We bring world-class raw ingredients and expert craftsmanship to every single bottle."
      },
      {
        title: "PROPERLY MACERATED",
        description: "We don't rush production. Every batch undergoes a strict maceration process, allowing the raw oils and alcohol to perfectly bind and mature. This eliminates harsh alcohol openings and guarantees a smooth, refined profile."
      }
    ];

    let textData = {
      features: JSON.parse(JSON.stringify(defaultFeatures)),
      trust_banner: [
        {
          title: " Free & Speedy Delivery Nationwide",
          description: "Courier dispatch direct to your door anywhere in South Africa at no extra costs. "
        },
        {
          title: "Trusted Clone Brand",
          description: "Soon to be selling on Takealot and Amazon. Studio Extrait has 100% premium quality formulation matching original scents. Safe and secure checkout options using PayFast, Google and Apple Pay."
        }
      ],
      footer_description: "Designer-inspired extraits, crafted at 20%+ concentration to match 95% of the iconic scents you love — for a fraction of the price. Macerated to perfection, with free delivery across South Africa on orders over R650. Find your signature scent."
    };

    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) {
        textData = { ...textData, ...JSON.parse(cached) };
        let correctedCached = false;
        if (textData.features) {
          const firstTitle = textData.features[0] ? textData.features[0].title : "";
          if (firstTitle === "Handcrafted with French Oils" || firstTitle === "Long Lasting" || (firstTitle && !firstTitle.includes("EXTRAIT DE PARFUM"))) {
            textData.features = JSON.parse(JSON.stringify(defaultFeatures));
            correctedCached = true;
          } else {
            if (textData.features[0] && textData.features[0].description && textData.features[0].description.includes("10-15%")) {
              textData.features[0].description = defaultFeatures[0].description;
              correctedCached = true;
            }
            if (textData.features[1] && textData.features[1].description && textData.features[1].description.includes("We don't just create")) {
              textData.features[1].description = defaultFeatures[1].description;
              correctedCached = true;
            }
            if (textData.features[2] && textData.features[2].description && textData.features[2].description.includes("bypass the mass market")) {
              textData.features[2].description = defaultFeatures[2].description;
              correctedCached = true;
            }
            if (textData.features[3] && textData.features[3].title === "SIDE EFFECT: COMPLIMENTS") {
              textData.features[3].title = "SIDE EFFECT:COMPLIMENTS";
              correctedCached = true;
            }
          }
        }
        if (correctedCached) {
          localStorage.setItem("minara_custom_text", JSON.stringify(textData));
        }
      }
    } catch (e) {
      console.error("Failed to load local custom text cache:", e);
    }

    const populateFields = (data) => {
      if (data.features) {
        data.features.forEach((feature, idx) => {
          const titleEl = document.getElementById(`featureTitle${idx}`);
          const descEl = document.getElementById(`featureDesc${idx}`);
          if (titleEl) titleEl.value = feature.title || "";
          if (descEl) descEl.value = feature.description || "";
        });
      }
      if (data.trust_banner) {
        data.trust_banner.forEach((item, idx) => {
          const titleEl = document.getElementById(`trustTitle${idx}`);
          const descEl = document.getElementById(`trustDesc${idx}`);
          if (titleEl) titleEl.value = item.title || "";
          if (descEl) descEl.value = item.description || "";
        });
      }
      const footDescEl = document.getElementById("footerDescription");
      if (footDescEl) footDescEl.value = data.footer_description || "";
      if (data.accordions) {
        const accs = data.accordions;
        const wearing = document.getElementById("accordionWearing");
        const inspired = document.getElementById("accordionHonestInspired");
        const nonInspired = document.getElementById("accordionHonestNonInspired");
        const ing = document.getElementById("accordionIngredients");
        const shipping = document.getElementById("accordionShippingReturns");
        
        if (wearing) wearing.value = accs.wearingOccasion || "";
        if (inspired) inspired.value = accs.honestComparisonInspired || "";
        if (nonInspired) nonInspired.value = accs.honestComparisonNonInspired || "";
        if (ing) ing.value = accs.ingredients || "";
        if (shipping) shipping.value = accs.shippingReturns || "";
      }

      function adminHtmlToText(html) {
        if (!html) return "";
        let str = html;
        str = str.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
        str = str.replace(/<p[^>]*>/gi, '');
        str = str.replace(/<\/p>/gi, '');
        str = str.replace(/<br\s*\/?>/gi, '\n');
        return str.trim();
      }

      const defaultAdminPolicy = {
        shippingHeading: "1. Express Shipping Policy",
        shippingText: "STUDIO EXTRAIT provides reliable, door-to-door courier dispatch to any address within South Africa powered by The Courier Guy.\n\nDispatch & Processing: Orders are packaged and dispatched within 24 to 48 hours of payment confirmation (excluding weekends and public holidays).\n\nDelivery Timeframe: Express courier delivery nationwide typically takes 2 to 4 business days to major centers, and up to 5 business days for regional areas.\n\nLive Order Tracking: Upon dispatch, you will automatically receive an SMS and Email containing your Courier Guy waybill tracking link to monitor your delivery in real-time.\n\nCourier Rates: Standard door-to-door nationwide delivery is R85 per order, or FREE on qualifying orders and promotional offers.",
        returnsHeading: "2. Returns & Exchanges Policy",
        returnsText: "STUDIO EXTRAIT is committed to ensuring your satisfaction with every Extrait de Parfum purchase. Recognizing the subjective and personal nature of fine fragrances, we offer our customers the option to exchange or refund their goods within 7 days from the date of delivery.\n\nExchanges Policy: For exchanges, the customer will be responsible for the two-way courier fee (R85 x 2 = R170 total).\n\nRefunds Policy: For refunds, the customer will be responsible for the one-way return courier fee (R85 x 1). If your refund is approved upon inspection, courier fees will be deducted from the final refund amount, and a net refund will be processed back to your original payment method. For refunds, we also reserve the right to apply a 15% administrative fee on the total order value.\n\nExchange & Refund Restrictions: In order to maintain fairness and prevent system abuse, STUDIO EXTRAIT reserves the right to impose limitations on the number of exchanges allowed per customer. Frequent and repetitive exchanges, viewed as an attempt to exploit the system for obtaining free samples, may be considered an abuse of our policy. Determination of such behavior remains at the sole discretion of STUDIO EXTRAIT management.\n\nDamaged Merchandise: We place meticulous care in packaging our extraits to ensure pristine condition upon delivery. Should you encounter a damaged or leaking bottle upon arrival, please notify our team within 7 days of receipt via email at jadon@studioextrait.co.za or WhatsApp with a description and photographic evidence. Upon verification, an exchange will be facilitated and a replacement item dispatched, subject to stock availability.",
        disclaimerHeading: "3. Product & Brand Disclaimer",
        disclaimerText: "STUDIO EXTRAIT offers original Extraits de Parfum formulated independently and sold under its own brand label. While certain products are described as \"inspired by\" famous designer fragrances, this is done solely to provide an olfactory frame of reference for the scent profile.\n\nOur products are not associated with, endorsed by, sponsored by, or manufactured by the owners of any designer brands mentioned. Any reference to third-party trademarks or brand names is made strictly for descriptive purposes. All trademark rights remain the property of their respective owners.\n\nOur custom packaging and bottle designs are intentionally unique to STUDIO EXTRAIT and do not imitate or copy third-party designer logos or trade dress.",
        supportPrompt: "TO INITIATE A RETURN OR EXCHANGE, CONTACT OUR SUPPORT TEAM:",
        supportEmail: "jadon@studioextrait.co.za"
      };

      const rs = data.returns_shipping || defaultAdminPolicy;
      if (document.getElementById("adminRetShipHeading")) document.getElementById("adminRetShipHeading").value = rs.shippingHeading || defaultAdminPolicy.shippingHeading;
      if (document.getElementById("adminRetShipText")) document.getElementById("adminRetShipText").value = adminHtmlToText(rs.shippingText) || defaultAdminPolicy.shippingText;
      if (document.getElementById("adminRetReturnsHeading")) document.getElementById("adminRetReturnsHeading").value = rs.returnsHeading || defaultAdminPolicy.returnsHeading;
      if (document.getElementById("adminRetReturnsText")) document.getElementById("adminRetReturnsText").value = adminHtmlToText(rs.returnsText) || defaultAdminPolicy.returnsText;
      if (document.getElementById("adminRetDisclaimerHeading")) document.getElementById("adminRetDisclaimerHeading").value = rs.disclaimerHeading || defaultAdminPolicy.disclaimerHeading;
      if (document.getElementById("adminRetDisclaimerText")) document.getElementById("adminRetDisclaimerText").value = adminHtmlToText(rs.disclaimerText) || defaultAdminPolicy.disclaimerText;
      if (document.getElementById("adminRetSupportPrompt")) document.getElementById("adminRetSupportPrompt").value = rs.supportPrompt || defaultAdminPolicy.supportPrompt;
      if (document.getElementById("adminRetSupportEmail")) document.getElementById("adminRetSupportEmail").value = rs.supportEmail || defaultAdminPolicy.supportEmail;
    };

    populateFields(textData);

    setTimeout(async () => {
      if (window.db && window.dbDoc && window.dbGetDoc) {
        try {
          const docSnap = await window.dbGetDoc(window.dbDoc(window.db, "settings", "custom_text"));
          if (docSnap.exists()) {
            const liveData = docSnap.data();
            let corrected = false;
            if (liveData.features) {
              const firstTitle = liveData.features[0] ? liveData.features[0].title : "";
              if (firstTitle === "Handcrafted with French Oils" || firstTitle === "Long Lasting" || (firstTitle && !firstTitle.includes("EXTRAIT DE PARFUM"))) {
                liveData.features = JSON.parse(JSON.stringify(defaultFeatures));
                corrected = true;
              } else {
                if (liveData.features[0] && liveData.features[0].description && liveData.features[0].description.includes("10-15%")) {
                  liveData.features[0].description = defaultFeatures[0].description;
                  corrected = true;
                }
                if (liveData.features[1] && liveData.features[1].description && liveData.features[1].description.includes("We don't just create")) {
                  liveData.features[1].description = defaultFeatures[1].description;
                  corrected = true;
                }
                if (liveData.features[2] && liveData.features[2].description && liveData.features[2].description.includes("bypass the mass market")) {
                  liveData.features[2].description = defaultFeatures[2].description;
                  corrected = true;
                }
                if (liveData.features[3] && liveData.features[3].title === "SIDE EFFECT: COMPLIMENTS") {
                  liveData.features[3].title = "SIDE EFFECT:COMPLIMENTS";
                  corrected = true;
                }
              }
            }
            
            localStorage.setItem("minara_custom_text", JSON.stringify(liveData));
            populateFields(liveData);

            if (corrected) {
              console.log("Stale Firestore custom text detected and auto-corrected. Updating Firestore & GitHub...");
              if (window.dbDoc && window.dbSetDoc) {
                try {
                  await window.dbSetDoc(window.dbDoc(window.db, "settings", "custom_text"), liveData);
                  if (window.syncToGithubCallable) {
                    await window.syncToGithubCallable({
                      action: "saveCustomText",
                      payload: liveData
                    });
                  }
                } catch (saveErr) {
                  console.error("Auto-correction sync failed:", saveErr);
                }
              }
            }
          }
        } catch (err) {
          console.warn("Failed to fetch live custom text settings:", err);
        }
      }
    }, 0);
  };

  window.handleSaveCustomTextSettings = async function(e) {
    if (e) e.preventDefault();
    
    const saveBtn = document.getElementById("saveCustomTextBtn");
    const originalText = saveBtn ? saveBtn.innerHTML : "";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = "PUBLISHING...";
    }

    const payload = {
      features: [],
      trust_banner: [],
      accordions: {
        wearingOccasion: document.getElementById("accordionWearing") ? document.getElementById("accordionWearing").value : "",
        honestComparisonInspired: document.getElementById("accordionHonestInspired") ? document.getElementById("accordionHonestInspired").value : "",
        honestComparisonNonInspired: document.getElementById("accordionHonestNonInspired") ? document.getElementById("accordionHonestNonInspired").value : "",
        ingredients: document.getElementById("accordionIngredients") ? document.getElementById("accordionIngredients").value : "",
        shippingReturns: document.getElementById("accordionShippingReturns") ? document.getElementById("accordionShippingReturns").value : ""
      },
      returns_shipping: {
        shippingHeading: document.getElementById("adminRetShipHeading") ? document.getElementById("adminRetShipHeading").value.trim() : "1. Express Shipping Policy",
        shippingText: document.getElementById("adminRetShipText") ? (function(t){
          const trimmed = t.trim();
          if (/^<p[\s>]/i.test(trimmed)) return trimmed;
          return trimmed.split(/\n\s*\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        })(document.getElementById("adminRetShipText").value) : "",
        returnsHeading: document.getElementById("adminRetReturnsHeading") ? document.getElementById("adminRetReturnsHeading").value.trim() : "2. Returns & Exchanges Policy",
        returnsText: document.getElementById("adminRetReturnsText") ? (function(t){
          const trimmed = t.trim();
          if (/^<p[\s>]/i.test(trimmed)) return trimmed;
          return trimmed.split(/\n\s*\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        })(document.getElementById("adminRetReturnsText").value) : "",
        disclaimerHeading: document.getElementById("adminRetDisclaimerHeading") ? document.getElementById("adminRetDisclaimerHeading").value.trim() : "3. Product & Brand Disclaimer",
        disclaimerText: document.getElementById("adminRetDisclaimerText") ? (function(t){
          const trimmed = t.trim();
          if (/^<p[\s>]/i.test(trimmed)) return trimmed;
          return trimmed.split(/\n\s*\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        })(document.getElementById("adminRetDisclaimerText").value) : "",
        supportPrompt: document.getElementById("adminRetSupportPrompt") ? document.getElementById("adminRetSupportPrompt").value.trim() : "TO INITIATE A RETURN OR EXCHANGE, CONTACT OUR SUPPORT TEAM:",
        supportEmail: document.getElementById("adminRetSupportEmail") ? document.getElementById("adminRetSupportEmail").value.trim() : "jadon@studioextrait.co.za"
      },
      footer_description: document.getElementById("footerDescription") ? document.getElementById("footerDescription").value.trim() : ""
    };

    for (let i = 0; i < 6; i++) {
      const titleEl = document.getElementById(`featureTitle${i}`);
      const descEl = document.getElementById(`featureDesc${i}`);
      payload.features.push({
        title: titleEl ? titleEl.value : "",
        description: descEl ? descEl.value : ""
      });
    }

    for (let i = 0; i < 2; i++) {
      const titleEl = document.getElementById(`trustTitle${i}`);
      const descEl = document.getElementById(`trustDesc${i}`);
      payload.trust_banner.push({
        title: titleEl ? titleEl.value : "",
        description: descEl ? descEl.value : ""
      });
    }

    try {
      localStorage.setItem("minara_custom_text", JSON.stringify(payload));

      let dbSaved = false;
      if (window.db && window.dbDoc && window.dbSetDoc) {
        try {
          await window.dbSetDoc(window.dbDoc(window.db, "settings", "custom_text"), payload);
          dbSaved = true;
        } catch (dbErr) {
          console.error("Firestore custom text settings save failed:", dbErr);
        }
      }

      let gitHubSynced = false;
      if (window.syncToGithubCallable) {
        try {
          const response = await window.syncToGithubCallable({
            action: "saveCustomText",
            payload: payload
          });
          if (response.data && response.data.success) {
            gitHubSynced = true;
          } else {
            throw new Error(response.data ? response.data.message : "GitHub sync failed");
          }
        } catch (gitHubErr) {
          console.error("Failed to sync custom text to GitHub:", gitHubErr);
          throw gitHubErr;
        }
      }

      if (dbSaved && gitHubSynced) {
        alert("Success! Text & Footer settings published and synchronized to GitHub.");
      } else if (dbSaved) {
        alert("Warning: Text settings saved to database, but GitHub sync failed.");
      } else {
        alert("Warning: Local changes saved, but database and GitHub updates failed.");
      }

    } catch (err) {
      console.error("Failed to publish text settings:", err);
      alert("Error publishing text settings: " + (err.message || err));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }
  };

  // ==========================================
  // PER-BLOCK CUSTOM TEXT PUBLISH (separate publish buttons)
  // ==========================================
  function getCurrentCustomText() {
    let base = { features: [], trust_banner: [], accordions: {}, returns_shipping: {}, footer_description: "" };
    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) base = { ...base, ...JSON.parse(cached) };
    } catch (e) {}
    return base;
  }

  window.persistCustomTextData = async function(payload, saveBtn) {
    const originalText = saveBtn ? saveBtn.innerHTML : "";
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = "PUBLISHING..."; }
    try {
      localStorage.setItem("minara_custom_text", JSON.stringify(payload));
      let dbSaved = false;
      if (window.db && window.dbDoc && window.dbSetDoc) {
        try { await window.dbSetDoc(window.dbDoc(window.db, "settings", "custom_text"), payload); dbSaved = true; }
        catch (dbErr) { console.error("Firestore custom text settings save failed:", dbErr); }
      }
      let gitHubSynced = false;
      if (window.syncToGithubCallable) {
        try {
          const response = await window.syncToGithubCallable({ action: "saveCustomText", payload });
          if (response.data && response.data.success) gitHubSynced = true;
          else throw new Error(response.data ? response.data.message : "GitHub sync failed");
        } catch (gitHubErr) { console.error("Failed to sync custom text to GitHub:", gitHubErr); throw gitHubErr; }
      }
      if (dbSaved && gitHubSynced) alert("Success! Published and synchronized to GitHub.");
      else if (dbSaved) alert("Warning: saved to database, but GitHub sync failed.");
      else alert("Warning: Local changes saved, but database and GitHub updates failed.");
    } catch (err) {
      console.error("Failed to publish text settings:", err);
      alert("Error publishing text settings: " + (err.message || err));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalText; }
    }
  };


  // ==========================================
  window.handleSaveFeatures = async function(e) {
    if (e) e.preventDefault();
    const data = getCurrentCustomText();
    data.features = [];
    for (let i = 0; i < 6; i++) {
      const t = document.getElementById(`featureTitle${i}`);
      const d = document.getElementById(`featureDesc${i}`);
      data.features.push({ title: t ? t.value : "", description: d ? d.value : "" });
    }
    await window.persistCustomTextData(data, document.getElementById("saveFeaturesBtn"));
  };

  window.handleSaveTrustBanner = async function(e) {
    if (e) e.preventDefault();
    const data = getCurrentCustomText();
    data.trust_banner = [];
    for (let i = 0; i < 2; i++) {
      const t = document.getElementById(`trustTitle${i}`);
      const d = document.getElementById(`trustDesc${i}`);
      data.trust_banner.push({ title: t ? t.value : "", description: d ? d.value : "" });
    }
    await window.persistCustomTextData(data, document.getElementById("saveTrustBtn"));
  };

  window.handleSaveFooterDescription = async function(e) {
    if (e) e.preventDefault();
    const data = getCurrentCustomText();
    const f = document.getElementById("footerDescription");
    data.footer_description = f ? f.value.trim() : "";
    await window.persistCustomTextData(data, document.getElementById("saveFooterBtn"));
  };

  window.handleSaveAccordions = async function(e) {
    if (e) e.preventDefault();
    const data = getCurrentCustomText();
    data.accordions = {
      wearingOccasion: document.getElementById("accordionWearing") ? document.getElementById("accordionWearing").value : "",
      honestComparisonInspired: document.getElementById("accordionHonestInspired") ? document.getElementById("accordionHonestInspired").value : "",
      honestComparisonNonInspired: document.getElementById("accordionHonestNonInspired") ? document.getElementById("accordionHonestNonInspired").value : "",
      ingredients: document.getElementById("accordionIngredients") ? document.getElementById("accordionIngredients").value : "",
      shippingReturns: document.getElementById("accordionShippingReturns") ? document.getElementById("accordionShippingReturns").value : ""
    };
    await window.persistCustomTextData(data, document.getElementById("saveAccordionsBtn"));
  };

  const toHtmlText = (text) => {
    const trimmed = (text || "").trim();
    if (/^<p[\s>]/i.test(trimmed)) return trimmed;
    return trimmed.split(/\n\s*\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  };

  window.handleSaveReturnsShipping = async function(e) {
    if (e) e.preventDefault();
    const data = getCurrentCustomText();
    data.returns_shipping = {
      shippingHeading: document.getElementById("adminRetShipHeading") ? document.getElementById("adminRetShipHeading").value.trim() : "1. Express Shipping Policy",
      shippingText: toHtmlText(document.getElementById("adminRetShipText") ? document.getElementById("adminRetShipText").value : ""),
      returnsHeading: document.getElementById("adminRetReturnsHeading") ? document.getElementById("adminRetReturnsHeading").value.trim() : "2. Returns & Exchanges Policy",
      returnsText: toHtmlText(document.getElementById("adminRetReturnsText") ? document.getElementById("adminRetReturnsText").value : ""),
      disclaimerHeading: document.getElementById("adminRetDisclaimerHeading") ? document.getElementById("adminRetDisclaimerHeading").value.trim() : "3. Product & Brand Disclaimer",
      disclaimerText: toHtmlText(document.getElementById("adminRetDisclaimerText") ? document.getElementById("adminRetDisclaimerText").value : ""),
      supportPrompt: document.getElementById("adminRetSupportPrompt") ? document.getElementById("adminRetSupportPrompt").value.trim() : "TO INITIATE A RETURN OR EXCHANGE, CONTACT OUR SUPPORT TEAM:",
      supportEmail: document.getElementById("adminRetSupportEmail") ? document.getElementById("adminRetSupportEmail").value.trim() : "jadon@studioextrait.co.za"
    };
    await window.persistCustomTextData(data, document.getElementById("saveReturnsBtn"));
  };


  // IMAGE OPTIMIZER & SEO TOOL
  // ==========================================
  let activeImages = [];
  window.loadImageList = async function() {
    const tableBody = document.getElementById("imageOptimizerTableBody");
    const stats = document.getElementById("imageOptimizerStats");
    const saveBtn = document.getElementById("saveImageNamesBtn");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">Scanning files and extracting images...</td></tr>`;

    try {
      let products = [];
      try {
        const res = await fetch("products.json?t=" + Date.now());
        if (res.ok) products = await res.json();
      } catch (err) { console.error("Error loading products.json for SEO:", err); }

      let hero = {};
      try {
        const res = await fetch("hero_settings.json?t=" + Date.now());
        if (res.ok) hero = await res.json();
      } catch (err) { console.error("Error loading hero_settings.json for SEO:", err); }

      let secHero = {};
      try {
        const res = await fetch("second_hero_settings.json?t=" + Date.now());
        if (res.ok) secHero = await res.json();
      } catch (err) { console.error("Error loading second_hero_settings.json for SEO:", err); }

      activeImages = [];

      products.forEach(p => {
        if (p.image && !p.image.startsWith("data:")) {
          activeImages.push({
            src: p.image,
            sourceName: `Product: ${p.name}`,
            fileType: "product_main",
            id: p.id,
            key: "image"
          });
        }
        if (p.image_thumb && !p.image_thumb.startsWith("data:")) {
          activeImages.push({
            src: p.image_thumb,
            sourceName: `Product Thumbnail: ${p.name}`,
            fileType: "product_thumb",
            id: p.id,
            key: "image_thumb"
          });
        }
      });

      if (hero.leftImage && !hero.leftImage.startsWith("data:")) {
        activeImages.push({
          src: hero.leftImage,
          sourceName: "Hero Left Image",
          fileType: "hero_left",
          key: "leftImage"
        });
      }
      if (hero.rightImage && !hero.rightImage.startsWith("data:")) {
        activeImages.push({
          src: hero.rightImage,
          sourceName: "Hero Right Image",
          fileType: "hero_right",
          key: "rightImage"
        });
      }
      if (hero.mobileImage && !hero.mobileImage.startsWith("data:")) {
        activeImages.push({
          src: hero.mobileImage,
          sourceName: "Hero Mobile Image",
          fileType: "hero_mobile",
          key: "mobileImage"
        });
      }

      if (secHero.leftImage && !secHero.leftImage.startsWith("data:")) {
        activeImages.push({
          src: secHero.leftImage,
          sourceName: "Second Hero Left Image",
          fileType: "second_hero_left",
          key: "leftImage"
        });
      }
      if (secHero.rightImage && !secHero.rightImage.startsWith("data:")) {
        activeImages.push({
          src: secHero.rightImage,
          sourceName: "Second Hero Right Image",
          fileType: "second_hero_right",
          key: "rightImage"
        });
      }
      if (secHero.mobileImage && !secHero.mobileImage.startsWith("data:")) {
        activeImages.push({
          src: secHero.mobileImage,
          sourceName: "Second Hero Mobile Image",
          fileType: "second_hero_mobile",
          key: "mobileImage"
        });
      }

      if (activeImages.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">No active images found in JSON configuration files.</td></tr>`;
        if (stats) stats.textContent = "0 Images Referenced";
        if (saveBtn) saveBtn.style.display = "none";
        return;
      }

      if (stats) stats.textContent = `${activeImages.length} Images Referenced`;
      if (saveBtn) saveBtn.style.display = "inline-block";
      tableBody.innerHTML = "";

      activeImages.forEach((img, idx) => {
        const pathParts = img.src.split("/");
        const filename = pathParts[pathParts.length - 1];
        const folderPath = pathParts.slice(0, -1).join("/");

        const tr = document.createElement("tr");

        const tdPreview = document.createElement("td");
        const imgEl = document.createElement("img");
        imgEl.src = img.src;
        imgEl.style.cssText = "width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);";
        tdPreview.appendChild(imgEl);
        tr.appendChild(tdPreview);

        const tdSource = document.createElement("td");
        tdSource.style.fontWeight = "bold";
        tdSource.textContent = img.sourceName;
        tr.appendChild(tdSource);

        const tdPath = document.createElement("td");
        tdPath.style.fontFamily = "monospace";
        tdPath.style.fontSize = "11px";
        tdPath.style.color = "var(--text-muted)";
        tdPath.textContent = img.src;
        tr.appendChild(tdPath);

        const tdInput = document.createElement("td");
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "4px";

        const folderSpan = document.createElement("span");
        folderSpan.style.fontFamily = "monospace";
        folderSpan.style.fontSize = "11px";
        folderSpan.style.color = "rgba(255,255,255,0.4)";
        folderSpan.textContent = folderPath + "/";
        wrapper.appendChild(folderSpan);

        const inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.className = "form-input";
        inputEl.style.cssText = "padding: 6px 10px; font-family: monospace; font-size: 11px; width: 220px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: #fff;";

        const dotIdx = filename.lastIndexOf(".");
        const baseName = dotIdx !== -1 ? filename.slice(0, dotIdx) : filename;
        const ext = dotIdx !== -1 ? filename.slice(dotIdx) : "";

        inputEl.value = baseName;
        inputEl.dataset.ext = ext;
        inputEl.dataset.original = filename;
        inputEl.dataset.index = idx;
        wrapper.appendChild(inputEl);

        tdInput.appendChild(wrapper);
        tr.appendChild(tdInput);

        const tdStatus = document.createElement("td");
        const statusSpan = document.createElement("span");
        statusSpan.className = "status-badge user";
        statusSpan.textContent = "READY";
        statusSpan.id = `img-status-${idx}`;
        tdStatus.appendChild(statusSpan);
        tr.appendChild(tdStatus);

        tableBody.appendChild(tr);
      });

    } catch (err) {
      console.error("Failed to load active images list:", err);
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 30px;">Error scanning images: ${err.message || err}</td></tr>`;
    }
  };

  window.saveImageNames = async function() {
    const inputs = document.querySelectorAll("#imageOptimizerTableBody input");
    const renameList = [];

    inputs.forEach(input => {
      const idx = parseInt(input.dataset.index);
      const originalFilename = input.dataset.original;
      const ext = input.dataset.ext;
      const newBaseName = input.value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
      const newFilename = newBaseName + ext;

      if (newFilename !== originalFilename) {
        const img = activeImages[idx];
        const pathParts = img.src.split("/");
        const folderPath = pathParts.slice(0, -1).join("/");

        renameList.push({
          oldPath: img.src,
          newPath: `${folderPath}/${newFilename}`,
          inputEl: input,
          statusSpan: document.getElementById(`img-status-${idx}`)
        });
      }
    });

    if (renameList.length === 0) {
      alert("No filename changes detected.");
      return;
    }

    const saveBtn = document.getElementById("saveImageNamesBtn");
    const originalText = saveBtn ? saveBtn.innerHTML : "";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = "SAVING...";
    }

    if (window.syncToGithubCallable) {
      try {
        const payload = renameList.map(r => ({ oldPath: r.oldPath, newPath: r.newPath }));

        renameList.forEach(r => {
          if (r.statusSpan) {
            r.statusSpan.className = "status-badge pending";
            r.statusSpan.textContent = "RENAME PENDING";
          }
        });

        const response = await window.syncToGithubCallable({
          action: "renameImages",
          payload: payload
        });

        if (response.data && response.data.success) {
          renameList.forEach(r => {
            if (r.statusSpan) {
              r.statusSpan.className = "status-badge shipped";
              r.statusSpan.textContent = "RENAMED ✓";
            }
            const newFilenameOnly = r.newPath.split("/").pop();
            r.inputEl.dataset.original = newFilenameOnly;
          });
          alert("Success! Image files renamed and JSON configurations updated.");
          window.loadImageList();
        } else {
          throw new Error(response.data ? response.data.message : "Rename failed");
        }
      } catch (err) {
        console.error("Failed to rename images via GitHub sync:", err);
        renameList.forEach(r => {
          if (r.statusSpan) {
            r.statusSpan.className = "status-badge error";
            r.statusSpan.style.background = "rgba(255, 59, 48, 0.15)";
            r.statusSpan.style.color = "var(--danger)";
            r.statusSpan.style.border = "1px solid rgba(255, 59, 48, 0.25)";
            r.statusSpan.textContent = "FAILED";
          }
        });
        alert("Error renaming images: " + (err.message || err));
      }
    } else {
      alert("Firebase GitHub sync function is not initialized.");
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  };

})();
