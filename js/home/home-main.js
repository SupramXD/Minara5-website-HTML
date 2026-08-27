/**
 * Studio Extrait - Home Page Main Utilities
 * Manages dynamic logo positioning, scroll tracking, cart/menu drawer bindings,
 * hero interactive hover reveals, and second hero CTA tagline proximity animation.
 */

// ==========================================
// 1. GLOBAL CART & MENU PANEL HANDLERS
// ==========================================
window.openCart = function () {
  const panel = document.getElementById('cartPanel');
  const dimmer = document.getElementById('pageDimmer');
  if (panel) panel.classList.add('open');
  if (dimmer) dimmer.classList.add('active');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
};

window.closeCart = function () {
  const panel = document.getElementById('cartPanel');
  const dimmer = document.getElementById('pageDimmer');
  if (panel) panel.classList.remove('open');
  if (dimmer) dimmer.classList.remove('active');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
};

window.updateCartCount = function (n) {
  const v = n < 10 ? '0' + n : String(n);
  const headerCount = document.getElementById('cartCountHeader');
  const panelCount = document.getElementById('cartCountPanel');
  if (headerCount) headerCount.textContent = v;
  if (panelCount) panelCount.textContent = v;
};

window.openMenu = function () {
  const menu = document.getElementById('menuPanel');
  if (menu) menu.classList.add('open');
};

window.closeMenu = function () {
  const menu = document.getElementById('menuPanel');
  if (menu) menu.classList.remove('open');
};

document.addEventListener('DOMContentLoaded', () => {
  const dimmer = document.getElementById('pageDimmer');
  if (dimmer) {
    dimmer.addEventListener('click', window.closeCart);
  }

  const mobileShopBtn = document.getElementById('mobileShopButton');
  if (mobileShopBtn) {
    mobileShopBtn.addEventListener('click', () => {
      window.location.href = 'catalog.html';
    });
  }
});


