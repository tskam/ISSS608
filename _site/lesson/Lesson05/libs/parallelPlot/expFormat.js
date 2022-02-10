"use strict";
// eslint-disable-next-line no-unused-vars
class ExpFormat {
    static withExp(siValue) {
        const siStr = /[yzafpnµmkMGTPEZY]/.exec(siValue);
        if (siStr !== null) {
            return siValue.replace(siStr[0], ExpFormat.NONBREAKING_SPACE + "E" + ExpFormat.EXP_FORMATS[siStr[0]]);
        }
        return siValue;
    }
    static instance(value) {
        if (value > 1e3 || value < -1e3 || (value < 1e-3 && value > -1e-3)) {
            return ExpFormat.withExp(ExpFormat.f2s(value));
        }
        return ExpFormat.f3f(value);
    }
}
ExpFormat.NONBREAKING_SPACE = String.fromCharCode(0xA0);
ExpFormat.EXP_FORMATS = {
    "y": "-24",
    "z": "-21",
    "a": "-18",
    "f": "-15",
    "p": "-12",
    "n": "-9",
    "µ": "-6",
    "m": "-3",
    "k": "3",
    "M": "6",
    "G": "9",
    "T": "12",
    "P": "15",
    "E": "18",
    "Z": "21",
    "Y": "24"
};
ExpFormat.f2s = d3.format("~s");
ExpFormat.f3f = d3.format("~r");

//# sourceMappingURL=maps/expFormat.js.map
