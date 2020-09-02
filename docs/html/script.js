var preventHashChange = false; // Manage hashchange/popstate hell
var sessionUser = null;
var startNotebook = null;

function handleState(name, keepDest) {
    var pushData = {
        "name" : name
    };
    var url = "#" + name;
    var dest = getParameterByName("dest");
    if (keepDest && dest && dest != name) {
        url += "?dest=" + dest;
    }
    window.history.pushState(pushData, "", url);
}

function loadPage(name, pushState, keepDest, keepMsg) {
    if (name === "") {
        name = "home";
    }
    if (!keepMsg) {
        flashReset();
    }
    var neutralPage = $.inArray(name, ["termsofuse", "dsaas", "home"]) > -1;
    var unauthPage = $.inArray(name, ["signin", "signup", "request_pwd_reset",
                                      "pwd_reset"]) > -1;
    if (neutralPage) {
    }
    else if (sessionUser && unauthPage) {
        // auth user trying to reach non signed in page
        name = "main";
        window.history.replaceState({"name" : name}, "", "#" + name);
    }
    else if (!sessionUser && !unauthPage) {
        // non user trying to reach auth user page
        var targettedName = name;
        name = "signin";
        window.history.replaceState({"name" : name}, "",
                                    "#" + name + "?dest=" + targettedName);
    }

    if (pushState !== false) {
        handleState(name, keepDest !== false);
    }
    var url = "/html/pages/";
    var idx = name.indexOf('?');
    if (idx > -1) {
        url += name.substr(0, idx) + '.html' + name.substr(idx);
    }
    else {
        url += name + '.html?';
    }
    url += "_t" + Date.now();
    $.get(url, function(uncompiledWidget) {
        $("#main").html(uncompiledWidget);
        initI18n();
    }).error(function (jqXhr, textStatus, errorThrown) {
        flashError("Failed to load page. Status: " + jqXhr.status);
    });
    initI18n();
    return false;
}

window.onpopstate = function(data) {
    if (data.state) {
        preventHashChange = true;
        loadPage(data.state.name, false, false);
    }
}

function startingPage(name) {
    var verificationToken = getParameterByName("t");
    var email = getParameterByName("email");
    loadPage(name, false);
    if (verificationToken) {
        emailVerification(email, verificationToken);
    }
}

function logout() {
    sessionUser = null;
    document.cookie = "token=; path=/";
    updateLayout(null);
    $(".if_admin").hide();
}

function dateToLocal(date) {
    if (typeof(date) == "string") {
        date = new Date(date);
    }
    return date.toLocaleString();
}

Handlebars.registerHelper("date", function(date) {
    try {
        return dateToLocal(date);
    }
    catch (err) {
        return err;
    }
});

Handlebars.registerHelper("sortableDateMdy", function(date) {
    if (!date) {
        return "-";
    }
    try {
        if (typeof(date) == "string") {
            date = new Date(date);
        }
        var momentDate = moment(date);
    }
    catch (err) {
        return '-';
    }
    var now = new Date();

    var str;
    if (moment(now).format("YYYY") === momentDate.format("YYYY")) {
        str = momentDate.format("MMM Do");
    }
    else {
        str = momentDate.format("MMM Do YYYY");
    }
    return new Handlebars.SafeString('<span class="hidden">' + date.toISOString() + '</span>'
                                     + str);
});

function updateTime(elem) {
    var elem = $(elem);
    var m = moment(elem.parents("tr:first").data("date"));
    elem.html(m.fromNow());
}

function updateTimes(selector) {
    if (!selector) {
        selector = "body";
    }
    $(selector).find(".auto-refresh-moment")
        .each(function() { updateTime(this) });
}

function updateExpire(elem) {
    var elem = $(elem);
    var d = (elem.parents("tr:first").data("date"));
    elem.html(d > new Date() ? "running" : "expired");
}

function updateExpires(selector) {
    if (!selector) {
        selector = "body";
    }
    $(selector).find(".auto-refresh-expires")
        .each(function() { updateExpire(this) });
}

function updateHide(selector) {
    if (!selector) {
        selector = "body";
    }
    $(selector).find(".auto-refresh-hide").each(function() {
        if ($(this).parents("tr:first").data("date") < new Date()) {
            $(this).removeClass(".auto-refresh-hide").html("");
        }
    });
}

