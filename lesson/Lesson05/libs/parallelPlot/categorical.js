"use strict";
// eslint-disable-next-line no-unused-vars
class Categorical {
    constructor(dim, categories, parallelPlot) {
        this.categories = categories;
        const height = (parallelPlot.axeHeight / categories.length) * Categorical.heightRatio;
        // rowCountsByCat: for each category, how many rows are to spread 
        const rowCountsByCat = categories.map(_c => 0);
        // rowPositionsByRow: for each row, what is its position in the category box
        const rowPositionsByRow = [];
        parallelPlot.sampleData.forEach(row => {
            const rowCount = rowCountsByCat[row[dim]];
            if (typeof rowCount === "undefined") {
                rowPositionsByRow.push(NaN);
            }
            else {
                rowCountsByCat[row[dim]] = rowCount + 1;
                rowPositionsByRow.push(rowCount + 1);
            }
        });
        this.offsets = [];
        parallelPlot.sampleData.forEach((row, i) => {
            const rowCount = rowCountsByCat[row[dim]];
            if (typeof rowCount === "undefined") {
                this.offsets.push(0);
            }
            else {
                let spreaderScale = parallelPlot.catSpreaderMap.get(rowCount);
                if (typeof spreaderScale === "undefined") {
                    spreaderScale = d3.scalePoint()
                        .domain(d3.range(rowCount)); // costly => introduce 'catSpreaderMap'
                    parallelPlot.catSpreaderMap.set(rowCount, spreaderScale);
                }
                spreaderScale.range([(-height / 2) * 0.8, (height / 2) * 0.8]);
                const offset = spreaderScale(rowPositionsByRow[i]);
                if (typeof offset === "undefined") {
                    this.offsets.push(0);
                }
                else {
                    this.offsets.push(offset);
                }
            }
        });
    }
}
Categorical.heightRatio = 0.8;

//# sourceMappingURL=maps/categorical.js.map
