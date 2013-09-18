var MAX_DURATION = 45 * 60;
var INITIAL_TIME = 32400;

var city = "Philly";
//var city = "NYC"

var dynamicRendering = false;


var baseUrl = baseUrl || "http://207.245.89.247/gt";

if(city == "Philly") {
    var viewCoords = [39.9886950160466,-75.1519775390625];
    var geoCodeLowerLeft = { lat: 39.7353312333975, lng: -75.4468831918069 };
    var geoCodeUpperRight = { lat: 40.1696687666025, lng: -74.8802888081931 };
    var borderPoly = [
        [39.7353312333975,-75.4468831918069],
        [40.1696687666025,-75.4468831918069],
        [40.1696687666025,-74.8802888081931],
        [39.7353312333975,-74.8802888081931]
    ];
    var startLat = 40.0175;   
    var startLng = -75.059;
} else {
    // New York
    // WNYC data extent
    //40.495526,-74.260025
    //40.920161,-73.688564
    //HEIGHT = 47191.92886399891
    //WIDTH = 48296.20594990707

    var viewCoords = [40.753499,-73.983994];
    var borderPoly = [
        [40.495526,-74.260025],
        [40.495526,-73.688564],
        [40.920161,-73.688564],
        [40.920161,-74.260025]
    ];
    var startLat = 40.753499; 
    var startLng = -73.983994;
}

var breaks = 
   _.reduce(_.map([10,15,20,30,40,50,60,75,90,120], function(minute) { return minute*60; }),
            function(s,i) { return s + "," + i.toString(); })

var colors = "0xF68481,0xFDB383,0xFEE085," + 
             "0xDCF288,0xB6F2AE,0x98FEE6,0x83D9FD,0x81A8FC,0x8083F7,0x7F81BD"

var getLayer = function(url,attrib) {
    return L.tileLayer(url, { maxZoom: 18, attribution: attrib });
};

var Layers = {
    stamen: { 
        toner:  'http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png',   
        terrain: 'http://{s}.tile.stamen.com/terrain/{z}/{x}/{y}.png',
        watercolor: 'http://{s}.tile.stamen.com/watercolor/{z}/{x}/{y}.png',
        attrib: 'Map data &copy;2013 OpenStreetMap contributors, Tiles &copy;2013 Stamen Design'
    },
    mapBox: {
        azavea:     'http://{s}.tiles.mapbox.com/v3/azavea.map-zbompf85/{z}/{x}/{y}.png',
        wnyc:       'http://{s}.tiles.mapbox.com/v3/jkeefe.map-id6ukiaw/{z}/{x}/{y}.png',
        worldGlass:     'http://{s}.tiles.mapbox.com/v3/mapbox.world-glass/{z}/{x}/{y}.png',
        worldBlank:  'http://{s}.tiles.mapbox.com/v3/mapbox.world-blank-light/{z}/{x}/{y}.png',
        worldLight: 'http://{s}.tiles.mapbox.com/v3/mapbox.world-light/{z}/{x}/{y}.png',
        attrib: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery &copy; <a href="http://mapbox.com">MapBox</a>'
    }
};

var map = (function() {
    var selected = getLayer(Layers.mapBox.azavea,Layers.mapBox.attrib);

    var baseLayers = {
        "Azavea" : selected,
        "WNYC" : getLayer(Layers.mapBox.wnyc,Layers.mapBox.attrib),
        "World Light" : getLayer(Layers.mapBox.worldLight,Layers.mapBox.attrib),
        "Terrain" : getLayer(Layers.stamen.terrain,Layers.stamen.attrib),
        "Watercolor" : getLayer(Layers.stamen.watercolor,Layers.stamen.attrib),
        "Toner" : getLayer(Layers.stamen.toner,Layers.stamen.attrib),
        "Glass" : getLayer(Layers.mapBox.worldGlass,Layers.mapBox.attrib),
        "Blank" : getLayer(Layers.mapBox.worldBlank,Layers.mapBox.attrib)
    };

    var m = L.map('map').setView(viewCoords, 9);
    selected.addTo(m);

    m.lc = L.control.layers(baseLayers).addTo(m);

    $('#map').resize(function() {
        m.setView(m.getBounds(),m.getZoom());
    });

    // Extent of OSM data - large
    // var polygon = L.polygon([
    //     [39.641,-75.572],
    //     [40.308,-75.572],
    //     [40.308,-74.641],
    //     [39.641,-74.641],
    // ],
    //   {  color: 'black',
    //     fillColor: '#f03',
    //     fillOpacity: 0.0}).addTo(m);

    // Extent of OSM data - med (same area as WNYC app)
    var polygon = L.polygon(borderPoly,
      {  color: 'black',
        fillColor: '#f03',
        fillOpacity: 0.0}).addTo(m);

    return m;
})();

