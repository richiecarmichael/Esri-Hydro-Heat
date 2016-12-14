/* -----------------------------------------------------------------------------------
   Hydro Flow Map
   Develolped by the Applications Prototype Lab
   (c) 2014 Esri | http://www.esri.com/legal/software-license  
----------------------------------------------------------------------------------- */

require([
    'esri/map',
    'esri/layers/ArcGISTiledMapServiceLayer',
    'esri/geometry/Extent',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'dojo/domReady!'
],
function (
    Map,
    ArcGISTiledMapServiceLayer,
    Extent,
    Query,
    QueryTask
    ) {
    $(document).ready(function () {
        // Enforce strict mode
        'use strict';

        // Constants
        var FPS = 20;
        var CHECKED = 'Hide Legend';
        var UNCHECKED = 'Show Legend';

        // Variables
        var _de = null;
        var _g = $('#canvas')[0].getContext('2d');
        var _base = new ArcGISTiledMapServiceLayer(_config.basemap);
        var _flares = [];
        var _hash = null;

        // Help button/window
        $('#help-button-text').html(UNCHECKED);
        $('#help-button').click(function () {
            if ($('#help-button-text').html() === CHECKED) {
                var w1 = -$('#help-window').height();
                var w2 = w1.toString() + 'px';
                $('#help-window').animate({ marginTop: w2 }, 300, 'swing', function () {
                    $('#help-button-text').html(UNCHECKED);
                });
            } else {
                $('#help-window').animate({ marginTop: '0px' }, 300, 'swing', function () {
                    $('#help-button-text').html(CHECKED);
                });
            }
        });
         
        // Create map
        var _map = new Map('map', {
            zoom: 5,
            center: [-100, 40],
            logo: false,
            showAttribution: false,
            slider: true,
            wrapAround180: false
        });
        _map.addLayers([
            _base
        ]);
        _map.on('pan-start', function () {
            reset();
        });
        _map.on('pan-end', function () {
            load();
        });
        _map.on('zoom-start', function () {
            reset();
        });
        _map.on('zoom-end', function () {
            load();
        });
        _map.on('resize', function () {
            reset();
            load();
        });
        _map.on('load', function () {
            load();
            draw();
        });

        // Initialize slider
        $('#slider').slider({
            value: 1,
            min: 1,
            max: 12,
            step: 1,
            start: function () { },
            slide: function (event, ui) {
                updateUI(ui.value);
            },
            stop: function (event, ui) {
                updateUI(ui.value);
                updateMap(ui.value);
            }
        });

        updateUI($('#slider').slider('value'));

        function updateUI(m) {
            var f = new google.visualization.DateFormat({ pattern: 'MMMM, yyyy' });
            var t = f.formatValue(new Date(2014, m - 1, 1));
            $('#bottom-date').html(t);
        }
        function updateMap(m) {
            _g.clearRect(0, 0, _map.width, _map.height);
            _flares = [];
            var level = _config.levels[_map.getLevel()];
            process(level, m);
        }

        // Reset
        function reset() {
            // Cancel previous request (if any)
            if (_de && !_de.isCanceled()) {
                _de.cancel();
            }
            _g.clearRect(0, 0, _map.width, _map.height);
            _hash = null;
            _flares = [];
        }

        // Load
        function load() {
            // D - Distance from tangent point.
            // A - Avimuth to tangent point. Angle is anticlockwise from East.
            // S - Stream order from 4 to 9 with 9 the largest.
            // V - Ten year average monthly flow.
            // B - Azimuth parallel to nearest river.
            // Fn - Average monthly flow when n is 1 to 11.

            // Find processing configuration
            var level = _config.levels[_map.getLevel()];
            if (level === null) { return; }

            // Download data
            var query = new Query();
            query.where = 'D<={0}'.format(level.buffer);
            query.outFields = [
                'B',
                'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
            ];
            query.geometry = _map.extent;
            query.returnGeometry = true;
            query.outSpatialReference = _map.spatialReference;

            var queryTask = new QueryTask(level.url);
            queryTask.execute(
                query,
                function (e) {
                    _hash = new SpatialHash(level.hash_size);
                    $.each(e.features, function () {
                        var s = _map.toScreen(this.geometry);
                        _hash.insert(s.x, s.y, this.attributes);
                    });
                    process(level, $('#slider').slider('value'));
                }
            );
        }

        function toSpeed(f) {
            if (f < 125) {
                return 0.2;
            } else if (f < 600) {
                return 0.3;
            } else if (f < 1435) {
                return 0.4;
            } else if (f < 3656) {
                return 0.6;
            } else if (f < 12565) {
                return 0.8;
            } else {
                return 1.0;
            }
        }

        function toWidth(f) {
            if (f < 125) {
                return 0.2;
            } else if (f < 600) {
                return 0.3;
            } else if (f < 1435) {
                return 0.4;
            } else if (f < 3656) {
                return 0.6;
            } else if (f < 12565) {
                return 0.8;
            } else {
                return 1.0;
            }
        }

        //
        function process(level, month) {
            while (_flares.length < level.polyline_count) {
                // Interpolate a random point on screen
                var x = Math.random() * _map.width;
                var y = Math.random() * _map.height;
                var p = interpolate(
                    x,
                    y,
                    month,
                    level.search_radius
                );
                if (p === null) {
                    continue;
                }
                var points = [{
                    x: x,
                    y: y,
                    w: null
                }];

                // Advance
                while (points.length < level.segment_count_max) {
                    var s = toSpeed(p.f);
                    p = interpolate(
                        p.x + p.dx * level.segment_length * s,
                        p.y + p.dy * level.segment_length * s,
                        month,
                        level.search_radius
                    );
                    if (p === null) {
                        break;
                    }
                    points.push({
                        x: p.x,
                        y: p.y,
                        w: toWidth(p.f)
                    });
                }
                if (points.length < level.segment_count_min) {
                    continue;
                }

                // Add flare
                _flares.push({
                    i: getRandomInt(0, points.length-2),
                    p: points
                });
            }
        }

        //
        function interpolate(x, y, m, search) {
            // Get all nearby points
            var hash = _hash.query(x, y, search);

            // Find points within search radius
            var points = [];
            var sum = 0;
            $.each(hash, function () {
                var dx = x - this.x;
                var dy = y - this.y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d > search) {
                    return true;
                }
                points.push({
                    d: d,   // Distance from x,y
                    p: this // Grid point
                });
                sum += d;
            });
            if (points.length === 0) {
                return null;
            }

            // Apply weighted average
            var o = {
                x: x,
                y: y,
                dx: 0,
                dy: 0,
                f: 0
            };
            $.each(points, function () {
                var w = points.length === 1 ? 1 : (1 - this.d / sum);
                o.dx += w * Math.sin(this.p.o.B * Math.PI / 180);
                o.dy += w * -Math.cos(this.p.o.B * Math.PI / 180);
                o.f += w * this.p.o['F{0}'.format(m)];
            });
            return o;
        }

        //        
        function draw() {
            setTimeout(function () {
                // Request animation
                requestAnimationFrame(draw);
                
                // Adjust canvas size
                if (_g.canvas.height !== _map.height) {
                    _g.canvas.height = _map.height;
                }
                if (_g.canvas.width !== _map.width) {
                    _g.canvas.width = _map.width;
                }

                // Fade previous draw
                _g.globalCompositeOperation = 'destination-in';
                _g.fillStyle = 'rgba(0, 0, 0, 0.90)';
                _g.fillRect(0, 0, _map.width, _map.height);
                _g.globalCompositeOperation = 'source-over';

                // Draw flares
                $.each(_flares, function () {
                    var p1 = this.p[this.i];
                    var p2 = this.p[this.i + 1];

                    // Draw new lines
                    _g.beginPath();
                    _g.lineWidth = p2.w;
                    _g.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    _g.moveTo(
                        p1.x,
                        p1.y
                    );
                    _g.lineTo(
                        p2.x,
                        p2.y
                    );
                    _g.stroke();

                    this.i++;
                    if (this.i === this.p.length - 1) { this.i = 0; }
                });
            }, 1000 / FPS);
        }

        // RequestAnimationFrame shim with setTimeout fallback
        // ---------------------------------------------------
        window.requestAnimFrame = (function(){
            return window.requestAnimationFrame       ||
                   window.webkitRequestAnimationFrame ||
                   window.mozRequestAnimationFrame    ||
                   function( callback ){
                       window.setTimeout(callback, 1000 / 20);
                   };
        })();

        // Spatial Hash
        // ------------
        // http://entitycrisis.blogspot.com/2011/07/spatial-hash-in-javascript-for-2d.html (derived on)
        var SpatialHash = function (cellSize) {
            this.idx = {};
            this.cellSize = cellSize;
        };
        SpatialHash.prototype.insert = function (x, y, obj) {
            var cell = [];
            var key = this.key(this.floor(x), this.floor(y));
            if (key in this.idx) {
                cell = this.idx[key];
            } else {
                this.idx[key] = cell;
            }
            var o = {
                x: x,
                y: y,
                o: obj
            };
            if (cell.indexOf(o) === -1) {
                cell.push(o);
            }
        };
        SpatialHash.prototype.query = function (x, y, r) {
            var cell = [];
            var xmin = this.floor(x - r);
            var ymin = this.floor(y - r);
            var xmax = this.floor(x + r);
            var ymax = this.floor(y + r);
            for (var i = xmin; i <= xmax; i++) {
                for (var j = ymin; j <= ymax; j++) {
                    var key = this.key(i, j);
                    if (this.idx[key] !== undefined) {
                        cell = cell.concat(this.idx[key]);
                    }
                }
            }
            return cell;
        };
        SpatialHash.prototype.floor = function (n) {
            return Math.floor(n / this.cellSize);
        };
        SpatialHash.prototype.key = function (x, y) {
            return x.toString() + ":" + y.toString();
        };

        // String Formatter
        // ----------------
        // http://stackoverflow.com/questions/1038746/equivalent-of-string-format-in-jquery/2648463#2648463
        String.prototype.format = function () {
            var s = this;
            var i = arguments.length;
            while (i--) {
                s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
            }
            return s;
        };

        // Random Integer
        // http://roshanbh.com.np/2008/09/get-random-number-range-two-numbers-javascript.html
        function getRandomInt (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    });
});