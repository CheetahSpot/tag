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
    knownEventParams: {
      "subtype": "event_subtype",
      "source": "event_source",
      "url": "click_link_url",
      "click_link_url": "click_link_url",
      "click_link_name": "click_link_name",
      "click_link_tags": "click_link_tags",
      "referrer": "web_event_url_referrer",
      "user_agent": "user_agent_raw" },
    autoEvents: [ { type:"web", params: { subtype: "visit", url: "{href}", referrer: "{referrer}"} ],
    debug: 1 // set debug=2 for trace
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
  let logTrace = config.debug > 1 ? console.log.bind(window.console) : function(){};
  let logError = console.log.bind(window.console);

  // @public track
  // Helper function to push an event to the data layer
  let track = spotjs.track = function (eventType, params) {
    spotjs.dataLayer.push({ "type": eventType, "params": params });
  }

  // @public identify
  let identify = spotjs.identify = function (user2, skipEvent) {
    if (typeof user2 !== "object") {
      logError("spotjs.identify error - user object is required", user2);
      return false;
    }
    setUser(user2);
    if (!skipEvent) {
      spotjs.dataLayer.push({ "type": "identify", "params": spotjs.user });
    }
  }

  // @public signin
  let signIn = spotjs.signin = function (user2, skipEvent) {
    identify(user2, skipEvent);
    // Loyalty signin counts as optin
    setOptin(1);
  }
  
  // @public Signout
  let signOut = spotjs.signout = function () {
    // clear user token
    user.ut = "";
    user.utAttr = config.utAttr;
    setCookie("ut", user.ut);
    setCookie("utAttr", user.utAttr);
  }

  // @public setOptin
  let setOptin = spotjs.setOptin = function (optin) {
    user.optin = optin === 0 ? 0 : 1;
    user.dnt = user.optin === 0 ? 1 : 0;
    setCookie("dnt", user.dnt);
  }

  // Init Data Layer
  let initDataLayer = function () {
    if (!spotjs.dataLayer) {
      spotjs.dataLayer = window[config.dataLayerId] = window[config.dataLayerId] || [];
      if (config.autoEvents !== undefined) {
        spotjs.dataLayer.concat(config.autoEvents);
      }
      spotjs.dataLayer.push = function(e) {
        Array.prototype.push.call(spotjs.dataLayer, e);
        processDataLayer();
      };
    }
  }

  // Process data layer array
  let processDataLayer = function () {
    logTrace("spotjs.processDataLayer dataLayer =", JSON.stringify(spotjs.dataLayer));
    if (spotjs.dataLayer) {
      spotjs.pendingEvents = [];
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        if (typeof data !== "object" || !data) {
          logTrace("spotjs.processDataLayer skipping non-object item", data)
          continue;
        }
        if (data.config && typeof data.config === "object") {
          setConfig(data.config);
        }
        let configError = validateConfig();
        if (configError) {
          logError("spotjs.processDataLayer exiting due to config error:", configError, config);
          spotjs.pendingEvents.push(data);
          continue;
        }
        if (data.type) {
          processEvent(data);
        }
      }
    }
  }

  // @public setConfig
  let setConfig = spotjs.setConfig = function (config2) {
    if (typeof config2 !== "object") {
      logError("spotjs.setConfig error - config object is required");
    }
    Object.assign(config, config2);
    logTrace("spotjs.setConfig config =", config);
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
    if (!data.type) {
      return;
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
        setOptin(1);
        send = true;
        break;
      case "optout":
        setOptin(0);
        break;
      default:
        break;
    }
    return send;
  }

  let formatEventParam = function (key, val) {
    switch (val) {
      case "{href}":
        return document.location.href;
        break;
      case "{referrer}":
        return document.referrer;
        break;
      default:
        return val;
    }
  }

  // Process a business event, such as a page visit, add to cart, etc.
  let processEvent = function (data) {
    if (!data.type) {
      return;
    }
    let send = preprocessEvent(data);
    processUser(data);
    if (!send) {
      log("spotjs.processEvent - do not track");
      return;
    }
    logTrace("spotjs.processEvent data =", data);
    // Construct Event
    var evt = {
      "event": { "type": data.type, "iso_time": data.iso_time, "params_json": {} },
      "client": { "identifier": { "id": user.ut, "id_field": user.utAttr, "device_token": user.dt } },
      "campaign": data.campaign || config.defaultCampaign
    };
    if (!evt.event.iso_time) {
      let dateobj = new Date();
      evt.event.iso_time = dateobj.toISOString();
    }
    // Copy known params to top-level Object, and submit others as params_json
    if (typeof data.params === "object") {
      let params_json = {};
      for (const key of Object.keys(data.params)) {
        let val = formatEventParam(evt.event, key, data.params[key]);
        if (config.knownEventParams[key] !== undefined) {
          evt.event[key] = val;
        }
        else {
          // send unknown event params in params_json
          params_json[key] = val;
          evt.event.params_json = params_json;
        }
      }
    }
    // Update attributes
    let update_attributes = data.update_attributes || {};
    Object.apply(update_attributes, user.update_attributes);
    // Anonymous
    if (!evt.client.identifier.id) {
      evt.client.identifier.id = user.dt;
      evt.client.identifier.id_field = user.dtAttr;
      update_attributes.visitor = true;
    }
    if (Object.keys(update_attributes).length) {
      evt.callback = { "update_attributes": update_attributes };
    }

    logTrace("spotjs.processEvent", evt.event.type, "/", evt.event.subtype, " evt=", evt);
    sendEvent(evt);
  }

  let sendEvent = function (evt) {
    logTrace("spotjs.sendEvent evt =", evt);
    if (config.useNavigatorBeacon && navigator.sendBeacon) {
      let blob = new Blob(JSON.stringify(evt), { "type": "application/json" });
      navigator.sendBeacon(config.apiHost + config.apiEndpoint, blob);
    }
    else {
      let evtId = "event-"+spotjs.sentEvents.length;
      let xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open("POST", config.apiHost+config.apiEndpoint, true);
      xhr.setRequestHeader("Content-Type", config.apiContentType);
      xhr.setRequestHeader("Authorization", config.apiAuth);
      xhr.addEventListener("readystatechange", function() {
        spotjs.sentEvents[evtId].readyState = this.readyState;
        if(this.readyState === 4) {
          log("spotjs", evtId, "received response =", this.responseText);
        }
      });
      let xhrBody = JSON.stringify(evt);
      spotjs.sentEvents[evtId] = { "evt": evt, "readyState": null, "xhr": xhr };
      log("spotjs", evtId, "sending request =", xhrBody);
      xhr.send(xhrBody);
    }
  }

  // Load the user from querystring or inline variable
  let detectUser = function () {
    let user2 = null;
    if (typeof window[config.userParam] !== "undefined") {
      user2 = window[config.userParam];
      logTrace("spotjs.detectUser window.user2 = ", user2);
    }
    if (!user2) {
      let param = getParam(config.userParam);
      if (param) {
        if (param.indexOf("{") !== 0) {
          param = atob(param);
        }
        user2 = JSON.parse(param);
        logTrace("spotjs.detectUser ?"+config.userParam+" = ", user2);
      }
    }
    if (user2) {
      if (user2.ut && !user2.utAttr) {
        // Assume user_token is the default attribute
        user2.utAttr = config.utAttr;
      }
      log("spotjs.detectUser identity user2 = ", user2);
      identify(user2);
    }
  }

  // setUser
  let setUser = function (user2) {
    if (typeof user2 !== "object") {
      logError("spotjs.setUser error - user object is required", user2);
      return false;
    }
    logTrace("spotjs.setUser user2 =", JSON.stringify(user2));
    Object.assign(spotjs.user, user2);
    processUser();
    return true;
  }

  let processUser = function (data) {
    data = data || {};
    getUserCookie("dt", "{uuidv4}", data);
    getUserCookie("ut", "", data);
    getUserCookie("dnt", null, data);
    getUserCookie("dtAttr", config.dtAttr, data);
    getUserCookie("utAttr", config.utAttr, data);
  }

  let getUserCookie = function (key, defaultVal, data) {
    let cookieVal = getCookie(key);
    if (user[key] === undefined || user[key] === null) {
      if (data[key] !== undefined) {
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
    if (cookieVal2 !== undefined && cookieVal2 !== cookieVal) { // && (cookieVal2 !== defaultVal && !cookieVal)) {
      setCookie(key, cookieVal2);
    }
  }

  let getCookie = function (name) {
    var v = document.cookie.match('(^|;) ?'+config.cookiePrefix+name+'=([^;]*)(;|$)');
    let v2 = v ? v[2] : null;
    return v2 === "null" ? null : v2;
  }

  let setCookie = function (name, value) {
    if (isPersonalInfo(value)) {
      logError("spotjs.setCookie exiting - value looks like personal info");
      return;
    }
    let c = config.cookiePrefix+name+'='+value;
    c += '; SameSite=None';
    c += '; Secure=true';
    c += '; Max-Age='+config.cookieMaxAge;
    c += "; Path=/";
    document.cookie = c;
    logTrace("spotjs.setCookie c=", c);
  }

  // Detect if a value looks like personal info
  let isPersonalInfo = function (val) {
    // look for possible email address
    return /^.+@.+\..+$/.test(val);
  }
 
  // get a querystring parameter by name
  let getParam = function (name, url) {
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

  log(spotjs.name, "ready");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
