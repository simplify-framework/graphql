'use strict';

module.exports.readBookFunction = () => new FunctionExecution([
    { Run: "checkBookPaid", onSuccess: "readNewBook", onFailure: "errorPaidBook" },
    { Run: "readNewBook", onSuccess: "doneReadBook", onFailure: "DONE" },
    { Run: "doneReadBook", onSuccess: "DONE", onFailure: "DONE" },
    { Run: "errorPaidBook", onSuccess: "DONE", onFailure: "DONE" }
])
