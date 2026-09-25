/* Santronica — site interactions */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Sticky nav shadow ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 10);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Stat counters ---------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    if (prefersReducedMotion) {
      el.textContent = String(target);
      return;
    }
    if (typeof requestAnimationFrame !== "function") {
      el.textContent = String(target);
      return;
    }
    var duration = 1200;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var counters = document.querySelectorAll(".stat-num[data-count]");
  if ("IntersectionObserver" in window) {
    var countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) { countObserver.observe(el); });
  } else {
    counters.forEach(animateCount);
  }

  /* ---------- Active nav link on scroll ---------- */
  var sections = document.querySelectorAll("main section[id]");
  var navAnchors = document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)');
  if ("IntersectionObserver" in window && sections.length && navAnchors.length) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.getAttribute("id");
          navAnchors.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ---------- Contact form (mailto compose) ---------- */
  var form = document.getElementById("contactForm");
  var note = document.getElementById("formNote");

  function fieldValue(name) {
    var el = form && form.elements[name];
    return el && typeof el.value === "string" ? el.value.trim() : "";
  }

  function setInvalid(name, invalid) {
    var el = form && form.elements[name];
    if (el && el.setAttribute) el.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = fieldValue("name");
      var email = fieldValue("email");
      var company = fieldValue("company");
      var area = fieldValue("area") || "General enquiry";
      var message = fieldValue("message");

      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      setInvalid("name", !name);
      setInvalid("email", !email || !emailOk);
      setInvalid("message", !message);

      if (!name || !email || !message) {
        if (note) note.textContent = "Please fill in your name, email and project brief.";
        return;
      }
      if (!emailOk) {
        if (note) note.textContent = "Please enter a valid email address.";
        return;
      }

      // Honeypot filled => spam bot; pretend success, send nothing.
      if (fieldValue("_honey")) {
        form.reset();
        if (note) note.textContent = "Thank you — your enquiry has been sent.";
        return;
      }

      var subject = "Project enquiry — " + area + " (" + name + ")";

      function mailtoFallback() {
        var bodyLines = [
          "Name: " + name,
          "Email: " + email,
          company ? "Company: " + company : null,
          "Project area: " + area,
          "",
          message
        ].filter(Boolean);
        window.location.href =
          "mailto:admin@santronica.com" +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(bodyLines.join("\n"));
        if (note) note.textContent = "Opening your email app instead… If nothing happens, write to admin@santronica.com directly.";
      }

      if (typeof fetch !== "function") {
        mailtoFallback();
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      if (note) note.textContent = "";

      fetch("https://formsubmit.co/ajax/admin@santronica.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          company: company || "—",
          "project area": area,
          message: message,
          _subject: subject,
          _template: "table",
          _captcha: "false"
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          // FormSubmit answers HTTP 200 even when it did not deliver
          // (e.g. "needs Activation"), so trust only an explicit success.
          if (!data || String(data.success) !== "true") {
            throw new Error((data && data.message) || "Enquiry not delivered");
          }
          form.reset();
          if (note) note.textContent = "Thank you — your enquiry has been sent. We'll get back to you shortly.";
        })
        .catch(function () {
          mailtoFallback();
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Enquiry";
          }
        });
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
