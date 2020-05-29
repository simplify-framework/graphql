const { addBookFunctionSet } = require('./StateMachine/addBookFunctionSet')
const { deleteBookFunction } = require('./StateMachine/deleteBookFunction')

addBookFunctionSet("parent", {foo: "bar"}, { context: {} }, { info: {} } )
deleteBookFunction("parent", {foo: "bar"}, { context: {} }, { info: {} } )