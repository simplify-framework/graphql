'use strict';

const { StateExecution } = require('../StateExecution')
let Book = require('../Models/Book')

module.exports.addBookFunctionSet = (parent, args, context, info) => new StateExecution().execute([
    { Run: "checkBookExisted", Next: "addNewBook", Other: "doneNewBook", Retry: 3 },
    { Run: "addNewBook", Next: "doneNewBook", Other: "errorNewBook" },
    { Run: "doneNewBook", Next: "DONE", Other: "DONE" },
    { Run: "errorNewBook", Next: "DONE", Other: "DONE" }
], { parent, args, context, info }, "ListType", Book)
