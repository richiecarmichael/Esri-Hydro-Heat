require([
    'esri/map',
    'esri/layers/ArcGISTiledMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/geometry/Extent',
    'esri/tasks/Geoprocessor',
    'dojo/dom',
    'dojo/domReady!'
],
function (
    Map,
    ArcGISTiledMapServiceLayer,
    FeatureLayer,
    Extent,
    Geoprocessor,
    dom
    ) {
    $(document).ready(function () {
        var BUFFER = 2;      //  5;
        var GRID = 4;        // 10;
        var SEARCH = 6;      // 20;
        var FRAME_RATE = 20;
        var SEGMENTS = 20;
        var XMIN = -13964271;
        var SPEED = 1;
        var FLOW = 'https://maps.esri.com/apl15/rest/services/RiverFlow/RiverFlow/GPServer/RiverFlow';
        var BASEMAP = 'https://tiles4.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Dark_Gray_Base_Beta/MapServer';
        var month = 1;
        var display = 1;

        String.prototype.format = function () {
            var s = this;
            var i = arguments.length;
            while (i--) {
                s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
            }
            return s;
        };

        // Create map
        var map = new Map('map', {
            extent: new Extent({
                xmin: -13964271,
                ymin: 2710429,
                xmax: -7927581,
                ymax: 6976227,
                spatialReference: {
                    wkid: 102100
                }
            })
        });
        map.addLayers([
            new ArcGISTiledMapServiceLayer(BASEMAP)
        ]);
        map.on('pan-start', reset);
        map.on('zoom-start', reset);
        map.on('resize', load);
        map.on('extent-change', load);

        var de = null;
        var timer = null;
        var canvas = dom.byId('canvas');
        var g = canvas.getContext('2d');
        var strokes = [];

        function reset() {
            // Cancel previous request (if any)
            if (de && !de.isCanceled()) {
                de.cancel();
            }

            // Stop and clear animation
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            strokes = [];
            g.clearRect(0, 0, map.width, map.height);
        }

        function load() {
            // --------------------------- DISABLE? ---------------------------
            //$('#footer').css('display', 'block');
            //$('#progress').css('display', 'none');
            //$('#progress-bar-text').html('');
            //return;
            // ----------------------------------------------------------------
            var shift = null;

            // Stop and clear animation
            reset();

            //
            $('#footer').css('display', 'none');
            $('#progress').css('display', 'block');
            $('#progress-bar-text').html('Downloading...');

            // Cancel previous request (if any)
            if (de && !de.isCanceled()) {
                de.cancel();
            }

            // Build parameter for gp request        
            var params = {
                xMin: map.extent.xmin,
                yMin: map.extent.ymin,
                xMax: map.extent.xmax,
                yMax: map.extent.ymax,
                SR_WKID: map.extent.spatialReference.wkid,
                Display_Width__Pixels_: map.width,
                Display_Height__Pixels_: map.height,
                Grid_Spacing__Pixels_: GRID,
                Stream_Buffer__Pixels_: BUFFER
            };

            if (map.extent.xmin < XMIN && map.extent.xmax > XMIN) {
                // map units per pixel
                var scale = (map.extent.xmax - map.extent.xmin) / map.width;
                var diff_map = XMIN - params.xMin;
                shift = Math.round(diff_map / scale);
                params.xMin = XMIN;
                params.Display_Width__Pixels_ = map.width - shift;
            }

            // Request hydro data
            var gp = new Geoprocessor(FLOW);
            gp.setOutSpatialReference(map.spatialReference);
            de = gp.execute(params,
                function (results) {
                    $('#footer').css('display', 'none');
                    $('#progress').css('display', 'block');
                    $('#progress-bar-text').html('Processing...');

                    var vectors = [];
                    var result = results[0];
                    if (!result || !result.value || result.value.length == 0) { return; }
                    result.value.forEach(function (element) {
                        var x = element[0]; // x
                        var y = element[1]; // y
                        var a = element[2]; // azimuth
                        var m = element[3]; // 10 year average
                        var f = element[4]; // array of flows
                        var p = element[5]; // array of percentage ten year average flows
                        vectors.push({
                            x: (shift) ? x + shift : x,
                            y: y,
                            dx: Math.sin(a * Math.PI / 180),
                            dy: -Math.cos(a * Math.PI / 180),
                            f: f,
                            p: p
                        });
                    });

                    for (var q = 0; q < vectors.length; q++) {
                        var vq = vectors[q];
                        var locations = [];

                        var nears = [];
                        for (var w = 0; w < vectors.length; w++) {
                            var near = vectors[w];
                            var dx = vq.x - near.x;
                            var dy = vq.y - near.y;
                            if (dx == 0 && dy == 0) {
                                nears.push(near);
                                continue;
                            }
                            var py = Math.sqrt(dx * dx + dy * dy);
                            if (py <= SEGMENTS * SPEED + SEARCH) {
                                nears.push(near);
                            }
                        };

                        for (var j = 0; j < SEGMENTS; j++) {
                            // Seed
                            if (j == 0) {
                                locations.push({
                                    x: vq.x,
                                    y: vq.y,
                                    f1: magnitudeToWidth(vq.f[0]),
                                    f2: magnitudeToWidth(vq.f[1]),
                                    f3: magnitudeToWidth(vq.f[2]),
                                    f4: magnitudeToWidth(vq.f[3]),
                                    f5: magnitudeToWidth(vq.f[4]),
                                    f6: magnitudeToWidth(vq.f[5]),
                                    f7: magnitudeToWidth(vq.f[6]),
                                    f8: magnitudeToWidth(vq.f[7]),
                                    f9: magnitudeToWidth(vq.f[8]),
                                    f10: magnitudeToWidth(vq.f[9]),
                                    f11: magnitudeToWidth(vq.f[10]),
                                    f12: magnitudeToWidth(vq.f[11]),
                                    p1: percentageToColor(vq.p[0]),
                                    p2: percentageToColor(vq.p[1]),
                                    p3: percentageToColor(vq.p[2]),
                                    p4: percentageToColor(vq.p[3]),
                                    p5: percentageToColor(vq.p[4]),
                                    p6: percentageToColor(vq.p[5]),
                                    p7: percentageToColor(vq.p[6]),
                                    p8: percentageToColor(vq.p[7]),
                                    p9: percentageToColor(vq.p[8]),
                                    p10: percentageToColor(vq.p[9]),
                                    p11: percentageToColor(vq.p[10]),
                                    p12: percentageToColor(vq.p[11])
                                });
                                continue;
                            }

                            var previous = locations[j - 1];

                            // Interpolate
                            var arms = [];
                            var sum = 0;
                            for (var i = 0; i < nears.length; i++) {
                                var v = nears[i];
                                var dx = previous.x - v.x;
                                var dy = previous.y - v.y;
                                if (dx == 0 && dy == 0) {
                                    arms = [];
                                    arms.push({
                                        offset: 0,
                                        vector: v
                                    });
                                    sum = 1;
                                    break;
                                }
                                var py = Math.sqrt(dx * dx + dy * dy);
                                if (py > SEARCH) {
                                    continue;
                                }
                                arms.push({
                                    offset: py,
                                    vector: v
                                });
                                sum += py;
                            };
                            if (arms.length == 0) {
                                break;
                            }

                            var location = {
                                x: previous.x,
                                y: previous.y,
                                f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0, f8: 0, f9: 0, f10: 0, f11: 0, f12: 0,
                                p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0, p9: 0, p10: 0, p11: 0, p12: 0
                            };
                            arms.forEach(function (arm) {
                                var w = (1 - arm.offset / sum);
                                location.x += w * arm.vector.dx * SPEED;
                                location.y += w * arm.vector.dy * SPEED;
                                location.f1 += w * arm.vector.f[0];
                                location.f2 += w * arm.vector.f[1];
                                location.f3 += w * arm.vector.f[2];
                                location.f4 += w * arm.vector.f[3];
                                location.f5 += w * arm.vector.f[4];
                                location.f6 += w * arm.vector.f[5];
                                location.f7 += w * arm.vector.f[6];
                                location.f8 += w * arm.vector.f[7];
                                location.f9 += w * arm.vector.f[8];
                                location.f10 += w * arm.vector.f[9];
                                location.f11 += w * arm.vector.f[10];
                                location.f12 += w * arm.vector.f[11];
                                location.p1 += w * arm.vector.p[0];
                                location.p2 += w * arm.vector.p[1];
                                location.p3 += w * arm.vector.p[2];
                                location.p4 += w * arm.vector.p[3];
                                location.p5 += w * arm.vector.p[4];
                                location.p6 += w * arm.vector.p[5];
                                location.p7 += w * arm.vector.p[6];
                                location.p8 += w * arm.vector.p[7];
                                location.p9 += w * arm.vector.p[8];
                                location.p10 += w * arm.vector.p[9];
                                location.p11 += w * arm.vector.p[10];
                                location.p12 += w * arm.vector.p[11];
                            });

                            location.f1 = magnitudeToWidth(location.f1);
                            location.f2 = magnitudeToWidth(location.f2);
                            location.f3 = magnitudeToWidth(location.f3);
                            location.f4 = magnitudeToWidth(location.f4);
                            location.f5 = magnitudeToWidth(location.f5);
                            location.f6 = magnitudeToWidth(location.f6);
                            location.f7 = magnitudeToWidth(location.f7);
                            location.f8 = magnitudeToWidth(location.f8);
                            location.f9 = magnitudeToWidth(location.f9);
                            location.f10 = magnitudeToWidth(location.f10);
                            location.f11 = magnitudeToWidth(location.f11);
                            location.f12 = magnitudeToWidth(location.f12);

                            location.p1 = percentageToColor(location.p1);
                            location.p2 = percentageToColor(location.p2);
                            location.p3 = percentageToColor(location.p3);
                            location.p4 = percentageToColor(location.p4);
                            location.p5 = percentageToColor(location.p5);
                            location.p6 = percentageToColor(location.p6);
                            location.p7 = percentageToColor(location.p7);
                            location.p8 = percentageToColor(location.p8);
                            location.p9 = percentageToColor(location.p9);
                            location.p10 = percentageToColor(location.p10);
                            location.p11 = percentageToColor(location.p11);
                            location.p12 = percentageToColor(location.p12);

                            locations.push(location);

                            function magnitudeToWidth(m) {
                                if (m == 0) {
                                    return 0;
                                }
                                if (m <= 15000) {
                                    return 0.8; // 0.2;
                                }
                                if (m <= 60000) {
                                    return 1.2; //  0.3;
                                }
                                if (m <= 135000) {
                                    return 2.0; // 0.5;
                                }
                                if (m <= 300000) {
                                    return 2.8; //  0.7;
                                }
                                return 4; // 1; //  ~750,000
                            };

                            function percentageToColor(m) {
                                var v1 = Math.max(Math.min(m, 200), 0);
                                var v2 = -0.0001 * v1 * v1 + 0.02 * v1 + 0;
                                var r = v1 <= 100 ? 255 * v2 : 255;
                                var g = 255 * v2;
                                var b = v1 <= 100 ? 255 : 255 * v2;

                                return 'rgba({0},{1},{2},0.5)'.format(
                                    parseInt(b).toString(),
                                    parseInt(g).toString(),
                                    parseInt(r).toString()
                                );
                            }
                        }
                        strokes.push({
                            locations: locations,
                            age: Math.floor(Math.random() * locations.length + 1)
                        });
                    };

                    vectors = null;
                    draw();

                    $('#footer').css('display', 'block');
                    $('#progress').css('display', 'none');
                    $('#progress-bar-text').html('');
                },
                function (e) {
                    if (e.dojoType == 'cancel') { return; }
                    console.error(e);
                }
            );
        };

        function draw() {
            try {
                timer = setTimeout(function () {
                    // Request animation
                    requestAnimationFrame(draw);

                    // Adjust canvas size
                    if (g.canvas.height != map.height) {
                        g.canvas.height = map.height;
                    }
                    if (g.canvas.width != map.width) {
                        g.canvas.width = map.width;
                    }

                    // Fade previous draw
                    g.globalCompositeOperation = 'destination-in';
                    g.fillStyle = 'rgba(0, 0, 0, 0.90)';
                    g.fillRect(0, 0, map.width, map.height);
                    g.globalCompositeOperation = 'source-over';

                    // Draw new lines
                    strokes.forEach(function (stoke) {
                        if (stoke.locations.length < 2) { return; }
                        if (stoke.age + 2 > stoke.locations.length) { stoke.age = 0; }

                        // Width
                        var width = 0;
                        switch (month) {
                            case 1:
                                width = stoke.locations[stoke.age].f1;
                                break;
                            case 2:
                                width = stoke.locations[stoke.age].f2;
                                break;
                            case 3:
                                width = stoke.locations[stoke.age].f3;
                                break;
                            case 4:
                                width = stoke.locations[stoke.age].f4;
                                break;
                            case 5:
                                width = stoke.locations[stoke.age].f5;
                                break;
                            case 6:
                                width = stoke.locations[stoke.age].f6;
                                break;
                            case 7:
                                width = stoke.locations[stoke.age].f7;
                                break;
                            case 8:
                                width = stoke.locations[stoke.age].f8;
                                break;
                            case 9:
                                width = stoke.locations[stoke.age].f9;
                                break;
                            case 10:
                                width = stoke.locations[stoke.age].f10;
                                break;
                            case 11:
                                width = stoke.locations[stoke.age].f11;
                                break;
                            case 12:
                                width = stoke.locations[stoke.age].f12;
                                break;
                        }

                        // Color
                        var color = 'rgba(255, 255, 255, 0.5)';
                        if (display == 2) {
                            switch (month) {
                                case 1:
                                    color = stoke.locations[stoke.age].p1;
                                    break;
                                case 2:
                                    color = stoke.locations[stoke.age].p2;
                                    break;
                                case 3:
                                    color = stoke.locations[stoke.age].p3;
                                    break;
                                case 4:
                                    color = stoke.locations[stoke.age].p4;
                                    break;
                                case 5:
                                    color = stoke.locations[stoke.age].p5;
                                    break;
                                case 6:
                                    color = stoke.locations[stoke.age].p6;
                                    break;
                                case 7:
                                    color = stoke.locations[stoke.age].p7;
                                    break;
                                case 8:
                                    color = stoke.locations[stoke.age].p8;
                                    break;
                                case 9:
                                    color = stoke.locations[stoke.age].p9;
                                    break;
                                case 10:
                                    color = stoke.locations[stoke.age].p10;
                                    break;
                                case 11:
                                    color = stoke.locations[stoke.age].p11;
                                    break;
                                case 12:
                                    color = stoke.locations[stoke.age].p12;
                                    break;
                            }
                        }
                        g.beginPath();
                        g.lineWidth = width == 0 ? 0.1 : width;
                        g.strokeStyle = color;
                        g.moveTo(
                            stoke.locations[stoke.age].x,
                            stoke.locations[stoke.age].y
                        );
                        g.lineTo(
                            stoke.locations[stoke.age + 1].x,
                            stoke.locations[stoke.age + 1].y
                        );
                        g.stroke();

                        // Age line
                        stoke.age++;
                    });
                }, 1000 / FRAME_RATE);
            }
            catch (e) {
                console.error(e);
            }
        };

        window.requestAnimationFrame = (function () {
            return window.requestAnimationFrame ||
                   window.webkitRequestAnimationFrame ||
                   window.mozRequestAnimationFrame ||
                   window.oRequestAnimationFrame ||
                   window.msRequestAnimationFrame ||
                   function (callback) {
                       window.setTimeout(callback, 1000 / 20);
                   };
        }
        )();

        // Help button/window
        var CHECKED = 'Hide Help';
        var UNCHECKED = 'Show Help';
        $('#help-window').css('marginTop', function () {
            var x1 = $('#help-button').height() - $('#help-window').height();
            var x2 = x1.toString() + 'px';
            return x2;
        });
        $('#help-button-text').html(UNCHECKED);
        $('#help-button').click(function () {
            if ($('#help-button-text').html() == CHECKED) {
                var w1 = $('#help-button').height() - $('#help-window').height();
                var w2 = w1.toString() + 'px';
                $('#help-window').animate({ marginTop: w2 }, 300, 'swing', function () {
                    $('#help-button-text').html(UNCHECKED);
                });
            }
            else {
                var w1 = $('#help-button').height();
                var w2 = w1.toString() + 'px';
                $('#help-window').animate({ marginTop: w2 }, 300, 'swing', function () {
                    $('#help-button-text').html(CHECKED);
                });
            }
        });

        // Radio buttons
        $('#month1').parent().addClass('active');
        $('#display1').parent().addClass('active');
        $('#months > .btn, .btn[data-toggle="button"]').click(function () {
            month = $(this).index() + 1;
        });
        $('#displays > .btn, .btn[data-toggle="button"]').click(function () {
            display = $(this).index() + 1;
        });
    });
});
