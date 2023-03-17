/*jshint -W097 */
/*jshint -W117 */
"use strict";

/**
 * simplifications:
 *      fields and parameters are fixed in order to simplify display:  making dynamically responise design is OOS for this POC
 */

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}


const BatchStatuses = ["Registered", "Pending", "Blocked"];
const FractionStatuses = ["Open", "Closed", "Expired"];

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
    constructor(product) {
        this.id = Batch.last_id || (Batch.last_id = 1);
        Batch.last_id++;
        this.product = product;
        this.fractions = [];
        this.fraction_id = 1;

        this.fields = {
            production_date: { data: randomDate(new Date(2020, 0, 1), new Date(2021, 11, 31)), dataType: "date" },
            expiration_date: { data: randomDate(new Date(2022, 0, 1), new Date(2024, 11, 31)), dataType: "date" },
            status: { data: BatchStatuses.chooseRandom(), dataType: "list", source: BatchStatuses },
        };

        this.parameters = {
            assay: { data: RNDF(80, 100), dataType: 'number', PG: 'ASSAY' },
        };
    }
    addFraction(fraction) {
        this.fractions.push(fraction);
    }
}

class Fraction {
    constructor(batch) {
        this.batch = batch;
        this.id = `${batch.id}-F-${batch.fraction_id}`;
        batch.fraction_id++;

        this.fields = {
            status: { data: FractionStatuses.chooseRandom(), dataType: "list", source: FractionStatuses },
        };
    }
}

const DataBase = [];

const APP = {
    version: 0.2,
    init() {
        //console.clear();
        console.log(`%cFB_Mock v${APP.version}`, 'color: green');
        $("#v").html(`v${APP.version} by LS`);
        this.generateData();
        this.displayTable();
    },
    generateData(products = 3, batches = 3, fractions = 3) {
        for (let p = 0; p < products; p++) {
            const product = new Product(`PRODUCT${p + 1}`);
            for (let b = 0; b < batches; b++) {
                const batch = new Batch(product);
                product.addbatch(batch);
                for (let f = 0; f < fractions; f++) {
                    const fraction = new Fraction(batch);
                    batch.addFraction(fraction);
                }
            }
            DataBase.push(product);
        }
        console.table(DataBase);
    },
    displayTable() {
        const [header, data] = this.readDB();
        this.displayHeader(header);
        this.displayData(data);
    },
    displayData(data) {
        for (let row of data) {
            let html = "<tr>";
            for (let column of row) {
                html += `<td>${column}</td>`;
            }
            html += "</tr>";
            $("#table > tbody").append(html);
        }

    },
    displayHeader(header) {
        let html = "";
        for (let col of header) {
            html += `<th scope="col">${col}</th>`;
        }
        $("#table > thead > tr").html(html);

    },
    readDB() {
        const header = ['Product.name',
            'Batch.number', 'Batch.status', 'Batch.production_date', 'Batch.expiration_date',
            'ASSAY.Assay',
            'Fraction.id', 'Fraction.status'];
        const data = [];
        for (let p of DataBase) {
            for (let b of p.batches) {
                for (let f of b.fractions) {
                    const row = [
                        p.name,
                        b.id, b.fields.status.data,
                        b.fields.production_date.data.toLocaleString().split(',')[0],
                        b.fields.expiration_date.data.toLocaleString().split(',')[0],
                        b.parameters.assay.data,
                        f.id, f.fields.status.data
                    ];
                    data.push(row);
                }
            }

        }

        console.assert(header.length === data[0].length, "Something went wrong ...");
        return [header, data];
    }

};

APP.init();