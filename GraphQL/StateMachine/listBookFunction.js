'use strict';

const { StateExecution } = require('../StateExecution')
let Book = require('../Models/Book')

module.exports.listBookFunction = (parent, args, context, info) => new StateExecution().execute([
    { Run: "listBookFunction", Next: "DONE", Other: "DONE" }
], { parent, args, context, info }, "NamedType", Book)
