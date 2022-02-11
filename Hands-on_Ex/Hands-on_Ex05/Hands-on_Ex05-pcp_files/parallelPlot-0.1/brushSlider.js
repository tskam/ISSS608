"use strict";
// eslint-disable-next-line no-unused-vars
class BrushSlider {
    constructor(parallelPlot) {
        this.parallelPlot = parallelPlot;
        // Create the slider axis
        const axis = d3.select(parallelPlot.bindto + " .slider").append("g")
            .attr("pointer-events", "none")
            .attr("class", "axisGroup")
            // Tick Values set to none to have no overlayed names
            .call(d3.axisBottom(parallelPlot.xScaleDimension).tickSize(0).tickFormat(() => ""));
        d3.select(parallelPlot.bindto).append("div")
            .attr("class", "sliderTooltip")
            .style("display", "none");
        this.createBrush();
        axis.append("line")
            .attr("class", "locatorLine")
            .attr("x1", 50)
            .attr("y1", -8)
            .attr("x2", 50)
            .attr("y2", 8)
            .style("display", "none")
            .attr("pointer-events", "none");
        // Adapt slider to dimensions
        d3.select(parallelPlot.bindto + " .brushDim").call(d3.brushX().move, [0, parallelPlot.xScaleDimension(parallelPlot.visibleDimensions[parallelPlot.visibleDimensions.length - 1])]);
    }
    centerBrush(dimensionCenter, moveBrush) {
        const sizeDimVisible = this.parallelPlot.visibleDimensions.length;
        let sizeLeft = Math.round((sizeDimVisible - 1) / 2.0);
        let sizeRight = sizeDimVisible - 1 - sizeLeft;
        const indexCenter = this.parallelPlot.dimensions.indexOf(dimensionCenter);
        if (indexCenter - sizeLeft < 0) {
            sizeRight = sizeRight + (sizeLeft - indexCenter);
            sizeLeft = indexCenter;
        }
        if (indexCenter + sizeRight > this.parallelPlot.dimensions.length - 1) {
            sizeLeft = sizeLeft + (indexCenter + sizeRight - this.parallelPlot.dimensions.length + 1);
            sizeRight = this.parallelPlot.dimensions.length - 1 - indexCenter;
        }
        const dim1 = this.parallelPlot.dimensions[indexCenter - sizeLeft];
        const dim2 = this.parallelPlot.dimensions[indexCenter + sizeRight];
        if (dim1 !== this.parallelPlot.visibleDimensions[0] ||
            dim2 !== this.parallelPlot.visibleDimensions[this.parallelPlot.visibleDimensions.length - 1]) {
            this.updateVisibleDimensions(dim1, dim2);
            this.parallelPlot.buildXScale();
            this.parallelPlot.buildPlotArea();
            d3.select(this.parallelPlot.bindto + " .sliderTooltip").style("display", "none");
        }
        if (moveBrush) {
            d3.select(this.parallelPlot.bindto + " .brushDim").call(d3.brushX().move, [this.parallelPlot.xScaleDimension(dim1), this.parallelPlot.xScaleDimension(dim2)]);
        }
    }
    mouseDown(mouse) {
        this.centerBrush(this.parallelPlot.xScaleDimensionInvertFn(mouse[0]), true);
        d3.event.stopPropagation();
    }
    mouseMove(mouse) {
        d3.select(this.parallelPlot.bindto + " .locatorLine")
            .style("display", null)
            .attr("x1", mouse[0])
            .attr("x2", mouse[0]);
        const dim = this.parallelPlot.xScaleDimensionInvertFn(mouse[0]);
        d3.select(this.parallelPlot.bindto + " .sliderTooltip")
            .html(this.parallelPlot.columns[dim].label)
            .style("left", mouse[0] - ParallelPlot.margin.left + "px")
            .style("top", ParallelPlot.margin.top / 4.0 - 30 + "px")
            .style("display", null);
    }
    mouseExit() {
        d3.select(this.parallelPlot.bindto + " .locatorLine").style("display", "none");
        d3.select(this.parallelPlot.bindto + " .sliderTooltip").style("display", "none");
    }
    // eslint-disable-next-line max-lines-per-function
    createBrush() {
        const thisBrushSlider = this;
        let inSelectionDrag;
        d3.select(this.parallelPlot.bindto + " .slider").append("g")
            .attr("class", "brushDim")
            .call(d3.brushX()
            .handleSize(4)
            .extent([
            [0, -10],
            [thisBrushSlider.parallelPlot.width - ParallelPlot.margin.left - ParallelPlot.margin.right, 10]
        ])
            .on("brush", function () {
            const selection = d3.event.selection;
            const select = selection.map(thisBrushSlider.parallelPlot.xScaleDimensionInvertFn);
            if (inSelectionDrag) {
                thisBrushSlider.centerBrush(thisBrushSlider.parallelPlot.xScaleDimensionInvertFn((selection[0] + selection[1]) / 2.0), false);
            }
            else {
                if (select[0] !== thisBrushSlider.parallelPlot.visibleDimensions[0] ||
                    select[1] !== thisBrushSlider.parallelPlot.visibleDimensions[thisBrushSlider.parallelPlot.visibleDimensions.length - 1]) {
                    thisBrushSlider.updateVisibleDimensions(select[0], select[1]);
                    thisBrushSlider.parallelPlot.buildXScale();
                    thisBrushSlider.parallelPlot.buildPlotArea();
                }
            }
        })
            .on("end", function () {
            inSelectionDrag = false;
        }))
            .call(g => g.select(this.parallelPlot.bindto + " .overlay")
            // @ts-ignore
            .on("mousedown touchstart", function () { thisBrushSlider.mouseDown(d3.mouse(this)); })
            // @ts-ignore
            .on("mousemove", function () { thisBrushSlider.mouseMove(d3.mouse(this)); })
            // @ts-ignore
            .on("mouseout", function () { thisBrushSlider.mouseExit(d3.mouse(this)); }))
            .call(g => g.select(this.parallelPlot.bindto + " .selection")
            .on("mousedown", function () { inSelectionDrag = true; })
            .on("mouseup", function () { inSelectionDrag = false; }));
    }
    updateVisibleDimensions(dim1, dim2) {
        const thisBrushSlider = this;
        const parallelPlot = thisBrushSlider.parallelPlot;
        // Dimension with extent are Always Visible
        const toKeep = parallelPlot.dimensions.filter(dim => parallelPlot.columns[dim].rowFilter.hasFilters() ||
            dim === parallelPlot.refColumnDim);
        const begin = parallelPlot.dimensions.indexOf(dim1);
        const end = parallelPlot.dimensions.indexOf(dim2);
        if (begin >= 0 && end >= 0) {
            // Care about slice method which dont take the end item
            const requested = parallelPlot.dimensions.slice(begin, end + 1);
            const toKeepBefore = toKeep.filter(dim => parallelPlot.dimensions.indexOf(dim) < begin);
            const toKeepAfter = toKeep.filter(dim => parallelPlot.dimensions.indexOf(dim) > end);
            const requestedAndToKeep = toKeepBefore
                .concat(requested)
                .concat(toKeepAfter);
            // Have to remove elements in order to have the good lenght but not element that are selected
            const removableRequested = requested.filter(dim => !toKeep.includes(dim));
            const removableRequestedBefore = removableRequested.splice(0, toKeepBefore.length);
            const removableRequestedAfter = removableRequested.splice(-toKeepAfter.length, toKeepAfter.length);
            parallelPlot.visibleDimensions = requestedAndToKeep.filter(dim => !removableRequestedBefore.includes(dim) &&
                !removableRequestedAfter.includes(dim));
        }
    }
}

//# sourceMappingURL=maps/brushSlider.js.map
