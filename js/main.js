// Small progressive enhancements — the site works without this file.
(() => {
  // Keep the footer year current.
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Fade sections in as they scroll into view. Only opt in once we know
  // IntersectionObserver is available, so content stays fully visible
  // for anyone without it (older browsers, JS errors, etc.).
  const revealTargets = document.querySelectorAll(".reveal");
  if (revealTargets.length && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js");

    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  // Highlight the current section's nav link as the user scrolls.
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".primary-nav a, .mobile-nav a");

  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    const linksById = new Map();
    navLinks.forEach((link) => {
      const id = link.getAttribute("href")?.slice(1);
      if (!id) return;
      if (!linksById.has(id)) linksById.set(id, []);
      linksById.get(id).push(link);
    });

    const setActive = (id) => {
      navLinks.forEach((link) => link.classList.remove("is-active"));
      (linksById.get(id) || []).forEach((link) => link.classList.add("is-active"));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0.1, 0.25, 0.5, 0.75] }
    );

    sections.forEach((section) => observer.observe(section));
  }

  // Close the mobile nav popover after a link is tapped.
  const mobileNav = document.getElementById("mobile-nav");
  if (mobileNav && "popover" in HTMLElement.prototype) {
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => mobileNav.hidePopover?.());
    });
  }
})();