// ==========================================
// 2. DYNAMIC LOGO POSITIONING & SCROLL TRACKING
// ==========================================
(function () {
  const hero = document.getElementById('hero');
  const imgR = document.getElementById('imgR');
  const secondHero = document.getElementById('secondHero');
  const secImgR = document.getElementById('secImgR');
  const bagsBtn = document.getElementById('bagsBtn');
  const logo = document.getElementById('logo');
  const topbar = document.getElementById('topbar');

  // Cached dimensions and states
  let heroBottom = 0;
  let imgRBottom = 0;
  let secondHeroBottom = 0;
  let secImgRBottom = 0;
  let secImgLTop = 0;
  let secWrapHeight = 0;
  let bagsBtnHeight = 0;
  let logoHeight = 0;
  let topbarHeight = 45; // Default header height
  let windowHeight = 0;
  let mobileView = false;

  // State tracking for style guards
  let lastBagsBtnState = ""; // "fixed" or "absolute"
  let lastLogoState = "";    // "fixed" or "absolute"

  function measure() {
    if (!hero || !imgR || !secondHero || !secImgR) return;

    mobileView = window.innerWidth <= 900;

    // Measure heights/positions with fallbacks for loading/collapsed states
    let firstHeight = hero.offsetHeight;
    if (firstHeight < 100) {
      firstHeight = 180;
    }
    heroBottom = hero.offsetTop + firstHeight - 45;
    imgRBottom = window.scrollY + imgR.getBoundingClientRect().bottom;

    let secHeight = secondHero.offsetHeight;
    if (secHeight < 100) {
      secHeight = 180;
    }
    secondHeroBottom = secondHero.offsetTop + secHeight - 45;
    secImgRBottom = window.scrollY + secImgR.getBoundingClientRect().bottom;

    const secWrap = document.querySelector('.second-hero-left-wrap');
    if (secWrap && secondHero) {
      secImgLTop = secondHero.offsetTop + secWrap.offsetTop;
      secWrapHeight = secWrap.offsetHeight || 720;
    } else if (secondHero) {
      secImgLTop = secondHero.offsetTop;
      secWrapHeight = 720;
    }

    if (bagsBtn) {
      bagsBtnHeight = bagsBtn.offsetHeight;
    }
    if (logo) {
      logoHeight = logo.offsetHeight || logo.getBoundingClientRect().height;
    }
    if (topbar) {
      topbarHeight = topbar.offsetHeight || topbar.getBoundingClientRect().height;
    }
    windowHeight = window.innerHeight;
  }

  function update() {
    const y = window.scrollY;
    const s = window.heroSettings || {};

    // Desktop second hero halfway detection for tagline animation
    const secWrap = document.querySelector('.second-hero-left-wrap');
    if (secWrap) {
      const isHalfway = !mobileView && ((y + windowHeight) >= (secImgLTop + (secWrapHeight * 0.5))) && (y < (secImgLTop + secWrapHeight));
      if (isHalfway) {
        secWrap.classList.add('halfway-in-view');
      } else {
        secWrap.classList.remove('halfway-in-view');
      }
    }

    let desktopSpawn = s.logoDesktopSpawn !== undefined ? s.logoDesktopSpawn : 44;
    let mobileSpawn = s.logoMobileSpawn !== undefined ? s.logoMobileSpawn : -100;

    if (hero && secondHero) {
      const firstHeroEnd = heroBottom + 45;
      const secondHeroStart = secondHero.offsetTop;

      if (!mobileView) {
        const spawnPercent = s.logoDesktopSpawn !== undefined ? s.logoDesktopSpawn : 44;
        const spawnPercent2 = s.logoDesktopSpawn2 !== undefined ? s.logoDesktopSpawn2 : 65;

        const spawnY = windowHeight * (spawnPercent / 100);
        const spawnY2 = windowHeight * (spawnPercent2 / 100);

        const yStart = firstHeroEnd - spawnY;
        const yEnd = secondHeroStart - spawnY2;

        if (yEnd > yStart) {
          const ySwitch = (yStart + yEnd) / 2;
          desktopSpawn = y < ySwitch ? spawnPercent : spawnPercent2;
        }
      } else {
        const spawnOffset = s.logoMobileSpawn !== undefined ? s.logoMobileSpawn : -100;
        const spawnOffset2 = s.logoMobileSpawn2 !== undefined ? s.logoMobileSpawn2 : 50;

        const spawnY = topbarHeight + spawnOffset;
        const spawnY2 = topbarHeight + spawnOffset2;

        const yStart = firstHeroEnd - spawnY;
        const yEnd = secondHeroStart - spawnY2;

        if (yEnd > yStart) {
          const ySwitch = (yStart + yEnd) / 2;
          mobileSpawn = y < ySwitch ? spawnOffset : spawnOffset2;
        }
      }
    }

    if (!mobileView) {
      if (logo) logo.classList.remove('locked-white-zone');
      // --- DESKTOP LOGIC ---
      const fixedOffset = 48;
      const bottom = y + fixedOffset + bagsBtnHeight;
      const shouldBeAbsolute = bottom >= heroBottom + 45;

      // 1. bagsBtn styling guard (locks at first hero bottom)
      if (shouldBeAbsolute) {
        if (lastBagsBtnState !== "absolute") {
          bagsBtn.style.position = 'absolute';
          bagsBtn.style.top = (heroBottom - bagsBtnHeight) + 'px';
          lastBagsBtnState = "absolute";
        }
      } else {
        if (lastBagsBtnState !== "fixed") {
          bagsBtn.style.position = 'fixed';
          bagsBtn.style.top = fixedOffset + 'px';
          lastBagsBtnState = "fixed";
        }
      }

      // 2. logo styling guard on DESKTOP:
      // Locks at bottom of FIRST hero (heroBottom). Does NOT show on second hero image on desktop.
      const spawnPercent = desktopSpawn;
      const stickOffset = s.logoDesktopStick !== undefined ? s.logoDesktopStick : -34;
      const dX = s.logoDesktopX !== undefined ? s.logoDesktopX : 0;

      const spawnY = windowHeight * (spawnPercent / 100);
      const shouldLockDesktop = y + spawnY + logoHeight / 2 + stickOffset >= heroBottom;

      if (shouldLockDesktop) {
        if (lastLogoState !== "desktop-absolute") {
          logo.style.position = 'absolute';
          logo.style.top = (heroBottom - logoHeight - stickOffset) + 'px';
          logo.style.transform = `translate3d(calc(-50% + ${dX}px), 0, 0)`;
          lastLogoState = "desktop-absolute";
        }
      } else {
        const logoFixedStyle = `fixed-${spawnPercent}-${dX}`;
        if (lastLogoState !== logoFixedStyle) {
          logo.style.position = 'fixed';
          logo.style.top = spawnPercent + '%';
          logo.style.transform = `translate3d(calc(-50% + ${dX}px), -50%, 0)`;
          lastLogoState = logoFixedStyle;
        }
      }

      if (logo) {
        logo.style.opacity = '1';
        logo.style.visibility = 'visible';
        logo.style.pointerEvents = 'none';
        logo.style.zIndex = '10';
      }

      // Reset mobile state tracking when on desktop
      if (lastLogoState.startsWith("mobile-") || lastLogoState === "hidden") {
        lastLogoState = "";
      }

      return;
    }

    // --- MOBILE LOGIC ---
    const stickOffset = s.logoMobileStick !== undefined ? s.logoMobileStick : 10;
    const mX = s.logoMobileX !== undefined ? s.logoMobileX : 0;

    const floatTopViewportHero1 = topbarHeight + (s.logoMobileSpawn !== undefined ? s.logoMobileSpawn : -95);
    const floatTopViewportHero2 = topbarHeight + (s.logoMobileSpawn2 !== undefined ? s.logoMobileSpawn2 : 180);

    const lockPtHero1 = (heroBottom + 45) - logoHeight + stickOffset + 25;
    const lockPtHero2 = (secondHeroBottom + topbarHeight) + stickOffset - 125;

    // Hero 2 Symmetrical Trigger
    const viewportH = document.documentElement.clientHeight || windowHeight || window.innerHeight;
    const hero2SpawnY = (secImgLTop + 190) - viewportH;

    if (y < hero2SpawnY) {
      if (logo) logo.classList.remove('locked-white-zone');
      // HERO 1 ZONE OR PRODUCTS/TEXT ZONE
      const isHero1Visible = (y <= lockPtHero1 + logoHeight + 60);
      if (isHero1Visible) {
        logo.style.opacity = '1';
        logo.style.visibility = 'visible';
        logo.style.pointerEvents = 'none';
        logo.style.zIndex = '1500';

        const shouldLockHero1 = (y + floatTopViewportHero1) >= lockPtHero1;
        if (shouldLockHero1) {
          const hero1AbsStyle = `mobile-hero1-absolute-${lockPtHero1}-${mX}`;
          if (lastLogoState !== hero1AbsStyle) {
            logo.style.position = 'absolute';
            logo.style.top = lockPtHero1 + 'px';
            logo.style.transform = `translate3d(calc(-50% + ${mX}px), 0, 0)`;
            lastLogoState = hero1AbsStyle;
          }
        } else {
          const hero1FixedStyle = `mobile-hero1-fixed-${floatTopViewportHero1}-${mX}`;
          if (lastLogoState !== hero1FixedStyle) {
            logo.style.position = 'fixed';
            logo.style.top = floatTopViewportHero1 + 'px';
            logo.style.transform = `translate3d(calc(-50% + ${mX}px), 0, 0)`;
            lastLogoState = hero1FixedStyle;
          }
        }
      } else {
        // Hidden over products & 6 text blocks
        if (lastLogoState !== "hidden") {
          logo.style.opacity = '0';
          logo.style.visibility = 'hidden';
          logo.style.pointerEvents = 'none';
          lastLogoState = "hidden";
        }
      }
    } else {
      // HERO 2 ZONE & EVERYTHING BELOW — logo hidden over the image, shown once it locks
      const shouldLockHero2 = (y + floatTopViewportHero2) >= lockPtHero2;
      const photoBottom = secImgLTop + secWrapHeight;
      const logoDocTop = y + floatTopViewportHero2;
      const isOverWhite = (logoDocTop >= photoBottom - 10) || shouldLockHero2;

      if (shouldLockHero2) {
        logo.style.opacity = '1';
        logo.style.visibility = 'visible';
        logo.style.pointerEvents = 'none';
        logo.style.zIndex = '1500';

        if (isOverWhite) {
          if (logo) logo.classList.add('locked-white-zone');
        } else {
          if (logo) logo.classList.remove('locked-white-zone');
        }

        const hero2AbsStyle = `mobile-hero2-absolute-${lockPtHero2}-${mX}`;
        if (lastLogoState !== hero2AbsStyle) {
          logo.style.position = 'absolute';
          logo.style.top = lockPtHero2 + 'px';
          logo.style.transform = `translate3d(calc(-50% + ${mX}px), 0, 0) scale(0.99)`;
          lastLogoState = hero2AbsStyle;
        }
      } else {
        // Hidden while travelling across the hero images; appear only when it locks in place
        if (lastLogoState !== "hidden") {
          logo.style.opacity = '0';
          logo.style.visibility = 'hidden';
          logo.style.pointerEvents = 'none';
          lastLogoState = "hidden";
        }
      }
    }

    // Reset desktop state tracking when on mobile
    if (lastLogoState && (lastLogoState.startsWith("desktop-") || lastLogoState.startsWith("fixed-"))) {
      lastLogoState = "";
    }
    lastBagsBtnState = "";

    // Update desktop tagline visibility on scroll
    updateSecondHeroTaglineDesktop();
  }

  // Desktop: Tagline scroll detection & crosshair proximity animation
  const secWrapElem = document.querySelector('.second-hero-left-wrap');
  const secHeroElem = document.getElementById('secondHero');
  const ctaGroupElem = document.querySelector('.second-hero-cta-group');
  let lastClientX = null;
  let lastClientY = null;

  function updateSecondHeroTaglineDesktop() {
    if (window.innerWidth <= 900) {
      if (secWrapElem) secWrapElem.classList.remove('tagline-visible');
      if (secHeroElem) secHeroElem.classList.remove('tagline-visible');
      if (ctaGroupElem) ctaGroupElem.classList.remove('tagline-visible', 'tagline-proximity');
      return;
    }

    const secWrap = secWrapElem || document.querySelector('.second-hero-left-wrap');
    const ctaGroup = ctaGroupElem || document.querySelector('.second-hero-cta-group');
    const secHero = secHeroElem || document.getElementById('secondHero');
    if (!secWrap || !ctaGroup) return;

    const ctaRect = ctaGroup.getBoundingClientRect();
    const winH = window.innerHeight || document.documentElement.clientHeight;

    const isScrolledIn = (ctaRect.top <= winH * 0.88 && ctaRect.bottom >= 40);

    if (isScrolledIn) {
      ctaGroup.classList.add('tagline-visible');
      if (secWrap) secWrap.classList.add('tagline-visible');
      if (secHero) secHero.classList.add('tagline-visible');
    } else {
      ctaGroup.classList.remove('tagline-visible');
      ctaGroup.classList.remove('tagline-proximity');
      if (secWrap) secWrap.classList.remove('tagline-visible');
      if (secHero) secHero.classList.remove('tagline-visible');
    }

    if (isScrolledIn && lastClientX !== null && lastClientY !== null) {
      const ctaCenterX = ctaRect.left + ctaRect.width / 2;
      const ctaCenterY = ctaRect.top + ctaRect.height / 2;
      const dist = Math.hypot(lastClientX - ctaCenterX, lastClientY - ctaCenterY);

      if (dist <= 180) {
        ctaGroup.classList.add('tagline-proximity');
      } else {
        ctaGroup.classList.remove('tagline-proximity');
      }
    } else {
      ctaGroup.classList.remove('tagline-proximity');
    }
  }

  window.addEventListener('scroll', updateSecondHeroTaglineDesktop, { passive: true });
  window.addEventListener('mousemove', (e) => {
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    updateSecondHeroTaglineDesktop();
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    lastClientX = null;
    lastClientY = null;
    if (ctaGroupElem) ctaGroupElem.classList.remove('tagline-proximity');
  });

  window.addEventListener('resize', updateSecondHeroTaglineDesktop, { passive: true });
  document.addEventListener('DOMContentLoaded', updateSecondHeroTaglineDesktop);

  window.updateLogoPosition = function () {
    measure();
    update();
  };

  // requestAnimationFrame (rAF) Throttle Wrapper for scroll
  let scrollTicking = false;
  function handleScroll() {
    if (!scrollTicking) {
      window.requestAnimationFrame(() => {
        update();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  window.addEventListener('load', () => { measure(); update(); });
  setTimeout(() => { measure(); update(); }, 80);
})();


// ==========================================
// 3. HERO CLICK & HOVER INTERACTIVE REVEALS
// ==========================================
(function () {
  const imgL = document.getElementById('imgL');
  const imgR = document.getElementById('imgR');

  if (imgL) {
    imgL.addEventListener('click', () => window.location.href = "catalog.html");
  }
  if (imgR) {
    imgR.addEventListener('click', () => window.location.href = "catalog.html");
  }

  if (window.matchMedia("(max-width:900px)").matches) return;

  const shopNow = document.getElementById('shopNow');
  if (!shopNow) return;

  if (imgL) {
    imgL.addEventListener('mouseenter', () => {
      shopNow.style.opacity = "1";
      shopNow.style.left = "0";
    });

    imgL.addEventListener('mouseleave', () => {
      shopNow.style.opacity = "";
      shopNow.style.left = "";
    });
  }

  const giftsBtn = document.getElementById('bagsBtn');
  if (giftsBtn) {
    giftsBtn.addEventListener('mouseenter', () => {
      shopNow.style.opacity = "1";
      shopNow.style.left = "0";
    });
    giftsBtn.addEventListener('mouseleave', () => {
      shopNow.style.opacity = "";
      shopNow.style.left = "";
    });
  }
})();
