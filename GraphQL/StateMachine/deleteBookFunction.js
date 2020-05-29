'use strict';

const { StateExecution } = require('../StateExecution')
let Book = require('../Models/Book')

module.exports.deleteBookFunction = (parent, args, context, info) => new StateExecution().execute([
    { Run: "deleteBookFunction", Next: "DONE", Other: "DONE" }
], { parent, args, context, info }, "NamedType", Book)
