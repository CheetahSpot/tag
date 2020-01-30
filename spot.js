/**
 * Spot Web Tag
 */

function SpotJs () {
  let version = "0.0.9";

  //@public tag config
  let config = {
    apiAuth: null,
    apiHost: null,
    defaultCampaign: { "ext_parent_id": "1", "camp_id": "1" }, // TODO - verify we want to save these
    dtAttr: 'device_token',
    utAttr: 'user_token',
    apiEndpoint: '/edp/api/event',
    apiContentType: 'application/json',
    userParam: 'spot_user',
    dataLayerId: 'spot_data',
    cookiePrefix: 'spot_',
    cookieMaxAge: 60*60*24*365, // 1y
    useNavigatorBeacon: false,
    debug: 1
  };

  // @public user object
  let user = { dt: null, ut: null, optin: null, dnt: null, update_attributes: {} };

  // @public return object
  let spotjs = {
    name: "spotjs "+version+" "+Math.random().toString(36).substring(4),
    config: config,
    user: user,
    dataLayer: null,
    sentEvents: [],
    pendingEvents: []
  };

  // log wrapper
  let log = config.debug ? console.log.bind(window.console) : function(){};

  // @public track
  // Helper function to push an event to the data layer
  let track = spotjs.track = function (eventType, params) {
    spotjs.dataLayer.push({ "type": eventType, "params": params });
  }

  // @public identify
  let identify = spotjs.identify = function (user2, skipEvent) {
    if (typeof user2 !== "object") {
      log("spotjs.identify error - user object is required", user2);
      return false;
    }
    user2.subtype = user2.subtype || "identify";
    user2.dt = user2.dt || user.dt;
    user2.dtAttr = user2.dtAttr || user.dtAttr;
    user2.dnt = user2.dnt ? 1 : 0;
    setUser(user2);
    if (!skipEvent) {
      let params = { subtype: 'identify' };
      Object.assign(params, spotjs.user);
      spotjs.dataLayer.push({ "type": "identify", "params": params });
    }
  }

  // @public signin
  let signIn = spotjs.signin = function (user2, skipEvent) {
    if (typeof user2 !== "object") {
      log("spotjs.signin existing - user object is required");
      return;
    }
    user2.subtype = user2.subtype || "signin";
    spotjs.identify(user2, skipEvent);
  }
  
  // @public Signout
  let signOut = spotjs.signout = function () {
    // clear user token
    user.ut = "";
    setCookie("ut", user.ut);
  }

  // @public setOptin
  let setOptin = spotjs.setOptin = function (optin) {
    user.optin = optin ? 1 : 0;
    setCookie("optin", user.optin);
    user.dnt = user.optin ? 0 : 1;
    setCookie("dnt", user.dnt);
    // TODO - decide if this should also clear spot_ut cookie
  }

  // Init Data Layer
  let initDataLayer = function () {
    if (!spotjs.dataLayer) {
      spotjs.dataLayer = window[config.dataLayerId] = window[config.dataLayerId] || [];
      spotjs.dataLayer.push = function(e) {
        Array.prototype.push.call(spotjs.dataLayer, e);
        processDataLayer();
      };
    }
  }

  // Process data layer array
  let processDataLayer = function () {
    log("spotjs.processDataLayer dataLayer =", JSON.stringify(spotjs.dataLayer));
    if (spotjs.dataLayer) {
      spotjs.pendingEvents = [];
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        if (typeof data !== "object" || !data) {
          log("spotjs.processDataLayer skipping non-object item", data)
          continue;
        }
        if (data.config && typeof data.config === "object") {
          setConfig(data.config);
        }
        let configError = validateConfig();
        if (configError) {
          log("spotjs.processDataLayer exiting due to config error:", configError, config);
          spotjs.pendingEvents.push(data);
          continue;
        }
        processEvent(data);
      }
    }
  }

  // @public setConfig
  let setConfig = spotjs.setConfig = function (config2) {
    if (typeof config2 !== "object") {
      log("spotjs.setConfig error - config object is required");
    }
    Object.assign(config, config2);
    log("spotjs.setConfig config =", config);
    // Process pending events
    while (spotjs.pendingEvents.length) {
      spotjs.dataLayer.push(spotjs.pendingEvents.shift());
    }
  }

  // Validate the current config
  let validateConfig = function () {
    if (!config.apiHost) {
      return "error: apiHost is required";
    }
    else if (!config.apiAuth) {
      return "error: apiAuth is required";
    }
    return false; // no errors = valid
  }

  // Handle any special event type
  let preprocessEvent = function (data) {
    let send = true;
    if (user.dnt === 1) {
      // do not track - do not send events
      send = false;
    }
    switch (data.type) {
      case "identify":
        identify(data.params, true);
        break;
      case "signin":
        signIn(data.params, true);
        send = true;
        break;
      case "signout":
        signOut();
        break;
      case "optin":
        setOptin(true);
        send = true;
        break;
      case "optout":
        setOptin(false);
        break;
      default:
        break;
    }
    return send;
  }

  // Process a business event, such as a page visit, add to cart, etc.
  let processEvent = function (data) {
    let send = preprocessEvent(data);
    processUser(data);
    if (!send) {
      log("spotjs.processEvent exiting");
    }
    log("spotjs.processEvent data =", data);
    if (!data.type) {
      log("spotjs.processEvent error - data.type is required");
    }
    // Construct Event
    var evt = {
      "event": { "type": data.type, "iso_time": data.iso_time, "params_json": {} },
      "client": { "identifier": { "id": user.ut, "id_field": user.utAttr } },
      "campaign": data.campaign || config.defaultCampaign
    };
    if (!user.ut) { // anon
      evt.client.identifier.id = user.ut;
      evt.client.identifier.id_field = user.utAttr;
      evt.client.visitor = true;
    }
    if (!evt.event.iso_time) {
      let dateobj = new Date();
      evt.event.iso_time = dateobj.toISOString();
    }
    // Event JSON Params
    if (data.params && Object.keys(data.params).length) {
      evt.event.params_json = data.params;
      if (data.params.subtype) {
        evt.event.subtype = data.params.subtype;
      }
    }
    // Update attributes
    let update_attributes = data.update_attributes || {};
    Object.apply(update_attributes, user.update_attributes);
    if (evt.client.visitor) {
      update_attributes.visitor = true;
    }
    if (Object.keys(update_attributes).length) {
      evt.callback = { "update_attributes": update_attributes };
    }

    log("spotjs.processEvent", evt.event.type, "/", evt.event.subtype, " evt=", evt);
    sendEvent(evt);
  }

  let sendEvent = function (evt) {
    log("spotjs.sendEvent evt =", evt);
    if (config.useNavigatorBeacon && navigator.sendBeacon) {
      let blob = new Blob(JSON.stringify(evt), { "type": "application/json" });
      navigator.sendBeacon(config.apiHost + config.apiEndpoint, blob);
    }
    else {
      let evtId = "event-"+spotjs.sentEvents.length;
      spotjs.sentEvents[evtId] = { "evt": evt, "readyState": null };
      let xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.addEventListener("readystatechange", function() {
        spotjs.sentEvents[evtId].readyState = this.readyState;
        if(this.readyState === 4) {
          log("spotjs.sendEvent evtId =", evtId, " response =", this.responseText, " evt=", spotjs.sentEvents[evtId]);
        }
      });
      xhr.open("POST", config.apiHost+config.apiEndpoint, true);
      xhr.setRequestHeader("Content-Type", config.apiContentType);
      xhr.setRequestHeader("Authorization", config.apiAuth);
      xhr.send(JSON.stringify(evt));
    }
  }


  // Load the user from querystring or inline variable
  let detectUser = function () {
    let user2 = null;
    if (typeof window[config.userParam] !== "undefined") {
      user2 = window[config.userParam];
      log("spotjs.detectUser window.user2 = ", user2);
    }
    if (!user2) {
      let param = getParam(config.userParam);
      if (param) {
        if (param.indexOf("{") !== 0) {
          param = atob(param);
        }
        user2 = JSON.parse(param);
        log("spotjs.detectUser ?"+config.userParam+" = ", user2);
      }
    }
    if (user2) {
      log("spotjs.detectUser identity user2 = ", user2);
      identify(user2);
    }
  }

  // setUser
  let setUser = function (user2) {
    if (typeof user2 !== "object") {
      log("spotjs.setUser error - user object is required", user2);
      return false;
    }
    log("spotjs.setUser user2 =", JSON.stringify(user2));
    Object.assign(spotjs.user, user2);
    processUser(spotjs.user);
    return true;
  }

  let processUser = function (data) {
    getUserCookie("dt", "{uuidv4}", data);
    getUserCookie("ut", "", data);
    getUserCookie("dnt", null, data);
    getUserCookie("dtAttr", config.dtAttr, data);
    getUserCookie("utAttr", config.utAttr, data);
  }

  let getUserCookie = function (key, defaultVal, data) {
    let cookieName = config.cookiePrefix+key,
        cookieVal = getCookie(cookieName);
    if (user[key] === undefined || user[key] === null) {
      if (typeof data === "object" && data[key] !== undefined) {
        user[key] = data[key];
      }
      else if (cookieVal) {
        user[key] = cookieVal;
      }
      if (!user[key] && defaultVal) {
        if (defaultVal === "{uuidv4}") {
          user[key] = uuidv4();
        }
        else {
          user[key] = defaultVal;
        }
      }
    }
    let cookieVal2 = user[key];
    // Save the value as a cookie, but only if necessary
    if (cookieVal2 !== undefined && cookieVal2 !== cookieVal && (cookieVal2 !== defaultVal && cookieVal === null)) {
      setCookie(cookieName, cookieVal2);
    }
  }

  let getCookie = function (name) {
    var v = document.cookie.match('(^|;) ?'+name+'=([^;]*)(;|$)');
    return v ? v[2] : null;
  }

  let setCookie = function (name, value) {
    let c = name+'='+value;
    c += '; SameSite=None';
    c += '; Secure=true';
    c += '; Max-Age='+config.cookieMaxAge;
    c += "; Path=/";
    document.cookie = c;
    log("spotjs.setCookie c=", c);
  }

  function getParam(name, url) {
    if (!url) { url = window.location.href; }
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  let uuidv4 = function () {
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Init the array of events to process
  initDataLayer();
  // Detect user state prior to processing any events
  detectUser();
  // Finally, process any existing events
  processDataLayer();

  log(spotjs.name, "created");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
