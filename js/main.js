/* Santronica — site interactions (Page B) */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav material switching (dark/light) ---------- */
  var nav = document.querySelector(".nav");
  var sections = document.querySelectorAll("section[data-theme]");

  function updateNavTheme() {
    if (!nav || !sections.length) return;
    var scrollY = window.scrollY;
    var currentTheme = "light";

    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      var rect = section.getBoundingClientRect();
      var sectionTop = scrollY + rect.top;
      var navCenter = scrollY + nav.offsetHeight / 2;

      if (navCenter >= sectionTop && navCenter < sectionTop + rect.height) {
        currentTheme = section.getAttribute("data-theme") || "light";
        break;
      }
    }

    nav.classList.toggle("nav--dark", currentTheme === "dark");
    nav.classList.toggle("nav--light", currentTheme === "light");
  }

  window.addEventListener("scroll", updateNavTheme, { passive: true });
  updateNavTheme();

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

    // Keyboard: ESC to close
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Scroll reveal (Apple-style easing) ---------- */
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
  var navSections = document.querySelectorAll("main section[id]");
  var navAnchors = document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)');
  if ("IntersectionObserver" in window && navSections.length && navAnchors.length) {
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
      { threshold: 0.6 }
    );
    navSections.forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ---------- Contact form (FormSubmit AJAX, mailto fallback) ---------- */
  var form = document.getElementById("contactForm");
  var note = document.getElementById("formNote");
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  var sendLabel = submitBtn ? submitBtn.textContent : "Send Enquiry";

  // Name, email and company limits mirror their maxlength attributes in index.html, which do not
  // stop values set by script, autofill or drag and drop. The brief has no maxlength, so a long
  // paste is not cut silently; this check asks the visitor to shorten it instead.
  var FIELD_LIMITS = { name: 100, email: 254, company: 120, message: 5000 };
  var FIELD_LABELS = { name: "name", email: "email address", company: "company name", message: "project brief" };
  var REQUEST_TIMEOUT_MS = 30000; // generous, so a slow but successful send is not also sent by mailto
  var SENT_COOLDOWN_MS = 60000;   // after a successful send, block another enquiry for one minute

  var sending = false;   // in-flight guard: true from submit until the request settles
  var cooldownUntil = 0; // timestamp in ms; 0 means no cooldown

  function fieldValue(name) {
    var el = form && form.elements[name];
    return el && typeof el.value === "string" ? el.value.trim() : "";
  }

  function setInvalid(name, invalid) {
    var el = form && form.elements[name];
    if (el && el.setAttribute) el.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  function setNote(text) {
    if (note) note.textContent = text;
  }

  function setSending(busy) {
    sending = busy;
    if (form) {
      if (busy) form.setAttribute("aria-busy", "true");
      else form.removeAttribute("aria-busy");
    }
    if (submitBtn) {
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? "Sending…" : sendLabel;
    }
  }

  // Resolves only on an explicit success:"true". Rejects on a network error, a non-2xx status,
  // an unreadable body, any other success value, or when no complete answer arrives within
  // REQUEST_TIMEOUT_MS. The timer also covers reading the body. Promise.race keeps the timeout
  // working in browsers without AbortController; where it exists, the request is cancelled too.
  function sendEnquiry(payload) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("timeout"));
      }, REQUEST_TIMEOUT_MS);
    });
    var request = Promise.resolve()
      .then(function () {
        return fetch("https://formsubmit.co/ajax/admin@santronica.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });
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
        return data;
      });
    return Promise.race([request, timeout]).then(
      function (data) { clearTimeout(timer); return data; },
      function (err) { clearTimeout(timer); throw err; }
    );
  }

  // First field (in FIELD_LIMITS order) whose trimmed value is over its limit, or null.
  function overLimitField(values) {
    var keys = ["name", "email", "company", "message"];
    for (var i = 0; i < keys.length; i++) {
      if (values[keys[i]].length > FIELD_LIMITS[keys[i]]) return keys[i];
    }
    return null;
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // A send is already in flight (double click, Enter or a scripted second submit): ignore it.
      if (sending) return;

      // Honeypot filled => spam bot; pretend success, send nothing.
      if (fieldValue("_honey")) {
        form.reset();
        setNote("Thank you — your enquiry has been sent.");
        return;
      }

      // An enquiry was just sent: block an immediate second one.
      if (Date.now() < cooldownUntil) {
        setNote("Your enquiry has already been sent. Please wait a minute before sending another.");
        return;
      }

      var name = fieldValue("name");
      var email = fieldValue("email");
      var company = fieldValue("company");
      var area = fieldValue("area") || "General enquiry";
      var message = fieldValue("message");
      var values = { name: name, email: email, company: company, message: message };
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      setInvalid("name", !name || name.length > FIELD_LIMITS.name);
      setInvalid("email", !email || !emailOk || email.length > FIELD_LIMITS.email);
      setInvalid("company", company.length > FIELD_LIMITS.company);
      setInvalid("message", !message || message.length > FIELD_LIMITS.message);

      if (!name || !email || !message) {
        setNote("Please fill in your name, email and project brief.");
        return;
      }
      if (!emailOk) {
        setNote("Please enter a valid email address.");
        return;
      }
      var over = overLimitField(values);
      if (over) {
        setNote("Please keep your " + FIELD_LABELS[over] + " to " + FIELD_LIMITS[over] + " characters or fewer.");
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
        setNote("Opening your email app instead… If nothing happens, write to admin@santronica.com directly.");
      }

      if (typeof fetch !== "function") {
        mailtoFallback();
        return;
      }

      setSending(true);
      setNote("");

      sendEnquiry({
        name: name,
        email: email,
        company: company || "—",
        "project area": area,
        message: message,
        _subject: subject,
        _template: "table",
        _captcha: "false"
      })
        .then(function () {
          form.reset();
          cooldownUntil = Date.now() + SENT_COOLDOWN_MS;
          // Clear aria-busy before writing the note so screen readers announce it.
          setSending(false);
          setNote("Thank you — your enquiry has been sent. We'll get back to you shortly.");
        }, function () {
          // Not confirmed as delivered (HTTP error, success:"false", network error or timeout):
          // keep the mailto fallback so the enquiry still reaches the business.
          setSending(false);
          mailtoFallback();
        })
        .then(null, function () { setSending(false); });
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
