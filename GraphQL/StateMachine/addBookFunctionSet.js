'use strict';

module.exports.addBookFunctionSet = () => new StateExecution([
    { Run: "checkBookExisted", onSuccess: "addNewBook", onFailure: "doneNewBook", RetryOnFailure: 3 },
    { Run: "addNewBook", onSuccess: "doneNewBook", onFailure: "errorNewBook" },
    { Run: "doneNewBook", onSuccess: "DONE", onFailure: "DONE" },
    { Run: "errorNewBook", onSuccess: "DONE", onFailure: "DONE" }
])
