'use strict';

const { StateExecution } = require('../StateExecution')
let Book = require('../Models/Book')

module.exports.getBookFunction = (parent, args, context, info) => new StateExecution().execute([
    { Run: "getBookFunction", Next: "DONE", Other: "DONE" }
], { parent, args, context, info }, "NamedType", Book)
