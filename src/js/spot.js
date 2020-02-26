/**
 * Spot CD Tag
 */

function SpotJs () {

    const version = "0.1.4",

        // @public tag config
        config = {
            "apiAuth": null,
            "apiHost": null,
            "defaultCampaign": {"camp_id": "0",
                "ext_parent_id": "0"},
            "eventType": "tag",
            "eventSource": "cd-tag",
            "dta": "device_token",
            "uta": "user_token",
            "sta": "session_token",
            "apiEndpoint": "/edp/api/event",
            "apiContentType": "application/json",
            "dataLayerId": "spot_data",
            "cookiePrefix": "spot_",
            "sessionLength": 60 * 30, // default 30 min
            "cookieMaxAge": 60 * 60 * 24 * 60, // default 2 months
            "logLevel": 2, // 0:none, 1:error, 2:info, 3:trace
            "tagParams": {"spot_user": "spot_user",
                "spot_ut": "spot_ut",
                "spot_uta": "spot_uta",
                "spot_camp_id": "spot_camp_id"},
            "eventParamKeys": { },
            "useNavigatorBeacon": false // not supported in IE
        }

    // Spot Config can be overridden with a javascript variable on the page.
    if (window.spot_config) {

        Object.assign(
            config,
            spot_config
        )

    }

    // @public user object
    const user = {"dt": null,
            "ut": null,
            "st": null,
            "uta": config.uta,
            "optin": null,
            "dnt": null,
            "update_attributes": {}},

        // @public return object
        spotjs = {
            "name": `spotjs ${version}`,
            config,
            user,
            "dataLayer": null,
            "sentEvents": [],
            "pendingEvents": []
        },

        // logger
        emptyFn = function () {},
        log = config.logLevel ? console.log.bind(window.console) : emptyFn,
        logError = config.logLevel >= 1 ? log : emptyFn,
        logInfo = config.logLevel >= 2 ? log : emptyFn,
        logTrace = config.logLevel >= 3 ? log : emptyFn,

        /*
         * @public push
         * Helper function to push an event to the data layer
         */
        push = spotjs.push = function (eventType, params) {

            spotjs.dataLayer.push({"event": eventType,
                params})

        },

        // @public identify
        identify = spotjs.identify = function (user2) {

            setUser(user2)

        },

        // @public signin - identify plus optin
        signIn = spotjs.signin = function (user2) {

            setUser(user2)
            setOptin(1)

        },

        // @private setuser - setter with validation
        setUser = function (user2) {

            if (typeof user2 !== "object") {

                logError(
                    "spotjs.setUser error - user object is required",
                    user2
                )
                return false

            }
            if (isPersonal(
                user2.ut,
                user2.ut
            )) {

                user2.ut = "redacted"
                logError(
                    "spotjs.setUser error - email is not allowed as an identifier",
                    user2
                )
                return false

            }
            logTrace(
                "spotjs.setUser user2 =",
                JSON.stringify(user2)
            )
            Object.assign(
                spotjs.user,
                user2
            )
            return true

        },

        // @public Signout
        signOut = spotjs.signout = function () {

            // clear user token
            user.ut = ""
            user.uta = config.uta
            setCookie(
                "ut",
                "redacted"
            )
            setCookie(
                "uta",
                user.uta
            )

        },

        // @public setOptin
        setOptin = spotjs.setOptin = function (optin) {

            user.optin = optin === 0 ? 0 : 1
            user.dnt = user.optin === 0 ? 1 : 0
            setCookie(
                "dnt",
                user.dnt
            )

        },

        // Init Data Layer
        initDataLayer = function () {

            if (!spotjs.dataLayer) {

                spotjs.dataLayer = window[config.dataLayerId] = window[config.dataLayerId] || []
                while (spotjs.pendingEvents.length) {

                    spotjs.dataLayer.push(spotjs.pendingEvents.shift())

                }
                spotjs.dataLayer.pushSilent = function (e) {

                    Array.prototype.push.call(
                        spotjs.dataLayer,
                        e
                    )

                }
                spotjs.dataLayer.push = function (e) {

                    Array.prototype.push.call(
                        spotjs.dataLayer,
                        e
                    )
                    processDataLayer()

                }

            }

        },

        // Process data layer array
        processDataLayer = function () {

            logTrace(
                "spotjs.processDataLayer dataLayer =",
                JSON.stringify(spotjs.dataLayer)
            )
            if (spotjs.dataLayer) {

                while (spotjs.dataLayer.length) {

                    const data = spotjs.dataLayer.shift()
                    if (typeof data !== "object" || !data) {

                        logTrace(
                            "spotjs.processDataLayer skipping non-object item",
                            data
                        )
                        continue

                    }
                    if (data.config && typeof data.config === "object") {

                        setConfig(data.config)

                    }
                    const configError = validateConfig()
                    if (configError) {

                        logError(
                            "spotjs.processDataLayer exiting due to config error:",
                            configError,
                            config
                        )
                        spotjs.pendingEvents.push(data)
                        continue

                    }
                    if (data.before && typeof window[data.before] === "function") {

                        const proceed = window[data.before](data)
                        if (!proceed) {

                            if (data.cancel && typeof window[data.cancel] === "function") {

                                window[data.cancel](data)
                                continue

                            }

                        }

                    }
                    if (data.event) {

                        processEvent(data)

                    }
                    if (data.after && typeof window[data.after] === "function") {

                        window[data.after](data)

                    }

                }

            }

        },

        // @public setConfig
        setConfig = spotjs.setConfig = function (config2) {

            if (typeof config2 !== "object") {

                logError("spotjs.setConfig error - config object is required")

            }
            Object.assign(
                config,
                config2
            )
            logTrace(
                "spotjs.setConfig config =",
                config
            )
            // Process pending events
            while (spotjs.pendingEvents.length) {

                spotjs.dataLayer.push(spotjs.pendingEvents.shift())

            }

        },

        // Validate the current config
        validateConfig = function () {

            if (!config.apiHost) {

                return "error: apiHost is required"

            } else if (!config.apiAuth) {

                return "error: apiAuth is required"

            }
            return false // no errors = valid

        },

        // Handle any special event
        preprocessEvent = function (data) {

            let send = true
            if (user.dnt === 1) {

                // do not send events
                send = false

            }
            if (!data.event) {

                return

            }
            switch (data.event) {

            case "identify":
                identify(data.params)
                break
            case "signin":
                signIn(data.params)
                send = true
                break
            case "signout":
                signOut()
                break
            case "optin":
                setOptin(1)
                send = true
                break
            case "optout":
                setOptin(0)
                break
            default:
                break

            }
            return send

        },

        formatEventParam = function (eventType, key, val) {

            switch (val) {

            case "{url}": return document.location.href
            case "{referrer}": return document.location.href
            case "{useragent}": return navigator.userAgent
            default: return val

            }

        },

        // Process a business event, such as a page visit, add to cart, etc.
        processEvent = function (data) {

            data = data || {}
            if (!data.event) {

                return

            }
            const send = preprocessEvent(data)
            processCampaign(data)
            processCookies(data)
            if (!send) {

                logInfo("spotjs.processEvent - dnt")
                return

            }
            if (typeof data.params !== "object") {

                data.params = {}

            }
            logTrace(
                "spotjs.processEvent data =",
                data
            )
            // Construct Event
            const evt = {
                "event": {"type": config.eventType,
                    "sub_type": data.event,
                    "iso_time": data.iso_time},
                "campaign": data.campaign,
                "client": {"identifier": {"id": user.ut,
                    "id_field": user.uta},
                "user_agent": `user_agent_raw : ${navigator.userAgent}`},
                "source": spotjs.eventSource
            }
            try {

                evt.client.event.local_tz = Intl.DateTimeFormat().resolvedOptions().timeZone

            } catch (e) { }
            evt.client.identifier[config.dta] = user.dt // TODO - finalize location in api signature
            evt.client.identifier[config.sta] = user.st // TODO - finalize location in api signature
            /*
             * evt.event.web_event_url_referrer = data.params.referrer || document.referrer;
             * evt.link = { "url": data.params.url || document.location.href };
             */
            if (!evt.event.iso_time) {

                const dateobj = new Date()
                evt.event.iso_time = dateobj.toISOString()

            }
            // Copy known params to top-level Object, and submit others as params_json
            const params_json = {}
            for (const key of Object.keys(data.params)) {

                const val = formatEventParam(
                    evt.event,
                    key,
                    data.params[key]
                )
                if (config.eventParamKeys[key] !== undefined) {

                    evt.event[config.eventParamKeys[key]] = val

                } else {

                    // send unknown event params in params_json
                    params_json[key] = val
                    evt.params_json = params_json

                }

            }
            // Update attributes
            const update_attributes = data.update_attributes || {}
            Object.apply(
                update_attributes,
                user.update_attributes
            )
            // Anonymous
            if (!evt.client.identifier.id || isPersonal(
                evt.client.identifier.id_field,
                evt.client.identifier.id
            )) {

                evt.client.identifier.id = user.dt
                evt.client.identifier.id_field = config.dta
                update_attributes.visitor = true

            }
            if (Object.keys(update_attributes).length) {

                evt.callback = {update_attributes}

            }

            logTrace(
                "spotjs.processEvent",
                evt.event.event,
                "/",
                evt.event.sub_type,
                " evt=",
                evt
            )
            sendEvent(evt)

        },

        sendEvent = function (evt) {

            logTrace(
                "spotjs.sendEvent evt =",
                evt
            )
            if (config.useNavigatorBeacon && navigator.sendBeacon) {

                const blob = new Blob(
                    JSON.stringify(evt),
                    {"type": "application/json"}
                )
                navigator.sendBeacon(
                    config.apiHost + config.apiEndpoint,
                    blob
                )

            } else {

                const xhr = new XMLHttpRequest(),
                    evtId = `${evt.event.event}-event-${spotjs.sentEvents.length}`,
                    sentEvent = {"id": evtId,
                        evt,
                        xhr}
                spotjs.sentEvents.push(sentEvent)
                xhr.open(
                    "POST",
                    config.apiHost + config.apiEndpoint,
                    true
                )
                xhr.setRequestHeader(
                    "Content-Type",
                    config.apiContentType
                )
                xhr.setRequestHeader(
                    "Authorization",
                    config.apiAuth
                )
                xhr.addEventListener(
                    "readystatechange",
                    function () {

                        if (this.readyState === 4) {

                            logInfo(
                                "spotjs",
                                evtId,
                                "completed =",
                                this.responseText
                            )

                        }

                    }
                )
                const xhrBody = JSON.stringify(evt)
                logInfo(
                    "spotjs",
                    evtId,
                    "sending =",
                    xhrBody
                )
                xhr.send(xhrBody)

            }

        },

        // Load the user from querystring or inline variable
        detectUser = function () {

            let user2 = null
            if (typeof window[config.tagParams.spot_user] !== "undefined") {

                user2 = window[config.tagParams.spot_user]
                logTrace(
                    "spotjs spot_user variable = ",
                    user2
                )

            }
            if (!user2) {

                let param = getParam(config.tagParams.spot_user)
                if (param) {

                    if (param.indexOf("{") !== 0) {

                        param = atob(param)

                    }
                    user2 = JSON.parse(param)
                    logTrace(
                        `spotjs ?spot_user=${config.tagParams.spot_user} = `,
                        user2
                    )

                }

            }
            if (!user2) {

                const param = getParam(config.tagParams.spot_ut)
                if (param) {

                    user2 = {"ut": param,
                        "uta": getParam(config.tagParams.spot_uta)}
                    logTrace(
                        "spotjs ?spot_ut = ",
                        user2
                    )

                }

            }
            if (user2) {

                if (user2.ut && !user2.uta) {

                    // Assume user_token is the default attribute
                    user2.uta = config.uta

                }
                logInfo(
                    "spotjs.detectUser identity user2 = ",
                    user2
                )
                setUser(user2)
                spotjs.pendingEvents.push({"event": "identify",
                    "params": user2})

            }

        },

        processCampaign = function (data) {

            data.campaign = data.campaign || config.defaultCampaign
            if (data.campaign.camp_id === config.defaultCampaign.camp_id) {

                const param = getParam(config.tagParams.spot_camp_id)
                if (param) {

                    data.campaign.camp_id = param

                }

            }
            // user.campaign = JSON.stringify(data.campaign);

        },

        processCookies = function (data) {

            getUserCookie(
                "dt",
                "{uuidv4}",
                data
            )
            getUserCookie(
                "ut",
                "",
                data
            )
            getUserCookie(
                "uta",
                config.uta,
                data
            )
            getUserCookie(
                "st",
                "{uuidv4}",
                data,
                {"cookieMaxAge": config.sessionLength}
            )
            // getUserCookie("campaign", "", data, { cookieMaxAge: config.sessionLength });
            getUserCookie(
                "dnt",
                null,
                data
            )

        },

        getUserCookie = function (key, defaultVal, data, options) {

            const cookieVal = getCookie(key)
            if (user[key] === undefined || user[key] === null) {

                if (data[key] !== undefined) {

                    user[key] = data[key]

                } else if (cookieVal) {

                    user[key] = cookieVal

                }
                if (!user[key] && defaultVal) {

                    if (defaultVal === "{uuidv4}") {

                        user[key] = uuidv4()

                    } else {

                        user[key] = defaultVal

                    }

                }

            }
            const cookieVal2 = user[key]
            // Save the value as a cookie, but only if necessary
            if (cookieVal2 !== undefined && cookieVal2 !== cookieVal) { // && (cookieVal2 !== defaultVal && !cookieVal)) {

                setCookie(
                    key,
                    cookieVal2,
                    options
                )

            }

        },

        getCookie = function (name) {

            const v = document.cookie.match(`(^|;) ?${config.cookiePrefix}${name}=([^;]*)(;|$)`),
                v2 = v ? v[2] : null
            if (v2 === "null" || v2 === "redacted") {

                v2 = null

            }
            return v2

        },

        setCookie = function (name, value, options) {

            options = options || config
            if (isPersonal(
                name,
                value
            )) {

                value = "redacted"

            }
            let c = `${config.cookiePrefix + name}=${value}`
            c += "; SameSite=None"
            c += "; Secure=true"
            c += `; Max-Age=${options.cookieMaxAge}`
            c += "; Path=/"
            document.cookie = c
            logTrace(
                "spotjs.setCookie c=",
                c
            )

        },

        // Detect if a value looks like personal info
        isPersonal = function (name, val) {

            // look for possible email address
            return name === "email" || (/^.+@.+\..+$/).test(val)

        },

        // get a querystring parameter by name
        getParam = function (name, url) {

            if (!url) {

                url = window.location.href

            }
            name = name.replace(
                /[\[\]]/g,
                "\\$&"
            )
            const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
                results = regex.exec(url)
            if (!results) {

                return null

            }
            if (!results[2]) {

                return ""

            }
            return decodeURIComponent(results[2].replace(
                /\+/g,
                " "
            ))

        },

        uuidv4 = function () {

            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                /[xy]/g,
                (c) => {

                    const r = Math.random() * 16 | 0,
                        v = c == "x" ? r : r & 0x3 | 0x8
                    return v.toString(16)

                }
            )

        }

    // Detect user state prior to processing any events
    detectUser()
    // Init the array of events to process
    initDataLayer()
    // Finally, process any existing events
    processDataLayer()

    spotjs.instance = uuidv4()
    logInfo(
        spotjs.name,
        "ready",
        spotjs.instance
    )
    return spotjs

}

if (!window.spotjs) {

    window.spotjs = SpotJs()

}