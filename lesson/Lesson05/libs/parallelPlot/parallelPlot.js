"use strict";
// eslint-disable-next-line no-unused-vars
class ParallelPlot {
    constructor(id, width, height) {
        this.width = 0;
        this.height = 0;
        this.axeHeight = 0;
        this.sampleData = [];
        this.dimensions = [];
        this.visibleColumnsLimit = 15;
        this.visibleDimensions = [];
        this.selectedRows = new Set();
        this.continuousCsId = ParallelPlot.CONTINUOUS_CS_IDS[0];
        this.categoricalCsId = ParallelPlot.CATEGORIAL_CS_IDS[0];
        this.refColumnDim = null;
        this.colorScale = null;
        this.columns = {}; // Column for each dimension
        this.editedRowIndex = null;
        this.editedPointDim = null;
        this.editionMode = ParallelPlot.EDITION_ON_DRAG_END;
        /**
         * Position of each dimension in X in the drawing domain
         */
        this.xScaleVisibleDimension = d3.scalePoint();
        this.xScaleDimension = d3.scalePoint();
        this.xScaleDimensionInvertFn = d3.scaleQuantize();
        this.refRowIndex = null;
        this.dispatch = d3.dispatch(ParallelPlot.PLOT_EVENT);
        this.rotateTitle = false;
        this.catSpreaderMap = new Map();
        this.bindto = "#" + id;
        this.width = width ? width : 1200;
        this.height = height ? height : 600;
    }
    id() {
        return this.bindto.substring(1);
    }
    resize(width, height) {
        this.width = width ? width : 1200;
        this.height = height ? height : 600;
        d3.select(this.bindto + " svg")
            .attr("width", this.width)
            .attr("height", this.height);
        this.buildXScale();
        d3.select(this.bindto + " .slider .axisGroup").remove();
        d3.select(this.bindto + " .slider .brushDim").remove();
        new BrushSlider(this);
        this.buildPlotArea();
    }
    // eslint-disable-next-line max-lines-per-function
    generate(config) {
        const thisPlot = this;
        this.visibleColumnsLimit = 15;
        this.refRowIndex = config.refRowIndex;
        this.axeHeight =
            this.height - ParallelPlot.margin.top - ParallelPlot.margin.bottom;
        if (this.refRowIndex !== null) {
            this.axeHeight = this.axeHeight / 2;
        }
        this.rotateTitle = config.rotateTitle === null ? false : config.rotateTitle;
        this.initSampleData(config);
        const allDimensions = d3.keys(this.sampleData[0]);
        allDimensions.forEach((dim, i) => {
            const isInput = config.inputColumns === null ? true : config.inputColumns[i];
            this.columns[dim] = new Column(dim, i, this, config.columnLabels === null ? dim : config.columnLabels[i], config.categorical ? config.categorical[i] : null, config.cutoffs ? config.cutoffs[i] : null, config.histoVisibility === null ? false : config.histoVisibility[i], isInput ? Column.INPUT : Column.OUTPUT);
        });
        const nanColumns = allDimensions.map(dim => this.sampleData.every(row => isNaN(row[dim])));
        this.dimensions = allDimensions.filter((_dim, i) => !nanColumns[i] && (config.keptColumns === null || config.keptColumns[i]));
        if (config.refColumnDim === null) {
            this.refColumnDim = null;
        }
        else {
            if (this.dimensions.includes(config.refColumnDim)) {
                this.refColumnDim = config.refColumnDim;
            }
            else {
                console.log("Unknown 'refColumnDim': " + config.refColumnDim);
            }
        }
        this.updateSelectedRows();
        if (ParallelPlot.CONTINUOUS_CS_IDS.includes(config.continuousCS)) {
            this.continuousCsId = config.continuousCS;
        }
        else {
            console.log("Unknown continuous color scale: " + config.continuousCS);
        }
        if (ParallelPlot.CATEGORIAL_CS_IDS.includes(config.categoricalCS)) {
            this.categoricalCsId = config.categoricalCS;
        }
        else {
            console.log("Unknown categorical color scale: " + config.categoricalCS);
        }
        if (ParallelPlot.EDITION_MODE_IDS.includes(config.editionMode)) {
            this.editionMode = config.editionMode;
        }
        else {
            console.log("Unknown edition mode: " + config.editionMode);
        }
        d3.select(this.bindto).style("position", "relative");
        d3.select(this.bindto).select("svg").remove();
        d3.select(this.bindto).selectAll("div").remove();
        const svg = d3.select(this.bindto).append("svg")
            .attr("width", this.width)
            .attr("height", this.height);
        this.addGlow();
        const plotGroup = svg.append("g")
            .attr("class", "plotGroup")
            .attr("transform", "translate(" +
            ParallelPlot.margin.left + "," +
            ParallelPlot.margin.top + ")");
        this.setColorScale();
        svg.append("g")
            .attr("class", "slider")
            .attr("transform", "translate(" +
            ParallelPlot.margin.left + "," +
            ParallelPlot.margin.top / 4.0 + ")");
        // Path of the background
        plotGroup.append("g")
            .attr("class", "background")
            .attr("opacity", "0.1");
        // Path of the foreground
        plotGroup.append("g")
            .attr("class", "foreground")
            .attr("opacity", "0.8");
        plotGroup.append("g")
            .attr("class", "columns");
        if (this.dimensions.length < this.visibleColumnsLimit) {
            this.visibleColumnsLimit = this.dimensions.length;
        }
        // Build Visible Dimension
        this.visibleDimensions = this.dimensions.slice(0, this.visibleColumnsLimit);
        this.buildXScale();
        new BrushSlider(this);
        this.buildPlotArea();
        plotGroup.append("path")
            .attr("class", "subHlTrace")
            .attr("d", this.path(0))
            .attr("stroke-width", 3)
            .attr("fill", "none")
            .attr("pointer-events", "none")
            .style("display", "none")
            .style("filter", "url(#glow)");
        plotGroup.append("path")
            .attr("class", "hlTrace")
            .attr("d", this.path(0))
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("pointer-events", "none")
            .style("display", "none");
        plotGroup.append("path")
            .attr("class", "subEditedTrace")
            .attr("d", this.path(0))
            .attr("stroke-width", 3)
            .attr("opacity", "0.8")
            .attr("fill", "none")
            .attr("pointer-events", "none")
            .style("display", "none")
            .style("filter", "url(#glow)");
        plotGroup.append("path")
            .attr("class", "editedTrace")
            .attr("d", this.path(0))
            .attr("opacity", "0.8")
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .style("display", "none")
            .on("click", function () {
            thisPlot.editedRowIndex = null;
            thisPlot.drawEditedTrace();
        });
        plotGroup.append("g")
            .attr("class", "editionCircles")
            .style("display", "none");
        this.changeColorMap();
    }
    addGlow() {
        const svg = d3.select(this.bindto + " svg");
        //Container for the gradients
        const defs = svg.append("defs");
        //Filter for the outside glow
        const filter = defs.append("filter").attr("id", "glow");
        filter.append("feGaussianBlur")
            .attr("stdDeviation", "3.5")
            .attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    buildXScale() {
        this.xScaleVisibleDimension
            .domain(this.visibleDimensions)
            .range([0, this.width - ParallelPlot.margin.left - ParallelPlot.margin.right])
            .padding(1);
        this.xScaleDimension
            .domain(this.dimensions)
            .range([0, this.width - ParallelPlot.margin.left - ParallelPlot.margin.right]);
        this.xScaleDimensionInvertFn
            .domain([0, this.width - ParallelPlot.margin.left - ParallelPlot.margin.right])
            .range(this.dimensions);
    }
    on(type, callback) {
        // @ts-ignore
        this.dispatch.on(type, callback);
    }
    initSampleData(config) {
        const data = config.data;
        const thisPlot = this;
        this.sampleData = [];
        data.forEach(function (r) {
            const curRow = {};
            d3.keys(r).forEach((dim, i) => {
                const categories = config.categorical ? config.categorical[i] : null;
                if (categories === null) {
                    curRow[dim] = +r[dim];
                }
                else {
                    let catIndex = categories.indexOf(r[dim]);
                    if (catIndex === -1) {
                        catIndex = categories.indexOf(r[dim].toString());
                    }
                    curRow[dim] = (catIndex === -1) ? NaN : catIndex;
                }
            });
            thisPlot.sampleData.push(curRow);
        });
    }
    catScaledValue(dim, rowIndex) {
        return this.columns[dim].catScaledValue(rowIndex);
    }
    rowColor(row) {
        if (this.refColumnDim === null) {
            return "#03306B";
        }
        else {
            if (this.colorScale === null) {
                console.log("Cant't retrieve a color for a row (no color scale defined)");
                return "#03306B";
            }
            return this.colorScale(row[this.refColumnDim]);
        }
    }
    valueColor(value) {
        if (this.colorScale === null) {
            console.log("Cant't retrieve a color for a value (no color scale defined)");
            return "#03306B";
        }
        return this.colorScale(value);
    }
    changeColorMapOnDimension(d) {
        this.refColumnDim = (d === this.refColumnDim) ? null : d;
        this.changeColorMap();
    }
    setContinuousColorScale(continuousCsId) {
        if (ParallelPlot.CONTINUOUS_CS_IDS.includes(continuousCsId)) {
            this.continuousCsId = continuousCsId;
            this.changeColorMap();
        }
        else {
            console.log("Unknown continuous color scale: " + continuousCsId);
        }
    }
    setCategoricalColorScale(categoricalCsId) {
        if (ParallelPlot.CATEGORIAL_CS_IDS.includes(categoricalCsId)) {
            this.categoricalCsId = categoricalCsId;
            this.changeColorMap();
        }
        else {
            console.log("Unknown categorical color scale: " + categoricalCsId);
        }
    }
    setHistoVisibility(histoVisibility) {
        const thisPlot = this;
        d3.keys(this.sampleData[0]).forEach(function (dim, i) {
            if (Array.isArray(histoVisibility)) {
                thisPlot.columns[dim].histoVisible = histoVisibility[i];
            }
            else {
                if (typeof histoVisibility[dim] === "undefined") {
                    return;
                }
                thisPlot.columns[dim].histoVisible = histoVisibility[dim];
            }
            thisPlot.drawMainHistograms();
            thisPlot.drawSelectedHistograms();
        });
    }
    setCutoffs(cutoffs) {
        const thisPlot = this;
        d3.keys(this.sampleData[0]).forEach(function (dim, i) {
            if (cutoffs === null) {
                thisPlot.columns[dim].rowFilter.setCutoffs(null);
            }
            else if (Array.isArray(cutoffs)) {
                thisPlot.columns[dim].rowFilter.setCutoffs(cutoffs[i]);
            }
            else {
                if (typeof cutoffs[dim] === "undefined") {
                    return;
                }
                thisPlot.columns[dim].rowFilter.setCutoffs(cutoffs[dim]);
            }
            thisPlot.columns[dim].initMultiBrush();
            thisPlot.columns[dim].applyCategoricalCutoffs();
        });
        thisPlot.applyColumnCutoffs();
    }
    setKeptColumns(keptColumns) {
        const thisPlot = this;
        if (Array.isArray(keptColumns)) {
            this.dimensions = d3.keys(this.sampleData[0]).filter((_dim, i) => keptColumns[i]);
        }
        else {
            this.dimensions = d3.keys(this.sampleData[0]).filter(function (dim) {
                let toKeep = thisPlot.dimensions.includes(dim);
                if (typeof keptColumns[dim] !== "undefined") {
                    toKeep = keptColumns[dim];
                }
                return toKeep;
            });
        }
        this.visibleDimensions = this.dimensions.slice(0, this.visibleColumnsLimit);
        this.buildXScale();
        d3.select(this.bindto + " .slider .axisGroup").remove();
        d3.select(this.bindto + " .slider .brushDim").remove();
        new BrushSlider(this);
        this.buildPlotArea();
    }
    getValue(attrType) {
        const thisPlot = this;
        if (attrType === ParallelPlot.CO_ATTR_TYPE) {
            const coMap = new Map();
            d3.keys(this.sampleData[0])
                .forEach(function (dim) {
                const extents = thisPlot.columns[dim].rowFilter.getCutoffs();
                if (extents !== null) {
                    coMap.set(dim, extents);
                }
            });
            const cutoffs = {};
            for (const [dim, co] of coMap) {
                cutoffs[dim] = co;
            }
            return cutoffs;
        }
        if (attrType === ParallelPlot.ST_ATTR_TYPE) {
            return [...this.selectedRows];
        }
        if (attrType === ParallelPlot.RC_ATTR_TYPE) {
            return this.refColumnDim;
        }
        throw new Error("'getValue' called with an unknown attrType: " + attrType);
    }
    setColorScale() {
        if (this.refColumnDim !== null) {
            if (this.columns[this.refColumnDim].categories === null) {
                const [yRefMin, yRefMax] = this.columns[this.refColumnDim].y().domain();
                this.colorScale = d3.scaleSequential(ParallelPlot.CONTINUOUS_CS[this.continuousCsId])
                    .domain([yRefMin, yRefMax]);
            }
            else {
                const yRefMax = this.columns[this.refColumnDim].y().domain()[1];
                this.colorScale = ParallelPlot.CATEGORIAL_CS[this.categoricalCsId]
                    .domain(d3.range(yRefMax));
            }
        }
    }
    // eslint-disable-next-line max-lines-per-function
    changeColorMap() {
        const thisPlot = this;
        this.setColorScale();
        d3.select(this.bindto + " .foreground")
            .selectAll("path")
            .transition()
            .duration(1500)
            .attr("stroke", function (row) {
            return thisPlot.rowColor(row);
        });
        d3.select(this.bindto + " .background")
            .selectAll("path")
            .transition()
            .duration(1500)
            .attr("stroke", function (row) {
            return thisPlot.rowColor(row);
        });
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".dimension")
            .each(function (dim) {
            if (dim === thisPlot.refColumnDim) {
                d3.select(this).selectAll(".category")
                    .transition()
                    .duration(1500)
                    .attr("fill", function (_d, i) {
                    return thisPlot.valueColor(i);
                });
            }
            else {
                d3.select(this).selectAll(".category")
                    .transition()
                    .duration(1500)
                    .attr("fill", "black");
            }
        });
        if (this.editedRowIndex !== null) {
            const stroke = thisPlot.selectedRows.has(this.editedRowIndex) ? thisPlot.rowColor(thisPlot.sampleData[this.editedRowIndex]) : "#FFFFFF";
            const greyStroke = ParallelPlot.greyStroke(stroke);
            d3.select(this.bindto + " .subEditedTrace")
                .transition()
                .duration(1500)
                .attr("stroke", greyStroke);
            d3.select(this.bindto + " .editedTrace")
                .transition()
                .duration(1500)
                .attr("stroke", stroke);
        }
        this.drawContinuousCS();
    }
    drawContinuousCS() {
        const thisPlot = this;
        d3.select(this.bindto + " .plotGroup").selectAll(".colorScaleBar").remove();
        d3.selectAll(this.bindto + " .plotGroup .dimension")
            .each(function (dim) {
            thisPlot.columns[dim].drawContinuousCS(thisPlot);
        });
    }
    drawAxes() {
        const thisPlot = this;
        const axis = d3.axisLeft(this.columns[this.dimensions[0]].y())
            .tickFormat(ExpFormat.instance);
        const catAxis = d3.axisLeft(this.columns[this.dimensions[0]].y());
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".dimension").append("g")
            .attr("class", "axisGroup")
            .each(function (dim) {
            thisPlot.columns[dim].drawAxe(axis, catAxis);
        });
    }
    drawCategories() {
        const thisPlot = this;
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".dimension")
            .filter((dim) => thisPlot.columns[dim].categories !== null)
            .append("g")
            .attr("class", "catGroup")
            .each(function (dim) {
            thisPlot.columns[dim].drawCategory(thisPlot);
        });
    }
    updateSelectedRows() {
        const thisPlot = this;
        this.selectedRows.clear();
        this.sampleData.forEach(function (row, i) {
            const isKept = thisPlot.dimensions.every(function (dim) {
                return thisPlot.columns[dim].rowFilter.isKept(row[dim]);
            });
            if (isKept) {
                thisPlot.selectedRows.add(i);
            }
        });
    }
    buildPlotArea() {
        const thisPlot = this;
        this.drawBackGroundPath();
        this.drawForeGroundPath();
        this.drawEditedTrace();
        d3.select(this.bindto + " .plotGroup").selectAll(".dimension").remove();
        // Add a group element for each dimension.
        // Add One Axis (call of yScale on each dimension)
        const dimensionGroup = d3.select(this.bindto + " .columns")
            .selectAll(".dimension")
            .data(this.visibleDimensions)
            .enter().append("g")
            .classed("dimension", true)
            .classed("input", function (dim) { return thisPlot.columns[dim].isInput(); })
            .classed("output", function (dim) { return thisPlot.columns[dim].isOutput(); })
            .attr("transform", function (dim) {
            const x = thisPlot.xScaleVisibleDimension(dim);
            const y = thisPlot.refRowIndex === null
                ? 0
                : thisPlot.axeHeight - thisPlot.catScaledValue(dim, thisPlot.refRowIndex);
            return "translate(" + x + "," + y + ")";
        });
        this.drawMainHistograms();
        this.drawSelectedHistograms();
        // Add and store a brush for each continious axis.
        dimensionGroup.append("g")
            .filter(dim => thisPlot.columns[dim].categories === null)
            .attr("class", function (dim) {
            return "brush " + thisPlot.columns[dim].multiBrushId();
        })
            .each(function (dim) {
            thisPlot.columns[dim].initMultiBrush();
        });
        this.drawAxes();
        this.drawCategories();
        new ColumnHeaders(this);
        this.drawContinuousCS();
    }
    drawBackGroundPath() {
        const thisPlot = this;
        d3.select(this.bindto + " .background").selectAll("path").remove();
        d3.select(this.bindto + " .background").selectAll("path")
            .data(this.sampleData)
            .enter().append("path")
            .attr("d", function (_row, i) {
            return thisPlot.path(i);
        })
            .attr("stroke", function (row) {
            return thisPlot.rowColor(row);
        })
            .style("display", function (_row, i) {
            return thisPlot.selectedRows.has(i) ? "none" : null;
        });
    }
    drawForeGroundPath() {
        const thisPlot = this;
        d3.select(this.bindto + " .foreground").selectAll("path").remove();
        d3.select(this.bindto + " .foreground")
            .selectAll("path")
            .data(this.sampleData)
            .enter().append("path")
            .attr("d", function (_row, i) {
            return thisPlot.path(i);
        })
            .attr("stroke", function (row) {
            return thisPlot.rowColor(row);
        })
            .attr("stroke-width", 1)
            .style("display", function (_row, i) {
            return thisPlot.selectedRows.has(i) ? null : "none";
        })
            .on("mouseover", function (_row, i) {
            thisPlot.drawHightlightedTrace(i);
        })
            .on("mouseout", function () {
            thisPlot.drawHightlightedTrace(null);
        })
            .on("click", function (_clickedRow, clickedRowIndex) {
            if (thisPlot.editionMode !== ParallelPlot.EDITION_OFF) {
                thisPlot.editedRowIndex =
                    thisPlot.editedRowIndex === clickedRowIndex
                        ? null
                        : clickedRowIndex;
                thisPlot.drawEditedTrace();
            }
        });
    }
    path(rowIndex) {
        const thisPlot = this;
        return ParallelPlot.line(this.visibleDimensions.map(function (dim) {
            const x = thisPlot.xScaleVisibleDimension(dim);
            const y = thisPlot.catScaledValue(dim, rowIndex) +
                (thisPlot.refRowIndex === null
                    ? 0
                    : thisPlot.axeHeight -
                        thisPlot.catScaledValue(dim, thisPlot.refRowIndex));
            if (typeof x === "undefined") {
                return [0, y];
            }
            return [x, y];
        }));
    }
    editedPath(editedDim, position) {
        const thisPlot = this;
        return ParallelPlot.line(this.visibleDimensions.map(function (dim) {
            const x = thisPlot.xScaleVisibleDimension(dim);
            const y1 = (dim === editedDim || thisPlot.editedRowIndex === null)
                ? position
                : thisPlot.catScaledValue(dim, thisPlot.editedRowIndex);
            const y = y1 +
                (thisPlot.refRowIndex === null
                    ? 0
                    : thisPlot.axeHeight -
                        thisPlot.catScaledValue(dim, thisPlot.refRowIndex));
            if (typeof x === "undefined") {
                return [0, y];
            }
            return [x, y];
        }));
    }
    drawHightlightedTrace(rowIndex) {
        if (rowIndex === null || this.editedPointDim !== null) {
            d3.select(this.bindto + " .subHlTrace")
                .style("display", "none");
            d3.select(this.bindto + " .hlTrace")
                .style("display", "none");
        }
        else {
            const row = this.sampleData[rowIndex];
            const stroke = this.rowColor(row);
            const greyStroke = ParallelPlot.greyStroke(stroke);
            d3.select(this.bindto + " .subHlTrace")
                .attr("d", this.path(rowIndex))
                .attr("stroke", greyStroke)
                .style("display", null);
            d3.select(this.bindto + " .hlTrace")
                .attr("d", this.path(rowIndex))
                .attr("stroke", stroke)
                .style("display", null);
        }
        d3.select(this.bindto + " .foreground")
            .attr("opacity", rowIndex === null && this.editedRowIndex === null ? 0.8 : 0.6);
    }
    static greyStroke(stroke) {
        const strokeColor = d3.color(stroke);
        let greyStroke = d3.rgb(0, 0, 0);
        if (strokeColor) {
            const rgb = strokeColor.rgb();
            const greyComp = Math.round(((rgb.r ^ 255) + (rgb.g ^ 255) + (rgb.b ^ 255)) / 3);
            greyStroke = d3.rgb(greyComp, greyComp, greyComp);
        }
        return greyStroke.hex();
    }
    // eslint-disable-next-line max-lines-per-function
    drawEditedTrace() {
        const thisPlot = this;
        const editedRowIndex = this.editedRowIndex;
        if (editedRowIndex === null) {
            d3.select(this.bindto + " .subEditedTrace")
                .style("display", "none");
            d3.select(this.bindto + " .editedTrace")
                .style("display", "none");
        }
        else {
            const row = this.sampleData[editedRowIndex];
            const stroke = thisPlot.selectedRows.has(editedRowIndex) ? thisPlot.rowColor(row) : "#FFFFFF";
            const greyStroke = ParallelPlot.greyStroke(stroke);
            d3.select(this.bindto + " .subEditedTrace")
                .attr("d", this.path(editedRowIndex))
                .attr("stroke", greyStroke)
                .style("display", null);
            d3.select(this.bindto + " .editedTrace")
                .attr("d", this.path(editedRowIndex))
                .attr("stroke", stroke)
                .style("display", null);
        }
        d3.select(this.bindto + " .foreground")
            .attr("opacity", this.editedRowIndex === null ? 0.8 : 0.6);
        const visibleInputDims = this.visibleDimensions.filter(dim => thisPlot.columns[dim].isInput());
        d3.select(this.bindto + " .editionCircles")
            .style("display", function () {
            return thisPlot.editedRowIndex === null ? "none" : null;
        })
            .selectAll(".gEditionCircle")
            .data(visibleInputDims)
            .join(function (enter) {
            const gEditionCircle = enter.append("g")
                .attr("class", "gEditionCircle");
            gEditionCircle.append("circle")
                .attr("r", 4)
                .call(d3.drag()
                .on("start", function (dim) {
                thisPlot.editedPointDim = dim;
                thisPlot.drawEditedTrace();
            })
                .on("drag", function (dim) {
                thisPlot.pointDrag(dim);
            })
                .on("end", function (dim) {
                thisPlot.pointDragEnd(dim);
            }));
            return gEditionCircle;
        }, update => update, exit => exit.remove())
            .attr("transform", function (dim) {
            const x = thisPlot.xScaleVisibleDimension(dim);
            const y = thisPlot.refRowIndex === null
                ? 0
                : thisPlot.axeHeight - thisPlot.catScaledValue(dim, thisPlot.refRowIndex);
            return "translate(" + x + "," + y + ")";
        })
            .select("circle")
            .attr("cx", 0)
            .filter(dim => dim !== thisPlot.editedPointDim)
            .attr("cy", function (dim) {
            if (thisPlot.editedRowIndex === null) {
                return 0;
            }
            return thisPlot.catScaledValue(dim, thisPlot.editedRowIndex);
        });
    }
    pointDrag(draggedDim) {
        if (this.editionMode === ParallelPlot.EDITION_ON_DRAG_END) {
            this.dragEditionPoint(draggedDim, d3.event.y);
        }
        else if (this.editionMode === ParallelPlot.EDITION_ON_DRAG) {
            this.dragEditionPoint(draggedDim, d3.event.y);
            this.askForPointEdition(draggedDim);
        }
    }
    pointDragEnd(draggedDim) {
        if (this.editionMode !== ParallelPlot.EDITION_OFF) {
            this.askForPointEdition(draggedDim);
            this.editedPointDim = null;
        }
    }
    dragEditionPoint(draggedDim, position) {
        if (this.editedRowIndex === null) {
            console.log("dragEditionPoint is called but editedRowIndex is null");
            return;
        }
        const thisPlot = this;
        d3.select(this.bindto + " .editionCircles")
            .selectAll("circle")
            .filter(dim => dim === draggedDim)
            .attr("cy", function (_dim) {
            return position;
        });
        d3.select(this.bindto + " .foreground")
            .selectAll("path")
            .filter((_row, i) => i === thisPlot.editedRowIndex)
            .attr("d", this.editedPath(draggedDim, position));
        d3.select(this.bindto + " .subEditedTrace")
            .attr("d", this.editedPath(draggedDim, position));
        d3.select(this.bindto + " .editedTrace")
            .attr("d", this.editedPath(draggedDim, position));
    }
    askForPointEdition(draggedDim) {
        if (this.editedRowIndex === null) {
            console.log("dragEditedTrace is called but editedRowIndex is null");
            return;
        }
        const position = d3.event.y;
        const newValue = this.columns[draggedDim].y().invert(position);
        const categories = this.columns[draggedDim].categories;
        if (categories === null) {
            this.sendPointEditionEvent(draggedDim, this.editedRowIndex, newValue);
        }
        else {
            const catIndex = Math.round(newValue);
            if (catIndex >= 0 && catIndex < categories.length) {
                this.sendPointEditionEvent(draggedDim, this.editedRowIndex, categories[catIndex]);
            }
        }
    }
    applyColumnCutoffs() {
        const thisPlot = this;
        this.updateSelectedRows();
        d3.select(this.bindto + " .foreground")
            .selectAll("path")
            .style("display", function (_d, i) {
            return thisPlot.selectedRows.has(i) ? null : "none";
        });
        d3.select(this.bindto + " .background")
            .selectAll("path")
            .style("display", function (_d, i) {
            return thisPlot.selectedRows.has(i) ? "none" : null;
        });
        d3.select(this.bindto + " .plotGroup").selectAll(".histogram")
            .style("display", function () {
            return thisPlot.selectedRows.size > thisPlot.sampleData.length / 10.0
                ? null
                : "none";
        });
        this.drawSelectedHistograms();
    }
    setContCutoff(brushExtents, dim, end) {
        const contCutoffs = brushExtents
            .map(interval => interval.map(this.columns[dim].y().invert))
            .map(interval => {
            return interval.sort(function (a, b) {
                return b - a;
            });
        });
        if (contCutoffs === null || contCutoffs.length === 0) {
            this.columns[dim].rowFilter.contCutoffs = null;
        }
        else {
            this.columns[dim].rowFilter.contCutoffs = contCutoffs;
        }
        this.sendCutoffEvent(dim, end);
    }
    sendCutoffEvent(updatedDim, end) {
        this.updateSelectedRows();
        if (end) {
            this.dispatch.call(ParallelPlot.PLOT_EVENT, undefined, {
                type: ParallelPlot.CUTOFF_EVENT,
                value: { updatedDim: updatedDim, cutoffs: this.getValue(ParallelPlot.CO_ATTR_TYPE), selectedTraces: this.getValue(ParallelPlot.ST_ATTR_TYPE) }
            });
        }
        this.applyColumnCutoffs();
    }
    sendPointEditionEvent(dim, rowIndex, newValue) {
        this.dispatch.call(ParallelPlot.PLOT_EVENT, undefined, {
            type: ParallelPlot.EDITION_EVENT,
            value: { dim: dim, rowIndex: rowIndex, newValue: newValue }
        });
    }
    changeRow(rowIndex, newValues) {
        const thisPlot = this;
        const changedRow = this.sampleData[rowIndex];
        d3.keys(this.sampleData[0]).forEach(function (dim) {
            thisPlot.columns[dim].initDone = false;
        });
        d3.keys(newValues).forEach((dim) => {
            const categories = thisPlot.columns[dim].categories;
            if (categories === null) {
                changedRow[dim] = +newValues[dim];
            }
            else {
                changedRow[dim] = categories.indexOf(newValues[dim].toString());
            }
        });
        this.sampleData[rowIndex] = changedRow;
        const isKept = thisPlot.dimensions.every(function (dim) {
            return thisPlot.columns[dim].rowFilter.isKept(thisPlot.sampleData[rowIndex][dim]);
        });
        if (isKept) {
            thisPlot.selectedRows.add(rowIndex);
        }
        else {
            thisPlot.selectedRows.delete(rowIndex);
        }
        this.buildXScale();
        this.buildPlotArea();
    }
    drawMainHistograms() {
        const thisPlot = this;
        const dimensionGroup = d3.select(this.bindto + " .plotGroup")
            .selectAll(".dimension");
        dimensionGroup.selectAll(".histogram").remove();
        dimensionGroup.append("g")
            .attr("class", "histogram")
            .attr("opacity", "0.5")
            .each(function (dim) {
            thisPlot.columns[dim].drawMainHistogram(thisPlot);
        });
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".histogram")
            .style("display", function () {
            return thisPlot.selectedRows.size > thisPlot.sampleData.length / 10.0
                ? null
                : "none";
        });
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".histogram")
            .filter((dim) => thisPlot.columns[dim].categories !== null)
            .attr("transform", "translate(" + ParallelPlot.catClusterWidth / 2 + ",0)");
    }
    drawSelectedHistograms() {
        const thisPlot = this;
        d3.select(this.bindto + " .plotGroup").selectAll(".histogramSelected").remove();
        const selected = this.sampleData.filter((_row, i) => thisPlot.selectedRows.has(i));
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".dimension").append("g")
            .attr("class", "histogramSelected")
            .attr("opacity", "0.4")
            .each(function (dim) {
            thisPlot.columns[dim].drawSelectedHistogram(thisPlot, selected);
        });
        d3.select(this.bindto + " .plotGroup")
            .selectAll(".histogramSelected")
            .filter((dim) => thisPlot.columns[dim].categories !== null)
            .attr("transform", "translate(" + ParallelPlot.catClusterWidth / 2 + ",0)");
    }
}
ParallelPlot.mainHistoColor = "#a6f2f2";
ParallelPlot.secondHistoColor = "#169c9c";
ParallelPlot.CONTINUOUS_CS = {
    Blues: d3.interpolateBlues,
    RdBu: d3.interpolateRdBu,
    YlGnBu: d3.interpolateYlGnBu,
    YlOrRd: d3.interpolateYlOrRd,
    Reds: d3.interpolateReds
};
ParallelPlot.CONTINUOUS_CS_IDS = Object.keys(ParallelPlot.CONTINUOUS_CS);
ParallelPlot.CATEGORIAL_CS = {
    Category10: d3.scaleOrdinal(d3.schemeCategory10),
    Accent: d3.scaleOrdinal(d3.schemeAccent),
    Dark2: d3.scaleOrdinal(d3.schemeDark2),
    Paired: d3.scaleOrdinal(d3.schemePaired),
    Set1: d3.scaleOrdinal(d3.schemeSet1)
};
ParallelPlot.CATEGORIAL_CS_IDS = Object.keys(ParallelPlot.CATEGORIAL_CS);
ParallelPlot.margin = { top: 100, right: 10, bottom: 10, left: 10 };
ParallelPlot.catClusterWidth = 6;
ParallelPlot.line = d3.line();
ParallelPlot.PLOT_EVENT = "plotEvent";
ParallelPlot.CUTOFF_EVENT = "cutoffChange";
ParallelPlot.EDITION_EVENT = "pointChange";
ParallelPlot.CO_ATTR_TYPE = "Cutoffs";
ParallelPlot.ST_ATTR_TYPE = "SelectedTraces";
ParallelPlot.RC_ATTR_TYPE = "ReferenceColumn";
ParallelPlot.EDITION_OFF = "EditionOff";
ParallelPlot.EDITION_ON_DRAG = "EditionOnDrag";
ParallelPlot.EDITION_ON_DRAG_END = "EditionOnDragEnd";
ParallelPlot.EDITION_MODE_IDS = [ParallelPlot.EDITION_OFF, ParallelPlot.EDITION_ON_DRAG, ParallelPlot.EDITION_ON_DRAG_END,];

//# sourceMappingURL=maps/parallelPlot.js.map
