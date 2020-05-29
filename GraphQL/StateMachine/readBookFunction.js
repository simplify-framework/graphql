'use strict';

const { StateExecution } = require('../StateExecution')
let Book = require('../Models/Book')

module.exports.readBookFunction = (parent, args, context, info) => new StateExecution().execute([
    { Run: "checkBookPaid", Next: "readNewBook", Other: "errorPaidBook" },
    { Run: "readNewBook", Next: "doneReadBook", Other: "DONE" },
    { Run: "doneReadBook", Next: "DONE", Other: "DONE" },
    { Run: "errorPaidBook", Next: "DONE", Other: "DONE" }
], { parent, args, context, info }, "NamedType", Book)
