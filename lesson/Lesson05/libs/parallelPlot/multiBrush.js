"use strict";
// eslint-disable-next-line no-unused-vars
class MultiBrush {
    constructor(colIndex, plot, dim) {
        this.brushes = [];
        this.colIndex = colIndex;
        this.plot = plot;
        this.dim = dim;
        this.newBrush();
        this.drawBrushes();
    }
    static multiBrushId(colIndex) {
        return "col" + colIndex + "_brushes";
    }
    static brushId(colIndex, brushId) {
        return "Multibrush-" + MultiBrush.multiBrushId(colIndex) + brushId;
    }
    brushId(brushId) {
        return MultiBrush.brushId(this.colIndex, brushId);
    }
    newBrush() {
        const thisMultiBrush = this;
        const brush = d3.brushY()
            .handleSize(4)
            .extent([
            [-5, 0],
            [20, this.plot.axeHeight]
        ])
            // .on("start", brushstart)
            .on("brush", function () { thisMultiBrush.brushed(false); })
            .on("end", function () { thisMultiBrush.brushend(); });
        const brushInside = {
            id: this.brushes.length,
            brush: brush,
            initialExtent: null
        };
        this.brushes.push(brushInside);
        return brushInside;
    }
    // eslint-disable-next-line max-lines-per-function
    drawBrushes() {
        const thisMultiBrush = this;
        const brushSelection = d3.select(thisMultiBrush.plot.bindto + " ." + MultiBrush.multiBrushId(this.colIndex))
            .selectAll(".Multibrush")
            .data(this.brushes, (brush) => brush.id.toString());
        // Set up new brushes
        brushSelection.enter().insert("g", ".Multibrush")
            .attr("class", function (brush) {
            return "Multibrush " + thisMultiBrush.brushId(brush.id);
        })
            .each(function (brush) {
            d3.select(this).call(brush.brush);
            if (brush.initialExtent !== null) {
                const extent = d3.extent(brush.initialExtent.map(thisMultiBrush.plot.columns[thisMultiBrush.dim].y()));
                d3.select(this).call(d3.brushY().move, extent);
            }
        });
        brushSelection.each(function (brushObject) {
            d3.select(this)
                .selectAll(".overlay")
                .style("pointer-events", function () {
                return (brushObject.id === thisMultiBrush.brushes.length - 1 &&
                    brushObject.brush !== undefined)
                    ? "all"
                    : "none";
            })
                .on("click", function () {
                const brushExtents = [];
                thisMultiBrush.plot.setContCutoff(brushExtents, thisMultiBrush.dim, true);
                thisMultiBrush.brushes = [];
                thisMultiBrush.drawBrushes();
                thisMultiBrush.newBrush();
                thisMultiBrush.drawBrushes();
            });
        });
        brushSelection.exit().remove();
    }
    setExtents(newExtents) {
        const thisMultiBrush = this;
        // Remove all Old Brushes
        thisMultiBrush.brushes = [];
        thisMultiBrush.drawBrushes();
        if (newExtents !== null) {
            newExtents.forEach((extent) => {
                const brushCreated = thisMultiBrush.newBrush();
                brushCreated.initialExtent = extent;
                thisMultiBrush.drawBrushes();
            });
        }
        thisMultiBrush.newBrush();
        thisMultiBrush.drawBrushes();
    }
    brushed(end) {
        const thisMultiBrush = this;
        const brushExtents = [];
        this.brushes.forEach(d => {
            const selection = d3.brushSelection(d3.select(thisMultiBrush.plot.bindto + " ." + this.brushId(d.id))
                .node());
            if (selection !== null) {
                const min = d3.min(selection);
                const max = d3.max(selection);
                brushExtents.push([min, max]);
            }
        });
        this.plot.setContCutoff(brushExtents, this.dim, end);
    }
    brushend() {
        const thisMultiBrush = this;
        this.brushed(true);
        // Figure out if our latest brush has a selection
        const lastBrushID = this.brushes[this.brushes.length - 1].id;
        const lastBrush = d3.select(thisMultiBrush.plot.bindto + " ." + this.brushId(lastBrushID));
        const selection = d3.brushSelection(lastBrush.node());
        // If it does, that means we need another one
        if (selection && selection[0] !== selection[1]) {
            this.newBrush();
        }
        // Always draw brushes
        this.drawBrushes();
    }
}

//# sourceMappingURL=maps/multiBrush.js.map