function activateAutoRefresh() {
    updateTimes();
    updateExpires();
    updateHide();
    setTimeout(activateAutoRefresh, 60 * 1000);
}

function getParameterByName(name, url) {
    if (!url) {
        url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)", "i"),
                           results = regex.exec(url);
    if (!results) {
        return null;
    }
    if (!results[2]) {
        return '';
    }
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function flashReset() {
    $("#flashMsg").hide()
        .removeClass("alert-default alert-primary alert-success alert-info alert-warning alert-danger")
        .find("span:last").html(" ");
}

function flashMsg(msg, type) {
    flashReset();
    $("#flashMsg").show().addClass("alert-" + type)
        .find("span:last").html(msg);
}

function flashError(msg) {
    flashMsg(msg, "danger");
}

function flashSuccess(msg) {
    flashMsg(msg, "success");
}

function flashWarning(msg) {
    flashMsg(msg, "warning");
}

function getLoginRedirectUrl() {
    var dest = getParameterByName('dest');
    if (dest) {
        return "/#" + dest
    }
    return '/';
}

function msgBoxErrorFromJqXhr(jqXhr) {
    var msg = "";
    if (jqXhr.status == 400) {
        try {
            msg = $.parseJSON(jqXhr.responseText).msg;
        } catch (exception) {
        }
    }
    if (!Boolean(msg)) {
        msg = jqXhr.responseText;
    }
    flashError(msg);
}


function emailVerification(email, verificationToken) {

    function onSuccess(data) {
        sessionUser = data.user;
        updateLayout(data.user, {redirect: getPageFromUrl()});
        flashSuccess(data.msg);
    }
    function onError(jqXhr, textStatus, errorThrown) {
        var msg = "";
        if (jqXhr.status == 400) {
            try {
                var data = $.parseJSON(jqXhr.responseText);
                if (data.reason == "ALREADY_ACTIVATED") {
                    flashWarning("This email address is already verified.");
                    //mute
                    return;
                }
                msg = data.msg;
            }
            catch (exception) {
            }
        }
        if (!Boolean(msg)) {
            msg = jqXhr.responseText;
        }
        flashError(msg);
    }
    var settings = {
        type: 'PUT',
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify({
            email : email,
            token : verificationToken
        }),
        success: onSuccess,
        error: onError
    };
    $.ajax('/user/email_verification', settings);
}

function updateLayout(user, params) {
    if (params === undefined) {
        params = {};
    }
    var page = "home"
    sessionUser = user;
    if (user) {
        $(".signedOut").addClass("hidden");
        $(".signedIn").removeClass("hidden");
        $("#gravatar").attr("src",
                "https://www.gravatar.com/avatar/" + md5(user.email) + "?s=30&d=retro");
    }
    else {
        $(".signedIn").addClass("hidden");
        $(".signedOut").removeClass("hidden");
    }

    if (params.starting) {
        startingPage(params.redirect ? params.redirect : page);
    }
    else {
        var dest = getParameterByName("dest");
        var redirect = params.redirect;
        if (dest) {
            redirect = dest;
        }
        loadPage(redirect ? redirect : page, true, false, params.keepMsg);
    }

    if (user && user.role === "admin") {
        $(".if_admin").show();
    }
}

function getPageFromUrl() {
    return document.location.hash.slice(1).split('?')[0];
}

function initTablesorter() {
    // https://mottie.github.io/tablesorter/docs/example-widget-bootstrap-theme.html
    $.tablesorter.themes.bootstrap = {
//         table        : 'table table-bordered table-striped',
//         caption      : 'caption',
        header       : 'cursorPointer',
//         sortNone     : '',
//         sortAsc      : '',
//         sortDesc     : '',
//         active       : '',
//         hover        : '',
//         icons        : '',
        iconSortNone : 'glyphicon glyphicon-sort',
        iconSortAsc  : 'glyphicon glyphicon-chevron-up',
        iconSortDesc : 'glyphicon glyphicon-chevron-down',
//         filterRow    : '',
//         footerRow    : '',
//         footerCells  : '',
//         even         : '',
//         odd          : ''
    };
}

function detectLanguage() {
    var lang = localStorage.getItem("lang");
    var acceptedLangs = ["en", "fr"]
    if ($.inArray(lang, acceptedLangs) != -1) {
        return lang;
    }

    lang = navigator.language.substr(0, 2);
    if ($.inArray(lang, acceptedLangs) != -1) {
        return lang;
    }

    return undefined;
}

function initI18n() {
    var lang = detectLanguage();
    if (lang !== undefined && lang != "en") {
        $(".languageMenu").html("English").click(function() {
            localStorage.setItem("lang", "en");
            location.reload();
        });

        $.getJSON("/html/i18n/" + lang + ".json", function(i18n) {
            // At the moment the only other supported language is english

            $(".i18n").each(function () {
                // get html, replace \n (one or many) with single whitespace,
                // trim clopening whitespaces.
                var html = $(this).html().replace(/[\n]+/g, " ").trim();
                var getTranslation = function(key) {
                    var res = i18n[key];
                    if (res === undefined) {
                        console.warn("Not found in i18n: " + key);
                    }
                    return res;
                }
                var res = getTranslation(html);
                if (res !== undefined) {
                    $(this).html(res).removeClass("i18n");
                }

                var placeholder = $(this).attr("placeholder");
                if (placeholder !== undefined) {
                    res = getTranslation(placeholder);
                    if (res !== undefined) {
                        $(this).attr("placeholder", res);
                    }
                }
            });
            $(".i18n").show();
        }).error(function () {
            // default to english
            console.error("Failed to load language: " + lang);
            $(".i18n").show().removeClass("i18n");
        });
    }
    else {
        // At the moment the only other supported language is French
        $(".languageMenu").html("Français").click(function() {
            localStorage.setItem("lang", "fr");
            location.reload();
        });
        $(".i18n").show().removeClass("i18n");
    }
}

function initLayout() {
    activateAutoRefresh();
    startNotebook = getParameterByName("notebook");
    $.getJSON('/user', function(user) {
        sessionUser = user;
        updateLayout(user, {redirect: getPageFromUrl(), starting: true});
        mixpanel.identify(user.email);
        mixpanel.people.set({
            "$email" : user.email
        });
    }).error(function (jqXhr) {
        // if condition to prevent race with email validation
        if (!sessionUser) {
            updateLayout(null, {redirect: getPageFromUrl(), starting: true});
        }
        jqXhr.preventDefault = true;
    });

    $("body").on("click", "a[role=button]", function(event) {
        // don't mess with bfcache
        event.preventDefault();
        var page = $(this).data("target");
        if (page) {
            loadPage(page);
        }
    });

    // Global 401 handler
    $(document).ajaxError(function (event, jqXhr, settings, thrownError) {
        // jqXhr.preventDefault is not a stdandard field
        if (jqXhr.status == 401 && !jqXhr.preventDefault) {
            var page = getPageFromUrl();
            var url = "/#signin";
            if (page != "signin") {
                url += "?dest=" + page;
            }
            logout();
            loadPage("signin", false, false);
            flashWarning("You have been logged out.");
            var pushData = {
                "name" : "signin",
                "params" : null
            };
            preventHashChange = true;
            window.history.replaceState(pushData, "", url);
        }
    });

    $(window).on("hashchange", function(event) {
        if (!preventHashChange) {
            loadPage(getPageFromUrl(), false);
        }
        preventHashChange = false
    });

    initTablesorter();
}

function clearEmptyKeys(data) {
    var toDel = [];
    for (var key in data) {
        if (data[key] == "") {
            toDel.push(key);
        }
    }
    while (key = toDel.pop()) {
        delete data[key];
    }
    return data;
}

function sendVerifyEmail(dest) {
    function onSuccess(data) {
        flashSuccess(data.msg);
    }
    function onError(jqXhr, textStatus, errorThrown) {
        var msg = "";
        if (jqXhr.status == 400) {
            try {
                msg = $.parseJSON(jqXhr.responseText).msg;
            } catch (exception) {
            }
        }
        if (!Boolean(msg)) {
            msg = jqXhr.responseText;
        }
        flashError(msg);
    }
    flashReset();
    var setting = {
        type: 'POST',
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(clearEmptyKeys({
            dest : dest
        })),
        success: onSuccess,
        error: onError
    };
    $.ajax("/user/email_verification", setting);
    return false;
}

function nullableDateSorter(a, b, direction, column, table) {
    if (a == "-" || a == "") {
        a = direction ? "ZZZZZ" : "";
    }
    if (b == "-" || b == "") {
        b = direction ? "ZZZZZ" : "";
    }
    return ((a < b) ? -1 : ((a > b) ? 1 : 0));
}
