/* eslint-disable */
// @ts-nocheck
HTMLWidgets.widget({

    name: "parallelPlot",

    type: "output",

    factory: function(el, width, height) {
        function js2RIndex(index) {
            return (index !== null) ? index + 1 : index;
        }

        function r2JsIndex(index) {
            return (index !== null) ? index - 1 : index;
        }

        const parallelPlot = new ParallelPlot(el.id, width, height);

        return {
            renderValue: function(config) {
                // Add a reference to the widget from the HTML element
                document.getElementById(parallelPlot.id()).widget = this;

                // If htmlwidget is included in Shiny app, listen JavaScript messages sent from Shiny
                if (HTMLWidgets.shinyMode) {
                    ["setContinuousColorScale", "setCategoricalColorScale", "setHistoVisibility", "setCutoffs", "setKeptColumns", "getValue", "changeRow"].forEach(func => {
                        Shiny.addCustomMessageHandler("parallelPlot:" + func, function(message) {
                            var el = document.getElementById(message.id);
                            if (el) {
                                el.widget[func](message);
                            }
                        });
                    });

                    // Listen event sent by the parallelPlot
                    const eventInputId = config.eventInputId !== null ? config.eventInputId : ParallelPlot.PLOT_EVENT;
                    parallelPlot.on(ParallelPlot.PLOT_EVENT, function (event) {
                        if (event.type === ParallelPlot.EDITION_EVENT) {
                            event.value.rowIndex = js2RIndex(event.value.rowIndex);
                        }
                        if (event.type === ParallelPlot.CUTOFF_EVENT) {
                            event.value.selectedTraces = event.value.selectedTraces.map(js2RIndex);
                        }
                        // Forward 'event' to Shiny through the reactive input 'eventInputId'
                        Shiny.setInputValue(eventInputId, event, {priority: "event"});
                    });
                }

                parallelPlot.generate({
                    data: HTMLWidgets.dataframeToD3(config.data),
                    categorical: config.categorical,
                    inputColumns: config.inputColumns,
                    keptColumns: config.keptColumns,
                    histoVisibility : config.histoVisibility,
                    cutoffs: config.cutoffs,
                    refRowIndex : r2JsIndex(config.refRowIndex),
                    refColumnDim : config.refColumnDim,
                    rotateTitle : config.rotateTitle,
                    columnLabels : config.columnLabels,
                    continuousCS : config.continuousCS,
                    categoricalCS : config.categoricalCS,
                    editionMode : config.editionMode
                });
            }, // End 'renderValue'

            setContinuousColorScale: function(params) {
                parallelPlot.setContinuousColorScale(params.continuousCsId);
            },

            setCategoricalColorScale: function(params) {
                parallelPlot.setCategoricalColorScale(params.categoricalCsId);
            },

            setHistoVisibility: function(params) {
                parallelPlot.setHistoVisibility(params.histoVisibility);
            },

            setCutoffs: function(params) {
                parallelPlot.setCutoffs(params.cutoffs);
            },

            setKeptColumns: function(params) {
                parallelPlot.setKeptColumns(params.keptColumns);
            },

            getValue: function(params) {
                if (HTMLWidgets.shinyMode) {
                    let value = parallelPlot.getValue(params.attrType);
                    if (params.attrType === ParallelPlot.ST_ATTR_TYPE) {
                        value = value.map(js2RIndex);
                    }
                    if (value === null) {
                        // TODO: Find how to manage 'null' value
                        value = "NULL";
                    }
                    Shiny.setInputValue(params.valueInputId, value, {priority: "event"});
                }
            },

            changeRow: function(params) {
                parallelPlot.changeRow(r2JsIndex(params.rowIndex), params.newValues);
            },

            resize: function(width, height) {
                parallelPlot.resize(width, height);
            }
        };
    } // End 'factory'
});
