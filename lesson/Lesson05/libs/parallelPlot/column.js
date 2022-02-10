"use strict";
// eslint-disable-next-line no-unused-vars
class Column {
    constructor(dim, colIndex, parallelPlot, label, categories, cutoffs, histoVisibility, type) {
        this.colIndex = colIndex;
        this.dim = dim;
        this.label = label;
        this.parallelPlot = parallelPlot;
        this.categorical = null;
        this.categories = categories;
        this.yScale = d3.scaleLinear();
        this.histoGenerator = d3.histogram();
        this.initDone = false;
        this.histoScale = d3.scaleLinear();
        this.histoVisible = histoVisibility;
        this.rowFilter = new RowFilter(this);
        this.rowFilter.setCutoffs(cutoffs);
        this.multiBrush = null;
        this.type = type;
    }
    y() {
        this.checkInitDone();
        return this.yScale;
    }
    histo() {
        this.checkInitDone();
        return this.histoGenerator;
    }
    checkInitDone() {
        if (!this.initDone) {
            if (this.categories === null) {
                this.continuousInit();
            }
            else {
                this.categoricalInit();
            }
            this.initDone = true;
        }
    }
    continuousInit() {
        const thisColumn = this;
        const [yMin, yMax] = d3.extent(this.parallelPlot.sampleData, function (row) {
            return +row[thisColumn.dim];
        });
        if (typeof yMin === "undefined" || typeof yMax === "undefined") {
            console.trace("d3.extent returns 'undefined values'");
            return;
        }
        this.yScale
            .domain([yMin, yMax])
            .range([this.parallelPlot.axeHeight, 0])
            .nice(this.numbin());
        this.histoGenerator
            .value(function (row) {
            return row[thisColumn.dim];
        })
            .domain([yMin, yMax])
            .thresholds(this.equiDepthThresholds(yMin, yMax));
    }
    categoricalInit() {
        const categories = this.categories;
        if (categories === null) {
            return;
        }
        const thisColumn = this;
        const padding = ((this.parallelPlot.axeHeight / categories.length) *
            Categorical.heightRatio) / 2 + 10;
        this.yScale
            .domain([0, categories.length - 1])
            .range([this.parallelPlot.axeHeight - padding, padding])
            .ticks(categories.length);
        const thresholds = d3.range(2 * categories.length).map(t => t / 2 - 0.25);
        const [yMin, yMax] = d3.extent(thresholds);
        if (typeof yMin === "undefined" || typeof yMax === "undefined") {
            console.trace("d3.extent returns 'undefined values'");
            return;
        }
        this.histoGenerator
            .value(function (p) {
            return p[thisColumn.dim];
        })
            .domain([yMin, yMax])
            .thresholds(thresholds);
    }
    equiDepthThresholds(min, max) {
        const binBounds = [];
        const depth = (max - min) / this.numbin();
        for (let j = 0; j < this.numbin(); j++) {
            binBounds.push(min + j * depth);
        }
        return binBounds;
    }
    numbin() {
        return Math.ceil(2.5 * Math.pow(this.parallelPlot.sampleData.length, 0.25));
    }
    catScaledValue(rowIndex) {
        const value = this.parallelPlot.sampleData[rowIndex][this.dim];
        if (this.categories !== null) {
            if (this.categorical === null) {
                this.categorical = new Categorical(this.dim, this.categories, this.parallelPlot);
            }
            return this.y()(value) + this.categorical.offsets[rowIndex];
        }
        return this.y()(value);
    }
    isInput() {
        return this.type === Column.INPUT;
    }
    isOutput() {
        return this.type === Column.OUTPUT;
    }
    // eslint-disable-next-line max-lines-per-function
    drawMainHistogram(parallelPlot) {
        if (!this.histoVisible) {
            return;
        }
        const thisColumn = this;
        const histogramGroup = d3.selectAll(parallelPlot.bindto + " .histogram")
            .filter(dim => dim === thisColumn.dim);
        const columnWidth = parallelPlot.xScaleVisibleDimension(parallelPlot.visibleDimensions[0]);
        if (typeof columnWidth === "undefined") {
            console.log("Dim '", parallelPlot.visibleDimensions[0], "' not found");
            return;
        }
        const bins = this.histo()(this.parallelPlot.sampleData);
        const maxBinCount = d3.max(bins.map(b => b.length));
        if (typeof maxBinCount === "undefined") {
            console.log("maxBinCount not found");
            return;
        }
        // range is 70% percent of the original x() size between 2 dimensions
        this.histoScale
            .range([0, columnWidth * 0.7])
            .domain([0, maxBinCount]);
        histogramGroup.selectAll("rect")
            .data(bins)
            .enter().append("rect")
            .attr("class", "barMainHisto")
            .attr("pointer-events", "none")
            .attr("x", 1)
            .attr("transform", function (bin) {
            if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                console.log("bin.x1 is undefined");
                return null;
            }
            return ("translate(0," +
                Math.min(thisColumn.y()(bin.x1), thisColumn.y()(bin.x0)) + ")");
        })
            .attr("width", function (bin) {
            return thisColumn.histoScale(bin.length);
        })
            .attr("height", function (bin) {
            if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                console.log("bin.x0 or bin.x1 are undefined");
                return null;
            }
            return Math.abs(thisColumn.y()(bin.x0) - thisColumn.y()(bin.x1));
        })
            .style("fill", ParallelPlot.mainHistoColor)
            .style("stroke", "white");
    }
    // eslint-disable-next-line max-lines-per-function
    drawSelectedHistogram(parallelPlot, selected) {
        if (!this.histoVisible) {
            return;
        }
        const thisColumn = this;
        const histogramGroup = d3.selectAll(parallelPlot.bindto + " .histogramSelected")
            .filter(dim => dim === thisColumn.dim);
        const bins = this.histo()(selected);
        let selectedHistoScale;
        if (selected.length > this.parallelPlot.sampleData.length / 10.0) {
            selectedHistoScale = this.histoScale;
        }
        else {
            const columnWidth = parallelPlot.xScaleVisibleDimension(parallelPlot.visibleDimensions[0]);
            if (typeof columnWidth === "undefined") {
                console.log("Dim '", parallelPlot.visibleDimensions[0], "' not found");
                return;
            }
            const maxBinCount = d3.max(bins.map(b => b.length));
            if (typeof maxBinCount === "undefined") {
                console.log("maxBinCount not found");
                return;
            }
            selectedHistoScale = d3.scaleLinear()
                .range([0, columnWidth * 0.7])
                .domain([0, maxBinCount]);
        }
        histogramGroup.selectAll("rect")
            .data(bins)
            .enter().append("rect")
            .attr("class", "barSecondHisto")
            .attr("pointer-events", "none")
            .attr("x", 1)
            .attr("transform", function (bin) {
            if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                console.log("bin.x1 is undefined");
                return null;
            }
            return ("translate(0," +
                Math.min(thisColumn.y()(bin.x1), thisColumn.y()(bin.x0)) + ")");
        })
            .attr("height", function (bin) {
            if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                console.log("bin.x0 or bin.x1 are undefined");
                return null;
            }
            return Math.abs(thisColumn.y()(bin.x0) - thisColumn.y()(bin.x1));
        })
            .attr("width", function (bin) {
            return selectedHistoScale.domain()[1] === 0
                ? 0
                : selectedHistoScale(bin.length);
        })
            .style("fill", ParallelPlot.secondHistoColor)
            .style("stroke", function () {
            return "white";
        });
    }
    drawAxe(axis, catAxis) {
        const thisColumn = this;
        const axisGroup = d3.selectAll(this.parallelPlot.bindto + " .axisGroup")
            .filter(dim => dim === thisColumn.dim);
        const categories = this.categories;
        if (categories === null) {
            axisGroup.call(axis.scale(this.y()));
        }
        else {
            axisGroup.call(catAxis
                .scale(this.y())
                .tickFormat((d) => Number.isInteger(d.valueOf()) ? categories[d.valueOf()].toString() : "")
                .ticks(categories.length));
            // Just display tick labels, hide the rest of the axis
            axisGroup.selectAll("path").style("display", "none");
            axisGroup.selectAll("line").style("display", "none");
        }
    }
    // eslint-disable-next-line max-lines-per-function
    drawCategory(parallelPlot) {
        const categories = this.categories;
        if (categories === null) {
            return;
        }
        const thisColumn = this;
        const categoricalGroup = d3.selectAll(parallelPlot.bindto + " .catGroup")
            .filter(dim => dim === thisColumn.dim);
        const height = (this.parallelPlot.axeHeight / categories.length) *
            Categorical.heightRatio;
        categoricalGroup.append("rect")
            .attr("class", "catOverlay")
            .attr("x", -ParallelPlot.catClusterWidth)
            .attr("height", this.parallelPlot.axeHeight)
            .attr("width", 2 * ParallelPlot.catClusterWidth)
            .attr("opacity", 0)
            .attr("cursor", "crosshair")
            .on("click", function () {
            thisColumn.rowFilter.toggleCategories();
            thisColumn.applyCategoricalCutoffs();
            thisColumn.parallelPlot.sendCutoffEvent(thisColumn.dim, true);
        });
        categoricalGroup
            .selectAll(".category")
            .data(categories)
            .join(enter => enter.append("rect")
            .attr("class", "category")
            .classed("active", function (_cat2, i2) {
            return thisColumn.rowFilter.isKept(i2);
        })
            .classed("inactive", function (_cat2, i2) {
            return !thisColumn.rowFilter.isKept(i2);
        })
            .attr("x", -ParallelPlot.catClusterWidth / 2)
            .attr("y", function (_cat, i) {
            return thisColumn.y()(i) - height / 2;
        })
            .attr("height", height)
            .attr("width", ParallelPlot.catClusterWidth)
            .attr("fill-opacity", 0.3)
            .on("click", function (_cat, i) {
            thisColumn.rowFilter.toggleCategory(i);
            thisColumn.applyCategoricalCutoffs();
            thisColumn.parallelPlot.sendCutoffEvent(thisColumn.dim, true);
        })
            .attr("shape-rendering", "crispEdges"), update => update, exit => exit.remove())
            .attr("fill", function (_cat, i) {
            return thisColumn.dim === parallelPlot.refColumnDim
                ? parallelPlot.valueColor(i)
                : "black";
        });
    }
    applyCategoricalCutoffs() {
        const thisColumn = this;
        const categoricalGroup = d3.selectAll(this.parallelPlot.bindto + " .catGroup")
            .filter(dim => dim === thisColumn.dim);
        categoricalGroup.selectAll(".category")
            .classed("active", function (_cat2, i2) {
            return thisColumn.rowFilter.isKept(i2);
        })
            .classed("inactive", function (_cat2, i2) {
            return !thisColumn.rowFilter.isKept(i2);
        });
    }
    drawContinuousCS(parallelPlot) {
        if (parallelPlot.refColumnDim !== this.dim ||
            parallelPlot.columns[this.dim].categories !== null) {
            return;
        }
        const thisColumn = this;
        const dimensionGroup = d3.selectAll(parallelPlot.bindto + " .plotGroup .dimension")
            .filter(dim => dim === this.dim);
        dimensionGroup.selectAll(".colorScaleBar")
            .data(d3.range(this.parallelPlot.axeHeight))
            .enter().append("rect")
            .attr("pointer-events", "none")
            .attr("class", "colorScaleBar")
            .attr("x", -4)
            .attr("y", function (_d, i) {
            return i;
        })
            .attr("height", 1)
            .attr("width", 4)
            .attr("opacity", 0.9)
            .style("fill", function (pixel) {
            return parallelPlot.valueColor(thisColumn.y().invert(pixel));
        });
    }
    multiBrushId() {
        return MultiBrush.multiBrushId(this.colIndex);
    }
    initMultiBrush() {
        if (this.multiBrush === null ||
            d3.select(this.parallelPlot.bindto + " ." + MultiBrush.multiBrushId(this.colIndex))
                .selectAll(".Multibrush")
                .size() === 0) {
            this.multiBrush = new MultiBrush(this.colIndex, this.parallelPlot, this.dim);
        }
        this.multiBrush.setExtents(this.rowFilter.contCutoffs);
    }
}
Column.INPUT = "Input";
Column.OUTPUT = "Output";

//# sourceMappingURL=maps/column.js.map
