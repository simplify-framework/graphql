'use strict';

const AuthorType = require('./AuthorType')

module.exports.AuthorInput = (context)=> {
    return {
        name: "9052d0cba48426a6",
        type: AuthorType(context)
    }
}
