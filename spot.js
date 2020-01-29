/**
 * Spot Web Tag
 */

function SpotJs () {
  let version = "0.0.7";

  //@public tag config
  let config = {
    apiAuth: null,
    apiHost: null,
    defaultCampaign: { "ext_parent_id": "1", "camp_id": "1" }, // TODO - verify we want to save these
    dtAttr: 'integration6_id', // TODO - update to device_token
    utAttr: 'integration5_id', // TODO - update to user_token
    cookieMaxAge: 60*60*24*365, // 1y
    apiEndpoint: '/edp/api/event',
    apiContentType: 'application/json',
    userParam: 'spot_user',
    dataLayerId: 'spot_data',
    cookiePrefix: 'spot_',
    dtCookieName: 'spot_dt',
    utCookieName: 'spot_ut',
    dntCookieName: 'spot_dnt',
    dtAttrCookieName: 'spot_da', 
    utAttrCookieName: 'spot_ua', 
    useNavigatorBeacon: false,
    debug: 1
  };

  // @public user object
  let user = { dt: null, ut: null, known: null, visitor: null, optin: null, dnt: null, update_attributes: {} };

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

  // @public signin
  let signIn = spotjs.signin = function (user2) {
    log("spotjs.signin", user2);
    if (typeof user2 !== "object") {
      log("spotjs.signin existing - user object is required");
      return;
    }
    user2.subtype = user2.subtype || "signin";
    spotjs.setUser(user2);
  }
  
  // @public Signout
  let signOut = spotjs.signout = function () {
    // clear user token
    user.ut = "";
    setCookie(config.utCookieName, user.ut, config);
  }

  // @public setOptin
  let setOptin = spotjs.setOptin = function (optin) {
    user.optin = optin ? true : false;
    setDnt(optin ? 0 : 1);
  }

  // @public setDnt
  let setDnt = spotjs.setDnt = function (dnt) {
    user.dnt = dnt;
    setCookie(config.dntCookieName, dnt, config);
  }

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
        if (data.user && typeof data.user === "object") {
          setUser(data.user);
        }
        let configError = validateConfig();
        if (configError) {
          log("spotjs.processDataLayer exiting due to config error:", configError, config);
          spotjs.pendingEvents.push(data);
          continue;
        }
        if (data.type) {
          switch (data.type) {
            case "signin":
              signIn(data.params);
              break;
            case "signout":
              signOut();
              break;
            case "optin":
              setOptin(true);
              break;
            case "optout":
              setOptin(false);
              break;
            case "dnt":
              setDnt(true);
              break;
            default:
              processEvent(data);
          }
        }
      }
    }
  }

  // @public setConfig
  let setConfig = spotjs.setConfig = function (config2) {
    if (typeof config2 !== "object") {
      log("spotjs.setConfig error - config object is required");
    }
    log("spotjs.setConfig config2 =", JSON.stringify(config2));
    Object.assign(config, config2);
    config.dtCookieName = config.cookiePrefix+'dt';
    config.utCookieName = config.cookiePrefix+'ut';
    config.dntCookieName = config.cookiePrefix+'dnt';
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
    if (data.params && data.params.subtype) {
      evt.event.subtype = data.params.subtype;
    }
    evt.client.identifier.id = user.known ? user.ut : user.dt;
    evt.client.identifier.id_field = user.known ? user.utAttr : user.dtAttr;
    if (Object.keys(data.params).length) {
      //evt.event.params = data.params;
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

    if (user.dnt === 1) {
      // do not track - do not send events
      log("dnt enabled, abort sending event");
      return;
    }
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
          log("spotjs.sendEvent evtId =", evtId, " response =", this.responseText, this);
        }
      });
      xhr.open("POST", config.apiHost+config.apiEndpoint, true);
      xhr.setRequestHeader("Content-Type", config.apiContentType);
      xhr.setRequestHeader("Authorization", config.apiAuth);
      xhr.send(JSON.stringify(evt));
    }
  }


  // Load the user from querystring or inline variable
  let loadUser = function () {
    if (typeof window[config.userParam] !== undefined) {
      setUser(window[config.userParam]);
    }
    else if (location.search.indexOf("spot_user") !== -1) {
      setUser(JSON.decode(getParam("spot_user", true)));
    }
  }

  // @public setUser
  let setUser = spotjs.setUser = function (user2) {
    if (typeof user2 !== "object") {
      log("spotjs.setUser error - user object is required");
    }
    log("spotjs.setUser user2 =", JSON.stringify(user2));
    Object.assign(spotjs.user, user2);
    processUser(spotjs.user);
    let params = Object.assign({ subtype: 'user' }, spotjs.user);
    spotjs.dataLayer.push({ "type": "identify", "params": params });
  }

  let processUser = function (data) {
    getUserCookie("dt", "{uuidv4}", data);
    getUserCookie("ut", "", data);
    getUserCookie("dnt", null, data);
    user.dtAttr = user.dtAttr || config.dtAttr;
    user.utAttr = user.utAttr || config.utAttr;
    getUserCookie("dtAttr", config.dtAttr, data);
    getUserCookie("utAttr", config.utAttr, data);
    if (user.ut) { // known
      user.known = true;
      user.visitor = null;
    }
    else { // anonymous
      user.known = false;
      user.visitor = true;
    }
  }

  let getUserCookie = function (key, defaultValue, data) {
    let cookieName = config[key+'CookieName'] || (config.cookiePrefix+key), 
        cookieVal = getCookie(cookieName);
    if (!user[key]) {
      if (typeof data === "object" && data[key] !== undefined) {
        user[key] = data[key];
      }
      else if (cookieVal) {
        user[key] = cookieVal;
      }
      if (!user[key] && defaultValue === "{uuidv4}") {
        user[key] = uuidv4();
      }
    }
    let cookieVal2 = user[key];
    if (cookieVal2 !== cookieVal) {
      setCookie(cookieName, cookieVal2, config);
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

  // Run init methods and return spotjs object
  initDataLayer();
  loadUser();

  log(spotjs.name, "created");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
