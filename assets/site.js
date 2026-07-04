(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var cards = Array.prototype.slice.call(document.querySelectorAll(".product-card"));

  function setFilter(filter) {
    tabs.forEach(function (tab) {
      var active = tab.dataset.filter === filter;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    cards.forEach(function (card) {
      var visible = filter === "all" || card.dataset.category === filter;
      card.hidden = !visible;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setFilter(tab.dataset.filter);
    });
  });

  var requestForm = document.querySelector("[data-request-form]");

  function getCheckedValue(form, name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function setRequestStatus(form, message, state) {
    var status = form.querySelector("[data-request-status]");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.state = state || "";
  }

  function requestPayload(form) {
    var formData = new FormData(form);

    return {
      platform: getCheckedValue(form, "platform"),
      problem: String(formData.get("problem") || "").trim(),
      contact_name: String(formData.get("contact_name") || "").trim(),
      contact_method: String(formData.get("contact_method") || "").trim(),
      company_site: String(formData.get("company_site") || "").trim(),
      source_page: window.location.href,
      submitted_at: new Date().toISOString()
    };
  }

  function openMailDraft(email, payload) {
    var subject = "Buck Builds tool request: " + payload.platform;
    var body = [
      "Main computer: " + payload.platform,
      "",
      "Problem or work pain:",
      payload.problem,
      "",
      "Name or business: " + (payload.contact_name || "Not provided"),
      "Email or phone: " + (payload.contact_method || "Not provided")
    ].join("\n");

    window.location.href = "mailto:" + encodeURIComponent(email) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  function canUseDynamicRequests() {
    var host = window.location.hostname;
    return /^https?:$/.test(window.location.protocol) && (
      host === "buckbuilds.org" ||
      host === "www.buckbuilds.org" ||
      /\.pages\.dev$/i.test(host)
    );
  }

  if (requestForm) {
    requestForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!requestForm.checkValidity()) {
        requestForm.reportValidity();
        setRequestStatus(requestForm, "Please choose a computer type and describe the work pain.", "error");
        return;
      }

      var payload = requestPayload(requestForm);
      var endpoint = requestForm.dataset.endpoint || (canUseDynamicRequests() ? "/api/requests" : "");
      var mailto = requestForm.dataset.mailto;

      if (payload.company_site) {
        requestForm.reset();
        setRequestStatus(requestForm, "Request received.", "success");
        return;
      }

      if (!endpoint && mailto) {
        openMailDraft(mailto, payload);
        setRequestStatus(requestForm, "Opening an email draft with your request.", "success");
        return;
      }

      if (!endpoint) {
        setRequestStatus(requestForm, "The private request inbox is not connected yet. This request was not sent.", "error");
        return;
      }

      setRequestStatus(requestForm, "Sending request...", "");

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed");
        }

        requestForm.reset();
        setRequestStatus(requestForm, "Request sent. Thank you.", "success");
      }).catch(function () {
        setRequestStatus(requestForm, "The request could not be sent. Please try again later.", "error");
      });
    });
  }

  var jobBoard = document.querySelector("[data-job-board]");
  var statusLabels = {
    requested: "Requested",
    building: "Building",
    available: "Available"
  };

  function safeUrl(url) {
    return /^https?:\/\//.test(String(url || "")) ? url : "";
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function renderEmptyJobBoard(message) {
    if (!jobBoard) {
      return;
    }

    clearNode(jobBoard);

    var empty = document.createElement("p");
    empty.className = "job-empty";
    empty.textContent = message || "No public jobs yet.";
    jobBoard.appendChild(empty);
  }

  function renderJob(job) {
    var url = safeUrl(job.url);
    var item = document.createElement(url ? "a" : "article");
    item.className = "job-item";

    if (url) {
      item.href = url;
      item.target = "_blank";
      item.rel = "noreferrer";
    }

    var title = document.createElement("span");
    title.className = "job-title";
    title.textContent = job.title || "Untitled request";

    var meta = document.createElement("span");
    meta.className = "job-meta";

    var platform = document.createElement("span");
    platform.textContent = job.platform || "Any computer";

    var status = document.createElement("span");
    status.className = "job-status " + (job.status || "");
    status.textContent = statusLabels[job.status] || "Requested";

    meta.appendChild(platform);
    meta.appendChild(document.createTextNode(" - "));
    meta.appendChild(status);
    item.appendChild(title);
    item.appendChild(meta);

    return item;
  }

  if (jobBoard) {
    var boardSrc = canUseDynamicRequests() ? "/api/request-board" : (jobBoard.dataset.boardSrc || "assets/request-board.json");

    fetch(boardSrc, {
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Board not found");
      }
      return response.json();
    }).then(function (board) {
      var jobs = Array.isArray(board.jobs) ? board.jobs : [];

      if (!jobs.length) {
        renderEmptyJobBoard("No public jobs yet. Approved requests will show up here.");
        return;
      }

      clearNode(jobBoard);
      jobs.slice(0, 8).forEach(function (job) {
        jobBoard.appendChild(renderJob(job));
      });
    }).catch(function () {
      renderEmptyJobBoard("No public jobs exported yet.");
    });
  }
}());
