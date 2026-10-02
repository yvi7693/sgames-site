/* S.Games — редакционная версия. Один скрипт на все страницы */

/* Ссылки задаются здесь один раз */
const SITE = {
  steamUrl: "#",                // https://store.steampowered.com/app/...
  discordUrl: "#",              // https://discord.gg/...
  email: "hello@sgames.example" // почта на домене студии
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
document.querySelectorAll("[data-steam]").forEach((a) => (a.href = SITE.steamUrl));
document.querySelectorAll("[data-discord]").forEach((a) => (a.href = SITE.discordUrl));
document.querySelectorAll("[data-email-address]").forEach((el) => (el.textContent = SITE.email));
document.querySelectorAll("[data-email]").forEach((a) => {
  a.href = `mailto:${SITE.email}`;
  if (a.hasAttribute("data-email-text")) a.textContent = SITE.email;
});

/* ---------- Меню: скользящий индикатор ----------
   Первая установка и пересчёт при изменении размера — без анимации,
   чтобы индикатор не «выезжал» слева при загрузке страницы. */
const navList = document.querySelector(".nav-links");
if (navList) {
  const indicator = navList.querySelector(".nav-indicator");
  const current = navList.querySelector('[aria-current="page"]');
  let target = current;
  const place = (el, animate) => {
    indicator.classList.toggle("no-anim", !animate);
    if (!el || !el.offsetWidth) { indicator.style.opacity = "0"; return; }
    indicator.style.width = `${el.offsetWidth}px`;
    indicator.style.transform = `translateX(${el.offsetLeft}px)`;
    indicator.style.opacity = "1";
  };
  const moveTo = (el) => { target = el; place(el, true); };
  navList.querySelectorAll("a").forEach((a) => {
    a.addEventListener("pointerenter", () => moveTo(a));
    a.addEventListener("focus", () => moveTo(a));
  });
  navList.addEventListener("pointerleave", () => moveTo(current));
  navList.addEventListener("focusout", (e) => { if (!navList.contains(e.relatedTarget)) moveTo(current); });
  const snap = () => place(target, false);
  snap();
  document.fonts?.ready.then(snap);
  window.addEventListener("resize", snap);
}

/* ---------- Мобильное меню ---------- */
const toggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
if (toggle && mobileMenu) {
  const isOpen = () => document.body.classList.contains("menu-open");
  const setOpen = (open) => {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.documentElement.style.overflow = open ? "hidden" : "";
    mobileMenu.inert = !open; // закрытое меню нельзя «натабать» с клавиатуры
  };
  setOpen(false);
  toggle.addEventListener("click", () => setOpen(!isOpen()));
  mobileMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { setOpen(false); toggle.focus(); }
  });
  // окно стало шире мобильного — закрыть меню, иначе страница останется без прокрутки
  const closeIfWide = () => { if (isOpen() && window.innerWidth > 720) setOpen(false); };
  window.matchMedia("(max-width: 720px)").addEventListener("change", closeIfWide);
  window.addEventListener("resize", closeIfWide);
}

/* ---------- Трейлер сжимается из полного экрана в окно по центру ---------- */
const shrink = document.querySelector("[data-shrink]");
if (shrink) {
  const frame = shrink.querySelector("[data-shrink-frame]");
  const foot = shrink.querySelector("[data-shrink-foot]");
  let geo = { s: 1, dx: 0, dy: 0 };
  // во сколько раз и куда сдвинуть окно, чтобы оно накрыло весь экран
  const measure = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = frame.offsetWidth, h = frame.offsetHeight;
    const cx = frame.offsetLeft + w / 2, cy = frame.offsetTop + h / 2; // координаты в «прилипшем» экране
    geo = { s: Math.max(vw / w, vh / h) * 1.002, dx: vw / 2 - cx, dy: vh / 2 - cy };
    frame.style.setProperty("--s", geo.s.toFixed(4));
    frame.style.setProperty("--dx", `${geo.dx.toFixed(1)}px`);
    frame.style.setProperty("--dy", `${geo.dy.toFixed(1)}px`);
  };
  const update = () => {
    const range = window.innerHeight * 0.6;
    const k = reduceMotion ? 1 : Math.min(1, Math.max(0, window.scrollY / range));
    const eased = 1 - Math.pow(1 - k, 3); // мягкое торможение в конце
    frame.style.setProperty("--k", eased.toFixed(4));
    foot.style.setProperty("--k", eased.toFixed(4));
    document.body.classList.toggle("nav-shown", window.scrollY > 8 || reduceMotion);
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", () => { measure(); update(); });
  document.fonts?.ready.then(() => { measure(); update(); });
  measure();
  update();
}

/* ---------- Фичи: «Дорожка из лапок» ----------
   Следы раскладываются по линии, которая идёт через кружки-номера и слегка петляет
   между ними. Лапки чередуются (левая/правая) и повёрнуты по направлению шага.
   Прокрутка «доводит» дорожку до уровня 60% экрана; назад — следы гаснут. */
