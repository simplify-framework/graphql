'use strict';

const { Author } = require('./Author')


const { AuthorType } = require('./AuthorType')

module.exports.Book = (context)=> {
    return {
        title: "String",
        author: Author(context),
        comments: [ "String" ],
        outofstock: "Boolean",
        types: [ AuthorType(context) ]
    }
}
