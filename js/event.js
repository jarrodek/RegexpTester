chrome.app.runtime.onLaunched.addListener(function(launchData) {
  chrome.app.window.create('../index.html', {
    id: "RegexpApp",
    minWidth: 800,
    minHeight: 600
  });
});