var travelTimeViz = (function() {
    var duration = MAX_DURATION;
    var travelModes = ['walking'];
    var schedule = "weekday";
    return {
        setDuration: function(o) {
            duration = o;
        },
        getDuration: function(o) {
            return duration;
        },
        getMaxDuration: function(o) {
            return MAX_DURATION;
        },
        addMode: function(mode) {
            if(!_.contains(travelModes,mode)) {
                travelModes.push(mode);
            };
        },
        removeMode: function(mode) {
            if(_.contains(travelModes,mode)) {
                var i = travelModes.indexOf(mode);
                travelModes.splice(i,1);
            };
        },
        getModes: function() {
            return travelModes;
        },
        setSchedule: function(newSchedule) {
            schedule = newSchedule;
        },
        getSchedule: function() { 
            return schedule;
        }
  }
})()

var travelTimes = (function() {
    var mapLayer = null;
    var vectorLayer = null;
    var opacity = 0.9;

    var duration = MAX_DURATION;
    var time = INITIAL_TIME;

    var getModes = function() {
        var modes = travelTimeViz.getModes();
        if(modes.length == 0) { return ""; }
        else {
            return _.reduce(travelTimeViz.getModes(), 
                            function(s,v) { return s + "," + v; });
        }
        
    };

    return {
        setOpacity : function(o) {
            opacity = o;
            if(mapLayer) { 
                mapLayer.setOpacity(opacity); 
            }
        },
        setTime : function(o) {
            time = o;
            travelTimes.update();
        },
        setDuration : function(o) {
            duration = o;
            travelTimes.update();
        },
        update : function() {
            var wmsClass;

            var modes = getModes();
            if(modes != "") {
                var direction_val = $("#direction").val();
                var direction = "";
                if(direction_val == 0) { direction = "departing"; }
                if(direction_val == 1) { direction = "arriving"; }

                // if(schedule_val == 0) { schedule = "weekday"; }
                // if(schedule_val == 1) { schedule = "saturday"; }
                // if(schedule_val == 2) { schedule = "sunday"; }
                schedule = travelTimeViz.getSchedule();

                if (mapLayer) {
                    map.lc.removeLayer(mapLayer);
                    map.removeLayer(mapLayer);
                    mapLayer = null;
                }


		if($('#rendering_checkbox').is(':checked')) {
		    mapLayer = new L.TileLayer.WMS2(baseUrl + "/travelshed/wmsdata", {
                        latitude: startMarker.getLat(),
                        longitude: startMarker.getLng(),
                        time: time,
                        duration: duration,
                        modes: modes,
                        schedule: schedule,
                        direction: direction,
                        breaks: breaks,
                        palette: colors,
                        attribution: 'Azavea'
		    });
		} else {
		    mapLayer = new L.TileLayer.WMS(baseUrl + "/travelshed/wms", {
                        latitude: startMarker.getLat(),
                        longitude: startMarker.getLng(),
                        time: time,
                        duration: duration,
                        modes: modes,
                        schedule: schedule,
                        direction: direction,
                        breaks: breaks,
                        palette: colors,
                        attribution: 'Azavea'
		    });
                }
		
		mapLayer.setOpacity(opacity);
		mapLayer.addTo(map);
		map.lc.addOverlay(mapLayer, "Travel Times");
		travelTimes.updateVector();
            }
        },
        updateVector : function() {
            var modes = getModes();
            if(modes != "") {
                var direction_val = $("#direction").val()
                var direction = ""
                if(direction_val == 0) { direction = "departing" }
                if(direction_val == 1) { direction = "arriving" }

                var schedule_val = $("#schedule").val()
                var schedule = ""
                if(schedule_val == 0) { schedule = "weekday" }
                if(schedule_val == 1) { schedule = "saturday" }
                if(schedule_val == 2) { schedule = "sunday" }

                if (vectorLayer) {
                    map.lc.removeLayer(vectorLayer);
                    map.removeLayer(vectorLayer);
                    vectorLayer = null; 
                }

                if($('#vector_checkbox').is(':checked')) {
                    $.ajax({
                        url: baseUrl + '/travelshed/json',
                        dataType: "json",
                        data: { latitude: startMarker.getLat(),
                                longitude: startMarker.getLng(),
                                time: time,
                                durations: duration,
                                modes: modes,
                                schedule: schedule,
                                direction: direction },
                        success: function(data) {
                            vectorLayer = L.geoJson().addTo(map);
                            vectorLayer.addData(data); 
                        }
                    })
                }
            }
        }
    }
})();

var startMarker = (function() {
    var lat = startLat;
    var lng = startLng;

    var marker = L.marker([lat,lng], {
        draggable: true 
    }).addTo(map);
    
    marker.on('dragend', function(e) { 
        lat = marker.getLatLng().lat;
        lng = marker.getLatLng().lng;
        travelTimes.update();
    } );

    return {
        getMarker : function() { return marker; },
        getLat : function() { return lat; },
        getLng : function() { return lng; },
        setLatLng : function(newLat,newLng) {
            lat = newLat;
            lng = newLng;
            marker.setLatLng(new L.LatLng(lat, lng));
            travelTimes.update();
        }
    }
})();

