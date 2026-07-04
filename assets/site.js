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
}());
