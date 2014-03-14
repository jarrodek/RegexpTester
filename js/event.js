chrome.app.runtime.onLaunched.addListener(function(launchData) {
  //console.log(launchData);
  chrome.app.window.create('../index.html', {
    id: "RegexpApp",
    minWidth: 500,
    minHeight: 600
  });
});

//chrome.runtime.onSuspend.addListener(function() {});