const trail = document.querySelector("[data-trail]");
if (trail) {
  const layer = trail.querySelector(".trail-paws");
  const stops = [...trail.querySelectorAll(".trail-stop")];
  const markers = stops.map((s) => s.querySelector(".trail-marker"));
  let paws = [], stopYs = [];

  const build = () => {
    layer.textContent = "";
    paws = [];
    const box = trail.getBoundingClientRect();
    const pts = markers.map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    stopYs = pts.map((p) => p.y);
    const small = window.innerWidth <= 760;
    const step = small ? 38 : 48;          // шаг между отпечатками
    const amp = small ? 10 : 26;           // насколько дорожка петляет
    const side = small ? 7 : 10;           // смещение левой/правой лапы
    // от верха блока к первому номеру, дальше — между номерами,
    // после последнего — вниз к плашке Discord, следы постепенно тают (дальше их подхватывает футер)
    const next = trail.closest("section")?.nextElementSibling;
    const tail = pts[pts.length - 1];
    const endY = next ? next.getBoundingClientRect().top - box.top + (small ? 24 : 40) : tail.y + 240;
    const route = [{ x: pts[0].x, y: 0 }, ...pts, { x: tail.x, y: endY }];
    const lastSeg = route.length - 2;
    let n = 0;
    for (let s = 0; s < route.length - 1; s++) {
      const a = route[s], b = route[s + 1];
      const len = b.y - a.y, dir = s % 2 ? -1 : 1;
      // следы не заходят под кружки-номера
      const end = s === lastSeg ? b.y : b.y - (small ? 32 : 40);
      for (let y = a.y + (s ? (small ? 32 : 40) : step / 2); y < end; y += step) {
        const t = (y - a.y) / len;
        const x = a.x + (b.x - a.x) * t + dir * amp * Math.sin(Math.PI * t);
        const slope = ((b.x - a.x) + dir * amp * Math.PI * Math.cos(Math.PI * t)) / len; // dx/dy
        const angle = (Math.atan(slope) * 180) / Math.PI;
        const foot = n++ % 2 ? 1 : -1;
        const el = document.createElement("span");
        el.className = "paw";
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.setProperty("--px", `${foot * side}px`);
        el.style.setProperty("--py", "0px");
        el.style.setProperty("--r", `${180 - angle}deg`); // пальчики смотрят по ходу движения (вниз)
        if (s === lastSeg) el.style.setProperty("--o", (1 - 0.85 * t).toFixed(2));
        layer.appendChild(el);
        paws.push({ el, y });
      }
    }
    update();
  };

  const update = () => {
    const reach = window.innerHeight * 0.6 - trail.getBoundingClientRect().top;
    paws.forEach((p) => p.el.classList.toggle("is-on", reduceMotion || p.y < reach));
    stopYs.forEach((y, i) => {
      const on = reduceMotion || y < reach + 40;
      stops[i].classList.toggle("is-reached", on);
      markers[i].classList.toggle("is-reached", on);
    });
  };

  let resizeTimer = 0;
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 150); });
  document.fonts?.ready.then(build);
  build();
}

/* ---------- Следы в футере: появляются один за другим, когда футер на экране ---------- */
const footerPaws = document.querySelector("[data-footer-paws]");
if (footerPaws) {
  if ("IntersectionObserver" in window && !reduceMotion) {
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { footerPaws.classList.add("is-in"); o.disconnect(); } }, { threshold: 0.6 }).observe(footerPaws.parentElement);
  } else footerPaws.classList.add("is-in");
}

/* ---------- Появление блоков при прокрутке ---------- */
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
}

/* ---------- Видео: показать, когда файл загрузился; пауза вне экрана ---------- */
document.querySelectorAll(".video-slot video").forEach((video) => {
  const slot = video.closest(".video-slot");
  const ready = () => slot.classList.add("is-ready");
  if (video.readyState >= 2) ready();
  video.addEventListener("loadeddata", ready);
  if (reduceMotion) video.removeAttribute("autoplay");
});
if ("IntersectionObserver" in window && !reduceMotion) {
  const vio = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => (isIntersecting ? target.play().catch(() => {}) : target.pause()));
  }, { threshold: 0.15 });
  document.querySelectorAll(".video-slot video[autoplay]").forEach((v) => vio.observe(v));
}
document.querySelectorAll("[data-sound-toggle]").forEach((btn) => {
  const video = btn.closest(".video-slot").querySelector("video");
  btn.addEventListener("click", () => {
    video.muted = !video.muted;
    if (!video.muted) video.play().catch(() => {});
    btn.setAttribute("aria-pressed", String(!video.muted));
    btn.setAttribute("aria-label", video.muted ? "Turn sound on" : "Turn sound off");
  });
});

/* ---------- Общее фото команды: тап по человеку показывает карточку ---------- */
document.querySelectorAll(".person").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".person.is-active").forEach((b) => b !== btn && b.classList.remove("is-active"));
    btn.classList.toggle("is-active");
  });
});
document.addEventListener("click", () => document.querySelectorAll(".person.is-active").forEach((b) => b.classList.remove("is-active")));

/* ---------- Копировать почту ---------- */
document.querySelectorAll("[data-copy-email]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(SITE.email);
      const label = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = label), 1600);
    } catch {}
  });
});

/* ---------- Тема: светлая / тёмная ----------
   Начальная тема ставится в <head> до отрисовки; здесь — только переключение и запоминание. */
const themeBtn = document.querySelector("[data-theme-toggle]");
if (themeBtn) {
  const root = document.documentElement;
  const sync = () => {
    const dark = root.dataset.theme === "dark";
    themeBtn.setAttribute("aria-pressed", String(dark));
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  themeBtn.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    try { localStorage.setItem("sgames-theme", next); } catch {}
    sync();
    setTimeout(() => root.classList.remove("theme-anim"), 400);
  });
  sync();
}
