"use strict";
// eslint-disable-next-line no-unused-vars
class RowFilter {
    constructor(column) {
        this.contCutoffs = null;
        this.keptCatIndexes = null;
        this.column = column;
    }
    toggleCategory(catIndex) {
        if (this.column.categories === null) {
            console.log("categories is null but 'toggleCategory' is called.");
        }
        else {
            if (this.keptCatIndexes === null) {
                this.keptCatIndexes = new Set(d3.range(this.column.categories.length));
                this.keptCatIndexes.delete(catIndex);
            }
            else if (this.keptCatIndexes.has(catIndex)) {
                this.keptCatIndexes.delete(catIndex);
            }
            else {
                this.keptCatIndexes.add(catIndex);
                if (this.keptCatIndexes.size === this.column.categories.length) {
                    this.keptCatIndexes = null;
                }
            }
        }
    }
    toggleCategories() {
        if (this.column.categories === null) {
            console.log("categories is null but 'toggleCategories' is called.");
        }
        else {
            if (this.keptCatIndexes === null) {
                this.keptCatIndexes = new Set();
            }
            else {
                this.keptCatIndexes = null;
            }
        }
    }
    getCutoffs() {
        const categories = this.column.categories;
        if (categories !== null) {
            if (this.keptCatIndexes === null) {
                return null;
            }
            return [...this.keptCatIndexes].map(catIndex => categories[catIndex]);
        }
        return this.contCutoffs;
    }
    setCutoffs(cutoffs) {
        if (cutoffs === null) {
            this.contCutoffs = null;
            this.keptCatIndexes = null;
        }
        else {
            const categories = this.column.categories;
            if (categories === null) {
                if (typeof cutoffs[0] === "string" || typeof cutoffs[0] === "number") {
                    console.log("categories is null but categorical cutoffs are provided:", cutoffs);
                }
                else {
                    this.contCutoffs = cutoffs.map(co => {
                        // reverse order
                        return co.sort(function (a, b) {
                            return b - a;
                        });
                    });
                }
            }
            else {
                if (cutoffs.length !== 0 && typeof cutoffs[0] !== "string" && typeof cutoffs[0] !== "number") {
                    console.log("Wrong categorical cutoffs are provided:", cutoffs);
                }
                else {
                    const catCutoffs = cutoffs;
                    const indexes = catCutoffs
                        .map(catCo => {
                        const catIndex = categories.indexOf(catCo);
                        if (catIndex === -1) {
                            console.log(catCo + " is not a category of " + this.column.dim);
                        }
                        return catIndex;
                    })
                        .filter(index => index !== -1);
                    this.keptCatIndexes = new Set(indexes);
                }
            }
        }
    }
    hasFilters() {
        return this.contCutoffs !== null || this.keptCatIndexes !== null;
    }
    isKept(value) {
        if (this.contCutoffs !== null) {
            let active = false;
            this.contCutoffs.forEach(function (contCutoff) {
                active =
                    active ||
                        (contCutoff[1] <= value && value <= contCutoff[0]);
            });
            return active;
        }
        if (this.keptCatIndexes !== null) {
            return this.keptCatIndexes.has(value);
        }
        return true;
    }
}

//# sourceMappingURL=maps/rowFilter.js.map
