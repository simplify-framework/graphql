const { addBookFunctionSet } = require('./States/addBookFunctionSet')
const { deleteBookFunction } = require('./States/deleteBookFunction')

addBookFunctionSet("parent", {foo: "bar"}, { context: {} }, { info: {} } )
deleteBookFunction("parent", {foo: "bar"}, { context: {} }, { info: {} } )