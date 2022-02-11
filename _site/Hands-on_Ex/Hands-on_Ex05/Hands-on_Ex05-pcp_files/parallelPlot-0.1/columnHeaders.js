"use strict";
// eslint-disable-next-line no-unused-vars
class ColumnHeaders {
    // eslint-disable-next-line max-lines-per-function
    constructor(parallelPlot) {
        this.dragDimension = null;
        this.clickCount = 0;
        this.dimensionGroup = d3.select(parallelPlot.bindto + " .plotGroup").selectAll(".dimension");
        this.parallelPlot = parallelPlot;
        const thisTextColumns = this;
        const axisLabel = this.dimensionGroup.append("text")
            .attr("class", "axisLabel")
            .on("mouseover", function () {
            d3.select(this).attr("font-weight", "bold");
        })
            .on("mouseout", function () {
            d3.select(this).attr("font-weight", "normal");
        })
            .call(d3.drag()
            // Click Distance : 5 pixel arround .. to begin a drag .. or to have a "click" if under
            .clickDistance(5)
            // @ts-ignore
            .container(function () { return this.parentNode.parentNode; })
            .on("start", function (d) {
            thisTextColumns.dragDimension = d;
        })
            .on("drag", function (dim) {
            thisTextColumns.drag(dim);
        })
            .on("end", function (dim) {
            thisTextColumns.dragEnd(dim);
        }))
            // ON click must be called after Drag ... if not the click event is removed
            .on("click", function (dim) {
            if (d3.event.defaultPrevented) {
                return; // dragged
            }
            if (thisTextColumns.clickCount === 0) {
                thisTextColumns.clickCount = 1;
                setTimeout(function () {
                    if (thisTextColumns.clickCount === 1) {
                        parallelPlot.changeColorMapOnDimension(dim);
                    }
                    if (thisTextColumns.clickCount === 2) {
                        thisTextColumns.reverseDomainOnAxis(dim);
                    }
                    thisTextColumns.clickCount = 0;
                }, 350);
            }
            else if (thisTextColumns.clickCount === 1) {
                thisTextColumns.clickCount = 2;
            }
        });
        axisLabel.each(function (dim) {
            const self = d3.select(this);
            const labels = parallelPlot.columns[dim].label.split("<br>");
            self.text(labels[0]);
            for (let i = 1; i < labels.length; i++) {
                self.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "1em")
                    .text(labels[i]);
            }
            if (parallelPlot.rotateTitle) {
                self.attr("y", 0)
                    .attr("transform", "rotate(-10) translate(-20," + -15 * labels.length + ")");
            }
            else {
                self.style("text-anchor", "middle")
                    .attr("y", -15 * labels.length);
            }
        });
    }
    // eslint-disable-next-line max-lines-per-function
    drag(draggedDim) {
        let position = d3.event.x;
        const parallelPlot = this.parallelPlot;
        const dimensionGroup = this.dimensionGroup;
        const dragDimension = this.dragDimension;
        const thisTextColumns = this;
        const indexInitialPosition = parallelPlot.visibleDimensions.indexOf(dragDimension);
        if (indexInitialPosition > 0) {
            const leftDimension = parallelPlot.visibleDimensions[indexInitialPosition - 1];
            const leftX = parallelPlot.xScaleVisibleDimension(leftDimension);
            if (leftX && position < leftX) {
                if (thisTextColumns.canSwitchDimension(leftDimension, dragDimension)) {
                    thisTextColumns.switchdimension(leftDimension, dragDimension);
                }
                else {
                    position = leftX;
                }
            }
        }
        if (indexInitialPosition < parallelPlot.visibleDimensions.length - 1) {
            const rightDimension = parallelPlot.visibleDimensions[indexInitialPosition + 1];
            const rightX = parallelPlot.xScaleVisibleDimension(rightDimension);
            if (rightX && position > rightX) {
                if (thisTextColumns.canSwitchDimension(dragDimension, rightDimension)) {
                    thisTextColumns.switchdimension(dragDimension, rightDimension);
                }
                else {
                    position = rightX;
                }
            }
        }
        dimensionGroup.filter(dim => dim === draggedDim)
            .attr("transform", function (dim) {
            const x = position;
            const y = parallelPlot.refRowIndex === null
                ? 0
                : parallelPlot.axeHeight -
                    parallelPlot.catScaledValue(dim, parallelPlot.refRowIndex);
            return "translate(" + x + "," + y + ")";
        });
    }
    dragEnd(_draggedDim) {
        const parallelPlot = this.parallelPlot;
        const dimensionGroup = this.dimensionGroup;
        const thisTextColumns = this;
        // Move only the second dimension switched
        dimensionGroup.filter(dim => dim === thisTextColumns.dragDimension)
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.switchAxisTime)
            .attr("transform", function (d) {
            const x = parallelPlot.xScaleVisibleDimension(d);
            const y = parallelPlot.refRowIndex === null
                ? 0
                : parallelPlot.axeHeight -
                    parallelPlot.catScaledValue(d, parallelPlot.refRowIndex);
            return "translate(" + x + "," + y + ")";
        });
        this.updateTracesPaths();
        this.updateEditedTrace();
        thisTextColumns.dragDimension = null;
    }
    canSwitchDimension(dim1, dim2) {
        const parallelPlot = this.parallelPlot;
        const indexDim1 = parallelPlot.dimensions.indexOf(dim1);
        const indexDim2 = parallelPlot.dimensions.indexOf(dim2);
        if (indexDim1 === null || indexDim2 === null) {
            return false;
        }
        if (indexDim1 + 1 !== indexDim2) {
            return false;
        }
        return true;
    }
    // eslint-disable-next-line max-lines-per-function
    switchdimension(leftDim, rightDim) {
        const parallelPlot = this.parallelPlot;
        const dimensionGroup = this.dimensionGroup;
        const thisTextColumns = this;
        const leftVisibleIndex = parallelPlot.visibleDimensions.indexOf(leftDim);
        const rightVisibleIndex = parallelPlot.visibleDimensions.indexOf(rightDim);
        const leftSliderIndex = parallelPlot.dimensions.indexOf(leftDim);
        const rightSliderIndex = parallelPlot.dimensions.indexOf(rightDim);
        if (leftVisibleIndex === -1 ||
            rightVisibleIndex === -1 ||
            leftSliderIndex === -1 ||
            rightSliderIndex === -1) {
            return;
        }
        // check that they are coherent leftIndex + 1 = rightIndex in both array
        if (leftVisibleIndex + 1 !== rightVisibleIndex) {
            return;
        }
        if (leftSliderIndex + 1 !== rightSliderIndex) {
            return;
        }
        // Switch on global
        parallelPlot.dimensions[leftSliderIndex] = rightDim;
        parallelPlot.dimensions[rightSliderIndex] = leftDim;
        // Switch on Visible
        parallelPlot.visibleDimensions[leftVisibleIndex] = rightDim;
        parallelPlot.visibleDimensions[rightVisibleIndex] = leftDim;
        // Reset of the XScale
        parallelPlot.buildXScale();
        // Move only the second dimension switched
        dimensionGroup.filter(dim => (dim === rightDim || dim === leftDim) &&
            dim !== thisTextColumns.dragDimension)
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.switchAxisTime)
            .attr("transform", function (d) {
            const x = parallelPlot.xScaleVisibleDimension(d);
            const y = parallelPlot.refRowIndex === null
                ? 0
                : parallelPlot.axeHeight -
                    parallelPlot.catScaledValue(d, parallelPlot.refRowIndex);
            return "translate(" + x + "," + y + ")";
        });
    }
    // eslint-disable-next-line max-lines-per-function
    reverseDomainOnAxis(revDim) {
        const dimensionGroup = this.dimensionGroup;
        const parallelPlot = this.parallelPlot;
        // If categorical axis no reverse
        if (parallelPlot.columns[revDim].categories !== null) {
            return;
        }
        // Change the domain of axis
        const axis = d3.axisLeft(parallelPlot.columns[parallelPlot.dimensions[0]].y())
            .tickFormat(ExpFormat.instance);
        const [old1, old2] = parallelPlot.columns[revDim].y().domain();
        //Reverse the axis on the column object
        const newScale = parallelPlot.columns[revDim].y().domain([old2, old1]);
        //Have the old scale in order to some reverse operation
        const oldScale = d3.scaleLinear()
            .range(parallelPlot.columns[revDim].y().range())
            .domain([old1, old2]);
        dimensionGroup.filter(dim => dim === revDim)
            .each(function (d) {
            d3.select(this).selectAll(".axisGroup")
                .transition()
                .ease(d3.easeBackOut)
                .duration(ColumnHeaders.reverseAxisTime)
                // @ts-ignore
                .call(axis.scale(parallelPlot.columns[d].y()));
        });
        // cannot filter the dimension group
        // we need the i argument in order to find the brush
        // eslint-disable-next-line max-lines-per-function
        dimensionGroup.each(function (dim) {
            if (dim === revDim) {
                // The group can be moved by the reverse if the center lane is defined
                d3.select(this)
                    .transition()
                    .ease(d3.easeBackOut)
                    .duration(ColumnHeaders.reverseAxisTime)
                    .attr("transform", function () {
                    const x = parallelPlot.xScaleVisibleDimension(revDim);
                    const y = parallelPlot.refRowIndex === null
                        ? 0
                        : parallelPlot.axeHeight -
                            parallelPlot.catScaledValue(dim, parallelPlot.refRowIndex);
                    return "translate(" + x + "," + y + ")";
                });
                // Reverse Main histo Bins of the group
                d3.select(this)
                    .selectAll(".barMainHisto")
                    .transition()
                    .ease(d3.easeBackOut)
                    .duration(ColumnHeaders.reverseAxisTime)
                    .attr("transform", function (bin) {
                    if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                        console.log("bin.x1 is undefined");
                        return null;
                    }
                    return ("translate(0," +
                        Math.min(parallelPlot.columns[dim].y()(bin.x1), parallelPlot.columns[dim].y()(bin.x0)) + ")");
                })
                    .attr("height", function (bin) {
                    if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                        console.log("bin.x0 or bin.x1 are undefined");
                        return null;
                    }
                    return Math.abs(parallelPlot.columns[dim].y()(bin.x0) -
                        parallelPlot.columns[dim].y()(bin.x1));
                });
                // Reverse Second Histo Bins
                d3.select(this)
                    .selectAll(".barSecondHisto")
                    .transition()
                    .ease(d3.easeBackOut)
                    .duration(ColumnHeaders.reverseAxisTime)
                    .attr("transform", function (bin) {
                    if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                        console.log("bin.x1 is undefined");
                        return null;
                    }
                    return ("translate(0," +
                        Math.min(parallelPlot.columns[dim].y()(bin.x1), parallelPlot.columns[dim].y()(bin.x0)) + ")");
                })
                    .attr("height", function (bin) {
                    if (typeof bin.x0 === "undefined" || typeof bin.x1 === "undefined") {
                        console.log("bin.x0 or bin.x1 are undefined");
                        return null;
                    }
                    return Math.abs(parallelPlot.columns[dim].y()(bin.x0) -
                        parallelPlot.columns[dim].y()(bin.x1));
                });
                // Reverse the brush
                const allDimensions = d3.keys(parallelPlot.sampleData[0]);
                const colIndex = allDimensions.indexOf(dim);
                d3.select(this)
                    .selectAll("." + MultiBrush.multiBrushId(colIndex))
                    .selectAll(".Multibrush")
                    .each(function (brush) {
                    const select = d3.select(parallelPlot.bindto + " ." + MultiBrush.brushId(colIndex, brush.id));
                    const selection = d3.brushSelection(select.node());
                    if (selection) {
                        const brushExtent = d3.extent([
                            newScale(oldScale.invert(selection[0])),
                            newScale(oldScale.invert(selection[1]))
                        ]);
                        select
                            .transition()
                            .ease(d3.easeBackOut)
                            .duration(ColumnHeaders.reverseAxisTime)
                            // @ts-ignore
                            .call(d3.brushY().move, brushExtent); // [selection[1] as number, selection[0] as number])
                    }
                });
                // Reverse the color Scale if it is on the same group
                if (revDim === parallelPlot.refColumnDim) {
                    d3.select(this)
                        .selectAll(".colorScaleBar")
                        .transition()
                        .duration(ColumnHeaders.reverseAxisTime)
                        .style("fill", function (pixel) {
                        return parallelPlot.valueColor(newScale.invert(pixel));
                    });
                }
            }
        });
        this.updateTracesPaths();
        this.updateEditedTrace();
    }
    updateTracesPaths() {
        const parallelPlot = this.parallelPlot;
        d3.select(parallelPlot.bindto + " .foreground")
            .selectAll("path")
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.reverseAxisTime)
            .attr("d", function (_d, i) {
            return parallelPlot.path(i);
        });
        // Move BackGround Path
        d3.select(parallelPlot.bindto + " .background")
            .selectAll("path")
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.reverseAxisTime)
            .attr("d", function (_d, i) {
            return parallelPlot.path(i);
        });
    }
    updateEditedTrace() {
        const parallelPlot = this.parallelPlot;
        if (parallelPlot.editedRowIndex === null) {
            return;
        }
        d3.select(parallelPlot.bindto + " .subEditedTrace")
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.reverseAxisTime)
            .attr("d", parallelPlot.path(parallelPlot.editedRowIndex));
        d3.select(parallelPlot.bindto + " .editedTrace")
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.reverseAxisTime)
            .attr("d", parallelPlot.path(parallelPlot.editedRowIndex));
        d3.selectAll(parallelPlot.bindto + " .gEditionCircle")
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.reverseAxisTime)
            .attr("transform", function (dim) {
            const x = parallelPlot.xScaleVisibleDimension(dim);
            const y = parallelPlot.refRowIndex === null
                ? 0
                : parallelPlot.axeHeight - parallelPlot.catScaledValue(dim, parallelPlot.refRowIndex);
            return "translate(" + x + "," + y + ")";
        });
        d3.select(parallelPlot.bindto + " .editionCircles")
            .selectAll("circle")
            .transition()
            .ease(d3.easeBackOut)
            .duration(ColumnHeaders.reverseAxisTime)
            .attr("cy", function (dim) {
            if (parallelPlot.editedRowIndex === null) {
                return 0;
            }
            const y = parallelPlot.catScaledValue(dim, parallelPlot.editedRowIndex) +
                (parallelPlot.refRowIndex === null
                    ? 0
                    : parallelPlot.axeHeight -
                        parallelPlot.catScaledValue(dim, parallelPlot.refRowIndex));
            return y;
        });
    }
}
ColumnHeaders.reverseAxisTime = 1000;
ColumnHeaders.switchAxisTime = 500;

//# sourceMappingURL=maps/columnHeaders.js.map
