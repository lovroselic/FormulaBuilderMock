/*jshint -W097 */
/*jshint -W117 */
"use strict";

/**
 * simplifications:
 *      fields and parameters are fixed, in order to simplify display:  making dynamically responise design is OOS for this POC
 *      OR chains ignored at the moment
 * 
 */

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function getSignChar(number) {
    if (number >= 0) return "+";
    return "";
}
function locateStringToDate(str) {
    let d = str.split("/").reverse();
    d[1]--;
    return new Date(...d);
}

const BatchStatuses = ["Registered", "Pending", "Blocked"];
const FractionStatuses = ["Open", "Closed", "Expired"];
const Categorical = ["A", "B", "C"];

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
            category: { data: Categorical.chooseRandom(), dataType: "list", source: Categorical, PG: "DUMMY" }
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

class ParameterEntry {
    constructor(label, table, type, source = null) {
        this.label = label;
        this.table = table;
        this.type = type;
        this.source = source;
        this.expects = 'operator';
        this.state_position = 'parameter';
    }
    updateNextState(state, par) {
        state.parameter = par;
        state.position = this.expects;
    }
    resetState(state) {
        state.position = "parameter";
        state.parameter = null;
    }
}

class OperatorEntry {
    constructor(label) {
        this.label = label;
        this.state_position = 'operator';
        this.expects = 'operand';
        switch (label) {
            case "BETWEEN":
                this.operands = 2;
                break;
            case "IS NOT NULL":
                this.operands = 0;
                break;
            default:
                this.operands = 1;
                break;
        }
    }
    updateNextState(state) {
        state.position = this.expects;
        state.operands = this.operands;
    }
    resetState(state) {
        state.position = "operator";
    }
}

class OperandEntry {
    constructor(label, value, offset_unit = null) {
        this.label = label;
        this.state_position = 'operand';
        this.expects = 'finish';
        this.value = value;
        this.offset_unit = offset_unit;
    }
    resetState(state) {
        state.position = "operand";
    }
    updateNextState(state) {
        state.position = this.expects;
    }
}

const DataBase = [];

