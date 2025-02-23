// ===============================
// Leaflet Export Button Control
// ===============================

// Create a custom control for exporting the map
var ExportButtonControl = L.Control.extend({
    options: {
        position: 'topleft' // Position the control on the top left
    },
    onAdd: function (map) {
        // Create a container for the button
        var container = L.DomUtil.create('div', 'leaflet-control export-button');
        container.style.backgroundColor = 'white';
        container.style.width = '20px';
        container.style.height = '20px';
        container.style.cursor = 'pointer';
        container.title = 'Export Map';

        // Add a download icon inside the button
        container.innerHTML = '<i class="fa fa-download" style="font-size: 20px; color: #000;"></i>';

        // On click, trigger the map export function
        container.onclick = function () {
            exportMapData();
        };

        return container;
    }
});

// Add the export button to the map
var exportControl = new ExportButtonControl();
exportControl.addTo(map);

// ===============================
// Function to Export Map as Image
// ===============================
function exportMapData() {
    jQuery("#loadingOverlay-export").fadeIn(0); // Show loading overlay

    // Hide control elements before taking a screenshot
    jQuery('.leaflet-control').css('display', 'none');
    jQuery('.leaflet-draw').css('display', 'none');

    // Generate the legend HTML for the map
    let legendHTML = generateLegendHTML(map); 
    let legendDiv = document.createElement('div');
    legendDiv.innerHTML = legendHTML;
    legendDiv.style.position = 'absolute';
    legendDiv.style.top = '10px';
    legendDiv.style.right = '10px';
    legendDiv.style.zIndex = '9999';
    legendDiv.style.backgroundColor = 'rgba(255,255,255,0.8)';

    // Append legend to the map container
    document.getElementById("map-container-frontend").appendChild(legendDiv);

    // Convert the map container to a PNG image using domtoimage library
    var mapContainer = document.getElementById("map-container-frontend");
    domtoimage.toPng(mapContainer)
        .then(function (dataUrl) {
            legendDiv.remove(); // Remove legend after capture

            // Restore control elements
            jQuery('.leaflet-control').css('display', '');
            jQuery('.leaflet-draw').css('display', '');

            // Set the captured image to the export modal
            jQuery("#mapScreenshot-export").attr("src", dataUrl);
            jQuery("#exportModal").fadeIn(300); // Show export modal

            jQuery("#loadingOverlay-export").fadeOut(300); // Hide loading overlay
        })
        .catch(function (error) {
            console.error("Screenshot failed:", error);

            legendDiv.remove();
            jQuery('.leaflet-control').css('display', '');
            jQuery('.leaflet-draw').css('display', '');
        });
}

// ===============================
// Close Modal Event
// ===============================
// When the user clicks on the close button, hide the modal
$(".closeBtn-export").on("click", function () {
    $("#exportModal").fadeOut(300);
});

// ===============================
// Collect Map Data for Export
// ===============================
function getMapDataForExport() {
    var currentBaseMapStyle = 'OpenStreetMap'; // Default base map
    var base_map = {
        style: currentBaseMapStyle || "unknown",
        center: [map.getCenter().lat, map.getCenter().lng], // Map center
        zoom: map.getZoom() // Current zoom level
    };

    var features = [];
    // Loop through drawn layers to collect GeoJSON data
    editableLayers.eachLayer(function (layer) {
        var geojsonFeature = layer.toGeoJSON();

        // Identify layer type (marker, polygon, etc.)
        var layerType;
        if (layer instanceof L.Marker) {
            layerType = 'marker';
        } else if (layer instanceof L.Polyline) {
            layerType = 'polyline';
        } else if (layer instanceof L.Polygon) {
            layerType = 'polygon';
        } else if (layer instanceof L.Rectangle) {
            layerType = 'rectangle';
        } else if (layer instanceof L.Circle) {
            layerType = 'circle';
        } else if (layer instanceof L.CircleMarker) {
            layerType = 'circlemarker';
        } else if (layer instanceof L.LayerGroup) {
            layerType = 'layergroup';
        } else {
            layerType = 'unknown';
        }

        // Collect layer properties
        var properties = geojsonFeature.properties || {};
        properties.type = layerType;
        properties.color = layer.options.color || '#3388ff';
        properties.layerName = layer.options.layerName || '';
        properties.radius = (typeof layer.getRadius === 'function') ? layer.getRadius() : undefined;
        properties.icon = (layer.options.icon && layer.options.icon.options) ? layer.options.icon.options : undefined;

        // If layer has popup, include its content
        if (typeof layer.getPopup === 'function' && layer.getPopup()) {
            properties.popupContent = layer.getPopup().getContent();
        }

        // If layer is a text box, capture text
        if (layer.options.icon && layer.options.icon.options.className === 'custom-textbox-icon') {
            var textDiv = layer.getElement() ? layer.getElement().querySelector('.textbox-content') : null;
            properties.text = textDiv ? textDiv.innerText : '';
        }

        geojsonFeature.properties = properties;
        features.push(geojsonFeature);
    });

    // Prepare the final configuration object
    var drawn_features = {
        type: "FeatureCollection",
        features: features
    };

    var configuration = {
        base_map: base_map,
        datasets: [],
        drawn_features: drawn_features
    };

    return configuration;
}

// ===============================
// DOM Ready Events
// ===============================
jQuery(document).ready(function ($) {
    // Pre-fill userId and vignettenId fields
    $("#userIdField").val(window.user_id);
    $("#vignettenIdField").val(window.vignetten_id);
    console.log("Vignettenid:" + window.vignetten_id);

    // AJAX call to fetch course ID for the vignette
    $.ajax({
        url: window.movebankData.ajaxurl,
        method: "POST",
        data: {
            action: "get_kursid_for_vignette",
            vignetten_id: window.vignetten_id
        },
        success: function (response) {
            if (response.success) {
                $("#kursIdField").val(response.data.kursid);
            } else {
                $("#kursIdField").val("Error: " + response.data);
            }
        },
        error: function (xhr, status, error) {
            $("#kursIdField").val("Ajax Error: " + error);
        }
    });

    // Capture screenshot when the capture button is clicked
    $("#captureButton").on("click", function () {
        var mapContainer = document.getElementById("map-container-frontend");
        domtoimage.toPng(mapContainer)
            .then(function (dataUrl) {
                $("#mapScreenshot-export").attr("src", dataUrl);
                $("#exportModal").fadeIn(300);
            })
            .catch(function (error) {
                console.error("Screenshot failed:", error);
            });
    });

    // Save screenshot to server
    $("#saveScreenshot").on("click", function () {
        var dataUrl = $("#mapScreenshot-export").attr("src");

        $.ajax({
            url: window.movebankData.ajaxurl,
            method: "POST",
            data: {
                action: "store_screenshot",
                screenshot: dataUrl,
                vignetten_id: window.vignetten_id
            },
            success: function (response) {
                if (response.success) {
                    alert("Screenshot saved!");
                    $("#exportModal").fadeOut(300);
                } else {
                    alert("Error: " + response.data);
                }
            },
            error: function (xhr, status, error) {
                alert("Ajax Error: " + error);
            }
        });
    });
});

