/*jshint -W097 */
/*jshint -W117 */
"use strict";

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}


const BatchStatuses = ["Registered", "Pending", "Blocked"];

class Product {
    constructor(name) {
        this.name = name;
        this.batches = [];
    }
    addbatch(batch) {
        this.batches.push(batch);
    }
}

class Batch {
    static last_id = 1;
    constructor(product) {
        this.id = Batch.last_id;
        Batch.last_id++;
        this.product = product;
        this.fractions = [];
        this.fields = {
            production_date: randomDate(new Date(2020, 0, 1), new Date(2021, 11, 31)),
            expiration_date: randomDate(new Date(2022, 0, 1), new Date(2024, 11, 31)),
            status: BatchStatuses.chooseRandom(),
        };
        this.parameters = {
            assay: RNDF(80, 100),
        };
    }
    addFraction(fraction) {
        this.fraction = fraction;
    }
}

const DataBase = [];

const APP = {
    version: 0.1,
    init() {
        //console.clear();
        console.log("FB mock running.");
        $("#v").html(`v${APP.version} by LS`);
        this.generateData();
    },
    generateData(products = 3, batches = 3, fractions = 3) {
        for (let p = 0; p < products; p++) {
            const product = new Product(`PRODUCT${p + 1}`);

            for (let b = 0; b < batches; b++) {
                const batch = new Batch(product);
                product.addbatch(batch);
            }

            DataBase.push(product);

        }

        console.log("DataBase", DataBase);
    }
};

APP.init();