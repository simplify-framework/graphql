'use strict';

class StateExecution {
    runNextExecution({ args, context }, stateObject, states) {
        const _thisFunction = this
        return new Promise((resolve, reject) => {
            const stateFunction = require(`./Functions/${stateObject.Run}`).handler
            console.log("StateExecution:CONTEXT", context)
            return stateFunction(args, context, function (err, data) {
                if (err && stateObject.Other !== "DONE") {
                    console.log("StateExecution:OTHER", data)
                    context.data = data
                    const nextState = states.find(state => state.Run === stateObject.Other)
                    return _thisFunction.runNextExecution({ args, context }, nextState, states)
                } else if (err && stateObject.Other === "DONE") {
                    console.log("StateExecution:ERROR", data)
                    resolve(data)
                } else if (!err && stateObject.Next !== "DONE") {
                    console.log("StateExecution:NEXT", data)
                    context.data = data
                    const nextState = states.find(state => state.Run === stateObject.Next)
                    return _thisFunction.runNextExecution({ args, context }, nextState, states)
                } else if (!err && stateObject.Next === "DONE") {
                    console.log("StateExecution:DONE", data)
                    resolve(data)
                }
            })
        })
    }

    execute(states, args, dataType, dataModel) {
        return new Promise((resolve, reject) => {
            return this.runNextExecution({ args, context: { dataType, dataModel } }, states[0], states)
        })
    }
}

module.exports.StateExecution = StateExecution