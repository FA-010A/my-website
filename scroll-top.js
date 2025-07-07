// scroll-top.js
// スクロールトップ機能

document.addEventListener('DOMContentLoaded', function() {
  const scrollTopButton = document.getElementById("scroll-top");
  
  if (scrollTopButton) {
    scrollTopButton.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }
});