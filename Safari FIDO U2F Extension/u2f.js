(function() {
  var u2f = {};

  u2f._pending = null;



  /**
  Log to the console.
  We prepend all messages with a tag.
  */

  u2f.log = function(message) {
    console.log("U2F Safari: " + message)
  }



  /**
  Dispatch an event to the extension.
  It will be forwarded by the event listener in bridge.js.
  */

  u2f.postToExtension = function(name, message) {
    window.postMessage({ name: name, message: message }, window.location.origin);
  }



  /**
  Register a callback for later processing.
  Returns true if all went well, false if there was already a callback pending.
  */

  u2f.registerCallback = function(type, callback, appId) {
    u2f.log(type + " " + appId);
    if (u2f._pending) {
      u2f.log("Pending action exists, exiting.");
      return false;
    } else {
      u2f._pending = {
        type: type,
        callback: callback,
      };
      return true;
    }
  }



  /**
  Call a previously registered callback.
  Clears the callback down so that it won't get called again.
  */

  u2f.callCallback = function(info) {
    var pending = u2f._pending;
    if (pending) {
      u2f._pending = null;
      pending.callback(info);
    }
  }



  /**
  Report success via the previously registered callback.
  */

  u2f.reportSuccess = function(result) {
    var info = {
      version: "U2F_V2",
      clientData: result.clientData
    };

    var type = u2f._pending.type;
    if (type == "register") {
      info.registrationData = result.registrationData;
    } else if (type == "sign") {
      info.keyHandle = result.keyHandle;
      info.signatureData = result.signatureData;
    }
    u2f.callCallback(info);
  }



  /**
  Report an error via the previously registred callback.
  */

  u2f.reportError = function(message) {
    u2f.log("Error " + message);
    info = { errorCode : 1 };
    if (message) {
      info.errorMessage = message;
    }
    u2f.callCallback(info);
  }




  /**
  * Dispatches register requests to available U2F tokens. An array of sign
  * requests identifies already registered tokens.
  * If the JS API version supported by the extension is unknown, it first sends a
  * message to the extension to find out the supported API version and then it sends
  * the register request.
  * @param {string=} appId
  * @param {Array<u2f.RegisterRequest>} registerRequests
  * @param {Array<u2f.RegisteredKey>} registeredKeys
  * @param {function((u2f.Error|u2f.RegisterResponse))} callback
  * @param {number=} opt_timeoutSeconds
  *
  * Also support legacy function signature
  */
  u2f.register = function() {
    var arguments_offset = 0;
    var appId = null;
    if (typeof(arguments[0]) == "string") {
      appId = arguments[0];
      arguments_offset += 1;
    }

    var registerRequests = arguments[arguments_offset];
    var callback = arguments[arguments_offset + 2];

    if (u2f.registerCallback("register", callback, appId)) {

      var challenge = null;
      for (var i = 0 ; i < registerRequests.length ; i += 1) {
        if (registerRequests[i].version == "U2F_V2") {
          challenge = registerRequests[i].challenge;
          if (!appId) {
            appId = registerRequests[i].appId;
          }
          break;
        }
      }

      if (challenge && appId) {
        u2f.postToExtension("U2FRegister", {
          appId: appId,
          challenge: challenge
        });
      } else {
        u2f.reportError()
      }
    }

  };



  /**
  * Dispatches an array of sign requests to available U2F tokens.
  * If the JS API version supported by the extension is unknown, it first sends a
  * message to the extension to find out the supported API version and then it sends
  * the sign request.
  * @param {string=} appId
  * @param {string=} challenge
  * @param {Array<u2f.RegisteredKey>} registeredKeys
  * @param {function((u2f.Error|u2f.SignResponse))} callback
  * @param {number=} opt_timeoutSeconds
  *
  * Also support legacy function signature
  */
  u2f.sign = function() {
    var arguments_offset = 0;
    var appId = null;
    var challenge = null;
    if (typeof(arguments[0]) == "string") {
      appId = arguments[0];
      challenge = arguments[1];
      arguments_offset += 2;
    }

    var registeredKeys = arguments[arguments_offset];
    var callback = arguments[arguments_offset + 1];

    if (u2f.registerCallback("sign", callback, appId)) {

      var keyHandle = null;
      for (var i = 0 ; i < registeredKeys.length ; i += 1) {
        if (registeredKeys[i].version == "U2F_V2") {
          keyHandle = registeredKeys[i].keyHandle;
          if (!appId || !challenge) {
            appId = registeredKeys[i].appId;
            challenge = registeredKeys[i].challenge;
          }
          break;
        }
      }

      if (keyHandle && appId && challenge) {
        u2f.postToExtension("U2FSign", {
          appId: appId,
          challenge: challenge,
          keyHandle: keyHandle,
        });
      } else {
        u2f.reportError();
      }
    }
  };


  /**
  Listen for a response from the app extension.
  Figure out whether it's an error or a success, and process it accordingly.
  */

  window.addEventListener("message", function(e) {
    if (e.origin == window.location.origin) {
      if (e.data.name == "U2FResponse") {
        response = e.data.message;
        error = response.error;
        if (error && (error != 0)) {
          u2f.reportError(error);
        } else {
          u2f.reportSuccess(JSON.parse(response.result));
        }
      }
    }
  });



  /**
  Attach the api object to the window.
  We replace anything that's already there, and attempt to prevent
  anything that comes after us from replacing our api.
  */

  if (window.u2f) {
    window.u2f = u2f;
  }

  Object.defineProperty(window, "u2f", {
    get: function() { return u2f; },
    set: undefined,  // prevent furthur change
  });

  u2f.log("loaded");
})();
