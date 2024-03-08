require("normalize.css/normalize.css");
require("leaflet/dist/leaflet.css");
require("@geoapify/geocoder-autocomplete/styles/minimal.css");
require("../style/app.scss");

const boundaryShape = require("./boundary.json");
const geoapify = require("@geoapify/geocoder-autocomplete");

require("../img/favicon.ico");
require("../img/thinking.gif");
require("../img/logo.png");
require("../img/logo-no-text.png");
require("../img/icon-search.png");
require("../img/caret.svg");
require("../img/language.svg");
require("../img/locate-me.svg");

// Our Data Sources pdf that gets linked to in several snuggets
require("../img/data-sources.pdf");

require("./users");
require("./sections");

// IE11 polyfills
require("url-polyfill");

if (!String.prototype.includes) {
  String.prototype.includes = function (search, start) {
    "use strict";
    if (typeof start !== "number") {
      start = 0;
    }

    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}

const GEOAPIFY_KEY = "78ba2cb5406144f1827a7f146b94d255";

const osmUrl =
  "//{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=3a70462b44dd431586870baee15607e4";
const osmAttrib =
  'Map data © <a href="//openstreetmap.org">OpenStreetMap</a> contributors';

const boundaryStyle = {
  color: "rgb(253, 141, 60)",
  weight: 4,
  opacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 0.7,
};

const GEOAPIFY_MAP_BOUNDS = {
  lon1: mapBounds[0][1],
  lat1: mapBounds[0][0],
  lon2: mapBounds[1][1],
  lat2: mapBounds[1][0],
};

const GEOAPIFY_MAP_BOUNDS_STRING = `${GEOAPIFY_MAP_BOUNDS["lon1"]},${GEOAPIFY_MAP_BOUNDS["lat1"]},${GEOAPIFY_MAP_BOUNDS["lon2"]},${GEOAPIFY_MAP_BOUNDS["lat2"]}`;

var location_query_text = "";
var input_lat;
var input_lng;
var $locationInput;

// the page language, as ISO 639-1
let lang = document.documentElement.lang;
if (lang == "cn") {
  lang = "zh";
}

// grab the position, if possible
const query_lat = getURLParameter("lat");
const query_lng = getURLParameter("lng");

var map;
var mapElement = document.getElementById("map");

// convenience function to extract url parameters
function getURLParameter(name) {
  var results = new RegExp("[?&]" + name + "=([^&#]*)").exec(
    window.location.href,
  );
  return results === null ? null : results[1] || 0;
}

// Reload the current page, with the specified parameters (to show a location on the map and its information)
function loadPageWithParameters(lat, lng, queryText) {
  var query = "?lat=" + lat + "&lng=" + lng;
  if (queryText) {
    query += "&loc=" + queryText;
  }
  document.location = encodeURI(document.location.pathname + query);
}

function showGeocodeError() {
  $(".geocode-error-message").removeClass("hide");
}

function hideGeocodeError() {
  $(".geocode-error-message").addClass("hide");
}

function reverseGeocodeLocation(lat, lng) {
  // if we don't have text for the location, reverse geocode to get it
  return $.ajax({
    type: "GET",
    url: "https://api.geoapify.com/v1/geocode/reverse",
    data: {
      apiKey: GEOAPIFY_KEY,
      lang: lang,
      lat: lat,
      lon: lng,
      format: "json",
      type: "street",
    },
  })
    .then(function (response) {
      // We have at least one result and nothing went wrong
      if (response.results.length) {
        return response.results[0].formatted;
      } else {
        console.log("Reverse geocoding error; response: ", response);
      }
    })
    .catch(function (error) {
      console.log("reverse geocoding error", error);
    });
}

function submitLocation(lat, lng, queryText) {
  if (!queryText) {
    reverseGeocodeLocation(lat, lng).then(function (queryText) {
      return loadPageWithParameters(lat, lng, queryText);
    });
  } else {
    loadPageWithParameters(lat, lng, queryText);
  }
}

function setUpMap() {
  // set up the map
  var map = new L.Map("map", {
    scrollWheelZoom: false,
  });
  if (query_lat && query_lng) {
    zoom = 14;
    map.setView([query_lat, query_lng], zoom);
  } else {
    // use the data bounds if we don't have a position in the query string
    map.fitBounds(mapBounds);
  }

  var layer = L.tileLayer(osmUrl, { attribution: osmAttrib }).addTo(map);
  layer.setOpacity(0.6);

  var boundaryLayer = L.geoJson(boundaryShape, {
    style: boundaryStyle,
  }).addTo(map);

  document.getElementById("map").style.cursor = "default";

  if (query_lat && query_lng) {
    var icon = L.icon({
      iconUrl: require("../img/marker-icon.png"),
      shadowUrl: require("../img/marker-shadow.png"),
      iconSize: [25, 41],
      iconAnchor: [25, 41],
    });

    var marker = L.marker([query_lat, query_lng], {
      icon: icon,
      clickable: false,
      keyboard: false,
    }).addTo(map);
    layer.setOpacity(1);
  }

  // Make a click on the map submit the location
  map.on("click", function (e) {
    $locationInput.val(""); // clear query text
    submitLocation(e.latlng.lat, e.latlng.lng, "");
  });
}

function setStopHeight(heroContainer) {
  var headerHeight = $("header").outerHeight();
  var informationHeight = heroContainer.outerHeight();
  return headerHeight + informationHeight - 20;
}

function lazyLoadVideos() {
  $(".video").each(function (idx) {
    var self = $(this);
    var embedCode = self.data("embed");
    // Load the video preview thumbnails asynchronously
    var preview = new Image();
    preview.src = "https://img.youtube.com/vi/" + embedCode + "/sddefault.jpg";
    preview.alt = "";
    $(preview).on("load", function () {
      self.append(preview);
    });

    self.click(function () {
      var iframe = $(document.createElement("iframe"));

      iframe.attr("frameborder", 0);
      iframe.attr("allowfullscreen", "");
      iframe.attr(
        "src",
        "https://www.youtube.com/embed/" +
          embedCode +
          "?rel=0&showinfo=0&autoplay=1",
      );

      // Swap out the static image and the play button for the video when someone clicks on it.
      self.empty();
      self.append(iframe);
    });
  });
}

$(document).ready(function () {
  var infoContainer = $(".information-container--found-content");
  var heroContainer = $(".hero-container");
  var contentContainer = $(".content-container");

  $("a").on("click", function (e) {
    if (e.currentTarget.hostname !== location.hostname) {
      return trackOutboundLink(
        e.currentTarget.href,
        e.currentTarget.target === "_blank",
      );
    }
  });

  $(".sogoSurvey").click(function () {
    document.cookie = "sogoSurvey=true; expires=Fri, 31 Dec 9999 23:59:59 GMT;";
  });

  // if we are on the found content page, stick the hero container, set up our tabs and lazy load our videos.
  if (infoContainer.length) {
    var stopHeight = setStopHeight(heroContainer);

    var hazardLinks = $(".hazard-link");

    // get the hash, if there is one, and select the correct tab
    var anchor = window.location.hash;
    $('a[href="' + anchor + '"]').addClass("selected");

    // Select the correct tab when we click on one
    hazardLinks.click(function (event) {
      // Clicking one of these from a non-collapsed header makes things weird if we don't compensate for the way the header is going to collapse.
      if (!heroContainer.hasClass("sticky")) {
        contentContainer.css({ "padding-top": "150px" });
      }
      hazardLinks.removeClass("selected");
      $(event.delegateTarget).addClass("selected");
    });

    // Highlight the correct hazard tabs as we scroll
    var anchors = $(".anchor");
    var previousHazard;

    var stickMenu = function () {
      var scrollTop = $(document).scrollTop();
      if (scrollTop >= stopHeight) {
        heroContainer.addClass("sticky");
        contentContainer.css({ "padding-top": stopHeight + 100 + "px" });

        // Get id of current hazard
        var currentHazard = anchors
          .filter(function () {
            var container = $(this).parent();
            var top = container.offset().top - 200;
            return (
              top <= scrollTop && container.outerHeight() + top >= scrollTop
            );
          })
          .attr("id");

        if (currentHazard !== previousHazard) {
          previousHazard = currentHazard;
          hazardLinks.removeClass("selected");
          var currentTab = $('a[href="#' + currentHazard + '"]');
          currentTab.addClass("selected");
          if (currentTab[0]) {
            currentTab[0].scrollIntoView();
          }
        }
      } else {
        heroContainer.removeClass("sticky");
        contentContainer.css({ "padding-top": "" });
      }
    };

    $(document).scroll(stickMenu);

    $(window).resize(function () {
      stopHeight = setStopHeight(heroContainer);
    });

    lazyLoadVideos();
  }

  // Set up input box
  const $locationContainer = $("#location-text");
  const $locationSubmit = $("#location-submit");
  const $autoLocationButton = $("#auto-location");
  if (mapElement) {
    if (map !== undefined && map !== null) {
      // sometimes we already have one and I don't know why
      map = map.remove();
    }
    setUpMap();
  }

  // Set up autocomplete
  const autocompleteInput = new geoapify.GeocoderAutocomplete(
    $locationContainer[0],
    GEOAPIFY_KEY,
    {
      filter: { rect: GEOAPIFY_MAP_BOUNDS },
      placeholder: gettext("Enter an address."),
    },
  );

  // geoapify adds an input element, which we need to work with
  $locationInput = $locationContainer.find("input.geoapify-autocomplete-input");

  // grab and set any previously entered query text
  var loc = getURLParameter("loc");
  if (loc) {
    $locationInput.val(decodeURIComponent(loc));
  } else if (query_lat && query_lng) {
    // or if there isn't any, and we have a lat and lng, reverse geocode our lat and lng, and set it in the UI.
    reverseGeocodeLocation(query_lat, query_lng).then(function (queryText) {
      $locationInput.val(queryText);
      $(".info__location").text(queryText);
    });
  }

  // Hide a geocoding error message every time, if there is one
  $locationInput.on("click", hideGeocodeError);

  autocompleteInput.on("select", function (location) {
    if (!!location) {
      input_lat = location.properties.lat;
      input_lng = location.properties.lon;
    }
  });

  //hitting enter key in the input will trigger submit
  $locationInput.keydown(function (event) {
    if (event.keyCode == 13) {
      $locationSubmit.trigger("click");
      return false;
    }
  });

  // submit location text
  $locationSubmit.click(function () {
    // grab the query value, ignoring it if it's empty
    location_query_text = $locationInput.val();
    if (location_query_text.trim().length == 0) return;
    disableForm();

    if (input_lat && input_lng) {
      submitLocation(input_lat, input_lng, location_query_text);
      return;
    }

    // Geocode our location text if we don't have a lat/lng from the autocomplete
    // (e.g someone just typed in there and hit 'enter')
    $.ajax({
      type: "GET",
      url: "https://api.geoapify.com/v1/geocode/search",
      data: {
        apiKey: GEOAPIFY_KEY,
        text: location_query_text,
        lang: lang,
        format: "json",
        filter: `rect:${GEOAPIFY_MAP_BOUNDS_STRING}`,
      },
    })
      .then(function (response) {
        if (response.results.length) {
          var lat = response.results[0].lat;
          var lon = response.results[0].lon;
          submitLocation(lat, lon, location_query_text);
        } else {
          console.log("Geocoding error: ", response);
          showGeocodeError();
        }
      })
      .catch(function (error) {
        console.log("Geocoding error: ", error.message);
        showGeocodeError();
      });
  });

  // auto location (the Find Me button)
  $autoLocationButton.click(function () {
    hideGeocodeError();
    disableForm();

    if (!navigator.geolocation) {
      showGeocodeError();
      enableForm();
    } else {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lng = position.coords.longitude;
          // success! onwards to view the content
          submitLocation(lat, lng);
        },
        function (error) {
          console.log("Error finding your location: " + error.message);
          showGeocodeError();
          enableForm();
        },
        { timeout: 8000 },
      );
    }
  });

  // during api calls, disable the form
  function disableForm() {
    $locationInput.prop("disabled", true);
    $locationSubmit.addClass("disabled");
    $autoLocationButton.addClass("disabled");
    $(".loading").show();
  }

  // if a search fails or a restart, enable the form
  function enableForm() {
    $locationInput.prop("disabled", false);
    $locationSubmit.removeClass("disabled");
    $autoLocationButton.removeClass("disabled");
    $(".loading").hide();
  }
});
