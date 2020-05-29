'use strict';

const { AuthorType } = require('./AuthorType')

module.exports.AuthorInput = (context)=> {
    return {
        name: "String",
        type: AuthorType(context)
    }
}
