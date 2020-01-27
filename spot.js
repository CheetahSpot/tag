/**
 * Spot.js
 *
 *  Spot.js is a web tracker tag
 *
 *  Spot observes window.spot_data array
 *
 */

//
// Implementation
//
function SpotJs () {

  let config = {
    apiContentType: 'application/json',
    apiHost: null,
    apiEndpoint: '/edp/api/event',
    apiAuth: null,
    cookiePrefix: 'spot_',
    dtCookieName: 'spot_dt',
    utCookieName: 'spot_ut',
    dtAttribute: 'integration6_id', // TODO - update to device_token
    utAttribute: 'integration5_id', // TODO - update to user_token
    cookieMaxAge: 60*60*24*365,
    useNavigatorBeacon: false,
    dataLayerId: 'spot_data',
    defaultCampaign: { "ext_parent_id": "1", "camp_id": "1" },
    debug: 1
  };


  let user = { dt: null, ut: null, known: null, visitor: null, optIn: null, optOut: null, update_attributes: {} };

  let spotjs = {
    name: "spotjs 0.0.5 "+Math.random().toString(36).substring(7),
    config: config,
    user: user,
    dataLayer: null,
    sent: []
  };

  // log wrapper
  let log = spotjs.log = config.debug ? console.log.bind(window.console) : function(){};

  // Init Data Layer
  let initDataLayer = function () {
    if (!spotjs.dataLayer) {
      spotjs.dataLayer = window[config.dataLayerId] = window[config.dataLayerId] || [];
      spotjs.dataLayer.push = function(e) {
        Array.prototype.push.call(spotjs.dataLayer, e);
        processDataLayer();
      };
      processDataLayer();
    }
  }

  // Helper function to push an event to the data layer
  let track = function (eventType, params) {
    spot.dataLayer.push({ "type": eventType, "params": params });
  }

  // Helper function to push user info to the data layer
  let identify = function (user2) {
    if (typeof user2 !== "object") {
      log("spotjs.identify existing - user object is required");
      return;
    }
    user2.subtype = "identify";
    Object.assign(user, user2);
    spot.dataLayer.push({ "type": "identify", "params": user2 });
  }

  // Signin/signout known user
  let signin = function (user2) {
    if (typeof user2 === "object") {
      log("spotjs.signin existing - user object is required");
      return;
    }
    user2.subtype = "signin";
    Object.assign(user, user2);
    spot.dataLayer.push({ "type": "identify", "params": user2 });
    optIn(); // signin is implict optin
  }
  let signout = function () {
    if (user.ut !== "OPTOUT") {
      setCookie(config.utCookieName, "", config);
    }
  }

  // Allow user to opt/out of tracking
  let optIn = function () {
    user.optIn = true;
    user.optOut = false;
    if (user.dt === "OPTOUT") {
      setCookie(config.dtCookieName, "", config);
    }
    if (user.ut === "OPTOUT") {
      setCookie(config.utCookieName, "", config);
    }
  }
  let optOut = function () {
    user.optIn = false;
    user.optOut = true;
    setCookie(config.dtCookieName, "OPTOUT", config);
    setCookie(config.utCookieName, "OPTOUT", config);
  }

  let processDataLayer = function () {
    log("spotjs.processDataLayer dataLayer =", JSON.stringify(spotjs.dataLayer))
    if (spotjs.dataLayer) {
      let deferredData = [];
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        if (typeof data !== "object" || !data) {
          log("spotjs.processDataLayer skipping non-object item", data)
          continue;
        }
        if (data.config && typeof data.config === "object") {
          applyConfig(data.config);
        }
        let configError = validateConfig();
        if (configError) {
          log("spot.processDataLayer exiting due to config error:", configError, config);
          deferredData.push(data);
          continue;
        }
        if (data.type) {
          processEvent(data);
        }
      }
      // Put deferred items back on the queue
      while (deferredData.length) {
        spotjs.dataLayer.push(deferredData.shift());
      }
    }
  }

  // Allow the tag to provide config, such as API details.
  let applyConfig = function (config2) {
    if (typeof config2 === "object") {
      log("spotjs.applyConfig config2 =", JSON.stringify(config2));
      Object.assign(config, config2);
      config.dtCookieName = config.cookiePrefix+'dt';
      config.utCookieName = config.cookiePrefix+'ut';
      log("spotjs.applyConfig config =", config);
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

  // Process a business event, such as a page visit, add to cart, etc.
  let processEvent = function (data) {
    log("spotjs.processEvent data =", data);
    if (!data.type) {
      log("spotjs.processEvent error - data.type is required");
    }
    processUser(data);
    if (!data.iso_time) {
      let dateobj = new Date();
      data.iso_time = dateobj.toISOString();
    }
    var evt = {
      "event": { "type": data.type, "iso_time": data.iso_time },
      "client": { "identifier": { "id": "", "id_field": "" } },
      "campaign": data.campaign || config.defaultCampaign
    };
    if (data.params.subtype) {
      evt.event.subtype = data.params.subtype;
    }
    evt.client.identifier.id = user.known ? user.ut : user.dt;
    evt.client.identifier.id_field = user.known ? config.dtAttribute : config.utAttribute;
    if (Object.keys(data.params).length) {
      evt.event.params_json = data.params;
    }
    data.update_attributes = data.update_attributes || {};
    Object.apply(data.update_attributes, user.update_attributes);
    if (data.update_attributes.visitor === undefined && user.visitor !== null) {
      data.update_attributes.visitor = user.visitor;
    }
    if (Object.keys(data.update_attributes).length) {
      evt.callback = { "update_attributes": data.update_attributes };
    }
    log("spotjs.processEvent type =", evt.event.type, " subtype =", evt.event.subtype, " evt =", evt);
    sendEvent(evt);
  }

  let sendEvent = function (evt) {
    let evtId = spotjs.sent.length+1;
    let data = JSON.stringify(evt);
    log("spotjs.sendEvent evt =", evt);
    spotjs.sent[evtId] = { "status": "sent", "evt": evt };
    if (config.useNavigatorBeacon && navigator.sendBeacon) {
      let blob = new Blob(data, { "type": "application/json" });
      navigator.sendBeacon(config.apiHost + config.apiEndpoint, blob);
      spotjs.sent[evtId].status = "done";
    }
    else {
      let xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.addEventListener("readystatechange", function() {
        if(this.readyState === 4) {
          //log(this.responseText, this);
        }
      });
      xhr.open("POST", config.apiHost+config.apiEndpoint, true);
      xhr.setRequestHeader("Content-Type", config.apiContentType);
      xhr.setRequestHeader("Authorization", config.apiAuth);
      // TODO - update sent status in async callbacks
      //spotjs.sent[evtId].status = "done";
      xhr.send(data);
    }
  }

  let processUser = function (data) {
    getTokenCookie("dt", true, data);
    getTokenCookie("ut", false, data);
    if (user.ut) { // known
      user.known = true;
      user.visitor = null;
      if (user.ut === "OPTOUT") {
        user.optOut = true;
      }
    }
    else { // anonymous
      user.known = false;
      user.visitor = true;
      if (user.dt === "OPTOUT") {
        user.optOut = true;
      }
    }
  }


  // Utils
  let getTokenCookie = function (token, generate, data) {
    let cookieName = config[token+'CookieName'], 
        cookieVal = getCookie(cookieName);
    if (!user[token]) {
      if (typeof data === "object" && data[token]) {
        user[token] = data[token];
      }
      else if (cookieVal) {
        user[token] = cookieVal;
      }
      if (!user[token] && generate) {
        // generate token
        user[token] = uuidv4();
      }
    }
    if (user[token] !== cookieVal) {
      setCookie(cookieName, user[token], config);
    }
  }

  let getCookie = function (name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
  }

  let setCookie = function (name, value, options) {
    let c = name+'='+value;
    c += '; SameSite=None';
    c += '; Secure=true';
    c += '; Max-Age='+config.cookieMaxAge;
    c += "; Path=/";
    document.cookie = c;
    log("spotjs.setCookie c=", c);
  }

  let uuidv4 = function () {
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Interface methods
  spotjs.applyConfig = applyConfig;
  spotjs.identify = identify;
  spotjs.track = track;

  // Run init methods and return spotjs object
  initDataLayer();

  log(spotjs.name, "created");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