var opacitySlider = (function() {
    var opacitySlider = $("#opacity-slider").slider({
        value: 0.9,
        min: 0,
        max: 1,
        step: .02,
        slide: function( event, ui ) {
            travelTimes.setOpacity(ui.value);
        }
    });

    return {
        setOpacity: function(o) {
            opacitySlider.slider('value', o);
        }
    }
})();

var timeSlider = (function() {
    var slider = $("#time-slider").slider({
        value: INITIAL_TIME,
        min: 0,
        max: 24*60*60,
        step: 10,
        change: function( event, ui ) {
            travelTimes.setTime(ui.value);
        }
    });

    return {
        setTime: function(o) {
            slider.slider('value', o);
        }
    }
})();

var durationSlider = (function() {
    var slider = $("#duration-slider").slider({
        value: MAX_DURATION,
        min: 0,
        max: MAX_DURATION,
        step: 60,
        change: function( event, ui ) {      
	    if( ! $('#rendering_checkbox').is(':checked')) {
		travelTimes.setDuration(ui.value);
	    }
        },
	slide: function (event, ui) {
	    travelTimeViz.setDuration(ui.value);
	}
    });

    return {
        setDuration: function(o) {
            slider.slider('value', o);
        }
    }
})();


var setupEvents = function() {
    $("#schedule-dropdown-menu li a").click(function(){
        var selText = $(this).text();
        $(this).parents('.dropdown').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
        travelTimeViz.setSchedule(selText.toLowerCase());
        travelTimes.update();
    });

    $("#transit_type").change(function() {
        travelTimes.update();
    });

    $("#schedule").change(function() {
        travelTimes.update();
    });

    $("#direction").change(function() {
        travelTimes.update();
    });

    $('#vector_checkbox').click(function() {
        travelTimes.updateVector();
    });

    $('#rendering_checkbox').click(function() {
	if( $('#rendering_checkbox').is(':checked')) { 
	    travelTimes.setDuration(travelTimeViz.getMaxDuration());
	} else {
	    travelTimes.setDuration(travelTimeViz.getDuration());
	}
	travelTimes.update();
    });
};

var setupTransitModes = function() {
    $.each($("input[name='anytime-mode']"), function () {
        $(this).change(function() {
            if($(this).val() == 'walking') {
                travelTimeViz.removeMode("biking");
                travelTimeViz.addMode("walking");
            } else {
                travelTimeViz.addMode("biking");
                travelTimeViz.removeMode("walking");
            }
            travelTimes.update();
        });
    });

    $.each($("input[name='public-transit-mode']"), function () {
        $(this).change(function() {
            var val = $(this).val();
            if($(this).is(':checked')) {
                travelTimeViz.addMode(val);
            } else {
                travelTimeViz.removeMode(val);
            }
            travelTimes.update();
        });
    });
};
           // var modes = $("#transit_modes");
           // var p = $("#transitModeCheckBox").clone();
           // var label = p.find('label');
           // var text = $('<span>' + transitMode.name + '</span>');
           // var checkbox = label.find("input:checkbox");
           // checkbox.prop('value',transitMode.name);
           // label.click(function() {
           //     travelTimes.update();
           // });
           // label.empty().append(checkbox).append(text);
           // p.show();
           // modes.append(p);

var Geocoder = (function(){
    var geocoder = null;
    return {
        onLoadGoogleApiCallback : function() {
            geocoder = new google.maps.Geocoder();
            document.body.removeChild(document.getElementById('load_google_api'));
        },
        getGeocoder : function() { return geocoder; }
    };
})();


var setupGeocoding = function() {
    var url = "https://maps.googleapis.com/maps/api/js?v=3&callback=Geocoder.onLoadGoogleApiCallback&sensor=false";
    var script = document.createElement('script');
    script.id = 'load_google_api';
    script.type = "text/javascript";
    script.src = url;
    document.body.appendChild(script);

    var geoCode = function(address) {
        var geocoder = Geocoder.getGeocoder();

        var lowerLeft = new google.maps.LatLng(geoCodeLowerLeft.lat, geoCodeLowerLeft.lng);
        var upperRight = new google.maps.LatLng(geoCodeUpperRight.lat, geoCodeUpperRight.lng);
        var bounds = new google.maps.LatLngBounds(lowerLeft, upperRight);

        var parameters = {
            address: address,
            bounds: bounds
        };

        var results = geocoder.geocode(parameters, function(data){
            data = {results: data};

            if (data.results.length == 0)
                return [];
 
            for (var i = 0; i < data.results.length; i++) {
                var lat = data.results[i].geometry.location.lat();
                var lng = data.results[i].geometry.location.lng();
                startMarker.setLatLng(lat,lng);
            };
        });
    };

    $.each($("input[name='address']"), function() {
        $(this).keypress(function (e) {
            if (e.which == 13) {
                geoCode($(this).val());
            }
        });
    });
    
};

// On page load
$(document).ready(function() {
    setupGeocoding();
    setupEvents();
    setupTransitModes();
    travelTimes.update();
});
