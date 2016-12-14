/* -----------------------------------------------------------------------------------
   Hydro Flow Map
   Develolped by the Applications Prototype Lab
   (c) 2014 Esri | https://www.esri.com/legal/software-license  
----------------------------------------------------------------------------------- */

require([
    'esri/map',
    'esri/layers/ArcGISTiledMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/renderers/ClassBreaksRenderer',
    'esri/renderers/UniqueValueRenderer',
    'esri/symbols/SimpleLineSymbol',
    'esri/Color',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'esri/tasks/StatisticDefinition',
    'dojo/domReady!'
],
function (
    Map,
    ArcGISTiledMapServiceLayer,
    FeatureLayer,
    ClassBreaksRenderer,
    UniqueValueRenderer,
    SimpleLineSymbol,
    Color,
    Query,
    QueryTask,
    StatisticDefinition
    ) {
    $(document).ready(function () {
        // Enforce strict mode
        'use strict';

        // Constants
        var CHECKED = 'Hide Legend';
        var UNCHECKED = 'Show Legend';
        var RIVERS = 'https://services.arcgis.com/6DIQcwlPy8knb6sg/arcgis/rest/services/HydroHierarchy/FeatureServer/0';

        // Variables
        var _mode = 'order';
        var _month = 1;
        var _base = new ArcGISTiledMapServiceLayer(_config.basemap);
        var _fl = new FeatureLayer(RIVERS, {
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: [
                'S',
                'V',
                'F1',
                'F2',
                'F3',
                'F4',
                'F5',
                'F6',
                'F7',
                'F8',
                'F9',
                'F10',
                'F11',
                'F12'
            ],
            showAttribution: false,
            showLabels: false,
            visible: true
        });
        _fl.on('load', function () {
            _fl.minScale = 0;
            _fl.maxScale = 0;
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
            _base,
            _fl
        ]);

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
                _month = ui.value;
                updateUI();
                updateMap();
            }
        });

        $('input[name="mode"]').change(function () {
            _mode = $(this).val();
            updateMap();
        });

        //
        updateUI();
        updateMap();
        createChart();
        
        function updateUI() {
            var f = new google.visualization.DateFormat({ pattern: 'MMMM, yyyy' });
            var t = f.formatValue(new Date(2014, _month - 1, 1));
            $('#bottom-date').html(t);
        }

        function updateMap() {
            var fields = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
            switch (_mode) {
                case 'order':
                    $('#legend-flow').hide();
                    $('#legend-comparison').hide();
                    $('#legend-order').show();
                    $('#bottom').hide();
                    _fl.setRenderer(getStreamOrderRenderer());
                    break;
                case 'flow':
                    $('#legend-flow').show();
                    $('#legend-comparison').hide();
                    $('#legend-order').hide();
                    $('#bottom').show();
                    _fl.setRenderer(getFlowRenderer(fields[_month - 1]));
                    break;
                case 'comparison':
                    $('#legend-flow').hide();
                    $('#legend-comparison').show();
                    $('#legend-order').hide();
                    $('#bottom').show();
                    _fl.setRenderer(getComparisonRenderer(fields[_month - 1]));
                    break;
            }
            _fl.redraw();
        }

        function getFlowRenderer(field) {
            var def = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 255, 0.5]), 0.3);
            var renderer = new ClassBreaksRenderer(def, field);
            renderer.addBreak(0, 125, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1));           // red
            renderer.addBreak(125, 600, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([250, 127, 0]), 1));       // orange
            renderer.addBreak(600, 1435, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 0]), 1));      // yellow
            renderer.addBreak(1435, 3656, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 255, 0]), 1));       // green
            renderer.addBreak(3656, 12565, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 255, 255]), 1));    // blue
            renderer.addBreak(12565, 1000000, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 255, 255]), 3)); // cyan
            return renderer;
        }

        function getComparisonRenderer(field) {
            var def = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 255, 0.5]), 0.3);
            var renderer = new ClassBreaksRenderer(def, function (f) {
                var ave = f.attributes.V;
                var per = f.attributes[field] / ave;
                per = Math.min(per, 2);
                return per;
            });
            renderer.addBreak(0.0, 0.2, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0, 1]), 1));     // Red
            renderer.addBreak(0.2, 0.4, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 51, 51, 1]), 1));
            renderer.addBreak(0.4, 0.6, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 102, 102, 1]), 1));
            renderer.addBreak(0.6, 0.8, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 153, 153, 1]), 1));
            renderer.addBreak(0.8, 1.0, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 204, 204, 1]), 1)); // Light Red
            renderer.addBreak(1.0, 1.2, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([204, 204, 255, 1]), 1)); // Light Blue
            renderer.addBreak(1.2, 1.4, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([153, 153, 255, 1]), 1));
            renderer.addBreak(1.4, 1.6, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([102, 102, 255, 1]), 1));
            renderer.addBreak(1.6, 1.8, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([51, 51, 255, 1]), 1));
            renderer.addBreak(1.8, 2.0, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 255, 1]), 1));     // Blue
            return renderer;
        }

        function getStreamOrderRenderer() {
            var def = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 255, 0.5]), 0.3);
            var renderer = new UniqueValueRenderer(def, 'S');
            renderer.addValue(4, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([197, 0, 255, 1]), 1)); // purple
            renderer.addValue(5, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([197, 0, 255, 1]), 1)); // purple
            renderer.addValue(6, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0, 1]), 1));   // red
            renderer.addValue(7, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([250, 127, 0, 1]), 1)); // orange
            renderer.addValue(8, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 0, 1]), 1.5)); // yellow
            renderer.addValue(9, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 255, 0, 1]), 2));   // green
            return renderer;
        }

        function createChart() {
            var sds = [];
            for (var i = 0; i < 12; i++) {
                var sd = new StatisticDefinition();
                sd.statisticType = 'avg';
                sd.onStatisticField = 'F' + (i + 1).toString();
                sd.outStatisticFieldName = 'A' + i.toString();
                sds.push(sd);
            }
            var sd2 = new StatisticDefinition();
            sd2.statisticType = 'avg';
            sd2.onStatisticField = 'V';
            sd2.outStatisticFieldName = 'T';
            sds.push(sd2);

            var query = new Query();
            query.where = '1=1';
            query.outStatistics = sds;
            var queryTask = new QueryTask(_config.rivers);
            queryTask.execute(query, function (r) {
                var formatter = new google.visualization.DateFormat({ pattern: 'MMMMM' });
                var data = [['Month', 'Average Flow', 'Ten Year Average']];
                var ten = Math.round(r.features[0].attributes.T);
                for (var i = 0; i < 12; i++) {
                    var month = formatter.formatValue(new Date(2000, i, 1));
                    var value = r.features[0].attributes['A' + i.toString()];
                    data.push([month, value, ten]);
                }
                var chart = new google.visualization.ComboChart(
                    document.getElementById('legend-chart')
                );
                var options = {
                    bar: { groupWidth: '90%' },
                    legend: {
                        position: 'bottom',
                        maxLines: 2,
                        textStyle: {
                            color: 'white'
                        }
                    },
                    width: 280,
                    height: 250,
                    backgroundColor: 'transparent',
                    fontName: 'Avenir LT W01 35 Light',
                    fontSize: 11,
                    colors: ['orange', 'red'],
                    orientation: 'horizontal',
                    title: '2014 vs Ten Year Average',
                    titlePosition: 'out',
                    titleTextStyle: {
                        color: 'white',
                        fontSize: 18,
                        bold: false
                    },
                    seriesType: 'bars',
                    series: {
                        1: {
                            type: "line"
                        }
                    },
                    tooltip: {
                        trigger: 'focus'
                    },
                    hAxis: {
                        textStyle: {
                            color: 'white'
                        },
                        title: 'Month',
                        titleTextStyle: {
                            color: 'white'
                        }
                    },
                    vAxis: {
                        textStyle: {
                            color: 'white'
                        },
                        title: 'Flow (m³/second)',
                        titleTextStyle: {
                            color: 'white'
                        },
                        format: '#,###'
                    }
                };
                chart.draw(google.visualization.arrayToDataTable(data), options);
            });
        }
    });
});
