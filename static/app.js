"use strict";

const revealTargets = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -56px 0px", threshold: 0.08 },
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}

const navLinks = Array.from(document.querySelectorAll(".nav-links a"));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function updateActiveNav() {
  const current = sections.reduce((active, section) => {
    const top = section.getBoundingClientRect().top;
    return top <= 110 ? section : active;
  }, sections[0]);

  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${current?.id}`);
  });
}

if (navLinks.length > 0 && sections.length > 0) {
  updateActiveNav();
  window.addEventListener("scroll", updateActiveNav, { passive: true });
}

const copyButton = document.querySelector(".copy-email");
const copyStatus = document.querySelector(".copy-status");

async function copyEmail() {
  const email = copyButton?.dataset.copy;
  if (!email || !copyStatus) return;

  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = "Email copied.";
  } catch {
    copyStatus.textContent = email;
  }

  window.setTimeout(() => {
    copyStatus.textContent = "";
  }, 2400);
}

copyButton?.addEventListener("click", copyEmail);
