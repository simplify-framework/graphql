'use strict';


const { AuthorType } = require('./AuthorType')

module.exports.Author = (context)=> {
    return {
        id: "ID",
        name: "String",
        type: AuthorType(context)
    }
}