const APP = {
    INI: {
        products: 3,
        batches: 3,
        fractions: 3
    },
    version: 0.6,
    parameter_selection: null,
    option_labels: null,
    STACK: null,
    state: null,
    header: null,
    data: null,
    operator_list: ["==", "!=", "<", "<=", ">", ">=", "BETWEEN", "IS NOT NULL"],
    date_offsets: ["Days", "Months", "Years"],
    undo_html: `<div id="undo" class="my-auto"><button class="btn btn-danger" type="button" onclick="APP.undo()"> BACK <i class="bi bi-arrow-counterclockwise"></i></button></div>`,
    denyDate: ["BETWEEN"],
    denyList: ["<", "<=", ">", ">=", "BETWEEN"],
    init() {
        console.log(`%cFB_Mock v${APP.version}`, 'color: green');
        $("#v").html(`v${APP.version} by LS`);
        this.STACK = [];
        this.setInitialState();
        this.generateData();
        this.generateParameterList();
        this.displayTable();
    },
    setInitialState() {
        this.state = {
            position: 'parameter',
            parameter: null,
            finished: false,
            group: 1,
            operands: null,
            parse: false,
            columnIndex: null,
        };
    },
    generateParameterList() {
        const parameter_selection = [];
        const option_labels = [];
        const batch = new Batch(null);
        const fraction = new Fraction(batch);
        const batch_fields = Object.keys(batch.fields);
        const fraction_fields = Object.keys(fraction.fields);
        const batch_parameters = Object.keys(batch.parameters);

        for (let b of batch_fields) {
            const label = `Batch.${b}`;
            const entry = new ParameterEntry(label, "Batch", batch.fields[b].dataType, batch.fields[b].source);
            parameter_selection.push(entry);
            option_labels.push(label);
        }
        for (let f of fraction_fields) {
            const label = `Fraction.${f}`;
            const entry = new ParameterEntry(label, "Fraction", fraction.fields[f].dataType, fraction.fields[f].source);
            parameter_selection.push(entry);
            option_labels.push(label);
        }
        for (let b of batch_parameters) {
            const label = `${batch.parameters[b].PG}.${b}`;
            const entry = new ParameterEntry(label, "Batch", batch.parameters[b].dataType, batch.parameters[b].source);
            parameter_selection.push(entry);
            option_labels.push(label);
        }
        this.parameter_selection = parameter_selection;
        this.option_labels = option_labels;
    },
    generateData(products = this.INI.products, batches = this.INI.batches, fractions = this.INI.fractions) {
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
    },
    displayTable() {
        const [header, data] = this.readDB();
        this.header = header;
        this.data = data;
        this.initBuilder();
        this.displayHeader(header);
        this.displayData(data);
    },
    initBuilder() {
        this.setoptions();
        this.drawCommitCurrent();
    },
    setoptions() {
        const html0 = `
            <div id="parameter${this.state.group}" class="mx-3 my-auto">
                <label for="parameter_options${this.state.group}">Parameter/Field:</label>
                <select name="parameter_options${this.state.group}" id="parameter_options${this.state.group}"></select>
            </div>
        `;
        $("#fb").append(html0);

        let html = "";
        for (let [index, option] of this.option_labels.entries()) {
            html += `<option value="${index}">${option}</option>`;
        }
        $(`#parameter_options${this.state.group}`).append(html);
    },
    drawCommitCurrent() {
        $("#commit").remove();
        let html = `<div id="commit" class="my-auto"><button class="btn btn-success" type="button" onclick="APP.parseCommit()"> NEXT <i class="bi bi-box-arrow-right"></i></button></div>`;
        $("#fb").append(html);
    },
    drawUndo() {
        $("#undo").remove();
        $("#fb").append(this.undo_html);
    },
    insertUndo() {
        $(this.undo_html).insertBefore(`#${this.state.position}${this.state.group}`);
    },
    undo() {
        const last = this.STACK.last();
        last.resetState(this.state);
        this.STACK.pop();
        this.displayFormula();
       
        $(`#${last.state_position}_options${this.state.group}`).prop('disabled', false);
        $(`#value${this.state.group}`).prop('disabled', false);
  
        $("#undo").remove();
        $(`#${last.expects}${this.state.group}`).remove();
        if (this.STACK.length > 0) {
            this.insertUndo();
        }
        $("#end").remove();
        $("#or").remove();
        if (this.state.finished) {
            this.state.finished = false;
            this.drawCommitCurrent();
        }
    },
    parseCommit() {
        switch (this.state.position) {
            case "parameter": return this.commitParameter();
            case "operator": return this.commitOperator();
            case "operand": return this.commitOperand();
            default: throw new Error(`state position pointer error`);
        }
    },
    commitOperand() {
        const dataType = this.state.parameter.type;
        let operand;
        switch (dataType) {
            case "date":
                let value = parseInt($(`#value${this.state.group}`).val(), 10);
                let dateOffset = this.date_offsets[parseInt($(`#operand_options${this.state.group}`).find(":selected").val(), 10)];
                let label = `TODAY ${getSignChar(value)}${value} ${dateOffset}`;
                operand = new OperandEntry(label, value, dateOffset);
                break;
            case "list":
                let val_from_list = this.state.parameter.source[parseInt($(`#operand_options${this.state.group}`).find(":selected").val(), 10)];
                operand = new OperandEntry(val_from_list, val_from_list);
                break;
            case "number":
                let value_numbers = [parseFloat($(`#value${this.state.group}`).val())];
                if (this.state.operands === 2) {
                    value_numbers.push(parseFloat($(`#value${this.state.group}_2`).val()));
                }
                let label_num = value_numbers.join(" AND ");
                operand = new OperandEntry(label_num, value_numbers);
                break;
            default: throw new Error("Wrong datatype");
        }
        operand.updateNextState(this.state);
        $(`#operand_options${this.state.group}`).prop('disabled', 'disabled');
        $(`#value${this.state.group}`).prop('disabled', 'disabled');
        this.next(operand);
    },
    commitOperator() {
        const selected_operator = this.operator_list[parseInt($(`#operator_options${this.state.group}`).find(":selected").val(), 10)];
        const operator = new OperatorEntry(selected_operator);
        operator.updateNextState(this.state);
        $(`#operator_options${this.state.group}`).prop('disabled', 'disabled');
        this.next(operator);
    },
    commitParameter() {
        const selected_par = this.parameter_selection[parseInt($(`#parameter_options${this.state.group}`).find(":selected").val(), 10)];
        selected_par.updateNextState(this.state, selected_par);
        $(`#parameter_options${this.state.group}`).prop('disabled', 'disabled');
        this.next(selected_par);
    },
    next(obj) {
        this.STACK.push(obj);
        this.displayFormula();
        this.drawUndo();
        this[`select_${obj.expects}`]();
        if (!this.state.finished) this.drawCommitCurrent();
    },
    select_finish() {
        this.endSequence();
    },
    select_operator() {
        const html = `
            <div id="operator${this.state.group}" class="mx-3 my-auto">
                <label for="operator_options${this.state.group}">Operator:</label>
                <select name="operator_options${this.state.group}" id="operator_options${this.state.group}"></select>
            </div>
        `;
        $("#fb").append(html);

        let html2 = "";
        let disabled;
        let dType = this.state.parameter.type;
        for (let [index, option] of this.operator_list.entries()) {
            if (
                (['date'].includes(dType) && this.denyDate.includes(option)) ||
                (['list'].includes(dType) && this.denyList.includes(option))
            ) {
                disabled = "disabled";
            } else disabled = "";
            html2 += `<option value="${index}" ${disabled}>${option}</option>`;
        }
        $(`#operator_options${this.state.group}`).append(html2);
    },
    select_operand() {
        if (this.state.operands === 0) return this.endSequence();
        const html = `
            <div id="operand${this.state.group}" class="mx-3 my-auto">
            </div>
        `;
        $("#fb").append(html);

        const dataType = this.state.parameter.type;
        let html_for_value;

        switch (dataType) {
            case "date":
                html_for_value = `
                    <label for = "operand_options${this.state.group}">Date offset:</label>
                    <select name="operand_options${this.state.group}" id="operand_options${this.state.group}"></select>
                `;
                $(`#operand${this.state.group}`).append(html_for_value);
                let html2 = "";
                for (let [index, option] of this.date_offsets.entries()) {
                    html2 += `<option value="${index}">${option}</option>`;
                }
                $(`#operand_options${this.state.group}`).append(html2);

                let value_html2 = `<input id = "value${this.state.group}" type="number" value="0"/>`;
                $(`#operand${this.state.group}`).append(value_html2);
                break;

            case "list":
                html_for_value = `
                    <select name="operand_options${this.state.group}" id="operand_options${this.state.group}"></select>
                `;
                $(`#operand${this.state.group}`).append(html_for_value);
                let html3 = "";
                for (let [index, option] of this.state.parameter.source.entries()) {
                    html3 += `<option value="${index}">${option}</option>`;
                }
                $(`#operand_options${this.state.group}`).append(html3);
                break;
            case "number":
                let value_html3 = `<input id = "value${this.state.group}" type="number" require value="0"/>`;
                $(`#operand${this.state.group}`).append(value_html3);
                if (this.state.operands === 2) {
                    let value_html4 = ` AND <input id = "value${this.state.group}_2" type="number" require value="0"/>`;
                    $(`#operand${this.state.group}`).append(value_html4);
                }
                break;
            default: throw new Error("Wrong datatype");
        }
    },
    drawEnd() {
        let html_end = `
        <div id="end" class="my-auto"><button class="btn btn-primary" type="button" onclick="APP.end_formula()"> ADD FORMULA <i class="bi bi-box-arrow-down"></i></button></div>
        <div id="or" class="my-auto"><button class="btn btn-warning" type="button" onclick="APP.or()"> OR <i class="bi bi-node-plus-fill"></i></button></div>
        `;
        $("#fb").append(html_end);
    },
    end_formula() {
        console.log("ending formula", this.STACK);
        $("#or").remove();
        $("#undo").remove();
        $("#end").remove();
        this.state.parse = true;
        this.state.columnIndex = this.header.indexOf(this.STACK[0].label);
        console.table(this.state);
        this.displayData();
    },
    or() {
        alert("this is not yet implemented!");
    },
    endSequence() {
        $("#commit").remove();
        this.drawEnd();
        this.state.finished = true;
    },
    displayFormula() {
        const labels = this.STACK.map(entry => entry.label);
        $("#display").html(labels.join(" "));
    },
    displayData(data = this.data) {
        $("#table_body").html("");
        for (let row of data) {
            let html = "<tr>";
            for (let [i, column] of row.entries()) {
                if (i === this.state.columnIndex) {
                    let CL = `class="table-danger"`;
                    let complies = this.parseFormula(column);
                    if (complies) {
                        CL = `class="table-success"`;
                    }
                    html += `<td ${CL}>${column}</td>`;
                } else {
                    html += `<td>${column}</td>`;
                }
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
            'ASSAY.assay', 'DUMMY.category',
            'Fraction.id', 'Fraction.status'];
        const data = [];
        for (let p of DataBase) {
            for (let b of p.batches) {
                for (let f of b.fractions) {
                    const row = [
                        p.name,
                        b.id, b.fields.status.data,
                        b.fields.production_date.data.toLocaleDateString(),
                        b.fields.expiration_date.data.toLocaleDateString(),
                        b.parameters.assay.data, b.parameters.category.data,
                        f.id, f.fields.status.data
                    ];
                    data.push(row);
                }
            }
        }
        console.assert(header.length === data[0].length, "Something went wrong ...");
        return [header, data];
    },
    parseFormula(value) {
        const value_data = this.STACK[2] || null;

        switch (this.state.parameter.type) {
            case "date":
                let date = locateStringToDate(value);
                let date_offset = new Date();
                if (this.state.operands > 0) {
                    date_offset[`add${value_data.offset_unit}`](value_data.value);
                    date.setHours(0, 0, 0, 0);
                    date_offset.setHours(0, 0, 0, 0);
                }
                switch (this.STACK[1].label) {
                    case "==": return date.getTime() === date_offset.getTime();
                    case "!=": return date.getTime() !== date_offset.getTime();
                    case "IS NOT NULL": return date != null;
                    case "<": return date < date_offset;
                    case ">": return date > date_offset;
                    case "<=": return date < date_offset || date.getTime() === date_offset.getTime();
                    case ">=": return date > date_offset || date.getTime() === date_offset.getTime();
                }
                break;
            case "list":
                switch (this.STACK[1].label) {
                    case "IS NOT NULL": return value != null;
                    case "==": return value == value_data.label;
                    case "!=": return value != value_data.label;
                }
                break;
            case "number":
                if (this.state.operands === 2) {
                    return value >= this.STACK[2].value[0] && value <= this.STACK[2].value[1];
                }
                switch (this.STACK[1].label) {
                    case "==": return value === this.STACK[2].value[0];
                    case "!=": return value !== this.STACK[2].value[0];
                    case "<": return value < this.STACK[2].value[0];
                    case ">": return value > this.STACK[2].value[0];
                    case "<=": return value <= this.STACK[2].value[0];
                    case ">=": return value >= this.STACK[2].value[0];
                }
                break;
            default: throw new Error('wrong data type');
        }
    }
};

APP.init();