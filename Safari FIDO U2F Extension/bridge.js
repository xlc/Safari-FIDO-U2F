/**
This script is injected automatically when the Safari app extension is loaded.

It acts as a bridge between the native extension and the javascript api, by
doing three things:

- adding a <script> element to the document which causes the actual api to be loaded and injected
- listening for messages from the api and passing them on to the extension
- listening for messages from the extension and passing them on to the api

*/



/**
Listen for messages sent to the window.
Pass on any U2F-specific messages to the extension.
*/

window.addEventListener("message", function(e) {
  if (e.origin == window.location.origin) {
    name = e.data.name
    if ((name == "U2FSign") || (name == "U2FRegister")) {
      safari.extension.dispatchMessage(name, e.data.message);
    }
  }
});

/**
Listen for messages from the extension.
Repost them to the window, so that they can be picked up by the u2f.js script.
*/

safari.self.addEventListener("message", function(e) {
  window.postMessage({
    name: e.name,
    message: e.message,
  }, window.location.origin);
});

/**
Listen for the content loaded event.
Add a script element to the head containing the u2f.js script.
This causes the u2f api to be loaded and added to the window as window.u2f.
*/

document.addEventListener("DOMContentLoaded", function(e) {
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = safari.extension.baseURI + 'u2f.js';
  document.head.appendChild(s);
});
